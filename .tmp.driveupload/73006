const LicenseActivation = require('../../models/LicenseActivation');

// ============================================================
// ===== LAVA Remote Activation Discovery (PART 2B-2C-1) =========
// ============================================================
// مسؤولية الملف ده حاجة واحدة بس: يرجّع قائمة activations "مؤهلة"
// للـheartbeat - `[{licenseId, activationId}]` بس، مفيش أي حقل حساس.
//
// PART F (bounded, مش full scan): الـquery هنا مفلترة على
// `status: 'active'` - مش `LicenseActivation.find({})`. ده بيستخدم
// الـindex الموجود بالفعل `{licenseId: 1, status: 1}` (في
// models/LicenseActivation.js من PART 1A) - مفيش index جديد اتضاف.
//
// PART G (eligibility): المعيار الوحيد هنا هو
// `activation.status === 'active'` (القيم الممكنة فعليًا في الـschema
// هي 'active'|'revoked' بس - `ACTIVATION_STATUSES`) - activation
// بحالة 'revoked' محليًا **مبترجعش خالص** من الدالة دي.
//
// PART H (قرار مقصود، اتسجل في التقرير النهائي): الدالة دي **مبتفلترش**
// حسب حالة الـLicense نفسها محليًا (computeLicenseStatus) - يعني license
// منتهية/موقوفة محليًا لسه ممكن يكون عندها activation بحالة 'active' وهي
// دي اللي بترجع هنا. ده مقصود: الهدف من الـheartbeat أصلًا هو معرفة
// الحالة الحقيقية من عند السيرفر البعيد (خصوصًا وقت grace period محلي)،
// ومفيش أي enforcement هنا أو في أي مرحلة لحد دلوقتي بيعتمد على النتيجة
// دي - فمفيش خطر من تضمين activations لـlicenses منتهية محليًا. القرار
// ده قابل لإعادة النظر في مرحلة الـenforcement (2B-2C-2) لو حبينا نوفر
// remote calls غير ضرورية.
//
// الدالة دي **read-only بالكامل** - مفيش أي `.updateOne`/`.save()` هنا.

const DEFAULT_DISCOVERY_LIMIT = 500;

/**
 * بيرجّع قائمة الـactivations المؤهلة لعمل heartbeat عليها.
 * @param {{limit?: number}} [options] - سقف أمان اختياري (مش pagination
 *   حقيقية - النظام الحالي LAVA installation مستقل single-tenant، فعدد
 *   الـactivations متوقع يكون صغير جدًا أصلًا؛ الـlimit ده مجرد حماية
 *   دفاعية من أي نمو غير متوقع، مش سيناريو متوقع فعليًا).
 * @returns {Promise<Array<{licenseId: string, activationId: string}>>}
 */
async function getEligibleActivationsForHeartbeat(options = {}) {
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? options.limit : DEFAULT_DISCOVERY_LIMIT;

  const docs = await LicenseActivation.find(
    { status: 'active' },
    { licenseId: 1, activationId: 1, _id: 0 } // projection صريحة - مفيش fingerprintHash/domain/installationId هنا خالص
  )
    .limit(limit)
    .lean();

  return docs.map((doc) => ({ licenseId: doc.licenseId, activationId: doc.activationId }));
}

module.exports = {
  DEFAULT_DISCOVERY_LIMIT,
  getEligibleActivationsForHeartbeat,
};