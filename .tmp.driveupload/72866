const test = require('node:test');
const assert = require('node:assert/strict');

const ExchangeRequest = require('../models/ExchangeRequest');
const { toCustomerExchangeView } = require('../utils/customerExchangeView');

test('ExchangeRequest: has a database-level unique index for one active exchange per order', () => {
  const indexes = ExchangeRequest.schema.indexes();
  const index = indexes.find(([keys, options]) =>
    keys.orderId === 1 && options?.unique === true && options?.name === 'uniq_active_exchange_per_order'
  );
  assert.ok(index, 'active exchange unique index is missing');
  assert.deepEqual(index[1].partialFilterExpression, {
    status: {
      $in: [
        'pending', 'under_review', 'approved', 'pickup_scheduled', 'received', 'processing',
        'carrier_picked_up', 'received_at_warehouse', 'inspecting', 'shipped_to_customer',
      ],
    },
  });
});

test('customer exchange serializer never exposes internal/admin fields', () => {
  const view = toCustomerExchangeView({
    requestId: 'EX-TEST',
    orderId: 'ORDER-ID',
    userId: 'USER-ID',
    status: 'approved',
    adminNote: 'internal',
    reviewedBy: 'STAFF-ID',
    provider: 'bosta',
    providerShipmentId: 'secret-provider-id',
    trackingRawStatus: 'raw-internal',
    moneyAmount: 500,
    moneyReference: 'secret-ref',
    financialImpactApplied: true,
    stockAdjusted: true,
    items: [{ productId: 'P1', quantity: 1, oldVariant: { variantId: 'v1', size: 'M', color: 'black' }, requestedNewVariant: { variantId: 'v2', size: 'L', color: 'blue' } }],
  });

  assert.equal(view.requestId, 'EX-TEST');
  assert.equal(view.status, 'approved');
  assert.equal(view.trackingNumber, null);
  assert.equal(view.adminNote, undefined);
  assert.equal(view.reviewedBy, undefined);
  assert.equal(view.provider, undefined);
  assert.equal(view.providerShipmentId, undefined);
  assert.equal(view.trackingRawStatus, undefined);
  assert.equal(view.moneyAmount, undefined);
  assert.equal(view.moneyReference, undefined);
  assert.equal(view.financialImpactApplied, undefined);
  assert.equal(view.stockAdjusted, undefined);
  assert.equal(view.items[0].quantity, 1);
});
