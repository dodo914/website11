'use strict';

/**
 * Central configuration loader for the LAVA License Server.
 *
 * IMPORTANT: This module never hardcodes secrets. All sensitive values
 * come from environment variables (see .env.example). This file only
 * defines safe defaults for non-sensitive settings.
 */

require('dotenv').config();

const REQUIRED_IN_PRODUCTION = [
  'LICENSE_SERVER_MONGO_URI',
  'LICENSE_SERVER_PRIVATE_KEY',
  'LICENSE_SERVER_ADMIN_API_KEY',
];

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',

  mongoUri: process.env.LICENSE_SERVER_MONGO_URI || '',

  // Ed25519 private key material (base64). Only ever read here, only ever
  // used inside src/license/signingService.js. Never logged, never
  // returned from any controller/route, never persisted.
  privateKeyB64: process.env.LICENSE_SERVER_PRIVATE_KEY || '',
  publicKeyId: process.env.LICENSE_SERVER_PUBLIC_KEY_ID || 'key-1',

  port: parseInt(process.env.LICENSE_SERVER_PORT, 10) || 4000,

  protocolVersion: parseInt(process.env.LICENSE_SERVER_PROTOCOL_VERSION, 10) || 1,

  // Shared-secret credential for the administrative License Management
  // API (Control Panel). Never used by, or exposed to, customer LAVA
  // installations — those only ever talk to the customer protocol
  // endpoint, which never reads this value.
  adminApiKey: process.env.LICENSE_SERVER_ADMIN_API_KEY || '',
};

function assertProductionConfig() {
  if (config.nodeEnv !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`
    );
  }
}

module.exports = { config, assertProductionConfig };
