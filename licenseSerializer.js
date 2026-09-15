'use strict';

/**
 * Public/customer-facing view of a license (PART 3B, STEP 16).
 *
 * Deliberately excludes internal/administrative fields: MongoDB `_id`,
 * `customerReference` (an internal store/order reference, not something
 * the installed product itself needs), and Mongoose bookkeeping
 * (`__v`, `createdAt`/`updatedAt`).
 */
function toPublicLicenseView(license) {
  if (!license) return null;
  return {
    licenseId: license.licenseId,
    type: license.type,
    status: license.status,
    allowedDomains: license.allowedDomains,
    maxActivations: license.maxActivations,
    activeActivationCount: license.activeActivationCount,
    expiresAt: license.expiresAt,
    features: license.features,
    buildId: license.buildId,
  };
}

/**
 * Administrative (Control Panel) view of a license. Broader than the
 * public view, but still never includes anything that isn't a plain
 * License model field — no MongoDB `_id`/`__v`, no cryptographic
 * material (the License model never stores any), no other customer's
 * data (callers are expected to fetch/filter by licenseId already).
 */
function toAdminLicenseView(license) {
  if (!license) return null;
  return {
    licenseId: license.licenseId,
    customerReference: license.customerReference,
    type: license.type,
    status: license.status,
    allowedDomains: license.allowedDomains,
    maxActivations: license.maxActivations,
    activeActivationCount: license.activeActivationCount,
    issuedAt: license.issuedAt,
    activatedAt: license.activatedAt,
    expiresAt: license.expiresAt,
    features: license.features,
    buildId: license.buildId,
    createdAt: license.createdAt,
    updatedAt: license.updatedAt,
  };
}

/**
 * Administrative view of an activation. Excludes nothing structurally
 * sensitive (fingerprintHash is already a one-way hash, never a raw
 * fingerprint/hardware serial — see LicenseActivation model), but this
 * boundary exists so a future "expose activations to a customer"
 * feature doesn't accidentally reuse the admin view.
 */
function toAdminActivationView(activation) {
  if (!activation) return null;
  return {
    activationId: activation.activationId,
    licenseId: activation.licenseId,
    domain: activation.domain,
    fingerprintHash: activation.fingerprintHash,
    status: activation.status,
    environment: activation.environment,
    appVersion: activation.appVersion,
    buildId: activation.buildId,
    activatedAt: activation.activatedAt,
    lastSeenAt: activation.lastSeenAt,
    deactivatedAt: activation.deactivatedAt,
  };
}

module.exports = { toPublicLicenseView, toAdminLicenseView, toAdminActivationView };
