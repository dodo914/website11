'use strict';

const mongoose = require('mongoose');

/**
 * Thin abstraction over MongoDB multi-document transactions (PART
 * 3A-FIX-2).
 *
 * Real MongoDB transactions require a replica-set/sharded-cluster
 * deployment and an active mongoose connection. Two situations in this
 * project legitimately don't have that:
 *
 *   1. Unit tests, which swap the real Mongoose models for the
 *      in-memory FakeModel test double (see tests/helpers/fakeModel.js)
 *      and never open a real connection at all.
 *   2. A standalone (non-replica-set) MongoDB deployment, which some
 *      small/self-hosted installs of this server may still use.
 *
 * `runTransactional(work)` calls `work(session)` with a real, committed
 * MongoDB session when one is available, and with `session === null`
 * otherwise. Callers MUST treat `session === null` as "no atomicity is
 * provided by the database here" and fall back to an explicit,
 * deterministic compensation strategy (see activationService.js) rather
 * than assuming the operation was atomic.
 *
 * This module never fakes or simulates transaction support — when a
 * session can't be used, it is honest about that by returning null
 * rather than pretending to wrap the work in a transaction.
 */

function connectionIsReady() {
  // readyState 1 === connected. Checked synchronously so we never block
  // on mongoose's connection-buffering behavior (which would otherwise
  // hang indefinitely in a test process that never calls connectDb()).
  return mongoose.connection && mongoose.connection.readyState === 1;
}

async function runTransactional(work) {
  if (!connectionIsReady()) {
    return work(null);
  }

  try {
    let session;
    try {
      session = await mongoose.startSession();
    } catch (err) {
      // Session creation itself failed (e.g. driver/topology doesn't
      // support sessions). Fall back to the no-session path rather than
      // throwing — the caller's compensation strategy handles this.
      return work(null);
    }

    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      session.endSession();
    }
  } catch (err) {
    // NOTE: if the transaction genuinely fails to commit because this
    // deployment doesn't support transactions (e.g. a standalone
    // MongoDB, not a replica set/sharded cluster), we deliberately do
    // NOT silently retry `work` outside a transaction here — `work` may
    // have already partially executed non-idempotent writes (e.g.
    // creating a LicenseActivation with a fresh random id), so blindly
    // re-running it could create a duplicate. Production deployments of
    // this server MUST run MongoDB as a replica set for activation to
    // get real atomicity; this is a known, documented limitation rather
    // than something this helper papers over.
    throw err;
  }
}

module.exports = { runTransactional, connectionIsReady };
