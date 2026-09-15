'use strict';

const { Schema, model } = require('mongoose');

const ACTIVATION_STATUSES = ['active', 'deactivated'];
const ENVIRONMENTS = ['production', 'staging', 'development'];

const licenseActivationSchema = new Schema(
  {
    activationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    licenseId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    // A one-way hash of the installation fingerprint, never the raw
    // fingerprint, hardware serial, or browser fingerprint itself.
    fingerprintHash: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ACTIVATION_STATUSES,
      required: true,
      default: 'active',
    },

    environment: {
      type: String,
      enum: ENVIRONMENTS,
      default: 'production',
    },

    appVersion: {
      type: String,
      default: null,
    },

    buildId: {
      type: String,
      default: null,
    },

    activatedAt: {
      type: Date,
      default: Date.now,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },

    deactivatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce activation uniqueness at the database level: one active
// (license, domain, fingerprint) combination at a time.
licenseActivationSchema.index(
  { licenseId: 1, domain: 1, fingerprintHash: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

licenseActivationSchema.index({ licenseId: 1, status: 1 });

const LicenseActivation = model('LicenseActivation', licenseActivationSchema);

module.exports = { LicenseActivation, ACTIVATION_STATUSES, ENVIRONMENTS };
