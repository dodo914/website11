const crypto = require('crypto');

// ===== FIX: بوابة الدفع أحيانًا بتفضل "معلقة" (تسحب سيرفر السيرفر) =====
// السبب رقم 1: fetch() هنا كان من غير أي timeout خالص — لو Kashier اتأخر أو
// حصلت تقطيعة شبكة، الطلب كان بيفضل واقف من غير حد أقصى للوقت.
// السبب رقم 2 (وده اللي بيفسر "ساعات كل الاسترجاعات بتفشل طول ما السيرفر
// شغال، ولازم أعمل ريستارت"): fetch الأصلي في Node بيعيد استخدام نفس اتصال
// الشبكة (TCP keep-alive) بين كل طلب والتاني، توفيرًا للوقت. لو حصلت تقطيعة
// نت أول مرة تعمل فيها استرجاع، الاتصال ده بيتعطب — وكل استرجاع بعد كده في
// نفس تشغيلة السيرفر بيحاول يستخدم نفس الاتصال المعطوب فيفشل تلقائيًا، لحد
// ما ريستارت السيرفر يفتح اتصالات جديدة من الصفر. الحل: نجبر كل طلب لبوابة
// الدفع إنه يقفل الاتصال بعد ما يخلص (Connection: close) بدل ما يعيد
// استخدامه — فلو اتعطب مرة، الطلب اللي بعده هيفتح اتصال جديد نضيف تلقائيًا.
const GATEWAY_FETCH_TIMEOUT_MS = 15000;
const fetchWithTimeout = (url, options = {}) => fetch(url, {
  ...options,
  headers: { Connection: 'close', ...(options.headers || {}) },
  signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
});

const KASHIER_CHECKOUT_URL = 'https://checkout.kashier.io/';

// Refund API base — separate from the checkout domain above.
// IMPORTANT: this is NOT "test-fep.kashier.io" (the "fep" host from the public
// docs page). We spent a while chasing that host and got a persistent proxy
// error ("Routing key is missing from the URL") no matter which URL shape we
// tried on it. The docs page's "fep" example is unreliable/inconsistent (it
// even contradicts itself about whether the transaction id belongs in the
// URL). What we're using now instead is the host + path pulled from Kashier's
// own official Postman collection (asciisd/kashier repo,
// "Kashier API test.postman_collection.json"), from a request that has an
// ACTUAL saved 200 "SUCCESS" response attached to it (not just a docs
// snippet) — i.e. proof it really works:
//   PUT https://test-api.kashier.io/orders/{orderId}/transactions/{transactionId}?operation=refund
const KASHIER_REFUND_TEST_BASE = 'https://test-api.kashier.io';
const KASHIER_REFUND_LIVE_BASE = 'https://api.kashier.io';

const isConfigured = () => Boolean(
  String(process.env.KASHIER_MID || '').trim() &&
  String(process.env.KASHIER_API_KEY || '').trim() &&
  String(process.env.KASHIER_SECRET_KEY || '').trim()
);

const getMode = () => (String(process.env.KASHIER_MODE || 'test').toLowerCase() === 'live' ? 'live' : 'test');
const getCurrency = () => String(process.env.KASHIER_CURRENCY || 'EGP').trim() || 'EGP';

const getFrontendUrl = () => {
  const configured = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  // Vite's usual local dev port. In production, set FRONTEND_URL explicitly.
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') return 'http://localhost:5173';
  return '';
};

const getBackendUrl = () => {
  const configured = String(process.env.BACKEND_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  // Express' usual local port. In production, set BACKEND_URL explicitly.
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
    const port = Number(process.env.PORT || 5000);
    return `http://localhost:${Number.isFinite(port) && port > 0 ? port : 5000}`;
  }
  return '';
};

const getCallbackUrl = () => {
  const explicit = String(process.env.KASHIER_CALLBACK_URL || '').trim();
  if (explicit) return explicit;

  // Browser callback: Kashier returns the customer to our backend first,
  // then the backend redirects to the frontend. This keeps the callback
  // endpoint independent from the frontend router.
  const base = getBackendUrl();
  return base ? `${base}/api/payments/kashier/callback` : '';
};

const getWebhookUrl = () => {
  // IMPORTANT: do not automatically send localhost/private URLs to Kashier.
  // A server-to-server webhook needs a publicly reachable HTTPS URL.
  const explicit = String(process.env.KASHIER_WEBHOOK_URL || '').trim();
  if (explicit) return explicit;
  return '';
};

// Kashier Hosted Checkout uses an HMAC-SHA256 hash over the merchant/order/payment
// identity. Keep this server-side; the secret must never reach the browser.
//
// Per Kashier's official docs ("Payment Api Keys are used to generate hash order
// and to validate signature"), the HMAC key is the Payment API Key, NOT the
// Secret Key. The signed payload MUST be exactly:
//   /?payment=MID.orderId.amount.currency
const createPaymentHash = ({ merchantId, orderId, amount, currency }) => {
  const paymentApiKey = String(process.env.KASHIER_API_KEY || '');
  const path = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
  return crypto.createHmac('sha256', paymentApiKey).update(path).digest('hex');
};

// القيم المسموحة من Kashier نفسها لباراميتر allowedMethods (راجع الوثائق:
// developers.kashier.io). لو حد بعت قيمة غريبة، بنتجاهلها ونسيب الرابط
// يعرض كل الوسائل زي الوضع الافتراضي — أأمن من رابط مكسور.
const KASHIER_ALLOWED_METHOD_VALUES = ['card', 'wallet', 'bank_installments', 'valu'];

const normalizeAllowedMethods = (methods) => {
  const list = Array.isArray(methods) ? methods : String(methods || '').split(',');
  const cleaned = list
    .map((m) => String(m || '').trim().toLowerCase())
    .filter((m) => KASHIER_ALLOWED_METHOD_VALUES.includes(m));
  return [...new Set(cleaned)];
};

const buildPaymentUrl = ({ orderId, amount, customerEmail, customerPhone, allowedMethods }) => {
  if (!isConfigured()) {
    const err = new Error('Kashier is not configured');
    err.code = 'KASHIER_NOT_CONFIGURED';
    throw err;
  }

  const merchantId = String(process.env.KASHIER_MID).trim();
  const currency = getCurrency();
  const normalizedAmount = Number(amount).toFixed(2);
  const callbackUrl = getCallbackUrl();
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    // بدون serverWebhook، Kashier مش هيبعت أي إشعار سيرفر-لسيرفر لأي حدث بعد الدفع
    // (وأهمها الاسترجاع/refund اللي بيتعمل من لوحة Kashier نفسها) — فالطلب هيفضل
    // شكله زي ما هو (paid) عندنا في الداتابيز حتى لو اتعمله refund فعلي على Kashier.
    // ده أكتر سبب شائع إن الـ admin/العميل ميشوفوش تحديث الـ refund بينما هو ظاهر في Kashier.
    console.warn('⚠️  KASHIER_WEBHOOK_URL غير مضبوط في .env — إشعارات Kashier (خصوصًا الاسترجاع/refund) لن تصل للسيرفر ولن تنعكس على الأدمن أو العميل. اضبط KASHIER_WEBHOOK_URL على دومين عام (https) يشير لـ /api/payments/kashier/webhook، وتأكد إن نفس اللينك مسجل في إعدادات الـ Webhook داخل لوحة تحكم Kashier.');
  }

  if (!callbackUrl) {
    const err = new Error('KASHIER_CALLBACK_URL or FRONTEND_URL is required');
    err.code = 'KASHIER_CALLBACK_MISSING';
    throw err;
  }

  const params = new URLSearchParams({
    merchantId,
    orderId: String(orderId),
    amount: normalizedAmount,
    currency,
    hash: createPaymentHash({ merchantId, orderId: String(orderId), amount: normalizedAmount, currency }),
    merchantRedirect: callbackUrl,
    mode: getMode(),
    display: 'en',
  });

  if (webhookUrl) params.set('serverWebhook', webhookUrl);
  if (customerEmail) params.set('customerEmail', String(customerEmail));
  if (customerPhone) params.set('customerPhone', String(customerPhone));

  // اختياري بالكامل: لو الفرونت إند بعت وسيلة/وسائل محددة (مثلاً العميل دوس
  // "ادفع بفودافون كاش")، بنقفل صفحة Kashier عليها بس فتفتح مباشرة من غير
  // قائمة اختيار. لو مفيش allowedMethods، السلوك زي ما هو بالظبط من قبل
  // (كل الوسائل المفعّلة على الحساب بتظهر).
  const normalizedMethods = normalizeAllowedMethods(allowedMethods);
  if (normalizedMethods.length > 0) params.set('allowedMethods', normalizedMethods.join(','));

  return `${KASHIER_CHECKOUT_URL}?${params.toString()}`;
};

const getPayloadValue = (payload, ...keys) => {
  for (const key of keys) {
    const parts = key.split('.');
    let value = payload;
    for (const part of parts) value = value?.[part];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
};

// Kashier's async webhook body looks like:
//   { "event": "pay" | "refund" | "authorize" | "void" | "capture", "data": { ...transaction fields..., "signatureKeys": [...] } }
// This is a DIFFERENT shape/signature scheme than the Hosted Checkout hash above.
// Docs: https://developers.kashier.io/payment/webhook/
const verifyWebhookSignature = (data, signatureHeader) => {
  if (!data || !signatureHeader) return false;
  const keys = Array.isArray(data.signatureKeys) ? [...data.signatureKeys].sort() : [];
  if (keys.length === 0) return false;

  const querystring = require('querystring');
  const picked = {};
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) picked[key] = data[key];
  }
  const signaturePayload = querystring.stringify(picked);
  const paymentApiKey = String(process.env.KASHIER_API_KEY || '');
  const expected = crypto.createHmac('sha256', paymentApiKey).update(signaturePayload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signatureHeader)));
  } catch {
    return false; // length mismatch etc. -> treat as invalid
  }
};

const normalizePaymentResult = (payload = {}) => {
  // Webhook bodies are { event, data }. Everything else (the browser callback
  // query string) is already flat, so falling back to top-level keys keeps
  // both call sites working with the same function.
  const event = getPayloadValue(payload, 'event');
  const statusRaw = getPayloadValue(
    payload,
    'status',
    'paymentStatus',
    'transactionStatus',
    'result',
    'data.status',
    'data.paymentStatus',
    'data.transactionStatus',
    'data.result'
  );
  const responseCode = getPayloadValue(payload, 'responseCode', 'responseStatus', 'data.responseCode');
  // IMPORTANT: Kashier's own "orderId"/"kashierOrderId" is its internal transaction id, not ours.
  // Our order id is always sent back as "merchantOrderId" (both in the webhook
  // body and in the browser merchantRedirect query string), so it must win.
  const orderId = getPayloadValue(payload, 'merchantOrderId', 'orderId', 'data.merchantOrderId', 'data.orderId');
  const amount = getPayloadValue(payload, 'amount', 'data.amount');
  const currency = getPayloadValue(payload, 'currency', 'data.currency');
  const hash = getPayloadValue(payload, 'hash', 'signature', 'data.hash', 'data.signature');
  // Kashier's own internal order id + transaction id — needed later to issue a
  // refund through the Refund API (that API is keyed on Kashier's ids, not ours).
  const kashierOrderId = getPayloadValue(payload, 'kashierOrderId', 'orderId', 'data.kashierOrderId', 'data.orderId');
  const transactionId = getPayloadValue(payload, 'transactionId', 'data.transactionId');
  const status = String(statusRaw ?? responseCode ?? '').trim().toLowerCase();

  // "refund" is an event TYPE, not a status value — a refund event's own
  // data.status is usually still "SUCCESS" (meaning the refund succeeded).
  const isRefundEvent = String(event || '').trim().toLowerCase() === 'refund';
  const isVoidEvent = String(event || '').trim().toLowerCase() === 'void';

  const successStatus = ['success', 'successful', 'paid', 'completed', 'approved', 'succeeded', '00', '2'].includes(status);
  const failedStatus = ['failed', 'failure', 'declined', 'cancelled', 'canceled', 'expired', 'error', 'rejected'].includes(status);

  const refunded = isRefundEvent && successStatus;
  const success = successStatus && !isRefundEvent && !isVoidEvent;
  const failed = failedStatus || isVoidEvent;

  return {
    event: event ? String(event) : null,
    orderId: orderId ? String(orderId) : null,
    amount: amount != null ? Number(amount) : null,
    currency: currency ? String(currency) : null,
    hash: hash ? String(hash) : null,
    kashierOrderId: kashierOrderId ? String(kashierOrderId) : null,
    transactionId: transactionId ? String(transactionId) : null,
    status,
    success,
    failed,
    refunded,
    raw: payload,
  };
};

// ============================================================================
// Refund — two different Kashier refund endpoints exist and this account's
// transactions only seem to be visible on one of them, so we try both and
// fall back automatically instead of guessing again and burning another
// round trip on it:
//
//   1) "v3" endpoint (fep host) — this is the CURRENT request template in
//      Kashier's own official Postman collection (asciisd/kashier repo,
//      "Kashier API test.postman_collection.json"):
//        PUT {fepBase}/v3/orders/{orderId}
//        body: { apiOperation: "REFUND", reason, transaction: { amount, targetTransactionId } }
//
//   2) legacy endpoint (api host) — an OLDER request in the same collection
//      that has an actual saved 200 "SUCCESS" response attached to it:
//        PUT {apiBase}/orders/{orderId}/transactions/{transactionId}?operation=refund
//        body: { amount }
//      We tried this one already and got a clean 404 (not the earlier
//      "routing key missing" proxy error) — meaning this order/transaction
//      just isn't visible on the legacy host, most likely because this
//      account's transactions run on Kashier's newer platform. We keep it
//      as a fallback in case some other order *was* created the old way.
//
// NOTE: both ids are KASHIER's own ids (order.paymentGateway.kashierOrderId /
// transactionId), not our Mongo order id. They only exist once a payment has
// actually gone through the webhook/callback and we captured them (see
// paymentController.markPaid).
// ============================================================================
const KASHIER_REFUND_FEP_TEST_BASE = 'https://test-fep.kashier.io';
const KASHIER_REFUND_FEP_LIVE_BASE = 'https://fep.kashier.io';

const getRefundApiBase = () => (getMode() === 'live' ? KASHIER_REFUND_LIVE_BASE : KASHIER_REFUND_TEST_BASE);
const getRefundFepBase = () => (getMode() === 'live' ? KASHIER_REFUND_FEP_LIVE_BASE : KASHIER_REFUND_FEP_TEST_BASE);

// ============================================================================
// getOrderStatus — read-only check against Kashier itself for how much of
// this order has ACTUALLY been refunded so far, straight from the source.
// Used to guard against double refunds when a refund was issued directly
// from the Kashier dashboard (or anywhere outside our app) and our local DB
// doesn't know about it yet — most commonly because KASHIER_WEBHOOK_URL
// isn't configured/reachable (e.g. running on localhost). This check works
// regardless of whether the webhook is set up, since it asks Kashier
// directly instead of waiting for Kashier to tell us.
// ============================================================================
const getOrderStatus = async (kashierOrderId) => {
  if (!kashierOrderId) return null;
  const secretKey = String(process.env.KASHIER_SECRET_KEY || '').trim();
  const url = `${getRefundFepBase()}/v3/orders/${encodeURIComponent(kashierOrderId)}`;
  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Authorization: secretKey, accept: 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    const order = data?.response || data;
    return {
      totalCapturedAmount: Number(order?.totalCapturedAmount ?? order?.amount ?? NaN),
      totalRefundedAmount: Number(order?.totalRefundedAmount ?? 0),
      raw: data,
    };
  } catch {
    // Network/parse failure — treat as "unknown", caller should not block
    // the refund attempt on an inconclusive check.
    return null;
  }
};

const callKashierRefund = async (url, body, secretKey) => {
  let response;
  let data;
  try {
    response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: {
        Authorization: secretKey,
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    data = await response.json().catch(() => ({}));
  } catch (networkErr) {
    const err = new Error(`Kashier refund request failed: ${networkErr.message}`);
    err.code = 'KASHIER_REFUND_REQUEST_FAILED';
    err.url = url;
    throw err;
  }

  // Two different response shapes exist depending on which endpoint answered:
  //  - v3/fep shape: top-level "status": "SUCCESS" and/or
  //    response.result === "SUCCESS", with response.status describing the
  //    ORDER's new state ("REFUNDED" / "PARTIALLY_REFUNDED") — NOT "SUCCESS".
  //    Checking response.status alone (as we used to) wrongly treated a real
  //    successful refund as a failure, because response.status here is
  //    "REFUNDED", never "SUCCESS".
  //  - legacy endpoint shape: response.status === "SUCCESS" directly.
  // So we accept any of these as success:
  const isSuccess =
    data?.status === 'SUCCESS' ||
    data?.response?.result === 'SUCCESS' ||
    data?.response?.status === 'SUCCESS' ||
    data?.response?.status === 'REFUNDED' ||
    data?.response?.status === 'PARTIALLY_REFUNDED';

  if (!response.ok || !isSuccess) {
    const err = new Error(`Kashier refund failed: ${response.status} ${JSON.stringify(data)} (url: ${url})`);
    err.code = 'KASHIER_REFUND_FAILED';
    err.httpStatus = response.status;
    err.raw = data;
    err.url = url;
    throw err;
  }

  return data;
};

const refundPayment = async ({ kashierOrderId, transactionId, amount, reason }) => {
  if (!isConfigured()) {
    const err = new Error('Kashier is not configured');
    err.code = 'KASHIER_NOT_CONFIGURED';
    throw err;
  }
  if (!kashierOrderId) {
    const err = new Error('kashierOrderId is required to issue a Kashier refund');
    err.code = 'KASHIER_ORDER_ID_MISSING';
    throw err;
  }
  if (!transactionId) {
    const err = new Error('transactionId is required to issue a Kashier refund');
    err.code = 'KASHIER_TRANSACTION_ID_MISSING';
    throw err;
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    const err = new Error('Invalid refund amount');
    err.code = 'KASHIER_REFUND_INVALID_AMOUNT';
    throw err;
  }

  const secretKey = String(process.env.KASHIER_SECRET_KEY || '').trim();

  // Attempt 1: the "v3" fep endpoint.
  const fepUrl = `${getRefundFepBase()}/v3/orders/${encodeURIComponent(kashierOrderId)}`;
  const fepBody = {
    apiOperation: 'REFUND',
    reason: String(reason || 'Refund requested by merchant'),
    transaction: { amount: numericAmount, targetTransactionId: String(transactionId) },
  };

  try {
    return await callKashierRefund(fepUrl, fepBody, secretKey);
  } catch (fepErr) {
    // Attempt 2 (fallback): the legacy api host endpoint.
    const legacyUrl = `${getRefundApiBase()}/orders/${encodeURIComponent(kashierOrderId)}/transactions/${encodeURIComponent(transactionId)}?operation=refund`;
    const legacyBody = { amount: String(numericAmount) };

    try {
      return await callKashierRefund(legacyUrl, legacyBody, secretKey);
    } catch (legacyErr) {
      const err = new Error(
        `Kashier refund failed on both endpoints.\n` +
        `1) v3/fep (${fepUrl}): ${fepErr.message}\n` +
        `2) legacy (${legacyUrl}): ${legacyErr.message}`
      );
      err.code = 'KASHIER_REFUND_FAILED';
      err.raw = { fep: fepErr.raw, legacy: legacyErr.raw };
      throw err;
    }
  }
};

// ============================================================================
// reconcilePaymentStatus — FIX (payment stuck on "pending" in TEST/SANDBOX):
// -----------------------------------------------------------------------
// KASHIER_WEBHOOK_URL must be a publicly reachable HTTPS URL. While testing
// locally (or on a box Kashier's servers can't reach), Kashier has no way to
// deliver the "pay" webhook at all — so handleKashierWebhook never runs, the
// order sits on paymentStatus='pending' forever, and the customer is stuck
// looking at "جاري التأكيد" indefinitely because nothing ever moves it past
// pending. This is a fallback, NOT a replacement for the webhook: it asks
// Kashier itself (server-to-server, with our secret key) what the real state
// of the order is, the exact same "verify with the gateway" check the
// webhook already does — it just also runs from the status-polling endpoint
// so it doesn't depend on the webhook having reached us.
//
// This never trusts the browser: the kashierOrderId used as the lookup key
// was captured from the merchantRedirect query string (see
// handleKashierCallback), but that ID is only used to ask Kashier "what is
// this order's real status?" — the actual success/failure/amount used to
// decide anything always comes back from Kashier's own response, never from
// the customer's browser.
// ============================================================================
const reconcilePaymentStatus = async (kashierOrderId) => {
  if (!kashierOrderId) return null;
  const info = await getOrderStatus(kashierOrderId);
  if (!info || !info.raw) return null;

  const responseObj = info.raw.response || info.raw;
  // Kashier's order-status payload is expected to carry the same
  // status/amount/currency field names as the webhook body, so we reuse the
  // exact same success/failure keyword logic instead of duplicating it.
  const normalized = normalizePaymentResult(responseObj);

  // Belt-and-suspenders: if the payload doesn't expose a status keyword we
  // recognize, fall back to inferring success from the captured amount
  // Kashier itself reports (only ever used as a positive signal, never to
  // downgrade an already-detected failure).
  if (!normalized.success && !normalized.failed) {
    if (Number.isFinite(info.totalCapturedAmount) && info.totalCapturedAmount > 0) {
      normalized.success = true;
    }
  }
  if (normalized.amount == null && Number.isFinite(info.totalCapturedAmount)) {
    normalized.amount = info.totalCapturedAmount;
  }
  return normalized;
};

module.exports = {
  KASHIER_CHECKOUT_URL,
  isConfigured,
  getMode,
  getCurrency,
  getFrontendUrl,
  getBackendUrl,
  getCallbackUrl,
  getWebhookUrl,
  createPaymentHash,
  buildPaymentUrl,
  normalizePaymentResult,
  verifyWebhookSignature,
  refundPayment,
  getRefundApiBase,
  getOrderStatus,
  reconcilePaymentStatus,
};