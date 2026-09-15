const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

const root = path.resolve(__dirname, '..');

const { requireLicenseEnforcement, ENFORCEMENT_REASONS } = require(path.join(root, 'services/license/licenseEnforcementService.js'));
const licenseMiddleware = require(path.join(root, 'middleware/licenseMiddleware.js'));
const licenseService = require(path.join(root, 'services/license/licenseService.js'));
const remoteStateService = require(path.join(root, 'services/license/licenseRemoteStateService.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));

// ============================================================
// PART 2B-2C-3 - Route-level license enforcement integration tests.
// ============================================================
// مفيش Mongo حقيقي، مفيش HTTP لأي License Server حقيقي - بس server HTTP
// محلي فعلي (127.0.0.1 عن طريق http.createServer) عشان نتأكد إن الـ
// middleware فعلاً شغال صح جوه Express request/response cycle حقيقي، مش
// بس بـfake req/res.

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

function stubConfiguredLicenseId(licenseId) {
  const original = licenseMiddleware.getConfiguredLicenseId;
  licenseMiddleware.getConfiguredLicenseId = () => licenseId;
  return () => { licenseMiddleware.getConfiguredLicenseId = original; };
}

function stubServerActivation(activation) {
  const original = LicenseActivation.findOne;
  LicenseActivation.findOne = () => ({ lean: async () => activation });
  return () => { LicenseActivation.findOne = original; };
}

/** بيبني app اختباري فيه route محمي واحد بـrequireLicenseEnforcement() بالـ
 * defaults الحقيقية بتاعته، وroute عام تاني من غيره - زي ما هيحصل فعليًا
 * في routes/licenseRoutes.js (محمي) مقابل باقي الـstorefront routes (مش
 * محمية). */
function buildTestApp() {
  const app = express();
  app.get('/api/license/status', requireLicenseEnforcement(), (req, res) => res.json({ licensed: true }));
  app.get('/api/products/public', (req, res) => res.json({ ok: true })); // زي storefront route عادي - من غير enforcement خالص
  return app;
}

async function withServer(fn) {
  const app = buildTestApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('1. allowed license reaches the protected route', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubServerActivation({ licenseId: 'LIC-1', activationId: 'ACT-1', status: 'active', domain: 'example.com' });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.licensed, true);
      });
    });
  } finally {
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('2. blocked license returns 403', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('revoked');
  const restoreActivation = stubServerActivation(null);
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status`);
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.code, ENFORCEMENT_REASONS.LICENSE_INVALID);
      });
    });
  } finally {
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('3. REMOTE_REVOKED returns 403', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubServerActivation(null);
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'revoked' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status`);
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.code, 'REMOTE_REVOKED');
      });
    });
  } finally {
    restoreRemote();
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('4. REMOTE_SUSPENDED returns 403', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubServerActivation(null);
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'suspended' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status`);
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.code, 'REMOTE_SUSPENDED');
      });
    });
  } finally {
    restoreRemote();
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('5. REMOTE_EXPIRED returns 403', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubServerActivation(null);
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.FRESH, state: { status: 'expired' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status`);
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.code, 'REMOTE_EXPIRED');
      });
    });
  } finally {
    restoreRemote();
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('6. REMOTE_UNAVAILABLE_GRACE_EXPIRED returns 403', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubServerActivation(null);
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE, state: { status: 'active' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status`);
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.code, 'REMOTE_UNAVAILABLE_GRACE_EXPIRED');
      });
    });
  } finally {
    restoreRemote();
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('7. REMOTE_GRACE allows the route', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubServerActivation(null);
  const restoreRemote = stubRemoteUsability({ bucket: remoteStateService.FRESHNESS_BUCKETS.STALE_IN_GRACE, state: { status: 'active' } });
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'true' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status`);
        assert.equal(res.status, 200);
      });
    });
  } finally {
    restoreRemote();
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('8. LOCAL_ONLY_MODE allows the route', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubServerActivation(null);
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status`);
        assert.equal(res.status, 200);
      });
    });
  } finally {
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('9. public/non-protected storefront route remains unaffected regardless of license state', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('revoked'); // حتى لو الترخيص محلي متبوظ خالص
  try {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/products/public`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.ok, true);
    });
  } finally {
    restoreLocal();
    restoreLicenseId();
  }
});

test('10. enforcement is NOT globally attached (server.js only mounts licenseRoutes on /api/license, no app.use(requireLicenseEnforcement))', () => {
  const fs = require('node:fs');
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.doesNotMatch(serverSource, /requireLicenseEnforcement/);
  assert.match(serverSource, /app\.use\('\/api\/license', require\('\.\/routes\/licenseRoutes'\)\)/);

  const licenseRoutesSource = fs.readFileSync(path.join(root, 'routes/licenseRoutes.js'), 'utf8');
  // متربطة على route واحد صريح (`/status`) بس، مش router.use() عام على كل الـrouter
  assert.doesNotMatch(licenseRoutesSource, /router\.use\(\s*requireLicenseEnforcement/);
  assert.match(licenseRoutesSource, /router\.get\('\/status',/);
  assert.match(licenseRoutesSource, /requireLicenseEnforcement\(\)/);
});

test('11. arbitrary client-provided licenseId cannot override the configured server-side license context', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-REAL');
  const restoreLocal = stubLocalState('active');
  const restoreActivation = stubServerActivation(null);
  let receivedLicenseId = null;
  const originalGetLocal = licenseService.getLocalLicenseState;
  licenseService.getLocalLicenseState = async (licenseId) => { receivedLicenseId = licenseId; return { status: 'active', expiresAt: null, graceEndsAt: null, activation: null }; };
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status?licenseId=LIC-ATTACKER`, {
          headers: { 'x-license-id': 'LIC-ATTACKER' },
        });
        assert.equal(res.status, 200);
        assert.equal(receivedLicenseId, 'LIC-REAL'); // مش LIC-ATTACKER
      });
    });
  } finally {
    licenseService.getLocalLicenseState = originalGetLocal;
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('12. arbitrary client-provided activationId cannot bypass the real activation/domain binding', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const restoreLocal = stubLocalState('active');
  // الـserver-side activation الحقيقية على دومين مختلف تمامًا عن أي حاجة
  // ممكن العميل يبعتها.
  const restoreActivation = stubServerActivation({ licenseId: 'LIC-1', activationId: 'ACT-REAL', status: 'active', domain: 'real-store.com' });
  let receivedActivationId = null;
  let receivedDomain = null;
  const originalCheckBinding = require(path.join(root, 'services/license/licenseEnforcementService.js'))._checkActivationBinding;
  try {
    await withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/license/status`, {
          headers: {
            'x-license-activation-id': 'ACT-ATTACKER-CONTROLLED',
            'x-forwarded-host': 'attacker-domain.com',
          },
        });
        // لو الـheaders دي اتقروا كانت هتأثر - بس هي مبتتقراش خالص، فالنتيجة
        // بتعتمد بس على الـactivation الحقيقية المخزنة (ACT-REAL / real-store.com).
        assert.equal(res.status, 200);
      });
    });
  } finally {
    restoreActivation();
    restoreLocal();
    restoreLicenseId();
  }
});

test('13. middleware errors do not leak stack traces or internal details', async () => {
  const restoreLicenseId = stubConfiguredLicenseId('LIC-1');
  const original = licenseService.getLocalLicenseState;
  licenseService.getLocalLicenseState = async () => { throw new Error('internal mongo connection string leak test'); };
  try {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/license/status`, { headers: { Connection: 'close' } });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.code, 'LICENSE_CHECK_FAILED');
      const bodyText = JSON.stringify(body);
      assert.doesNotMatch(bodyText, /internal mongo connection string leak test/);
      assert.doesNotMatch(bodyText, /at Object\.|at async|\.js:\d+:\d+/); // مفيش stack trace شكل
    });
  } finally {
    licenseService.getLocalLicenseState = original;
    restoreLicenseId();
  }
});

test('14. existing route behavior remains unchanged when license enforcement middleware is not attached (storefront)', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/products/public`);
    assert.equal(res.status, 200);
  });
});