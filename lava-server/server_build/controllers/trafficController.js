const TrafficEvent = require('../models/TrafficEvent');
const FunnelEvent  = require('../models/FunnelEvent');
const Settings     = require('../models/Settings');

// ─── ثوابت ────────────────────────────────────────────────────────────────
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 دقيقة خمول
const ONLINE_WINDOW_MS   = 5  * 60 * 1000; // آخر 5 دقايق = "أونلاين دلوقتي" (لوحة التحكم)
const PRODUCT_VIEW_WINDOW_MS = 3 * 60 * 1000; // آخر 3 دقايق = "بيشوف الصفحة دلوقتي" (صفحة المنتج)

// ─── تحديد المصدر من الـ UTM أو الـ Referrer ──────────────────────────────
const detectSource = (utm_source, referrer) => {
  if (utm_source) {
    const s = utm_source.toLowerCase();
    if (s.includes('facebook') || s.includes('fb')) return 'facebook';
    if (s.includes('instagram') || s.includes('ig')) return 'instagram';
    if (s.includes('tiktok'))   return 'tiktok';
    if (s.includes('google')   || s.includes('adwords')) return 'google';
    if (s.includes('snapchat') || s.includes('snap'))    return 'snapchat';
    return utm_source.toLowerCase();
  }
  if (referrer) {
    const r = referrer.toLowerCase();
    if (r.includes('facebook.com') || r.includes('fb.com'))  return 'facebook';
    if (r.includes('instagram.com'))  return 'instagram';
    if (r.includes('tiktok.com'))     return 'tiktok';
    if (r.includes('google.com') || r.includes('google.'))   return 'google';
    if (r.includes('snapchat.com'))   return 'snapchat';
    if (r.includes('youtube.com'))    return 'youtube';
    if (r.includes('twitter.com') || r.includes('x.com'))    return 'twitter';
    return 'other';
  }
  return 'direct';
};

// ─── تحديد الجهاز من User-Agent ───────────────────────────────────────────
const detectDevice = (ua = '') => {
  if (!ua) return 'unknown';
  if (/tablet|ipad/i.test(ua))                   return 'tablet';
  if (/mobile|android|iphone|ipod/i.test(ua))    return 'mobile';
  return 'desktop';
};

// ══════════════════════════════════════════════════════════════════════════
// POST /api/traffic/visit  — session_start
// الفرونت هو اللي بيقرر لو الـ session جديدة (بناءً على lastActivity في localStorage)
// البكند بيسجّل بدون dedup — كل sessionId جديد = record جديد
// ══════════════════════════════════════════════════════════════════════════
const recordVisit = async (req, res) => {
  try {
    const {
      visitorId, sessionId,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referrer, page,
    } = req.body;

    if (!visitorId || !sessionId) {
      return res.status(400).json({ message: 'visitorId و sessionId مطلوبان' });
    }

    // تحقق: هل الـ sessionId ده موجود أصلاً (حماية من duplicate في حالة network retry)
    const existing = await TrafficEvent.findOne({ sessionId }).select('_id').lean();
    if (existing) return res.json({ ok: true, duplicate: true });

    const source = detectSource(utm_source, referrer);
    const device = detectDevice(req.headers['user-agent']);

    await TrafficEvent.create({
      visitorId,
      sessionId,
      source,
      utm_source:   utm_source   || null,
      utm_medium:   utm_medium   || null,
      utm_campaign: utm_campaign || null,
      utm_term:     utm_term     || null,
      utm_content:  utm_content  || null,
      referrer:     referrer     || null,
      landingPage:  page || '/',
      page:         page || '/',
      device,
      lastActivity: new Date(),
      converted: false,
    });

    // سجّل أول خطوة في الـ funnel تلقائياً
    await FunnelEvent.updateOne(
      { sessionId, step: 'visit' },
      { $setOnInsert: { visitorId, sessionId, step: 'visit' } },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (err) {
    if (err.code === 11000) return res.json({ ok: true, duplicate: true });
    console.error('recordVisit error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// POST /api/traffic/pageview  — page_view (navigation داخل نفس الـ session)
// ══════════════════════════════════════════════════════════════════════════
const recordPageView = async (req, res) => {
  try {
    const { sessionId, page, visitorId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId مطلوب' });

    // upsert: لو الـ session_start الأصلية فشلت لأي سبب (سيرفر واقف وقتها،
    // مشكلة شبكة مؤقتة...) بنضمن على الأقل إن الزيارة تتسجل من هنا بدل ما
    // تتفقد بالكامل - أفضل من findOneAndUpdate عادي اللي كان بيعمل no-op
    // صامت لو الـ TrafficEvent مش موجود أصلاً.
    await TrafficEvent.findOneAndUpdate(
      { sessionId },
      {
        $inc: { pageViewCount: 1 },
        $set: { page: page || '/', lastActivity: new Date() },
        $setOnInsert: {
          visitorId: visitorId || sessionId,
          source: 'direct',
          landingPage: page || '/',
        },
      },
      { sort: { createdAt: -1 }, upsert: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('recordPageView error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/traffic/convert
// ══════════════════════════════════════════════════════════════════════════
const markConverted = async (req, res) => {
  try {
    const { sessionId, orderId, orderAmount, visitorId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId مطلوب' });

    // upsert دفاعي: لو الـ session دي أصلاً متسجلتش (session_start فشلت)،
    // برضو لازم نسجّل إن الأوردر ده جه من زيارة حقيقية بدل ما نضيّع الربط
    // بين الأوردر ومصدر الزيارة بالكامل.
    await TrafficEvent.findOneAndUpdate(
      { sessionId },
      {
        $set: { converted: true, orderId: orderId || null, orderAmount: orderAmount || null, lastActivity: new Date() },
        $setOnInsert: { visitorId: visitorId || sessionId, source: 'direct' },
      },
      { sort: { createdAt: -1 }, upsert: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('markConverted error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// POST /api/traffic/funnel  — خطوات الفانيل
// ══════════════════════════════════════════════════════════════════════════
const recordFunnelStep = async (req, res) => {
  try {
    const { visitorId, sessionId, step } = req.body;
    const validSteps = ['visit', 'product_view', 'add_to_cart', 'checkout', 'purchase'];
    if (!sessionId || !validSteps.includes(step)) {
      return res.status(400).json({ message: 'sessionId أو step غير صحيح' });
    }

    await FunnelEvent.updateOne(
      { sessionId, step },
      { $setOnInsert: { visitorId: visitorId || sessionId, sessionId, step } },
      { upsert: true }
    );

    // حدّث lastActivity في الـ TrafficEvent
    if (['add_to_cart', 'checkout', 'purchase'].includes(step)) {
      await TrafficEvent.findOneAndUpdate(
        { sessionId },
        { $set: { lastActivity: new Date() } },
        { sort: { createdAt: -1 } }
      );
    }

    res.json({ ok: true });
  } catch (err) {
    if (err.code === 11000) return res.json({ ok: true, duplicate: true });
    console.error('recordFunnelStep error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// GET /api/traffic/stats
// بيستخدم MongoDB aggregation بدل ما يحمّل كل الـ events في الميموري
// (كان قبل كده بيعمل .find().lean() على كل الأحداث في المدى الزمني، وده
// بيبقى بطيء جدًا وبياكل ميموري كتير لما يبقى فيه traffic كبير).
// ══════════════════════════════════════════════════════════════════════════
const getStats = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match = { createdAt: { $gte: since } };

    // ─── إحصائيات عامة + حسب المصدر + حسب اليوم + حسب الجهاز + حسب الساعة، كلها في aggregation واحدة ─────
    const [summaryAgg, bySourceAgg, dailyAgg, byDeviceAgg, funnelCounts, byHourAgg] = await Promise.all([
      TrafficEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            visitorIds: { $addToSet: { $ifNull: ['$visitorId', '$sessionId'] } },
            sessionIds: { $addToSet: '$sessionId' },
            totalPageViews: { $sum: { $ifNull: ['$pageViewCount', 1] } },
            totalOrders: { $sum: { $cond: ['$converted', 1, 0] } },
            totalRevenue: { $sum: { $cond: ['$converted', { $ifNull: ['$orderAmount', 0] }, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            totalVisitors: { $size: '$visitorIds' },
            totalSessions: { $size: '$sessionIds' },
            totalPageViews: 1,
            totalOrders: 1,
            totalRevenue: 1,
          },
        },
      ]),
      TrafficEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $ifNull: ['$source', 'direct'] },
            visitorIds: { $addToSet: { $ifNull: ['$visitorId', '$sessionId'] } },
            sessionIds: { $addToSet: '$sessionId' },
            orders: { $sum: { $cond: ['$converted', 1, 0] } },
            revenue: { $sum: { $cond: ['$converted', { $ifNull: ['$orderAmount', 0] }, 0] } },
          },
        },
        {
          $project: {
            source: '$_id',
            _id: 0,
            visitors: { $size: '$visitorIds' },
            visits: { $size: '$sessionIds' },
            orders: 1,
            revenue: 1,
          },
        },
      ]),
      TrafficEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            visitorIds: { $addToSet: { $ifNull: ['$visitorId', '$sessionId'] } },
            sessions: { $sum: 1 },
            orders: { $sum: { $cond: ['$converted', 1, 0] } },
            revenue: { $sum: { $cond: ['$converted', { $ifNull: ['$orderAmount', 0] }, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            _id: 0,
            visitors: { $size: '$visitorIds' },
            sessions: 1,
            orders: 1,
            revenue: 1,
          },
        },
      ]),
      TrafficEvent.aggregate([
        { $match: match },
        { $group: { _id: { $ifNull: ['$device', 'unknown'] }, count: { $sum: 1 } } },
        { $project: { device: '$_id', _id: 0, count: 1 } },
      ]),
      FunnelEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$step',
            uniqueVisitors: { $addToSet: '$visitorId' },
            uniqueSessions: { $addToSet: '$sessionId' },
          },
        },
        {
          $project: {
            step:     '$_id',
            visitors: { $size: '$uniqueVisitors' },
            sessions: { $size: '$uniqueSessions' },
            _id: 0,
          },
        },
      ]),
      // ===== FIX: أضفنا "ساعات النشاط" هنا (مبنية على زيارات حقيقية فعلاً)
      // — قبل كده شاشة "تحليلات الزيارات" في الأدمن كانت بتحسب "ساعات
      // النشاط" من الطلبات والسلات المتروكة (اللي أعدادها قليلة عادةً)
      // مش من الزيارات نفسها، فكانت بتفضل فاضية طول ما مفيش طلبات كتير،
      // حتى لو فيه زيارات حقيقية كتير على الموقع. دلوقتي بتتحسب من ساعة
      // كل زيارة فعلية (TrafficEvent.createdAt).
      TrafficEvent.aggregate([
        { $match: match },
        {
          $group: {
            // بتوقيت القاهرة (مش UTC) عشان "ساعة الذروة" تتطابق مع الوقت
            // المحلي الفعلي اللي شغالين بيه، مش وقت السيرفر العالمي.
            _id: { $hour: { date: '$createdAt', timezone: 'Africa/Cairo' } },
            count: { $sum: 1 },
          },
        },
        { $project: { hour: '$_id', count: 1, _id: 0 } },
      ]),
    ]);

    const summary = summaryAgg[0] || { totalVisitors: 0, totalSessions: 0, totalPageViews: 0, totalOrders: 0, totalRevenue: 0 };

    const bySource = bySourceAgg
      .map((s) => ({
        source: s.source,
        visitors: s.visitors,
        visits: s.visits, // للتوافق مع الـ UI القديم
        orders: s.orders,
        revenue: Math.round(s.revenue),
        conversionRate: s.visitors > 0 ? ((s.orders / s.visitors) * 100).toFixed(1) : '0.0',
        revenuePerVisit: s.visitors > 0 ? Math.round(s.revenue / s.visitors) : 0,
      }))
      .sort((a, b) => b.visitors - a.visitors);

    const daily = dailyAgg.map((d) => ({
      date: d.date,
      visits: d.sessions,
      visitors: d.visitors,
      orders: d.orders,
      revenue: Math.round(d.revenue),
    }));

    // ─── Funnel ────────────────────────────────────────────────────────
    // ===== FIX: الرقم المعروض في الفانل كان بيتحسب من عدد "الزوار
    // الفريدين" (visitorId) مش عدد "مرات الدخول" (sessionId). بما إن
    // visitorId ثابت لنفس الجهاز للأبد (وده صح — عشان يحسب زائر واحد لنفس
    // الشخص)، كان معناه إن رجوع نفس الجهاز بعد 30 دقيقة أو يوم أو سنة —
    // حتى لو اتسجلت جلسة (session) جديدة فعليًا بنجاح في قاعدة البيانات —
    // مكانش بيغيّر رقم الفانل خالص، لأن نفس الـvisitorId موجود بالفعل من
    // أول مرة. دلوقتي بنستخدم عدد الـsessions (اللي هو فعليًا "كام مرة
    // حصلت الخطوة دي" وبيزيد مع كل جلسة جديدة) بدل عدد الزوار الفريدين.
    const STEPS = ['visit', 'product_view', 'add_to_cart', 'checkout', 'purchase'];
    const funnelMap = {};
    for (const r of funnelCounts) funnelMap[r.step] = { visitors: r.visitors, sessions: r.sessions };

    const topSessions = funnelMap['visit']?.sessions || 1;

    const funnel = STEPS.map((step, i) => {
      const curr = funnelMap[step]?.sessions || 0;
      const prev = i === 0 ? curr : (funnelMap[STEPS[i - 1]]?.sessions || 0);
      return {
        step,
        count:       curr,
        visitors:    funnelMap[step]?.visitors || 0, // متاح لو حبيت تعرضه بجانب عدد مرات الدخول
        dropoffRate: prev > 0 ? (((prev - curr) / prev) * 100).toFixed(1) : '0.0',
        convFromTop: topSessions > 0 ? ((curr / topSessions) * 100).toFixed(1) : '0.0',
      };
    });

    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    byHourAgg.forEach((r) => {
      if (r.hour >= 0 && r.hour < 24) byHour[r.hour].count = r.count;
    });

    res.json({
      summary: {
        totalVisitors: summary.totalVisitors,
        totalSessions: summary.totalSessions,
        totalPageViews: summary.totalPageViews,
        totalOrders: summary.totalOrders,
        totalRevenue: Math.round(summary.totalRevenue),
        overallConversionRate: summary.totalVisitors > 0
          ? ((summary.totalOrders / summary.totalVisitors) * 100).toFixed(1)
          : '0.0',
      },
      bySource,
      byDevice: byDeviceAgg,
      byHour,
      daily,
      funnel,
      days,
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// GET /api/traffic/online — عدد الزوار الأونلاين دلوقتي (لوحة التحكم)
// بيعتمد على lastActivity خلال آخر ONLINE_WINDOW_MS، وبيعدّ visitorId الفريد
// ══════════════════════════════════════════════════════════════════════════
const getOnlineNow = async (req, res) => {
  try {
    const since = new Date(Date.now() - ONLINE_WINDOW_MS);
    const visitorIds = await TrafficEvent.distinct('visitorId', { lastActivity: { $gte: since } });
    res.json({ online: visitorIds.filter(Boolean).length });
  } catch (err) {
    console.error('getOnlineNow error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// GET /api/traffic/product-viewers/:productId — كام عميل بيشوف صفحة المنتج ده دلوقتي
// عام (بيستخدمه العميل في صفحة المنتج)، لكن بيتقفل تلقائياً لو الأدمن معطّل
// خاصية showLiveViewers من الإعدادات
// ══════════════════════════════════════════════════════════════════════════
const getProductViewers = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) return res.status(400).json({ message: 'productId مطلوب' });

    const settings = await Settings.findOne().select('showLiveViewers').lean();
    if (!settings?.showLiveViewers) {
      return res.json({ viewers: 0, enabled: false });
    }

    const since = new Date(Date.now() - PRODUCT_VIEW_WINDOW_MS);
    const page = `/product/${productId}`;
    const visitorIds = await TrafficEvent.distinct('visitorId', { page, lastActivity: { $gte: since } });
    res.json({ viewers: visitorIds.filter(Boolean).length, enabled: true });
  } catch (err) {
    console.error('getProductViewers error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

module.exports = { recordVisit, recordPageView, markConverted, recordFunnelStep, getStats, getOnlineNow, getProductViewers };