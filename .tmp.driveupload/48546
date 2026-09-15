const Order = require('../models/Order');
const Settings = require('../models/Settings');
const { restoreOrderItems, logMovementsBulk } = require('../utils/inventory');
const { invalidateProductCaches, del: delCache } = require('../utils/cache');
// ===== P1-2: Centralized payment state machine / transition guard =====
const { applyPaymentStatusTransition } = require('./paymentStateMachine');
const { releaseLoyaltyCode, releaseFirstOrderDiscount, releaseDiscountCodeUsage } = require('../utils/benefitReservation');

// ============================================================================
// المشكلة اللي الـ worker ده بيحلها:
// العميل يدوس "ادفع" (Kashier/Paymob) → الطلب بيتعمل بحالة paymentStatus=pending
// والمخزون بيتحجز فورًا (زي أي طلب تاني). لو العميل دخل بوابة الدفع وماكملش
// (دس رجوع بالسهم، قفل التاب، نت قطع...) مفيش أي حدث (لا callback ولا webhook)
// بيوصل للسيرفر، فالطلب بيفضل "pending" للأبد والمخزون فاضل محجوز غلط.
//
// الحل: كل tick بندور على طلبات kashier/paymob لسه pending وعدّى عليها وقت
// أطول من المهلة المحددة في الإعدادات (Settings.paymentSettings.pendingTimeoutMinutes)
// ونحولها failed + نرجع المخزون، بنفس المنطق المستخدم في paymentController
// (markFailedAndReleaseStock) لما الـ webhook نفسه يقول "فشل الدفع".
// ============================================================================

const DEFAULT_TIMEOUT_MINUTES = 20;
const BATCH_LIMIT = 200;

async function getTimeoutMinutes() {
  const settings = await Settings.findOne().select('paymentSettings.pendingTimeoutMinutes').lean();
  const configured = Number(settings?.paymentSettings?.pendingTimeoutMinutes);
  if (Number.isFinite(configured) && configured >= 1) return configured;
  return DEFAULT_TIMEOUT_MINUTES;
}

async function expireOrder(order) {
  // إعادة تحميل الطلب عشان نتأكد إنه لسه pending وماحدش عالجه (webhook/callback)
  // في نفس اللحظة دي — تجنبًا لأي سباق (race condition).
  const fresh = await Order.findOne({
    _id: order._id,
    paymentMethod: order.paymentMethod,
    paymentStatus: 'pending',
  });
  if (!fresh) return false;

  // ===== P1-2: transition guard =====
  // Belt-and-suspenders on top of the fresh re-fetch above: even though we
  // just re-queried for paymentStatus: 'pending', a webhook could have
  // Atomically claim pending->failed so two sweep/worker invocations cannot
  // both perform failure side-effects for the same order.
  const failureClaim = await Order.findOneAndUpdate(
    { _id: fresh._id, paymentStatus: 'pending' },
    { $set: { paymentStatus: 'failed' } },
    { new: true }
  );
  if (!failureClaim) return false;
  fresh.paymentStatus = 'failed';

  if (!fresh.stockRestored) {
    await restoreOrderItems(fresh.items);
    await logMovementsBulk(fresh.items, 'stock_released', {
      orderId: fresh._id,
      note: `${fresh.paymentMethod === 'paymob' ? 'Paymob' : 'Kashier'} payment timed out — no confirmation received, stock released`,
    });
    fresh.stockRestored = true;
    fresh.stockRestoredAt = new Date();
    invalidateProductCaches();
  }

  await fresh.save();

  // Release benefits reserved when the order was created. Online loyalty is
  // finalized only after successful payment, so it is intentionally skipped.
  try {
    if (fresh.customerId) {
      if (fresh.discountType === 'first_order') {
        await releaseFirstOrderDiscount(fresh.customerId);
      } else if (fresh.discountType === 'code' && fresh.discountCode) {
        const claim = await Order.findOneAndUpdate(
          { _id: fresh._id, discountUsageReleased: { $ne: true } },
          { $set: { discountUsageReleased: true } },
          { new: true }
        );
        if (claim) {
          await releaseDiscountCodeUsage(String(fresh.discountCode).trim().toUpperCase());
        }
      } else if (fresh.discountType === 'loyalty_code' && fresh.usedLoyaltyCode && ['cod', 'wallet'].includes(fresh.paymentMethod)) {
        await releaseLoyaltyCode(fresh.customerId, fresh.usedLoyaltyCode);
      }
    }
  } catch (benefitErr) {
    console.error(`[payment-expiry] benefit reservation release failed for order ${fresh._id}:`, benefitErr.message);
  }

  delCache('orders:all');
  console.log(`[payment-expiry] order ${fresh._id} (${fresh.paymentMethod}) marked failed — pending payment timed out, stock released`);
  return true;
}

async function sweepExpiredPendingPayments() {
  const timeoutMinutes = await getTimeoutMinutes();
  const cutoff = new Date(Date.now() - timeoutMinutes * 60000);

  const stale = await Order.find({
    paymentMethod: { $in: ['kashier', 'paymob'] },
    paymentStatus: 'pending',
    createdAt: { $lte: cutoff },
  })
    .select('_id paymentMethod stockRestored createdAt')
    .limit(BATCH_LIMIT)
    .lean();

  for (const order of stale) {
    try {
      await expireOrder(order);
    } catch (err) {
      console.error(`[payment-expiry] failed to expire order ${order._id}:`, err.message);
    }
  }
}

let tickRunning = false;

async function startPaymentExpiryWorker() {
  const tick = async () => {
    if (tickRunning) return;
    tickRunning = true;
    try {
      await sweepExpiredPendingPayments();
    } catch (e) {
      console.error('[payment-expiry] tick error:', e.message);
    } finally {
      tickRunning = false;
    }
  };
  await tick();
  // بنفحص كل دقيقة — كافية جدًا لمهلة بتتقاس بالدقايق وماتحملش على الداتابيز.
  return setInterval(tick, 60000);
}

module.exports = { startPaymentExpiryWorker, sweepExpiredPendingPayments };