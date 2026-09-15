const express = require('express');
const router = express.Router();
const { protect, access } = require('../middleware/auth');
const { getMarketing, updateMarketing, queueCampaign, getMessageStats } = require('../controllers/marketingController');
router.get('/settings', protect, access('brevo_marketing', 'view'), getMarketing);
router.put('/settings', protect, access('brevo_marketing', 'edit'), updateMarketing);
router.post('/campaigns', protect, access('brevo_marketing', 'edit'), queueCampaign);
router.get('/stats', protect, access('brevo_marketing', 'view'), getMessageStats);
module.exports = router;