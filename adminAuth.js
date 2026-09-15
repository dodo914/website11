'use strict';

const crypto = require('crypto');
const { config } = require('../config/env');

/**
 * Minimum secure authentication boundary for the administrative License
 * Management API (PART 3B, STEP 14/15).
 *
 * This is deliberately simple: a single long-lived shared secret
 * (LICENSE_SERVER_ADMIN_API_KEY) that only the owner's Control Panel
 * backend holds, sent as either:
 *
 *   Authorization: Bearer <key>
 *   X-Admin-Api-Key: <key>
 *
 * This is NOT a user-management system (no accounts, roles, sessions) —
 * that is explicitly out of scope for this phase. It exists purely to
 * make sure a customer LAVA installation (which only ever talks to the
 * separate, unauthenticated customer protocol endpoint) can never reach
 * these endpoints, and that they aren't accidentally exposed with zero
 * authorization.
 *
 * Never logs the configured key or the value the caller supplied.
 */
function extractProvidedKey(req) {
  const authHeader = req.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const headerKey = req.get('x-admin-api-key');
  if (headerKey) return headerKey.trim();

  return null;
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length buffers so the response
    // time doesn't trivially leak the correct key's length.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function adminAuth(req, res, next) {
  if (!config.adminApiKey) {
    // Fails closed: an unconfigured admin key means the admin API can
    // never be used, not that it's wide open.
    return res.status(503).json({
      error: 'ADMIN_API_NOT_CONFIGURED',
      message: 'The administrative API is not configured on this server.',
    });
  }

  const provided = extractProvidedKey(req);
  if (!provided || !timingSafeEqual(provided, config.adminApiKey)) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid administrative credentials.',
    });
  }

  return next();
}

module.exports = { adminAuth };
