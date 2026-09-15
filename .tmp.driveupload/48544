const Settings = require('../models/Settings');
const Order = require('../models/Order');
const MarketingMessage = require('../models/MarketingMessage');
const AbandonedCart = require('../models/AbandonedCart');
const User = require('../models/User');
const {
  sendEmail, sendWhatsApp, configured,
  orderHtml, orderStatusHtml, abandonedCartHtml, campaignHtml,
  makeConfirmationToken,
} = require('./brevoService');

const esc = s => String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const render = (s, ctx) => String(s || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => { let v=ctx; for(const p of k.split('.')) v=v?.[p]; return v==null?'':String(v); });

const confirmationUrlFor = (order) => {
  const token = makeConfirmationToken(order._id.toString(), order.customerEmail);
  const base = String(process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, '');
  return `${base}/marketing/order-confirm/${encodeURIComponent(token)}`;
};

const cancelUrlFor = (order) => {
  const token = makeConfirmationToken(order._id.toString(), order.customerEmail);
  const base = String(process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, '');
  return `${base}/marketing/order-cancel/${encodeURIComponent(token)}`;
};

// يبني شكل HTML حلو للرسالة حسب نوعها (بنفس تصميم صندوق تأكيد الطلب)، ولو حصل أي خطأ بيرجع نص بسيط بدل ما يفشل الإرسال كله.
async function buildEmailHtml(job) {
  try {
    if (job.kind === 'order_confirmation') {
      const order = await Order.findById(job.entityId).lean();
      if (order) return await orderHtml(order, confirmationUrlFor(order), cancelUrlFor(order));
    } else if (job.kind === 'order_status') {
      const sep = String(job.entityId || '').indexOf(':');
      const orderId = sep >= 0 ? job.entityId.slice(0, sep) : job.entityId;
      const statusValue = sep >= 0 ? job.entityId.slice(sep + 1) : (job.subject || '');
      const order = await Order.findById(orderId).lean();
      if (order) return await orderStatusHtml(order, statusValue, job.content);
    } else if (job.kind === 'abandoned_cart') {
      const cart = await AbandonedCart.findById(job.entityId).lean();
      if (cart) return await abandonedCartHtml(cart, job.content, job.couponCode || '');
    } else if (job.kind === 'campaign') {
      return await campaignHtml(job.subject, job.content);
    }
  } catch (e) {
    console.error('buildEmailHtml:', e.message);
  }
  return `<div style="font-family:Arial;direction:rtl;white-space:pre-wrap">${esc(job.content)}</div>`;
}

// إرسال job واحد (مهما كان نوعه) فعليًا عبر Brevo، وإرجاع نتيجة الإرسال (messageId).
// order_confirmation ليها معاملة خاصة لأنها محتاجة رابط تأكيد ومحتوى مبني من الطلب نفسه.
async function sendJob(job) {
  if (job.kind === 'order_confirmation') {
    const order = await Order.findById(job.entityId);
    if (!order) throw new Error('Order not found for confirmation job');

    if (job.channel === 'whatsapp') {
      const result = await sendWhatsApp({
        phone: job.recipientPhone,
        templateId: process.env.BREVO_ORDER_CONFIRM_TEMPLATE_ID,
        senderNumber: process.env.BREVO_WHATSAPP_SENDER,
        params: { orderId: String(order.orderNumber ?? order._id), total: String(order.totalAmount || 0) },
        bodyText: `تأكيد طلبك #${order.orderNumber ?? order._id}`,
      });
      await Order.updateOne({ _id: order._id }, { $set: {
        'emailConfirmation.status': 'sent',
        'emailConfirmation.messageId': result?.messageId || null,
      } });
      return result;
    }

    const confirmationUrl = confirmationUrlFor(order);
    const cancelUrl = cancelUrlFor(order);
    const result = await sendEmail({
      to: job.recipientEmail,
      name: order.customerName,
      subject: job.subject || `تأكيد طلبك #${order.orderNumber ?? order._id}`,
      html: await orderHtml(order, confirmationUrl, cancelUrl),
      text: `تأكيد طلبك #${order.orderNumber ?? order._id}: ${confirmationUrl} — إلغاء الطلب: ${cancelUrl}`,
      tags: ['order_confirmation'],
    });
    await Order.updateOne({ _id: order._id }, { $set: {
      'emailConfirmation.status': 'sent',
      'emailConfirmation.messageId': result?.messageId || null,
    } });
    return result;
  }

  if (job.channel === 'email') {
    const html = await buildEmailHtml(job);
    return sendEmail({ to: job.recipientEmail, subject: job.subject || 'LAVA', html, text: job.content, tags: [job.kind] });
  }
  return sendWhatsApp({ phone: job.recipientPhone, templateId: job.whatsappTemplateId, senderNumber: process.env.BREVO_WHATSAPP_SENDER, bodyText: job.content });
}

// لما job يفشل نهائيًا (استنفد كل محاولات الـ retry) ولو كان تأكيد طلب،
// لازم نعلّم الطلب نفسه بالفشل عشان يظهر بوضوح في لوحة التحكم.
async function markEntityFailedIfNeeded(job) {
  if (job.kind === 'order_confirmation') {
    await Order.updateOne({ _id: job.entityId }, { $set: { 'emailConfirmation.status': 'failed' } }).catch(() => {});
  }
}

// ============================================================
// معالجة job واحد بس في كل tick (claim atomic عبر findOneAndUpdate)
// حالات واضحة: pending -> sending -> sent | pending (retry) | failed
// ============================================================
async function processQueue() {
  if (!configured()) return;
  const now = new Date();
  const job = await MarketingMessage.findOneAndUpdate(
    { status: 'pending', scheduledAt: { $lte: now } },
    { $set: { status: 'sending' } },
    { sort: { scheduledAt: 1 }, new: true }
  );
  if (!job) return;

  console.log(`[marketing-worker] job started id=${job._id} kind=${job.kind} channel=${job.channel}`);

  try {
    const result = await sendJob(job);
    job.status = 'sent';
    job.sentAt = new Date();
    job.providerMessageId = result?.messageId || result?.messageIds?.[0];
    job.error = undefined;
    await job.save();
    console.log(`[marketing-worker] job completed id=${job._id} kind=${job.kind}`);
  } catch (err) {
    const attempts = (job.attempts || 0) + 1;
    const maxAttempts = job.maxAttempts || 3;
    job.attempts = attempts;
    job.error = String(err.message || 'send failed').slice(0, 1000);

    if (attempts < maxAttempts) {
      // ===== retry محدود وآمن: backoff تصاعدي بسيط (2, 4, 8 دقايق...) بدون أي queue خارجية =====
      const backoffMinutes = Math.pow(2, attempts);
      job.status = 'pending';
      job.scheduledAt = new Date(Date.now() + backoffMinutes * 60000);
      await job.save();
      console.warn(`[marketing-worker] job retry scheduled id=${job._id} kind=${job.kind} attempt=${attempts}/${maxAttempts} in ${backoffMinutes}m`);
    } else {
      job.status = 'failed';
      await job.save();
      await markEntityFailedIfNeeded(job);
      console.error(`[marketing-worker] job failed permanently id=${job._id} kind=${job.kind} attempts=${attempts}`);
    }
  }
}

async function scheduleAbandonedCarts() {
  const settings = await Settings.findOne().select('marketing').lean();
  const cfg = settings?.marketing?.abandonedCart;
  if (!cfg?.enabled || !Array.isArray(cfg.steps) || !cfg.steps.length) return;
  const carts = await AbandonedCart.find({ recoveredAt:null, customerEmail:{ $exists:true, $ne:null } }).sort({ lastSeen:1 }).limit(500).lean();
  // ===== FIX: موافقة الماركتنج - العملاء اللي عندهم حساب وألغوا موافقتهم
  // ميتبعتلهمش رسائل السلة المتروكة (نفس فكرة queueStatusNotification). =====
  const customerIds = carts.map(c => c.customerId).filter(Boolean);
  const optedOutIds = customerIds.length
    ? new Set((await User.find({ _id: { $in: customerIds }, marketingConsent: false }).select('_id').lean()).map(u => String(u._id)))
    : new Set();
  const now = Date.now();
  for (const cart of carts) {
    if (cart.customerId && optedOutIds.has(String(cart.customerId))) continue;
    for (let i=0;i<cfg.steps.length;i++) {
      const step = cfg.steps[i];
      const scheduled = new Date(new Date(cart.lastSeen || cart.createdAt).getTime() + Number(step.delayMinutes || 120)*60000);
      if (scheduled.getTime() > now) continue;
      const exists = await MarketingMessage.findOne({ kind:'abandoned_cart', entityId:String(cart._id), step:i, channel:step.channel });
      if (exists) continue;
      const itemText = (cart.items || []).map(x => `${x.name?.ar || x.name?.en || x.name} x${x.quantity||1}`).join('، ');
      await MarketingMessage.create({ kind:'abandoned_cart', channel:step.channel, recipientEmail:cart.customerEmail, recipientPhone:cart.customerPhone, subject:step.subject || 'لسه حاجاتك في السلة', content:render(step.content || 'وحشتنا! لسه المنتجات دي محفوظة في عربيتك.', { items:itemText, subtotal:cart.subtotal, couponCode:step.couponCode || '' }), couponCode: step.couponCode || '', entityId:String(cart._id), step:i, scheduledAt:scheduled });
    }
  }
}

// ===== حماية ضد تشغيل نفس الـ tick أكتر من مرة في نفس الوقت =====
// لو tick سابق لسه شغال (مثلاً استغرق أكتر من 15 ثانية)، الـ tick الجديد
// بيتجاهل نفسه بدل ما يشتغل فوق نفس الشغل مرة تانية.
let tickRunning = false;

async function startMarketingWorker() {
  const tick = async () => {
    if (tickRunning) {
      console.log('[marketing-worker] previous tick still running, skipping this cycle');
      return;
    }
    tickRunning = true;
    try {
      await scheduleAbandonedCarts();
      await processQueue();
      await processQueue();
    } catch (e) {
      console.error('[marketing-worker] tick error:', e.message);
    } finally {
      tickRunning = false;
    }
  };
  await tick();
  return setInterval(tick, 15000);
}
module.exports = { startMarketingWorker };