'use strict';

const { validateProtocolRequest, RequestValidationError } = require('../services/requestValidationService');
const {
  claimRequest,
  completeRequest,
  failRequest,
  IdempotencyConflictError,
  IdempotencyBusyError,
} = require('../services/idempotencyService');
const { buildSignedResponse } = require('../license/protocol');
const { validateLicense } = require('../services/licenseService');
const {
  activateLicense,
  heartbeat,
  deactivateActivation,
  ActivationError,
} = require('../services/activationService');

/**
 * Handles all four customer protocol operations behind one entry point.
 * This is the "customer protocol API" side of the security boundary —
 * it never grants administrative privileges.
 *
 * Idempotency (FIX #1): the requestId is atomically claimed before any
 * side-effecting operation runs. Only the caller that wins the claim
 * executes the operation; everyone else either replays the stored
 * result or is told the request is still in flight. A signed response
 * is only ever persisted once the operation has actually finished.
 */
async function handleProtocolRequest(req, res) {
  let body;
  try {
    body = validateProtocolRequest(req.body);
  } catch (err) {
    if (err instanceof RequestValidationError) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    throw err;
  }

  const { operation, requestId, licenseId, activationId } = body;

  let claim;
  try {
    claim = await claimRequest({
      requestId,
      operation,
      licenseContext: licenseId,
      activationContext: activationId || null,
    });
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return res.status(409).json({ error: err.code, message: err.message });
    }
    if (err instanceof IdempotencyBusyError) {
      return res.status(409).json({ error: err.code, message: err.message });
    }
    throw err;
  }

  if (!claim.claimed) {
    // Already completed previously: replay the exact signed response.
    return res.status(200).json(claim.response);
  }

  let result;
  try {
    switch (operation) {
      case 'ACTIVATE':
        result = await handleActivate(body);
        break;
      case 'VALIDATE':
        result = await handleValidate(body);
        break;
      case 'HEARTBEAT':
        result = await handleHeartbeat(body);
        break;
      case 'DEACTIVATE':
        result = await handleDeactivate(body);
        break;
      default:
        // Unreachable: validateProtocolRequest already restricts this.
        await failRequest({ requestId });
        return res.status(400).json({ error: 'UNSUPPORTED_OPERATION' });
    }
  } catch (err) {
    if (err instanceof ActivationError) {
      // A well-understood, expected failure (e.g. domain not allowed,
      // limit reached). This IS the final outcome for this requestId —
      // sign and persist it so retries get the same answer.
      const response = buildSignedResponse({
        operation,
        requestId,
        success: false,
        code: err.code,
        message: err.message,
        data: {},
      });
      await completeRequest({ requestId, response });
      return res.status(200).json(response);
    }

    // Unexpected internal error: never sign or persist a trusted
    // response for it (FIX #7). Mark the claim FAILED so the request
    // can be safely retried later instead of deadlocking.
    await failRequest({ requestId });
    throw err;
  }

  try {
    const response = buildSignedResponse({
      operation,
      requestId,
      success: true,
      code: 'OK',
      message: result.message || '',
      data: result.data || {},
    });

    await completeRequest({ requestId, response });

    return res.status(200).json(response);
  } catch (err) {
    // A signing failure or a database error while persisting the
    // completed response must never be reported as, or leave behind, a
    // trusted successful response (FIX #7). Mark the claim FAILED so a
    // retry can safely re-run the operation later.
    await failRequest({ requestId });
    throw err;
  }
}

async function handleActivate(body) {
  const activation = await activateLicense({
    licenseId: body.licenseId,
    domain: body.domain,
    fingerprintHash: body.fingerprintHash,
    environment: body.environment,
    appVersion: body.appVersion,
    buildId: body.buildId,
  });

  return {
    data: {
      activationId: activation.activationId,
      status: activation.status,
    },
  };
}

async function handleValidate(body) {
  const { valid, code, license } = await validateLicense(body.licenseId);

  return {
    data: {
      valid,
      status: license ? license.status : 'unknown',
      features: license ? license.features : [],
      expiresAt: license && license.expiresAt ? license.expiresAt.toISOString() : null,
    },
    message: code,
  };
}

async function handleHeartbeat(body) {
  // Deliberately does NOT forward body.buildId — heartbeat must never be
  // able to move an activation to a different build (FIX #3/#4).
  const activation = await heartbeat({
    licenseId: body.licenseId,
    activationId: body.activationId,
  });

  return {
    data: { activationId: activation.activationId, lastSeenAt: activation.lastSeenAt.toISOString() },
  };
}

async function handleDeactivate(body) {
  const activation = await deactivateActivation({
    licenseId: body.licenseId,
    activationId: body.activationId,
  });

  return {
    data: { activationId: activation.activationId, status: activation.status },
  };
}

module.exports = { handleProtocolRequest };
