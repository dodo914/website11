const PushSubscription = require('../models/PushSubscription');

// POST /api/push/subscribe (أدمن/موظف عنده صلاحية على الطلبات)
// بيحفظ اشتراك الجهاز/المتصفح ده عشان يستلم إشعارات الطلبات الجديدة.
// نفس الـ endpoint بيتستخدم لو الاشتراك اتغيّر (upsert بالـendpoint).
const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'بيانات الاشتراك ناقصة' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: req.user._id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'تم تفعيل إشعارات الطلبات بنجاح' });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ message: 'حصل خطأ أثناء تفعيل الإشعارات' });
  }
};

// POST /api/push/unsubscribe
// بيتنده لما المستخدم يلغي تفعيل الإشعارات يدويًا من لوحة التحكم.
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ message: 'endpoint مطلوب' });
    await PushSubscription.deleteOne({ endpoint });
    res.json({ message: 'تم إلغاء تفعيل الإشعارات' });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ message: 'حصل خطأ أثناء إلغاء تفعيل الإشعارات' });
  }
};

// GET /api/push/vapid-public-key
// المفتاح العام مش سري (ده أصلاً معنى "public" في VAPID) - الفرونت
// بيجيبه من هنا بدل ما يتكرر في .env تاني منفصل، عشان يفضل مصدر واحد
// بس للحقيقة (السيرفر).
const getVapidPublicKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
};

module.exports = { subscribe, unsubscribe, getVapidPublicKey };