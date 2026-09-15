const mongoose = require('mongoose');
const { normalizeDomain } = require('../services/license/fingerprintService');

// ============================================================
// ===== LAVA Product License (PART 1A - data foundation) =====
// ============================================================
// ده الـLicense الخاص ببرنامج LAVA نفسه (اللي بيتباع للعميل اللي بيشغّل
// نسخته الخاصة من المتجر) - مش Customer بتاع أي متجر (ده موديل مختلف
// تمامًا اسمه User.js وموجود بالفعل).
//
// الموديل ده دلوقتي هو data foundation بس: مفيش License Server ولا
// remote validation ولا middleware بيستخدمه في المرحلة دي. هيتضاف لاحقًا.
//
// customerReference هنا نص حر (مش ref لموديل User) عشان اللايسنس بتاع
// عميل شراء LAVA نفسها (اللي بيشتري النسخة)، مش عميل داخل متجر - مفيش سبب
// معماري كافي دلوقتي لربطه بـUser model الخاص بالمتجر.
const LICENSE_TYPES = ['standard', 'source-code', 'resale', 'enterprise'];
const LICENSE_STATUSES = ['active', 'suspended', 'expired', 'revoked'];

const licenseSchema = new mongoose.Schema(
  {
    licenseId: { type: String, required: true, unique: true, index: true },
    customerReference: { type: String, required: true, trim: true },
    type: { type: String, enum: LICENSE_TYPES, required: true },
    status: { type: String, enum: LICENSE_STATUSES, default: 'active', required: true },
    // بنطبّع كل دومين هنا (نفس normalizeDomain المستخدمة في fingerprintService/
    // licenseService لتفعيل الـactivation) عشان نضمن مفيش mismatch بين
    // allowedDomains و normalized activation domain (زي "https://Foo.com/"
    // المخزنة هنا و"foo.com" الجاية من activation - كانوا هيفشلوا في المطابقة
    // من غير التطبيع ده). الـset() بيشتغل على أي array بتتحط (create/save/
    // findOneAndUpdate مع runValidators، أو تعديل مباشر للـarray).
    allowedDomains: {
      type: [String],
      default: [],
      set(domains) {
        if (!Array.isArray(domains)) return domains;
        const normalized = domains.map((d) => normalizeDomain(d)).filter(Boolean);
        return [...new Set(normalized)];
      },
    },
    maxActivations: { type: Number, default: 1, min: 0 },
    // عدد الـactivations النشطة الحالية - بيتحدّث بشكل atomic (findOneAndUpdate
    // + $inc) وقت إنشاء activation جديدة عشان نمنع أي race condition لو
    // طلبين اتنين حاولوا يعملوا activate في نفس اللحظة (شوف licenseService.js
    // activateLicense()). ده الـsource of truth لإنفاذ الحد، مش مجرد عداد
    // وصفي - متلمسوش يدويًا من غير المرور على نفس الـatomic path.
    activeActivationCount: { type: Number, default: 0, min: 0 },
    issuedAt: { type: Date, default: Date.now },
    activatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    features: { type: [String], default: [] },
    buildId: { type: String, default: null },
  },
  { timestamps: true }
);

licenseSchema.index({ status: 1, createdAt: -1 });
licenseSchema.index({ customerReference: 1 });

licenseSchema.statics.TYPES = LICENSE_TYPES;
licenseSchema.statics.STATUSES = LICENSE_STATUSES;

module.exports = mongoose.model('License', licenseSchema);
module.exports.LICENSE_TYPES = LICENSE_TYPES;
module.exports.LICENSE_STATUSES = LICENSE_STATUSES;