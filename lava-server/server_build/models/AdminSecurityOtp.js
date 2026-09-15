const mongoose = require('mongoose');

// مفصولة عن EmailOtp/PasswordResetOtp — بتُستخدم بس لما الأدمن يحاول يغيّر
// بياناته الشخصية (إيميل/باسورد/رقم هاتف) من لوحة التحكم. الكود بيتبعت على
// الإيميل الحالي المسجل للأدمن في الداتابيز (مش الإيميل الجديد اللي بيكتبه)،
// عشان لو حد اخترق جلسة الأدمن (session) مايقدرش يغيّر البيانات من غير ما
// يوصله كود على الإيميل الحقيقي بتاع صاحب الحساب.
const adminSecurityOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
}, { timestamps: true });

adminSecurityOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
adminSecurityOtpSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('AdminSecurityOtp', adminSecurityOtpSchema);