const mongoose = require('mongoose');

// ============================================================
// ===== LAVA Installation Identity (PART 1B) ===================
// ============================================================
// نفس فكرة Counter.js الموجود بالفعل: singleton document بـ_id ثابت
// (بدل ObjectId عشوائي) عشان يبقى سهل نجيبه/نعمله upsert من غير lookup
// إضافي. الـcollection دي بتخزن installationId واحد بس لكل نسخة LAVA
// شغالة على الداتابيز دي.
//
// installationId:
//   - بيتولّد مرة واحدة بس (أول مرة حد يطلبه ومفيش سطر موجود).
//   - مش مرتبط بأي user/browser ومفيهوش بيانات شخصية (UUID عشوائي بس).
//   - ثابت بعد كده - مش بيتغيّر مع أي server restart لأنه متخزن في
//     MongoDB (نفس الداتابيز المستخدمة لكل حاجة تانية في المشروع) - مش
//     في ملف على الـdisk اللي ممكن يتمسح في بيئات الاستضافة السحابية
//     (Render/Railway إلخ - زي ما واضح من التعليقات في .env.example).
const licenseInstallationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // مفتاح ثابت زي Counter.js
    installationId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LicenseInstallation', licenseInstallationSchema);