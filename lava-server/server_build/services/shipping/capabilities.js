// ============================================================================
// Provider Capabilities
// ------------------------------------------------------------------------
// بترجع capability = true بس للعملية اللي فعلاً متنفذة ومربوطة بـofficial
// API الخاص بشركة الشحن (شوف تعليقات كل service). أي عملية غير موثقة رسميًا
// أو مش متنفذة = false، وممنوع الـAdmin Dashboard يظهر زرارها.
//
// المصدر لكل قيمة هنا هو الكود الفعلي الموجود في bostaService/aramexService/
// dhlService/shipbluService - مش تخمين. لو حابب تضيف عملية جديدة (زي Return/
// Exchange) لازم الأول تتأكد من الـofficial API docs بتاع الشركة، تضيفها في
// service الخاص بيها، وبعدين تحدّث القيمة هنا لـtrue.
// ============================================================================

const CAPABILITIES = {
  bosta: {
    supportsRates: true,        // rate() - جدول أسعار يدوي (manual_rate) وليس API rate call
    supportsCreateShipment: true,   // createShipment() - POST /deliveries
    supportsTracking: true,     // track() - GET /deliveries/:id/tracking
    supportsCancellation: true, // cancelShipment() - PUT /deliveries/:id/terminate (terminateDelivery الرسمية)
    supportsLabels: true,       // getLabel() - GET /deliveries/:id/awb
    supportsCOD: true,          // موجودة في createShipment (حقل cod)
    supportsPickup: true,       // pickupId بيتبعت مع createShipment (pickup location موجودة مسبقًا)
    supportsReturns: false,     // غير متنفذ - مفيش official Return API متأكد منه في الكود ده
    supportsExchange: false,    // غير متنفذ رسميًا
    supportsWebhooks: true,      // handleBostaWebhook في shippingController.js - بوسطة رسميًا بتدعم Webhook (شوف تعليق الـhandler لتفاصيل التحقق بالـsecret)
  },
  aramex: {
    supportsRates: true,        // rate() - CalculateRate عبر RateCalculator service
    supportsCreateShipment: true,   // createShipment() - CreateShipments
    supportsTracking: true,     // track() - TrackShipments
    supportsCancellation: false, // موثق رسميًا إن الـShipping API بيدعم Pickup Cancellation بس، مش Shipment Cancellation (شوف تعليق aramexService.js)
    supportsLabels: true,       // بيرجع LabelURL مع createShipment (ReportType: 'URL')
    supportsCOD: true,          // PaymentType: 'C' في ShipmentDetails
    supportsPickup: false,      // مفيش pickup request منفصل متنفذ في الكود ده (بيتم الشحن مباشرة)
    supportsReturns: false,
    supportsExchange: false,
    supportsWebhooks: false,
  },
  dhl: {
    supportsRates: true,        // rate() - GET /rates
    supportsCreateShipment: true,   // createShipment() - POST /shipments
    supportsTracking: true,     // track() - GET /shipments/:id/tracking
    supportsCancellation: true, // cancelShipment() - DELETE /shipments/:id (موثقة في MyDHL API، بس قبل ما تتستلم من المندوب)
    supportsLabels: true,       // documents[0].contentUrl بيرجع مع إنشاء الشحنة
    supportsCOD: false,         // مفيش حقل COD متنفذ في الـpayload الحالي لـDHL Express
    supportsPickup: false,      // pickup.isRequested: false بشكل ثابت في الكود الحالي
    supportsReturns: false,
    supportsExchange: false,
    supportsWebhooks: false,
  },
  shipblu: {
    supportsRates: true,        // rate() - جدول أسعار يدوي (manual_rate)، مفيش Rate API رسمي موثق
    supportsCreateShipment: true,
    supportsTracking: true,
    supportsCancellation: false, // مفيش API endpoint موثّق للإلغاء - التوثيق الرسمي بيقول الإلغاء بيتم من لوحة تحكم ShipBlu نفسها يدويًا (Actions -> Return to Origin) مش عن طريق نداء API
    supportsLabels: true,       // getLabel()/getLabelBytes() - GET /orders/shipping-label/ (موثق في docs.shipblu.com/tutorial)، بيتم تحميلها عبر بروكسي الباك اند لأن الرابط الأصلي محتاج API Key سري
    supportsCOD: true,
    supportsPickup: false,
    supportsReturns: false,
    supportsExchange: false,
    supportsWebhooks: true,      // handleShipBluWebhook في shippingController.js - ShipBlu رسميًا بتوفر Webhook (بيتفعّل من لوحة تحكم ShipBlu - Integrations، مش من عندنا)
  },
};

// بيرجع نسخة capabilities لشركة شحن معينة (أو object فاضي لو مش معروفة).
function getCapabilities(key) {
  return CAPABILITIES[String(key || '').toLowerCase()] || null;
}

// بيرجع capabilities كل الشركات الأربعة مع بعض - مستخدم في الـAdmin Dashboard
// عشان يعرف يظهر/يخفي زراير كل عملية لكل شركة صح.
function getAllCapabilities() {
  return CAPABILITIES;
}

// بيتأكد إن عملية معينة (مثلاً 'supportsCancellation') مدعومة فعلاً لشركة
// شحن معينة قبل ما تتنفذ - لو مش مدعومة بيرمي error واضح بدل fake execution.
function assertCapability(key, capability) {
  const caps = getCapabilities(key);
  if (!caps || caps[capability] !== true) {
    const err = new Error(`العملية غير مدعومة لشركة الشحن (${key}) عبر الـAPI الرسمي حاليًا`);
    err.status = 400;
    err.code = 'UNSUPPORTED_OPERATION';
    throw err;
  }
  return true;
}

module.exports = { CAPABILITIES, getCapabilities, getAllCapabilities, assertCapability };