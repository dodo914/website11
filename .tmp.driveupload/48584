// Internal (موحّدة) shipping statuses تُستخدم في الـAdmin وفي Order.shippingStatus.
// كل Provider بيرجع أسماء حالات مختلفة تمامًا، فبنعمل mapping لأقرب حالة داخلية
// معروفة. لو حالة الشركة مش معروفة، بنرجعها زي ما هي (fallback) بدل ما نضيّع
// المعلومة أو نخترع حالة غير موجودة فعليًا عند الشركة.
const INTERNAL_STATUSES = [
  'pending', 'created', 'shipped', 'picked_up', 'in_transit', 'out_for_delivery',
  'delivered', 'failed_delivery', 'cancelled', 'failed', 'returned',
];

// ترتيب "تقدّم" منطقي للحالات - مستخدم بس لحماية الـWebhook من الـout-of-order
// events (لو وصل event قديم بعد واحد أحدث بسبب تأخير في الشبكة، منتراجعش
// لحالة أقدم). التسلسل هنا تقريبي ومنطقي (مش من توثيق رسمي بيرقّم الحالات
// كده) - الهدف بس نمنع التراجع للخلف، مش نفرض تسلسل صارم.
//
// Bug fix (regression): 'shipped' هي القيمة اللي controllers/shippingController.js
// (createShipment) بيحطها على order.shippingStatus فور نجاح إنشاء الشحنة مع
// شركة الشحن - نفس لحظة 'created' بالظبط (الشحنة اتسجلت، لسه ما اتستلمتش من
// المندوب). القيمة دي كانت مش موجودة خالص في STATUS_RANK/INTERNAL_STATUSES
// قبل كده، فكانت بتاخد rank = -1 (fallback) - وده كان بيلغي حماية التراجع
// للخلف تمامًا (applyIncomingStatus: `incomingRank !== -1 && incomingRank <
// currentRank` بيبقى دايمًا false لو currentRank=-1، فأي حالة جاية حتى لو
// أقدم كانت بتعدّي وتكتب فوق 'shipped'). الحل: 'shipped' بقت جزء رسمي من
// الترتيب بنفس درجة 'created' (نفس اللحظة في السير) عشان الحماية تشتغل صح.
const STATUS_RANK = {
  pending: 0, created: 1, shipped: 1, picked_up: 2, in_transit: 3, out_for_delivery: 4,
  delivered: 5, failed_delivery: 5, returned: 5, cancelled: 5, failed: 5,
};

// ============================================================================
// Terminal-status transition guard
// ------------------------------------------------------------------------
// ===== FIX: STATUS_RANK فوق بيحمي بس من التراجع لـ"رقم أقل" (out-of-order
// events)، لكن delivered/failed_delivery/returned/cancelled/failed كلهم على
// نفس الـrank (5) بالتصميم (كل واحد فيهم "نهاية" منطقية للرحلة). المشكلة:
// الفحص الأصلي `incomingRank < currentRank` بيبقى false لما يكونوا بنفس
// الـrank، يعني كان مسموح ننتقل بين أي حالتين terminal بأي اتجاه - زي
// delivered -> cancelled أو delivered -> pending (لو currentRank اتحسب غلط)
// - وده بالظبط النوع من الـregression اللي مفروض نمنعه (Webhook مزوّر أو
// event متأخر/فاسد من شركة الشحن يقدر "يلغي" شحنة اتسلمت فعلاً).
// الحل: أي حالة "terminal" (وصلت لنهاية منطقية) ممنوع تتغير لحالة تانية
// خالص، إلا لو فيه استثناء مدعوم صراحة تجاريًا (TERMINAL_TRANSITION_EXCEPTIONS
// تحت) - زي delivered -> returned (عميل رفض الشحنة/رجّعها بعد الاستلام،
// سيناريو حقيقي وموجود بالفعل في تعليق syncOrderTracking/applyIncomingStatus).
// ============================================================================
const TERMINAL_STATUSES = new Set(['delivered', 'failed_delivery', 'cancelled', 'failed', 'returned']);

// استثناءات مدعومة صراحة: من (currentStatus) لـ(مجموعة nextStatus مسموحة).
// أي انتقال terminal->terminal مش موجود هنا بالاسم بيترفض تلقائيًا.
const TERMINAL_TRANSITION_EXCEPTIONS = {
  delivered: new Set(['returned']),
};

// بيرجع true لو الانتقال من currentStatus لـnextStatus ممنوع لأن currentStatus
// حالة نهائية (terminal) ومفيش استثناء تجاري صريح ليها.
function isBlockedTerminalTransition(currentStatus, nextStatus) {
  if (!nextStatus || currentStatus === nextStatus) return false;
  if (!TERMINAL_STATUSES.has(currentStatus)) return false;
  const allowed = TERMINAL_TRANSITION_EXCEPTIONS[currentStatus];
  return !(allowed && allowed.has(nextStatus));
}

// نفس فكرة isBlockedTerminalTransition بالظبط بس لحالات Return/Exchange
// (RETURN_EXCHANGE_STATUS_RANK تحت - delivered/delivery_failed/returned_to_store/
// cancelled كلهم rank=6 بنفس السبب). مفيش استثناء تجاري موثّق حاليًا لأي
// انتقال terminal->terminal في مسار الإرجاع/الاستبدال، فكلهم ممنوعين.
const RETURN_EXCHANGE_TERMINAL_STATUSES = new Set(['delivered', 'delivery_failed', 'returned_to_store', 'cancelled']);
function isBlockedReturnExchangeTerminalTransition(currentStatus, nextStatus) {
  if (!nextStatus || currentStatus === nextStatus) return false;
  return RETURN_EXCHANGE_TERMINAL_STATUSES.has(currentStatus);
}

// Bosta states (حسب التوثيق العام لحالات "state"/"code" الشائعة).
const BOSTA_MAP = {
  '10': 'created', 'created': 'created',
  '20': 'picked_up', 'pickedup': 'picked_up', 'picked_up': 'picked_up',
  '30': 'in_transit', 'intransit': 'in_transit',
  '40': 'out_for_delivery', 'headingtocustomer': 'out_for_delivery',
  '45': 'delivered', 'delivered': 'delivered',
  '46': 'failed_delivery', 'notdelivered': 'failed_delivery',
  '50': 'returned', 'returntobusiness': 'returned',
  'canceled': 'cancelled', 'cancelled': 'cancelled',
};

// Aramex UpdateCode القياسية.
const ARAMEX_MAP = {
  'sh001': 'in_transit', 'sh005': 'delivered', 'sh007': 'failed',
  'sh012': 'out_for_delivery', 'sh013': 'picked_up', 'sh026': 'returned',
  'cancelled': 'cancelled',
};

// DHL Express tracking event typeCode القياسية.
const DHL_MAP = {
  'pu': 'picked_up', 'pl': 'in_transit', 'ar': 'in_transit', 'dp': 'in_transit',
  'wc': 'out_for_delivery', 'od': 'out_for_delivery',
  'dd': 'delivered', 'de': 'delivered',
  'cc': 'cancelled', 'rt': 'returned', 'ex': 'failed',
};

// حالات ShipBlu الرسمية (موثقة في support.shipblu.com - "Detailed Timeline" tool).
// بنحتفظ بالـraw status الأصلي زي ما هو دايمًا (شايف statusMap.js في trackShipment)،
// وهنا بس بنعمل mapping لأقرب حالة داخلية معروفة عندنا.
const SHIPBLU_MAP = {
  'created': 'created',
  'pickup requested': 'pending',
  'out for pickup': 'pending',
  'pickup rescheduled': 'pending',
  'picked up': 'picked_up',
  'in transit & en route': 'in_transit',
  'in transit': 'in_transit',
  'out for delivery': 'out_for_delivery',
  'delivery attempted': 'failed',
  'delivered': 'delivered',
  'return to origin': 'returned',
  'on hold': 'pending',
  'out for return': 'returned',
  'returned': 'returned',
  'canceled': 'cancelled',
  'cancelled': 'cancelled',
};

const PROVIDER_MAPS = { bosta: BOSTA_MAP, aramex: ARAMEX_MAP, dhl: DHL_MAP, shipblu: SHIPBLU_MAP };

function normalizeStatus(provider, rawStatus) {
  if (!rawStatus) return 'pending';
  const map = PROVIDER_MAPS[String(provider || '').toLowerCase()] || {};
  const key = String(rawStatus).trim().toLowerCase();
  return map[key] || (INTERNAL_STATUSES.includes(key) ? key : 'pending');
}

// ============================================================================
// Return / Exchange status normalization (Bosta Return & Exchange Integration)
// ------------------------------------------------------------------------
// دي مجموعة منفصلة تمامًا عن INTERNAL_STATUSES/STATUS_RANK فوق (اللي خاصة
// بشحنة الطلب العادية Order.trackingNumber بس). لما نتابع شحنة Return أو
// Exchange (Order.returnTrackingNumber / Order.exchangeTrackingNumber أو
// ExchangeRequest.trackingNumber) لازم نستخدم mapping مختلف لأن دورة حياة
// شحنة الإرجاع/الاستبدال مختلفة عن شحنة الذهاب العادية (بترجع للمخزن بدل
// ما توصل للعميل، وممكن يبقى فيها مرحلة معاينة "inspecting").
//
// القيم دي مأخوذة حرفيًا من القيم اللي طلبها الـPRD (BOSTA RETURN & EXCHANGE
// INTEGRATION AUDIT) - ملحوظة: دي أسماء داخلية موحّدة إحنا اخترناها، مش
// حالات موثّقة رسميًا من بوسطة لـReturn/Exchange تحديدًا (بوسطة معندهاش
// official Return/Exchange creation API موثّق في الكود ده - شوف
// capabilities.js). لحد ما نتأكد من التوثيق الرسمي الدقيق لكل حالة، الـraw
// status اللي بيرجع من بوسطة بيتحفظ زي ما هو دايمًا (مفيش فقد للمعلومة)،
// وده بس أقرب mapping منطقي لأقرب حالة داخلية معروفة عندنا.
// ============================================================================
const RETURN_EXCHANGE_STATUSES = [
  'pickup_pending', 'picked_up', 'received_at_warehouse', 'inspecting',
  'shipped_to_customer', 'out_for_delivery', 'delivered', 'delivery_failed',
  'returned_to_store', 'cancelled',
];

// ترتيب تقدّم منطقي - نفس فكرة STATUS_RANK بالظبط (حماية من التراجع للخلف
// بسبب webhook/tracking response متأخر أو out-of-order).
const RETURN_EXCHANGE_STATUS_RANK = {
  pickup_pending: 0,
  picked_up: 1,
  received_at_warehouse: 2,
  inspecting: 3,
  shipped_to_customer: 4,
  out_for_delivery: 5,
  delivered: 6,
  delivery_failed: 6,
  returned_to_store: 6,
  cancelled: 6,
};

// نفس منطق BOSTA_MAP فوق لكن لأقرب حالة داخلية Return/Exchange. بنستخدم
// نفس raw codes/state names اللي بوسطة بترجعها لشحنة عادية (لأن مفيش
// توثيق رسمي منفصل لحالات Return/Exchange تحديدًا) + كلمات إضافية شائعة
// في التتبع العام (received/warehouse/inspection) لو ظهرت فعليًا.
const BOSTA_RETURN_EXCHANGE_MAP = {
  '10': 'pickup_pending', 'created': 'pickup_pending', 'pickuprequested': 'pickup_pending',
  '20': 'picked_up', 'pickedup': 'picked_up', 'picked_up': 'picked_up',
  'receivedatwarehouse': 'received_at_warehouse', 'received_at_warehouse': 'received_at_warehouse',
  'atwarehouse': 'received_at_warehouse', 'instock': 'received_at_warehouse',
  'inspecting': 'inspecting', 'inspection': 'inspecting', 'underinspection': 'inspecting',
  '30': 'shipped_to_customer', 'intransit': 'shipped_to_customer',
  '40': 'out_for_delivery', 'headingtocustomer': 'out_for_delivery',
  '45': 'delivered', 'delivered': 'delivered',
  '46': 'delivery_failed', 'notdelivered': 'delivery_failed',
  '50': 'returned_to_store', 'returntobusiness': 'returned_to_store', 'returned': 'returned_to_store',
  'canceled': 'cancelled', 'cancelled': 'cancelled',
};

// ============================================================================
// ShipBlu Return/Exchange mapping (ShipBlu Return & Exchange Integration Audit)
// ------------------------------------------------------------------------
// ليه محتاجين الخريطة دي منفصلة؟ لأن normalizeReturnExchangeStatus قبل كده
// كانت شغالة لبوسطة بس (RETURN_EXCHANGE_PROVIDER_MAPS = { bosta }) - يعني
// حتى لو الأدمن دخّل رقم تتبع ShipBlu لمرتجع/استبدال يدويًا (Manual Mode)
// وطلب "مزامنة الآن"، أو وصل تحديث تلقائي من الـworker الدوري، كانت
// normalizeReturnExchangeStatus بترجع null دايمًا لـShipBlu (الحالة الخام
// بتتحفظ في returnTrackingRawStatus/exchangeTrackingRawStatus بس returnStatus/
// exchangeStatus الداخلي كان بيفضل زي ما هو - مفيش تقدّم تلقائي للـworkflow
// خالص). ده باج حقيقي كان لازم يتصلح عشان "Mode 2" (يدوي + تتبع تلقائي)
// يشتغل فعليًا لـShipBlu زي بوسطة بالظبط.
//
// المصدر: نفس raw status strings الموثقة فعليًا في SHIPBLU_MAP فوق (مش
// حالات مخترعة) - بنعمل mapping لأقرب حالة Return/Exchange داخلية معروفة.
// بعض الحالات الغامضة (زي "on hold" أو "out for return") متعمّد إننا
// مسيبينها من غير mapping (بترجع null) بدل ما نخمّن تصنيف غلط - نفس مبدأ
// normalizeReturnExchangeStatus ("لو معرفناش نصنفها صح، أحسن حاجة نسيبها
// زي ما هي"). حالة "in transit" اتحطت 'shipped_to_customer' بنفس منطق
// BOSTA_RETURN_EXCHANGE_MAP فوق (نفس الكلمة بتتستخدم لمرحلة "في الطريق"
// سواء الشحنة راجعة للمخزن أو رايحة للعميل بالاستبدال - أقرب حالة داخلية
// متاحة عندنا للمرحلة دي).
// ============================================================================
const SHIPBLU_RETURN_EXCHANGE_MAP = {
  'created': 'pickup_pending',
  'pickup requested': 'pickup_pending',
  'out for pickup': 'pickup_pending',
  'pickup rescheduled': 'pickup_pending',
  'picked up': 'picked_up',
  'in transit & en route': 'shipped_to_customer',
  'in transit': 'shipped_to_customer',
  'out for delivery': 'out_for_delivery',
  'delivery attempted': 'delivery_failed',
  'delivered': 'delivered',
  'return to origin': 'received_at_warehouse',
  'returned': 'returned_to_store',
  'canceled': 'cancelled',
  'cancelled': 'cancelled',
};

// ============================================================================
// Aramex Return/Exchange mapping (Aramex Return & Exchange Integration Audit)
// ------------------------------------------------------------------------
// نفس المشكلة اللي كانت موجودة لـShipBlu بالظبط: normalizeReturnExchangeStatus
// كانت بترجع null دايمًا لأرامكس (مفيش mapping ليها في RETURN_EXCHANGE_PROVIDER_MAPS)،
// يعني حتى لو الأدمن دخّل رقم تتبع أرامكس لمرتجع/استبدال ونجحت المزامنة
// (الـworker الدوري أو زرار "مزامنة الآن")، الـraw status بس كان بيتسجل -
// returnStatus/exchangeStatus الداخلي مكانش بيتقدّم تلقائيًا خالص. الخريطة
// دي بتستخدم نفس UpdateCode القياسية الموثّقة والمستخدمة فعليًا في ARAMEX_MAP
// فوق (مش أكواد مخترعة) - بس معمولة mapping لأقرب حالة Return/Exchange
// داخلية بدل الحالة العادية. 'sh001' (in_transit) اتحطت 'shipped_to_customer'
// بنفس منطق BOSTA/SHIPBLU_RETURN_EXCHANGE_MAP (نفس الكود بيتستخدم لمرحلة
// "في الطريق" سواء رايحة للعميل أو راجعة للمخزن - أقرب حالة داخلية متاحة).
// ============================================================================
const ARAMEX_RETURN_EXCHANGE_MAP = {
  'sh013': 'picked_up',
  'sh001': 'shipped_to_customer',
  'sh012': 'out_for_delivery',
  'sh005': 'delivered',
  'sh007': 'delivery_failed',
  'sh026': 'returned_to_store',
  'cancelled': 'cancelled',
};

// ============================================================================
// DHL Return/Exchange mapping (DHL Return & Exchange Integration Audit)
// ------------------------------------------------------------------------
// نفس المشكلة اللي كانت موجودة لـShipBlu/أرامكس بالظبط: normalizeReturnExchangeStatus
// كانت بترجع null دايمًا لـDHL (مفيش mapping ليها في RETURN_EXCHANGE_PROVIDER_MAPS)
// - يعني حتى لو الأدمن دخّل رقم تتبع DHL (MyDHL API) لمرتجع/استبدال ونجحت
// المزامنة (الـworker الدوري أو زرار "مزامنة الآن")، الـraw status بس كان
// بيتسجل - returnStatus/exchangeStatus الداخلي مكانش بيتقدّم تلقائيًا خالص.
// الخريطة دي بتستخدم نفس typeCode القياسية الموثّقة والمستخدمة فعليًا في
// DHL_MAP فوق (مش أكواد مخترعة) - بس معمولة mapping لأقرب حالة Return/Exchange
// داخلية بدل الحالة العادية. 'pl'/'ar'/'dp' (in_transit) اتحطوا
// 'shipped_to_customer' بنفس منطق باقي الشركات (نفس الكود بيتستخدم لمرحلة
// "في الطريق" سواء رايحة للعميل أو راجعة للمخزن - أقرب حالة داخلية متاحة).
// ============================================================================
const DHL_RETURN_EXCHANGE_MAP = {
  'pu': 'picked_up',
  'pl': 'shipped_to_customer',
  'ar': 'shipped_to_customer',
  'dp': 'shipped_to_customer',
  'wc': 'out_for_delivery',
  'od': 'out_for_delivery',
  'dd': 'delivered',
  'de': 'delivered',
  'cc': 'cancelled',
  'rt': 'returned_to_store',
  'ex': 'delivery_failed',
};

const RETURN_EXCHANGE_PROVIDER_MAPS = { bosta: BOSTA_RETURN_EXCHANGE_MAP, shipblu: SHIPBLU_RETURN_EXCHANGE_MAP, aramex: ARAMEX_RETURN_EXCHANGE_MAP, dhl: DHL_RETURN_EXCHANGE_MAP };

// بيرجع أقرب حالة داخلية معروفة لـReturn/Exchange بناءً على الـraw status
// اللي رجع من شركة الشحن. لو الحالة مش معروفة، بيرجع null (مش 'pending' -
// عشان الشك في تصنيف حالة Return/Exchange أخطر من الشك في شحنة عادية:
// لو معرفناش نصنفها صح، أحسن حاجة نسيبها زي ما هي ونعرض الـraw status
// للأدمن بدل ما نحطها في حالة أولى غلط).
function normalizeReturnExchangeStatus(provider, rawStatus) {
  if (!rawStatus) return null;
  const map = RETURN_EXCHANGE_PROVIDER_MAPS[String(provider || '').toLowerCase()] || {};
  const key = String(rawStatus).trim().toLowerCase();
  return map[key] || (RETURN_EXCHANGE_STATUSES.includes(key) ? key : null);
}

module.exports = {
  INTERNAL_STATUSES, STATUS_RANK, normalizeStatus,
  RETURN_EXCHANGE_STATUSES, RETURN_EXCHANGE_STATUS_RANK, normalizeReturnExchangeStatus,
  TERMINAL_STATUSES, isBlockedTerminalTransition,
  RETURN_EXCHANGE_TERMINAL_STATUSES, isBlockedReturnExchangeTerminalTransition,
};