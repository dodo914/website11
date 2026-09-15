'use strict';

const { normalizeDomain } = require('../utils/normalizeDomain');

/**
 * Returns true if `requestDomain` is allowed for a license with the given
 * `allowedDomains` list.
 *
 * - Empty allowedDomains => unrestricted (always true).
 * - Otherwise the normalized request domain must match one of the
 *   normalized allowed domains.
 */
function isDomainAllowed(allowedDomains, requestDomain) {
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) {
    return true;
  }

  const normalizedRequest = normalizeDomain(requestDomain);
  if (!normalizedRequest) return false;

  const normalizedAllowed = allowedDomains.map(normalizeDomain);
  return normalizedAllowed.includes(normalizedRequest);
}

module.exports = { isDomainAllowed };
