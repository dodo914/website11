const licenseService = require('./licenseService');
const LicenseActivation = require('../../models/LicenseActivation');
const remoteStateService = require('./licenseRemoteStateService');
const { normalizeDomain } = require('./fingerprintService');
const { isRemoteEnabled } = require('./licenseRemoteConfig');
const licenseMiddleware = require('../../middleware/licenseMiddleware');

// ============================================================
// ===== LAVA Remote License Enforcement Foundation (PART 2B-2C-2) ===
// ============================================================
// الملف ده هو أول "enforcement decision" abstraction بيحسب: هل جزء محمي
// من LAVA مسموح له يكمل، بناءً على:
//   1) Local License State      -> licenseService.getLocalLicenseState()
//      (موجود بالفعل من PART 1B - مش بيتعدل هنا خالص).
//   2) Trusted Remote State     -> licenseRemoteStateService (موجود بالفعل
//      من PART 2A - آخر state اتخزنت بس بعد ما عدت pipeline التحقق الكامل
//      في licenseRemoteOrchestrator.verifyAndPersist()، مش أي raw response).
//   3) Remote freshness         -> licenseRemoteStateService.evaluateRemoteFreshness()
//      (نفس الـ72-hour grace foundation الموجود بالفعل - مفيش policy جديدة).
//   4) Domain / Activation      -> LicenseActivation الموجودة بالفعل +
//      fingerprintService.normalizeDomain() (مفيش إعادة تنفيذ للـnormalization).
//
// **مهم جدًا**: الملف ده لا يكتب فوق License ولا LicenseActivation أبدًا،
// ولا بيعمل أي HTTP call مباشر (كله عن طريق remoteStateService اللي هو
// قراءة من MongoDB بس - مفيش transport هنا خالص)، ولا بيشغّل أي heartbeat
// scheduler. هو orchestration/decision layer بس فوق اللي موجود بالفعل.
//
// ---- Decision precedence (PART 11) ----
//   Local License Validation
//     -> Domain / Activation validity (لو activationId/domain اتبعتوا)
//     -> Remote disabled? -> Local-only decision
//     -> Trusted Remote State موجودة؟ -> لأ -> safe unavailable behavior
//     -> Remote status (ACTIVE/REVOKED/SUSPENDED/EXPIRED)
//     -> Remote freshness (fresh/stale_in_grace/expired_beyond_grace)
//     -> Grace policy بس لحالة عدم القدرة على التحقق من remote (مش لتجاوز
//        revoked/suspended/expired موثوقة - PART 8).

/** الحالات المسموح بيها (allowed reasons) - matches PART 5. */
const ENFORCEMENT_REASONS = Object.freeze({
  // Allowed
  LOCAL_ONLY_MODE: 'LOCAL_ONLY_MODE',
  REMOTE_ACTIVE: 'REMOTE_ACTIVE',
  REMOTE_GRACE: 'REMOTE_GRACE',
  // Blocked
  REMOTE_REVOKED: 'REMOTE_REVOKED',
  REMOTE_SUSPENDED: 'REMOTE_SUSPENDED',
  REMOTE_EXPIRED: 'REMOTE_EXPIRED',
  REMOTE_INVALID: 'REMOTE_INVALID',
  LICENSE_INVALID: 'LICENSE_INVALID',
  LICENSE_DOMAIN_NOT_ALLOWED: 'LICENSE_DOMAIN_NOT_ALLOWED',
  LICENSE_ACTIVATION_LIMIT: 'LICENSE_ACTIVATION_LIMIT',
  REMOTE_STATE_UNAVAILABLE: 'REMOTE_STATE_UNAVAILABLE',
  REMOTE_UNAVAILABLE_GRACE_EXPIRED: 'REMOTE_UNAVAILABLE_GRACE_EXPIRED',
});

/** local license statuses اللي معتبرة "usable" (نفس منطق licenseService الحالي). */
const USABLE_LOCAL_STATUSES = new Set(['active', 'grace_period']);

/** remote statuses اللي *لازم* تتحجب حتى لو الـLicense Server unreachable دلوقتي (PART 8). */
const NON_OVERRIDABLE_REMOTE_STATUSES = new Set(['revoked', 'suspended', 'expired']);

function buildResult({ allowed, reason, source, graceUsed = false }) {
  return { allowed, reason, source, graceUsed };
}

/**
 * بتلوّج قرار enforcement واحد - metadata آمنة بس (PART 17)، مفيش
 * secrets/signatures/raw installationId/raw remote payload هنا.
 * @param {Object} entry
 */
function logEnforcementDecision(entry) {
  try {
    // eslint-disable-next-line no-console
    console.log('[license-enforcement]', {
      licenseId: entry.licenseId || null,
      activationId: entry.activationId || null,
      reason: entry.reason,
      allowed: entry.allowed,
      source: entry.source,
      timestamp: new Date().toISOString(),
    });
  } catch (_err) {
    // logging لازم ميكسرش الـenforcement decision نفسه أبدًا.
  }
}

/**
 * بتتأكد إن activation معينة (لو اتبعتت) فعلًا بتخص licenseId ده وعلى
 * domain مسموح بيه - **مبتقبلش activationId من untrusted input من غير
 * تحقق** (بتعمل lookup فعلي في LicenseActivation، مش بتثق في أي حاجة
 * جايه من الـcaller على عليها).
 * @param {string} licenseId
 * @param {string} activationId
 * @param {string} [domain]
 * @returns {Promise<{ok: true}|{ok: false, reason: string}>}
 */
async function checkActivationBinding(licenseId, activationId, domain) {
  const activation = await LicenseActivation.findOne({ activationId }).lean();

  if (!activation || activation.licenseId !== licenseId || activation.status !== 'active') {
    return { ok: false, reason: ENFORCEMENT_REASONS.LICENSE_INVALID };
  }

  if (domain) {
    const normalized = normalizeDomain(domain);
    if (activation.domain !== normalized) {
      return { ok: false, reason: ENFORCEMENT_REASONS.LICENSE_DOMAIN_NOT_ALLOWED };
    }
  }

  return { ok: true };
}

/**
 * بتفسّر آخر trusted remote state المخزنة (لو موجودة) بالـfreshness/grace
 * policy الموجودة بالفعل (licenseRemoteStateService) لقرار enforcement
 * نهائي - **مفيش grace policy جديدة هنا**، وده أهم قاعدة أمان (PART 8):
 * revoked/suspended/expired موثوقة لا تتجاوز أبدًا بالـgrace period، حتى
 * لو الـLicense Server بقى unreachable دلوقتي.
 * @param {string} licenseId
 * @param {Date} [now]
 * @returns {Promise<{allowed: boolean, reason: string, source: string, graceUsed: boolean}>}
 */
async function evaluateRemoteEnforcement(licenseId, now = new Date()) {
  const usability = await remoteStateService.getRemoteLicenseUsability(licenseId, now);
  const { bucket, state } = usability;

  // لا trusted remote state موجودة خالص لسه - مننتحلش أي default (PART 16).
  if (!state) {
    return buildResult({ allowed: false, reason: ENFORCEMENT_REASONS.REMOTE_STATE_UNAVAILABLE, source: 'remote' });
  }

  // PART 8: revoked/suspended/expired موثوقة تحجب دايمًا - الـgrace period
  // مخصصة لعدم القدرة على التحقق، مش لتجاوز حالة سيئة معروفة.
  if (NON_OVERRIDABLE_REMOTE_STATUSES.has(state.status)) {
    const reason = state.status === 'revoked'
      ? ENFORCEMENT_REASONS.REMOTE_REVOKED
      : state.status === 'suspended'
        ? ENFORCEMENT_REASONS.REMOTE_SUSPENDED
        : ENFORCEMENT_REASONS.REMOTE_EXPIRED;
    return buildResult({ allowed: false, reason, source: 'remote' });
  }

  if (state.status !== 'active') {
    // حالة remote غير معروفة/غير متوقعة - fail-closed (زي
    // interpretRemoteLicenseState في الـorchestrator).
    return buildResult({ allowed: false, reason: ENFORCEMENT_REASONS.REMOTE_INVALID, source: 'remote' });
  }

  // من هنا: آخر trusted state = active. الفريش نيس بتقرر إحنا لسه نقدر
  // نثق فيها من غير remote check جديد، أو محتاجين grace، أو خلصت الـgrace.
  switch (bucket) {
    case remoteStateService.FRESHNESS_BUCKETS.FRESH:
      return buildResult({ allowed: true, reason: ENFORCEMENT_REASONS.REMOTE_ACTIVE, source: 'remote' });
    case remoteStateService.FRESHNESS_BUCKETS.STALE_IN_GRACE:
      return buildResult({ allowed: true, reason: ENFORCEMENT_REASONS.REMOTE_GRACE, source: 'remote', graceUsed: true });
    case remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE:
      return buildResult({ allowed: false, reason: ENFORCEMENT_REASONS.REMOTE_UNAVAILABLE_GRACE_EXPIRED, source: 'remote' });
    default:
      // NEVER_VALIDATED مش المفروض توصل هنا (state null كان هيترد فوق)،
      // بس fail-closed برضو لو حصل أي حالة غير متوقعة.
      return buildResult({ allowed: false, reason: ENFORCEMENT_REASONS.REMOTE_STATE_UNAVAILABLE, source: 'remote' });
  }
}

/**
 * نقطة الدخول الرئيسية - بترجع enforcement decision structured (مش
 * true/false بس). **لا تعدل** License ولا LicenseActivation، **لا تعمل**
 * HTTP مباشرة، **لا تشغّل** أي heartbeat scheduler - كل ده مسؤوليات
 * منفصلة موجودة بالفعل في ملفات تانية.
 * @param {{licenseId: string, activationId?: string, domain?: string, now?: Date}} input
 * @returns {Promise<{allowed: boolean, reason: string, source: string, graceUsed: boolean}>}
 */
async function evaluateLicenseEnforcement({ licenseId, activationId, domain, now = new Date() } = {}) {
  if (!licenseId) {
    const result = buildResult({ allowed: false, reason: ENFORCEMENT_REASONS.LICENSE_INVALID, source: 'local' });
    logEnforcementDecision({ licenseId, activationId, ...result });
    return result;
  }

  // ---- 1) Local License Validation ----
  const localState = await licenseService.getLocalLicenseState(licenseId);
  if (!USABLE_LOCAL_STATUSES.has(localState.status)) {
    const result = buildResult({ allowed: false, reason: ENFORCEMENT_REASONS.LICENSE_INVALID, source: 'local' });
    logEnforcementDecision({ licenseId, activationId, ...result });
    return result;
  }

  // ---- 2) Domain / Activation validity (لو اتبعتت) ----
  if (activationId) {
    const binding = await checkActivationBinding(licenseId, activationId, domain);
    if (!binding.ok) {
      const result = buildResult({ allowed: false, reason: binding.reason, source: 'local' });
      logEnforcementDecision({ licenseId, activationId, ...result });
      return result;
    }
  }

  // ---- 3) Remote disabled؟ -> Local-only mode ----
  if (!isRemoteEnabled()) {
    const result = buildResult({ allowed: true, reason: ENFORCEMENT_REASONS.LOCAL_ONLY_MODE, source: 'local' });
    logEnforcementDecision({ licenseId, activationId, ...result });
    return result;
  }

  // ---- 4) Remote enabled: اعتمد على trusted remote state + freshness/grace ----
  const remoteResult = await evaluateRemoteEnforcement(licenseId, now);
  logEnforcementDecision({ licenseId, activationId, ...remoteResult });
  return remoteResult;
}

/**
 * بيرجّع trusted server-side activation context لـlicenseId معينة - single
 * active activation بس (نفس افتراض single-tenant installation الموجود
 * بالفعل في licenseRemoteActivationDiscovery.js). **مفيش أي اعتماد على
 * أي حاجة جايه من الـclient هنا** - كله lookup حقيقي في LicenseActivation.
 * @param {string} licenseId
 * @returns {Promise<{activationId: string, domain: string}|null>}
 */
async function getServerActivationContext(licenseId) {
  if (!licenseId) return null;
  const activation = await LicenseActivation.findOne({ licenseId, status: 'active' }).lean();
  if (!activation) return null;
  return { activationId: activation.activationId, domain: activation.domain };
}

/**
 * Integration point جاهز للاستخدام على routes محددة بس (PART 2B-2C-3) -
 * **مش متربط بأي global app/router هنا**. مسؤول caller المستقبلي إنه
 * يستخدمه بس على الـroutes المحمية المحددة، مش globally.
 *
 * **أمان مهم جدًا**: الـdefault behavior هنا **بيتجاهل تمامًا** أي
 * licenseId/activationId جاي من الـrequest نفسه (headers/query/body) -
 * ده عن قصد. licenseId بيتقرا من الـconfigured server-side context
 * (licenseMiddleware.getConfiguredLicenseId() - من .env، زي الموجود
 * بالفعل من PART 1C)، والـactivationId/domain بيترجعوا من lookup حقيقي
 * في LicenseActivation (single active activation - نفس افتراض
 * single-tenant الموجود في activation discovery). عميل خبيث مبيقدرش
 * يبعت header زي `x-license-activation-id` عشان يتحايل على الـbinding -
 * الهيدر ده **مش متقروش خالص** في الـdefault path.
 *
 * لو محتاج سلوك مختلف مستقبلًا (multi-tenant مثلاً)، مرّر resolver
 * صريح في options - بس الـdefault لازم يفضل fail-closed وموثوق.
 * @param {{getLicenseId?: (req: import('express').Request) => (string|Promise<string>), getActivationContext?: (req: import('express').Request, licenseId: string) => Promise<{activationId?: string, domain?: string}|null>}} [options]
 * @returns {import('express').RequestHandler}
 */
function requireLicenseEnforcement(options = {}) {
  const getLicenseId = options.getLicenseId || (() => licenseMiddleware.getConfiguredLicenseId());
  const getActivationContext = options.getActivationContext || ((_req, licenseId) => getServerActivationContext(licenseId));

  return async (req, res, next) => {
    try {
      const licenseId = await getLicenseId(req);
      if (!licenseId) {
        return res.status(403).json({ code: ENFORCEMENT_REASONS.LICENSE_INVALID, message: 'License is invalid.' });
      }

      const activationContext = (await getActivationContext(req, licenseId)) || {};
      const activationId = activationContext.activationId || undefined;
      const domain = activationContext.domain || undefined;

      const decision = await evaluateLicenseEnforcement({ licenseId, activationId, domain });
      if (!decision.allowed) {
        return res.status(403).json({ code: decision.reason, message: 'License enforcement check failed.' });
      }
      return next();
    } catch (_err) {
      // fail-closed بس بدون تسريب تفاصيل داخلية - نفس فلسفة licenseMiddleware.js.
      return res.status(503).json({ code: 'LICENSE_CHECK_FAILED', message: 'Unable to verify license status.' });
    }
  };
}

module.exports = {
  ENFORCEMENT_REASONS,
  evaluateLicenseEnforcement,
  requireLicenseEnforcement,
  // exported for tests only
  _checkActivationBinding: checkActivationBinding,
  _evaluateRemoteEnforcement: evaluateRemoteEnforcement,
  _getServerActivationContext: getServerActivationContext,
};