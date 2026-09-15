'use strict';

const { LicenseEvent } = require('../models/LicenseEvent');
const { assertNoSecrets } = require('../utils/assertNoSecrets');

/**
 * Records a machine-generated licensing audit event.
 *
 * Runs a defensive assertNoSecrets check on metadata before persisting —
 * see STEP 5 (event model must never store secrets / raw identifiers).
 *
 * Accepts an optional `session` (PART 3A-FIX-2) so callers running
 * inside a MongoDB transaction (e.g. activation) can have the event
 * write commit/abort atomically together with the rest of that
 * transaction's writes. Safe to omit — a plain (non-transactional)
 * write is used when no session is given.
 */
async function recordEvent({ eventType, licenseId = null, activationId = null, metadata = {} }, session = null) {
  assertNoSecrets(metadata);

  const doc = { eventType, licenseId, activationId, metadata };

  if (session) {
    // Array form is required for a create() call to participate in a
    // MongoDB session/transaction.
    const [created] = await LicenseEvent.create([doc], { session });
    return created;
  }

  return LicenseEvent.create(doc);
}

module.exports = { recordEvent };
