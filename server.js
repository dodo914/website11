'use strict';

const { createApp } = require('./app');
const { connectDb } = require('./config/db');
const { config, assertProductionConfig } = require('./config/env');

async function start() {
  assertProductionConfig();

  await connectDb();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[LAVA License Server] listening on port ${config.port} (${config.nodeEnv})`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[LAVA License Server] Failed to start:', err);
    process.exit(1);
  });
}

module.exports = { start };
