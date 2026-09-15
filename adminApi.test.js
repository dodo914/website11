'use strict';

const ADMIN_KEY = 'test-admin-secret-key';

jest.mock('../config/env', () => ({
  config: {
    nodeEnv: 'test',
    mongoUri: '',
    privateKeyB64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    publicKeyId: 'key-1',
    port: 4000,
    protocolVersion: 1,
    adminApiKey: 'test-admin-secret-key',
  },
  assertProductionConfig: jest.fn(),
}));

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
jest.mock('../models/LicenseActivation', () => ({
  LicenseActivation: require('./helpers/fakeModel').__sharedActivationModel,
  ACTIVATION_STATUSES: ['active', 'deactivated'],
  ENVIRONMENTS: ['production', 'staging', 'development'],
}));

const request = require('supertest');

describe('Administrative License Management API', () => {
  let app;
  let License;
  let LicenseEvent;
  let ProcessedRequest;

  beforeEach(() => {
    jest.resetModules();
    const fakeModel = require('./helpers/fakeModel');
    fakeModel.__sharedLicenseModel.reset();
    fakeModel.__sharedEventModel.reset();
    fakeModel.__sharedProcessedRequestModel.reset();
    fakeModel.__sharedActivationModel.reset();
    License = fakeModel.__sharedLicenseModel;
    LicenseEvent = fakeModel.__sharedEventModel;
    ProcessedRequest = fakeModel.__sharedProcessedRequestModel;

    const { createApp } = require('../app');
    app = createApp();
  });

  describe('authorization boundary', () => {
    test('rejects a request with no credentials', async () => {
      const res = await request(app).get('/api/v1/admin/licenses');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    test('rejects a request with a wrong key', async () => {
      const res = await request(app)
        .get('/api/v1/admin/licenses')
        .set('X-Admin-Api-Key', 'wrong-key');
      expect(res.status).toBe(401);
    });

    test('accepts a request with the correct key via X-Admin-Api-Key', async () => {
      const res = await request(app)
        .get('/api/v1/admin/licenses')
        .set('X-Admin-Api-Key', ADMIN_KEY);
      expect(res.status).toBe(200);
    });

    test('accepts a request with the correct key via Bearer auth', async () => {
      const res = await request(app)
        .get('/api/v1/admin/licenses')
        .set('Authorization', `Bearer ${ADMIN_KEY}`);
      expect(res.status).toBe(200);
    });

    test('the customer protocol endpoint never requires or checks the admin key', async () => {
      const res = await request(app).post('/api/v1/license').send({
        protocolVersion: 1,
        operation: 'VALIDATE',
        requestId: 'req-boundary-1',
        timestamp: new Date().toISOString(),
        licenseId: 'does-not-exist',
      });
      // No 401/403 from missing admin creds — the protocol endpoint is a
      // wholly separate boundary.
      expect([200, 400]).toContain(res.status);
    });
  });

  function authed(req) {
    return req.set('X-Admin-Api-Key', ADMIN_KEY);
  }

  describe('license CRUD', () => {
    test('creates a license and never trusts client-supplied lifecycle fields', async () => {
      const res = await authed(request(app).post('/api/v1/admin/licenses')).send({
        customerReference: 'cust-1',
        type: 'standard',
        maxActivations: 3,
        status: 'revoked', // must be ignored
        activeActivationCount: 99, // must be ignored
      });

      expect(res.status).toBe(201);
      expect(res.body.license.status).toBe('active');
      expect(res.body.license.activeActivationCount).toBe(0);
      expect(res.body.license.licenseId).toMatch(/^LAVA-/);
      // Admin view includes customerReference; never exposes _id/__v.
      expect(res.body.license.customerReference).toBe('cust-1');
      expect(res.body.license._id).toBeUndefined();
    });

    test('rejects creation with an invalid type', async () => {
      const res = await authed(request(app).post('/api/v1/admin/licenses')).send({
        customerReference: 'cust-1',
        type: 'not-real',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_LICENSE_TYPE');
    });

    test('gets a license by id', async () => {
      const create = await authed(request(app).post('/api/v1/admin/licenses')).send({
        customerReference: 'cust-2',
        type: 'standard',
      });
      const licenseId = create.body.license.licenseId;

      const res = await authed(request(app).get(`/api/v1/admin/licenses/${licenseId}`));
      expect(res.status).toBe(200);
      expect(res.body.license.licenseId).toBe(licenseId);
    });

    test('404s for an unknown license', async () => {
      const res = await authed(request(app).get('/api/v1/admin/licenses/does-not-exist'));
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('LICENSE_NOT_FOUND');
    });

    test('lists licenses with pagination', async () => {
      for (let i = 0; i < 3; i += 1) {
        await authed(request(app).post('/api/v1/admin/licenses')).send({
          customerReference: `cust-${i}`,
          type: 'standard',
        });
      }
      const res = await authed(request(app).get('/api/v1/admin/licenses?pageSize=2&page=1'));
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(2);
      expect(res.body.total).toBe(3);
    });
  });

  describe('lifecycle transitions', () => {
    async function createLicense(overrides = {}) {
      const res = await authed(request(app).post('/api/v1/admin/licenses')).send({
        customerReference: 'cust-x',
        type: 'standard',
        ...overrides,
      });
      return res.body.license.licenseId;
    }

    test('suspend -> reactivate happy path', async () => {
      const licenseId = await createLicense();
      const suspended = await authed(request(app).post(`/api/v1/admin/licenses/${licenseId}/suspend`));
      expect(suspended.status).toBe(200);
      expect(suspended.body.license.status).toBe('suspended');

      const reactivated = await authed(request(app).post(`/api/v1/admin/licenses/${licenseId}/reactivate`));
      expect(reactivated.status).toBe(200);
      expect(reactivated.body.license.status).toBe('active');
    });

    test('a revoked license cannot be reactivated, suspended, or renewed', async () => {
      const licenseId = await createLicense();
      await authed(request(app).post(`/api/v1/admin/licenses/${licenseId}/revoke`));

      const reactivate = await authed(request(app).post(`/api/v1/admin/licenses/${licenseId}/reactivate`));
      expect(reactivate.status).toBe(409);

      const suspend = await authed(request(app).post(`/api/v1/admin/licenses/${licenseId}/suspend`));
      expect(suspend.status).toBe(409);
      expect(suspend.body.error).toBe('LICENSE_REVOKED');

      const renew = await authed(request(app).post(`/api/v1/admin/licenses/${licenseId}/renew`)).send({
        durationDays: 30,
      });
      expect(renew.status).toBe(409);
      expect(renew.body.error).toBe('LICENSE_REVOKED');
    });

    test('customer protocol calls cannot revoke/suspend a license (no such capability exists there)', async () => {
      // The customer protocol only supports ACTIVATE/VALIDATE/HEARTBEAT/DEACTIVATE.
      const res = await request(app).post('/api/v1/license').send({
        protocolVersion: 1,
        operation: 'REVOKE',
        requestId: 'req-boundary-2',
        timestamp: new Date().toISOString(),
        licenseId: 'lic-1',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('renewal idempotency', () => {
    test('renewing twice with the same requestId only extends the expiry once', async () => {
      const create = await authed(request(app).post('/api/v1/admin/licenses')).send({
        customerReference: 'cust-r',
        type: 'standard',
      });
      const licenseId = create.body.license.licenseId;

      const payload = { durationDays: 30, paymentReference: 'pay-1', requestId: 'renew-req-1' };
      const first = await authed(request(app).post(`/api/v1/admin/licenses/${licenseId}/renew`)).send(payload);
      expect(first.status).toBe(200);
      const firstExpiry = first.body.license.expiresAt;

      const second = await authed(request(app).post(`/api/v1/admin/licenses/${licenseId}/renew`)).send(payload);
      expect(second.status).toBe(200);
      expect(second.body.license.expiresAt).toBe(firstExpiry);

      const events = await LicenseEvent.find({ eventType: 'LICENSE_RENEWED', licenseId });
      expect(events.length).toBe(1);
    });

    test('renewal without a requestId still works but is not idempotency-protected', async () => {
      const create = await authed(request(app).post('/api/v1/admin/licenses')).send({
        customerReference: 'cust-r2',
        type: 'standard',
      });
      const licenseId = create.body.license.licenseId;

      const res = await authed(request(app).post(`/api/v1/admin/licenses/${licenseId}/renew`)).send({
        durationDays: 10,
      });
      expect(res.status).toBe(200);
      expect(res.body.license.expiresAt).toBeTruthy();
    });
  });

  describe('domain / limit / features / build management', () => {
    async function createLicense(overrides = {}) {
      const res = await authed(request(app).post('/api/v1/admin/licenses')).send({
        customerReference: 'cust-y',
        type: 'standard',
        ...overrides,
      });
      return res.body.license.licenseId;
    }

    test('updates and normalizes allowed domains', async () => {
      const licenseId = await createLicense();
      const res = await authed(request(app).patch(`/api/v1/admin/licenses/${licenseId}/domains`)).send({
        allowedDomains: ['HTTPS://Example.COM/path', 'www.example.com', 'other.com'],
      });
      expect(res.status).toBe(200);
      expect(res.body.license.allowedDomains).toEqual(['example.com', 'other.com']);
    });

    test('rejects an activation-limit change below the current active count', async () => {
      const licenseId = await createLicense({ maxActivations: 3 });
      // Simulate 2 active activations by writing directly to the fake License doc.
      const doc = License.docs.find((d) => d.licenseId === licenseId);
      doc.activeActivationCount = 2;

      const res = await authed(
        request(app).patch(`/api/v1/admin/licenses/${licenseId}/activation-limit`)
      ).send({ maxActivations: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ACTIVATION_LIMIT_INVALID');
    });

    test('updates features', async () => {
      const licenseId = await createLicense();
      const res = await authed(request(app).patch(`/api/v1/admin/licenses/${licenseId}/features`)).send({
        features: ['pro', 'pro', 'beta'],
      });
      expect(res.status).toBe(200);
      expect(res.body.license.features).toEqual(['pro', 'beta']);
    });

    test('updates buildId and records an audit event', async () => {
      const licenseId = await createLicense();
      const res = await authed(request(app).patch(`/api/v1/admin/licenses/${licenseId}/build`)).send({
        buildId: 'build-99',
      });
      expect(res.status).toBe(200);
      expect(res.body.license.buildId).toBe('build-99');

      const events = await LicenseEvent.find({ eventType: 'BUILD_ID_CHANGED', licenseId });
      expect(events.length).toBe(1);
    });
  });
});
