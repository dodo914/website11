const mongoose = require('mongoose');

// ============================================================
// ===== LAVA License Activation (PART 1A - data foundation) ==
// ============================================================
// بيسجل كل تفعيل (installation) لِـLicense معين على domain معين.
// دلوقتي مفيش أي كود بيكتب في الموديل ده - ده foundation بس لحد ما
// يتبنى License Server في مرحلة لاحقة.
//
// ملحوظة عن الـduplicate activation:
// معمول compound unique index على (licenseId, domain, fingerprintHash)
// بدل unique index لوحده على domain، عشان:
//   - نفس الـdomain ممكن يتفعّل تاني (reactivation طبيعي بعد إعادة تركيب
//     مثلاً) من غير ما يتمنع بسبب unique constraint قديم.
//   - في نفس الوقت بنمنع إنشاء activation مكررة بالظبط لنفس
//     (license + domain + fingerprint) بيوم واحد عن طريق الغلط.
// منطق الـreactivation الفعلي (upsert / إعادة استخدام activation قديمة)
// هيتحدد وقت بناء License Server نفسه - هنا بس بنوفر الـconstraint
// الصحيح على مستوى الداتابيز.
const ACTIVATION_STATUSES = ['active', 'revoked'];

const licenseActivationSchema = new mongoose.Schema(
  {
    licenseId: { type: String, required: true, index: true },
    activationId: { type: String, required: true, unique: true, index: true },
    domain: { type: String, required: true, trim: true, lowercase: true },
    environment: { type: String, default: 'production' },
    fingerprintHash: { type: String, required: true },
    activatedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    status: { type: String, enum: ACTIVATION_STATUSES, default: 'active', required: true },
    appVersion: { type: String, default: null },
    buildId: { type: String, default: null },
  },
  { timestamps: true }
);

licenseActivationSchema.index(
  { licenseId: 1, domain: 1, fingerprintHash: 1 },
  { unique: true }
);
licenseActivationSchema.index({ licenseId: 1, status: 1 });
licenseActivationSchema.index({ lastSeenAt: -1 });

// ---- PART 1D/1E review notes (no schema change needed) ----
// - installationId: مش متخزن raw هنا عن قصد - هو بالفعل جزء من
//   fingerprintHash (one-way hash عبر fingerprintService.createFingerprint)،
//   فتخزينه تاني كـplain field هيبقى تكرار من غير فايدة أمنية إضافية. لو
//   احتجنا lookup مباشر بالـinstallationId لاحقًا (Prompt 2)، وقتها
//   نضيف field بس مش دلوقتي (لا نضيف حاجة مش مستخدمة).
// - status: القيم الحالية ('active'|'revoked') متوافقة تمامًا مع
//   licenseService.js - الكود الحالي بيكتب 'active' بس وقت الإنشاء/
//   الـreactivation. الانتقال لـ'revoked' هيتم عبر
//   licenseService.releaseActivationSlot() (PART 2 - helper داخلي مش
//   مربوط بأي route لسه).
// - الـindexes التلاتة فوق مبنيين على LicenseActivation collection بس - مفيش
//   تعارض ممكن مع License.activeActivationCount لأنه field على collection
//   تانية تمامًا (License)، فمفيش overlap في الـindex space.

licenseActivationSchema.statics.STATUSES = ACTIVATION_STATUSES;

module.exports = mongoose.model('LicenseActivation', licenseActivationSchema);
module.exports.ACTIVATION_STATUSES = ACTIVATION_STATUSES;