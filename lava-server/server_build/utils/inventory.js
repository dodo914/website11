const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');

// ============================================================
// منطق المخزون المركزي — atomic فقط، ولا يقرأ الكمية ثم يخصمها لاحقًا.
//
// decrementStockAtomic:
//   بيحاول يخصم الكمية بشرط أن يكون الـ stock الحالي >= الكمية المطلوبة،
//   في نفس عملية الـ update (findOneAndUpdate واحدة atomic في MongoDB).
//   لو الشرط مش متحقق (مخزون غير كافي أو تغيّر بين لحظة التحقق ولحظة التنفيذ
//   بسبب طلب آخر حصل في نفس اللحظة)، الـ update مش هيرجع أي document ولن
//   يحصل أي خصم إطلاقًا. مفيش أي فرصة لـ race condition لأن كل ده بيحصل
//   داخل عملية واحدة في الداتابيز نفسها.
// ============================================================

const findVariantSizeFilter = (item) => ({
  productId: item.productId,
  variantId: item.variantId,
});

// ===== إصلاح: منتجات من غير ألوان بتيجي بـ variantId وهمي زي "__no_color__"
// (نص عادي مش ObjectId). لو حاولنا نطابقه على variants._id (حقل ObjectId
// رسمي في الداتابيز) هيرمي CastError ويوقف العملية كلها قبل ما توصل
// لمحاولة variants.id (legacy) اللي المفروض تنجح. الدالة دي بتتأكد إن
// القيمة شكلها ObjectId صحيح (24 حرف hex) قبل ما نجرب محاولة _id خالص. =====
const isValidObjectIdString = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

// يحاول الخصم بشرط توفر الكمية. بيرجع { ok: true } أو { ok: false, reason }
async function decrementStockAtomic(item, session) {
  const quantity = Number(item.quantity);

  // نجرب الفلتر بـ variants._id الأول (canonical)، ولو معملوش match نجرب variants.id (legacy)
  // ===== إصلاح: نجرب محاولة _id بس لو القيمة شكلها ObjectId صحيح، عشان
  // منتجات من غير لون (variantId = "__no_color__") متعملش CastError. =====
  const attempts = [];
  if (isValidObjectIdString(item.variantId)) {
    attempts.push({
      filter: {
        _id: item.productId,
        variants: { $elemMatch: { _id: item.variantId, sizeStock: { $elemMatch: { size: item.size, stock: { $gte: quantity } } } } },
      },
      arrayFilters: [{ 'v._id': String(item.variantId) }, { 's.size': item.size, 's.stock': { $gte: quantity } }],
    });
  }
  attempts.push({
    filter: {
      _id: item.productId,
      variants: { $elemMatch: { id: item.variantId, sizeStock: { $elemMatch: { size: item.size, stock: { $gte: quantity } } } } },
    },
    arrayFilters: [{ 'v.id': String(item.variantId) }, { 's.size': item.size, 's.stock': { $gte: quantity } }],
  });

  for (const attempt of attempts) {
    const opts = { arrayFilters: attempt.arrayFilters };
    if (session) opts.session = session;

    const result = await Product.updateOne(
      attempt.filter,
      { $inc: { 'variants.$[v].sizeStock.$[s].stock': -quantity } },
      opts,
    );

    if (result.modifiedCount > 0) {
      return { ok: true };
    }
  }

  return { ok: false, reason: 'OUT_OF_STOCK' };
}

// عكس الخصم (استرجاع كمية) — بتُستخدم عند: فشل إنشاء order بعد خصم مخزون،
// أو إلغاء/رفض/ارتجاع طلب مؤكد. بتحاول بنفس الترتيب (canonical ثم legacy id).
async function restoreStockAtomic(item, session) {
  const quantity = Number(item.quantity);

  // ===== إصلاح: نفس فكرة decrementStockAtomic بالظبط - محاولة _id بس لو
  // القيمة شكلها ObjectId صحيح، عشان منتجات من غير لون متعملش CastError. =====
  const attempts = [];
  if (isValidObjectIdString(item.variantId)) {
    attempts.push({
      filter: { _id: item.productId, 'variants._id': item.variantId, 'variants.sizeStock.size': item.size },
      arrayFilters: [{ 'v._id': String(item.variantId) }, { 's.size': item.size }],
    });
  }
  attempts.push({
    filter: { _id: item.productId, 'variants.id': item.variantId, 'variants.sizeStock.size': item.size },
    arrayFilters: [{ 'v.id': String(item.variantId) }, { 's.size': item.size }],
  });

  for (const attempt of attempts) {
    const opts = { arrayFilters: attempt.arrayFilters };
    if (session) opts.session = session;

    const result = await Product.updateOne(
      attempt.filter,
      { $inc: { 'variants.$[v].sizeStock.$[s].stock': quantity } },
      opts,
    );

    if (result.modifiedCount > 0) {
      return { ok: true };
    }
  }

  return { ok: false, reason: 'PRODUCT_OR_VARIANT_NOT_FOUND' };
}

// يخصم مخزون كل عناصر الطلب بشكل atomic واحد تلو الآخر.
// لو أي عنصر فشل (مخزون غير كافي)، بيرجع كل العناصر السابقة اللي اتخصمت
// (rollback فوري) وبيرجع { ok: false, failedItem } من غير ما يسيب أي أثر.
async function decrementOrderItems(items, session) {
  const decremented = [];

  for (const item of items) {
    const result = await decrementStockAtomic(item, session);
    if (!result.ok) {
      // Rollback أي عنصر اتخصم قبل كده في نفس الطلب
      for (const done of decremented) {
        await restoreStockAtomic(done, session);
        await logMovement(done, 'stock_released', { note: 'rollback بسبب فشل خصم عنصر آخر في نفس الطلب' });
      }
      return { ok: false, failedItem: item };
    }
    decremented.push(item);
  }

  return { ok: true, decremented };
}

// يرجّع مخزون مجموعة عناصر (استخدام عام: rollback فشل إنشاء order، أو cancel/return)
async function restoreOrderItems(items, session) {
  for (const item of items) {
    await restoreStockAtomic(item, session);
  }
}

async function logMovement(item, reason, extra = {}) {
  try {
    await InventoryMovement.create({
      product: item.productId,
      variantId: item.variantId != null ? String(item.variantId) : null,
      size: item.size || null,
      quantity: reason === 'stock_sold' ? -Math.abs(Number(item.quantity)) : Math.abs(Number(item.quantity)),
      reason,
      order: extra.orderId || null,
      user: extra.userId || null,
      note: extra.note || null,
    });
  } catch (err) {
    // فشل تسجيل الحركة لا يجب أن يوقف العملية الأساسية (الخصم/الإرجاع تم فعلاً)
    console.error('Failed to log inventory movement:', err.message);
  }
}

async function logMovementsBulk(items, reason, extra = {}) {
  for (const item of items) {
    await logMovement(item, reason, extra);
  }
}

module.exports = {
  decrementStockAtomic,
  restoreStockAtomic,
  decrementOrderItems,
  restoreOrderItems,
  logMovement,
  logMovementsBulk,
};