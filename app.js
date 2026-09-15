'use strict';

const express = require('express');
const licenseRoutes = require('./routes/licenseRoutes');
const adminLicenseRoutes = require('./routes/adminLicenseRoutes');
const { errorHandler } = require('./middleware/errorHandler');

/**
 * Builds the Express app. Kept separate from server.js so tests can
 * import the app without binding a port or connecting to a real DB.
 *
 * Route boundary (STEP 13 / PART 3B STEP 14):
 *   /api/v1/license/...        customer protocol — unauthenticated
 *                               envelope, but never grants
 *                               administrative capabilities.
 *   /api/v1/admin/licenses/... administrative License Management API
 *                               (PART 3B) — requires adminAuth on every
 *                               route; a customer installation has no
 *                               path to reach it.
 */
function createApp() {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/v1/license', licenseRoutes);
  app.use('/api/v1/admin/licenses', adminLicenseRoutes);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
