'use strict';

const { randomUUID } = require('crypto');
const { License, LICENSE_TYPES, LICENSE_STATUSES } = require('../models/License');
const { recordEvent } = require('./eventService');
const { normalizeDomain } = require('../utils/normalizeDomain');
const { runTransactional } = require('./transactionHelper');

class LicenseServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LicenseServiceError';
    this.code = code;
  }
}

const MAX_CAS_RETRIES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function assertValidType(type) {
  if (!LICENSE_TYPES.includes(type)) {
    throw new LicenseServiceError(`Invalid license type: ${type}`, 'INVALID_LICENSE_TYPE');
  }
}

/**
 * Server-side license key generation (PART 3B, STEP 4). Deliberately
 * distinct from MongoDB's internal `_id`.
 */
function generateLicenseId() {
  return `LAVA-${randomUUID().toUpperCase()}`;
}

function normalizeDomainList(domains) {
  if (!Array.isArray(domains)) {
    throw new LicenseServiceError('allowedDomains must be an array of strings.', 'INVALID_DOMAIN');
  }
  const normalized = [];
  const seen = new Set();
  for (const raw of domains) {
    const domain = normalizeDomain(raw);
    if (!domain) {
      throw new LicenseServiceError(`Invalid domain: ${raw}`, 'INVALID_DOMAIN');
    }
    if (!seen.has(domain)) {
      seen.add(domain);
      normalized.push(domain);
    }
  }
  return normalized;
}

function assertValidMaxActivations(maxActivations) {
  if (!Number.isInteger(maxActivations) || maxActivations < 0) {
    throw new LicenseServiceError(
      'maxActivations must be a non-negative integer.',
      'ACTIVATION_LIMIT_INVALID'
    );
  }
}

function normalizeFeatureList(features) {
  if (!Array.isArray(features)) {
    throw new LicenseServiceError('features must be an array of strings.', 'INVALID_FEATURES');
  }
  const normalized = [];
  const seen = new Set();
  for (const raw of features) {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new LicenseServiceError('Each feature must be a non-empty string.', 'INVALID_FEATURES');
    }
    const feature = raw.trim();
    if (!seen.has(feature)) {
      seen.add(feature);
      normalized.push(feature);
    }
  }
  return normalized;
}

function assertValidBuildId(buildId) {
  if (buildId === null || buildId === undefined) return;
  if (typeof buildId !== 'string' || buildId.trim().length === 0) {
    throw new LicenseServiceError('buildId must be a non-empty string or null.', 'INVALID_BUILD_ID');
  }
}

/**
 * PART 3B-FIX, Problem 1: generic "mutate the License document, then
 * write the matching audit event, as one atomic unit" helper.
 *
 * Every administrative operation below (suspend/reactivate/revoke/
 * domain/limit/features/buildId) is built on this so none of them can
 * repeat the bug this fix addresses: a License mutation succeeding
 * while its audit event silently fails to write.
 *
 *   - With a real MongoDB session (replica set): `applyMutation` and
 *     the event write run inside session.withTransaction. If the event
 *     write throws, MongoDB aborts the whole transaction — the License
 *     mutation is undone as if it never happened.
 *   - Without a session (unit tests' FakeModel doubles, or a
 *     standalone/non-replica-set MongoDB): there is no database-level
 *     atomicity available, so we manually compensate — if the event
 *     write fails after the mutation already applied, `revert` is
 *     called to put the License back exactly as it was, before
 *     rethrowing. Either way, the caller only ever observes "this
 *     mutation failed" — never a mutation that silently landed without
 *     its audit trail.
 *
 * Returns `{ license, before }`: `license` is the post-mutation
 * document (or null if `applyMutation` found no matching document —
 * e.g. an invalid lifecycle transition), and `before` is a read of the
 * document as it stood immediately prior to the mutation attempt (or
 * null if the license doesn't exist at all), which callers use to
 * build precise "not found" vs "invalid transition" error responses.
 */
async function mutateLicenseWithEvent({ licenseId, applyMutation, eventType, buildMetadata, revert }) {
  return runTransactional(async (session) => {
    const beforeDoc = await License.findOne({ licenseId });
    // Shallow snapshot, decoupled from any later in-place mutation of
    // the same underlying object. This matters for the FakeModel test
    // double (whose findOneAndUpdate mutates and returns the very same
    // object `findOne` handed back) — without this, `before` would
    // silently reflect the POST-mutation state by the time `revert`
    // reads it. Real Mongoose always returns a distinct document
    // instance per query, so this is a no-op there.
    const before = beforeDoc ? { ...beforeDoc } : null;

    const license = await applyMutation(session, before);
    if (!license) {
      return { license: null, before };
    }

    try {
      await recordEvent(
        { eventType, licenseId, metadata: buildMetadata ? buildMetadata(license, before) : {} },
        session
      );
      return { license, before };
    } catch (err) {
      if (session) {
        // Real transaction in progress: let it abort. MongoDB itself
        // undoes the mutation — manually compensating here as well
        // would be redundant and unsafe against an already-aborting
        // session (see PART 3A-FIX-3).
        throw err;
      }
      if (revert) {
        await revert(before, session);
      }
      throw err;
    }
  });
}

async function createLicense({
  licenseId,
  customerReference,
  type,
  allowedDomains = [],
  maxActivations = 1,
  expiresAt = null,
  features = [],
  buildId = null,
}) {
  assertValidType(type);
  assertValidMaxActivations(maxActivations);
  assertValidBuildId(buildId);
  const normalizedDomains = normalizeDomainList(allowedDomains);
  const normalizedFeatures = normalizeFeatureList(features);

  if (expiresAt !== null && Number.isNaN(new Date(expiresAt).getTime())) {
    throw new LicenseServiceError('expiresAt must be a valid date or null.', 'INVALID_EXPIRATION');
  }
  if (!customerReference || typeof customerReference !== 'string') {
    throw new LicenseServiceError('customerReference is required.', 'INVALID_CUSTOMER_REFERENCE');
  }

  const doc = {
    licenseId: licenseId || generateLicenseId(),
    customerReference,
    type,
    status: 'active',
    allowedDomains: normalizedDomains,
    maxActivations,
    activeActivationCount: 0,
    issuedAt: new Date(),
    activatedAt: null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    features: normalizedFeatures,
    buildId,
  };

  return runTransactional(async (session) => {
    const license = session
      ? (await License.create([doc], { session }))[0]
      : await License.create(doc);

    try {
      await recordEvent({ eventType: 'LICENSE_CREATED', licenseId: license.licenseId }, session);
      return license;
    } catch (err) {
      if (session) throw err;
      // No real transaction: the license row was already inserted —
      // remove it so a failed creation never leaves an orphaned,
      // un-audited License document behind.
      await License.deleteOne({ licenseId: license.licenseId });
      throw err;
    }
  });
}

async function getLicense(licenseId) {
  return License.findOne({ licenseId });
}

async function listLicenses({
  status,
  type,
  customerReference,
  expiresBefore,
  expiresAfter,
  page = 1,
  pageSize = 25,
} = {}) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 25;

  const filter = {};
  if (status) {
    if (!LICENSE_STATUSES.includes(status)) {
      throw new LicenseServiceError(`Invalid status filter: ${status}`, 'INVALID_LICENSE_STATUS');
    }
    filter.status = status;
  }
  if (type) {
    if (!LICENSE_TYPES.includes(type)) {
      throw new LicenseServiceError(`Invalid type filter: ${type}`, 'INVALID_LICENSE_TYPE');
    }
    filter.type = type;
  }
  if (customerReference) filter.customerReference = customerReference;
  if (expiresBefore || expiresAfter) {
    filter.expiresAt = {};
    if (expiresBefore) filter.expiresAt.$lt = new Date(expiresBefore);
    if (expiresAfter) filter.expiresAt.$gt = new Date(expiresAfter);
  }

  const skip = (safePage - 1) * safePageSize;
  const [items, total] = await Promise.all([
    License.find(filter).skip(skip).limit(safePageSize),
    License.countDocuments(filter),
  ]);

  return { items, page: safePage, pageSize: safePageSize, total };
}

/**
 * Read-only validity check. Never trusts client-provided status/expiry —
 * always re-derives from the authoritative database record.
 */
async function validateLicense(licenseId) {
  const license = await License.findOne({ licenseId });

  if (!license) {
    return { valid: false, code: 'INVALID_LICENSE', license: null };
  }

  if (license.expiresAt && license.expiresAt.getTime() < Date.now() && license.status === 'active') {
    license.status = 'expired';
    await license.save();
    await recordEvent({ eventType: 'LICENSE_EXPIRED', licenseId });
  }

  return { valid: license.status === 'active', code: license.status.toUpperCase(), license };
}

async function revokeLicense(licenseId) {
  const { license, before } = await mutateLicenseWithEvent({
    licenseId,
    applyMutation: (session) =>
      License.findOneAndUpdate(
        { licenseId, status: { $in: ['active', 'suspended', 'expired'] } },
        { $set: { status: 'revoked' } },
        { new: true, session: session || undefined }
      ),
    eventType: 'LICENSE_REVOKED',
    revert: (prior, session) =>
      prior &&
      License.findOneAndUpdate(
        { licenseId },
        { $set: { status: prior.status } },
        { session: session || undefined }
      ),
  });

  if (license) return license;
  if (!before) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  if (before.status === 'revoked') return before; // already terminal; idempotent no-op
  throw new LicenseServiceError('License cannot be revoked from its current state.', 'INVALID_TRANSITION');
}

async function suspendLicense(licenseId) {
  const { license, before } = await mutateLicenseWithEvent({
    licenseId,
    applyMutation: (session) =>
      License.findOneAndUpdate(
        { licenseId, status: 'active' },
        { $set: { status: 'suspended' } },
        { new: true, session: session || undefined }
      ),
    eventType: 'LICENSE_SUSPENDED',
    revert: (prior, session) =>
      prior &&
      License.findOneAndUpdate(
        { licenseId },
        { $set: { status: prior.status } },
        { session: session || undefined }
      ),
  });

  if (license) return license;
  if (!before) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  if (before.status === 'revoked') {
    throw new LicenseServiceError('A revoked license cannot be suspended.', 'LICENSE_REVOKED');
  }
  if (before.status === 'suspended') return before; // idempotent no-op
  throw new LicenseServiceError('License cannot be suspended from its current state.', 'INVALID_TRANSITION');
}

async function reactivateLicense(licenseId) {
  const { license, before } = await mutateLicenseWithEvent({
    licenseId,
    applyMutation: (session) =>
      License.findOneAndUpdate(
        { licenseId, status: 'suspended' },
        { $set: { status: 'active' } },
        { new: true, session: session || undefined }
      ),
    eventType: 'LICENSE_REACTIVATED',
    revert: (prior, session) =>
      prior &&
      License.findOneAndUpdate(
        { licenseId },
        { $set: { status: prior.status } },
        { session: session || undefined }
      ),
  });

  if (license) return license;
  if (!before) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  if (before.status === 'revoked') {
    throw new LicenseServiceError('A revoked license cannot be reactivated.', 'LICENSE_REVOKED');
  }
  throw new LicenseServiceError(
    'License not found or not in a reactivatable state.',
    'INVALID_LICENSE_STATE'
  );
}

/**
 * PART 3B-FIX, Problem 2: renewal is the highest-stakes idempotency
 * case in this service (it will eventually be driven by retried
 * payment webhooks), so its mutation + audit event is made atomic by
 * the exact same strategy as the rest of this file — see
 * mutateLicenseWithEvent's doc comment — applied inline here because
 * renewal also needs a compare-and-swap retry loop for concurrency
 * (two different requestIds renewing the same license at once must
 * never lose an update).
 *
 * The critical guarantee this produces for
 * controllers/adminLicenseController.js's idempotency wiring:
 * `renewLicense` either (a) fully commits — License updated AND
 * LICENSE_RENEWED event recorded — and returns normally, or (b) throws
 * having left the License exactly as it was found. There is no
 * third outcome where the expiry changed but the function still threw.
 * That is what makes it safe for the controller to mark a ProcessedRequest
 * FAILED (permitting retry) whenever renewLicense throws unexpectedly:
 * the retry is guaranteed to be renewing from the pre-attempt state,
 * never double-applying an extension.
 */
async function renewLicense({ licenseId, durationDays, paymentReference = null, metadata = {} }) {
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    throw new LicenseServiceError('durationDays must be a positive number.', 'INVALID_EXPIRATION');
  }

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt += 1) {
    const result = await runTransactional(async (session) => {
      const currentDoc = await License.findOne({ licenseId });
      if (!currentDoc) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
      if (currentDoc.status === 'revoked') {
        throw new LicenseServiceError('A revoked license cannot be renewed.', 'LICENSE_REVOKED');
      }

      // Snapshot immutable-by-convention primitives BEFORE the mutating
      // call below. This matters for the FakeModel test double, whose
      // findOneAndUpdate mutates and returns the very same object
      // `findOne` handed back — reading `currentDoc.expiresAt`/`.status`
      // AFTER that call would silently observe the NEW values instead
      // of the ones we're trying to compare-and-swap against or revert
      // to. Real Mongoose always returns a distinct document instance
      // per query, so this snapshot is a no-op there.
      const previousExpiresAt = currentDoc.expiresAt;
      const previousStatus = currentDoc.status;

      const now = Date.now();
      const base = previousExpiresAt && previousExpiresAt.getTime() > now ? previousExpiresAt.getTime() : now;
      const newExpiresAt = new Date(base + durationDays * DAY_MS);
      const newStatus = previousStatus === 'expired' ? 'active' : previousStatus;

      const update = { $set: { expiresAt: newExpiresAt } };
      if (newStatus !== previousStatus) update.$set.status = newStatus;

      // Compare-and-swap: only apply if expiresAt is still exactly what
      // we just read. A concurrent renewal (different requestId, same
      // license) that already changed it makes this match nothing —
      // we retry from fresh state below rather than clobbering it
      // (protects against lost updates across different requestIds).
      const updated = await License.findOneAndUpdate(
        { licenseId, expiresAt: previousExpiresAt },
        update,
        { new: true, session: session || undefined }
      );

      if (!updated) {
        return { casConflict: true };
      }

      try {
        await recordEvent(
          {
            eventType: 'LICENSE_RENEWED',
            licenseId,
            metadata: {
              previousExpiresAt,
              newExpiresAt,
              durationDays,
              paymentReference,
              ...metadata,
            },
          },
          session
        );
        return { license: updated };
      } catch (err) {
        if (session) throw err; // real transaction: abort undoes the $set automatically
        // No real transaction: manually put expiresAt/status back
        // exactly as read, so this attempt leaves zero trace and a
        // retry (same or different requestId) starts clean instead of
        // renewing on top of an unaudited partial renewal.
        await License.findOneAndUpdate(
          { licenseId },
          { $set: { expiresAt: previousExpiresAt, status: previousStatus } }
        );
        throw err;
      }
    });

    if (result.casConflict) continue; // someone else renewed concurrently; retry from fresh state
    return result.license;
  }

  throw new LicenseServiceError(
    'Could not renew license due to concurrent updates; please retry.',
    'RENEW_CONFLICT'
  );
}

async function changeAllowedDomains(licenseId, allowedDomains) {
  const normalized = normalizeDomainList(allowedDomains);

  const { license, before } = await mutateLicenseWithEvent({
    licenseId,
    applyMutation: (session) =>
      License.findOneAndUpdate(
        { licenseId, status: { $ne: 'revoked' } },
        { $set: { allowedDomains: normalized } },
        { new: true, session: session || undefined }
      ),
    eventType: 'DOMAIN_CHANGED',
    buildMetadata: () => ({ allowedDomains: normalized }),
    revert: (prior, session) =>
      prior &&
      License.findOneAndUpdate(
        { licenseId },
        { $set: { allowedDomains: prior.allowedDomains } },
        { session: session || undefined }
      ),
  });

  if (license) return license;
  if (!before) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  throw new LicenseServiceError('A revoked license cannot be modified.', 'LICENSE_REVOKED');
}

async function changeActivationLimit(licenseId, maxActivations) {
  assertValidMaxActivations(maxActivations);

  const { license, before } = await mutateLicenseWithEvent({
    licenseId,
    applyMutation: (session) =>
      License.findOneAndUpdate(
        {
          licenseId,
          status: { $ne: 'revoked' },
          activeActivationCount: { $lte: maxActivations },
        },
        { $set: { maxActivations } },
        { new: true, session: session || undefined }
      ),
    eventType: 'ACTIVATION_LIMIT_CHANGED',
    buildMetadata: () => ({ maxActivations }),
    revert: (prior, session) =>
      prior &&
      License.findOneAndUpdate(
        { licenseId },
        { $set: { maxActivations: prior.maxActivations } },
        { session: session || undefined }
      ),
  });

  if (license) return license;
  if (!before) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  if (before.status === 'revoked') {
    throw new LicenseServiceError('A revoked license cannot be modified.', 'LICENSE_REVOKED');
  }
  throw new LicenseServiceError(
    `maxActivations cannot be set below the current active activation count (${before.activeActivationCount}).`,
    'ACTIVATION_LIMIT_INVALID'
  );
}

async function updateFeatures(licenseId, features) {
  const normalized = normalizeFeatureList(features);

  const { license, before } = await mutateLicenseWithEvent({
    licenseId,
    applyMutation: (session) =>
      License.findOneAndUpdate(
        { licenseId, status: { $ne: 'revoked' } },
        { $set: { features: normalized } },
        { new: true, session: session || undefined }
      ),
    eventType: 'FEATURES_UPDATED',
    buildMetadata: () => ({ features: normalized }),
    revert: (prior, session) =>
      prior &&
      License.findOneAndUpdate(
        { licenseId },
        { $set: { features: prior.features } },
        { session: session || undefined }
      ),
  });

  if (license) return license;
  if (!before) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  throw new LicenseServiceError('A revoked license cannot be modified.', 'LICENSE_REVOKED');
}

async function updateBuildId(licenseId, buildId) {
  assertValidBuildId(buildId);
  const normalizedBuildId = buildId ?? null;

  const { license, before } = await mutateLicenseWithEvent({
    licenseId,
    applyMutation: (session) =>
      License.findOneAndUpdate(
        { licenseId, status: { $ne: 'revoked' } },
        { $set: { buildId: normalizedBuildId } },
        { new: true, session: session || undefined }
      ),
    eventType: 'BUILD_ID_CHANGED',
    buildMetadata: () => ({ buildId: normalizedBuildId }),
    revert: (prior, session) =>
      prior &&
      License.findOneAndUpdate(
        { licenseId },
        { $set: { buildId: prior.buildId } },
        { session: session || undefined }
      ),
  });

  if (license) return license;
  if (!before) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  throw new LicenseServiceError('A revoked license cannot be modified.', 'LICENSE_REVOKED');
}

module.exports = {
  LicenseServiceError,
  LICENSE_TYPES,
  LICENSE_STATUSES,
  generateLicenseId,
  createLicense,
  getLicense,
  listLicenses,
  validateLicense,
  revokeLicense,
  suspendLicense,
  reactivateLicense,
  renewLicense,
  changeAllowedDomains,
  changeActivationLimit,
  updateFeatures,
  updateBuildId,
};
