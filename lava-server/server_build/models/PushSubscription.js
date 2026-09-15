const mongoose = require('mongoose');

// ============================================================
// PushSubscription - بيخزن اشتراك كل جهاز/متصفح ضغط "تفعيل إشعارات
// الطلبات" من لوحة التحكم. كل صف هنا = جهاز واحد بيتبعتله إشعار مستقل
// وقت أي طلب جديد (شوف utils/webPush.js - sendPushToAdmins).
//
// ملحوظة: نفس الأدمن/الموظف ممكن يكون عنده أكتر من صف هنا لو فتح لوحة
// التحكم من أكتر من جهاز/متصفح وفعّل الإشعارات في كل واحد - وده مقصود،
// عشان الإشعار يوصله على كل الأجهزة مش جهاز واحد بس.
// ============================================================
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);