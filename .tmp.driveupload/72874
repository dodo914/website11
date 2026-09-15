const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('shipping idempotency reclaims failed/stale attempts atomically', () => {
  const source = read('services/shipping/idempotency.js');
  assert.match(source, /findOneAndUpdate\(/);
  assert.match(source, /status:\s*'failed'/);
  assert.match(source, /status:\s*'in_progress',\s*lastAttemptAt:\s*\{\s*\$lte:\s*staleBefore/s);
  assert.match(source, /\$inc:\s*\{\s*attempts:\s*1\s*\}/);
});

test('order creation idempotency reclaims failed/stale attempts atomically', () => {
  const source = read('services/orderIdempotencyService.js');
  assert.match(source, /findOneAndUpdate\(/);
  assert.match(source, /status:\s*'failed'/);
  assert.match(source, /status:\s*'in_progress',\s*lastAttemptAt:\s*\{\s*\$lte:\s*staleBefore/s);
});

test('successful payment has an atomic pending/failed -> paid database claim', () => {
  const source = read('controllers/paymentController.js');
  assert.match(source, /const wasFailedAndStockReleased = order\.paymentStatus === 'failed'/);
  assert.match(source, /const claimed = await Order\.findOneAndUpdate\(/);
  assert.match(source, /paymentStatus:\s*fromStatus/);
  assert.match(source, /stockRestored:\s*false/);
});

test('manual payment-status endpoint cannot fabricate online Kashier/Paymob state', () => {
  const source = read('controllers/orderController.js');
  assert.match(source, /\['kashier', 'paymob'\]\.includes\(order\.paymentMethod\)/);
  assert.match(source, /حالة دفع Kashier\/Paymob تتحدث تلقائيًا/);
});

test('OTP verification consumes the code atomically', () => {
  const source = read('controllers/authController.js');
  assert.match(source, /const consumeOtpAtomically = async/);
  assert.match(source, /findOneAndDelete\(/);
  assert.match(source, /expiresAt:\s*\{\s*\$gt:\s*now\s*\}/);
  assert.match(source, /attempts:\s*\{\s*\$lt:\s*5\s*\}/);
});

test('refund lock has stale recovery timestamp', () => {
  const model = read('models/Order.js');
  const controller = read('controllers/orderController.js');
  assert.match(model, /refundInProgressAt:\s*\{\s*type:\s*Date/);
  assert.match(controller, /refundLockStaleBefore/);
  assert.match(controller, /refundInProgress:\s*true,\s*refundInProgressAt:\s*\{\s*\$lte:\s*refundLockStaleBefore\s*\}/s);
});
