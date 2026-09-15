const crypto = require('crypto');

// ============================================================
// ===== LAVA Remote License Protocol Contract (PART 2B-1) ======
// ============================================================
// الملف ده هو الـ single source of truth لشكل الـ"طلب" (request) اللي
// LAVA Backend هيبعته لـLicense Server مستقبلًا. مفيش ولا ملف تاني في
// المشروع يفترض شكل الـrequest أو يكرر الـprotocol version/operation
// strings - كل حاجة بتتجاب من هنا (licenseRemoteClient.js,
// licenseRemoteSignatureService.js, licenseRemoteResponsePipeline.js).
//
// PART L (مهم جدًا): الملف ده pure - بيبني object جاهز بس، مفيهوش أي
// HTTP call/fetch/axios/network. البناء + الإرسال الفعلي حاجتين منفصلتين
// عن قصد (Protocol Builder -> Remote Client -> Transport)، وده اللي
// بيخلي إضافة الـtransport الحقيقي لاحقًا (Prompt 2B/2C) من غير ما نحتاج
// نغيّر شكل الـrequest نفسه.

/**
 * رقم إصدار الـprotocol - string ثابت (مش semver معقد، الهدف بس نقدر
 * نميّز مستقبلًا لو License Server استلم request بإصدار قديم/جديد).
 * أي breaking change في شكل الـrequest/response لازم يزوّد الرقم ده.
 */
const LICENSE_REMOTE_PROTOCOL_VERSION = '1';

/** العمليات الأربعة المدعومة حاليًا - الأسامي دي هي الـcontract نفسه. */
const REMOTE_OPERATIONS = Object.freeze({
  ACTIVATE: 'ACTIVATE',
  VALIDATE: 'VALIDATE',
  HEARTBEAT: 'HEARTBEAT',
  DEACTIVATE: 'DEACTIVATE',
});

const ALLOWED_OPERATIONS = Object.freeze(Object.values(REMOTE_OPERATIONS));

// ---- PART D: timestamp / clock skew foundation ----
// الـunit: ISO-8601 UTC string (زي كل الـtimestamps التانية بالمشروع، مش
// epoch ms) - سهل القراءة في الـlogs وآمن من مشاكل تقريب الأرقام الكبيرة.
// الـskew المسموح بيه: 5 دقايق - قيمة معقولة لأي نظامين متزامنين بـNTP
// عادي، من غير ما نعقّد الموضوع بـanti-replay database دلوقتي (ده مؤجل
// عمدًا لمرحلة تانية زي ما اتطلب في PART D). القيمة دي بتتستخدم لاحقًا في
// pipeline التحقق من الـresponse (licenseRemoteResponsePipeline.js) -
// مش بتتفرض هنا.
const REMOTE_REQUEST_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * requestId جديد لكل request - **يتولّد محليًا دايمًا**، مش من الـtimestamp
 * (timestamp لوحده مش كفاية للـcorrelation/idempotency - ممكن يتكرر بين
 * طلبين في نفس الميلي ثانية). uuid عشوائي (crypto.randomUUID، نفس الـ
 * mechanism المستخدم بالفعل في installationIdService.js).
 * @returns {string}
 */
function generateRequestId() {
  return crypto.randomUUID();
}

/** @returns {string} ISO-8601 UTC timestamp للحظة الحالية. */
function currentTimestamp() {
  return new Date().toISOString();
}

/**
 * بيتأكد إن كل الحقول المطلوبة (required) موجودة (مش null/undefined/فاضية)
 * - fail fast محليًا بدل ما نبعت request ناقص. ده validation وقت البناء
 * بس (مش جزء من أي typed LicenseError - ده misuse من الكود نفسه، زي نفس
 * الأسلوب المستخدم في fingerprintService.createFingerprint).
 * @param {Object} fields
 * @param {string[]} requiredKeys
 */
function requireFields(fields, requiredKeys) {
  for (const key of requiredKeys) {
    const value = fields[key];
    if (value === null || value === undefined || value === '') {
      throw new Error(`licenseRemoteProtocol: missing required field "${key}"`);
    }
  }
}

/**
 * الأساس المشترك لكل الأربع operations - بيضيف الحقول الثابتة (protocol
 * version, operation, requestId, timestamp) قبل الحقول الخاصة بالـ
 * operation نفسها.
 * @param {string} operation - لازم يكون من REMOTE_OPERATIONS
 * @param {Object} fields
 * @returns {Object}
 */
function buildBaseRequest(operation, fields) {
  if (!ALLOWED_OPERATIONS.includes(operation)) {
    throw new Error(`licenseRemoteProtocol: unknown operation "${operation}"`);
  }
  return {
    protocolVersion: LICENSE_REMOTE_PROTOCOL_VERSION,
    operation,
    requestId: generateRequestId(),
    timestamp: currentTimestamp(),
    ...fields,
  };
}

// ---- PART B: request contracts ----
// كل الحقول هنا اتاخدت بعد فحص الموديلات/الخدمات الموجودة فعليًا
// (License.js/LicenseActivation.js/fingerprintService.js/buildIdService.js)
// - مفيش حقل مخترع من غير سبب. **ممنوع** raw installationId (مش موجود
// أصلًا هنا)، وممنوع أي secret/credential (نفس الشيء - مش موجود).

/**
 * @param {{licenseId: string, domain: string, fingerprintHash: string, buildId: string, appVersion?: string, environment?: string}} input
 * @returns {Object} activate request جاهز - استخدمه مع remote client، مش HTTP مباشر.
 */
function buildActivateRequest({ licenseId, domain, fingerprintHash, buildId, appVersion, environment } = {}) {
  requireFields({ licenseId, domain, fingerprintHash, buildId }, ['licenseId', 'domain', 'fingerprintHash', 'buildId']);
  return buildBaseRequest(REMOTE_OPERATIONS.ACTIVATE, {
    licenseId,
    domain,
    fingerprintHash,
    buildId,
    appVersion: appVersion || null,
    environment: environment || null,
  });
}

/**
 * activationId اختياري هنا عمدًا - أول validate ممكن يحصل قبل ما يكون
 * فيه activation محلية معروفة (زي أول تشغيل).
 * @param {{licenseId: string, activationId?: string, domain?: string, fingerprintHash?: string}} input
 * @returns {Object}
 */
function buildValidateRequest({ licenseId, activationId, domain, fingerprintHash } = {}) {
  requireFields({ licenseId }, ['licenseId']);
  return buildBaseRequest(REMOTE_OPERATIONS.VALIDATE, {
    licenseId,
    activationId: activationId || null,
    domain: domain || null,
    fingerprintHash: fingerprintHash || null,
  });
}

/**
 * @param {{licenseId: string, activationId: string}} input
 * @returns {Object}
 */
function buildHeartbeatRequest({ licenseId, activationId } = {}) {
  requireFields({ licenseId, activationId }, ['licenseId', 'activationId']);
  return buildBaseRequest(REMOTE_OPERATIONS.HEARTBEAT, { licenseId, activationId });
}

/**
 * @param {{licenseId: string, activationId: string}} input
 * @returns {Object}
 */
function buildDeactivateRequest({ licenseId, activationId } = {}) {
  requireFields({ licenseId, activationId }, ['licenseId', 'activationId']);
  return buildBaseRequest(REMOTE_OPERATIONS.DEACTIVATE, { licenseId, activationId });
}

module.exports = {
  LICENSE_REMOTE_PROTOCOL_VERSION,
  REMOTE_OPERATIONS,
  ALLOWED_OPERATIONS,
  REMOTE_REQUEST_CLOCK_SKEW_MS,
  generateRequestId,
  currentTimestamp,
  buildActivateRequest,
  buildValidateRequest,
  buildHeartbeatRequest,
  buildDeactivateRequest,
};