'use strict';

const mongoose = require('mongoose');
const { config } = require('./env');

/**
 * Connects to the License Server's dedicated MongoDB database.
 *
 * This is intentionally isolated from any LAVA Store customer database:
 * it only ever reads LICENSE_SERVER_MONGO_URI, and this project has no
 * knowledge of / dependency on the LAVA Store's connection details.
 */
async function connectDb(uri = config.mongoUri) {
  if (!uri) {
    throw new Error(
      'LICENSE_SERVER_MONGO_URI is not set. Refusing to connect with an empty URI.'
    );
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    // Modern mongoose driver options are mostly defaulted; kept explicit
    // here for clarity and future tuning.
    autoIndex: config.nodeEnv !== 'production',
  });

  return mongoose.connection;
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = { connectDb, disconnectDb, mongoose };
