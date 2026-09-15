// ============================================================
// Phase 2: تحقق من رقم الهاتف المصري (Frontend UX validation)
// ------------------------------------------------------------------------
// ملحوظة: ده تحقق مساعد للتجربة (UX) بس عشان نمنع إرسال طلب هيترفض أصلاً،
// مش بديل عن التحقق الحقيقي اللي بيحصل في السيرفر (orderController.js عبر
// utils/addressValidation.js) - نفس المنطق بالظبط (01[0125] + 8 أرقام).
// ============================================================
export const EGYPT_PHONE_REGEX = /^01[0125]\d{8}$/;

export const isValidEgyptianPhone = (raw) => {
  let s = String(raw || '').trim().replace(/[\s\-()]/g, '');
  if (s.startsWith('+20')) s = '0' + s.slice(3);
  else if (s.startsWith('0020')) s = '0' + s.slice(4);
  else if (s.startsWith('20') && s.length === 12) s = '0' + s.slice(2);
  return EGYPT_PHONE_REGEX.test(s);
};