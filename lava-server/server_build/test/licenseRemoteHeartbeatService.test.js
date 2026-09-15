const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const heartbeatService = require(path.join(root, 'services/license/licenseRemoteHeartbeatService.js'));
const remoteClient = require(path.join(root, 'services/license/licenseRemoteClient.js'));
const signatureService = require(path.join(root, 'services/license/licenseRemoteSignatureService.js'));
const protocol = require(path.join(root, 'services/license/licenseRemoteProtocol.js'));
const License = require(path.join(root, 'models/License.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const LicenseRemoteState = require(path.join(root, 'models/LicenseRemoteState.js'));
const REAL_LICENSE_REMOTE_STATE_FIND_ONE = LicenseRemoteState.findOne;
const { RemoteLicenseUnavailableError } = require(path.join(root, 'services/license/licenseErrors.js'));

// ============================================================
// PART 2B-2B - Remote License Heartbeat Service tests.
// مفيش HTTP حقيقي هنا - transport دايمًا injected/mock، وأي DB write
// بيتعمله stub (زي نفس pattern licenseRemoteOrchestrator.test.js).
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

function generateTestKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return { publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }), privateKey };
}

function signEnvelopeFields({ privateKey, protocolVersion = '1', operation, requestId, timestamp, success, code, data }) {
  const payload = signatureService.buildCanonicalSigningPayload({ protocolVersion, operation, requestId, timestamp, success, code, data });
  return crypto.sign(null, payload, privateKey).toString('base64');
}

function stubRemoteStatePersist() {
  const calls = [];
  const original = LicenseRemoteState.findOneAndUpdate;
  // STEP 5 SAFETY FIX (PART 2B-2C-4): saveSuccessfulRemoteState() بقت بتعمل
  // findOne() الأول (stale-write guard) قبل الـupsert - لازم يتستبّب هنا
  // كمان، إلا لو حد استبدله بنفسه قبل كده (مفيش تعارض).
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
    activationCreate: LicenseActivation.create,
    activationFindOneAndUpdate: LicenseActivation.findOneAndUpdate,
  };
  License.updateOne = async (...args) => { calls.push(['License.updateOne', args]); return originals.licenseUpdateOne.apply(License, args); };
  License.findOneAndUpdate = async (...args) => { calls.push(['License.findOneAndUpdate', args]); return originals.licenseFindOneAndUpdate.apply(License, args); };
  LicenseActivation.create = async (...args) => { calls.push(['LicenseActivation.create', args]); return originals.activationCreate.apply(LicenseActivation, args); };
  LicenseActivation.findOneAndUpdate = async (...args) => { calls.push(['LicenseActivation.findOneAndUpdate', args]); return originals.activationFindOneAndUpdate.apply(LicenseActivation, args); };
  return {
    calls,
    restore: () => {
      License.updateOne = originals.licenseUpdateOne;
      License.findOneAndUpdate = originals.licenseFindOneAndUpdate;
      LicenseActivation.create = originals.activationCreate;
      LicenseActivation.findOneAndUpdate = originals.activationFindOneAndUpdate;
    },
  };
}

/** بيرجّع mock transport بيرد envelope موقّع صحيح بأي status محدد. */
function mockTransportWithStatus({ privateKey, status, success = true, code = 'OK' }) {
  return async ({ payload }) => {
    const timestamp = new Date().toISOString();
    const data = { licenseId: payload.licenseId, status };
    const signature = signEnvelopeFields({
      privateKey,
      operation: protocol.REMOTE_OPERATIONS.HEARTBEAT,
      requestId: payload.requestId,
      timestamp,
      success,
      code,
      data,
    });
    return {
      protocolVersion: '1',
      operation: protocol.REMOTE_OPERATIONS.HEARTBEAT,
      requestId: payload.requestId,
      timestamp,
      success,
      code,
      message: 'ok',
      data,
      signature,
    };
  };
}

test.beforeEach(() => {
  heartbeatService._resetLocksForTests();
});

// ---------- 1-3: basic guards ----------

test('sendHeartbeat: remote disabled -> RemoteLicenseUnavailableError, no transport call', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
    let calls = 0;
    remoteClient.setRemoteTransport(async () => { calls += 1; return {}; });
    try {
      await assert.rejects(() => heartbeatService.sendHeartbeat({ licenseId: 'LIC-1', activationId: 'ACT-1' }), RemoteLicenseUnavailableError);
      assert.equal(calls, 0);
    } finally {
      remoteClient._resetTransportForTests();
    }
  }));

test('sendHeartbeat: missing licenseId throws', async () => {
  await assert.rejects(() => heartbeatService.sendHeartbeat({ activationId: 'ACT-1' }));
});

test('sendHeartbeat: missing activationId throws', async () => {
  await assert.rejects(() => heartbeatService.sendHeartbeat({ licenseId: 'LIC-1' }));
});

// ---------- 4-9: status handling ----------

const STATUS_CASES = [
  { status: 'active', expectedUsable: true },
  { status: 'expired', expectedUsable: false },
  { status: 'revoked', expectedUsable: false },
  { status: 'suspended', expectedUsable: false },
  { status: 'invalid', expectedUsable: false },
  { status: 'something-the-server-invented', expectedUsable: false, expectedStatus: 'invalid' },
];

for (const { status, expectedUsable, expectedStatus } of STATUS_CASES) {
  test(`sendHeartbeat: remote status "${status}" -> usable=${expectedUsable}`, () =>
    withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
      const { publicKeyPem, privateKey } = generateTestKeyPair();
      process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
      const remoteState = stubRemoteStatePersist();

      remoteClient.setRemoteTransport(mockTransportWithStatus({ privateKey, status }));

      try {
        const result = await heartbeatService.sendHeartbeat({ licenseId: 'LIC-1', activationId: 'ACT-1' });
        assert.equal(result.success, true);
        assert.equal(result.usable, expectedUsable);
        assert.equal(result.status, expectedStatus || status);
        // كل الحالات دي (بما فيهم revoked/suspended/expired) نجحت في التحقق
        // من الإمضاء - يبقى trusted remote state لازم تتحدث (PART H) حتى
        // لو الترخيص نفسه مش usable (PART I: مفيش أي destructive action).
        assert.equal(remoteState.calls.length, 1);
      } finally {
        remoteClient._resetTransportForTests();
        remoteState.restore();
        delete process.env.LICENSE_SERVER_PUBLIC_KEY;
      }
    }));
}

// ---------- 10-13: failure handling ----------

test('sendHeartbeat: RemoteLicenseUnavailableError from transport propagates, no state change', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const remoteState = stubRemoteStatePersist();
    remoteClient.setRemoteTransport(async () => { throw new Error('network down'); });
    try {
      await assert.rejects(() => heartbeatService.sendHeartbeat({ licenseId: 'LIC-1', activationId: 'ACT-1' }), RemoteLicenseUnavailableError);
      assert.equal(remoteState.calls.length, 0);
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
    }
  }));

test('sendHeartbeat: invalid signature is rejected, no state change (PART G fail-closed)', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem } = generateTestKeyPair();
    const { privateKey: wrongKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const remoteState = stubRemoteStatePersist();

    remoteClient.setRemoteTransport(mockTransportWithStatus({ privateKey: wrongKey, status: 'active' }));

    try {
      await assert.rejects(() => heartbeatService.sendHeartbeat({ licenseId: 'LIC-1', activationId: 'ACT-1' }));
      assert.equal(remoteState.calls.length, 0);
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

test('sendHeartbeat: requestId mismatch is rejected, no state change', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const remoteState = stubRemoteStatePersist();

    remoteClient.setRemoteTransport(async ({ payload }) => {
      const timestamp = new Date().toISOString();
      const data = { licenseId: payload.licenseId, status: 'active' };
      const signature = signEnvelopeFields({ privateKey, operation: protocol.REMOTE_OPERATIONS.HEARTBEAT, requestId: 'A-DIFFERENT-REQUEST-ID', timestamp, success: true, code: 'OK', data });
      return { protocolVersion: '1', operation: protocol.REMOTE_OPERATIONS.HEARTBEAT, requestId: 'A-DIFFERENT-REQUEST-ID', timestamp, success: true, code: 'OK', message: 'ok', data, signature };
    });

    try {
      await assert.rejects(() => heartbeatService.sendHeartbeat({ licenseId: 'LIC-1', activationId: 'ACT-1' }));
      assert.equal(remoteState.calls.length, 0);
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

test('sendHeartbeat: malformed response is rejected, no state change', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const remoteState = stubRemoteStatePersist();
    remoteClient.setRemoteTransport(async () => ({ not: 'a valid envelope' }));
    try {
      await assert.rejects(() => heartbeatService.sendHeartbeat({ licenseId: 'LIC-1', activationId: 'ACT-1' }));
      assert.equal(remoteState.calls.length, 0);
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
    }
  }));

// ---------- 15-17: local state untouched, remote persisted only on success ----------

test('sendHeartbeat: local License and LicenseActivation are never touched (PART C)', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const localWrites = stubLocalWrites();
    const remoteState = stubRemoteStatePersist();

    remoteClient.setRemoteTransport(mockTransportWithStatus({ privateKey, status: 'revoked' }));

    try {
      const result = await heartbeatService.sendHeartbeat({ licenseId: 'LIC-1', activationId: 'ACT-1' });
      assert.equal(result.status, 'revoked');
      assert.equal(result.usable, false);
      assert.deepEqual(localWrites.calls, [], 'a revoked heartbeat must never touch local License/LicenseActivation directly');
    } finally {
      remoteClient._resetTransportForTests();
      localWrites.restore();
      remoteState.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

test('sendHeartbeat: trusted remote state is updated only after successful verification (success then failure sequence)', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const remoteState = stubRemoteStatePersist();

    // أول heartbeat: ناجح -> لازم يتخزن.
    remoteClient.setRemoteTransport(mockTransportWithStatus({ privateKey, status: 'active' }));
    await heartbeatService.sendHeartbeat({ licenseId: 'LIC-2', activationId: 'ACT-2' });
    assert.equal(remoteState.calls.length, 1);

    // تاني heartbeat: response ملخبط -> منعتبروش، والعداد مايزيدش.
    remoteClient.setRemoteTransport(async () => ({ malformed: true }));
    await assert.rejects(() => heartbeatService.sendHeartbeat({ licenseId: 'LIC-2', activationId: 'ACT-2' }));
    assert.equal(remoteState.calls.length, 1, 'a failed second heartbeat must not add another persisted state');

    remoteClient._resetTransportForTests();
    remoteState.restore();
    delete process.env.LICENSE_SERVER_PUBLIC_KEY;
  }));

// ---------- concurrency (PART J) ----------

test('sendHeartbeat: overlapping calls for the same activation are rejected (in-flight lock)', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const remoteState = stubRemoteStatePersist();

    let releaseTransport;
    const gate = new Promise((resolve) => { releaseTransport = resolve; });
    remoteClient.setRemoteTransport(async ({ payload }) => {
      await gate;
      const timestamp = new Date().toISOString();
      const data = { licenseId: payload.licenseId, status: 'active' };
      const signature = signEnvelopeFields({ privateKey, operation: protocol.REMOTE_OPERATIONS.HEARTBEAT, requestId: payload.requestId, timestamp, success: true, code: 'OK', data });
      return { protocolVersion: '1', operation: protocol.REMOTE_OPERATIONS.HEARTBEAT, requestId: payload.requestId, timestamp, success: true, code: 'OK', message: 'ok', data, signature };
    });

    try {
      const first = heartbeatService.sendHeartbeat({ licenseId: 'LIC-3', activationId: 'ACT-3' });
      // بمجرد ما أول heartbeat بدأ (قبل ما يخلص)، تاني نداء لنفس الـactivation لازم يترفض فورًا.
      assert.equal(heartbeatService.isHeartbeatInFlight('LIC-3', 'ACT-3'), true);
      await assert.rejects(() => heartbeatService.sendHeartbeat({ licenseId: 'LIC-3', activationId: 'ACT-3' }));

      releaseTransport();
      const result = await first;
      assert.equal(result.usable, true);
      assert.equal(heartbeatService.isHeartbeatInFlight('LIC-3', 'ACT-3'), false, 'lock must be released after completion');
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

test('sendHeartbeat: different activations do not block each other', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const remoteState = stubRemoteStatePersist();
    remoteClient.setRemoteTransport(mockTransportWithStatus({ privateKey, status: 'active' }));

    try {
      const [a, b] = await Promise.all([
        heartbeatService.sendHeartbeat({ licenseId: 'LIC-4', activationId: 'ACT-A' }),
        heartbeatService.sendHeartbeat({ licenseId: 'LIC-4', activationId: 'ACT-B' }),
      ]);
      assert.equal(a.usable, true);
      assert.equal(b.usable, true);
      assert.equal(remoteState.calls.length, 2);
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

test('sendHeartbeat: lock is released after a failed heartbeat, allowing a subsequent retry', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const remoteState = stubRemoteStatePersist();

    remoteClient.setRemoteTransport(async () => ({ malformed: true }));
    await assert.rejects(() => heartbeatService.sendHeartbeat({ licenseId: 'LIC-5', activationId: 'ACT-5' }));
    assert.equal(heartbeatService.isHeartbeatInFlight('LIC-5', 'ACT-5'), false);

    remoteClient.setRemoteTransport(mockTransportWithStatus({ privateKey, status: 'active' }));
    const result = await heartbeatService.sendHeartbeat({ licenseId: 'LIC-5', activationId: 'ACT-5' });
    assert.equal(result.usable, true);

    remoteClient._resetTransportForTests();
    remoteState.restore();
    delete process.env.LICENSE_SERVER_PUBLIC_KEY;
  }));

// ---------- interpretRemoteLicenseState reuse (PART B) ----------

test('sendHeartbeat: reuses licenseRemoteOrchestrator.interpretRemoteLicenseState (no duplicate status-mapping logic)', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteHeartbeatService.js'), 'utf8');
  assert.match(source, /interpretRemoteLicenseState/);
  assert.ok(!/'expired'.*'revoked'.*'suspended'/.test(source.replace(/\s/g, '')), 'must not redefine its own status enum/mapping');
});

// ---------- grace fallback wrapper ----------

test('sendHeartbeatWithGraceFallback: remote unavailable falls back to evaluateRemoteUsability instead of throwing', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
    const original = LicenseRemoteState.findOne;
    LicenseRemoteState.findOne = () => ({ lean: async () => null });
    try {
      const result = await heartbeatService.sendHeartbeatWithGraceFallback({ licenseId: 'LIC-6', activationId: 'ACT-6' });
      assert.equal(result.success, false);
      assert.equal(result.usedGrace, true);
      assert.equal(result.usable, false); // never validated -> not usable
    } finally {
      LicenseRemoteState.findOne = original;
    }
  }));

test('sendHeartbeatWithGraceFallback: stale-in-grace trusted state is still usable on remote failure', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
    const original = LicenseRemoteState.findOne;
    const staleButInGrace = { licenseId: 'LIC-7', status: 'active', lastSuccessfulValidationAt: new Date(Date.now() - 60 * 60 * 1000) };
    LicenseRemoteState.findOne = () => ({ lean: async () => staleButInGrace });
    try {
      const result = await heartbeatService.sendHeartbeatWithGraceFallback({ licenseId: 'LIC-7', activationId: 'ACT-7' });
      assert.equal(result.usedGrace, true);
      assert.equal(result.usable, true);
      assert.equal(result.status, 'active');
    } finally {
      LicenseRemoteState.findOne = original;
    }
  }));

// ---------- safety sweep ----------

test('licenseRemoteHeartbeatService.js: no HTTP client libraries, no real fetch/axios/https, no Redis', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteHeartbeatService.js'), 'utf8');
  assert.ok(!/require\(['"]axios['"]\)/.test(source));
  assert.ok(!/require\(['"]node-fetch['"]\)/.test(source));
  assert.ok(!/require\(['"]https?['"]\)/.test(source));
  assert.ok(!/\bfetch\(/.test(source));
  assert.ok(!/new\s+Redis\s*\(/i.test(source));
});