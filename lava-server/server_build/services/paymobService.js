const crypto = require('crypto');

// ===== FIX: بوابة الدفع أحيانًا بتفضل "معلقة" (تسحب سيرفر السيرفر) =====
// السبب رقم 1: fetch() هنا كان من غير أي timeout خالص — لو Paymob اتأخر أو
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

// Paymob Unified Intention API (the current recommended integration — replaces
// the old 3-step auth/order/key flow). Docs: https://developers.paymob.com/egypt/unified-checkout
const PAYMOB_API_BASE = 'https://accept.paymob.com';
const PAYMOB_INTENTION_URL = `${PAYMOB_API_BASE}/v1/intention/`;
const PAYMOB_CHECKOUT_URL = `${PAYMOB_API_BASE}/unifiedcheckout/`;
// Legacy "Accept" API endpoints, still used for refund/void even on accounts
// created through the newer Unified Intention flow.
// IMPORTANT: this legacy auth endpoint needs the separate "API Key" from the
// Paymob dashboard (Settings → Account Info → API Key), NOT the "Secret Key"
// used for the Intention API above. They are two different credentials —
// using the secret key here is what was causing:
//   403 {"detail":"incorrect credentials"}
// (Paymob's own docs: "Secret Key: Used for Intentions... API Key: Used to
// generate a Bearer Token for management APIs".)
const PAYMOB_AUTH_URL = `${PAYMOB_API_BASE}/api/auth/tokens`;
const PAYMOB_REFUND_URL = `${PAYMOB_API_BASE}/api/acceptance/void_refund/refund`;
const PAYMOB_TRANSACTION_INQUIRY_URL = `${PAYMOB_API_BASE}/api/acceptance/transactions`;

const isConfigured = () => Boolean(
  String(process.env.PAYMOB_SECRET_KEY || '').trim() &&
  String(process.env.PAYMOB_PUBLIC_KEY || '').trim() &&
  String(process.env.PAYMOB_INTEGRATION_ID || '').trim()
);

// Separate check for refunds specifically — payment/checkout keeps working
// fine without this, only refunds need it.
const isRefundConfigured = () => Boolean(String(process.env.PAYMOB_API_KEY || '').trim());

const getCurrency = () => String(process.env.PAYMOB_CURRENCY || 'EGP').trim() || 'EGP';

const getIntegrationIds = () => String(process.env.PAYMOB_INTEGRATION_ID || '')
  .split(',')
  .map((s) => Number(String(s).trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

// اختياري بالكامل: لو عايز تقفل الـ intention على وسيلة واحدة بس (مثلاً
// العميل دوس "ادفع بفودافون كاش" في موقعك)، ضيف في .env متغير منفصل لكل
// وسيلة، مثلاً:
//   PAYMOB_INTEGRATION_ID_CARD=5885103
//   PAYMOB_INTEGRATION_ID_WALLET=5885230
// لو المتغير مش موجود لأي وسيلة، أو preferredMethod مش متبعت أصلاً، الكود
// بيرجع لسلوكه القديم زي ما هو بالظبط (كل الـ IDs من PAYMOB_INTEGRATION_ID).
const PAYMOB_METHOD_ENV_KEYS = {
  card: 'PAYMOB_INTEGRATION_ID_CARD',
  wallet: 'PAYMOB_INTEGRATION_ID_WALLET',
};

const getIntegrationIdsForMethod = (method) => {
  const envKey = PAYMOB_METHOD_ENV_KEYS[String(method || '').trim().toLowerCase()];
  if (!envKey) return null; // وسيلة غير معروفة -> استخدم القائمة الكاملة
  const ids = String(process.env[envKey] || '')
    .split(',')
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? ids : null; // المتغير مش مضبوط -> استخدم القائمة الكاملة
};

const getFrontendUrl = () => {
  const configured = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') return 'http://localhost:5173';
  return '';
};

const getBackendUrl = () => {
  const configured = String(process.env.BACKEND_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
    const port = Number(process.env.PORT || 5000);
    return `http://localhost:${Number.isFinite(port) && port > 0 ? port : 5000}`;
  }
  return '';
};

const getCallbackUrl = () => {
  const explicit = String(process.env.PAYMOB_CALLBACK_URL || '').trim();
  if (explicit) return explicit;

  // Browser return URL: Paymob redirects the customer here after checkout,
  // then we redirect on to the frontend. Same pattern as Kashier's callback.
  const base = getBackendUrl();
  return base ? `${base}/api/payments/paymob/callback` : '';
};

const getWebhookUrl = () => {
  // IMPORTANT: do not send a localhost/private URL to Paymob — the server-to-server
  // "Transaction Processed Callback" needs a publicly reachable HTTPS URL.
  const explicit = String(process.env.PAYMOB_WEBHOOK_URL || '').trim();
  if (explicit) return explicit;
  return '';
};

const splitName = (fullName) => {
  const name = String(fullName || '').trim();
  if (!name) return { first: 'NA', last: 'NA' };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: 'NA' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
};

// Paymob's billing_data requires every one of these keys to be present and
// non-empty, even though our checkout only collects a subset (name/phone/email
// /address/governorate). Missing address parts are filled with "NA" — Paymob
// accepts this and it does not affect the actual payment/order.
const buildBillingData = ({ customerName, customerEmail, customerPhone, address, governorate, country }) => {
  const { first, last } = splitName(customerName);
  return {
    first_name: first,
    last_name: last,
    email: String(customerEmail || 'no-email@lava-store.com').trim() || 'no-email@lava-store.com',
    phone_number: String(customerPhone || 'NA').trim() || 'NA',
    apartment: 'NA',
    floor: 'NA',
    street: String(address || 'NA').trim() || 'NA',
    building: 'NA',
    city: String(governorate || 'NA').trim() || 'NA',
    state: String(governorate || 'NA').trim() || 'NA',
    country: String(country || 'EG').trim() || 'EG',
    postal_code: 'NA',
  };
};

// Creates a Paymob "intention" (a hosted-checkout session) and returns the
// Unified Checkout URL to redirect the customer to. Mirrors kashierService's
// buildPaymentUrl(), but Paymob's flow needs a server-side API call first
// (Kashier's hosted checkout is just a signed URL, no pre-call needed).
const createPaymentIntention = async ({ orderId, amount, customerName, customerEmail, customerPhone, address, governorate, country, preferredMethod }) => {
  if (!isConfigured()) {
    const err = new Error('Paymob is not configured');
    err.code = 'PAYMOB_NOT_CONFIGURED';
    throw err;
  }

  // لو الفرونت إند بعت preferredMethod ('card' أو 'wallet') وفيه متغير env
  // مضبوط ليها، نبعت لـ Paymob integration ID واحد بس فتفتح صفحة الدفع
  // مباشرة عليه من غير قائمة اختيار. غير كده، نرجع للسلوك القديم (كل الـ IDs).
  const integrationIds = getIntegrationIdsForMethod(preferredMethod) || getIntegrationIds();
  if (integrationIds.length === 0) {
    const err = new Error('PAYMOB_INTEGRATION_ID is missing or invalid');
    err.code = 'PAYMOB_NOT_CONFIGURED';
    throw err;
  }

  const currency = getCurrency();
  const amountCents = Math.round(Number(amount) * 100);
  const callbackUrl = getCallbackUrl();
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    // بدون notification_url (webhook)، Paymob مش هيبعت أي إشعار سيرفر-لسيرفر بعد
    // الدفع أو في حالة الاسترجاع (refund) من لوحة Paymob — فالطلب هيفضل شكله زي
    // ما هو عندنا في الداتابيز حتى لو اتعمله دفع أو استرجاع فعلي على Paymob.
    console.warn('⚠️  PAYMOB_WEBHOOK_URL غير مضبوط في .env — إشعارات Paymob (خصوصًا الاسترجاع/refund) لن تصل للسيرفر ولن تنعكس على الأدمن أو العميل. اضبط PAYMOB_WEBHOOK_URL على دومين عام (https) يشير لـ /api/payments/paymob/webhook.');
  }

  if (!callbackUrl) {
    const err = new Error('PAYMOB_CALLBACK_URL or BACKEND_URL is required');
    err.code = 'PAYMOB_CALLBACK_MISSING';
    throw err;
  }

  const body = {
    amount: amountCents,
    currency,
    payment_methods: integrationIds,
    items: [],
    billing_data: buildBillingData({ customerName, customerEmail, customerPhone, address, governorate, country }),
    // special_reference must be unique per merchant — our order id fits perfectly,
    // and Paymob echoes it back as order.merchant_order_id on both the webhook
    // and the browser redirect, which is how we look the order back up.
    special_reference: String(orderId),
    extras: { merchantOrderId: String(orderId) },
    redirection_url: callbackUrl,
  };
  if (webhookUrl) body.notification_url = webhookUrl;

  let response;
  let data;
  try {
    response = await fetchWithTimeout(PAYMOB_INTENTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${String(process.env.PAYMOB_SECRET_KEY).trim()}`,
      },
      body: JSON.stringify(body),
    });
    data = await response.json().catch(() => ({}));
  } catch (networkErr) {
    const err = new Error(`Paymob intention request failed: ${networkErr.message}`);
    err.code = 'PAYMOB_REQUEST_FAILED';
    throw err;
  }

  if (!response.ok || !data?.client_secret) {
    const err = new Error(`Paymob intention creation failed: ${response.status} ${JSON.stringify(data)}`);
    err.code = 'PAYMOB_INTENTION_FAILED';
    throw err;
  }

  const publicKey = String(process.env.PAYMOB_PUBLIC_KEY).trim();
  const paymentUrl = `${PAYMOB_CHECKOUT_URL}?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(data.client_secret)}`;

  // DEBUG (تشخيص مؤقت): بنسأل Paymob مباشرة "إيه وسايل الدفع اللي فعليًا
  // live على الـ intention ده؟" — ده هو نفس المصدر اللي صفحة Unified Checkout
  // بتعتمد عليه في إظهار/إخفاء التابات. لو "Wallets" مش موجودة أو live=false
  // هنا، فالمشكلة من حساب/تفعيل Paymob مش من الكود اللي بيبعت الـ payment_methods.
  // احذف الاستدعاء ده بعد ما تخلص تشخيص لو مش عايزه في اللوج بشكل دائم.
  debugLogIntentionPaymentMethods(publicKey, data.client_secret);

  return { paymentUrl, intentionId: data.id || null, clientSecret: data.client_secret };
};

const debugLogIntentionPaymentMethods = async (publicKey, clientSecret) => {
  try {
    const url = `${PAYMOB_API_BASE}/v1/intention/element/${encodeURIComponent(publicKey)}/${encodeURIComponent(clientSecret)}/`;
    const res = await fetchWithTimeout(url);
    const json = await res.json().catch(() => null);
    const methods = json?.payment_methods || [];
    console.log('🔍 Paymob intention payment_methods:', JSON.stringify(methods));
    const wallet = methods.find((m) => String(m?.name || '').toLowerCase().includes('wallet'));
    if (!wallet) {
      console.warn('⚠️  "Wallets" مش راجعة خالص في قائمة وسائل الدفع — على الأغلب integration 5885230 لسه مش مفعّلة (Pending) عند Paymob، أو مش من نوع صحيح لحساب المحافظ. راجع Payment Integrations في الداشبورد.');
    } else if (wallet.live !== true) {
      console.warn('⚠️  "Wallets" موجودة بس live=false — يعني Paymob شايفة الـ integration ID بس مش مفعّلة فعليًا (Pending activation من حساب مانجر Paymob).');
    } else {
      console.log('✅ Wallets integration شغالة (live=true) — لو لسه مش ظاهرة في الصفحة، جرب تفتح اللينك من متصفح تاني/incognito (كاش الصفحة).');
    }
  } catch (err) {
    console.error('Paymob debug intention element fetch failed:', err.message);
  }
};

// Reads a value from either shape Paymob sends us:
//  - webhook JSON body: nested objects, e.g. obj.order.id, obj.source_data.pan
//  - browser callback query string: flat keys that are LITERALLY the dotted
//    name, e.g. req.query['source_data.pan'] (Express does not nest dotted
//    query keys by default), plus a flat "order" key (the Paymob order id).
const getField = (source, dottedKey) => {
  if (!source) return undefined;
  if (Object.prototype.hasOwnProperty.call(source, dottedKey)) return source[dottedKey];
  const parts = dottedKey.split('.');
  let val = source;
  for (const part of parts) {
    if (val == null) return undefined;
    val = val[part];
  }
  return val;
};

// Official field order used to build the HMAC signature string for both the
// "Transaction Processed Callback" (webhook) and the browser response
// callback. Docs: https://developers.paymob.com/egypt/manage-transactions/transaction-webhooks
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction',
  'id', 'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded',
  'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
  'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
];

const verifyHmac = (source, hmacParam) => {
  if (!source || !hmacParam) return false;
  const hmacSecret = String(process.env.PAYMOB_HMAC_SECRET || '');
  if (!hmacSecret) return false;

  const concatenated = HMAC_FIELDS.map((key) => {
    let value;
    if (key === 'order.id') {
      // Nested (webhook): obj.order.id — Flat (browser callback): query.order
      value = getField(source, 'order.id');
      if (value === undefined) value = getField(source, 'order');
    } else {
      value = getField(source, key);
    }
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }).join('');

  const expected = crypto.createHmac('sha512', hmacSecret).update(concatenated).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(hmacParam), 'hex'));
  } catch {
    return false; // length/format mismatch -> treat as invalid
  }
};

const asBool = (val) => val === true || val === 'true';

// Normalizes the two very different payload shapes (webhook JSON body vs.
// browser redirect query string) into one flat, consistent result — same
// idea as kashierService.normalizePaymentResult().
const normalizePaymentResult = (payload = {}) => {
  // Webhook body is { type: 'TRANSACTION', obj: {...} }. The browser callback
  // query string is already flat, so `obj` falls back to the payload itself.
  const obj = payload.obj || payload;

  let orderId = getField(obj, 'merchant_order_id');
  if (orderId == null) orderId = getField(obj, 'order.merchant_order_id');
  if (orderId == null) {
    // Fall back to what we stashed in `extras` when creating the intention.
    orderId = getField(obj, 'extras.merchantOrderId') || getField(obj, 'merchantOrderId');
  }

  const success = asBool(getField(obj, 'success'));
  const pending = asBool(getField(obj, 'pending'));
  const isRefunded = asBool(getField(obj, 'is_refunded'));
  const isVoided = asBool(getField(obj, 'is_voided'));
  const errorOccured = asBool(getField(obj, 'error_occured'));
  const amountCents = getField(obj, 'amount_cents');
  const currency = getField(obj, 'currency');
  const hmac = getField(payload, 'hmac') || getField(obj, 'hmac');
  // Paymob's own transaction id — needed later to issue a refund through the
  // Accept API (that API is keyed on Paymob's transaction id, not ours).
  const transactionId = getField(obj, 'id');

  const refunded = isRefunded;
  const failed = !refunded && !isVoided && !pending && (errorOccured || success === false);
  const isSuccess = !refunded && !isVoided && success === true;

  return {
    orderId: orderId != null ? String(orderId) : null,
    amount: amountCents != null ? Number(amountCents) / 100 : null,
    currency: currency ? String(currency) : null,
    hmac: hmac ? String(hmac) : null,
    transactionId: transactionId != null ? String(transactionId) : null,
    pending,
    success: isSuccess,
    failed,
    refunded,
    raw: payload,
    hmacSource: obj,
  };
};

// ============================================================================
// getTransactionStatus — read-only check against Paymob itself for whether
// this transaction has ALREADY been refunded, straight from the source.
// Used to guard against double refunds when a refund was issued directly
// from the Paymob dashboard (or anywhere outside our app) and our local DB
// doesn't know about it yet — most commonly because a webhook isn't
// configured/reachable (e.g. running on localhost). This works regardless
// of webhook setup, since it asks Paymob directly instead of waiting for
// Paymob to tell us.
// Docs: GET /api/acceptance/transactions/{id}
// ============================================================================
const getTransactionStatus = async (transactionId) => {
  if (!transactionId) return null;
  const secretKey = String(process.env.PAYMOB_SECRET_KEY || '').trim();
  const url = `${PAYMOB_TRANSACTION_INQUIRY_URL}/${encodeURIComponent(transactionId)}`;
  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Authorization: `Token ${secretKey}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    return {
      isRefunded: Boolean(data?.is_refunded),
      isVoided: Boolean(data?.is_voided),
      amountCents: Number(data?.amount_cents ?? NaN),
      raw: data,
    };
  } catch {
    // Network/parse failure — treat as "unknown", caller should not block
    // the refund attempt on an inconclusive check.
    return null;
  }
};

// ============================================================================
// Refund — Paymob has two ways to authenticate this, depending on the
// account type:
//   1) Modern accounts (Intention-only, what you have — no "API Key" field
//      in the dashboard at all): the SAME secret key used for Intentions
//      also covers "Post-pay APIs" (refund/void/capture), sent directly as
//      an "Authorization: Token <secret_key>" header — no separate
//      auth/token step needed.
//   2) Older accounts (still have a distinct "API Key" field): need the
//      legacy 2-step flow — POST api_key to /api/auth/tokens to mint a
//      short-lived auth_token, then send that auth_token in the refund body.
// We try (1) first since that's what your account needs; if PAYMOB_API_KEY
// is set, we fall back to (2) automatically.
// Docs: https://developers.paymob.com (Payment Actions > Refund Transaction Through API)
// ============================================================================
const getAuthToken = async () => {
  const apiKey = String(process.env.PAYMOB_API_KEY || '').trim();
  let response;
  let data;
  try {
    response = await fetchWithTimeout(PAYMOB_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    data = await response.json().catch(() => ({}));
  } catch (networkErr) {
    const err = new Error(`Paymob auth token request failed: ${networkErr.message}`);
    err.code = 'PAYMOB_AUTH_REQUEST_FAILED';
    throw err;
  }
  if (!response.ok || !data?.token) {
    const err = new Error(`Paymob auth token request failed: ${response.status} ${JSON.stringify(data)}`);
    err.code = 'PAYMOB_AUTH_FAILED';
    err.raw = data;
    throw err;
  }
  return data.token;
};

const callPaymobRefund = async (body, headers) => {
  let response;
  let data;
  try {
    response = await fetchWithTimeout(PAYMOB_REFUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    data = await response.json().catch(() => ({}));
  } catch (networkErr) {
    const err = new Error(`Paymob refund request failed: ${networkErr.message}`);
    err.code = 'PAYMOB_REFUND_REQUEST_FAILED';
    throw err;
  }
  if (!response.ok || data?.success !== true) {
    const err = new Error(`Paymob refund failed: ${response.status} ${JSON.stringify(data)}`);
    err.code = 'PAYMOB_REFUND_FAILED';
    err.httpStatus = response.status;
    err.raw = data;
    throw err;
  }
  return data;
};

const refundPayment = async ({ transactionId, amountCents }) => {
  if (!isConfigured()) {
    const err = new Error('Paymob is not configured');
    err.code = 'PAYMOB_NOT_CONFIGURED';
    throw err;
  }
  if (!transactionId) {
    const err = new Error('transactionId is required to issue a Paymob refund');
    err.code = 'PAYMOB_TRANSACTION_ID_MISSING';
    throw err;
  }
  const numericAmountCents = Math.round(Number(amountCents));
  if (!Number.isFinite(numericAmountCents) || numericAmountCents <= 0) {
    const err = new Error('Invalid refund amount');
    err.code = 'PAYMOB_REFUND_INVALID_AMOUNT';
    throw err;
  }

  const secretKey = String(process.env.PAYMOB_SECRET_KEY || '').trim();

  // Attempt 1: modern accounts — secret key straight in the header.
  try {
    const data = await callPaymobRefund(
      { transaction_id: String(transactionId), amount_cents: numericAmountCents },
      { Authorization: `Token ${secretKey}` }
    );
    return data;
  } catch (modernErr) {
    // Attempt 2 (fallback): legacy accounts that still have a separate API Key.
    if (!isRefundConfigured()) {
      // No PAYMOB_API_KEY configured, so there's no legacy fallback to try —
      // surface the modern attempt's real error instead of a misleading
      // "API key missing" message.
      throw modernErr;
    }
    const authToken = await getAuthToken();
    return callPaymobRefund(
      { auth_token: authToken, transaction_id: String(transactionId), amount_cents: numericAmountCents },
      {}
    );
  }
};

// ============================================================================
// reconcileTransactionStatus — FIX (payment stuck on "pending" in TEST/SANDBOX):
// -----------------------------------------------------------------------
// Paymob's "Transaction Processed Callback" (webhook) needs a publicly
// reachable HTTPS URL. While testing locally (or anywhere Paymob's servers
// can't reach us), that webhook never arrives — handlePaymobWebhook never
// runs, the order stays paymentStatus='pending' forever, and the customer is
// stuck on "جاري التأكيد" indefinitely. This is a fallback, NOT a
// replacement for the webhook: it asks Paymob itself (server-to-server, with
// our secret key) for the transaction's real status — the same kind of
// gateway-side verification the webhook already does, just also reachable
// from the status-polling endpoint so it isn't blocked on the webhook having
// reached us.
//
// This never trusts the browser: the transactionId used as the lookup key
// is captured from the callback query string (see handlePaymobCallback), but
// it's only ever used to ask Paymob "what is this transaction's real
// status?" — success/failure/amount always come back from Paymob's own
// response, never from the customer's browser.
// ============================================================================
const reconcileTransactionStatus = async (transactionId) => {
  if (!transactionId) return null;
  const info = await getTransactionStatus(transactionId);
  if (!info || !info.raw) return null;
  // Paymob's transaction-inquiry response uses the same field names as the
  // webhook/callback payload ("success", "pending", "is_refunded",
  // "amount_cents", ...), so reuse the exact same normalizer instead of
  // duplicating that logic here.
  return normalizePaymentResult(info.raw);
};

module.exports = {
  PAYMOB_CHECKOUT_URL,
  isConfigured,
  getCurrency,
  getFrontendUrl,
  getBackendUrl,
  getCallbackUrl,
  getWebhookUrl,
  createPaymentIntention,
  verifyHmac,
  normalizePaymentResult,
  refundPayment,
  getTransactionStatus,
  reconcileTransactionStatus,
};