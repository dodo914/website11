const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const discovery = require(path.join(root, 'services/license/licenseRemoteActivationDiscovery.js'));
const LicenseActivation = require(path.join(root, 'models/LicenseActivation.js'));
const License = require(path.join(root, 'models/License.js'));

// ============================================================
// PART 2B-2C-1 - Activation Discovery tests.
// مفيش Mongo حقيقي هنا - LicenseActivation.find() بيتعمله stub زي نفس
// pattern باقي تستات الـlicense (licenseRemoteOrchestrator.test.js إلخ).
// ============================================================

/**
 * بيعمل stub لـLicenseActivation.find() يرجّع docs محددة، وبيسجل الـfilter
 * والـprojection اللي اتبعتوا فعليًا - عشان نتأكد إن الـquery bounded
 * (PART F) مش full scan.
 */
function stubFind(docs) {
  const calls = [];
  const original = LicenseActivation.find;
  LicenseActivation.find = (filter, projection) => {
    calls.push({ filter, projection });
    return {
      limit: () => ({
        lean: async () => docs,
      }),
    };
  };
  return { calls, restore: () => { LicenseActivation.find = original; } };
}

// ---------- 1: returns active eligible activations ----------

test('getEligibleActivationsForHeartbeat: returns active activations as {licenseId, activationId} only', async () => {
  const stub = stubFind([
    { licenseId: 'LIC-1', activationId: 'ACT-1' },
    { licenseId: 'LIC-2', activationId: 'ACT-2' },
  ]);
  try {
    const result = await discovery.getEligibleActivationsForHeartbeat();
    assert.deepEqual(result, [
      { licenseId: 'LIC-1', activationId: 'ACT-1' },
      { licenseId: 'LIC-2', activationId: 'ACT-2' },
    ]);
  } finally {
    stub.restore();
  }
});

// ---------- 2: empty array when none ----------

test('getEligibleActivationsForHeartbeat: returns [] when there are no activations at all', async () => {
  const stub = stubFind([]);
  try {
    const result = await discovery.getEligibleActivationsForHeartbeat();
    assert.deepEqual(result, []);
  } finally {
    stub.restore();
  }
});

// ---------- 3: does not return revoked activation ----------

test('getEligibleActivationsForHeartbeat: query is filtered to status "active" only (bounded, not a full scan)', async () => {
  const stub = stubFind([]); // المحتوى مش المهم هنا - المهم شكل الـfilter نفسه
  try {
    await discovery.getEligibleActivationsForHeartbeat();
    assert.equal(stub.calls.length, 1);
    assert.deepEqual(stub.calls[0].filter, { status: 'active' });
  } finally {
    stub.restore();
  }
});

test('getEligibleActivationsForHeartbeat: a revoked activation present in the DB is simply absent from the (already-filtered) result', async () => {
  // بما إن الـquery نفسها مفلترة على status:'active' (اتأكد في التست اللي
  // فات)، الـstub هنا بيمثّل الرد اللي الداتابيز كانت هترجعه فعليًا - يعني
  // activation الـrevoked أصلاً معندهاش تظهر في docs المرجعة.
  const stub = stubFind([{ licenseId: 'LIC-1', activationId: 'ACT-ACTIVE-ONLY' }]);
  try {
    const result = await discovery.getEligibleActivationsForHeartbeat();
    assert.equal(result.length, 1);
    assert.equal(result[0].activationId, 'ACT-ACTIVE-ONLY');
  } finally {
    stub.restore();
  }
});

// ---------- 4: handles missing data safely ----------

test('getEligibleActivationsForHeartbeat: does not throw when given partial/unexpected doc shapes', async () => {
  // ملحوظة: الـschema الحالي لـLicenseActivation بيحط licenseId/activationId
  // كـrequired+unique، فالحالة دي مش متوقعة عمليًا من بيانات حقيقية - التست
  // ده بيتأكد بس إن الدالة مش بتعمل throw/crash لو الشكل جه غير متوقع،
  // مش إنها بتعمل filtering إضافي (مفيش أي filtering زيادة في التنفيذ الحالي).
  const stub = stubFind([
    { licenseId: 'LIC-1', activationId: 'ACT-1' },
    { licenseId: null, activationId: 'ACT-BROKEN' },
  ]);
  try {
    await assert.doesNotReject(() => discovery.getEligibleActivationsForHeartbeat());
  } finally {
    stub.restore();
  }
});

// ---------- 5: does not expose sensitive fields ----------

test('getEligibleActivationsForHeartbeat: result objects never contain sensitive fields', async () => {
  // حتى لو الـDB (نظريًا/بالغلط) رجعت حقول زيادة، الدالة لازم ترجع
  // {licenseId, activationId} بس - مش أي حقل تاني موجود في الـdoc.
  const stub = stubFind([
    { licenseId: 'LIC-1', activationId: 'ACT-1', fingerprintHash: 'should-not-leak', domain: 'shop.com', installationId: 'should-not-exist' },
  ]);
  try {
    const [result] = await discovery.getEligibleActivationsForHeartbeat();
    assert.deepEqual(Object.keys(result).sort(), ['activationId', 'licenseId']);
  } finally {
    stub.restore();
  }
});

test('getEligibleActivationsForHeartbeat: projection explicitly excludes sensitive fields', async () => {
  const stub = stubFind([]);
  try {
    await discovery.getEligibleActivationsForHeartbeat();
    const projection = stub.calls[0].projection;
    assert.ok(projection.licenseId);
    assert.ok(projection.activationId);
    assert.equal(projection._id, 0);
    assert.ok(!('fingerprintHash' in projection));
    assert.ok(!('domain' in projection));
    assert.ok(!('installationId' in projection));
  } finally {
    stub.restore();
  }
});

// ---------- 6-7: read-only, never modifies License/LicenseActivation ----------

test('getEligibleActivationsForHeartbeat: never writes to LicenseActivation or License (read-only)', async () => {
  const stub = stubFind([{ licenseId: 'LIC-1', activationId: 'ACT-1' }]);
  const writeCalls = [];
  const originals = {
    activationUpdateOne: LicenseActivation.updateOne,
    activationFindOneAndUpdate: LicenseActivation.findOneAndUpdate,
    activationCreate: LicenseActivation.create,
    licenseUpdateOne: License.updateOne,
    licenseFindOneAndUpdate: License.findOneAndUpdate,
  };
  LicenseActivation.updateOne = (...args) => { writeCalls.push('LicenseActivation.updateOne'); return originals.activationUpdateOne.apply(LicenseActivation, args); };
  LicenseActivation.findOneAndUpdate = (...args) => { writeCalls.push('LicenseActivation.findOneAndUpdate'); return originals.activationFindOneAndUpdate.apply(LicenseActivation, args); };
  LicenseActivation.create = (...args) => { writeCalls.push('LicenseActivation.create'); return originals.activationCreate.apply(LicenseActivation, args); };
  License.updateOne = (...args) => { writeCalls.push('License.updateOne'); return originals.licenseUpdateOne.apply(License, args); };
  License.findOneAndUpdate = (...args) => { writeCalls.push('License.findOneAndUpdate'); return originals.licenseFindOneAndUpdate.apply(License, args); };

  try {
    await discovery.getEligibleActivationsForHeartbeat();
    assert.deepEqual(writeCalls, []);
  } finally {
    stub.restore();
    LicenseActivation.updateOne = originals.activationUpdateOne;
    LicenseActivation.findOneAndUpdate = originals.activationFindOneAndUpdate;
    LicenseActivation.create = originals.activationCreate;
    License.updateOne = originals.licenseUpdateOne;
    License.findOneAndUpdate = originals.licenseFindOneAndUpdate;
  }
});

// ---------- safety sweep ----------

test('licenseRemoteActivationDiscovery.js: no HTTP client libraries, no real fetch/axios/https, no Redis', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteActivationDiscovery.js'), 'utf8');
  assert.ok(!/require\(['"]axios['"]\)/.test(source));
  assert.ok(!/\bfetch\(/.test(source));
  assert.ok(!/new\s+Redis\s*\(/i.test(source));
});