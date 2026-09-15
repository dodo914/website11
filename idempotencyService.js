'use strict';

const { ProcessedRequest } = require('../models/ProcessedRequest');

/**
 * Idempotency / concurrency control (FIX #1).
 *
 * SAME REQUEST -> SAME EFFECT -> SAME RESULT.
 *
 * Claiming a requestId is a single atomic database operation (an insert
 * relying on the unique index on `requestId`), never a
 * "find, then decide, then write" sequence. Two concurrent processes
 * racing on the same requestId can never both proceed past claimRequest().
 */

// How long a RECEIVED claim is allowed to sit unfinished before it is
// considered abandoned (e.g. the process handling it crashed) and safe
// to reclaim. Long enough that no in-flight request under normal
// operation would ever be reclaimed out from under itself.
const PROCESSING_STALE_MS = 30 * 1000;

// How long/how many times a caller will briefly wait for a concurrent
// in-flight duplicate to finish before giving up and reporting
// "still processing". Keeps genuinely concurrent duplicate requests
// (the common case) converging on the same COMPLETED response instead
// of bouncing one of them with an error.
const POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 50;

class IdempotencyConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IdempotencyConflictError';
    this.code = 'REQUEST_CONTEXT_MISMATCH';
  }
}

class IdempotencyBusyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IdempotencyBusyError';
    this.code = 'REQUEST_IN_PROGRESS';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function contextMatches(existing, { operation, licenseContext, activationContext }) {
  if (existing.operation !== operation) return false;
  if (existing.licenseContext !== licenseContext) return false;
  if (
    activationContext != null &&
    existing.activationContext != null &&
    existing.activationContext !== activationContext
  ) {
    return false;
  }
  return true;
}

async function tryReclaimStale(requestId) {
  const cutoff = new Date(Date.now() - PROCESSING_STALE_MS);
  return ProcessedRequest.findOneAndUpdate(
    { requestId, status: 'RECEIVED', claimedAt: { $lt: cutoff } },
    { $set: { status: 'RECEIVED', claimedAt: new Date() } },
    { new: true }
  );
}

async function tryReclaimFailed(requestId) {
  return ProcessedRequest.findOneAndUpdate(
    { requestId, status: 'FAILED' },
    { $set: { status: 'RECEIVED', claimedAt: new Date() } },
    { new: true }
  );
}

/**
 * Atomically claims a requestId for processing.
 *
 * Resolves to one of:
 *   { claimed: true }                    - caller owns execution now,
 *                                           must call completeRequest or
 *                                           failRequest when done.
 *   { claimed: false, response }         - already completed; replay
 *                                           this stored response,
 *                                           execute nothing.
 *
 * Throws:
 *   IdempotencyConflictError - requestId was already used for a
 *                              different operation/license/activation.
 *   IdempotencyBusyError     - a concurrent request is still actively
 *                              processing this requestId; caller should
 *                              surface a retryable "in progress" result
 *                              rather than executing anything.
 */
async function claimRequest({ requestId, operation, licenseContext, activationContext = null }) {
  const desired = { requestId, operation, licenseContext, activationContext };

  // Attempt 1: the common case — nobody has seen this requestId before.
  try {
    await ProcessedRequest.create({
      requestId,
      operation,
      licenseContext,
      activationContext,
      status: 'RECEIVED',
      claimedAt: new Date(),
    });
    return { claimed: true };
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  // Someone got there first (or a previous attempt left a record).
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const existing = await ProcessedRequest.findOne({ requestId }).lean();

    if (!existing) {
      // Extremely unlikely race: the prior record was removed between
      // our failed insert and this read. Retry the claim from scratch.
      return claimRequest({ requestId, operation, licenseContext, activationContext });
    }

    if (!contextMatches(existing, desired)) {
      throw new IdempotencyConflictError(
        'requestId was already used for a different operation, license, or activation context.'
      );
    }

    if (existing.status === 'COMPLETED') {
      return { claimed: false, response: existing.response };
    }

    if (existing.status === 'FAILED') {
      const reclaimed = await tryReclaimFailed(requestId);
      if (reclaimed) return { claimed: true };
      // Someone else reclaimed it first; loop and re-check its state.
      if (attempt < POLL_ATTEMPTS - 1) await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // status === 'RECEIVED': either genuinely in-flight, or abandoned.
    const reclaimed = await tryReclaimStale(requestId);
    if (reclaimed) return { claimed: true };

    if (attempt < POLL_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new IdempotencyBusyError('This request is already being processed. Retry shortly.');
}

/** Marks a claimed request as completed, storing the response for replay. */
async function completeRequest({ requestId, response }) {
  await ProcessedRequest.updateOne(
    { requestId },
    { $set: { status: 'COMPLETED', response } }
  );
}

/**
 * Marks a claimed request as failed (no trusted side effect occurred),
 * making it eligible for a future safe retry instead of deadlocking
 * forever in RECEIVED.
 */
async function failRequest({ requestId }) {
  await ProcessedRequest.updateOne(
    { requestId },
    { $set: { status: 'FAILED' } }
  );
}

module.exports = {
  claimRequest,
  completeRequest,
  failRequest,
  IdempotencyConflictError,
  IdempotencyBusyError,
  PROCESSING_STALE_MS,
};
