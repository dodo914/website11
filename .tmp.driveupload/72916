const mongoose = require('mongoose');

// ============================================================
// ===== LAVA License Event Log (PART 1A - data foundation) ===
// ============================================================
// سجل منفصل خاص بأحداث اللايسنس بس (مش نفس ActivityLog الموجود).
// ActivityLog.js الحالي مبني حوالين نشاط أدمن/موظف بشري (userId/userName
// مطلوبين) - أحداث اللايسنس غالبًا machine-generated (من License Server
// لاحقًا) ومالهاش علاقة بيوزر إداري، فموديل منفصل هنا أنضف من إعادة
// استخدام ActivityLog وأوفر من عمل تعديلات عليه.
//
// مهم: الموديل ده ممنوع يخزن أي secret/password/API key/private key أو
// license secret كامل - metadata لازم تفضل معلومات وصفية بس (زي domain,
// reason, IP مثلاً) لما يتحدد شكلها بالظبط في مرحلة License Server.
const LICENSE_EVENT_TYPES = [
  'LICENSE_CREATED',
  'LICENSE_ACTIVATED',
  'LICENSE_VALIDATED',
  'LICENSE_DEACTIVATED',
  'LICENSE_EXPIRED',
  'LICENSE_REVOKED',
  'LICENSE_SUSPENDED',
  'DOMAIN_CHANGED',
  'FINGERPRINT_CHANGED',
  'ACTIVATION_LIMIT_REACHED',
  'INVALID_LICENSE',
  'INVALID_SIGNATURE',
  'SUSPICIOUS_ACTIVITY',
  // ---- STEP 7 EVENT AUDIT FIX (PART 2B-2C-4) ----
  // كان فيه استدعاء فعلي لـ recordLicenseEvent(licenseId,
  // 'LICENSE_DOMAIN_NOT_ALLOWED', ...) في licenseService.activateLicense()
  // (PART 1B/1E) بس القيمة دي مكنتش موجودة في الـenum هنا خالص - يعني في
  // Mongo حقيقي (مش mocked زي التستات) كانت هترمي Mongoose ValidationError
  // خام بدل ما تسجّل الحدث بهدوء، وده كان ممكن يوقف مسار رفض الـdomain
  // نفسه بشكل غير متوقع. إضافتها هنا بس - مفيش تغيير في أي enum value
  // تاني ولا في أي schema field.
  'LICENSE_DOMAIN_NOT_ALLOWED',
];

const licenseEventSchema = new mongoose.Schema(
  {
    licenseId: { type: String, required: true, index: true },
    activationId: { type: String, default: null, index: true },
    eventType: { type: String, enum: LICENSE_EVENT_TYPES, required: true },
    domain: { type: String, default: null },
    fingerprintHash: { type: String, default: null },
    appVersion: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

licenseEventSchema.index({ licenseId: 1, createdAt: -1 });
licenseEventSchema.index({ eventType: 1, createdAt: -1 });

licenseEventSchema.statics.EVENT_TYPES = LICENSE_EVENT_TYPES;

module.exports = mongoose.model('LicenseEvent', licenseEventSchema);
module.exports.LICENSE_EVENT_TYPES = LICENSE_EVENT_TYPES;