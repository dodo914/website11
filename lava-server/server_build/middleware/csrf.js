// حماية CSRF بنمط Double-Submit Cookie
// بما إن الـ JWT بقى HttpOnly Cookie، لازم نتأكد إن أي POST/PUT/PATCH/DELETE
// جاي فعلاً من الفرونت اند بتاعنا مش من موقع تاني بيستغل تسجيل دخول المستخدم.
// الفكرة: بنبعت CSRF token في كوكي قابلة للقراءة من الـ JS، والفرونت لازم يبعتها
// تاني كـ Header (x-csrf-token). أي حد بره الموقع مايقدرش يقرا الكوكي بتاعتنا عشان
// Same-Origin Policy، فمايقدرش يبني الهيدر ده صح.

const { CSRF_COOKIE_NAME } = require('../utils/cookieAuth');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// المسارات دي مش محتاجة CSRF لأنها بتحصل قبل ما يبقى فيه أي جلسة مسجلة
// (تسجيل الدخول نفسه محمي بالفعل بـ SameSite=Lax + rate limiting)
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/send-code',
  '/api/auth/verify-code',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/check-email',
  // تتبع الزوار/السلة المتروكة: مسارات عامة بدون جلسة مسجلة، نفس مستوى الحماية
  // اللي كانت موجودة قبل التعديل (مفيش auth أصلاً هنا) — تزويرها مايأثرش على حساب مستخدم.
  '/api/traffic/visit',
  '/api/traffic/pageview',
  '/api/traffic/convert',
  '/api/traffic/funnel',
  '/api/abandoned-carts',
  '/api/abandoned-carts/recover',
  // Kashier server-to-server webhook — no browser CSRF token is available.
  '/api/payments/kashier/webhook',
  // ===== FIX: Paymob's webhook was missing from this list entirely, so every
  // single Paymob webhook delivery (payment success, failure, AND refund) was
  // being rejected here with 403 "طلب غير موثوق (CSRF)" before it ever reached
  // handlePaymobWebhook in controllers/paymentController.js. Paymob calls this
  // URL server-to-server (no browser, no cookie, no CSRF header can ever be
  // attached to it) — same situation as the Kashier webhook line right above,
  // which is why that one already had this exemption and this one didn't.
  // Real authentication for this endpoint is still enforced right after this
  // (verifyPaymobHmac against the query "hmac" param), this exemption only
  // stops CSRF from blocking it before that check even runs. =====
  '/api/payments/paymob/webhook',
]);

// ===== FIX: shipping provider webhooks (Bosta/ShipBlu) are server-to-server
// calls (no browser, no cookie, no CSRF header can ever be attached) - same
// situation as the Kashier/Paymob webhook exemptions above. These were
// previously listed in EXEMPT_PATHS as bare '/api/shipping/webhooks/bosta',
// but the actual route is '/api/shipping/webhooks/bosta/:secret' (the secret
// is a path segment, see routes/shippingRoutes.js) - req.path always includes
// that secret segment, so the exact-match EXEMPT_PATHS.has(req.path) NEVER
// matched and every single Bosta webhook delivery was being rejected here
// with 403 before it ever reached handleBostaWebhook. ShipBlu's webhook
// wasn't exempted at all. Real authentication for both endpoints still
// happens right after this, inside the controller (constant-time secret
// comparison against the :secret path param) - this exemption only stops
// CSRF from blocking the request before that check even runs. We match by
// prefix (not exact path) specifically because the secret is part of the
// path itself. =====
const WEBHOOK_PREFIX_EXEMPTIONS = [
  '/api/shipping/webhooks/bosta/',
  '/api/shipping/webhooks/shipblu/',
];
const isExemptWebhookPath = (path) => WEBHOOK_PREFIX_EXEMPTIONS.some((prefix) => path.startsWith(prefix));

// ===== P1-5: فورم إلغاء الأوردر من رابط الإيميل (guest، من غير أي جلسة
// تسجيل دخول أو كوكي CSRF أصلاً - العميل بيفتح الرابط من الإيميل مباشرة في
// تاب جديد). الحماية هنا مش الـdouble-submit cookie لأنه مفيش cookie للعميل
// الغير مسجل دخول أصلاً، الحماية الحقيقية هي التوكن الموقّع (HMAC) نفسه في
// الـURL (unguessable + بينتهي + محدد لطلب واحد بالإيميل بتاعه) - نفس مبدأ
// أي "magic link" (زي روابط تأكيد الإيميل واستعادة كلمة المرور بالكود).
const isCancelEmailFormPath = (path) => /^\/marketing\/order-cancel\/[^/]+$/.test(path);

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PATHS.has(req.path)) return next();
  if (isCancelEmailFormPath(req.path)) return next();
  if (isExemptWebhookPath(req.path)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: 'طلب غير موثوق (CSRF). حدّث الصفحة وحاول مرة أخرى.' });
  }

  return next();
};

module.exports = { csrfProtection };