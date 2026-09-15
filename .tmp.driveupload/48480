const AbandonedCart = require('../models/AbandonedCart');
const Settings = require('../models/Settings');
const { parsePagination, buildListResponse } = require('../utils/pagination');

// POST /api/abandoned-carts — يتبعت لما العميل يدخل Checkout بدون ما يكمل
const upsertAbandonedCart = async (req, res) => {
  try {
    const {
      sessionId, customerId, customerPhone, customerEmail,
      items, subtotal, governorate,
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId مطلوب' });
    }

    // لو السلة فاضية نحذف أي سجل سابق ليها
    if (!Array.isArray(items) || items.length === 0) {
      await AbandonedCart.deleteOne({ sessionId });
      return res.json({ message: 'cart cleared' });
    }

    const doc = await AbandonedCart.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        customerId: customerId || null,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        items,
        subtotal: subtotal || 0,
        governorate: governorate || null,
        lastSeen: new Date(),
        recoveredAt: null,
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, id: doc._id });
  } catch (err) {
    console.error('abandonedCart upsert error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// PUT /api/abandoned-carts/recover — لما يكمل أوردر حقيقي نحدد السلة كمتعافية
const markRecovered = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId مطلوب' });
    await AbandonedCart.findOneAndUpdate({ sessionId }, { recoveredAt: new Date() });
    res.json({ ok: true });
  } catch (err) {
    console.error('abandonedCart recover error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// GET /api/abandoned-carts — للأدمن فقط
const getAbandonedCarts = async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 200, defaultLimit: 50, hardCap: 500 });

    // ===== FIX: كان بيعرض أي سلة فيها منتجات فورًا من لحظة الإضافة، حتى لو
    // العميل لسه بيتصفح فعليًا من ثانية واحدة — مش "متروكة" فعلاً. دلوقتي
    // بنستني 10 دقايق خمول (من غير أي تحديث للسلة) قبل ما نعتبرها "متروكة"
    // ونعرضها هنا. السلات اللي كملت (اترجعلها recoveredAt) بتفضل تظهر
    // دايمًا بغض النظر عن التوقيت، عشان تتحسب صح في "تم الإكمال" و"نسبة
    // الإنقاذ".
    // ===== FIX: مدة الخمول دلوقتي بتتقرأ من الإعدادات (بدل رقم ثابت في
    // الكود)، عشان الأدمن يقدر يغيّرها بنفسه من شاشة السلات المتروكة.
    const settingsDoc = await Settings.findOne().select('abandonedCartIdleMinutes').lean();
    const idleMinutes = Number(settingsDoc?.abandonedCartIdleMinutes) > 0 ? Number(settingsDoc.abandonedCartIdleMinutes) : 30;
    const idleCutoff = new Date(Date.now() - idleMinutes * 60 * 1000);

    const filter = {
      createdAt: { $gte: since },
      $or: [
        { recoveredAt: { $ne: null } },
        { lastSeen: { $lte: idleCutoff } },
      ],
    };

    const [carts, total] = await Promise.all([
      AbandonedCart.find(filter)
        .populate('customerId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      isPaginated ? AbandonedCart.countDocuments(filter) : Promise.resolve(null),
    ]);

    // تنظيف وإثراء البيانات
    const enriched = carts.map(cart => {
      const customerInfo = cart.customerId;
      return {
        ...cart,
        // بيانات العميل المنظمة
        customerName: customerInfo?.name || null,
        customerEmail: cart.customerEmail || customerInfo?.email || null,
        customerPhone: cart.customerPhone || customerInfo?.phone || null,
        isGuest: !cart.customerId,
        // حساب وقت ترك السلة بشكل مقروء
        minutesSinceAbandoned: Math.round((Date.now() - new Date(cart.createdAt).getTime()) / 60000),
      };
    });

    const listResponse = buildListResponse({ isPaginated, page, limit, items: enriched, total });
    // الأدمن يقدر يشوف/يغيّر مدة الخمول من نفس الشاشة من غير طلب إضافي
    listResponse.abandonedCartIdleMinutes = idleMinutes;
    res.json(listResponse);
  } catch (err) {
    console.error('getAbandonedCarts error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ============================================================================
// GET /api/abandoned-carts/stats  (أدمن - تبويب لوحة البيانات + تبويب السلات المتروكة)
// ----------------------------------------------------------------------------
// ليه الإندبوينت ده اتضاف: قيم "الإيراد المفقود" و"الإيراد المسترجَع" ونسبة
// الاسترجاع كانت بتتحسب في الفرونت من قايمة abandonedCarts المعروضة على
// الشاشة - وهي قايمة *مُصفّحة (paginated)* أصلاً (صفحة واحدة بس في كل مرة)،
// يعني الأرقام دي كانت غلط من الأساس مهما كان حجم المتجر (مش بس بعد 1000
// زي حالة الأوردرات - هنا حتى لو 60 سلة بس والصفحة بتعرض 50، الرقم غلط).
// هنا بنستخدم *نفس فلتر* getAbandonedCarts بالظبط (نفس نافذة الـ30 يوم ونفس
// idleCutoff من الإعدادات) بس من غير skip/limit - aggregation على كل السلات
// المطابقة للفلتر مرة واحدة.
// ============================================================================
const getAbandonedCartStats = async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const settingsDoc = await Settings.findOne().select('abandonedCartIdleMinutes').lean();
    const idleMinutes = Number(settingsDoc?.abandonedCartIdleMinutes) > 0 ? Number(settingsDoc.abandonedCartIdleMinutes) : 30;
    const idleCutoff = new Date(Date.now() - idleMinutes * 60 * 1000);

    const filter = {
      createdAt: { $gte: since },
      $or: [
        { recoveredAt: { $ne: null } },
        { lastSeen: { $lte: idleCutoff } },
      ],
    };

    const [row] = await AbandonedCart.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          recoveredCount: { $sum: { $cond: [{ $ne: ['$recoveredAt', null] }, 1, 0] } },
          lostRevenue: { $sum: { $cond: [{ $eq: ['$recoveredAt', null] }, { $ifNull: ['$subtotal', 0] }, 0] } },
          recoveredRevenue: { $sum: { $cond: [{ $ne: ['$recoveredAt', null] }, { $ifNull: ['$subtotal', 0] }, 0] } },
        },
      },
    ]);

    const totalCount = row?.totalCount || 0;
    const recoveredCount = row?.recoveredCount || 0;

    res.json({
      totalCount,
      notRecoveredCount: totalCount - recoveredCount,
      recoveredCount,
      recoveryRate: totalCount > 0 ? Number(((recoveredCount / totalCount) * 100).toFixed(1)) : 0,
      lostRevenue: row?.lostRevenue || 0,
      recoveredRevenue: row?.recoveredRevenue || 0,
    });
  } catch (err) {
    console.error('getAbandonedCartStats error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

module.exports = { upsertAbandonedCart, markRecovered, getAbandonedCarts, getAbandonedCartStats };