const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load .env file manually to ensure it's loaded
const envPath = path.resolve(__dirname, '../.env');
console.log('Looking for .env at:', envPath);
console.log('.env exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  lines.forEach((line, idx) => {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    // Remove BOM if present
    if (trimmed.charCodeAt(0) === 65279) {
      trimmed = trimmed.slice(1);
    }
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      console.log(`Line ${idx}: key="${key}", value length=${value.length}`);
      if (key && !process.env[key]) {
        process.env[key] = value;
        console.log(`Loaded env: ${key} (length: ${value.length})`);
      }
    }
  });
}

console.log('MONGODB_URI loaded:', process.env.MONGODB_URI ? 'Yes' : 'No');

let connectionPromise = null;

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    if (connectionPromise) {
      return connectionPromise;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('Available env vars:', Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY')));
      throw new Error('MONGODB_URI is not defined in .env file');
    }

    connectionPromise = mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      family: 4,
    });

    const conn = await connectionPromise;
    console.log(`MongoDB Connected ✅ (${conn.connection.host})`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    return conn;
  } catch (err) {
    connectionPromise = null;
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
};

module.exports = connectDB;