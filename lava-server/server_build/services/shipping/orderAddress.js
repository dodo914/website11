// ============================================================================
// Generic Order Address Resolver (Phase 3 - مشترك بين كل شركات الشحن)
// ------------------------------------------------------------------------
// المصدر الوحيد لقراءة عنوان الأوردر بشكل موحّد: بيقرأ shippingAddress
// (العنوان المنظّم من Phase 2) ولو حقل فاضي فيه، بيعمل fallback للحقول
// القديمة المسطّحة على الأوردر نفسه (لطلبات ما قبل Phase 2، أو لو
// shippingAddress مش موجود أصلاً).
//
// ده نفس المنطق اللي كان موجود جوه bostaAddressMapper.js بس متعمم هنا عشان
// Aramex/DHL/ShipBlu يستخدموه بدل ما يقرأوا الحقول القديمة بس (اللي كان
// معناه إنهم بيفقدوا district والتفاصيل التانية أصلاً - كانوا شغالين على
// العنوان القديم زي ما هو قبل Phase 2 من غير أي استفادة من shippingAddress).
//
// كل provider-specific mapper (bostaAddressMapper.js /aramexAddressMapper.js/
// dhlAddressMapper.js/shipbluAddressMapper.js) بيبني على النتيجة الموحّدة دي،
// وبعدين كل واحد يحدد الحقول المطلوبة فعليًا عند شركته (بند 7 في الطلب -
// كل شركة requirements مختلفة، مش نفس الحقول لكل الشركات).
// ============================================================================

function firstNonEmpty(...values) {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function resolveOrderAddress(order) {
  const sa = order.shippingAddress || {};
  return {
    fullName: firstNonEmpty(sa.fullName, order.customerName),
    phone: firstNonEmpty(sa.phone, order.customerPhone),
    phone2: firstNonEmpty(sa.phone2, order.customerPhone2),
    email: firstNonEmpty(sa.email, order.customerEmail),
    governorate: firstNonEmpty(sa.governorate, order.governorate),
    district: firstNonEmpty(sa.district),
    detailedAddress: firstNonEmpty(sa.detailedAddress, order.address),
    buildingNumber: firstNonEmpty(sa.buildingNumber),
    floor: firstNonEmpty(sa.floor),
    apartment: firstNonEmpty(sa.apartment),
    landmark: firstNonEmpty(sa.landmark),
    country: firstNonEmpty(sa.country, order.country) || 'مصر',
    zipCode: firstNonEmpty(sa.zipCode, order.zipCode),
  };
}

// بيتحقق إن كل حقل من requiredFields (array من {key,label}) موجود بقيمة
// حقيقية في resolvedAddress - نفس شكل النتيجة اللي كان مستخدم في بوسطة بس
// عام لأي provider يبعتله list الحقول اللي هو محتاجها فعليًا.
function validateRequiredFields(resolvedAddress, requiredFields) {
  const missingKeys = [];
  const missingLabels = [];
  for (const f of requiredFields) {
    if (!resolvedAddress[f.key]) {
      missingKeys.push(f.key);
      missingLabels.push(f.label);
    }
  }
  return { ok: missingKeys.length === 0, missingKeys, missingLabels };
}

// بيبني نص "سطر ثاني" من التفاصيل (مبنى/دور/شقة/علامة مميزة) - مشترك بين
// كل الشركات اللي محتاجة تبعت التفاصيل دي كنص إضافي (Aramex Line2, DHL
// addressLine2, ShipBlu line2).
function buildSecondLine({ buildingNumber, floor, apartment, landmark }) {
  const parts = [];
  if (buildingNumber) parts.push(`مبنى ${buildingNumber}`);
  if (floor) parts.push(`دور ${floor}`);
  if (apartment) parts.push(`شقة ${apartment}`);
  if (landmark) parts.push(`علامة مميزة: ${landmark}`);
  return parts.join(' - ');
}

function structuredError(message, code, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

module.exports = {
  firstNonEmpty,
  resolveOrderAddress,
  validateRequiredFields,
  buildSecondLine,
  structuredError,
};