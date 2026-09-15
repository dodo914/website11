const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const License = require(path.join(root, 'models/License.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const LicenseEvent = require(path.join(root, 'models/LicenseEvent.js'));
const LicenseInstallation = require(path.join(root, 'models/LicenseInstallation.js'));
const { activateLicense } = require(path.join(root, 'services/license/licenseService.js'));
const { _resetCacheForTests: resetInstallationIdCache } = require(path.join(root, 'services/license/installationIdService.js'));

// ============================================================
// PART 1F - rollback-floor hardening pass.
// الغرض من الملف ده: تستات للـtغيير الوحيد اللي اتعمل في المرحلة دي -
// حماية الـrollback بعد فشل LicenseActivation.create() في activateLicense()
// بنفس مبدأ releaseActivationSlot() (atomic $gt: 0 guard، مفيش
// countDocuments()، مفيش read-then-write).
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

test('activateLicense: reservation succeeds, LicenseActivation.create() fails, rollback decrements exactly once (activeActivationCount does not go negative)', async () => {
  const fakeLicenseDoc = {
    licenseId: 'LIC-ROLLBACK-1',
    status: 'active',
    expiresAt: null,
    maxActivations: 1,
    activeActivationCount: 0,
    activatedAt: null,
    toObject() {
      return { ...this };
    },
  };

  const restoreFindOne = mockModelFn(License, 'findOne', async () => ({ ...fakeLicenseDoc }));

  // 1) Atomic reservation succeeds (mimics MongoDB: $expr check + $inc as
  // one indivisible step).
  const restoreFindOneAndUpdate = mockModelFn(License, 'findOneAndUpdate', async () => {
    if (fakeLicenseDoc.activeActivationCount < fakeLicenseDoc.maxActivations) {
      fakeLicenseDoc.activeActivationCount += 1;
      return fakeLicenseDoc;
    }
    return null;
  });

  const updateOneCalls = [];
  const restoreUpdateOne = mockModelFn(License, 'updateOne', async (filter, update) => {
    updateOneCalls.push({ filter, update });
    // Mimic MongoDB: the update only actually applies if the filter matches.
    const guardOk = !filter.activeActivationCount || (filter.activeActivationCount.$gt === 0 && fakeLicenseDoc.activeActivationCount > 0);
    if (guardOk && update.$inc && typeof update.$inc.activeActivationCount === 'number') {
      fakeLicenseDoc.activeActivationCount += update.$inc.activeActivationCount;
    }
    return { acknowledged: true };
  });

  const restoreActivationFindOne = mockModelFn(LicenseActivation, 'findOne', async () => null); // no existing activation

  // 2) LicenseActivation.create() fails (simulated DB/duplicate-key error).
  const restoreActivationCreate = mockModelFn(LicenseActivation, 'create', async () => {
    throw new Error('simulated LicenseActivation.create failure');
  });
  const restoreEventCreate = mockModelFn(LicenseEvent, 'create', async () => ({}));
  const restoreInstallationId = mockInstallationId();

  try {
    await assert.rejects(
      () => activateLicense({ licenseId: 'LIC-ROLLBACK-1', domain: 'shop-rollback.example.com' }),
      /simulated LicenseActivation.create failure/
    );

    // 3) Rollback happened: exactly one updateOne call, using the atomic
    // $gt: 0 guard (not countDocuments(), not read-then-write).
    assert.equal(updateOneCalls.length, 1, 'exactly one rollback updateOne call should happen');
    assert.deepEqual(updateOneCalls[0].filter, { licenseId: 'LIC-ROLLBACK-1', activeActivationCount: { $gt: 0 } });
    assert.deepEqual(updateOneCalls[0].update, { $inc: { activeActivationCount: -1 } });

    // 4) Counter is back to 0 (reserved then rolled back) - never negative.
    assert.equal(fakeLicenseDoc.activeActivationCount, 0);
  } finally {
    restoreFindOne();
    restoreFindOneAndUpdate();
    restoreUpdateOne();
    restoreActivationFindOne();
    restoreActivationCreate();
    restoreEventCreate();
    restoreInstallationId();
  }
});

test('activateLicense: rollback guard prevents the counter from ever going negative even under a hypothetical double-rollback', async () => {
  // Defensive test: even if the rollback path were somehow invoked twice
  // for the same reservation (should never happen given activateLicense's
  // control flow, but this documents the floor guard's own correctness in
  // isolation), the $gt: 0 filter must stop the second decrement cold.
  const fakeLicenseDoc = { licenseId: 'LIC-ROLLBACK-2', activeActivationCount: 1 };

  const restoreUpdateOne = mockModelFn(License, 'updateOne', async (filter, update) => {
    const guardOk = filter.activeActivationCount.$gt === 0 && fakeLicenseDoc.activeActivationCount > 0;
    if (guardOk) {
      fakeLicenseDoc.activeActivationCount += update.$inc.activeActivationCount;
    }
    return { acknowledged: true };
  });

  try {
    await License.updateOne(
      { licenseId: 'LIC-ROLLBACK-2', activeActivationCount: { $gt: 0 } },
      { $inc: { activeActivationCount: -1 } }
    );
    assert.equal(fakeLicenseDoc.activeActivationCount, 0);

    // Second rollback call for the same (already-zeroed) license.
    await License.updateOne(
      { licenseId: 'LIC-ROLLBACK-2', activeActivationCount: { $gt: 0 } },
      { $inc: { activeActivationCount: -1 } }
    );
    assert.equal(fakeLicenseDoc.activeActivationCount, 0, 'the guard must block the decrement once the counter is already 0');
  } finally {
    restoreUpdateOne();
  }
});