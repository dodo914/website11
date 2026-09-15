const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe, getVapidPublicKey } = require('../controllers/pushController');
const { protect, access } = require('../middleware/auth');

// المفتاح العام مش سري - أي حد يقدر يشوفه (زي أي public key تاني)
router.get('/vapid-public-key', getVapidPublicKey);

// بس اللي عنده صلاحية "مشاهدة الطلبات" (أدمن أو موظف مديله الصلاحية دي)
// يقدر يفعّل/يلغي إشعارات الطلبات - نفس صلاحية GET /api/orders بالظبط.
router.post('/subscribe', protect, access('orders', 'view', ['call_center', 'packer']), subscribe);
router.post('/unsubscribe', protect, access('orders', 'view', ['call_center', 'packer']), unsubscribe);

module.exports = router;