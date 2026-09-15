'use strict';

/**
 * Normalizes a domain string for consistent comparison.
 *
 * Mirrors the normalization principles expected by the customer-side
 * LAVA implementation: lowercase, strip protocol, strip "www.", strip
 * path/query/hash, strip trailing dot and port.
 */
function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return '';

  let domain = input.trim().toLowerCase();

  // Strip protocol (http://, https://, etc.)
  domain = domain.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');

  // Strip any path/query/hash.
  domain = domain.split('/')[0];

  // Strip credentials if present (user:pass@host).
  domain = domain.split('@').pop();

  // Strip port.
  domain = domain.split(':')[0];

  // Strip leading "www."
  domain = domain.replace(/^www\./, '');

  // Strip trailing dot.
  domain = domain.replace(/\.$/, '');

  return domain;
}

module.exports = { normalizeDomain };
