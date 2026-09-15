const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const { createFingerprint, normalizeDomain } = require(path.join(root, 'services/license/fingerprintService.js'));
const licenseCache = require(path.join(root, 'services/license/licenseCache.js'));
const { computeLicenseStatus, getActivation } = require(path.join(root, 'services/license/licenseService.js'));
const {
  InvalidLicenseError,
  LicenseExpiredError,
  LicenseRevokedError,
  LicenseSuspendedError,
  ActivationLimitError,
  LicenseError,
} = require(path.join(root, 'services/license/licenseErrors.js'));

// ============================================================
// ملحوظة: زي test/licenseFoundation.test.js، التست دول بيشتغلوا من غير
// اتصال حقيقي بـMongoDB - بيستخدموا الـpure functions (computeLicenseStatus)
// والـmodules المستقلة (fingerprintService/licenseCache) مباشرة، وبيعملوا
// source-inspection حيث الفانكشن محتاجة DB فعلي (زي باقي الـsuite الحالي).
// ============================================================

// ---------- 1/2/3: Fingerprint ----------

test('fingerprintService: same installation inputs produce the same fingerprint', () => {
  const input = { licenseId: 'LIC-1', buildId: 'BUILD-1', installationId: 'INST-1', domain: 'Example.com' };
  const a = createFingerprint(input);
  const b = createFingerprint({ ...input });
  assert.equal(a, b);
});

test('fingerprintService: different domain produces a different fingerprint', () => {
  const base = { licenseId: 'LIC-1', buildId: 'BUILD-1', installationId: 'INST-1' };
  const a = createFingerprint({ ...base, domain: 'shop-a.com' });
  const b = createFingerprint({ ...base, domain: 'shop-b.com' });
  assert.notEqual(a, b);
});

test('fingerprintService: different installationId produces a different fingerprint (same license/domain)', () => {
  const base = { licenseId: 'LIC-1', buildId: 'BUILD-1', domain: 'example.com' };
  const a = createFingerprint({ ...base, installationId: 'INST-1' });
  const b = createFingerprint({ ...base, installationId: 'INST-2' });
  assert.notEqual(a, b);
});

test('fingerprintService: normalizes domain so http/https/www/trailing-slash variants match', () => {
  const base = { licenseId: 'LIC-1', buildId: 'BUILD-1', installationId: 'INST-1' };
  const variants = ['https://Example.com/', 'http://www.example.com', 'example.com', 'EXAMPLE.com/'];
  const results = variants.map((domain) => createFingerprint({ ...base, domain }));
  assert.ok(results.every((r) => r === results[0]));
});

test('fingerprintService: output is a 64-char hex SHA-256 digest (does not expose raw inputs)', () => {
  const digest = createFingerprint({ licenseId: 'LIC-1', buildId: 'BUILD-1', installationId: 'INST-1', domain: 'example.com' });
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.ok(!digest.includes('LIC-1'));
  assert.ok(!digest.includes('INST-1'));
});

test('fingerprintService: source never calls console.* (no logging of raw inputs)', () => {
  const source = read('services/license/fingerprintService.js');
  // Matches actual invocations only (console.log(...)) - not the word
  // "console.log" mentioned inside a comment explaining the rule.
  assert.ok(!/console\.(log|info|warn|error)\s*\(/.test(source), 'fingerprintService must not log anything');
});

test('normalizeDomain: strips protocol, www, trailing slash and port', () => {
  assert.equal(normalizeDomain('https://www.Example.com:443/'), 'example.com');
  assert.equal(normalizeDomain('example.com'), 'example.com');
  assert.equal(normalizeDomain(''), '');
});

// ---------- 4: Installation ID persistence ----------

test('installationIdService: persists via atomic upsert ($setOnInsert) and memoizes in-process (no repeated writes)', async () => {
  const installationIdServicePath = path.join(root, 'services/license/installationIdService.js');
  const source = fs.readFileSync(installationIdServicePath, 'utf8');
  // Storage must be MongoDB-backed (persists across restarts), atomic, and never Redis.
  assert.match(source, /findOneAndUpdate/);
  assert.match(source, /\$setOnInsert/);
  assert.match(source, /upsert:\s*true/);
  // Matches actual Redis usage only (require('ioredis')/require('redis')/
  // "new Redis(") - not the word "Redis" inside a comment explaining that
  // it's forbidden.
  assert.ok(!/require\(['"]i?oredis['"]\)|new\s+Redis\s*\(/i.test(source), 'installationIdService must not use Redis');

  // Functional: mock the model to prove getInstallationId() only hits the
  // "database" once per process (memoization) and returns a stable value.
  // (Reuse the already-loaded mongoose model instead of re-requiring the
  // file - mongoose keeps its own model registry, so re-requiring the
  // module would throw OverwriteModelError.)
  const LicenseInstallation = require(path.join(root, 'models/LicenseInstallation.js'));
  const originalFindOneAndUpdate = LicenseInstallation.findOneAndUpdate;

  let calls = 0;
  const fixedId = 'fixed-installation-id-123';
  LicenseInstallation.findOneAndUpdate = async () => {
    calls += 1;
    return { installationId: fixedId };
  };

  const { getInstallationId, _resetCacheForTests } = require(installationIdServicePath);
  _resetCacheForTests();

  const first = await getInstallationId();
  const second = await getInstallationId();
  const third = await getInstallationId();

  assert.equal(first, fixedId);
  assert.equal(first, second);
  assert.equal(second, third);
  assert.equal(calls, 1, 'the DB upsert should only be attempted once (memoized after that)');

  LicenseInstallation.findOneAndUpdate = originalFindOneAndUpdate;
  _resetCacheForTests();
});

// ---------- 5-9: License status / validation logic (pure) ----------

test('computeLicenseStatus: active license with no expiry stays active', () => {
  const result = computeLicenseStatus({ status: 'active', expiresAt: null });
  assert.equal(result.status, 'active');
});

test('computeLicenseStatus: active license with a future expiry stays active', () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const result = computeLicenseStatus({ status: 'active', expiresAt: future });
  assert.equal(result.status, 'active');
});

test('computeLicenseStatus: expired license (no grace period) is expired', () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const originalGrace = process.env.LICENSE_GRACE_PERIOD;
  delete process.env.LICENSE_GRACE_PERIOD;
  const result = computeLicenseStatus({ status: 'active', expiresAt: past });
  assert.equal(result.status, 'expired');
  if (originalGrace !== undefined) process.env.LICENSE_GRACE_PERIOD = originalGrace;
});

test('computeLicenseStatus: revoked license is revoked regardless of expiry', () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const result = computeLicenseStatus({ status: 'revoked', expiresAt: future });
  assert.equal(result.status, 'revoked');
});

test('computeLicenseStatus: suspended license is suspended regardless of expiry', () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const result = computeLicenseStatus({ status: 'suspended', expiresAt: future });
  assert.equal(result.status, 'suspended');
});

test('computeLicenseStatus: missing license is invalid', () => {
  const result = computeLicenseStatus(null);
  assert.equal(result.status, 'invalid');
});

test('computeLicenseStatus: expired license within LICENSE_GRACE_PERIOD days is grace_period', () => {
  const originalGrace = process.env.LICENSE_GRACE_PERIOD;
  process.env.LICENSE_GRACE_PERIOD = '7';
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000); // expired yesterday
  const result = computeLicenseStatus({ status: 'active', expiresAt: past });
  assert.equal(result.status, 'grace_period');
  assert.ok(result.graceEndsAt instanceof Date);
  if (originalGrace === undefined) delete process.env.LICENSE_GRACE_PERIOD;
  else process.env.LICENSE_GRACE_PERIOD = originalGrace;
});

test('computeLicenseStatus: expired beyond LICENSE_GRACE_PERIOD days is expired, not grace_period', () => {
  const originalGrace = process.env.LICENSE_GRACE_PERIOD;
  process.env.LICENSE_GRACE_PERIOD = '3';
  const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // expired 10 days ago
  const result = computeLicenseStatus({ status: 'active', expiresAt: past });
  assert.equal(result.status, 'expired');
  if (originalGrace === undefined) delete process.env.LICENSE_GRACE_PERIOD;
  else process.env.LICENSE_GRACE_PERIOD = originalGrace;
});

// ---------- 10: Cache read/write ----------

test('licenseCache: set then get returns the stored state', () => {
  licenseCache._clearAllForTests();
  const state = licenseCache.setCachedLicenseState('LIC-CACHE-1', { status: 'active', expiresAt: null });
  const fetched = licenseCache.getCachedLicenseState('LIC-CACHE-1');
  assert.equal(fetched.status, 'active');
  assert.equal(fetched, state);
});

test('licenseCache: getCachedLicenseState returns null for an unknown licenseId', () => {
  licenseCache._clearAllForTests();
  assert.equal(licenseCache.getCachedLicenseState('does-not-exist'), null);
});

test('licenseCache: clearCachedLicenseState removes the entry', () => {
  licenseCache._clearAllForTests();
  licenseCache.setCachedLicenseState('LIC-CACHE-2', { status: 'active' });
  licenseCache.clearCachedLicenseState('LIC-CACHE-2');
  assert.equal(licenseCache.getCachedLicenseState('LIC-CACHE-2'), null);
});

test('licenseCache: isCacheFresh respects TTL', () => {
  const freshEntry = { cachedAt: new Date() };
  const staleEntry = { cachedAt: new Date(Date.now() - 10_000) };
  assert.equal(licenseCache.isCacheFresh(freshEntry, 300), true);
  assert.equal(licenseCache.isCacheFresh(staleEntry, 5), false);
  assert.equal(licenseCache.isCacheFresh(null, 300), false);
});

// ---------- 11: activateLicense() makes no external HTTP request ----------

test('licenseService: activateLicense() source contains no external HTTP/network calls', () => {
  const source = read('services/license/licenseService.js');
  assert.ok(!/require\(['"]axios['"]\)/.test(source));
  assert.ok(!/require\(['"]node-fetch['"]\)/.test(source));
  assert.ok(!/require\(['"]https?['"]\)/.test(source));
  assert.ok(!/\bfetch\(/.test(source));
  assert.ok(!/\.request\(/.test(source));
  assert.ok(!/LICENSE_SERVER_URL/.test(source), 'PART 1B must not wire up LICENSE_SERVER_URL yet');
});

// ---------- 12: No secrets in returned objects / models ----------

test('LicenseActivation/License/LicenseEvent schemas expose no secret-like fields', () => {
  const License = require(path.join(root, 'models/License.js'));
  const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
  const LicenseEvent = require(path.join(root, 'models/LicenseEvent.js'));
  const forbidden = ['password', 'apikey', 'secret', 'privatekey', 'signingkey'];
  for (const Model of [License, LicenseActivation, LicenseEvent]) {
    const paths = Object.keys(Model.schema.paths).map((p) => p.toLowerCase());
    for (const bad of forbidden) {
      assert.ok(!paths.some((p) => p.includes(bad)), `${Model.modelName} must not have a field like "${bad}"`);
    }
  }
});

test('licenseErrors: safe error classes exist with codes and no raw internals in toSafeJSON()', () => {
  const err = new LicenseExpiredError({ licenseId: 'LIC-1' });
  assert.ok(err instanceof LicenseError);
  assert.ok(err instanceof Error);
  const safe = err.toSafeJSON();
  assert.deepEqual(Object.keys(safe).sort(), ['code', 'message']);
  assert.equal(safe.code, 'LICENSE_EXPIRED');
  assert.ok(!('stack' in safe));

  assert.equal(new InvalidLicenseError().code, 'INVALID_LICENSE');
  assert.equal(new LicenseRevokedError().code, 'LICENSE_REVOKED');
  assert.equal(new LicenseSuspendedError().code, 'LICENSE_SUSPENDED');
  assert.equal(new ActivationLimitError().code, 'ACTIVATION_LIMIT_REACHED');
});

test('licenseService: exposes the required abstraction functions', () => {
  const licenseService = require(path.join(root, 'services/license/licenseService.js'));
  for (const fn of [
    'getLocalLicenseState',
    'validateLocalLicense',
    'getLicenseStatus',
    'activateLicense',
    'getActivation',
    'createFingerprint',
    'recordLicenseEvent',
  ]) {
    assert.equal(typeof licenseService[fn], 'function', `licenseService.${fn} must be a function`);
  }
  assert.equal(typeof getActivation, 'function');
});