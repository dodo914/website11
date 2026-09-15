// ============================================================================
// Structured Error Classifier (مشترك لـAramex/DHL/ShipBlu)
// ------------------------------------------------------------------------
// بند 10 في طلب Phase 3: الأخطاء غير المصنّفة (auth/timeout) لازم تترجم
// لـPROVIDER_AUTH_ERROR / PROVIDER_TIMEOUT بدل ما ترجع رسالة الـHTTP الخام.
// (Bosta ليها classifyBostaApiError خاص بيها في bostaService.js زي المطلوب
// بالظبط في الطلب - subscription/Error 3000 حالات خاصة بيها هي بس).
// ============================================================================
const { structuredError } = require('./orderAddress');

function classifyProviderApiError(err) {
  if (err && err.isTimeout) {
    return structuredError('انتهت مهلة الاتصال بشركة الشحن (Timeout)', 'PROVIDER_TIMEOUT', { status: 504 });
  }
  const status = Number(err?.status || 0);
  if (status === 401 || status === 403) {
    return structuredError('فشل التحقق من صلاحية الاتصال بشركة الشحن (بيانات اعتماد غير صحيحة)', 'PROVIDER_AUTH_ERROR', { status });
  }
  return null;
}

module.exports = { classifyProviderApiError };