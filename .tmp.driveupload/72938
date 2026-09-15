const licenseService = require('../services/license/licenseService');
const License = require('../models/License');
const { hasLicensedFeature } = require('../services/license/featureEntitlementService');
const { LicenseError } = require('../services/license/licenseErrors');

// ============================================================
// ===== License Middleware Foundation (PART 1C) =================
// ============================================================
// مهم جدًا - الملف ده foundation بس، **مش متربط بأي route حالي**. زي ما
// اتطلب بالظبط:
//   - لما LICENSE_ENABLED=false (القيمة الافتراضية) -> أي middleware هنا
//     بينده next() فورًا من غير أي DB call أو أي تغيير في سلوك الـAPI
//     الحالي (non-blocking تمامًا).
//   - لما LICENSE_ENABLED=true -> الـmiddleware يبقى جاهز يعمل local
//     validation (بيستخدم نفس licenseService من PART 1B) - لسه مفيش
//     remote validation/heartbeat/kill-switch، وده برّه scope البرومبت ده.
//   - مفيش أي secret أو internal error message بيترجع في الـresponse -
//     كل error بيتحول لرسالة عامة آمنة (زي نفس فلسفة middleware/auth.js
//     الموجود اللي بيرجع رسائل عامة زي 'لازم تسجل دخول الأول' مش تفاصيل
//     JWT الداخلية).
//
// ملحوظة تصميم مهمة للاختبار: الدوال هنا بتنادي licenseService.xxx() و
// License.xxx() عن طريق الـmodule object نفسه (مش destructuring وقت
// الـrequire) عشان التستات تقدر تعمل mock/monkeypatch لأي دالة من غيرهم
// من غير ما تحتاج اتصال حقيقي بـMongoDB.

/**
 * @returns {boolean} هل enforcement مفعّل دلوقتي (default: false/non-blocking)
 */
function isLicenseEnforcementEnabled() {
  return String(process.env.LICENSE_ENABLED || 'false').trim().toLowerCase() === 'true';
}

/**
 * الـLicenseId الخاص بالتنصيب الحالي - بيتقرا من .env (LICENSE_ID)، مش من
 * أي مصدر جاي من الفرونت اند أو من الـrequest نفسه.
 * @returns {string|null}
 */
function getConfiguredLicenseId() {
  const raw = (process.env.LICENSE_ID || '').trim();
  return raw || null;
}

/**
 * بيحوّل أي error لـresponse آمن - مفيش أي raw err.message/stack بيترجع
 * لحد إلا لو كان LicenseError معروف (اللي أصلًا عنده toSafeJSON() آمنة).
 */
function respondWithSafeLicenseError(res, err) {
  if (err instanceof LicenseError) {
    return res.status(403).json(err.toSafeJSON());
  }
  // أي error تاني (مثلاً مشكلة اتصال بالداتابيز) - رسالة عامة بس، من غير
  // تفاصيل داخلية.
  return res.status(503).json({ code: 'LICENSE_CHECK_FAILED', message: 'Unable to verify license status.' });
}

/**
 * middleware factory: بيتأكد إن الترخيص المحلي صالح (active أو
 * grace_period) قبل ما يكمل للـroute. Non-blocking تمامًا لو
 * LICENSE_ENABLED=false.
 * استخدام مستقبلي: router.use('/some-protected-area', requireValidLicense())
 * @returns {import('express').RequestHandler}
 */
function requireValidLicense() {
  return async (req, res, next) => {
    if (!isLicenseEnforcementEnabled()) return next();

    const licenseId = getConfiguredLicenseId();
    if (!licenseId) {
      return res.status(403).json({ code: 'INVALID_LICENSE', message: 'License is invalid.' });
    }

    try {
      await licenseService.validateLocalLicense(licenseId);
      return next();
    } catch (err) {
      return respondWithSafeLicenseError(res, err);
    }
  };
}

/**
 * middleware factory: زي requireValidLicense بس بيتأكد كمان إن الـfeature
 * المطلوبة موجودة في license.features.
 * استخدام مستقبلي: router.use('/analytics', requireFeature('analytics'))
 * @param {string} featureName
 * @returns {import('express').RequestHandler}
 */
function requireFeature(featureName) {
  return async (req, res, next) => {
    if (!isLicenseEnforcementEnabled()) return next();

    const licenseId = getConfiguredLicenseId();
    if (!licenseId) {
      return res.status(403).json({ code: 'INVALID_LICENSE', message: 'License is invalid.' });
    }

    try {
      await licenseService.validateLocalLicense(licenseId);
      const license = await License.findOne({ licenseId }).lean();
      if (!hasLicensedFeature(license, featureName)) {
        return res.status(403).json({ code: 'FEATURE_NOT_LICENSED', message: 'This feature is not included in your license.' });
      }
      return next();
    } catch (err) {
      return respondWithSafeLicenseError(res, err);
    }
  };
}

/**
 * middleware factory: بيتأكد إن نوع الترخيص من ضمن الأنواع المسموحة.
 * استخدام مستقبلي: router.use('/source-only', requireLicenseType('source-code', 'enterprise'))
 * @param {...string} allowedTypes
 * @returns {import('express').RequestHandler}
 */
function requireLicenseType(...allowedTypes) {
  return async (req, res, next) => {
    if (!isLicenseEnforcementEnabled()) return next();

    const licenseId = getConfiguredLicenseId();
    if (!licenseId) {
      return res.status(403).json({ code: 'INVALID_LICENSE', message: 'License is invalid.' });
    }

    try {
      await licenseService.validateLocalLicense(licenseId);
      const license = await License.findOne({ licenseId }).lean();
      if (!license || !allowedTypes.includes(license.type)) {
        return res.status(403).json({ code: 'LICENSE_TYPE_NOT_ALLOWED', message: 'This license type does not allow this operation.' });
      }
      return next();
    } catch (err) {
      return respondWithSafeLicenseError(res, err);
    }
  };
}

module.exports = {
  isLicenseEnforcementEnabled,
  getConfiguredLicenseId,
  requireValidLicense,
  requireFeature,
  requireLicenseType,
};