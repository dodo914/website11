// ============================================================
// ===== LAVA Remote License Configuration (PART 2A) =============
// ============================================================
// Foundation بس - بيقرا env vars الخاصة بالربط المستقبلي مع License
// Server خارجي. **لا يوجد License Server حقيقي دلوقتي** ومفيش أي كود هنا
// أو في أي ملف تاني بيعمل HTTP call فعلي - ده كله جاهز بس لـPrompt 2B/2C.
//
// أسماء الـenv vars:
//   - LICENSE_SERVER_URL: موجودة بالفعل من PART 1A (.env.example) -
//     استخدمناها زي ما هي، مفيش duplicate جديد بنفس المعنى.
//   - LICENSE_REMOTE_ENABLED: جديد. منفصل عمدًا عن LICENSE_ENABLED
//     (الموجود بالفعل) - LICENSE_ENABLED بيتحكم في تفعيل local
//     enforcement (middleware) بشكل عام، أما LICENSE_REMOTE_ENABLED
//     فبيتحكم في حاجة أضيق (هل نحاول remote communication أصلًا ولا لأ) -
//     ممكن نفعّل local enforcement من غير remote خالص (بالظبط الوضع
//     الحالي)، فمش نفس المفهوم.
//   - LICENSE_REMOTE_TIMEOUT_MS: جديد - timeout لأي HTTP request مستقبلي
//     لـLicense Server (يستخدمه الـtransport في licenseRemoteClient.js).
//   - LICENSE_REMOTE_GRACE_PERIOD_HOURS: جديد - مختلف تمامًا عن
//     LICENSE_GRACE_PERIOD الموجودة بالفعل (اللي بالأيام، ومستخدمة في
//     computeLicenseStatus لحساب grace period بعد انتهاء expiresAt محليًا).
//     ده بالساعات، ومستخدم في licenseRemoteStateService.js لحساب أد إيه
//     نقدر نستمر نثق في آخر remote validation ناجحة لو السيرفر بقى
//     unreachable مؤقتًا. مفيش تعارض أو تكرار في المعنى، فسبنا الاتنين
//     منفصلين بأسماء واضحة.
//
// كل القيم هنا placeholders/defaults بس - مفيش أي secret حقيقي.

const DEFAULT_REMOTE_TIMEOUT_MS = 5000;
const DEFAULT_REMOTE_GRACE_PERIOD_HOURS = 72;

/**
 * هل remote license communication مفعّل أصلًا؟ افتراضي: false (زي كل حاجة
 * في الـLicense Foundation دي - non-blocking/off by default).
 * @returns {boolean}
 */
function isRemoteEnabled() {
  return String(process.env.LICENSE_REMOTE_ENABLED || 'false').trim().toLowerCase() === 'true';
}

/**
 * بيرجّع LICENSE_SERVER_URL لو متحدد، وإلا null - من غير أي throw. لو
 * remote مش مفعّل أصلًا، القيمة دي مش مهمة (متتقراش حتى) - النظام يشتغل
 * طبيعي 100% محليًا.
 * @returns {string|null}
 */
function getRemoteServerUrl() {
  const raw = (process.env.LICENSE_SERVER_URL || '').trim();
  return raw || null;
}

/**
 * @returns {number} timeout بالميلي ثانية - default آمن لو القيمة مش
 *   موجودة أو مش رقم صالح أو <= 0.
 */
function getRemoteTimeoutMs() {
  const raw = Number(process.env.LICENSE_REMOTE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_REMOTE_TIMEOUT_MS;
}

/**
 * @returns {number} عدد الساعات - default آمن لو القيمة مش موجودة أو مش
 *   رقم صالح أو سالبة.
 */
function getRemoteGracePeriodHours() {
  const raw = Number(process.env.LICENSE_REMOTE_GRACE_PERIOD_HOURS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_REMOTE_GRACE_PERIOD_HOURS;
}

/**
 * "Configured" معناها هنا: remote مفعّل صراحة + عندنا URL فعلي. لو
 * remote مش مفعّل، أو مفعّل لكن الـURL فاضي (misconfiguration) - النتيجة
 * false في الحالتين، ومفيش أي محاولة اتصال هتحصل (licenseRemoteClient.js
 * بيتأكد من الدالة دي قبل أي حاجة).
 * @returns {boolean}
 */
function isRemoteConfigured() {
  return isRemoteEnabled() && Boolean(getRemoteServerUrl());
}

module.exports = {
  isRemoteEnabled,
  getRemoteServerUrl,
  getRemoteTimeoutMs,
  getRemoteGracePeriodHours,
  isRemoteConfigured,
  DEFAULT_REMOTE_TIMEOUT_MS,
  DEFAULT_REMOTE_GRACE_PERIOD_HOURS,
};