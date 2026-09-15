'use strict';

const { signPayload, verifyPayload, generateKeyPairB64, getPublicKeyB64 } = require('../license/signingService');

describe('signingService', () => {
  const { privateKeyB64, publicKeyB64 } = generateKeyPairB64();

  const payload = {
    protocolVersion: 1,
    operation: 'ACTIVATE',
    requestId: 'req-123',
    timestamp: '2026-01-01T00:00:00.000Z',
    success: true,
    code: 'OK',
    data: { activationId: 'abc' },
  };

  test('produces a valid Ed25519 signature verifiable with the public key', () => {
    const signature = signPayload(payload, { privateKeyB64 });
    const isValid = verifyPayload(payload, signature, publicKeyB64);
    expect(isValid).toBe(true);
  });

  test('signature is deterministic-input sensitive: any field change invalidates it', () => {
    const signature = signPayload(payload, { privateKeyB64 });
    const tampered = { ...payload, code: 'FAIL' };
    expect(verifyPayload(tampered, signature, publicKeyB64)).toBe(false);
  });

  test('tampering with timestamp invalidates the signature', () => {
    const signature = signPayload(payload, { privateKeyB64 });
    const tampered = { ...payload, timestamp: '2099-01-01T00:00:00.000Z' };
    expect(verifyPayload(tampered, signature, publicKeyB64)).toBe(false);
  });

  test('tampering with success invalidates the signature', () => {
    const signature = signPayload(payload, { privateKeyB64 });
    const tampered = { ...payload, success: false };
    expect(verifyPayload(tampered, signature, publicKeyB64)).toBe(false);
  });

  test('tampering with data invalidates the signature', () => {
    const signature = signPayload(payload, { privateKeyB64 });
    const tampered = { ...payload, data: { activationId: 'someone-elses-id' } };
    expect(verifyPayload(tampered, signature, publicKeyB64)).toBe(false);
  });

  test('rejects signatures verified against the wrong public key', () => {
    const signature = signPayload(payload, { privateKeyB64 });
    const other = generateKeyPairB64();
    expect(verifyPayload(payload, signature, other.publicKeyB64)).toBe(false);
  });

  test('getPublicKeyB64 returns a key that successfully verifies', () => {
    const derivedPublicKey = getPublicKeyB64(privateKeyB64);
    const signature = signPayload(payload, { privateKeyB64 });
    expect(verifyPayload(payload, signature, derivedPublicKey)).toBe(true);
  });

  test('throws on malformed key length', () => {
    expect(() => signPayload(payload, { privateKeyB64: 'not-a-valid-key' })).toThrow();
  });
});

describe('signingService <-> customer-side verification contract (STEP 16)', () => {
  // Reproduces ONLY the public canonicalization/verification contract the
  // customer-side LAVA verifier relies on (protocolVersion, operation,
  // requestId, timestamp, success, code, data — message excluded). This
  // does not import or duplicate the private key.
  const nacl = require('tweetnacl');
  const naclUtil = require('tweetnacl-util');

  function reproducedCustomerSideVerify(signedFields, signatureB64, publicKeyB64) {
    const canonical = JSON.stringify({
      protocolVersion: signedFields.protocolVersion,
      operation: signedFields.operation,
      requestId: signedFields.requestId,
      timestamp: signedFields.timestamp,
      success: signedFields.success,
      code: signedFields.code,
      data: signedFields.data,
    });
    const messageBytes = naclUtil.decodeUTF8(canonical);
    const signatureBytes = naclUtil.decodeBase64(signatureB64);
    const publicKeyBytes = naclUtil.decodeBase64(publicKeyB64);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  }

  test('License Server signed response verifies under the reproduced customer-side contract', () => {
    const { privateKeyB64, publicKeyB64 } = generateKeyPairB64();
    const { buildSignedResponse } = require('../license/protocol');

    const response = buildSignedResponse({
      operation: 'VALIDATE',
      requestId: 'req-999',
      success: true,
      code: 'OK',
      message: 'Validated',
      data: { valid: true },
      timestamp: '2026-01-01T00:00:00.000Z',
      privateKeyB64,
    });

    expect(
      reproducedCustomerSideVerify(response, response.signature, publicKeyB64)
    ).toBe(true);
  });

  test('message field is not part of the signed contract (STEP 7)', () => {
    const { privateKeyB64, publicKeyB64 } = generateKeyPairB64();
    const { buildSignedResponse } = require('../license/protocol');

    const responseA = buildSignedResponse({
      operation: 'VALIDATE',
      requestId: 'req-1',
      success: true,
      code: 'OK',
      message: 'Message A',
      data: {},
      timestamp: '2026-01-01T00:00:00.000Z',
      privateKeyB64,
    });

    // Swap in a different message but keep the same signature — should
    // still verify, proving `message` isn't part of the trust boundary.
    const responseB = { ...responseA, message: 'Completely different message' };

    expect(
      reproducedCustomerSideVerify(responseB, responseB.signature, publicKeyB64)
    ).toBe(true);
  });
});
