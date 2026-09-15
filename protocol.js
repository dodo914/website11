'use strict';

const { config } = require('../config/env');
const { signPayload } = require('./signingService');

const SUPPORTED_OPERATIONS = ['ACTIVATE', 'VALIDATE', 'HEARTBEAT', 'DEACTIVATE'];

/**
 * Builds and signs a protocol response envelope:
 *
 *   { protocolVersion, operation, requestId, timestamp, success, code,
 *     message, data, signature }
 *
 * `message` is human-readable only and is deliberately excluded from the
 * signed canonical payload (see canonicalPayload.js / STEP 7).
 */
function buildSignedResponse({
  operation,
  requestId,
  success,
  code,
  message = '',
  data = {},
  timestamp = new Date().toISOString(),
  protocolVersion = config.protocolVersion,
  privateKeyB64,
}) {
  const signable = { protocolVersion, operation, requestId, timestamp, success, code, data };
  const signature = signPayload(signable, { privateKeyB64 });

  return {
    protocolVersion,
    operation,
    requestId,
    timestamp,
    success,
    code,
    message,
    data,
    signature,
  };
}

module.exports = { buildSignedResponse, SUPPORTED_OPERATIONS };
