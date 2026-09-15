// ============================================================================
// utils/orderIdempotencyKey.js  (P1-1: Order Creation Idempotency)
// ------------------------------------------------------------------------
// دالة صغيرة نقية (pure) لاستخراج مفتاح idempotency الخاص بإنشاء الطلب من
// الـrequest - منفصلة عن controllers/orderController.js عشان تتختبر
// مباشرة من غير الحاجة لمحاكاة كل الـDB/services اللي createOrder بتستخدمها.
//
// أقصى طول منطقي لمفتاح idempotency القادم من العميل (حماية من قيم كبيرة/هجومية).
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

/**
 * buildOrderIdempotencyKey(req)
 *
 * بيقرأ مفتاح idempotency من هيدر "Idempotency-Key" (المعيار الشائع) أو
 * "X-Idempotency-Key"، أو من req.body.idempotencyKey كـfallback. بيربط
 * المفتاح بهوية مقدّم الطلب (customerId المسجّل أو 'guest') عشان عميل
 * ميقدرش يستخدم مفتاح عميل تاني عمدًا ويشوف نتيجة/بيانات طلب مش بتاعه.
 *
 * بيرجع null لو مفيش مفتاح مُرسل أصلاً (سلوك مُعرَّف بوضوح: إنشاء الطلب
 * بيكمل بنفس السلوك القديم من غير أي حماية إضافية - شوف orderController.js).
 *
 * بيرجع { idempotencyKey, scope } لو فيه مفتاح صالح.
 */
function buildOrderIdempotencyKey(req) {
  const headers = (req && req.headers) || {};
  const body = (req && req.body) || {};

  const rawIdemKey = headers['idempotency-key'] || headers['x-idempotency-key'] ||
    (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null);
  const trimmedIdemKey = typeof rawIdemKey === 'string' ? rawIdemKey.trim() : '';

  if (!trimmedIdemKey) return null;

  const scope = (req && req.user && req.user._id) ? `user:${req.user._id}` : 'guest';
  const idempotencyKey = `${scope}:${trimmedIdemKey.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH)}`;

  return { idempotencyKey, scope };
}

// ============================================================================
// hashOrderPayload(orderData)
// ------------------------------------------------------------------------
// SECURITY HARDENING: same Idempotency-Key + a *different* request body must
// be rejected, not silently replayed/executed. Previously claimOrderIdempotency
// only keyed on `key`, so a client (or attacker who guessed/reused a header)
// sending a different cart/discount code with the same key would either get
// a stale replay of an unrelated order, or - while the first request was
// still in flight - a second, different order created concurrently under the
// same key.
//
// We hash only the fields that define "what is being purchased" (items,
// discount code/type, payment method, address essentials). Prices/totals are
// intentionally excluded - the server recomputes those from trusted data
// anyway (see calculateEffectiveProductPrice/computeShippingCost above), so
// they are not part of "the same logical request".
// ============================================================================
const crypto = require('crypto');

function hashOrderPayload(orderData) {
  const data = orderData || {};
  const items = Array.isArray(data.items)
    ? data.items
        .map((it) => ({
          productId: String(it?.productId || ''),
          variantId: String(it?.variantId || ''),
          size: String(it?.size || ''),
          quantity: Number(it?.quantity) || 0,
        }))
        // ترتيب ثابت عشان نفس السلة بترتيب مختلف تدي نفس الـhash بالظبط.
        .sort((a, b) => (a.productId + a.variantId + a.size).localeCompare(b.productId + b.variantId + b.size))
    : [];

  const normalized = {
    items,
    discountType: data.discountType || null,
    discountCode: data.discountCode ? String(data.discountCode).trim().toUpperCase() : null,
    paymentMethod: data.paymentMethod || null,
    governorate: data.governorate || null,
    address: data.address || null,
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

module.exports = { buildOrderIdempotencyKey, hashOrderPayload, MAX_IDEMPOTENCY_KEY_LENGTH };