'use strict';

const express = require('express');
const adminLicenseController = require('../controllers/adminLicenseController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// Every route in this router requires administrative authentication
// (PART 3B, STEP 14/15). This router is mounted separately from the
// customer protocol router (routes/licenseRoutes.js) — a customer LAVA
// installation has no path to any of these routes.
router.use(adminAuth);

router.post('/', asyncHandler(adminLicenseController.createLicense));
router.get('/', asyncHandler(adminLicenseController.listLicenses));
router.get('/:licenseId', asyncHandler(adminLicenseController.getLicense));

router.post('/:licenseId/suspend', asyncHandler(adminLicenseController.suspendLicense));
router.post('/:licenseId/reactivate', asyncHandler(adminLicenseController.reactivateLicense));
router.post('/:licenseId/revoke', asyncHandler(adminLicenseController.revokeLicense));
router.post('/:licenseId/renew', asyncHandler(adminLicenseController.renewLicense));

router.patch('/:licenseId/domains', asyncHandler(adminLicenseController.updateDomains));
router.patch('/:licenseId/activation-limit', asyncHandler(adminLicenseController.updateActivationLimit));
router.patch('/:licenseId/features', asyncHandler(adminLicenseController.updateFeatures));
router.patch('/:licenseId/build', asyncHandler(adminLicenseController.updateBuildId));

module.exports = router;
