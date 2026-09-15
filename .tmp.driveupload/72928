const License = require('../../models/License');
const LicenseActivation = require('../../models/LicenseActivation');
const LicenseEvent = require('../../models/LicenseEvent');
const { getBuildId } = require('./buildIdService');
const { getInstallationId } = require('./installationIdService');
const { createFingerprint, normalizeDomain } = require('./fingerprintService');
const licenseCache = require('./licenseCache');
const {
  InvalidLicenseError,
  LicenseExpiredError,
  LicenseRevokedError,
  LicenseSuspendedError,
  ActivationLimitError,
  LicenseDomainNotAllowedError,
} = require('./licenseErrors');

// ============================================================
// ===== License Service (PART 1B) ===============================
// ============================================================
// الملف ده هو الـabstraction الرئيسية لحالة الترخيص المحلية. مهم جدًا:
//   - كل حاجة هنا local validation بس (بناءً على License/LicenseActivation
//     المخزنين في MongoDB). مفيش أي remote/HTTP call لأي License Server
//     خارجي - ده هيتضاف في مرحلة لاحقة (PART 1C+).
//   - activateLicense() هنا بتعمل الـbookkeeping المحلي بس (تنشئ
//     LicenseActivation + LicenseEvent) - مفيهاش أي fake/simulated HTTP
//     request لحد ما يتحدد شكل الـLicense Server الحقيقي لاحقًا.
//   - مفيش enforcement (زي إيقاف التطبيق) في المرحلة دي - LICENSE_ENABLED
//     مش بيتقرا هنا أصلًا لأن مفيش middleware عام لسه.

const DEFAULT_GRACE_PERIOD_DAYS = 0;
const DEFAULT_CACHE_TTL_SECONDS = 300;

function getGracePeriodDays() {
  const raw = Number(process.env.LICENSE_GRACE_PERIOD);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_GRACE_PERIOD_DAYS;
}

function getCacheTtlSeconds() {
  const raw = Number(process.env.LICENSE_CACHE_TTL);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_CACHE_TTL_SECONDS;
}

/**
 * منطق تحديد حالة الترخيص محليًا - pure function (مفيهاش DB call) عشان
 * تبقى سهلة الاختبار. بتاخد license "plain-ish" object (فيه status و
 * expiresAt) وترجّع الحالة المحسوبة (ممكن تختلف عن license.status الخام
 * في حالة الـgrace period بس).
 * @param {{status: string, expiresAt: Date|string|null}|null} license
 * @param {Date} [now]
 * @returns {{status: string, expiresAt: Date|null, graceEndsAt: Date|null}}
 */
function computeLicenseStatus(license, now = new Date()) {
  if (!license) {
    return { status: 'invalid', expiresAt: null, graceEndsAt: null };
  }

  if (license.status === 'revoked') {
    return { status: 'revoked', expiresAt: license.expiresAt || null, graceEndsAt: null };
  }
  if (license.status === 'suspended') {
    return { status: 'suspended', expiresAt: license.expiresAt || null, graceEndsAt: null };
  }

  const expiresAt = license.expiresAt ? new Date(license.expiresAt) : null;
  if (expiresAt && now.getTime() > expiresAt.getTime()) {
    const graceDays = getGracePeriodDays();
    const graceEndsAt = graceDays > 0
      ? new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000)
      : null;
    if (graceEndsAt && now.getTime() <= graceEndsAt.getTime()) {
      return { status: 'grace_period', expiresAt, graceEndsAt };
    }
    return { status: 'expired', expiresAt, graceEndsAt: null };
  }

  // مفيش expiry، أو لسه ماخلصش: النتيجة هي status الأصلي (المفروض 'active').
  return { status: license.status === 'active' ? 'active' : license.status, expiresAt, graceEndsAt: null };
}

/**
 * بيرجّع حالة الترخيص المحلية - بيستخدم الكاش لو لسه طازة، وإلا بيعمل
 * lookup من الداتابيز ويحدّث الكاش.
 * @param {string} licenseId
 * @param {{forceRefresh?: boolean}} [options]
 * @returns {Promise<import('./licenseCache').CachedLicenseState>}
 */
async function getLocalLicenseState(licenseId, options = {}) {
  if (!licenseId) throw new InvalidLicenseError({ reason: 'missing_license_id' });

  if (!options.forceRefresh) {
    const cached = licenseCache.getCachedLicenseState(licenseId);
    if (licenseCache.isCacheFresh(cached, getCacheTtlSeconds())) {
      return cached;
    }
  }

  const license = await License.findOne({ licenseId }).lean();
  const computed = computeLicenseStatus(license);

  const state = licenseCache.setCachedLicenseState(licenseId, {
    status: computed.status,
    expiresAt: computed.expiresAt,
    graceEndsAt: computed.graceEndsAt,
    activation: null,
  });

  return state;
}

/**
 * زي getLocalLicenseState بس بترجع status فقط (convenience wrapper) -
 * مبتعملش throw، بترجع 'invalid' لو الترخيص مش موجود.
 * @param {string} licenseId
 * @returns {Promise<string>}
 */
async function getLicenseStatus(licenseId) {
  const state = await getLocalLicenseState(licenseId);
  return state.status;
}

/**
 * بتعمل fresh local validation وترمي typed error مناسب لو الترخيص مش
 * valid (revoked/suspended/expired) - 'active' و'grace_period' بس
 * بيرجعوا successfully.
 * @param {string} licenseId
 * @returns {Promise<import('./licenseCache').CachedLicenseState>}
 */
async function validateLocalLicense(licenseId) {
  const state = await getLocalLicenseState(licenseId, { forceRefresh: true });

  switch (state.status) {
    case 'invalid':
      throw new InvalidLicenseError({ licenseId });
    case 'revoked':
      throw new LicenseRevokedError({ licenseId });
    case 'suspended':
      throw new LicenseSuspendedError({ licenseId });
    case 'expired':
      throw new LicenseExpiredError({ licenseId });
    case 'active':
    case 'grace_period':
      return state;
    default:
      throw new InvalidLicenseError({ licenseId, reason: 'unknown_status' });
  }
}

/**
 * بيبني fingerprint hash لـinstallation معينة - wrapper رقيق حوالين
 * fingerprintService + installationIdService/buildIdService.
 * @param {string} licenseId
 * @param {string} domain
 * @returns {Promise<{fingerprintHash: string, installationId: string, buildId: string, normalizedDomain: string}>}
 */
async function createLicenseFingerprint(licenseId, domain) {
  const buildId = getBuildId();
  const installationId = await getInstallationId();
  const fingerprintHash = createFingerprint({ licenseId, buildId, installationId, domain });
  return { fingerprintHash, installationId, buildId, normalizedDomain: normalizeDomain(domain) };
}

/**
 * بتسجّل حدث لايسنس (LicenseEvent) - مفيش أي secret بيتخزن هنا.
 * @param {string} licenseId
 * @param {string} eventType
 * @param {Object} [meta]
 */
async function recordLicenseEvent(licenseId, eventType, meta = {}) {
  return LicenseEvent.create({
    licenseId,
    activationId: meta.activationId || null,
    eventType,
    domain: meta.domain || null,
    fingerprintHash: meta.fingerprintHash || null,
    appVersion: meta.appVersion || null,
    metadata: meta.metadata || null,
  });
}

/**
 * بترجع الـactivation الحالية (لو موجودة) لـ(licenseId, domain,
 * fingerprintHash) معينة.
 * @param {string} licenseId
 * @param {string} domain
 * @param {string} fingerprintHash
 */
async function getActivation(licenseId, domain, fingerprintHash) {
  const normalizedDomain = normalizeDomain(domain);
  return LicenseActivation.findOne({ licenseId, domain: normalizedDomain, fingerprintHash });
}

/**
 * بتتأكد هل domain معين مسموح بيه حسب license.allowedDomains - pure
 * function (مفيهاش DB call). NOT wired to activateLicense() ولا لأي route
 * حاليًا: زي ما اتطلب في PART 3، احنا مش بنفرض allowedDomains على الـlocal
 * activation في المرحلة دي. الهيلبر ده جاهز يتستخدم في Prompt 2.
 *
 * ملحوظة التصميم: التحقق النهائي من allowedDomains هيتحصل في الـLocal
 * License Service (زي maxActivations بالظبط) مش في الـRemote License
 * Server - لأن allowedDomains بييجي وبيتخزن أصلًا مع باقي بيانات الـLicense
 * محليًا (نفس الـdocument اللي فيه maxActivations)، فمفيش داعي لـround-trip
 * شبكة على كل activation عشان نتأكد من حاجة موجودة عندنا محليًا بالفعل.
 * الـRemote Server هيفضل هو مصدر الحقيقة اللي بيحدّث/يزوّد allowedDomains
 * نفسها (زي أي تغيير تاني في الـLicense)، لكن الفحص وقت الـactivation نفسه
 * هيفضل محلي وسريع - يبقى orchestration/sync problem مش validation problem.
 *
 * @param {{allowedDomains?: string[]}|null} license
 * @param {string} domain
 * @returns {boolean}
 */
function isDomainAllowed(license, domain) {
  if (!license || !Array.isArray(license.allowedDomains) || license.allowedDomains.length === 0) {
    // مفيش allowedDomains متحددة -> مش بنفرض حاجة (نفس السلوك الحالي تمامًا،
    // من غير أي تغيير في الـbackward compatibility للـlicenses الموجودة).
    return true;
  }
  const normalized = normalizeDomain(domain);
  return license.allowedDomains.includes(normalized);
}

/**
 * Internal helper فقط - PART 2 (synchronization foundation). **مش متربط
 * بأي route ولا بأي endpoint حاليًا** - مفيش deactivate/revoke API لسه.
 * الهدف منه إنه يبقى جاهز يتنادى بأمان لما الـdeactivate/revoke الحقيقي
 * يتبنى في Prompt 2، من غير ما نضطر نعيد التفكير في الـconcurrency وقتها.
 *
 * بيعمل حاجتين atomic ومترابطين:
 *   1) بيحاول ينقل activation واحدة بس من 'active' -> 'revoked' باستخدام
 *      شرط `{ activationId, status: 'active' }` في findOneAndUpdate - ده
 *      بالظبط نفس الـatomic-claim pattern المستخدم في باقي المشروع (زي
 *      `_id: order._id, stockRestored: false` في orderController.js).
 *      لو الـactivation كانت 'revoked' بالفعل (أو مش موجودة)، الشرط مش
 *      هيتحقق والـfindOneAndUpdate هترجع null - يعني الدالة idempotent:
 *      استدعاءها أكتر من مرة لنفس activationId هيعمل تأثير مرة واحدة بس.
 *   2) لو الـclaim نجح (يعني إحنا فعلًا اللي حولنا الحالة دلوقتي، مش حد
 *      قبلنا) -> بننزّل License.activeActivationCount بشكل atomic كمان،
 *      بس بشرط `activeActivationCount > 0` عشان نضمن العداد ميبقاش سالب
 *      أبدًا (schema `min: 0` مش كفاية لوحدها هنا لأن $inc/updateOne
 *      بيتخطوا الـschema validators - ده الحارس الحقيقي).
 *
 * @param {string} activationId
 * @returns {Promise<Object|null>} الـactivation بعد التحديث، أو null لو
 *   already-revoked/مش موجودة (no-op).
 *
 * ---- PART 1F review: هل الترتيب ده أفضل حل ممكن من غير transaction؟ ----
 * الترتيب مقصود ومهم: بنعمل claim الـactivation status الأول (خطوة 1)،
 * وبعدين بس ننزّل العداد (خطوة 2). ده عشان لو خطوة 2 فشلت (مثلاً DB error
 * عابر) وحد عمل retry بينادي releaseActivationSlot() تاني لنفس
 * activationId:
 *   - خطوة 1 هترجع null فورًا (لأن status بقى 'revoked' بالفعل من
 *     المحاولة اللي فاتت) -> خطوة 2 مش هتتنفذ تاني -> مستحيل نعمل
 *     double-decrement.
 *   - أسوأ سيناريو ممكن: العداد يفضل "معلّق" شوية أعلى من العدد الحقيقي
 *     للـactivations النشطة (يعني ممكن نرفض activation جديدة شرعية قبل
 *     ما لازم) - ده أمان في الاتجاه الآمن (leak محافظ)، عكس إنه ينزل تحت
 *     0 أو يتكرر الـdecrement. من غير transaction حقيقية (multi-document
 *     atomicity)، مفيش طريقة نضمن بيها الاتنين خطوات في عملية واحدة كاملة
 *     - فالـfailure mode ده (leak في اتجاه المحافظة) هو الأفضل المتاح.
 *     التطلب صراحة إننا منضيفش transaction system كامل في المرحلة دي.
 */
async function releaseActivationSlot(activationId) {
  if (!activationId) return null;

  const revoked = await LicenseActivation.findOneAndUpdate(
    { activationId, status: 'active' },
    { $set: { status: 'revoked', lastSeenAt: new Date() } },
    { new: true }
  );

  if (!revoked) {
    // إما مش موجودة أصلًا، أو already revoked من استدعاء سابق - idempotent
    // no-op، مفيش decrement تاني هيحصل.
    return null;
  }

  await License.updateOne(
    { licenseId: revoked.licenseId, activeActivationCount: { $gt: 0 } },
    { $inc: { activeActivationCount: -1 } }
  );

  licenseCache.clearCachedLicenseState(revoked.licenseId);

  return revoked.toObject();
}

/**
 * تفعيل محلي بس: بتتأكد من صلاحية الترخيص + حد الـactivations، وبعدين
 * تنشئ/تحدّث LicenseActivation محليًا في MongoDB.
 *
 * مهم جدًا: مفيش أي HTTP request هنا لأي License Server خارجي - ده
 * PART 1B بس (local bookkeeping). لما يتبنى الـLicense Server الحقيقي
 * الدالة دي هتتعدل (مش النهاردة) عشان تتواصل معاه.
 *
 * @param {{licenseId: string, domain: string, environment?: string, appVersion?: string}} input
 * @returns {Promise<Object>} activation document (plain object، من غير secrets)
 */
async function activateLicense({ licenseId, domain, environment = 'production', appVersion = null }) {
  if (!licenseId) throw new InvalidLicenseError({ reason: 'missing_license_id' });
  if (!domain) throw new InvalidLicenseError({ reason: 'missing_domain' });

  const license = await License.findOne({ licenseId });
  const computed = computeLicenseStatus(license ? license.toObject() : null);

  if (computed.status === 'invalid') throw new InvalidLicenseError({ licenseId });
  if (computed.status === 'revoked') throw new LicenseRevokedError({ licenseId });
  if (computed.status === 'suspended') throw new LicenseSuspendedError({ licenseId });
  if (computed.status === 'expired') throw new LicenseExpiredError({ licenseId });

  // ---- Domain restriction (allowedDomains) ----
  // لازم يحصل قبل أي حاجة تانية (قبل fingerprint، قبل حجز activation slot،
  // قبل أي كتابة على LicenseActivation) - domain مرفوض معناه مفيش أي أثر
  // على النظام خالص غير event log واحد. isDomainAllowed() نفسها pure
  // function مبنية بالفعل في PART 1E (allowedDomains=[] -> كله مسموح).
  const normalizedDomain = normalizeDomain(domain);
  if (!isDomainAllowed(license, domain)) {
    await recordLicenseEvent(licenseId, 'LICENSE_DOMAIN_NOT_ALLOWED', {
      domain: normalizedDomain,
    });
    throw new LicenseDomainNotAllowedError({ licenseId, domain: normalizedDomain });
  }

  const { fingerprintHash, buildId } = await createLicenseFingerprint(licenseId, domain);

  const existing = await LicenseActivation.findOne({ licenseId, domain: normalizedDomain, fingerprintHash });
  if (existing) {
    existing.lastSeenAt = new Date();
    existing.status = 'active';
    existing.appVersion = appVersion || existing.appVersion;
    existing.buildId = buildId;
    await existing.save();
    await recordLicenseEvent(licenseId, 'LICENSE_VALIDATED', {
      activationId: existing.activationId,
      domain: normalizedDomain,
      fingerprintHash,
      appVersion,
    });
    return existing.toObject();
  }

  // ---- Atomic capacity reservation (fixes TOCTOU race) ----
  // Old code did `countDocuments()` then `create()` as two separate steps,
  // so two concurrent requests could both read a count under the limit and
  // both create an activation, exceeding maxActivations. Instead, we claim
  // a slot with a single atomic findOneAndUpdate: the $expr condition and
  // the $inc happen together as one document-level operation, which
  // MongoDB always serializes for a single document - so only one of two
  // concurrent requests can ever succeed in incrementing past the limit.
  // This needs no multi-document transaction (and therefore works the same
  // whether or not the deployment/tests have a replica set available).
  const reserved = await License.findOneAndUpdate(
    {
      licenseId,
      $expr: { $lt: [{ $ifNull: ['$activeActivationCount', 0] }, '$maxActivations'] },
    },
    { $inc: { activeActivationCount: 1 } },
    { new: true }
  );

  if (!reserved) {
    await recordLicenseEvent(licenseId, 'ACTIVATION_LIMIT_REACHED', {
      domain: normalizedDomain,
      fingerprintHash,
      appVersion,
    });
    throw new ActivationLimitError({ licenseId, maxActivations: license.maxActivations });
  }

  const activationId = `ACT-${licenseId}-${fingerprintHash.slice(0, 12)}`;
  let created;
  try {
    created = await LicenseActivation.create({
      licenseId,
      activationId,
      domain: normalizedDomain,
      environment,
      fingerprintHash,
      status: 'active',
      appVersion,
      buildId,
    });
  } catch (err) {
    // Creation failed (e.g. unexpected duplicate-key race on the compound
    // unique index, or a DB error) - release the reserved slot so it isn't
    // leaked/stuck counted against maxActivations forever.
    // Guarded the same way as releaseActivationSlot(): only decrement while
    // activeActivationCount > 0, atomically. $inc/updateOne bypass the
    // schema's `min: 0` validator, so this $gt guard is the real floor -
    // without it a retry/duplicate rollback call could theoretically drive
    // the counter negative.
    await License.updateOne(
      { licenseId, activeActivationCount: { $gt: 0 } },
      { $inc: { activeActivationCount: -1 } }
    );
    throw err;
  }

  if (!reserved.activatedAt) {
    reserved.activatedAt = new Date();
    await reserved.save();
  }

  await recordLicenseEvent(licenseId, 'LICENSE_ACTIVATED', {
    activationId: created.activationId,
    domain: normalizedDomain,
    fingerprintHash,
    appVersion,
  });

  licenseCache.clearCachedLicenseState(licenseId);

  return created.toObject();
}

module.exports = {
  computeLicenseStatus,
  getLocalLicenseState,
  getLicenseStatus,
  validateLocalLicense,
  createFingerprint: createLicenseFingerprint,
  recordLicenseEvent,
  getActivation,
  activateLicense,
  isDomainAllowed,
  releaseActivationSlot,
};