'use strict';

const { Schema, model } = require('mongoose');

/**
 * Persisted idempotency + concurrency-control record (FIX #1).
 *
 * A single ProcessedRequest document acts as an atomic "claim" on a
 * requestId: whichever concurrent request first manages to INSERT the
 * document (relying on the unique index on `requestId` alone, not a
 * compound key) owns executing the side effect. Every other concurrent
 * or retried caller with the same requestId finds the existing document
 * instead of racing to perform the operation again.
 *
 * States:
 *   RECEIVED   - claimed, operation is being executed right now.
 *   COMPLETED  - operation finished; `response` holds the exact signed
 *                envelope that must be replayed for any future duplicate.
 *   FAILED     - operation raised an unexpected error before completing;
 *                safe to reclaim and retry (no side effect was recorded
 *                as successful).
 *
 * requestId alone is unique (not requestId+operation+licenseContext) so
 * that a requestId reused for a different operation or a different
 * license is detected as a genuine conflict rather than silently
 * creating a second, unrelated idempotency record.
 */
const processedRequestSchema = new Schema(
  {
    requestId: {
      type: String,
      required: true,
      trim: true,
    },

    operation: {
      type: String,
      required: true,
      trim: true,
    },

    // e.g. licenseId — scopes the requestId so two different licenses
    // reusing the same client-generated requestId are detected as a
    // conflict instead of colliding silently.
    licenseContext: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional finer-grained binding (e.g. activationId) for operations
    // where the same requestId must also stay pinned to one activation.
    activationContext: {
      type: String,
      default: null,
      trim: true,
    },

    status: {
      type: String,
      enum: ['RECEIVED', 'COMPLETED', 'FAILED'],
      required: true,
      default: 'RECEIVED',
    },

    // When the current (or most recent) claim started processing. Used
    // to detect and safely reclaim a request abandoned mid-processing
    // by a crashed process, without an arbitrary short TTL that could
    // let two processes both believe they own the claim.
    claimedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // The exact response envelope returned the first time the request
    // completed successfully, so retries get a byte-identical answer
    // instead of re-executing side effects.
    response: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// A requestId identifies exactly one logical request, full stop. This is
// intentionally NOT a compound index — a compound (requestId, operation,
// licenseContext) index would let the same requestId silently succeed
// again under a different operation/license, which FIX #1 explicitly
// forbids.
processedRequestSchema.index({ requestId: 1 }, { unique: true });

const ProcessedRequest = model('ProcessedRequest', processedRequestSchema);

module.exports = { ProcessedRequest };
