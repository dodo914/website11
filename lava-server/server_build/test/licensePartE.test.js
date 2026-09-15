const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const License = require(path.join(root, 'models/License.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const LicenseEvent = require(path.join(root, 'models/LicenseEvent.js'));
const LicenseInstallation = require(path.join(root, 'models/LicenseInstallation.js'));
const licenseCache = require(path.join(root, 'services/license/licenseCache.js'));
const { isDomainAllowed, releaseActivationSlot, activateLicense } = require(path.join(root, 'services/license/licenseService.js'));
const { _resetCacheForTests: resetInstallationIdCache } = require(path.join(root, 'services/license/installationIdService.js'));

// ============================================================
// PART 1E - final local-foundation hardening pass tests.
// نفس فلسفة باقي الـsuite: من غير اتصال حقيقي بـMongoDB - mocking لدوال
// الموديل عشان نحاكي atomicity الـMongoDB الحقيقية من غير replica set.
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

// ---------- PART 3: allowedDomains normalization ----------

test('License.allowedDomains: normalizes protocol/www/port/case and de-duplicates on assignment', () => {
  const doc = new License({
    licenseId: 'LIC-DOMAINS-1',
    customerReference: 'ref',
    type: 'standard',
    allowedDomains: ['https://Shop.Example.com/', 'shop.example.com', 'www.shop.example.com:443', 'other.com'],
  });
  assert.deepEqual(doc.allowedDomains, ['shop.example.com', 'other.com']);
});

test('License.allowedDomains: empty/default stays an empty array (backward compatible with existing licenses)', () => {
  const doc = new License({ licenseId: 'LIC-DOMAINS-2', customerReference: 'ref', type: 'standard' });
  assert.deepEqual(doc.allowedDomains, []);
});

test('isDomainAllowed: no allowedDomains configured means every domain is allowed (current design - not enforced yet)', () => {
  assert.equal(isDomainAllowed({ allowedDomains: [] }, 'anything.com'), true);
  assert.equal(isDomainAllowed(null, 'anything.com'), true);
});

test('isDomainAllowed: matches only after normalizing the domain being checked', () => {
  const license = { allowedDomains: ['shop.example.com'] };
  assert.equal(isDomainAllowed(license, 'https://Shop.Example.com/'), true);
  assert.equal(isDomainAllowed(license, 'other-shop.com'), false);
});

// ---------- PART 2: activeActivationCount floor + idempotent release ----------

test('releaseActivationSlot: decrements activeActivationCount exactly once and is a no-op on a second call for the same activation', async () => {
  const fakeLicense = { licenseId: 'LIC-RELEASE-1', activeActivationCount: 1 };
  const fakeActivation = { activationId: 'ACT-1', licenseId: 'LIC-RELEASE-1', status: 'active' };

  const restoreActivationFOU = mockModelFn(LicenseActivation, 'findOneAndUpdate', async (filter) => {
    // Mimics MongoDB's atomic active->revoked claim: only succeeds once.
    if (filter.activationId === fakeActivation.activationId && fakeActivation.status === 'active') {
      fakeActivation.status = 'revoked';
      return { ...fakeActivation, toObject: () => ({ ...fakeActivation }) };
    }
    return null;
  });

  const restoreLicenseUpdateOne = mockModelFn(License, 'updateOne', async (filter) => {
    if (filter.activeActivationCount && filter.activeActivationCount.$gt === 0 && fakeLicense.activeActivationCount > 0) {
      fakeLicense.activeActivationCount -= 1;
    }
    return { acknowledged: true };
  });

  try {
    const first = await releaseActivationSlot('ACT-1');
    assert.ok(first, 'first release should succeed');
    assert.equal(fakeLicense.activeActivationCount, 0);

    const second = await releaseActivationSlot('ACT-1');
    assert.equal(second, null, 'second release for the same activation must be a no-op');
    assert.equal(fakeLicense.activeActivationCount, 0, 'the counter must not go below 0 or be decremented twice');
  } finally {
    restoreActivationFOU();
    restoreLicenseUpdateOne();
  }
});

test('releaseActivationSlot: never drives activeActivationCount negative even if the counter was already 0', async () => {
  const fakeLicense = { licenseId: 'LIC-RELEASE-2', activeActivationCount: 0 };
  const fakeActivation = { activationId: 'ACT-2', licenseId: 'LIC-RELEASE-2', status: 'active' };

  const restoreActivationFOU = mockModelFn(LicenseActivation, 'findOneAndUpdate', async () => {
    fakeActivation.status = 'revoked';
    return { ...fakeActivation, toObject: () => ({ ...fakeActivation }) };
  });

  let updateOneCalls = 0;
  const restoreLicenseUpdateOne = mockModelFn(License, 'updateOne', async (filter) => {
    updateOneCalls += 1;
    // The $gt: 0 guard means this filter never matches a doc whose real
    // counter is already 0, so nothing should change.
    if (filter.activeActivationCount && filter.activeActivationCount.$gt === 0 && fakeLicense.activeActivationCount > 0) {
      fakeLicense.activeActivationCount -= 1;
    }
    return { acknowledged: true };
  });

  try {
    await releaseActivationSlot('ACT-2');
    assert.equal(updateOneCalls, 1);
    assert.equal(fakeLicense.activeActivationCount, 0, 'counter must stay at 0, never negative');
  } finally {
    restoreActivationFOU();
    restoreLicenseUpdateOne();
  }
});

test('releaseActivationSlot: missing/empty activationId is a safe no-op', async () => {
  assert.equal(await releaseActivationSlot(), null);
  assert.equal(await releaseActivationSlot(''), null);
});

// ---------- PART 1: reactivation reuses the existing activation (no duplicate create, no reservation consumed) ----------

test('activateLicense: re-activating the same (license, domain, fingerprint) returns the existing activation without creating a duplicate or consuming another slot', async () => {
  const fakeLicenseDoc = {
    licenseId: 'LIC-REACT-1',
    status: 'active',
    expiresAt: null,
    maxActivations: 1,
    activeActivationCount: 1, // already at capacity from the earlier activation
    activatedAt: new Date(),
    toObject() {
      return { ...this };
    },
  };

  const existingActivation = {
    activationId: 'ACT-EXISTING-1',
    licenseId: 'LIC-REACT-1',
    domain: 'shop.example.com',
    fingerprintHash: null, // filled in below once we know the real hash
    status: 'active',
    appVersion: null,
    buildId: null,
    lastSeenAt: new Date(),
    async save() {
      return this;
    },
    toObject() {
      return { ...this };
    },
  };

  const restoreFindOne = mockModelFn(License, 'findOne', async () => ({ ...fakeLicenseDoc }));
  let findOneAndUpdateCalls = 0;
  const restoreFindOneAndUpdate = mockModelFn(License, 'findOneAndUpdate', async () => {
    findOneAndUpdateCalls += 1;
    return fakeLicenseDoc; // would only be reached if the (buggy) reservation path ran
  });
  let createCalls = 0;
  const restoreActivationCreate = mockModelFn(LicenseActivation, 'create', async () => {
    createCalls += 1;
    throw new Error('LicenseActivation.create must not be called on reactivation');
  });
  const restoreActivationFindOne = mockModelFn(LicenseActivation, 'findOne', async () => existingActivation);
  const restoreEventCreate = mockModelFn(LicenseEvent, 'create', async () => ({}));
  const restoreInstallationId = mockInstallationId();

  try {
    const result = await activateLicense({ licenseId: 'LIC-REACT-1', domain: 'shop.example.com' });
    assert.equal(result.activationId, 'ACT-EXISTING-1');
    assert.equal(createCalls, 0, 'no new LicenseActivation should be created on reactivation');
    assert.equal(findOneAndUpdateCalls, 0, 'the atomic capacity reservation must not run when reusing an existing activation');
  } finally {
    restoreFindOne();
    restoreFindOneAndUpdate();
    restoreActivationCreate();
    restoreActivationFindOne();
    restoreEventCreate();
    restoreInstallationId();
  }
});

// ---------- PART 6: cache invalidation after releaseActivationSlot ----------

test('releaseActivationSlot: clears the cached license state for the affected license so the next read is fresh', async () => {
  licenseCache._clearAllForTests();
  licenseCache.setCachedLicenseState('LIC-RELEASE-3', { status: 'active' });
  assert.ok(licenseCache.getCachedLicenseState('LIC-RELEASE-3'));

  const restoreActivationFOU = mockModelFn(LicenseActivation, 'findOneAndUpdate', async () => ({
    activationId: 'ACT-3',
    licenseId: 'LIC-RELEASE-3',
    status: 'revoked',
    toObject() {
      return { activationId: 'ACT-3', licenseId: 'LIC-RELEASE-3', status: 'revoked' };
    },
  }));
  const restoreLicenseUpdateOne = mockModelFn(License, 'updateOne', async () => ({ acknowledged: true }));

  try {
    await releaseActivationSlot('ACT-3');
    assert.equal(licenseCache.getCachedLicenseState('LIC-RELEASE-3'), null, 'cache must be invalidated after a revoke');
  } finally {
    restoreActivationFOU();
    restoreLicenseUpdateOne();
    licenseCache._clearAllForTests();
  }
});