'use strict';

const { Schema, model } = require('mongoose');

const LICENSE_TYPES = ['standard', 'source-code', 'resale', 'enterprise'];
const LICENSE_STATUSES = ['active', 'suspended', 'expired', 'revoked'];

const licenseSchema = new Schema(
  {
    licenseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // Opaque reference to the customer record. This server does not
    // store customer PII — just an external reference id owned by
    // whatever system issues licenses (e.g. a store/order id).
    customerReference: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: LICENSE_TYPES,
      required: true,
    },

    status: {
      type: String,
      enum: LICENSE_STATUSES,
      required: true,
      default: 'active',
    },

    // Empty array = unrestricted (see domain validation service).
    allowedDomains: {
      type: [String],
      default: [],
    },

    maxActivations: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },

    // Denormalized counter kept in sync atomically by the activation
    // service (see STEP 10 — never read-modify-write in application code).
    activeActivationCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    features: {
      type: [String],
      default: [],
    },

    buildId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

licenseSchema.index({ status: 1 });
licenseSchema.index({ customerReference: 1 });

const License = model('License', licenseSchema);

module.exports = { License, LICENSE_TYPES, LICENSE_STATUSES };
