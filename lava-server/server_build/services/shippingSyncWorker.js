const Order = require('../models/Order');
const ExchangeRequest = require('../models/ExchangeRequest');
const { getProvider, getConfig, getCapabilities } = require('./shipping');
const { syncOrderTracking } = require('./shipping/sync');
const { applyReturnExchangeStatus, RETURN_WORKFLOW_ADVANCE, EXCHANGE_WORKFLOW_ADVANCE } = require('./shipping/returnExchangeSync');
const Settings = require('../models/Settings');

// ============================================================================
// shippingSyncWorker
// ------------------------------------------------------------------------
// الغرض: تحديث حالة شحن الطلبات تلقائيًا من غير ما حد يدوس "تحديث التتبع"
// يدويًا - لكل الشركات الأربعة (Bosta/Aramex/DHL/ShipBlu)، مش بوسطة بس.
// (بوسطة كمان عندها Webhook فوري - شوف shippingController.handleBostaWebhook
// - فالـworker ده بيبقى شبكة أمان لبوسطة (لو الـWebhook اتأخر/فشل لأي سبب)
// وهو الطريقة الوحيدة للتحديث التلقائي لباقي التلات شركات لحد ما تتوفر لهم
// Webhook رسمي موثّق زي بوسطة).
//
// إزاي بيشتغل: كل فترة (INTERVAL) بيدوّر على الطلبات اللي معاها Tracking
// Number وحالتها لسه "نشطة" (مش وصلت لحالة نهائية زي delivered/cancelled/
// returned/failed - دول مش محتاجين تحديث تاني)، وبينادي provider.track()
// لكل واحدة بنفس منطق التحديث المستخدم في الزرار اليدوي بالظبط
// (services/shipping/sync.js).
//
// معدل التحديث الافتراضي كل 10 دقايق - مش أسرع من كده، عشان منضغطش على
// الـAPI بتاع شركات الشحن (فيه أصلاً Rate Limiting طبيعي عندهم)، ولأن حالة
// شحنة نادرًا ما تتغير كل ثواني.
// ============================================================================

const DEFAULT_INTERVAL_MINUTES = 10;
const BATCH_LIMIT_PER_PROVIDER = 100; // أقصى عدد طلبات نحدّثها لكل شركة في كل دورة، عشان منعملش آلاف النداءات مرة واحدة
// 'shipped' اتضافت هنا (Bug fix) - كانت الحالة اللي بيحطها createShipment
// فور نجاح إنشاء الشحنة، بس كانت مش موجودة في القايمة دي فكان الـworker
// بيتجاهل الطلبات دي تمامًا وميحاولش يتابعها تلقائيًا لحد ما حد يعمل
// sync يدوي أو يوصل Webhook يغيّر حالتها لحاجة تانية موجودة في القايمة.
const ACTIVE_STATUSES = ['pending', 'created', 'shipped', 'picked_up', 'in_transit', 'out_for_delivery'];

async function getIntervalMinutes() {
  const settings = await Settings.findOne().select('shippingIntegrations.syncIntervalMinutes').lean();
  const configured = Number(settings?.shippingIntegrations?.syncIntervalMinutes);
  if (Number.isFinite(configured) && configured >= 2) return configured;
  return DEFAULT_INTERVAL_MINUTES;
}

async function syncProviderOrders(key) {
  const config = getConfig(key);
  if (!config) return;
  // مفيش داعي نحاول نتصل بشركة شحن الأدمن مفعّلهاش أو معهاش بيانات أصلًا.
  const settings = await Settings.findOne().select('shippingIntegrations').lean();
  const saved = settings?.shippingIntegrations?.[key] || {};
  const merged = { ...config, ...saved };
  if (merged.enabled === false) return;

  const orders = await Order.find({
    shippingCompany: key,
    trackingNumber: { $exists: true, $ne: null },
    shippingStatus: { $in: ACTIVE_STATUSES },
  }).limit(BATCH_LIMIT_PER_PROVIDER);

  if (!orders.length) return;

  const provider = getProvider(key);
  let updatedCount = 0;
  for (const order of orders) {
    try {
      const { changed } = await syncOrderTracking(order, provider, merged);
      if (changed) updatedCount += 1;
    } catch (err) {
      // فشل تحديث طلب واحد (مثلاً شركة الشحن مش راجعة رد دلوقتي) مايوقفش
      // باقي الطلبات - كل طلب مستقل عن التاني.
      console.error(`[shipping-sync] ${key} order ${order._id} failed:`, err.message);
    }
  }
  if (updatedCount > 0) {
    console.log(`[shipping-sync] ${key}: تم تحديث ${updatedCount} من أصل ${orders.length} طلب`);
  }
}

// ============================================================================
// Bosta Return/Exchange Integration: مزامنة دورية لأرقام تتبع الإرجاع/
// الاستبدال اللي الأدمن دخّلها يدويًا (Manual Mode). نفس فكرة
// syncProviderOrders فوق بالظبط لكن للحقول المنفصلة (returnTrackingNumber/
// exchangeTrackingNumber على الأوردر، وExchangeRequest.trackingNumber
// المستقل) - شبكة أمان لو الأدمن مضغطش "مزامنة الآن" بنفسه، ولباقي الوقت
// اللي مفيش فيه Webhook فوري (بوسطة بس هي اللي عندها Webhook - شوف
// handleBostaWebhook - والـworker ده بيغطي أي شركة تانية تدعم supportsTracking).
// ============================================================================
const RETURN_EXCHANGE_ACTIVE_STATUSES = [
  'pickup_pending', 'picked_up', 'received_at_warehouse', 'inspecting',
  'shipped_to_customer', 'out_for_delivery', null,
];

async function syncOrderReturnExchangeTracking(key) {
  const caps = getCapabilities(key);
  if (!caps?.supportsTracking) return; // مفيش سبب نحاول نتابع لو الشركة أصلاً مش بتدعم Tracking API

  const config = getConfig(key);
  if (!config) return;

  const returnOrders = await Order.find({
    returnTrackingProvider: key, returnTrackingSyncEnabled: true,
    returnTrackingNumber: { $exists: true, $ne: null },
    returnStatus: { $in: RETURN_EXCHANGE_ACTIVE_STATUSES },
  }).limit(BATCH_LIMIT_PER_PROVIDER);
  for (const order of returnOrders) {
    try {
      const result = await getProvider(key).track(order.returnTrackingNumber, config);
      await applyReturnExchangeStatus({
        doc: order, providerKey: key, rawStatus: result.status,
        statusField: 'returnStatus', rawStatusField: 'returnTrackingRawStatus',
        workflowField: 'returnRequestStatus', workflowAdvanceMap: RETURN_WORKFLOW_ADVANCE,
        lastSyncField: 'returnLastTrackingSyncAt', lastEventField: 'returnLastProviderEvent',
      });
    } catch (err) {
      console.error(`[shipping-sync] ${key} return tracking ${order._id} failed:`, err.message);
    }
  }

  const exchangeOrders = await Order.find({
    exchangeTrackingProvider: key, exchangeTrackingSyncEnabled: true,
    exchangeTrackingNumber: { $exists: true, $ne: null },
    exchangeStatus: { $in: RETURN_EXCHANGE_ACTIVE_STATUSES },
  }).limit(BATCH_LIMIT_PER_PROVIDER);
  for (const order of exchangeOrders) {
    try {
      const result = await getProvider(key).track(order.exchangeTrackingNumber, config);
      await applyReturnExchangeStatus({
        doc: order, providerKey: key, rawStatus: result.status,
        statusField: 'exchangeStatus', rawStatusField: 'exchangeTrackingRawStatus',
        workflowField: null, workflowAdvanceMap: null,
        lastSyncField: 'exchangeLastTrackingSyncAt', lastEventField: 'exchangeLastProviderEvent',
      });
    } catch (err) {
      console.error(`[shipping-sync] ${key} exchange tracking ${order._id} failed:`, err.message);
    }
  }

  const exchangeRequests = await ExchangeRequest.find({
    provider: key, trackingSyncEnabled: true,
    trackingNumber: { $exists: true, $ne: null },
    trackingStatus: { $in: RETURN_EXCHANGE_ACTIVE_STATUSES },
  }).limit(BATCH_LIMIT_PER_PROVIDER);
  for (const er of exchangeRequests) {
    try {
      const result = await getProvider(key).track(er.trackingNumber, config);
      await applyReturnExchangeStatus({
        doc: er, providerKey: key, rawStatus: result.status,
        statusField: 'trackingStatus', rawStatusField: 'trackingRawStatus',
        workflowField: 'status', workflowAdvanceMap: EXCHANGE_WORKFLOW_ADVANCE,
        lastSyncField: 'lastTrackingSyncAt', lastEventField: 'lastProviderEvent',
      });
    } catch (err) {
      console.error(`[shipping-sync] ${key} exchange request tracking ${er._id} failed:`, err.message);
    }
  }
}

let tickRunning = false;

async function runSyncTick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    for (const key of ['bosta', 'aramex', 'dhl', 'shipblu']) {
      try {
        await syncProviderOrders(key);
      } catch (err) {
        console.error(`[shipping-sync] provider ${key} tick error:`, err.message);
      }
      try {
        await syncOrderReturnExchangeTracking(key);
      } catch (err) {
        console.error(`[shipping-sync] provider ${key} return/exchange tick error:`, err.message);
      }
    }
  } finally {
    tickRunning = false;
  }
}

async function startShippingSyncWorker() {
  const intervalMinutes = await getIntervalMinutes();
  console.log(`[shipping-sync] worker بدأ الشغل - هيحدّث حالة الشحنات النشطة كل ${intervalMinutes} دقيقة`);
  // أول تشغيل فورًا (من غير ما نستنى أول interval) عشان الحالات القديمة
  // تتحدث بسرعة بعد ما السيرفر يشتغل، مش لازم تستنى 10 دقايق الأول.
  runSyncTick().catch(err => console.error('[shipping-sync] initial tick error:', err.message));
  setInterval(() => {
    runSyncTick().catch(err => console.error('[shipping-sync] tick error:', err.message));
  }, intervalMinutes * 60 * 1000);
}

module.exports = { startShippingSyncWorker, runSyncTick };