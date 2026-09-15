// ============================================================================
// HTTP client مشترك لكل شركات الشحن (Bosta/Aramex/DHL/ShipBlu) + Retry System.
//
// قواعد الـRetry (مهم جدًا - راجع الطلب الأصلي):
// - بيعيد المحاولة بس في الحالات دي:
//     * Timeout (انقطاع الاتصال قبل ما يوصل رد)
//     * Network error (فشل الاتصال بالسيرفر نفسه - DNS/Connection refused...)
//     * HTTP 429 (Too Many Requests)
//     * HTTP 5xx (خطأ في سيرفر شركة الشحن)
// - مبيعملش retry تلقائي أبدًا لأي 4xx تاني (400/401/403/404/409/422...) لأن
//   دي أخطاء بيانات/صلاحيات/رفض شحنة، وإعادة المحاولة فيها مش هتغيّر النتيجة
//   وممكن تعمل مشاكل (زي محاولة إنشاء نفس الشحنة تاني من غير داعي).
// - Exponential backoff: أول محاولة فاشلة تستنى شوية، وكل محاولة بعدها تستنى
//   ضعف اللي قبلها (مع سقف أقصى)، عشان منضغطش على سيرفر شركة الشحن وهو أصلاً
//   بيرجع أخطاء.
// - لو شركة الشحن رجعت هيدر Retry-After (موجود غالبًا مع 429)، بنستخدم القيمة
//   دي بالظبط بدل الـbackoff المحسوب، لأنها تعليمات صريحة من السيرفر نفسه.
// - Retry من هنا (طبقة الـHTTP) بيعيد نفس الـrequest (نفس body/headers) - مش
//   مسؤول عن منع الـduplicate shipment؛ الحماية من التكرار مسؤولية طبقة
//   الـidempotency (شوف idempotency.js) اللي بتتأكد إن نفس عملية "إنشاء شحنة"
//   لأوردر معين مع provider معين متتنفذش مرتين حتى لو اتعمل retry هنا أو
//   العميل بعت نفس الـrequest تاني بعد timeout.
// ============================================================================

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;   // أول انتظار بعد أول فشل
const DEFAULT_MAX_DELAY_MS = 8000;   // سقف أقصى لأي انتظار بين المحاولات
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// بيحسب مدة الانتظار قبل المحاولة الجاية: بيفضّل Retry-After (لو موجود وصالح)
// وإلا بيستخدم exponential backoff مع jitter بسيط (عشوائية صغيرة) عشان لو
// أكتر من request بيعملوا retry في نفس اللحظة ميضربوش سيرفر الشركة مع بعض.
function computeDelay(attempt, retryAfterHeader, baseDelayMs, maxDelayMs) {
  if (retryAfterHeader) {
    // Retry-After ممكن يكون عدد ثواني، أو تاريخ HTTP-date - بنتعامل مع الاتنين.
    const asSeconds = Number(retryAfterHeader);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return Math.min(asSeconds * 1000, maxDelayMs);
    }
    const asDate = Date.parse(retryAfterHeader);
    if (!Number.isNaN(asDate)) {
      const diff = asDate - Date.now();
      if (diff > 0) return Math.min(diff, maxDelayMs);
    }
  }
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * baseDelayMs * 0.3;
  return Math.min(exponential + jitter, maxDelayMs);
}

// بيحدد هل الخطأ ده "قابل لإعادة المحاولة" ولا لأ حسب القواعد فوق.
function isRetryableError(err) {
  // أخطاء الشبكة/الـtimeout من fetch مبيبقاش ليها err.status (لأ الطلب أصلاً
  // ما وصلش لسيرفر شركة الشحن أو ما رجعش رد كامل).
  if (!err.status) return true; // network error / abort (timeout) / DNS ...
  return RETRYABLE_STATUS_CODES.has(Number(err.status));
}

/**
 * requestJson(url, options)
 * options زي fetch العادي، وبالإضافة:
 *  - timeout: مدة الـtimeout بالمللي ثانية (افتراضي 15 ثانية)
 *  - retry: false لتعطيل الـretry تمامًا لهذا الطلب بالذات (افتراضي: مفعّل)
 *  - maxRetries: أقصى عدد محاولات إضافية بعد المحاولة الأولى (افتراضي 3)
 *  - baseDelayMs / maxDelayMs: للتحكم في الـexponential backoff
 *  - onRetry(info): callback اختياري بينادى قبل كل محاولة إعادة، بيستقبل
 *    { attempt, delayMs, error } - مفيد للـlogging بدون ما نطبع secrets.
 */
async function requestJson(url, options = {}) {
  const {
    timeout = 15000,
    retry = true,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    onRetry,
    ...fetchOptions
  } = options;

  let attempt = 0;
  // نحتفظ بآخر خطأ عشان نرميه لو استنفدنا كل المحاولات.
  let lastError;

  // عدد "المحاولات" الكلي = محاولة أولى + maxRetries إعادة محاولة (لو retry مفعّل).
  const totalAttempts = retry ? maxRetries + 1 : 1;

  while (attempt < totalAttempts) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

      if (!response.ok) {
        const message = data?.message || data?.error || data?.raw || `HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        err.data = data;
        err.retryAfter = response.headers?.get ? response.headers.get('retry-after') : null;
        throw err;
      }
      return data;
    } catch (rawErr) {
      // AbortError من الـtimeout مالوش status - يبقى قابل لإعادة المحاولة.
      const err = rawErr.name === 'AbortError'
        ? Object.assign(new Error('انتهت مهلة الاتصال بشركة الشحن (Timeout)'), { isTimeout: true })
        : rawErr;
      lastError = err;

      const canRetry = retry && attempt < totalAttempts && isRetryableError(err);
      if (!canRetry) throw err;

      const delayMs = computeDelay(attempt, err.retryAfter, baseDelayMs, maxDelayMs);
      if (typeof onRetry === 'function') {
        try { onRetry({ attempt, delayMs, error: err }); } catch { /* تجاهل أخطاء الـcallback */ }
      }
      await sleep(delayMs);
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  // نظريًا مش المفروض نوصل هنا (الـloop بيرمي أو بيرجع)، بس تحوّط:
  throw lastError || new Error('فشل الاتصال بشركة الشحن');
}

module.exports = { requestJson, isRetryableError, computeDelay };