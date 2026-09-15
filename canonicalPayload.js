'use strict';

/**
 * Builds the canonical (deterministic) payload that gets signed / verified.
 *
 * This MUST stay compatible with the existing customer-side verifier,
 * which expects the signed payload to be built from exactly these fields,
 * in this order:
 *
 *   protocolVersion, operation, requestId, timestamp, success, code, data
 *
 * `message` is intentionally excluded — it is never part of the trust
 * boundary and must never be treated as an authorization signal.
 *
 * Determinism requires stable key ordering for `data`, so we deep-sort
 * object keys before JSON-stringifying.
 */
function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function buildCanonicalPayload({
  protocolVersion,
  operation,
  requestId,
  timestamp,
  success,
  code,
  data,
}) {
  const canonicalObject = {
    protocolVersion,
    operation,
    requestId,
    timestamp,
    success,
    code,
    data: sortKeysDeep(data ?? {}),
  };

  // Stable key order at the top level too, though we already control it
  // by construction above — JSON.stringify preserves insertion order for
  // string keys, which is sufficient here since canonicalObject's keys
  // are fixed and always inserted in the same order.
  return JSON.stringify(canonicalObject);
}

module.exports = { buildCanonicalPayload, sortKeysDeep };
