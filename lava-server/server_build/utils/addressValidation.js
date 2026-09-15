// ============================================================================
// Address & Phone Validation (Shared / Provider-agnostic)
// ------------------------------------------------------------------------
// الهدف: مصدر واحد للتحقق من رقم الهاتف المصري وبيانات العنوان الأساسية،
// يُستخدم من الـcheckout / orderController وأي مكان تاني محتاج نفس التحقق
// (مش خاص ببوسطة أو أي شركة شحن بعينها - راجع طلب الـPhase 2).
//
// ملحوظة: التحقق من إمكانية إنشاء شحنة فعلية عند شركة شحن معينة (زي احتياج
// Bosta لـzone/buildingNumber) هيتحدد لاحقًا في Phase 3 عبر
// capabilities.js (requiredAddressFields لكل شركة) - هنا بنتحقق بس من إن
// الطلب نفسه فيه بيانات عنوان أساسية سليمة بغض النظر عن شركة الشحن.
// ============================================================================

// أرقام الموبايل المصرية: تبدأ بـ 01 ثم واحد من (0,1,2,5) ثم 8 أرقام
// (يعني 11 رقم بالإجمالي). بنسمح بمسافات/شرطات/+20 اختياريًا في البداية
// وبنشيلها قبل التحقق، عشان "010 123 45678" أو "+201012345678" يتقبلوا.
const EGYPT_MOBILE_REGEX = /^01[0125]\d{8}$/;

function normalizePhone(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/[\s\-()]/g, '');
  if (s.startsWith('+20')) s = '0' + s.slice(3);
  else if (s.startsWith('0020')) s = '0' + s.slice(4);
  else if (s.startsWith('20') && s.length === 12) s = '0' + s.slice(2);
  return s;
}

// بيرجع true/false فقط - مفيد للفرونت (تحقق سريع) وللباك اند.
function isValidEgyptianPhone(raw) {
  const normalized = normalizePhone(raw);
  return EGYPT_MOBILE_REGEX.test(normalized);
}

// بيرجع { ok, message } - نسخة بترجع رسالة عربية جاهزة للعرض للمستخدم.
function validateEgyptianPhone(raw, { required = true, label = 'رقم الهاتف' } = {}) {
  const value = String(raw || '').trim();
  if (!value) {
    return required
      ? { ok: false, message: `${label} مطلوب` }
      : { ok: true, message: null };
  }
  if (!isValidEgyptianPhone(value)) {
    return { ok: false, message: `${label} غير صحيح - يجب أن يكون رقم موبايل مصري صالح (11 رقم يبدأ بـ 010/011/012/015)` };
  }
  return { ok: true, message: null };
}

// ===== التحقق من بيانات العنوان الأساسية (عامة لأي شركة شحن) =====
// core: بيانات لازم تكون موجودة دايمًا (اسم، هاتف، محافظة، عنوان تفصيلي).
// الحقول الإضافية (district/buildingNumber/floor/apartment/landmark) اختيارية
// هنا عن قصد - كل شركة شحن هتحدد احتياجاتها الدقيقة بنفسها في Phase 3
// عبر capabilities.js (requiredAddressFields) قبل إنشاء الشحنة الفعلية.
function validateCoreAddress({ fullName, phone, governorate, detailedAddress } = {}) {
  const missing = [];
  if (!String(fullName || '').trim()) missing.push('اسم العميل');
  const phoneCheck = validateEgyptianPhone(phone, { label: 'رقم الهاتف' });
  if (!phoneCheck.ok) missing.push(phoneCheck.message);
  if (!String(governorate || '').trim()) missing.push('المحافظة');
  if (!String(detailedAddress || '').trim()) missing.push('العنوان التفصيلي');
  return { ok: missing.length === 0, missing };
}

module.exports = {
  EGYPT_MOBILE_REGEX,
  normalizePhone,
  isValidEgyptianPhone,
  validateEgyptianPhone,
  validateCoreAddress,
};