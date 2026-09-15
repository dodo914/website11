// ============================================================================
// tests/dhlReturnExchange.test.js
// ------------------------------------------------------------------------
// DHL Return & Exchange Integration Audit - اختبارات لخريطة
// normalizeReturnExchangeStatus الخاصة بـDHL Express/MyDHL API
// (DHL_RETURN_EXCHANGE_MAP في statusMap.js) اللي كانت ناقصة قبل كده (نفس
// الباج اللي كان موجود في ShipBlu وأرامكس - كانت بترجع null دايمًا لـDHL
// فمكانتش بتقدّم returnStatus/exchangeStatus تلقائيًا حتى لو التتبع نجح).
// نفس أسلوب باقي ملفات الاختبار (node:test بدون مكتبات خارجية، Fake
// documents بدل اتصال DB حقيقي).
//
// تشغيل: node --test test/dhlReturnExchange.test.js
// ============================================================================
const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeReturnExchangeStatus } = require('../services/shipping/statusMap');
const { applyReturnExchangeStatus, RETURN_WORKFLOW_ADVANCE, EXCHANGE_WORKFLOW_ADVANCE } = require('../services/shipping/returnExchangeSync');

function makeFakeReturnOrder(overrides = {}) {
  const doc = {
    returnStatus: null,
    returnTrackingRawStatus: null,
    returnRequestStatus: 'approved',
    returnLastTrackingSyncAt: null,
    returnLastProviderEvent: null,
    returnStatusHistory: [],
    saveCallCount: 0,
    ...overrides,
  };
  doc.save = async function save() { doc.saveCallCount += 1; return doc; };
  return doc;
}

function makeFakeExchangeRequest(overrides = {}) {
  const doc = {
    trackingStatus: null,
    trackingRawStatus: null,
    status: 'approved',
    lastTrackingSyncAt: null,
    lastProviderEvent: null,
    statusHistory: [],
    saveCallCount: 0,
    ...overrides,
  };
  doc.save = async function save() { doc.saveCallCount += 1; return doc; };
  return doc;
}

test('normalizeReturnExchangeStatus: بيعرف DHL typeCode الأساسية (كانت null دايمًا قبل الإصلاح)', () => {
  assert.equal(normalizeReturnExchangeStatus('dhl', 'pu'), 'picked_up');
  assert.equal(normalizeReturnExchangeStatus('dhl', 'dd'), 'delivered');
  assert.equal(normalizeReturnExchangeStatus('dhl', 'de'), 'delivered');
  assert.equal(normalizeReturnExchangeStatus('dhl', 'rt'), 'returned_to_store');
  assert.equal(normalizeReturnExchangeStatus('dhl', 'wc'), 'out_for_delivery');
  assert.equal(normalizeReturnExchangeStatus('dhl', 'ex'), 'delivery_failed');
  assert.equal(normalizeReturnExchangeStatus('dhl', 'cc'), 'cancelled');
});

test('normalizeReturnExchangeStatus: typeCode غير معروف بيرجع null بدل تخمين تصنيف غلط', () => {
  assert.equal(normalizeReturnExchangeStatus('dhl', 'zz'), null);
  assert.equal(normalizeReturnExchangeStatus('dhl', 'some_unknown_event'), null);
});

test('applyReturnExchangeStatus (DHL): بيحدّث returnStatus + returnRequestStatus للمرحلة الآمنة المقابلة', async () => {
  const order = makeFakeReturnOrder();
  const outcome = await applyReturnExchangeStatus({
    doc: order, providerKey: 'dhl', rawStatus: 'pu', // Picked up
    statusField: 'returnStatus', rawStatusField: 'returnTrackingRawStatus',
    workflowField: 'returnRequestStatus', workflowAdvanceMap: RETURN_WORKFLOW_ADVANCE,
    lastSyncField: 'returnLastTrackingSyncAt', lastEventField: 'returnLastProviderEvent',
  });
  assert.equal(outcome.changed, true);
  assert.equal(order.returnStatus, 'picked_up');
  assert.equal(order.returnRequestStatus, 'carrier_picked_up');
  assert.ok(order.returnLastTrackingSyncAt instanceof Date);
  assert.equal(order.returnLastProviderEvent, 'pu');
  assert.equal(order.saveCallCount, 1);
});

test('applyReturnExchangeStatus (DHL): منتراجعش لحالة أقدم (regression protection) على شحنة استبدال مستقلة', async () => {
  const exchangeRequest = makeFakeExchangeRequest({ trackingStatus: 'delivered', status: 'completed' });
  const outcome = await applyReturnExchangeStatus({
    doc: exchangeRequest, providerKey: 'dhl', rawStatus: 'pu', // picked_up وصلت متأخرة بعد delivered
    statusField: 'trackingStatus', rawStatusField: 'trackingRawStatus',
    workflowField: 'status', workflowAdvanceMap: EXCHANGE_WORKFLOW_ADVANCE,
    lastSyncField: 'lastTrackingSyncAt', lastEventField: 'lastProviderEvent',
  });
  assert.equal(outcome.ignored, true);
  assert.equal(outcome.reason, 'regression');
  assert.equal(exchangeRequest.trackingStatus, 'delivered'); // لم يتراجع
  // rawStatus + lastSync بيتسجلوا برضو حتى لو الحالة الداخلية اتجاهلت (نفس سلوك باقي الشركات)
  assert.equal(exchangeRequest.trackingRawStatus, 'pu');
  assert.ok(exchangeRequest.lastTrackingSyncAt instanceof Date);
});

test('applyReturnExchangeStatus (DHL): حالة exchangeStatus (Order-level) بتتحدث من غير workflow field', async () => {
  const order = makeFakeReturnOrder();
  order.exchangeStatus = null;
  order.exchangeTrackingRawStatus = null;
  order.exchangeLastTrackingSyncAt = null;
  order.exchangeLastProviderEvent = null;
  const outcome = await applyReturnExchangeStatus({
    doc: order, providerKey: 'dhl', rawStatus: 'dd', // Delivered
    statusField: 'exchangeStatus', rawStatusField: 'exchangeTrackingRawStatus',
    workflowField: null, workflowAdvanceMap: null,
    lastSyncField: 'exchangeLastTrackingSyncAt', lastEventField: 'exchangeLastProviderEvent',
  });
  assert.equal(outcome.changed, true);
  assert.equal(order.exchangeStatus, 'delivered');
  assert.ok(order.exchangeLastTrackingSyncAt instanceof Date);
});