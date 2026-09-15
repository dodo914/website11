// ============================================================================
// utils/benefitReservation.js
// ----------------------------------------------------------------------------
// P1-3: حجز/استهلاك "المزايا محدودة الاستخدام" بشكل atomic لمنع الاستهلاك
// المزدوج (double consumption) تحت الطلبات المتزامنة.
//
// المشكلة (قبل الإصلاح): كل مزايا العميل دي (كود خصم كوبون بحد استخدام،
// خصم أول طلب، كود ولاء لمرة واحدة) كانت بتتفحص (read) في مكان، وبعدين
// تتحدّث (write) في مكان تاني بعيد (بعد ما يتعمل الـ order فعليًا، أو حتى
// بعد كذا سطر تاني). الفجوة الزمنية دي (TOCTOU: Time-Of-Check to
// Time-Of-Use) هي بالظبط الفجوة اللي بيقدر فيها request تاني (تبويب تاني،
// أو نفس الطلب اتبعت مرتين بالصدفة) يعدي من نفس الفحص قبل ما الأول يسجل
// استخدامه، فيتفق الطلبان على استخدام نفس الميزة "لمرة واحدة".
//
// الإصلاح: كل عملية "فحص + استهلاك" بقت عملية DB واحدة atomic (نفس مبدأ
// decrementStockAtomic في utils/inventory.js بالظبط): الشرط (لسه متاح؟)
// والتحديث (علّمه كمُستخدَم / زوّد العداد) بيحصلوا في نفس الـ
// findOneAndUpdate/updateOne واحدة، فمفيش أي فجوة زمنية يقدر فيها أي
// request تاني "يشوف" الحالة القديمة.
//
// ليه atomic single-document update مش MongoDB transaction؟
// -----------------------------------------------------------------------
// كل واحدة من المزايا دي متخزّنة بالكامل جوه document واحد فقط:
//   - كود الخصم (coupon) وعداد استخدامه: كلها جوه document الـ Settings
//     الوحيد (settings.discountCodes[]).
//   - خصم أول طلب وكود الولاء: كلها جوه document الـ User بتاع العميل
//     نفسه (firstOrderDiscountUsed / loyaltyCodes / loyaltyCodesUsed).
// وMongoDB بتضمن الـ atomicity الكاملة (isolation) لأي update بيمس document
// واحد بس أساسًا - من غير أي حاجة زيادة. استخدام multi-document transaction
// هنا (يلف الـ Settings + الـ User + الـ Order + Product بتاع المخزون مع
// بعض) هيكلّف أداء زيادة (locks أوسع، latency أعلى) من غير أي فايدة حقيقية،
// وهيربط منطق مالوش علاقة ببعضه (الشحن، رفع صورة التحويل، جدولة رسالة
// التأكيد) جوه نفس session، ونفس المبدأ ده هو اللي خلى خصم المخزون في P0
// يتعمل بـatomic conditional update لكل منتج لوحده مش transaction شاملة.
// فبنكمل نفس النمط المتبع فعليًا في المشروع.
//
// أي فشل بعد الحجز (فشل خصم مخزون / فشل إنشاء الـ order نفسه) لازم يرجّع
// (release) الحجز فورًا - نفس فكرة restoreOrderItems بالظبط - عشان الكوبون/
// الميزة ميتاكلش من غير ما يتعمل أي order فعلي.
// ============================================================================

const User = require('../models/User');
const Settings = require('../models/Settings');

// ============================================================
// ===== كود الولاء (لمرة واحدة لكل عميل) =====
// الشرط والتحديث في نفس الـ query: لو الكود مش موجود ضمن loyaltyCodes
// بتاعة العميل، أو موجود ومُستخدَم فعلاً ضمن loyaltyCodesUsed، الـ query
// مش هيلاقي أي document يطابق الشرط، وبالتالي findOneAndUpdate هيرجع null
// (فشل الحجز) - مفيش أي فرصة نتيجة سباق تشوف الحالة القديمة.
// ============================================================
async function reserveLoyaltyCode(userId, code) {
  const updated = await User.findOneAndUpdate(
    { _id: userId, loyaltyCodes: code, loyaltyCodesUsed: { $ne: code } },
    { $addToSet: { loyaltyCodesUsed: code } },
    { new: true }
  );
  return { ok: !!updated, user: updated };
}

async function releaseLoyaltyCode(userId, code) {
  try {
    await User.updateOne({ _id: userId }, { $pull: { loyaltyCodesUsed: code } });
  } catch (err) {
    console.error('releaseLoyaltyCode failed (best-effort):', err.message);
  }
}

// ============================================================
// ===== خصم أول طلب (لمرة واحدة لكل عميل) =====
// نفس المبدأ: الشرط firstOrderDiscountUsed !== true جوه نفس الـ query اللي
// بتعمل الـ $set. لو حصل نفس السباق (تبويبين بيبعتوا أول طلب في نفس
// اللحظة)، الاتنين بيوصلوا لنفس الـ query بالظبط، بس MongoDB بتنفذ الـ
// updates بالتتابع (serialized) على مستوى الـ document نفسه - يبقى واحد
// بس هيلاقي الشرط لسه متحقق ويرجعله document، والتاني هيرجعله null.
// ============================================================
async function reserveFirstOrderDiscount(userId) {
  const updated = await User.findOneAndUpdate(
    { _id: userId, firstOrderDiscountUsed: { $ne: true } },
    { $set: { firstOrderDiscountUsed: true } },
    { new: true }
  );
  return { ok: !!updated, user: updated };
}

async function releaseFirstOrderDiscount(userId) {
  try {
    await User.updateOne({ _id: userId }, { $set: { firstOrderDiscountUsed: false } });
  } catch (err) {
    console.error('releaseFirstOrderDiscount failed (best-effort):', err.message);
  }
}

// ============================================================
// ===== كود خصم (كوبون) بحد استخدام maxUses =====
// discountCodes مخزّنة كـ array جوه document Settings الوحيد في المشروع
// كله (شوف models/Settings.js). عشان نضمن إن findOneAndUpdate ترجع null
// فعليًا لو الحد اتخلص (بدل ما ترجع الـ document بتاع الإعدادات "زي ما هو"
// من غير أي تغيير فعلي وسط لبس هل الحجز نجح ولا لأ)، بنحط شرط الحد الأقصى
// في الـ query الرئيسية نفسها (مش بس في arrayFilters) - فلو محدش من عناصر
// discountCodes حقق الشرط، الـ query الرئيسية نفسها مبتطابقش، وترجع null
// بشكل مضمون 100%.
//
// maxUses بتتاخد كقيمة "معروفة" اتقرت لحظة التحقق الأولي (مش سباق حرج -
// التاجر نادرًا ما يغيّر حد الاستخدام لحظة ما عميل بيشتري، وحتى لو حصل،
// أسوأ سيناريو إننا بنستخدم القيمة الأقدم شوية - وده اتجاه أكثر تحفظًا/أمانًا
// مش أقل، مش هو الـ race المطلوب نمنعه أصلاً وهو usageCount نفسه).
// ============================================================
async function reserveDiscountCodeUsage(code, maxUses) {
  const limited = Number(maxUses) > 0;
  const elemCondition = limited
    ? {
        code,
        isActive: true,
        $or: [{ usageCount: { $exists: false } }, { usageCount: { $lt: Number(maxUses) } }],
      }
    : { code, isActive: true };

  const updated = await Settings.findOneAndUpdate(
    { discountCodes: { $elemMatch: elemCondition } },
    { $inc: { 'discountCodes.$[c].usageCount': 1 } },
    { arrayFilters: [{ 'c.code': code }], new: true }
  );

  if (!updated) return { ok: false };
  const codeDoc = (updated.discountCodes || []).find((c) => String(c?.code) === String(code));
  return { ok: true, codeDoc };
}

async function releaseDiscountCodeUsage(code) {
  try {
    await Settings.updateOne(
      { 'discountCodes.code': code },
      { $inc: { 'discountCodes.$[c].usageCount': -1 } },
      { arrayFilters: [{ 'c.code': code }] }
    );
  } catch (err) {
    console.error('releaseDiscountCodeUsage failed (best-effort):', err.message);
  }
}

// ============================================================
// ===== عداد طلبات الولاء (loyaltyOrderCount) =====
// $inc atomic بيرجع القيمة الجديدة الصحيحة فعليًا مباشرة (findOneAndUpdate
// + new:true) بدل قراءة القيمة القديمة وحساب +1 يدويًا وعمل $set بيها -
// اللي كان بيسبب "lost update" حقيقي: لو طلبين وصلوا لنفس اللحظة وقروا
// نفس القيمة القديمة، كل واحد فيهم كان هيحسب نفس "القيمة+1" ويحفظها بـ
// $set، فيضيع تحديث واحد منهم بالكامل (العداد بيزيد مرة واحدة بس بدل
// مرتين). دلوقتي كل $inc بياخد رقم صحيح ومضمون من MongoDB نفسها.
// ============================================================
async function incrementLoyaltyOrderCount(userId) {
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { loyaltyOrderCount: 1 } },
    { new: true }
  );
  return updated ? updated.loyaltyOrderCount : null;
}

module.exports = {
  reserveLoyaltyCode,
  releaseLoyaltyCode,
  reserveFirstOrderDiscount,
  releaseFirstOrderDiscount,
  reserveDiscountCodeUsage,
  releaseDiscountCodeUsage,
  incrementLoyaltyOrderCount,
};