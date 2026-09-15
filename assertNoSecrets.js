'use strict';

/**
 * Defensive check run before any LicenseEvent (or other audit record) is
 * persisted. Not a substitute for careful call-site discipline, but a
 * last line of defense against accidentally logging sensitive fields.
 */
const FORBIDDEN_KEYS = [
  'privateKey',
  'private_key',
  'licenseServerPrivateKey',
  'password',
  'apiSecret',
  'api_secret',
  'secret',
  'installationId',
  'installation_id',
  'hardwareSerial',
  'hardware_serial',
  'browserFingerprint',
  'browser_fingerprint',
  'mongoUri',
  'mongo_uri',
  'connectionString',
];

function containsForbiddenKey(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  for (const [key, val] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (FORBIDDEN_KEYS.some((forbidden) => normalizedKey === forbidden.toLowerCase())) {
      return true;
    }
    if (val && typeof val === 'object' && containsForbiddenKey(val, seen)) {
      return true;
    }
  }

  return false;
}

function assertNoSecrets(metadata) {
  if (containsForbiddenKey(metadata)) {
    throw new Error(
      'Refusing to persist LicenseEvent metadata: forbidden/sensitive key detected.'
    );
  }
}

module.exports = { assertNoSecrets, FORBIDDEN_KEYS };
