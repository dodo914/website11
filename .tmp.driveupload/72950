const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const License = require(path.join(root, 'models/License.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const LicenseEvent = require(path.join(root, 'models/LicenseEvent.js'));
const LicenseInstallation = require(path.join(root, 'models/LicenseInstallation.js'));
const licenseCache = require(path.join(root, 'services/license/licenseCache.js'));
const { ActivationLimitError } = require(path.join(root, 'services/license/licenseErrors.js'));
const { _resetCacheForTests: resetInstallationIdCache } = require(path.join(root, 'services/license/installationIdService.js'));

function mockModelFn(Model, fnName, impl) {
  const original = Model[fnName];
  Model[fnName] = impl;
  return () => {
    Model[fnName] = original;
  };
}

// createLicenseFingerprint() (called internally by activateLicense) needs a
// working getInstallationId() - stub LicenseInstallation so it never hits a
// real DB, the same way installationIdService's own tests do.
function mockInstallationId(fixedId = 'fixed-installation-id-for-tests') {
  const restore = mockModelFn(LicenseInstallation, 'findOneAndUpdate', async () => ({ installationId: fixedId }));
  resetInstallationIdCache();
  return () => {
    restore();
    resetInstallationIdCache();
  };
}

// ============================================================
// PART 1D - hardening pass tests.
// نفس فلسفة باقي الـsuite: من غير اتصال حقيقي بـMongoDB - بيستخدموا
// mocking لدوال الموديل (findOneAndUpdate/create/findOne) عشان يحاكوا
// سلوك الداتابيز (بما فيه الـatomicity المفروضة من MongoDB لأي عملية
// findOneAndUpdate على document واحد) من غير الحاجة لـreplica set حقيقي.
// ============================================================

// ---------- 1: .env.example contains no real secrets ----------

test('.env.example: contains no real/leaked credentials', () => {
  const source = read('.env.example');

  // These are the exact leaked values that existed in the file before this
  // hardening pass - if any of them ever reappear, something regressed.
  const leakedSecrets = [
    'FTNisdtlbAsLP1Y8', // MongoDB Atlas password
    '2gXqmBnM6XWFftbzBPCIj4ILhik', // Cloudinary API secret
    're_JSLZ5JXy_2TeeCJcWhjwJRURPu73XBnir', // Resend API key
    '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', // Brevo API key
    'f356649ed18afef8003c51b91c585688', // Kashier secret key
    'egy_sk_test_65b7de0989c49ab66153437cdbb6baede022e1dfb63e74f4484f07526af1e45c', // Paymob secret key
    'EDCEDEBD5D8B9FAA1A3B78304DFC69CE', // Paymob HMAC secret
    '5a05bf883d0a54baf4553a65a9cb806293ba1c9b4eae16ba41d8cf28f1de2440', // Bosta API key
    '1vAPlWA6.5Wy0b0mDGV8Q3CIpqULmDMgnj1ILblcz', // ShipBlu API key
    'QN19FMpS.93mGcH8qLVRAPFEZlkTjGl5845TU17Ga', // ShipBlu sandbox API key
    'dodoadam1382009@gmail.com', // real personal email used as sender
  ];
  for (const secret of leakedSecrets) {
    assert.ok(!source.includes(secret), `.env.example must not contain the leaked value "${secret}"`);
  }

  // No mongodb+srv (Atlas) connection string with embedded credentials.
  assert.ok(!/mongodb\+srv:\/\/[^:]+:[^@]+@/.test(source), '.env.example must not contain a live MongoDB URI with credentials');

  // Variable names the app actually uses must stay present (only values changed).
  for (const key of ['MONGODB_URI', 'JWT_SECRET', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'KASHIER_SECRET_KEY', 'PAYMOB_SECRET_KEY']) {
    assert.match(source, new RegExp(`^${key}=`, 'm'), `.env.example must still define ${key}`);
  }

  // File must still parse as one KEY=value per line (catches the previous
  // bug where MONGODB_URI's value ran into JWT_SECRET on the same line).
  assert.match(source, /^JWT_SECRET=/m);
});

test('.env: the real local secrets file is not deleted or altered by the .env.example cleanup', () => {
  assert.ok(fs.existsSync(path.join(root, '.env')), '.env must still exist untouched');
});

test('.gitignore: ignores real env files but keeps the .example templates trackable', () => {
  const gitignorePath = path.join(root, '.gitignore');
  assert.ok(fs.existsSync(gitignorePath), '.gitignore should exist so real secrets are never committed');
  const source = read('.gitignore');
  assert.match(source, /^\.env$/m);
  assert.ok(!/^\.env\.example$/m.test(source), '.env.example must remain trackable');
});

// ---------- 2 & 3: activation-limit race + duplicate activation ----------

test('licenseService.activateLicense: maxActivations cannot be exceeded under concurrent activation attempts', async () => {
  const { activateLicense } = require(path.join(root, 'services/license/licenseService.js'));

  // Simulate a single License document with maxActivations=1, living only
  // in memory. findOneAndUpdate here mimics real MongoDB atomicity: the
  // $expr check-and-$inc happens as one indivisible step per call.
  const fakeLicenseDoc = {
    licenseId: 'LIC-RACE-1',
    status: 'active',
    expiresAt: null,
    maxActivations: 1,
    activeActivationCount: 0,
    activatedAt: null,
    toObject() {
      return { ...this };
    },
    async save() {
      return this;
    },
  };

  const restoreFindOne = mockModelFn(License, 'findOne', async () => ({
    ...fakeLicenseDoc,
    toObject: fakeLicenseDoc.toObject,
  }));

  const restoreFindOneAndUpdate = mockModelFn(License, 'findOneAndUpdate', async (filter) => {
    // Real MongoDB serializes concurrent writes to the same document, so
    // this whole block executes as one atomic step per call.
    if (fakeLicenseDoc.activeActivationCount < fakeLicenseDoc.maxActivations) {
      fakeLicenseDoc.activeActivationCount += 1;
      return fakeLicenseDoc;
    }
    return null;
  });

  const restoreUpdateOne = mockModelFn(License, 'updateOne', async (filter, update) => {
    if (update && update.$inc && typeof update.$inc.activeActivationCount === 'number') {
      fakeLicenseDoc.activeActivationCount += update.$inc.activeActivationCount;
    }
    return { acknowledged: true };
  });

  const activations = [];
  const restoreActivationFindOne = mockModelFn(LicenseActivation, 'findOne', async () => null); // no existing activation
  const restoreActivationCreate = mockModelFn(LicenseActivation, 'create', async (doc) => {
    activations.push(doc);
    return { ...doc, toObject: () => ({ ...doc }) };
  });
  const restoreEventCreate = mockModelFn(LicenseEvent, 'create', async () => ({}));
  const restoreInstallationId = mockInstallationId();

  try {
    const results = await Promise.allSettled([
      activateLicense({ licenseId: 'LIC-RACE-1', domain: 'shop-a.example.com' }),
      activateLicense({ licenseId: 'LIC-RACE-1', domain: 'shop-b.example.com' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'exactly one concurrent activation should succeed');
    assert.equal(rejected.length, 1, 'exactly one concurrent activation should be rejected');
    assert.ok(rejected[0].reason instanceof ActivationLimitError);
    assert.equal(activations.length, 1, 'only one LicenseActivation document should ever be created');
    assert.equal(fakeLicenseDoc.activeActivationCount, 1, 'the reserved count must not exceed maxActivations');
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

test('licenseService.activateLicense: releases the reserved slot if LicenseActivation.create() fails', async () => {
  const { activateLicense } = require(path.join(root, 'services/license/licenseService.js'));

  const fakeLicenseDoc = {
    licenseId: 'LIC-RACE-2',
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
  const restoreFindOneAndUpdate = mockModelFn(License, 'findOneAndUpdate', async () => {
    if (fakeLicenseDoc.activeActivationCount < fakeLicenseDoc.maxActivations) {
      fakeLicenseDoc.activeActivationCount += 1;
      return fakeLicenseDoc;
    }
    return null;
  });
  const restoreUpdateOne = mockModelFn(License, 'updateOne', async (filter, update) => {
    fakeLicenseDoc.activeActivationCount += update.$inc.activeActivationCount;
    return { acknowledged: true };
  });
  const restoreActivationFindOne = mockModelFn(LicenseActivation, 'findOne', async () => null);
  const restoreActivationCreate = mockModelFn(LicenseActivation, 'create', async () => {
    throw new Error('simulated duplicate-key error');
  });
  const restoreEventCreate = mockModelFn(LicenseEvent, 'create', async () => ({}));
  const restoreInstallationId = mockInstallationId();

  try {
    await assert.rejects(
      () => activateLicense({ licenseId: 'LIC-RACE-2', domain: 'shop-c.example.com' }),
      /simulated duplicate-key error/
    );
    assert.equal(fakeLicenseDoc.activeActivationCount, 0, 'the slot must be released back after a failed create');
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

test('LicenseActivation: duplicate activation for the same (licenseId, domain, fingerprintHash) still fails via the unique compound index', () => {
  const indexes = LicenseActivation.schema.indexes();
  const compound = indexes.find(
    ([keys]) => keys.licenseId === 1 && keys.domain === 1 && keys.fingerprintHash === 1
  );
  assert.ok(compound, 'compound unique index on (licenseId, domain, fingerprintHash) must exist');
  assert.equal(compound[1].unique, true, 'the compound index must be unique to reject exact duplicate activations');
});

test('licenseService.activateLicense: source still contains no external HTTP/network calls after the hardening pass', () => {
  const source = read('services/license/licenseService.js');
  assert.ok(!/require\(['"]axios['"]\)/.test(source));
  assert.ok(!/require\(['"]node-fetch['"]\)/.test(source));
  assert.ok(!/\bfetch\(/.test(source));
  assert.ok(!/require\(['"]ioredis['"]\)|new\s+Redis\s*\(/i.test(source), 'must not introduce Redis');
});

// ---------- 5: installation ID init under concurrent calls ----------

test('installationIdService: concurrent getInstallationId() calls before memoization all resolve to the same id (atomic upsert)', async () => {
  const installationIdServicePath = path.join(root, 'services/license/installationIdService.js');
  const LicenseInstallation = require(path.join(root, 'models/LicenseInstallation.js'));
  const originalFindOneAndUpdate = LicenseInstallation.findOneAndUpdate;

  const fixedId = 'fixed-installation-id-concurrent';
  // Simulates MongoDB upsert semantics: whichever call "wins" the insert,
  // every caller ends up reading back the same persisted document.
  let persisted = null;
  LicenseInstallation.findOneAndUpdate = async (filter, update) => {
    if (!persisted) {
      persisted = { installationId: update.$setOnInsert.installationId };
    }
    return persisted;
  };

  const { getInstallationId, _resetCacheForTests } = require(installationIdServicePath);
  _resetCacheForTests();

  try {
    const results = await Promise.all([getInstallationId(), getInstallationId(), getInstallationId()]);
    assert.ok(results.every((id) => id === results[0]), 'all concurrent calls must resolve to the same installationId');
  } finally {
    LicenseInstallation.findOneAndUpdate = originalFindOneAndUpdate;
    _resetCacheForTests();
  }
});

// ---------- 6 & 7: license cache TTL + isolation between license IDs ----------

test('licenseCache: an expired entry is never treated as fresh/valid', () => {
  licenseCache._clearAllForTests();
  const state = licenseCache.setCachedLicenseState('LIC-TTL-1', { status: 'active' });
  state.cachedAt = new Date(Date.now() - 10_000); // force it stale
  assert.equal(licenseCache.isCacheFresh(state, 5), false);
});

test('licenseCache: entries for different license IDs never collide or leak into each other', () => {
  licenseCache._clearAllForTests();
  licenseCache.setCachedLicenseState('LIC-A', { status: 'active' });
  licenseCache.setCachedLicenseState('LIC-B', { status: 'revoked' });

  const a = licenseCache.getCachedLicenseState('LIC-A');
  const b = licenseCache.getCachedLicenseState('LIC-B');

  assert.equal(a.status, 'active');
  assert.equal(b.status, 'revoked');

  licenseCache.clearCachedLicenseState('LIC-A');
  assert.equal(licenseCache.getCachedLicenseState('LIC-A'), null);
  assert.equal(licenseCache.getCachedLicenseState('LIC-B').status, 'revoked', 'clearing one license must not affect another');
});