'use strict';

const { Schema, model } = require('mongoose');

const EVENT_TYPES = [
  'LICENSE_CREATED',
  'LICENSE_ACTIVATED',
  'LICENSE_VALIDATED',
  'LICENSE_DEACTIVATED',
  'LICENSE_EXPIRED',
  'LICENSE_REVOKED',
  'LICENSE_SUSPENDED',
  'LICENSE_REACTIVATED',
  'LICENSE_RENEWED',
  'DOMAIN_CHANGED',
  'FINGERPRINT_CHANGED',
  'ACTIVATION_LIMIT_REACHED',
  'ACTIVATION_LIMIT_CHANGED',
  'FEATURES_UPDATED',
  'BUILD_ID_CHANGED',
  'INVALID_LICENSE',
  'INVALID_SIGNATURE',
  'LICENSE_DOMAIN_NOT_ALLOWED',
  'SUSPICIOUS_ACTIVITY',
];

const licenseEventSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
      index: true,
    },

    licenseId: {
      type: String,
      default: null,
      index: true,
    },

    activationId: {
      type: String,
      default: null,
      index: true,
    },

    // Free-form but deliberately descriptive metadata. Callers are
    // responsible for never passing secrets here — see
    // utils/assertNoSecrets.js, which the event service runs on every
    // write as a defensive check.
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

licenseEventSchema.index({ licenseId: 1, createdAt: -1 });
licenseEventSchema.index({ eventType: 1, createdAt: -1 });
licenseEventSchema.index({ activationId: 1, createdAt: -1 });

const LicenseEvent = model('LicenseEvent', licenseEventSchema);

module.exports = { LicenseEvent, EVENT_TYPES };
