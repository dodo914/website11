const express = require('express');
const router = express.Router();
const {
  register,
  login,
  sendLoginCode,
  verifyLoginCode,
  forgotPassword,
  resetPassword,
  checkEmailLoginMethod,
  getPublicAuthConfig,
  getAdminAuthConfig,
  requestAdminConfigOtp,
  updateAdminAuthConfig,
  getMe,
  updateSavedShipping,
  updateWishlist,
  updateMarketingConsent,
  updateCart,
  logout,
  getCsrfToken,
} = require('../controllers/authController');
const { protect, authorize, access } = require('../middleware/auth');

router.get('/config', getPublicAuthConfig);
router.get('/csrf-token', getCsrfToken);
router.post('/register', register);
router.post('/login', login);
router.post('/send-code', sendLoginCode);
router.post('/verify-code', verifyLoginCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/check-email', checkEmailLoginMethod);
router.post('/logout', logout);
router.get('/admin-config', protect, access('auth_settings', 'view'), getAdminAuthConfig);
// إرسال كود التأكيد بيروح على إيميل الأدمن الحالي في الداتابيز — نفس منطق أمان
// تعديل بيانات الأدمن نفسه، فبيفضل للأدمن بس.
router.post('/admin-config/send-otp', protect, authorize('admin'), requestAdminConfigOtp);
// ملحوظة أمان: التعديل هنا بيغيّر إيميل/باسورد حساب الأدمن نفسه، فبيفضل للأدمن بس
// حتى لو موظف عنده صلاحية "تعديل" على قسم auth_settings — منعاً للاستحواذ على الحساب.
router.put('/admin-config', protect, authorize('admin'), updateAdminAuthConfig);
router.get('/me', protect, getMe);
router.put('/saved-shipping', protect, updateSavedShipping);
router.put('/wishlist', protect, updateWishlist);
router.put('/marketing-consent', protect, updateMarketingConsent);
router.put('/cart', protect, updateCart);

module.exports = router;