const express = require('express');
const router = express.Router();
const { protect, access } = require('../middleware/auth');
const { recordVisit, recordPageView, markConverted, recordFunnelStep, getStats, getOnlineNow, getProductViewers } = require('../controllers/trafficController');

// Public
router.post('/visit',    recordVisit);
router.post('/pageview', recordPageView);
router.put('/convert',   markConverted);
router.post('/funnel',   recordFunnelStep);
// عام - بيستخدمه العميل في صفحة المنتج لمعرفة عدد المشاهدين الحاليين
// (بيرجع 0 تلقائياً لو الأدمن معطّل الخاصية دي من الإعدادات)
router.get('/product-viewers/:productId', getProductViewers);

// Admin / staff with permission
router.get('/stats',  protect, access('traffic', 'view'), getStats);
router.get('/online', protect, access('traffic', 'view'), getOnlineNow);

module.exports = router;