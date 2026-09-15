const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  storeName: { ar: String, en: String },
  logoText: { ar: String, en: String },
  phone: String,
  whatsapp: String,
  email: String,
  adminEmail: String,
  // Legacy fields kept only for backward compatibility; authentication is stored on User.
  adminPassword: { type: String, select: false },
  adminPhone: String,
  // ===== إعدادات تسجيل دخول العملاء / Resend =====
  customerLoginMethod: { type: String, enum: ['email_password', 'email_code'], default: 'email_password' },
  resendFromEmail: { type: String, default: 'onboarding@resend.dev', trim: true, lowercase: true },
  // ===== الشركة المستخدمة لإرسال رسايل الـ OTP (كود الدخول / إعادة تعيين الباسورد / تأكيد الأدمن) =====
  otpEmailProvider: { type: String, enum: ['resend', 'brevo'], default: 'resend' },
  heroImage: String,
  heroVideo: String,
  heroTitle: { ar: String, en: String },
  heroSubtitle: { ar: String, en: String },
  aboutText: { ar: String, en: String },
  aboutImage: String,
  footerLocation: { ar: String, en: String },
  socialFacebook: String,
  socialInstagram: String,
  socialTiktok: String,
  socialYoutube: String,
  socialLinkedin: String,
  socialSnapchat: String,
  socialFacebookEnabled: { type: Boolean, default: true },
  socialInstagramEnabled: { type: Boolean, default: true },
  socialTiktokEnabled: { type: Boolean, default: true },
  socialYoutubeEnabled: { type: Boolean, default: false },
  socialLinkedinEnabled: { type: Boolean, default: false },
  socialSnapchatEnabled: { type: Boolean, default: false },
  showLocation: { type: Boolean, default: true },
  locationText: { ar: String, en: String },
  freeShippingThreshold: { type: Number, default: 1500 },
  defaultShippingCost: { type: Number, default: 90 },
  // ===== مدة التوصيل المعروضة للعميل (نص "شحن سريع" في صفحة المنتج) =====
  // قيمة عرض/تسويق بس (مش مرتبطة بحساب فعلي لتاريخ وصول الشحنة) - قابلة
  // للتعديل من لوحة التحكم (الشحن والمحافظات).
  shippingMinDays: { type: Number, default: 3, min: 0 },
  shippingMaxDays: { type: Number, default: 5, min: 0 },
  // ===== رسوم استرجاع تتخصم من مبلغ الاسترجاع =====
  // بتتطبق بس لو سبب الاسترجاع من نوع "اختيار العميل" (مقاس/غيّر رأيه/سبب تاني)،
  // مش لو السبب عيب في المنتج أو غلط من المتجر (شوف utils/returnReasons.js).
  // قابلة للتعديل من لوحة التحكم - صفحة الإعدادات.
  returnFeeAmount: { type: Number, default: 160, min: 0 },

  // ===== Returns & Exchanges - Phase 2A =====
  // كل القيم دي قابلة للتعديل من لوحة التحكم (PUT /api/settings العام - مفيش
  // كنترولر خاص بيها، بتتحدث زي أي حقل تاني في الموديل ده). الـBackend فقط
  // (orderController/exchangeController عبر utils/returnExchangeFees.js) هو
  // اللي بيقرأها ويحسب الرسوم/الأهلية - مفيش أي قيمة منها بتتقبل من الفرونت
  // وقت إنشاء طلب استرجاع/استبدال.
  enableReturns: { type: Boolean, default: true },
  // returnWindow: عدد الأيام المسموح فيها بطلب استرجاع بعد الاستلام (للأسباب
  // العادية زي مقاس/غيّر رأيه). محسوبة من Order.deliveredAt.
  returnWindow: { type: Number, default: 7, min: 0 },
  // defectiveProductWindow: نافذة زمنية منفصلة (بالأيام) تتطبق بس لو السبب
  // "عيب في المنتج" أو "استلمت منتج غلط" (شوف utils/returnReasons.js -
  // evidenceRequired/doesReasonApplyFee لنفس مجموعة الأسباب دي).
  defectiveProductWindow: { type: Number, default: 3, min: 0 },

  enableExchanges: { type: Boolean, default: true },
  // Exchange Fee - منفصلة تمامًا عن returnFeeAmount، الأدمن يقدر يغيّرها لوحدها.
  exchangeFeeAmount: { type: Number, default: 180, min: 0 },
  exchangeWindow: { type: Number, default: 7, min: 0 },

  // requireEvidenceImages: لو true، الأسباب اللي evidenceRequired=true (عيب/
  // منتج غلط/مش مطابق) لازم تيجي مع صور إثبات وإلا الطلب يترفض من الـBackend.
  requireEvidenceImages: { type: Boolean, default: false },
  // freeStoreErrorReturns/Exchanges: لو true، الحالات اللي سببها خطأ من
  // المتجر/المنتج (feeApplies=false في utils/returnReasons.js و
  // utils/exchangeReasons.js) بتبقى مجانية (Fee = 0) تلقائيًا من الـBackend.
  freeStoreErrorReturns: { type: Boolean, default: true },
  freeStoreErrorExchanges: { type: Boolean, default: true },
  // ===== Returns & Exchanges - Phase 2B: Reasons Management =====
  // قايمة قابلة للتعديل من Admin (تسميات ar/en، enabled، وممكن إضافة أسباب
  // custom جديدة). Mixed عشان الشكل مرن (زي باقي القوايم في الموديل ده)، وبيتم
  // قراءتها عبر utils/returnReasons.js - getEffectiveReturnReasons (والـ
  // equivalent للاستبدال) اللي بترجع للقايمة الثابتة fallback لو فاضية.
  returnReasons: [{ type: mongoose.Schema.Types.Mixed }],
  exchangeReasons: [{ type: mongoose.Schema.Types.Mixed }],

  // ===== Returns & Exchanges - Phase 3: صفحة السياسة العامة (/returns) =====
  // العرض بس - النص هنا لا يتحكم أبدًا في Business Logic (الأهلية/الرسوم/المدد
  // بتتحسب من returnFeeAmount/exchangeFeeAmount/returnWindow/exchangeWindow فوق،
  // مش من هنا). Mixed عشان الشكل مرن زي seo/promotions تحت في نفس الملف - بيتقرا
  // ويتحدث عادي عبر GET /api/settings/public و PUT /api/settings الموجودين
  // بالفعل، مفيش API جديد.
  returnsPolicy: { type: mongoose.Schema.Types.Mixed, default: null },
  shippingIntegrations: { type: mongoose.Schema.Types.Mixed, default: {} },
  showCountdownBar: { type: Boolean, default: true },
  saleEndDate: String,
  showZipCode: { type: Boolean, default: false },
  showCountry: { type: Boolean, default: true },
  requiredPhone2: { type: Boolean, default: false },
  showPhone2: { type: Boolean, default: false },
  showCheckoutNotes: { type: Boolean, default: false },
  // ===== إعدادات طرق الدفع الرئيسية =====
  paymentSettings: {
    manualEnabled: { type: Boolean, default: true },
    codEnabled: { type: Boolean, default: true },
    kashierEnabled: { type: Boolean, default: false },
    paymobEnabled: { type: Boolean, default: false },
    // ===== مهلة انتظار الدفع الإلكتروني (Kashier/Paymob) بالدقايق =====
    // لو العميل دخل بوابة الدفع وماكملش (رجع بالسهم لورا، قفل التاب...)، الطلب
    // بيفضل "pending" والمخزون محجوز لحد ما المهلة دي تخلص، وقتها يتحول الطلب
    // لـ "failed" تلقائيًا ويترجع المخزون. مينفعش تكون أقل من دقيقة واحدة.
    pendingTimeoutMinutes: { type: Number, default: 20, min: 1 },
  },
  // ===== وسائل الدفع الإلكتروني (محفظة/انستاباي/فودافون كاش... الأدمن يضيف أكتر من وسيلة) =====
  paymentMethods: [{
    name: { ar: { type: String, default: '' }, en: { type: String, default: '' } },
    phoneNumber: { type: String, default: '' },
    instructions: { ar: { type: String, default: '' }, en: { type: String, default: '' } },
    icon: { type: String, default: '📱' },
    enabled: { type: Boolean, default: true },
    screenshotRequired: { type: Boolean, default: false },
    transferDetailsRequired: { type: Boolean, default: true },
  }],
  tiktokApiKey: String,
  metaApiKey: String,
  snapchatApiKey: String,
  googleApiKey: String,
  metaPixelId: String,
  tiktokPixelId: String,
  googlePixelId: String,
  snapchatPixelId: String,
  metaCatalogEnabled: { type: Boolean, default: false },
  tiktokCatalogEnabled: { type: Boolean, default: false },
  googleCatalogEnabled: { type: Boolean, default: false },
  snapchatCatalogEnabled: { type: Boolean, default: false },
  showRecommendations: { type: Boolean, default: true },
  showBundleOffers: { type: Boolean, default: true },
  showRecentlyViewed: { type: Boolean, default: false }, // إظهار قسم "شاهدته مؤخراً" تحت تفاصيل المنتج
  // إظهار عدد العملاء اللي بيشوفوا صفحة المنتج دلوقتي (Live Viewers) للعميل في المتجر
  showLiveViewers: { type: Boolean, default: false },
  showFooterCategories: { type: Boolean, default: true },
  showReviews: { type: Boolean, default: true },
  reviewsRequireApproval: { type: Boolean, default: true },
  allowReviewImages: { type: Boolean, default: true },
  allowReviewImages: { type: Boolean, default: true },
  showConfirmedExportForCallCenter: { type: Boolean, default: true },
  logoImage: String,
  useLogoImage: { type: Boolean, default: false },
  faviconImage: String,
  displayOutOfStockProducts: { type: Boolean, default: true },
  defaultLowStockThreshold: { type: Number, default: 5 },
  // ===== FIX: مدة الخمول (بالدقايق) قبل ما نعتبر السلة "متروكة" فعلاً في
  // شاشة السلات المتروكة — كانت قيمة ثابتة في الكود (10 دقايق)، دلوقتي
  // الأدمن يقدر يغيّرها من شاشة السلات المتروكة نفسها.
  abandonedCartIdleMinutes: { type: Number, default: 30 },
  categories: [{ type: mongoose.Schema.Types.Mixed }],
  governorates: [{ type: mongoose.Schema.Types.Mixed }],
  countries: [{ type: mongoose.Schema.Types.Mixed }],
  homeSections: [{ type: mongoose.Schema.Types.Mixed }],
  customPages: [{ type: mongoose.Schema.Types.Mixed }],
  footerLinks: [{ type: mongoose.Schema.Types.Mixed }],
  promotions: {
    guestDiscount: {
      enabled: { type: Boolean, default: true },
      percentage: { type: Number, default: 5 },
      title: { ar: String, en: String },
      message: { ar: String, en: String },
      buttonText: { ar: String, en: String },
    },
    welcomeOffer: {
      enabled: { type: Boolean, default: false },
      promotionId: { type: String },
      image: String,
      title: { ar: String, en: String },
      description: { ar: String, en: String },
      offerText: { ar: String, en: String },
      buttonText: { ar: String, en: String },
      destinationType: { type: String, default: 'shop' },
      productId: { type: String },
      categoryId: { type: String },
    },
  },
  campaigns: [{ type: mongoose.Schema.Types.Mixed }],
  marketing: {
    enabled: { type: Boolean, default: false },
    orderConfirmation: { type: Boolean, default: false },
    orderConfirmationChannel: { type: String, enum: ['email', 'whatsapp'], default: 'email' },
    statusNotifications: { type: Boolean, default: false },
    statusChannels: [{ type: mongoose.Schema.Types.Mixed }],
    abandonedCart: {
      enabled: { type: Boolean, default: false },
      steps: [{ type: mongoose.Schema.Types.Mixed }],
    },
    whatsapp: { enabled: { type: Boolean, default: false }, senderNumber: String },
  },
  discountCodes: [{ type: mongoose.Schema.Types.Mixed }],
  expenses: [{ type: mongoose.Schema.Types.Mixed }],
  // ===== تتبع آخر تنبيه اتبعت لصاحب المتجر عن صحة الربح/الإرجاع =====
  // بيمنع إرسال نفس التنبيه أكتر من مرة في نفس اليوم (شوف profitAlertWorker.js)
  profitAlerts: {
    lastNegativeProfitAlertAt: { type: Date, default: null },
    lastReturnRateAlertAt: { type: Date, default: null },
  },

  contactMessages: [{ type: mongoose.Schema.Types.Mixed }],
  faqs: [{ type: mongoose.Schema.Types.Mixed }],
  productReviews: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  salesData: [{ type: mongoose.Schema.Types.Mixed }],

  // ===== التحكم في أقسام الصفحة الرئيسية =====
  showFeaturedSection: { type: Boolean, default: true },
  showAboutSection: { type: Boolean, default: true },
  featuredSectionTitle: { ar: String, en: String },
  featuredDisplayStyle: { type: String, default: 'grid' },

  // ===== نظام الثيمات =====
  activeTheme: { type: String, default: 'classic' },
  customTheme: { type: mongoose.Schema.Types.Mixed, default: null },

  // ===== تحسين محركات البحث (SEO) على مستوى المتجر بالكامل =====
  seo: {
    metaTitle: { ar: String, en: String },
    metaDescription: { ar: String, en: String },
    keywords: { ar: String, en: String },
    canonicalBaseUrl: { type: String, default: '' },
    ogImage: { type: String, default: '' },
    googleSiteVerification: { type: String, default: '' },
    bingSiteVerification: { type: String, default: '' },
  },

  // ===== نظام الولاء =====
  // loyaltyProgram: الإعدادات الكاملة لنظام الولاء
  loyaltyProgram: {
    enabled: { type: Boolean, default: false },
    ordersRequired: { type: Number, default: 10 },       // كام طلب علشان يستحق الجائزة
    rewardType: { type: String, default: 'percentage' },  // 'percentage' | 'fixed' | 'product'
    rewardValue: { type: Number, default: 10 },           // النسبة أو المبلغ
    rewardProductId: { type: String, default: null },     // لو rewardType = 'product'
    codePrefix: { type: String, default: 'LOYALTY' },    // بداية الكود اللي بيتوّلد
    singleUse: { type: Boolean, default: true },          // الكود بيستخدم مرة واحدة بس
    specificProductId: { type: String, default: null },   // لو الكود لمنتج معين بس
    title: { ar: String, en: String },
    message: { ar: String, en: String },
  },

}, { 
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false },
});

settingsSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Settings', settingsSchema);