// دوال validation بسيطة لبيانات الـ Authentication (بدون مكتبات خارجية إضافية)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// رقم موبايل مصري أو دولي بسيط: أرقام فقط، ممكن يبدأ بـ + ، طول معقول
const PHONE_REGEX = /^\+?[0-9]{8,15}$/;
const OTP_REGEX = /^\d{6}$/;

const isValidEmail = (email) => typeof email === 'string' && email.trim().length <= 254 && EMAIL_REGEX.test(email.trim());

const isValidPhone = (phone) => typeof phone === 'string' && PHONE_REGEX.test(String(phone).trim());

const isValidOtp = (code) => typeof code === 'string' && OTP_REGEX.test(code.trim());

// باسورد قوي: 8 أحرف على الأقل + حرف وحد رقمي على الأقل (بدون ما نبالغ عشان منكسرش تجربة المستخدم الحالية)
const validatePasswordStrength = (password) => {
  const value = String(password || '');
  if (value.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  if (value.length > 128) return 'كلمة المرور طويلة جداً';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return 'كلمة المرور يجب أن تحتوي على حروف وأرقام معاً';
  }
  return null;
};

const validateName = (name) => {
  const value = String(name || '').trim();
  if (!value || value.length < 2 || value.length > 120) {
    return 'الاسم غير صحيح';
  }
  return null;
};

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidOtp,
  validatePasswordStrength,
  validateName,
};
