const express = require('express');
const router = express.Router();
const { upsertAbandonedCart, markRecovered, getAbandonedCarts, getAbandonedCartStats } = require('../controllers/abandonedCartController');
const { protect, authorize, optionalProtect, access } = require('../middleware/auth');

router.post('/', optionalProtect, upsertAbandonedCart);
router.put('/recover', optionalProtect, markRecovered);
// إحصائيات (إيراد مفقود/مسترجَع/نسبة استرجاع) على *كل* السلات المطابقة للفلتر
// بدون سقف صفحة - لازم تتسجل قبل '/' العادية عشان الـ Express matching، لكن
// هنا مفيش تعارض لأنها '/stats' مش ':id'.
router.get('/stats', protect, access('abandoned_carts', 'view'), getAbandonedCartStats);
router.get('/', protect, access('abandoned_carts', 'view'), getAbandonedCarts);

module.exports = router;