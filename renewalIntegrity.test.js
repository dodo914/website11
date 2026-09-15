'use strict';

// PART 3B-FIX: focused failure/concurrency coverage for renewal and for
// the "License mutation + audit event" atomicity fix. Deliberately
// exercises the real licenseService + idempotencyService +
// adminLicenseController code paths (not re-implemented mocks), against
// the in-memory FakeModel doubles — see the "Real MongoDB verification"
// note in the final report: this proves the compensation/rollback logic
// is correct, not that a real MongoDB replica-set transaction was used.

jest.mock('../models/License', () => ({
  License: require('./helpers/fakeModel').__sharedLicenseModel,
  LICENSE_TYPES: ['standard', 'source-code', 'resale', 'enterprise'],
  LICENSE_STATUSES: ['active', 'suspended', 'expired', 'revoked'],
}));
jest.mock('../models/LicenseEvent', () => ({
  LicenseEvent: require('./helpers/fakeModel').__sharedEventModel,
  EVENT_TYPES: [
    'LICENSE_CREATED', 'LICENSE_ACTIVATED', 'LICENSE_VALIDATED', 'LICENSE_DEACTIVATED',
    'LICENSE_EXPIRED', 'LICENSE_REVOKED', 'LICENSE_SUSPENDED', 'LICENSE_REACTIVATED',
    'LICENSE_RENEWED', 'DOMAIN_CHANGED', 'FINGERPRINT_CHANGED', 'ACTIVATION_LIMIT_REACHED',
    'ACTIVATION_LIMIT_CHANGED', 'FEATURES_UPDATED', 'BUILD_ID_CHANGED', 'INVALID_LICENSE',
    'INVALID_SIGNATURE', 'LICENSE_DOMAIN_NOT_ALLOWED', 'SUSPICIOUS_ACTIVITY',
  ],
}));
jest.mock('../models/ProcessedRequest', () => ({
  ProcessedRequest: require('./helpers/fakeModel').__sharedProcessedRequestModel,
}));

describe('PART 3B-FIX: renewal atomicity, idempotency, and concurrency', () => {
  let licenseService;
  let idempotencyService;
  let adminLicenseController;
  let License;
  let LicenseEvent;
  let ProcessedRequest;

  beforeEach(() => {
    jest.resetModules();
    const fakeModel = require('./helpers/fakeModel');
    fakeModel.__sharedLicenseModel.reset();
    fakeModel.__sharedEventModel.reset();
    fakeModel.__sharedProcessedRequestModel.reset();
    License = fakeModel.__sharedLicenseModel;
    LicenseEvent = fakeModel.__sharedEventModel;
    ProcessedRequest = fakeModel.__sharedProcessedRequestModel;

    licenseService = require('../services/licenseService');
    idempotencyService = require('../services/idempotencyService');
    adminLicenseController = require('../controllers/adminLicenseController');
  });

  async function createLicense(overrides = {}) {
    return licenseService.createLicense({
      licenseId: overrides.licenseId || `lic-${Math.random().toString(36).slice(2)}`,
      customerReference: 'cust-1',
      type: 'standard',
      maxActivations: 5,
      ...overrides,
    });
  }

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

  // --- 1. Renewal success -----------------------------------------------

  test('renewal success: expiry changes, LICENSE_RENEWED exists, ProcessedRequest COMPLETED', async () => {
    const license = await createLicense();
    LicenseEvent.reset(); // ignore LICENSE_CREATED

    const req = {
      params: { licenseId: license.licenseId },
      body: { durationDays: 30, paymentReference: 'pay-1', requestId: 'renew-success-1' },
    };
    const res = mockRes();
    await adminLicenseController.renewLicense(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.license.expiresAt).toBeTruthy();

    const events = await LicenseEvent.find({ eventType: 'LICENSE_RENEWED', licenseId: license.licenseId });
    expect(events.length).toBe(1);

    const processed = ProcessedRequest.docs.find((d) => d.requestId === 'renew-success-1');
    expect(processed.status).toBe('COMPLETED');
  });

  // --- 2. Same requestId replay ------------------------------------------

  test('same requestId replayed sequentially: expiry changes only once, one event, second request replays', async () => {
    const license = await createLicense();
    LicenseEvent.reset();

    const body = { durationDays: 30, paymentReference: 'pay-2', requestId: 'renew-replay-1' };

    const res1 = mockRes();
    await adminLicenseController.renewLicense({ params: { licenseId: license.licenseId }, body }, res1);
    const res2 = mockRes();
    await adminLicenseController.renewLicense({ params: { licenseId: license.licenseId }, body }, res2);

    expect(res1.body.license.expiresAt).toBe(res2.body.license.expiresAt);

    const events = await LicenseEvent.find({ eventType: 'LICENSE_RENEWED', licenseId: license.licenseId });
    expect(events.length).toBe(1);
  });

  // --- 3. Concurrent same requestId --------------------------------------

  test('concurrent requests with the same requestId renew exactly once', async () => {
    const license = await createLicense();
    LicenseEvent.reset();

    const body = { durationDays: 15, paymentReference: 'pay-3', requestId: 'renew-concurrent-same' };
    const makeCall = () => {
      const res = mockRes();
      return adminLicenseController
        .renewLicense({ params: { licenseId: license.licenseId }, body }, res)
        .then(() => res);
    };

    const [res1, res2, res3] = await Promise.all([makeCall(), makeCall(), makeCall()]);

    const events = await LicenseEvent.find({ eventType: 'LICENSE_RENEWED', licenseId: license.licenseId });
    expect(events.length).toBe(1);

    const successResponses = [res1, res2, res3].filter((r) => r.statusCode === 200);
    // At least one succeeds; any that got a "still processing" 409 is
    // acceptable (the caller is expected to retry the identical
    // request), but none may show a *different* expiry than the others.
    const expiries = new Set(successResponses.map((r) => r.body.license.expiresAt));
    expect(expiries.size).toBe(1);
  });

  // --- 4 & 5. Event failure, and event failure + retry never double-renews ---

  test('event failure during renewal leaves License/ProcessedRequest/LicenseEvent consistent, and a retry does not double-renew', async () => {
    const license = await createLicense();
    LicenseEvent.reset();
    const originalExpiresAt = license.expiresAt;

    const createSpy = jest
      .spyOn(LicenseEvent, 'create')
      .mockRejectedValueOnce(new Error('simulated LicenseEvent write failure'));

    const requestId = 'renew-event-failure-1';
    const body = { durationDays: 30, paymentReference: 'pay-4', requestId };

    const res1 = mockRes();
    await expect(
      adminLicenseController.renewLicense({ params: { licenseId: license.licenseId }, body }, res1)
    ).rejects.toThrow('simulated LicenseEvent write failure');

    // No event was recorded, and the License must show NO trace of the
    // failed attempt (no-session fallback compensation rolled it back).
    const eventsAfterFailure = await LicenseEvent.find({ eventType: 'LICENSE_RENEWED', licenseId: license.licenseId });
    expect(eventsAfterFailure.length).toBe(0);

    const licenseAfterFailure = await License.findOne({ licenseId: license.licenseId });
    expect(licenseAfterFailure.expiresAt).toEqual(originalExpiresAt);

    const processedAfterFailure = ProcessedRequest.docs.find((d) => d.requestId === requestId);
    expect(processedAfterFailure.status).toBe('FAILED');

    createSpy.mockRestore();

    // Retry with the SAME requestId: must renew exactly once now, not
    // "again on top of" a phantom prior renewal.
    const res2 = mockRes();
    await adminLicenseController.renewLicense({ params: { licenseId: license.licenseId }, body }, res2);
    expect(res2.statusCode).toBe(200);

    const eventsAfterRetry = await LicenseEvent.find({ eventType: 'LICENSE_RENEWED', licenseId: license.licenseId });
    expect(eventsAfterRetry.length).toBe(1);

    const expectedExpiresAt = new Date(originalExpiresAt ?? Date.now()).getTime() || Date.now();
    const licenseAfterRetry = await License.findOne({ licenseId: license.licenseId });
    const expectedNew = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime();
    // Renewed exactly once (30 days from "now", not 60 days from two renewals).
    expect(Math.abs(licenseAfterRetry.expiresAt.getTime() - expectedNew)).toBeLessThan(5000);
  });

  // --- 6. Concurrent different requestIds: no lost update -----------------

  test('concurrent renewals with different requestIds for the same license never lose an update', async () => {
    const license = await createLicense();
    LicenseEvent.reset();

    const [resA, resB] = await Promise.all([
      (async () => {
        const res = mockRes();
        await adminLicenseController.renewLicense(
          { params: { licenseId: license.licenseId }, body: { durationDays: 10, requestId: 'renew-diff-A' } },
          res
        );
        return res;
      })(),
      (async () => {
        const res = mockRes();
        await adminLicenseController.renewLicense(
          { params: { licenseId: license.licenseId }, body: { durationDays: 20, requestId: 'renew-diff-B' } },
          res
        );
        return res;
      })(),
    ]);

    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);

    // Both extensions must be reflected: exactly 2 LICENSE_RENEWED
    // events, and the final expiry must be ~30 days out (10 + 20),
    // never just one of the two (that would mean a lost update).
    const events = await LicenseEvent.find({ eventType: 'LICENSE_RENEWED', licenseId: license.licenseId });
    expect(events.length).toBe(2);

    const finalLicense = await License.findOne({ licenseId: license.licenseId });
    const expectedFinal = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(finalLicense.expiresAt.getTime() - expectedFinal)).toBeLessThan(5000);
  });

  // --- 7. Lifecycle event failure (suspend) rolls back in no-session mode --

  test('a LicenseEvent failure during suspend leaves the license active, not silently suspended', async () => {
    const license = await createLicense();
    LicenseEvent.reset();

    const createSpy = jest
      .spyOn(LicenseEvent, 'create')
      .mockRejectedValueOnce(new Error('simulated LicenseEvent write failure'));

    await expect(licenseService.suspendLicense(license.licenseId)).rejects.toThrow(
      'simulated LicenseEvent write failure'
    );

    const current = await License.findOne({ licenseId: license.licenseId });
    expect(current.status).toBe('active'); // rolled back, not left "suspended with no audit trail"

    const events = await LicenseEvent.find({ eventType: 'LICENSE_SUSPENDED', licenseId: license.licenseId });
    expect(events.length).toBe(0);

    createSpy.mockRestore();

    // And a normal retry now succeeds cleanly.
    const suspended = await licenseService.suspendLicense(license.licenseId);
    expect(suspended.status).toBe('suspended');
  });

  // --- Idempotency conflict / stale-claim sanity (ProcessedRequest reuse) --

  test('reusing the same requestId for renewal on a different license is rejected as a conflict', async () => {
    const licenseA = await createLicense();
    const licenseB = await createLicense();
    const requestId = 'renew-conflict-1';

    const res1 = mockRes();
    await adminLicenseController.renewLicense(
      { params: { licenseId: licenseA.licenseId }, body: { durationDays: 10, requestId } },
      res1
    );
    expect(res1.statusCode).toBe(200);

    const res2 = mockRes();
    await adminLicenseController.renewLicense(
      { params: { licenseId: licenseB.licenseId }, body: { durationDays: 10, requestId } },
      res2
    );
    expect(res2.statusCode).toBe(409);
    expect(res2.body.error).toBe('REQUEST_CONTEXT_MISMATCH');
  });
});
