const express = require('express');
const router = express.Router();
const { confirmOrderByEmail, showCancelConfirmation, cancelOrderByEmail } = require('../controllers/marketingController');
const { marketingTokenLimiter } = require('../middleware/guestRateLimiters');

// مسارات دي بره /api بالكامل فمكنش عليها أي rate limiting قبل كده (P1-4).
// التوكن هو الحماية الأساسية، لكن order-cancel فعليًا بيغيّر حالة الأوردر،
// فمحتاج حد فوق محاولات تخمين/تكرار التوكن.
router.get('/order-confirm/:token', marketingTokenLimiter, confirmOrderByEmail);
// ===== P1-5: GET بيعرض صفحة تأكيد بس (من غير أي تعديل على الأوردر) =====
// POST هو اللي بينفذ الإلغاء الفعلي - نفس الـrate limiter على الاتنين.
router.get('/order-cancel/:token', marketingTokenLimiter, showCancelConfirmation);
router.post('/order-cancel/:token', marketingTokenLimiter, cancelOrderByEmail);
module.exports = router;