const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const orchestrator = require(path.join(root, 'services/license/licenseRemoteOrchestrator.js'));
const remoteClient = require(path.join(root, 'services/license/licenseRemoteClient.js'));
const signatureService = require(path.join(root, 'services/license/licenseRemoteSignatureService.js'));
const protocol = require(path.join(root, 'services/license/licenseRemoteProtocol.js'));
const License = require(path.join(root, 'models/License.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const LicenseInstallation = require(path.join(root, 'models/LicenseInstallation.js'));
const LicenseRemoteState = require(path.join(root, 'models/LicenseRemoteState.js'));
// captured once at module load, before any test stubs it - lets
// stubRemoteStatePersist() detect "nobody already overrode findOne for
// this test" without clobbering a test-specific findOne stub set up
// beforehand (see PART 7-F test below).
const REAL_LICENSE_REMOTE_STATE_FIND_ONE = LicenseRemoteState.findOne;
const { _resetCacheForTests } = require(path.join(root, 'services/license/installationIdService.js'));
const {
  RemoteLicenseUnavailableError,
  RemoteSignatureInvalidError,
  RemoteResponseInvalidError,
} = require(path.join(root, 'services/license/licenseErrors.js'));

// ============================================================
// PART 2B-2A - Remote License Orchestration tests.
// مفيش أي HTTP request حقيقي هنا - transport دايمًا mocked/injected، وكل
// DB access (LicenseInstallation/LicenseRemoteState) بيتعمله stub زي نفس
// pattern الملفات التانية (licensePartB.test.js إلخ) - مفيش Mongo حقيقي.
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

/** بيعمل stub لـLicenseInstallation.findOneAndUpdate عشان createFingerprint متحتجش Mongo حقيقي. */
function stubInstallation() {
  const original = LicenseInstallation.findOneAndUpdate;
  LicenseInstallation.findOneAndUpdate = async () => ({ installationId: 'INSTALL-TEST-FIXED' });
  _resetCacheForTests();
  return () => {
    LicenseInstallation.findOneAndUpdate = original;
    _resetCacheForTests();
  };
}

/** بيعمل stub لـLicenseRemoteState.findOneAndUpdate وبيسجل كل الـcalls. */
function stubRemoteStatePersist() {
  const calls = [];
  const original = LicenseRemoteState.findOneAndUpdate;
  // STEP 5 SAFETY FIX (PART 2B-2C-4): saveSuccessfulRemoteState() بقت بتعمل
  // findOne() الأول (stale-write guard) قبل الـupsert. لو حد مستدعي الدالة
  // دي عمل stub لـfindOne بنفسه قبل كده (زي تست PART 7-F تحت)، بنسيبه زي
  // ما هو ومنكسرهوش - بنستبدل بس لو لسه الـmethod الحقيقية (مفيش stub
  // مسبق).
  const findOneAlreadyStubbed = LicenseRemoteState.findOne !== REAL_LICENSE_REMOTE_STATE_FIND_ONE;
  const originalFindOne = LicenseRemoteState.findOne;
  if (!findOneAlreadyStubbed) {
    LicenseRemoteState.findOne = () => ({ lean: async () => null });
  }
  LicenseRemoteState.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
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

/** بيسجّل كل الكتابات المحلية (License/LicenseActivation) - المفروض تفضل صفر طول أي remote flow. */
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

// ---------- PART 2: remote activation ----------

test('remoteActivateLicense: remote disabled -> RemoteLicenseUnavailableError, no transport call, no local/installation DB work', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
    let transportCalls = 0;
    remoteClient.setRemoteTransport(async () => {
      transportCalls += 1;
      return {};
    });
    const localWrites = stubLocalWrites();
    let installationCalls = 0;
    const originalInstall = LicenseInstallation.findOneAndUpdate;
    LicenseInstallation.findOneAndUpdate = async (...args) => {
      installationCalls += 1;
      return originalInstall.apply(LicenseInstallation, args);
    };
    try {
      await assert.rejects(
        () => orchestrator.remoteActivateLicense({ licenseId: 'LIC-1', domain: 'shop.com' }),
        RemoteLicenseUnavailableError
      );
      assert.equal(transportCalls, 0);
      assert.equal(installationCalls, 0, 'must short-circuit before doing any local fingerprint/DB work');
      assert.deepEqual(localWrites.calls, []);
    } finally {
      remoteClient._resetTransportForTests();
      LicenseInstallation.findOneAndUpdate = originalInstall;
      localWrites.restore();
    }
  }));

test('remoteActivateLicense: missing licenseId/domain throws before any remote/DB work', async () => {
  await assert.rejects(() => orchestrator.remoteActivateLicense({ domain: 'shop.com' }));
  await assert.rejects(() => orchestrator.remoteActivateLicense({ licenseId: 'LIC-1' }));
});

test('remoteActivateLicense: a fully valid signed response is verified and persisted as trusted remote state', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;

    const restoreInstall = stubInstallation();
    const remoteState = stubRemoteStatePersist();
    const localWrites = stubLocalWrites();

    remoteClient.setRemoteTransport(async ({ payload }) => {
      const timestamp = new Date().toISOString();
      const data = { licenseId: 'LIC-1', status: 'active', maxActivations: 5 };
      const signature = signEnvelopeFields({
        privateKey,
        operation: protocol.REMOTE_OPERATIONS.ACTIVATE,
        requestId: payload.requestId,
        timestamp,
        success: true,
        code: 'OK',
        data,
      });
      return {
        protocolVersion: '1',
        operation: protocol.REMOTE_OPERATIONS.ACTIVATE,
        requestId: payload.requestId,
        timestamp,
        success: true,
        code: 'OK',
        message: 'activated',
        data,
        signature,
      };
    });

    try {
      const result = await orchestrator.remoteActivateLicense({ licenseId: 'LIC-1', domain: 'shop.com' });
      assert.equal(result.success, true);
      assert.equal(result.code, 'OK');
      assert.equal(result.data.licenseId, 'LIC-1');
      assert.equal(result.data.status, 'active');

      assert.equal(remoteState.calls.length, 1, 'trusted remote state must be persisted exactly once');
      assert.equal(remoteState.calls[0].filter.licenseId, 'LIC-1');
      assert.equal(remoteState.calls[0].update.$set.status, 'active');

      // PART 5: local License/LicenseActivation must never be touched by a remote flow.
      assert.deepEqual(localWrites.calls, []);
    } finally {
      remoteClient._resetTransportForTests();
      restoreInstall();
      remoteState.restore();
      localWrites.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

// ---------- PART 3: remote validation (separate from local) ----------

test('remoteValidateLicense: does not call/replace licenseService.validateLocalLicense', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteOrchestrator.js'), 'utf8');
  // مسموح إن التعليقات توضّح إن الدالة دي منفصلة عن validateLocalLicense
  // (توضيح architecture)، الممنوع فعليًا هو استدعاؤها كـfunction call.
  assert.ok(!/validateLocalLicense\s*\(/.test(source), 'must not call validateLocalLicense()');
});

test('remoteValidateLicense: remote disabled -> RemoteLicenseUnavailableError, no transport call', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
    let transportCalls = 0;
    remoteClient.setRemoteTransport(async () => {
      transportCalls += 1;
      return {};
    });
    try {
      await assert.rejects(() => orchestrator.remoteValidateLicense({ licenseId: 'LIC-1' }), RemoteLicenseUnavailableError);
      assert.equal(transportCalls, 0);
    } finally {
      remoteClient._resetTransportForTests();
    }
  }));

test('remoteValidateLicense: a valid signed response is accepted and persisted', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem, privateKey } = generateTestKeyPair();
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const remoteState = stubRemoteStatePersist();

    remoteClient.setRemoteTransport(async ({ payload }) => {
      const timestamp = new Date().toISOString();
      const data = { licenseId: 'LIC-2', status: 'active' };
      const signature = signEnvelopeFields({ privateKey, operation: protocol.REMOTE_OPERATIONS.VALIDATE, requestId: payload.requestId, timestamp, success: true, code: 'OK', data });
      return { protocolVersion: '1', operation: protocol.REMOTE_OPERATIONS.VALIDATE, requestId: payload.requestId, timestamp, success: true, code: 'OK', message: 'ok', data, signature };
    });

    try {
      const result = await orchestrator.remoteValidateLicense({ licenseId: 'LIC-2' });
      assert.equal(result.success, true);
      assert.equal(remoteState.calls.length, 1);
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

// ---------- PART 6/7 (D/E/F): invalid/malformed responses never update trusted state ----------

test('remoteValidateLicense: an invalid signature is rejected, and no trusted remote state is persisted', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const { publicKeyPem } = generateTestKeyPair();
    const { privateKey: wrongPrivateKey } = generateTestKeyPair(); // different keypair -> signature won't verify
    process.env.LICENSE_SERVER_PUBLIC_KEY = publicKeyPem;
    const remoteState = stubRemoteStatePersist();

    remoteClient.setRemoteTransport(async ({ payload }) => {
      const timestamp = new Date().toISOString();
      const data = { licenseId: 'LIC-3', status: 'active' };
      const signature = signEnvelopeFields({ privateKey: wrongPrivateKey, operation: protocol.REMOTE_OPERATIONS.VALIDATE, requestId: payload.requestId, timestamp, success: true, code: 'OK', data });
      return { protocolVersion: '1', operation: protocol.REMOTE_OPERATIONS.VALIDATE, requestId: payload.requestId, timestamp, success: true, code: 'OK', message: 'ok', data, signature };
    });

    try {
      await assert.rejects(() => orchestrator.remoteValidateLicense({ licenseId: 'LIC-3' }), RemoteSignatureInvalidError);
      assert.equal(remoteState.calls.length, 0, 'an invalid signature must never update the trusted remote state');
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
      delete process.env.LICENSE_SERVER_PUBLIC_KEY;
    }
  }));

test('remoteValidateLicense: a malformed response is rejected, and no trusted remote state is persisted', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const remoteState = stubRemoteStatePersist();
    remoteClient.setRemoteTransport(async () => ({ not: 'a valid envelope' }));

    try {
      await assert.rejects(() => orchestrator.remoteValidateLicense({ licenseId: 'LIC-4' }), RemoteResponseInvalidError);
      assert.equal(remoteState.calls.length, 0);
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
    }
  }));

test('remoteValidateLicense: an old trusted state remains unchanged after a later invalid response (PART 7-F)', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    const originalFindOne = LicenseRemoteState.findOne;
    const existingTrustedState = { licenseId: 'LIC-5', status: 'active', lastSuccessfulValidationAt: new Date() };
    LicenseRemoteState.findOne = () => ({ lean: async () => existingTrustedState });
    const remoteState = stubRemoteStatePersist();
    remoteClient.setRemoteTransport(async () => ({ malformed: true }));

    try {
      await assert.rejects(() => orchestrator.remoteValidateLicense({ licenseId: 'LIC-5' }));
      assert.equal(remoteState.calls.length, 0);

      const usability = await orchestrator.evaluateRemoteUsability('LIC-5');
      assert.equal(usability.state, existingTrustedState, 'the old trusted state must still be what evaluateRemoteUsability sees');
    } finally {
      remoteClient._resetTransportForTests();
      remoteState.restore();
      LicenseRemoteState.findOne = originalFindOne;
    }
  }));

// ---------- PART 7: grace period (reuse, not reinvent) ----------

test('evaluateRemoteUsability: delegates to licenseRemoteStateService.getRemoteLicenseUsability (same fresh/grace policy)', async () => {
  const original = LicenseRemoteState.findOne;
  const state = { licenseId: 'LIC-6', lastSuccessfulValidationAt: new Date(Date.now() - 5000) };
  LicenseRemoteState.findOne = () => ({ lean: async () => state });
  try {
    const usability = await orchestrator.evaluateRemoteUsability('LIC-6');
    assert.equal(usability.bucket, 'fresh');
    assert.equal(usability.requiresRemoteValidation, false);
  } finally {
    LicenseRemoteState.findOne = original;
  }
});

test('licenseRemoteOrchestrator: does not define its own grace-period/freshness constants (reuses licenseRemoteStateService)', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteOrchestrator.js'), 'utf8');
  assert.ok(!/GRACE_PERIOD_HOURS\s*=/.test(source));
  assert.ok(!/FRESH_WINDOW/.test(source));
});

// ---------- PART 8: remote status mapping ----------

test('interpretRemoteLicenseState: active status with success -> usable', () => {
  const result = orchestrator.interpretRemoteLicenseState({ success: true, code: 'OK', data: { status: 'active' } });
  assert.deepEqual(result, { usable: true, status: 'active', code: 'OK' });
});

for (const status of ['expired', 'revoked', 'suspended', 'invalid']) {
  test(`interpretRemoteLicenseState: ${status} status -> not usable`, () => {
    const result = orchestrator.interpretRemoteLicenseState({ success: true, code: 'OK', data: { status } });
    assert.equal(result.usable, false);
    assert.equal(result.status, status);
  });
}

test('interpretRemoteLicenseState: success:false -> not usable regardless of data', () => {
  const result = orchestrator.interpretRemoteLicenseState({ success: false, code: 'SOME_ERROR', data: { status: 'active' } });
  assert.equal(result.usable, false);
  assert.equal(result.status, 'invalid');
  assert.equal(result.code, 'SOME_ERROR');
});

test('interpretRemoteLicenseState: an unknown/unexpected status value falls back to invalid (fail-closed)', () => {
  const result = orchestrator.interpretRemoteLicenseState({ success: true, code: 'OK', data: { status: 'something-new-the-server-invented' } });
  assert.equal(result.usable, false);
  assert.equal(result.status, 'invalid');
});

test('interpretRemoteLicenseState: null/missing input is handled safely', () => {
  assert.deepEqual(orchestrator.interpretRemoteLicenseState(null), { usable: false, status: 'invalid', code: null });
  assert.deepEqual(orchestrator.interpretRemoteLicenseState(undefined), { usable: false, status: 'invalid', code: null });
});

test("interpretRemoteLicenseState: never reads 'message' to decide usability", () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteOrchestrator.js'), 'utf8');
  assert.ok(!/\.message\b/.test(source), 'orchestrator must never key a decision off .message');
});

// ---------- heartbeat / deactivate ----------

test('remoteHeartbeat: missing activationId throws before any remote call', async () => {
  await assert.rejects(() => orchestrator.remoteHeartbeat({ licenseId: 'LIC-1' }));
});

test('remoteDeactivate: missing activationId throws before any remote call', async () => {
  await assert.rejects(() => orchestrator.remoteDeactivate({ licenseId: 'LIC-1' }));
});

test('remoteHeartbeat: remote disabled -> RemoteLicenseUnavailableError, no transport call', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
    let calls = 0;
    remoteClient.setRemoteTransport(async () => {
      calls += 1;
      return {};
    });
    try {
      await assert.rejects(() => orchestrator.remoteHeartbeat({ licenseId: 'LIC-1', activationId: 'ACT-1' }), RemoteLicenseUnavailableError);
      assert.equal(calls, 0);
    } finally {
      remoteClient._resetTransportForTests();
    }
  }));

test('remoteDeactivate: remote disabled -> RemoteLicenseUnavailableError, no transport call, no local LicenseActivation write', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false' }, async () => {
    const localWrites = stubLocalWrites();
    remoteClient.setRemoteTransport(async () => ({}));
    try {
      await assert.rejects(() => orchestrator.remoteDeactivate({ licenseId: 'LIC-1', activationId: 'ACT-1' }), RemoteLicenseUnavailableError);
      assert.deepEqual(localWrites.calls, [], 'remote deactivate must never touch local LicenseActivation (PART 8 backward compatibility)');
    } finally {
      remoteClient._resetTransportForTests();
      localWrites.restore();
    }
  }));

// ---------- safety sweep ----------

test('licenseRemoteOrchestrator.js: no HTTP client libraries, no real fetch/axios/https, no Redis', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteOrchestrator.js'), 'utf8');
  assert.ok(!/require\(['"]axios['"]\)/.test(source));
  assert.ok(!/require\(['"]node-fetch['"]\)/.test(source));
  assert.ok(!/require\(['"]https?['"]\)/.test(source));
  assert.ok(!/\bfetch\(/.test(source));
  assert.ok(!/new\s+Redis\s*\(/i.test(source));
});

test('licenseRemoteOrchestrator.js: never logs payloads/signatures/keys', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteOrchestrator.js'), 'utf8');
  assert.ok(!/console\.(log|error|warn|info)\(/.test(source));
});

test('integration boundary: no global license middleware/route wiring was introduced by this orchestration layer', () => {
  const fs = require('node:fs');
  const middlewareSource = fs.readFileSync(path.join(root, 'middleware/licenseMiddleware.js'), 'utf8');
  assert.ok(!/require\(.*licenseRemoteOrchestrator/.test(middlewareSource));
  assert.ok(!/app\.use\(\s*requireValidLicense/.test(middlewareSource));

  const serviceSource = fs.readFileSync(path.join(root, 'services/license/licenseService.js'), 'utf8');
  assert.ok(!/require\(.*licenseRemoteOrchestrator/.test(serviceSource), 'licenseService.js must not be wired to the orchestrator yet');
});