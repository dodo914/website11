'use strict';

jest.mock('../models/License', () => ({
  License: require('./helpers/fakeModel').__sharedLicenseModel,
  LICENSE_TYPES: ['standard', 'source-code', 'resale', 'enterprise'],
  LICENSE_STATUSES: ['active', 'suspended', 'expired', 'revoked'],
}));
jest.mock('../services/eventService', () => ({
  recordEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('licenseService', () => {
  let licenseService;
  let License;

  beforeEach(() => {
    jest.resetModules();
    const { __sharedLicenseModel } = require('./helpers/fakeModel');
    __sharedLicenseModel.reset();
    License = __sharedLicenseModel;
    licenseService = require('../services/licenseService');
  });

  test('creates a license with expected defaults', async () => {
    const license = await licenseService.createLicense({
      licenseId: 'lic-1',
      customerReference: 'cust-1',
      type: 'standard',
      maxActivations: 5,
    });

    expect(license.status).toBe('active');
    expect(license.activeActivationCount).toBe(0);
  });

  test('rejects an invalid license type', async () => {
    await expect(
      licenseService.createLicense({
        licenseId: 'lic-2',
        customerReference: 'cust-1',
        type: 'not-a-real-type',
      })
    ).rejects.toThrow('Invalid license type');
  });

  test('enforces unique licenseId at creation', async () => {
    await licenseService.createLicense({ licenseId: 'lic-3', customerReference: 'c', type: 'standard' });
    await expect(
      licenseService.createLicense({ licenseId: 'lic-3', customerReference: 'c', type: 'standard' })
    ).rejects.toThrow();
  });

  test('validateLicense returns valid=true for an active, unexpired license', async () => {
    await licenseService.createLicense({ licenseId: 'lic-4', customerReference: 'c', type: 'standard' });
    const result = await licenseService.validateLicense('lic-4');
    expect(result.valid).toBe(true);
  });

  test('validateLicense returns invalid for an unknown license', async () => {
    const result = await licenseService.validateLicense('does-not-exist');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_LICENSE');
  });

  test('validateLicense transitions an expired license to status=expired', async () => {
    await License.create({
      licenseId: 'lic-5',
      customerReference: 'c',
      type: 'standard',
      status: 'active',
      expiresAt: new Date(Date.now() - 1000),
      activeActivationCount: 0,
      maxActivations: 1,
      allowedDomains: [],
    });

    const result = await licenseService.validateLicense('lic-5');
    expect(result.valid).toBe(false);
    expect(result.license.status).toBe('expired');
  });

  test('revokeLicense sets status to revoked', async () => {
    await licenseService.createLicense({ licenseId: 'lic-6', customerReference: 'c', type: 'standard' });
    const revoked = await licenseService.revokeLicense('lic-6');
    expect(revoked.status).toBe('revoked');
  });

  test('suspendLicense sets status to suspended, then can be reactivated', async () => {
    await licenseService.createLicense({ licenseId: 'lic-7', customerReference: 'c', type: 'standard' });
    const suspended = await licenseService.suspendLicense('lic-7');
    expect(suspended.status).toBe('suspended');

    const reactivated = await licenseService.reactivateLicense('lic-7');
    expect(reactivated.status).toBe('active');
  });

  test('a normal successful validation does not create a LicenseEvent', async () => {
    const eventService = require('../services/eventService');
    await licenseService.createLicense({ licenseId: 'lic-9', customerReference: 'c', type: 'standard' });
    eventService.recordEvent.mockClear(); // ignore the LICENSE_CREATED event above

    await licenseService.validateLicense('lic-9');
    await licenseService.validateLicense('lic-9');
    await licenseService.validateLicense('lic-9');

    expect(eventService.recordEvent).not.toHaveBeenCalled();
  });

  test('an expiring validation still records the security-relevant LICENSE_EXPIRED event', async () => {
    const eventService = require('../services/eventService');
    await License.create({
      licenseId: 'lic-10',
      customerReference: 'c',
      type: 'standard',
      status: 'active',
      expiresAt: new Date(Date.now() - 1000),
      activeActivationCount: 0,
      maxActivations: 1,
      allowedDomains: [],
    });
    eventService.recordEvent.mockClear();

    await licenseService.validateLicense('lic-10');

    expect(eventService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'LICENSE_EXPIRED', licenseId: 'lic-10' })
    );
  });

  test('a revoked license cannot become active through validateLicense', async () => {
    await licenseService.createLicense({ licenseId: 'lic-11', customerReference: 'c', type: 'standard' });
    await licenseService.revokeLicense('lic-11');

    const result = await licenseService.validateLicense('lic-11');
    expect(result.valid).toBe(false);
    expect(result.license.status).toBe('revoked');
  });

  test('a suspended license cannot become active through validateLicense', async () => {
    await licenseService.createLicense({ licenseId: 'lic-12', customerReference: 'c', type: 'standard' });
    await licenseService.suspendLicense('lic-12');

    const result = await licenseService.validateLicense('lic-12');
    expect(result.valid).toBe(false);
    expect(result.license.status).toBe('suspended');
  });

  test('validateLicense never writes a client-controllable status field back to the license', async () => {
    await licenseService.createLicense({ licenseId: 'lic-13', customerReference: 'c', type: 'standard' });
    // validateLicense only accepts a licenseId — there is no code path
    // through which a protocol-layer caller can pass a status override.
    const result = await licenseService.validateLicense('lic-13');
    expect(result.license.status).toBe('active');
  });

  test('ignores a client-supplied status override at creation', async () => {
    const license = await licenseService.createLicense({
      licenseId: 'lic-8',
      customerReference: 'c',
      type: 'standard',
      status: 'revoked', // not a real createLicense parameter — must be ignored
    });
    expect(license.status).toBe('active');
  });
});
