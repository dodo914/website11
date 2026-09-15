const express=require('express');
const router=express.Router();
const {protect,access}=require('../middleware/auth');
const { shippingRatesLimiter } = require('../middleware/guestRateLimiters');
const c=require('../controllers/shippingController');
router.get('/providers', c.getProviders);
// ===== [Security Audit Fix] نسخة أدمن كاملة (بيانات الاعتماد المحفوظة) من
// نفس /providers - عشان لوحة التحكم تقدر تعرض نموذج التعديل معبّى، بعد ما
// /providers العامة بقت بترجع بس الحقول الآمنة (شوف getProviders/
// getAdminProviders في shippingController.js).
router.get('/providers/admin', protect, access('settings', 'view'), c.getAdminProviders);
router.get('/capabilities', c.getCapabilitiesList);
router.get('/providers/:key/governorates', c.getProviderGovernorates);
// عام (guest) وبينادي مزوّد شحن خارجي فعليًا لكل طلب - محتاج حد أضيق من
// الحد العام (P1-4) لمنع إساءة استخدام تكلف quota/فلوس مع المزوّد.
router.post('/rates', shippingRatesLimiter, c.getRates);
router.post('/providers/:key/connect', protect, access('settings','edit'), c.connectProvider);
router.post('/orders/:orderId/create', protect, access('orders','edit',['call_center','packer']), c.createShipment);
router.post('/orders/:orderId/cancel', protect, access('orders','edit',['call_center','packer']), c.cancelShipment);
router.post('/orders/:orderId/return', protect, access('orders','edit',['call_center','packer']), c.createReturn);
router.post('/orders/:orderId/exchange', protect, access('orders','edit',['call_center','packer']), c.createExchange);
router.get('/orders/:orderId/track', protect, access('orders','view',['call_center','packer']), c.trackShipment);
router.get('/orders/:orderId/label', protect, access('orders','view',['call_center','packer']), c.getLabel);
router.get('/orders/:orderId/label/file', protect, access('orders','view',['call_center','packer']), c.downloadLabel);
// Manual Mode: إدخال رقم تتبع Return/Exchange يدويًا + مزامنة الحالة (شوف
// تعليق setOrderReturnTracking في الكونترولر لسبب وجود الـendpoints دي).
router.post('/orders/:orderId/return/tracking', protect, access('orders','edit',['call_center','packer']), c.setOrderReturnTracking);
router.post('/orders/:orderId/return/sync', protect, access('orders','view',['call_center','packer']), c.syncOrderReturnTracking);
router.post('/orders/:orderId/exchange/tracking', protect, access('orders','edit',['call_center','packer']), c.setOrderExchangeTracking);
router.post('/orders/:orderId/exchange/sync', protect, access('orders','view',['call_center','packer']), c.syncOrderExchangeTracking);
// Webhook بوسطة - مفيش protect middleware عمدًا (بوسطة هي اللي بتنادي عليه
// مباشرة مش أي مستخدم مسجل دخول)، الحماية بتحصل بالـsecret في نفس الرابط.
router.post('/webhooks/bosta/:secret', c.handleBostaWebhook);
// نفس الفكرة لـShipBlu - شوف تعليق handleShipBluWebhook في الكونترولر.
router.post('/webhooks/shipblu/:secret', c.handleShipBluWebhook);
module.exports=router;