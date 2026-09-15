const LicenseRemoteState = require('../../models/LicenseRemoteState');
const { normalizeRemoteLicenseResponse } = require('./licenseRemoteResponse');
const { getRemoteGracePeriodHours } = require('./licenseRemoteConfig');

// ============================================================
// ===== LAVA Remote License State Service (PART 2A - foundation) =====
// ============================================================
// الملف ده بيفصل بوضوح بين 4 مفاهيم مختلفة (زي ما اتطلب):
//   1) Local license data      -> models/License.js (مش هنا).
//   2) Last successful remote state -> LicenseRemoteState (هنا،
//      persisted في MongoDB، بيتحدث بس عند نجاح remote validation فعلي).
//   3) Local cache freshness   -> services/license/licenseCache.js (كاش
//      قصير المدى في الـmemory لنتيجة الـlocal validation، مالوش علاقة
//      بالـremote هنا).
//   4) Grace period            -> evaluateRemoteFreshness() تحت - بيحدد
//      لحد إيه نقدر نستمر نثق في آخر remote state لو الـLicense Server
//      بقى unreachable مؤقتًا.
//
// قاعدة أمان مهمة جدًا: **remote failure ≠ license revoked تلقائيًا**.
// أسوأ نتيجة ممكن يرجعها evaluateRemoteFreshness() هي 'expired_beyond_grace'
// أو 'never_validated' + requiresRemoteValidation:true - القرار النهائي
// (نوقف الميزة الفلانية ولا لأ) يرجع لـcaller (Prompt 2B/2C)، مش هنا.
// الملف ده pure classification + MongoDB persistence بس، مفيش أي HTTP call.

const FRESHNESS_BUCKETS = {
  FRESH: 'fresh',
  STALE_IN_GRACE: 'stale_in_grace',
  EXPIRED_BEYOND_GRACE: 'expired_beyond_grace',
  NEVER_VALIDATED: 'never_validated',
};

const DEFAULT_FRESH_WINDOW_SECONDS = 300;

/**
 * "fresh window" (أد إيه آخر remote validation تتحسب لسه طازة، مش محتاجة
 * remote check تاني) - بنعيد استخدام LICENSE_CACHE_TTL الموجودة بالفعل
 * (بدل ما نعمل env var جديد بنفس المعنى) لأنه نفس مفهوم "التحقق ده لسه
 * حديث كفاية" المستخدم أصلًا في licenseService.js للـlocal cache.
 * @returns {number} بالثواني
 */
function getRemoteFreshWindowSeconds() {
  const raw = Number(process.env.LICENSE_CACHE_TTL);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_FRESH_WINDOW_SECONDS;
}

/**
 * بيحفظ remote state جديدة "ناجحة" - upsert atomic واحد (findOneAndUpdate)،
 * مفيش countDocuments/read-then-write. لازم تتنادى بس لما remote
 * validation فعلًا نجحت (الـcaller المستقبلي في Prompt 2B هو اللي هيقرر
 * إمتى ينادي الدالة دي - مش هنا).
 * @param {Object} rawResponse - raw response من الـLicense Server
 * @returns {Promise<Object>} الـstate بعد الحفظ (plain object)
 */
async function saveSuccessfulRemoteState(rawResponse) {
  const normalized = normalizeRemoteLicenseResponse(rawResponse);
  if (!normalized || !normalized.licenseId) {
    throw new Error('saveSuccessfulRemoteState requires a normalizable response with a licenseId');
  }

  const saved = await LicenseRemoteState.findOneAndUpdate(
    { licenseId: normalized.licenseId },
    { $set: { ...normalized, lastSuccessfulValidationAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return saved.toObject();
}

/**
 * بيرجّع آخر remote state معروفة لـlicense معينة، أو null لو مفيش أي
 * remote validation ناجحة اتسجلت قبل كده خالص.
 * @param {string} licenseId
 * @returns {Promise<Object|null>}
 */
async function getLastRemoteState(licenseId) {
  if (!licenseId) return null;
  const doc = await LicenseRemoteState.findOne({ licenseId }).lean();
  return doc || null;
}

/**
 * بيصنّف آخر remote state معروفة حسب الـfreshness/grace period - pure
 * function (مفيهاش أي DB/network call بنفسه، بياخد الـstate جاهزة).
 * @param {Object|null} lastState - ناتج getLastRemoteState()
 * @param {Date} [now]
 * @returns {{bucket: string, state: Object|null, requiresRemoteValidation: boolean}}
 */
function evaluateRemoteFreshness(lastState, now = new Date()) {
  if (!lastState || !lastState.lastSuccessfulValidationAt) {
    return { bucket: FRESHNESS_BUCKETS.NEVER_VALIDATED, state: null, requiresRemoteValidation: true };
  }

  const lastValidatedAt = new Date(lastState.lastSuccessfulValidationAt);
  const ageMs = now.getTime() - lastValidatedAt.getTime();

  const freshWindowMs = getRemoteFreshWindowSeconds() * 1000;
  if (ageMs <= freshWindowMs) {
    return { bucket: FRESHNESS_BUCKETS.FRESH, state: lastState, requiresRemoteValidation: false };
  }

  const graceWindowMs = getRemoteGracePeriodHours() * 60 * 60 * 1000;
  if (ageMs <= graceWindowMs) {
    // لسه جوه الـgrace period: بنستخدم آخر state موثوقة، مفيش توقف مفاجئ.
    return { bucket: FRESHNESS_BUCKETS.STALE_IN_GRACE, state: lastState, requiresRemoteValidation: false };
  }

  return { bucket: FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE, state: lastState, requiresRemoteValidation: true };
}

/**
 * Convenience wrapper: بيجيب آخر remote state من MongoDB ويصنّفها في
 * نفس الوقت. **مش متربطة بأي route** - جاهزة بس لـPrompt 2B/2C.
 * لما requiresRemoteValidation=true، الـcode المرفق بيبقى
 * 'REMOTE_VALIDATION_REQUIRED' (حالة واضحة، مش error مبهم ومش revoked).
 * @param {string} licenseId
 * @param {Date} [now] - deterministic clock للاختبار (اختياري - بيدّي new Date() لو مش متبعت)
 * @returns {Promise<{bucket: string, state: Object|null, requiresRemoteValidation: boolean, code: string|null}>}
 */
async function getRemoteLicenseUsability(licenseId, now = new Date()) {
  const lastState = await getLastRemoteState(licenseId);
  const evaluation = evaluateRemoteFreshness(lastState, now);
  return {
    ...evaluation,
    code: evaluation.requiresRemoteValidation ? 'REMOTE_VALIDATION_REQUIRED' : null,
  };
}

module.exports = {
  FRESHNESS_BUCKETS,
  getRemoteFreshWindowSeconds,
  saveSuccessfulRemoteState,
  getLastRemoteState,
  evaluateRemoteFreshness,
  getRemoteLicenseUsability,
};