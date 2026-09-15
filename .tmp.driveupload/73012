const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const bootstrap = require(path.join(root, 'services/license/licenseRemoteHeartbeatBootstrap.js'));
const remoteClient = require(path.join(root, 'services/license/licenseRemoteClient.js'));
const heartbeatService = require(path.join(root, 'services/license/licenseRemoteHeartbeatService.js'));
const signatureService = require(path.join(root, 'services/license/licenseRemoteSignatureService.js'));
const protocol = require(path.join(root, 'services/license/licenseRemoteProtocol.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const LicenseRemoteState = require(path.join(root, 'models/LicenseRemoteState.js'));
const REAL_LICENSE_REMOTE_STATE_FIND_ONE = LicenseRemoteState.findOne;
const License = require(path.join(root, 'models/License.js'));

// ============================================================
// PART 2B-2C-1 - Bootstrap wiring tests.
// مفيش HTTP/Mongo حقيقي هنا - LicenseActivation.find() بيتعمله stub، وأي
// remote call بيعدي على transport محقون. الاختبارات دي integration-style
// عمدًا (بتشغّل الـwiring الحقيقي: bootstrap → scheduler → discovery →
// heartbeatService → orchestrator → pipeline) عشان تتأكد إن التوصيل نفسه
// شغال صح، مش بس كل جزء لوحده.
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

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stubActivationFind(docs) {
  const calls = [];
  const original = LicenseActivation.find;
  LicenseActivation.find = (filter, projection) => {
    calls.push({ filter, projection });
    return { limit: () => ({ lean: async () => docs }) };
  };
  return { calls, restore: () => { LicenseActivation.find = original; } };
}

function stubRemoteStatePersist() {
  const original = LicenseRemoteState.findOneAndUpdate;
  const calls = [];
  // STEP 5 SAFETY FIX (PART 2B-2C-4): saveSuccessfulRemoteState() بقت بتعمل
  // findOne() الأول (stale-write guard) قبل الـupsert - لازم يتستبّب هنا كمان.
  const findOneAlreadyStubbed = LicenseRemoteState.findOne !== REAL_LICENSE_REMOTE_STATE_FIND_ONE;
  const originalFindOne = LicenseRemoteState.findOne;
  if (!findOneAlreadyStubbed) {
    LicenseRemoteState.findOne = () => ({ lean: async () => null });
  }
  LicenseRemoteState.findOneAndUpdate = async (filter, update) => {
    calls.push({ filter, update });
    return { toObject: () => ({ licenseId: filter.licenseId, ...update.$set }) };
  };
  return {
    calls,
    restore: () => {
      LicenseRemoteState.findOneAndUpdate = original;
      if (!findOneAlreadyStubbed) LicenseRemoteState.findOne = originalFindOne;
    },
  };
}

function stubLocalWrites() {
  const calls = [];
  const originals = {
    licenseUpdateOne: License.updateOne,
    licenseFindOneAndUpdate: License.findOneAndUpdate,
    activationUpdateOne: LicenseActivation.updateOne,
    activationFindOneAndUpdate: LicenseActivation.findOneAndUpdate,
  };
  License.updateOne = async (...args) => { calls.push('License.updateOne'); return originals.licenseUpdateOne.apply(License, args); };
  License.findOneAndUpdate = async (...args) => { calls.push('License.findOneAndUpdate'); return originals.licenseFindOneAndUpdate.apply(License, args); };
  LicenseActivation.updateOne = async (...args) => { calls.push('LicenseActivation.updateOne'); return originals.activationUpdateOne.apply(LicenseActivation, args); };
  LicenseActivation.findOneAndUpdate = async (...args) => { calls.push('LicenseActivation.findOneAndUpdate'); return originals.activationFindOneAndUpdate.apply(LicenseActivation, args); };
  return {
    calls,
    restore: () => {
      License.updateOne = originals.licenseUpdateOne;
      License.findOneAndUpdate = originals.licenseFindOneAndUpdate;
      LicenseActivation.updateOne = originals.activationUpdateOne;
      LicenseActivation.findOneAndUpdate = originals.activationFindOneAndUpdate;
    },
  };
}

function generateTestKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return { publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }), privateKey };
}

function mockTransportWithStatus({ privateKey, status = 'active' }) {
  return async ({ payload }) => {
    const timestamp = new Date().toISOString();
    const data = { licenseId: payload.licenseId, status };
    const signature = crypto
      .sign(null, signatureService.buildCanonicalSigningPayload({ protocolVersion: '1', operation: protocol.REMOTE_OPERATIONS.HEARTBEAT, requestId: payload.requestId, timestamp, success: true, code: 'OK', data }), privateKey)
      .toString('base64');
    return { protocolVersion: '1', operation: protocol.REMOTE_OPERATIONS.HEARTBEAT, requestId: payload.requestId, timestamp, success: true, code: 'OK', message: 'ok', data, signature };
  };
}

// bootstrap.js uses a module-level lazy singleton scheduler - نتأكد إنه
// واقف تمامًا بعد كل تست، عشان تستات تانية متتأثرش بحالة سابقة.
test.afterEach(() => {
  bootstrap.stopLicenseHeartbeatScheduler();
  heartbeatService._resetLocksForTests();
  remoteClient._resetTransportForTests();
});

// ---------- 1: heartbeat disabled -> scheduler does not start ----------

test('bootstrap: LICENSE_REMOTE_HEARTBEAT_ENABLED=false -> scheduler does not start, no DB query happens', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_ENABLED: 'false', LICENSE_REMOTE_ENABLED: 'true' }, async () => {
    const activationStub = stubActivationFind([{ licenseId: 'LIC-1', activationId: 'ACT-1' }]);
    try {
      bootstrap.startLicenseHeartbeatScheduler();
      assert.equal(bootstrap.getLicenseHeartbeatScheduler().isRunning(), false);
      await waitMs(30);
      assert.equal(activationStub.calls.length, 0, 'discovery must never be queried while heartbeat scheduling is disabled');
    } finally {
      activationStub.restore();
    }
  }));

// ---------- 2: remote disabled -> heartbeat cannot start (even though scheduler ticks) ----------

test('bootstrap: LICENSE_REMOTE_ENABLED=false + heartbeat enabled -> no activation is ever queried/attempted (PART D)', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_ENABLED: 'true', LICENSE_REMOTE_HEARTBEAT_INTERVAL_MS: '20', LICENSE_REMOTE_ENABLED: 'false' }, async () => {
    const activationStub = stubActivationFind([{ licenseId: 'LIC-1', activationId: 'ACT-1' }]);
    try {
      bootstrap.startLicenseHeartbeatScheduler();
      await waitMs(70);
      // PART D: حتى لو الـscheduler نفسه بدأ (heartbeat flag=true)، مفيش
      // أي query حقيقية لازم تحصل على LicenseActivation طول ما remote
      // نفسه معطّل - الـwiring الحالي بيقفل الموضوع بدري في getActivations.
      assert.equal(activationStub.calls.length, 0, 'no DB query should happen while LICENSE_REMOTE_ENABLED=false, even if the scheduler is ticking');
    } finally {
      activationStub.restore();
    }
  }));

// ---------- 3/4: heartbeat+remote enabled -> scheduler starts exactly once, repeated bootstrap is idempotent ----------

test('bootstrap: heartbeat enabled + remote enabled -> scheduler starts, and calling start() again does not create a duplicate timer', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_ENABLED: 'true', LICENSE_REMOTE_HEARTBEAT_INTERVAL_MS: '20', LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const activationStub = stubActivationFind([]); // مفيش activations - كفاية نثبت إن الـquery بتحصل فعلًا
    try {
      bootstrap.startLicenseHeartbeatScheduler();
      bootstrap.startLicenseHeartbeatScheduler();
      bootstrap.startLicenseHeartbeatScheduler();
      assert.equal(bootstrap.getLicenseHeartbeatScheduler().isRunning(), true);
      await waitMs(70);
      // لو فيه أكتر من timer شغال، عدد الـcalls كان هيبقى مضاعف بوضوح
      // (~3x). هنا بنتأكد إن العدد معقول لـtimer واحد بس.
      assert.ok(activationStub.calls.length >= 1 && activationStub.calls.length <= 6, `expected roughly one timer's worth of calls, got ${activationStub.calls.length}`);
    } finally {
      activationStub.restore();
    }
  }));

test('bootstrap: getLicenseHeartbeatScheduler() always returns the same instance (lazy singleton)', () => {
  const a = bootstrap.getLicenseHeartbeatScheduler();
  const b = bootstrap.getLicenseHeartbeatScheduler();
  assert.equal(a, b);
});

// ---------- 5: database readiness (mongoose buffering pattern, not a new mechanism) ----------

test('bootstrap: does not open a new/separate Mongo connection (relies on the existing mongoose connection)', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteHeartbeatBootstrap.js'), 'utf8');
  assert.ok(!/mongoose\.connect\(/.test(source));
  assert.ok(!/require\(['"]\.\.\/\.\.\/config\/db['"]\)/.test(source));
});

// ---------- 6/7: scheduler stop() during graceful shutdown does not crash ----------

test('bootstrap: stopLicenseHeartbeatScheduler() is safe to call even if the scheduler was never started', () => {
  assert.doesNotThrow(() => bootstrap.stopLicenseHeartbeatScheduler());
});

test('bootstrap: stopLicenseHeartbeatScheduler() stops a running scheduler and prevents further ticks', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_ENABLED: 'true', LICENSE_REMOTE_HEARTBEAT_INTERVAL_MS: '20', LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const activationStub = stubActivationFind([]);
    try {
      bootstrap.startLicenseHeartbeatScheduler();
      await waitMs(45);
      bootstrap.stopLicenseHeartbeatScheduler();
      assert.equal(bootstrap.getLicenseHeartbeatScheduler().isRunning(), false);
      const countAfterStop = activationStub.calls.length;
      await waitMs(60);
      assert.equal(activationStub.calls.length, countAfterStop, 'no further discovery calls after stop()');
    } finally {
      activationStub.restore();
    }
  }));

test('bootstrap: repeated stop() calls do not throw (idempotent, safe for double shutdown signals)', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_ENABLED: 'true', LICENSE_REMOTE_HEARTBEAT_INTERVAL_MS: '1000', LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    bootstrap.startLicenseHeartbeatScheduler();
    assert.doesNotThrow(() => {
      bootstrap.stopLicenseHeartbeatScheduler();
      bootstrap.stopLicenseHeartbeatScheduler();
    });
  }));

// ---------- 8: no license enforcement occurs ----------

test('bootstrap end-to-end: a "revoked" heartbeat result never blocks/throws at the bootstrap level and never touches local License/LicenseActivation', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_ENABLED: 'true', LICENSE_REMOTE_HEARTBEAT_INTERVAL_MS: '20', LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const activationStub = stubActivationFind([{ licenseId: 'LIC-REVOKED', activationId: 'ACT-1' }]);
    const remoteState = stubRemoteStatePersist();
    const localWrites = stubLocalWrites();
    remoteClient.setRemoteTransport(mockTransportWithStatus({ privateKey, status: 'revoked' }));

    try {
      bootstrap.startLicenseHeartbeatScheduler();
      await waitMs(60);
      // الـheartbeat اتنفذ فعليًا (الإمضاء صح) وremote state اتحدثت لـ
      // 'revoked' - لكن مفيش أي throw/crash/block حصل على مستوى الـ
      // bootstrap/scheduler، ومفيش أي local write خالص.
      assert.ok(remoteState.calls.length >= 1);
      assert.equal(remoteState.calls[0].update.$set.status, 'revoked');
      assert.deepEqual(localWrites.calls, [], 'no local License/LicenseActivation write must ever happen from a heartbeat result');
      assert.equal(bootstrap.getLicenseHeartbeatScheduler().isRunning(), true, 'scheduler keeps running normally after a revoked result - no enforcement/shutdown');
    } finally {
      activationStub.restore();
      remoteState.restore();
      localWrites.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

// ---------- failure isolation across activations ----------

test('bootstrap end-to-end: one activation failing does not stop others, and the scheduler stays alive', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_ENABLED: 'true', LICENSE_REMOTE_HEARTBEAT_INTERVAL_MS: '30', LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const activationStub = stubActivationFind([
      { licenseId: 'LIC-FAIL', activationId: 'ACT-FAIL' },
      { licenseId: 'LIC-OK', activationId: 'ACT-OK' },
    ]);
    const remoteState = stubRemoteStatePersist();

    remoteClient.setRemoteTransport(async ({ payload }) => {
      if (payload.licenseId === 'LIC-FAIL') {
        throw new Error('simulated transport failure for this activation only');
      }
      return mockTransportWithStatus({ privateKey, status: 'active' })({ payload });
    });

    try {
      bootstrap.startLicenseHeartbeatScheduler();
      await waitMs(60);
      const okStateCalls = remoteState.calls.filter((c) => c.filter.licenseId === 'LIC-OK');
      assert.ok(okStateCalls.length >= 1, 'the healthy activation must still succeed despite the other one failing');
      assert.equal(bootstrap.getLicenseHeartbeatScheduler().isRunning(), true, 'the scheduler/application must not crash from one activation failing');
    } finally {
      activationStub.restore();
      remoteState.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

// ---------- safety sweep ----------

test('licenseRemoteHeartbeatBootstrap.js: no HTTP client libraries, no real fetch/axios/https, no Redis, no process.exit', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteHeartbeatBootstrap.js'), 'utf8');
  assert.ok(!/require\(['"]axios['"]\)/.test(source));
  assert.ok(!/\bfetch\(/.test(source));
  assert.ok(!/new\s+Redis\s*\(/i.test(source));
  // فحص process.exit() الفعلي بس - مش أي ذكر ليها جوه تعليق يوضح إنها
  // مش موجودة (زي "مفيش process.exit() هنا خالص").
  const codeLines = source.split('\n').filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
  });
  assert.ok(!codeLines.some((line) => /process\.exit\(/.test(line)));
});

test('server.js: wires the heartbeat scheduler start/stop without adding a new SIGINT/SIGTERM handler pair', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(source, /licenseRemoteHeartbeatBootstrap/);
  assert.match(source, /startLicenseHeartbeatScheduler/);
  assert.match(source, /stopLicenseHeartbeatScheduler/);
  // مفيش process.on('SIGTERM'/'SIGINT') إضافي - نفس الاتنين الموجودين بس.
  const sigtermCount = (source.match(/process\.on\('SIGTERM'/g) || []).length;
  const sigintCount = (source.match(/process\.on\('SIGINT'/g) || []).length;
  assert.equal(sigtermCount, 1);
  assert.equal(sigintCount, 1);
});