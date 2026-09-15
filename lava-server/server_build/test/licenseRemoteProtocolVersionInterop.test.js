const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const { processRemoteResponse } = require(path.join(root, 'services/license/licenseRemoteResponsePipeline.js'));
const signatureService = require(path.join(root, 'services/license/licenseRemoteSignatureService.js'));

// ============================================================
// ===== PART 3C: protocolVersion type interop regression test ===
// ============================================================
// The real, independent License Server sends protocolVersion as a JSON
// *number* (its config.protocolVersion is `parseInt(...) || 1`), while
// this codebase's own outgoing request constant is historically a
// *string* ('1'). Before this fix, validateEnvelope() strictly required
// `typeof protocolVersion === 'string'`, so every genuine, correctly
// signed response from the real server would have been rejected as
// REMOTE_RESPONSE_INVALID. This test proves that no longer happens,
// using a real Ed25519 keypair exactly like the real server would.

function buildRealServerStyleResponse({ privateKey, publicKey, requestId }) {
  const timestamp = new Date().toISOString();
  const fields = {
    protocolVersion: 1, // <-- number, exactly as the real License Server sends it
    operation: 'VALIDATE',
    requestId,
    timestamp,
    success: true,
    code: 'OK',
    data: { licenseId: 'LIC-1', status: 'active' },
  };
  const canonical = signatureService.buildCanonicalSigningPayload(fields);
  const signature = crypto.sign(null, canonical, privateKey).toString('base64');
  return { ...fields, message: 'ok', signature };
}

test('processRemoteResponse accepts a real-server-style response with numeric protocolVersion', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

  const requestId = 'req-interop-1';
  const raw = buildRealServerStyleResponse({ privateKey, publicKey, requestId });

  const result = processRemoteResponse(raw, { expectedRequestId: requestId, publicKeyPem });

  assert.equal(result.success, true);
  assert.equal(result.code, 'OK');
});

test('processRemoteResponse still rejects a genuinely wrong protocol version (e.g. "2")', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const requestId = 'req-interop-2';

  const timestamp = new Date().toISOString();
  const fields = {
    protocolVersion: 2,
    operation: 'VALIDATE',
    requestId,
    timestamp,
    success: true,
    code: 'OK',
    data: {},
  };
  const canonical = signatureService.buildCanonicalSigningPayload(fields);
  const signature = crypto.sign(null, canonical, privateKey).toString('base64');
  const raw = { ...fields, message: 'ok', signature };

  assert.throws(() => processRemoteResponse(raw, { expectedRequestId: requestId, publicKeyPem }));
});

test('processRemoteResponse still rejects a response with a tampered numeric protocolVersion (signature no longer matches)', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const requestId = 'req-interop-3';

  const raw = buildRealServerStyleResponse({ privateKey, publicKey, requestId });
  raw.protocolVersion = 1; // still passes the version gate...
  raw.data = { licenseId: 'TAMPERED' }; // ...but this invalidates the signature

  assert.throws(() => processRemoteResponse(raw, { expectedRequestId: requestId, publicKeyPem }));
});
