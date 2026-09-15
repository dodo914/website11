const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const AbandonedCart = require('../models/AbandonedCart');
const MarketingMessage = require('../models/MarketingMessage');
const { sendEmail, sendWhatsApp, configured, verifyConfirmationToken, escapeHtml } = require('../services/brevoService');

const normalizeEmail = e => String(e || '').trim().toLowerCase();

const getMarketing = async (req, res) => {
  const settings = await Settings.findOne().select('marketing').lean();
  res.json({ configured: configured(), marketing: settings?.marketing || {} });
};

const updateMarketing = async (req, res) => {
  const input = req.body?.marketing || req.body || {};
  const safe = {
    enabled: Boolean(input.enabled),
    orderConfirmation: Boolean(input.orderConfirmation),
    orderConfirmationChannel: ['email','whatsapp'].includes(input.orderConfirmationChannel) ? input.orderConfirmationChannel : 'email',
    statusNotifications: Boolean(input.statusNotifications),
    statusChannels: Array.isArray(input.statusChannels) ? input.statusChannels.slice(0, 30).map(x => ({
      status: String(x.status || '').slice(0, 80), enabled: Boolean(x.enabled), channel: ['email','whatsapp'].includes(x.channel) ? x.channel : 'email', subject: String(x.subject || '').slice(0, 180), content: String(x.content || '').slice(0, 20000),
    })) : [],
    abandonedCart: {
      enabled: Boolean(input.abandonedCart?.enabled),
      steps: Array.isArray(input.abandonedCart?.steps) ? input.abandonedCart.steps.slice(0, 10).map((x, i) => ({
        step: i, delayMinutes: Math.max(1, Math.min(10080, Number(x.delayMinutes) || 120)), channel: ['email','whatsapp'].includes(x.channel) ? x.channel : 'email', subject: String(x.subject || '').slice(0, 180), content: String(x.content || '').slice(0, 20000), couponCode: String(x.couponCode || '').slice(0, 80),
      })) : [],
    },
    whatsapp: { enabled: Boolean(input.whatsapp?.enabled), senderNumber: String(input.whatsapp?.senderNumber || '').replace(/\D/g, '').slice(0, 20) },
  };
  await Settings.findOneAndUpdate({}, { $set: { marketing: safe } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ ok: true, marketing: safe, configured: configured() });
};

function renderText(template, ctx) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const parts = key.split('.'); let value = ctx;
    for (const p of parts) value = value?.[p];
    return value == null ? '' : String(value);
  });
}

// حجم الدفعة الواحدة لجدولة رسائل الحملة — بنقسّم الجمهور الكبير لدفعات صغيرة
// (batching) بدل ما نحمّل كل العملاء في الميموري مرة واحدة أو نعمل insert
// ضخم واحد، وبنسيب فرصة للـ event loop يستجيب لطلبات تانية بين كل دفعة.
const CAMPAIGN_BATCH_SIZE = 500;
const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

const queueCampaign = async (req, res) => {
  try {
    const { channel='email', subject='', content='', audience='all', couponCode='', whatsappTemplateId } = req.body || {};
    if (!['email','whatsapp'].includes(channel)) return res.status(400).json({ message: 'القناة غير صحيحة' });
    if (!String(content).trim()) return res.status(400).json({ message: 'اكتب الرسالة أولاً' });
    // ===== FIX: الفئات المتاحة كانت "الكل" و"أصحاب الطلبات" بس. ضفنا:
    // - abandoned_cart: حطوا حاجات في السلة وماكملوش (من AbandonedCart
    //   مباشرة، مش من جدول العملاء، عشان نوصل حتى لو دخل زائر من غير حساب).
    // - inactive_customers: عملاء عندهم طلب قديم بس مطلبوش من 60 يوم (إعادة
    //   استهداف/win-back) — فئة شائعة ومفيدة في التسويق بالإيميل.
    if (!['all', 'with_orders', 'abandoned_cart', 'inactive_customers'].includes(audience)) {
      return res.status(400).json({ message: 'فئة الجمهور غير معروفة' });
    }

    // معرّف واحد للحملة (للتجميع/التقارير)، لكن entityId الفريد لكل رسالة
    // لازم يكون مختلف لكل مستلم (campaignTag + userId)، وإلا الـ unique index
    // على (kind, entityId, step, channel) هيمنع إدخال أكتر من مستلم واحد
    // لنفس الحملة — وده كان بيسبب إرسال الحملة لعميل واحد بس فعليًا.
    const campaignTag = `campaign-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const scheduledAt = new Date();

    let queued = 0;
    let batch = [];
    const flushBatch = async () => {
      if (!batch.length) return;
      await MarketingMessage.insertMany(batch, { ordered: false });
      queued += batch.length;
      batch = [];
      // بنسيب الـ event loop يلحق يستجيب لأي HTTP request تاني جاي للعملاء
      // قبل ما نكمل الدفعة الجاية، بدل ما الحملة الكبيرة تحجز الـ process كله.
      await yieldToEventLoop();
    };

    if (audience === 'abandoned_cart') {
      // ===== سلات متروكة: بنبعت لصاحب السلة نفسه (سواء عنده حساب أو زائر)،
      // مباشرة من بيانات السلة المتروكة (اسمه/إيميله/تليفونه المسجلين وقت
      // ما سابها)، مش من جدول العملاء — عشان الزوار (Guests) اللي سابوا
      // سلة من غير ما يعملوا حساب يتغطوا برضو، مش بس اللي عندهم حساب.
      const seen = new Set();
      const contactField = channel === 'email' ? 'customerEmail' : 'customerPhone';
      const cursor = AbandonedCart
        .find({ recoveredAt: null, [contactField]: { $exists: true, $ne: null, $ne: '' } })
        .select('customerName customerEmail customerPhone customerId')
        .lean()
        .cursor();
      for (let c = await cursor.next(); c != null; c = await cursor.next()) {
        const target = channel === 'email' ? normalizeEmail(c.customerEmail) : String(c.customerPhone || '').replace(/\D/g, '');
        if (!target || seen.has(target)) continue;
        // ===== FIX: موافقة الماركتنج - لو السلة تابعة لعميل عنده حساب وألغى
        // موافقته على إيميلات الماركتنج، منبعتش له رسالة الحملة عبر الإيميل. =====
        if (channel === 'email' && c.customerId) {
          const owner = await User.findById(c.customerId).select('marketingConsent').lean();
          if (owner && owner.marketingConsent === false) continue;
        }
        seen.add(target);
        const customerCtx = { name: c.customerName || '', email: c.customerEmail || '', phone: c.customerPhone || '' };
        batch.push({
          kind: 'campaign',
          channel,
          recipientEmail: normalizeEmail(c.customerEmail),
          recipientPhone: String(c.customerPhone || '').replace(/\D/g, ''),
          subject: String(subject).slice(0, 180),
          content: renderText(content, { customer: customerCtx, couponCode }),
          scheduledAt,
          status: 'pending',
          entityId: `${campaignTag}-${target}`,
          whatsappTemplateId: whatsappTemplateId ? Number(whatsappTemplateId) : undefined,
        });
        if (batch.length >= CAMPAIGN_BATCH_SIZE) await flushBatch();
      }
      await flushBatch();
      return res.json({ ok: true, queued });
    }

    if (audience === 'inactive_customers') {
      // ===== عملاء قدامى ماطلبوش من فترة (60 يوم): بنجيب آخر تاريخ طلب لكل
      // عميل عنده طلب على الأقل، ونستبعد اللي طلبوا بعد الحد ده.
      const INACTIVE_DAYS = 60;
      const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
      const recentCustomerIds = await Order.distinct('customerId', { customerId: { $ne: null }, createdAt: { $gte: cutoff } });
      const allCustomerIdsWithOrders = await Order.distinct('customerId', { customerId: { $ne: null } });
      const recentSet = new Set(recentCustomerIds.map(String));
      const inactiveIds = allCustomerIdsWithOrders.filter((id) => !recentSet.has(String(id)));

      const cursor = User.find({ role: 'customer', _id: { $in: inactiveIds }, ...(channel === 'email' ? { marketingConsent: { $ne: false } } : {}) }).select('name email phone').lean().cursor();
      for (let u = await cursor.next(); u != null; u = await cursor.next()) {
        const target = channel === 'email' ? normalizeEmail(u.email) : String(u.phone || '').replace(/\D/g, '');
        if (!target) continue;
        batch.push({
          kind: 'campaign',
          channel,
          recipientEmail: normalizeEmail(u.email),
          recipientPhone: String(u.phone || '').replace(/\D/g, ''),
          subject: String(subject).slice(0, 180),
          content: renderText(content, { customer: u, couponCode }),
          scheduledAt,
          status: 'pending',
          entityId: `${campaignTag}-${u._id}`,
          whatsappTemplateId: whatsappTemplateId ? Number(whatsappTemplateId) : undefined,
        });
        if (batch.length >= CAMPAIGN_BATCH_SIZE) await flushBatch();
      }
      await flushBatch();
      return res.json({ ok: true, queued });
    }

    const filter = { role: 'customer' };
    if (audience === 'with_orders') {
      filter._id = { $in: await Order.distinct('customerId', { customerId: { $ne: null } }) };
    }
    // ===== FIX: موافقة الماركتنج - العملاء اللي ألغوا موافقتهم مايتبعتلهمش
    // حملات إيميل (زي شوبيفاي بالظبط). واتساب مش متأثر بالإعداد ده. =====
    if (channel === 'email') {
      filter.marketingConsent = { $ne: false };
    }

    // ===== cursor بدل find().lean() عادي: بيقرأ العملاء واحد ورا التاني من =====
    // MongoDB من غير ما يحمّل كل الجمهور (ممكن يكون ملايين) في الميموري مرة واحدة.
    const cursor = User.find(filter).select('name email phone').lean().cursor();
    for (let u = await cursor.next(); u != null; u = await cursor.next()) {
      const target = channel === 'email' ? normalizeEmail(u.email) : String(u.phone || '').replace(/\D/g, '');
      if (!target) continue;

      batch.push({
        kind: 'campaign',
        channel,
        recipientEmail: normalizeEmail(u.email),
        recipientPhone: String(u.phone || '').replace(/\D/g, ''),
        subject: String(subject).slice(0, 180),
        content: renderText(content, { customer: u, couponCode }),
        scheduledAt,
        status: 'pending',
        entityId: `${campaignTag}-${u._id}`,
        whatsappTemplateId: whatsappTemplateId ? Number(whatsappTemplateId) : undefined,
      });

      if (batch.length >= CAMPAIGN_BATCH_SIZE) await flushBatch();
    }
    await flushBatch();

    res.json({ ok: true, queued });
  } catch (err) { console.error('Marketing campaign error:', err); res.status(500).json({ message: 'تعذر تجهيز الحملة' }); }
};

const confirmOrderByEmail = async (req, res) => {
  try {
    const data = verifyConfirmationToken(req.params.token);
    if (!data) return res.status(400).send('<h2>رابط التأكيد غير صالح أو منتهي.</h2>');
    const order = await Order.findById(data.orderId);
    if (!order || normalizeEmail(order.customerEmail) !== normalizeEmail(data.email)) return res.status(404).send('<h2>الطلب غير موجود.</h2>');
    if (!order.emailConfirmation?.confirmedAt) {
      order.emailConfirmation = { ...(order.emailConfirmation?.toObject?.() || order.emailConfirmation || {}), confirmedAt: new Date(), confirmedEmail: true };
      await order.save();
    }
    const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || '/';
    res.send(`<!doctype html><html><body style="font-family:Arial;text-align:center;padding:60px"><h1>تم تسجيل تأكيد طلبك ✅</h1><p>التأكيد من الإيميل تم تسجيله، وسيتم التواصل معك لتأكيد الطلب بشكل نهائي.</p><a href="${escapeHtml(clientUrl)}">العودة للمتجر</a></body></html>`);
  } catch (err) { console.error('confirm email:', err); res.status(500).send('<h2>حصل خطأ. حاول مرة أخرى.</h2>'); }
};

// ============================================================================
// P1-5 (Part A) — إلغاء الأوردر من رابط الإيميل: GET بيعرض تأكيد بس، POST هو
// اللي بيغيّر حالة الأوردر فعليًا.
// ----------------------------------------------------------------------------
// كان الرابط قبل كده GET وبيلغي الأوردر فورًا من غير أي تأكيد — ده بيخلي
// الإلغاء عرضة لـ prefetching (متصفحات/إضافات/سكانرز بتفتح الروابط في
// الإيميل تلقائيًا) أو مجرد ضغطة غلط، وبيغيّر حالة السيرفر من طلب GET وهو
// أصلاً ضد semantics بروتوكول HTTP (GET المفروض يكون safe/read-only).
// دلوقتي:
//   GET  /marketing/order-cancel/:token  -> صفحة تأكيد بس (زرار "تأكيد
//        الإلغاء" بيعمل POST لنفس الرابط)، من غير أي تعديل على الأوردر.
//   POST /marketing/order-cancel/:token  -> بينفذ الإلغاء فعليًا بعد نفس
//        التحقق (توكن صالح + غير منتهي + الإيميل مطابق لصاحب الأوردر).
//
// الحماية من إعادة الاستخدام (replay):
// التوكن نفسه HMAC-signed stateless (مفيهوش jti/nonce)، فمفيش تخزين لكل
// توكن اتصدر. بدل ما نبني نظام تخزين توكنات كامل (over-engineering لمشكلة
// صغيرة)، بنعتمد على حالة الأوردر نفسها كـ"استخدام واحد" فعلي: أول POST
// ناجح بيسجل cancelledAt + hash التوكن اللي استخدمه على الأوردر. أي محاولة
// POST تانية بعد كده (بنفس التوكن أو بتوكن صالح تاني لنفس الأوردر لسه في
// نافذة الصلاحية) بترجع "الطلب ملغي بالفعل" من غير ما تعمل أي تغيير تاني
// أو أي side effect (لا save تاني ولا إعادة إرسال إشعارات) — يعني التأثير
// الفعلي للتوكن (تغيير حالة الأوردر) بيحصل مرة واحدة بس، حتى لو الرابط
// اتفتح/اتضغط عليه أكتر من مرة.
// ============================================================================

const hashCancelToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

const cancelPageShell = (title, message, { clientUrl, formToken } = {}) => {
  const url = clientUrl || process.env.CLIENT_URL || process.env.FRONTEND_URL || '/';
  const form = formToken
    ? `<form method="POST" action="/marketing/order-cancel/${encodeURIComponent(formToken)}" style="margin-top:20px">
         <button type="submit" style="background:#ef4444;color:#fff;border:none;padding:14px 28px;border-radius:10px;font-weight:bold;font-size:16px;cursor:pointer">❌ تأكيد إلغاء الطلب</button>
       </form>`
    : '';
  return `<!doctype html><html><body style="font-family:Arial;text-align:center;padding:60px">
    <h1>${title}</h1>
    <p>${message}</p>
    ${form}
    <p style="margin-top:20px"><a href="${escapeHtml(url)}">العودة للمتجر</a></p>
  </body></html>`;
};

// ===== يتحقق من التوكن + يرجع الأوردر (fields محدودة فقط - مفيش عنوان/تليفون/
// items) لو موجود ومطابق لصاحب التوكن. بيرجع { data, order } أو يبعت رد الخطأ
// المناسب هو نفسه (عشان GET وPOST يستخدموا نفس منطق التحقق بالظبط). =====
const resolveCancelRequest = async (req, res, { selectFields }) => {
  const data = verifyConfirmationToken(req.params.token);
  if (!data) {
    res.status(400).send(cancelPageShell('رابط غير صالح ❌', 'رابط الإلغاء غير صالح أو منتهي الصلاحية.'));
    return null;
  }
  const order = await Order.findById(data.orderId).select(selectFields);
  // نفس رسالة "غير موجود" سواء الأوردر مش موجود أصلاً أو الإيميل مش مطابق -
  // منعًا لتسريب أي فرق يساعد حد يجرب orderId عشوائي مع إيميلات مختلفة.
  if (!order || normalizeEmail(order.customerEmail) !== normalizeEmail(data.email)) {
    res.status(404).send(cancelPageShell('غير موجود', 'الطلب غير موجود.'));
    return null;
  }
  return { data, order };
};

// GET /marketing/order-cancel/:token — عرض تأكيد بس، من غير أي تعديل على الأوردر
const showCancelConfirmation = async (req, res) => {
  try {
    const resolved = await resolveCancelRequest(req, res, 'orderNumber customerEmail totalAmount status emailConfirmation');
    if (!resolved) return;
    const { order } = resolved;

    if (order.emailConfirmation?.confirmedAt) {
      return res.send(cancelPageShell('تم تأكيد الطلب من قبل ✅', 'الطلب ده اتأكد قبل كده، مينفعش يتلغي من الإيميل. لو حابب تلغيه تواصل معانا مباشرة.'));
    }
    if (order.emailConfirmation?.cancelledAt) {
      return res.send(cancelPageShell('الطلب ملغي بالفعل', 'تم تسجيل إلغاء الطلب ده قبل كده.'));
    }

    const orderLabel = order.orderNumber ? `#${order.orderNumber}` : '';
    res.send(cancelPageShell(
      'تأكيد إلغاء الطلب',
      `هل أنت متأكد إنك عايز تلغي الطلب ${escapeHtml(orderLabel)}؟ الخطوة دي مينفعش ترجع فيها بعدين من نفس الرابط.`,
      { formToken: req.params.token },
    ));
  } catch (err) { console.error('show cancel confirmation:', err); res.status(500).send(cancelPageShell('حصل خطأ', 'حصل خطأ. حاول مرة أخرى.')); }
};

// POST /marketing/order-cancel/:token — بينفذ الإلغاء فعليًا
const cancelOrderByEmail = async (req, res) => {
  try {
    const resolved = await resolveCancelRequest(req, res, 'orderNumber customerEmail totalAmount status emailConfirmation');
    if (!resolved) return;
    const { data, order } = resolved;

    // ===== نفس قاعدة العمل اللي كانت موجودة قبل كده بالظبط: أوردر اتأكد
    // من الإيميل مينفعش يتلغي من نفس القناة (لازم تواصل مباشر) =====
    if (order.emailConfirmation?.confirmedAt) {
      return res.status(409).send(cancelPageShell('تم تأكيد الطلب من قبل ✅', 'الطلب ده اتأكد قبل كده، مينفعش يتلغي من الإيميل. لو حابب تلغيه تواصل معانا مباشرة.'));
    }

    // ===== one-time-use guard: الأوردر ده اتلغى قبل كده (بنفس التوكن ده أو
    // بتوكن صالح تاني) - رد آمن (idempotent)، من غير أي save/side-effect تاني =====
    if (order.emailConfirmation?.cancelledAt) {
      return res.status(409).send(cancelPageShell('الطلب ملغي بالفعل', 'تم تسجيل إلغاء الطلب ده قبل كده. الرابط ده اتستخدم بالفعل.'));
    }

    // ===== ملحوظة: الزرار ده بقى مايلغيش الأوردر فعليًا (order.status مبيتغيرش)،
    // هو بس بيسجل إن العميل طلب الإلغاء من الإيميل (emailConfirmation.cancelledAt)
    // عشان يبان كـ badge في الأدمن ("ألغى الطلب من الإيميل") والفريق يتواصل
    // معاه بعدين ويقرر - بالظبط زي زرار "تأكيد الطلب" اللي بيسجل بس تأكيد
    // من غير ما يغيّر حالة الأوردر. =====
    order.emailConfirmation = {
      ...(order.emailConfirmation?.toObject?.() || order.emailConfirmation || {}),
      cancelled: true,
      cancelledAt: new Date(),
      cancelTokenHash: hashCancelToken(req.params.token),
    };
    await order.save();

    res.send(cancelPageShell('تم تسجيل طلب الإلغاء ❌', 'تم تسجيل رغبتك في إلغاء الطلب، وهنتواصل معاك في أقرب وقت لتأكيد الإلغاء.'));
  } catch (err) { console.error('cancel email:', err); res.status(500).send(cancelPageShell('حصل خطأ', 'حصل خطأ. حاول مرة أخرى.')); }
};

const getMessageStats = async (req, res) => {
  const [pending, sent, failed] = await Promise.all([
    MarketingMessage.countDocuments({ status: 'pending' }),
    MarketingMessage.countDocuments({ status: 'sent' }),
    MarketingMessage.countDocuments({ status: 'failed' }),
  ]);
  res.json({ pending, sent, failed, configured: configured() });
};

module.exports = { getMarketing, updateMarketing, queueCampaign, confirmOrderByEmail, showCancelConfirmation, cancelOrderByEmail, getMessageStats };