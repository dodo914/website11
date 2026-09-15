'use strict';

const licenseService = require('../services/licenseService');
const { LicenseServiceError } = licenseService;
const { toAdminLicenseView } = require('../services/licenseSerializer');
const { claimRequest, completeRequest, failRequest } = require('../services/idempotencyService');

/**
 * Administrative License Management API (PART 3B).
 *
 * This is entirely separate from the customer LAVA protocol
 * (controllers/licenseProtocolController.js): it is mounted under
 * /api/v1/admin/licenses, guarded by middleware/adminAuth.js, and a
 * customer installation has no path to reach it. None of these
 * handlers accept or trust any lifecycle/state field from the request
 * body beyond what each specific operation is explicitly documented to
 * change — see licenseService.js for the validated, transition-guarded
 * implementations.
 */

// Maps LicenseServiceError codes to HTTP status codes. Falls back to
// 400 for anything else (validation-shaped errors), since every code
// this service throws is a caller-input or state problem, never an
// internal error (those are unexpected exceptions and are left to
// asyncHandler -> errorHandler, which never leaks details either).
const STATUS_BY_CODE = {
  LICENSE_NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  LICENSE_REVOKED: 409,
  INVALID_LICENSE_STATE: 409,
  RENEW_CONFLICT: 409,
};

function sendServiceError(res, err) {
  if (err instanceof LicenseServiceError) {
    const status = STATUS_BY_CODE[err.code] || 400;
    return res.status(status).json({ error: err.code, message: err.message });
  }
  throw err;
}

async function createLicense(req, res) {
  try {
    const license = await licenseService.createLicense(req.body || {});
    return res.status(201).json({ license: toAdminLicenseView(license) });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

async function getLicense(req, res) {
  const license = await licenseService.getLicense(req.params.licenseId);
  if (!license) {
    return res.status(404).json({ error: 'LICENSE_NOT_FOUND', message: 'License not found.' });
  }
  return res.status(200).json({ license: toAdminLicenseView(license) });
}

async function listLicenses(req, res) {
  try {
    const { status, type, customerReference, expiresBefore, expiresAfter, page, pageSize } = req.query;
    const result = await licenseService.listLicenses({
      status,
      type,
      customerReference,
      expiresBefore,
      expiresAfter,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return res.status(200).json({
      items: result.items.map(toAdminLicenseView),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

async function suspendLicense(req, res) {
  try {
    const license = await licenseService.suspendLicense(req.params.licenseId);
    return res.status(200).json({ license: toAdminLicenseView(license) });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

async function reactivateLicense(req, res) {
  try {
    const license = await licenseService.reactivateLicense(req.params.licenseId);
    return res.status(200).json({ license: toAdminLicenseView(license) });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

async function revokeLicense(req, res) {
  try {
    const license = await licenseService.revokeLicense(req.params.licenseId);
    return res.status(200).json({ license: toAdminLicenseView(license) });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

/**
 * Renewal is the one administrative operation explicitly designed for
 * future payment-webhook retries (PART 3B, STEP 18): if the caller
 * supplies a `requestId`, the same requestId can never renew the
 * license twice — it reuses the exact claim/complete/fail idempotency
 * primitives already used by the customer protocol. If no requestId is
 * supplied (e.g. an operator manually triggering a renewal from a
 * Control Panel button), the renewal simply runs once, immediately.
 */
async function renewLicense(req, res) {
  const { licenseId } = req.params;
  const { durationDays, paymentReference, metadata, requestId } = req.body || {};

  if (!requestId) {
    try {
      const license = await licenseService.renewLicense({ licenseId, durationDays, paymentReference, metadata });
      return res.status(200).json({ license: toAdminLicenseView(license) });
    } catch (err) {
      return sendServiceError(res, err);
    }
  }

  let claim;
  try {
    claim = await claimRequest({ requestId, operation: 'ADMIN_RENEW', licenseContext: licenseId });
  } catch (err) {
    return res.status(409).json({ error: err.code || 'REQUEST_CONFLICT', message: err.message });
  }

  if (!claim.claimed) {
    return res.status(claim.response.status).json(claim.response.body);
  }

  let status = 200;
  let responseBody;
  try {
    const license = await licenseService.renewLicense({ licenseId, durationDays, paymentReference, metadata });
    responseBody = { license: toAdminLicenseView(license) };
  } catch (err) {
    if (err instanceof LicenseServiceError) {
      status = STATUS_BY_CODE[err.code] || 400;
      responseBody = { error: err.code, message: err.message };
      await completeRequest({ requestId, response: { status, body: responseBody } });
      return res.status(status).json(responseBody);
    }
    await failRequest({ requestId });
    throw err;
  }

  await completeRequest({ requestId, response: { status, body: responseBody } });
  return res.status(status).json(responseBody);
}

async function updateDomains(req, res) {
  try {
    const license = await licenseService.changeAllowedDomains(req.params.licenseId, req.body?.allowedDomains || []);
    return res.status(200).json({ license: toAdminLicenseView(license) });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

async function updateActivationLimit(req, res) {
  try {
    const license = await licenseService.changeActivationLimit(req.params.licenseId, req.body?.maxActivations);
    return res.status(200).json({ license: toAdminLicenseView(license) });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

async function updateFeatures(req, res) {
  try {
    const license = await licenseService.updateFeatures(req.params.licenseId, req.body?.features || []);
    return res.status(200).json({ license: toAdminLicenseView(license) });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

async function updateBuildId(req, res) {
  try {
    const license = await licenseService.updateBuildId(req.params.licenseId, req.body?.buildId ?? null);
    return res.status(200).json({ license: toAdminLicenseView(license) });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

module.exports = {
  createLicense,
  getLicense,
  listLicenses,
  suspendLicense,
  reactivateLicense,
  revokeLicense,
  renewLicense,
  updateDomains,
  updateActivationLimit,
  updateFeatures,
  updateBuildId,
};
