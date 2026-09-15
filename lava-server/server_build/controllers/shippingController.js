const { publicConfig, getProvider, getConfig, rates, getAllCapabilities, getCapabilities, assertCapability } = require('../services/shipping');
const { getEnvConfig } = require('../services/shipping/config');
const { getProviderRequirements } = require('../services/shipping/requirements');
const { syncOrderTracking, applyIncomingStatus } = require('../services/shipping/sync');
const { applyReturnExchangeStatus } = require('../services/shipping/returnExchangeSync');
const { getCoverageWithRates } = require('../services/shipping/config');
const { withIdempotency } = require('../services/shipping/idempotency');
const Settings = require('../models/Settings');
const Order = require('../models/Order');
const crypto = require('crypto');

// ============================================================================
// verifyWebhookSecret(configuredSecret, receivedSecret)
// ------------------------------------------------------------------------
// ===== FIX: كانت الأكواد القديمة بتعمل `if (expectedSecret && ...)` - يعني
// لو الأدمن لسه ما حطش BOSTA_WEBHOOK_SECRET/SHIPBLU_WEBHOOK_SECRET (أو
// الحقل فاضي)، الشرط كله كان بيتجاهل تمامًا وأي حد (من غير أي secret خالص)
// كان يقدر ينادي على الـwebhook وياخد صلاحية يغيّر شحنة/حالة طلب حقيقية
// (زي "delivered" وهمي أو "cancelled" وهمي). ده fail-open خطير - الـsecret
// هنا هو الحماية الوحيدة (بوسطة/ShipBlu مفيش عندهم HMAC رسمي، شوف تعليق
// handleBostaWebhook تحت)، فلازم يبقى **إجباري**: لو مش متظبط في الإعدادات،
// الـwebhook يترفض بالكامل (fail closed) - مش يتقبل من غير تحقق.
// كمان استخدمنا crypto.timingSafeEqual (زي باقي أماكن مقارنة الأسرار في
// الكود - authController.js/paymobService.js/kashierService.js) بدل `!==`
// العادي، عشان نمنع أي فرصة (حتى لو ضئيلة جدًا) لـtiming attack يستنتج بيها
// حد الـsecret الصح حرف حرف من فروق التوقيت.
// ============================================================================
function verifyWebhookSecret(configuredSecret, receivedSecret) {
  // مفيش secret متظبط في الإعدادات أصلاً - fail closed. ممنوع نقبل أي حاجة.
  if (!configuredSecret || typeof configuredSecret !== 'string') return false;
  if (!receivedSecret || typeof receivedSecret !== 'string') return false;
  const expectedBuf = Buffer.from(configuredSecret);
  const receivedBuf = Buffer.from(receivedSecret);
  // timingSafeEqual بيرمي لو الأطوال مختلفة - لازم نتأكد يدويًا الأول
  // (اختلاف الطول نفسه مش لازم يبقى timing leak خطير هنا، بس بنتجنب الرمي).
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

// P1-6: لو الخطأ جايّ من استدعاء HTTP فعلي لمزوّد شحن خارجي (services/shipping/http.js
// بيحط `.data` على أي خطأ زي ده)، ممكن يحتوي نص خام من رد المزوّد (تفاصيل حساب/طلب
// داخلية). منرجعوش زي ما هو حتى للأدمن - بنرجع رسالة عامة بحالة الـHTTP بس، ونسجل
// التفاصيل الكاملة في اللوج. أي خطأ تاني (رسائلنا العربية الجاهزة زي "بيانات Aramex
// غير مكتملة"، أو أخطاء الـcapabilities/idempotency اللي فيها .status محدد يدويًا)
// آمن إننا نعرضه زي ما هو - دي رسائل business-rule مقصودة للأدمن.
function safeShippingErrorMessage(e) {
  if (e && e.data !== undefined) {
    return `فشل الاتصال بشركة الشحن (HTTP ${e.status || 'error'})`;
  }
  return (e && e.message) || 'حصل خطأ غير متوقع أثناء عملية الشحن';
}

// شركات الشحن اللي بالفعل خلّصت شحنتها بنجاح - ممنوع نعمل لها Shipment تاني
// (Duplicate Shipment Protection). لو الحالة "failed"/"pending" مسموح بالـRetry.
// ملحوظة: ده فحص أولي سريع (fail-fast) قبل حتى ما ندخل في الـidempotency
// layer، لكن الحماية الحقيقية من التكرار (race conditions/concurrent
// requests/retry بعد timeout) موجودة في services/shipping/idempotency.js.
const ALREADY_SHIPPED_STATUSES = new Set([
  'shipped', 'created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered',
]);

// بنجمع إعدادات الـ.env مع الإعدادات المحفوظة من الأدمن (تفعيل/تعطيل، الدول)
// لأن قبل كده كان في تعارض: الأدمن يفعّل الشركة من الإعدادات، بس أي مكان
// بيستخدم getConfig() لوحدها كان بيتجاهل الحفظ ده وبيفضل شغال بقيمة الـ.env بس.
async function getMergedConfig(key) {
  const base = getConfig(key);
  if (!base) return base;
  const settings = await Settings.findOne().lean();
  const saved = settings?.shippingIntegrations?.[key] || {};
  return { ...base, ...saved };
}

// نتيجة Test Connection موحّدة لكل الشركات - قيم واضحة بدل ok/fail بس، عشان
// الأدمن يعرف بالظبط المشكلة فين (بيانات ناقصة / بيانات غلط / مشكلة شبكة...).
const CONNECTION_RESULTS = {
  CONNECTED: 'CONNECTED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  AUTH_ERROR: 'AUTH_ERROR',
  API_ERROR: 'API_ERROR',
  TIMEOUT: 'TIMEOUT',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
};

// بيصنّف الخطأ الراجع من p.test() لواحدة من نتائج Test Connection الواضحة
// فوق، بدون ما نسرّب أي تفاصيل حساسة (headers/keys) في الرسالة.
function classifyConnectionError(err) {
  if (err.isTimeout) return CONNECTION_RESULTS.TIMEOUT;
  const status = Number(err.status);
  if (status === 401 || status === 403) return CONNECTION_RESULTS.AUTH_ERROR;
  if (status === 400 || status === 422) return CONNECTION_RESULTS.INVALID_CREDENTIALS;
  if (status >= 500 || !status) return CONNECTION_RESULTS.API_ERROR;
  return CONNECTION_RESULTS.API_ERROR;
}

const connectProvider = async (req, res) => {
  try {
    const key = String(req.params.key).toLowerCase();
    const p = getProvider(key);
    const config = await getMergedConfig(key);

    // مفيش بيانات اتحطت خالص لسه - منحاولش نتصل، بنرجع NOT_CONFIGURED مباشرة
    // (فرق واضح عن AUTH_ERROR: هنا الأدمن لسه ماحطش أي بيانات أصلاً).
    const hasAnyCredential = key === 'bosta' || key === 'shipblu' ? !!config.apiKey : !!(config.username || config.password);
    if (!hasAnyCredential) {
      return res.json({ ok: false, provider: key, connectionResult: CONNECTION_RESULTS.NOT_CONFIGURED, message: 'لم يتم إدخال بيانات الاتصال لهذه الشركة بعد' });
    }

    const result = await p.test(config);
    res.json({ ok: true, provider: key, connectionResult: CONNECTION_RESULTS.CONNECTED, result });
  } catch (e) {
    console.error('Shipping provider connection test failed:', e);
    const connectionResult = classifyConnectionError(e);
    res.status(e.status || 400).json({ ok: false, connectionResult, message: safeShippingErrorMessage(e) });
  }
};

// ===== [Security Audit Fix] الحقول الوحيدة من shippingIntegrations[key] اللي
// مسموح تتحط في استجابة عامة (GET /api/shipping/providers - بدون أي auth
// خالص). المشكلة كانت إن الكود القديم بيعمل `{ ...base[key], ...saved[key] }`
// يعني أي حقل حفظه الأدمن جوه shippingIntegrations.<provider> (apiKey,
// sandboxApiKey, username, password, accountPin, webhookSecret, pickupPhone،
// إلخ) كان بيتسرّب كامل لأي زائر - ده بيانات اعتماد حقيقية لمزوّدين شحن
// خارجيين (Aramex/DHL/Bosta/ShipBlu)، مش مجرد إعدادات عرض.
// الحل: whitelist صريح لحقول العرض/التفعيل الآمنة بس (نفس فكرة toPublicProduct) -
// أي حقل حساس تاني ما بيتلمسش هنا خالص، حتى لو الأدمن ضاف حقل جديد مستقبلًا.
const PUBLIC_PROVIDER_OVERRIDE_FIELDS = ['enabled', 'environment', 'defaultRate', 'countries'];

// دالة نقية (بدون I/O) بتطبّق فقط الحقول المسموح بيها فوق نسخة provider
// العامة - مُصدَّرة عشان الاختبارات تتأكد إن أي حقل حساس (apiKey/username/
// password/webhookSecret/accountPin...) مش بيعدّي حتى لو موجود في saved.
const applyPublicProviderOverrides = (basePublicProvider, savedForKey) => {
  const result = { ...basePublicProvider };
  if (savedForKey && typeof savedForKey === 'object') {
    PUBLIC_PROVIDER_OVERRIDE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(savedForKey, field)) {
        result[field] = savedForKey[field];
      }
    });
  }
  return result;
};

const getProviders = async (req, res) => {
  const settings = await Settings.findOne().lean();
  const base = publicConfig();
  const saved = settings?.shippingIntegrations || {};
  for (const key of Object.keys(base)) {
    base[key] = applyPublicProviderOverrides(base[key], saved[key]);
    // الـcapabilities الحقيقية (مش fake) بتتحط جنب بيانات كل شركة عشان
    // الأدمن Dashboard يعرف يظهر/يخفي الأزرار الصح لكل provider.
    base[key].capabilities = getCapabilities(key);
    // requiredFields/optionalFields (Phase 4 - Dynamic Checkout): نفس
    // الحقول اللي فعليًا بيتحقق منها الـbackend قبل إنشاء الشحنة (مصدرها
    // requirements.js اللي بيقرا من نفس REQUIRED_FIELDS الحقيقية جوه كل
    // provider mapper) - الـfrontend يقدر يستخدمها يعرف يعرض/يطلب إيه بس
    // لما العميل يختار الـprovider ده، من غير hard-code منفصل لكل شركة.
    base[key].requirements = getProviderRequirements(key);
  }
  res.json({ providers: base });
};

// GET /api/shipping/providers/admin (أدمن/موظف بصلاحية settings بس) - نفس
// getProviders لكن بالبيانات الكاملة (بما فيها بيانات الاعتماد المحفوظة) -
// لوحة التحكم محتاجاها عشان تعرض نموذج تعديل إعدادات شركة الشحن (اسم
// المستخدم/الباسورد/الـAPI key المحفوظين) بدل ما تبتدي من فاضي كل مرة.
// ده الراوت الصح اللي لازم الفرونت (شاشة إعدادات الشحن في الأدمن) يستخدمه
// بدل GET /api/shipping/providers العامة بعد إصلاح التسريب فوق.
const getAdminProviders = async (req, res) => {
  const settings = await Settings.findOne().lean();
  const base = getEnvConfig();
  const saved = settings?.shippingIntegrations || {};
  const merged = {};
  for (const key of Object.keys(base)) {
    merged[key] = { ...base[key], ...(saved[key] || {}) };
    merged[key].capabilities = getCapabilities(key);
    merged[key].requirements = getProviderRequirements(key);
  }
  res.json({ providers: merged });
};

// GET /api/shipping/capabilities - كل الشركات مع الـcapabilities بتاعتها،
// مفيدة للـAdmin Dashboard عشان يبني شاشة الشحن من غير ما يحتاج ينادي
// getProviders (اللي محتاج auth أوسع).
const getCapabilitiesList = async (req, res) => {
  res.json({ capabilities: getAllCapabilities() });
};

const getRates = async (req, res) => {
  try {
    const settings = await Settings.findOne().lean();
    const saved = settings?.shippingIntegrations || {};
    const order = {
      _id: 'quote', country: req.body.country, governorate: req.body.governorate, address: req.body.address,
      zipCode: req.body.zipCode, customerName: req.body.customerName, customerPhone: req.body.customerPhone,
      totalAmount: req.body.totalAmount, paymentMethod: req.body.paymentMethod, items: req.body.items || [],
    };
    const all = await rates(order, saved);
    const allowed = all.filter(r => {
      const cfg = saved[r.provider];
      if (cfg && cfg.enabled === false) return false;
      if (cfg?.countries?.length && req.body.countryCode && !cfg.countries.includes(req.body.countryCode)) return false;
      return true;
    });
    res.json({ rates: allowed });
  } catch (e) {
    console.error('Error fetching shipping rates:', e);
    res.status(500).json({ message: 'حصل خطأ في جلب أسعار الشحن' });
  }
};

// تحقق من البيانات الأساسية المطلوبة لأي شركة شحن قبل إرسال الطلب لها
// (Validation - قاعدة 43). منمنعش الطلب لو ناقص، وبنرجع رسالة واضحة للأدمن.
function validateOrderForShipping(order) {
  const missing = [];
  if (!order.customerName) missing.push('اسم العميل (customerName)');
  if (!order.customerPhone) missing.push('رقم هاتف العميل (customerPhone)');
  if (!order.address) missing.push('عنوان الشحن (address)');
  if (!order.governorate) missing.push('المحافظة (governorate)');
  return missing;
}

// بيحسب المبلغ الفعلي المطلوب تحصيله (COD) للطلب، مبني على total الحقيقي
// بعد الخصومات والشحن والضرائب - مش subtotal بس. لو totalAmount محفوظ
// ومحسوب صح وقت إنشاء الطلب (شامل كل حاجة)، بيتم استخدامه مباشرة؛ ده
// أدق مصدر عندنا لأنه اللي فعليًا اتحسب وقت الطلب.
function computeCodAmount(order) {
  if (order.paymentMethod !== 'cod') return 0;
  const amount = Number(order.totalAmount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

const createShipment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });

    // Duplicate Shipment Protection (فحص سريع أولي): لو فيه شحنة موجودة
    // بالفعل وناجحة/في تقدم، امنع إنشاء شحنة ثانية سواء ضغط الأدمن على
    // الزر مرتين أو حصل retry غلط. الحماية الكاملة من الـrace conditions
    // بتحصل بعد كده جوه withIdempotency.
    if (order.trackingNumber && ALREADY_SHIPPED_STATUSES.has(order.shippingStatus)) {
      return res.status(409).json({
        ok: false,
        message: `تم إنشاء شحنة لهذا الطلب بالفعل (${order.shippingCompany || ''} - ${order.trackingNumber})`,
        order,
      });
    }

    const key = String(req.body.provider || order.shippingCompany || '').toLowerCase();
    if (!key) return res.status(400).json({ message: 'يجب تحديد شركة الشحن' });

    const config = await getMergedConfig(key);
    if (!config) return res.status(400).json({ message: `شركة الشحن غير مدعومة: ${key}` });
    if (config.enabled === false) {
      return res.status(400).json({ message: `شركة الشحن (${config.name || key}) غير مفعّلة حاليًا في الإعدادات` });
    }

    const missing = validateOrderForShipping(order);
    if (missing.length) {
      return res.status(422).json({ message: `بيانات ناقصة في الطلب لإنشاء الشحنة: ${missing.join('، ')}` });
    }

    // نفس حماية COD اللي بتحصل وقت إنشاء الطلب (orderController.js) - بنكررها
    // هنا كمان لأن الأدمن ممكن يغيّر شركة الشحن لطلب COD موجود بالفعل بعد
    // ما اتعمل (زرار "تعديل شركة الشحن")، فمينفعش نعتمد بس على الفحص وقت
    // إنشاء الطلب. لو الشركة مش بتدعم COD فعليًا، ممنوع ننشئ الشحنة أصلاً.
    if (order.paymentMethod === 'cod') {
      const providerCaps = getCapabilities(key);
      if (providerCaps && providerCaps.supportsCOD !== true) {
        return res.status(400).json({ message: `شركة الشحن (${config.name || key}) لا تدعم الدفع عند الاستلام - هذا الطلب COD ولا يمكن شحنه بهذه الشركة`, code: 'UNSUPPORTED_COD' });
      }
    }

    const p = getProvider(key);

    // تحقق خاص بشركة الشحن (لو موجود - حاليًا بوسطة فقط، شوف
    // bostaService.js validateOrder) قبل حتى ما ندخل idempotency/API call.
    // بيرمي structured error (code/fields) زي BOSTA_ADDRESS_INCOMPLETE أو
    // INVALID_PHONE - بيتقفل هنا بدل ما نستنى شركة الشحن تكتشفه (بند 6 و9).
    if (typeof p.validateOrder === 'function') {
      try {
        p.validateOrder(order);
      } catch (validationErr) {
        return res.status(validationErr.status || 422).json({
          ok: false,
          message: validationErr.message,
          code: validationErr.code,
          fields: validationErr.fields,
        });
      }
    }

    // الـcod المحسوب من الـtotal الحقيقي (بعد الخصم/الشحن/الضرائب) بيتحط
    // على الأوردر مؤقتًا (مش بيتحفظ في الداتابيز) عشان provider services
    // اللي بتقرأ order.totalAmount مباشرة (bostaService) تستخدم نفس القيمة
    // الصحيحة تلقائيًا - القيمة دي أصلاً هي totalAmount الأصلي، الحساب هنا
    // بيتأكد بس إنها رقم صالح ومحسوبة (مش undefined/subtotal بالغلط).
    const codAmount = computeCodAmount(order);

    let idempotencyOutcome;
    try {
      idempotencyOutcome = await withIdempotency(
        { orderId: order._id, provider: key, operation: 'create_shipment' },
        () => p.createShipment(order, config),
      );
    } catch (providerErr) {
      // لو الخطأ ناتج عن idempotency لقت عملية سابقة "in_progress" أو
      // "failed" (409) منلمسش الأوردر - الحالة محفوظة فعلاً من المحاولة
      // اللي فشلت أو اللي شغالة دلوقتي.
      if (providerErr.status === 409) {
        return res.status(409).json({ ok: false, message: providerErr.message, order });
      }
      // فشل الاتصال بشركة الشحن (فشل حقيقي بعد استنفاد الـretries): الطلب
      // (Order) لازم يفضل موجود، وبس بنسجل الخطأ على الشحنة (Shipment =
      // failed) عشان الأدمن يقدر يعمل Retry (بمحاولة create جديدة واعية).
      // مهم: أخطاء زي BOSTA_SUBSCRIPTION_REQUIRED مش bug في الكود - حساب
      // بوسطة نفسه محتاج تفعيل (بند 7) - بنسجلها زي أي فشل تاني من غير
      // محاولة تجاوزها.
      order.shippingCompany = key;
      order.shippingStatus = 'failed';
      order.shippingError = providerErr.message || 'فشل إنشاء الشحنة';
      order.shippingErrorCode = providerErr.code || null;
      order.shippingUpdatedAt = new Date();
      await order.save();
      return res.status(providerErr.status || 400).json({ ok: false, message: providerErr.message, code: providerErr.code, fields: providerErr.fields, order });
    }

    const { executed, result } = idempotencyOutcome;

    if (!executed) {
      // كانت فيه شحنة اتعملت بالفعل من محاولة سابقة (نفس الأوردر + نفس
      // الشركة) - منعملش نداء تاني لشركة الشحن، ومنرجعش نكتب على الأوردر
      // تاني، بس نرجّع نفس النتيجة المحفوظة (منع duplicate shipment فعلي).
      return res.json({ ok: true, shipment: result, order, deduplicated: true });
    }

    order.shippingCompany = key;
    order.trackingNumber = result.trackingNumber || result.shipmentId || null;
    order.shippingProviderId = result.shipmentId || result.trackingNumber || null;
    order.shippingLabelUrl = result.labelUrl || null;
    order.shippingStatus = 'shipped';
    order.shippingError = null;
    order.shippingErrorCode = null;
    order.shippedAt = new Date();
    order.shippingCreatedAt = order.shippingCreatedAt || new Date();
    order.shippingUpdatedAt = new Date();
    await order.save();
    res.json({ ok: true, shipment: result, order });
  } catch (e) { console.error('Shipping provider connect error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e), code: e.code, fields: e.fields }); }
};

// حالات مش منطقي تلغي شحنة وهي فيها - لو اتسلمت أو رجعت أو اتلغت بالفعل،
// ممنوع إلغاء تاني (زي Duplicate Shipment Protection بالظبط بس بالعكس).
const NOT_CANCELLABLE_STATUSES = new Set(['delivered', 'cancelled', 'returned']);

const cancelShipment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });

    const key = String(order.shippingCompany || '').toLowerCase();
    if (!key) return res.status(400).json({ message: 'لا توجد شركة شحن محددة لهذا الطلب' });
    if (!order.trackingNumber && !order.shippingProviderId) {
      return res.status(400).json({ message: 'لا توجد شحنة فعلية لإلغائها لهذا الطلب' });
    }
    if (NOT_CANCELLABLE_STATUSES.has(order.shippingStatus)) {
      return res.status(409).json({ message: `لا يمكن إلغاء الشحنة وهي في حالة "${order.shippingStatus}"` });
    }

    // نتأكد من الـcapability الحقيقية قبل أي حاجة - لو مش مدعومة رسميًا
    // بيرمي رسالة واضحة (UNSUPPORTED_OPERATION) بدل تنفيذ وهمي.
    try {
      assertCapability(key, 'supportsCancellation');
    } catch (capErr) {
      return res.status(capErr.status || 400).json({ ok: false, message: capErr.message, code: capErr.code });
    }

    const config = await getMergedConfig(key);
    try {
      const { executed, result } = await withIdempotency(
        { orderId: order._id, provider: key, operation: 'cancel_shipment' },
        () => getProvider(key).cancelShipment(order.shippingProviderId || order.trackingNumber, config),
      );
      order.shippingStatus = 'cancelled';
      order.shippingUpdatedAt = new Date();
      order.shippingError = null;
      await order.save();
      res.json({ ok: true, result, order, deduplicated: !executed });
    } catch (providerErr) {
      if (providerErr.status === 409) return res.status(409).json({ ok: false, message: providerErr.message, order });
      res.status(providerErr.status || 400).json({ ok: false, message: providerErr.message || 'فشل إلغاء الشحنة' });
    }
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

const trackShipment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    const key = String(req.query.provider || order.shippingCompany || '').toLowerCase();
    if (!key) return res.status(400).json({ message: 'يجب تحديد شركة الشحن' });
    if (!order.trackingNumber) return res.status(400).json({ message: 'لا يوجد Tracking Number للطلب' });

    const config = await getMergedConfig(key);
    if (!config) return res.status(400).json({ message: `شركة الشحن غير مدعومة: ${key}` });

    // نفس منطق التحديث المستخدم في الـworker التلقائي بالظبط (شوف
    // services/shipping/sync.js) - عشان الضغط اليدوي هنا وأي تحديث تلقائي
    // من غير تدخل يفضلوا متسقين ومفيش تعارض بينهم.
    const { result, internalStatus } = await syncOrderTracking(order, getProvider(key), config);

    res.json({ ok: true, ...result, internalStatus, order });
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

// GET /api/shipping/providers/:key/governorates
// بترجع كل المحافظات اللي شركة الشحن دي بتوصلها + السعر المحدد لكل واحدة
// (لو الأدمن حدده من قبل)، عشان تتعرض في لوحة التحكم (لملء الأسعار) وفي
// صفحة التشيك أوت (يشوف العميل كل المحافظات وأسعارها قبل ما يختار بتاعته).
const getProviderGovernorates = async (req, res) => {
  try {
    const key = String(req.params.key).toLowerCase();
    const settings = await Settings.findOne().lean();
    const saved = settings?.shippingIntegrations?.[key] || {};
    const governorateRates = saved.governorateRates || {};
    const governorates = getCoverageWithRates(key, governorateRates);
    res.json({ provider: key, governorates });
  } catch (e) {
    console.error('Error fetching provider governorates:', e);
    res.status(500).json({ message: 'حصل خطأ في جلب المحافظات' });
  }
};

// GET /api/shipping/orders/:orderId/label
// أرامكس و DHL بيرجعوا رابط بوليصة الشحن مباشرة وقت إنشاء الشحنة، فبيتحفظ في
// order.shippingLabelUrl من الأول. بوسطة مش بترجعه وقت الإنشاء، فبنطلبه هنا
// عند الحاجة بس (Lazy) ونحفظه بعد كده عشان منكررش الطلب في كل مرة.
//
// ملحوظة عن ShipBlu تحديدًا: الرابط اللي بيترجع من provider.getLabel() هنا
// (ومن order.shippingLabelUrl المحفوظ) رابط API الرسمي بتاع ShipBlu نفسه،
// وده محتاج API Key سري في الـHeader عشان يفتح - يعني الفرونت (المتصفح)
// مينفعش يفتحه مباشرة بـwindow.open زي Aramex/DHL. لازم يستخدم الـendpoint
// التاني تحت (downloadLabel) اللي بيعدي على الباك اند كـبروكسي.
const getLabel = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (!order.trackingNumber) return res.status(400).json({ message: 'لا يوجد رقم تتبع للطلب - لازم يتم إنشاء الشحنة أولاً' });

    if (order.shippingLabelUrl) {
      return res.json({ ok: true, labelUrl: order.shippingLabelUrl });
    }

    const key = String(order.shippingCompany || '').toLowerCase();
    if (!key) return res.status(400).json({ message: 'لا توجد شركة شحن محددة لهذا الطلب' });

    try {
      assertCapability(key, 'supportsLabels');
    } catch (capErr) {
      return res.status(capErr.status || 400).json({ ok: false, message: capErr.message, code: capErr.code });
    }

    const provider = getProvider(key);
    const config = await getMergedConfig(key);
    const { labelUrl } = await provider.getLabel(order.trackingNumber, config);
    order.shippingLabelUrl = labelUrl;
    await order.save();
    res.json({ ok: true, labelUrl });
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

// GET /api/shipping/orders/:orderId/label/file
// بروكسي حقيقي لتحميل/طباعة البوليصة من الباك اند مباشرة (بايتات الملف نفسه)،
// مش مجرد رابط. ده ضروري لشركات زي ShipBlu اللي رابط البوليصة عندها محتاج
// API Key سري في الـHeader - المفتاح ده Backend-only دايمًا (قاعدة الأمان
// رقم 11)، فمينفعش نبعته للفرونت أو يتحط في رابط بيفتحه المتصفح مباشرة.
// الباك اند هنا هو اللي بيتصل بشركة الشحن بالمفتاح، وبيبعت الملف الجاهز
// للمتصفح كـPDF عادي (Content-Type: application/pdf) من غير ما الفرونت
// يحتاج يعرف أي سر خالص.
//
// لشركات تانية (Aramex/DHL) اللي رابط البوليصة بتاعها عام (public URL) من
// غير احتياج مفتاح، بنعمل redirect بسيط للرابط ده بدل تحميل البايتات مرتين.
const downloadLabel = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (!order.trackingNumber) return res.status(400).json({ message: 'لا يوجد رقم تتبع للطلب - لازم يتم إنشاء الشحنة أولاً' });

    const key = String(order.shippingCompany || '').toLowerCase();
    if (!key) return res.status(400).json({ message: 'لا توجد شركة شحن محددة لهذا الطلب' });

    try {
      assertCapability(key, 'supportsLabels');
    } catch (capErr) {
      return res.status(capErr.status || 400).json({ ok: false, message: capErr.message, code: capErr.code });
    }

    const provider = getProvider(key);
    const config = await getMergedConfig(key);

    // provider.getLabelBytes موجودة بس للشركات اللي رابط البوليصة عندها
    // محتاج مصادقة سرية (ShipBlu حاليًا) - لو مش موجودة، معناها الرابط عام
    // ومينفعش/مش محتاج نبروكسي عليه، فبنعمل redirect بسيط بدل ما نحمّل
        // الملف مرتين (مرة هنا ومرة تانية لما المتصفح يفتح الرابط).
    if (typeof provider.getLabelBytes === 'function') {
      const { buffer, contentType } = await provider.getLabelBytes(order.trackingNumber, config);
      // نحفظ إشارة إن البوليصة اتولدت (من غير ما نخزن الرابط السري نفسه للفرونت)
      if (!order.shippingLabelUrl) {
        order.shippingLabelUrl = `internal:${key}:${order.trackingNumber}`;
        await order.save();
      }
      res.setHeader('Content-Type', contentType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="label-${order.trackingNumber}.pdf"`);
      return res.send(buffer);
    }

    let labelUrl = order.shippingLabelUrl;
    if (!labelUrl || labelUrl.startsWith('internal:')) {
      const result = await provider.getLabel(order.trackingNumber, config);
      labelUrl = result.labelUrl;
      order.shippingLabelUrl = labelUrl;
      await order.save();
    }
    if (!labelUrl) return res.status(400).json({ message: 'لم يتم العثور على رابط بوليصة الشحن' });
    return res.redirect(302, labelUrl);
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

// ============================================================================
// Return / Exchange
// ------------------------------------------------------------------------
// مفيش شركة من الأربعة (Bosta/Aramex/DHL/ShipBlu) بتوفر official Return أو
// Exchange API موثّق ومتأكد منه في الكود الحالي (شوف services/shipping/
// capabilities.js). عشان كده الـendpoints دول بترجع رسالة "غير مدعومة"
// واضحة بدل ما تعمل fake implementation - بالظبط زي أي عملية تانية غير
// مدعومة في المشروع ده. الـendpoints جاهزة بنيويًا (routes + controller +
// حقول الأوردر) عشان أول ما شركة تضيف Return/Exchange API رسمي، التنفيذ
// يتحط هنا مباشرة من غير ما نغيّر أي حاجة تانية في الـarchitecture.
// ============================================================================

const createReturn = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    const key = String(order.shippingCompany || '').toLowerCase();
    if (!key) return res.status(400).json({ message: 'لا توجد شركة شحن محددة لهذا الطلب' });

    try {
      assertCapability(key, 'supportsReturns');
    } catch (capErr) {
      return res.status(capErr.status || 400).json({ ok: false, message: capErr.message, code: capErr.code });
    }

    // ملحوظة: الكود وصل هنا يبقى معناه capabilities.js اتحدّثت وبقى فيه
    // provider.createReturn() حقيقي متنفذ - لسه مفيش حاليًا لأي من الأربعة.
    const p = getProvider(key);
    if (typeof p.createReturn !== 'function') {
      return res.status(400).json({ ok: false, message: `شركة الشحن (${key}) لا تدعم إنشاء مرتجع عبر الـAPI حاليًا`, code: 'UNSUPPORTED_OPERATION' });
    }
    const config = await getMergedConfig(key);
    const { executed, result } = await withIdempotency(
      { orderId: order._id, provider: key, operation: 'create_return' },
      () => p.createReturn(order, config),
    );
    order.returnShipmentId = result.shipmentId || null;
    order.returnTrackingNumber = result.trackingNumber || null;
    order.returnStatus = 'created';
    await order.save();
    res.json({ ok: true, result, order, deduplicated: !executed });
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

const createExchange = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    const key = String(order.shippingCompany || '').toLowerCase();
    if (!key) return res.status(400).json({ message: 'لا توجد شركة شحن محددة لهذا الطلب' });

    try {
      assertCapability(key, 'supportsExchange');
    } catch (capErr) {
      return res.status(capErr.status || 400).json({ ok: false, message: capErr.message, code: capErr.code });
    }

    const p = getProvider(key);
    if (typeof p.createExchange !== 'function') {
      return res.status(400).json({ ok: false, message: `شركة الشحن (${key}) لا تدعم إنشاء استبدال عبر الـAPI حاليًا`, code: 'UNSUPPORTED_OPERATION' });
    }
    const config = await getMergedConfig(key);
    const { executed, result } = await withIdempotency(
      { orderId: order._id, provider: key, operation: 'create_exchange' },
      () => p.createExchange(order, config),
    );
    order.exchangeShipmentId = result.shipmentId || null;
    order.exchangeTrackingNumber = result.trackingNumber || null;
    order.exchangeStatus = 'created';
    await order.save();
    res.json({ ok: true, result, order, deduplicated: !executed });
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

// ============================================================================
// MANUAL MODE - إدخال رقم تتبع Return/Exchange يدويًا + مزامنة الحالة
// ------------------------------------------------------------------------
// دي الـfallback الأساسي اللي بيشتغل دايمًا حتى لو الشركة مش بتدعم إنشاء
// Return/Exchange عبر API (createReturn/createExchange فوق بيرجعوا
// UNSUPPORTED_OPERATION في الحالة دي). الأدمن بيعمل العملية يدويًا على
// موقع/تطبيق شركة الشحن، وبعدين بيدخّل رقم التتبع هنا. لو الشركة supportsTracking
// (بوسطة مثلاً - نفس GET /deliveries/:id/tracking المستخدم للشحن العادي،
// مفيش سبب يفرق مع رقم تتبع Return/Exchange لأنه بالنسبالها Delivery ID
// زي أي واحد تاني)، بنحاول نجيب الحالة فورًا؛ غير كده بيفضل "يدوي بالكامل"
// والأدمن هو اللي بيحدّث returnRequestStatus بنفسه زي ما هو النظام الحالي.
// ============================================================================

const setOrderReturnTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    const { trackingNumber, provider, syncEnabled } = req.body || {};
    if (!trackingNumber) return res.status(400).json({ ok: false, message: 'رقم التتبع مطلوب' });

    const key = String(provider || order.shippingCompany || '').toLowerCase();
    order.returnTrackingNumber = String(trackingNumber).trim();
    order.returnTrackingProvider = key || null;
    if (typeof syncEnabled === 'boolean') order.returnTrackingSyncEnabled = syncEnabled;
    if (!order.returnStatus) order.returnStatus = 'pickup_pending';
    await order.save();

    // محاولة مزامنة فورية لو الشركة supportsTracking والمزامنة مش مقفولة يدويًا.
    const caps = key ? getCapabilities(key) : null;
    let syncResult = null;
    if (key && caps?.supportsTracking && order.returnTrackingSyncEnabled) {
      try {
        const config = await getMergedConfig(key);
        const result = await getProvider(key).track(order.returnTrackingNumber, config);
        syncResult = await applyReturnExchangeStatus({
          doc: order, providerKey: key, rawStatus: result.status,
          statusField: 'returnStatus', rawStatusField: 'returnTrackingRawStatus',
          workflowField: 'returnRequestStatus',
          workflowAdvanceMap: require('../services/shipping/returnExchangeSync').RETURN_WORKFLOW_ADVANCE,
          lastSyncField: 'returnLastTrackingSyncAt', lastEventField: 'returnLastProviderEvent',
        });
      } catch (trackErr) {
        // فشل المزامنة الفورية (رقم لسه مش معروف عند الشركة، تأخير مؤقت...)
        // مش خطأ فادح - رقم التتبع اتحفظ بنجاح، والـworker الدوري هيحاول تاني.
        order.returnLastProviderEvent = `sync_failed: ${trackErr.message}`.slice(0, 200);
        await order.save();
      }
    }
    res.json({
      ok: true, order,
      trackingMode: (key && caps?.supportsTracking) ? 'auto' : 'manual',
      syncResult,
    });
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

const syncOrderReturnTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (!order.returnTrackingNumber) return res.status(400).json({ ok: false, message: 'لا يوجد رقم تتبع إرجاع لهذا الطلب' });
    const key = String(order.returnTrackingProvider || order.shippingCompany || '').toLowerCase();
    const caps = getCapabilities(key);
    if (!caps?.supportsTracking) {
      return res.status(400).json({ ok: false, message: `شركة الشحن (${key}) لا تدعم التتبع الآلي - التحديث يدوي بالكامل`, code: 'MANUAL_TRACKING_ONLY' });
    }
    const config = await getMergedConfig(key);
    const result = await getProvider(key).track(order.returnTrackingNumber, config);
    const outcome = await applyReturnExchangeStatus({
      doc: order, providerKey: key, rawStatus: result.status,
      statusField: 'returnStatus', rawStatusField: 'returnTrackingRawStatus',
      workflowField: 'returnRequestStatus',
      workflowAdvanceMap: require('../services/shipping/returnExchangeSync').RETURN_WORKFLOW_ADVANCE,
      lastSyncField: 'returnLastTrackingSyncAt', lastEventField: 'returnLastProviderEvent',
    });
    res.json({ ok: true, result, outcome, order });
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

const setOrderExchangeTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    const { trackingNumber, provider, syncEnabled } = req.body || {};
    if (!trackingNumber) return res.status(400).json({ ok: false, message: 'رقم التتبع مطلوب' });

    const key = String(provider || order.shippingCompany || '').toLowerCase();
    order.exchangeTrackingNumber = String(trackingNumber).trim();
    order.exchangeTrackingProvider = key || null;
    if (typeof syncEnabled === 'boolean') order.exchangeTrackingSyncEnabled = syncEnabled;
    if (!order.exchangeStatus) order.exchangeStatus = 'pickup_pending';
    await order.save();

    const caps = key ? getCapabilities(key) : null;
    let syncResult = null;
    if (key && caps?.supportsTracking && order.exchangeTrackingSyncEnabled) {
      try {
        const config = await getMergedConfig(key);
        const result = await getProvider(key).track(order.exchangeTrackingNumber, config);
        syncResult = await applyReturnExchangeStatus({
          doc: order, providerKey: key, rawStatus: result.status,
          statusField: 'exchangeStatus', rawStatusField: 'exchangeTrackingRawStatus',
          workflowField: null, workflowAdvanceMap: null,
          lastSyncField: 'exchangeLastTrackingSyncAt', lastEventField: 'exchangeLastProviderEvent',
        });
      } catch (trackErr) {
        order.exchangeLastProviderEvent = `sync_failed: ${trackErr.message}`.slice(0, 200);
        await order.save();
      }
    }
    res.json({
      ok: true, order,
      trackingMode: (key && caps?.supportsTracking) ? 'auto' : 'manual',
      syncResult,
    });
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

const syncOrderExchangeTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (!order.exchangeTrackingNumber) return res.status(400).json({ ok: false, message: 'لا يوجد رقم تتبع استبدال لهذا الطلب' });
    const key = String(order.exchangeTrackingProvider || order.shippingCompany || '').toLowerCase();
    const caps = getCapabilities(key);
    if (!caps?.supportsTracking) {
      return res.status(400).json({ ok: false, message: `شركة الشحن (${key}) لا تدعم التتبع الآلي - التحديث يدوي بالكامل`, code: 'MANUAL_TRACKING_ONLY' });
    }
    const config = await getMergedConfig(key);
    const result = await getProvider(key).track(order.exchangeTrackingNumber, config);
    const outcome = await applyReturnExchangeStatus({
      doc: order, providerKey: key, rawStatus: result.status,
      statusField: 'exchangeStatus', rawStatusField: 'exchangeTrackingRawStatus',
      workflowField: null, workflowAdvanceMap: null,
      lastSyncField: 'exchangeLastTrackingSyncAt', lastEventField: 'exchangeLastProviderEvent',
    });
    res.json({ ok: true, result, outcome, order });
  } catch (e) { console.error('Shipping operation error:', e); res.status(e.status || 400).json({ ok: false, message: safeShippingErrorMessage(e) }); }
};

// ============================================================================
// POST /api/shipping/webhooks/bosta/:secret
// ------------------------------------------------------------------------
// Endpoint عام (مفيش protect middleware - بوسطة هي اللي بتنادي عليه مباشرة،
// مش الأدمن) بيستقبل تحديثات حالة الشحنة أول بأول من بوسطة، عشان الطلب في
// الأدمن يتحدث لوحده تلقائيًا من غير ما حد يدوس "تحديث التتبع" يدويًا.
//
// التوثيق: بوسطة رسميًا بتديك تدرج/تحدد رابط الـWebhook وقت إنشاء كل شحنة
// (باراميتر webHook في نداء إنشاء الطلب)، وبترجع بيانات حالة الشحنة لما
// تتغير. المهم: بوسطة رسميًا **مبتوفرش أي HMAC أو توقيع رسمي للتحقق من
// إن الطلب فعلاً جاي منها** - التوثيق نفسه بينصح إنك تحط secret كجزء من
// رابط الـWebhook نفسه (query param أو path segment) وتتحقق منه يدويًا،
// وده بالظبط اللي بنعمله هنا بـ:secret في الـURL.
//
// دفاعي في القراءة: بما إن مفيش schema رسمي دقيق موثّق لشكل الـpayload
// (الحقول اللي بترجع تحديدًا)، بنقرا القيم بأكتر من اسم محتمل بدل ما نفترض
// اسم واحد بس ونكسر لو اختلف. لو مش لاقيين trackingNumber أو state خالص،
// بنرجع 200 (عشان بوسطة ما تعملش retry لا نهائي) لكن بنسجل تحذير في اللوج
// عشان تعرف إن فيه payload وصل شكله مش متوقع ومحتاج مراجعة يدوية.
// ============================================================================
const handleBostaWebhook = async (req, res) => {
  try {
    const config = await getMergedConfig('bosta');
    const expectedSecret = config?.webhookSecret;
    // fail closed دايمًا (شوف تعليق verifyWebhookSecret فوق) - سواء الـsecret
    // مش متظبط أصلاً في الإعدادات أو غلط، الاتنين بيترفضوا بنفس الرد بالظبط.
    // مفيش تفاصيل زيادة في الرد (زي "secret غلط"/"مش متظبط") عشان منسهلش
    // على حد يخمن الـsecret الصح بالتجربة أو يعرف إن الإعداد ناقص.
    if (!verifyWebhookSecret(expectedSecret, req.params.secret)) {
      return res.status(404).end();
    }

    const payload = req.body || {};
    // قراءة دفاعية بأكتر من اسم حقل محتمل - شوف الملحوظة فوق.
    const trackingNumber = payload.trackingNumber || payload.TrackingNumber
      || payload.deliveryTrackingNumber || payload._id || payload.deliveryId
      || payload.data?.trackingNumber || payload.data?._id;
    const rawStatus = payload.state || payload.status || payload.deliveryState
      || payload.currentStatus || payload.data?.state || payload.data?.status;

    if (!trackingNumber) {
      console.warn('[bosta-webhook] payload وصل من غير trackingNumber معروف - شكل الـpayload غير متوقع:', JSON.stringify(payload).slice(0, 500));
      return res.status(200).json({ ok: true, ignored: true, reason: 'no_tracking_number' });
    }

    // ============================================================
    // Bosta Return/Exchange Integration: التمييز بين شحنة الطلب العادية
    // وشحنة الإرجاع/الاستبدال - لازم نفحص الأنواع التلاتة بنفس رقم التتبع
    // (بوسطة بترجع نفس نوع payload سواء كانت الشحنة SEND/RETURN/EXCHANGE،
    // مفيش حقل رسمي موثّق يميّز النوع في الـwebhook نفسه)، وكل واحد منهم
    // بيتحدث على الحقول/الـmapping بتاعته هو بس - أبدًا مش هيلمس التاني.
    // بندوّر بالترتيب: طلب عادي -> إرجاع على الأوردر -> استبدال على الأوردر
    // -> ExchangeRequest مستقل.
    // ============================================================
    const order = await Order.findOne({ trackingNumber: String(trackingNumber), shippingCompany: 'bosta' });
    if (order) {
      if (!rawStatus) {
        // مفيش حالة واضحة في الـpayload - بنسجل الـraw payload على الأقل
        // (احتياطًا) بدل ما نضيّع الحدث بالكامل.
        order.shippingRawStatus = JSON.stringify(payload).slice(0, 500);
        order.shippingUpdatedAt = new Date();
        await order.save();
        return res.status(200).json({ ok: true, saved: 'raw_only' });
      }
      const outcome = await applyIncomingStatus(order, rawStatus, 'bosta');
      return res.status(200).json({ ok: true, type: 'order', ...outcome });
    }

    const returnOrder = await Order.findOne({ returnTrackingNumber: String(trackingNumber) });
    if (returnOrder) {
      if (!rawStatus) return res.status(200).json({ ok: true, ignored: true, reason: 'no_raw_status' });
      const outcome = await applyReturnExchangeStatus({
        doc: returnOrder, providerKey: 'bosta', rawStatus,
        statusField: 'returnStatus', rawStatusField: 'returnTrackingRawStatus',
        workflowField: 'returnRequestStatus',
        workflowAdvanceMap: require('../services/shipping/returnExchangeSync').RETURN_WORKFLOW_ADVANCE,
        lastSyncField: 'returnLastTrackingSyncAt', lastEventField: 'returnLastProviderEvent',
      });
      return res.status(200).json({ ok: true, type: 'return', ...outcome });
    }

    const exchangeOrder = await Order.findOne({ exchangeTrackingNumber: String(trackingNumber) });
    if (exchangeOrder) {
      if (!rawStatus) return res.status(200).json({ ok: true, ignored: true, reason: 'no_raw_status' });
      const outcome = await applyReturnExchangeStatus({
        doc: exchangeOrder, providerKey: 'bosta', rawStatus,
        statusField: 'exchangeStatus', rawStatusField: 'exchangeTrackingRawStatus',
        workflowField: null, workflowAdvanceMap: null,
        lastSyncField: 'exchangeLastTrackingSyncAt', lastEventField: 'exchangeLastProviderEvent',
      });
      return res.status(200).json({ ok: true, type: 'exchange_order', ...outcome });
    }

    const ExchangeRequest = require('../models/ExchangeRequest');
    const exchangeRequest = await ExchangeRequest.findOne({ trackingNumber: String(trackingNumber) });
    if (exchangeRequest) {
      if (!rawStatus) return res.status(200).json({ ok: true, ignored: true, reason: 'no_raw_status' });
      const outcome = await applyReturnExchangeStatus({
        doc: exchangeRequest, providerKey: 'bosta', rawStatus,
        statusField: 'trackingStatus', rawStatusField: 'trackingRawStatus',
        workflowField: 'status',
        workflowAdvanceMap: require('../services/shipping/returnExchangeSync').EXCHANGE_WORKFLOW_ADVANCE,
        lastSyncField: 'lastTrackingSyncAt', lastEventField: 'lastProviderEvent',
      });
      return res.status(200).json({ ok: true, type: 'exchange_request', ...outcome });
    }

    console.warn(`[bosta-webhook] مفيش طلب/إرجاع/استبدال عندنا برقم تتبع بوسطة: ${trackingNumber}`);
    return res.status(200).json({ ok: true, ignored: true, reason: 'not_found' });
  } catch (e) {
    console.error('[bosta-webhook] error:', e);
    // برضو بنرجع 200 - خطأ داخلي عندنا مش المفروض يخلي بوسطة تفضل تعمل retry
    // لا نهائي على نفس الحدث؛ الخطأ متسجل في اللوج للمراجعة. منرجعش تفاصيل
    // الخطأ الداخلي لمزوّد خارجي حتى في رد الـwebhook.
    res.status(200).json({ ok: false, error: 'internal_error' });
  }
};

// ============================================================================
// POST /api/shipping/webhooks/shipblu/:secret
// ------------------------------------------------------------------------
// نفس فكرة Webhook بوسطة بالظبط، لكن لـShipBlu. الفرق المهم: تفعيل الـWebhook
// عند ShipBlu بيتم من **لوحة تحكم ShipBlu نفسها** (Dashboard → Integrations
// → Webhook) - إنت اللي بتحدد هناك أي حالات (statuses) عايز تستقبلها، مش من
// خلال نداء API من عندنا. التوثيق بيوضح إن التاجر لازم "يضيف كل حالة عايز
// يستقبلها بنفسه" وإلا مش هتتبعت.
//
// زي بوسطة بالظبط: مفيش HMAC/توقيع رسمي موثّق لـShipBlu، فالحماية بتبقى
// بـsecret في رابط الـWebhook نفسه، وقراءة الـpayload دفاعية (بأكتر من اسم
// حقل محتمل) لأن الـschema الدقيق مش موثّق بالكامل عندي.
// ============================================================================
const handleShipBluWebhook = async (req, res) => {
  try {
    const config = await getMergedConfig('shipblu');
    const expectedSecret = config?.webhookSecret;
    // fail closed دايمًا - نفس فكرة handleBostaWebhook بالظبط، شوف تعليق
    // verifyWebhookSecret فوق لسبب استخدام timingSafeEqual + رفض الـsecret
    // الفاضي بدل قبول أي حاجة لما الإعداد ناقص.
    if (!verifyWebhookSecret(expectedSecret, req.params.secret)) {
      return res.status(404).end();
    }

    const payload = req.body || {};
    const trackingNumber = payload.tracking_number || payload.trackingNumber
      || payload.order_id || payload.orderId || payload.id
      || payload.data?.tracking_number || payload.data?.id;
    const rawStatus = payload.status || payload.state || payload.order_status
      || payload.data?.status || payload.data?.state;

    if (!trackingNumber) {
      console.warn('[shipblu-webhook] payload وصل من غير tracking number معروف - شكل الـpayload غير متوقع:', JSON.stringify(payload).slice(0, 500));
      return res.status(200).json({ ok: true, ignored: true, reason: 'no_tracking_number' });
    }

    // ============================================================
    // ShipBlu Return/Exchange Integration: نفس منطق handleBostaWebhook
    // بالظبط - لازم نميّز بين شحنة الطلب العادية وشحنة الإرجاع/الاستبدال
    // اللي الأدمن دخّل رقم تتبعها يدويًا (Manual Mode)، وإلا أي Webhook
    // واصل لشحنة مرتجع/استبدال هيترفض بـ"order_not_found" ومحدش هيعرف
    // (ده كان باج فعلي قبل الإصلاح - كان بيدوّر بس في Order.trackingNumber).
    // بندوّر بالترتيب: طلب عادي -> إرجاع على الأوردر -> استبدال على الأوردر
    // -> ExchangeRequest مستقل. كل واحد بيتحدث على حقوله بس، أبدًا مش
    // بيلمس شحنة الطلب الأصلية بالغلط.
    // ============================================================
    const order = await Order.findOne({ trackingNumber: String(trackingNumber), shippingCompany: 'shipblu' });
    if (order) {
      if (!rawStatus) {
        order.shippingRawStatus = JSON.stringify(payload).slice(0, 500);
        order.shippingUpdatedAt = new Date();
        await order.save();
        return res.status(200).json({ ok: true, saved: 'raw_only' });
      }
      const outcome = await applyIncomingStatus(order, rawStatus, 'shipblu');
      return res.status(200).json({ ok: true, type: 'order', ...outcome });
    }

    const returnOrder = await Order.findOne({ returnTrackingNumber: String(trackingNumber), returnTrackingProvider: 'shipblu' });
    if (returnOrder) {
      if (!rawStatus) return res.status(200).json({ ok: true, ignored: true, reason: 'no_raw_status' });
      const outcome = await applyReturnExchangeStatus({
        doc: returnOrder, providerKey: 'shipblu', rawStatus,
        statusField: 'returnStatus', rawStatusField: 'returnTrackingRawStatus',
        workflowField: 'returnRequestStatus',
        workflowAdvanceMap: require('../services/shipping/returnExchangeSync').RETURN_WORKFLOW_ADVANCE,
        lastSyncField: 'returnLastTrackingSyncAt', lastEventField: 'returnLastProviderEvent',
      });
      return res.status(200).json({ ok: true, type: 'return', ...outcome });
    }

    const exchangeOrder = await Order.findOne({ exchangeTrackingNumber: String(trackingNumber), exchangeTrackingProvider: 'shipblu' });
    if (exchangeOrder) {
      if (!rawStatus) return res.status(200).json({ ok: true, ignored: true, reason: 'no_raw_status' });
      const outcome = await applyReturnExchangeStatus({
        doc: exchangeOrder, providerKey: 'shipblu', rawStatus,
        statusField: 'exchangeStatus', rawStatusField: 'exchangeTrackingRawStatus',
        workflowField: null, workflowAdvanceMap: null,
        lastSyncField: 'exchangeLastTrackingSyncAt', lastEventField: 'exchangeLastProviderEvent',
      });
      return res.status(200).json({ ok: true, type: 'exchange_order', ...outcome });
    }

    const ExchangeRequest = require('../models/ExchangeRequest');
    const exchangeRequest = await ExchangeRequest.findOne({ trackingNumber: String(trackingNumber), provider: 'shipblu' });
    if (exchangeRequest) {
      if (!rawStatus) return res.status(200).json({ ok: true, ignored: true, reason: 'no_raw_status' });
      const outcome = await applyReturnExchangeStatus({
        doc: exchangeRequest, providerKey: 'shipblu', rawStatus,
        statusField: 'trackingStatus', rawStatusField: 'trackingRawStatus',
        workflowField: 'status',
        workflowAdvanceMap: require('../services/shipping/returnExchangeSync').EXCHANGE_WORKFLOW_ADVANCE,
        lastSyncField: 'lastTrackingSyncAt', lastEventField: 'lastProviderEvent',
      });
      return res.status(200).json({ ok: true, type: 'exchange_request', ...outcome });
    }

    console.warn(`[shipblu-webhook] مفيش طلب/إرجاع/استبدال عندنا برقم تتبع ShipBlu: ${trackingNumber}`);
    return res.status(200).json({ ok: true, ignored: true, reason: 'not_found' });
  } catch (e) {
    console.error('[shipblu-webhook] error:', e);
    // زي بوسطة - بنرجع 200 عشان ShipBlu ما تعملش retry لا نهائي على خطأ
    // داخلي عندنا؛ الخطأ متسجل في اللوج للمراجعة. منرجعش تفاصيل الخطأ
    // الداخلي لمزوّد خارجي حتى في رد الـwebhook.
    res.status(200).json({ ok: false, error: 'internal_error' });
  }
};

module.exports = {
  connectProvider, getProviders, getAdminProviders, getCapabilitiesList, getRates, getProviderGovernorates,
  PUBLIC_PROVIDER_OVERRIDE_FIELDS, applyPublicProviderOverrides,
  createShipment, cancelShipment, trackShipment, getLabel, downloadLabel, createReturn, createExchange,
  setOrderReturnTracking, syncOrderReturnTracking, setOrderExchangeTracking, syncOrderExchangeTracking,
  handleBostaWebhook, handleShipBluWebhook,
};