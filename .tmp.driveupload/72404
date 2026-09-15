// ============================================================================
// middleware/guestRateLimiters.js
// ----------------------------------------------------------------------------
// P1-4 — Guest Endpoint Rate Limiting
//
// هدف الملف: تجميع كل الـrate limiters الخاصة بالـ"guest endpoints" الحساسة
// (اللي ممكن حد يسيء استخدامها من غير تسجيل دخول) في مكان واحد، بدل ما تتكرر
// الإعدادات في كل route file. النقاط دي مش تكرار للـlimiters العامة الموجودة
// بالفعل في server.js (createLimiter/authLimiter/apiLimiter/otpLimiter) —
// دي طبقة إضافية أضيق وأكثر تشددًا فوق الـendpoints عالية الخطورة بس، مبنية
// على نفس المكتبة (express-rate-limit) ونفس أسلوب contactLimiter/
// reviewImageLimiter الموجودين في settingsRoutes.js.
//
// ليه مفيش Redis هنا؟
// المشروع فعليًا مش بيستخدم Redis: مش موجود في package.json ولا
// package-lock.json (فيه فولدر @ioredis جوه node_modules بس من غير أي مرجع
// ليه في الكود أو الـlockfile — يبدو أثر تثبيت قديم مش جزء حقيقي من
// dependencies المشروع). الـlimiters الموجودة بالفعل في server.js
// (createLimiter/authLimiter/apiLimiter/otpLimiter) و settingsRoutes.js
// (contactLimiter/reviewImageLimiter) كلها بتستخدم الـMemoryStore الافتراضي
// بتاع express-rate-limit (تخزين في الـprocess نفسها، من غير أي storage
// خارجي). عشان كده الـlimiters هنا بتتبع نفس النمط بالظبط للاتساق، وعشان
// المشروع شغال على سيرفر واحد (single instance) مفيش داعي لـshared store
// موزّع دلوقتي. لو المشروع اتنقل لـmulti-instance مستقبلًا، ده المكان
// المناسب لاستبدال الـstore بـRedis store من غير ما يتغيّر أي حاجة تانية.
//
// Fail-open عند فشل الـstore:
// كل الـlimiters هنا معمول لها passOnStoreError: true — لو حصل أي خطأ غير
// متوقع جوه الـstore نفسه (حتى لو MemoryStore مش المفروض تفشل أصلاً لأنها في
// نفس الـprocess)، الطلب بيكمل عادي من غير ما يترفض ومن غير ما يوقف السيرفر
// (express-rate-limit بيرمي error لو passOnStoreError:false، وده كان
// هيوصل للـglobal error handler في server.js ويرجع 500 بدل ما يكمل — مش
// السلوك المطلوب لحماية أمنية إضافية، الأفضل "تفتح" مش "توقف الموقع").
//
// ملحوظة IP: التطبيق بيحدد trust proxy = 1 بس في production (شوف server.js)،
// يعني express-rate-limit بيقرا req.ip الصحيح من X-Forwarded-For بس لما
// السيرفر فعلاً وراء reverse proxy موثوق بيحط هيدر واحد بس. في أي بيئة تانية
// req.ip بيرجع لعنوان الاتصال الفعلي، فمفيش اعتماد على هيدر client-provided
// من غير ما يبقى فيه proxy config يضمن صحته. نفس الإعداد المستخدم بالفعل في
// كل limiters السيرفر التانية، فمفيش داعي لـkeyGenerator مخصص هنا.
// ============================================================================

const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

// رسالة رفض موحدة وعامة - من غير أي تفاصيل تقنية عن السبب/الحد/التخزين
// (منعًا لتسريب أي معلومة تساعد في الالتفاف على الحماية).
const makeHandler = (message) => (req, res) => {
  res.status(429).json({ message });
};

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true, // fail-open: مشكلة في الـstore ماتمنعش المستخدم الحقيقي
};

// ----------------------------------------------------------------------------
// 1) guestVerifyLimiter — أي endpoint بيتحقق من (orderNumber + phone) وبيرجع
//    نتيجة تفرّق بين "صح/غلط" (lookup + eligibility checks). دي أعلى خطورة
//    brute-force لأن orderNumber رقم متسلسل صغير المدى نسبيًا ورقم الهاتف له
//    مساحة قابلة للتجربة - محتاجة حد صارم نسبيًا فوق الـapiLimiter العام.
// ----------------------------------------------------------------------------
const guestVerifyLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 15 : 150,
  handler: makeHandler('تم تجاوز عدد المحاولات المسموح بها. حاول مرة أخرى بعد شوية.'),
});

// ----------------------------------------------------------------------------
// 2) guestActionLimiter — عمليات "guest" اللي بتغيّر حالة أو مكلفة (رفع صورة
//    إثبات على Cloudinary، تقديم طلب استرجاع/استبدال فعلي). أضيق شوية من
//    verify لأنها بتلي عادة نجاح lookup، لكن برضو لازم حد يمنع تكرار/إساءة.
// ----------------------------------------------------------------------------
const guestActionLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 100,
  handler: makeHandler('تم تجاوز عدد المحاولات المسموح بها. حاول مرة أخرى بعد شوية.'),
});

// ----------------------------------------------------------------------------
// 3) marketingTokenLimiter — روابط تأكيد/إلغاء الأوردر بالإيميل
//    (/marketing/order-confirm/:token و /marketing/order-cancel/:token).
//    مسارات دي بره /api بالكامل فمكنش عليها أي rate limiting قبل كده
//    (healthBypassLimiter في server.js مربوط بـ '/api' بس). التوكن هنا هو
//    الحماية الأساسية، لكن أي endpoint بيتحقق من توكن محتاج حد لمحاولات
//    التخمين + لأنه بيغيّر حالة الأوردر فعليًا (cancel).
// ----------------------------------------------------------------------------
const marketingTokenLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 200,
  handler: makeHandler('تم تجاوز عدد المحاولات المسموح بها. حاول مرة أخرى بعد شوية.'),
});

// ----------------------------------------------------------------------------
// 4) shippingRatesLimiter — POST /api/shipping/rates: endpoint عام (من غير
//    تسجيل دخول) وبينادي شركات شحن خارجية فعليًا لحساب السعر - كل طلب ليه
//    تكلفة حقيقية (API calls خارجية) فمحتاج حد يمنع إساءة استخدام تكلف
//    فلوس/quota مع مزوّد الشحن، من غير ما يأثر على عميل بيغيّر المحافظة
//    كذا مرة في صفحة الـcheckout العادية.
// ----------------------------------------------------------------------------
const shippingRatesLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: isProd ? 20 : 200,
  handler: makeHandler('طلبات كتير على حساب الشحن. حاول تاني بعد لحظات.'),
});

// ----------------------------------------------------------------------------
// 5) reviewSubmitLimiter — POST /api/settings/reviews: أي زائر يقدر يبعت
//    تقييم (optionalProtect) وكان من غير أي rate limiting خالص (على عكس
//    reviewImageLimiter اللي بيحمي رفع الصورة بس). ده "public form
//    submission" كلاسيكي لازم يتحمي من السبام، بنفس فلسفة contactLimiter
//    الموجود جنبه في نفس الملف.
// ----------------------------------------------------------------------------
const reviewSubmitLimiter = rateLimit({
  ...baseOptions,
  windowMs: 10 * 60 * 1000,
  max: isProd ? 10 : 100,
  handler: makeHandler('تم إرسال تقييمات كثيرة. حاول مرة أخرى لاحقاً.'),
});

// ----------------------------------------------------------------------------
// 6) productListLimiter — GET /api/products: أكبر endpoint عام بيتقرا منه
//    الداتابيز (فيه مسار caching للحالة البسيطة، لكن أي فلترة/بحث بتضرب
//    الداتابيز مباشرة في كل طلب). حد سخي جدًا فوق أي تصفح طبيعي (حتى بيتات
//    كتير خلف نفس الـIP)، هدفه بس منع scraping/DoS بالسكريبت.
// ----------------------------------------------------------------------------
const productListLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: isProd ? 120 : 1000,
  handler: makeHandler('طلبات كتير على المنتجات. حاول تاني بعد لحظات.'),
});

// ----------------------------------------------------------------------------
// 7) paymentStatusLimiter — GET /kashier/status/:orderId و
//    GET /paymob/status/:orderId: تتبع حالة الدفع من غير تسجيل دخول، بيتحقق
//    بـgateway order id. مش endpoint بيغيّر أي حالة (الكونترولر بيرفض غير
//    kashier/paymob ordinal match) لكنه "status lookup" عام برقم قابل
//    للتخمين نظريًا، فمحتاج حد يمنع تعداد/enumeration.
//
// ===== FIX: isProd max كان 30 لكل 15 دقيقة، وده بالظبط نفس رقم MAX_ATTEMPTS
// في الفرونت اند (App.jsx — صفحة payment-complete بتعمل poll كل 4 ثواني لحد
// 30 مرة = "جولة" واحدة بس بتستهلك الحد بالكامل). النتيجة: أي IP واحد (نفس
// الجهاز/الشبكة) بيختبر أكتر من طلب دفع، أو بيعمل refresh لصفحة الدفع، أو
// بيدوس "تحقق الآن"، أو حتى مجرد تجربتين متتاليتين لنفس التاجر وهو بيختبر في
// TEST/SANDBOX — كل ده بيستهلك من نفس الـbucket المشترك (مفتاحه الـIP)، فبعد
// أول جولة استعلام كاملة (أو حتى قبلها لو فيه أي محاولة سابقة في نفس الـ15
// دقيقة) أي poll جديد بيرجعله 429، والفرونت اند بيتعامل مع أي خطأ في الـ
// polling كإنه "لسه pending" ويكمل يحاول لحد ما يوصل MAX_ATTEMPTS ويظهر
// "timeout" — بالظبط نفس عرض "جاري التأكيد" اللي بيفضل عالق وبعدين "بيفشل"
// اللي العميل شايفه، حتى لو الدفع نجح فعلاً عند البوابة. رفعنا الحد هنا لقيمة
// أكبر بهامش أمان كافي (تكفي أكتر من جولة استعلام كاملة + ضغطات "تحقق الآن" +
// عدة عملاء وراء نفس الـIP/NAT) من غير ما نلغي الحماية من enumeration خالص —
// لسه فيه حد أقصى حقيقي، بس مش أقل من احتياج الاستخدام الطبيعي نفسه.
// ----------------------------------------------------------------------------
const paymentStatusLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 300,
  handler: makeHandler('طلبات كتير على حالة الدفع. حاول تاني بعد شوية.'),
});

module.exports = {
  guestVerifyLimiter,
  guestActionLimiter,
  marketingTokenLimiter,
  shippingRatesLimiter,
  reviewSubmitLimiter,
  productListLimiter,
  paymentStatusLimiter,
};