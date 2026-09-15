const express = require('express');
const router = express.Router();
const {
  getKashierStatus,
  getPaymentStatus,
  handleKashierCallback,
  handleKashierWebhook,
  getPaymobStatus,
  getPaymobPaymentStatus,
  handlePaymobCallback,
  handlePaymobWebhook,
} = require('../controllers/paymentController');
const { protect, access } = require('../middleware/auth');
const { paymentStatusLimiter } = require('../middleware/guestRateLimiters');

router.get('/kashier/status', protect, access('settings', 'view'), getKashierStatus);
// P1-4: guest status lookup بـgateway order id - حد يمنع enumeration.
router.get('/kashier/status/:orderId', paymentStatusLimiter, getPaymentStatus);
router.get('/kashier/callback', handleKashierCallback);
router.post('/kashier/webhook', handleKashierWebhook);

router.get('/paymob/status', protect, access('settings', 'view'), getPaymobStatus);
router.get('/paymob/status/:orderId', paymentStatusLimiter, getPaymobPaymentStatus);
router.get('/paymob/callback', handlePaymobCallback);
router.post('/paymob/webhook', handlePaymobWebhook);

module.exports = router;