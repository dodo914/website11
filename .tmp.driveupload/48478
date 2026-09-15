const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const Review = require('../models/Review');
const ContactMessage = require('../models/ContactMessage');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { get, set, invalidateSettingsCaches, invalidateProductCaches, invalidateReviewCaches, CACHE_TTL, CACHE_KEYS } = require('../utils/cache');
const { logActivity } = require('../utils/activityLogger');
const { parsePagination, buildListResponse } = require('../utils/pagination');
const { isValidEmail, isValidPhone, validateName } = require('../utils/validators');
const { uploadImageToCloudinary, uploadVideoToCloudinary, deleteVideoFromCloudinary, getCloudinaryPublicId } = require('../utils/uploadToCloudinary');

// ===== Returns & Exchanges - Phase 2B: قوايم الأسباب القابلة للتعديل من Admin =====
// Seed مبدئي من القايمة الثابتة في utils/returnReasons.js / exchangeReasons.js
// (نفس الأكواد بالظبط). الأدمن يقدر بعد كده يعدّل ar/en أو enabled، أو يضيف
// سبب custom جديد، من Admin → Returns & Exchanges → Reasons، وبيتحفظ هنا
// كجزء عادي من مستند الإعدادات (نفس آلية باقي الإعدادات - مفيش API جديد).
const { RETURN_REASONS } = require('../utils/returnReasons');
const { EXCHANGE_REASONS } = require('../utils/exchangeReasons');

const buildSettingsDefaults = () => ({
  // ===== التحكم في أقسام الصفحة الرئيسية =====
  showFeaturedSection: true,
  showAboutSection: true,
  featuredSectionTitle: { ar: 'منتجات مميزة', en: 'Featured Products' },
  featuredDisplayStyle: 'grid',

  // ===== نظام الثيمات =====
  activeTheme: 'classic',
  customTheme: null,

  // ===== تحسين محركات البحث (SEO) =====
  seo: {
    metaTitle: { ar: '', en: '' },
    metaDescription: { ar: '', en: '' },
    keywords: { ar: '', en: '' },
    canonicalBaseUrl: '',
    ogImage: '',
    googleSiteVerification: '',
    bingSiteVerification: '',
  },

  // ===== إعدادات تسجيل الدخول للعملاء =====
  customerLoginMethod: 'email_password',
  resendFromEmail: 'onboarding@resend.dev',

  freeShippingThreshold: 1500,
  defaultShippingCost: 90,
  returnFeeAmount: 160,
  // ===== Returns & Exchanges - Phase 2A =====
  enableReturns: true,
  returnWindow: 7,
  defectiveProductWindow: 3,
  enableExchanges: true,
  exchangeFeeAmount: 180,
  exchangeWindow: 7,
  requireEvidenceImages: false,
  freeStoreErrorReturns: true,
  freeStoreErrorExchanges: true,
  // ===== Returns & Exchanges - Phase 2B: Reasons Management =====
  returnReasons: RETURN_REASONS.map((r) => ({ ...r, enabled: true, custom: false })),
  exchangeReasons: EXCHANGE_REASONS.map((r) => ({ ...r, enabled: true, custom: false })),
  // ===== Returns & Exchanges - Phase 3: صفحة السياسة (/returns) =====
  // عرض بس (شوف الملاحظة في models/Settings.js) - نفس الديفولت المستخدم في
  // الفرونت (App.jsx) عشان أول مرة يتفتح فيها الموقع، قبل ما الأدمن يعدّل حاجة،
  // يبقى فيه محتوى منطقي بدل صفحة فاضية.
  returnsPolicy: {
    enabled: true,
    lastUpdated: null,
    title: { ar: 'الاسترجاع والاستبدال', en: 'Returns & Exchanges' },
    intro: {
      ar: 'قبل تقديم طلب استرجاع أو استبدال، من فضلك اطّلع على الشروط التالية.',
      en: 'Before submitting a return or exchange request, please review the terms below.',
    },
    content: {
      ar: '• تقديم طلب الاستبدال أو الاسترجاع يكون خلال {{returnWindow}} أيام من تاريخ استلام الشحنة.\n• يجب أن تكون الشحنة/المنتجات في حالتها الأصلية مع بطاقة المقاس الخاصة بها.\n• في حالة الاسترجاع يتحمل العميل تكلفة الشحن ذهابًا وعودة وفق الرسوم المحددة من المتجر ({{returnFee}} {{currency}}).\n• الرسوم قد تُطبَّق أيضًا خلال فترات الشحن المجاني وفق سياسة المتجر والقانون.\n• لن تُقبل الطلبات المقدَّمة بعد انتهاء الفترة المحددة، مع مراعاة الحقوق القانونية للمستهلك.\n• المنتجات التي تعرضت للتلف أو فقدت بطاقة المقاس قد لا تكون مؤهلة للاسترجاع أو الاستبدال حسب الحالة والسياسة والقانون.\n• يمكن لكل شحنة إجراء Return أو Exchange (رسوم الاستبدال: {{exchangeFee}} {{currency}}) وفق القواعد المحددة.\n• أي رسوم إضافية تكون وفق سياسة المتجر والقانون.\n• يتم رد المبلغ وفق طريقة الاسترداد التي يحددها المتجر ووفق المدة المحددة في السياسة.\n• حالات استلام منتج تالف أو معيوب أو مختلف عن الطلب يتم التعامل معها كحالات "خطأ من المتجر" وفق النظام والسياسة والقانون.\n• هذه السياسة لا تنتقص من أي حقوق قانونية للمستهلك.',
      en: '• Return or exchange requests must be submitted within {{returnWindow}} days of receiving your shipment.\n• Items must be in their original condition with the size tag attached.\n• For returns, the customer bears the round-trip shipping cost according to the store\'s fees ({{returnFee}} {{currency}}).\n• Fees may also apply during free-shipping periods, subject to store policy and applicable law.\n• Requests submitted after the deadline will not be accepted, without prejudice to consumer legal rights.\n• Damaged items or items missing their size tag may not be eligible for return or exchange, depending on condition, policy, and law.\n• Each shipment may have one Return or Exchange (exchange fee: {{exchangeFee}} {{currency}}) processed according to the rules in place.\n• Any additional fees are subject to store policy and applicable law.\n• Refunds are issued according to the store\'s chosen refund method and within the timeframe specified in this policy.\n• Cases of receiving a damaged, defective, or incorrect item are treated as Store Error cases under the system, this policy, and applicable law.\n• This policy does not diminish any legal rights you may have as a consumer.',
    },
  },
  showCountdownBar: true,
  showZipCode: false,
  showCountry: true,
  showPhone2: false,
  requiredPhone2: false,
  showCheckoutNotes: false,
  paymentSettings: { manualEnabled: true, codEnabled: true, kashierEnabled: false },
  showReviews: true,
  reviewsRequireApproval: true,
  allowReviewImages: true,
  allowReviewImages: true,
  defaultLowStockThreshold: 5,
  abandonedCartIdleMinutes: 30,
  displayOutOfStockProducts: true,
  showRecommendations: true,
  showBundleOffers: true,
  showRecentlyViewed: false,
  showLiveViewers: false,
  showFooterCategories: true,
  showConfirmedExportForCallCenter: true,
  promotions: {
    guestDiscount: {
      enabled: true,
      percentage: 5,
      title: { ar: 'خصم 5%', en: 'Get 5% OFF' },
      message: { ar: 'اعمل حساب وخد خصم 5% على أول طلب ليك', en: 'Create an account and get 5% OFF your first order.' },
      buttonText: { ar: 'تسجيل الدخول / إنشاء حساب', en: 'Login / Register' },
    },
    welcomeOffer: {
      enabled: false,
      promotionId: null,
      image: '',
      title: { ar: 'عرض خاص 🎁', en: 'Special Offer 🎁' },
      description: { ar: 'احصل على عرض حصري لفترة محدودة', en: 'Get an exclusive offer for a limited time' },
      offerText: { ar: '', en: '' },
      buttonText: { ar: 'تسوق الآن', en: 'Shop Now' },
      destinationType: 'shop',
      productId: null,
      categoryId: null,
    },
  },
  campaigns: [],
  marketing: {
    enabled: false,
    orderConfirmation: false,
    orderConfirmationChannel: 'email',
    statusNotifications: false,
    statusChannels: [],
    abandonedCart: { enabled: false, steps: [{ delayMinutes: 120, channel: 'email', subject: 'نسيت حاجة في السلة؟', content: 'لسه منتجاتك مستنياك في السلة.', couponCode: '' }] },
    whatsapp: { enabled: false, senderNumber: '' },
  },
  discountCodes: [
    { id: 1, code: 'WELCOME10', discountPercent: 10, isActive: true },
    { id: 2, code: 'SUMMER20', discountPercent: 20, isActive: true },
  ],
  expenses: [
    { id: 1, title: 'إعلان تمويلى فيسبوك', amount: 500 }
  ],
  contactMessages: [],
  faqs: [
    { id: 1, q: { ar: 'إيه هي سياسة الاسترجاع؟', en: 'What is the return policy?' }, a: { ar: 'تقدر ترجع المنتج خلال 14 يوم من الاستلام، بشرط يكون بحالته الأصلية.', en: 'You can return the product within 14 days of receipt, provided it is in its original condition.' } },
    { id: 2, q: { ar: 'مدة التوصيل قد إيه؟', en: 'How long does delivery take?' }, a: { ar: 'التوصيل بياخد من 3 لـ 5 أيام عمل حسب محافظتك.', en: 'Delivery takes 3 to 5 business days depending on your governorate.' } }
  ],
  productReviews: {},
  salesData: [
    { day: { ar: 'السبت', en: 'Sat' }, amount: 1200 },
    { day: { ar: 'الأحد', en: 'Sun' }, amount: 800 },
    { day: { ar: 'الإثنين', en: 'Mon' }, amount: 1500 },
    { day: { ar: 'الثلاثاء', en: 'Tue' }, amount: 2000 },
    { day: { ar: 'الأربعاء', en: 'Wed' }, amount: 950 },
    { day: { ar: 'الخميس', en: 'Thu' }, amount: 3000 },
    { day: { ar: 'الجمعة', en: 'Fri' }, amount: 2500 },
  ],
  // ===== نظام الولاء =====
  loyaltyProgram: {
    enabled: false,
    ordersRequired: 10,
    rewardType: 'percentage',
    rewardValue: 10,
    rewardProductId: null,
    codePrefix: 'LOYALTY',
    singleUse: true,
    specificProductId: null,
    title: { ar: 'مبروك! استحقيت خصم الولاء 🎉', en: 'Congratulations! You earned a loyalty reward 🎉' },
    message: { ar: 'كملت 10 طلبات وكسبت خصم خاص ليك!', en: 'You completed 10 orders and earned a special discount!' },
  },
});

const safeParseJson = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (err) {
    return null;
  }
};

// ملحوظة مهمة (سبب مشكلة "وسيلة الدفع المختارة غير متاحة"):
// كنا بنشيل _id من كل object جوه الإعدادات - حتى لو كان عنصر جوه array زي
// paymentMethods (وسائل الدفع اليدوية/المحافظ). ده كان بيخلي كل عنصر ياخد
// _id جديد عشوائي من Mongoose في كل مرة الأدمن يحفظ الإعدادات (حتى لو
// التعديل مالوش علاقة بوسائل الدفع خالص)، فأي طلب اتعمل بـ methodId قديم،
// أو أي عميل فاتح صفحة قديمة، كان بيرجع "الوسيلة المختارة غير متاحة" لإن
// الـ _id بقى مختلف عن اللي محفوظ فعلياً.
// الحل: نمنع حذف _id/__v/createdAt/updatedAt إلا لمستند الإعدادات نفسه
// (depth 0)، ونسيبها ثابتة لأي عنصر جوه array أو object متداخل (depth > 0).
//
// لكن: لما الأدمن بيضيف وسيلة دفع جديدة (زرار "إضافة وسيلة دفع")، الفرونت
// بيولّد _id مؤقت شكله "pm_<timestamp>_<random>" (مش ObjectId حقيقي من
// MongoDB) عشان يقدر يتعامل مع العنصر الجديد جوه الفورم قبل ما يتحفظ خالص.
// لو سيبنا الـ _id ده يعدي لـ Mongoose زي ما هو، هيحصل تعارض/فشل في الحفظ
// لإن schema بتاع paymentMethods متوقع ObjectId حقيقي - فده كان سبب إن
// وسيلة زي "إنستاباي" المضافة جديد بتفضل ترجع "اختر وسيلة الدفع" حتى بعد
// ما الأدمن يحفظها. الحل: نحافظ على الـ _id بس لو شكله ObjectId حقيقي
// (24 حرف hex) - أي حاجة تانية (زي الـ id المؤقت ده) بنشيلها ونسيب
// Mongoose يولّد ObjectId حقيقي وثابت للعنصر الجديد.
// ملحوظة: قيمة الـ _id القادمة من settings.toObject() بتكون object حقيقي من نوع
// mongoose.Types.ObjectId - مش string عادي (حتى لو JSON.stringify/console.log
// بيوريها شكلها زي string). فلازم نتأكد بطريقة تشتغل صح مع الحالتين: string
// (لو جايه من الفرونت كـ JSON) أو ObjectId حقيقي (لو جايه من DB مباشرة).
const isRealMongoObjectId = (value) => {
  if (value instanceof mongoose.Types.ObjectId) return true;
  if (typeof value === 'string') return /^[0-9a-fA-F]{24}$/.test(value);
  return false;
};

const normalizePlainObject = (value, depth = 0) => {
  if (!value) return {};
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries()).map(([key, item]) => [key, sanitizeSettingsForMerge(item, depth)]));
  }
  if (Array.isArray(value)) return value.map(item => sanitizeSettingsForMerge(item, depth));
  if (typeof value === 'object') {
    const copy = {};
    Object.entries(value).forEach(([key, item]) => {
      // منع كتابة بيانات اعتماد الأدمن أو مفاتيح سرية عن طريق الإعدادات - دايماً، في أي عمق.
      if (['adminPassword', 'adminEmail', 'resendApiKey', 'RESEND_API_KEY'].includes(key)) return;
      // _id/__v/createdAt/updatedAt الخاصة بمستند الإعدادات نفسه فقط (depth 0) هي اللي بتتشال دايماً.
      if (depth === 0 && ['_id', '__v', 'createdAt', 'updatedAt'].includes(key)) return;
      // جوه array/object متداخل (depth > 0): _id بتتشال فقط لو مش ObjectId حقيقي
      // (يبقى قيمة مؤقتة اتولدت في الفرونت لعنصر جديد لسه ما اتحفظش) - عشان
      // Mongoose يولّد له _id حقيقي وثابت بدل ما يحصل خطأ أو تعارض.
      if (depth > 0 && key === '_id' && !isRealMongoObjectId(item)) return;
      const parsedItem = safeParseJson(item);
      if (parsedItem !== null) {
        copy[key] = sanitizeSettingsForMerge(parsedItem, depth + 1);
        return;
      }
      copy[key] = sanitizeSettingsForMerge(item, depth + 1);
    });
    return copy;
  }
  return value;
};

const sanitizeSettingsForMerge = (value, depth = 0) => {
  if (typeof value === 'string') {
    const parsed = safeParseJson(value);
    if (parsed !== null) return sanitizeSettingsForMerge(parsed, depth);
    return value;
  }

  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => sanitizeSettingsForMerge(item, depth));
  if (value instanceof Date) return new Date(value.getTime());
  // مهم: لازم نرجّع الـ ObjectId زي ما هو من غير ما نفكّه لـ plain object -
  // لو سبناه يعدي عادي، normalizePlainObject تحته كانت بتعمل Object.entries
  // على الـ ObjectId نفسه وتحوّله لشكل تخزينه الداخلي (buffer object) بدل
  // القيمة الحقيقية، فكان بيبوظ الـ _id حتى بعد ما نتأكد إنه صالح.
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (value instanceof Map) return normalizePlainObject(value, depth);

  return normalizePlainObject(value, depth);
};

const mergeDeep = (target, source, seen = new WeakMap()) => {
  if (source === null || source === undefined) return source;
  if (source instanceof Date) return new Date(source.getTime());
  // نفس ملاحظة sanitizeSettingsForMerge فوق: لازم نرجّع ObjectId زي ما هو
  // من غير Object.entries عليه، وإلا هيتحول لشكله الداخلي (buffer) ويضيع
  // كـ _id حقيقي لأي عنصر (زي وسيلة دفع) بيتم دمجه من الإعدادات القديمة.
  if (source instanceof mongoose.Types.ObjectId) return source;
  if (source instanceof Map) return new Map(source);

  if (Array.isArray(source)) {
    if (Array.isArray(target) && source.length === 0) {
      return [];
    }
    const output = Array.isArray(target) ? [...target] : [];
    source.forEach((item, index) => {
      output[index] = mergeDeep(output[index], item, seen);
    });
    return output;
  }

  if (source && typeof source === 'object') {
    if (seen.has(source)) return seen.get(source);
    const output = Array.isArray(target) ? [] : { ...(target || {}) };
    seen.set(source, output);

    Object.entries(source).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        output[key] = mergeDeep(output[key], value, seen);
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          output[key] = [];
          return;
        }
        output[key] = mergeDeep(Array.isArray(output[key]) ? output[key] : [], value, seen);
      } else if (value !== undefined) {
        output[key] = value;
      }
    });

    return output;
  }

  return source;
};

const normalizePromotionBlock = (value = {}) => {
  const defaults = buildSettingsDefaults().promotions;
  const guest = value?.guestDiscount || {};
  const welcome = value?.welcomeOffer || {};

  return {
    guestDiscount: {
      enabled: guest.enabled ?? defaults.guestDiscount.enabled,
      percentage: Number.isFinite(Number(guest.percentage)) ? Number(guest.percentage) : defaults.guestDiscount.percentage,
      title: guest.title && typeof guest.title === 'object'
        ? { ar: guest.title.ar ?? defaults.guestDiscount.title.ar, en: guest.title.en ?? defaults.guestDiscount.title.en }
        : defaults.guestDiscount.title,
      message: guest.message && typeof guest.message === 'object'
        ? { ar: guest.message.ar ?? defaults.guestDiscount.message.ar, en: guest.message.en ?? defaults.guestDiscount.message.en }
        : defaults.guestDiscount.message,
      buttonText: guest.buttonText && typeof guest.buttonText === 'object'
        ? { ar: guest.buttonText.ar ?? defaults.guestDiscount.buttonText.ar, en: guest.buttonText.en ?? defaults.guestDiscount.buttonText.en }
        : defaults.guestDiscount.buttonText,
    },
    welcomeOffer: {
      enabled: welcome.enabled ?? defaults.welcomeOffer.enabled,
      promotionId: welcome.promotionId ?? defaults.welcomeOffer.promotionId,
      image: welcome.image ?? defaults.welcomeOffer.image,
      title: welcome.title && typeof welcome.title === 'object'
        ? { ar: welcome.title.ar ?? defaults.welcomeOffer.title.ar, en: welcome.title.en ?? defaults.welcomeOffer.title.en }
        : defaults.welcomeOffer.title,
      description: welcome.description && typeof welcome.description === 'object'
        ? { ar: welcome.description.ar ?? defaults.welcomeOffer.description.ar, en: welcome.description.en ?? defaults.welcomeOffer.description.en }
        : defaults.welcomeOffer.description,
      offerText: welcome.offerText && typeof welcome.offerText === 'object'
        ? { ar: welcome.offerText.ar ?? defaults.welcomeOffer.offerText.ar, en: welcome.offerText.en ?? defaults.welcomeOffer.offerText.en }
        : defaults.welcomeOffer.offerText,
      buttonText: welcome.buttonText && typeof welcome.buttonText === 'object'
        ? { ar: welcome.buttonText.ar ?? defaults.welcomeOffer.buttonText.ar, en: welcome.buttonText.en ?? defaults.welcomeOffer.buttonText.en }
        : defaults.welcomeOffer.buttonText,
      destinationType: welcome.destinationType || defaults.welcomeOffer.destinationType,
      productId: welcome.productId != null ? String(welcome.productId) : defaults.welcomeOffer.productId,
      categoryId: welcome.categoryId != null ? String(welcome.categoryId) : defaults.welcomeOffer.categoryId,
    },
  };
};

const normalizeListField = (value, fallback = []) => {
  if (Array.isArray(value)) return value.filter(item => item !== null && item !== undefined);
  if (typeof value === 'string') {
    const parsed = safeParseJson(value);
    if (Array.isArray(parsed)) return parsed.filter(item => item !== null && item !== undefined);
    return fallback;
  }
  return fallback;
};

// ===== تطبيع مصفوفة الـ campaigns =====
// productId و categoryId قد يُخزَّنان في MongoDB كـ ObjectId فيرجعون كـ object،
// فنحوّلهم إلى string دايماً عشان مقارنة === في الفرونت تشتغل صح.
const normalizeCampaigns = (campaigns) => {
  if (!Array.isArray(campaigns)) return [];
  return campaigns.map((c) => {
    if (!c || typeof c !== 'object') return c;
    return {
      ...c,
      productId: c.productId != null ? String(c.productId) : null,
      categoryId: c.categoryId != null ? String(c.categoryId) : null,
    };
  });
};

// depth=1 هنا لإن العناصر دي أصلاً جوه array (مش مستند الإعدادات نفسه)،
// فلازم تحافظ على _id بتاعها (نفس السبب الموضح فوق في normalizePlainObject).
const normalizedArrayReplacement = (value = []) => normalizeListField(value, []).map(item => sanitizeSettingsForMerge(item, 1));

const normalizeObjectField = (value, fallback = {}) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed = safeParseJson(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  }
  return fallback;
};

const mergeSettingsPayload = (existing, incoming) => {
  const sanitizedExisting = sanitizeSettingsForMerge(existing);
  const sanitizedIncoming = sanitizeSettingsForMerge(incoming);
  const base = mergeDeep(buildSettingsDefaults(), sanitizedExisting);
  const merged = mergeDeep(base, sanitizedIncoming);

  // activeTheme: حقل string بسيط - بييجي تلقائياً مع mergeDeep بدون معالجة خاصة

  // ملحوظة: paymentMethods (وسائل الدفع اليدوية/المحافظ) لازم تتعامل كمصفوفة
  // بتتستبدل بالكامل زي باقي القوائم دي، مش دمج بالـ index. لو استخدمنا الدمج
  // العام (mergeDeep) بدل كده، حذف وسيلة دفع أو إعادة ترتيبها كان بيخلط بيانات
  // وسيلة قديمة مع تانية بنفس المكان في المصفوفة (index)، وده كان بيسبب
  // اختلاف الـ _id عن اللي فعلاً محفوظ، فيرجع "وسيلة الدفع المختارة غير متاحة".
  const listFields = ['categories', 'governorates', 'countries', 'homeSections', 'customPages', 'footerLinks', 'campaigns', 'discountCodes', 'expenses', 'contactMessages', 'faqs', 'salesData', 'paymentMethods', 'returnReasons', 'exchangeReasons'];
  // loyaltyProgram treated as object field (below)
  listFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(sanitizedIncoming, field) && Array.isArray(sanitizedIncoming[field])) {
      const normalized = normalizedArrayReplacement(sanitizedIncoming[field]);
      merged[field] = field === 'campaigns' ? normalizeCampaigns(normalized) : normalized;
      return;
    }
    const nextValue = normalizeListField(merged[field], []);
    merged[field] = field === 'campaigns' ? normalizeCampaigns(nextValue) : nextValue;
  });

  const objectFields = ['storeName', 'logoText', 'heroTitle', 'heroSubtitle', 'aboutText', 'footerLocation', 'locationText', 'promotions', 'productReviews', 'loyaltyProgram', 'marketing', 'seo', 'paymentSettings'];
  objectFields.forEach((field) => {
    if (field === 'promotions') {
      merged[field] = normalizeObjectField(merged[field], buildSettingsDefaults().promotions);
      return;
    }
    if (field === 'productReviews') {
      // ===== دمج التقييمات بدل استبدالها بالكامل =====
      // مهم جداً: الأدمن بيبعت كائن productReviews من حالة الفرونت (قد يكون قديماً/غير محدّث)
      // لو استبدلناه بالكامل، هنفقد التقييمات الجديدة اللي زار العملاء ضافوها بعد آخر تحميل لإعدادات الأدمن.
      // الحل: ندمج بالمعرّف (review.id) — نحتفظ بأي تقييم قديم/جديد في DB، ونضيف أي تقييم جديد من الـ payload
      // بدون تكرار.
      const incomingReviews = normalizeObjectField(sanitizedIncoming.productReviews, {});
      const existingReviews = normalizeObjectField(sanitizedExisting.productReviews, {});
      const mergedReviews = { ...existingReviews };

      Object.entries(incomingReviews).forEach(([productId, reviews]) => {
        if (!Array.isArray(reviews)) return;
        const existingList = Array.isArray(mergedReviews[productId]) ? mergedReviews[productId] : [];
        const seenIds = new Set(existingList.map(r => r && r.id));
        const mergedList = [...existingList];
        reviews.forEach((review) => {
          if (!review || !review.id || !seenIds.has(review.id)) {
            mergedList.push(review);
            if (review && review.id) seenIds.add(review.id);
          }
        });
        mergedReviews[productId] = mergedList;
      });

      merged[field] = mergedReviews;
      return;
    }
    if (field === 'loyaltyProgram') {
      const defaults = buildSettingsDefaults().loyaltyProgram;
      const lp = merged[field] || {};
      merged[field] = {
        enabled: lp.enabled ?? defaults.enabled,
        ordersRequired: Number.isFinite(Number(lp.ordersRequired)) && Number(lp.ordersRequired) > 0 ? Number(lp.ordersRequired) : defaults.ordersRequired,
        rewardType: ['percentage','fixed','product'].includes(lp.rewardType) ? lp.rewardType : defaults.rewardType,
        rewardValue: Number.isFinite(Number(lp.rewardValue)) ? Number(lp.rewardValue) : defaults.rewardValue,
        rewardProductId: lp.rewardProductId != null ? String(lp.rewardProductId) : null,
        codePrefix: lp.codePrefix ? String(lp.codePrefix).trim().toUpperCase() : defaults.codePrefix,
        singleUse: lp.singleUse ?? defaults.singleUse,
        specificProductId: lp.specificProductId != null ? String(lp.specificProductId) : null,
        title: lp.title && typeof lp.title === 'object'
          ? { ar: lp.title.ar ?? defaults.title.ar, en: lp.title.en ?? defaults.title.en }
          : defaults.title,
        message: lp.message && typeof lp.message === 'object'
          ? { ar: lp.message.ar ?? defaults.message.ar, en: lp.message.en ?? defaults.message.en }
          : defaults.message,
      };
      return;
    }
    merged[field] = normalizeObjectField(merged[field], {});
  });

  const defaults = buildSettingsDefaults().promotions;
  const incomingGuest = sanitizedIncoming?.promotions?.guestDiscount || {};
  const hasGuestEnabledOverride = Object.prototype.hasOwnProperty.call(incomingGuest, 'enabled');
  const hasGuestPercentageOverride = Object.prototype.hasOwnProperty.call(incomingGuest, 'percentage');

  const nextPromotions = normalizePromotionBlock(merged.promotions);
  if (!hasGuestEnabledOverride && nextPromotions.guestDiscount.enabled === false) {
    nextPromotions.guestDiscount.enabled = defaults.guestDiscount.enabled;
  }
  if (!hasGuestPercentageOverride && Number(nextPromotions.guestDiscount.percentage) === 0) {
    nextPromotions.guestDiscount.percentage = defaults.guestDiscount.percentage;
  }

  return {
    ...merged,
    promotions: nextPromotions,
  };
};

const transformSettingsForMongoose = (payload = {}) => {
  const normalized = sanitizeSettingsForMerge(payload);

  if (normalized.productReviews && typeof normalized.productReviews === 'object' && !(normalized.productReviews instanceof Map)) {
    const productReviewsMap = new Map();
    Object.entries(normalized.productReviews).forEach(([productId, reviews]) => {
      if (Array.isArray(reviews)) {
        productReviewsMap.set(productId, reviews.map(item => sanitizeSettingsForMerge(item)));
      } else if (reviews !== undefined && reviews !== null) {
        productReviewsMap.set(productId, [sanitizeSettingsForMerge(reviews)]);
      }
    });
    normalized.productReviews = productReviewsMap;
  }

  return normalized;
};

const syncEnvFile = (body = {}) => {
  const envPath = require('path').resolve(__dirname, '../.env');
  if (!require('fs').existsSync(envPath)) return;

  const values = {
    META_API_KEY: body.metaApiKey ?? '',
    META_PIXEL_ID: body.metaPixelId ?? '',
    TIKTOK_API_KEY: body.tiktokApiKey ?? '',
    TIKTOK_PIXEL_ID: body.tiktokPixelId ?? '',
    GOOGLE_API_KEY: body.googleApiKey ?? '',
    GOOGLE_PIXEL_ID: body.googlePixelId ?? '',
    SNAPCHAT_API_KEY: body.snapchatApiKey ?? '',
    SNAPCHAT_PIXEL_ID: body.snapchatPixelId ?? '',
  };

  Object.entries(values).forEach(([key, value]) => {
    process.env[key] = String(value ?? '');
  });

  let envContent = require('fs').readFileSync(envPath, 'utf8');
  Object.entries(values).forEach(([key, value]) => {
    const normalizedValue = String(value ?? '').replace(/\r?\n/g, ' ');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${normalizedValue}`);
    } else {
      envContent += `\n${key}=${normalizedValue}`;
    }
  });

  require('fs').writeFileSync(envPath, envContent);
};

const getOrCreateSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
};

const serializeSettings = (settings) => {
  if (!settings) return {};
  const plain = settings.toObject ? settings.toObject() : settings;
  const normalized = {
    ...plain,
    productReviews: plain.productReviews instanceof Map
      ? Object.fromEntries(plain.productReviews.entries())
      : (plain.productReviews || {}),
    // نطبّع campaigns هنا مباشرةً قبل ما تتمر لـ mergeSettingsPayload
    // عشان ObjectId من MongoDB يتحول لـ string قبل أي مقارنة في الفرونت
    campaigns: normalizeCampaigns(Array.isArray(plain.campaigns) ? plain.campaigns : []),
  };
  return mergeSettingsPayload({}, normalized);
};

const PUBLIC_SECRET_FIELDS = new Set([
  'adminEmail', 'adminPassword', 'adminPhone',
  'metaApiKey', 'tiktokApiKey', 'googleApiKey', 'snapchatApiKey',
  'resendFromEmail', 'otpEmailProvider',
  'contactMessages', 'expenses', 'salesData',
  // ===== [P0 Fix #6] إعدادات التسويق الداخلية (أتمتة الرسائل/رقم واتساب
  // المرسل/خطوات السلة المهجورة...) مش مستخدمة في الفرونت العام خالص
  // (بتتقرا وتتحدّث من لوحة الأدمن بس) - مفيش أي داعي تتبعت لأي زائر.
  'marketing',
  // ===== [Security Audit Fix] بيانات اعتماد شركات الشحن (Aramex username/
  // password/accountPin, Bosta/ShipBlu apiKey, webhook secrets, sandbox
  // credentials...) كانت من غير قصد بترجع كاملة لأي زائر عن طريق
  // /api/settings/public (نفس السبب اللي كان بيسرّبها في GET /api/shipping/
  // providers - شوف الإصلاح المقابل في shippingController.js). shippingIntegrations
  // كائن Mixed بيتخزن فيه أي حقل حساس الأدمن يضيفه لأي شركة شحن، فمفيش أي
  // داعي شرعي إنه يوصل لزائر خالص - الفرونت العام بيستخدم /api/shipping/providers
  // (النسخة الآمنة المفلترة) لمعرفة الشركات المتاحة، مش الحقل الخام ده.
  'shippingIntegrations',
  // بيانات تشغيلية داخلية بحتة (آخر مرة اتبعت فيها تنبيهات ربح/نسبة إرجاع
  // لصاحب المتجر) - مفيش أي استخدام لها في الفرونت العام.
  'profitAlerts',
]);

// ===== [P0 Fix #6] كودات الخصم/الحملات العامة =====
// المشكلة: /api/settings/public كانت بترجّع discountCodes وcampaigns
// زي ما هي بالكامل - يعني أي زائر (من غير تسجيل دخول) يقدر يشوف كل أكواد
// الخصم حتى لو متوقفة (isActive: false) أو الحملات اللي لسه متوقفة/مسودة
// (active: false)، وده بيسرّب معلومات تسويقية داخلية (أكواد مستقبلية،
// حملات لسه ما اتفعّلتش) لأي حد بيعمل fetch للـ endpoint العام.
//
// الحل: فلترة server-side - يترجع بس الأكواد الفعّالة (isActive: true)
// والحملات الفعّالة (active: true)، بالظبط زي مبدأ hidden/draft للمنتجات.
// الحقول والبنية بتاعة كل عنصر فاضلة زي ما هي عشان صفحة الشراء (تطبيق كود
// الخصم / حساب عروض السلة) تفضل شغالة - إحنا بس بنشيل العناصر الغير-فعّالة،
// مش بنغيّر شكل النظام. السيرفر أصلاً بيعيد التحقق من الكود/العرض بالكامل
// وقت إنشاء الأوردر (orderController) فمفيش أي اعتماد أمني على الفلترة دي
// لوحدها، لكنها بتمنع تسريب البيانات الداخلية دي لزوار الموقع.
// ===== [Security Audit Fix] إسقاط صريح (Explicit Projection) لكل كود خصم =====
// المشكلة: discountCodes مخزّنة كـ Schema.Types.Mixed (من غير أي شكل ثابت)،
// وكانت الفلترة القديمة بترجّع العنصر كامل زي ما هو (بعد فلترة isActive بس) -
// يعني أي حقل داخلي بحت (زي usageCount الحالي، أو maxUses - حد الاستخدام
// الكلي، وده "internal usage information" بالتعريف) كان بيتسرّب مع الكود.
// الحل: allowlist صريح لحقول الكود اللي فعلاً الفرونت محتاجها عشان يعرض/يطبّق
// الكود (code نفسه, discountPercent للعرض, specificProductId لمعرفة هل الكود
// مخصص لمنتج معيّن) - وأي حقل تاني (maxUses/usageCount/أي ملاحظة إدارية) بيتشال.
// التحقق الحقيقي من صحة/حد استخدام الكود بيحصل بالكامل في orderController.js
// من نسخة settings الكاملة اللي السيرفر بيجيبها من الداتابيز مباشرة (مش من
// الاستجابة العامة المفلترة دي) - فمفيش أي اعتماد وظيفي على الحقول المشالة.
const toPublicDiscountCode = (c) => {
  if (!c || typeof c !== 'object') return null;
  return {
    id: c.id ?? c._id ?? null,
    code: c.code ?? '',
    discountPercent: Number(c.discountPercent) || 0,
    specificProductId: c.specificProductId != null ? String(c.specificProductId) : null,
    // ملحوظة: maxUses/usageCount (بيانات استخدام داخلية) وأي حقل تاني غير
    // مذكور هنا عمدًا مش موجودين في الاستجابة العامة.
  };
};

const toPublicDiscountCodes = (codes) => (Array.isArray(codes)
  ? codes.filter((c) => c && c.isActive === true).map(toPublicDiscountCode).filter(Boolean)
  : []);

// ===== [Security Audit Fix] إسقاط صريح لكل حملة/عرض ترويجي عام =====
// نفس المبدأ - campaigns برضه Mixed. الحقول هنا هي بالظبط كل الحقول اللي
// الكود الحالي (utils/cartPromotions.js) بيقرأها عشان يحدد هل العرض ينطبق
// وبيحسب قيمته (target/productId/categoryId/type/buyQty/freeQty/minQty/
// discountPercent/percentage/fixedAmount/startDate/endDate)، بالإضافة لحقول
// العرض/الوصف الأساسية (name/title/description/image) اللي الفرونت محتاجها
// يعرض بانر/بطاقة العرض للعميل. أي حقل إداري تاني (ملاحظات داخلية، هامش ربح،
// معرّفات تتبع داخلية...) مش موجود هنا فمش هيتسرّب حتى لو الأدمن ضافه لاحقًا.
const toPublicCampaign = (c) => {
  if (!c || typeof c !== 'object') return null;
  return {
    id: c.id ?? c._id ?? null,
    active: true,
    name: c.name ?? undefined,
    title: c.title ?? undefined,
    description: c.description ?? undefined,
    image: c.image ?? undefined,
    target: c.target ?? undefined,
    productId: c.productId != null ? String(c.productId) : null,
    categoryId: c.categoryId != null ? String(c.categoryId) : null,
    type: c.type ?? undefined,
    buyQty: c.buyQty,
    freeQty: c.freeQty,
    minQty: c.minQty,
    discountPercent: c.discountPercent,
    percentage: c.percentage,
    fixedAmount: c.fixedAmount,
    startDate: c.startDate ?? null,
    endDate: c.endDate ?? null,
  };
};

const toPublicCampaigns = (campaigns) => (Array.isArray(campaigns)
  ? campaigns.filter((c) => c && c.active === true).map(toPublicCampaign).filter(Boolean)
  : []);

const serializePublicSettings = (settings) => {
  const serialized = serializeSettings(settings);
  const safe = { ...serialized };
  PUBLIC_SECRET_FIELDS.forEach((field) => delete safe[field]);
  safe.discountCodes = toPublicDiscountCodes(safe.discountCodes);
  safe.campaigns = toPublicCampaigns(safe.campaigns);
  return safe;
};

const normalizeLegacyReviewsSnapshot = (legacyValue, approvedOnly = false, limit = 500) => {
  const source = legacyValue instanceof Map
    ? Object.fromEntries(legacyValue.entries())
    : (legacyValue && typeof legacyValue === 'object' ? legacyValue : {});
  const grouped = {};
  let count = 0;

  Object.entries(source).forEach(([productId, items]) => {
    if (!Array.isArray(items)) return;
    const list = items
      .map((review) => ({
        id: review?.id || null,
        productId,
        name: String(review?.name || '').trim(),
        rating: Number(review?.rating),
        comment: String(review?.comment || '').trim(),
        status: approvedOnly ? 'approved' : (review?.status || 'approved'),
        verifiedPurchase: !!review?.verifiedPurchase,
        customerId: review?.customerId || null,
        createdAt: review?.createdAt || review?.date || null,
        updatedAt: review?.updatedAt || review?.createdAt || review?.date || null,
        date: review?.createdAt || review?.date || null,
      }))
      .filter((review) =>
        Number.isInteger(review.rating) &&
        review.rating >= 1 &&
        review.rating <= 5 &&
        review.comment.length >= 3
      );

    if (list.length > 0) {
      grouped[productId] = list.slice(0, Math.max(1, limit));
      count += grouped[productId].length;
    }
  });

  return { grouped, count };
};

const buildReviewsSnapshot = async ({ approvedOnly = false, limit = 500, legacyValue = null } = {}) => {
  const filter = approvedOnly ? { status: 'approved' } : {};
  const reviews = await Review.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(1000, Math.max(1, Number(limit) || 500)))
    .lean();

  if (reviews.length === 0 && legacyValue) {
    return normalizeLegacyReviewsSnapshot(legacyValue, approvedOnly, limit).grouped;
  }

  const grouped = {};
  reviews.forEach((review) => {
    const key = String(review.productId);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      id: review._id,
      name: review.name || '',
      rating: review.rating,
      comment: review.comment,
      image: review.image || '',
      status: review.status,
      verifiedPurchase: !!review.verifiedPurchase,
      customerId: review.customerId || null,
      productId: review.productId,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      date: review.createdAt,
    });
  });
  return grouped;
};

const normalizeLegacyContactsSnapshot = (legacyValue, limit = 500) => {
  const source = Array.isArray(legacyValue) ? legacyValue : [];
  return source.slice(0, limit).map((item) => ({
    id: item?.id || null,
    _id: item?.id || null,
    name: String(item?.name || '').trim(),
    email: String(item?.email || '').trim().toLowerCase(),
    phone: String(item?.phone || '').trim(),
    message: String(item?.message || '').trim(),
    status: ['unread', 'read', 'replied', 'archived'].includes(item?.status) ? item.status : 'unread',
    createdAt: item?.createdAt || item?.date || null,
    updatedAt: item?.updatedAt || item?.createdAt || item?.date || null,
    date: item?.createdAt || item?.date || null,
  }));
};

const buildContactSnapshot = async (limit = 500, legacyValue = null) => {
  const items = await ContactMessage.find({})
    .sort({ createdAt: -1 })
    .limit(Math.min(1000, Math.max(1, Number(limit) || 500)))
    .lean();

  if (items.length === 0 && legacyValue) {
    return normalizeLegacyContactsSnapshot(legacyValue, limit);
  }

  return items.map((item) => ({
    id: item._id,
    _id: item._id,
    name: item.name,
    email: item.email || '',
    phone: item.phone,
    message: item.message,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    date: item.createdAt,
  }));
};

// GET /api/settings/public  (عام - إعدادات آمنة بس)
const getPublicSettings = async (req, res) => {
  try {
    const cached = get(CACHE_KEYS.SETTINGS_PUBLIC);
    if (cached) {
      return res.json(cached);
    }

    const settings = await getOrCreateSettings();
    const serialized = serializePublicSettings(settings);
    serialized.productReviews = await buildReviewsSnapshot({ approvedOnly: true, limit: 500, legacyValue: serialized.productReviews });
    delete serialized.contactMessages;

    set(CACHE_KEYS.SETTINGS_PUBLIC, serialized, CACHE_TTL.SETTINGS_PUBLIC);

    res.json(serialized);
  } catch (err) {
    console.error('Error fetching public settings:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب الإعدادات'});
  }
};

// GET /api/settings/admin  (أدمن بس)
const getAdminSettings = async (req, res) => {
  try {
    const cached = get(CACHE_KEYS.SETTINGS_ADMIN);
    if (cached) {
      return res.json(cached);
    }

    const settings = await getOrCreateSettings();
    const serialized = serializeSettings(settings);
    serialized.productReviews = await buildReviewsSnapshot({ approvedOnly: false, limit: 500, legacyValue: serialized.productReviews });
    serialized.contactMessages = await buildContactSnapshot(500, serialized.contactMessages);

    set(CACHE_KEYS.SETTINGS_ADMIN, serialized, CACHE_TTL.SETTINGS_ADMIN);

    res.json(serialized);
  } catch (err) {
    console.error('Error fetching admin settings:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب الإعدادات'});
  }
};

// PUT /api/settings  (أدمن بس)
let settingsWriteQueue = Promise.resolve();

const updateSettings = async (req, res) => {
  const runUpdate = async () => {
    try {
      const rawBody = sanitizeSettingsForMerge(req.body);

      const containsDataImage = (value) => {
        if (typeof value === 'string') return /^data:image\//i.test(value);
        if (Array.isArray(value)) return value.some(containsDataImage);
        if (value && typeof value === 'object') return Object.values(value).some(containsDataImage);
        return false;
      };
      const containsDataVideo = (value) => {
        if (typeof value === 'string') return /^data:video\//i.test(value);
        if (Array.isArray(value)) return value.some(containsDataVideo);
        if (value && typeof value === 'object') return Object.values(value).some(containsDataVideo);
        return false;
      };
      if (containsDataImage(rawBody) || containsDataVideo(rawBody)) {
        return res.status(400).json({
          message: 'رفع الصور/الفيديو يجب أن يتم من خلال مسار الرفع المخصص، وليس داخل بيانات الإعدادات.',
        });
      }

      // لو فيديو البانر الرئيسي اتغيّر أو اتشال، نمسح الفيديو القديم من Cloudinary
      // بعد ما نتأكد إن الحفظ نجح (تحت في نفس الدالة دي)
      const settings = await getOrCreateSettings();
      const oldHeroVideo = settings?.heroVideo || null;
      const heroVideoProvided = Object.prototype.hasOwnProperty.call(rawBody, 'heroVideo');
      const newHeroVideo = heroVideoProvided ? (rawBody.heroVideo || null) : oldHeroVideo;
      const heroVideoChanged = heroVideoProvided && oldHeroVideo && oldHeroVideo !== newHeroVideo;

      // ===== Returns & Exchanges - Phase 3: تحديث lastUpdated تلقائيًا من الـBackend =====
      // بيتحدد هنا (مش بيتقبل من الفرونت) لضمان إنه Timestamp حقيقي وقت الحفظ
      // فعليًا، مش قيمة ممكن العميل يبعتها.
      if (Object.prototype.hasOwnProperty.call(rawBody, 'returnsPolicy') && rawBody.returnsPolicy && typeof rawBody.returnsPolicy === 'object') {
        rawBody.returnsPolicy = { ...rawBody.returnsPolicy, lastUpdated: new Date().toISOString() };
      }

      const plainSettings = settings && settings.toObject ? settings.toObject() : settings;
      const mergedPayload = mergeSettingsPayload(plainSettings, rawBody);
      const payloadForSave = transformSettingsForMongoose(mergedPayload);

      // Reviews and contact messages now live in their own collections.
      // Keep the legacy Settings fields untouched for safe rollback/migration,
      // but never allow the settings endpoint to write them again.
      delete payloadForSave.productReviews;
      delete payloadForSave.contactMessages;

      Object.keys(payloadForSave).forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payloadForSave, field)) {
          settings[field] = payloadForSave[field];
          settings.markModified(field);
        }
      });

      await settings.save();
      syncEnvFile(payloadForSave);

      // الحفظ نجح — دلوقتي نمسح الفيديو القديم من Cloudinary لو كان اتستبدل أو اتشال
      if (heroVideoChanged) {
        deleteVideoFromCloudinary(oldHeroVideo).catch(() => {});
      }

      const serialized = serializeSettings(settings);
      // Keep the existing frontend response shape, but source migrated data from
      // the dedicated collections rather than the legacy Settings fields.
      serialized.productReviews = await buildReviewsSnapshot({ approvedOnly: false, limit: 500, legacyValue: serialized.productReviews });
      serialized.contactMessages = await buildContactSnapshot(500, serialized.contactMessages);

      invalidateSettingsCaches();
      invalidateProductCaches();

      logActivity(req, {
        action: 'update',
        entityType: 'settings',
        description: `${req.user?.name || 'أدمن'} حدّث إعدادات المتجر`,
      });

      return res.json({ success: true, data: serialized });
    } catch (err) {
      console.error('Error updating settings:', err);
      return res.status(500).json({ message: 'حصل خطأ في حفظ الإعدادات'});
    }
  };

  const nextWrite = settingsWriteQueue.then(runUpdate, runUpdate);
  settingsWriteQueue = nextWrite.then(() => undefined, () => undefined);
  return nextWrite;
};


// POST /api/settings/image (admin) - server-side upload for settings images.
const uploadSettingsImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'لم يتم إرسال صورة' });
    }

    const uploaded = await uploadImageToCloudinary(
      req.file.buffer,
      req.file.safeOriginalName || req.file.originalname,
      req.file.detectedMime || req.file.mimetype,
      { folder: 'settings' },
    );

    return res.status(201).json({
      success: true,
      data: {
        url: uploaded.secureUrl || uploaded.url,
        publicId: uploaded.publicId,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
      },
    });
  } catch (err) {
    console.error('Settings image upload failed:', err);
    if (err?.code === 'CLOUDINARY_UPLOAD_FAILED') {
      return res.status(502).json({
        message: 'تعذر رفع صورة الإعدادات إلى التخزين. حاول مرة أخرى.',
      });
    }
    return res.status(err?.statusCode || 500).json({
      message: 'تعذر رفع صورة الإعدادات.',
    });
  }
};

// POST /api/settings/video  (أدمن بس) — رفع فيديو (زي فيديو البانر الرئيسي) على Cloudinary
// مفيش أي تحويل Base64، ولو الرفع فشل بيرجع خطأ واضح "حصل خطأ في رفع الفيديو".
const uploadSettingsVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'لم يتم إرسال فيديو' });
    }

    const uploaded = await uploadVideoToCloudinary(
      req.file.buffer,
      req.file.safeOriginalName || req.file.originalname,
      req.file.detectedMime || req.file.mimetype,
      { folder: 'settings/video' },
    );

    return res.status(201).json({
      success: true,
      data: {
        url: uploaded.secureUrl || uploaded.url,
        publicId: uploaded.publicId,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
        duration: uploaded.duration,
      },
    });
  } catch (err) {
    console.error('Settings video upload failed:', err);
    if (err?.code === 'CLOUDINARY_UPLOAD_FAILED') {
      return res.status(502).json({ message: 'حصل خطأ في رفع الفيديو. حاول مرة أخرى.' });
    }
    return res.status(err?.statusCode || 500).json({ message: 'حصل خطأ في رفع الفيديو' });
  }
};

// GET /api/settings/pixels
const getPublicPixels = async (req, res) => {
  try {
    const cached = get(CACHE_KEYS.SETTINGS_PIXELS);
    if (cached) {
      return res.json(cached);
    }

    const settings = await getOrCreateSettings();
    const pixels = {
      metaPixelId: settings.metaPixelId || process.env.META_PIXEL_ID || '',
      tiktokPixelId: settings.tiktokPixelId || process.env.TIKTOK_PIXEL_ID || '',
      googlePixelId: settings.googlePixelId || process.env.GOOGLE_PIXEL_ID || '',
      snapchatPixelId: settings.snapchatPixelId || process.env.SNAPCHAT_PIXEL_ID || '',
    };
    
    set(CACHE_KEYS.SETTINGS_PIXELS, pixels, CACHE_TTL.SETTINGS_PIXELS);
    
    res.json(pixels);
  } catch (err) {
    console.error('Error fetching pixels:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب البيكسلات'});
  }
};

// POST /api/settings/contact  (عام - رسالة تواصل من العميل)
const addContactMessage = async (req, res) => {
  try {
    const { name, email, phone, message } = req.body || {};
    const nameError = validateName(name);
    if (nameError) {
      return res.status(400).json({ message: nameError });
    }

    if (!isValidPhone(String(phone || '').trim())) {
      return res.status(400).json({ message: 'رقم الهاتف غير صحيح' });
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });
    }

    const normalizedMessage = String(message || '').trim();
    if (normalizedMessage.length < 3 || normalizedMessage.length > 5000) {
      return res.status(400).json({ message: 'الرسالة يجب أن تكون بين 3 و 5000 حرف' });
    }

    const created = await ContactMessage.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      message: normalizedMessage,
      status: 'unread',
    });

    invalidateSettingsCaches();

    const newMessage = {
      id: created._id,
      _id: created._id,
      name: created.name,
      email: created.email,
      phone: created.phone,
      message: created.message,
      status: created.status,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      date: created.createdAt,
    };

    res.status(201).json({ message: newMessage });
  } catch (err) {
    console.error('Error adding contact message:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'بيانات الرسالة غير صالحة' });
    }
    res.status(500).json({ message: 'حصل خطأ في إرسال الرسالة'});
  }
};

// GET /api/settings/contact  (أدمن بس - pagination/filtering)
const getContactMessages = async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 100, defaultLimit: 25, hardCap: 100 });
    const filter = {};
    if (req.query.status) {
      const allowedStatuses = ['unread', 'read', 'replied', 'archived'];
      if (!allowedStatuses.includes(String(req.query.status))) {
        return res.status(400).json({ message: 'حالة الرسالة غير صحيحة' });
      }
      filter.status = String(req.query.status);
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) {
        const from = new Date(req.query.dateFrom);
        if (Number.isNaN(from.getTime())) return res.status(400).json({ message: 'dateFrom غير صحيح' });
        filter.createdAt.$gte = from;
      }
      if (req.query.dateTo) {
        const to = new Date(req.query.dateTo);
        if (Number.isNaN(to.getTime())) return res.status(400).json({ message: 'dateTo غير صحيح' });
        filter.createdAt.$lte = to;
      }
    }

    const [items, total] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ContactMessage.countDocuments(filter),
    ]);

    const normalizedItems = items.map((item) => ({
      ...item,
      id: item._id,
      date: item.createdAt,
    }));

    res.json(buildListResponse({
      isPaginated: true,
      page,
      limit,
      items: normalizedItems,
      total,
    }));
  } catch (err) {
    console.error('Error fetching contact messages:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب رسائل العملاء'});
  }
};

// PATCH /api/settings/contact/:id/status (أدمن بس)
const updateContactMessageStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'معرّف الرسالة غير صحيح' });
    }

    const allowedStatuses = ['unread', 'read', 'replied', 'archived'];
    if (!allowedStatuses.includes(String(req.body?.status))) {
      return res.status(400).json({ message: 'حالة الرسالة غير صحيحة' });
    }

    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { $set: { status: String(req.body.status) } },
      { new: true, runValidators: true }
    ).lean();

    if (!message) return res.status(404).json({ message: 'الرسالة غير موجودة' });

    invalidateSettingsCaches();
    res.json({ ...message, id: message._id, date: message.createdAt });
  } catch (err) {
    console.error('Error updating contact message:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث الرسالة'});
  }
};

// DELETE /api/settings/contact/:id (أدمن بس)
const deleteContactMessage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'معرّف الرسالة غير صحيح' });
    }

    const deleted = await ContactMessage.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ message: 'الرسالة غير موجودة' });

    invalidateSettingsCaches();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting contact message:', err);
    res.status(500).json({ message: 'حصل خطأ في حذف الرسالة'});
  }
};

// POST /api/settings/reviews/image  (عميل/زائر) - رفع صورة مع التقييم
const uploadReviewImage = async (req, res) => {
  try {
    const settingsDoc = await getOrCreateSettings();
    if (settingsDoc.allowReviewImages === false) {
      return res.status(409).json({ message: 'رفع الصور مع التقييمات غير مفعّل حالياً' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'لم يتم إرسال صورة' });
    }

    const uploaded = await uploadImageToCloudinary(
      req.file.buffer,
      req.file.safeOriginalName || req.file.originalname,
      req.file.detectedMime || req.file.mimetype,
      { folder: 'reviews' },
    );

    return res.status(201).json({
      success: true,
      data: {
        url: uploaded.secureUrl || uploaded.url,
        publicId: uploaded.publicId,
      },
    });
  } catch (err) {
    console.error('Review image upload failed:', err);
    if (err?.code === 'CLOUDINARY_UPLOAD_FAILED') {
      return res.status(502).json({
        message: 'تعذر رفع صورة التقييم إلى التخزين. حاول مرة أخرى.',
      });
    }
    return res.status(err?.statusCode || 500).json({
      message: 'تعذر رفع صورة التقييم.',
    });
  }
};

// POST /api/settings/reviews  (عميل/زائر - إضافة تقييم)
const addProductReview = async (req, res) => {
  try {
    const { productId, name, rating, comment, image } = req.body || {};

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: 'المنتج غير صحيح' });
    }

    const product = await Product.findById(productId).select('_id enableReviews').lean();
    if (!product) return res.status(404).json({ message: 'المنتج غير موجود' });
    if (product.enableReviews === false) {
      return res.status(409).json({ message: 'التقييمات غير مفعّلة لهذا المنتج' });
    }

    const settingsDoc = await getOrCreateSettings();

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'التقييم يجب أن يكون رقماً صحيحاً بين 1 و 5' });
    }

    const normalizedComment = String(comment || '').trim();
    if (normalizedComment.length < 3 || normalizedComment.length > 2000) {
      return res.status(400).json({ message: 'التعليق يجب أن يكون بين 3 و 2000 حرف' });
    }

    // بنقبل بس رابط صورة رفعناه إحنا على Cloudinary (عن طريق /settings/reviews/image)
    // عشان محدش يقدر يحط رابط خارجي غريب في التقييم.
    let normalizedImage = '';
    if (image && settingsDoc.allowReviewImages !== false) {
      const imageStr = String(image).trim();
      if (imageStr.length > 0) {
        if (imageStr.length > 500 || !/^https:\/\/res\.cloudinary\.com\//.test(imageStr)) {
          return res.status(400).json({ message: 'صورة التقييم غير صالحة' });
        }
        normalizedImage = imageStr;
      }
    }

    const isAuthenticatedCustomer = !!req.user && req.user.role === 'customer';
    const customerId = isAuthenticatedCustomer ? req.user._id : null;

    let normalizedName = String(name || '').trim();
    if (customerId) {
      normalizedName = req.user.name || normalizedName;
      if (!normalizedName) return res.status(400).json({ message: 'اسم العميل غير صالح' });

      const existingCustomerReview = await Review.exists({
        productId,
        customerId,
      });
      if (existingCustomerReview) {
        return res.status(409).json({ message: 'لا يمكنك إضافة أكثر من تقييم واحد لنفس المنتج' });
      }
    }

    // Verified Purchase: لا نثق بأي product/customer IDs من الـfrontend.
    // بنستخدم req.user._id فقط، ونثبت الشراء من Orders الفعلية.
    let verifiedPurchase = false;
    if (customerId) {
      verifiedPurchase = !!(await Order.exists({
        customerId,
        items: { $elemMatch: { productId: product._id } },
        $or: [
          { shippingStatus: 'delivered' },
          { status: { $in: ['مكتمل', 'تم التسليم', 'delivered'] } },
        ],
      }));
    }

    const created = await Review.create({
      productId: product._id,
      customerId,
      name: normalizedName,
      rating: numericRating,
      comment: normalizedComment,
      image: normalizedImage,
      status: settingsDoc.reviewsRequireApproval === false ? 'approved' : 'pending',
      verifiedPurchase,
    });

    invalidateReviewCaches(productId);
    invalidateSettingsCaches();

    res.status(201).json({
      review: {
        id: created._id,
        productId: created.productId,
        customerId: created.customerId,
        name: created.name,
        rating: created.rating,
        comment: created.comment,
        image: created.image,
        status: created.status,
        verifiedPurchase: created.verifiedPurchase,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        date: created.createdAt,
      },
      productId,
    });
  } catch (err) {
    console.error('Error adding review:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'بيانات التقييم غير صالحة' });
    }
    res.status(500).json({ message: 'حصل خطأ في إضافة التقييم'});
  }
};

// GET /api/settings/reviews/:productId  (عام - approved فقط + pagination)
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: 'المنتج غير صحيح' });
    }

    const productExists = await Product.exists({ _id: productId });
    if (!productExists) return res.status(404).json({ message: 'المنتج غير موجود' });

    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 100, defaultLimit: 25, hardCap: 100 });
    const filter = { productId, status: 'approved' };

    if (req.query.rating !== undefined && req.query.rating !== '') {
      const rating = Number(req.query.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'rating غير صحيح' });
      }
      filter.rating = rating;
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) {
        const from = new Date(req.query.dateFrom);
        if (Number.isNaN(from.getTime())) return res.status(400).json({ message: 'dateFrom غير صحيح' });
        filter.createdAt.$gte = from;
      }
      if (req.query.dateTo) {
        const to = new Date(req.query.dateTo);
        if (Number.isNaN(to.getTime())) return res.status(400).json({ message: 'dateTo غير صحيح' });
        filter.createdAt.$lte = to;
      }
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    const normalized = reviews.map((review) => ({
      id: review._id,
      productId: review.productId,
      customerId: review.customerId,
      name: review.name || '',
      rating: review.rating,
      comment: review.comment,
      image: review.image || '',
      status: review.status,
      verifiedPurchase: !!review.verifiedPurchase,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      date: review.createdAt,
    }));

    res.json(buildListResponse({
      isPaginated: true,
      page,
      limit,
      items: normalized,
      total,
    }));
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب التقييمات'});
  }
};

// GET /api/settings/reviews/mine (عميل مسجل)
const getMyReviews = async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 100, defaultLimit: 25, hardCap: 100 });
    const [reviews, total] = await Promise.all([
      Review.find({ customerId: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments({ customerId: req.user._id }),
    ]);

    res.json(buildListResponse({
      isPaginated: true,
      page,
      limit,
      items: reviews.map((review) => ({ ...review, id: review._id, date: review.createdAt })),
      total,
    }));
  } catch (err) {
    console.error('Error fetching my reviews:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب تقييماتك'});
  }
};

// GET /api/settings/reviews (أدمن بس - moderation/filtering)
const getAdminReviews = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { maxLimit: 100, defaultLimit: 25, hardCap: 100 });
    const filter = {};

    if (req.query.product) {
      if (!mongoose.isValidObjectId(req.query.product)) {
        return res.status(400).json({ message: 'product غير صحيح' });
      }
      filter.productId = req.query.product;
    }
    if (req.query.status) {
      if (!['pending', 'approved', 'rejected'].includes(String(req.query.status))) {
        return res.status(400).json({ message: 'status غير صحيح' });
      }
      filter.status = String(req.query.status);
    }
    if (req.query.rating !== undefined && req.query.rating !== '') {
      const rating = Number(req.query.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'rating غير صحيح' });
      }
      filter.rating = rating;
    }
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) {
        const from = new Date(req.query.dateFrom);
        if (Number.isNaN(from.getTime())) return res.status(400).json({ message: 'dateFrom غير صحيح' });
        filter.createdAt.$gte = from;
      }
      if (req.query.dateTo) {
        const to = new Date(req.query.dateTo);
        if (Number.isNaN(to.getTime())) return res.status(400).json({ message: 'dateTo غير صحيح' });
        filter.createdAt.$lte = to;
      }
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name email phone')
        .populate('productId', 'name slug')
        .lean(),
      Review.countDocuments(filter),
    ]);

    res.json({
      items: reviews.map((review) => ({ ...review, id: review._id, date: review.createdAt })),
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('Error fetching admin reviews:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب التقييمات'});
  }
};

// PATCH /api/settings/reviews/:id/status (أدمن بس)
const moderateReview = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'معرّف التقييم غير صحيح' });
    }

    const nextStatus = String(req.body?.status || '');
    if (!['pending', 'approved', 'rejected'].includes(nextStatus)) {
      return res.status(400).json({ message: 'حالة التقييم غير صحيحة' });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $set: { status: nextStatus } },
      { new: true, runValidators: true }
    ).lean();

    if (!review) return res.status(404).json({ message: 'التقييم غير موجود' });

    invalidateReviewCaches(review.productId);
    invalidateSettingsCaches();
    res.json({ ...review, id: review._id, date: review.createdAt });
  } catch (err) {
    console.error('Error moderating review:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث حالة التقييم'});
  }
};

// PATCH /api/settings/reviews/:id (عميل - يملك التقييم فقط)
const updateMyReview = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'معرّف التقييم غير صحيح' });
    }

    const review = await Review.findOne({ _id: req.params.id, customerId: req.user._id });
    if (!review) return res.status(404).json({ message: 'التقييم غير موجود أو لا تملك صلاحية تعديله' });

    const update = {};
    if (req.body.rating !== undefined) {
      const rating = Number(req.body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'التقييم يجب أن يكون رقماً صحيحاً بين 1 و 5' });
      }
      update.rating = rating;
    }
    if (req.body.comment !== undefined) {
      const comment = String(req.body.comment).trim();
      if (comment.length < 3 || comment.length > 2000) {
        return res.status(400).json({ message: 'التعليق يجب أن يكون بين 3 و 2000 حرف' });
      }
      update.comment = comment;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'لا يوجد شيء لتحديثه' });
    }

    // Any customer edit requires re-review.
    update.status = 'pending';
    Object.assign(review, update);
    await review.save();

    invalidateReviewCaches(review.productId);
    invalidateSettingsCaches();
    res.json({ ...review.toObject(), id: review._id, date: review.createdAt });
  } catch (err) {
    console.error('Error updating my review:', err);
    res.status(500).json({ message: 'حصل خطأ في تعديل التقييم'});
  }
};

// DELETE /api/settings/reviews/:id (عميل يملك التقييم أو أدمن)
const deleteReview = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'معرّف التقييم غير صحيح' });
    }

    const filter = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, customerId: req.user._id };

    const deleted = await Review.findOneAndDelete(filter).lean();
    if (!deleted) return res.status(404).json({ message: 'التقييم غير موجود أو لا تملك صلاحية حذفه' });

    invalidateReviewCaches(deleted.productId);
    invalidateSettingsCaches();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ message: 'حصل خطأ في حذف التقييم'});
  }
};

// GET /api/settings/store-health  (أدمن بس)
// بيحسب "جاهزية المتجر" كنسبة مئوية بناءً على عناصر أساسية: اللوجو، الثيم، المنتجات،
// الشحن، وسيلة الدفع، الدومين، وSEO. كل عنصر بيتحقق من بيانات حقيقية في الداتا بيز.
const getStoreHealth = async (req, res) => {
  try {
    const Product = require('../models/Product');
    const settings = await getOrCreateSettings();
    const plain = settings.toObject ? settings.toObject() : settings;

    const [productsCount, productsWithSeoCount] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ $or: [{ 'metaTitle.ar': { $ne: null, $ne: '' } }, { 'metaTitle.en': { $ne: null, $ne: '' } }, { slug: { $ne: null, $ne: '' } }] }),
    ]);

    const hasLogo = !!(plain.useLogoImage && plain.logoImage) || !!(plain.logoText && (plain.logoText.ar || plain.logoText.en));
    const hasTheme = !!plain.activeTheme;
    const hasProducts = productsCount > 0;
    const hasShipping = Array.isArray(plain.governorates) && plain.governorates.length > 0;
    const hasPayment = (plain.paymentSettings?.kashierEnabled && !!(process.env.KASHIER_MID && process.env.KASHIER_API_KEY && process.env.KASHIER_SECRET_KEY)) || (plain.paymentSettings?.codEnabled !== false) || (plain.paymentSettings?.manualEnabled && Array.isArray(plain.paymentMethods) && plain.paymentMethods.some((m) => m && m.enabled));
    const hasDomain = !!(process.env.FRONTEND_URL || process.env.CLIENT_URL);
    const hasSeo = productsCount > 0 && productsWithSeoCount > 0;

    const checklist = [
      { key: 'logo', label: { ar: 'الشعار', en: 'Logo' }, done: hasLogo },
      { key: 'theme', label: { ar: 'التصميم (الثيم)', en: 'Theme' }, done: hasTheme },
      { key: 'products', label: { ar: 'المنتجات', en: 'Products' }, done: hasProducts },
      { key: 'shipping', label: { ar: 'الشحن', en: 'Shipping' }, done: hasShipping },
      { key: 'payment', label: { ar: 'وسيلة الدفع', en: 'Payment' }, done: hasPayment },
      { key: 'domain', label: { ar: 'الدومين', en: 'Domain' }, done: hasDomain },
      { key: 'seo', label: { ar: 'تحسين محركات البحث (SEO)', en: 'SEO' }, done: hasSeo },
    ];

    const doneCount = checklist.filter((c) => c.done).length;
    const percentage = Math.round((doneCount / checklist.length) * 100);

    res.json({ percentage, checklist });
  } catch (err) {
    console.error('Error computing store health:', err);
    res.status(500).json({ message: 'حصل خطأ في حساب جاهزية المتجر'});
  }
};

module.exports = {
  getOrCreateSettings,
  getPublicSettings, getAdminSettings, updateSettings, uploadSettingsImage, uploadSettingsVideo, getPublicPixels,
  addContactMessage, getContactMessages, updateContactMessageStatus, deleteContactMessage,
  addProductReview, getProductReviews, getMyReviews, getAdminReviews, moderateReview, updateMyReview, deleteReview, uploadReviewImage,
  mergeSettingsPayload, transformSettingsForMongoose, buildSettingsDefaults,
  getStoreHealth,
  // ===== [P0 Fix #6] مُصدَّرة للاختبار =====
  serializePublicSettings, serializeSettings, toPublicDiscountCodes, toPublicCampaigns,
  // ===== [Security Audit Fix] مُصدَّرة للاختبار =====
  PUBLIC_SECRET_FIELDS, toPublicDiscountCode, toPublicCampaign,
};