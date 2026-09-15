const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const { get, set, invalidateProductCaches, CACHE_TTL, CACHE_KEYS } = require('../utils/cache');
const { uploadImageToCloudinary, deleteImageFromCloudinary } = require('../utils/uploadToCloudinary');
const {
  decrementOrderItems,
  restoreOrderItems,
  logMovement,
  logMovementsBulk,
} = require('../utils/inventory');
const { parsePagination, buildListResponse } = require('../utils/pagination');
const { buildPaymentUrl, isConfigured: isKashierConfigured, refundPayment: refundKashierPayment, getOrderStatus: getKashierOrderStatus } = require('../services/kashierService');
const { createPaymentIntention: createPaymobIntention, isConfigured: isPaymobConfigured, refundPayment: refundPaymobPayment, getTransactionStatus: getPaymobTransactionStatus } = require('../services/paymobService');
// ملحوظة إصلاح: كان بيستخدم موديل ShippingProvider (Mongo collection) ودالة
// getProvider(key).getRate(...) غير موجودة أصلاً في services/shipping. الموديل
// ده معملوش عليه أي route يكتب فيه بيانات (Dead/Orphaned model) وبالتالي
// findOne كان يرجع null دايمًا، والدالة getRate مكنتش موجودة أصلاً (كانت
// هتعمل crash لو الشرط اتحقق). الكود اتشال ومكانه استخدام نظام الشحن
// الحقيقي الشغال فعليًا في services/shipping (نفس اللي بيستخدمه /api/shipping).
const { publicConfig, rates: getShippingRates, createShipmentForOrder, getCapabilities } = require('../services/shipping');
// ===== Phase 2: تحقق موحّد من رقم الهاتف المصري + بيانات العنوان الأساسية =====
// نفس الدالة مستخدمة هنا وفي authController (حفظ عنوان الحساب) - مصدر واحد
// للتحقق، مش خاص بشركة شحن معينة (شوف utils/addressValidation.js).
const { validateEgyptianPhone, validateCoreAddress } = require('../utils/addressValidation');
// ===== قائمة أسباب الاسترجاع الموحّدة + هل السبب بيستوجب رسوم شحن استرجاع =====
const { isValidReasonCode, doesReasonApplyFee, RETURN_REASONS, getEffectiveReturnReasons } = require('../utils/returnReasons');
// ===== Returns & Exchanges - Phase 2A: حساب الرسوم/الأهلية/الصور المطلوبة Server-side =====
const { computeFee, checkEligibility, isEvidenceRequired } = require('../utils/returnExchangeFees');
// ===== رقم الأوردر المتسلسل (1001، 1002...) - شوف utils/orderNumber.js و models/Counter.js =====
const { getNextOrderNumber } = require('../utils/orderNumber');
// ===== P0 Fix #4: حساب الـ Bundles والعروض الترويجية (Promotions) من السيرفر =====
// بدل ما نصدّق discount/bundleDiscount المرسلين من العميل، بنعيد نفس حساب
// الفرونت (calculateCartPromotions/addBundleToCart في App.jsx) هنا باستخدام
// بيانات المنتجات والإعدادات المخزّنة فعليًا في قاعدة البيانات فقط.
const { calculateCartPromotions, validateBundleItems } = require('../utils/cartPromotions');
// ===== P1-1: حماية إنشاء الطلب من التكرار (Idempotency) - شوف services/orderIdempotencyService.js =====
const { claimOrderIdempotency, finalizeOrderIdempotency } = require('../services/orderIdempotencyService');
// ===== FIX: sendPurchaseConversions (Meta/TikTok/Snapchat server-side Conversion
// API) is called later in createOrder (COD/manual orders) and in markPaid, but
// this file never imported it - ReferenceError: sendPurchaseConversions is not
// defined, thrown AFTER the order was already saved to the DB (stock already
// decremented, order visible in admin), which is why the customer saw a
// generic 500 "حصل خطأ في إنشاء الطلب" while the order existed. =====
const { sendPurchaseConversions } = require('../services/conversionTrackingService');
const { buildOrderIdempotencyKey, hashOrderPayload } = require('../utils/orderIdempotencyKey');
// ===== حماية بيانات العميل: projection صريحة (allowlist) بدل ما نرجّع
// مستند الـOrder كامل للعميل/الضيف - شوف utils/customerOrderView.js =====
const { toCustomerOrderView, toCustomerOrderViews, toCustomerReturnRequestView } = require('../utils/customerOrderView');
// ===== P1-2: Centralized payment state machine / transition guard =====
const { PAYMENT_STATUSES, applyPaymentStatusTransition, canTransitionPaymentStatus } = require('../services/paymentStateMachine');
// ===== P1-3: حجز atomic لأي "ميزة عميل محدودة الاستخدام" (كوبون/أول طلب/
// كود ولاء) وقت التحقق نفسه، عشان نمنع استهلاكها مرتين تحت طلبات متزامنة
// (شوف utils/benefitReservation.js للشرح الكامل) =====
const {
  reserveLoyaltyCode,
  releaseLoyaltyCode,
  reserveFirstOrderDiscount,
  releaseFirstOrderDiscount,
  reserveDiscountCodeUsage,
  releaseDiscountCodeUsage,
  incrementLoyaltyOrderCount,
} = require('../utils/benefitReservation');

// أقصى كمية منطقية للعنصر الواحد في الطلب (حماية من قيم غير منطقية/هجومية)
const MAX_ITEM_QUANTITY = 1000;

// كمية صحيحة (integer) وأكبر من صفر وأقل من الحد الأقصى المنطقي
const isValidQuantity = (q) => Number.isInteger(q) && q > 0 && q <= MAX_ITEM_QUANTITY;

// حالات الطلب اللي معناها "الطلب اتلغى/اترفض/رجع" وبالتالي لازم يرجع المخزون
const STOCK_RESTORING_STATUSES = new Set(['ملغي', 'Cancelled', 'مرتجع', 'Returned']);

const roundTwo = (value) => Math.round(Number(value || 0) * 100) / 100;

const calculateEffectiveProductPrice = (product, settings) => {
  // لازم نفس أولوية حساب السعر المستخدمة في الفرونت (getEffectivePrice في App.jsx):
  // 1) خصم العداد التنازلي (onSale + salePrice) لو العداد شغال فعلاً
  // 2) خصم دائم ثابت (permanentSalePrice) — مستقل عن العداد، وكان ناقص هنا
  //    وده اللي كان بيخلي الطلب يتحسب بالسعر الأصلي كامل في Kashier حتى لو
  //    الموقع نفسه كان عارض السعر بعد الخصم الدائم.
  // 3) السعر الأصلي
  const saleActive = settings?.showCountdownBar && settings?.saleEndDate && new Date(settings.saleEndDate).getTime() > Date.now();
  if (saleActive && product.onSale && product.salePrice != null && product.salePrice !== '' && Number(product.salePrice) < Number(product.price)) {
    return roundTwo(product.salePrice);
  }
  if (product.permanentSalePrice != null && product.permanentSalePrice !== '' && Number(product.permanentSalePrice) > 0 && Number(product.permanentSalePrice) < Number(product.price)) {
    return roundTwo(product.permanentSalePrice);
  }
  return roundTwo(product.price);
};

// ===== حساب سعر الشحن سيرفر-سايد من إعدادات المتجر (مش من قيمة العميل) =====
// نفس المنطق المستخدم في الفرونت (calculateCartTotals): لو السلة وصلت لحد الشحن
// المجاني يبقى الشحن صفر، وإلا بنجيب سعر المحافظة المطابقة، وإلا نرجع لسعر الشحن الافتراضي.
const computeShippingCost = (settings, governorateName, subtotal) => {
  const freeThreshold = Number.isFinite(Number(settings?.freeShippingThreshold))
    ? Number(settings.freeShippingThreshold)
    : 1500;

  if (subtotal >= freeThreshold) return 0;

  const governorates = Array.isArray(settings?.governorates) ? settings.governorates : [];
  const name = String(governorateName || '').trim();
  const gov = name
    ? governorates.find((g) => g?.name?.ar === name || g?.name?.en === name)
    : null;

  if (gov && Number.isFinite(Number(gov.cost))) {
    return roundTwo(gov.cost);
  }

  const defaultCost = Number.isFinite(Number(settings?.defaultShippingCost))
    ? Number(settings.defaultShippingCost)
    : 90;
  return roundTwo(defaultCost);
};

// ===== توليد كود ولاء عشوائي وفريد =====
const generateLoyaltyCode = (prefix) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = (prefix || 'LOYALTY') + '-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// ============================================================
// ===== [P0 Fix #5] حماية حالة الدفع وقت إنشاء الطلب =====
// orderData بييجي مباشرة من body العميل (req.body) وكان بيتحط زي ما هو
// جوا Order.create({ ...orderData, ... }) من غير أي تصفية. ده كان معناه
// إن أي عميل (حتى غير مسجل دخول) يقدر يبعت paymentStatus: "paid" أو
// paymentGateway: {...} مزيّفة مع الطلب ويخلي السيرفر يصدقه من غير ما
// يعدي فعليًا على مسار التحقق الحقيقي (Webhook/Callback الموثوق من
// Kashier/Paymob أو تأكيد الأدمن اليدوي لمحفظة/إنستاباي).
// الدالة دي بتشيل أي حقل بيتحكم في "حالة الدفع الحقيقية" من مدخلات
// العميل قبل ما تتحط في الطلب - حالة الدفع بتفضل دايمًا 'pending' (القيمة
// الافتراضية في الـ Schema) لحد ما مسار موثوق (Webhook/Callback أو
// endpoint الأدمن /:id/payment-status المحمي بصلاحية payments_dashboard)
// يغيّرها فعليًا.
// مُصدَّرة عشان تتختبر مباشرة (test/paymentStatusSecurity.test.js) من
// غير ما نحتاج نشغّل قاعدة بيانات حقيقية.
// ============================================================
const CLIENT_FORBIDDEN_ORDER_FIELDS = ['paymentStatus', 'paymentGateway'];
const stripClientPaymentFields = (data) => {
  const clean = { ...data };
  for (const field of CLIENT_FORBIDDEN_ORDER_FIELDS) {
    delete clean[field];
  }
  return clean;
};

// POST /api/orders  (عام - عميل مسجل أو ضيف)
const createOrder = async (req, res) => {
  let uploadedScreenshot = null;

  // ===== بارسنج بيانات الطلب مبكرًا (قبل فحص الـidempotency) =====
  // اتنقل لفوق عشان نقدر نحسب hash المحتوى المنطقي للطلب (hashOrderPayload)
  // ونمرره لـclaimOrderIdempotency - كان الفحص بيحصل قبل ما orderData يتقرأ
  // خالص، فمكانش في أي طريقة نتحقق إن نفس المفتاح بيتستخدم لنفس الطلب
  // فعليًا. لسه جوه try/catch مستقل بنفس رسالة الخطأ القديمة بالظبط.
  let orderData;
  if (req.body && typeof req.body.data === 'string') {
    try {
      orderData = JSON.parse(req.body.data);
    } catch (err) {
      return res.status(400).json({ message: 'بيانات الطلب غير صالحة' });
    }
  } else {
    orderData = { ...req.body };
  }
  // امنع العميل من فرض حالة دفع أو بيانات بوابة دفع مزيّفة على الطلب
  orderData = stripClientPaymentFields(orderData);

  // ============================================================
  // ===== P1-1: Order Creation Idempotency =====
  // بنقرأ مفتاح idempotency من هيدر "Idempotency-Key" (المعيار الشائع لهذا
  // النوع من الحماية) أو من الـbody كـfallback (لو مبعتش كـheader لأي
  // سبب). الفرونت بيولّد قيمة واحدة (UUID) لكل "محاولة تأكيد طلب" وبيفضل
  // يستخدمها هي هي لو نفس الطلب اتعاد إرساله (double-click/retry بعد
  // timeout) - شوف src/App.jsx (handleCheckoutSubmit) و src/api/orders.js.
  //
  // مفيش idempotency key = بيتنفذ إنشاء الطلب بنفس السلوك القديم بالظبط،
  // من غير أي حماية إضافية (سلوك مُعرَّف بوضوح ومقصود، مش عرضي) - عشان
  // منكسرش أي عميل/تكامل قديم لسه مبعتش الهيدر ده.
  //
  // بنربط المفتاح بهوية مقدّم الطلب (customerId المسجّل، أو 'guest' لغير
  // المسجلين) عشان عميل ميقدرش يستخدم مفتاح عميل تاني عمدًا ويشوف نتيجة/
  // بيانات طلب مش بتاعه عن طريق الـreplay.
  // ============================================================
  const idemInfo = buildOrderIdempotencyKey(req);
  const idempotencyKey = idemInfo ? idemInfo.idempotencyKey : null;
  const idempotencyScope = idemInfo ? idemInfo.scope : (req.user ? `user:${req.user._id}` : 'guest');
  let idemRecord = null;

  // ===== SECURITY HARDENING: نفس المفتاح + طلب مختلف (سلة/كود خصم/طريقة
  // دفع مختلفة) لازم يترفض، مش يتنفذ فوق سجل مفتاح راجع لطلب تاني، ولا
  // يرجّع replay لطلب تاني للعميل. شوف hashOrderPayload جوه
  // utils/orderIdempotencyKey.js للتفاصيل. =====
  const requestHash = idempotencyKey ? hashOrderPayload(orderData) : null;

  if (idempotencyKey) {
    try {
      const claim = await claimOrderIdempotency(idempotencyKey, idempotencyScope, requestHash);
      if (!claim.claimed) {
        if (claim.mismatch) {
          return res.status(422).json({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'مفتاح الطلب ده اتستخدم قبل كده لطلب مختلف - من فضلك أعد المحاولة بمفتاح جديد',
          });
        }
        if (claim.replay) {
          // ===== محاولة ناجحة سابقة بنفس المفتاح بالظبط - رجّع نفس النتيجة =====
          // (مفيش Order جديد اتعمل، ومفيش أي منطق عمل اتنفذ تاني).
          return res.status(claim.replay.statusCode).json(claim.replay.body);
        }
        // ===== محاولة تانية شغالة فعليًا دلوقتي بنفس المفتاح (race حقيقي) =====
        return res.status(409).json({
          code: 'ORDER_ALREADY_PROCESSING',
          message: 'طلبك قيد المعالجة بالفعل، من فضلك انتظر قليلاً ولا تعيد الإرسال',
        });
      }
      idemRecord = claim.record;
    } catch (idemErr) {
      // لو نظام الـidempotency نفسه فشل (مثلاً مشكلة اتصال مؤقتة بقاعدة
      // البيانات وقت محاولة الحجز)، منمنعش العميل من إتمام طلب حقيقي بسبب
      // ده - بنكمل عادي من غير حماية idempotency لهذا الـrequest بس (نفس
      // سلوك "مفيش مفتاح أصلاً")، ونسجل الخطأ للمتابعة.
      console.error('Order idempotency claim failed, proceeding without guard for this request:', idemErr.message);
    }
  }

  // ===== بتحدّث سجل الـidempotency (لو موجود) بنتيجة الـresponse الفعلية =====
  // قبل ما ترجع للعميل - بتغطي كل الـreturn res.status(...).json(...) في
  // الدالة دي من غير ما نحتاج نعدّل كل واحد فيهم لوحده (نفس النتيجة
  // النهائية، أقل تغيير ممكن في المنطق الحالي الشغال).
  if (idemRecord) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const safeBody = body && typeof body.toObject === 'function' ? body.toObject() : body;
      finalizeOrderIdempotency(idemRecord, {
        statusCode: res.statusCode,
        body: safeBody,
        orderId: safeBody && safeBody._id ? safeBody._id : null,
      }).catch((e) => console.error('finalizeOrderIdempotency failed:', e.message));
      return originalJson(body);
    };
  }

  try {
    // orderData اتقرأ وتنضّف (stripClientPaymentFields) فوق قبل فحص الـ
    // idempotency - شوف الملحوظة عند تعريف orderData في بداية الدالة.
    if (req.user) {
      orderData.customerId = req.user._id;
      orderData.customerEmail = req.user.email;
    }

    if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
      return res.status(400).json({ message: 'الطلب يجب أن يحتوي على عناصر صالحة' });
    }

    // ============================================================
    // ===== Phase 2: تحقق سيرفر-سايد إلزامي من الهاتف وبيانات العنوان =====
    // ده تحقق authoritative (السيرفر هو المصدر الحقيقي) - بغض النظر عن أي
    // تحقق تم في الفرونت. بيرفض أرقام زي "11" قبل ما يوصل لأي حاجة تانية
    // (خصم مخزون / إنشاء طلب / إنشاء شحنة). التحقق ده عام لكل شركات الشحن،
    // مش خاص ببوسطة (شوف utils/addressValidation.js).
    // الحقول الإضافية (district/buildingNumber/floor/apartment/landmark) لو
    // اتبعتت جوه shippingAddress بتتقبل زي ما هي من غير إلزام هنا - كل شركة
    // شحن هتتأكد من احتياجاتها الدقيقة بنفسها وقت إنشاء الشحنة (Phase 3).
    // ============================================================
    const incomingShippingAddress = (orderData.shippingAddress && typeof orderData.shippingAddress === 'object')
      ? orderData.shippingAddress
      : {};

    const phoneCheck = validateEgyptianPhone(orderData.customerPhone, { label: 'رقم الهاتف' });
    if (!phoneCheck.ok) {
      return res.status(400).json({ message: phoneCheck.message });
    }
    if (orderData.customerPhone2) {
      const phone2Check = validateEgyptianPhone(orderData.customerPhone2, { required: false, label: 'رقم الهاتف الإضافي' });
      if (!phone2Check.ok) {
        return res.status(400).json({ message: phone2Check.message });
      }
    }

    const coreAddressCheck = validateCoreAddress({
      fullName: orderData.customerName,
      phone: orderData.customerPhone,
      governorate: orderData.governorate,
      detailedAddress: orderData.address,
    });
    if (!coreAddressCheck.ok) {
      return res.status(400).json({ message: `بيانات الشحن ناقصة: ${coreAddressCheck.missing.join('، ')}` });
    }

    const settings = await Settings.findOne();
    // ملحوظة: الفرونت بيبعت اختيار العميل لشركة الشحن في حقل اسمه
    // "shippingProviderId" (راجع src/App.jsx و src/api/orders.js) مش
    // "shippingProvider"، فكان الشرط القديم "if (shippingProviderKey)"
    // متحققش عمليًا خالص وده سبب إضافي إن الكود القديم كان Dead Code.
    // بنقرأ الحقل الصح هنا، ونتحقق منه على نظام الشحن الحقيقي (env-based
    // providers في services/shipping) بدل موديل Mongo يتيم.
    const shippingProviderKey = String(orderData.shippingProviderId || orderData.shippingProvider || '').trim().toLowerCase();
    if (shippingProviderKey) {
      const providersConfig = publicConfig();
      const providerInfo = providersConfig[shippingProviderKey];
      if (!providerInfo || !providerInfo.enabled) {
        return res.status(400).json({ message: 'شركة الشحن المختارة غير متاحة حاليًا' });
      }
      const countryCode = String(orderData.shippingCountryCode || '').toUpperCase();
      if (countryCode && providerInfo.countries?.length && !providerInfo.countries.includes(countryCode)) {
        return res.status(400).json({ message: 'شركة الشحن المختارة لا تخدم دولة التوصيل' });
      }
      // بنخزن اختيار العميل في shippingCompany (نفس الحقل اللي بيستخدمه
      // shippingController بعد إنشاء الشحنة فعليًا) عشان منعملش تعارض مع
      // shippingProviderId اللي معناه الحقيقي في الـSchema هو "رقم الشحنة
      // من شركة الشحن نفسها" بعد إنشائها (مش اختيار العميل قبل الطلب).
      orderData.shippingCompany = shippingProviderKey;
    }


    // ===== التحقق من طريقة الدفع =====
    // codEnabled يتحكم في الدفع عند الاستلام بشكل مستقل.
    // manualEnabled يتحكم في وسائل الدفع اليدوية (محافظ/إنستاباي) فقط.
    // Kashier له مفتاح مستقل ويحوّل العميل إلى صفحة الدفع المستضافة خارج الموقع.
    const paymentSettings = settings?.paymentSettings || { manualEnabled: true, codEnabled: true, kashierEnabled: false, paymobEnabled: false };
    const requestedPaymentMethod = String(orderData.paymentMethod || 'cod').toLowerCase();
    const paymentMethod = ['cod', 'wallet', 'kashier', 'paymob'].includes(requestedPaymentMethod) ? requestedPaymentMethod : 'cod';
    let walletPaymentData = null;

    // اختياري بالكامل: لو العميل اختار من موقعك وسيلة فرعية محددة جوه Kashier
    // أو Paymob (مثلاً "كارت" أو "محفظة")، بيوصل هنا كـ gatewaySubMethod.
    // لو مبعتش أو قيمة غير معروفة، بيتجاهل تمامًا وكل حاجة تشتغل زي القديم
    // (صفحة الدفع بتعرض كل الوسائل المتاحة على الحساب).
    const requestedSubMethod = String(orderData.gatewaySubMethod || '').trim().toLowerCase();
    const gatewaySubMethod = ['card', 'wallet'].includes(requestedSubMethod) ? requestedSubMethod : null;

    if (paymentMethod === 'cod' && paymentSettings.codEnabled === false) {
      return res.status(400).json({ message: 'الدفع عند الاستلام غير متاح حالياً' });
    }

    // ===== الدفع عند الاستلام (COD) + شركة الشحن =====
    // مش كل شركات الشحن بتدعم COD فعليًا عبر الـAPI (مثلاً DHL في المشروع
    // ده حاليًا مفيش لها تنفيذ COD موثّق - راجع services/shipping/
    // capabilities.js). لو سمحنا بطلب COD مع شركة زي دي، الشحنة هتتعمل
    // "مدفوعة مقدمًا" عند شركة الشحن من غير ما تعرف إنها المفروض تحصّل
    // فلوس من العميل - يعني نقص فعلي في الفلوس عند التسليم. فبنمنع
    // التوليفة دي من الأساس وقت إنشاء الطلب نفسه (مش بس وقت إنشاء الشحنة).
    if (paymentMethod === 'cod' && shippingProviderKey) {
      const providerCaps = getCapabilities(shippingProviderKey);
      if (providerCaps && providerCaps.supportsCOD !== true) {
        return res.status(400).json({ message: 'شركة الشحن المختارة لا تدعم الدفع عند الاستلام - برجاء اختيار وسيلة دفع أخرى أو شركة شحن مختلفة' });
      }
    }

    if (paymentMethod === 'wallet') {
      if (paymentSettings.manualEnabled !== true) {
        return res.status(400).json({ message: 'الدفع اليدوي غير متاح حالياً' });
      }
      
      const methods = settings?.paymentMethods || [];
      const chosenMethodId = orderData.walletPayment && orderData.walletPayment.methodId;
      const method = methods.find((m) => String(m._id) === String(chosenMethodId) && m.enabled);

      if (!method) {
        return res.status(400).json({ message: 'وسيلة الدفع المختارة غير متاحة' });
      }

      const senderPhone = (orderData.walletPayment && orderData.walletPayment.senderPhone) || '';
      const transferDate = (orderData.walletPayment && orderData.walletPayment.transferDate) || '';

      if (method.transferDetailsRequired && (!senderPhone.trim() || !transferDate.trim())) {
        return res.status(400).json({ message: 'من فضلك ادخل رقم التحويل وتاريخه' });
      }

      if (method.screenshotRequired && !req.file) {
        return res.status(400).json({ message: 'من فضلك ارفع صورة تأكيد التحويل' });
      }

      walletPaymentData = {
        methodId: String(method._id),
        methodName: (method.name && (method.name.ar || method.name.en)) || '',
        walletPhoneNumber: method.phoneNumber || '',
        senderPhone: senderPhone || null,
        transferDate: transferDate || null,
        screenshotUrl: null,
        screenshotPublicId: null,
        confirmed: false,
      };

      if (req.file) {
        const uploaded = await uploadImageToCloudinary(req.file.buffer, req.file.safeOriginalName || req.file.originalname, req.file.detectedMime || req.file.mimetype, { folder: 'payment-screenshots' });
        walletPaymentData.screenshotUrl = uploaded.url;
        walletPaymentData.screenshotPublicId = uploaded.publicId || null;
      }
    }

    if (paymentMethod === 'kashier') {
      if (paymentSettings.kashierEnabled !== true) {
        return res.status(400).json({ message: 'الدفع الإلكتروني عبر Kashier غير متاح حالياً' });
      }
      if (!isKashierConfigured()) {
        return res.status(503).json({ message: 'Kashier غير مُعد على السيرفر. أضف مفاتيح Kashier إلى .env أولاً.' });
      }
    }

    if (paymentMethod === 'paymob') {
      if (paymentSettings.paymobEnabled !== true) {
        return res.status(400).json({ message: 'الدفع الإلكتروني عبر Paymob غير متاح حالياً' });
      }
      if (!isPaymobConfigured()) {
        return res.status(503).json({ message: 'Paymob غير مُعد على السيرفر. أضف مفاتيح Paymob إلى .env أولاً.' });
      }
    }

    let expectedSubtotal = 0;
    const validatedItems = [];
    // ===== Pass 1: نجيب كل منتج ونتحقق من التوفر، بدون ما نصدّق isBundleItem/
    // bundleDiscount المرسلين من العميل لسه - ده مجرد "ادّعاء" هيتحقق منه في
    // validateBundleItems تحت، مقارنة بإعدادات bundle الحقيقية للمنتج نفسه =====
    const rawItems = [];
    const productsById = new Map();

    for (const item of orderData.items) {
      const parsedQuantity = Number(item.quantity);
      if (!item.productId || !item.variantId || !item.size || !isValidQuantity(parsedQuantity)) {
        return res.status(400).json({ message: 'بيانات أحد عناصر الطلب غير كاملة أو غير صحيحة' });
      }

      const product = await Product.findById(item.productId);
      if (!product || (product.visibility || 'published') !== 'published') {
        return res.status(400).json({ message: 'أحد المنتجات في الطلب غير متاح حالياً' });
      }

      const variant = (product.variants || []).find(v =>
        String(v._id) === String(item.variantId) ||
        (v.id != null && String(v.id) === String(item.variantId))
      );
      if (!variant) {
        return res.status(400).json({ message: 'الفاريانت المحدد غير موجود' });
      }

      const canonicalVariantId = variant._id ? String(variant._id) : (variant.id != null ? String(variant.id) : null);
      if (!canonicalVariantId) {
        return res.status(400).json({ message: 'الفاريانت المحدد غير صالح' });
      }

      const sizeEntry = (variant.sizeStock || []).find(s => s.size === item.size);
      if (!sizeEntry || sizeEntry.stock < Number(item.quantity)) {
        return res.status(400).json({ message: `الكمية المطلوبة من منتج ${product.name?.en || product.name?.ar || 'unknown'} غير متوفرة` });
      }

      const effectivePrice = calculateEffectiveProductPrice(product, settings);
      const basePrice = roundTwo(product.price);
      productsById.set(String(item.productId), product);

      rawItems.push({
        item,
        product,
        variant,
        canonicalVariantId,
        effectivePrice,
        basePrice,
        quantity: Number(item.quantity),
        isBundleItemClaim: !!item.isBundleItem,
        bundleDiscountClaim: Number(item.bundleDiscount || 0),
        sku: sizeEntry.sku || null,
      });
    }

    // ===== Pass 2: نتحقق فعليًا من ادّعاءات الـ bundle مقارنة بإعدادات
    // bundle.discountPercent + bundle.productIds الحقيقية المخزّنة على
    // المنتج "الأساسي" نفسه في قاعدة البيانات (شوف validateBundleItems) =====
    const bundleValidation = validateBundleItems(rawItems);

    for (let idx = 0; idx < rawItems.length; idx++) {
      const raw = rawItems[idx];
      const { isBundleItem, bundleDiscount } = bundleValidation[idx];

      let finalItemPrice;
      if (isBundleItem && bundleDiscount > 0) {
        finalItemPrice = roundTwo(raw.basePrice * (1 - bundleDiscount / 100));
      } else {
        finalItemPrice = raw.effectivePrice;
      }

      if (finalItemPrice < 0) {
        return res.status(400).json({ message: 'السعر المرسل غير صحيح، حاول مرة أخرى' });
      }

      const primaryImage = (raw.product.images && raw.product.images[0])
        ? (typeof raw.product.images[0] === 'string' ? raw.product.images[0] : (raw.product.images[0].url || ''))
        : '';

      const validatedItem = {
        productId: raw.item.productId,
        variantId: raw.canonicalVariantId,
        size: raw.item.size,
        price: finalItemPrice,
        originalPrice: raw.basePrice,
        quantity: raw.quantity,
        costPrice: Number(raw.product.costPrice || 0),
        name: raw.product.name || { ar: '', en: '' },
        productImage: primaryImage,
        sku: raw.sku,
        isBundleItem,
        bundleDiscount,
      };

      if (raw.variant.color) validatedItem.color = raw.variant.color;
      if (raw.variant.hex) validatedItem.colorHex = raw.variant.hex;

      validatedItems.push(validatedItem);
      expectedSubtotal += finalItemPrice * raw.quantity;
    }

    expectedSubtotal = roundTwo(expectedSubtotal);

    // ===== حساب سعر الشحن =====
    // لو العميل اختار شركة مفعلة: نحسب السعر من الـ carrier API على السيرفر
    // (Aramex/DHL). Bosta تستخدم السعر الذي حدده التاجر لأن Bosta لا تنشر
    // Rate Calculator API عامًا في توثيقها الحالي. لو لم يوجد تكامل فعلي،
    // نرجع للنظام القديم الخاص بالمحافظات.
    let shippingCost = computeShippingCost(settings, orderData.governorate, expectedSubtotal);
    if (shippingProviderKey && expectedSubtotal < (Number(settings?.freeShippingThreshold) || 1500)) {
      // بنعيد حساب السعر من نفس الـaggregator الحقيقي اللي بيستخدمه
      // /api/shipping/rates (services/shipping/index.js -> rates()) بدل
      // اختراع/استدعاء دالة getRate مكنتش موجودة. لو الشركة معندهاش Rate
      // API حقيقي (أو حصل خطأ اتصال)، منمنعش الطلب - بنرجع لسعر المحافظات
      // الافتراضي بدل ما نكسر الـCheckout بالكامل.
      try {
        const quoteOrder = {
          _id: 'checkout-quote',
          subtotal: expectedSubtotal,
          countryCode: String(orderData.shippingCountryCode || '').toUpperCase(),
          country: orderData.country,
          governorate: orderData.governorate || '',
          address: orderData.address || '',
          zipCode: orderData.zipCode || '',
          customerName: orderData.customerName || '',
          customerPhone: orderData.customerPhone || '',
          totalAmount: orderData.totalAmount,
          paymentMethod: requestedPaymentMethod,
        };
        const allRates = await getShippingRates(quoteOrder, {});
        const matched = allRates.find(r => r.provider === shippingProviderKey && Number.isFinite(Number(r.amount)));
        if (matched) shippingCost = roundTwo(matched.amount);
      } catch (rateErr) {
        console.error('Shipping rate recalculation failed:', rateErr.message);
      }
    }
    const submittedSubtotal = roundTwo(orderData.subtotal);
    const submittedTotal = roundTwo(orderData.totalAmount);

    // ===== التحقق من الخصومات =====
    let discount = 0;
    let discountType = 'none';
    let firstOrderDiscountApplied = false;
    let appliedDiscountCodeDoc = null;

    // ===== التحقق من كود الولاء (مرة واحدة فقط للعميل) =====
    let loyaltyCodeApplied = false;
    let usedLoyaltyCode = null;

    // ============================================================
    // ===== P1-3: حجز atomic لأي ميزة "استخدام لمرة واحدة" فور التحقق
    // من الأهلية مباشرة (مش بعد إنشاء الـ order بكذا سطر) =====
    // كل عنصر هنا بيبقى { release: async () => {...} } بيتنفذ لو الطلب فشل
    // بعد كده لأي سبب (مخزون غير كافي / فشل إنشاء الـ order نفسه) - عشان
    // الميزة ميتحسبش "متاستهلكت" من غير ما يتعمل order فعلي.
    // ============================================================
    const benefitReleasers = [];
    const rollbackReservedBenefits = async () => {
      for (const release of benefitReleasers) {
        try {
          await release();
        } catch (e) {
          console.error('rollbackReservedBenefits: release failed:', e.message);
        }
      }
    };

    if (req.user && orderData.discountType === 'loyalty_code' && orderData.discountCode) {
      const code = String(orderData.discountCode).trim().toUpperCase();
      // ===== ملحوظة مقصودة: Kashier/Paymob مش بتستهلك كود الولاء فعليًا
      // (نفس السلوك القديم قبل الإصلاح ده بالظبط - راجع قسم "تحديث نظام
      // الولاء" تحت اللي بيتجاهل الطلبات دي أساسًا) - فمفيش داعي نحجزها
      // atomically ليهم، بنكتفي بفحص أهلية عادي (read-only) زي ما كان قبل
      // كده تمامًا، عشان منغيرش سلوك تكامل الدفع ده (خارج نطاق P1-3). =====
      if (paymentMethod === 'cod' || paymentMethod === 'wallet') {
        const reservation = await reserveLoyaltyCode(req.user._id, code);
        if (reservation.ok) {
          const lp = settings?.loyaltyProgram;
          if (lp && lp.enabled) {
            const specificProductId = lp.specificProductId;
            const specificProductInOrder = specificProductId
              ? validatedItems.some(it => String(it.productId) === String(specificProductId))
              : true;

            if (specificProductInOrder) {
              if (lp.rewardType === 'percentage') {
                discount = roundTwo(expectedSubtotal * (Number(lp.rewardValue) / 100));
              } else if (lp.rewardType === 'fixed') {
                discount = roundTwo(Math.min(Number(lp.rewardValue), expectedSubtotal));
              }
              loyaltyCodeApplied = true;
              usedLoyaltyCode = code;
              discountType = 'loyalty_code';
              benefitReleasers.push(() => releaseLoyaltyCode(req.user._id, code));
            } else {
              // الكود اتحجز بس مالوش لازمة هنا (المنتج المطلوب مش موجود
              // بالطلب) - نرجعه فورًا عشان العميل يقدر يستخدمه في طلب صحيح.
              await releaseLoyaltyCode(req.user._id, code);
            }
          } else {
            await releaseLoyaltyCode(req.user._id, code);
          }
        }
        // reservation.ok === false يعني الكود مش موجود للعميل ده أو
        // مُستخدَم فعلاً - بنسيب discount = 0 زي السلوك القديم بالظبط.
      } else {
        const freshUser = await User.findById(req.user._id);
        if (freshUser) {
          const hasCode = (freshUser.loyaltyCodes || []).includes(code);
          const alreadyUsed = (freshUser.loyaltyCodesUsed || []).includes(code);
          if (hasCode && !alreadyUsed) {
            const lp = settings?.loyaltyProgram;
            if (lp && lp.enabled) {
              const specificProductId = lp.specificProductId;
              const specificProductInOrder = specificProductId
                ? validatedItems.some(it => String(it.productId) === String(specificProductId))
                : true;
              if (specificProductInOrder) {
                if (lp.rewardType === 'percentage') {
                  discount = roundTwo(expectedSubtotal * (Number(lp.rewardValue) / 100));
                } else if (lp.rewardType === 'fixed') {
                  discount = roundTwo(Math.min(Number(lp.rewardValue), expectedSubtotal));
                }
                loyaltyCodeApplied = true;
                usedLoyaltyCode = code;
                discountType = 'loyalty_code';
              }
            }
          }
        }
      }

    } else if (req.user && orderData.discountType === 'first_order') {
      // ===== atomic: الشرط (firstOrderDiscountUsed !== true) والتحديث في
      // نفس الـ query - يمنع تطبيق الخصم على طلبين متزامنين لنفس العميل =====
      const reservation = await reserveFirstOrderDiscount(req.user._id);
      if (reservation.ok) {
        const guestDiscount = settings?.promotions?.guestDiscount;
        const percentage = Number.isFinite(Number(guestDiscount?.percentage)) ? Number(guestDiscount.percentage) : 0;
        if (guestDiscount?.enabled && percentage > 0) {
          discount = roundTwo(expectedSubtotal * (percentage / 100));
          firstOrderDiscountApplied = true;
          discountType = 'first_order';
          benefitReleasers.push(() => releaseFirstOrderDiscount(req.user._id));
        } else {
          // اتحجز بس الإعداد مقفول/النسبة صفر - رجّع الحجز فورًا (مفيش خصم اتاخد).
          await releaseFirstOrderDiscount(req.user._id);
        }
      }
      // reservation.ok === false يعني العميل استخدم خصم أول طلب قبل كده
      // (أو طلب تاني سبقه في نفس اللحظة بالظبط) - discount بيفضل 0.

    } else if (orderData.discountType === 'code' && orderData.discountCode) {
      // ===== كود خصم عادي — بيتحسب من نسبة الكود المخزّنة في الإعدادات، مش من رقم العميل =====
      const code = String(orderData.discountCode).trim().toUpperCase();
      const codes = settings?.discountCodes || [];
      const foundCode = codes.find((c) => String(c?.code || '').trim().toUpperCase() === code && c?.isActive);

      if (foundCode) {
        const maxUses = Number(foundCode.maxUses) || 0;
        const productOk = !foundCode.specificProductId
          || validatedItems.some((it) => String(it.productId) === String(foundCode.specificProductId));

        if (productOk) {
          // ===== atomic: شرط usageCount < maxUses والزيادة (+1) في نفس
          // الـ query - يمنع طلبين/أكتر متزامنين من كسر حد الاستخدام =====
          const reservation = await reserveDiscountCodeUsage(code, maxUses);
          if (reservation.ok) {
            const percentage = Math.min(Math.max(Number(foundCode.discountPercent) || 0, 0), 100);
            discount = roundTwo(expectedSubtotal * (percentage / 100));
            discountType = 'code';
            appliedDiscountCodeDoc = foundCode;
            benefitReleasers.push(() => releaseDiscountCodeUsage(code));
          }
          // reservation.ok === false يعني حد الاستخدام اتخلص فعليًا (سواء
          // من زمان أو من طلب تاني حصل في نفس اللحظة بالظبط) - discount = 0.
        }
      }

    } else if (orderData.discountType === 'promotion') {
      // ===== عروض الحملات (Buy X Get Y / خصم كمية / نسبة / مبلغ ثابت) =====
      // P0 Fix #4: بيتحسب بالكامل من السيرفر دلوقتي (نفس منطق
      // calculateCartPromotions في الفرونت بالظبط - شوف utils/cartPromotions.js)
      // من بيانات المنتجات (offers) وإعدادات الحملات (settings.campaigns) الحقيقية
      // المخزّنة في قاعدة البيانات - رقم العميل (orderData.discount) متستخدمش خالص.
      const units = [];
      validatedItems.forEach((it) => {
        for (let i = 0; i < it.quantity; i++) {
          units.push({ productId: it.productId, price: it.price });
        }
      });
      const promoResult = calculateCartPromotions({
        units,
        productsById,
        campaigns: settings?.campaigns || [],
        categories: settings?.categories || [],
      });
      discount = roundTwo(promoResult.totalDiscount);
      discountType = 'promotion';
    }

    // ===== سقف أمان نهائي: الخصم مايتخطاش قيمة السلة أبداً تحت أي ظرف =====
    discount = Math.min(Math.max(roundTwo(discount), 0), expectedSubtotal);

    const expectedTotal = roundTwo(expectedSubtotal + shippingCost - discount);

    if (expectedTotal < 0) {
      await rollbackReservedBenefits();
      return res.status(400).json({ message: 'قيمة الطلب غير صحيحة' });
    }

    if (submittedTotal <= 0) {
      await rollbackReservedBenefits();
      return res.status(400).json({ message: 'قيمة الطلب غير متطابقة مع الأسعار الحالية' });
    }

    // ============================================================
    // ===== خصم المخزون Atomic قبل إنشاء الطلب (منع overselling) =====
    // كل عنصر بيتخصم بعملية atomic واحدة في MongoDB بشرط
    // (stock >= quantity) داخل نفس الـ update، مش قراءة ثم خصم لاحقًا.
    // لو أي عنصر فشل (مخزون غير كافي فعليًا وقت التنفيذ، حتى لو عدة طلبات
    // جت في نفس اللحظة بالظبط)، بيتم إرجاع أي عناصر سابقة اتخصمت في نفس
    // الطلب فورًا (rollback)، ولا يتم إنشاء order، ولا إرسال أي confirmation.
    // ============================================================
    const decrementResult = await decrementOrderItems(validatedItems);
    if (!decrementResult.ok) {
      const failedItem = decrementResult.failedItem;
      const failedName = validatedItems.find(
        (it) => it.productId === failedItem.productId && it.variantId === failedItem.variantId && it.size === failedItem.size
      );
      await rollbackReservedBenefits();
      return res.status(409).json({
        code: 'OUT_OF_STOCK',
        message: `الكمية المطلوبة من منتج ${failedName?.name?.ar || failedName?.name?.en || 'unknown'} غير متوفرة`,
      });
    }

    // ============================================================
    // ===== Phase 2: بناء shippingAddress المنظّم (عام لكل شركات الشحن) =====
    // بنبني الحقل الجديد دايمًا (حتى لو الفرونت لسه بيبعت الحقول القديمة
    // بس)، بالـfallback للحقول المسطّحة (customerName/customerPhone/
    // governorate/address/...) - عشان يبقى جاهز لـPhase 3 من غير ما نحتاج
    // أي migration على الطلبات الجديدة، ومن غير ما نغيّر أو نمسح أي حقل
    // قديم (الحقول القديمة بتتحفظ زي ما هي بالظبط من orderData نفسها).
    // ============================================================
    const normalizedShippingAddress = {
      fullName: incomingShippingAddress.fullName || orderData.customerName || null,
      phone: incomingShippingAddress.phone || orderData.customerPhone || null,
      phone2: incomingShippingAddress.phone2 || orderData.customerPhone2 || null,
      email: incomingShippingAddress.email || orderData.customerEmail || null,
      governorate: incomingShippingAddress.governorate || orderData.governorate || null,
      district: incomingShippingAddress.district || null,
      detailedAddress: incomingShippingAddress.detailedAddress || orderData.address || null,
      buildingNumber: incomingShippingAddress.buildingNumber || null,
      floor: incomingShippingAddress.floor || null,
      apartment: incomingShippingAddress.apartment || null,
      landmark: incomingShippingAddress.landmark || null,
      country: incomingShippingAddress.country || orderData.country || null,
      zipCode: incomingShippingAddress.zipCode || orderData.zipCode || null,
    };

    // ===== توليد رقم الأوردر المتسلسل قبل الإنشاء (1001، 1002...) =====
    const orderNumber = await getNextOrderNumber();

    let order;
    try {
      // Keep the existing checkout behavior, but recover safely if the
      // unique orderNumber counter is temporarily out of sync with old data.
      let nextOrderNumber = orderNumber;
      let createErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          order = await Order.create({
            ...orderData,
            orderNumber: nextOrderNumber,
            items: validatedItems,
            subtotal: expectedSubtotal,
            discount,
            shippingCost,
            totalAmount: expectedTotal,
            paymentMethod,
            walletPayment: walletPaymentData || undefined,
            shippingAddress: normalizedShippingAddress,
            usedLoyaltyCode: loyaltyCodeApplied ? usedLoyaltyCode : null,
          });
          createErr = null;
          break;
        } catch (err) {
          createErr = err;
          if (err?.code !== 11000 || attempt === 2) break;
          nextOrderNumber = await getNextOrderNumber();
        }
      }
      if (createErr) throw createErr;
    } catch (createErr) {
      await restoreOrderItems(validatedItems);
      try {
        await logMovementsBulk(validatedItems, 'stock_released', {
          note: 'rollback بسبب فشل إنشاء الطلب بعد خصم المخزون',
        });
      } catch (movementErr) {
        console.error('Failed to log stock rollback movement:', movementErr?.message);
      }
      await rollbackReservedBenefits();
      throw createErr;
    }

    // تسجيل حركة البيع مهم للتدقيق، لكنه لا يجب أن يحوّل طلبًا تم إنشاؤه
    // بنجاح إلى HTTP 500 لو سجل الحركة نفسه فشل مؤقتًا.
    try {
      await logMovementsBulk(validatedItems, 'stock_sold', {
        orderId: order._id,
        userId: req.user ? req.user._id : null,
      });
    } catch (movementErr) {
      console.error('Failed to log stock_sold movement:', { orderId: order._id, message: movementErr?.message });
    }

    // ===== P1-3: عداد استخدام كود الخصم اتزوّد فعلاً بشكل atomic وقت الحجز
    // (reserveDiscountCodeUsage) قبل ما الطلب يتعمل خالص - مفيش داعي لأي
    // تحديث تاني هنا. appliedDiscountCodeDoc لسه موجودة (بتتستخدم فوق في
    // حساب discount بس)، والحجز هو المصدر الوحيد للحقيقة دلوقتي. =====

    // ============================================================
    // ===== تأكيد الطلب (إيميل/واتساب) — معزول تمامًا عن مسار إنشاء الطلب =====
    // بدل ما نستدعي Brevo هنا ونستنى الرد منه (اتصال شبكة خارجي بطيء ممكن
    // يعلّق الـ HTTP request)، بنكتفي بعمل insert سريع في MarketingMessage
    // (عملية DB محلية خفيفة) والـ background worker (marketingWorker.js) هو
    // اللي فعليًا بيكلم Brevo لاحقًا. لو فشل الإرسال، الطلب يبقى اتعمل
    // بنجاح برضو، والـ worker بيعمل retry محدود، ولو استمر الفشل بتتحدث
    // حالة emailConfirmation.status لـ 'failed' من غير ما تأثر على الطلب.
    // الـ unique index على (kind, entityId, step, channel) في MarketingMessage
    // بيمنع تكرار جدولة نفس رسالة تأكيد الطلب أكتر من مرة (idempotency).
    // ============================================================
    try {
      const marketing = settings?.marketing;
      if (paymentMethod !== 'kashier' && paymentMethod !== 'paymob' && marketing?.enabled && marketing?.orderConfirmation) {
        const channel = marketing.orderConfirmationChannel === 'whatsapp' ? 'whatsapp' : 'email';
        const hasTarget = channel === 'email' ? !!order.customerEmail : !!order.customerPhone;

        if (hasTarget) {
          const MarketingMessage = require('../models/MarketingMessage');
          try {
            await MarketingMessage.create({
              kind: 'order_confirmation',
              channel,
              recipientEmail: channel === 'email' ? String(order.customerEmail).trim().toLowerCase() : undefined,
              recipientPhone: channel === 'whatsapp' ? String(order.customerPhone || '').replace(/\D/g, '') : undefined,
              subject: `تأكيد طلبك #${order.orderNumber ?? order._id}`,
              entityId: order._id.toString(),
              step: 0,
              scheduledAt: new Date(),
              status: 'pending',
            });
            order.emailConfirmation = { enabled: true, confirmed: false, confirmedAt: null, messageId: null, status: 'pending' };
          } catch (queueErr) {
            // E11000 = already queued لنفس الطلب/القناة (نادراً، لو حصل retry على نفس الـ request) — تجاهل بأمان.
            if (queueErr?.code !== 11000) throw queueErr;
          }
          await order.save();
        }
      }
    } catch (e) {
      // Never fail an otherwise valid order because queueing the confirmation message failed.
      console.error('Order confirmation queueing failed:', { message: e?.message, code: e?.code });
    }

    // المخزون اتخصم فعلاً (atomic) قبل إنشاء الطلب فوق — هنا بس نلغي الكاش
    invalidateProductCaches();
    require('../utils/cache').del('orders:all');

    // ===== P1-3: firstOrderDiscountUsed اتحطّت فعلاً بشكل atomic وقت
    // الحجز (reserveFirstOrderDiscount) قبل ما الطلب يتعمل خالص - مفيش
    // داعي لأي تحديث تاني هنا. =====

    // ===== Server-side conversion tracking: COD/manual orders are authoritative at creation time.
    // Online Kashier/Paymob orders are intentionally sent later from markPaid only.
    if (paymentMethod !== 'kashier' && paymentMethod !== 'paymob') {
      void sendPurchaseConversions(order, {
        sourceUrl: req.get('referer') || process.env.FRONTEND_URL || undefined,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    // ===== تحديث نظام الولاء (عداد الطلبات + مكافأة عند اكتمال العدد) =====
    // الطلب الإلكتروني عبر Kashier/Paymob لا يُحسب كطلب مكتمل قبل وصول
    // تأكيد الدفع (نفس السلوك القديم بالظبط - مفيش تغيير هنا).
    // ملحوظة P1-3: كود الولاء (loyaltyCodesUsed) اتحجز فعلاً بشكل atomic
    // فوق وقت التحقق من الأهلية مباشرة (مش هنا) للطلبات cod/wallet - هنا
    // بقي بس بيزوّد عداد الطلبات بشكل atomic ($inc) بدل قراءة القيمة
    // القديمة وحساب +1 يدويًا، اللي كان بيسبب "lost update" حقيقي لو
    // طلبين متزامنين لنفس العميل وصلوا هنا في نفس اللحظة.
    if (req.user && paymentMethod !== 'kashier' && paymentMethod !== 'paymob') {
      let newCount = null;
      try {
        newCount = await incrementLoyaltyOrderCount(req.user._id);
      } catch (loyaltyErr) {
        // Loyalty bookkeeping is secondary to checkout. Never turn a created
        // COD/wallet order into HTTP 500 because the counter update failed.
        console.error('Loyalty order-count update failed:', { orderId: order._id, message: loyaltyErr?.message });
      }

      // ===== FIX: root cause of "حدث خطأ" being shown to the customer for an
      // order that WAS actually created (and shows up fine in the admin panel).
      // Every other secondary side-effect in this function (stock movement log,
      // order-confirmation queueing, auto-shipment) is wrapped in its own
      // try/catch so a failure there can never turn an already-created order
      // into an HTTP 500 — this loyalty-reward block was the one exception.
      // If the loyalty program is enabled with a low ordersRequired (e.g. 1,
      // common right after setup/testing), this runs on every single order,
      // so any transient DB hiccup here (User.findById / User.updateOne)
      // used to propagate all the way to the outer catch at the bottom of
      // createOrder, which had already succeeded in saving the order and
      // decrementing stock. The customer saw a generic error and had no way
      // to know the order actually went through, so they'd retry — creating
      // a new duplicate order each time (this block runs again, same risk,
      // for every retry) while every previous attempt still sits in the
      // admin panel as a real order. =====
      try {
        if (newCount != null) {
          const lp = settings?.loyaltyProgram;
          if (lp && lp.enabled && lp.ordersRequired > 0) {
            const ordersRequired = Number(lp.ordersRequired);
            // بيستحق مكافأة كل ما يكمل العدد المطلوب (مثلاً كل 10 طلبات).
            // newCount دلوقتي جاي من $inc atomic حقيقي - كل طلب بياخد رقم
            // فريد ومضمون (مفيش طلبين ممكن ياخدوا نفس newCount)، فمفيش خطر
            // منح نفس "عتبة المكافأة" مرتين لطلبين مختلفين.
            if (newCount % ordersRequired === 0) {
              // ولّد كود جديد (احتمال التصادم مع كود عشوائي 8 خانات لعميل
              // تاني بيكمل العتبة في نفس اللحظة ضئيل جدًا - غير محسوس عمليًا)
              const currentUser = await User.findById(req.user._id).select('loyaltyCodes');
              let newCode;
              let attempts = 0;
              do {
                newCode = generateLoyaltyCode(lp.codePrefix || 'LOYALTY');
                attempts++;
              } while (
                (currentUser?.loyaltyCodes || []).includes(newCode) && attempts < 10
              );

              await User.updateOne({ _id: req.user._id }, { $addToSet: { loyaltyCodes: newCode } });

              // أرجع كود المكافأة مع الاستجابة
              return res.status(201).json({
                ...toCustomerOrderView(order),
                loyaltyReward: {
                  earned: true,
                  code: newCode,
                  rewardType: lp.rewardType,
                  rewardValue: lp.rewardValue,
                  specificProductId: lp.specificProductId || null,
                  title: lp.title,
                  message: lp.message,
                  orderCount: newCount,
                }
              });
            }
          }
        }
      } catch (loyaltyRewardErr) {
        // نفس مبدأ باقي الملف بالظبط: الأوردر خلاص اتحفظ ونزل من المخزون —
        // فشل توليد مكافأة الولاء لازم يتسجل في اللوج بس، من غير ما يحوّل
        // رد ناجح لأوردر حقيقي إلى HTTP 500 على العميل.
        console.error('Loyalty reward generation failed (order already created):', { orderId: order._id, message: loyaltyRewardErr?.message });
      }
    }

    if (paymentMethod === 'kashier') {
      try {
        // ===== نبعت رقم الأوردر المتسلسل (orderNumber: 1001، 1002...) لـKashier =====
        // مش الـ_id الطويل بتاع Mongo، عشان يبقى نفس الرقم اللي بيوصل لشركة
        // الشحن. paymentController.js بيدور بالرقم ده لما Kashier يرجّعه في
        // الـcallback/webhook (شوف findOrderByGatewayOrderId هناك).
        const paymentUrl = buildPaymentUrl({
          orderId: String(order.orderNumber),
          amount: order.totalAmount,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          allowedMethods: gatewaySubMethod ? [gatewaySubMethod] : undefined,
        });

        invalidateProductCaches();
        require('../utils/cache').del('orders:all');
        return res.status(201).json({
          ...toCustomerOrderView(order),
          paymentUrl,
          requiresPayment: true,
        });
      } catch (paymentErr) {
        console.error('Kashier checkout creation failed:', paymentErr);
        // The order already reserved stock. Release it because no payment session was created.
        try {
          await restoreOrderItems(order.items);
          await logMovementsBulk(order.items, 'stock_released', {
            orderId: order._id,
            note: 'rollback because Kashier checkout session could not be created',
          });
          order.stockRestored = true;
          order.stockRestoredAt = new Date();
          // ===== D) migrated to the centralized transition guard (pending->failed) =====
          applyPaymentStatusTransition(order, 'failed');
          await order.save();
          invalidateProductCaches();
        } catch (rollbackErr) {
          console.error('Kashier checkout rollback failed:', rollbackErr);
        }
        return res.status(502).json({ message: 'تعذر تجهيز صفحة الدفع عبر Kashier. لم يتم إتمام الدفع.' });
      }
    }

    if (paymentMethod === 'paymob') {
      try {
        // ===== نفس المبدأ مع Paymob: نبعت orderNumber مش الـ_id الطويل =====
        const { paymentUrl } = await createPaymobIntention({
          orderId: String(order.orderNumber),
          amount: order.totalAmount,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          address: order.address,
          governorate: order.governorate,
          country: order.country,
          preferredMethod: gatewaySubMethod || undefined,
        });

        invalidateProductCaches();
        require('../utils/cache').del('orders:all');
        return res.status(201).json({
          ...toCustomerOrderView(order),
          paymentUrl,
          requiresPayment: true,
        });
      } catch (paymentErr) {
        console.error('Paymob checkout creation failed:', paymentErr);
        // The order already reserved stock. Release it because no payment session was created.
        try {
          await restoreOrderItems(order.items);
          await logMovementsBulk(order.items, 'stock_released', {
            orderId: order._id,
            note: 'rollback because Paymob checkout session could not be created',
          });
          order.stockRestored = true;
          order.stockRestoredAt = new Date();
          // ===== D) migrated to the centralized transition guard (pending->failed) =====
          applyPaymentStatusTransition(order, 'failed');
          await order.save();
          invalidateProductCaches();
        } catch (rollbackErr) {
          console.error('Paymob checkout rollback failed:', rollbackErr);
        }
        return res.status(502).json({ message: 'تعذر تجهيز صفحة الدفع عبر Paymob. لم يتم إتمام الدفع.' });
      }
    }

    // ============================================================
    // ===== إرسال تلقائي لشركة الشحن فور تأكيد الطلب (COD / تحويل يدوي) =====
    // بيحصل بعد ما الطلب اتأكد فعليًا (مش لطلبات Kashier/Paymob لسه مستنية
    // الدفع - دي بترجع فوق قبل ما توصل هنا). لو فشل الإرسال (شركة الشحن مش
    // مفعّلة، بيانات ناقصة، مشكلة اتصال...) الطلب يفضل موجود بنجاح برضو،
    // وبنسجل الخطأ في shippingError عشان الأدمن يقدر يعمل Retry يدوي من
    // لوحة الشحن (زرار "إرسال لشركة الشحن").
    // ============================================================
    if (order.shippingCompany) {
      try {
        const shipResult = await createShipmentForOrder(order, settings?.shippingIntegrations || {});
        if (shipResult.ok) {
          order.trackingNumber = shipResult.result.trackingNumber || shipResult.result.shipmentId || null;
          order.shippingProviderId = shipResult.result.shipmentId || shipResult.result.trackingNumber || null;
          order.shippingLabelUrl = shipResult.result.labelUrl || null;
          order.shippingStatus = 'shipped';
          order.shippingError = null;
          order.shippingErrorCode = null;
          order.shippedAt = new Date();
          order.shippingCreatedAt = new Date();
        } else {
          // ملحوظة (بند 7 في طلب Phase 3): لو الكود BOSTA_SUBSCRIPTION_REQUIRED،
          // ده مش bug في الكود - حساب بوسطة نفسه محتاج Active Bundle
          // Subscription. الطلب نفسه بيفضل موجود بنجاح زي أي فشل شحن تاني،
          // والأدمن يقدر يعمل Retry بعد ما يفعّل الحساب من عند بوسطة.
          order.shippingStatus = 'failed';
          order.shippingError = shipResult.message;
          order.shippingErrorCode = shipResult.code || null;
        }
        order.shippingUpdatedAt = new Date();
        await order.save();
      } catch (autoShipErr) {
        // لازم الطلب يفضل موجود حتى لو فشل الإرسال التلقائي لأي سبب غير متوقع
        console.error('Auto shipment creation failed:', autoShipErr);
        try {
          order.shippingStatus = 'failed';
          // P1-6: الرسالة دي بترجع للعميل في رد إنشاء الطلب (order كامل) -
          // منخليهاش تحتوي تفاصيل خطأ داخلي خام (DB/stack/إلخ).
          order.shippingError = (autoShipErr && autoShipErr.data !== undefined)
            ? `فشل الاتصال بشركة الشحن (HTTP ${autoShipErr.status || 'error'})`
            : 'فشل إنشاء الشحنة تلقائيًا';
          order.shippingUpdatedAt = new Date();
          await order.save();
        } catch (saveErr) {
          console.error('Failed to save shippingError after auto-ship failure:', saveErr);
        }
      }
    }

    // ===== حماية بيانات العميل: نرجّع projection آمنة بدل مستند الـOrder
    // الكامل (كان بيسرّب items[].costPrice, paymentGateway, إلخ للعميل/
    // الضيف اللي بينشئ الطلب - شوف utils/customerOrderView.js) =====
    res.status(201).json(toCustomerOrderView(order));
  } catch (err) {
    console.error('Error creating order:', err);
    if (uploadedScreenshot) {
      await deleteImageFromCloudinary(uploadedScreenshot);
    }
    if (err?.code === 'CLOUDINARY_UPLOAD_FAILED') {
      return res.status(err.statusCode || 502).json({
        message: 'تعذر رفع صورة الدفع إلى التخزين. لم يتم إنشاء الطلب.',
      });
    }
    return res.status(500).json({ message: 'حصل خطأ في إنشاء الطلب' });
  }
};

// يبني فلتر Mongo من query params الاختيارية — فلترة server-side بالكامل
// (بدل ما الفرونت يحمّل كل الطلبات ويفلتر في المتصفح).
const buildOrderFilter = (query = {}) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.shippingStatus) filter.shippingStatus = query.shippingStatus;
  if (query.customerPhone) filter.customerPhone = String(query.customerPhone).trim();
  if (query.customerEmail) filter.customerEmail = String(query.customerEmail).trim().toLowerCase();
  if (query.trackingNumber) filter.trackingNumber = String(query.trackingNumber).trim();

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
  }

  if (query.search) {
    const term = String(query.search).trim();
    if (term) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ customerName: regex }, { customerPhone: regex }, { customerEmail: regex }];
    }
  }

  return filter;
};

// يجيب بيانات المنتجات المرتبطة بعناصر مجموعة orders بعملية واحدة (bulk fetch
// بـ $in) بدل عمل Product.findById لكل عنصر في كل order على حدة (N+1 قديم).
const enrichOrdersWithProductData = async (orders) => {
  const productIds = new Set();
  for (const order of orders) {
    for (const item of order.items || []) {
      if (item.productId) productIds.add(String(item.productId));
    }
  }

  if (productIds.size === 0) return orders;

  const products = await Product.find({ _id: { $in: Array.from(productIds) } }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  return orders.map((order) => {
    const enrichedItems = (order.items || []).map((item) => {
      const product = productMap.get(String(item.productId));
      if (!product) return item;

      const variant = (product.variants || []).find((v) =>
        String(v._id) === String(item.variantId) ||
        String(v._id) === String(item.variantId?.toString?.() || item.variantId)
      );

      const productName = item.name && (item.name.ar || item.name.en) ? item.name : (product.name || {});
      const productImage = item.productImage || (product.images && product.images[0]
        ? (typeof product.images[0] === 'string' ? product.images[0] : (product.images[0].url || ''))
        : '');
      const colorInfo = item.color || (variant ? variant.color : null);
      const colorHex = item.colorHex || (variant ? variant.hex : null);

      return {
        ...item,
        productName,
        images: productImage ? [productImage] : (product.images || []),
        color: colorInfo,
        colorHex,
        size: item.size,
        isBundleItem: item.isBundleItem || false,
        bundleDiscount: item.bundleDiscount || 0,
        originalPrice: item.originalPrice || item.price,
      };
    });

    return { ...order, items: enrichedItems };
  });
};

// GET /api/orders  (أدمن / كول سنتر / باكر بس)
const getOrders = async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 500, defaultLimit: 50 });
    const filter = buildOrderFilter(req.query);
    const hasFilters = Object.keys(filter).length > 0;

    // المسار السريع القديم (بدون فلاتر/pagination صريحة): كاش زي ما كان
    if (!isPaginated && !hasFilters) {
      const cacheKey = 'orders:all';
      const cached = get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const orders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(5000) // سقف أمان أعلى من القديم (كان 1000) - تقليل احتمال تقصير
        // البيانات لمتاجر كبيرة على المسار الاحتياطي القديم، مع الإبقاء على
        // سقف أمان يمنع تحميل غير محدود في الذاكرة/الريسبونس.
        .populate('customerId', 'name email phone')
        .lean();

      const enriched = await enrichOrdersWithProductData(orders);

      set(cacheKey, enriched, 30);
      return res.json(enriched);
    }

    // مسار الفلترة/الـ pagination الحقيقية
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name email phone')
        .lean(),
      Order.countDocuments(filter),
    ]);

    const enriched = await enrichOrdersWithProductData(orders);
    res.json(buildListResponse({ isPaginated: true, page, limit, items: enriched, total }));
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب الطلبات'});
  }
};

// ============================================================================
// GET /api/orders/revenue-stats  (أدمن - تبويب لوحة البيانات بس)
// ----------------------------------------------------------------------------
// ليه الإندبوينت ده اتضاف: لوحة البيانات كانت بتحسب "إجمالي الإيرادات" في
// الفرونت عن طريق تحميل كل الطلبات (بحد أقصى 1000 - سقف أمان قديم) وعمل
// reduce عليها في المتصفح. ده فيه مشكلتين:
//  1) أي متجر عنده أكتر من 1000 أوردر، رقم الإيرادات كان بيبقى غلط لأن
//     الطلبات اللي بعد الـ 1000 مكنتش بتتحمل أصلاً (باگ حقيقي).
//  2) الحساب نفسه بيتكرر في المتصفح في كل فتح للوحة بدل ما ياخد الرقم
//     جاهز من الداتا بيز.
// الحل هنا: aggregation pipeline في MongoDB بيحسب الإيراد على *كل* الطلبات
// في النطاق الزمني المطلوب من غير أي سقف، وبيرجع كمان رقم الفترة السابقة
// للمقارنة (trend) - بنفس المعادلة اللي كانت في الفرونت بالظبط:
//   الإيراد = totalAmount + exchangeExtraCollected - refundedAmount
// (على كل الطلبات في النطاق بغض النظر عن حالتها، زي ما كان في الفرونت).
// ============================================================================
const getRevenuePeriodRange = (period, customFrom, customTo) => {
  const now = new Date();
  let rangeStart = null;
  const rangeEnd = new Date(now);
  rangeEnd.setHours(23, 59, 59, 999);

  if (period === '7days') {
    rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 6); rangeStart.setHours(0, 0, 0, 0);
  } else if (period === '14days') {
    rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 13); rangeStart.setHours(0, 0, 0, 0);
  } else if (period === '30days') {
    rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 29); rangeStart.setHours(0, 0, 0, 0);
  } else if (period === '90days') {
    rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 89); rangeStart.setHours(0, 0, 0, 0);
  } else if (period === 'monthly') {
    rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1); rangeStart.setHours(0, 0, 0, 0);
  } else if (period === 'yearly') {
    rangeStart = new Date(now.getFullYear() - 3, 0, 1); rangeStart.setHours(0, 0, 0, 0);
  } else if (period === 'custom') {
    let end = rangeEnd;
    if (customFrom) { rangeStart = new Date(customFrom); rangeStart.setHours(0, 0, 0, 0); }
    if (customTo) { end = new Date(customTo); end.setHours(23, 59, 59, 999); }
    return { rangeStart, rangeEnd: end };
  }
  return { rangeStart, rangeEnd };
};

// بيحسب مجموع الإيراد (كل الطلبات) + المبيعات المكتملة (المتسلمة بس) + عدد
// الطلبات لأي نطاق تاريخ، من غير أي سقف على العدد. "المتسلمة" هنا بنفس
// تعريف الفرونت بالظبط: status = 'تم التسليم'/'Delivered' أو shippingStatus
// = 'delivered'.
const aggregateRevenueForRange = async (rangeStart, rangeEnd) => {
  const match = {};
  if (rangeStart) {
    match.createdAt = { $gte: rangeStart, $lte: rangeEnd };
  } else {
    match.createdAt = { $lte: rangeEnd };
  }
  const isDeliveredExpr = {
    $or: [
      { $eq: ['$status', 'تم التسليم'] },
      { $eq: ['$status', 'Delivered'] },
      { $eq: ['$shippingStatus', 'delivered'] },
    ],
  };
  const revenueExpr = { $add: [{ $ifNull: ['$totalAmount', 0] }, { $ifNull: ['$exchangeExtraCollected', 0] }, { $multiply: [{ $ifNull: ['$refundedAmount', 0] }, -1] }] };
  // ===== نفس تعريف الفرونت بالظبط لـ"طلبات اترجع شحنها بعد التسليم/الشحن":
  // status ضمن (مرتجع/Returned/ملغي/Cancelled) وشحن اتحرك فعلاً (shippingStatus
  // موجود ومش 'pending'). =====
  const isShippedBackExpr = {
    $and: [
      { $in: ['$status', ['مرتجع', 'Returned', 'ملغي', 'Cancelled']] },
      { $ne: ['$shippingStatus', null] },
      { $ne: ['$shippingStatus', 'pending'] },
    ],
  };
  // returnShippingCost الفعلي لو متسجل، وإلا تقريب ضعف تكلفة الشحن الأصلية
  // (ذهاب + رجوع) - بنفس منطق الفرونت بالظبط.
  const returnShippingCostExpr = {
    $cond: [
      { $ne: ['$returnShippingCost', null] },
      '$returnShippingCost',
      { $multiply: [{ $ifNull: ['$shippingCost', 0] }, 2] },
    ],
  };
  // ==========================================================================
  // تكلفة المنتجات (totalCost) - نفس منطق الفرونت بالظبط
  // (getItemUnitCost + getOrderRefundRatio + getItemKeepRatio في AdminPanel.jsx)
  // بس محسوب هنا كـ aggregation جوه نفس الاستعلام (facet منفصل) بدل ما يتحسب
  // بـ JS loop على كل الطلبات (اللي كان بيرجعنا لمشكلة سقف الـ 1000 أوردر
  // القديمة تاني). الحساب بيتم بس على الطلبات "المتسلمة" زي الفرونت
  // (deliveredFiltered) - نفس isDeliveredExpr المستخدم فوق بالظبط.
  //
  // خطوات المطابقة مع الفرونت:
  //  - $lookup على كوليكشن products بـ items.productId عشان نجيب costPrice
  //    الحالي للمنتج، ده الـ fallback بالظبط زي ما getItemUnitCost بيعمل لو
  //    مفيش costPrice متسجل (snapshot) على عنصر الطلب نفسه.
  //  - لكل عنصر في items: unitCost = snapshotCost (لو > 0) وإلا costPrice
  //    الحالي للمنتج (لو اتلاقى) وإلا صفر.
  //  - qty = item.quantity، ولو صفر/مفقودة يبقى 1 (زي (item.quantity || 1)).
  //  - keepRatio: لو فيه returnItems وحالة returnRequestStatus = 'approved'،
  //    بنطرح الكمية المرتجعة لنفس المنتج (matching على productId + variantId
  //    + size زي الكود بالظبط، مع معاملة null/undefined كـ '' زي String(x||'')
  //    في الفرونت) من الكمية الأصلية. غير كده، keepRatio = 1 - نسبة استرداد
  //    الطلب كله (refundedAmount / totalAmount، بحد أقصى 1).
  //  - تكلفة العنصر = unitCost * qty * keepRatio، وتكلفة الأوردر = مجموع
  //    تكلفة كل عناصره، والمجموع الكلي = مجموع تكلفة كل الطلبات المتسلمة.
  // ==========================================================================
  const itemUnitCostExpr = {
    $cond: [
      { $gt: [{ $ifNull: ['$$this.costPrice', 0] }, 0] },
      { $ifNull: ['$$this.costPrice', 0] },
      {
        $ifNull: [
          {
            $let: {
              vars: {
                matchedProduct: {
                  $arrayElemAt: [
                    { $filter: { input: '$productDocs', as: 'p', cond: { $eq: ['$$p._id', '$$this.productId'] } } },
                    0,
                  ],
                },
              },
              in: '$$matchedProduct.costPrice',
            },
          },
          0,
        ],
      },
    ],
  };
  const totalCostExpr = {
    $reduce: {
      input: '$items',
      initialValue: 0,
      in: {
        // ===== المستوى 1: نلقط بيانات العنصر الحالي ($$this) في متغيرات
        // ثابتة، لأن $$this هتتغيّر جوه الـ $reduce الداخلي بتاع returnItems
        // تحت (كل $reduce بيستخدم نفس اسم $$this لعنصر الـ input بتاعه). =====
        $let: {
          vars: {
            itemProductId: '$$this.productId',
            itemVariantId: { $ifNull: ['$$this.variantId', ''] },
            itemSize: { $ifNull: ['$$this.size', ''] },
            unitCost: itemUnitCostExpr,
            qty: {
              $cond: [
                { $eq: [{ $ifNull: ['$$this.quantity', 0] }, 0] },
                1,
                '$$this.quantity',
              ],
            },
            refundRatio: {
              $let: {
                vars: {
                  refundedAmt: { $ifNull: ['$$ROOT.refundedAmount', 0] },
                  totalAmt: { $ifNull: ['$$ROOT.totalAmount', 0] },
                },
                in: {
                  $cond: [
                    { $or: [{ $lte: ['$$refundedAmt', 0] }, { $lte: ['$$totalAmt', 0] }] },
                    0,
                    { $min: [1, { $divide: ['$$refundedAmt', '$$totalAmt'] }] },
                  ],
                },
              },
            },
            hasApprovedReturn: {
              $and: [
                { $gt: [{ $size: { $ifNull: ['$$ROOT.returnItems', []] } }, 0] },
                { $eq: ['$$ROOT.returnRequestStatus', 'approved'] },
              ],
            },
          },
          // ===== المستوى 2: الكمية المرتجعة لنفس العنصر (productId+variantId
          // +size) من returnItems - بيستخدم المتغيرات اللي اتلقطت فوق، مش
          // $$this تاني، عشان $$this هنا بقت بتشاور على عنصر returnItems. =====
          in: {
            $let: {
              vars: {
                returnedQty: {
                  $reduce: {
                    input: { $ifNull: ['$$ROOT.returnItems', []] },
                    initialValue: 0,
                    in: {
                      $add: [
                        '$$value',
                        {
                          $cond: [
                            {
                              $and: [
                                { $eq: ['$$this.productId', '$$itemProductId'] },
                                { $eq: [{ $ifNull: ['$$this.variantId', ''] }, '$$itemVariantId'] },
                                { $eq: [{ $ifNull: ['$$this.size', ''] }, '$$itemSize'] },
                              ],
                            },
                            { $ifNull: ['$$this.quantity', 0] },
                            0,
                          ],
                        },
                      ],
                    },
                  },
                },
              },
              // ===== المستوى 3: keepRatio النهائي، وضمه لمجموع تكلفة الأوردر =====
              in: {
                $let: {
                  vars: {
                    keepRatio: {
                      $cond: [
                        '$$hasApprovedReturn',
                        { $divide: [{ $max: [0, { $subtract: ['$$qty', '$$returnedQty'] }] }, '$$qty'] },
                        { $subtract: [1, '$$refundRatio'] },
                      ],
                    },
                  },
                  in: { $add: ['$$value', { $multiply: ['$$unitCost', '$$qty', '$$keepRatio'] }] },
                },
              },
            },
          },
        },
      },
    },
  };
  const [result] = await Order.aggregate([
    { $match: match },
    {
      $facet: {
        // الفاسيت الأصلي (إيرادات/مبيعات/شحن) - متلمسناهوش خالص.
        revenueStats: [
          {
            $group: {
              _id: null,
              totalAllRevenue: { $sum: revenueExpr },
              totalSales: { $sum: { $cond: [isDeliveredExpr, revenueExpr, 0] } },
              totalShippingCost: { $sum: { $cond: [isDeliveredExpr, { $ifNull: ['$shippingCost', 0] }, 0] } },
              returnShippingCost: { $sum: { $cond: [isShippedBackExpr, returnShippingCostExpr, 0] } },
              ordersCount: { $sum: 1 },
            },
          },
        ],
        // فاسيت منفصل لتكلفة المنتجات (طلبات متسلمة بس - راجع الشرح فوق).
        // ===== تصحيح: isDeliveredExpr عبارة عن aggregation expression (فيها
        // $eq بصيغة المصفوفة)، ولازم تتلف بـ $expr عشان تبقى صالحة جوه stage
        // $match (من غيرها MongoDB بيرفض الـ query دي بالكامل وقت التنفيذ). =====
        costStats: [
          { $match: { $expr: isDeliveredExpr } },
          { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'productDocs' } },
          { $addFields: { __orderCost: totalCostExpr } },
          { $group: { _id: null, totalCost: { $sum: '$__orderCost' } } },
        ],
      },
    },
  ]);
  const revenueResult = result?.revenueStats?.[0];
  const costResult = result?.costStats?.[0];
  return {
    totalAllRevenue: revenueResult?.totalAllRevenue || 0,
    totalSales: revenueResult?.totalSales || 0,
    totalShippingCost: revenueResult?.totalShippingCost || 0,
    returnShippingCost: revenueResult?.returnShippingCost || 0,
    ordersCount: revenueResult?.ordersCount || 0,
    totalCost: costResult?.totalCost || 0,
  };
};

const getRevenueStats = async (req, res) => {
  try {
    const period = String(req.query.period || '30days');
    const customFrom = req.query.from || null;
    const customTo = req.query.to || null;

    const { rangeStart, rangeEnd } = getRevenuePeriodRange(period, customFrom, customTo);

    // الفترة السابقة (لنفس طول الفترة الحالية بالظبط) لحساب نسبة التغيّر
    let prevStart = null;
    let prevEnd = null;
    if (rangeStart) {
      const span = rangeEnd.getTime() - rangeStart.getTime();
      prevEnd = new Date(rangeStart.getTime() - 1);
      prevStart = new Date(rangeStart.getTime() - span);
    }

    const [current, previous] = await Promise.all([
      aggregateRevenueForRange(rangeStart, rangeEnd),
      prevStart ? aggregateRevenueForRange(prevStart, prevEnd) : Promise.resolve({ totalAllRevenue: 0, totalSales: 0, totalShippingCost: 0, returnShippingCost: 0, ordersCount: 0, totalCost: 0 }),
    ]);

    const avgOrderValue = current.ordersCount > 0 ? Math.round(current.totalAllRevenue / current.ordersCount) : 0;

    res.json({
      period,
      rangeStart: rangeStart ? rangeStart.toISOString() : null,
      rangeEnd: rangeEnd.toISOString(),
      totalAllRevenue: current.totalAllRevenue,
      totalSales: current.totalSales,
      totalShippingCost: current.totalShippingCost,
      returnShippingCost: current.returnShippingCost,
      ordersCount: current.ordersCount,
      avgOrderValue,
      totalCost: current.totalCost,
      prevRevenue: previous.totalAllRevenue,
      prevSales: previous.totalSales,
      prevOrdersCount: previous.ordersCount,
      prevCost: previous.totalCost,
    });
  } catch (err) {
    console.error('Error computing revenue stats:', err);
    res.status(500).json({ message: 'حصل خطأ في حساب الإيرادات' });
  }
};

// ============================================================================
// GET /api/orders/revenue-breakdown  (أدمن - تبويب لوحة البيانات بس)
// ----------------------------------------------------------------------------
// نفس فكرة /revenue-stats بالظبط (aggregation في MongoDB بدل تحميل كل الطلبات
// للفرونت وعمل reduce عليها) بس هنا التفصيل بدل الإجمالي: توزيع الإيراد حسب
// المحافظة (زي govMap في AdminPanel.jsx)، وربح/تكلفة كل منتج (زي
// productProfitMap في نفس الملف). نفس query params بتاعة revenue-stats
// (period/from/to) ونفس getRevenuePeriodRange.
// ============================================================================
const getRevenueBreakdown = async (req, res) => {
  try {
    const period = String(req.query.period || '30days');
    const customFrom = req.query.from || null;
    const customTo = req.query.to || null;

    const { rangeStart, rangeEnd } = getRevenuePeriodRange(period, customFrom, customTo);

    const match = {};
    if (rangeStart) {
      match.createdAt = { $gte: rangeStart, $lte: rangeEnd };
    } else {
      match.createdAt = { $lte: rangeEnd };
    }

    // نفس isDeliveredExpr المستخدمة في aggregateRevenueForRange بالظبط (نسخة
    // مستقلة هنا لأن الدالتين منفصلتين، بس نفس التعريف حرفيًا).
    const isDeliveredExpr = {
      $or: [
        { $eq: ['$status', 'تم التسليم'] },
        { $eq: ['$status', 'Delivered'] },
        { $eq: ['$shippingStatus', 'delivered'] },
      ],
    };
    const revenueExpr = { $add: [{ $ifNull: ['$totalAmount', 0] }, { $ifNull: ['$exchangeExtraCollected', 0] }, { $multiply: [{ $ifNull: ['$refundedAmount', 0] }, -1] }] };

    // ==========================================================================
    // 1) توزيع الإيراد حسب المحافظة - مطابق لـ govMap في AdminPanel.jsx بالظبط:
    //    - الحقل المستخدم فعليًا هو o.governorate (الحقل القديم المباشر على
    //      الأوردر)، مش o.shippingAddress.governorate (ده حقل تاني مضاف لاحقًا
    //      لشركات الشحن، والفرونت مبيقراش منه في الحساب ده - راجع السطر
    //      "const gov = (o.governorate || '').trim();" في govMap).
    //    - على *كل* الطلبات في النطاق (زي totalAllRevenue، مش على المتسلمة بس).
    //    - الطلبات اللي مفيهاش محافظة (فاضية بعد trim) بتتجاهل تمامًا زي
    //      "if (!gov) return;" في الفرونت.
    //    أول $match هنا على createdAt بس عشان يستخدم index({createdAt:-1})
    //    الموجود في Order.js، وأي فلترة تانية (فراغ المحافظة) بعده.
    // ==========================================================================
    const byGovernoratePromise = Order.aggregate([
      { $match: match },
      {
        $addFields: {
          __gov: { $trim: { input: { $ifNull: ['$governorate', ''] } } },
        },
      },
      { $match: { __gov: { $ne: '' } } },
      {
        $group: {
          _id: '$__gov',
          revenue: { $sum: revenueExpr },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $project: {
          _id: 0,
          governorate: '$_id',
          revenue: 1,
          ordersCount: 1,
        },
      },
    ]);

    // ==========================================================================
    // 2) ربح/تكلفة/إيراد كل منتج - مطابق لـ productProfitMap في AdminPanel.jsx
    //    بالظبط: طلبات متسلمة بس (deliveredFiltered)، ونفس منطق
    //    getItemUnitCost/getItemKeepRatio المستخدم في totalCost فوق (نفس
    //    الـ snapshot cost / fallback لـ costPrice الحالي للمنتج، ونفس
    //    مطابقة returnItems بـ productId+variantId+size). الفرق الوحيد عن
    //    totalCost إننا هنا بنعمل $unwind على items بدل $reduce، عشان
    //    التجميع (group) يبقى لكل منتج لوحده مش لكل أوردر.
    //    $match الأول على createdAt (index)، وبعده isDeliveredExpr في نفس
    //    الـ $match object (عشان الـ range يفضل قابل لاستخدام index حتى مع
    //    وجود $expr)، وده قبل الـ $unwind عشان نقلل عدد الـ items اللي
    //    هتتفكك من الأول.
    // ==========================================================================
    const byProductPromise = Order.aggregate([
      { $match: { ...match, $expr: isDeliveredExpr } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'itemProductDoc',
        },
      },
      {
        // unitCost + qty لكل عنصر - نفس getItemUnitCost بالظبط.
        $addFields: {
          __unitCost: {
            $let: {
              vars: {
                snapshotCost: { $ifNull: ['$items.costPrice', 0] },
                matchedProduct: { $arrayElemAt: ['$itemProductDoc', 0] },
              },
              in: {
                $cond: [
                  { $gt: ['$$snapshotCost', 0] },
                  '$$snapshotCost',
                  { $ifNull: ['$$matchedProduct.costPrice', 0] },
                ],
              },
            },
          },
          __qty: {
            $cond: [
              { $eq: [{ $ifNull: ['$items.quantity', 0] }, 0] },
              1,
              '$items.quantity',
            ],
          },
        },
      },
      {
        // الكمية المرتجعة لنفس العنصر (productId+variantId+size) + نسبة
        // استرداد الطلب كله - نفس getItemKeepRatio بالظبط.
        $addFields: {
          __returnedQty: {
            $reduce: {
              input: { $ifNull: ['$returnItems', []] },
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$$this.productId', '$items.productId'] },
                          { $eq: [{ $ifNull: ['$$this.variantId', ''] }, { $ifNull: ['$items.variantId', ''] }] },
                          { $eq: [{ $ifNull: ['$$this.size', ''] }, { $ifNull: ['$items.size', ''] }] },
                        ],
                      },
                      { $ifNull: ['$$this.quantity', 0] },
                      0,
                    ],
                  },
                ],
              },
            },
          },
          __refundRatio: {
            $let: {
              vars: {
                refundedAmt: { $ifNull: ['$refundedAmount', 0] },
                totalAmt: { $ifNull: ['$totalAmount', 0] },
              },
              in: {
                $cond: [
                  { $or: [{ $lte: ['$$refundedAmt', 0] }, { $lte: ['$$totalAmt', 0] }] },
                  0,
                  { $min: [1, { $divide: ['$$refundedAmt', '$$totalAmt'] }] },
                ],
              },
            },
          },
          __hasApprovedReturn: {
            $and: [
              { $gt: [{ $size: { $ifNull: ['$returnItems', []] } }, 0] },
              { $eq: ['$returnRequestStatus', 'approved'] },
            ],
          },
        },
      },
      {
        $addFields: {
          __keepRatio: {
            $cond: [
              '$__hasApprovedReturn',
              { $divide: [{ $max: [0, { $subtract: ['$__qty', '$__returnedQty'] }] }, '$__qty'] },
              { $subtract: [1, '$__refundRatio'] },
            ],
          },
        },
      },
      {
        // إيراد وتكلفة العنصر - نفس (item.price||0)*qty*keepRatio و
        // getItemUnitCost(item)*qty*keepRatio بالظبط.
        $addFields: {
          __itemRevenue: { $multiply: [{ $ifNull: ['$items.price', 0] }, '$__qty', '$__keepRatio'] },
          __itemCost: { $multiply: ['$__unitCost', '$__qty', '$__keepRatio'] },
        },
      },
      {
        $group: {
          _id: '$items.productId',
          qty: { $sum: '$__qty' },
          revenue: { $sum: '$__itemRevenue' },
          cost: { $sum: '$__itemCost' },
          // اسم المنتج زي ما اتسجل وقت البيع (snapshot) - fallback لو
          // المنتج اتمسح من كوليكشن products وقت ما نجيب اسمه الحالي تحت.
          itemNameSnapshot: { $first: '$items.name' },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      {
        $addFields: {
          // بنفضّل الاسم الحالي للمنتج (لو لسه موجود) على الـ snapshot، زي
          // ما الفرونت بيعمل (products.find(...) أولاً وبعدين "منتج محذوف").
          name: { $ifNull: [{ $arrayElemAt: ['$productDoc.name', 0] }, '$itemNameSnapshot'] },
          profit: { $subtract: ['$revenue', '$cost'] },
        },
      },
      {
        $addFields: {
          margin: {
            $cond: [
              { $gt: ['$revenue', 0] },
              { $multiply: [{ $divide: ['$profit', '$revenue'] }, 100] },
              0,
            ],
          },
        },
      },
      // أعلى 50 منتج بالإيراد بس - عشان لو المتجر عنده آلاف المنتجات، مش
      // هنرجعهم كلهم للفرونت (limit جوه الـ pipeline نفسه مش بعد ما يوصل).
      { $sort: { revenue: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          name: 1,
          qty: 1,
          revenue: 1,
          cost: 1,
          profit: 1,
          margin: 1,
        },
      },
    ]);

    // ==========================================================================
    // 3) توزيع كل منتج عبر *كل* حالات الطلب (مش المتسلمة بس) - مطابق لـ
    //    productSalesMap2 في AdminPanel.jsx بالظبط (نفس نطاق totalAllRevenue:
    //    كل الطلبات في النطاق أيًا كانت حالتها)، بالإضافة لعدد القطع المرتجعة
    //    من كل منتج (returnedQty) عشان يغطي productReturnRateList كمان (اللي
    //    كان بيحسب productReturnQtyMap من نفس الطلبات المرتجعة). ده منفصل عن
    //    byProduct فوق (اللي بيقيس الربح على المتسلم بس) لأن الغرض مختلف:
    //    هنا "الأكثر مبيعًا" و"معدل الإرجاع لكل منتج"، مش الربح/الهامش.
    //    مرتب تنازليًا بعدد القطع المباعة، وأعلى 50 منتج بس (زي byProduct).
    // ==========================================================================
    const byProductAllOrdersPromise = Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $addFields: {
          __qty: {
            $cond: [
              { $eq: [{ $ifNull: ['$items.quantity', 0] }, 0] },
              1,
              '$items.quantity',
            ],
          },
          __isReturned: { $in: ['$status', ['مرتجع', 'Returned']] },
        },
      },
      {
        $group: {
          _id: '$items.productId',
          qty: { $sum: '$__qty' },
          revenue: { $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, '$__qty'] } },
          returnedQty: { $sum: { $cond: ['$__isReturned', '$__qty', 0] } },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          qty: 1,
          revenue: 1,
          returnedQty: 1,
        },
      },
    ]);

    const [byGovernorate, byProduct, byProductAllOrders] = await Promise.all([byGovernoratePromise, byProductPromise, byProductAllOrdersPromise]);

    res.json({
      period,
      rangeStart: rangeStart ? rangeStart.toISOString() : null,
      rangeEnd: rangeEnd.toISOString(),
      byGovernorate,
      byProduct,
      byProductAllOrders,
    });
  } catch (err) {
    console.error('Error computing revenue breakdown:', err);
    res.status(500).json({ message: 'حصل خطأ في حساب تفاصيل الإيرادات' });
  }
};

// ============================================================================
// GET /api/orders/customer-stats  (أدمن - تبويب لوحة البيانات بس)
// ----------------------------------------------------------------------------
// إندبوينت منفصل عن /revenue-breakdown (مش حقول مضافة له) - القرار ده متعمّد:
// المنطق هنا مختلف جوهريًا (تحليل "هوية عميل" وتاريخه عبر كل الأوردرات، مش
// مجرد تجميع/group على حقول الأوردر الحالي زي المحافظة/المنتج)، وعمليًا
// بيحتاج $lookup مترابط (correlated) لكل عميل بدل $group بسيط. فصله بيخلي
// أي حد بيستخدم بيانات المحافظة/المنتج بس (من /revenue-breakdown) مايدفعش
// تكلفة حساب "عميل جديد/متكرر" لو مش محتاجها، والعكس.
//
// المنطق المطلوب (زي ما اتحدد بالظبط):
//  - uniqueCustomersCount: عدد العملاء الفريدين في الفترة، بنفس منطق
//    uniqueCustomerSet في الفرونت بالظبط (هوية العميل بالترتيب: customerId
//    أولاً، وإلا customerPhone (بعد trim)، وإلا customerEmail (بعد trim +
//    toLowerCase))..
//  - repeatCustomersCount: من العملاء الفريدين دول، اللي عنده *أوردر واحد على
//    الأقل قبل rangeStart* (بنفس تعريف الهوية). newCustomersCount = الباقي.
//    ===== ملحوظة مهمة: التعريف ده مختلف عن newCustomers/repeatCustomers في
//    AdminPanel.jsx الحالي! الفرونت بيحسبها *لكل أوردر* (كل أوردر في الفترة
//    بيتحسب "جديد" لو هو أول أوردر على الإطلاق للعميل ده عبر كل التاريخ، وأي
//    أوردر تاني بعده - حتى لو كله جوه نفس الفترة - بيتحسب "متكرر"). أما
//    التعريف المطلوب هنا فهو *لكل عميل* (مرة واحدة بس لكل عميل فريد في
//    الفترة): "متكرر" = عنده أوردر قبل بداية الفترة، بغض النظر عن عدد
//    أوردراته جوه الفترة نفسها. الرقمين مش هيتطابقوا مع بعض، وده متوقع لأنهم
//    بيقيسوا حاجتين مختلفتين (تكرار الأوردرات مقابل تكرار العملاء) - لو
//    محتاج تطابق سلوك الفرونت الحالي حرفيًا هنعدّل المنطق في برومبت تاني. =====
//  - returnRate / returnRevenueLost: على *كل* الطلبات في الفترة (زي
//    returnRate في الفرونت اللي بيستخدم filteredOrders مش deliveredFiltered).
//
// ===== أداء الـ "عميل متكرر": الطريقة اللي اخترتها ولية =====
// بدل ما نعمل $lookup/$group على *كل* تاريخ الأوردرات (سكان كامل للكوليكشن
// كلها عشان نجمّع أول أوردر لكل عميل عبر كل الزمن - ده تحديدًا اللي ممنوع
// نعمله)، بنعمل الآتي:
//  1) نجيب العملاء الفريدين *في الفترة الحالية بس* (باستخدام index
//     {createdAt:-1} في أول $match، زي كل الـ pipelines التانية).
//  2) لكل عميل فريد من دول (عددهم محدود بعدد العملاء اللي طلبوا في الفترة،
//     مش كل الأوردرات)، بنعمل $lookup مترابط (correlated subquery عن طريق
//     let/pipeline) بيسأل بس: "فيه أوردر واحد قبل rangeStart بنفس الهوية؟"
//     مع $limit: 1 جوه الـ lookup نفسه (مش هنجيب كل تاريخه، بس نتأكد إن فيه
//     حاجة واحدة على الأقل - أسرع بكتير من جلب كل الأوردرات القديمة).
// كده عدد عمليات الـ lookup = عدد العملاء الفريدين في الفترة (عادةً كسر صغير
// من إجمالي عدد الأوردرات)، مش عدد الأوردرات كله ولا تاريخ الشركة كله.
//
// ===== تحذير أداء/index محتاج قرارك (متعملتش لوحدي) =====
// الـ lookup بيتفرّع لـ 3 حالات حسب نوع الهوية:
//  - customerId: فيه index مركّب جاهز {customerId:1, createdAt:-1} في
//    Order.js - ده الحالة الأمثل أداءً.
//  - customerPhone / customerEmail: الموجود حاليًا index مفرد بس
//    ({customerPhone:1} و {customerEmail:1}) من غير createdAt معاه. المطابقة
//    بتتم جوه $lookup بصيغة $expr (مش query عادي)، فلو حجم الطلبات كبير
//    (مليون سجل زي ما ذكرت)، محتمل الأداء يبقى أبطأ من حالة customerId لأن
//    الـ query planner مش مضمون يستخدم index لـ $expr equality بكفاءة زي
//    query عادي، وبعدين لازم يفلتر createdAt يدويًا على النتائج. لو الغالبية
//    العظمى من الطلبات عندها customerId (عملاء مسجلين)، الأداء هيبقى كويس.
//    لو نسبة كبيرة "زوار" (guest checkout) بتتماثل بالتليفون/الإيميل بس،
//    وحابب تحسّن الأداء أكتر، أقترح تضيف index مركّب:
//      orderSchema.index({ customerPhone: 1, createdAt: -1 });
//      orderSchema.index({ customerEmail: 1, createdAt: -1 });
//    (نفس فكرة index({customerId:1, createdAt:-1}) الموجود بالفعل) - بس
//    متعمّدتش أضيفهم من غير ما تأكدلي، لأن بناء index جديد على كوليكشن فيها
//    مليون سجل ممكن ياخد وقت ويأثر على الأداء وقت البناء نفسه.
// ============================================================================
const getCustomerStats = async (req, res) => {
  try {
    const period = String(req.query.period || '30days');
    const customFrom = req.query.from || null;
    const customTo = req.query.to || null;

    const { rangeStart, rangeEnd } = getRevenuePeriodRange(period, customFrom, customTo);

    const match = {};
    if (rangeStart) {
      match.createdAt = { $gte: rangeStart, $lte: rangeEnd };
    } else {
      match.createdAt = { $lte: rangeEnd };
    }

    // ==========================================================================
    // 1) العملاء الفريدين في الفترة + تصنيفهم جديد/متكرر - راجع الشرح فوق.
    // ==========================================================================
    // بنحسب هوية كل عميل (نوع الحقل + قيمته) بنفس أولوية uniqueCustomerSet:
    // customerId أولاً، وإلا customerPhone (trim)، وإلا customerEmail
    // (trim + lowercase). أي أوردر من غير أي حقل من التلاتة (نادر لأن
    // customerPhone required) بيتجاهل زي "if (!key) return;" في الفرونت.
    const custKeyTypeExpr = {
      $switch: {
        branches: [
          { case: { $ne: ['$customerId', null] }, then: 'id' },
          { case: { $ne: ['$__custPhoneNorm', ''] }, then: 'phone' },
          { case: { $ne: ['$__custEmailNorm', ''] }, then: 'email' },
        ],
        default: null,
      },
    };
    const custKeyValueExpr = {
      $switch: {
        branches: [
          { case: { $ne: ['$customerId', null] }, then: '$customerId' },
          { case: { $ne: ['$__custPhoneNorm', ''] }, then: '$__custPhoneNorm' },
          { case: { $ne: ['$__custEmailNorm', ''] }, then: '$__custEmailNorm' },
        ],
        default: null,
      },
    };
    const customerBucketsPipeline = [
      { $match: match },
      {
        $addFields: {
          __custPhoneNorm: { $trim: { input: { $ifNull: ['$customerPhone', ''] } } },
          __custEmailNorm: { $toLower: { $trim: { input: { $ifNull: ['$customerEmail', ''] } } } },
        },
      },
      {
        $addFields: {
          __custKeyType: custKeyTypeExpr,
          __custKeyValue: custKeyValueExpr,
        },
      },
      { $match: { __custKeyType: { $ne: null } } },
      // كل عميل مرة واحدة بس - نفس فكرة الـ Set في الفرونت.
      { $group: { _id: { type: '$__custKeyType', value: '$__custKeyValue' } } },
    ];
    // لو rangeStart = null (يعني "من الأول"/كل التاريخ)، فمفيش "فترة سابقة"
    // أصلاً يتقاس بالنسبة لها التكرار - رياضيًا كل العملاء "جدد" (مفيش حاجة
    // قبل بداية كل التاريخ). في الحالة دي بنسيب الـ lookup المكلف ده تمامًا
    // (مش هنعمله من غير داعي) ونرجّع repeatCustomersCount=0 مباشرة.
    const customerStatsPromise = rangeStart
      ? Order.aggregate([
          ...customerBucketsPipeline,
          {
            // ===== لكل عميل فريد في الفترة، فيه أوردر واحد على الأقل قبل
            // rangeStart بنفس الهوية؟ (existence check بـ $limit:1، مش جلب
            // كل التاريخ). راجع شرح الأداء/الـ index المطلوب فوق. =====
            $lookup: {
              from: 'orders',
              let: { keyType: '$_id.type', keyValue: '$_id.value' },
              pipeline: [
                {
                  $match: {
                    createdAt: { $lt: rangeStart },
                    $expr: {
                      $switch: {
                        branches: [
                          { case: { $eq: ['$$keyType', 'id'] }, then: { $eq: ['$customerId', '$$keyValue'] } },
                          { case: { $eq: ['$$keyType', 'phone'] }, then: { $eq: [{ $trim: { input: { $ifNull: ['$customerPhone', ''] } } }, '$$keyValue'] } },
                          { case: { $eq: ['$$keyType', 'email'] }, then: { $eq: [{ $toLower: { $trim: { input: { $ifNull: ['$customerEmail', ''] } } } }, '$$keyValue'] } },
                        ],
                        default: false,
                      },
                    },
                  },
                },
                { $limit: 1 },
                { $project: { _id: 1 } },
              ],
              as: '__priorOrder',
            },
          },
          {
            $group: {
              _id: null,
              uniqueCustomersCount: { $sum: 1 },
              repeatCustomersCount: { $sum: { $cond: [{ $gt: [{ $size: '$__priorOrder' }, 0] }, 1, 0] } },
              newCustomersCount: { $sum: { $cond: [{ $gt: [{ $size: '$__priorOrder' }, 0] }, 0, 1] } },
            },
          },
        ])
      : Order.aggregate([
          ...customerBucketsPipeline,
          { $group: { _id: null, uniqueCustomersCount: { $sum: 1 } } },
        ]);

    // ==========================================================================
    // 2) معدل الإرجاع وخسارة الإيراد منه - على كل الطلبات في الفترة (زي
    //    returnRate في الفرونت: filteredOrders مش deliveredFiltered).
    // ==========================================================================
    const returnStatsPromise = Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          returnedOrdersCount: { $sum: { $cond: [{ $in: ['$status', ['مرتجع', 'Returned']] }, 1, 0] } },
          returnRevenueLost: { $sum: { $cond: [{ $in: ['$status', ['مرتجع', 'Returned']] }, { $ifNull: ['$totalAmount', 0] }, 0] } },
        },
      },
    ]);

    const [customerResult, returnResult] = await Promise.all([customerStatsPromise, returnStatsPromise]);

    const customerRow = customerResult?.[0];
    const returnRow = returnResult?.[0];
    const totalOrders = returnRow?.totalOrders || 0;
    const returnedOrdersCount = returnRow?.returnedOrdersCount || 0;
    const returnRate = totalOrders > 0 ? Number(((returnedOrdersCount / totalOrders) * 100).toFixed(1)) : 0;

    res.json({
      period,
      rangeStart: rangeStart ? rangeStart.toISOString() : null,
      rangeEnd: rangeEnd.toISOString(),
      uniqueCustomersCount: customerRow?.uniqueCustomersCount || 0,
      newCustomersCount: rangeStart ? (customerRow?.newCustomersCount || 0) : (customerRow?.uniqueCustomersCount || 0),
      repeatCustomersCount: rangeStart ? (customerRow?.repeatCustomersCount || 0) : 0,
      returnRate,
      returnedOrdersCount,
      returnRevenueLost: returnRow?.returnRevenueLost || 0,
    });
  } catch (err) {
    console.error('Error computing customer stats:', err);
    res.status(500).json({ message: 'حصل خطأ في حساب إحصائيات العملاء' });
  }
};

// ============================================================================
// GET /api/orders/sales-trend  (أدمن - جراف المبيعات + التوقع في لوحة البيانات)
// ----------------------------------------------------------------------------
// ليه الإندبوينت ده اتضاف: جراف المبيعات (وتوقع الإيرادات المبني عليه) كان
// بيتحسب بالكامل في الفرونت من statsOrders (بسقف أمان 1000 أوردر قديم)، يعني
// أي متجر عنده أكتر من 1000 أوردر كان الجراف بيبقى غلط تمامًا (بيانات ناقصة).
// هنا بنعمل aggregation بتجمع مبلغ totalAmount لكل "دلو" زمني (يوم/أسبوع/شهر/
// سنة) على *كل* الطلبات في النطاق من غير أي سقف، بنفس منطق تقسيم الفرونت
// بالظبط (buildActiveSalesData في AdminPanel.jsx):
//  - 7/14/30/90 يوم أو مدى مخصص: لو عدد الأيام <= 31 يبقى تجميع يومي، غير
//    كده أسبوعي (بداية الأسبوع = الأحد، زي setDate(d.getDate()-d.getDay())).
//  - شهري: آخر 6 شهور. سنوي: آخر 4 سنين.
// الرد بيرجّع نقاط خام (تاريخ/سنة + مبلغ) والفرونت هو اللي مسؤول عن تكوين
// التسمية المعروضة (زي منطقه الحالي بالظبط) - عشان نتجنب تكرار منطق الترجمة
// العربي/الإنجليزي هنا كمان.
// ============================================================================
const getSalesTrend = async (req, res) => {
  try {
    const period = String(req.query.period || '30days');
    const customFrom = req.query.from || null;
    const customTo = req.query.to || null;
    const { rangeStart, rangeEnd } = getRevenuePeriodRange(period, customFrom, customTo);
    const now = new Date();

    let granularity;
    if (period === 'monthly') granularity = 'month';
    else if (period === 'yearly') granularity = 'year';
    else {
      const start = rangeStart || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      const totalDays = Math.max(1, Math.round((rangeEnd - start) / 86400000) + 1);
      granularity = totalDays <= 31 ? 'day' : 'week';
    }

    // نطاق المطابقة: زي باقي الإندبوينتس - لو monthly/yearly بنستخدم نطاق
    // أوسع (6 شهور/4 سنين) بيتحدد فعليًا من getRevenuePeriodRange بالفعل.
    const match = rangeStart ? { createdAt: { $gte: rangeStart, $lte: rangeEnd } } : { createdAt: { $lte: rangeEnd } };

    let bucketKeyExpr;
    if (granularity === 'day') {
      bucketKeyExpr = { $dateToString: { date: '$createdAt', format: '%Y-%m-%d' } };
    } else if (granularity === 'week') {
      // بداية الأسبوع = الأحد (نفس d.setDate(d.getDate()-d.getDay()) في الفرونت)
      const dayTrunc = { $dateTrunc: { date: '$createdAt', unit: 'day' } };
      const weekStart = { $dateSubtract: { startDate: dayTrunc, unit: 'day', amount: { $subtract: [{ $dayOfWeek: '$createdAt' }, 1] } } };
      bucketKeyExpr = { $dateToString: { date: weekStart, format: '%Y-%m-%d' } };
    } else if (granularity === 'month') {
      bucketKeyExpr = { $dateToString: { date: '$createdAt', format: '%Y-%m' } };
    } else {
      bucketKeyExpr = { $dateToString: { date: '$createdAt', format: '%Y' } };
    }

    const rows = await Order.aggregate([
      { $match: match },
      { $group: { _id: bucketKeyExpr, amount: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
    ]);
    const amountByKey = {};
    rows.forEach(r => { amountByKey[r._id] = Math.round(r.amount); });

    // ===== نبني كل الدلاء (buckets) المتوقعة في النطاق حتى لو مفيهاش
    // طلبات - بنفس منطق dayMap/monthlyMap/yearlyMap في الفرونت بالظبط - عشان
    // الجراف يفضل كامل ومتصل حتى في الفترات اللي مفيهاش مبيعات. =====
    const points = [];
    if (granularity === 'day') {
      const start = rangeStart || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      const totalDays = Math.max(1, Math.round((rangeEnd - start) / 86400000) + 1);
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        const key = d.toISOString().slice(0, 10);
        points.push({ key, date: key, amount: amountByKey[key] || 0 });
      }
    } else if (granularity === 'week') {
      // نولّد بداية كل أسبوع من rangeStart (بعد ما نرجّعه لأقرب أحد) لحد rangeEnd
      const start = rangeStart || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      const weekStartOf = (d) => { const w = new Date(d); w.setHours(0, 0, 0, 0); w.setDate(w.getDate() - w.getDay()); return w; };
      let cursor = weekStartOf(start);
      const end = rangeEnd;
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        points.push({ key, date: key, amount: amountByKey[key] || 0 });
        cursor = new Date(cursor.getTime() + 7 * 86400000);
      }
    } else if (granularity === 'month') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        points.push({ key, year: d.getFullYear(), month: d.getMonth(), amount: amountByKey[key] || 0 });
      }
    } else {
      for (let i = 3; i >= 0; i--) {
        const y = now.getFullYear() - i;
        const key = String(y);
        points.push({ key, year: y, amount: amountByKey[key] || 0 });
      }
    }

    res.json({ period, granularity, points });
  } catch (err) {
    console.error('Error computing sales trend:', err);
    res.status(500).json({ message: 'حصل خطأ في حساب جراف المبيعات' });
  }
};

// ============================================================================
// GET /api/orders/dashboard-extras  (أدمن - تبويب لوحة البيانات بس)
// ----------------------------------------------------------------------------
// إحصائيات متفرقة كانت بتتحسب في الفرونت من statsOrders (بسقف الـ1000 القديم)
// وجمعناها هنا في إندبوينت واحد بدل ما نعمل رحلة/طلب منفصل لكل رقم:
//  - avgDeliveryDays: متوسط وقت التسليم (بالأيام) - على *كل تاريخ المتجر*
//    (زي avgDeliveryMs في الفرونت اللي بيحسب على orders/statsOrders كلها مش
//    بس الفترة المختارة)، ولو مفيش طلبات معاها deliveredAt بنرجع لتقريب
//    احتياطي بـ updatedAt-createdAt على الطلبات المتسلمة *في الفترة المحددة*
//    (period/from/to) - بنفس الترتيب اللي كان في الفرونت بالظبط.
//  - clvAvg / clvTop: متوسط/أعلى قيمة عميل مدى الحياة - على كل تاريخ المتجر
//    برضه (زي customerSpendMap في الفرونت اللي بيلف على orders كلها).
//  - todaySales / yesterdaySales: مبيعات النهاردة/إمبارح (دايمًا، بغض النظر
//    عن الفترة المختارة في الفلتر - زي allOrders في الفرونت).
//  - statusDistribution: عدد الطلبات لكل حالة *في الفترة المحددة* (period/
//    from/to) - زي statusMap2 في الفرونت اللي بيتحسب من filteredOrders.
// ============================================================================
const getDashboardExtras = async (req, res) => {
  try {
    const period = String(req.query.period || '30days');
    const customFrom = req.query.from || null;
    const customTo = req.query.to || null;
    const { rangeStart, rangeEnd } = getRevenuePeriodRange(period, customFrom, customTo);
    const periodMatch = rangeStart ? { createdAt: { $gte: rangeStart, $lte: rangeEnd } } : { createdAt: { $lte: rangeEnd } };

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const yesterdayEnd = new Date(todayEnd.getTime() - 86400000);

    const custKeyTypeExpr = {
      $switch: {
        branches: [
          { case: { $ne: ['$customerId', null] }, then: 'id' },
          { case: { $ne: ['$__custPhoneNorm', ''] }, then: 'phone' },
          { case: { $ne: ['$__custEmailNorm', ''] }, then: 'email' },
        ],
        default: null,
      },
    };
    const custKeyValueExpr = {
      $switch: {
        branches: [
          { case: { $ne: ['$customerId', null] }, then: '$customerId' },
          { case: { $ne: ['$__custPhoneNorm', ''] }, then: '$__custPhoneNorm' },
          { case: { $ne: ['$__custEmailNorm', ''] }, then: '$__custEmailNorm' },
        ],
        default: null,
      },
    };

    const [deliveryRow, deliveryFallbackRow, clvRow, todayRow, yesterdayRow, statusRows] = await Promise.all([
      // متوسط وقت التسليم على كل التاريخ (deliveredAt متسجل)
      Order.aggregate([
        { $match: { deliveredAt: { $ne: null }, createdAt: { $ne: null } } },
        { $group: { _id: null, avgMs: { $avg: { $subtract: ['$deliveredAt', '$createdAt'] } } } },
      ]),
      // تقريب احتياطي: متسلمة في الفترة المحددة، مفيهاش deliveredAt، updatedAt != createdAt
      Order.aggregate([
        {
          $match: {
            ...periodMatch,
            $expr: {
              $and: [
                { $in: ['$status', ['تم التسليم', 'Delivered']] },
                { $ne: [{ $ifNull: ['$updatedAt', null] }, null] },
                { $ne: ['$updatedAt', '$createdAt'] },
              ],
            },
          },
        },
        { $group: { _id: null, avgMs: { $avg: { $subtract: ['$updatedAt', '$createdAt'] } } } },
      ]),
      // قيمة العميل مدى الحياة - على كل تاريخ المتجر
      Order.aggregate([
        {
          $addFields: {
            __custPhoneNorm: { $trim: { input: { $ifNull: ['$customerPhone', ''] } } },
            __custEmailNorm: { $toLower: { $trim: { input: { $ifNull: ['$customerEmail', ''] } } } },
          },
        },
        { $addFields: { __custKeyType: custKeyTypeExpr, __custKeyValue: custKeyValueExpr } },
        { $match: { __custKeyType: { $ne: null } } },
        { $group: { _id: { type: '$__custKeyType', value: '$__custKeyValue' }, spend: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
        { $group: { _id: null, avgCLV: { $avg: '$spend' }, topCLV: { $max: '$spend' } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
      ]),
      Order.aggregate([
        { $match: periodMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const avgDeliveryMs = deliveryRow?.[0]?.avgMs || null;
    const avgDeliveryFallbackMs = (avgDeliveryMs === null) ? (deliveryFallbackRow?.[0]?.avgMs || null) : null;
    const avgDeliveryDays = avgDeliveryMs !== null
      ? Number((avgDeliveryMs / 86400000).toFixed(1))
      : (avgDeliveryFallbackMs !== null ? Number((avgDeliveryFallbackMs / 86400000).toFixed(1)) : null);

    res.json({
      period,
      avgDeliveryDays,
      clvAvg: Math.round(clvRow?.[0]?.avgCLV || 0),
      clvTop: Math.round(clvRow?.[0]?.topCLV || 0),
      todaySales: todayRow?.[0]?.total || 0,
      yesterdaySales: yesterdayRow?.[0]?.total || 0,
      statusDistribution: statusRows.map(r => ({ status: r._id, count: r.count })),
    });
  } catch (err) {
    console.error('Error computing dashboard extras:', err);
    res.status(500).json({ message: 'حصل خطأ في حساب إحصائيات لوحة البيانات' });
  }
};

// ============================================================================
// GET /api/orders/yearly-comparison  (أدمن - قسم "مقارنة سنة بسنة" في لوحة البيانات)
// ----------------------------------------------------------------------------
// كان بيتحسب بالكامل في الفرونت من statsOrders (سقف 1000). بنستخدم نفس
// aggregateRevenueForRange المستخدمة في /revenue-stats (aggregation بدون سقف)
// على نطاق السنة الحالية والسنة اللي قبلها. المصاريف (expenses) اتسيبت في
// الفرونت لأنها متسجلة جوه Settings كمصفوفة صغيرة بيدخلها الأدمن يدويًا -
// مش نتيجة أوردرات، فمفيهاش مشكلة سقف أصلاً.
// ============================================================================
const getYearlyComparison = async (req, res) => {
  try {
    const now = new Date();
    const buildYearRange = (year) => ({
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
    });
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;
    const curr = buildYearRange(thisYear);
    const prev = buildYearRange(lastYear);

    // نسبة الإرجاع محسوبة برضه هنا (returnedOrdersCount / ordersCount) - مش
    // موجودة في aggregateRevenueForRange، فبنجيبها بـ query عدّ بسيط منفصل.
    const returnedCountForRange = async (start, end) => {
      const [row] = await Order.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: 1 }, returned: { $sum: { $cond: [{ $in: ['$status', ['مرتجع', 'Returned']] }, 1, 0] } } } },
      ]);
      return { total: row?.total || 0, returned: row?.returned || 0 };
    };

    const [currAgg, prevAgg, currReturn, prevReturn] = await Promise.all([
      aggregateRevenueForRange(curr.start, curr.end),
      aggregateRevenueForRange(prev.start, prev.end),
      returnedCountForRange(curr.start, curr.end),
      returnedCountForRange(prev.start, prev.end),
    ]);

    const toYearStats = (agg, ret) => ({
      orders: agg.ordersCount,
      revenue: agg.totalAllRevenue,
      sales: agg.totalSales,
      cost: agg.totalCost,
      shippingCost: agg.totalShippingCost,
      returnShippingCost: agg.returnShippingCost,
      returnRate: ret.total > 0 ? Number(((ret.returned / ret.total) * 100).toFixed(1)) : 0,
    });

    res.json({
      thisYear: { year: thisYear, ...toYearStats(currAgg, currReturn) },
      lastYear: { year: lastYear, ...toYearStats(prevAgg, prevReturn) },
    });
  } catch (err) {
    console.error('Error computing yearly comparison:', err);
    res.status(500).json({ message: 'حصل خطأ في حساب مقارنة السنوات' });
  }
};

// GET /api/orders/mine  (عميل مسجل)
const getMyOrders = async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 100, defaultLimit: 50 });

    if (!isPaginated) {
      const orders = await Order.find({ customerId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(500) // سقف أمان
        .lean();
      // ===== حماية بيانات العميل: projection آمنة بدل مستندات الـOrder
      // الكاملة (كانت بتسرّب costPrice/paymentGateway/refunds إلخ) =====
      return res.json(toCustomerOrderViews(orders));
    }

    const filter = { customerId: req.user._id };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    res.json(buildListResponse({ isPaginated: true, page, limit, items: toCustomerOrderViews(orders), total }));
  } catch (err) {
    console.error('Error fetching my orders:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب طلباتك'});
  }
};

// يبعت رسالة تسويقية (إيميل/واتساب) لو الأدمن حدد رسالة لحالة الطلب أو حالة الشحن دي.
// لا يوقف أو يفشّل تحديث الحالة لو الإرسال فشل.
const queueStatusNotification = async (order, statusValue) => {
  try {
    const settings = await Settings.findOne().select('marketing').lean();
    const marketing = settings?.marketing;
    const rule = marketing?.statusNotifications
      ? (marketing.statusChannels || []).find(s => s.enabled && s.status === statusValue)
      : null;
    if (!rule) return;
    const channel = rule.channel === 'whatsapp' ? 'whatsapp' : 'email';
    // ===== FIX: موافقة الماركتنج - لو العميل عنده حساب وألغى موافقته على
    // استقبال إيميلات الماركتنج، منبعتش له رسائل الحالة دي عبر الإيميل خالص
    // (زي شوبيفاي بالظبط). الطلبات كـ Guest (من غير customerId) مفيهاش
    // موافقة أصلاً فبتفضل زي ما هي. =====
    if (channel === 'email' && order.customerId) {
      const customer = await User.findById(order.customerId).select('marketingConsent').lean();
      if (customer && customer.marketingConsent === false) return;
    }
    const hasTarget = channel === 'email' ? !!order.customerEmail : !!order.customerPhone;
    if (!hasTarget) return;
    const MarketingMessage = require('../models/MarketingMessage');
    const render = (tpl) => String(tpl || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
      const ctx = { customerName: order.customerName, orderId: String(order.orderNumber ?? order._id), status: statusValue, total: order.totalAmount };
      return ctx[k] == null ? '' : String(ctx[k]);
    });
    await MarketingMessage.create({
      kind: 'order_status',
      channel,
      recipientEmail: channel === 'email' ? String(order.customerEmail).trim().toLowerCase() : undefined,
      recipientPhone: channel === 'whatsapp' ? String(order.customerPhone || '').replace(/\D/g, '') : undefined,
      subject: render(rule.subject) || `تحديث حالة طلبك #${order.orderNumber ?? order._id}`,
      content: render(rule.content) || `طلبك #${order.orderNumber ?? order._id} بقى: ${statusValue}`,
      // entityId يشمل الحالة نفسها علشان كل حالة تتبعت مرة واحدة، وأي حالة جديدة تتبعت برضو.
      entityId: `${order._id}:${statusValue}`,
      step: 0,
      scheduledAt: new Date(),
      status: 'pending',
    });
  } catch (notifyErr) {
    console.error('Order status notification queue failed:', notifyErr.message);
  }
};

// PUT /api/orders/:id/status  (أدمن / كول سنتر)
const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'الطلب مش موجود' });
    }
    const statusChanged = req.body.status && req.body.status !== order.status;
    const newStatus = req.body.status;
    if (req.body.status) order.status = req.body.status;

    // ===== تفاصيل الإرجاع — بتتسجل بس لو الحالة الجديدة "مرتجع" =====
    // returnReason و returnShippingCost اختياريين، بيتبعتوا من الأدمن وقت
    // تغيير الحالة (مثلاً من مودال تأكيد الإرجاع في الفرونت).
    if (statusChanged && (newStatus === 'مرتجع' || newStatus === 'Returned')) {
      if (typeof req.body.returnReason === 'string' && req.body.returnReason.trim()) {
        order.returnReason = req.body.returnReason.trim().slice(0, 500);
      }
      if (req.body.returnShippingCost !== undefined && req.body.returnShippingCost !== null && req.body.returnShippingCost !== '') {
        const cost = Number(req.body.returnShippingCost);
        if (Number.isFinite(cost) && cost >= 0) order.returnShippingCost = cost;
      }
    }

    // ============================================================
    // ===== إرجاع المخزون عند الإلغاء/الرفض/الارتجاع =====
    // بيحصل مرة واحدة بس لكل order (محمي بـ stockRestored) حتى لو حد نادى
    // على الـ endpoint ده أكتر من مرة أو تم تغيير الحالة لـ "ملغي" مرتين.
    // ============================================================
    if (statusChanged && STOCK_RESTORING_STATUSES.has(newStatus) && !order.stockRestored) {
      // نعلّم الطلب كـ "تم إرجاع مخزونه" بشرط atomic (findOneAndUpdate) قبل
      // أي إرجاع فعلي، عشان نقفل الـ race لو نفس الـ endpoint اتنادى مرتين
      // في نفس اللحظة بالظبط (مثلاً دبل كليك من الأدمن، أو retry من الفرونت).
      const lockResult = await Order.findOneAndUpdate(
        { _id: order._id, stockRestored: false },
        { $set: { stockRestored: true, stockRestoredAt: new Date() } },
        { new: true }
      );

      if (lockResult) {
        await restoreOrderItems(order.items);
        await logMovementsBulk(order.items, 'stock_returned', {
          orderId: order._id,
          userId: req.user ? req.user._id : null,
          note: `إرجاع مخزون بسبب تغيير حالة الطلب إلى: ${newStatus}`,
        });
        invalidateProductCaches();
        order.stockRestored = true;
        order.stockRestoredAt = lockResult.stockRestoredAt;
      } else {
        // Another concurrent request already claimed the stock-restoration lock.
        // Keep this in-memory document aligned with the DB before save(), so a
        // stale document can never write stockRestored=false back over the winner.
        order.stockRestored = true;
        order.stockRestoredAt = order.stockRestoredAt || new Date();
      }
    }

    await order.save();
    require('../utils/cache').del('orders:all');

    if (statusChanged) await queueStatusNotification(order, order.status);

    res.json(order);
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث حالة الطلب'});
  }
};

// PUT /api/orders/:id/packer-status  (أدمن / باكر)
const updatePackerStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'الطلب مش موجود' });
    }
    const packerStatusChanged = req.body.packerStatus && req.body.packerStatus !== order.packerStatus;
    if (req.body.packerStatus) order.packerStatus = req.body.packerStatus;
    await order.save();
    require('../utils/cache').del('orders:all');

    if (packerStatusChanged) await queueStatusNotification(order, order.packerStatus);

    res.json(order);
  } catch (err) {
    console.error('Error updating packer status:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث حالة التجهيز'});
  }
};

// PUT /api/orders/:id/confirm-payment  (أدمن / كول سنتر - تأكيد استلام فلوس الدفع الإلكتروني)
// ============================================================
// ===== تأكيد/رفض دفع المحفظة (تحويل يدوي - Wallet) من الأدمن =====
// ===== إصلاح: كان بيعدّل walletPayment.confirmed بس من غير ما يلمس
// paymentStatus خالص - يعني الطلب يفضل "pending" للأبد حتى لو الأدمن أكد
// أو رفض الدفع فعليًا، ومفيش أي إرجاع للمخزون لو الأدمن رفض (شك في التحويل/
// سكرين شوت مزور). دلوقتي بيمر على نفس الحارس المركزي
// (applyPaymentStatusTransition) ونفس منطق إرجاع المخزون المستخدم في
// updatePaymentStatus فوق بالظبط - فبقى نفس السلوك المضمون للدفع
// الإلكتروني، لكن لدفع المحفظة اليدوي.
// ============================================================
const confirmWalletPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'الطلب مش موجود' });
    }
    if (order.paymentMethod !== 'wallet') {
      return res.status(400).json({ message: 'الطلب ده مش مدفوع دفع إلكتروني' });
    }
    const confirmed = !!req.body.confirmed;
    order.walletPayment.confirmed = confirmed;
    order.walletPayment.confirmedAt = confirmed ? new Date() : null;

    const requestedPaymentStatus = confirmed ? 'paid' : 'failed';
    const previousStatus = order.paymentStatus;
    const transition = applyPaymentStatusTransition(order, requestedPaymentStatus);

    if (!transition.applied && !transition.noop) {
      // transition غير مسموح بيه (مثلاً الطلب اتسترجع فلوسه بالفعل) - منرفضش
      // العملية بالكامل (walletPayment.confirmed لسه فيه قيمة إعلامية مفيدة
      // للأدمن)، لكن نوضح إن paymentStatus مش هيتغير.
      console.warn(`Wallet confirm: cannot move order ${order._id} paymentStatus from '${previousStatus}' to '${requestedPaymentStatus}' — reason: ${transition.reason}`);
    }

    // ===== اتساق المخزون مع حالة الدفع (نفس منطق updatePaymentStatus فوق) =====
    if (!confirmed && (transition.applied || previousStatus === 'failed') && !order.stockRestored) {
      await restoreOrderItems(order.items);
      await logMovementsBulk(order.items, 'stock_released', {
        orderId: order._id,
        userId: req.user ? req.user._id : null,
        note: 'رفض الأدمن لدفع المحفظة (تحويل يدوي) — تم إرجاع المخزون',
      });
      order.stockRestored = true;
      order.stockRestoredAt = new Date();
      invalidateProductCaches();
    }

    await order.save();
    require('../utils/cache').del('orders:all');
    res.json(order);
  } catch (err) {
    console.error('Error confirming wallet payment:', err);
    res.status(500).json({ message: 'حصل خطأ في تأكيد الدفع'});
  }
};

// GET /api/orders/loyalty-info  (عميل مسجل - يجيب بياناته في نظام الولاء)
const getLoyaltyInfo = async (req, res) => {
  try {
    const User = require('../models/User');
    const freshUser = await User.findById(req.user._id).select('loyaltyOrderCount loyaltyCodes loyaltyCodesUsed');
    if (!freshUser) return res.status(404).json({ message: 'المستخدم غير موجود' });

    const settings = await Settings.findOne();
    const lp = settings?.loyaltyProgram || {};

    const availableCodes = (freshUser.loyaltyCodes || []).filter(
      c => !(freshUser.loyaltyCodesUsed || []).includes(c)
    );

    res.json({
      orderCount: freshUser.loyaltyOrderCount || 0,
      ordersRequired: lp.ordersRequired || 10,
      availableCodes,
      usedCodes: freshUser.loyaltyCodesUsed || [],
      loyaltyEnabled: lp.enabled || false,
      rewardType: lp.rewardType || 'percentage',
      rewardValue: lp.rewardValue || 0,
      specificProductId: lp.specificProductId || null,
      nextRewardIn: lp.enabled && lp.ordersRequired
        ? lp.ordersRequired - ((freshUser.loyaltyOrderCount || 0) % lp.ordersRequired)
        : null,
    });
  } catch (err) {
    console.error('Error fetching loyalty info:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب بيانات الولاء'});
  }
};

// exports moved to bottom of file
// ============================================================
// GET /api/orders/payments-dashboard  (أدمن فقط)
// إحصائيات شاملة للمدفوعات — aggregation في الداتابيز بدل تحميل كل الطلبات
// في الميموري (كان قبل كده Order.find().lean() على كل الطلبات، وده مش
// scalable لو عدد الطلبات كبير).
// ============================================================
const getPaymentsDashboard = async (req, res) => {
  try {
    const [totals] = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [
                // الإيراد ميتحسبش إلا لما الطلب "يتسلم" فعليًا - سواء عن طريق تتبع
                // شركة شحن (shippingStatus=delivered) أو طلب متابع يدويًا/استلام من
                // المتجر (status='تم التسليم') - بغض النظر عن طريقة الدفع (COD،
                // كاشير، Paymob، محفظة). قبل كده كان مختلف حسب طريقة الدفع (COD
                // بيتحسب من وقت "تم التأكيد" بس، وأونلاين من وقت "paid") وده كان بيدي
                // صورة غير دقيقة لصافي الأرباح لأن الشحنة ممكن ترجع/تفشل بعد الشحن.
                { $or: [
                  { $eq: ['$shippingStatus', 'delivered'] },
                  { $eq: ['$status', 'تم التسليم'] },
                ] },
                // ===== FIX: فرق فلوس الاستبدال (Exchange) بقى بيدخل في الإيراد =====
                // exchangeExtraCollected: فرق سعر اتحصّل فعليًا من العميل وقت
                // الاستبدال (بيتزوّد على الإيراد). فلوس الاستبدال اللي بترجع
                // للعميل (refund_to_customer) بتتسجل في refundedAmount نفسه
                // (نفس حقل الاسترجاع العادي) فبتتخصم من غير ما نضيف حقل تاني
                // هنا - شوف Order.js / exchangeController.js -> updateExchangeMoney.
                { $subtract: [
                  { $add: [{ $ifNull: ['$totalAmount', 0] }, { $ifNull: ['$exchangeExtraCollected', 0] }] },
                  { $ifNull: ['$refundedAmount', 0] },
                ] }, 0,
              ],
            },
          },
          pendingAmount: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$paymentStatus', 'pending'] }, 'pending'] }, { $ifNull: ['$totalAmount', 0] }, 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$paymentStatus', 'pending'] }, 'pending'] }, 1, 0] } },
          failedAmount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'failed'] }, { $ifNull: ['$totalAmount', 0] }, 0] } },
          failedCount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'failed'] }, 1, 0] } },
          refundedAmount: { $sum: { $ifNull: ['$refundedAmount', 0] } },
          refundedCount: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$refundedAmount', 0] }, 0] }, 1, 0] } },
          byCodAmount: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$paymentMethod', 'cod'] }, 'cod'] }, { $ifNull: ['$totalAmount', 0] }, 0] } },
          codCount: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$paymentMethod', 'cod'] }, 'cod'] }, 1, 0] } },
          byWalletAmount: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'wallet'] }, { $ifNull: ['$totalAmount', 0] }, 0] } },
          walletCount: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'wallet'] }, 1, 0] } },
          byKashierAmount: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'kashier'] }, { $ifNull: ['$totalAmount', 0] }, 0] } },
          kashierCount: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'kashier'] }, 1, 0] } },
          byPaymobAmount: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'paymob'] }, { $ifNull: ['$totalAmount', 0] }, 0] } },
          paymobCount: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'paymob'] }, 1, 0] } },
        },
      },
    ]);

    const walletMethodsAgg = await Order.aggregate([
      { $match: { paymentMethod: 'wallet' } },
      {
        $group: {
          _id: { $ifNull: ['$walletPayment.methodName', 'أخرى'] },
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        },
      },
    ]);

    const walletMethods = {};
    walletMethodsAgg.forEach((m) => {
      walletMethods[m._id] = { count: m.count, amount: m.amount };
    });

    // إيصالات في انتظار المراجعة — بحد أقصى آمن (أحدث 200 بدل تحميل الكل)
    const pendingProofReviewDocs = await Order.find({
      paymentMethod: 'wallet',
      'walletPayment.confirmed': false,
      'walletPayment.screenshotUrl': { $ne: null },
    })
      .select('customerName customerPhone totalAmount createdAt walletPayment')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const pendingProofReview = pendingProofReviewDocs.map((order) => ({
      _id: order._id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      methodName: order.walletPayment?.methodName || 'أخرى',
      screenshotUrl: order.walletPayment?.screenshotUrl,
      senderPhone: order.walletPayment?.senderPhone,
      transferDate: order.walletPayment?.transferDate,
      walletPhoneNumber: order.walletPayment?.walletPhoneNumber,
    }));

    const t = totals || {
      totalOrders: 0, totalRevenue: 0, pendingAmount: 0, pendingCount: 0,
      failedAmount: 0, failedCount: 0, refundedAmount: 0, refundedCount: 0,
      byCodAmount: 0, codCount: 0, byWalletAmount: 0, walletCount: 0,
    };

    res.json({
      totalRevenue: Math.round((t.totalRevenue || 0) * 100) / 100,
      pendingAmount: Math.round((t.pendingAmount || 0) * 100) / 100,
      failedAmount: Math.round((t.failedAmount || 0) * 100) / 100,
      refundedAmount: Math.round((t.refundedAmount || 0) * 100) / 100,
      byCodAmount: Math.round((t.byCodAmount || 0) * 100) / 100,
      byWalletAmount: Math.round((t.byWalletAmount || 0) * 100) / 100,
      totalOrders: t.totalOrders || 0,
      pendingCount: t.pendingCount || 0,
      failedCount: t.failedCount || 0,
      refundedCount: t.refundedCount || 0,
      codCount: t.codCount || 0,
      walletCount: t.walletCount || 0,
      byKashierAmount: Math.round((t.byKashierAmount || 0) * 100) / 100,
      kashierCount: t.kashierCount || 0,
      byPaymobAmount: Math.round((t.byPaymobAmount || 0) * 100) / 100,
      paymobCount: t.paymobCount || 0,
      walletMethods,
      pendingProofReview,
    });
  } catch (err) {
    console.error('Error fetching payments dashboard:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب إحصائيات المدفوعات'});
  }
};

// ============================================================
// GET /api/orders/shipping-dashboard  (أدمن فقط)
// إحصائيات شاملة للشحن — aggregation بدل تحميل كل الطلبات في الميموري
// ============================================================
const getShippingDashboard = async (req, res) => {
  try {
    const statusCountsAgg = await Order.aggregate([
      { $group: { _id: { $ifNull: ['$shippingStatus', 'pending'] }, count: { $sum: 1 } } },
    ]);

    const stats = {
      pending: 0, preparing: 0, shipped: 0, delivered: 0, failedDelivery: 0, returned: 0,
      companies: {},
      issues: [],
      shippedOrders: [],
    };

    const statusKeyMap = {
      pending: 'pending', preparing: 'preparing', shipped: 'shipped',
      delivered: 'delivered', failed_delivery: 'failedDelivery', returned: 'returned',
    };
    statusCountsAgg.forEach((s) => {
      const key = statusKeyMap[s._id];
      if (key) stats[key] = s.count;
    });

    const companiesAgg = await Order.aggregate([
      { $match: { shippingCompany: { $ne: null } } },
      {
        $group: {
          _id: '$shippingCompany',
          count: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$shippingStatus', 'delivered'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $in: ['$shippingStatus', ['failed_delivery', 'returned']] }, 1, 0] } },
        },
      },
    ]);
    companiesAgg.forEach((c) => {
      stats.companies[c._id] = { count: c.count, delivered: c.delivered, failed: c.failed };
    });

    // مشاكل الشحن — بحد أقصى آمن (أحدث 200)
    const issuesDocs = await Order.find({
      $or: [
        { shippingStatus: 'failed_delivery' },
        { shippingStatus: 'returned' },
        { shippingNotes: { $nin: [null, ''] } },
      ],
    })
      .select('customerName customerPhone governorate shippingStatus shippingCompany trackingNumber shippingNotes totalAmount createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    stats.issues = issuesDocs;

    // الطلبات المشحونة مع tracking — بحد أقصى آمن (أحدث 200)
    const shippedDocs = await Order.find({ trackingNumber: { $ne: null } })
      .select('customerName customerPhone governorate shippingStatus shippingCompany trackingNumber shippedAt totalAmount')
      .sort({ shippedAt: -1 })
      .limit(200)
      .lean();
    stats.shippedOrders = shippedDocs;

    res.json(stats);
  } catch (err) {
    console.error('Error fetching shipping dashboard:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب إحصائيات الشحن'});
  }
};

// ===== FIX: خريطة تسمية عربية لحالات "طلب الاسترجاع" (returnStatus) — عشان
// الأدمن يقدر يضيفها في شاشة رسائل بيرفو زي أي حالة تانية. النظام ده اتضاف
// بعد ما بيرفو كان متظبط أصلاً، فمكانش بيبعت أي إشعار وقت ما الحالة دي تتغير.
const RETURN_STATUS_LABELS = {
  pending: 'طلب استرجاع قيد المراجعة',
  approved: 'تم قبول طلب الاسترجاع',
  rejected: 'تم رفض طلب الاسترجاع',
  carrier_picked_up: 'شركة الشحن استلمت المرتجع',
  received_at_warehouse: 'المرتجع وصل المخزن',
  inspecting: 'جاري فحص المرتجع',
  completed: 'تم استرجاع الفلوس بنجاح',
  cancelled: 'تم إلغاء طلب الاسترجاع',
};

// ============================================================
// PUT /api/orders/:id/shipping  (أدمن فقط)
// تحديث بيانات الشحن (شركة / tracking / حالة)
// ============================================================
const updateOrderShipping = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    const { shippingStatus, shippingCompany, trackingNumber, shippingNotes, returnTrackingNumber, returnStatus } = req.body;
    // ===== FIX: كنا محتاجين نعرف هل returnStatus اتغيرت فعلاً قبل ما نكتب
    // فوق القيمة القديمة، عشان نبعت إشعار مرة واحدة بس لما الحالة تتغير
    // فعليًا (نفس فكرة statusChanged في updateOrderStatus).
    const returnStatusChanged = returnStatus !== undefined && returnStatus !== order.returnStatus;

    if (shippingStatus) order.shippingStatus = shippingStatus;
    if (shippingCompany !== undefined) order.shippingCompany = shippingCompany;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
    if (shippingNotes !== undefined) order.shippingNotes = shippingNotes;
    // ===== إدخال يدوي لبيانات مرتجع شركة الشحن =====
    // مفيش شركة شحن من الأربعة عندها Return API رسمي متاح حاليًا (شوف
    // services/shipping/capabilities.js)، فالأدمن بيروح موقع شركة الشحن
    // بنفسه، يعمل طلب استرجاع، ولما تدّيله رقم تتبع بيدخله هنا يدويًا.
    if (returnTrackingNumber !== undefined) order.returnTrackingNumber = returnTrackingNumber;
    if (returnStatus !== undefined) order.returnStatus = returnStatus;

    // سجّل تواريخ تلقائية
    if (shippingStatus === 'shipped' && !order.shippedAt) order.shippedAt = new Date();
    if (shippingStatus === 'delivered' && !order.deliveredAt) order.deliveredAt = new Date();

    await order.save();
    require('../utils/cache').del('orders:all');
    // ===== FIX: نبعت إشعار الاسترجاع (لو الأدمن مضيف رسالة لها في بيرفو)
    // بعد الحفظ، بنفس منطق queueStatusNotification المستخدم مع order.status.
    if (returnStatusChanged) {
      const label = RETURN_STATUS_LABELS[returnStatus];
      if (label) await queueStatusNotification(order, label);
    }
    res.json(order);
  } catch (err) {
    console.error('Error updating order shipping:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث بيانات الشحن'});
  }
};

// ============================================================
// PUT /api/orders/:id/payment-status  (أدمن فقط)
// تحديث حالة الدفع (paid / failed / refunded) - يدوي، لطلبات wallet/cod
// بشكل أساسي (Kashier/Paymob بيتحدثوا تلقائيًا من الـwebhook، والاسترجاع
// الإلكتروني بتاعهم من /:id/refund، لكن الأدمن لسه يقدر يستخدم الـendpoint
// ده كمان في حالات استثنائية زي مطابقة يدوية).
//
// ===== P1-2: Payment State Machine Guard =====
// ده كان أخطر endpoint في الأوردر بتاع الدفع - كان بيقبل أي قيمة من الأربعة
// من غير أي فحص لحالة الطلب الحالية، يعني كان ممكن (غلط أو عن قصد من حساب
// أدمن مخترق) يرجّع paid->pending أو paid->failed أو حتى refunded->paid.
// دلوقتي كل تغيير بيعدي على applyPaymentStatusTransition (نفس الحارس
// المستخدم في الـwebhooks) قبل ما يتحفظ.
// ============================================================
const updatePaymentStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    const requestedStatus = req.body.paymentStatus;
    if (!PAYMENT_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({ message: 'حالة الدفع غير صحيحة' });
    }

    // Kashier/Paymob payment state is authoritative from gateway webhooks /
    // server-side reconciliation. This manual endpoint remains for COD/wallet
    // orders and must not fabricate an online failure/refund locally.
    if (['kashier', 'paymob'].includes(order.paymentMethod)) {
      return res.status(409).json({ message: 'حالة دفع Kashier/Paymob تتحدث تلقائيًا من البوابة. استخدم مسار الاسترجاع الإلكتروني للـrefund.' });
    }

    const previousStatus = order.paymentStatus;
    const transition = applyPaymentStatusTransition(order, requestedStatus);

    if (!transition.applied) {
      if (transition.noop) {
        // نفس الحالة الحالية بالظبط — عملية آمنة ومتكررة (idempotent)، نرجع
        // الطلب زي ما هو من غير أي خطأ.
        return res.json(order);
      }
      const reasonMessages = {
        order_cancelled: 'الطلب ده ملغي، مينفعش يتحدد كـ"مدفوع"',
      };
      const message = reasonMessages[transition.reason]
        || `تغيير حالة الدفع من "${previousStatus}" إلى "${requestedStatus}" مش مسموح به (transition غير صالح)`;
      return res.status(409).json({ message, reason: transition.reason });
    }

    // ===== اتساق المخزون مع حالة الدفع =====
    // لو الأدمن حوّل الحالة يدويًا لـ"فشل" أو "مسترجع"، لازم المخزون يرجع
    // بنفس منطق الـwebhook/الـexpiry-worker (markFailedAndReleaseStock) -
    // ده كان ناقص هنا قبل كده (الطلب كان يتعلّم "فشل"/"مسترجع" والمخزون
    // يفضل محجوز غلط لحد ما حد يلاحظ يدويًا).
    if ((requestedStatus === 'failed' || requestedStatus === 'refunded') && !order.stockRestored) {
      const stockClaim = await Order.findOneAndUpdate(
        { _id: order._id, stockRestored: false },
        { $set: { stockRestored: true, stockRestoredAt: new Date() } },
        { new: true }
      );
      if (stockClaim) {
        await restoreOrderItems(order.items);
        await logMovementsBulk(order.items, 'stock_released', {
          orderId: order._id,
          userId: req.user ? req.user._id : null,
          note: `تحديث يدوي لحالة الدفع إلى "${requestedStatus}" من الأدمن — تم إرجاع المخزون`,
        });
        order.stockRestored = true;
        order.stockRestoredAt = stockClaim.stockRestoredAt;
        invalidateProductCaches();
      } else {
        order.stockRestored = true;
      }
    }

    if (requestedStatus === 'failed') {
      try {
        if (order.customerId) {
          if (order.discountType === 'first_order') {
            await releaseFirstOrderDiscount(order.customerId);
          } else if (order.discountType === 'code' && order.discountCode && !order.discountUsageReleased) {
            const releaseClaim = await Order.findOneAndUpdate(
              { _id: order._id, discountUsageReleased: { $ne: true } },
              { $set: { discountUsageReleased: true } },
              { new: true }
            );
            if (releaseClaim) await releaseDiscountCodeUsage(String(order.discountCode).trim().toUpperCase());
          }
          if (order.discountType === 'loyalty_code' && order.usedLoyaltyCode) {
            await releaseLoyaltyCode(order.customerId, order.usedLoyaltyCode);
          }
        }
      } catch (benefitErr) {
        console.error('Manual payment status benefit release failed:', benefitErr.message);
      }
    }

    await order.save();
    require('../utils/cache').del('orders:all');
    res.json(order);
  } catch (err) {
    console.error('Error updating payment status:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث حالة الدفع'});
  }
};

// ===== FIX: نداء موحّد لبوابة الدفع الفعلية (Kashier/Paymob) =====
// ده نفس الكود اللي كان جوه refundOrderPayment بس متعمول عليه extract هنا
// عشان نقدر نستخدمه في مكان تاني كمان: reviewReturnRequest (شاشة "طلبات
// الاسترجاع") كانت بتسجل مبلغ الاسترجاع محليًا (order.refundedAmount) من
// غير ما تكلم بوابة الدفع خالص — مصممة أصلاً لطلبات الدفع عند الاستلام
// (COD)/اليدوي، اللي فيها الفلوس بترجع يدويًا (كاش/تحويل) مش عن طريق حسابنا.
// لكن نفس الشاشة دي شغالة برضو على طلبات Kashier/Paymob، وهنا المشكلة: بما
// إنها مش بتكلم بوابة الدفع، أي استرجاع منها بيتسجل عندنا "تم" فورًا (من غير
// أي تأخير شبكة) من غير ما تتحرك فلوس فعلية عند Kashier/Paymob — وده بالظبط
// اللي كنت لاحظه: الاسترجاع التاني بيرجع بسرعة جدًا (من غير التأخير اللي
// بيحصل وقت مانادي بوابة الدفع فعليًا).
const performGatewayRefund = async ({ order, amount, reason, alreadyRefunded }) => {
  let gatewayResponse;
  if (order.paymentMethod === 'kashier') {
    const kashierOrderId = order.paymentGateway?.kashierOrderId;
    const kashierTransactionId = order.paymentGateway?.transactionId;
    if (!kashierOrderId || !kashierTransactionId) {
      const err = new Error('مفيش رقم أوردر/عملية Kashier محفوظ بالكامل على الطلب ده — استرجع الفلوس يدويًا من لوحة تحكم Kashier.');
      err.code = 'GATEWAY_IDS_MISSING';
      throw err;
    }
    gatewayResponse = await refundKashierPayment({ kashierOrderId, transactionId: kashierTransactionId, amount, reason });
  } else if (order.paymentMethod === 'paymob') {
    const transactionId = order.paymentGateway?.transactionId;
    if (!transactionId) {
      const err = new Error('مفيش رقم عملية Paymob محفوظ على الطلب ده — استرجع الفلوس يدويًا من لوحة تحكم Paymob.');
      err.code = 'GATEWAY_IDS_MISSING';
      throw err;
    }
    gatewayResponse = await refundPaymobPayment({ transactionId, amountCents: Math.round(amount * 100) });
  } else {
    // كاش/تحويل يدوي (COD وغيره) — مفيش بوابة دفع نكلمها، الاسترجاع بيتسجل
    // محليًا بس زي ما كان دايمًا (ده السلوك الصحيح للطلبات دي).
    return { gatewayResponse: null, confirmedRefundedAmount: null };
  }

  // نتأكد من Kashier مباشرة بعد الاسترجاع "الناجح" — عشان لو استرجاع اتنين
  // حصلوا قريبين من بعض على نفس العملية وKashier عاملة dedupe من غير ما
  // تسحب فلوس تانية فعليًا، نصدق رقمها الحقيقي مش حسابنا المحلي.
  let confirmedRefundedAmount = null;
  if (order.paymentMethod === 'kashier') {
    try {
      const status = await getKashierOrderStatus(order.paymentGateway?.kashierOrderId);
      if (status && Number.isFinite(status.totalRefundedAmount)) {
        confirmedRefundedAmount = status.totalRefundedAmount;
        const expected = Math.round((Number(alreadyRefunded || 0) + amount) * 100) / 100;
        if (Math.abs(confirmedRefundedAmount - expected) > 0.01) {
          console.warn(`Refund amount mismatch for order ${order._id}: gateway confirms total refunded = ${confirmedRefundedAmount}, expected = ${expected}. Recording gateway's real number.`);
        }
      }
    } catch (verifyErr) {
      console.error('Post-refund verification failed (Kashier):', verifyErr?.message);
    }
  }

  return { gatewayResponse, confirmedRefundedAmount };
};

// PUT /api/orders/:id/refund  (أدمن - استرجاع فلوس Kashier/Paymob كامل أو جزئي)
// بيستخدم مراجع بوابة الدفع (paymentGateway) اللي بتتسجل تلقائيًا وقت الدفع
// عشان ينادي refund API بتاع البوابة نفسها، فالفلوس ترجع فعليًا لكارت/محفظة
// العميل — مش مجرد تغيير شكل الحالة عندنا.
const refundOrderPayment = async (req, res) => {
  // ===== FIX: قفل ذري (atomic lock) يمنع تنفيذ استرجاعين على نفس الطلب في
  // نفس الوقت (مثلاً دبل-كليك أو ضغطتين سريعتين من الأدمن). findOneAndUpdate
  // هنا عملية واحدة ذرية في MongoDB (مش قراءة ثم كتابة منفصلتين)، فلو الطلبين
  // وصلوا في نفس اللحظة تقريبًا، واحد بس هو اللي هياخد الطلب ويكمل، والتاني
  // هيلاقي refundInProgress اتقفل بالفعل ويرجع رسالة واضحة بدل ما ينادي بوابة
  // الدفع تاني بنفس المبلغ (وده اللي كان بيسبب "استرجاع مرتين بيتسجل مرتين
  // محليًا بينما البوابة فعليًا نفذت واحدة بس").
  let order;
  try {
    const refundLockStaleBefore = new Date(Date.now() - 10 * 60 * 1000);
    order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [
          { refundInProgress: { $ne: true } },
          { refundInProgress: true, refundInProgressAt: { $lte: refundLockStaleBefore } },
          { refundInProgress: true, refundInProgressAt: null },
        ],
      },
      { $set: { refundInProgress: true, refundInProgressAt: new Date() } },
      { new: true }
    );
    if (!order) {
      const exists = await Order.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ message: 'الطلب مش موجود' });
      return res.status(409).json({ message: 'في عملية استرجاع شغالة على الطلب ده دلوقتي — استنى شوية وحاول تاني' });
    }
  } catch (lockErr) {
    console.error('Error acquiring refund lock:', lockErr);
    return res.status(500).json({ message: 'حصل خطأ في تحديث حالة الدفع' });
  }

  try {

    if (!['kashier', 'paymob'].includes(order.paymentMethod)) {
      return res.status(400).json({ message: 'الاسترجاع الإلكتروني ده متاح بس لطلبات Kashier و Paymob' });
    }
    // ===== P1-2: نفس الحارس المركزي (paid->refunded هو الـtransition الوحيد
    // المسموح بيه) - بدل فحص مكرر بالنص، عشان أي تعديل لاحق على القواعد
    // يحصل في مكان واحد بس (services/paymentStateMachine.js).
    if (!canTransitionPaymentStatus(order.paymentStatus, 'refunded', order).ok) {
      return res.status(400).json({ message: 'الطلب ده مش في حالة "مدفوع"، مينفعش تسترجع فلوسه' });
    }

    const alreadyRefundedLocal = Math.round(Number(order.refundedAmount || 0) * 100) / 100;

    // ===== Reconciliation: ask the gateway itself directly, first =====
    // Protects against double refunds when a refund was issued straight from
    // the Kashier/Paymob dashboard and our local record hasn't caught up yet
    // (most commonly because the webhook isn't configured/reachable — e.g.
    // still running on localhost). This works whether or not the webhook is
    // set up, since it asks the gateway instead of waiting for it to tell us.
    let alreadyRefunded = alreadyRefundedLocal;
    try {
      if (order.paymentMethod === 'kashier' && order.paymentGateway?.kashierOrderId) {
        const status = await getKashierOrderStatus(order.paymentGateway.kashierOrderId);
        if (status && Number.isFinite(status.totalRefundedAmount) && status.totalRefundedAmount > alreadyRefundedLocal + 0.01) {
          const diff = Math.round((status.totalRefundedAmount - alreadyRefundedLocal) * 100) / 100;
          order.refunds = order.refunds || [];
          order.refunds.push({
            amount: diff,
            reason: 'Refund detected directly from Kashier (issued outside this app — reconciled automatically before attempting a new one)',
            at: new Date(),
            by: null,
            gatewayResponse: status.raw,
          });
          order.refundedAmount = status.totalRefundedAmount;
          alreadyRefunded = status.totalRefundedAmount;
        }
      } else if (order.paymentMethod === 'paymob' && order.paymentGateway?.transactionId) {
        const status = await getPaymobTransactionStatus(order.paymentGateway.transactionId);
        if (status && status.isRefunded && alreadyRefundedLocal < Number(order.totalAmount || 0) - 0.01) {
          // Paymob's inquiry API only exposes a yes/no "is_refunded" flag (no
          // partial-refund breakdown), so a detected refund is treated as
          // covering the full order.
          const diff = Math.round((Number(order.totalAmount || 0) - alreadyRefundedLocal) * 100) / 100;
          order.refunds = order.refunds || [];
          order.refunds.push({
            amount: diff,
            reason: 'Refund detected directly from Paymob (issued outside this app — reconciled automatically before attempting a new one)',
            at: new Date(),
            by: null,
            gatewayResponse: status.raw,
          });
          order.refundedAmount = Number(order.totalAmount || 0);
          alreadyRefunded = order.refundedAmount;
        }
      }
    } catch (reconcileErr) {
      // Don't let a failed check (network hiccup etc.) block a legitimate
      // refund attempt — just proceed with what we know locally.
      console.error('Refund reconciliation check failed (continuing with local data):', reconcileErr);
    }

    const remaining = Math.round((Number(order.totalAmount || 0) - alreadyRefunded) * 100) / 100;
    if (remaining <= 0) {
      applyPaymentStatusTransition(order, 'refunded');
      if (!order.stockRestored) {
        await restoreOrderItems(order.items);
        await logMovementsBulk(order.items, 'stock_released', {
          orderId: order._id,
          userId: req.user ? req.user._id : null,
          note: 'استرجاع فلوس كامل (متسجل من البوابة مباشرة) — تم إرجاع المخزون',
        });
        order.stockRestored = true;
        order.stockRestoredAt = new Date();
        invalidateProductCaches();
      }
      await order.save();
      require('../utils/cache').del('orders:all');
      return res.json(order);
    }

    // لو مبعتش amount، بنعتبرها استرجاع كامل للباقي (remaining)
    let amount = req.body.amount != null && req.body.amount !== ''
      ? Number(req.body.amount)
      : remaining;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'المبلغ المطلوب استرجاعه غير صحيح' });
    }
    if (amount > remaining + 0.01) {
      return res.status(400).json({ message: `أقصى مبلغ ينفع تسترجعه دلوقتي هو ${remaining}` });
    }
    amount = Math.min(amount, remaining);

    const reason = String(req.body.reason || '').trim() || 'Refund requested from admin dashboard';

    let gatewayResponse;
    try {
      if (order.paymentMethod === 'kashier') {
        const kashierOrderId = order.paymentGateway?.kashierOrderId;
        const kashierTransactionId = order.paymentGateway?.transactionId;
        if (!kashierOrderId || !kashierTransactionId) {
          return res.status(400).json({
            message: 'مفيش رقم أوردر/عملية Kashier محفوظ بالكامل على الطلب ده (غالبًا لأنه اتدفع قبل تفعيل الاسترجاع من هنا، أو الـ webhook مكنش مضبوط وقتها) — استرجع الفلوس يدويًا من لوحة تحكم Kashier.',
          });
        }
        gatewayResponse = await refundKashierPayment({ kashierOrderId, transactionId: kashierTransactionId, amount, reason });
      } else {
        const transactionId = order.paymentGateway?.transactionId;
        if (!transactionId) {
          return res.status(400).json({
            message: 'مفيش رقم عملية Paymob محفوظ على الطلب ده (غالبًا لأنه اتدفع قبل تفعيل الاسترجاع من هنا، أو الـ webhook مكنش مضبوط وقتها) — استرجع الفلوس يدويًا من لوحة تحكم Paymob.',
          });
        }
        gatewayResponse = await refundPaymobPayment({ transactionId, amountCents: Math.round(amount * 100) });
      }
    } catch (gatewayErr) {
      console.error('Refund gateway error:', gatewayErr);
      return res.status(502).json({
        message: `فشل الاسترجاع من بوابة الدفع: ${gatewayErr.message}`,
      });
    }

    // ===== FIX: التحقق الحقيقي من المبلغ بعد الاسترجاع مباشرة =====
    // اتضح إن قفل الطلب (فوق) بيمنع تضارب الطلبات عندنا فعلاً، لكن المشكلة
    // الحقيقية كانت من بوابة الدفع نفسها: لو استرجعت مرتين على نفس العملية
    // (transaction) بفارق وقت قصير جدًا، Kashier أحيانًا بترجع رد "نجاح" تاني
    // بيعكس نتيجة الاسترجاع الأول (status: REFUNDED/PARTIALLY_REFUNDED) من
    // غير ما تكون فعليًا سحبت فلوس إضافية — وكودنا كان بيصدق أي رد "نجاح"
    // ويزود refundedAmount بالمبلغ اللي طلبناه، حتى لو البوابة ماسحبتش حاجة
    // إضافية فعلاً. الحل: بعد أي استرجاع "ناجح"، نسأل Kashier مباشرة تاني
    // "كام اترجع فعليًا لحد دلوقتي؟" (نفس endpoint استعلام الحالة اللي
    // مستخدمينه في reconciliation) ونصدق الرقم ده، مش حسابنا المحلي.
    let confirmedRefundedAmount = null;
    if (order.paymentMethod === 'kashier') {
      try {
        const kashierOrderId = order.paymentGateway?.kashierOrderId;
        const status = await getKashierOrderStatus(kashierOrderId);
        if (status && Number.isFinite(status.totalRefundedAmount)) {
          confirmedRefundedAmount = status.totalRefundedAmount;
        }
      } catch (verifyErr) {
        console.error('Post-refund verification failed (Kashier):', verifyErr?.message);
      }
    }

    order.refunds = order.refunds || [];
    order.refunds.push({
      amount,
      reason,
      at: new Date(),
      by: req.user ? req.user._id : null,
      gatewayResponse,
    });

    if (confirmedRefundedAmount != null) {
      // لو رقم Kashier الحقيقي أقل من (اللي كان اترجع + المبلغ ده)، يبقى
      // البوابة فعليًا ما سحبتش المبلغ كامل (على الأغلب استرجاع مكرر) —
      // نسجل رقم Kashier الحقيقي بدل ما نضيف مبلغ ماتحركش فعليًا، ونحذر في
      // اللوج عشان يبان في السجلات إن ده حصل.
      const expected = Math.round((alreadyRefunded + amount) * 100) / 100;
      if (Math.abs(confirmedRefundedAmount - expected) > 0.01) {
        console.warn(`Refund amount mismatch for order ${order._id}: gateway confirms total refunded = ${confirmedRefundedAmount}, expected = ${expected}. Recording gateway's real number (likely a duplicate/deduped refund on Kashier's side).`);
      }
      order.refundedAmount = Math.round(confirmedRefundedAmount * 100) / 100;
    } else {
      // معرفناش نتأكد من Kashier (أو Paymob، اللي مفيش عنده API بيرجع رقم
      // جزئي أصلاً) — نرجع للحساب المحلي القديم زي ما هو.
      order.refundedAmount = Math.round((alreadyRefunded + amount) * 100) / 100;
    }

    const isFullyRefunded = order.refundedAmount >= Number(order.totalAmount || 0) - 0.01;
    if (isFullyRefunded) {
      applyPaymentStatusTransition(order, 'refunded');

      if (!order.stockRestored) {
        await restoreOrderItems(order.items);
        await logMovementsBulk(order.items, 'stock_released', {
          orderId: order._id,
          userId: req.user ? req.user._id : null,
          note: 'استرجاع فلوس كامل من لوحة التحكم — تم إرجاع المخزون',
        });
        order.stockRestored = true;
        order.stockRestoredAt = new Date();
        invalidateProductCaches();
      }
    }

    await order.save();
    require('../utils/cache').del('orders:all');
    res.json(order);
  } catch (err) {
    console.error('Error refunding order payment:', err);
    res.status(500).json({ message: 'حصل خطأ في استرجاع الفلوس'});
  } finally {
    // ===== FIX: فك القفل دايمًا مهما كانت نتيجة الطلب (نجح/فشل/رجع بدري) —
    // بـupdateOne مباشر بدل order.save() عشان منتعارضش مع أي تعديلات تانية
    // اتعملت على order.refunds/refundedAmount فوق (ومنعمل duplicate save).
    await Order.updateOne({ _id: order._id }, { $set: { refundInProgress: false, refundInProgressAt: null } }).catch((e) => {
      console.error('Failed to release refund lock:', e);
    });
  }
};

// POST /api/orders/:id/return-request  (عميل مسجل - يطلب استرجاع منتج/منتجات من طلبه)
const requestReturn = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    if (!req.user || String(order.customerId || '') !== String(req.user._id)) {
      return res.status(403).json({ message: 'الطلب ده مش تابع لحسابك' });
    }

    if (order.returnRequestStatus === 'pending' || order.returnRequestStatus === 'approved') {
      return res.status(400).json({ message: 'فيه طلب استرجاع لنفس الطلب ده اتسجل بالفعل' });
    }

    const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (requestedItems.length === 0) {
      return res.status(400).json({ message: 'اختار على الأقل منتج واحد عايز تسترجعه' });
    }

    // ===== سبب الاسترجاع + التحقق من الأهلية (Settings + نافذة زمنية) =====
    // reasonCode لازم يتحدد قبل التحقق من الأهلية عشان النافذة الزمنية بتختلف
    // لو السبب "عيب في المنتج/منتج غلط" (defectiveProductWindow) عن باقي الأسباب.
    const settingsDoc = await Settings.findOne().lean();
    const reasonCode = isValidReasonCode(req.body.reasonCode, settingsDoc) ? req.body.reasonCode : 'other';

    const eligibility = checkEligibility({ order, type: 'return', reasonCode, settings: settingsDoc });
    if (!eligibility.eligible) {
      return res.status(400).json({ message: eligibility.message });
    }

    // ===== صور الإثبات (لو مطلوبة للسبب ده حسب الإعدادات) =====
    const evidenceImages = Array.isArray(req.body.evidenceImages)
      ? req.body.evidenceImages.filter((u) => typeof u === 'string' && u.trim()).slice(0, 10)
      : [];
    if (isEvidenceRequired({ type: 'return', reasonCode, settings: settingsDoc }) && evidenceImages.length === 0) {
      return res.status(400).json({ message: 'من فضلك ارفع صورة إثبات واحدة على الأقل لهذا السبب' });
    }

    const validatedItems = [];
    for (const reqItem of requestedItems) {
      const quantity = Number(reqItem.quantity);
      if (!isValidQuantity(quantity)) {
        return res.status(400).json({ message: 'كمية غير صحيحة في أحد المنتجات المطلوب استرجاعها' });
      }
      const matchingItem = order.items.find(oi =>
        String(oi.productId) === String(reqItem.productId) &&
        String(oi.variantId || '') === String(reqItem.variantId || '') &&
        String(oi.size || '') === String(reqItem.size || '')
      );
      if (!matchingItem) {
        return res.status(400).json({ message: 'أحد المنتجات المطلوب استرجاعها مش موجود في هذا الطلب' });
      }
      if (quantity > matchingItem.quantity) {
        return res.status(400).json({ message: `الكمية المطلوب استرجاعها من "${matchingItem.name?.ar || matchingItem.name?.en || ''}" أكبر من الكمية المشتراة` });
      }
      validatedItems.push({
        productId: matchingItem.productId,
        variantId: matchingItem.variantId || null,
        size: matchingItem.size || null,
        quantity,
        reason: typeof reqItem.reason === 'string' ? reqItem.reason.trim().slice(0, 300) : null,
      });
    }

    // ===== Snapshot الرسوم وقت إنشاء الطلب (بند 5 + 6) =====
    // بتتحسب دلوقتي بناءً على Settings الحالية ومتتأثرش لو الأدمن غيّرها بعد
    // كده. returnFeeCharged بيفضل بردو موجود للتوافق مع الكود القديم اللي
    // بيقرأه، لكن دلوقتي بيتحدد هنا (وقت الطلب) مش وقت الموافقة بس.
    const feeSnapshot = computeFee({ type: 'return', reasonCode, settings: settingsDoc });

    order.returnItems = validatedItems;
    order.returnRequestedBy = 'customer';
    order.returnRequestStatus = 'pending';
    order.returnRequestReason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null;
    order.returnRequestReasonCode = reasonCode;
    order.returnRequestedAt = new Date();
    order.returnReviewedBy = null;
    order.returnReviewedAt = null;
    order.returnAdminNote = null;
    order.returnFeeCharged = feeSnapshot.fee;
    order.returnFeeCurrency = feeSnapshot.currency;
    order.returnFeeType = feeSnapshot.feeType;
    order.returnEvidenceImages = evidenceImages;
    order.returnStatusHistory = order.returnStatusHistory || [];
    order.returnStatusHistory.push({ status: 'pending', at: new Date(), by: req.user._id, note: 'العميل قدّم طلب استرجاع' });

    await order.save();
    require('../utils/cache').del('orders:all');
    // هذا الـendpoint للعميل صاحب الطلب بس (اتحقق فوق) - projection آمنة.
    res.json(toCustomerOrderView(order));
  } catch (err) {
    console.error('Error requesting return:', err);
    res.status(500).json({ message: 'حصل خطأ في تسجيل طلب الاسترجاع'});
  }
};

// PUT /api/orders/:id/return-request  (أدمن - يوافق/يرفض طلب استرجاع، أو يبدأ استرجاع بنفسه)
const reviewReturnRequest = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    const action = req.body.action; // 'approve' | 'reject' | 'create'

    if (action === 'reject') {
      if (order.returnRequestStatus !== 'pending') {
        return res.status(400).json({ message: 'مفيش طلب استرجاع قيد المراجعة لهذا الطلب' });
      }
      order.returnRequestStatus = 'rejected';
      order.returnReviewedBy = req.user ? req.user._id : null;
      order.returnReviewedAt = new Date();
      if (typeof req.body.adminNote === 'string' && req.body.adminNote.trim()) {
        order.returnAdminNote = req.body.adminNote.trim().slice(0, 500);
      }
      order.returnStatusHistory = order.returnStatusHistory || [];
      order.returnStatusHistory.push({ status: 'rejected', at: new Date(), by: req.user ? req.user._id : null, note: order.returnAdminNote });
      await order.save();
      require('../utils/cache').del('orders:all');
      // ===== FIX: نفس فكرة إشعارات returnStatus فوق — طلب الاسترجاع نفسه
      // (مش بس تتبع الشحنة) اتضاف بعد ما بيرفو كان متظبط، فمكانش بيبعت إشعار.
      await queueStatusNotification(order, RETURN_STATUS_LABELS.rejected);
      return res.json(order);
    }

    if (action === 'approve' || action === 'create') {
      if (action === 'approve' && order.returnRequestStatus !== 'pending') {
        return res.status(400).json({ message: 'مفيش طلب استرجاع قيد المراجعة لهذا الطلب' });
      }
      if (action === 'create' && (order.returnRequestStatus === 'pending' || order.returnRequestStatus === 'approved')) {
        return res.status(400).json({ message: 'فيه طلب استرجاع مسجل بالفعل لهذا الطلب' });
      }

      // الأدمن يقدر يعدّل/يحدد المنتجات بنفسه (action='create') أو يستخدم
      // نفس المنتجات اللي طلبها العميل (action='approve' بدون items في الـbody).
      const rawItems = Array.isArray(req.body.items) ? req.body.items : order.returnItems;
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return res.status(400).json({ message: 'اختار على الأقل منتج واحد للاسترجاع' });
      }

      const validatedItems = [];
      let refundAmount = 0;
      for (const reqItem of rawItems) {
        const quantity = Number(reqItem.quantity);
        if (!isValidQuantity(quantity)) {
          return res.status(400).json({ message: 'كمية غير صحيحة في أحد المنتجات' });
        }
        const matchingItem = order.items.find(oi =>
          String(oi.productId) === String(reqItem.productId) &&
          String(oi.variantId || '') === String(reqItem.variantId || '') &&
          String(oi.size || '') === String(reqItem.size || '')
        );
        if (!matchingItem) {
          return res.status(400).json({ message: 'أحد المنتجات مش موجود في هذا الطلب' });
        }
        if (quantity > matchingItem.quantity) {
          return res.status(400).json({ message: `الكمية أكبر من الكمية المشتراة لمنتج "${matchingItem.name?.ar || matchingItem.name?.en || ''}"` });
        }
        validatedItems.push({
          productId: matchingItem.productId,
          variantId: matchingItem.variantId || null,
          size: matchingItem.size || null,
          quantity,
          reason: typeof reqItem.reason === 'string' ? reqItem.reason.trim().slice(0, 300) : null,
        });
        refundAmount += Number(matchingItem.price || 0) * quantity;
      }
      refundAmount = Math.round(refundAmount * 100) / 100;

      // ===== رسوم شحن الاسترجاع (Snapshot - بند 6) =====
      // لو الأدمن غيّر السبب وقت المراجعة (عدّل/صحّح reasonCode) أو كان action=
      // 'create' (طلب بدأه الأدمن نفسه ومفيهوش Snapshot اتحفظ قبل كده)، بنعيد
      // حساب الرسوم دلوقتي بناءً على Settings الحالية. غير كده، بنستخدم الـ
      // Snapshot اللي اتحفظ وقت ما العميل قدّم الطلب أصلاً (requestReturn) -
      // عشان تغيير الإعدادات بعد كده متأثرش على طلب مسجل بالفعل.
      const reviewSettingsDoc = await Settings.findOne().lean();
      const reasonCodeOverridden = isValidReasonCode(req.body.reasonCode, reviewSettingsDoc) && req.body.reasonCode !== order.returnRequestReasonCode;
      const effectiveReasonCode = isValidReasonCode(req.body.reasonCode, reviewSettingsDoc)
        ? req.body.reasonCode
        : order.returnRequestReasonCode;
      if (effectiveReasonCode) {
        order.returnRequestReasonCode = effectiveReasonCode;
      }

      let feeSnapshot;
      if (action === 'create' || reasonCodeOverridden || !order.returnFeeType) {
        const settingsDoc = reviewSettingsDoc;
        const eligibility = checkEligibility({ order, type: 'return', reasonCode: effectiveReasonCode, settings: settingsDoc });
        if (action === 'create' && !eligibility.eligible) {
          return res.status(400).json({ message: eligibility.message });
        }
        feeSnapshot = computeFee({ type: 'return', reasonCode: effectiveReasonCode, settings: settingsDoc });
      } else {
        // استخدم الـSnapshot المحفوظ بالفعل من وقت الطلب (بدون إعادة حساب)
        feeSnapshot = { fee: Number(order.returnFeeCharged || 0), currency: order.returnFeeCurrency || 'EGP', feeType: order.returnFeeType };
      }

      // الرسوم متخصمش أكتر من مبلغ الاسترجاع نفسه (تفضل صفر كحد أدنى).
      const returnFeeCharged = Math.min(feeSnapshot.fee, refundAmount);
      refundAmount = Math.round((refundAmount - returnFeeCharged) * 100) / 100;

      // ===== FIX: منرجعش المخزون هنا خالص دلوقتي =====
      // قبل كده كان المخزون بيرجع فورًا وقت الموافقة (قبل ما المنتج يوصل
      // فعليًا أو حد يشوفه أصلاً) - ده غلط لأن المنتج ممكن يرجع تالف/منقوص.
      // دلوقتي المخزون بيفضل "معلّق" لحد ما الأدمن يعمل "معاينة" صريحة بعد
      // ما المنتج يوصل فعليًا (شوف inspectReturnRequest تحت + زرار "معاينة"
      // في الفرونت) - يرجع للمخزون بس لو المعاينة "كويس".
      order.returnInspectionResult = 'pending';

      // ===== تسجيل مبلغ الاسترجاع =====
      const currentRefunded = Number(order.refundedAmount || 0);
      const newRefundedAmount = Math.min(Number(order.totalAmount || 0), Math.round((currentRefunded + refundAmount) * 100) / 100);
      order.refunds = order.refunds || [];
      const baseRefundNote = (typeof req.body.adminNote === 'string' && req.body.adminNote.trim()) || 'استرجاع منتجات محددة من الطلب';
      order.refunds.push({
        amount: refundAmount,
        reason: returnFeeCharged > 0
          ? `${baseRefundNote} (بعد خصم ${returnFeeCharged} ج.م رسوم شحن استرجاع)`
          : baseRefundNote,
        at: new Date(),
        by: req.user ? req.user._id : null,
      });
      order.refundedAmount = newRefundedAmount;
      order.returnFeeCharged = returnFeeCharged;
      order.returnFeeCurrency = feeSnapshot.currency;
      order.returnFeeType = feeSnapshot.feeType;

      order.returnItems = validatedItems;
      order.returnRequestedBy = order.returnRequestedBy || (action === 'create' ? 'admin' : 'customer');
      order.returnRequestStatus = 'approved';
      order.returnReviewedBy = req.user ? req.user._id : null;
      order.returnReviewedAt = new Date();
      if (typeof req.body.adminNote === 'string' && req.body.adminNote.trim()) {
        order.returnAdminNote = req.body.adminNote.trim().slice(0, 500);
      }
      if (req.body.returnShippingCost !== undefined && req.body.returnShippingCost !== null && req.body.returnShippingCost !== '') {
        const cost = Number(req.body.returnShippingCost);
        if (Number.isFinite(cost) && cost >= 0) order.returnShippingCost = cost;
      }
      if (!order.returnRequestedAt) order.returnRequestedAt = new Date();

      // لو كل الكميات اللي في الطلب اترجعت بالكامل، نعتبر الطلب "مرتجع" كليًا
      // (يخرج من حسابات "الطلبات المتسلمة" في لوحة البيانات تلقائيًا).
      // ده مجرد "لابل" لحالة الطلب - مبيأثرش على المخزون (شوف تعليق
      // returnInspectionResult فوق - المخزون منفصل تمامًا ومعلّق للمعاينة).
      const totalOrderedQty = order.items.reduce((s, i) => s + (i.quantity || 1), 0);
      const totalReturnedQty = validatedItems.reduce((s, i) => s + (i.quantity || 1), 0);
      if (totalReturnedQty >= totalOrderedQty) {
        order.status = 'مرتجع';
      }

      order.returnStatusHistory = order.returnStatusHistory || [];
      order.returnStatusHistory.push({ status: 'approved', at: new Date(), by: req.user ? req.user._id : null, note: order.returnAdminNote });

      await order.save();
      require('../utils/cache').del('orders:all');
      // ===== FIX: نفس التعليق فوق — إشعار قبول طلب الاسترجاع.
      await queueStatusNotification(order, RETURN_STATUS_LABELS.approved);
      return res.json(order);
    }

    return res.status(400).json({ message: 'action غير معروف - المتاح: approve, reject, create' });
  } catch (err) {
    console.error('Error reviewing return request:', err);
    res.status(500).json({ message: 'حصل خطأ في مراجعة طلب الاسترجاع'});
  }
};

// ============================================================================
// PUT /api/orders/:id/return-request/inspect  (أدمن)
// ------------------------------------------------------------------------
// "معاينة" المنتج المرتجع بعد ما يوصل فعليًا (بعد الموافقة على الاسترجاع).
// ده اللي بيقرر هل المخزون يرجع فعلاً ولا لأ:
//   - result='good'  -> المنتج سليم -> يرجع للمخزون (restoreOrderItems).
//   - result='bad'   -> المنتج تالف/مش سليم -> منرجعوش للمخزون خالص.
// لازم الطلب يكون returnRequestStatus='approved' و returnInspectionResult
// لسه 'pending' (لسه ما اتعاينش) - عشان منرجعش/نمنع المخزون مرتين لو نفس
// الـendpoint اتنادى مرتين بالغلط.
// ============================================================================
const inspectReturnRequest = async (req, res) => {
  try {
    const { result, note } = req.body;
    if (!['good', 'bad'].includes(result)) {
      return res.status(400).json({ message: "نتيجة المعاينة لازم تكون 'good' أو 'bad'" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });

    // ===== FIX: كانت الشرط قبل كده بتقبل بس returnRequestStatus === 'approved'
    // بالظبط، فلو الأدمن قدّم في مراحل الشحن (carrier_picked_up ->
    // received_at_warehouse -> inspecting - شوف updateReturnStatus/
    // RETURN_WORKFLOW_ORDER) قبل ما يعاين المنتج فعليًا، كان الـendpoint بيرفض
    // المعاينة نهائيًا رغم إن ده بالظبط وقتها الطبيعي (لما المنتج يوصل
    // فعليًا للمخزن). دلوقتي بنقبل المعاينة في أي مرحلة من مراحل الاسترجاع
    // بعد الموافقة ولحد "inspecting" (مش بعد ما يخلص completed/يتلغي) =====
    const inspectableReturnStatuses = ['approved', 'carrier_picked_up', 'received_at_warehouse', 'inspecting'];
    if (!inspectableReturnStatuses.includes(order.returnRequestStatus)) {
      return res.status(400).json({ message: 'لازم الاسترجاع يكون approved الأول قبل المعاينة' });
    }
    if (order.returnInspectionResult && order.returnInspectionResult !== 'pending') {
      return res.status(400).json({ message: 'المنتج ده اتعاين بالفعل' });
    }
    if (!Array.isArray(order.returnItems) || order.returnItems.length === 0) {
      return res.status(400).json({ message: 'مفيش منتجات مسجلة للاسترجاع ده' });
    }

    if (result === 'good') {
      await restoreOrderItems(order.returnItems);
      await logMovementsBulk(order.returnItems, 'stock_returned', {
        orderId: order._id,
        userId: req.user ? req.user._id : null,
        note: 'إرجاع مخزون بعد معاينة الاسترجاع - المنتج سليم',
      });
      invalidateProductCaches();
      order.returnStockRestored = true;
      order.returnStockRestoredAt = new Date();
    }
    // result === 'bad': منلمسش المخزون خالص - المنتج تالف/مش سليم.

    order.returnInspectionResult = result;
    order.returnInspectedAt = new Date();
    order.returnInspectedBy = req.user ? req.user._id : null;
    if (typeof note === 'string' && note.trim()) {
      order.returnInspectionNote = note.trim().slice(0, 500);
    }

    order.returnStatusHistory = order.returnStatusHistory || [];
    order.returnStatusHistory.push({
      status: result === 'good' ? 'inspected_good' : 'inspected_bad',
      at: new Date(),
      by: req.user ? req.user._id : null,
      note: order.returnInspectionNote,
    });

    await order.save();
    require('../utils/cache').del('orders:all');
    return res.json(order);
  } catch (err) {
    console.error('Error inspecting return request:', err);
    res.status(500).json({ message: 'حصل خطأ في معاينة الاسترجاع' });
  }
};

// GET /api/orders/return-requests  (أدمن) - Phase 2B: قايمة كل طلبات الاسترجاع
// (الطلبات اللي returnRequestStatus بتاعها != 'none') مع بحث/فلترة/pagination.
// نفس فكرة getExchangeRequests بالظبط، لكن هنا بندوّر جوه Order مش collection مستقلة.
const getReturnRequests = async (req, res) => {
  try {
    const filter = { returnRequestStatus: { $ne: 'none' } };
    if (req.query.status) filter.returnRequestStatus = req.query.status;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.returnRequestedAt = {};
      if (req.query.dateFrom) {
        const from = new Date(req.query.dateFrom);
        if (!Number.isNaN(from.getTime())) filter.returnRequestedAt.$gte = from;
      }
      if (req.query.dateTo) {
        const to = new Date(req.query.dateTo);
        if (!Number.isNaN(to.getTime())) filter.returnRequestedAt.$lte = to;
      }
    }
    if (req.query.search) {
      const s = String(req.query.search).trim();
      if (s) {
        const orConditions = [
          { customerName: { $regex: s, $options: 'i' } },
          { customerPhone: { $regex: s, $options: 'i' } },
        ];
        if (mongoose.isValidObjectId(s)) orConditions.push({ _id: s });
        filter.$or = orConditions;
      }
    }

    const { isPaginated, page, limit, skip } = parsePagination(req.query);
    const projection = {
      orderNumber: 1, customerName: 1, customerPhone: 1, customerId: 1, items: 1,
      returnItems: 1, returnRequestedBy: 1, returnRequestStatus: 1,
      returnRequestReason: 1, returnRequestReasonCode: 1, returnRequestedAt: 1,
      returnReviewedBy: 1, returnReviewedAt: 1, returnAdminNote: 1,
      returnFeeCharged: 1, returnFeeCurrency: 1, returnFeeType: 1,
      returnEvidenceImages: 1, returnStatusHistory: 1, createdAt: 1,
      returnRefundAmount: 1, returnRefundMethod: 1, returnRefundTransferredAt: 1,
      returnRefundTransferredBy: 1, returnRefundReference: 1, refundedAmount: 1,
    };
    const [orders, total] = await Promise.all([
      Order.find(filter, projection).sort({ returnRequestedAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    // كل عنصر في القائمة بيتحول لشكل "طلب" واضح (Request ID = رقم الطلب نفسه
    // لأن الاسترجاع مدمج جوه Order مش collection مستقلة زي الاستبدال).
    const items = orders.map((o) => ({
      requestId: String(o._id),
      orderId: o._id,
      orderNumber: o.orderNumber,
      type: 'return',
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerId: o.customerId,
      items: o.returnItems,
      orderItems: o.items,
      status: o.returnRequestStatus,
      requestedBy: o.returnRequestedBy,
      reason: o.returnRequestReason,
      reasonCode: o.returnRequestReasonCode,
      createdAt: o.returnRequestedAt || o.createdAt,
      reviewedBy: o.returnReviewedBy,
      reviewedAt: o.returnReviewedAt,
      adminNote: o.returnAdminNote,
      fee: o.returnFeeCharged,
      currency: o.returnFeeCurrency || 'EGP',
      feeType: o.returnFeeType,
      evidenceImages: o.returnEvidenceImages,
      statusHistory: o.returnStatusHistory,
      refundAmount: o.returnRefundAmount,
      refundMethod: o.returnRefundMethod,
      refundTransferredAt: o.returnRefundTransferredAt,
      refundTransferredBy: o.returnRefundTransferredBy,
      refundReference: o.returnRefundReference,
      suggestedRefundAmount: o.refundedAmount,
    }));

    res.json(buildListResponse({ isPaginated, page, limit, items, total }));
  } catch (err) {
    console.error('Error fetching return requests:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب طلبات الاسترجاع'});
  }
};

// GET /api/orders/:id/return-request  (المالك أو الأدمن) - Phase 2B: تفاصيل طلب استرجاع واحد
const getReturnRequestDetails = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'الطلب مش موجود' });
    }
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    const isOwner = req.user && String(order.customerId || '') === String(req.user._id);
    const isPrivileged = req.user && (req.user.role === 'admin' || req.user.role === 'call_center');
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ message: 'مالكش صلاحية تشوف الطلب ده' });
    }
    if (order.returnRequestStatus === 'none') {
      return res.status(404).json({ message: 'مفيش طلب استرجاع مسجل لهذا الطلب' });
    }

    // ===== حماية بيانات العميل: العميل صاحب الطلب (isOwner && !isPrivileged)
    // بياخد projection آمنة (من غير adminNote/reviewedBy/costPrice) - الأدمن/
    // call_center لسه بياخد التفاصيل الكاملة زي ما هي بالظبط. =====
    if (isOwner && !isPrivileged) {
      return res.json(toCustomerReturnRequestView(order));
    }

    res.json({
      requestId: String(order._id),
      orderId: order._id,
      type: 'return',
      order: {
        _id: order._id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        address: order.address,
        governorate: order.governorate,
        totalAmount: order.totalAmount,
        status: order.status,
      },
      items: order.returnItems,
      orderItems: order.items,
      status: order.returnRequestStatus,
      requestedBy: order.returnRequestedBy,
      reason: order.returnRequestReason,
      reasonCode: order.returnRequestReasonCode,
      createdAt: order.returnRequestedAt || order.createdAt,
      reviewedBy: order.returnReviewedBy,
      reviewedAt: order.returnReviewedAt,
      adminNote: order.returnAdminNote,
      fee: order.returnFeeCharged,
      currency: order.returnFeeCurrency || 'EGP',
      feeType: order.returnFeeType,
      evidenceImages: order.returnEvidenceImages,
      statusHistory: order.returnStatusHistory,
      refundAmount: order.returnRefundAmount,
      refundMethod: order.returnRefundMethod,
      refundTransferredAt: order.returnRefundTransferredAt,
      refundTransferredBy: order.returnRefundTransferredBy,
      refundReference: order.returnRefundReference,
      suggestedRefundAmount: order.refundedAmount,
      // ===== FIX: كانت الحقول دي ناقصة من هنا فمكنش تبويب "الاسترجاع
      // والاستبدال" الموحّد في الأدمن يقدر يعرض زرار "معاينة" (كويس/مش كويس)
      // ولا حالة المعاينة، رغم إن الـController بتاع inspectReturnRequest
      // ومنطق المخزون كانوا شغالين بالفعل - شوف inspectReturnRequest تحت =====
      returnInspectionResult: order.returnInspectionResult,
      returnInspectionNote: order.returnInspectionNote,
      returnInspectedAt: order.returnInspectedAt,
      returnStockRestored: order.returnStockRestored,
      returnStockRestoredAt: order.returnStockRestoredAt,
      // ===== إضافة: كود التتبع بتاع المرتجع - عشان يبان في تبويب "الاسترجاع
      // والاستبدال" الموحّد في الأدمن (نفس الحقول الي كانت ظاهرة بس في تبويب
      // الأوردرات قبل كده) =====
      trackingNumber: order.returnTrackingNumber,
      trackingProvider: order.returnTrackingProvider,
      trackingStatus: order.returnStatus,
      trackingRawStatus: order.returnTrackingRawStatus,
      lastTrackingSyncAt: order.returnLastTrackingSyncAt,
    });
  } catch (err) {
    console.error('Error fetching return request details:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب تفاصيل طلب الاسترجاع'});
  }
};

// GET /api/orders/return-reasons  (عام - قايمة أسباب الاسترجاع الموحّدة)
const getReturnReasons = async (req, res) => {
  try {
    const settingsDoc = await Settings.findOne().lean();
    const effective = getEffectiveReturnReasons(settingsDoc).filter((r) => r.enabled !== false);
    res.json(effective.map(({ code, ar, en }) => ({ code, ar, en })));
  } catch (err) {
    console.error('Error fetching return reasons:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب أسباب الاسترجاع'});
  }
};

// GET /api/orders/:id/return-eligibility?reasonCode=...  (عميل مسجل - يتحقق قبل ما يقدّم الطلب)
const getReturnEligibility = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    if (!req.user || String(order.customerId || '') !== String(req.user._id)) {
      return res.status(403).json({ message: 'الطلب ده مش تابع لحسابك' });
    }

    const settingsDoc = await Settings.findOne().lean();
    const reasonCode = isValidReasonCode(req.query.reasonCode, settingsDoc) ? req.query.reasonCode : 'other';

    if (order.returnRequestStatus === 'pending' || order.returnRequestStatus === 'approved') {
      return res.json({ eligible: false, message: 'فيه طلب استرجاع لنفس الطلب ده اتسجل بالفعل' });
    }

    const eligibility = checkEligibility({ order, type: 'return', reasonCode, settings: settingsDoc });
    res.json({
      eligible: eligibility.eligible,
      message: eligibility.message,
      evidenceRequired: isEvidenceRequired({ type: 'return', reasonCode, settings: settingsDoc }),
      fee: eligibility.eligible ? computeFee({ type: 'return', reasonCode, settings: settingsDoc }) : null,
    });
  } catch (err) {
    console.error('Error checking return eligibility:', err);
    res.status(500).json({ message: 'حصل خطأ في التحقق من أهلية الاسترجاع'});
  }
};

// POST /api/orders/evidence-images  (عميل مسجل) - رفع صورة إثبات لطلب استرجاع/استبدال
// بيستخدم نفس File Upload الموجود بالفعل (middleware/upload.js + uploadImageToCloudinary)
// - مفيش Upload System جديد. الرابط الراجع بيتبعت بعد كده كـ evidenceImages
// جوه POST /api/orders/:id/return-request أو POST /api/orders/:id/exchange-request.
const uploadEvidenceImage = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'لازم تسجل دخول الأول' });
    if (!req.file) return res.status(400).json({ message: 'لم يتم إرسال صورة' });

    const uploaded = await uploadImageToCloudinary(
      req.file.buffer,
      req.file.safeOriginalName || req.file.originalname,
      req.file.detectedMime || req.file.mimetype,
      { folder: 'return-exchange-evidence' },
    );

    res.status(201).json({
      success: true,
      data: { url: uploaded.secureUrl || uploaded.url, publicId: uploaded.publicId },
    });
  } catch (err) {
    console.error('Evidence image upload failed:', err);
    if (err?.code === 'CLOUDINARY_UPLOAD_FAILED') {
      return res.status(502).json({ message: 'تعذر رفع الصورة إلى التخزين. حاول مرة أخرى.' });
    }
    res.status(err?.statusCode || 500).json({ message: 'تعذر رفع صورة الإثبات.' });
  }
};

// ============================================================
// PUT /api/orders/:id/return-request/status  (أدمن) - Phase 2C
// تحديث حالة سير عمل الاسترجاع بعد الموافقة: شركة الشحن استلمت المنتج من
// العميل -> وصل المخزن -> جاري المعاينة -> مكتمل (أو ملغي). نفس فكرة
// updateExchangeStatus في exchangeController.js بالظبط.
// ============================================================
const RETURN_WORKFLOW_ORDER = ['approved', 'carrier_picked_up', 'received_at_warehouse', 'inspecting', 'completed'];

const updateReturnStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    const nextStatus = req.body.status;
    const validNext = ['carrier_picked_up', 'received_at_warehouse', 'inspecting', 'completed', 'cancelled'];
    if (!validNext.includes(nextStatus)) {
      return res.status(400).json({ message: 'حالة غير معروفة' });
    }

    if (nextStatus === 'cancelled') {
      if (['completed', 'cancelled', 'rejected', 'none'].includes(order.returnRequestStatus)) {
        return res.status(400).json({ message: 'مينفعش تلغي طلب الاسترجاع ده في الحالة الحالية' });
      }
    } else {
      const currentIdx = RETURN_WORKFLOW_ORDER.indexOf(order.returnRequestStatus);
      const nextIdx = RETURN_WORKFLOW_ORDER.indexOf(nextStatus);
      if (currentIdx === -1 || nextIdx === -1 || nextIdx < currentIdx) {
        return res.status(400).json({ message: 'مينفعش تنقل طلب الاسترجاع للحالة دي دلوقتي' });
      }
    }

    order.returnRequestStatus = nextStatus;
    const note = typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim().slice(0, 500) : null;
    order.returnStatusHistory = order.returnStatusHistory || [];
    order.returnStatusHistory.push({ status: nextStatus, at: new Date(), by: req.user ? req.user._id : null, note });

    // اقتراح تلقائي لمبلغ التحويل أول مرة الطلب يوصل "جاري المعاينة" أو أي
    // مرحلة بعدها، لو لسه الأدمن ماحددش المبلغ يدويًا (بيفضل قابل للتعديل).
    if (order.returnRefundAmount === null || order.returnRefundAmount === undefined) {
      order.returnRefundAmount = Number(order.refundedAmount || 0);
    }

    await order.save();
    require('../utils/cache').del('orders:all');
    res.json(order);
  } catch (err) {
    console.error('Error updating return status:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث حالة طلب الاسترجاع'});
  }
};

// ============================================================
// PUT /api/orders/:id/return-request/refund  (أدمن) - Phase 2C
// تسجيل/تعديل مبلغ ورقة تحويل فلوس الاسترجاع (انستا باي / محفظة)، أو
// تأكيد إن التحويل تم فعليًا (زرار "تم التحويل" في الأدمن).
// ============================================================
const updateReturnRefund = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    if (order.returnRequestStatus === 'none' || order.returnRequestStatus === 'pending' || order.returnRequestStatus === 'rejected') {
      return res.status(400).json({ message: 'مفيش طلب استرجاع تحت التنفيذ لهذا الطلب حاليًا' });
    }

    if (req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== '') {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ message: 'المبلغ غير صحيح' });
      }
      order.returnRefundAmount = Math.round(amount * 100) / 100;
    }
    if (req.body.method !== undefined) {
      const method = req.body.method;
      if (method !== null && method !== 'instapay' && method !== 'wallet') {
        return res.status(400).json({ message: 'طريقة التحويل غير معروفة' });
      }
      order.returnRefundMethod = method || null;
    }
    if (typeof req.body.reference === 'string') {
      order.returnRefundReference = req.body.reference.trim().slice(0, 200) || null;
    }

    if (req.body.transferred === true) {
      if (order.returnRefundAmount === null || order.returnRefundAmount === undefined) {
        return res.status(400).json({ message: 'حدد مبلغ التحويل الأول' });
      }
      if (!order.returnRefundMethod) {
        return res.status(400).json({ message: 'حدد طريقة التحويل (انستا باي / محفظة) الأول' });
      }
      order.returnRefundTransferredAt = new Date();
      order.returnRefundTransferredBy = req.user ? req.user._id : null;
      order.returnStatusHistory = order.returnStatusHistory || [];
      order.returnStatusHistory.push({
        status: order.returnRequestStatus,
        at: new Date(),
        by: req.user ? req.user._id : null,
        note: `تم تحويل ${order.returnRefundAmount} ${order.returnFeeCurrency || 'EGP'} للعميل عبر ${order.returnRefundMethod === 'instapay' ? 'انستا باي' : 'المحفظة'}`,
      });
    } else if (req.body.transferred === false) {
      order.returnRefundTransferredAt = null;
      order.returnRefundTransferredBy = null;
    }

    await order.save();
    require('../utils/cache').del('orders:all');
    res.json(order);
  } catch (err) {
    console.error('Error updating return refund:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث تحويل فلوس الاسترجاع'});
  }
};

module.exports = {
  createOrder, getOrders, getRevenueStats, getRevenueBreakdown, getCustomerStats, getMyOrders, updateOrderStatus, updatePackerStatus,
  // ===== لوحة البيانات: جراف المبيعات + إحصائيات متفرقة + مقارنة سنوية (aggregation بدون سقف 1000) =====
  getSalesTrend, getDashboardExtras, getYearlyComparison,
  getLoyaltyInfo, confirmWalletPayment,
  // ===== جديد =====
  getPaymentsDashboard, getShippingDashboard, updateOrderShipping, updatePaymentStatus,
  refundOrderPayment, requestReturn, reviewReturnRequest, inspectReturnRequest,
  // ===== Returns & Exchanges - Phase 2A =====
  getReturnReasons, getReturnEligibility, uploadEvidenceImage,
  // ===== Returns & Exchanges - Phase 2B =====
  getReturnRequests, getReturnRequestDetails,
  // ===== Returns & Exchanges - Phase 2C =====
  updateReturnStatus, updateReturnRefund,
  // ===== [P0 Fix #5] مُصدَّرة للاختبار فقط =====
  stripClientPaymentFields,
  // ===== FIX: مُصدَّرة عشان exchangeController يقدر يبعت إشعارات بيرفو
  // لحالات طلب الاستبدال، بنفس الطريقة اللي بيرفو بيبعت بيها لحالات الاسترجاع =====
  queueStatusNotification,
};