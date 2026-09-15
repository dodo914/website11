/*
 * Safe Base64 image migration.
 *
 * Usage:
 *   node scripts/migrateBase64Images.js --dry-run
 *   node scripts/migrateBase64Images.js --execute
 *
 * The script:
 * 1) Finds data:image/... values in Product images/variant images and Settings.
 * 2) Uploads the decoded bytes to Cloudinary.
 * 3) Verifies the new URL is reachable with a HEAD request.
 * 4) Writes the new URL/publicId metadata to MongoDB.
 * 5) Only after the save + verification succeeds does it remove the old data URL.
 *
 * A JSONL backup is written before each execute run so the old values are not
 * lost before migration has completed.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const Product = require('../models/Product');
const Settings = require('../models/Settings');
const {
  uploadImageToCloudinary,
} = require('../utils/uploadToCloudinary');

const EXECUTE = process.argv.includes('--execute');
const DRY_RUN = !EXECUTE || process.argv.includes('--dry-run');

const backupDir = path.resolve(__dirname, '../../migration-backups');
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(
  backupDir,
  `base64-images-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`,
);

const dataUrlPattern = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i;

const parseDataUrl = (value) => {
  const match = typeof value === 'string' ? value.match(dataUrlPattern) : null;
  if (!match) return null;
  const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return null;
  return { mime, buffer };
};

const verifyReachable = (url) => new Promise((resolve) => {
  try {
    const client = url.startsWith('https:') ? https : http;
    const req = client.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  } catch (_) {
    resolve(false);
  }
});

const backup = (payload) => {
  fs.appendFileSync(backupPath, JSON.stringify(payload) + '\n', 'utf8');
};

const migrateImageValue = async (value, targetFolder) => {
  const parsed = parseDataUrl(value);
  if (!parsed) return null;

  const uploaded = await uploadImageToCloudinary(
    parsed.buffer,
    `migrated-${Date.now()}`,
    parsed.mime,
    { folder: targetFolder },
  );

  const reachable = await verifyReachable(uploaded.secureUrl || uploaded.url);
  if (!reachable) {
    throw new Error('Migrated Cloudinary image could not be verified as reachable');
  }

  return {
    url: uploaded.secureUrl || uploaded.url,
    secureUrl: uploaded.secureUrl || uploaded.url,
    publicId: uploaded.publicId,
    assetId: uploaded.assetId || null,
    width: uploaded.width || null,
    height: uploaded.height || null,
    format: uploaded.format || null,
  };
};

const migrateProduct = async (product) => {
  let changed = false;
  const oldValues = [];

  const migrateArray = async (images, pathPrefix) => {
    if (!Array.isArray(images)) return images;
    const next = [];
    for (let index = 0; index < images.length; index += 1) {
      const item = images[index];
      const raw = typeof item === 'string' ? item : item?.url;
      const parsed = parseDataUrl(raw);
      if (!parsed) {
        next.push(item);
        continue;
      }

      oldValues.push({
        collection: 'products',
        documentId: String(product._id),
        path: `${pathPrefix}.${index}`,
        value: raw,
      });

      const migrated = await migrateImageValue(raw, 'products');
      next.push(migrated);
      changed = true;
    }
    return next;
  };

  product.images = await migrateArray(product.images, 'images');

  for (let v = 0; v < (product.variants || []).length; v += 1) {
    product.variants[v].images = await migrateArray(
      product.variants[v].images,
      `variants.${v}.images`,
    );
  }

  if (changed) {
    backup({
      timestamp: new Date().toISOString(),
      collection: 'products',
      documentId: String(product._id),
      oldValues,
    });
    if (DRY_RUN) return true;
    await product.save();
  }

  return changed;
};

const findBase64InObject = (value, pathParts = [], hits = []) => {
  if (typeof value === 'string' && dataUrlPattern.test(value)) {
    hits.push({ path: pathParts.join('.'), value });
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => findBase64InObject(item, [...pathParts, i], hits));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) =>
      findBase64InObject(item, [...pathParts, key], hits)
    );
  }
  return hits;
};

const setByPath = (object, pathParts, nextValue) => {
  let target = object;
  for (let i = 0; i < pathParts.length - 1; i += 1) {
    target = target[pathParts[i]];
  }
  target[pathParts[pathParts.length - 1]] = nextValue;
};

const migrateSettings = async (settings) => {
  const plain = settings.toObject();
  const hits = findBase64InObject(plain);

  if (!hits.length) return false;

  const oldValues = [];

  for (const hit of hits) {
    oldValues.push({
      path: hit.path,
      value: hit.value,
    });

    const migrated = await migrateImageValue(hit.value, 'settings');
    if (!DRY_RUN) {
      setByPath(plain, hit.path.split('.'), migrated.url);
    }
  }

  backup({
    timestamp: new Date().toISOString(),
    collection: 'settings',
    documentId: String(settings._id),
    oldValues,
  });

  if (!DRY_RUN) {
    settings.set(plain);
    settings.markModified('promotions');
    settings.markModified('homeSections');
    settings.markModified('customPages');
    settings.markModified('categories');
    await settings.save();
  }
  return true;
};

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const productCursor = Product.find({
    $or: [
      { 'images.0': /^data:image\//i },
      { 'variants.images.0': /^data:image\//i },
      { 'images.url': /^data:image\//i },
      { 'variants.images.url': /^data:image\//i },
    ],
  }).cursor();

  let productsChanged = 0;
  for await (const product of productCursor) {
    if (await migrateProduct(product)) productsChanged += 1;
  }

  let settingsChanged = 0;
  const settings = await Settings.findOne({});
  if (settings && await migrateSettings(settings)) settingsChanged += 1;

  console.log(JSON.stringify({
    mode: DRY_RUN ? 'dry-run' : 'execute',
    productsChanged,
    settingsChanged,
    backupPath,
  }, null, 2));

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
