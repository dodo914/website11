const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  getPublicSettings, getAdminSettings, updateSettings, uploadSettingsImage, uploadSettingsVideo, getPublicPixels,
  addProductReview, getProductReviews, getMyReviews, getAdminReviews,
  moderateReview, updateMyReview, deleteReview, uploadReviewImage,
  addContactMessage, getContactMessages, updateContactMessageStatus, deleteContactMessage,
  getStoreHealth,
} = require('../controllers/settingsController');
const { protect, authorize, optionalProtect, access } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validateUploadedImages, uploadVideo, validateUploadedVideo } = require('../middleware/upload');
const { reviewSubmitLimiter } = require('../middleware/guestRateLimiters');

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 8 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'تم إرسال رسائل كثيرة. حاول مرة أخرى لاحقاً.' },
});

// حماية بسيطة من إساءة استخدام رفع صور التقييمات (زائر أو عميل)
const reviewImageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 15 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'تم رفع صور كثيرة. حاول مرة أخرى لاحقاً.' },
});

router.get('/public', getPublicSettings);
router.get('/pixels', getPublicPixels);
router.get('/admin', protect, access('settings', 'view'), getAdminSettings);
router.get('/store-health', protect, access('store_health', 'view'), getStoreHealth);
router.put('/', protect, access('settings', 'edit'), updateSettings);
router.post('/image', protect, access('settings', 'edit'), upload.single('image'), require('../middleware/upload').validateUploadedImages, uploadSettingsImage);
router.post('/video', protect, access('settings', 'edit'), uploadVideo.single('video'), validateUploadedVideo, uploadSettingsVideo);

// Contact Messages
router.post('/contact', contactLimiter, addContactMessage);
router.get('/contact', protect, access('messages', 'view'), getContactMessages);
router.patch('/contact/:id/status', protect, access('messages', 'edit'), updateContactMessageStatus);
router.delete('/contact/:id', protect, access('messages', 'edit'), deleteContactMessage);

// Reviews
// Public reads only approved reviews. The write endpoint derives customerId
// from the authenticated user when present and never trusts a frontend ID.
// P1-4: كان من غير أي rate limiting خالص - "public form submission" كلاسيكي.
router.post('/reviews', optionalProtect, reviewSubmitLimiter, addProductReview);
router.post('/reviews/image', optionalProtect, reviewImageLimiter, upload.single('image'), require('../middleware/upload').validateUploadedImages, uploadReviewImage);
router.get('/reviews/mine', protect, authorize('customer'), getMyReviews);
router.get('/reviews', protect, access('reviews', 'view'), getAdminReviews);
router.get('/reviews/:productId', getProductReviews);
router.patch('/reviews/:id/status', protect, access('reviews', 'edit'), moderateReview);
router.patch('/reviews/:id', protect, authorize('customer'), updateMyReview);
router.delete('/reviews/:id', protect, access('reviews', 'edit', ['customer']), deleteReview);

module.exports = router;