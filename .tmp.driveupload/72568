const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

const isConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  // مش هيوقف السيرفر ولا يأثر على أي حاجة تانية - بس الإشعارات مش هتشتغل
  // لحد ما تتحط VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY في .env
  // (شغّل: npx web-push generate-vapid-keys)
  console.warn('⚠️  VAPID keys غير موجودة في .env — إشعارات الطلبات (Push) معطّلة.');
}

// ============================================================
// بيبعت إشعار Push لكل الأجهزة المشتركة (كل الأدمن/الموظفين اللي فعّلوا
// الإشعارات من أي جهاز). كل جهاز بياخد إشعاره لوحده وبالتوازي - فحتى لو
// جالك 100 طلب في نفس اللحظة، كل طلب بيولّد إشعاره المستقل من غير ما
// يستنى أو يتجمع مع طلب تاني (مفيش "tag" مشترك بينهم يخليهم يتلخبطوا في
// بعض على الجهاز).
//
// أي اشتراك بقى غير صالح (المستخدم مسح البرنامج أو سحب الإذن من
// المتصفح - غالبًا 404/410 من خدمة البوش) بيتشال من الداتا بيز تلقائيًا
// عشان منفضلش نحاول نبعتله كل مرة من غير فايدة.
// ============================================================
async function sendPushToAdmins(payload) {
  if (!isConfigured) return;

  let subscriptions;
  try {
    subscriptions = await PushSubscription.find({}).lean();
  } catch (err) {
    console.error('تعذّر جلب اشتراكات الإشعارات:', err.message);
    return;
  }

  if (!subscriptions.length) return;

  const notificationPayload = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          notificationPayload
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else {
          console.error('فشل إرسال إشعار Push لجهاز:', err.message);
        }
      }
    })
  );
}

module.exports = { sendPushToAdmins, isConfigured };