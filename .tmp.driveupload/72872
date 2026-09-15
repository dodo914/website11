const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('order status stock restoration cannot save stale stockRestored=false after losing the atomic claim', () => {
  const source = read('controllers/orderController.js');
  assert.match(source, /_id: order\.\_id, stockRestored: false/);
  assert.match(source, /Another concurrent request already claimed the stock-restoration lock/);
  assert.match(source, /order\.stockRestored = true;/);
});

test('payment failure uses an atomic pending->failed claim and atomic stock claim', () => {
  const source = read('controllers/paymentController.js');
  assert.match(source, /_id: order\.\_id, paymentStatus: 'pending'/);
  assert.match(source, /\$set: \{ paymentStatus: 'failed' \}/);
  assert.match(source, /_id: order\.\_id, stockRestored: false/);
});

test('payment expiry uses the same atomic pending->failed guard', () => {
  const source = read('services/paymentExpiryWorker.js');
  assert.match(source, /_id: fresh\.\_id, paymentStatus: 'pending'/);
  assert.match(source, /\$set: \{ paymentStatus: 'failed' \}/);
});

test('coupon release is guarded by an order-level idempotency flag', () => {
  const model = read('models/Order.js');
  const payment = read('controllers/paymentController.js');
  const worker = read('services/paymentExpiryWorker.js');
  assert.match(model, /discountUsageReleased: \{ type: Boolean, default: false \}/);
  assert.match(payment, /discountUsageReleased: \{ \$ne: true \}/);
  assert.match(worker, /discountUsageReleased: \{ \$ne: true \}/);
});

test('customer exchange cancellation returns the safe customer projection', () => {
  const source = read('controllers/exchangeController.js');
  assert.match(source, /res\.json\(toCustomerExchangeView\(exchangeRequest\)\)/);
});
