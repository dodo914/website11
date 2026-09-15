const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const LicenseRemoteState = require(path.join(root, 'models/LicenseRemoteState.js'));
const remoteConfig = require(path.join(root, 'services/license/licenseRemoteConfig.js'));
const remoteClient = require(path.join(root, 'services/license/licenseRemoteClient.js'));
const { normalizeRemoteLicenseResponse } = require(path.join(root, 'services/license/licenseRemoteResponse.js'));
const remoteStateService = require(path.join(root, 'services/license/licenseRemoteStateService.js'));
const { RemoteLicenseUnavailableError } = require(path.join(root, 'services/license/licenseErrors.js'));

// ============================================================
// PART 2A - Remote License Architecture foundation tests.
// مفيش أي HTTP request حقيقي في أي تست هنا - transport دايمًا mocked أو
// مش محقون خالص (الحالة الافتراضية).
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

// ---------- 1: remote disabled -> no remote communication at all ----------

test('licenseRemoteClient: when LICENSE_REMOTE_ENABLED is false, no transport is ever invoked', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false', LICENSE_SERVER_URL: 'https://license.example.com' }, async () => {
    let transportCalls = 0;
    remoteClient.setRemoteTransport(async () => {
      transportCalls += 1;
      return {};
    });
    try {
      await assert.rejects(
        () => remoteClient.activateRemoteLicense({ licenseId: 'LIC-1', domain: 'shop.com' }),
        RemoteLicenseUnavailableError
      );
      await assert.rejects(() => remoteClient.validateRemoteLicense({ licenseId: 'LIC-1' }), RemoteLicenseUnavailableError);
      await assert.rejects(() => remoteClient.heartbeatRemoteLicense({ licenseId: 'LIC-1', activationId: 'A' }), RemoteLicenseUnavailableError);
      await assert.rejects(() => remoteClient.deactivateRemoteLicense({ licenseId: 'LIC-1', activationId: 'A' }), RemoteLicenseUnavailableError);
      assert.equal(transportCalls, 0, 'the injected transport must never be called while remote is disabled');
    } finally {
      remoteClient._resetTransportForTests();
    }
  }));

// ---------- 2: missing LICENSE_SERVER_URL with remote disabled -> runs normally ----------

test('licenseRemoteConfig: missing LICENSE_SERVER_URL with remote disabled does not throw and reports "not configured"', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'false', LICENSE_SERVER_URL: undefined }, () => {
    assert.doesNotThrow(() => remoteConfig.getRemoteServerUrl());
    assert.equal(remoteConfig.getRemoteServerUrl(), null);
    assert.equal(remoteConfig.isRemoteEnabled(), false);
    assert.equal(remoteConfig.isRemoteConfigured(), false);
  }));

test('licenseRemoteClient: missing LICENSE_SERVER_URL even with remote enabled fails safely (misconfiguration), no crash', () =>
  withEnv({ LICENSE_REMOTE_ENABLED: 'true', LICENSE_SERVER_URL: undefined }, async () => {
    await assert.rejects(() => remoteClient.validateRemoteLicense({ licenseId: 'LIC-1' }), RemoteLicenseUnavailableError);
  }));

// ---------- 3 & 4: invalid configuration handled safely, safe timeout default ----------

test('licenseRemoteConfig: invalid/garbage LICENSE_REMOTE_TIMEOUT_MS falls back to the safe default', () =>
  withEnv({ LICENSE_REMOTE_TIMEOUT_MS: 'not-a-number' }, () => {
    assert.equal(remoteConfig.getRemoteTimeoutMs(), remoteConfig.DEFAULT_REMOTE_TIMEOUT_MS);
  }));

test('licenseRemoteConfig: a negative/zero LICENSE_REMOTE_TIMEOUT_MS falls back to the safe default', () =>
  withEnv({ LICENSE_REMOTE_TIMEOUT_MS: '-100' }, () => {
    assert.equal(remoteConfig.getRemoteTimeoutMs(), remoteConfig.DEFAULT_REMOTE_TIMEOUT_MS);
  }));

test('licenseRemoteConfig: missing LICENSE_REMOTE_TIMEOUT_MS uses the safe default', () =>
  withEnv({ LICENSE_REMOTE_TIMEOUT_MS: undefined }, () => {
    assert.equal(remoteConfig.getRemoteTimeoutMs(), remoteConfig.DEFAULT_REMOTE_TIMEOUT_MS);
    assert.equal(typeof remoteConfig.getRemoteTimeoutMs(), 'number');
    assert.ok(remoteConfig.getRemoteTimeoutMs() > 0);
  }));

test('licenseRemoteConfig: invalid/negative LICENSE_REMOTE_GRACE_PERIOD_HOURS falls back to the safe default', () =>
  withEnv({ LICENSE_REMOTE_GRACE_PERIOD_HOURS: 'oops' }, () => {
    assert.equal(remoteConfig.getRemoteGracePeriodHours(), remoteConfig.DEFAULT_REMOTE_GRACE_PERIOD_HOURS);
  }));

// ---------- 5: remote unavailable does NOT equal revoked ----------

test('licenseRemoteStateService: remote unavailable/stale never returns a "revoked" bucket or throws a revocation error', async () => {
  const neverValidated = remoteStateService.evaluateRemoteFreshness(null);
  assert.equal(neverValidated.bucket, remoteStateService.FRESHNESS_BUCKETS.NEVER_VALIDATED);
  assert.notEqual(neverValidated.bucket, 'revoked');

  const beyondGrace = remoteStateService.evaluateRemoteFreshness(
    { lastSuccessfulValidationAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) }, // 1 year ago
    new Date()
  );
  assert.equal(beyondGrace.bucket, remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE);
  assert.notEqual(beyondGrace.bucket, 'revoked');
  assert.equal(beyondGrace.requiresRemoteValidation, true);
});

test('licenseRemoteClient: RemoteLicenseUnavailableError is a distinct type from any local license-invalid/revoked error', () => {
  const err = new RemoteLicenseUnavailableError({ reason: 'transport_error', operation: 'validate' });
  assert.equal(err.code, 'REMOTE_LICENSE_UNAVAILABLE');
  assert.notEqual(err.code, 'LICENSE_REVOKED');
  assert.notEqual(err.code, 'INVALID_LICENSE');
});

// ---------- 6, 7, 8: fresh / stale-in-grace / expired-beyond-grace classification ----------

test('licenseRemoteStateService: a recently-validated state is classified as fresh and does not require re-validation', () =>
  withEnv({ LICENSE_CACHE_TTL: '300', LICENSE_REMOTE_GRACE_PERIOD_HOURS: '72' }, () => {
    const state = { licenseId: 'LIC-FRESH', lastSuccessfulValidationAt: new Date(Date.now() - 5_000) }; // 5s ago
    const result = remoteStateService.evaluateRemoteFreshness(state);
    assert.equal(result.bucket, remoteStateService.FRESHNESS_BUCKETS.FRESH);
    assert.equal(result.requiresRemoteValidation, false);
    assert.equal(result.state, state);
  }));

test('licenseRemoteStateService: a stale-but-within-grace state is still accepted (no forced validation)', () =>
  withEnv({ LICENSE_CACHE_TTL: '300', LICENSE_REMOTE_GRACE_PERIOD_HOURS: '72' }, () => {
    // 10 minutes old: past the 300s fresh window, well within the 72h grace window.
    const state = { licenseId: 'LIC-STALE', lastSuccessfulValidationAt: new Date(Date.now() - 10 * 60 * 1000) };
    const result = remoteStateService.evaluateRemoteFreshness(state);
    assert.equal(result.bucket, remoteStateService.FRESHNESS_BUCKETS.STALE_IN_GRACE);
    assert.equal(result.requiresRemoteValidation, false);
  }));

test('licenseRemoteStateService: a state older than the grace period is no longer considered valid, and reports REMOTE_VALIDATION_REQUIRED', () =>
  withEnv({ LICENSE_CACHE_TTL: '300', LICENSE_REMOTE_GRACE_PERIOD_HOURS: '1' }, async () => {
    const state = { licenseId: 'LIC-EXPIRED', lastSuccessfulValidationAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }; // 2h ago, grace=1h
    const result = remoteStateService.evaluateRemoteFreshness(state);
    assert.equal(result.bucket, remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE);
    assert.equal(result.requiresRemoteValidation, true);

    // getRemoteLicenseUsability() wraps this with the same classification + the required code.
    const restoreFindOne = (() => {
      const original = LicenseRemoteState.findOne;
      LicenseRemoteState.findOne = () => ({ lean: async () => state });
      return () => {
        LicenseRemoteState.findOne = original;
      };
    })();
    try {
      const usability = await remoteStateService.getRemoteLicenseUsability('LIC-EXPIRED');
      assert.equal(usability.code, 'REMOTE_VALIDATION_REQUIRED');
      assert.equal(usability.bucket, remoteStateService.FRESHNESS_BUCKETS.EXPIRED_BEYOND_GRACE);
    } finally {
      restoreFindOne();
    }
  }));

test('licenseRemoteStateService: no previous successful validation reports REMOTE_VALIDATION_REQUIRED too', async () => {
  const original = LicenseRemoteState.findOne;
  LicenseRemoteState.findOne = () => ({ lean: async () => null });
  try {
    const usability = await remoteStateService.getRemoteLicenseUsability('LIC-NEVER-SEEN');
    assert.equal(usability.bucket, remoteStateService.FRESHNESS_BUCKETS.NEVER_VALIDATED);
    assert.equal(usability.code, 'REMOTE_VALIDATION_REQUIRED');
  } finally {
    LicenseRemoteState.findOne = original;
  }
});

// ---------- normalization (Part C) ----------

test('normalizeRemoteLicenseResponse: builds the expected shape and drops unknown/extra fields', () => {
  const raw = {
    licenseId: 'LIC-1',
    status: 'active',
    expiresAt: '2030-01-01T00:00:00.000Z',
    allowedDomains: ['shop.com', 42, 'other.com'],
    maxActivations: '3',
    features: ['analytics', null],
    buildId: 'build-abc',
    activation: { activationId: 'ACT-1', status: 'active', secretApiKey: 'should-not-appear' },
    serverIssuedAt: '2025-01-01T00:00:00.000Z',
    responseVersion: 'v1',
    someUnexpectedSecretLookingField: 'sk_live_should_not_be_kept',
  };

  const normalized = normalizeRemoteLicenseResponse(raw);
  assert.equal(normalized.licenseId, 'LIC-1');
  assert.equal(normalized.status, 'active');
  assert.ok(normalized.expiresAt instanceof Date);
  assert.deepEqual(normalized.allowedDomains, ['shop.com', 'other.com']);
  assert.equal(normalized.maxActivations, 3);
  assert.deepEqual(normalized.features, ['analytics']);
  assert.equal(normalized.buildId, 'build-abc');
  assert.deepEqual(normalized.activation, { activationId: 'ACT-1', status: 'active' });
  assert.equal(normalized.responseVersion, 'v1');
  assert.ok(!('someUnexpectedSecretLookingField' in normalized));
  assert.ok(!('secretApiKey' in normalized.activation));
});

test('normalizeRemoteLicenseResponse: handles null/garbage input safely', () => {
  assert.equal(normalizeRemoteLicenseResponse(null), null);
  assert.equal(normalizeRemoteLicenseResponse('not an object'), null);
  const normalized = normalizeRemoteLicenseResponse({});
  assert.equal(normalized.licenseId, null);
  assert.equal(normalized.status, 'invalid');
  assert.deepEqual(normalized.allowedDomains, []);
});

// ---------- PART 2A review fix: maxActivations null must not become 0 ----------

test('normalizeRemoteLicenseResponse: maxActivations = null normalizes to null (not 0)', () => {
  const normalized = normalizeRemoteLicenseResponse({ licenseId: 'LIC-MA-1', maxActivations: null });
  assert.equal(normalized.maxActivations, null);
});

test('normalizeRemoteLicenseResponse: maxActivations = undefined normalizes to null', () => {
  const normalized = normalizeRemoteLicenseResponse({ licenseId: 'LIC-MA-2', maxActivations: undefined });
  assert.equal(normalized.maxActivations, null);
});

test('normalizeRemoteLicenseResponse: a valid maxActivations stays a number', () => {
  assert.equal(normalizeRemoteLicenseResponse({ licenseId: 'LIC-MA-3', maxActivations: 5 }).maxActivations, 5);
  assert.equal(normalizeRemoteLicenseResponse({ licenseId: 'LIC-MA-4', maxActivations: '3' }).maxActivations, 3);
  assert.equal(normalizeRemoteLicenseResponse({ licenseId: 'LIC-MA-5', maxActivations: 0 }).maxActivations, 0);
});

test('normalizeRemoteLicenseResponse: a negative maxActivations normalizes to null', () => {
  const normalized = normalizeRemoteLicenseResponse({ licenseId: 'LIC-MA-6', maxActivations: -1 });
  assert.equal(normalized.maxActivations, null);
});

// ---------- PART 2A review fix: safe Date normalization (expiresAt / serverIssuedAt) ----------

test('normalizeRemoteLicenseResponse: a valid expiresAt/serverIssuedAt normalizes to a real Date', () => {
  const normalized = normalizeRemoteLicenseResponse({
    licenseId: 'LIC-DATE-1',
    expiresAt: '2030-01-01T00:00:00.000Z',
    serverIssuedAt: '2025-06-01T00:00:00.000Z',
  });
  assert.ok(normalized.expiresAt instanceof Date && !Number.isNaN(normalized.expiresAt.getTime()));
  assert.ok(normalized.serverIssuedAt instanceof Date && !Number.isNaN(normalized.serverIssuedAt.getTime()));
});

test('normalizeRemoteLicenseResponse: an invalid expiresAt/serverIssuedAt normalizes to null, never an Invalid Date', () => {
  const normalized = normalizeRemoteLicenseResponse({
    licenseId: 'LIC-DATE-2',
    expiresAt: 'not-a-real-date',
    serverIssuedAt: 'also-garbage',
  });
  assert.equal(normalized.expiresAt, null);
  assert.equal(normalized.serverIssuedAt, null);
});

test('normalizeRemoteLicenseResponse: missing expiresAt/serverIssuedAt normalize to null', () => {
  const normalized = normalizeRemoteLicenseResponse({ licenseId: 'LIC-DATE-3' });
  assert.equal(normalized.expiresAt, null);
  assert.equal(normalized.serverIssuedAt, null);
});

// ---------- LicenseRemoteState persistence (Part D) ----------

test('LicenseRemoteState schema: has no secret-like fields and requires lastSuccessfulValidationAt', () => {
  const forbidden = ['password', 'apikey', 'secret', 'privatekey', 'signingkey'];
  const paths = Object.keys(LicenseRemoteState.schema.paths).map((p) => p.toLowerCase());
  for (const bad of forbidden) {
    assert.ok(!paths.some((p) => p.includes(bad)), `LicenseRemoteState must not have a field like "${bad}"`);
  }
  assert.ok(LicenseRemoteState.schema.paths.lastSuccessfulValidationAt.isRequired);
  assert.ok(LicenseRemoteState.schema.paths.licenseId.options.unique);
});

test('saveSuccessfulRemoteState: upserts atomically via findOneAndUpdate (no countDocuments/read-then-write)', async () => {
  const calls = [];
  const originalFindOne = LicenseRemoteState.findOne;
  const original = LicenseRemoteState.findOneAndUpdate;
  // STEP 5 SAFETY FIX (PART 2B-2C-4) added a stale-write guard that reads
  // the existing trusted state via findOne() before the upsert - stub it
  // too (no existing state -> stale check short-circuits, same as before).
  LicenseRemoteState.findOne = () => ({ lean: async () => null });
  LicenseRemoteState.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
    return { toObject: () => ({ licenseId: filter.licenseId, ...update.$set }) };
  };
  try {
    const result = await remoteStateService.saveSuccessfulRemoteState({ licenseId: 'LIC-SAVE-1', status: 'active' });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].filter, { licenseId: 'LIC-SAVE-1' });
    assert.equal(calls[0].options.upsert, true);
    assert.equal(result.licenseId, 'LIC-SAVE-1');
    assert.ok(result.lastSuccessfulValidationAt instanceof Date);
  } finally {
    LicenseRemoteState.findOneAndUpdate = original;
    LicenseRemoteState.findOne = originalFindOne;
  }
});

test('saveSuccessfulRemoteState: rejects a response with no licenseId (nothing to key the upsert on)', async () => {
  await assert.rejects(() => remoteStateService.saveSuccessfulRemoteState({ status: 'active' }));
});

// ---------- 9: no secrets logged ----------

test('licenseRemoteClient/licenseRemoteConfig/licenseRemoteStateService: source contains no console.log/console.error of payloads or headers', () => {
  for (const file of [
    'services/license/licenseRemoteClient.js',
    'services/license/licenseRemoteConfig.js',
    'services/license/licenseRemoteStateService.js',
    'services/license/licenseRemoteResponse.js',
  ]) {
    const source = read(file);
    assert.ok(!/console\.(log|error|warn|info)\(/.test(source), `${file} must not log anything (payloads/headers/secrets)`);
  }
});

test('RemoteLicenseUnavailableError.toSafeJSON(): never exposes internal reason/operation/details', () => {
  const err = new RemoteLicenseUnavailableError({ reason: 'transport_error', operation: 'activate', someInternalDetail: 'x' });
  const safe = err.toSafeJSON();
  assert.deepEqual(Object.keys(safe).sort(), ['code', 'message']);
  assert.ok(!JSON.stringify(safe).includes('transport_error'));
});

// ---------- 10: no real HTTP calls anywhere in the new foundation files ----------

test('remote foundation files: no HTTP client libraries and no real fetch/axios calls', () => {
  for (const file of [
    'services/license/licenseRemoteClient.js',
    'services/license/licenseRemoteConfig.js',
    'services/license/licenseRemoteStateService.js',
    'services/license/licenseRemoteResponse.js',
    'models/LicenseRemoteState.js',
  ]) {
    const source = read(file);
    assert.ok(!/require\(['"]axios['"]\)/.test(source));
    assert.ok(!/require\(['"]node-fetch['"]\)/.test(source));
    assert.ok(!/require\(['"]https?['"]\)/.test(source));
    assert.ok(!/\bfetch\(/.test(source));
    assert.ok(!/new\s+Redis\s*\(/i.test(source), 'must not introduce Redis');
  }
});

// ---------- 11 & 12 (partial - Integration boundary / Part H) ----------

test('integration boundary: licenseService.js is not modified to call the remote client (no LICENSE_SERVER_URL/remote wiring yet)', () => {
  const source = read('services/license/licenseService.js');
  assert.ok(!/require\(.*licenseRemoteClient/.test(source), 'licenseService.js must not import the remote client yet (PART 2A is foundation-only)');
  assert.ok(!/LICENSE_SERVER_URL/.test(source));
});

test('integration boundary: licenseMiddleware.js has no global remote-license enforcement wired in', () => {
  const source = read('middleware/licenseMiddleware.js');
  assert.ok(!/require\(.*licenseRemoteClient/.test(source));
  assert.ok(!/require\(.*licenseRemoteStateService/.test(source));
  assert.ok(!/app\.use\(\s*requireValidLicense/.test(source));
});