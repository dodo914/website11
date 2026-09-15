const express = require('express');
const router = express.Router();
const {
  createOrder, getOrders, getRevenueStats, getRevenueBreakdown, getCustomerStats, getMyOrders, updateOrderStatus, updatePackerStatus,
  getSalesTrend, getDashboardExtras, getYearlyComparison,
  getLoyaltyInfo, confirmWalletPayment,
  getPaymentsDashboard, getShippingDashboard, updateOrderShipping, updatePaymentStatus,
  refundOrderPayment, requestReturn, reviewReturnRequest, inspectReturnRequest,
  getReturnReasons, getReturnEligibility, uploadEvidenceImage,
  getReturnRequests, getReturnRequestDetails,
  updateReturnStatus, updateReturnRefund,
} = require('../controllers/orderController');
const { createExchangeRequest, getExchangeReasons, getExchangeEligibility } = require('../controllers/exchangeController');
const {
  guestLookupOrder, guestGetReturnReasons, guestGetExchangeReasons,
  guestGetReturnEligibility, guestGetExchangeEligibility,
  guestUploadEvidenceImage, guestRequestReturn, guestRequestExchange,
} = require('../controllers/guestOrderController');
const { protect, authorize, optionalProtect, access } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validateUploadedImages } = require('../middleware/upload');
const { guestVerifyLimiter, guestActionLimiter } = require('../middleware/guestRateLimiters');

router.post('/', optionalProtect, upload.single('screenshot'), validateUploadedImages, createOrder);
router.get('/', protect, access('orders', 'view', ['call_center', 'packer']), getOrders);
// إحصائيات الإيرادات للوحة البيانات - محسوبة في الداتا بيز (aggregation)
// بدل ما تتحمل كل الطلبات للفرونت وتتحسب هناك (وكانت فيها سقف 1000 طلب).
router.get('/revenue-stats', protect, access('settings', 'view'), getRevenueStats);
// نفس صلاحية revenue-stats بالظبط - تفصيل الإيراد حسب المحافظة/المنتج بدل الإجمالي.
router.get('/revenue-breakdown', protect, access('settings', 'view'), getRevenueBreakdown);
// نفس الصلاحية برضه - عملاء جدد/متكررين ومعدل الإرجاع (إندبوينت منفصل عن
// revenue-breakdown عمدًا، راجع الشرح في orderController.js).
router.get('/customer-stats', protect, access('settings', 'view'), getCustomerStats);
// جراف المبيعات (يوم/أسبوع/شهر/سنة) + توقع الإيرادات المبني عليه - aggregation بدون سقف 1000.
router.get('/sales-trend', protect, access('settings', 'view'), getSalesTrend);
// متوسط وقت التسليم / قيمة العميل مدى الحياة / مبيعات اليوم وإمبارح / توزيع حالات الطلبات.
router.get('/dashboard-extras', protect, access('settings', 'view'), getDashboardExtras);
// مقارنة سنة بسنة (إيراد/مبيعات/تكلفة/شحن/نسبة إرجاع) - aggregation بدون سقف 1000.
router.get('/yearly-comparison', protect, access('settings', 'view'), getYearlyComparison);
router.get('/mine', protect, getMyOrders);
router.get('/loyalty-info', protect, getLoyaltyInfo);

// ============================================================
// ===== صفحة "استرجاع/استبدال بدون تسجيل دخول" (تحقق برقم الأوردر +
// رقم الهاتف) - لازم تتسجل قبل أي route فيها ":id" في نفس الملف ده
// (زي /:id/return-request) عشان Express ميحاولش يفهم "guest" على إنه
// :id ويبعت الطلب لـcontroller غلط.
// ============================================================
// عالي الخطورة (brute-force على orderNumber+phone) - guestVerifyLimiter
router.post('/guest/lookup', guestVerifyLimiter, guestLookupOrder);
router.get('/guest/return-eligibility', guestVerifyLimiter, guestGetReturnEligibility);
router.get('/guest/exchange-eligibility', guestVerifyLimiter, guestGetExchangeEligibility);
// بيانات مرجعية عامة بس (أسباب الاسترجاع/الاستبدال) - مفيش تحقق حساس هنا،
// تفضل تحت الحد العام (apiLimiter) بدون طبقة إضافية.
router.get('/guest/return-reasons', guestGetReturnReasons);
router.get('/guest/exchange-reasons', guestGetExchangeReasons);
// عمليات guest بتغيّر حالة أو مكلفة (رفع صورة / تقديم طلب فعلي) - guestActionLimiter
router.post('/guest/evidence-image', guestActionLimiter, upload.single('image'), validateUploadedImages, guestUploadEvidenceImage);
router.post('/guest/return-request', guestActionLimiter, guestRequestReturn);
router.post('/guest/exchange-request', guestActionLimiter, guestRequestExchange);

// ===== لوحات البيانات الجديدة =====
router.get('/payments-dashboard', protect, access('payments_dashboard', 'view'), getPaymentsDashboard);
router.get('/shipping-dashboard', protect, access('shipping_dashboard', 'view'), getShippingDashboard);

router.put('/:id/status', protect, access('orders', 'edit', ['call_center']), updateOrderStatus);
router.put('/:id/packer-status', protect, access('orders', 'edit', ['packer']), updatePackerStatus);
router.put('/:id/confirm-payment', protect, access('orders', 'edit', ['call_center']), confirmWalletPayment);
router.put('/:id/payment-status', protect, access('payments_dashboard', 'edit'), updatePaymentStatus);
router.put('/:id/refund', protect, access('payments_dashboard', 'edit'), refundOrderPayment);
router.put('/:id/shipping', protect, access('orders', 'edit', ['call_center']), updateOrderShipping);

// ===== استرجاع منتجات محددة من الطلب =====
// العميل بيطلب (route المفتوحة لأي مستخدم مسجل - بيتحقق داخل الكنترولر إن
// الطلب تابع له فعلاً)، والأدمن بيوافق/يرفض أو يبدأ استرجاع بنفسه.
router.post('/:id/return-request', protect, requestReturn);
router.put('/:id/return-request', protect, access('orders', 'edit', ['call_center']), reviewReturnRequest);
router.get('/:id/return-request', protect, getReturnRequestDetails);
// ===== Returns & Exchanges - Phase 2C: سير عمل الاسترجاع بعد الموافقة + تحويل الفلوس =====
router.put('/:id/return-request/status', protect, access('orders', 'edit', ['call_center']), updateReturnStatus);
router.put('/:id/return-request/refund', protect, access('orders', 'edit', ['call_center']), updateReturnRefund);
// ===== معاينة المنتج المرتجع بعد وصوله فعليًا - هي اللي بتقرر رجوع المخزون =====
router.put('/:id/return-request/inspect', protect, access('orders', 'edit', ['call_center']), inspectReturnRequest);

// ===== Returns & Exchanges - Phase 2B: قايمة كل طلبات الاسترجاع (أدمن) =====
router.get('/return-requests', protect, access('orders', 'view', ['call_center', 'packer']), getReturnRequests);

// ===== Returns & Exchanges - Phase 2A: أسباب/أهلية/صور إثبات =====
router.get('/return-reasons', getReturnReasons);
router.get('/:id/return-eligibility', protect, getReturnEligibility);
router.get('/exchange-reasons', getExchangeReasons);
router.get('/:id/exchange-eligibility', protect, getExchangeEligibility);
// صورة إثبات مشتركة للاسترجاع والاستبدال (نفس File Upload الموجود بالفعل)
router.post('/evidence-images', protect, upload.single('image'), validateUploadedImages, uploadEvidenceImage);

// ===== طلب استبدال (Exchange) منتج من الطلب - نفس فكرة return-request بالظبط =====
// باقي عمليات الاستبدال (عرض/مراجعة/تحديث حالة/إلغاء) في routes/exchangeRoutes.js
// تحت /api/exchange-requests.
router.post('/:id/exchange-request', protect, createExchangeRequest);

module.exports = router;