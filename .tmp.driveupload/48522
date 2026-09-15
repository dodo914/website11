const express = require('express');
const router = express.Router();
const {
  getMyExchangeRequests,
  getExchangeRequests,
  getExchangeRequestById,
  reviewExchangeRequest,
  updateExchangeStatus,
  inspectExchangeRequest,
  updateExchangeMoney,
  cancelExchangeRequest,
  syncExchangeTracking,
} = require('../controllers/exchangeController');
const { protect, access } = require('../middleware/auth');

// ملحوظة: إنشاء طلب استبدال (POST) بيتم عن طريق
// POST /api/orders/:id/exchange-request (شوف routes/orderRoutes.js) عشان
// يفضل نفس الـpattern بتاع نظام الـReturn الحالي (طلب مربوط بالأوردر
// مباشرة). باقي العمليات (عرض/مراجعة/تحديث حالة) هنا تحت /api/exchange-requests.

router.get('/mine', protect, getMyExchangeRequests);
router.get('/', protect, access('orders', 'view', ['call_center', 'packer']), getExchangeRequests);
router.get('/:id', protect, getExchangeRequestById);

router.put('/:id/review', protect, access('orders', 'edit', ['call_center']), reviewExchangeRequest);
router.put('/:id/status', protect, access('orders', 'edit', ['call_center']), updateExchangeStatus);
// ===== معاينة الفاريانت القديم بعد وصوله فعليًا - هي اللي بتقرر رجوع المخزون =====
router.put('/:id/inspect', protect, access('orders', 'edit', ['call_center']), inspectExchangeRequest);
router.put('/:id/money', protect, access('orders', 'edit', ['call_center']), updateExchangeMoney);
router.put('/:id/cancel', protect, cancelExchangeRequest);
// Bosta Return/Exchange Integration: مزامنة التتبع اليدوي (شوف تعليق
// syncExchangeTracking في الكونترولر).
router.post('/:id/sync-tracking', protect, access('orders', 'view', ['call_center', 'packer']), syncExchangeTracking);

module.exports = router;