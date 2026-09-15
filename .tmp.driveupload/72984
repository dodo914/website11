const { LICENSE_REMOTE_PROTOCOL_VERSION, ALLOWED_OPERATIONS } = require('./licenseRemoteProtocol');
const { verifyRemoteResponseSignature } = require('./licenseRemoteSignatureService');
const { normalizeRemoteLicenseResponse } = require('./licenseRemoteResponse');
const {
  RemoteProtocolInvalidError,
  RemoteSignatureInvalidError,
  RemoteResponseInvalidError,
  RemoteResponseExpiredError,
  RemoteRequestIdMismatchError,
} = require('./licenseErrors');

// ============================================================
// ===== LAVA Remote Response Validation Pipeline (PART 2B-1) ===
// ============================================================
// PART E: شكل الـenvelope الموحد اللي أي رد من License Server (مستقبلًا)
// المفروض يتوافق معاه:
//   { protocolVersion, operation, requestId, timestamp, success, code,
//     message, data, signature }
// - `data` هو الحقل الوحيد اللي بيتحول لـNormalizedRemoteLicenseState عن
//   طريق licenseRemoteResponse.normalizeRemoteLicenseResponse() (بنعيد
//   استخدامها هنا كما هي - مفيش duplicate/conflicting normalization).
// - `message` **مش** مصدر قرار أمني أبدًا - القرارات بتاعة الـpipeline
//   ده كلها بتعتمد على `code` + structured fields بس. `message` بيتشال
//   من الناتج النهائي عمدًا (مش بيتسرب لأي منطق قرار)، وعمدًا برضو مش
//   جوه الـsigned payload (شوف licenseRemoteSignatureService.js).
//
// ---- SECURITY FIX: `timestamp` بقى REQUIRED دلوقتي (مش اختياري زي قبل
// كده) - إحنا لسه في Protocol Version 1 وقبل بناء License Server
// الحقيقي، فمفيش داعي لـbackward compatibility مع رد من غير timestamp.
// بما إننا بنعتمد على timestamp في freshness/replay foundation، رد من
// غيره منعتبرش صالح أصلًا (REMOTE_RESPONSE_INVALID) - ومهم كمان إنه بقى
// جزء من الـsigned payload نفسه (مش بس بيتفحص شكليًا) عشان محدش يقدر
// يغيّره من غير ما يكسر الإمضاء.
//
// PART I: الـpipeline بترتيب صارم واحد بس، ومفيش تخطي/عكس:
//   Raw response
//     -> Envelope validation
//     -> Protocol version validation
//     -> Request ID validation
//     -> Timestamp validation
//     -> Signature verification
//     -> Payload normalization
//     -> Business status interpretation
// خصوصًا: **الترخيص منعتبرش active قبل ما signature verification تعدي
// بنجاح** - أي خطوة فشلت بترمي error واضح فورًا (fail-closed)، ومفيش أي
// كود بعدها بيتنفذ. حتى HTTP status 200 مش سبب كافي لوحده للثقة في الرد -
// الـpipeline ده هو اللي بيقرر، مش الـtransport.

const DEFAULT_MAX_RESPONSE_AGE_MS = 5 * 60 * 1000; // 5 minutes - نفس الـskew المستخدم في الـrequest (PART D)

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * PART I - خطوة 1: شكل الـenvelope نفسه سليم؟ (types + حقول أساسية
 * موجودة). فشل هنا = REMOTE_RESPONSE_INVALID أو REMOTE_SIGNATURE_INVALID
 * (لو تحديدًا الإمضاء ناقصة - عشان نفرّق "شكل غلط" عن "مفيش إمضاء خالص").
 * @param {*} raw
 * @returns {Object} نفس raw لو سليم (للتسلسل - convenience)
 */
function validateEnvelope(raw) {
  if (!isPlainObject(raw)) {
    throw new RemoteResponseInvalidError({ reason: 'not_an_object' });
  }
  // SECURITY FIX (PART 3C interop): the *type* of protocolVersion is
  // intentionally NOT constrained to `string` here. The independent
  // License Server signs and sends protocolVersion as a JSON number
  // (see its config.protocolVersion, parsed via parseInt), while this
  // codebase's own request-side constant is historically a string
  // ('1' — see licenseRemoteProtocol.js and its tests, unchanged by
  // this fix). Requiring `typeof === 'string'` here would reject every
  // real, correctly-signed response from the real server outright.
  // What actually matters is that the field exists and is a scalar
  // (string or number) usable for a value-comparison below and for
  // rebuilding the exact canonical signing bytes — see
  // validateSignature(), which always uses this value exactly as
  // received (never coerced), since the signature was computed over
  // whatever bytes the server actually put on the wire.
  if (
    (typeof raw.protocolVersion !== 'string' && typeof raw.protocolVersion !== 'number') ||
    raw.protocolVersion === ''
  ) {
    throw new RemoteResponseInvalidError({ reason: 'missing_protocol_version' });
  }
  if (typeof raw.operation !== 'string' || !ALLOWED_OPERATIONS.includes(raw.operation)) {
    throw new RemoteResponseInvalidError({ reason: 'missing_or_unknown_operation' });
  }
  if (typeof raw.requestId !== 'string' || !raw.requestId) {
    throw new RemoteResponseInvalidError({ reason: 'missing_request_id' });
  }
  // timestamp REQUIRED (SECURITY FIX) - رد بدونه مرفوض من هنا، قبل حتى ما
  // نوصل لخطوة الـtimestamp validation المخصصة (اللي بتتحقق من الصلاحية/
  // الـstaleness، مش من الوجود).
  if (typeof raw.timestamp !== 'string' || !raw.timestamp) {
    throw new RemoteResponseInvalidError({ reason: 'missing_timestamp' });
  }
  if (typeof raw.success !== 'boolean') {
    throw new RemoteResponseInvalidError({ reason: 'missing_success_flag' });
  }
  if (typeof raw.code !== 'string' || !raw.code) {
    throw new RemoteResponseInvalidError({ reason: 'missing_code' });
  }
  if (raw.data !== null && raw.data !== undefined && !isPlainObject(raw.data)) {
    throw new RemoteResponseInvalidError({ reason: 'malformed_data' });
  }
  // إمضاء ناقصة/مش string بترمي typed error مختلف عمدًا (REMOTE_SIGNATURE_INVALID)
  // - ده مش "شكل الرد غلط" عام، ده تحديدًا غياب إثبات الهوية.
  if (typeof raw.signature !== 'string' || !raw.signature) {
    throw new RemoteSignatureInvalidError({ reason: 'missing_signature' });
  }
  return raw;
}

/** PART I - خطوة 2. */
function validateProtocolVersion(envelope) {
  // Value-compared via String() coercion (not strict `!==`), for the
  // same interop reason documented in validateEnvelope() above: the
  // real License Server sends protocolVersion as a number, this
  // codebase's local constant is a string. String("1") === "1" and
  // String(1) === "1" both compare equal here — this is purely an
  // accept/reject gate, never used to rebuild signed bytes (that's
  // validateSignature(), which uses envelope.protocolVersion untouched).
  if (String(envelope.protocolVersion) !== LICENSE_REMOTE_PROTOCOL_VERSION) {
    throw new RemoteProtocolInvalidError({ receivedVersion: envelope.protocolVersion });
  }
}

/**
 * PART I - خطوة 3. لازم الـcaller يبعت الـrequestId الأصلي اللي هو ولّده
 * (licenseRemoteProtocol.generateRequestId()) وقت بناء الـrequest - رد
 * برقم مختلف (أو من غير رقم) منعتبرش رد على نفس الطلب.
 */
function validateRequestId(envelope, expectedRequestId) {
  if (!expectedRequestId || typeof expectedRequestId !== 'string') {
    throw new Error('licenseRemoteResponsePipeline: expectedRequestId is required to validate a response');
  }
  if (envelope.requestId !== expectedRequestId) {
    throw new RemoteRequestIdMismatchError({});
  }
}

/**
 * PART I - خطوة 4 (PART D foundation). `timestamp` REQUIRED دلوقتي
 * (validateEnvelope فوق بيتأكد إنه موجود كـstring أصلًا) - الدالة دي
 * مسؤولة عن حاجتين بعد كده: شكله صالح كتاريخ فعلي، ومش خارج حدود الـ
 * clock skew المسموح بيها (ماضي أو مستقبل - Math.abs بتغطي الاتنين).
 */
function validateTimestamp(envelope, now, maxAgeMs) {
  const ts = new Date(envelope.timestamp);
  if (Number.isNaN(ts.getTime())) {
    throw new RemoteResponseInvalidError({ reason: 'malformed_timestamp' });
  }
  const ageMs = Math.abs(now.getTime() - ts.getTime());
  if (ageMs > maxAgeMs) {
    throw new RemoteResponseExpiredError({});
  }
}

/**
 * PART I - خطوة 5. الإمضاء بقت بتغطي timestamp/success/code كمان (مش
 * data بس) - شوف licenseRemoteSignatureService.js للتفاصيل.
 */
function validateSignature(envelope, publicKeyPem) {
  const verified = verifyRemoteResponseSignature({
    protocolVersion: envelope.protocolVersion,
    operation: envelope.operation,
    requestId: envelope.requestId,
    timestamp: envelope.timestamp,
    success: envelope.success,
    code: envelope.code,
    data: envelope.data === undefined ? null : envelope.data,
    signature: envelope.signature,
    publicKeyPem,
  });
  if (!verified) {
    throw new RemoteSignatureInvalidError({});
  }
}

/**
 * بيشغّل الـpipeline بالكامل بالترتيب الصارم بتاع PART I. **لا تستدعي أي
 * من الدوال الفرعية فوق مباشرة بترتيب مختلف** - الدالة دي هي نقطة الدخول
 * الوحيدة المفروض تتستخدم من أي كود مستقبلي (licenseService.js وقت
 * التوصيل في Prompt 2B-2).
 * @param {Object} raw - الرد الخام (مش موثوق) من License Server
 * @param {{expectedRequestId: string, publicKeyPem?: string, now?: Date, maxAgeMs?: number}} options
 * @returns {{success: boolean, code: string, operation: string, data: import('./licenseRemoteResponse').NormalizedRemoteLicenseState|null}}
 *   ملحوظة: `message` مش موجود في الناتج عمدًا - مش مصدر قرار.
 */
function processRemoteResponse(raw, { expectedRequestId, publicKeyPem, now = new Date(), maxAgeMs = DEFAULT_MAX_RESPONSE_AGE_MS } = {}) {
  const envelope = validateEnvelope(raw);
  validateProtocolVersion(envelope);
  validateRequestId(envelope, expectedRequestId);
  validateTimestamp(envelope, now, maxAgeMs);
  validateSignature(envelope, publicKeyPem);

  // من هنا بس (بعد ما الإمضاء اتحققت) مسموح نطبّع الـdata ونفسرها كحالة
  // ترخيص - قبل كده كان أي استنتاج business-level سابق لأوانه وغير آمن.
  const normalizedData = envelope.data ? normalizeRemoteLicenseResponse(envelope.data) : null;

  return {
    success: envelope.success === true,
    code: envelope.code,
    operation: envelope.operation,
    data: normalizedData,
  };
}

module.exports = {
  DEFAULT_MAX_RESPONSE_AGE_MS,
  validateEnvelope,
  validateProtocolVersion,
  validateRequestId,
  validateTimestamp,
  validateSignature,
  processRemoteResponse,
};