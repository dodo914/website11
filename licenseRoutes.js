'use strict';

const express = require('express');
const { handleProtocolRequest } = require('../controllers/licenseProtocolController');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

// Single protocol entry point for the customer-facing LAVA installation.
// operation (ACTIVATE / VALIDATE / HEARTBEAT / DEACTIVATE) is carried in
// the request body per the protocol envelope, not the URL, to match the
// existing customer-side protocol foundation.
router.post('/', asyncHandler(handleProtocolRequest));

module.exports = router;
