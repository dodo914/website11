'use strict';

const { validateProtocolRequest, RequestValidationError } = require('../services/requestValidationService');

function baseRequest(overrides = {}) {
  return {
    protocolVersion: 1,
    operation: 'VALIDATE',
    requestId: 'req-1',
    timestamp: new Date().toISOString(),
    licenseId: 'lic-1',
    ...overrides,
  };
}

describe('validateProtocolRequest', () => {
  test('accepts a well-formed VALIDATE request', () => {
    expect(() => validateProtocolRequest(baseRequest())).not.toThrow();
  });

  test('rejects wrong protocolVersion', () => {
    expect(() => validateProtocolRequest(baseRequest({ protocolVersion: 99 }))).toThrow(
      RequestValidationError
    );
  });

  test('rejects unsupported operation', () => {
    expect(() => validateProtocolRequest(baseRequest({ operation: 'DELETE_EVERYTHING' }))).toThrow(
      RequestValidationError
    );
  });

  test('rejects missing requestId', () => {
    const req = baseRequest();
    delete req.requestId;
    expect(() => validateProtocolRequest(req)).toThrow(RequestValidationError);
  });

  test('rejects invalid timestamp', () => {
    expect(() => validateProtocolRequest(baseRequest({ timestamp: 'not-a-date' }))).toThrow(
      RequestValidationError
    );
  });

  test('rejects timestamp far outside allowed skew', () => {
    const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(() => validateProtocolRequest(baseRequest({ timestamp: oldTimestamp }))).toThrow(
      RequestValidationError
    );
  });

  test('rejects ACTIVATE missing operation-specific fields', () => {
    expect(() =>
      validateProtocolRequest(baseRequest({ operation: 'ACTIVATE' }))
    ).toThrow(RequestValidationError);
  });

  test('accepts ACTIVATE with all required fields', () => {
    expect(() =>
      validateProtocolRequest(
        baseRequest({ operation: 'ACTIVATE', domain: 'example.com', fingerprintHash: 'hash' })
      )
    ).not.toThrow();
  });

  test('rejects a malformed (non-object) body', () => {
    expect(() => validateProtocolRequest(null)).toThrow(RequestValidationError);
    expect(() => validateProtocolRequest('a string')).toThrow(RequestValidationError);
  });

  test('does not trust customer-provided authorization fields', () => {
    // Passing these should not cause validation to treat the request
    // specially — they are simply ignored by validateProtocolRequest and
    // must never be consulted by services either (see licenseService).
    const req = baseRequest({
      status: 'active',
      maxActivations: 999999,
      expiresAt: '2099-01-01',
    });
    expect(() => validateProtocolRequest(req)).not.toThrow();
  });
});
