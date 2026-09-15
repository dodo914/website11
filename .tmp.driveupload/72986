const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const protocol = require(path.join(root, 'services/license/licenseRemoteProtocol.js'));
const signatureService = require(path.join(root, 'services/license/licenseRemoteSignatureService.js'));
const pipeline = require(path.join(root, 'services/license/licenseRemoteResponsePipeline.js'));
const remoteClient = require(path.join(root, 'services/license/licenseRemoteClient.js'));
const {
  RemoteProtocolInvalidError,
  RemoteSignatureInvalidError,
  RemoteResponseInvalidError,
  RemoteResponseExpiredError,
  RemoteRequestIdMismatchError,
  RemoteLicenseUnavailableError,
} = require(path.join(root, 'services/license/licenseErrors.js'));

// ============================================================
// PART 2B-1 - Remote License Protocol Foundation tests.
// مفيش أي HTTP request حقيقي في أي تست هنا - كل حاجة إما pure function،
// إما injected/mock transport.
// ============================================================

function withEnv(vars, fn) {
  const original = {};
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(original)) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    });
}

/** بيولّد زوج مفاتيح Ed25519 للتستات بس - مش حقيقي/إنتاج. */
function generateTestKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey,
  };
}

/**
 * بيوقّع envelope-shape data بمفتاح تست ويرجع base64 signature - بيستخدم
 * نفس canonical fields اللي licenseRemoteSignatureService.js بيتحقق
 * منها فعليًا (SECURITY FIX: protocolVersion/operation/requestId/
 * timestamp/success/code/data) - عشان الـtest signature يمثل فعليًا
 * الشكل اللي License Server هيستخدمه مستقبلًا.
 */
function signTestEnvelope({ privateKey, protocolVersion, operation, requestId, timestamp, success, code, data }) {
  const payload = signatureService.buildCanonicalSigningPayload({ protocolVersion, operation, requestId, timestamp, success, code, data });
  return crypto.sign(null, payload, privateKey).toString('base64');
}

// ---------- 1: protocol version constant ----------

test('protocol version is a fixed, non-empty string', () => {
  assert.equal(typeof protocol.LICENSE_REMOTE_PROTOCOL_VERSION, 'string');
  assert.ok(protocol.LICENSE_REMOTE_PROTOCOL_VERSION.length > 0);
  assert.equal(protocol.LICENSE_REMOTE_PROTOCOL_VERSION, '1');
});

// ---------- 2-5: request structures ----------

test('buildActivateRequest: produces the expected shape', () => {
  const req = protocol.buildActivateRequest({
    licenseId: 'LIC-1',
    domain: 'shop.com',
    fingerprintHash: 'abc123',
    buildId: 'build-1',
    appVersion: '1.2.3',
    environment: 'production',
  });
  assert.equal(req.protocolVersion, protocol.LICENSE_REMOTE_PROTOCOL_VERSION);
  assert.equal(req.operation, protocol.REMOTE_OPERATIONS.ACTIVATE);
  assert.equal(req.licenseId, 'LIC-1');
  assert.equal(req.domain, 'shop.com');
  assert.equal(req.fingerprintHash, 'abc123');
  assert.equal(req.buildId, 'build-1');
  assert.equal(req.appVersion, '1.2.3');
  assert.equal(req.environment, 'production');
});

test('buildValidateRequest: produces the expected shape, activationId optional', () => {
  const req = protocol.buildValidateRequest({ licenseId: 'LIC-1' });
  assert.equal(req.operation, protocol.REMOTE_OPERATIONS.VALIDATE);
  assert.equal(req.licenseId, 'LIC-1');
  assert.equal(req.activationId, null);
});

test('buildHeartbeatRequest: produces the expected shape', () => {
  const req = protocol.buildHeartbeatRequest({ licenseId: 'LIC-1', activationId: 'ACT-1' });
  assert.equal(req.operation, protocol.REMOTE_OPERATIONS.HEARTBEAT);
  assert.equal(req.licenseId, 'LIC-1');
  assert.equal(req.activationId, 'ACT-1');
});

test('buildDeactivateRequest: produces the expected shape', () => {
  const req = protocol.buildDeactivateRequest({ licenseId: 'LIC-1', activationId: 'ACT-1' });
  assert.equal(req.operation, protocol.REMOTE_OPERATIONS.DEACTIVATE);
  assert.equal(req.licenseId, 'LIC-1');
  assert.equal(req.activationId, 'ACT-1');
});

test('request builders: reject missing required fields', () => {
  assert.throws(() => protocol.buildActivateRequest({ licenseId: 'LIC-1' }));
  assert.throws(() => protocol.buildValidateRequest({}));
  assert.throws(() => protocol.buildHeartbeatRequest({ licenseId: 'LIC-1' }));
  assert.throws(() => protocol.buildDeactivateRequest({ licenseId: 'LIC-1' }));
});

// ---------- 6-7: requestId ----------

test('every built request has a requestId', () => {
  const req = protocol.buildValidateRequest({ licenseId: 'LIC-1' });
  assert.equal(typeof req.requestId, 'string');
  assert.ok(req.requestId.length > 0);
});

test('requestId is unique between requests', () => {
  const ids = new Set();
  for (let i = 0; i < 20; i += 1) {
    ids.add(protocol.buildValidateRequest({ licenseId: 'LIC-1' }).requestId);
  }
  assert.equal(ids.size, 20);
});

// ---------- 8: timestamp ----------

test('every built request has a valid ISO timestamp', () => {
  const req = protocol.buildValidateRequest({ licenseId: 'LIC-1' });
  assert.equal(typeof req.timestamp, 'string');
  assert.ok(!Number.isNaN(new Date(req.timestamp).getTime()));
});

// ---------- 9-10: no raw installationId, no secrets ----------

test('built requests never contain a raw installationId or any secret-like field', () => {
  const requests = [
    protocol.buildActivateRequest({ licenseId: 'LIC-1', domain: 'shop.com', fingerprintHash: 'abc', buildId: 'b1' }),
    protocol.buildValidateRequest({ licenseId: 'LIC-1', activationId: 'ACT-1' }),
    protocol.buildHeartbeatRequest({ licenseId: 'LIC-1', activationId: 'ACT-1' }),
    protocol.buildDeactivateRequest({ licenseId: 'LIC-1', activationId: 'ACT-1' }),
  ];
  const forbidden = ['installationid', 'secret', 'password', 'jwt', 'mongodburi', 'privatekey', 'apikey'];
  for (const req of requests) {
    const keys = Object.keys(req).map((k) => k.toLowerCase());
    for (const bad of forbidden) {
      assert.ok(!keys.some((k) => k.includes(bad)), `request must not contain a "${bad}"-like field`);
    }
  }
});

// ---------- 11-13: canonical payload determinism ----------

const FIXED_TEST_TIMESTAMP = '2026-01-01T00:00:00.000Z';

/** القيم الافتراضية المشتركة لأي canonical payload تست - fields ثابتة، مفيش random. */
function baseSigningFields(overrides = {}) {
  return {
    protocolVersion: '1',
    operation: 'VALIDATE',
    requestId: 'REQ-1',
    timestamp: FIXED_TEST_TIMESTAMP,
    success: true,
    code: 'OK',
    data: { licenseId: 'LIC-1', status: 'active' },
    ...overrides,
  };
}

test('buildCanonicalSigningPayload: same payload -> same canonical bytes regardless of key order', () => {
  const a = signatureService.buildCanonicalSigningPayload(
    baseSigningFields({ data: { licenseId: 'LIC-1', status: 'active' } })
  );
  const b = signatureService.buildCanonicalSigningPayload(
    baseSigningFields({ data: { status: 'active', licenseId: 'LIC-1' } })
  );
  assert.ok(a.equals(b));
});

test('buildCanonicalSigningPayload: a changed data field produces different canonical bytes', () => {
  const a = signatureService.buildCanonicalSigningPayload(baseSigningFields({ data: { licenseId: 'LIC-1' } }));
  const b = signatureService.buildCanonicalSigningPayload(baseSigningFields({ data: { licenseId: 'LIC-2' } }));
  assert.ok(!a.equals(b));
});

test('buildCanonicalSigningPayload: missing/undefined data fields become explicit null, not omitted', () => {
  const withUndefined = signatureService.buildCanonicalSigningPayload(
    baseSigningFields({ data: { licenseId: 'LIC-1', activationId: undefined } })
  );
  const withNull = signatureService.buildCanonicalSigningPayload(
    baseSigningFields({ data: { licenseId: 'LIC-1', activationId: null } })
  );
  assert.ok(withUndefined.equals(withNull));
});

// ---- SECURITY FIX: timestamp/success/code are now part of the canonical
// payload too - changing any of them must change the canonical bytes.

test('buildCanonicalSigningPayload: a changed timestamp produces different canonical bytes', () => {
  const a = signatureService.buildCanonicalSigningPayload(baseSigningFields({ timestamp: '2026-01-01T00:00:00.000Z' }));
  const b = signatureService.buildCanonicalSigningPayload(baseSigningFields({ timestamp: '2026-01-01T00:05:00.000Z' }));
  assert.ok(!a.equals(b));
});

test('buildCanonicalSigningPayload: a changed success flag produces different canonical bytes', () => {
  const a = signatureService.buildCanonicalSigningPayload(baseSigningFields({ success: true }));
  const b = signatureService.buildCanonicalSigningPayload(baseSigningFields({ success: false }));
  assert.ok(!a.equals(b));
});

test('buildCanonicalSigningPayload: a changed code produces different canonical bytes', () => {
  const a = signatureService.buildCanonicalSigningPayload(baseSigningFields({ code: 'OK' }));
  const b = signatureService.buildCanonicalSigningPayload(baseSigningFields({ code: 'INVALID' }));
  assert.ok(!a.equals(b));
});

test('buildCanonicalSigningPayload: rejects a missing timestamp', () => {
  const fields = baseSigningFields();
  delete fields.timestamp;
  assert.throws(() => signatureService.buildCanonicalSigningPayload(fields));
});

test('buildCanonicalSigningPayload: rejects a non-boolean success flag', () => {
  assert.throws(() => signatureService.buildCanonicalSigningPayload(baseSigningFields({ success: 'true' })));
  assert.throws(() => signatureService.buildCanonicalSigningPayload(baseSigningFields({ success: undefined })));
});

test('buildCanonicalSigningPayload: rejects a missing code', () => {
  const fields = baseSigningFields();
  delete fields.code;
  assert.throws(() => signatureService.buildCanonicalSigningPayload(fields));
});

test('buildCanonicalSigningPayload: success:false is preserved correctly (not confused with a missing field)', () => {
  const withFalse = signatureService.buildCanonicalSigningPayload(baseSigningFields({ success: false }));
  const withTrue = signatureService.buildCanonicalSigningPayload(baseSigningFields({ success: true }));
  assert.ok(!withFalse.equals(withTrue));
});

// ---------- 14-19: Ed25519 signature verification ----------

/** بيبني fields + signature صحيحة لزوج مفاتيح تست معين - convenience للتستات تحت. */
function signedFields(privateKey, overrides = {}) {
  const fields = baseSigningFields(overrides);
  const signature = signTestEnvelope({ privateKey, ...fields });
  return { ...fields, signature };
}

test('verifyRemoteResponseSignature: a valid Ed25519 signature is accepted', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const ok = signatureService.verifyRemoteResponseSignature({ ...signedFields(privateKey), publicKeyPem });
  assert.equal(ok, true);
});

test('verifyRemoteResponseSignature: a modified data payload is rejected', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey);
  const ok = signatureService.verifyRemoteResponseSignature({
    ...fields,
    data: { licenseId: 'LIC-1', status: 'revoked' }, // tampered after signing
    publicKeyPem,
  });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: a modified signature is rejected', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey);
  const tampered = Buffer.from(fields.signature, 'base64');
  tampered[0] ^= 0xff; // flip bits
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, signature: tampered.toString('base64'), publicKeyPem });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: a missing signature is rejected', () => {
  const { publicKeyPem } = generateTestKeyPair();
  const ok = signatureService.verifyRemoteResponseSignature({ ...baseSigningFields(), signature: undefined, publicKeyPem });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: a missing public key is rejected (no crash)', () => {
  const { privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey);
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, publicKeyPem: '' });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: a malformed public key is rejected (no crash)', () => {
  const { privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey);
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, publicKeyPem: 'not a real PEM key' });
  assert.equal(ok, false);
});

// ---- SECURITY FIX: PART 5 items 1-7 - changing any signed field AFTER
// signing must invalidate the signature, one field at a time.

test('verifyRemoteResponseSignature: changing timestamp after signing invalidates the signature', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey, { timestamp: '2026-01-01T00:00:00.000Z' });
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, timestamp: '2026-01-01T00:05:00.000Z', publicKeyPem });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: changing success after signing invalidates the signature', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey, { success: true });
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, success: false, publicKeyPem });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: changing code after signing invalidates the signature', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey, { code: 'OK' });
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, code: 'INVALID', publicKeyPem });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: changing protocolVersion after signing invalidates the signature', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey, { protocolVersion: '1' });
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, protocolVersion: '2', publicKeyPem });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: changing operation after signing invalidates the signature', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey, { operation: 'VALIDATE' });
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, operation: 'ACTIVATE', publicKeyPem });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: changing requestId after signing invalidates the signature', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey, { requestId: 'REQ-1' });
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, requestId: 'REQ-2', publicKeyPem });
  assert.equal(ok, false);
});

test('verifyRemoteResponseSignature: changing data after signing invalidates the signature', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const fields = signedFields(privateKey, { data: { licenseId: 'LIC-1' } });
  const ok = signatureService.verifyRemoteResponseSignature({ ...fields, data: { licenseId: 'LIC-2' }, publicKeyPem });
  assert.equal(ok, false);
});

test('loadPublicKey: rejects a well-formed PEM of the wrong key type (e.g. RSA)', () => {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  assert.equal(signatureService.loadPublicKey(pem), null);
});

// ---------- Response validation pipeline (Part I) ----------

/**
 * بيبني envelope موقّع بشكل صحيح بالكامل (protocolVersion/operation/
 * requestId/timestamp/success/code/data كلهم جوه الإمضاء - SECURITY FIX).
 * `overrides` بتتطبق **بعد** حساب الإمضاء عمدًا - عشان تستخدم في تستات
 * الـtampering (تغيير حقل بعد التوقيع لازم يبوّظ الإمضاء).
 */
function buildSignedEnvelope({
  privateKey,
  publicKeyPem,
  requestId = 'REQ-1',
  operation = 'VALIDATE',
  timestamp = new Date().toISOString(),
  success = true,
  code = 'OK',
  data = { licenseId: 'LIC-1', status: 'active' },
  overrides = {},
}) {
  const protocolVersion = overrides.protocolVersion || protocol.LICENSE_REMOTE_PROTOCOL_VERSION;
  const signature =
    overrides.signature !== undefined
      ? overrides.signature
      : signTestEnvelope({ privateKey, protocolVersion, operation, requestId, timestamp, success, code, data });
  return {
    protocolVersion,
    operation,
    requestId,
    timestamp,
    success,
    code,
    message: 'ok',
    data,
    signature,
    ...overrides,
  };
}

test('processRemoteResponse: a fully valid signed response (with timestamp + success + code) is accepted end-to-end', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem });

  const result = pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem });
  assert.equal(result.success, true);
  assert.equal(result.code, 'OK');
  assert.equal(result.data.licenseId, 'LIC-1');
  assert.equal(result.data.status, 'active');
});

// ---------- 20: unsupported protocol version rejected ----------

test('processRemoteResponse: unsupported protocol version is rejected', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, overrides: { protocolVersion: '999' } });

  assert.throws(() => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem }), RemoteProtocolInvalidError);
});

// ---------- 21: requestId mismatch rejected ----------

test('processRemoteResponse: a requestId mismatch is rejected', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, requestId: 'REQ-1' });

  assert.throws(
    () => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-DIFFERENT', publicKeyPem }),
    RemoteRequestIdMismatchError
  );
});

// ---------- 22: expired/stale response rejected (timestamp now signed too) ----------

test('processRemoteResponse: a stale timestamp beyond the allowed window is rejected', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const staleTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, timestamp: staleTimestamp, data: { licenseId: 'LIC-1' } });

  assert.throws(
    () => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem, maxAgeMs: 5 * 60 * 1000 }),
    RemoteResponseExpiredError
  );
});

test('processRemoteResponse: a future timestamp beyond the allowed window is rejected', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const futureTimestamp = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h in the future
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, timestamp: futureTimestamp, data: { licenseId: 'LIC-1' } });

  assert.throws(
    () => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem, maxAgeMs: 5 * 60 * 1000 }),
    RemoteResponseExpiredError
  );
});

// ---- SECURITY FIX (PART 4): timestamp بقى REQUIRED - رد من غيره مرفوض
// كـREMOTE_RESPONSE_INVALID (مش يتقبل كـ"مفيش staleness check" زي قبل).

test('processRemoteResponse: a response with no timestamp field is rejected as invalid (timestamp is now required)', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, overrides: { timestamp: undefined } });

  assert.throws(() => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem }), RemoteResponseInvalidError);
});

test('processRemoteResponse: a malformed timestamp is rejected as invalid', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  // envelope بيتبني بإمضاء صحيحة على timestamp حقيقي، وبعدين بنستبدله بـ
  // string مش تاريخ - المفروض يترفض كـREMOTE_RESPONSE_INVALID (شكل غلط)
  // قبل حتى ما نوصل لخطوة التحقق من الإمضاء.
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, overrides: { timestamp: 'not-a-real-date' } });

  assert.throws(() => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem }), RemoteResponseInvalidError);
});

// ---------- 23: unsigned response is never accepted ----------

test('processRemoteResponse: a response with no signature is never accepted as valid', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, overrides: { signature: undefined } });

  assert.throws(() => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem }), RemoteSignatureInvalidError);
});

test('processRemoteResponse: a tampered signature is never accepted as valid', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem });
  const tampered = Buffer.from(envelope.signature, 'base64');
  tampered[0] ^= 0xff;
  envelope.signature = tampered.toString('base64');

  assert.throws(() => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem }), RemoteSignatureInvalidError);
});

// ---- SECURITY FIX (PART 5 items 2-3): tampering with success/code AFTER
// signing must be caught by the pipeline too (not just the raw signature
// service unit tests above) - end-to-end through processRemoteResponse.

test('processRemoteResponse: a success flag tampered with after signing is rejected', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, success: true });
  envelope.success = false; // tampered post-signing

  assert.throws(() => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem }), RemoteSignatureInvalidError);
});

test('processRemoteResponse: a code tampered with after signing is rejected', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, code: 'OK' });
  envelope.code = 'REVOKED'; // tampered post-signing

  assert.throws(() => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem }), RemoteSignatureInvalidError);
});

// ---- SECURITY FIX (PART 5 item 13): message is intentionally unsigned -
// modifying it must never change the business decision, since the pipeline
// never reads it in the first place.

test('processRemoteResponse: modifying message after signing does not change the decision (message is intentionally unsigned)', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem });
  envelope.message = 'totally different message, still not trusted';

  const result = pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem });
  assert.equal(result.success, true);
  assert.equal(result.code, 'OK');
  assert.ok(!('message' in result));
});

// ---------- 19: malformed response rejected ----------

test('processRemoteResponse: a malformed/non-object response is rejected', () => {
  assert.throws(() => pipeline.processRemoteResponse(null, { expectedRequestId: 'REQ-1' }), RemoteResponseInvalidError);
  assert.throws(() => pipeline.processRemoteResponse('not an object', { expectedRequestId: 'REQ-1' }), RemoteResponseInvalidError);
  assert.throws(() => pipeline.processRemoteResponse({}, { expectedRequestId: 'REQ-1' }), RemoteResponseInvalidError);
});

test('processRemoteResponse: an unknown operation value is rejected', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, operation: 'NOT_A_REAL_OPERATION' });

  assert.throws(() => pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem }), RemoteResponseInvalidError);
});

test('processRemoteResponse: license is never treated as active before signature verification passes (order of operations)', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  // نبني envelope صحيح الشكل لكن بإمضاء متلخبط - المفروض يتوقف عند
  // الإمضاء، مش يوصل لمرحلة تفسير business status.
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, data: { licenseId: 'LIC-1', status: 'active' } });
  envelope.signature = 'not-a-valid-signature-at-all';

  let reached = false;
  try {
    const result = pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem });
    reached = true;
    void result;
  } catch (err) {
    assert.ok(err instanceof RemoteSignatureInvalidError);
  }
  assert.equal(reached, false, 'must never reach business status interpretation with an invalid signature');
});

test("processRemoteResponse: 'message' field is not part of the decision output (code/data only)", () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, overrides: { message: 'ignored - not trustworthy for decisions' } });
  const result = pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem });
  assert.ok(!('message' in result));
});

// ---------- 24-25: mock transport + no real network ----------

test('licenseRemoteClient: a mock/injected transport is used, and it receives a protocol-shaped request', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    let receivedCall = null;
    remoteClient.setRemoteTransport(async (call) => {
      receivedCall = call;
      return { mocked: true };
    });
    try {
      const result = await remoteClient.validateRemoteLicense({ licenseId: 'LIC-1' });
      // PART 2B-2A: remoteClient بقى بيرجّع { requestId, operation, raw } -
      // مش الـraw response لوحدها - عشان الـorchestrator يقدر يستخدم
      // requestId ده كـexpectedRequestId في processRemoteResponse() بعد كده.
      assert.deepEqual(result.raw, { mocked: true });
      assert.equal(result.operation, protocol.REMOTE_OPERATIONS.VALIDATE);
      assert.equal(typeof result.requestId, 'string');
      assert.ok(receivedCall, 'transport must have been called');
      assert.equal(receivedCall.operation, protocol.REMOTE_OPERATIONS.VALIDATE);
      assert.equal(receivedCall.payload.protocolVersion, protocol.LICENSE_REMOTE_PROTOCOL_VERSION);
      assert.equal(receivedCall.payload.licenseId, 'LIC-1');
      assert.equal(typeof receivedCall.payload.requestId, 'string');
      // requestId المرجوع لازم يكون بالظبط نفس requestId اللي اتبعت في الـrequest.
      assert.equal(result.requestId, receivedCall.payload.requestId);
    } finally {
      remoteClient._resetTransportForTests();
    }
  }));

test('licenseRemoteClient: with remote disabled, the request is never built and no transport call happens', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
    let transportCalls = 0;
    remoteClient.setRemoteTransport(async () => {
      transportCalls += 1;
      return {};
    });
    try {
      // Intentionally incomplete input (missing fingerprintHash/buildId) - proves the
      // protocol request is never even built while remote is disabled.
      await assert.rejects(() => remoteClient.activateRemoteLicense({ licenseId: 'LIC-1', domain: 'shop.com' }), RemoteLicenseUnavailableError);
      assert.equal(transportCalls, 0);
    } finally {
      remoteClient._resetTransportForTests();
    }
  }));

test('remote protocol/signature/pipeline files: no HTTP client libraries, no real fetch/axios/https, no Redis', () => {
  const fs = require('node:fs');
  const files = [
    'services/license/licenseRemoteProtocol.js',
    'services/license/licenseRemoteSignatureService.js',
    'services/license/licenseRemoteResponsePipeline.js',
    'services/license/licenseRemoteClient.js',
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(!/require\(['"]axios['"]\)/.test(source));
    assert.ok(!/require\(['"]node-fetch['"]\)/.test(source));
    assert.ok(!/require\(['"]https?['"]\)/.test(source));
    assert.ok(!/\bfetch\(/.test(source));
    assert.ok(!/new\s+Redis\s*\(/i.test(source));
  }
});

test('remote protocol/signature/pipeline files: never log payloads/signatures/keys', () => {
  const fs = require('node:fs');
  const files = [
    'services/license/licenseRemoteProtocol.js',
    'services/license/licenseRemoteSignatureService.js',
    'services/license/licenseRemoteResponsePipeline.js',
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(!/console\.(log|error|warn|info)\(/.test(source), `${file} must not log anything`);
  }
});

// ---------- integration with licenseRemoteResponse.js: no duplicate/conflicting normalization ----------

test('integration: processRemoteResponse reuses normalizeRemoteLicenseResponse (same normalized shape, e.g. maxActivations null handling)', () => {
  const { publicKeyPem, privateKey } = generateTestKeyPair();
  const data = { licenseId: 'LIC-1', maxActivations: null, status: 'active' };
  const envelope = buildSignedEnvelope({ privateKey, publicKeyPem, data });

  const result = pipeline.processRemoteResponse(envelope, { expectedRequestId: 'REQ-1', publicKeyPem });
  assert.equal(result.data.maxActivations, null);
  assert.deepEqual(result.data.allowedDomains, []);
});

test('integration boundary: licenseService.js is still not wired to the remote protocol (PART 2B-1 is still foundation-only)', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseService.js'), 'utf8');
  assert.ok(!/require\(.*licenseRemoteClient/.test(source));
  assert.ok(!/require\(.*licenseRemoteProtocol/.test(source));
  assert.ok(!/require\(.*licenseRemoteResponsePipeline/.test(source));
});