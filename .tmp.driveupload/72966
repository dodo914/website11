const mongoose = require('mongoose');

// ============================================================
// ===== LAVA License Remote State (PART 2A - foundation) ========
// ============================================================
// بيخزن آخر نتيجة remote validation "ناجحة فعليًا" وموثوقة لكل license -
// ده مختلف عن حاجتين تانيين موجودين بالفعل، ومهم منفرّق بينهم:
//   1) models/License.js -> local license data (بيانات محلية، ممكن تكون
//      قديمة أو seed مبدئي، مش بالضرورة "authoritative" آخر لحظة).
//   2) services/license/licenseCache.js -> local cache freshness بس
//      (Map في الـmemory، بيروح مع أي restart، وTTL قصير لنتيجة
//      computeLicenseStatus المحلية - مالوش علاقة بالـremote خالص).
// الموديل ده هو الحاجة التالتة: "آخر remote state موثوقة" - بيتحدث بس لما
// remote validation تنجح فعليًا (مش أي محاولة، حتى لو فشلت)، وبيفضل موجود
// عبر الـrestarts (MongoDB، مش Memory Map) عشان grace period logic
// (licenseRemoteStateService.js) تقدر تشتغل صح حتى لو الـprocess اتعمله
// restart والـLicense Server كان unreachable وقتها.
//
// ممنوع تمامًا: أي secret أو signing key أو raw HTTP response كامل يتخزن
// هنا - بس الحقول المطبّعة (normalized) من licenseRemoteResponse.js.
const licenseRemoteStateSchema = new mongoose.Schema(
  {
    licenseId: { type: String, required: true, unique: true, index: true },
    status: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    allowedDomains: { type: [String], default: [] },
    maxActivations: { type: Number, default: null },
    features: { type: [String], default: [] },
    buildId: { type: String, default: null },
    // activation info وصفية بس (activationId/status) - شكلها ثابت من
    // normalizeRemoteLicenseResponse()، مش raw object حر.
    activation: { type: mongoose.Schema.Types.Mixed, default: null },
    serverIssuedAt: { type: Date, default: null },
    responseVersion: { type: String, default: null },
    // آخر مرة استلمنا فيها رد "ناجح" فعليًا من الـLicense Server - ده أساس
    // حساب الـfreshness/grace period (مش updatedAt العادي بتاع Mongoose،
    // اللي ممكن يتحدث لأسباب تانية مستقبلًا).
    lastSuccessfulValidationAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LicenseRemoteState', licenseRemoteStateSchema);