'use strict';

const { randomUUID } = require('crypto');
const { License, LICENSE_TYPES, LICENSE_STATUSES } = require('../models/License');
const { recordEvent } = require('./eventService');
const { normalizeDomain } = require('../utils/normalizeDomain');

class LicenseServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LicenseServiceError';
    this.code = code;
  }
}

const MAX_CAS_RETRIES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function assertValidType(type) {
  if (!LICENSE_TYPES.includes(type)) {
    throw new LicenseServiceError(`Invalid license type: ${type}`, 'INVALID_LICENSE_TYPE');
  }
}

function generateLicenseId() {
  return `LAVA-${randomUUID().toUpperCase()}`;
}

function normalizeDomainList(domains) {
  if (!Array.isArray(domains)) {
    throw new LicenseServiceError('allowedDomains must be an array of strings.', 'INVALID_DOMAIN');
  }
  const normalized = [];
  const seen = new Set();
  for (const raw of domains) {
    const domain = normalizeDomain(raw);
    if (!domain) {
      throw new LicenseServiceError(`Invalid domain: ${raw}`, 'INVALID_DOMAIN');
    }
    if (!seen.has(domain)) {
      seen.add(domain);
      normalized.push(domain);
    }
  }
  return normalized;
}

function assertValidMaxActivations(maxActivations) {
  if (!Number.isInteger(maxActivations) || maxActivations < 0) {
    throw new LicenseServiceError(
      'maxActivations must be a non-negative integer.',
      'ACTIVATION_LIMIT_INVALID'
    );
  }
}

function normalizeFeatureList(features) {
  if (!Array.isArray(features)) {
    throw new LicenseServiceError('features must be an array of strings.', 'INVALID_FEATURES');
  }
  const normalized = [];
  const seen = new Set();
  for (const raw of features) {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new LicenseServiceError('Each feature must be a non-empty string.', 'INVALID_FEATURES');
    }
    const feature = raw.trim();
    if (!seen.has(feature)) {
      seen.add(feature);
      normalized.push(feature);
    }
  }
  return normalized;
}

function assertValidBuildId(buildId) {
  if (buildId === null || buildId === undefined) return;
  if (typeof buildId !== 'string' || buildId.trim().length === 0) {
    throw new LicenseServiceError('buildId must be a non-empty string or null.', 'INVALID_BUILD_ID');
  }
}

async function createLicense({
  licenseId,
  customerReference,
  type,
  allowedDomains = [],
  maxActivations = 1,
  expiresAt = null,
  features = [],
  buildId = null,
}) {
  assertValidType(type);
  assertValidMaxActivations(maxActivations);
  assertValidBuildId(buildId);
  const normalizedDomains = normalizeDomainList(allowedDomains);
  const normalizedFeatures = normalizeFeatureList(features);

  if (expiresAt !== null && Number.isNaN(new Date(expiresAt).getTime())) {
    throw new LicenseServiceError('expiresAt must be a valid date or null.', 'INVALID_EXPIRATION');
  }

  if (!customerReference || typeof customerReference !== 'string') {
    throw new LicenseServiceError('customerReference is required.', 'INVALID_CUSTOMER_REFERENCE');
  }

  const license = await License.create({
    licenseId: licenseId || generateLicenseId(),
    customerReference,
    type,
    status: 'active',
    allowedDomains: normalizedDomains,
    maxActivations,
    activeActivationCount: 0,
    issuedAt: new Date(),
    activatedAt: null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    features: normalizedFeatures,
    buildId,
  });

  await recordEvent({ eventType: 'LICENSE_CREATED', licenseId: license.licenseId });

  return license;
}

async function getLicense(licenseId) {
  return License.findOne({ licenseId });
}

async function listLicenses({
  status,
  type,
  customerReference,
  expiresBefore,
  expiresAfter,
  page = 1,
  pageSize = 25,
} = {}) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 25;

  const filter = {};
  if (status) {
    if (!LICENSE_STATUSES.includes(status)) {
      throw new LicenseServiceError(`Invalid status filter: ${status}`, 'INVALID_LICENSE_STATUS');
    }
    filter.status = status;
  }
  if (type) {
    if (!LICENSE_TYPES.includes(type)) {
      throw new LicenseServiceError(`Invalid type filter: ${type}`, 'INVALID_LICENSE_TYPE');
    }
    filter.type = type;
  }
  if (customerReference) filter.customerReference = customerReference;
  if (expiresBefore || expiresAfter) {
    filter.expiresAt = {};
    if (expiresBefore) filter.expiresAt.$lt = new Date(expiresBefore);
    if (expiresAfter) filter.expiresAt.$gt = new Date(expiresAfter);
  }

  const skip = (safePage - 1) * safePageSize;
  const [items, total] = await Promise.all([
    License.find(filter).skip(skip).limit(safePageSize),
    License.countDocuments(filter),
  ]);

  return { items, page: safePage, pageSize: safePageSize, total };
}

async function validateLicense(licenseId) {
  const license = await License.findOne({ licenseId });

  if (!license) {
    return { valid: false, code: 'INVALID_LICENSE', license: null };
  }

  if (license.expiresAt && license.expiresAt.getTime() < Date.now() && license.status === 'active') {
    license.status = 'expired';
    await license.save();
    await recordEvent({ eventType: 'LICENSE_EXPIRED', licenseId });
  }

  return { valid: license.status === 'active', code: license.status.toUpperCase(), license };
}

async function revokeLicense(licenseId) {
  const license = await License.findOneAndUpdate(
    { licenseId, status: { $in: ['active', 'suspended', 'expired'] } },
    { $set: { status: 'revoked' } },
    { new: true }
  );
  if (license) {
    await recordEvent({ eventType: 'LICENSE_REVOKED', licenseId });
    return license;
  }

  const existing = await License.findOne({ licenseId }).lean();
  if (!existing) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  if (existing.status === 'revoked') return existing;
  throw new LicenseServiceError('License cannot be revoked from its current state.', 'INVALID_TRANSITION');
}

async function suspendLicense(licenseId) {
  const license = await License.findOneAndUpdate(
    { licenseId, status: 'active' },
    { $set: { status: 'suspended' } },
    { new: true }
  );
  if (license) {
    await recordEvent({ eventType: 'LICENSE_SUSPENDED', licenseId });
    return license;
  }

  const existing = await License.findOne({ licenseId }).lean();
  if (!existing) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  if (existing.status === 'revoked') {
    throw new LicenseServiceError('A revoked license cannot be suspended.', 'LICENSE_REVOKED');
  }
  if (existing.status === 'suspended') return existing;
  throw new LicenseServiceError('License cannot be suspended from its current state.', 'INVALID_TRANSITION');
}

async function reactivateLicense(licenseId) {
  const license = await License.findOneAndUpdate(
    { licenseId, status: 'suspended' },
    { $set: { status: 'active' } },
    { new: true }
  );
  if (!license) {
    const existing = await License.findOne({ licenseId }).lean();
    if (!existing) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
    if (existing.status === 'revoked') {
      throw new LicenseServiceError('A revoked license cannot be reactivated.', 'LICENSE_REVOKED');
    }
    throw new LicenseServiceError(
      'License not found or not in a reactivatable state.',
      'INVALID_LICENSE_STATE'
    );
  }

  await recordEvent({ eventType: 'LICENSE_REACTIVATED', licenseId });
  return license;
}

async function renewLicense({ licenseId, durationDays, paymentReference = null, metadata = {} }) {
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    throw new LicenseServiceError('durationDays must be a positive number.', 'INVALID_EXPIRATION');
  }

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt += 1) {
    const current = await License.findOne({ licenseId });
    if (!current) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
    if (current.status === 'revoked') {
      throw new LicenseServiceError('A revoked license cannot be renewed.', 'LICENSE_REVOKED');
    }

    const now = Date.now();
    const base = current.expiresAt && current.expiresAt.getTime() > now ? current.expiresAt.getTime() : now;
    const newExpiresAt = new Date(base + durationDays * DAY_MS);

    const update = { $set: { expiresAt: newExpiresAt } };
    if (current.status === 'expired') {
      update.$set.status = 'active';
    }

    const updated = await License.findOneAndUpdate(
      { licenseId, expiresAt: current.expiresAt },
      update,
      { new: true }
    );

    if (updated) {
      await recordEvent({
        eventType: 'LICENSE_RENEWED',
        licenseId,
        metadata: {
          previousExpiresAt: current.expiresAt,
          newExpiresAt,
          durationDays,
          paymentReference,
          ...metadata,
        },
      });
      return updated;
    }
  }

  throw new LicenseServiceError(
    'Could not renew license due to concurrent updates; please retry.',
    'RENEW_CONFLICT'
  );
}

async function changeAllowedDomains(licenseId, allowedDomains) {
  const normalized = normalizeDomainList(allowedDomains);

  const license = await License.findOneAndUpdate(
    { licenseId, status: { $ne: 'revoked' } },
    { $set: { allowedDomains: normalized } },
    { new: true }
  );
  if (!license) {
    const existing = await License.findOne({ licenseId }).lean();
    if (!existing) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
    throw new LicenseServiceError('A revoked license cannot be modified.', 'LICENSE_REVOKED');
  }

  await recordEvent({
    eventType: 'DOMAIN_CHANGED',
    licenseId,
    metadata: { allowedDomains: normalized },
  });
  return license;
}

async function changeActivationLimit(licenseId, maxActivations) {
  assertValidMaxActivations(maxActivations);

  const license = await License.findOneAndUpdate(
    {
      licenseId,
      status: { $ne: 'revoked' },
      activeActivationCount: { $lte: maxActivations },
    },
    { $set: { maxActivations } },
    { new: true }
  );
  if (license) {
    await recordEvent({
      eventType: 'ACTIVATION_LIMIT_CHANGED',
      licenseId,
      metadata: { maxActivations },
    });
    return license;
  }

  const existing = await License.findOne({ licenseId }).lean();
  if (!existing) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
  if (existing.status === 'revoked') {
    throw new LicenseServiceError('A revoked license cannot be modified.', 'LICENSE_REVOKED');
  }
  throw new LicenseServiceError(
    `maxActivations cannot be set below the current active activation count (${existing.activeActivationCount}).`,
    'ACTIVATION_LIMIT_INVALID'
  );
}

async function updateFeatures(licenseId, features) {
  const normalized = normalizeFeatureList(features);

  const license = await License.findOneAndUpdate(
    { licenseId, status: { $ne: 'revoked' } },
    { $set: { features: normalized } },
    { new: true }
  );
  if (!license) {
    const existing = await License.findOne({ licenseId }).lean();
    if (!existing) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
    throw new LicenseServiceError('A revoked license cannot be modified.', 'LICENSE_REVOKED');
  }

  await recordEvent({
    eventType: 'FEATURES_UPDATED',
    licenseId,
    metadata: { features: normalized },
  });
  return license;
}

async function updateBuildId(licenseId, buildId) {
  assertValidBuildId(buildId);

  const license = await License.findOneAndUpdate(
    { licenseId, status: { $ne: 'revoked' } },
    { $set: { buildId: buildId ?? null } },
    { new: true }
  );
  if (!license) {
    const existing = await License.findOne({ licenseId }).lean();
    if (!existing) throw new LicenseServiceError('License not found.', 'LICENSE_NOT_FOUND');
    throw new LicenseServiceError('A revoked license cannot be modified.', 'LICENSE_REVOKED');
  }

  await recordEvent({
    eventType: 'BUILD_ID_CHANGED',
    licenseId,
    metadata: { buildId: buildId ?? null },
  });
  return license;
}

module.exports = {
  LicenseServiceError,
  LICENSE_TYPES,
  LICENSE_STATUSES,
  generateLicenseId,
  createLicense,
  getLicense,
  listLicenses,
  validateLicense,
  revokeLicense,
  suspendLicense,
  reactivateLicense,
  renewLicense,
  changeAllowedDomains,
  changeActivationLimit,
  updateFeatures,
  updateBuildId,
};
