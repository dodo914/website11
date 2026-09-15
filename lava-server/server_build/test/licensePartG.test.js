const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const License = require(path.join(root, 'models/License.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const LicenseEvent = require(path.join(root, 'models/LicenseEvent.js'));
const LicenseInstallation = require(path.join(root, 'models/LicenseInstallation.js'));
const { activateLicense } = require(path.join(root, 'services/license/licenseService.js'));
const { LicenseDomainNotAllowedError } = require(path.join(root, 'services/license/licenseErrors.js'));
const { _resetCacheForTests: resetInstallationIdCache } = require(path.join(root, 'services/license/installationIdService.js'));

// ============================================================
// PART 1G - isDomainAllowed() is now wired into activateLicense().
// ============================================================

function mockModelFn(Model, fnName, impl) {
  const original = Model[fnName];
  Model[fnName] = impl;
  return () => {
    Model[fnName] = original;
  };
}

function mockInstallationId(fixedId = 'fixed-installation-id-for-tests') {
  const restore = mockModelFn(LicenseInstallation, 'findOneAndUpdate', async () => ({ installationId: fixedId }));
  resetInstallationIdCache();
  return () => {
    restore();
    resetInstallationIdCache();
  };
}

function makeFakeLicense(overrides = {}) {
  return {
    licenseId: 'LIC-DOMAIN-1',
    status: 'active',
    expiresAt: null,
    maxActivations: 1,
    activeActivationCount: 0,
    activatedAt: null,
    allowedDomains: [],
    toObject() {
      return { ...this };
    },
    async save() {
      return this;
    },
    ...overrides,
  };
}

function setupHarness(fakeLicenseDoc) {
  const events = [];
  const reservationCalls = [];
  const createCalls = [];

  const restoreFindOne = mockModelFn(License, 'findOne', async () => ({ ...fakeLicenseDoc }));
  const restoreFindOneAndUpdate = mockModelFn(License, 'findOneAndUpdate', async () => {
    reservationCalls.push(true);
    if (fakeLicenseDoc.activeActivationCount < fakeLicenseDoc.maxActivations) {
      fakeLicenseDoc.activeActivationCount += 1;
      return fakeLicenseDoc;
    }
    return null;
  });
  const restoreUpdateOne = mockModelFn(License, 'updateOne', async (filter, update) => {
    if (update.$inc && typeof update.$inc.activeActivationCount === 'number') {
      fakeLicenseDoc.activeActivationCount += update.$inc.activeActivationCount;
    }
    return { acknowledged: true };
  });
  const restoreActivationFindOne = mockModelFn(LicenseActivation, 'findOne', async () => null);
  const restoreActivationCreate = mockModelFn(LicenseActivation, 'create', async (doc) => {
    createCalls.push(doc);
    return { ...doc, toObject: () => ({ ...doc }) };
  });
  const restoreEventCreate = mockModelFn(LicenseEvent, 'create', async (doc) => {
    events.push(doc);
    return doc;
  });
  const restoreInstallationId = mockInstallationId();

  const restoreAll = () => {
    restoreFindOne();
    restoreFindOneAndUpdate();
    restoreUpdateOne();
    restoreActivationFindOne();
    restoreActivationCreate();
    restoreEventCreate();
    restoreInstallationId();
  };

  return { events, reservationCalls, createCalls, restoreAll };
}

// ---------- 1: allowedDomains = [] allows activation ----------

test('activateLicense: allowedDomains = [] allows activation from any domain', async () => {
  const fakeLicenseDoc = makeFakeLicense({ allowedDomains: [] });
  const { createCalls, restoreAll } = setupHarness(fakeLicenseDoc);

  try {
    const result = await activateLicense({ licenseId: 'LIC-DOMAIN-1', domain: 'anything.example.com' });
    assert.ok(result.activationId);
    assert.equal(createCalls.length, 1);
  } finally {
    restoreAll();
  }
});

// ---------- 2: allowedDomains = ["example.com"] allows example.com ----------

test('activateLicense: allowedDomains = ["example.com"] allows activation from example.com', async () => {
  const fakeLicenseDoc = makeFakeLicense({ allowedDomains: ['example.com'] });
  const { createCalls, restoreAll } = setupHarness(fakeLicenseDoc);

  try {
    const result = await activateLicense({ licenseId: 'LIC-DOMAIN-1', domain: 'example.com' });
    assert.ok(result.activationId);
    assert.equal(createCalls.length, 1);
  } finally {
    restoreAll();
  }
});

// ---------- 3, 4, 5, 6: domain not in allowedDomains is rejected, with no side effects ----------

test('activateLicense: rejects a domain not present in allowedDomains, with LicenseDomainNotAllowedError, no reservation, no counter change, no LicenseActivation created', async () => {
  const fakeLicenseDoc = makeFakeLicense({ allowedDomains: ['example.com'], activeActivationCount: 0 });
  const { events, reservationCalls, createCalls, restoreAll } = setupHarness(fakeLicenseDoc);

  try {
    await assert.rejects(
      () => activateLicense({ licenseId: 'LIC-DOMAIN-1', domain: 'not-allowed.example.org' }),
      LicenseDomainNotAllowedError
    );

    // 4) no reservation attempt at all.
    assert.equal(reservationCalls.length, 0, 'License.findOneAndUpdate (slot reservation) must never be called for a rejected domain');

    // 5) counter untouched.
    assert.equal(fakeLicenseDoc.activeActivationCount, 0, 'activeActivationCount must stay unchanged when the domain is rejected');

    // 6) no LicenseActivation created.
    assert.equal(createCalls.length, 0, 'LicenseActivation.create must never be called for a rejected domain');

    // A LICENSE_DOMAIN_NOT_ALLOWED event should still be recorded, with only licenseId + normalized domain.
    const domainEvent = events.find((e) => e.eventType === 'LICENSE_DOMAIN_NOT_ALLOWED');
    assert.ok(domainEvent, 'a LICENSE_DOMAIN_NOT_ALLOWED event should be recorded');
    assert.equal(domainEvent.licenseId, 'LIC-DOMAIN-1');
    assert.equal(domainEvent.domain, 'not-allowed.example.org');
    assert.equal(domainEvent.fingerprintHash, null, 'no fingerprint should ever be computed/stored for a rejected domain');
  } finally {
    restoreAll();
  }
});

// ---------- 7: normalization does not cause a false mismatch ----------

test('activateLicense: normalization means https://, www., and a trailing port on the same domain are all allowed', async () => {
  const variants = ['https://www.example.com:443/', 'http://example.com', 'EXAMPLE.com', 'example.com/'];

  for (const domainVariant of variants) {
    const fakeLicenseDoc = makeFakeLicense({ allowedDomains: ['example.com'], activeActivationCount: 0 });
    const { createCalls, restoreAll } = setupHarness(fakeLicenseDoc);
    try {
      const result = await activateLicense({ licenseId: 'LIC-DOMAIN-1', domain: domainVariant });
      assert.ok(result.activationId, `expected "${domainVariant}" to normalize to an allowed domain`);
      assert.equal(createCalls.length, 1);
    } finally {
      restoreAll();
    }
  }
});

test('activateLicense: a domain that only superficially resembles an allowed one is still rejected (no false-positive match)', async () => {
  const fakeLicenseDoc = makeFakeLicense({ allowedDomains: ['example.com'] });
  const { restoreAll } = setupHarness(fakeLicenseDoc);
  try {
    await assert.rejects(
      () => activateLicense({ licenseId: 'LIC-DOMAIN-1', domain: 'notexample.com' }),
      LicenseDomainNotAllowedError
    );
    await assert.rejects(
      () => activateLicense({ licenseId: 'LIC-DOMAIN-1', domain: 'example.com.evil.net' }),
      LicenseDomainNotAllowedError
    );
  } finally {
    restoreAll();
  }
});

// ---------- 8: typed, safe error, no secrets ----------

test('LicenseDomainNotAllowedError: is typed, has a safe public message, and toSafeJSON() leaks no internals', () => {
  const err = new LicenseDomainNotAllowedError({ licenseId: 'LIC-X', domain: 'blocked.com' });
  assert.equal(err.code, 'LICENSE_DOMAIN_NOT_ALLOWED');
  assert.ok(err instanceof Error);

  const safe = err.toSafeJSON();
  assert.deepEqual(safe, { code: 'LICENSE_DOMAIN_NOT_ALLOWED', message: err.publicMessage });
  assert.ok(!/secret|key|token|password/i.test(safe.message), 'public message must not reference any secret-sounding term');
  assert.equal(Object.keys(safe).length, 2, 'toSafeJSON must only expose code + message, nothing else (no stack, no raw details)');
});