'use strict';

jest.mock('../services/idempotencyService', () => ({
  claimRequest: jest.fn(),
  completeRequest: jest.fn().mockResolvedValue(undefined),
  failRequest: jest.fn().mockResolvedValue(undefined),
  IdempotencyConflictError: class IdempotencyConflictError extends Error {
    constructor(message) {
      super(message);
      this.code = 'REQUEST_CONTEXT_MISMATCH';
    }
  },
  IdempotencyBusyError: class IdempotencyBusyError extends Error {
    constructor(message) {
      super(message);
      this.code = 'REQUEST_IN_PROGRESS';
    }
  },
}));
jest.mock('../services/licenseService', () => ({
  validateLicense: jest.fn(),
}));
jest.mock('../services/activationService', () => ({
  activateLicense: jest.fn(),
  heartbeat: jest.fn(),
  deactivateActivation: jest.fn(),
  ActivationError: class ActivationError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  },
}));
jest.mock('../license/protocol', () => ({
  buildSignedResponse: jest.fn((fields) => ({ ...fields, signature: 'fake-signature' })),
  SUPPORTED_OPERATIONS: ['ACTIVATE', 'VALIDATE', 'HEARTBEAT', 'DEACTIVATE'],
}));

const { handleProtocolRequest } = require('../controllers/licenseProtocolController');
const idempotencyService = require('../services/idempotencyService');
const licenseService = require('../services/licenseService');
const activationService = require('../services/activationService');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function baseBody(overrides = {}) {
  return {
    protocolVersion: 1,
    operation: 'VALIDATE',
    requestId: 'req-1',
    timestamp: new Date().toISOString(),
    licenseId: 'lic-1',
    ...overrides,
  };
}

describe('handleProtocolRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyService.claimRequest.mockResolvedValue({ claimed: true });
  });

  test('rejects a malformed request with 400 and never calls a service', async () => {
    const req = { body: { operation: 'NOT_REAL' } };
    const res = mockRes();

    await handleProtocolRequest(req, res);

    expect(res.statusCode).toBe(400);
    expect(licenseService.validateLicense).not.toHaveBeenCalled();
  });

  test('returns the previously stored response for a completed duplicate requestId without re-invoking the service', async () => {
    const cached = { success: true, code: 'OK', signature: 'cached-sig' };
    idempotencyService.claimRequest.mockResolvedValue({ claimed: false, response: cached });

    const req = { body: baseBody() };
    const res = mockRes();

    await handleProtocolRequest(req, res);

    expect(res.body).toEqual(cached);
    expect(licenseService.validateLicense).not.toHaveBeenCalled();
  });

  test('a conflicting requestId reuse is rejected with 409 and never invokes a service', async () => {
    idempotencyService.claimRequest.mockRejectedValue(
      new idempotencyService.IdempotencyConflictError('conflict')
    );

    const req = { body: baseBody() };
    const res = mockRes();

    await handleProtocolRequest(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('REQUEST_CONTEXT_MISMATCH');
    expect(licenseService.validateLicense).not.toHaveBeenCalled();
  });

  test('a still-processing duplicate is rejected with 409 and never invokes a service twice', async () => {
    idempotencyService.claimRequest.mockRejectedValue(
      new idempotencyService.IdempotencyBusyError('busy')
    );

    const req = { body: baseBody() };
    const res = mockRes();

    await handleProtocolRequest(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('REQUEST_IN_PROGRESS');
    expect(licenseService.validateLicense).not.toHaveBeenCalled();
  });

  test('VALIDATE success path signs and completes the claimed request', async () => {
    licenseService.validateLicense.mockResolvedValue({
      valid: true,
      code: 'ACTIVE',
      license: { status: 'active', features: [], expiresAt: null },
    });

    const req = { body: baseBody() };
    const res = mockRes();

    await handleProtocolRequest(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.signature).toBe('fake-signature');
    expect(idempotencyService.completeRequest).toHaveBeenCalled();
  });

  test('a well-understood ActivationError is signed as a failure response and completes the claim', async () => {
    activationService.activateLicense.mockRejectedValue(
      new activationService.ActivationError('Build ID does not match.', 'BUILD_ID_MISMATCH')
    );

    const req = {
      body: baseBody({
        operation: 'ACTIVATE',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
        buildId: 'wrong-build',
      }),
    };
    const res = mockRes();

    await handleProtocolRequest(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('BUILD_ID_MISMATCH');
    expect(idempotencyService.completeRequest).toHaveBeenCalled();
  });

  test('an unexpected internal error marks the claim as failed and never returns a trusted success response', async () => {
    licenseService.validateLicense.mockRejectedValue(new Error('db exploded'));

    const req = { body: baseBody() };
    const res = mockRes();

    await expect(handleProtocolRequest(req, res)).rejects.toThrow('db exploded');
    expect(idempotencyService.failRequest).toHaveBeenCalledWith({ requestId: 'req-1' });
    expect(idempotencyService.completeRequest).not.toHaveBeenCalled();
  });
});
