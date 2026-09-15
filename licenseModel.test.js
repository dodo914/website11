'use strict';

const { License } = require('../models/License');

describe('License model schema validation', () => {
  function makeLicense(overrides = {}) {
    return new License({
      licenseId: 'lic-1',
      customerReference: 'cust-1',
      type: 'standard',
      status: 'active',
      maxActivations: 3,
      ...overrides,
    });
  }

  test('valid document passes validation', () => {
    const err = makeLicense().validateSync();
    expect(err).toBeUndefined();
  });

  test('rejects an invalid license type', () => {
    const err = makeLicense({ type: 'not-a-real-type' }).validateSync();
    expect(err).toBeDefined();
    expect(err.errors.type).toBeDefined();
  });

  test('rejects an invalid license status', () => {
    const err = makeLicense({ status: 'not-a-real-status' }).validateSync();
    expect(err).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });

  test('requires licenseId', () => {
    const err = makeLicense({ licenseId: undefined }).validateSync();
    expect(err.errors.licenseId).toBeDefined();
  });

  test('requires customerReference', () => {
    const err = makeLicense({ customerReference: undefined }).validateSync();
    expect(err.errors.customerReference).toBeDefined();
  });

  test('defaults status to active and activeActivationCount to 0', () => {
    const license = new License({ licenseId: 'lic-2', customerReference: 'c', type: 'standard' });
    expect(license.status).toBe('active');
    expect(license.activeActivationCount).toBe(0);
  });

  test('licenseId uniqueness is enforced via a unique index (schema declaration check)', () => {
    const licenseIdPath = License.schema.path('licenseId');
    expect(licenseIdPath.options.unique).toBe(true);
  });
});

describe('LicenseActivation model', () => {
  const { LicenseActivation } = require('../models/LicenseActivation');

  test('valid document passes validation', () => {
    const activation = new LicenseActivation({
      activationId: 'act-1',
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'hash',
    });
    expect(activation.validateSync()).toBeUndefined();
  });

  test('rejects invalid environment enum', () => {
    const activation = new LicenseActivation({
      activationId: 'act-1',
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'hash',
      environment: 'not-a-real-env',
    });
    expect(activation.validateSync().errors.environment).toBeDefined();
  });

  test('has a unique compound index on licenseId+domain+fingerprintHash', () => {
    const indexes = LicenseActivation.schema.indexes();
    const compound = indexes.find(
      ([fields]) => fields.licenseId && fields.domain && fields.fingerprintHash
    );
    expect(compound).toBeDefined();
    expect(compound[1].unique).toBe(true);
  });
});

describe('LicenseEvent model', () => {
  const { LicenseEvent, EVENT_TYPES } = require('../models/LicenseEvent');

  test('accepts every documented event type', () => {
    for (const eventType of EVENT_TYPES) {
      const event = new LicenseEvent({ eventType });
      expect(event.validateSync()).toBeUndefined();
    }
  });

  test('rejects an undocumented event type', () => {
    const event = new LicenseEvent({ eventType: 'NOT_A_REAL_EVENT' });
    expect(event.validateSync().errors.eventType).toBeDefined();
  });
});
