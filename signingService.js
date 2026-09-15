'use strict';

const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');
const { config } = require('../config/env');
const { buildCanonicalPayload } = require('./canonicalPayload');

/**
 * Ed25519 signing service for the License Server.
 *
 * SECURITY:
 * - The private key is read ONLY from config (env var
 *   LICENSE_SERVER_PRIVATE_KEY) and is held ONLY in memory in this module.
 * - This module never logs, returns, or persists the private key.
 * - Nothing in this file writes the key to the database, to an event, or
 *   to any HTTP response.
 */

let cachedKeyPair = null;

function decodeKeyMaterial(base64Key) {
  const raw = naclUtil.decodeBase64(base64Key);

  if (raw.length === nacl.sign.seedLength) {
    // 32-byte seed — derive the full key pair from it.
    return nacl.sign.keyPair.fromSeed(raw);
  }
  if (raw.length === nacl.sign.secretKeyLength) {
    // 64-byte secret key (seed + public key already concatenated).
    return nacl.sign.keyPair.fromSecretKey(raw);
  }

  throw new Error(
    `Invalid LICENSE_SERVER_PRIVATE_KEY length: expected ${nacl.sign.seedLength} or ${nacl.sign.secretKeyLength} bytes, got ${raw.length}.`
  );
}

/**
 * Lazily loads and caches the signing key pair from config.
 * Accepts an optional explicit base64 key (used by tests) so tests never
 * need to touch process.env directly.
 */
function getKeyPair(explicitBase64Key) {
  if (explicitBase64Key) {
    return decodeKeyMaterial(explicitBase64Key);
  }
  if (!cachedKeyPair) {
    if (!config.privateKeyB64) {
      throw new Error(
        'LICENSE_SERVER_PRIVATE_KEY is not configured. Cannot sign responses.'
      );
    }
    cachedKeyPair = decodeKeyMaterial(config.privateKeyB64);
  }
  return cachedKeyPair;
}

/**
 * Signs the canonical protocol payload and returns a base64 signature.
 */
function signPayload(payloadFields, options = {}) {
  const keyPair = getKeyPair(options.privateKeyB64);
  const canonical = buildCanonicalPayload(payloadFields);
  const messageBytes = naclUtil.decodeUTF8(canonical);
  const signatureBytes = nacl.sign.detached(messageBytes, keyPair.secretKey);
  return naclUtil.encodeBase64(signatureBytes);
}

/**
 * Verifies a signature against a canonical payload using a PUBLIC key.
 * Provided for the compatibility test (STEP 16) — this never touches the
 * private key.
 */
function verifyPayload(payloadFields, signatureB64, publicKeyB64) {
  const canonical = buildCanonicalPayload(payloadFields);
  const messageBytes = naclUtil.decodeUTF8(canonical);
  const signatureBytes = naclUtil.decodeBase64(signatureB64);
  const publicKeyBytes = naclUtil.decodeBase64(publicKeyB64);
  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
}

/**
 * Returns the base64 public key for a given key pair. Safe to expose —
 * this is what gets distributed to the customer-side installation.
 */
function getPublicKeyB64(explicitBase64Key) {
  const keyPair = getKeyPair(explicitBase64Key);
  return naclUtil.encodeBase64(keyPair.publicKey);
}

/** Test/ops helper: generates a fresh Ed25519 key pair (base64-encoded). */
function generateKeyPairB64() {
  const keyPair = nacl.sign.keyPair();
  return {
    privateKeyB64: naclUtil.encodeBase64(keyPair.secretKey),
    publicKeyB64: naclUtil.encodeBase64(keyPair.publicKey),
  };
}

module.exports = {
  signPayload,
  verifyPayload,
  getPublicKeyB64,
  generateKeyPairB64,
};
