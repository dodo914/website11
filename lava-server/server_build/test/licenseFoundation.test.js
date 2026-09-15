const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const License = require(path.join(root, 'models/License.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const LicenseEvent = require(path.join(root, 'models/LicenseEvent.js'));
const { getBuildId } = require(path.join(root, 'services/license/buildIdService.js'));

// ============================================================
// ملحوظة: التست دول بيستخدموا mongoose schema validation
// (validateSync) من غير أي اتصال فعلي بقاعدة البيانات - نفس فلسفة
// باقي الـtest suite الحالي (source/schema inspection) واللي بيشتغل
// من غير DB حقيقية.
// ============================================================

test('License: creation with valid required fields passes validation', () => {
  const doc = new License({
    licenseId: 'LIC-TEST-0001',
    customerReference: 'customer-ref-123',
    type: 'standard',
  });
  const err = doc.validateSync();
  assert.equal(err, undefined);
  assert.equal(doc.status, 'active'); // default
});

test('License: rejects invalid type', () => {
  const doc = new License({
    licenseId: 'LIC-TEST-0002',
    customerReference: 'customer-ref-123',
    type: 'not-a-real-type',
  });
  const err = doc.validateSync();
  assert.ok(err);
  assert.ok(err.errors.type);
});

test('License: accepts every documented type', () => {
  for (const type of License.LICENSE_TYPES) {
    const doc = new License({ licenseId: `LIC-${type}`, customerReference: 'ref', type });
    assert.equal(doc.validateSync(), undefined, `type "${type}" should be valid`);
  }
  assert.deepEqual(License.LICENSE_TYPES, ['standard', 'source-code', 'resale', 'enterprise']);
});

test('License: rejects invalid status', () => {
  const doc = new License({
    licenseId: 'LIC-TEST-0003',
    customerReference: 'ref',
    type: 'standard',
    status: 'not-a-real-status',
  });
  const err = doc.validateSync();
  assert.ok(err);
  assert.ok(err.errors.status);
});

test('License: accepts every documented status', () => {
  for (const status of License.LICENSE_STATUSES) {
    const doc = new License({ licenseId: `LIC-${status}`, customerReference: 'ref', type: 'standard', status });
    assert.equal(doc.validateSync(), undefined, `status "${status}" should be valid`);
  }
  assert.deepEqual(License.LICENSE_STATUSES, ['active', 'suspended', 'expired', 'revoked']);
});

test('License: requires licenseId, customerReference and type', () => {
  const doc = new License({});
  const err = doc.validateSync();
  assert.ok(err);
  assert.ok(err.errors.licenseId);
  assert.ok(err.errors.customerReference);
  assert.ok(err.errors.type);
});

test('LicenseActivation: creation with valid fields passes validation', () => {
  const doc = new LicenseActivation({
    licenseId: 'LIC-TEST-0001',
    activationId: 'ACT-TEST-0001',
    domain: 'example.com',
    fingerprintHash: 'abc123',
  });
  const err = doc.validateSync();
  assert.equal(err, undefined);
  assert.equal(doc.status, 'active'); // default
  assert.equal(doc.environment, 'production'); // default
});

test('LicenseActivation: rejects invalid status', () => {
  const doc = new LicenseActivation({
    licenseId: 'LIC-TEST-0001',
    activationId: 'ACT-TEST-0002',
    domain: 'example.com',
    fingerprintHash: 'abc123',
    status: 'not-a-real-status',
  });
  const err = doc.validateSync();
  assert.ok(err);
  assert.ok(err.errors.status);
});

test('LicenseActivation: has a compound unique index on (licenseId, domain, fingerprintHash) and not a bare unique index on domain', () => {
  const indexes = LicenseActivation.schema.indexes();
  const compound = indexes.find(([def]) =>
    def.licenseId === 1 && def.domain === 1 && def.fingerprintHash === 1
  );
  assert.ok(compound, 'expected compound unique index on (licenseId, domain, fingerprintHash)');
  assert.equal(compound[1].unique, true);

  const domainPath = LicenseActivation.schema.path('domain');
  assert.equal(domainPath.options.unique, undefined, 'domain field itself must not be uniquely indexed');
});

test('LicenseEvent: creation with valid fields passes validation', () => {
  const doc = new LicenseEvent({
    licenseId: 'LIC-TEST-0001',
    eventType: 'LICENSE_CREATED',
  });
  const err = doc.validateSync();
  assert.equal(err, undefined);
});

test('LicenseEvent: rejects invalid eventType', () => {
  const doc = new LicenseEvent({
    licenseId: 'LIC-TEST-0001',
    eventType: 'NOT_A_REAL_EVENT',
  });
  const err = doc.validateSync();
  assert.ok(err);
  assert.ok(err.errors.eventType);
});

test('LicenseEvent: accepts every documented event type', () => {
  for (const eventType of LicenseEvent.LICENSE_EVENT_TYPES) {
    const doc = new LicenseEvent({ licenseId: 'LIC-TEST-0001', eventType });
    assert.equal(doc.validateSync(), undefined, `eventType "${eventType}" should be valid`);
  }
});

test('LicenseEvent: schema has no fields for secrets/passwords/keys', () => {
  const forbidden = ['password', 'apiKey', 'secret', 'privateKey', 'licenseSecret'];
  const paths = Object.keys(LicenseEvent.schema.paths);
  for (const bad of forbidden) {
    assert.ok(
      !paths.some((p) => p.toLowerCase().includes(bad.toLowerCase())),
      `LicenseEvent schema must not contain a field like "${bad}"`
    );
  }
});

test('buildIdService: getBuildId() is stable across repeated calls (no per-call randomness)', () => {
  const first = getBuildId();
  const second = getBuildId();
  const third = getBuildId();
  assert.equal(first, second);
  assert.equal(second, third);
  assert.equal(typeof first, 'string');
  assert.ok(first.length > 0);
});

test('buildIdService: LICENSE_ENABLED=false does not throw or affect getBuildId()', () => {
  const original = process.env.LICENSE_ENABLED;
  process.env.LICENSE_ENABLED = 'false';
  assert.doesNotThrow(() => getBuildId());
  if (original === undefined) {
    delete process.env.LICENSE_ENABLED;
  } else {
    process.env.LICENSE_ENABLED = original;
  }
});