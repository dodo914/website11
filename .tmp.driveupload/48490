const mongoose = require('mongoose');
const Order = require('../models/Order');
const { restoreOrderItems, decrementOrderItems, logMovementsBulk } = require('../utils/inventory');
const { invalidateProductCaches } = require('../utils/cache');
// ===== P1-2: Centralized payment state machine / transition guard =====
const { applyPaymentStatusTransition } = require('../services/paymentStateMachine');
// ===== إصلاح باج: حجز كود الولاء بشكل atomic لما الدفع الأونلاين ينجح فعلاً
// (راجع الشرح الكامل جوه usedLoyaltyCode في models/Order.js وجوه markPaid تحت) =====
const { reserveLoyaltyCode, releaseLoyaltyCode, releaseFirstOrderDiscount, releaseDiscountCodeUsage } = require('../utils/benefitReservation');
const { sendPurchaseConversions } = require('../services/conversionTrackingService');

// ============================================================
// ===== إيجاد الأوردر من orderId اللي راجع من بوابة الدفع (Kashier/Paymob) =====
// بعد التحديث، بيتبعت رقم الأوردر المتسلسل (orderNumber: 1001، 1002...)
// لبوابات الدفع بدل الـ Mongo _id الطويل، عشان يبقى نفس الرقم اللي بيوصل
// لشركة الشحن. الدالة دي بتدور بالـorderNumber الأول (الحالة الجديدة)،
// وبترجع تدور بالـ_id كـfallback عشان أي جلسة دفع (checkout session) كانت
// اتعملت قبل التحديث ده ولسه معلقة (orderId فيها لسه الـ_id القديم) - عشان
// متتكسرش فجأة.
// ============================================================
const gatewayOrderFilter = (orderId) => {
  const raw = String(orderId == null ? '' : orderId).trim();
  if (!raw) return null;
  const or = [];
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) or.push({ orderNumber: numeric });
  if (mongoose.Types.ObjectId.isValid(raw)) or.push({ _id: raw });
  return or.length > 0 ? { $or: or } : null;
};
const findOrderByGatewayOrderId = async (orderId, projection) => {
  const filter = gatewayOrderFilter(orderId);
  if (!filter) return null;
  const query = Order.findOne(filter);
  return projection ? query.select(projection) : query;
};
const {
  isConfigured,
  getMode,
  getCurrency,
  getFrontendUrl,
  getBackendUrl,
  getCallbackUrl,
  getWebhookUrl,
  normalizePaymentResult,
  verifyWebhookSignature,
  // ===== FIX: TEST/SANDBOX "جاري التأكيد" stuck-pending fallback (see reconcilePaymentStatus jsdoc) =====
  reconcilePaymentStatus,
} = require('../services/kashierService');
const {
  isConfigured: isPaymobConfigured,
  getCurrency: getPaymobCurrency,
  getFrontendUrl: getPaymobFrontendUrl,
  getCallbackUrl: getPaymobCallbackUrl,
  getWebhookUrl: getPaymobWebhookUrl,
  normalizePaymentResult: normalizePaymobResult,
  verifyHmac: verifyPaymobHmac,
  // ===== FIX: TEST/SANDBOX "جاري التأكيد" stuck-pending fallback (see reconcileTransactionStatus jsdoc) =====
  reconcileTransactionStatus,
} = require('../services/paymobService');

const isKashierEnabled = async () => {
  const Settings = require('../models/Settings');
  const settings = await Settings.findOne();
  return settings?.paymentSettings?.kashierEnabled === true;
};

const isPaymobEnabled = async () => {
  const Settings = require('../models/Settings');
  const settings = await Settings.findOne();
  return settings?.paymentSettings?.paymobEnabled === true;
};

const releaseOrderBenefitReservations = async (order) => {
  if (!order || !order.customerId) return;
  try {
    if (order.discountType === 'first_order') {
      await releaseFirstOrderDiscount(order.customerId);
    } else if (order.discountType === 'code' && order.discountCode) {
      const claim = await Order.findOneAndUpdate(
        { _id: order._id, discountUsageReleased: { $ne: true } },
        { $set: { discountUsageReleased: true } },
        { new: true }
      );
      if (claim) {
        await releaseDiscountCodeUsage(String(order.discountCode).trim().toUpperCase());
      }
    } else if (order.discountType === 'loyalty_code' && order.usedLoyaltyCode && ['cod', 'wallet'].includes(order.paymentMethod)) {
      await releaseLoyaltyCode(order.customerId, order.usedLoyaltyCode);
    }
  } catch (err) {
    console.error('releaseOrderBenefitReservations failed:', { orderId: order._id, message: err?.message });
  }
};

const markFailedAndReleaseStock = async (order) => {
  if (!order) return;

  // Atomically claim pending -> failed so only one failure webhook can run
  // stock/benefit release side effects.
  const failureClaim = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'pending' },
    { $set: { paymentStatus: 'failed' } },
    { new: true }
  );
  if (!failureClaim) {
    const current = await Order.findById(order._id).select('paymentStatus');
    if (!current || current.paymentStatus !== 'failed') {
      const transition = applyPaymentStatusTransition(order, 'failed');
      if (!transition.noop) {
        console.warn(`Payment transition blocked: cannot mark order ${order._id} failed (currently '${current?.paymentStatus || order.paymentStatus}') — reason: ${transition.reason || 'concurrent state change'}`);
      }
    }
    return;
  }
  order.paymentStatus = 'failed';

  if (!order.stockRestored) {
    const stockClaim = await Order.findOneAndUpdate(
      { _id: order._id, stockRestored: false },
      { $set: { stockRestored: true, stockRestoredAt: new Date() } },
      { new: true }
    );
    if (stockClaim) {
      await restoreOrderItems(order.items);
      await logMovementsBulk(order.items, 'stock_released', {
        orderId: order._id,
        note: 'Kashier payment failed/cancelled — stock released',
      });
      order.stockRestored = true;
      order.stockRestoredAt = stockClaim.stockRestoredAt;
      invalidateProductCaches();
    } else {
      order.stockRestored = true;
    }
  }

  await order.save();
  await releaseOrderBenefitReservations(order);
  require('../utils/cache').del('orders:all');
};

// ============================================================
// ===== تأكيد الطلب لبوابات الدفع (Kashier/Paymob) — بعد نجاح الدفع فعليًا =====
// نفس منطق queueOrderConfirmation في orderController.js، لكن هنا بيتنفذ
// بس لما الدفع ينجح فعلاً (مش وقت إنشاء الطلب زي COD/manual)، عشان محدش
// ياخد رسالة "تأكيد" على طلب لسه مدفعوش. مفصولة في try/catch مستقلة عشان
// فشل جدولة الرسالة (أو غياب إعدادات الماركتنج) ميأثرش على تسجيل الدفع نفسه.
// ============================================================
const queueGatewayOrderConfirmation = async (order) => {
  try {
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne();
    const marketing = settings?.marketing;
    if (!marketing?.enabled || !marketing?.orderConfirmation) return;

    const channel = marketing.orderConfirmationChannel === 'whatsapp' ? 'whatsapp' : 'email';
    const hasTarget = channel === 'email' ? !!order.customerEmail : !!order.customerPhone;
    if (!hasTarget) return;

    const MarketingMessage = require('../models/MarketingMessage');
    try {
      await MarketingMessage.create({
        kind: 'order_confirmation',
        channel,
        recipientEmail: channel === 'email' ? String(order.customerEmail).trim().toLowerCase() : undefined,
        recipientPhone: channel === 'whatsapp' ? String(order.customerPhone || '').replace(/\D/g, '') : undefined,
        subject: `تأكيد طلبك #${order.orderNumber ?? order._id}`,
        entityId: order._id.toString(),
        step: 0,
        scheduledAt: new Date(),
        status: 'pending',
      });
      order.emailConfirmation = { enabled: true, confirmed: false, confirmedAt: null, messageId: null, status: 'pending' };
      await order.save();
    } catch (queueErr) {
      // E11000 = already queued لنفس الطلب/القناة (مثلاً لو الـwebhook والـcallback
      // اشتغلوا مع بعض بالصدفة) — تجاهل بأمان، ده مش خطأ حقيقي.
      if (queueErr?.code !== 11000) throw queueErr;
    }
  } catch (e) {
    // Never fail the payment confirmation flow because queueing the message failed.
    console.error('Gateway order confirmation queueing failed:', { message: e?.message, code: e?.code });
  }
};

// ============================================================
// ===== إصلاح باج: كود ولاء بيتستخدم مرات لا نهائية مع الدفع الأونلاين =====
// المشكلة اللي كانت موجودة: لطلبات cod/wallet، كود الولاء بيتحجز atomically
// (يتعلّم "مستخدم") فورًا وقت إنشاء الطلب. لكن لطلبات kashier/paymob، كان
// بيتعمل بس فحص قراءة (هل الكود متاح؟) من غير أي حجز فعلي - يعني نفس الكود
// كان ممكن يتستخدم على عدد لا نهائي من الطلبات المدفوعة أونلاين، لأنه
// مايتسجلش "مستخدم" أبدًا في أي مكان.
// الإصلاح: بما إن الطلب الأونلاين أصلاً بيتأكد بس لما الدفع ينجح فعليًا (هنا
// في markPaid)، فده بالظبط المكان الصح لحجز الكود - نفس لحظة "الطلب بقى
// حقيقي ومستحق الخصم فعلاً". لو الحجز فشل (نادر جدًا: حد استخدم نفس الكود
// في نفس اللحظة بالظبط من مكان تاني)، الخصم يفضل زي ما هو على الطلب ده
// (الطلب اتدفع فعلاً، مينفعش نرجع فيه) لكن بنسجل تحذير للمراجعة اليدوية -
// نفس فلسفة "مايفشلش الدفع بسبب مشكلة جانبية" المتبعة في queueGatewayOrderConfirmation.
// ============================================================
const finalizeLoyaltyCodeIfNeeded = async (order) => {
  if (!order || !order.usedLoyaltyCode || !order.customerId) return;
  try {
    const reservation = await reserveLoyaltyCode(order.customerId, order.usedLoyaltyCode);
    if (!reservation.ok) {
      console.warn(`Loyalty code finalization: code '${order.usedLoyaltyCode}' for order ${order._id} could not be reserved (already used) - discount was already granted on this order, needs manual review.`);
    }
  } catch (e) {
    console.error('Loyalty code finalization failed:', { orderId: order._id, message: e?.message });
  }
};

const markPaid = async (order, payment = {}) => {
  if (!order) return;

  const wasFailedAndStockReleased = order.paymentStatus === 'failed' && order.stockRestored === true;
  const fromStatus = wasFailedAndStockReleased ? 'failed' : 'pending';

  const transitionCheck = applyPaymentStatusTransition(order, 'paid');
  if (!transitionCheck.applied) {
    if (!transitionCheck.noop) {
      console.warn(`Payment transition blocked: cannot mark order ${order._id} paid (currently '${order.paymentStatus}') — reason: ${transitionCheck.reason}`);
    }
    return;
  }

  // Atomic DB claim: only one webhook/reconciliation request can win the
  // pending->paid or failed->paid transition.
  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: fromStatus,
    },
    {
      $set: {
        paymentStatus: 'paid',
        ...(wasFailedAndStockReleased ? { stockRestored: false, stockRestoredAt: null } : {}),
      },
    },
    { new: true }
  );
  if (!claimed) {
    const current = await Order.findById(order._id).select('paymentStatus');
    if (current?.paymentStatus !== 'paid') {
      console.warn(`Payment paid claim lost for order ${order._id}; current status is '${current?.paymentStatus || 'missing'}'.`);
    }
    return;
  }

  order.paymentStatus = 'paid';
  if (wasFailedAndStockReleased) {
    order.stockRestored = false;
    order.stockRestoredAt = null;

    try {
      const reservation = await decrementOrderItems(order.items);
      if (!reservation.ok) {
        console.error(`Payment succeeded but stock could not be re-reserved for order ${order._id}; manual fulfillment/reconciliation required.`);
      } else {
        await logMovementsBulk(order.items, 'stock_sold', {
          orderId: order._id,
          note: 'Stock re-reserved after a previously failed payment was successfully retried',
        });
        order.stockRestored = false;
        order.stockRestoredAt = null;
        invalidateProductCaches();
      }
    } catch (stockErr) {
      console.error(`Stock re-reservation failed after payment success for order ${order._id}:`, stockErr.message);
    }
  }

  order.paymentGateway = order.paymentGateway || {};
  if (order.paymentMethod === 'kashier') {
    if (payment.kashierOrderId) order.paymentGateway.kashierOrderId = String(payment.kashierOrderId);
    if (payment.transactionId) order.paymentGateway.transactionId = String(payment.transactionId);
  } else if (order.paymentMethod === 'paymob') {
    if (payment.transactionId) order.paymentGateway.transactionId = String(payment.transactionId);
  }

  await order.save();
  require('../utils/cache').del('orders:all');
  await finalizeLoyaltyCodeIfNeeded(order);

  // Payment is now authoritative, so send the server-side Purchase event only
  // after the local paid transition succeeds. Browser/server use the same ID.
  void sendPurchaseConversions(order);

  await queueGatewayOrderConfirmation(order);
};

const markRefunded = async (order, payment = {}) => {
  if (!order) return;
  if (order.paymentStatus === 'refunded') return; // already fully refunded, nothing to do (idempotent)

  // ===== P1-2: transition guard =====
  // A refund event only makes sense for an order that is currently 'paid'.
  // If it isn't (e.g. still 'pending'/'failed' on our side — most likely
  // because our own 'paid' webhook was missed/delayed/out of order), we do
  // NOT let this silently jump the order straight to 'refunded'; that would
  // be an unaudited pending->refunded / failed->refunded transition. We log
  // it instead so it can be reconciled manually (the money movement already
  // happened at the gateway either way — this only affects our local status).
  if (order.paymentStatus !== 'paid') {
    console.warn(`Payment transition blocked: refund event for order ${order._id} but local paymentStatus is '${order.paymentStatus}' (expected 'paid') — needs manual reconciliation.`);
    return;
  }

  // Kashier's webhook "refund" event carries the amount THAT refund covers
  // (not necessarily the full order total — a merchant can issue a partial
  // refund straight from the Kashier dashboard too). We mirror exactly what
  // the admin-triggered refund endpoint does (orderController.refundOrderPayment):
  // accumulate refundedAmount / push a refunds[] entry, and only flip
  // paymentStatus to 'refunded' once the accumulated total covers the order.
  // This is what makes a refund issued directly from Kashier's dashboard show
  // up correctly (full or partial) in our admin panel too — as long as
  // KASHIER_WEBHOOK_URL is configured and reachable; without a working
  // webhook, Kashier has no way to tell our server this happened at all.
  const alreadyRefunded = Math.round(Number(order.refundedAmount || 0) * 100) / 100;
  const eventAmount = Number(payment.amount);
  const remaining = Math.round((Number(order.totalAmount || 0) - alreadyRefunded) * 100) / 100;
  // If Kashier didn't send a usable amount for some reason, fall back to
  // treating it as a full refund of whatever's left — safer than recording 0.
  const refundAmount = Number.isFinite(eventAmount) && eventAmount > 0
    ? Math.min(eventAmount, Math.max(remaining, eventAmount))
    : remaining;

  order.refunds = order.refunds || [];
  order.refunds.push({
    amount: refundAmount,
    reason: 'Refund issued from Kashier dashboard (via webhook)',
    at: new Date(),
    by: null,
    gatewayResponse: payment.raw || null,
  });
  order.refundedAmount = Math.round((alreadyRefunded + refundAmount) * 100) / 100;

  const isFullyRefunded = order.refundedAmount >= Number(order.totalAmount || 0) - 0.01;
  if (isFullyRefunded) {
    // Guaranteed to be applied — we already verified order.paymentStatus === 'paid'
    // above, and paid->refunded is an allowed transition.
    applyPaymentStatusTransition(order, 'refunded');

    if (!order.stockRestored) {
      await restoreOrderItems(order.items);
      await logMovementsBulk(order.items, 'stock_released', {
        orderId: order._id,
        note: 'Kashier refund confirmed — stock released',
      });
      order.stockRestored = true;
      order.stockRestoredAt = new Date();
      invalidateProductCaches();
    }
  }

  await order.save();
  require('../utils/cache').del('orders:all');
};

// ============================================================================
// FIX — root cause of "جاري التأكيد" (payment stuck on pending) in TEST/SANDBOX:
// -----------------------------------------------------------------------------
// handleKashierWebhook/handlePaymobWebhook are the ONLY paths that were ever
// allowed to move paymentStatus out of 'pending' (handleKashierCallback /
// handlePaymobCallback deliberately never touch it — see the P0 comments on
// those handlers above, and that part is correct and must stay that way).
// But KASHIER_WEBHOOK_URL / Paymob's webhook both require a publicly
// reachable HTTPS URL. When testing on localhost (or any box the gateway
// can't reach), that webhook is never delivered — so the order sits on
// 'pending' forever and the customer is stuck looking at "جاري التأكيد" with
// no way out, even though the payment genuinely succeeded on the gateway's
// side.
//
// The fix is NOT to trust the browser more (that would recreate the exact
// P0 hole the callback comments warn about). Instead, the status-polling
// endpoints the frontend already calls (getPaymentStatus / getPaymobPaymentStatus)
// now also ask the gateway itself, server-to-server, whenever they find the
// order still 'pending' — the same kind of verified check the webhook does,
// just reachable even when the webhook itself isn't. This is pure
// server-to-server verification (secret key, not user input) and goes
// through the exact same applyPaymentStatusTransition guard + amount
// integrity check as the webhook, so it's safe to call on every poll:
//   - idempotent: once the order is 'paid'/'failed'/'refunded' these
//     functions no-op immediately (order.paymentStatus !== 'pending' check
//     below, plus the transition guard itself).
//   - never trusts client-supplied status/amount — only trusts the ID as a
//     lookup key, exactly like markPaid/markFailedAndReleaseStock always did.
//   - never blocks the response to the frontend: any error/timeout talking
//     to the gateway is swallowed and the order's current DB status is
//     returned as-is, so a slow/unreachable gateway never turns into a 500.
// ============================================================================
const reconcileKashierPendingOrder = async (order) => {
  if (!order || order.paymentStatus !== 'pending') return;
  const kashierOrderId = order.paymentGateway?.kashierOrderId;
  // ===== FIX: this used to return here completely silently. Without
  // paymentGateway.kashierOrderId (only ever captured by a successful hit to
  // handleKashierCallback — see the P0 comments on that handler above) there
  // is nothing to ask Kashier about, so this order can NEVER resolve out of
  // 'pending' no matter how many times it's polled — not because anything is
  // broken in the reconciliation logic itself, but because the one piece of
  // data it needs was never captured (most commonly: the browser's redirect
  // back from Kashier never reached our callback route at all, e.g. because
  // of a wrong BACKEND_URL / dev-proxy port at the time that specific order
  // was paid). That used to be indistinguishable from "still waiting,  try
  // again next poll" in the logs. Logging it (once per poll is fine — this
  // only fires for genuinely stuck orders, which should be rare) makes a
  // permanently-stuck order immediately visible instead of silently retried
  // forever. It doesn't change any behavior — still no-ops exactly as before.
  if (!kashierOrderId) {
    console.warn(`Kashier reconciliation: order ${order._id} is 'pending' but has no paymentGateway.kashierOrderId — the browser callback for this order never reached handleKashierCallback (check BACKEND_URL / dev-proxy config), so this order cannot self-resolve via polling. Needs manual review.`);
    return;
  }

  try {
    const result = await reconcilePaymentStatus(kashierOrderId);
    if (!result) return; // gateway unreachable/inconclusive — leave status as-is, try again next poll

    if (result.amount != null && Math.abs(Number(result.amount) - Number(order.totalAmount)) > 0.01) {
      console.warn(`Kashier reconciliation amount mismatch for order ${order._id} — ignoring result.`);
      return;
    }

    if (result.success) {
      await markPaid(order, { ...result, kashierOrderId });
    } else if (result.failed) {
      await markFailedAndReleaseStock(order);
    }
  } catch (err) {
    console.error('Kashier payment reconciliation failed:', { orderId: order._id, message: err?.message });
  }
};

const reconcilePaymobPendingOrder = async (order) => {
  if (!order || order.paymentStatus !== 'pending') return;
  const transactionId = order.paymentGateway?.transactionId;
  // ===== FIX: same silent dead-end as reconcileKashierPendingOrder above —
  // see that function's comment for the full explanation. Here the id is
  // normally captured either by handlePaymobCallback (best-effort, from the
  // browser redirect) or by handlePaymobWebhook itself; if BOTH failed to
  // reach us for this order, there is nothing to reconcile against and it
  // will stay 'pending' forever until someone notices this log. =====
  if (!transactionId) {
    console.warn(`Paymob reconciliation: order ${order._id} is 'pending' but has no paymentGateway.transactionId — neither handlePaymobCallback nor handlePaymobWebhook ever reached us for this order (check BACKEND_URL / dev-proxy config, and CSRF exemption for the webhook route), so this order cannot self-resolve via polling. Needs manual review.`);
    return;
  }

  try {
    const result = await reconcileTransactionStatus(transactionId);
    if (!result || result.pending) return; // still processing / inconclusive — try again next poll

    if (result.amount != null && Math.abs(Number(result.amount) - Number(order.totalAmount)) > 0.01) {
      console.warn(`Paymob reconciliation amount mismatch for order ${order._id} — ignoring result.`);
      return;
    }

    if (result.refunded) return; // not our concern here — refund reconciliation is handled separately

    if (result.success) {
      await markPaid(order, result);
    } else if (result.failed) {
      await markFailedAndReleaseStock(order);
    }
  } catch (err) {
    console.error('Paymob payment reconciliation failed:', { orderId: order._id, message: err?.message });
  }
};

const getKashierStatus = async (req, res) => {
  try {
    const enabled = await isKashierEnabled();
    const configured = isConfigured();
    res.json({
      enabled,
      configured,
      connected: configured,
      mode: getMode(),
      currency: getCurrency(),
      callbackConfigured: Boolean(getCallbackUrl()),
      webhookConfigured: Boolean(getWebhookUrl()),
    });
  } catch (err) {
    console.error('Kashier status error:', err);
    res.status(500).json({ message: 'تعذر فحص اتصال Kashier' });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const order = await findOrderByGatewayOrderId(req.params.orderId);
    if (!order || order.paymentMethod !== 'kashier') {
      return res.status(404).json({ message: 'الدفع غير موجود' });
    }

    // ===== FIX: reconcile with Kashier directly before answering, in case the
    // 'pending' webhook never reached us (see reconcileKashierPendingOrder). =====
    await reconcileKashierPendingOrder(order);

    res.json({ orderId: order.orderNumber || order._id, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, totalAmount: order.totalAmount });
  } catch (err) {
    console.error('Kashier payment status error:', err);
    res.status(500).json({ message: 'تعذر جلب حالة الدفع' });
  }
};

const handleKashierCallback = async (req, res) => {
  // SECURITY (P0 fix): this endpoint is a plain browser redirect — anyone can
  // GET it directly with any orderId/status/amount they like, with no
  // signature at all. It must NEVER be trusted to mark an order paid/failed;
  // that decision belongs solely to handleKashierWebhook, which verifies the
  // real Kashier HMAC signature (x-kashier-signature) before touching
  // paymentStatus. This handler now only redirects the browser back to the
  // frontend "payment-complete" page with the orderId, which then polls
  // GET /kashier/status/:orderId (server-side truth) to learn the real status.
  const orderId = req.query.merchantOrderId || req.query.orderId || '';

  // ===== FIX: stash Kashier's own order id (untrusted, used ONLY as a lookup
  // key — never as a status/paid signal) so the poll endpoint above can later
  // ask Kashier directly "what really happened to this order?" even if the
  // webhook never arrives (sandbox / localhost). We never touch
  // paymentStatus here — that guarantee is unchanged. =====
  try {
    const result = normalizePaymentResult(req.query || {});
    if (result.orderId && result.kashierOrderId) {
      const order = await findOrderByGatewayOrderId(result.orderId, '_id paymentMethod paymentStatus paymentGateway');
      if (order && order.paymentMethod === 'kashier' && order.paymentStatus === 'pending' && !order.paymentGateway?.kashierOrderId) {
        order.paymentGateway = order.paymentGateway || {};
        order.paymentGateway.kashierOrderId = String(result.kashierOrderId);
        await order.save();
      }
    }
  } catch (err) {
    // Never let this best-effort bookkeeping break the redirect itself.
    console.error('Kashier callback id capture failed:', err?.message);
  }

  const base = getFrontendUrl();
  const target = base ? `${base}/payment-complete` : '/payment-complete';
  const query = new URLSearchParams();
  if (orderId) query.set('orderId', String(orderId));
  query.set('method', 'kashier');
  res.redirect(`${target}?${query.toString()}`);
};

const handleKashierWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const result = normalizePaymentResult(body);
    if (!result.orderId) return res.status(400).json({ message: 'merchantOrderId is required' });

    const order = await findOrderByGatewayOrderId(result.orderId);
    if (!order || order.paymentMethod !== 'kashier') {
      return res.status(404).json({ message: 'Kashier order not found' });
    }

    // Verify the request truly came from Kashier using the real webhook
    // signature scheme (header "x-kashier-signature", HMAC over the fields
    // listed in data.signatureKeys, keyed with the Payment API Key).
    // Docs: https://developers.kashier.io/payment/webhook/
    const signatureHeader = req.headers['x-kashier-signature'];
    const signatureValid = verifyWebhookSignature(body.data, signatureHeader);
    if (!signatureValid) {
      console.error('Kashier webhook: invalid or missing x-kashier-signature for order', result.orderId);
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    if (result.currency && result.currency !== getCurrency()) {
      return res.status(400).json({ message: 'Payment currency mismatch' });
    }

    if (result.refunded) {
      // A refund event's "amount" is the refunded amount, which may be less
      // than the order total for a partial refund — we don't reject on that,
      // we only require the signature (checked above) to be valid.
      await markRefunded(order, { amount: result.amount, raw: result.raw });
      return res.json({ ok: true });
    }

    // Full-payment integrity check only applies to pay/capture-style events.
    if (result.amount != null && Math.abs(Number(result.amount) - Number(order.totalAmount)) > 0.01) {
      return res.status(400).json({ message: 'Payment amount mismatch' });
    }

    if (result.success) {
      await markPaid(order, result);
    } else if (result.failed) {
      await markFailedAndReleaseStock(order);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Kashier webhook error:', err);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

// ============================================================================
// Paymob — mirrors the Kashier handlers above, adapted to Paymob's Unified
// Intention flow (a create-intention API call up front, then a hosted
// checkout redirect, then a browser callback + a server-to-server webhook).
// ============================================================================

const getPaymobStatus = async (req, res) => {
  try {
    const enabled = await isPaymobEnabled();
    const configured = isPaymobConfigured();
    res.json({
      enabled,
      configured,
      connected: configured,
      currency: getPaymobCurrency(),
      callbackConfigured: Boolean(getPaymobCallbackUrl()),
      webhookConfigured: Boolean(getPaymobWebhookUrl()),
    });
  } catch (err) {
    console.error('Paymob status error:', err);
    res.status(500).json({ message: 'تعذر فحص اتصال Paymob' });
  }
};

const getPaymobPaymentStatus = async (req, res) => {
  try {
    const order = await findOrderByGatewayOrderId(req.params.orderId);
    if (!order || order.paymentMethod !== 'paymob') {
      return res.status(404).json({ message: 'الدفع غير موجود' });
    }

    // ===== FIX: reconcile with Paymob directly before answering, in case the
    // 'pending' webhook never reached us (see reconcilePaymobPendingOrder). =====
    await reconcilePaymobPendingOrder(order);

    res.json({ orderId: order.orderNumber || order._id, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, totalAmount: order.totalAmount });
  } catch (err) {
    console.error('Paymob payment status error:', err);
    res.status(500).json({ message: 'تعذر جلب حالة الدفع' });
  }
};

const handlePaymobCallback = async (req, res) => {
  // SECURITY (P0 fix): this endpoint is a plain browser redirect — anyone can
  // GET it directly with any merchant_order_id/success/amount they like, with
  // no HMAC at all. It must NEVER be trusted to mark an order paid/failed;
  // that decision belongs solely to handlePaymobWebhook, which verifies the
  // real Paymob HMAC (query param "hmac") before touching paymentStatus.
  // This handler now only redirects the browser back to the frontend
  // "payment-complete" page with the orderId, which then polls
  // GET /paymob/status/:orderId (server-side truth) to learn the real status.
  const query = req.query || {};
  const result = normalizePaymobResult(query);
  const orderId = result.orderId || '';

  // ===== FIX: stash Paymob's own transaction id (untrusted, used ONLY as a
  // lookup key — never as a status/paid signal) so the poll endpoint above
  // can later ask Paymob directly "what really happened to this
  // transaction?" even if the webhook never arrives (sandbox / localhost).
  // We never touch paymentStatus here — that guarantee is unchanged. =====
  try {
    if (orderId && result.transactionId) {
      const order = await findOrderByGatewayOrderId(orderId, '_id paymentMethod paymentStatus paymentGateway');
      if (order && order.paymentMethod === 'paymob' && order.paymentStatus === 'pending' && !order.paymentGateway?.transactionId) {
        order.paymentGateway = order.paymentGateway || {};
        order.paymentGateway.transactionId = String(result.transactionId);
        await order.save();
      }
    }
  } catch (err) {
    // Never let this best-effort bookkeeping break the redirect itself.
    console.error('Paymob callback id capture failed:', err?.message);
  }

  const base = getPaymobFrontendUrl();
  const target = base ? `${base}/payment-complete` : '/payment-complete';
  const redirectQuery = new URLSearchParams();
  if (orderId) redirectQuery.set('orderId', String(orderId));
  redirectQuery.set('method', 'paymob');
  res.redirect(`${target}?${redirectQuery.toString()}`);
};

const handlePaymobWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    // Paymob puts the HMAC in the query string even on the POST webhook.
    const hmacParam = req.query?.hmac;
    const result = normalizePaymobResult(body);
    if (!result.orderId) return res.status(400).json({ message: 'merchant_order_id is required' });

    const order = await findOrderByGatewayOrderId(result.orderId);
    if (!order || order.paymentMethod !== 'paymob') {
      return res.status(404).json({ message: 'Paymob order not found' });
    }

    // Verify the request truly came from Paymob using the documented HMAC
    // scheme (ordered field concatenation, HMAC-SHA512, keyed with the HMAC
    // secret from the Paymob dashboard). Docs:
    // https://developers.paymob.com/egypt/manage-transactions/transaction-webhooks
    const signatureValid = verifyPaymobHmac(result.hmacSource, hmacParam);
    if (!signatureValid) {
      console.error('Paymob webhook: invalid or missing hmac for order', result.orderId);
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    if (result.pending) {
      // Still processing (e.g. 3D-Secure redirect in progress) — nothing to do yet.
      return res.json({ ok: true });
    }

    if (result.currency && result.currency !== getPaymobCurrency()) {
      return res.status(400).json({ message: 'Payment currency mismatch' });
    }

    if (result.refunded) {
      await markRefunded(order, { amount: result.amount, raw: result.raw });
      return res.json({ ok: true });
    }

    if (result.amount != null && Math.abs(Number(result.amount) - Number(order.totalAmount)) > 0.01) {
      return res.status(400).json({ message: 'Payment amount mismatch' });
    }

    if (result.success) {
      await markPaid(order, result);
    } else if (result.failed) {
      await markFailedAndReleaseStock(order);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Paymob webhook error:', err);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

module.exports = {
  getKashierStatus,
  getPaymentStatus,
  handleKashierCallback,
  handleKashierWebhook,
  getPaymobStatus,
  getPaymobPaymentStatus,
  handlePaymobCallback,
  handlePaymobWebhook,
  // ===== P1-2: مُصدَّرة عشان تتختبر مباشرة (test/paymentStateMachine.test.js)
  // من غير ما نحتاج نشغّل قاعدة بيانات حقيقية أو webhook فعلي — نفس أسلوب
  // stripClientPaymentFields في orderController.js.
  markPaid,
  markFailedAndReleaseStock,
  markRefunded,
  // ===== FIX: exported for the same reason (direct unit testing) =====
  reconcileKashierPendingOrder,
  reconcilePaymobPendingOrder,
};