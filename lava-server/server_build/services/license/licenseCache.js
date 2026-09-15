// ============================================================
// ===== Local License Cache (PART 1B) ==========================
// ============================================================
// Storage choice: in-memory (Map جوه الـprocess) - مش Redis (ممنوع)،
// ومش محتاجين persistence عبر الـrestart هنا لأن الكاش بطبيعته نتيجة
// مشتقة (derived) من License/LicenseActivation في MongoDB - أي restart
// ببساطة بيعيد بناءه من الداتابيز تاني (مفيش فقدان بيانات حقيقي).
//
// الهدف من الملف ده إنه يبقى الـabstraction boundary الوحيد لحالة
// الترخيص المحلية، عشان لو احتجنا نغيّر الـstorage لاحقًا (مثلاً نخزنه
// في collection مخصص أو أي storage تاني) نقدر نستبدل الملف ده بس من
// غير ما نلمس licenseService.js أو أي حد تاني بيستخدمه.
//
// لا تخزن هنا أي secret - الحالة المخزنة بس: status/lastValidatedAt/
// expiresAt/grace period/activation info (بيانات وصفية مش سرية).
//
// ---- PART 1E review notes ----
// - Security: الكاش ده بيخزن الـstatus المحسوب بالفعل (نتيجة
//   computeLicenseStatus) - مش بيعمل "تجاوز" لأي فحص، وTTL محدود
//   (LICENSE_CACHE_TTL، افتراضي 300 ثانية في licenseService.js) بيمنع أي
//   license منتهي/متلغي إنه يفضل "شغال" في الكاش لأجل غير محدد. أقصى مدة
//   ممكن يفضلها license متلغى يظهر active غلط هي TTL نفسه بس (مش أكتر).
// - Invalidation: بيتصفّى صراحة (clearCachedLicenseState) في اللحظات
//   اللي بيتغيّر فيها شيء يخص الترخيص من كودنا (زي activateLicense() بعد
//   إنشاء activation جديدة، وreleaseActivationSlot() بعد revoke). أي كود
//   مستقبلي (Prompt 2) بيغيّر License.status/expiresAt/إلخ مباشرة (مثلاً
//   admin action) **لازم** ينادي licenseCache.clearCachedLicenseState(licenseId)
//   بعد التغيير وإلا هيفضل الكاش القديم شغال لحد ما الـTTL يخلص.
// - النطاق الحالي: ده local-process cache بس (Map في الذاكرة) - مناسب
//   لسيرفر واحد. لو المشروع اتنقل لـmulti-instance/multi-process deployment
//   مستقبلًا، الكاش ده مش هيتشارك بين الـinstances (كل process هيبني كاشه
//   الخاص من الداتابيز) - ده مقبول للمرحلة الحالية لأن مفيش remote
//   validation/enforcement لسه، لكن استراتيجية الـcache/validation
//   المشتركة بين instances متعددة هتتحدد في مرحلة الـremote License Server
//   (Prompt 2+)، مش هنا.

const store = new Map();

/**
 * @typedef {Object} CachedLicenseState
 * @property {string} status - 'active' | 'grace_period' | 'expired' | 'suspended' | 'revoked' | 'invalid'
 * @property {Date|null} lastValidatedAt
 * @property {Date|null} expiresAt
 * @property {Date|null} graceEndsAt
 * @property {Object|null} activation - آخر activation info متاح (مفيش secrets)
 * @property {Date} cachedAt
 */

/**
 * @param {string} licenseId
 * @returns {CachedLicenseState|null}
 */
function getCachedLicenseState(licenseId) {
  return store.get(licenseId) || null;
}

/**
 * @param {string} licenseId
 * @param {Partial<CachedLicenseState>} state
 * @returns {CachedLicenseState}
 */
function setCachedLicenseState(licenseId, state) {
  const record = { ...state, lastValidatedAt: state.lastValidatedAt || new Date(), cachedAt: new Date() };
  store.set(licenseId, record);
  return record;
}

/** @param {string} licenseId */
function clearCachedLicenseState(licenseId) {
  store.delete(licenseId);
}

/**
 * بيتأكد هل الكاش المخزن لسه "طازة" حسب TTL معين (بالثواني) - مفيدة
 * عشان licenseService يقرر يعمل fresh lookup من الداتابيز ولا يستخدم
 * الكاش الحالي.
 * @param {CachedLicenseState|null} cached
 * @param {number} ttlSeconds
 * @returns {boolean}
 */
function isCacheFresh(cached, ttlSeconds) {
  if (!cached || !cached.cachedAt) return false;
  const ttlMs = Math.max(0, Number(ttlSeconds) || 0) * 1000;
  if (ttlMs === 0) return false;
  return Date.now() - new Date(cached.cachedAt).getTime() < ttlMs;
}

/** للتستات فقط. */
function _clearAllForTests() {
  store.clear();
}

module.exports = {
  getCachedLicenseState,
  setCachedLicenseState,
  clearCachedLicenseState,
  isCacheFresh,
  _clearAllForTests,
};