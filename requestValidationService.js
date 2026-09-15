'use strict';

const { config } = require('../config/env');
const { SUPPORTED_OPERATIONS } = require('../license/protocol');

class RequestValidationError extends Error {
  constructor(message, code = 'MALFORMED_REQUEST') {
    super(message);
    this.name = 'RequestValidationError';
    this.code = code;
  }
}

// Operation-specific required fields. Note: none of these ever include
// customer-provided authorization/state fields (see STEP 8) — status,
// activation state, maxActivations, and expiry are never accepted from
// the client.
const OPERATION_REQUIRED_FIELDS = {
  ACTIVATE: ['licenseId', 'domain', 'fingerprintHash'],
  VALIDATE: ['licenseId'],
  HEARTBEAT: ['licenseId', 'activationId'],
  DEACTIVATE: ['licenseId', 'activationId'],
};

const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates the protocol envelope + operation-specific fields of an
 * incoming request. Throws RequestValidationError on any problem.
 * Returns the validated (unmodified) request body on success.
 */
function validateProtocolRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new RequestValidationError('Request body must be a JSON object.');
  }

  const { protocolVersion, operation, requestId, timestamp } = body;

  if (protocolVersion !== config.protocolVersion) {
    throw new RequestValidationError(
      `Unsupported protocolVersion: expected ${config.protocolVersion}, got ${protocolVersion}.`,
      'UNSUPPORTED_PROTOCOL_VERSION'
    );
  }

  if (!isNonEmptyString(operation) || !SUPPORTED_OPERATIONS.includes(operation)) {
    throw new RequestValidationError(
      `Unsupported operation: ${operation}`,
      'UNSUPPORTED_OPERATION'
    );
  }

  if (!isNonEmptyString(requestId)) {
    throw new RequestValidationError('requestId is required.', 'MISSING_REQUEST_ID');
  }

  if (!isNonEmptyString(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new RequestValidationError('timestamp must be a valid ISO date string.', 'INVALID_TIMESTAMP');
  }

  const skew = Math.abs(Date.now() - Date.parse(timestamp));
  if (skew > MAX_TIMESTAMP_SKEW_MS) {
    throw new RequestValidationError(
      'timestamp is outside the allowed clock skew window.',
      'TIMESTAMP_OUT_OF_RANGE'
    );
  }

  const requiredFields = OPERATION_REQUIRED_FIELDS[operation] || [];
  const missing = requiredFields.filter((field) => !isNonEmptyString(body[field]));
  if (missing.length > 0) {
    throw new RequestValidationError(
      `Missing required fields for ${operation}: ${missing.join(', ')}`,
      'MISSING_FIELDS'
    );
  }

  return body;
}

module.exports = { validateProtocolRequest, RequestValidationError, OPERATION_REQUIRED_FIELDS };
