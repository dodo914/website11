const crypto = require('crypto');

// ============================================================
// ===== LAVA Installation Fingerprint (PART 1B) ================
// ============================================================
// بيولّد fingerprint ثابت نسبيًا للـinstallation، من غير أي معلومة
// شخصية أو invasive tracking:
//   - ممنوع: MAC address, hardware serial, browser fingerprint, أي
//     بيانات شخصية.
//   - بيعتمد بس على: licenseId + buildId + installationId + normalizedDomain
//     (كلهم قيم خاصة بالـinstallation نفسها مش بجهاز/متصفح حد معين).
// النتيجة hash واحد اتجاهي (SHA-256) - مش ممكن ترجّع منه القيم الأصلية.
//
// ملاحظات أمان:
//   - الدالة دي pure: نفس المدخلات = نفس الناتج دايمًا (deterministic)،
//     وبتتغيّر بس لو installation context اتغيّر فعلًا (زي تغيير الدومين).
//   - ممنوع نطبع/نسجل (console.log) أي من المدخلات الخام هنا.
//   - الملف ده مبيخزنش حاجة بنفسه - الـcaller (licenseService) هو اللي
//     بيقرر يخزن الـhash الناتج (fingerprintHash) في LicenseActivation،
//     مش أي raw input.

/**
 * بينضّف الدومين لصيغة موحدة (بدون protocol/www/trailing slash) عشان
 * نفس الدومين ديمًا ينتج نفس الـfingerprint حتى لو اتكتب بأشكال مختلفة.
 * @param {string} domain
 * @returns {string}
 */
function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return '';
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split('/')[0]
    .split(':')[0]; // بدون port
}

/**
 * بيولّد installation fingerprint hash (SHA-256 hex) من installation
 * context بس - مفيهوش أي بيانات شخصية أو هاردوير.
 * @param {{licenseId: string, buildId: string, installationId: string, domain: string}} input
 * @returns {string} SHA-256 hex digest
 */
function createFingerprint({ licenseId, buildId, installationId, domain }) {
  if (!licenseId || !buildId || !installationId) {
    throw new Error('createFingerprint requires licenseId, buildId and installationId');
  }

  const normalizedDomain = normalizeDomain(domain);
  // separator ثابت (\u0000) بيمنع تصادم لو أي قيمة فيها حرف زي "-" بيتكرر
  // بين القيم فيتلخبط الـconcatenation.
  const material = [licenseId, buildId, installationId, normalizedDomain].join('\u0000');

  return crypto.createHash('sha256').update(material).digest('hex');
}

module.exports = { createFingerprint, normalizeDomain };
