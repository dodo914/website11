const licenseService = require('./licenseService');
const remoteClient = require('./licenseRemoteClient');
const remoteStateService = require('./licenseRemoteStateService');
const { processRemoteResponse } = require('./licenseRemoteResponsePipeline');
const { REMOTE_OPERATIONS } = require('./licenseRemoteProtocol');
const { isRemoteEnabled } = require('./licenseRemoteConfig');
const { RemoteLicenseUnavailableError } = require('./licenseErrors');

// ============================================================
// ===== LAVA Remote License Orchestrator (PART 2B-2A) ===========
// ============================================================
// الملف ده هو طبقة الـ"lifecycle/business coordination" اللي بتربط الـ
// Remote foundation (licenseRemoteClient/licenseRemoteResponsePipeline/
// licenseRemoteStateService) بالـLocal License Service الموجود بالفعل -
// **مش** لسه مربوطة بأي route ولا middleware عام (ده برّه scope المرحلة
// دي عمدًا). حاليًا الملف ده مجرد API جاهز يتستخدم لاحقًا.
//
// فصل المسؤوليات (زي ما اتطلب صراحة):
//   - licenseRemoteClient.js  = transport/protocol adapter بس (بيبني
//     الـrequest ويبعته عن طريق transport محقون، مفيهوش أي قرار license).
//   - licenseRemoteOrchestrator.js (الملف ده) = بيقرر إمتى/إزاي نستخدم
//     الـclient، بيمرر الرد على processRemoteResponse() (fail-closed)،
//     وبيخزن trusted state بس بعد ما ينجح التحقق بالكامل.
//   - licenseService.js = local license logic (بيانات محلية بس) - **مش
//     بيتعدل هنا خالص**، بس بيتستخدم (createFingerprint) عشان منكررش
//     منطق الـfingerprint/buildId/installationId.
//
// ---- PART 5: STATE PRECEDENCE (مهم جدًا، الملف ده بيحترمه بالكامل) ----
//   1) Local License State  -> License/LicenseActivation في MongoDB -
//      الملف ده **ميغيّرش فيهم خالص**. رد remote (موثوق أو لأ) منأثرش
//      على الـLocal License Doc نفسه - ده قرار architecture مقصود لحد
//      ما مرحلة تانية (لو حصلت) تحدد إزاي/هل يتزامنوا.
//   2) Remote State -> LicenseRemoteState (عن طريق licenseRemoteStateService
//      بس - مفيش persistence logic جديدة هنا، بنعيد استخدامه زي ما هو).
//      بتتحدث بس لما remote response تعدي الـpipeline بالكامل (signature
//      verified + protocol/requestId/timestamp سليمين).
//   3) Cache -> licenseCache.js (performance layer للـlocal state بس) -
//      الملف ده منلمسهوش خالص؛ remote validation منعتبروش local cache
//      refresh، ومفيش تخليط بينهم.
//   4) Grace period -> licenseRemoteStateService.evaluateRemoteFreshness()/
//      getRemoteLicenseUsability() - fallback مؤقت لما ميكونش فيه fresh
//      remote validation، مش بيغيّر أي status في Mongo (لا local ولا
//      remote) - بس بيوصف "هل نقدر لسه نثق في آخر remote state معروفة".
//
// ---- PART 6: REMOTE FAILURE BEHAVIOR ----
// UNTRUSTED REMOTE RESPONSE ≠ VALID REMOTE LICENSE:
//   أي فشل في processRemoteResponse() (protocol/requestId/timestamp/
//   signature/envelope) بيرمي typed error فورًا **قبل** أي persistence -
//   يعني آخر trusted remote state معروفة بتفضل زي ما هي بالظبط (مفيش
//   حذف/استبدال بـresponse غير موثوق - PART 7 F).
// REMOTE SERVER UNAVAILABLE ≠ IMMEDIATELY DESTROY LOCAL STORE:
//   transport/timeout/disabled كلهم بيرموا RemoteLicenseUnavailableError
//   (نفس error PART 2A) - الدالة دي **مبتلمسش** grace period تلقائيًا؛
//   الـcaller (مستقبلًا) هو اللي يقرر يستخدم evaluateRemoteUsability()
//   تحت لو عايز fallback بدل ما يسيب الـerror يطلع كده. الفصل ده مقصود:
//   "remote call فشل" و"إيه اللي نستخدمه بدل كده" حاجتين مختلفتين.

/**
 * بيتأكد من الحقول الأساسية المطلوبة - fail fast محليًا (مش typed
 * LicenseError، ده misuse من الكود نفسه، زي نفس أسلوب licenseRemoteProtocol.js).
 * @param {Object} fields
 * @param {string[]} requiredKeys
 */
function requireFields(fields, requiredKeys) {
  for (const key of requiredKeys) {
    if (!fields[key]) {
      throw new Error(`licenseRemoteOrchestrator: missing required field "${key}"`);
    }
  }
}

/**
 * لو remote مش مفعّل أصلًا، بنرمي RemoteLicenseUnavailableError فورًا من
 * غير أي عمل إضافي (زي lookup لـfingerprint/installationId) - نفس
 * الـshort-circuit المستخدم في licenseRemoteClient.js، بس هنا قبل حتى ما
 * نعمل أي local DB work مش لازم نعمله لو مش هيتبعت.
 * @param {string} operation
 */
function assertRemoteEnabledOrThrow(operation) {
  if (!isRemoteEnabled()) {
    throw new RemoteLicenseUnavailableError({ reason: 'remote_disabled', operation });
  }
}

/**
 * بيمرر رد الـremote (raw، غير موثوق لسه) على الـvalidation pipeline
 * الكامل، وبعد النجاح بس بيخزن trusted remote state (لو الرد فيه `data`
 * فعلي بعد signature verification). **fail-closed**: أي throw من
 * processRemoteResponse() بيوقف هنا - مفيش persistence هيحصل، ومفيش
 * catch هنا (الـerror بيتنشر زي ما هو للـcaller، زي PART 6).
 * @param {{requestId: string, operation: string, raw: Object}} clientResult - ناتج licenseRemoteClient.js
 * @returns {Promise<{success: boolean, code: string, operation: string, data: Object|null}>}
 */
async function verifyAndPersist({ requestId, raw }) {
  const processed = processRemoteResponse(raw, { expectedRequestId: requestId });

  // بنستخدم raw.data الأصلي (مش processed.data) عشان
  // licenseRemoteStateService.saveSuccessfulRemoteState() يطبّعه بنفسه
  // (بيستخدم نفس normalizeRemoteLicenseResponse() اللي الـpipeline
  // استخدمها بالظبط) - إعادة استخدام الخدمة الموجودة زي ما هي، مش
  // duplicate persistence logic جديد (PART 4).
  if (raw && raw.data && typeof raw.data === 'object') {
    await remoteStateService.saveSuccessfulRemoteState(raw.data);
  }

  return processed;
}

/**
 * PART 2 - REMOTE ACTIVATION.
 * Flow: remote enabled? -> local fingerprint/buildId -> build+send
 * activate request (عن طريق licenseRemoteClient) -> processRemoteResponse
 * (fail-closed) -> persist trusted state لو نجح -> رجّع الحالة الآمنة.
 * @param {{licenseId: string, domain: string, environment?: string, appVersion?: string}} input
 * @returns {Promise<{success: boolean, code: string, operation: string, data: Object|null}>}
 */
async function remoteActivateLicense({ licenseId, domain, environment = 'production', appVersion = null } = {}) {
  requireFields({ licenseId, domain }, ['licenseId', 'domain']);
  assertRemoteEnabledOrThrow(REMOTE_OPERATIONS.ACTIVATE);

  // مفيش duplicate fingerprint logic هنا - بنعيد استخدام نفس الدالة
  // المستخدمة محليًا بالفعل في licenseService.activateLicense().
  const { fingerprintHash, buildId } = await licenseService.createFingerprint(licenseId, domain);

  const clientResult = await remoteClient.activateRemoteLicense({
    licenseId,
    domain,
    fingerprintHash,
    buildId,
    appVersion,
    environment,
  });

  return verifyAndPersist(clientResult);
}

/**
 * PART 3 - REMOTE VALIDATION.
 * **منفصلة تمامًا عن local validation** (licenseService's own
 * validateLocalLicense helper) - مبتستبدلهاش ولا بتنده عليها. Caller
 * مستقبلي هو اللي هيقرر إزاي يجمع بين الاتنين.
 * @param {{licenseId: string, activationId?: string, domain?: string, fingerprintHash?: string}} input
 * @returns {Promise<{success: boolean, code: string, operation: string, data: Object|null}>}
 */
async function remoteValidateLicense({ licenseId, activationId, domain, fingerprintHash } = {}) {
  requireFields({ licenseId }, ['licenseId']);
  assertRemoteEnabledOrThrow(REMOTE_OPERATIONS.VALIDATE);

  const clientResult = await remoteClient.validateRemoteLicense({ licenseId, activationId, domain, fingerprintHash });
  return verifyAndPersist(clientResult);
}

/**
 * PART 1 - REMOTE HEARTBEAT (processing/preparation - الـprotocol الحالي
 * بيدعمها زي ما هو موضح في licenseRemoteProtocol.buildHeartbeatRequest).
 * مفيش scheduling/cron هنا - نداء واحد بس لو اتنادت.
 * @param {{licenseId: string, activationId: string}} input
 * @returns {Promise<{success: boolean, code: string, operation: string, data: Object|null}>}
 */
async function remoteHeartbeat({ licenseId, activationId } = {}) {
  requireFields({ licenseId, activationId }, ['licenseId', 'activationId']);
  assertRemoteEnabledOrThrow(REMOTE_OPERATIONS.HEARTBEAT);

  const clientResult = await remoteClient.heartbeatRemoteLicense({ licenseId, activationId });
  return verifyAndPersist(clientResult);
}

/**
 * PART 1 - REMOTE DEACTIVATION (processing/preparation). **مبتلمسش**
 * releaseActivationSlot()/LicenseActivation المحليين - ده local
 * bookkeeping منفصل تمامًا (PART 8 backward compatibility).
 * @param {{licenseId: string, activationId: string}} input
 * @returns {Promise<{success: boolean, code: string, operation: string, data: Object|null}>}
 */
async function remoteDeactivate({ licenseId, activationId } = {}) {
  requireFields({ licenseId, activationId }, ['licenseId', 'activationId']);
  assertRemoteEnabledOrThrow(REMOTE_OPERATIONS.DEACTIVATE);

  const clientResult = await remoteClient.deactivateRemoteLicense({ licenseId, activationId });
  return verifyAndPersist(clientResult);
}

// ---- PART 7 - GRACE PERIOD (إعادة استخدام - مفيش policy جديدة) ----

/**
 * Convenience wrapper بس حوالين licenseRemoteStateService.getRemoteLicenseUsability()
 * - **مفيش grace policy جديدة هنا**، ده نفس الـ72-hour grace foundation
 * الموجود بالفعل من PART 2A، من غير أي تعديل. الهدف إن الـorchestrator
 * يبقى نقطة دخول واحدة (single entry point) لأي حد مستقبلي محتاج "هل
 * الترخيص ده لسه usable remotely دلوقتي" من غير ما يعرف تفاصيل
 * LicenseRemoteState/freshness buckets الداخلية.
 * @param {string} licenseId
 * @returns {Promise<{bucket: string, state: Object|null, requiresRemoteValidation: boolean, code: string|null}>}
 */
async function evaluateRemoteUsability(licenseId) {
  return remoteStateService.getRemoteLicenseUsability(licenseId);
}

// ---- PART 8 - REMOTE STATUS MAPPING ----

/** الحالات المعروفة اللي الـRemote Server ممكن يرجّعها - pure enum. */
const REMOTE_LICENSE_STATUSES = Object.freeze(['active', 'expired', 'revoked', 'suspended', 'invalid']);

/**
 * بتفسّر ناتج verifyAndPersist()/processRemoteResponse() لحالة استخدام
 * آمنة - **مش** بتعتمد على `message` ولا على HTTP status، بس على
 * `success` + `code` + الـ`data` المطبّعة والموقّعة (بعد ما الـpipeline
 * خلص). أي status مش من الأربعة+invalid المعروفين بيترد كـ'invalid'
 * (fail-closed - مش بنخمّن حالة جديدة).
 * @param {{success: boolean, code: string, data: Object|null}|null} processedResult - ناتج verifyAndPersist() أو processRemoteResponse()
 * @returns {{usable: boolean, status: string, code: string|null}}
 */
function interpretRemoteLicenseState(processedResult) {
  if (!processedResult || processedResult.success !== true) {
    return { usable: false, status: 'invalid', code: processedResult ? processedResult.code : null };
  }
  const rawStatus = processedResult.data ? processedResult.data.status : null;
  const status = REMOTE_LICENSE_STATUSES.includes(rawStatus) ? rawStatus : 'invalid';
  return { usable: status === 'active', status, code: processedResult.code };
}

module.exports = {
  remoteActivateLicense,
  remoteValidateLicense,
  remoteHeartbeat,
  remoteDeactivate,
  evaluateRemoteUsability,
  interpretRemoteLicenseState,
  REMOTE_LICENSE_STATUSES,
};