const path = require('path');
// Always load the backend .env next to server.js, regardless of the directory
// from which Node is started (VS Code, root workspace, PM2, Render, etc.).
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { csrfProtection } = require('./middleware/csrf');
const { identifyRateLimitRequest } = require('./middleware/rateLimitIdentity');

// Connect to database first
connectDB();

const app = express();

// Correct client IP handling behind reverse proxies (Vercel/Render/Railway in
// production, but also local dev tunnels/proxies like ngrok, Cloudflare
// Tunnel, or a Windows dev-proxy that forward X-Forwarded-For).
// ===== FIX: this used to be hardcoded to only fire when NODE_ENV==='production'.
// Any request arriving through a proxy that sets X-Forwarded-For while running
// in a non-production NODE_ENV (e.g. local dev behind ngrok/dev-proxy) made
// express-rate-limit throw ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request,
// because Express's default 'trust proxy' (false) rejects that header.
// TRUST_PROXY env var now lets this be configured explicitly:
//   TRUST_PROXY=1        -> trust the first hop (most common: single reverse proxy)
//   TRUST_PROXY=loopback -> trust only proxies on 127.0.0.1/::1 (safe local default)
//   TRUST_PROXY=false    -> disable (default when unset and not production)
// Falls back to the previous production-only behavior when TRUST_PROXY isn't set. =====
if (process.env.TRUST_PROXY) {
  const raw = process.env.TRUST_PROXY.trim();
  const asNumber = Number(raw);
  app.set('trust proxy', Number.isFinite(asNumber) && raw !== '' ? asNumber : raw);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet());

// Compression
app.use(compression());

// CORS
// ملحوظة أمان: لما credentials: true بيبقى مفعّل، مايصحش origin يبقى wildcard ('*').
// في production الـ origin لازم يبقى domain الفرونت اند الفعلي (FRONTEND_URL/CLIENT_URL).
const productionOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL;
if (process.env.NODE_ENV === 'production' && !productionOrigin) {
  console.warn('⚠️  FRONTEND_URL/CLIENT_URL غير موجود في .env — الكوكيز (JWT) مش هتشتغل صح مع الفرونت اند بدون origin محدد.');
}
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? productionOrigin
    : true,
  credentials: true,
}));

// Body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing (لازم قبل أي middleware بيستخدم req.cookies زي auth أو csrf)
app.use(cookieParser());

// حماية CSRF لكل الـ requests اللي بتغيّر بيانات (POST/PUT/PATCH/DELETE)
// بعد ما بقى الـ JWT متخزن في Cookie بدل Authorization header.
// (مش مقيدة بـ /api عشان req.path يفضل شامل المسار الكامل زي '/api/auth/login')
app.use(csrfProtection);

// Request timeout
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 seconds
  res.setTimeout(30000);
  next();
});

// Rate limiting
//
// P1 root-cause fix (Sept 2026): كان فيه دلو واحد بس (createLimiter) مشترك
// بالـIP لكل طلبات /api - زوار الموقع + Admin Dashboard كانوا بياخدوا من نفس
// الـ400 طلب/15 دقيقة. الداشبورد وحدها بتعمل auto-refresh دوري لأكتر من
// قسم طول ما فيه موظف مسجّل دخول، فكانت بتستهلك معظم الدلو المشترك وتخلي أي
// حركة زيادة (تاب تاني، جهاز زميل، عميل بيتصفح) ترجع 429 بسرعة - شكلها
// "السيرفر وقع" مع إنه لسه شغال عادي. تفاصيل كاملة في
// middleware/rateLimitIdentity.js.
//
// الحل: فصل حركة الموظف المسجّل دخول (admin/call_center/packer/staff) في
// دلو مستقل مربوط بحساب الموظف (مش بالـIP) عن طريق staffLimiter تحت. الدلو
// العام (createLimiter) فضل بالضبط بنفس الرقم اللي كان عليه قبل كده لحماية
// الزوار/الـpublic traffic - مفيش أي تخفيف في الحماية دي.
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 400 : 1500, // نفس الرقم القديم تمامًا - مفيش أي رفع هنا
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  // موظف مسجّل دخول بياخد دلوه المستقل (staffLimiter تحت) بدل ما يستهلك
  // دلو الزوار العام.
  skip: (req) => req.isStaffRequest === true,
});

// دلو مستقل لحركة الموظفين المسجّلين دخول بس (مربوط بحساب الموظف نفسه، مش
// بالـIP)، مبني على حجم الاستخدام الفعلي للداشبورد (auto-refresh كل 10
// ثواني لعدة أقسام في نفس الوقت طول ما اللوحة مفتوحة ≈ 350-400 طلب/15
// دقيقة من تاب واحد بس واقف، زائد هامش حقيقي للتنقل اليدوي وأكتر من تاب/جهاز
// موظفين في نفس الوقت) - مش رقم عشوائي كبير لإخفاء المشكلة، ومحتفظ بسقف
// حقيقي يمنع أي إساءة استخدام فعلية من حساب موظف واحد.
const staffLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 1200 : 4500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  keyGenerator: (req) => req.staffId || req.ip,
  skip: (req) => req.isStaffRequest !== true,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 200,
  skipSuccessfulRequests: true,
  message: { message: 'Too many authentication attempts, please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 200 : 800,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Rate limit exceeded, please slow down.' },
});

// OTP endpoints get an additional limiter. The controller also limits each email
// to one code per minute and a maximum of five verification attempts.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'تم إرسال أكواد كثيرة. حاول مرة أخرى لاحقاً.' },
});

const healthBypassLimiter = (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  return createLimiter(req, res, next);
};

// Apply rate limiters
// لازم identifyRateLimitRequest يتنفذ الأول عشان يحدد isStaffRequest/staffId
// قبل ما أي limiter يقرر هل يطبّق ولا يـskip الطلب.
app.use('/api', identifyRateLimitRequest);
app.use('/api', healthBypassLimiter);
app.use('/api', staffLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/auth/send-code', otpLimiter);
app.use('/api/auth/forgot-password', otpLimiter);
app.use('/api/auth/reset-password', otpLimiter);
app.use('/api/auth/admin-config/send-otp', otpLimiter);
app.use('/api/orders', apiLimiter);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/exchange-requests', require('./routes/exchangeRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/shipping', require('./routes/shippingRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/abandoned-carts', require('./routes/abandonedCartRoutes'));
app.use('/api/marketing', require('./routes/marketingRoutes'));
app.use('/marketing', require('./routes/marketingPublicRoutes'));

// Brevo/marketing worker runs server-side only. It never blocks API requests.
require('./services/marketingWorker').startMarketingWorker().catch(err => console.error('Marketing worker startup:', err));

// Payment-expiry worker: auto-fails Kashier/Paymob orders stuck on "pending"
// (customer opened the payment page and never finished/cancelled) and releases
// their reserved stock after Settings.paymentSettings.pendingTimeoutMinutes.
require('./services/paymentExpiryWorker').startPaymentExpiryWorker().catch(err => console.error('Payment-expiry worker startup:', err));

// Shipping-sync worker: بيحدّث حالة شحنات الطلبات النشطة تلقائيًا من غير
// ما حد يدوس "تحديث التتبع" يدويًا في الأدمن (شوف services/shippingSyncWorker.js).
require('./services/shippingSyncWorker').startShippingSyncWorker().catch(err => console.error('Shipping-sync worker startup:', err));

// Profit-alert worker: فحص يومي لصافي الربح ومعدل الإرجاع (آخر 7 أيام)، وبيبعت
// إيميل تنبيه للأدمن عن طريق Brevo لو صافي الربح سالب أو معدل الإرجاع ارتفع فجأة.
require('./services/profitAlertWorker').startProfitAlertWorker().catch(err => console.error('Profit-alert worker startup:', err));

// License remote HTTP transport (PART 3C): wires the real fetch-based
// transport into licenseRemoteClient.js's dependency-injection seam
// (setRemoteTransport) — see services/license/licenseRemoteTransport.js.
// Must run before anything that might call activate/validate/heartbeat/
// deactivate (i.e. before the heartbeat scheduler starts below). Safe
// to always call: if LICENSE_REMOTE_ENABLED=false, licenseRemoteClient
// rejects before ever invoking the transport, so this wiring is inert.
require('./services/license/licenseRemoteClient').setRemoteTransport(
  require('./services/license/licenseRemoteTransport').httpTransport
);

// License remote heartbeat scheduler (PART 2B-2C-1): بيبعت heartbeat دوري
// لـactivations النشطة عشان يحدّث trusted remote state بس - **مفيش أي
// enforcement هنا خالص** (مفيش blocking لأي request/route). الـscheduler
// بيبدأ بس لو LICENSE_REMOTE_HEARTBEAT_ENABLED=true (default: false) -
// نفس نمط الـworkers التانية فوق (fire-and-forget، معتمد على mongoose
// command buffering لحد ما الـDB تتوصل، بدون connection جديدة). التفاصيل
// كاملة في services/license/licenseRemoteHeartbeatBootstrap.js.
require('./services/license/licenseRemoteHeartbeatBootstrap').startLicenseHeartbeatScheduler();

app.use('/api/traffic', require('./routes/trafficRoutes'));
app.use('/api/push', require('./routes/pushRoutes'));
app.use('/api/activity-logs', require('./routes/activityLogRoutes'));
// PART 2B-2C-3: route-level license enforcement - admin-only، مفيش أي
// global middleware هنا، الحماية جوه licenseRoutes.js نفسه على /status بس.
app.use('/api/license', require('./routes/licenseRoutes'));

// Product Catalog Feeds (Meta / Google / TikTok / Snapchat)
// لا يحتاج /api prefix — المنصات بتجيب اللينك مباشرة
app.use('/feeds', require('./routes/feedRoutes'));

// sitemap.xml و robots.txt (SEO) — بدون /api prefix عشان محركات البحث تلاقيهم في المكان المتوقع.
// ملحوظة مهمة: لو الفرونت والباك إند على دومينين مختلفين، لازم الـ reverse proxy/CDN
// بتاع دومين الفرونت يعمل proxy لمسارات /sitemap.xml و /robots.txt على الباك إند ده،
// عشان جوجل يلاقيهم على دومين المتجر نفسه.
const { getSitemap, getRobotsTxt } = require('./controllers/sitemapController');
app.get('/sitemap.xml', getSitemap);
app.get('/robots.txt', getRobotsTxt);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await mongoose.connection.db.admin().ping();
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err) {
    // P1-6: /api/health مسار عام بدون مصادقة - منسبش تفاصيل خطأ الاتصال
    // بقاعدة البيانات الخام (ممكن تحتوي host/connection string) للعميل.
    console.error('Health check DB ping failed:', err);
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/', (req, res) => {
  res.send('LAVA Server is Running 🔥');
});

// Global error handler
app.use((err, req, res, next) => {
  const requestId = req.headers['x-request-id'] || 'N/A';

  // اللوج الداخلي بيحتفظ بكل التفاصيل (رسالة + stack) - ده مش اللي بيتبعت للعميل.
  console.error('Error:', {
    message: err.message || 'Internal server error',
    stack: err.stack,
    requestId,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
  });

  // P1-6: منسبش رسالة الخطأ الخام (ممكن تكون Mongoose/Mongo error، مسار
  // ملف، تفاصيل مكتبة داخلية...) للعميل غير لو الخطأ اتعلّم صراحة إنه آمن
  // للعرض (err.expose === true) - زي أخطاء business-rule/validation اللي
  // بترمي بـ AppError أو حاجة شبهها. غير كده، برجع رسالة عامة بس.
  // - أخطاء التحقق من Mongoose (ValidationError/CastError) ليها statusCode
  //   واضح (400) لكن رسالتها لسه ممكن تكشف اسم الحقل/الـschema الداخلي،
  //   فبتترجم لرسالة عامة "بيانات غير صالحة" بدل النص الخام.
  const statusCode = err.statusCode || err.status || 500;
  let clientMessage = 'حصل خطأ في السيرفر';

  if (err.expose === true && err.message) {
    clientMessage = err.message;
  } else if (err.name === 'ValidationError' || err.name === 'CastError') {
    clientMessage = 'بيانات الطلب غير صالحة';
  } else if (statusCode < 500 && err.message) {
    // أخطاء 4xx غير متوقعة (مش من مسار controller عادي بيتعامل معاها بنفسه)
    // غالبًا رسالتها آمنة (زي أخطاء middleware مثل body-parser/CORS)، لكن
    // برضو منعرضش أي حاجة فيها مسار ملف أو تفاصيل داخلية واضحة.
    const looksInternal = /\/(home|usr|var|mnt|node_modules)\/|\.js:\d+|at\s+\w+.*\(.*:\d+:\d+\)/i.test(err.message);
    clientMessage = looksInternal ? 'حصل خطأ في الطلب' : err.message;
  }

  res.status(statusCode).json({
    message: clientMessage,
    requestId,
    // الـstack مايتبعتش في الرد أبدًا في production - في development بس
    // للمساعدة في الديباج المحلي.
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

const PORT = parseInt(process.env.PORT || process.env.port, 10) || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the other process or use a different port.`);
    console.error('You can find the process using: netstat -ano | findstr :' + PORT);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  require('./services/license/licenseRemoteHeartbeatBootstrap').stopLicenseHeartbeatScheduler();
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  require('./services/license/licenseRemoteHeartbeatBootstrap').stopLicenseHeartbeatScheduler();
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Unhandled rejection handler
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Don't exit, just log
});

module.exports = app;