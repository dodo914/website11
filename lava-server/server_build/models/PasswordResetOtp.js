const mongoose = require('mongoose');

// مفصولة عن EmailOtp (اللي بتُستخدم لتسجيل الدخول بالكود) عشان طلب "نسيت الباسورد"
// ميتعارضش مع أي كود تسجيل دخول شغال في نفس الوقت لنفس الإيميل.
const passwordResetOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
}, { timestamps: true });

passwordResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetOtpSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('PasswordResetOtp', passwordResetOtpSchema);