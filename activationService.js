'use strict';

const { randomUUID } = require('crypto');
const { License } = require('../models/License');
const { LicenseActivation } = require('../models/LicenseActivation');
const { isDomainAllowed } = require('./domainValidationService');
const { normalizeDomain } = require('../utils/normalizeDomain');
const { recordEvent } = require('./eventService');
const { runTransactional } = require('./transactionHelper');

class ActivationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ActivationError';
    this.code = code;
  }
}

/**
 * Atomically reserves one activation slot on a license.
 *
 * STEP 10 requires this NOT be a read-count -> compare -> write-count
 * sequence, since that is a classic race condition. Instead we use a
 * single atomic findOneAndUpdate with a query-level guard:
 *
 *   activeActivationCount < maxActivations
 *
 * MongoDB only applies the $inc if the document still matches the
 * filter at the moment of the atomic update, so two concurrent requests
 * can never both succeed past the limit.
 *
 * Accepts an optional `session` so this can participate in the
 * activation transaction (PART 3A-FIX-2).
 */
async function reserveActivationSlot(licenseId, session = null) {
  const license = await License.findOneAndUpdate(
    {
      licenseId,
      status: 'active',
      $expr: { $lt: ['$activeActivationCount', '$maxActivations'] },
    },
    { $inc: { activeActivationCount: 1 } },
    { new: true, session: session || undefined }
  );

  return license; // null means: not found, not active, or limit reached
}

async function releaseActivationSlot(licenseId, session = null) {
  await License.updateOne(
    { licenseId, activeActivationCount: { $gt: 0 } },
    { $inc: { activeActivationCount: -1 } },
    { session: session || undefined }
  );
}

/**
 * Unconditionally restores one previously-released activation slot.
 * Used ONLY for no-session compensation, to undo our own prior
 * releaseActivationSlot() call after a subsequent step failed — never
 * for general-purpose slot acquisition (that must stay guarded by
 * reserveActivationSlot's maxActivations check).
 */
async function incrementActivationCount(licenseId, session = null) {
  await License.updateOne(
    { licenseId },
    { $inc: { activeActivationCount: 1 } },
    { session: session || undefined }
  );
}

/**
 * Performs the three side-effecting steps of activation — slot
 * reservation, LicenseActivation creation, and the LICENSE_ACTIVATED
 * audit event — as a single unit (PART 3A-FIX-2).
 *
 * The required invariant is:
 *
 *   License.activeActivationCount === count(active LicenseActivation)
 *
 * for the affected license. The old implementation could violate this:
 * if event recording failed AFTER the LicenseActivation document was
 * already created, the catch block released the slot but left the
 * active LicenseActivation document in place — an orphaned "phantom"
 * active activation with a decremented counter.
 *
 * Strategy:
 *   - When a real MongoDB session/transaction is available (replica-set
 *     deployment), all three writes run inside session.withTransaction:
 *     if the event write fails, MongoDB itself aborts and undoes the
 *     slot increment and the activation document — nothing partial is
 *     ever committed.
 *   - When no session is available (this project's unit tests use
 *     in-memory FakeModel doubles that have no notion of sessions; a
 *     standalone, non-replica-set MongoDB also has no transactions),
 *     we manually compensate: if the event write fails after the
 *     activation document was created, we delete that document and
 *     release the slot ourselves, in that order, before re-throwing.
 *     Either way, the caller only ever observes "activation failed" —
 *     never a partially-committed state.
 *
 * PART 3A-FIX-3: a duplicate-key error (err.code === 11000) on the
 * LicenseActivation unique index is NOT a failure — it means a
 * concurrent request already created the winning activation. The old
 * code resolved this from *inside* the try/catch by calling
 * releaseActivationSlot and LicenseActivation.findOne using the same
 * `session`. That is unsafe: once an error has occurred inside
 * `session.withTransaction`'s callback, MongoDB is already in the
 * process of aborting that transaction/session, and issuing further
 * operations against it is undefined/rejected behavior — it must never
 * be used to "recover" a result. So when a session is active, a 11000
 * is simply re-thrown like any other error, letting the transaction
 * abort cleanly (which also fully undoes our own slot reservation).
 * The duplicate is then resolved by `activateLicense` in a fresh,
 * non-transactional read performed strictly *after* `performActivation`
 * has returned/rejected and any transaction has fully finished
 * aborting.
 */
async function performActivation({ licenseId, normalizedDomain, fingerprintHash, environment, appVersion, buildId }) {
  try {
    return await runTransactional(async (session) => {
      const reserved = await reserveActivationSlot(licenseId, session);
      if (!reserved) {
        await recordEvent(
          {
            eventType: 'ACTIVATION_LIMIT_REACHED',
            licenseId,
            metadata: { domain: normalizedDomain },
          },
          session
        );
        throw new ActivationError('Activation limit reached for this license.', 'ACTIVATION_LIMIT_REACHED');
      }

      let activation;
      try {
        activation = await LicenseActivation.create(
          {
            activationId: randomUUID(),
            licenseId,
            domain: normalizedDomain,
            fingerprintHash,
            status: 'active',
            environment,
            appVersion,
            buildId,
            activatedAt: new Date(),
            lastSeenAt: new Date(),
          },
          { session: session || undefined }
        );

        await recordEvent(
          {
            eventType: 'LICENSE_ACTIVATED',
            licenseId,
            activationId: activation.activationId,
            metadata: { domain: normalizedDomain },
          },
          session
        );

        return activation;
      } catch (err) {
        if (session) {
          // Inside a real transaction: ALWAYS let the error propagate,
          // including for err.code === 11000. MongoDB aborts the whole
          // transaction on an uncaught error from the callback, so the
          // slot increment and the activation document (if it made it
          // that far) are undone automatically. Performing any further
          // operation — including the duplicate-key "find the winner"
          // recovery — against this same session here would be unsafe,
          // since the session is already being torn down.
          throw err;
        }

        if (err.code === 11000) {
          // No-session fallback: someone else concurrently created the
          // same activation. Release our own slot reservation (nothing
          // else will do it for us without a transaction) and let the
          // caller resolve the winner with a fresh read.
          await releaseActivationSlot(licenseId, session);
          throw err;
        }

        // No real transaction available: manually undo, in reverse
        // order, everything performed so far so we never leave an
        // orphaned active activation with a decremented/inconsistent
        // counter.
        if (activation) {
          await LicenseActivation.deleteOne({ activationId: activation.activationId });
        }
        await releaseActivationSlot(licenseId, session);
        throw err;
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      // Resolved strictly outside any transaction/session: by this
      // point either (a) there was no session at all and we already
      // released our own slot reservation above, or (b) there was a
      // real session and MongoDB has already finished aborting it,
      // fully undoing our slot reservation and activation document.
      // Either way it's now safe to issue a plain, non-transactional
      // read for the activation the winner actually created.
      const winner = await LicenseActivation.findOne({
        licenseId,
        domain: normalizedDomain,
        fingerprintHash,
        status: 'active',
      });
      if (winner) return winner;
    }
    throw err;
  }
}

/**
 * Activates a license for a given domain + fingerprint.
 *
 * Handles:
 * - domain validation (rejected domain never reserves a slot)
 * - atomic activation-limit enforcement
 * - duplicate activation requests (same license+domain+fingerprint that
 *   is already active) handled idempotently via the DB unique index
 */
async function activateLicense({ licenseId, domain, fingerprintHash, environment, appVersion, buildId }) {
  const license = await License.findOne({ licenseId }).lean();
  if (!license) {
    throw new ActivationError('License not found.', 'INVALID_LICENSE');
  }

  const normalizedDomain = normalizeDomain(domain);

  if (!isDomainAllowed(license.allowedDomains, normalizedDomain)) {
    await recordEvent({
      eventType: 'LICENSE_DOMAIN_NOT_ALLOWED',
      licenseId,
      metadata: { domain: normalizedDomain },
    });
    throw new ActivationError('Domain is not allowed for this license.', 'DOMAIN_NOT_ALLOWED');
  }

  // FIX #3: a License that is configured with a specific buildId only
  // accepts activation requests carrying that same buildId. A License
  // with no configured buildId (buildId === null/undefined) preserves
  // the existing unrestricted behavior. This check happens BEFORE any
  // slot reservation or activation mutation, so a mismatch never
  // consumes an activation slot and never touches existing state.
  if (license.buildId != null && buildId !== license.buildId) {
    await recordEvent({
      eventType: 'SUSPICIOUS_ACTIVITY',
      licenseId,
      metadata: { reason: 'BUILD_ID_MISMATCH', domain: normalizedDomain },
    });
    throw new ActivationError('Build ID does not match this license.', 'BUILD_ID_MISMATCH');
  }

  // Already-active duplicate: return the existing activation instead of
  // reserving a new slot.
  const existingActive = await LicenseActivation.findOne({
    licenseId,
    domain: normalizedDomain,
    fingerprintHash,
    status: 'active',
  });
  if (existingActive) {
    return existingActive;
  }

  return performActivation({ licenseId, normalizedDomain, fingerprintHash, environment, appVersion, buildId });
}

async function heartbeat({ licenseId, activationId }) {
  const activation = await LicenseActivation.findOneAndUpdate(
    { licenseId, activationId, status: 'active' },
    { $set: { lastSeenAt: new Date() } },
    { new: true }
  );

  if (!activation) {
    throw new ActivationError('Active activation not found.', 'INVALID_ACTIVATION');
  }

  return activation;
}

/**
 * PART 3A-FIX-3: deactivation now also runs its side effects (status
 * flip, slot release, LICENSE_DEACTIVATED event) through the same
 * transaction helper as activation, so an event-write failure can
 * never leave behind a decremented counter + deactivated activation
 * with no audit trail and no way to retry cleanly.
 */
async function deactivateActivation({ licenseId, activationId }) {
  return runTransactional(async (session) => {
    const activation = await LicenseActivation.findOneAndUpdate(
      { licenseId, activationId, status: 'active' },
      { $set: { status: 'deactivated', deactivatedAt: new Date() } },
      { new: true, session: session || undefined }
    );

    if (activation) {
      await releaseActivationSlot(licenseId, session);

      try {
        await recordEvent(
          {
            eventType: 'LICENSE_DEACTIVATED',
            licenseId,
            activationId,
          },
          session
        );
      } catch (err) {
        if (session) {
          // Real transaction: let it abort. That undoes both the
          // status flip and the slot release atomically — the caller
          // sees a clean failure and can safely retry.
          throw err;
        }

        // No real transaction available: manually restore the prior
        // state (active, slot held) so a retried deactivate can run
        // the whole operation again from scratch instead of getting
        // stuck on the "already deactivated" idempotency path without
        // ever having recorded the audit event.
        await LicenseActivation.findOneAndUpdate(
          { activationId, licenseId, status: 'deactivated' },
          { $set: { status: 'active', deactivatedAt: null } }
        );
        await incrementActivationCount(licenseId, session);
        throw err;
      }

      return activation;
    }

    // FIX #4: deactivate must be idempotent. If it's already deactivated
    // under this same license, that's not an error — repeating the
    // request (retry, duplicate network call) should return the same
    // successful outcome, not throw and not release the slot a second
    // time or emit a second LICENSE_DEACTIVATED event.
    const alreadyDeactivated = await LicenseActivation.findOne({
      licenseId,
      activationId,
      status: 'deactivated',
    }).lean();
    if (alreadyDeactivated) {
      return alreadyDeactivated;
    }

    throw new ActivationError('Active activation not found.', 'INVALID_ACTIVATION');
  });
}

module.exports = {
  ActivationError,
  reserveActivationSlot,
  releaseActivationSlot,
  activateLicense,
  heartbeat,
  deactivateActivation,
};
