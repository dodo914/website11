const { isRemoteEnabled, isRemoteConfigured, getRemoteServerUrl, getRemoteTimeoutMs } = require('./licenseRemoteConfig');
const { RemoteLicenseUnavailableError } = require('./licenseErrors');
const {
  REMOTE_OPERATIONS,
  buildActivateRequest,
  buildValidateRequest,
  buildHeartbeatRequest,
  buildDeactivateRequest,
} = require('./licenseRemoteProtocol');

// ============================================================
// ===== LAVA Remote License Client (PART 2A - foundation) =======
// ============================================================
// الملف ده abstraction لـ"communication مع License Server" بس - مفيهوش
// أي business rule خاصة بالـlicense نفسه (زي هل الترخيص صالح، أو حساب
// grace period - ده كله موجود في licenseService.js/licenseRemoteStateService.js
// مش هنا).
//
// PART 2A عمدًا مش بيعمل أي HTTP request حقيقي: شكل الـAPI بتاع License
// Server (endpoints/payload/response) لسه مش متفق عليه (السيرفر نفسه
// هيتبني في مشروع منفصل لاحقًا). بدل ما نخترع شكل عشوائي، عملنا
// **adapter/transport قابل للحقن** (dependency injection بسيط):
//   - setRemoteTransport(fn) هي النقطة الوحيدة اللي Prompt 2B/2C هيحقن
//     فيها الـtransport الحقيقي (axios/fetch وقتها) لما الـAPI contract
//     يتحدد.
//   - من غير transport محقون (الوضع الافتراضي دلوقتي، ومطابق لكونه
//     LICENSE_REMOTE_ENABLED=false بشكل افتراضي) - أي استدعاء لأي دالة
//     من الأربعة تحت بيرجع/يرمي RemoteLicenseUnavailableError واضح، من
//     غير أي محاولة اتصال شبكة فعلية.
// كده licenseService.js (أو أي كود مستقبلي) هيقدر يستخدم نفس الأربع
// دوال دايمًا، وييجي تغيير الـtransport من غير ما يحتاج يتغيّر هو نفسه.
//
// أمان (PART F):
//   - مفيش أي private/signing key هنا - الـEd25519 verification هتتضاف
//     في مرحلة لاحقة بعد الاتفاق على الـprotocol النهائي.
//   - مفيش أي raw error من الـtransport (تفاصيل HTTP/headers/body) بيتسرب
//     للـcaller - كل حاجة بتتلخّص في RemoteLicenseUnavailableError واحد.
//   - أي transport حقيقي مستقبلي هو المسؤول عن عدم تسجيل secrets أو
//     authorization headers في أي log - النقطة دي documented هنا عشان
//     تتاخد في الاعتبار وقت implementation الـtransport الحقيقي.

let transport = null;

/**
 * بيحقن الـtransport الحقيقي (Prompt 2B/2C). لازم يكون async function
 * بتاخد `{ operation, payload, url, timeoutMs }` وترجع الـraw response
 * (أو ترمي error). مفيش أي افتراض هنا عن شكل الـresponse - ده شغل
 * licenseRemoteResponsePipeline.processRemoteResponse() بعد كده (مش
 * licenseRemoteResponse.normalizeRemoteLicenseResponse() مباشرة - لازم
 * يعدي على signature verification الأول).
 * @param {Function|null} fn
 */
function setRemoteTransport(fn) {
  transport = typeof fn === 'function' ? fn : null;
}

/** للتستات فقط - يرجّع الحالة الافتراضية (مفيش transport محقون). */
function _resetTransportForTests() {
  transport = null;
}

/**
 * نقطة مركزية واحدة لأي عملية remote - بتتأكد من الإعدادات الأول (remote
 * enabled؟ configured؟ فيه transport محقون؟) قبل أي محاولة اتصال، وبتلخّص
 * أي فشل (network/timeout/transport) في نفس الـtyped error.
 * @param {string} operation - 'activate' | 'validate' | 'heartbeat' | 'deactivate'
 * @param {Object} payload
 * @returns {Promise<Object>} raw response من الـtransport (غير مطبّع لسه)
 */
async function callRemote(operation, buildRequest, input) {
  if (!isRemoteEnabled()) {
    throw new RemoteLicenseUnavailableError({ reason: 'remote_disabled', operation });
  }
  if (!isRemoteConfigured()) {
    // remote مفعّل بس مفيش LICENSE_SERVER_URL محدد - misconfiguration
    // آمنة: بترمي error واضح، مش بتحاول تتصل بـURL فاضي.
    throw new RemoteLicenseUnavailableError({ reason: 'remote_not_configured', operation });
  }
  if (!transport) {
    throw new RemoteLicenseUnavailableError({ reason: 'transport_not_configured', operation });
  }

  // الـrequest بيتبني (licenseRemoteProtocol.js) هنا بس - بعد ما اتأكدنا
  // إن هيحصل استخدام فعلي - عشان الحالة الافتراضية (remote disabled) تفضل
  // زي ما هي بالظبط: RemoteLicenseUnavailableError واحد واضح، من غير ما
  // نفرض شكل input معين على الـcaller وهو أصلًا مش هيتبعت لحد.
  const requestPayload = buildRequest(input);

  const timeoutMs = getRemoteTimeoutMs();
  try {
    const rawResponse = await transport({ operation, payload: requestPayload, url: getRemoteServerUrl(), timeoutMs });
    // ---- PART 2B-2A: بقينا برجّع requestId الأصلي جنب الـraw response ----
    // ده ضروري عشان أي caller (licenseRemoteOrchestrator.js) يقدر يعدي
    // requestId ده كـexpectedRequestId لـprocessRemoteResponse() بعد كده -
    // من غيره مفيش طريقة نتأكد إن الرد فعلًا رد على الـrequest ده بالذات
    // (PART I - خطوة Request ID validation). الشكل ده مقصود ومختلف عن
    // PART 2B-1 (كانت بترجع raw response لوحدها) - التغيير محصور هنا
    // وفي التستات المرتبطة بيه بس، مفيش أي business logic اتضافت.
    return { requestId: requestPayload.requestId, operation, raw: rawResponse };
  } catch (err) {
    // مفيش أي تفاصيل من الـerror الخام (headers/body/stack) بترجع للـcaller.
    throw new RemoteLicenseUnavailableError({ reason: 'transport_error', operation });
  }
}

/**
 * @param {{licenseId: string, domain: string, fingerprintHash: string, buildId: string}} input
 * @returns {Promise<{requestId: string, operation: string, raw: Object}>} raw response غير موثوق لسه -
 *   مرره لـlicenseRemoteResponsePipeline.processRemoteResponse({expectedRequestId: requestId, ...}) قبل أي استخدام.
 */
async function activateRemoteLicense(input) {
  return callRemote(REMOTE_OPERATIONS.ACTIVATE, buildActivateRequest, input);
}

/**
 * @param {{licenseId: string, activationId?: string, domain?: string, fingerprintHash?: string}} input
 * @returns {Promise<{requestId: string, operation: string, raw: Object}>}
 */
async function validateRemoteLicense(input) {
  return callRemote(REMOTE_OPERATIONS.VALIDATE, buildValidateRequest, input);
}

/**
 * heartbeat دورية بعد الـactivation (keep-alive/liveness) - مفيش أي
 * scheduling/cron هنا، الدالة دي بس بتعمل نداء واحد لو اتنادت.
 * @param {{licenseId: string, activationId: string}} input
 * @returns {Promise<{requestId: string, operation: string, raw: Object}>}
 */
async function heartbeatRemoteLicense(input) {
  return callRemote(REMOTE_OPERATIONS.HEARTBEAT, buildHeartbeatRequest, input);
}

/**
 * @param {{licenseId: string, activationId: string}} input
 * @returns {Promise<{requestId: string, operation: string, raw: Object}>}
 */
async function deactivateRemoteLicense(input) {
  return callRemote(REMOTE_OPERATIONS.DEACTIVATE, buildDeactivateRequest, input);
}

module.exports = {
  activateRemoteLicense,
  validateRemoteLicense,
  heartbeatRemoteLicense,
  deactivateRemoteLicense,
  setRemoteTransport,
  _resetTransportForTests,
};