// ============================================================
// ===== LAVA Feature Entitlement Foundation (PART 1C) ==========
// ============================================================
// Foundation بس: مفيش أي feature حالية مربوطة بالترخيص فعليًا دلوقتي.
// الهدف إن لما الـLicense Server يتبنى لاحقًا، يقدر يتحكم في الـfeature
// list بتاعة كل License (عن طريق حقل `features` الموجود بالفعل في
// License model من PART 1A) من غير ما نحتاج نغيّر أي كود هنا.
//
// مهم: الـFrontend مش مصدر ثقة لقائمة الـfeatures - القرار دايمًا بيتاخد
// هنا في الباك اند بناءً على `license.features` (المخزنة في MongoDB)،
// مش على أي flag جاي من الفرونت اند.
const KNOWN_FEATURES = [
  'analytics',
  'marketing',
  'shipping',
  'payments',
  'loyalty',
  'recommendations',
  'pwa',
  'advancedReports',
];

/**
 * @param {string} featureName
 * @returns {boolean}
 */
function isKnownFeature(featureName) {
  return typeof featureName === 'string' && KNOWN_FEATURES.includes(featureName);
}

/**
 * بيتأكد هل الـLicense معينة معاها الـfeature المطلوبة ولا لأ.
 * Feature غير معروفة (مش موجودة في KNOWN_FEATURES) دايمًا بترجع false -
 * حتى لو حد حط اسمها غلط جوه license.features بالغلط.
 * @param {{features?: string[]}|null} license
 * @param {string} featureName
 * @returns {boolean}
 */
function hasLicensedFeature(license, featureName) {
  if (!isKnownFeature(featureName)) return false;
  if (!license || !Array.isArray(license.features)) return false;
  return license.features.includes(featureName);
}

module.exports = { KNOWN_FEATURES, isKnownFeature, hasLicensedFeature };