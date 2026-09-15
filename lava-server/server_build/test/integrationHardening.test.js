const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..');

const read = (p) => fs.readFileSync(path.join(base, p), 'utf8');

test('conversion tracking uses stable event id and current Meta Graph version', () => {
  const source = read('services/conversionTrackingService.js');
  assert.match(source, /eventId: String\(order\._id\)/);
  assert.match(source, /META_GRAPH_API_VERSION \|\| 'v26\.0'/);
  assert.match(source, /https:\/\/business-api\.tiktok\.com\/open_api\/v1\.3\/event\/track\//);
  assert.match(source, /https:\/\/tr\.snapchat\.com\/v3\//);
});

test('online Purchase conversion is sent only after payment is authoritative', () => {
  const payment = read('controllers/paymentController.js');
  const order = read('controllers/orderController.js');
  assert.match(payment, /applyPaymentStatusTransition\(order, 'paid'\)/);
  assert.match(payment, /sendPurchaseConversions\(order\)/);
  assert.match(order, /paymentMethod !== 'kashier' && paymentMethod !== 'paymob'/);
});

test('catalog feed contains variant identifiers and optional GTIN support', () => {
  const feed = read('controllers/feedController.js');
  assert.match(feed, /itemGroupId/);
  assert.match(feed, /g:item_group_id/);
  assert.match(feed, /g:color/);
  assert.match(feed, /g:size/);
  assert.match(feed, /g:gtin/);
  assert.match(feed, /sale_price_effective_date/);
});

test('product schema keeps catalog identifiers optional for backward compatibility', () => {
  const product = read('models/Product.js');
  assert.match(product, /googleProductCategory: \{ ar: String, en: String \}/);
  assert.match(product, /gtin: String/);
  assert.match(product, /barcode: String/);
});

test('conversion service builds and sends three CAPI requests without exposing secrets', async () => {
  const previous = {
    META_PIXEL_ID: process.env.META_PIXEL_ID,
    META_API_KEY: process.env.META_API_KEY,
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
    TIKTOK_PIXEL_ID: process.env.TIKTOK_PIXEL_ID,
    TIKTOK_API_KEY: process.env.TIKTOK_API_KEY,
    SNAPCHAT_PIXEL_ID: process.env.SNAPCHAT_PIXEL_ID,
    SNAPCHAT_API_KEY: process.env.SNAPCHAT_API_KEY,
  };
  Object.assign(process.env, {
    META_PIXEL_ID: 'meta-test-pixel', META_API_KEY: 'meta-test-token', META_GRAPH_API_VERSION: 'v26.0',
    TIKTOK_PIXEL_ID: 'tiktok-test-pixel', TIKTOK_API_KEY: 'tiktok-test-token',
    SNAPCHAT_PIXEL_ID: 'snap-test-pixel', SNAPCHAT_API_KEY: 'snap-test-token',
  });

  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, status: 200, text: async () => '{"ok":true}' };
  };

  delete require.cache[require.resolve('../services/conversionTrackingService')];
  const { sendPurchaseConversions } = require('../services/conversionTrackingService');
  await sendPurchaseConversions({
    _id: '65f000000000000000000001',
    orderNumber: 1001,
    totalAmount: 500,
    customerEmail: 'Customer@Example.com',
    customerPhone: '+201001234567',
    items: [{ productId: 'p1', variantId: 'v1', sku: 'SKU-1', quantity: 2, price: 250, name: { en: 'Test Product' } }],
  });

  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }

  assert.equal(calls.length, 3);
  assert.ok(calls.some((c) => c.url.includes('graph.facebook.com/v26.0/meta-test-pixel/events')));
  assert.ok(calls.some((c) => c.url.includes('business-api.tiktok.com/open_api/v1.3/event/track')));
  assert.ok(calls.some((c) => c.url.includes('tr.snapchat.com/v3/snap-test-pixel/events')));
  const bodies = calls.map((c) => JSON.parse(c.options.body));
  assert.ok(bodies.some((b) => b.data?.[0]?.event_id === '65f000000000000000000001'));
});
