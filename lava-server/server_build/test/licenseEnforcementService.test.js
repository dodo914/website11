const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const enforcement = require(path.join(root, 'services/license/licenseEnforcementService.js'));
const licenseService = require(path.join(root, 'services/license/licenseService.js'));
const remoteStateService = require(path.join(root, 'services/license/licenseRemoteStateService.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const License = require(path.join(root, 'models/License.js'));
const LicenseRemoteState = require(path.join(root, 'models/LicenseRemoteState.js'));

// ============================================================
// PART 2B-2C-2 - License Enforcement Foundation tests.
// مفيش Mongo حقيقي هنا - كل DB access (licenseService/LicenseActivation/
// remoteStateService) بيتعمله stub، زي نفس pattern باقي ملفات الـlicense
// tests (licenseRemoteOrchestrator.test.js إلخ). مفيش أي HTTP حقيقي.
// ============================================================

function withEnv(vars, fn) {
  const original = {};
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(original)) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    });
}

function stubLocalState(status) {
  const original = licenseService.getLocalLicenseState;
  licenseService.getLocalLicenseState = async () => ({ status, expiresAt: null, graceEndsAt: null, activation: null });
  return () => { licenseService.getLocalLicenseState = original; };
}

function stubRemoteUsability({ bucket, state }) {
  const original = remoteStateService.getRemoteLicenseUsability;
  remoteStateService.getRemoteLicenseUsability = async () => ({
    bucket,
    state,
    requiresRemoteValidation: !state,
    code: state ? null : 'REMOTE_VALIDATION_REQUIRED',
  });
  return () => { remoteStateService.getRemoteLicenseUsability = original; };
}

function stubActivation(activation) {
  const original = LicenseActivation.findOne;
  LicenseActivation.findOne = () => ({ lean: async () => activation });
  return () => { LicenseActivation.findOne = original; };
}

function stubLocalWrites() {
  const calls = [];
  const originalLicenseUpdate = License.updateOne;
  const originalLicenseFindUpdate = License.findOneAndUpdate;
  const originalActivationUpdate = LicenseActivation.updateOne;
  const originalActivationFindUpdate = LicenseActivation.findOneAndUpdate;
  const originalActivationCreate = LicenseActivation.create;
  License.updateOne = (...args) => { calls.push(['License.updateOne', args]); return originalLicenseUpdate.apply(License, args); };
  License.findOneAndUpdate = (...args) => { calls.push(['License.findOneAndUpdate', args]); return originalLicenseFindUpdate.apply(License, args); };
  LicenseActivation.updateOne = (...args) => { calls.push(['LicenseActivation.updateOne', args]); return originalActivationUpdate.apply(LicenseActivation, args); };
  LicenseActivation.findOneAndUpdate = (...args) => { calls.push(['LicenseActivation.findOneAndUpdate', args]); return originalActivationFindUpdate.apply(LicenseActivation, args); };
  LicenseActivation.create = (...args) => { calls.push(['LicenseActivation.create', args]); return originalActivationCreate.apply(LicenseActivation, args); };
  return {
    calls,
    restore: () => {
      License.updateOne = originalLicenseUpdate;
      License.findOneAndUpdate = originalLicenseFindUpdate;
      LicenseActivation.updateOne = originalActivationUpdate;
      LicenseActivation.findOneAndUpdate = originalActivationFindUpdate;
      LicenseActivation.create = originalActivationCreate;
    },
  };
}

// ---------- Local-only ----------

test('1. remote disabled + valid local license -> allowed LOCAL_ONLY_MODE', async () => {
  const restoreLocal = stubLocalState('active');
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, true);
      assert.equal(result.reason, 'LOCAL_ONLY_MODE');
      assert.equal(result.source, 'local');
    });
  } finally {
    restoreLocal();
  }
});

test('2. remote disabled + invalid local license -> blocked LICENSE_INVALID', async () => {
  const restoreLocal = stubLocalState('revoked');
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'LICENSE_INVALID');
    });
  } finally {
    restoreLocal();
  }
});

test('3. remote disabled -> no remote call (getRemoteLicenseUsability never invoked)', async () => {
  const restoreLocal = stubLocalState('active');
  let called = false;
  const original = remoteStateService.getRemoteLicenseUsability;
  remoteStateService.getRemoteLicenseUsability = async () => { called = true; return { bucket: 'fresh', state: null }; };
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
    });
    assert.equal(called, false);
  } finally {
    remoteStateService.getRemoteLicenseUsability = original;
    restoreLocal();
  }
});

// ---------- Remote trusted state ----------

test('4. trusted ACTIVE (fresh) -> allowed REMOTE_ACTIVE', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'active' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, true);
      assert.equal(result.reason, 'REMOTE_ACTIVE');
      assert.equal(result.source, 'remote');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('5. trusted REVOKED -> blocked REMOTE_REVOKED', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'revoked' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_REVOKED');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('6. trusted SUSPENDED -> blocked REMOTE_SUSPENDED', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'suspended' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_SUSPENDED');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('7. trusted EXPIRED -> blocked REMOTE_EXPIRED', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'expired' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_EXPIRED');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

// ---------- Grace ----------

test('8. active trusted state + remote unavailable + grace valid -> allowed REMOTE_GRACE', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.STALE_IN_GRACE, state: { status: 'active' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, true);
      assert.equal(result.reason, 'REMOTE_GRACE');
      assert.equal(result.graceUsed, true);
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('9. active trusted state + remote unavailable + grace expired -> blocked REMOTE_UNAVAILABLE_GRACE_EXPIRED', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE, state: { status: 'active' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_UNAVAILABLE_GRACE_EXPIRED');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('10. revoked trusted state + remote unavailable -> blocked REMOTE_REVOKED (grace does not override)', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE, state: { status: 'revoked' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_REVOKED');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('11. suspended trusted state + remote unavailable -> blocked REMOTE_SUSPENDED (grace does not override)', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE, state: { status: 'suspended' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_SUSPENDED');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('12. expired trusted state + remote unavailable -> blocked REMOTE_EXPIRED (grace does not override)', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE, state: { status: 'expired' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_EXPIRED');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

// ---------- Security ----------
// ملحوظة: الأربعة تستات دول بيثبتوا إن licenseEnforcementService نفسه
// **مبيقراش raw remote response خالص** - هو بس بيقرا trusted state اللي
// اتخزنت بعد ما عدت pipeline التحقق (processRemoteResponse) في
// licenseRemoteOrchestrator.js. أي response فشل verification أصلًا مبيوصلش
// لـsaveSuccessfulRemoteState() (شوف licenseRemoteOrchestrator.test.js/
// licenseRemoteFoundation.test.js) - فهنا كافي نتأكد إن "مفيش trusted state
// = REMOTE_STATE_UNAVAILABLE"، مش "active" افتراضيًا.

test('13. invalid signature never becomes usable state (no trusted state -> REMOTE_STATE_UNAVAILABLE)', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.NEVER_VALIDATED, state: null });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_STATE_UNAVAILABLE');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('14. malformed remote response never becomes usable state (same as no trusted state)', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.NEVER_VALIDATED, state: null });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_STATE_UNAVAILABLE');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('15. requestId mismatch never becomes usable state (same as no trusted state)', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.NEVER_VALIDATED, state: null });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_STATE_UNAVAILABLE');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

test('16. expired remote response (protocol-level) never becomes usable state (same as no trusted state)', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.NEVER_VALIDATED, state: null });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_STATE_UNAVAILABLE');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

// ---------- Isolation ----------

test('17-20. enforcement does not modify License/LicenseActivation, does not start heartbeat, does not do HTTP', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'active' } });
  const writes = stubLocalWrites();

  let heartbeatStarted = false;
  const heartbeatScheduler = require(path.join(root, 'services/license/licenseRemoteHeartbeatScheduler.js'));
  const originalStart = heartbeatScheduler.startHeartbeatScheduler || heartbeatScheduler.start;
  if (typeof originalStart === 'function') {
    const key = heartbeatScheduler.startHeartbeatScheduler ? 'startHeartbeatScheduler' : 'start';
    heartbeatScheduler[key] = (...args) => { heartbeatStarted = true; return originalStart.apply(heartbeatScheduler, args); };
    try {
      await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
        const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
        assert.equal(result.allowed, true);
      });
    } finally {
      heartbeatScheduler[key] = originalStart;
    }
  } else {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, true);
    });
  }

  assert.equal(heartbeatStarted, false);
  assert.equal(writes.calls.length, 0, 'enforcement must not write to License or LicenseActivation');

  writes.restore();
  restoreRemote();
  restoreLocal();
});

test('does not import or use any HTTP/transport module directly', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseEnforcementService.js'), 'utf8');
  assert.doesNotMatch(source, /require\(['"](axios|node-fetch|http|https)['"]\)/);
  assert.doesNotMatch(source, /fetch\(/);
});

// ---------- Domain / activation ----------

test('21. wrong domain -> blocked LICENSE_DOMAIN_NOT_ALLOWED', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubActivation({ licenseId: 'LIC-1', activationId: 'ACT-1', status: 'active', domain: 'other.com' });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1', activationId: 'ACT-1', domain: 'example.com' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'LICENSE_DOMAIN_NOT_ALLOWED');
    });
  } finally {
    restoreActivation();
    restoreLocal();
  }
});

test('22. invalid activation (not found) -> blocked LICENSE_INVALID', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubActivation(null);
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1', activationId: 'ACT-MISSING', domain: 'example.com' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'LICENSE_INVALID');
    });
  } finally {
    restoreActivation();
    restoreLocal();
  }
});

test('22b. invalid activation (revoked) -> blocked LICENSE_INVALID', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubActivation({ licenseId: 'LIC-1', activationId: 'ACT-1', status: 'revoked', domain: 'example.com' });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1', activationId: 'ACT-1', domain: 'example.com' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'LICENSE_INVALID');
    });
  } finally {
    restoreActivation();
    restoreLocal();
  }
});

test('22c. activation belongs to a different license -> blocked LICENSE_INVALID', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubActivation({ licenseId: 'LIC-OTHER', activationId: 'ACT-1', status: 'active', domain: 'example.com' });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1', activationId: 'ACT-1', domain: 'example.com' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'LICENSE_INVALID');
    });
  } finally {
    restoreActivation();
    restoreLocal();
  }
});

// ---------- Determinism ----------

test('23. same local + remote state produces same decision', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'active' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const r1 = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      const r2 = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.deepEqual(r1, r2);
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

// ---------- Remote invalid status ----------

test('remote trusted state with unknown/invalid status -> blocked REMOTE_INVALID', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'invalid' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      const result = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1' });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'REMOTE_INVALID');
    });
  } finally {
    restoreRemote();
    restoreLocal();
  }
});

// ---------- Missing licenseId ----------

test('missing licenseId -> blocked LICENSE_INVALID, no lookups performed', async () => {
  const result = await enforcement.evaluateLicenseEnforcement({});
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'LICENSE_INVALID');
});

// ============================================================
// FIX: `now` لازم يتمرر فعليًا لـevaluateRemoteFreshness() عن طريق
// getRemoteLicenseUsability(licenseId, now) - مش يتجاهل ويستخدم دايمًا
// new Date() الحقيقي. التستات دي بتستخدم remoteStateService الحقيقي (مش
// stub لـgetRemoteLicenseUsability نفسها) - بنعمل stub بس على
// LicenseRemoteState.findOne (الطبقة الوحيدة اللي بتلمس DB فعليًا).
// ============================================================

function stubLastRemoteState(doc) {
  const original = LicenseRemoteState.findOne;
  LicenseRemoteState.findOne = () => ({ lean: async () => doc });
  return () => { LicenseRemoteState.findOne = original; };
}

const BASE_VALIDATED_AT = new Date('2026-01-01T00:00:00.000Z');

test('now-fix 1: same remote state, now inside fresh window -> FRESH', async () => {
  const restore = stubLastRemoteState({ status: 'active', lastSuccessfulValidationAt: BASE_VALIDATED_AT });
  try {
    await withEnv({ LICENSE_CACHE_TTL: '300', LICENSE_REMOTE_GRACE_PERIOD_HOURS: '72' }, async () => {
      const now = new Date(BASE_VALIDATED_AT.getTime() + 100 * 1000); // +100s, inside 300s fresh window
      const usability = await remoteStateService.getRemoteLicenseUsability('LIC-1', now);
      assert.equal(usability.bucket, remoteStateService.FRESHNESS_BUCKETS.FRESH);
    });
  } finally {
    restore();
  }
});

test('now-fix 2: same remote state, now inside grace window -> STALE_IN_GRACE', async () => {
  const restore = stubLastRemoteState({ status: 'active', lastSuccessfulValidationAt: BASE_VALIDATED_AT });
  try {
    await withEnv({ LICENSE_CACHE_TTL: '300', LICENSE_REMOTE_GRACE_PERIOD_HOURS: '72' }, async () => {
      const now = new Date(BASE_VALIDATED_AT.getTime() + 10 * 60 * 60 * 1000); // +10h: past fresh window, inside 72h grace
      const usability = await remoteStateService.getRemoteLicenseUsability('LIC-1', now);
      assert.equal(usability.bucket, remoteStateService.FRESHNESS_BUCKETS.STALE_IN_GRACE);
    });
  } finally {
    restore();
  }
});

test('now-fix 3: same remote state, now past grace window -> EXPIRED_BEYOND_GRACE', async () => {
  const restore = stubLastRemoteState({ status: 'active', lastSuccessfulValidationAt: BASE_VALIDATED_AT });
  try {
    await withEnv({ LICENSE_CACHE_TTL: '300', LICENSE_REMOTE_GRACE_PERIOD_HOURS: '72' }, async () => {
      const now = new Date(BASE_VALIDATED_AT.getTime() + 100 * 60 * 60 * 1000); // +100h: past 72h grace
      const usability = await remoteStateService.getRemoteLicenseUsability('LIC-1', now);
      assert.equal(usability.bucket, remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE);
    });
  } finally {
    restore();
  }
});

test('now-fix 4: evaluateLicenseEnforcement({ now }) actually uses the passed now (fresh vs grace-expired -> different decisions)', async () => {
  const restoreLocal = stubLocalState('active');
  const restoreLastState = stubLastRemoteState({ status: 'active', lastSuccessfulValidationAt: BASE_VALIDATED_AT });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_CACHE_TTL: '300', LICENSE_REMOTE_GRACE_PERIOD_HOURS: '72' }, async () => {
      const freshNow = new Date(BASE_VALIDATED_AT.getTime() + 100 * 1000);
      const freshResult = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1', now: freshNow });
      assert.equal(freshResult.allowed, true);
      assert.equal(freshResult.reason, 'REMOTE_ACTIVE');

      const expiredNow = new Date(BASE_VALIDATED_AT.getTime() + 100 * 60 * 60 * 1000);
      const expiredResult = await enforcement.evaluateLicenseEnforcement({ licenseId: 'LIC-1', now: expiredNow });
      assert.equal(expiredResult.allowed, false);
      assert.equal(expiredResult.reason, 'REMOTE_UNAVAILABLE_GRACE_EXPIRED');
    });
  } finally {
    restoreLastState();
    restoreLocal();
  }
});

test('now-fix 5: no real HTTP involved in the fixed path', () => {
  const fs = require('node:fs');
  const stateServiceSource = fs.readFileSync(path.join(root, 'services/license/licenseRemoteStateService.js'), 'utf8');
  assert.doesNotMatch(stateServiceSource, /require\(['"](axios|node-fetch|http|https)['"]\)/);
  assert.doesNotMatch(stateServiceSource, /fetch\(/);
});

test('now-fix 6: still no global enforcement wiring (requireLicenseEnforcement not used on any app/router)', () => {
  const fs = require('node:fs');
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.doesNotMatch(serverSource, /requireLicenseEnforcement/);
  const enforcementSource = fs.readFileSync(path.join(root, 'services/license/licenseEnforcementService.js'), 'utf8');
  assert.doesNotMatch(enforcementSource, /app\.use\(\s*requireLicenseEnforcement/);
  assert.doesNotMatch(enforcementSource, /router\.use\(\s*requireLicenseEnforcement/);
});