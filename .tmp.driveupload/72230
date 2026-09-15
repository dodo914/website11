import React, { useState, useEffect, useLayoutEffect, memo, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import { usePixels } from './usePixels';
import { authAPI } from './api/auth';
import { productsAPI } from './api/products';
import { ordersAPI, abandonedCartAPI, exchangeAPI } from './api/orders';
import { trafficAPI } from './api/traffic';
import { staffAPI } from './api/staff';
import { customersAPI } from './api/customers';
import { settingsAPI } from './api/settings';
import { paymentsAPI } from './api/payments';
import { shippingAPI } from './api/shipping';
import { activityLogsAPI } from './api/activityLogs';
import { THEMES, THEME_LIST, getTheme, DEFAULT_THEME_ID, PRESETS, FONT_OPTIONS, DEFAULT_FONT_ID, getFontOption } from './themes';
import ErrorBoundary from './components/ErrorBoundary';
import CookieConsentBanner, { getStoredCookieConsent } from './components/CookieConsentBanner';
import { loadXLSXLibrary } from './utils/loadXLSX';
import { updatePwaManifest } from './utils/pwaManifest';

// ===== [Lazy Loading] الصفحات/المكونات دي مش لازمة إلا لما الزائر يدخل عليها
// فعلاً (صفحة استرجاع/استبدال الضيوف، أداة بناء الثيمات في الأدمن، وصفحة
// التواصل) - React.lazy بيخليها تتحمّل في chunk منفصل بس وقت الحاجة، مش مع
// كل صفحات الموقع من البداية. الـfallback البسيط ده بيظهر لحظة التحميل بس. =====
const ThemeBuilder = lazy(() => import('./components/ThemeBuilder'));
const GuestReturnExchangePage = lazy(() => import('./pages/GuestReturnExchangePage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const CheckoutDetailsPage = lazy(() => import('./pages/CheckoutDetailsPage'));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage'));
const PaymentCompletePage = lazy(() => import('./pages/PaymentCompletePage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'));
const ReturnsPolicyPage = lazy(() => import('./pages/ReturnsPolicyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const CustomContentPage = lazy(() => import('./pages/CustomContentPage'));
const AdminPanel = lazy(() => import('./AdminPanel'));

const PageLoadingFallback = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-10 h-10 border-4 border-[var(--lava-border)] border-t-black rounded-full animate-spin" />
  </div>
);


import { EGYPT_GOVERNORATES } from './constants/governorates';
import { RETURN_REASONS, EXCHANGE_REASONS, EXCHANGE_STATUS_LABELS, EXCHANGE_WORKFLOW_ORDER } from './constants/returnExchange';
import { EGYPT_PHONE_REGEX, isValidEgyptianPhone } from './utils/egyptPhone';
import { WELCOME_OFFER_STORAGE_KEY, loadWelcomeOfferFromStorage, saveWelcomeOfferToStorage } from './utils/welcomeOfferStorage';
import {
  CountdownTimer, LiveViewersBadge, InputField, SelectField, TextareaField,
  ImageUrlOrUploadField, VideoUploadField, MaskedKeyField, AdminPaginationBar,
} from './components/SharedFields';

export default function App() {
  // ===== كل الـ States =====
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const path = window.location.pathname;
      if (path === '/' || path === '') return 'home';
      if (path.startsWith('/product/')) return 'product-details';
      if (path === '/shop') return 'shop';
      if (path === '/checkout') return 'checkout';
      if (path === '/checkout-details') return 'checkout-details';
      if (path === '/wishlist') return 'wishlist';
      if (path === '/contact') return 'contact';
      if (path === '/account') return 'account';
      if (path === '/returns') return 'returns-policy';
      if (path === '/return-exchange') return 'guest-return-exchange';
      if (path === '/my-orders') return 'my-orders';
      if (path === '/order-confirmation') return 'order-confirmation';
      if (path === '/payment-complete') return 'payment-complete';
      if (path === '/admin') return 'admin';
      if (path.startsWith('/page/')) return 'custom-page';
      // لينك مش معروف — نعرض صفحة "غير موجودة" بدل ما نرجّع الزائر
      // للرئيسية بصمت من غير ما يعرف إن اللينك اللي فتحه غلط.
      return 'not-found';
    } catch { return 'home'; }
  });
  // عداد بيزيد مع كل عملية تنقل (حتى لو الصفحة الجديدة نفس اسم الصفحة القديمة)
  // عشان نضمن إن التمرير لأعلى بيحصل في كل مرة المستخدم يضغط على أي رابط تنقل،
  // مش بس لما تتغير قيمة currentPage فعلياً.
  const [navKey, setNavKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState('ar');

  // ===== دالة الترجمة =====
  const t = useCallback((ar, en) => language === 'ar' ? ar : en, [language]);

  // ===== الويشليست (المفضلة) =====
  // بتتحفظ في localStorage عشان الزوار (guests)، ولو العميل مسجل دخول بتتزامن
  // كمان مع الداتا بيز (User.wishlist) عشان متتشلش لما يعمل ريفريش أو يدخل من جهاز تاني.
  const [wishlist, setWishlist] = useState(() => {
    try { const s = localStorage.getItem('lava_wishlist'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // ===== آخر منتجات اتشافت (Recently Viewed) — محفوظة في localStorage بس (بدون مزامنة سيرفر) =====
  const RECENTLY_VIEWED_MAX = 8; // بنخزن أكتر من اللي بيتعرض عشان لو المنتج الحالي كان من ضمنهم
  const [recentlyViewedIds, setRecentlyViewedIds] = useState(() => {
    try { const s = localStorage.getItem('lava_recently_viewed'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // ===== قائمة اقتراحات البحث المنسدلة =====
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // ===== الفلاتر المتقدمة في صفحة المتجر =====
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterSizes, setFilterSizes] = useState([]);
  const [filterColor, setFilterColor] = useState('');
  const [filterOnSaleOnly, setFilterOnSaleOnly] = useState(false);
  const [filterFeaturedOnly, setFilterFeaturedOnly] = useState(false);

  // ===== Pagination + Sort من السيرفر لصفحة المتجر (server-side) =====
  const SHOP_PAGE_SIZE = 12;
  const [shopSortBy, setShopSortBy] = useState('newest'); // newest | price_asc | price_desc
  const [shopItems, setShopItems] = useState([]);
  const [shopTotal, setShopTotal] = useState(0);
  const [shopPageNum, setShopPageNum] = useState(1);
  const [shopInitialLoading, setShopInitialLoading] = useState(true);
  const [shopLoadingMore, setShopLoadingMore] = useState(false);

  // ===== إعدادات الأدمن =====
  const adminSettings = useRef({
    storeName: { ar: 'LAVA', en: 'LAVA' },
    logoText: { ar: 'LAVA', en: 'LAVA' },
    phone: '01091900530',
    whatsapp: '',
    email: 'info@lava.com',
    // ملحوظة: بيانات دخول الأدمن بقت في الباك اند (.env + داتا بيز مشفّرة) مش هنا.
    // الحقول دي سايبينها فاضية عشان مايبقاش فيه أي بيانات حساسة في كود الفرونت.
    adminEmail: '',
    adminPassword: '',
    adminPhone: '01091900530',
    customerLoginMethod: 'email_password',
    resendFromEmail: 'onboarding@resend.dev',
    heroImage: 'https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=1920',
    heroTitle: { ar: 'اشعل ستايلك', en: 'Ignite Your Style' },
    heroSubtitle: { ar: 'اكتشف أحدث صيحات الموضة مع LAVA.', en: 'Discover the latest fashion trends with LAVA.' },
    aboutText: { ar: 'إحنا براند مصري بيهدف لتقديم أعلى جودة من الملابس بخامات ممتازة وتصميمات تناسب كل الأذواق. هدفنا نخليك دايماً في أحسن صورة.', en: 'We are an Egyptian brand aiming to deliver the highest quality clothing with excellent materials and designs that suit all tastes. Our goal is to always make you look your best.' },
    aboutImage: 'https://images.unsplash.com/photo-1558769132-cb1fac08c04b?w=500',
    footerLocation: { ar: 'القاهرة، مصر (متوفر فرع رئيسي وأونلاين)', en: 'Cairo, Egypt (Main branch & online available)' },
    socialFacebook: 'https://facebook.com',
    socialInstagram: 'https://instagram.com',
    socialTiktok: 'https://tiktok.com',
    socialYoutube: '',
    socialLinkedin: '',
    socialSnapchat: '',
    socialFacebookEnabled: true,
    socialInstagramEnabled: true,
    socialTiktokEnabled: true,
    socialYoutubeEnabled: false,
    socialLinkedinEnabled: false,
    socialSnapchatEnabled: false,
    showLocation: true,
    locationText: { ar: 'القاهرة، مصر (متوفر فرع رئيسي وأونلاين)', en: 'Cairo, Egypt (Main branch & online available)' },
    freeShippingThreshold: 1500,
    defaultShippingCost: 90,
    returnFeeAmount: 80, // رسوم شحن الاسترجاع لو سبب الاسترجاع اختيار العميل (مش عيب/غلط المتجر)
    // ===== Returns & Exchanges - Phase 3: صفحة السياسة =====
    // المحتوى بالكامل قابل للتعديل من Admin → Returns & Exchanges → Policy.
    // لا أرقام Hardcoded هنا: {{returnFee}} / {{exchangeFee}} / {{returnWindow}} /
    // {{exchangeWindow}} / {{currency}} بتتستبدل وقت العرض بقيم Settings الحية.
    returnsPolicy: {
      enabled: true,
      lastUpdated: null,
      title: { ar: 'الاسترجاع والاستبدال', en: 'Returns & Exchanges' },
      intro: {
        ar: 'قبل تقديم طلب استرجاع أو استبدال، من فضلك اطّلع على الشروط التالية.',
        en: 'Before submitting a return or exchange request, please review the terms below.',
      },
      content: {
        ar: `• تقديم طلب الاستبدال أو الاسترجاع يكون خلال {{returnWindow}} أيام من تاريخ استلام الشحنة.
• يجب أن تكون الشحنة/المنتجات في حالتها الأصلية مع بطاقة المقاس الخاصة بها.
• في حالة الاسترجاع يتحمل العميل تكلفة الشحن ذهابًا وعودة وفق الرسوم المحددة من المتجر ({{returnFee}} {{currency}}).
• الرسوم قد تُطبَّق أيضًا خلال فترات الشحن المجاني وفق سياسة المتجر والقانون.
• لن تُقبل الطلبات المقدَّمة بعد انتهاء الفترة المحددة، مع مراعاة الحقوق القانونية للمستهلك.
• المنتجات التي تعرضت للتلف أو فقدت بطاقة المقاس قد لا تكون مؤهلة للاسترجاع أو الاستبدال حسب الحالة والسياسة والقانون.
• يمكن لكل شحنة إجراء Return أو Exchange (رسوم الاستبدال: {{exchangeFee}} {{currency}}) وفق القواعد المحددة.
• أي رسوم إضافية تكون وفق سياسة المتجر والقانون.
• يتم رد المبلغ وفق طريقة الاسترداد التي يحددها المتجر ووفق المدة المحددة في السياسة.
• حالات استلام منتج تالف أو معيوب أو مختلف عن الطلب يتم التعامل معها كحالات "خطأ من المتجر" وفق النظام والسياسة والقانون.
• هذه السياسة لا تنتقص من أي حقوق قانونية للمستهلك.`,
        en: `• Return or exchange requests must be submitted within {{returnWindow}} days of receiving your shipment.
• Items must be in their original condition with the size tag attached.
• For returns, the customer bears the round-trip shipping cost according to the store's fees ({{returnFee}} {{currency}}).
• Fees may also apply during free-shipping periods, subject to store policy and applicable law.
• Requests submitted after the deadline will not be accepted, without prejudice to consumer legal rights.
• Damaged items or items missing their size tag may not be eligible for return or exchange, depending on condition, policy, and law.
• Each shipment may have one Return or Exchange (exchange fee: {{exchangeFee}} {{currency}}) processed according to the rules in place.
• Any additional fees are subject to store policy and applicable law.
• Refunds are issued according to the store's chosen refund method and within the timeframe specified in this policy.
• Cases of receiving a damaged, defective, or incorrect item are treated as Store Error cases under the system, this policy, and applicable law.
• This policy does not diminish any legal rights you may have as a consumer.`,
      },
    },
    shippingIntegrations: {},
    showCountdownBar: true,
    saleEndDate: new Date(Date.now() + 19 * 60 * 60 * 1000).toISOString(),
    showZipCode: false,
    showCountry: true,
    requiredPhone2: false,
    showPhone2: true,
    showCheckoutNotes: false,
    paymentSettings: { manualEnabled: true, codEnabled: true, kashierEnabled: false, paymobEnabled: false },
    tiktokApiKey: '',
    metaApiKey: '',
    snapchatApiKey: '',
    googleApiKey: '',
    metaPixelId: '',
    tiktokPixelId: '',
    googlePixelId: '',
    snapchatPixelId: '',
    metaCatalogEnabled: false,
    tiktokCatalogEnabled: false,
    googleCatalogEnabled: false,
    snapchatCatalogEnabled: false,
    showRecommendations: true,
    showBundleOffers: true,
    showRecentlyViewed: false, // إظهار قسم "شاهدته مؤخراً" تحت تفاصيل المنتج (مقفول افتراضياً)
    showLiveViewers: false,
    showFooterCategories: true,
    reviewsRequireApproval: true,
    allowReviewImages: true,
    showConfirmedExportForCallCenter: true,
    logoImage: '',
    useLogoImage: false,
    faviconImage: '',
    // ===== إدارة المخزون / التوفر =====
    displayOutOfStockProducts: true, // إظهار المنتجات الغير متوفرة (بشارة "غير متوفر") أو إخفاؤها تماماً
    defaultLowStockThreshold: 5,
    categories: [
      { id: 1, name: { ar: 'بناطيل', en: 'Pants' }, image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500' },
      { id: 2, name: { ar: 'تيشيرتات', en: 'T-Shirts' }, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500' },
      { id: 3, name: { ar: 'إكسسوارات', en: 'Accessories' }, image: 'https://images.unsplash.com/photo-1550614000-4b95d4ebf5eb?w=500' },
    ],
    governorates: [
      { id: 1, name: { ar: 'القاهرة', en: 'Cairo' }, cost: 70 },
      { id: 2, name: { ar: 'الجيزة', en: 'Giza' }, cost: 70 },
      { id: 3, name: { ar: 'الإسكندرية', en: 'Alexandria' }, cost: 95 },
      { id: 4, name: { ar: 'المنصورة / الدقهلية', en: 'Mansoura / Dakahlia' }, cost: 100 },
      { id: 5, name: { ar: 'باقي المحافظات', en: 'Other Governorates' }, cost: 120 },
    ],
    countries: [
      { id: 1, name: { ar: 'مصر', en: 'Egypt' }, code: 'EG' },
      { id: 2, name: { ar: 'السعودية', en: 'Saudi Arabia' }, code: 'SA' },
      { id: 3, name: { ar: 'الإمارات', en: 'UAE' }, code: 'AE' },
      { id: 4, name: { ar: 'الكويت', en: 'Kuwait' }, code: 'KW' },
    ],
    homeSections: [
      { id: 1, type: 'image-text', title: { ar: 'تخفيضات الصيف', en: 'Summer Sale' }, description: { ar: 'خصم يصل إلى 50% على التشكيلة الجديدة', en: 'Up to 50% off on the new collection' }, image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800', buttonAction: 'shop', buttonText: { ar: 'تسوق الآن', en: 'Shop Now' } },
      { id: 2, type: 'image-only', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800', buttonAction: 'shop', buttonText: { ar: 'تسوق الآن', en: 'Shop Now' } },
      { id: 3, type: 'text-only', title: { ar: 'توصيل مجاني', en: 'Free Shipping' }, description: { ar: 'لجميع الطلبات فوق 1500 جنيه', en: 'For all orders above 1500 EGP' } },
    ],
    customPages: [],
    footerLinks: [],
    showFeaturedSection: true,
    showAboutSection: true,
    featuredSectionTitle: { ar: 'منتجات مميزة', en: 'Featured Products' },
    // ===== مركز العروض الترويجية (Promotions Hub) =====
    // مصدر الحقيقة الوحيد لكل إعدادات العروض الترويجية. لا تكرر هذه القيم في أي مكان آخر.
    promotions: {
      guestDiscount: {
        enabled: true,
        percentage: 5,
        title: { ar: 'خصم 5%', en: 'Get 5% OFF' },
        message: { ar: 'اعمل حساب وخد خصم 5% على أول طلب ليك', en: 'Create an account and get 5% OFF your first order.' },
        buttonText: { ar: 'تسجيل الدخول / إنشاء حساب', en: 'Login / Register' },
      },
      welcomeOffer: loadWelcomeOfferFromStorage({
        enabled: false,
        image: '',
        title: { ar: 'عرض خاص 🎁', en: 'Special Offer 🎁' },
        description: { ar: 'احصل على عرض حصري لفترة محدودة', en: 'Get an exclusive offer for a limited time' },
        offerText: { ar: '', en: '' },
        buttonText: { ar: 'تسوق الآن', en: 'Shop Now' },
        destinationType: 'shop', // 'product' | 'category' | 'shop'
        productId: null,
        categoryId: null,
        promotionId: null, // ربط عرض الترحيب بعرض ترويجي حقيقي من Campaigns (Part 16/29) - لا يُنشئ خصماً مستقلاً بنفسه
      }),
    },
  });

  // ===== الدول =====
  const [countries, setCountries] = useState(() => adminSettings.current.countries || []);

  useEffect(() => {
    let cancelled = false;
    shippingAPI.getProviders().then(data => { if (!cancelled) setShippingProviders(data?.providers || {}); }).catch(err => console.error('Shipping providers:', err));
    return () => { cancelled = true; };
  }, []);

  // ===== أكواد الخصم =====
  const [discountCodes, setDiscountCodes] = useState([
    { id: 1, code: 'WELCOME10', discountPercent: 10, isActive: true, maxUses: 0, usageCount: 0, specificProductId: null },
    { id: 2, code: 'SUMMER20', discountPercent: 20, isActive: true, maxUses: 0, usageCount: 0, specificProductId: null },
  ]);
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountInput, setDiscountInput] = useState('');

  // ===== نظام الولاء =====
  const [loyaltyInfo, setLoyaltyInfo] = useState(null);
  const [loyaltyRewardModal, setLoyaltyRewardModal] = useState(null); // { code, rewardType, rewardValue, title, message }
  const [loyaltyProgram, setLoyaltyProgram] = useState({
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
  });

  // ===== إعادة رسم يدوية =====
  // settingsVersion بيتزيد مع كل bumpSettings - بيُستخدم كـ dependency في الـ effects
  // اللي محتاجة تتفاعل مع تغييرات adminSettings.current (وهو useRef مش reactive).
  const [settingsVersion, forceSettingsUpdate] = useState(0);
  const bumpSettings = useCallback(() => forceSettingsUpdate(n => n + 1), []);

  // ===== الثيم الحالي =====
  const [activeThemeId, setActiveThemeId] = useState(
    () => adminSettings.current.activeTheme || DEFAULT_THEME_ID
  );
  // ===== [شاشة التحميل الأولى] =====
  // من غير ده، الموقع كان بيبان أول ما يفتح بشكل افتراضي (الثيم الافتراضي) لحد
  // ما إعدادات المتجر (الألوان/الخطوط اللي الأدمن ظبطها) توصل من الباك إند،
  // وده كان بيسبب "فلاش" - الشكل الغلط يبان لحظة ثم يتغير للشكل الصح.
  // الحل: نستنى لحد ما loadAppSettings() يخلص (نجاح أو فشل) قبل ما نعرض الموقع،
  // وفي الوقت ده نعرض شاشة تحميل بسيطة (بيضاء ومحايدة، مش معتمدة على أي ثيم).
  const [settingsReady, setSettingsReady] = useState(false);
  // theme بيتحسب من جديد مع كل bumpSettings عشان يدعم Live Preview من ThemeBuilder
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const theme = useMemo(
    () => getTheme(activeThemeId, adminSettings),
    // settingsVersion هو الـ trigger — بيتغير مع كل bumpSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeThemeId, settingsVersion]
  );
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // ===== حقن ألوان الثيم كمتغيرات CSS على مستوى الصفحة كلها =====
  // كل الصفحات (المتجر، السلة، تشيك أوت، الحساب، لوحة التحكم...) بقت بتقرأ
  // نفس الألوان دي بدل الألوان الثابتة (bg-[var(--lava-card)], text-gray..) عشان الثيم
  // يتطبق على كل حاجة مش بس الصفحة الرئيسية.
  useEffect(() => {
    const c = theme.colors || {};
    const root = document.documentElement.style;
    root.setProperty('--lava-bg', c.bg || '#ffffff');
    root.setProperty('--lava-text', c.text || '#111827');
    root.setProperty('--lava-card', c.cardBg || '#ffffff');
    root.setProperty('--lava-card-fg', c.text || c.secondaryFg || '#111827');
    root.setProperty('--lava-secondary', c.secondary || '#f3f4f6');
    root.setProperty('--lava-secondary-fg', c.secondaryFg || '#111827');
    root.setProperty('--lava-muted', c.secondaryFg || '#6b7280');
    root.setProperty('--lava-border', c.navBorder || 'rgba(0,0,0,0.12)');
    root.setProperty('--lava-primary', c.primary || '#000000');
    root.setProperty('--lava-primary-fg', c.primaryFg || '#ffffff');
    root.setProperty('--lava-accent', c.accent || '#dc2626');
    root.setProperty('--lava-nav-bg', c.navBg || '#ffffff');
    root.setProperty('--lava-nav-fg', c.navFg || '#374151');
    root.setProperty('--lava-footer-bg', c.footerBg || '#111827');
    root.setProperty('--lava-footer-fg', c.footerFg || '#ffffff');
    root.setProperty('--lava-badge-bg', c.badgeBg || '#f3f4f6');
    root.setProperty('--lava-badge-fg', c.badgeFg || '#4b5563');
  }, [theme]);

  // ===== خط الموقع الحالي (من الثيم) — بيتحمّل من Google Fonts لو محتاج =====
  const activeFontOption = useMemo(
    () => getFontOption(theme.fontFamily || DEFAULT_FONT_ID),
    [theme.fontFamily]
  );
  useEffect(() => {
    if (!activeFontOption.google) return;
    const linkId = `lava-font-${activeFontOption.id}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${activeFontOption.google}&display=swap`;
    document.head.appendChild(link);
  }, [activeFontOption]);

  // ===== أيقونات (الحساب/المفضلة/العربة) ممكن تفضل ظاهرة فوق في الموبايل حتى
  // لو الناف التحتاني شغال - الاختيار بيتحكم فيه الأدمن من ThemeBuilder
  // (theme.nav.mobileTopItems) =====
  const showTopIconOnMobile = useCallback((item) => {
    if (!theme.nav.mobileBottom) return true;
    return (theme.nav.mobileTopItems || []).includes(item);
  }, [theme.nav.mobileBottom, theme.nav.mobileTopItems]);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  // ===== P1-1: Order Creation Idempotency =====
  // مفتاح ثابت لكل "محاولة تأكيد طلب" - بيتولد مرة واحدة وبيفضل هو هو لو
  // نفس الطلب اتعاد إرساله (retry بعد فشل/timeout)، عشان الباك اند يقدر
  // يمنع إنشاء طلب مكرر. بيتصفّر (يتولد مفتاح جديد للمحاولة الجاية) بعد أي
  // نجاح فعلي، أو لو محتويات السلة اتغيرت (يبقى طلب مختلف فعليًا مش retry).
  const checkoutIdempotencyKeyRef = useRef(null);
  // Track the payment method that owns the current checkout attempt.
  // Switching COD/Paymob/Kashier/manual payment starts a new logical order attempt,
  // so it must never reuse the idempotency key from the previous method.
  const checkoutIdempotencyPaymentMethodRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════
  // VISITOR & SESSION TRACKING
  // ─────────────────────────────────────────────────────────────────────
  // visitorId  → localStorage   (مستمر عبر الجلسات — unique visitor)
  // sessionId  → sessionStorage (يتجدد بعد 30 دقيقة خمول)
  // lastActivity → localStorage (لمعرفة وقت آخر نشاط)
  //
  // منطق تهيئة الـ session:
  //   1. اقرأ visitorId من localStorage — أنشئه لو مش موجود.
  //   2. اقرأ sessionId + lastActivity من localStorage.
  //   3. لو مفيش sessionId أو مضى أكتر من 30 دقيقة على آخر نشاط
  //      → أنشئ sessionId جديد (session_start).
  //   4. حدّث lastActivity عند كل إجراء (page view / funnel step).
  //
  // آمن من React StrictMode:
  //   الـ useRef(() => ...) بيتنفذ مرة واحدة بس لأنه initializer (مش useEffect)
  //   ومبيتأثرش بـ double-invoke في StrictMode.
  // ═══════════════════════════════════════════════════════════════════════
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 دقيقة

  const _analyticsIds = useRef((() => {
    try {
      // ─── visitorId (localStorage — دايم) ────────────────────────────
      let vid = localStorage.getItem('lava_visitor_id');
      if (!vid) {
        vid = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem('lava_visitor_id', vid);
      }

      // ─── sessionId (localStorage + timeout) ─────────────────────────
      const storedSid      = localStorage.getItem('lava_session_id');
      const storedActivity = parseInt(localStorage.getItem('lava_last_activity') || '0', 10);
      const now            = Date.now();
      const isExpired      = !storedSid || (now - storedActivity) > SESSION_TIMEOUT_MS;

      let sid;
      if (isExpired) {
        sid = `s_${now}_${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem('lava_session_id', sid);
      } else {
        sid = storedSid;
      }
      // سجّل أحدث نشاط
      localStorage.setItem('lava_last_activity', String(now));

      // للتوافق مع الـ abandonedCart system اللي كان بيستخدم sessionStorage
      try { sessionStorage.setItem('lava_session_id', sid); } catch (_) {}

      // ─── هل الـ session دي اتأكد تسجيلها فعلاً في السيرفر؟ ──────────
      // لو أول محاولة recordVisit فشلت (السيرفر لسه بيقوم، مشكلة شبكة مؤقتة...)
      // من غير الفلاج ده، الـ session هتفضل "مش جديدة" في أي reload تاني
      // (لأن lastActivity بيتحدّث مع كل page_view/funnel) وبالتالي recordVisit
      // مش هتتبعت تاني أبداً - وكل الأحداث التانية (pageview/funnel/convert)
      // هتفضل findOneAndUpdate على TrafficEvent مش موجود أصلاً = تسجيل صفري.
      const confirmedSid = localStorage.getItem('lava_session_confirmed_id');
      const isConfirmed = confirmedSid === sid;

      return { visitorId: vid, sessionId: sid, isNewSession: isExpired, isConfirmed };
    } catch {
      // fallback لو localStorage محجوب (private browsing بعض المتصفحات)
      const vid = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      return { visitorId: vid, sessionId: sid, isNewSession: true, isConfirmed: false };
    }
  })());

  // دوال مساعدة للوصول للـ ids في أي مكان
  const visitorIdRef   = useRef(_analyticsIds.current.visitorId);
  const sessionIdRef   = useRef(_analyticsIds.current.sessionId);
  // ===== FIX: علم بيتفعّل لحظة إتمام الطلب بنجاح، عشان نمنع الـeffect بتاع
  // "السلة المتروكة" من حذف السجل بمجرد ما السلة تفضى بعد الشراء. كان
  // بيحصل سباق (race): markRecovered() بتحدد السلة "اتعافت" في نفس اللحظة
  // اللي setCart([]) بيخلي effect تاني يبعت طلب "امسح السجل ده" (لأن
  // السلة فضيت) — فلو طلب المسح وصل بعد التحديد، السجل كان بيتمسح بالكامل
  // من قاعدة البيانات، فمكانش بيبان خالص لا في "تم الإكمال" ولا في "نسبة
  // الإنقاذ" رغم إن الطلب فعلاً كمل بنجاح.
  const orderJustCompletedRef = useRef(false);
  const isNewSessionRef = useRef(_analyticsIds.current.isNewSession);
  const isSessionConfirmedRef = useRef(_analyticsIds.current.isConfirmed);

  // تحديث lastActivity — يُستدعى من كل إجراء analytics
  const refreshActivity = useRef(() => {
    try { localStorage.setItem('lava_last_activity', String(Date.now())); } catch (_) {}
  }).current;

  // ===== السلات المتروكة (للأدمن) =====
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [abandonedCartsLoading, setAbandonedCartsLoading] = useState(false);
  const [abandonedCartsPage, setAbandonedCartsPage] = useState(1);
  const [abandonedCartsPageSize, setAbandonedCartsPageSize] = useState(30);
  const [abandonedCartsTotal, setAbandonedCartsTotal] = useState(0);
  const [abandonedCartsTotalPages, setAbandonedCartsTotalPages] = useState(1);
  // ===== FIX: مدة الخمول (بالدقايق) قبل ما نعتبر السلة "متروكة" — الأدمن
  // يقدر يغيّرها بنفسه دلوقتي من شاشة السلات المتروكة (بدل رقم ثابت 10
  // دقايق في الكود).
  const [abandonedCartIdleMinutes, setAbandonedCartIdleMinutes] = useState(30);
  const [abandonedCartIdleMinutesInput, setAbandonedCartIdleMinutesInput] = useState('30');
  const [savingAbandonedCartIdleMinutes, setSavingAbandonedCartIdleMinutes] = useState(false);
  const [cartSearch, setCartSearch] = useState('');
  const [cartFilter, setCartFilter] = useState('all');
  const [expandedCart, setExpandedCart] = useState(null);
  const [trafficStats, setTrafficStats] = useState(null);
  const [onlineNow, setOnlineNow] = useState(null); // عدد الزوار الأونلاين دلوقتي — لوحة التحكم
  // ===== جاهزية المتجر (Store Health) =====
  const [storeHealth, setStoreHealth] = useState(null);
  const [storeHealthLoading, setStoreHealthLoading] = useState(false);
  // ===== شرائح العملاء (Customer Segments) =====
  const [customerSegments, setCustomerSegments] = useState(null);
  const [customerSegmentsLoading, setCustomerSegmentsLoading] = useState(false);
  const [activeSegmentKey, setActiveSegmentKey] = useState(null);
  // ===== سجل النشاط (Activity Log) =====
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);
  const [activityLogFilter, setActivityLogFilter] = useState('all'); // 'all' | 'product' | 'order' | 'settings' | 'staff'
  const [activityLogsPage, setActivityLogsPage] = useState(1);
  const [activityLogsPageSize, setActivityLogsPageSize] = useState(30);
  const [activityLogsTotal, setActivityLogsTotal] = useState(0);
  const [activityLogsTotalPages, setActivityLogsTotalPages] = useState(1);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficDays, setTrafficDays] = useState(30);
  // ===== لوحات الدفع والشحن =====
  const [paymentsDashboard, setPaymentsDashboard] = useState(null);
  const [paymentsDashboardLoading, setPaymentsDashboardLoading] = useState(false);
  const [shippingDashboard, setShippingDashboard] = useState(null);
  const [shippingDashboardLoading, setShippingDashboardLoading] = useState(false);
  // فلترة في لوحة الشحن
  const [shippingFilter, setShippingFilter] = useState('all');
  const [shippingSearch, setShippingSearch] = useState('');
  // تعديل بيانات شحن طلب معين
  const [editingShippingOrderId, setEditingShippingOrderId] = useState(null);
  const [creatingShipmentOrderId, setCreatingShipmentOrderId] = useState(null);
  const [cancellingShipmentOrderId, setCancellingShipmentOrderId] = useState(null);
  const [fetchingLabelOrderId, setFetchingLabelOrderId] = useState(null);
  // حالة تحميل منفصلة لزرار "تحديث التتبع الآن" في لوحة الشحن - بتتبع نفس
  // نمط الـstates التلاتة فوق (منع double click + إظهار loading state لكل
  // أوردر لوحده).
  const [trackingShipmentOrderId, setTrackingShipmentOrderId] = useState(null);
  const [editShippingStatus, setEditShippingStatus] = useState('');
  const [editShippingCompany, setEditShippingCompany] = useState('');
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [editShippingNotes, setEditShippingNotes] = useState('');
  const adminSaveInFlightRef = useRef(false);
  const productSaveInFlightRef = useRef(new Set());

  // ===== هل عرض الخصم شغال؟ =====
  const isSaleActive = () => {
    return !!(adminSettings.current.showCountdownBar && adminSettings.current.saleEndDate &&
      new Date(adminSettings.current.saleEndDate).getTime() > Date.now());
  };
  const getEffectivePrice = (product) => {
    // لو العداد شغال وعنده سعر → استخدمه
    if (isSaleActive() && product.onSale && product.salePrice) {
      return Math.round(Number(product.salePrice) * 100) / 100;
    }
    // لو العداد خلص أو مش شغال، لكن فيه سعر عرض ثابت → استخدمه
    if (product.permanentSalePrice && Number(product.permanentSalePrice) > 0) {
      return Math.round(Number(product.permanentSalePrice) * 100) / 100;
    }
    // السعر الأصلي
    return Math.round(Number(product.price || 0) * 100) / 100;
  };

  // ===== نسبة الخصم (لبادج "-XX%" على صورة الكارت) =====
  const getDiscountPercent = (product) => {
    const isOnSale = (product.onSale && isSaleActive() && product.salePrice) || product.permanentSalePrice;
    if (!isOnSale) return 0;
    const salePrice = (product.onSale && isSaleActive() && product.salePrice) ? Number(product.salePrice) : Number(product.permanentSalePrice);
    const originalPrice = Number(product.price || 0);
    if (!originalPrice || !salePrice || salePrice >= originalPrice) return 0;
    return Math.round((1 - salePrice / originalPrice) * 100);
  };
  const isReviewsEnabled = (product) => {
    if (!product) return false;
    const globalOn = adminSettings.current.showReviews !== false;
    const productOn = product.enableReviews !== undefined ? product.enableReviews : true;
    return globalOn && productOn;
  };

  // ============================================================
  // نظام الفاريانتس والمخزون (لون / مقاس / كمية)
  // ============================================================
  // كل منتج بيحتوي دايماً على product.variants = [{ id, color:{ar,en}|null, hex, images:[], sizeStock:{ size: {sku, stock} } }]
  // لو المنتج مالوش ألوان، بيبقى عنده Variant واحد بس بـ color=null.
  const NO_COLOR_ID = '__no_color__';

  const getVariants = (product) => (product && Array.isArray(product.variants) ? product.variants : []);

  // ===== Canonical variant id: match by custom `id` OR Mongo `_id` =====
  const getVariantById = (product, variantId) => {
    if (!variantId) return null;
    return getVariants(product).find(v =>
      v.id === variantId ||
      (v._id != null && String(v._id) === String(variantId))
    ) || null;
  };

  // ===== Canonical variant id for DB payloads: prefer Mongo `_id`, fall back to custom `id` =====
  const getCanonicalVariantId = (variant) => {
    if (!variant) return NO_COLOR_ID;
    if (variant._id != null) return String(variant._id);
    return variant.id || NO_COLOR_ID;
  };

  const hasColors = (product) => getVariants(product).length > 1 || (getVariants(product)[0] && getVariants(product)[0].color);

  const getDefaultVariant = (product) => getVariants(product)[0] || null;

  // ===== Canonical sizeStock: Array of { size, sku, stock } =====
  // Legacy data may be Object: { "S": { sku, stock } } — handle both safely.
  const getSizeStockArray = (variant) => {
    if (!variant || !variant.sizeStock) return [];
    if (Array.isArray(variant.sizeStock)) return variant.sizeStock;
    if (typeof variant.sizeStock === 'object') {
      return Object.entries(variant.sizeStock).map(([size, entry]) => ({
        size,
        sku: entry && entry.sku != null ? entry.sku : '',
        stock: Math.max(0, Number(entry && entry.stock) || 0),
      }));
    }
    return [];
  };

  const getSizeEntry = (product, variantId, size) => {
    const variant = getVariantById(product, variantId) || getDefaultVariant(product);
    if (!variant || !size) return null;
    return getSizeStockArray(variant).find(s => s.size === size) || null;
  };

  const getVariantStock = (product, variantId, size) => {
    const entry = getSizeEntry(product, variantId, size);
    return entry ? Math.max(0, Number(entry.stock) || 0) : 0;
  };

  const getVariantTotalStock = (variant) => {
    return getSizeStockArray(variant).reduce((sum, e) => sum + Math.max(0, Number(e.stock) || 0), 0);
  };

  const getProductTotalStock = (product) => getVariants(product).reduce((sum, v) => sum + getVariantTotalStock(v), 0);

  const getLowStockThreshold = (product) => {
    const own = product && product.lowStockThreshold;
    return (own !== undefined && own !== null && own !== '') ? Number(own) : adminSettings.current.defaultLowStockThreshold;
  };

  // 'out' | 'low' | 'in'
  const getProductStockStatus = (product) => {
    const total = getProductTotalStock(product);
    if (total <= 0) return 'out';
    if (total <= getLowStockThreshold(product)) return 'low';
    return 'in';
  };

  const isProductFullyOutOfStock = (product) => getProductTotalStock(product) <= 0;

  // منتج قابل للظهور للعميل: منشور + (متوفر أو "عرض الغير متوفر" مفعّل)
  const isProductVisibleToCustomer = (product) => {
    if (!product) return false;
    const visibility = product.visibility || 'published';
    if (visibility !== 'published') return false;
    if (isProductFullyOutOfStock(product) && adminSettings.current.displayOutOfStockProducts === false) return false;
    return true;
  };

  const getVariantImages = (product, variantId) => {
    if (!product) return [];
    // مهم: لو مفيش variantId (يعني العميل لسه ما اختارش لون)، ما نرجعش صور أول لون تلقائياً.
    // بنرجع صور المنتج العامة (غير المرتبطة بلون معين) لحد ما العميل يختار.
    const variant = getVariantById(product, variantId);
    if (variant && Array.isArray(variant.images) && variant.images.length > 0) return variant.images;
    return product.images || [];
  };

  const generateSKU = (product, colorLabel, size) => {
    const base = (product && (product.name?.en || product.name?.ar) || 'PRD').toString().trim().slice(0, 3).toUpperCase();
    const colorPart = colorLabel ? colorLabel.toString().trim().slice(0, 3).toUpperCase() : 'STD';
    const sizePart = size ? size.toString().trim().slice(0, 3).toUpperCase() : 'OS';
    return `${base}-${colorPart}-${sizePart}`;
  };


  const toDatetimeLocalValue = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // ===== رسائل التنبيه =====
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const normalizePromotionSettings = useCallback((settings) => {
    const promoted = settings?.promotions || {};
    const guestDiscount = promoted.guestDiscount || {};
    const welcomeOffer = promoted.welcomeOffer || {};
    const guestPercentage = Number.isFinite(Number(guestDiscount.percentage)) && Number(guestDiscount.percentage) > 0
      ? Number(guestDiscount.percentage)
      : 5;

    return {
      ...settings,
      promotions: {
        guestDiscount: {
          enabled: guestDiscount.enabled ?? true,
          percentage: guestPercentage,
          title: { ar: guestDiscount.title?.ar || 'خصم 5%', en: guestDiscount.title?.en || 'Get 5% OFF' },
          message: { ar: guestDiscount.message?.ar || 'اعمل حساب وخد خصم 5% على أول طلب ليك', en: guestDiscount.message?.en || 'Create an account and get 5% OFF your first order.' },
          buttonText: { ar: guestDiscount.buttonText?.ar || 'تسجيل الدخول / إنشاء حساب', en: guestDiscount.buttonText?.en || 'Login / Register' },
        },
        welcomeOffer: {
          enabled: welcomeOffer.enabled ?? false,
          image: welcomeOffer.image || '',
          title: { ar: welcomeOffer.title?.ar || 'عرض خاص 🎁', en: welcomeOffer.title?.en || 'Special Offer 🎁' },
          description: { ar: welcomeOffer.description?.ar || 'احصل على عرض حصري لفترة محدودة', en: welcomeOffer.description?.en || 'Get an exclusive offer for a limited time' },
          offerText: { ar: welcomeOffer.offerText?.ar || '', en: welcomeOffer.offerText?.en || '' },
          buttonText: { ar: welcomeOffer.buttonText?.ar || 'تسوق الآن', en: welcomeOffer.buttonText?.en || 'Shop Now' },
          destinationType: welcomeOffer.destinationType || 'shop',
          productId: welcomeOffer.productId ?? null,
          categoryId: welcomeOffer.categoryId ?? null,
          promotionId: welcomeOffer.promotionId ?? null,
        },
      },
    };
  }, []);

  const loadAppSettings = useCallback(async () => {
    try {
      const [publicSettings, pixels, authConfig] = await Promise.all([
        settingsAPI.getPublic(),
        settingsAPI.getPixels(),
        authAPI.getConfig().catch(() => ({ customerLoginMethod: 'email_password' })),
      ]);

      const normalizedSettings = normalizePromotionSettings({ ...publicSettings, ...pixels, ...authConfig });
      Object.assign(adminSettings.current, normalizedSettings);
      const loadedPaymentSettings = normalizedSettings.paymentSettings || { manualEnabled: true, codEnabled: true, kashierEnabled: false, paymobEnabled: false };
      const codIsOn = loadedPaymentSettings.codEnabled !== false;
      if (!codIsOn && loadedPaymentSettings.kashierEnabled === true) setCheckoutPaymentMethod('kashier');
      else if (!codIsOn && loadedPaymentSettings.paymobEnabled === true) setCheckoutPaymentMethod('paymob');
      else if (codIsOn && (checkoutPaymentMethod === 'kashier' || checkoutPaymentMethod === 'paymob')) setCheckoutPaymentMethod('cod');
      // ===== تحميل Pixel IDs في الـ state عشان usePixels يشتغل =====
      setPixelIds({
        metaPixelId: pixels.metaPixelId || '',
        tiktokPixelId: pixels.tiktokPixelId || '',
        googlePixelId: pixels.googlePixelId || '',
        snapchatPixelId: pixels.snapchatPixelId || '',
      });
      if (Array.isArray(normalizedSettings.categories)) setCategories(normalizedSettings.categories);
      if (Array.isArray(normalizedSettings.governorates)) setGovernorates(normalizedSettings.governorates);
      if (Array.isArray(normalizedSettings.countries)) setCountries(normalizedSettings.countries);
      if (Array.isArray(normalizedSettings.homeSections)) setHomeSections(normalizedSettings.homeSections);
      if (Array.isArray(normalizedSettings.customPages)) setCustomPages(normalizedSettings.customPages);
      // ===== تحميل البيانات المحلية من الداتا بيز =====
      if (Array.isArray(normalizedSettings.campaigns)) setPromotions(normalizedSettings.campaigns);
      if (Array.isArray(normalizedSettings.discountCodes)) setDiscountCodes(normalizedSettings.discountCodes);
      if (normalizedSettings.loyaltyProgram && typeof normalizedSettings.loyaltyProgram === 'object') {
        setLoyaltyProgram(prev => ({ ...prev, ...normalizedSettings.loyaltyProgram }));
      }
      if (Array.isArray(normalizedSettings.expenses)) setExpenses(normalizedSettings.expenses);
      if (Array.isArray(normalizedSettings.contactMessages)) setContactMessages(normalizedSettings.contactMessages);
      if (Array.isArray(normalizedSettings.faqs)) setFaqs(normalizedSettings.faqs);
      if (normalizedSettings.productReviews && typeof normalizedSettings.productReviews === 'object') setProductReviews(normalizedSettings.productReviews);
      if (Array.isArray(normalizedSettings.salesData)) setSalesData(normalizedSettings.salesData);
      if (normalizedSettings.activeTheme) {
        setActiveThemeId(normalizedSettings.activeTheme);
      }
      bumpSettings();
    } catch (err) {
      console.error('تعذّر تحميل إعدادات الموقع:', err);
      showToast(t('تعذّر تحميل إعدادات الموقع، حاول تاني لاحقاً', 'Unable to load site settings, please try again later'));
    }
  }, [bumpSettings, normalizePromotionSettings, showToast, t]);

  // ===== البيكسلات =====
  const [pixelIds, setPixelIds] = useState({
    metaPixelId: '',
    tiktokPixelId: '',
    googlePixelId: '',
    snapchatPixelId: '',
  });
  // ===== موافقة الكوكيز — لازمة قبل ما أي بيكسل يتحمّل فعليًا =====
  // hasAnyPixel: بنحسبها من pixelIds نفسها بعد ما تتحمّل من الإعدادات،
  // عشان البانر يظهر بس لو فيه بيكسل واحد على الأقل متفعّل فعلاً.
  const hasAnyPixel = Boolean(pixelIds.metaPixelId || pixelIds.tiktokPixelId || pixelIds.googlePixelId || pixelIds.snapchatPixelId);
  const [cookieConsent, setCookieConsent] = useState(() => getStoredCookieConsent());
  // لو مفيش أي بيكسل متفعّل أصلاً، أو الزائر رفض، بنبعت pixelIds فاضية
  // لـ usePixels عشان مفيش سكريبت تتبّع يتحمّل خالص.
  const activePixelIds = hasAnyPixel && cookieConsent === 'accepted' ? pixelIds : {};
  const { fireEvent } = usePixels(activePixelIds);

  // ===== المستخدم =====
  const [user, setUser] = useState(null);

  // ===== مزامنة المفضلة مع السيرفر =====
  // - merge=true (تسجيل الدخول الفعلي في نفس الجلسة): بندمج أي عناصر ضافها المستخدم
  //   كـ guest قبل ما يسجل دخول (لسه في الـ state الحالي) مع مفضلة حسابه في الداتا بيز.
  // - merge=false (استرجاع الجلسة بعد ريفريش/فتح من جديد عبر auth/me): السيرفر هو
  //   المصدر الوحيد للحقيقة هنا — بنستبدل القائمة بالكامل بدل الدمج، عشان نسخة
  //   localStorage القديمة (اللي ممكن يكون فيها عنصر اتمسح من جهاز تاني) متـ"تحيّيش"
  //   عنصر كان اتمسح فعلاً وترجعه تاني على السيرفر.
  const syncWishlistFromServer = useCallback((serverWishlist, { merge = true } = {}) => {
    const serverList = Array.isArray(serverWishlist) ? serverWishlist : [];
    if (!merge) {
      setWishlist(serverList);
      return;
    }
    setWishlist((localList) => {
      const merged = [...new Set([...serverList, ...localList])];
      // لو فيه عناصر كانت محفوظة محلياً بس (guest) ومش موجودة عند السيرفر،
      // ابعتها للسيرفر عشان تتحفظ في حساب العميل بدل ما تضيع.
      if (merged.length !== serverList.length) {
        authAPI.updateWishlist(merged).catch(() => {});
      }
      return merged;
    });
  }, []);

  // ===== مزامنة سلة التسوق مع السيرفر (نفس فكرة المفضلة بالظبط) =====
  // - merge=true (تسجيل الدخول الفعلي في نفس الجلسة): بندمج أي منتجات ضافها العميل
  //   كـ guest قبل ما يسجل دخول (لسه في الـ state الحالي) مع سلة حسابه المحفوظة في
  //   الداتا بيز، ودمج على أساس cartId عشان منكررش نفس العنصر.
  // - merge=false (استرجاع الجلسة بعد ريفريش/دخول من جهاز تاني عبر auth/me): السيرفر
  //   هو المصدر الوحيد للحقيقة هنا — بنستبدل السلة بالكامل بدل الدمج، عشان لو العميل
  //   مسح منتج من السلة وهو في جهاز تاني، منرجعوش تاني من نسخة localStorage القديمة.
  const syncCartFromServer = useCallback((serverCart, { merge = true } = {}) => {
    const serverList = Array.isArray(serverCart) ? serverCart : [];
    if (!merge) {
      setCart(serverList);
      return;
    }
    setCart((localList) => {
      const serverCartIds = new Set(serverList.map(item => item.cartId));
      const localOnly = localList.filter(item => !serverCartIds.has(item.cartId));
      const merged = [...serverList, ...localOnly];
      // لو فيه منتجات كانت محفوظة محلياً بس (guest) ومش موجودة عند السيرفر،
      // ابعتها للسيرفر عشان تتحفظ في حساب العميل بدل ما تضيع.
      if (localOnly.length > 0) {
        authAPI.updateCart(merged).catch(() => {});
      }
      return merged;
    });
  }, []);

  // بيتأكد إن المستخدم الحالي عنده صلاحية على قسم معين في لوحة التحكم
  // (أدمن دايماً عنده كل حاجة، وموظف role:'staff' بس لو الأدمن دّاله صلاحية على القسم ده)
  const canAccess = useCallback((section, level = 'view') => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'staff' || !Array.isArray(user.permissions)) return false;
    const entry = user.permissions.find(p => p.section === section);
    if (!entry) return false;
    return level === 'view' ? (entry.access === 'view' || entry.access === 'edit') : entry.access === 'edit';
  }, [user]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editAccountData, setEditAccountData] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (user) {
      setEditAccountData({ name: user.name, email: user.email, phone: user.phone });
    }
  }, [user]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [otpStep, setOtpStep] = useState('email'); // email | password | code | forgotCode
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpCooldownRef = useRef(null);
  // نسيت كلمة المرور: خطوة منفصلة عن otpStep بتاع الدخول بالكود العادي
  const [forgotPasswordSending, setForgotPasswordSending] = useState(false);
  const [forgotPasswordCooldown, setForgotPasswordCooldown] = useState(0);
  const forgotPasswordCooldownRef = useRef(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [adminAuthConfig, setAdminAuthConfig] = useState({
    customerLoginMethod: 'email_password',
    resendFromEmail: 'onboarding@resend.dev',
    otpEmailProvider: 'resend',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
    resendConfigured: false,
    brevoConfigured: false,
  });
  // تعديل بيانات الأدمن الحساسة (إيميل/باسورد/هاتف) محتاج كود تأكيد على الإيميل الحالي
  const [adminOtpCode, setAdminOtpCode] = useState('');
  const [adminOtpSent, setAdminOtpSent] = useState(false);
  const [adminOtpSending, setAdminOtpSending] = useState(false);
  const [adminOtpCooldown, setAdminOtpCooldown] = useState(0);
  const [adminOtpSentTo, setAdminOtpSentTo] = useState('');
  const adminOtpCooldownRef = useRef(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  // ===== موافقة الماركتنج وقت التسجيل - checkbox متحدد افتراضيًا زي شوبيفاي =====
  const [regMarketingConsent, setRegMarketingConsent] = useState(true);
  // ===== موافقة الماركتنج وقت تسجيل الدخول بالكود - نفس فكرة regMarketingConsent
  // بس في شاشة الإيميل الموحدة (بتظهر قبل ما نعرف الحساب جديد ولا لأ، زي Shopify) =====
  const [loginMarketingConsent, setLoginMarketingConsent] = useState(true);

  // ===== الطلبات (يجب تعريفها قبل الدوال التي تعتمد على المتغير `orders`) =====
  const [orders, setOrders] = useState([]);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [lastOrderNumber, setLastOrderNumber] = useState(null);
  // ===== طريقة الدفع لآخر طلب اتعمل — مستخدمة في صفحة "تأكيد الطلب" عشان الدفع
  // اليدوي (محفظة) يوضح للعميل إن طلبه استلمناه وبانتظار تأكيد الدفع، مش إن
  // الدفع نفسه اتأكد فورًا. =====
  const [lastOrderPaymentMethod, setLastOrderPaymentMethod] = useState(null);
  // ===== باجينيشن الطلبات في لوحة الأدمن (صفحة بصفحة بدل ما تيجي كل الأوردرات مرة واحدة) =====
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(30);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  // ===== مدة تصدير الطلبات (Excel): كل الأوردرات / شهر / أسبوع / يومين / النهاردة / تحديد يدوي =====
  const [exportRangePreset, setExportRangePreset] = useState('all');
  const [exportRangeFrom, setExportRangeFrom] = useState('');
  const [exportRangeTo, setExportRangeTo] = useState('');
  // ===== أوردرات كاملة مخصصة لتبويب "لوحة البيانات" (الإحصائيات) - بديل
  // احتياطي بس لحد ما ردود aggregation endpoints (بدون أي سقف) توصل =====
  // منفصلة عن "orders" اللي فوق عشان دي بتيجي مقسّمة صفحات (30 بس)، ولو
  // استخدمناها في حساب الإيرادات هيبقى الرقم غلط لأنه هيحسب صفحة واحدة بس
  // مش كل الطلبات. هنا بنجيب كل الطلبات (لحد سقف أمان 5000) مرة واحدة -
  // ده بس fallback مؤقت، مش مصدر الأرقام الحقيقي.
  const [statsOrders, setStatsOrders] = useState([]);
  const [statsOrdersLoading, setStatsOrdersLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  // ===== سلة التسوق وتفاصيل المنتج المحدد =====
  const [cart, setCart] = useState(() => {
    try { const s = localStorage.getItem('lava_cart'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // ===== P1-1: لو محتويات السلة اتغيرت، أي محاولة تأكيد طلب سابقة بقت غير
  // ذات صلة - لازم مفتاح idempotency جديد عشان ده يبقى طلب مختلف فعليًا،
  // مش إعادة إرسال (retry) لنفس الطلب القديم.
  useEffect(() => {
    checkoutIdempotencyKeyRef.current = null;
    checkoutIdempotencyPaymentMethodRef.current = null;
  }, [cart]);
  const [selectedProduct, setSelectedProduct] = useState(() => {
    try {
      if (window.location.pathname.startsWith('/product/')) {
        const s = localStorage.getItem('lava_selected_product');
        return s ? JSON.parse(s) : null;
      }
      return null;
    } catch { return null; }
  });
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  // ===== المنتج المفتوح حالياً في نافذة "الإضافة السريعة للسلة" من على الكارت مباشرة =====
  const [quickAddProduct, setQuickAddProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [selectedBundleIds, setSelectedBundleIds] = useState([]);
  const [bundleSelections, setBundleSelections] = useState({}); // { [productId]: { variantId, size } }

  // ===== الخصم 5% =====
  const [firstOrderDiscountEligible, setFirstOrderDiscountEligible] = useState(false);
  const [firstOrderDiscountUsed, setFirstOrderDiscountUsed] = useState(false);

  // ===== رسالة خصم الزائر (Guest Discount) - إخفاء للجلسة الحالية عند الإغلاق =====
  const [guestDiscountDismissed, setGuestDiscountDismissed] = useState(false);
  // ===== إظهار/إخفاء بانر تذكير "خصم أول طلب" - هذه حالة واجهة فقط ولا تمس أهلية الخصم إطلاقاً =====
  const [firstOrderBannerDismissed, setFirstOrderBannerDismissed] = useState(false);

  // ===== بوب أب عرض الترحيب (Welcome Offer) =====
  const [welcomeOfferClosed, setWelcomeOfferClosed] = useState(false); // إغلاق للجلسة الحالية بس - حالة واجهة مستقلة تماماً
  const [welcomeOfferVisible, setWelcomeOfferVisible] = useState(false); // بيتحول true بعد تأخير بسيط لظهور أنيق
  const [welcomeOfferPreviewLang, setWelcomeOfferPreviewLang] = useState('ar');
  const [welcomeOfferProductSearch, setWelcomeOfferProductSearch] = useState('');
  // ===== لغة معاينة الأدمن لبطاقة خصم الزائر (لا تؤثر على الموقع الفعلي) =====
  const [promoPreviewLang, setPromoPreviewLang] = useState('ar');

  // ===== تابات مركز العروض الترويجية (Promotions Hub) - جزء 9 =====
  const [promotionsSubTab, setPromotionsSubTab] = useState('overview'); // overview | campaigns | welcome | guest

  // ===== محرك العروض الترويجية الحقيقي (Campaigns / Promotions Hub) =====
  const [campaignFormOpen, setCampaignFormOpen] = useState(false); // فورم إنشاء/تعديل عرض
  const [editingPromotionId, setEditingPromotionId] = useState(null); // null = عرض جديد
  const [newPromoName, setNewPromoName] = useState('');
  const [newPromoType, setNewPromoType] = useState('bxgy'); // bxgy | quantity_discount | percentage | fixed
  const [newPromoTarget, setNewPromoTarget] = useState('product'); // product | category | all
  const [newPromoProductId, setNewPromoProductId] = useState(null); // لا يوجد اختيار افتراضي أبداً
  const [newPromoCategoryId, setNewPromoCategoryId] = useState(null); // لا يوجد اختيار افتراضي أبداً
  const [newPromoBuyQty, setNewPromoBuyQty] = useState(2);
  const [newPromoFreeQty, setNewPromoFreeQty] = useState(1);
  const [newPromoMinQty, setNewPromoMinQty] = useState(2);
  const [newPromoDiscountPercent, setNewPromoDiscountPercent] = useState(10);
  const [newPromoPercentage, setNewPromoPercentage] = useState(10);
  const [newPromoFixedAmount, setNewPromoFixedAmount] = useState(50);
  const [newPromoStartDate, setNewPromoStartDate] = useState('');
  const [newPromoEndDate, setNewPromoEndDate] = useState('');
  const [campaignProductSearch, setCampaignProductSearch] = useState('');

  // ===== عروض المنتج المتعددة (Product Offers) - جزء 1-8 =====
  const [productOfferFormOpen, setProductOfferFormOpen] = useState(false); // فورم إضافة/تعديل عرض منتج
  const [editingProductOfferId, setEditingProductOfferId] = useState(null); // null = عرض جديد
  const [poName, setPoName] = useState('');
  const [poType, setPoType] = useState('quantity_discount'); // percentage | fixed | bxgy | quantity_discount
  const [poMinQty, setPoMinQty] = useState(2);
  const [poDiscountPercent, setPoDiscountPercent] = useState(10);
  const [poFixedAmount, setPoFixedAmount] = useState(50);
  const [poBuyQty, setPoBuyQty] = useState(2);
  const [poFreeQty, setPoFreeQty] = useState(1);
  const [poActive, setPoActive] = useState(true);

  // ===== المحافظات =====
  const [governorates, setGovernorates] = useState(() => adminSettings.current.governorates || []);

  // ===== الأقسام والمنتجات =====
  const [categories, setCategories] = useState(() => adminSettings.current.categories || []);

  // ===== أقسام الصفحة الرئيسية =====
  const [homeSections, setHomeSections] = useState(() => adminSettings.current.homeSections || []);

  // ===== الصفحات المخصصة (بيضيفها الأدمن براحته وتظهر كزرار في الناف) =====
  const [customPages, setCustomPages] = useState(() => adminSettings.current.customPages || []);
  const [activeCustomPageId, setActiveCustomPageId] = useState(null);

  // ===== العروض الترويجية الحقيقية (Campaigns) - المصدر المركزي الوحيد لحساب الخصومات =====
  // كل عرض: { id, name:{ar,en}, type: 'bxgy'|'quantity_discount'|'percentage'|'fixed', target: 'product'|'category'|'all',
  //           productId, categoryId, buyQty, freeQty, minQty, discountPercent, percentage, fixedAmount,
  //           active, startDate, endDate, createdAt }
  const [promotions, setPromotions] = useState([]);
  const [faqs, setFaqs] = useState([
    { id: 1, q: { ar: 'إيه هي سياسة الاسترجاع؟', en: 'What is the return policy?' }, a: { ar: 'تقدر ترجع المنتج خلال 14 يوم من الاستلام، بشرط يكون بحالته الأصلية.', en: 'You can return the product within 14 days of receipt, provided it is in its original condition.' } },
    { id: 2, q: { ar: 'مدة التوصيل قد إيه؟', en: 'How long does delivery take?' }, a: { ar: 'التوصيل بياخد من 3 لـ 5 أيام عمل حسب محافظتك.', en: 'Delivery takes 3 to 5 business days depending on your governorate.' } }
  ]);
  const [productReviews, setProductReviews] = useState({});
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImageFile, setReviewImageFile] = useState(null);
  const [reviewImagePreview, setReviewImagePreview] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [contactMessages, setContactMessages] = useState([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [expenses, setExpenses] = useState([
    { id: 1, title: 'إعلان تمويلى فيسبوك', amount: 500, date: null }
  ]);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseDate, setNewExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newExpenseCategory, setNewExpenseCategory] = useState('أخرى');
  const EXPENSE_CATEGORIES = [
    { key: 'تسويق', en: 'Marketing' },
    { key: 'رواتب', en: 'Salaries' },
    { key: 'إيجار', en: 'Rent' },
    { key: 'تغليف', en: 'Packaging' },
    { key: 'أدوات ومعدات', en: 'Tools & Equipment' },
    { key: 'اشتراكات', en: 'Subscriptions' },
    { key: 'أخرى', en: 'Other' },
  ];
  const [newFaqQAr, setNewFaqQAr] = useState('');
  const [newFaqQEn, setNewFaqQEn] = useState('');
  const [newFaqAAr, setNewFaqAAr] = useState('');
  const [newFaqAEn, setNewFaqAEn] = useState('');
  const [editingFaqId, setEditingFaqId] = useState(null);
  const [salesData, setSalesData] = useState([
    { day: { ar: 'السبت', en: 'Sat' }, amount: 1200 },
    { day: { ar: 'الأحد', en: 'Sun' }, amount: 800 },
    { day: { ar: 'الإثنين', en: 'Mon' }, amount: 1500 },
    { day: { ar: 'الثلاثاء', en: 'Tue' }, amount: 2000 },
    { day: { ar: 'الأربعاء', en: 'Wed' }, amount: 950 },
    { day: { ar: 'الخميس', en: 'Thu' }, amount: 3000 },
    { day: { ar: 'الجمعة', en: 'Fri' }, amount: 2500 },
  ]);

  const adminStateRef = useRef({
    categories: [],
    governorates: [],
    countries: [],
    homeSections: [],
    customPages: [],
    campaigns: [],
    discountCodes: [],
    expenses: [],
    contactMessages: [],
    faqs: [],
    productReviews: {},
    salesData: [],
  });

  const productsRef = useRef([]);

  useEffect(() => {
    adminStateRef.current = {
      categories: Array.isArray(categories) ? categories : [],
      governorates: Array.isArray(governorates) ? governorates : [],
      countries: Array.isArray(countries) ? countries : [],
      homeSections: Array.isArray(homeSections) ? homeSections : [],
      customPages: Array.isArray(customPages) ? customPages : [],
      campaigns: Array.isArray(promotions) ? promotions : [],
      discountCodes: Array.isArray(discountCodes) ? discountCodes : [],
      expenses: Array.isArray(expenses) ? expenses : [],
      contactMessages: Array.isArray(contactMessages) ? contactMessages : [],
      faqs: Array.isArray(faqs) ? faqs : [],
      productReviews: productReviews && typeof productReviews === 'object' ? productReviews : {},
      salesData: Array.isArray(salesData) ? salesData : [],
    };
  }, [categories, governorates, countries, homeSections, customPages, promotions, discountCodes, expenses, contactMessages, faqs, productReviews, salesData]);

  const saveAdminSettings = useCallback(async (message, overrides = {}) => {
    if (adminSaveInFlightRef.current) {
      return null;
    }

    const latestState = {
      categories: Array.isArray(adminStateRef.current.categories) ? adminStateRef.current.categories : (Array.isArray(adminSettings.current.categories) ? adminSettings.current.categories : []),
      governorates: Array.isArray(adminStateRef.current.governorates) ? adminStateRef.current.governorates : (Array.isArray(adminSettings.current.governorates) ? adminSettings.current.governorates : []),
      countries: Array.isArray(adminStateRef.current.countries) ? adminStateRef.current.countries : (Array.isArray(adminSettings.current.countries) ? adminSettings.current.countries : []),
      homeSections: Array.isArray(adminStateRef.current.homeSections) ? adminStateRef.current.homeSections : (Array.isArray(adminSettings.current.homeSections) ? adminSettings.current.homeSections : []),
      customPages: Array.isArray(adminStateRef.current.customPages) ? adminStateRef.current.customPages : (Array.isArray(adminSettings.current.customPages) ? adminSettings.current.customPages : []),
      campaigns: Array.isArray(adminStateRef.current.campaigns) ? adminStateRef.current.campaigns : (Array.isArray(adminSettings.current.campaigns) ? adminSettings.current.campaigns : []),
      discountCodes: Array.isArray(adminStateRef.current.discountCodes) ? adminStateRef.current.discountCodes : (Array.isArray(adminSettings.current.discountCodes) ? adminSettings.current.discountCodes : []),
      expenses: Array.isArray(adminStateRef.current.expenses) ? adminStateRef.current.expenses : (Array.isArray(adminSettings.current.expenses) ? adminSettings.current.expenses : []),
      contactMessages: Array.isArray(adminStateRef.current.contactMessages) ? adminStateRef.current.contactMessages : (Array.isArray(adminSettings.current.contactMessages) ? adminSettings.current.contactMessages : []),
      faqs: Array.isArray(adminStateRef.current.faqs) ? adminStateRef.current.faqs : (Array.isArray(adminSettings.current.faqs) ? adminSettings.current.faqs : []),
      productReviews: adminStateRef.current.productReviews && typeof adminStateRef.current.productReviews === 'object' ? adminStateRef.current.productReviews : (adminSettings.current.productReviews || {}),
      salesData: Array.isArray(adminStateRef.current.salesData) ? adminStateRef.current.salesData : (Array.isArray(adminSettings.current.salesData) ? adminSettings.current.salesData : []),
    };

    const payload = {
      ...adminSettings.current,
      ...latestState,
      ...overrides,
    };

    adminSaveInFlightRef.current = true;
    try {
      const response = await settingsAPI.update(payload);
      const refreshedSettings = response;
      const normalizedSettings = normalizePromotionSettings(refreshedSettings || payload);
      Object.assign(adminSettings.current, normalizedSettings);
      adminStateRef.current = {
        ...adminStateRef.current,
        categories: Array.isArray(normalizedSettings.categories) ? normalizedSettings.categories : adminStateRef.current.categories,
        governorates: Array.isArray(normalizedSettings.governorates) ? normalizedSettings.governorates : adminStateRef.current.governorates,
        countries: Array.isArray(normalizedSettings.countries) ? normalizedSettings.countries : adminStateRef.current.countries,
        homeSections: Array.isArray(normalizedSettings.homeSections) ? normalizedSettings.homeSections : adminStateRef.current.homeSections,
        customPages: Array.isArray(normalizedSettings.customPages) ? normalizedSettings.customPages : adminStateRef.current.customPages,
        campaigns: Array.isArray(normalizedSettings.campaigns) ? normalizedSettings.campaigns : adminStateRef.current.campaigns,
        discountCodes: Array.isArray(normalizedSettings.discountCodes) ? normalizedSettings.discountCodes : adminStateRef.current.discountCodes,
        expenses: Array.isArray(normalizedSettings.expenses) ? normalizedSettings.expenses : adminStateRef.current.expenses,
        contactMessages: Array.isArray(normalizedSettings.contactMessages) ? normalizedSettings.contactMessages : adminStateRef.current.contactMessages,
        faqs: Array.isArray(normalizedSettings.faqs) ? normalizedSettings.faqs : adminStateRef.current.faqs,
        productReviews: normalizedSettings.productReviews && typeof normalizedSettings.productReviews === 'object' ? normalizedSettings.productReviews : adminStateRef.current.productReviews,
        salesData: Array.isArray(normalizedSettings.salesData) ? normalizedSettings.salesData : adminStateRef.current.salesData,
      };
      if (Array.isArray(normalizedSettings.categories)) setCategories(normalizedSettings.categories);
      if (Array.isArray(normalizedSettings.governorates)) setGovernorates(normalizedSettings.governorates);
      if (Array.isArray(normalizedSettings.countries)) setCountries(normalizedSettings.countries);
      if (Array.isArray(normalizedSettings.homeSections)) setHomeSections(normalizedSettings.homeSections);
      if (Array.isArray(normalizedSettings.customPages)) setCustomPages(normalizedSettings.customPages);
      if (Array.isArray(normalizedSettings.campaigns)) setPromotions(normalizedSettings.campaigns);
      if (Array.isArray(normalizedSettings.discountCodes)) setDiscountCodes(normalizedSettings.discountCodes);
      if (Array.isArray(normalizedSettings.expenses)) setExpenses(normalizedSettings.expenses);
      if (Array.isArray(normalizedSettings.contactMessages)) setContactMessages(normalizedSettings.contactMessages);
      if (Array.isArray(normalizedSettings.faqs)) setFaqs(normalizedSettings.faqs);
      if (normalizedSettings.productReviews && typeof normalizedSettings.productReviews === 'object') setProductReviews(normalizedSettings.productReviews);
      if (Array.isArray(normalizedSettings.salesData)) setSalesData(normalizedSettings.salesData);
      bumpSettings();

      const successMessage = typeof message === 'string' && message.trim()
        ? message
        : t('تم حفظ الإعدادات بنجاح', 'Settings saved successfully');
      showToast(successMessage);
      return normalizedSettings;
    } catch (err) {
      console.error('تعذّر حفظ إعدادات الأدمن:', err);
      const fallbackMessage = err?.response?.data?.message || err?.message || t('حصل خطأ في حفظ الإعدادات', 'Failed to save settings');
      showToast(fallbackMessage);
      throw err;
    } finally {
      adminSaveInFlightRef.current = false;
    }
  }, [t, showToast, normalizePromotionSettings, bumpSettings]);

  useEffect(() => {
    adminSettings.current.homeSections = homeSections;
  }, [homeSections]);

  useEffect(() => {
    adminSettings.current.customPages = customPages;
  }, [customPages]);

  // ===== المنتجات بقت جاية من الباك اند الحقيقي مش ثابتة في الكود =====
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setProductsLoading(true);
        const list = await productsAPI.getAll();
        const safeList = Array.isArray(list) ? list : [];
        setProducts(safeList);
        productsRef.current = safeList;
      } catch (err) {
        console.error('تعذّر تحميل المنتجات من السيرفر:', err);
        showToast(t('تعذّر تحميل المنتجات، تأكد من اتصال السيرفر', 'Could not load products, check server connection'));
      } finally {
        setProductsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // ===== مزامنة المنتج المفتوح (selectedProduct) مع قائمة المنتجات =====
  // selectedProduct بيتحفظ كنسخة منفصلة وقت الضغط على المنتج (openProductDetails)،
  // فلو الأدمن عدّل عروض المنتج (أو أي بيانات تانية) وهو نفس المنتج مفتوح في صفحة
  // المنتج، الأوفرات الجديدة كانت بتفضل مش باينة لحد ما يقفل الصفحة ويفتحها تاني
  // (لأن selectedProduct نسخة قديمة مش متزامنة مع تحديثات products). هنا بنحدّث
  // selectedProduct تلقائياً كل ما نسخته الأحدث في products تتغيّر.
  useEffect(() => {
    if (!selectedProduct?.id) return;
    const freshProduct = products.find(p => p.id === selectedProduct.id);
    if (freshProduct && freshProduct !== selectedProduct) {
      setSelectedProduct(freshProduct);
    }
  }, [products, selectedProduct]);

  // Separate error handling for settings
  useEffect(() => {
    let isMounted = true;
    
    const loadSettingsOnly = async () => {
      try {
        await loadAppSettings();
      } catch (err) {
        if (!isMounted) return;
        console.error('تعذّر تحميل إعدادات الموقع:', err);
        // Only show toast for settings if products loaded successfully
        if (products.length > 0) {
          showToast(t('تعذّر تحميل إعدادات الموقع، حاول تاني لاحقاً', 'Unable to load site settings, please try again later'));
        }
      } finally {
        // سواء نجح أو فشل التحميل، لازم نوقف شاشة التحميل الأولى عشان الموقع
        // ميفضلش شاشة بيضاء لحد الأبد لو حصل خطأ في الشبكة.
        if (isMounted) setSettingsReady(true);
      }
    };
    
    loadSettingsOnly();
    
    return () => {
      isMounted = false;
    };
  }, [products.length]);

  useEffect(() => {
    adminSettings.current.categories = categories;
  }, [categories]);

  useEffect(() => {
    adminSettings.current.governorates = governorates;
  }, [governorates]);

  useEffect(() => {
    adminSettings.current.countries = countries;
  }, [countries]);

  // ===== سلة التسوق =====
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('call_center');
  const [staffSections, setStaffSections] = useState([]); // [{key,label}] من السيرفر
  const [newStaffPermissions, setNewStaffPermissions] = useState({}); // { sectionKey: 'view'|'edit'|undefined }
  const [editingStaffId, setEditingStaffId] = useState(null); // لو بنعدل صلاحيات موظف موجود
  const [editingStaffPermissions, setEditingStaffPermissions] = useState({});
  const [customersList, setCustomersList] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersPage, setCustomersPage] = useState(1);
  const [customersPageSize, setCustomersPageSize] = useState(30);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customersTotalPages, setCustomersTotalPages] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedCustomerOrders, setSelectedCustomerOrders] = useState([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);

  // ===== إضافة منتج =====
  const [newProdNameAr, setNewProdNameAr] = useState('');
  const [newProdNameEn, setNewProdNameEn] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdCat, setNewProdCat] = useState('');
  const [newProdImgs, setNewProdImgs] = useState('');
  const [newProdImageFiles, setNewProdImageFiles] = useState([]); // [{ id, dataUrl, name }]
  const [newProdVideo, setNewProdVideo] = useState(null); // { url, publicId, ... } أو null
  const [draggedImageId, setDraggedImageId] = useState(null);
  const [newProdDescAr, setNewProdDescAr] = useState('');
  const [newProdDescEn, setNewProdDescEn] = useState('');
  const [newProdOnSale, setNewProdOnSale] = useState(false);
  const [newProdSalePrice, setNewProdSalePrice] = useState('');
  const [newProdPermanentSalePrice, setNewProdPermanentSalePrice] = useState('');
  const [newProdIsFeatured, setNewProdIsFeatured] = useState(false);
  const [newProdEnableRec, setNewProdEnableRec] = useState(true);
  const [newProdEnableBundle, setNewProdEnableBundle] = useState(true);
  const [newProdEnableReviews, setNewProdEnableReviews] = useState(true);

  // ===== نظام الألوان / المقاسات / المخزون لمنتج جديد =====
  const [newProdVisibility, setNewProdVisibility] = useState('published'); // published | hidden | draft
  const [newProdLowStockThreshold, setNewProdLowStockThreshold] = useState('');
  const [newProdHasSizes, setNewProdHasSizes] = useState(true);
  const [newProdSelectedSizes, setNewProdSelectedSizes] = useState(['S', 'M', 'L', 'XL']);
  const [newProdCustomSize, setNewProdCustomSize] = useState('');
  const [newProdHasColors, setNewProdHasColors] = useState(false);
  const [newProdColors, setNewProdColors] = useState([]); // [{ id, nameAr, nameEn, hex }]
  const [newProdColorNameAr, setNewProdColorNameAr] = useState('');
  const [newProdColorNameEn, setNewProdColorNameEn] = useState('');
  const [newProdColorHex, setNewProdColorHex] = useState('#000000');
  const [newProdVariantsGenerated, setNewProdVariantsGenerated] = useState(null); // نتيجة "توليد الفاريانتس"
  const [newProdVariantStockInputs, setNewProdVariantStockInputs] = useState({}); // { "variantKey__size": { sku, stock } }
  const [newProdColorImages, setNewProdColorImages] = useState({}); // { colorId: [{ id, dataUrl, name }] }
  const [newProdSlug, setNewProdSlug] = useState('');
  const [newProdMetaTitleAr, setNewProdMetaTitleAr] = useState('');
  const [newProdMetaTitleEn, setNewProdMetaTitleEn] = useState('');
  const [newProdMetaDescAr, setNewProdMetaDescAr] = useState('');
  const [newProdMetaDescEn, setNewProdMetaDescEn] = useState('');
  const [newProdMetaKeywordsAr, setNewProdMetaKeywordsAr] = useState('');
  const [newProdMetaKeywordsEn, setNewProdMetaKeywordsEn] = useState('');

  const AVAILABLE_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  // ============================================================
  // إدارة المنتجات (الأدمن) — تحديد منتج / إضافة / تعديل
  // ============================================================
  const [selectedManagedProductId, setSelectedManagedProductId] = useState(null); // لا يوجد اختيار افتراضي أبداً
  const [productManagerMode, setProductManagerMode] = useState('closed'); // 'closed' | 'add' | 'edit'
  const [productEditorTab, setProductEditorTab] = useState('basic'); // basic | media | variants | inventory | visibility | marketing | seo
  const [adminProductSearch, setAdminProductSearch] = useState('');
  const [adminProductFilter, setAdminProductFilter] = useState('all');
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState(null);
  const [productEditorDirty, setProductEditorDirty] = useState(false);
  const [productEditorLoaded, setProductEditorLoaded] = useState(false);
  const [draggedColorImageKey, setDraggedColorImageKey] = useState(null);
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false); // درج القائمة الجانبية للأدمن على الموبايل

  // أي تغيير في حقول النموذج بعد التحميل الأول = فيه تعديلات غير محفوظة
  useEffect(() => {
    if (productManagerMode === 'closed') { setProductEditorLoaded(false); setProductEditorDirty(false); return; }
    if (!productEditorLoaded) { setProductEditorLoaded(true); return; }
    setProductEditorDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    newProdNameAr, newProdNameEn, newProdPrice, newProdCost, newProdCat, newProdImgs, newProdImageFiles,
    newProdDescAr, newProdDescEn, newProdOnSale, newProdSalePrice, newProdIsFeatured, newProdEnableRec,
    newProdEnableBundle, newProdEnableReviews, newProdVisibility, newProdLowStockThreshold, newProdHasSizes,
    newProdSelectedSizes, newProdHasColors, newProdColors, newProdColorImages, newProdVariantsGenerated,
    newProdVariantStockInputs, newProdSlug, newProdMetaTitleAr, newProdMetaTitleEn, newProdMetaDescAr, newProdMetaDescEn,
    newProdMetaKeywordsAr, newProdMetaKeywordsEn
  ]);

  // ===== إضافة قسم =====
  const [newCatNameAr, setNewCatNameAr] = useState('');
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [newCatImg, setNewCatImg] = useState('');

  // ===== إضافة محافظة =====
  const [newGovNameAr, setNewGovNameAr] = useState('');
  const [newGovNameEn, setNewGovNameEn] = useState('');
  const [newGovCost, setNewGovCost] = useState('');
  const [newGovCountryId, setNewGovCountryId] = useState('');

  // ===== بيانات الشحن =====
  const [selectedGov, setSelectedGov] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [shippingProviders, setShippingProviders] = useState({});
  // نتيجة آخر Test Connection لكل شركة شحن (CONNECTED/AUTH_ERROR/...) - بتتخزن
  // عشان نعرض حالة الاتصال بشكل واضح ودائم في شاشة إعدادات الشحن (مش toast
  // بيختفي بس)، وحالة تحميل منفصلة لكل شركة عشان منمنعش زرار شركة تانية.
  const [shippingConnectionResults, setShippingConnectionResults] = useState({});
  const [testingProviderKey, setTestingProviderKey] = useState(null);
  const [shippingRates, setShippingRates] = useState([]);
  const [selectedShippingProvider, setSelectedShippingProvider] = useState('');
  const [shippingCoverage, setShippingCoverage] = useState({});
  const [shippingRatesLoading, setShippingRatesLoading] = useState(false);
  const [shippingHasCandidates, setShippingHasCandidates] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingPhone2, setShippingPhone2] = useState('');
  const [shippingZipCode, setShippingZipCode] = useState('');
  const [shippingFullName, setShippingFullName] = useState('');
  // ===== Phase 2: حقول العنوان المنظّم الإضافية (عامة لكل شركات الشحن) =====
  // District/Area أساسي (مطلوب في الواجهة عشان لاحقًا يتربط باحتياجات كل
  // شركة شحن)، والباقي (رقم عمارة/دور/شقة/علامة مميزة) اختياري بالكامل -
  // مش عايزين نملأ الـCheckout بخانات إجبارية مش لازمة لكل الحالات.
  const [shippingDistrict, setShippingDistrict] = useState('');
  const [shippingBuildingNumber, setShippingBuildingNumber] = useState('');
  const [shippingFloor, setShippingFloor] = useState('');
  const [shippingApartment, setShippingApartment] = useState('');
  const [shippingLandmark, setShippingLandmark] = useState('');
  // إيميل اختياري للضيف (لو مسجل، بياخد إيميل الحساب زي ما كان قبل كده)
  const [shippingEmail, setShippingEmail] = useState('');
  const [useExistingAddress, setUseExistingAddress] = useState(false);
  const [saveShippingInfo, setSaveShippingInfo] = useState(false);
  const [hasSavedShipping, setHasSavedShipping] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('cod');
  const [selectedWalletMethodId, setSelectedWalletMethodId] = useState(null);
  const [walletSenderPhone, setWalletSenderPhone] = useState('');
  const [walletTransferDate, setWalletTransferDate] = useState('');
  const [walletScreenshotFile, setWalletScreenshotFile] = useState(null);
  const [walletScreenshotPreview, setWalletScreenshotPreview] = useState('');
  const [kashierPaymentStatus, setKashierPaymentStatus] = useState('pending');
  const [kashierPaymentOrderId, setKashierPaymentOrderId] = useState('');
  const [paymentCompleteGateway, setPaymentCompleteGateway] = useState('kashier');

  // ===== بيانات المبيعات (معرّفة أعلاه) =====

  const [adminTab, setAdminTab] = useState('stats');
  const [brevoMarketing, setBrevoMarketing] = useState({ enabled:false, orderConfirmation:false, orderConfirmationChannel:'email', statusNotifications:false, statusChannels:[], abandonedCart:{enabled:false,steps:[]}, whatsapp:{enabled:false,senderNumber:''} });
  const [brevoConfigured, setBrevoConfigured] = useState(false);
  const [brevoCampaign, setBrevoCampaign] = useState({ channel:'email', subject:'', content:'', audience:'all', whatsappTemplateId:'' });
  const [brevoBusy, setBrevoBusy] = useState(false);
  const [kashierAdminStatus, setKashierAdminStatus] = useState(null);
  const [kashierAdminStatusLoading, setKashierAdminStatusLoading] = useState(false);
  const [paymobAdminStatus, setPaymobAdminStatus] = useState(null);
  const [paymobAdminStatusLoading, setPaymobAdminStatusLoading] = useState(false);
  const [brevoStats, setBrevoStats] = useState(null);
  useEffect(() => {
    if (adminTab !== 'brevo_marketing') return;
    (async () => {
      try { setBrevoStats(await (await import('./api/marketing')).marketingAPI.getStats()); }
      catch (e) { console.error('Brevo stats load:', e); }
    })();
  }, [adminTab]);
  useEffect(() => {
    if (currentPage !== 'payment-complete') return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId') || '';
    // 'method' tells us which gateway sent the customer back (Kashier or
    // Paymob) so we poll the matching status endpoint. Defaults to kashier
    // for older links that don't carry the param.
    const gateway = params.get('method') === 'paymob' ? 'paymob' : 'kashier';
    setPaymentCompleteGateway(gateway);
    setKashierPaymentOrderId(orderId);
    if (!orderId) {
      setKashierPaymentStatus('failed');
      return;
    }
    let cancelled = false;
    let attempts = 0;
    // ===== FIX: the old cap (7 tries × 2s = 14s total) is why customers got
    // stuck forever on "جاري التأكيد": the backend now also reconciles
    // directly with the gateway on every poll (see reconcileKashierPendingOrder
    // / reconcilePaymobPendingOrder in paymentController.js), but that
    // gateway round-trip — plus normal webhook delivery delay — can
    // legitimately take longer than 14s, especially in TEST/SANDBOX. We now
    // poll for up to ~2 minutes (30 tries, 4s apart) before giving up, and
    // if it still hasn't resolved we show a distinct "still confirming, ثابت
    // من قاعدة البيانات" state with a manual recheck button instead of
    // silently freezing on the same "pending" spinner forever.
    const MAX_ATTEMPTS = 30;
    const POLL_INTERVAL_MS = 4000;
    const check = async () => {
      try {
        const result = gateway === 'paymob'
          ? await paymentsAPI.getPaymobPaymentStatus(orderId)
          : await paymentsAPI.getPaymentStatus(orderId);
        if (cancelled) return;
        const status = result?.paymentStatus || 'pending';
        if (status === 'pending') {
          attempts += 1;
          if (attempts < MAX_ATTEMPTS) {
            setKashierPaymentStatus('pending');
            setTimeout(check, POLL_INTERVAL_MS);
          } else {
            // Gave up polling — this does NOT mean the payment failed, it
            // just means we haven't heard back yet. The order's real status
            // is still tracked server-side and can be rechecked any time.
            setKashierPaymentStatus('timeout');
          }
        } else {
          setKashierPaymentStatus(status);
        }
      } catch (e) {
        if (!cancelled && attempts < MAX_ATTEMPTS) {
          attempts += 1;
          setTimeout(check, POLL_INTERVAL_MS);
        } else if (!cancelled) {
          setKashierPaymentStatus('timeout');
        }
      }
    };
    check();
    return () => { cancelled = true; };
  }, [currentPage]);

  // ===== FIX: manual "تحقق الآن" recheck for the 'timeout' state above — asks
  // the backend (and, through it, the gateway) one more time on demand
  // instead of leaving the customer with no way forward. =====
  const recheckPaymentStatus = async () => {
    if (!kashierPaymentOrderId) return;
    setKashierPaymentStatus('pending');
    try {
      const result = paymentCompleteGateway === 'paymob'
        ? await paymentsAPI.getPaymobPaymentStatus(kashierPaymentOrderId)
        : await paymentsAPI.getPaymentStatus(kashierPaymentOrderId);
      setKashierPaymentStatus(result?.paymentStatus || 'timeout');
    } catch (e) {
      setKashierPaymentStatus('timeout');
    }
  };

  useEffect(() => {
    if (adminTab !== 'payment_settings') return;
    let cancelled = false;
    (async () => {
      setKashierAdminStatusLoading(true);
      try {
        const status = await paymentsAPI.getKashierStatus();
        if (!cancelled) setKashierAdminStatus(status);
      } catch (e) {
        if (!cancelled) setKashierAdminStatus({ configured: false, connected: false, enabled: false, error: e?.message || 'Connection check failed' });
      } finally {
        if (!cancelled) setKashierAdminStatusLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adminTab]);

  useEffect(() => {
    if (adminTab !== 'payment_settings') return;
    let cancelled = false;
    (async () => {
      setPaymobAdminStatusLoading(true);
      try {
        const status = await paymentsAPI.getPaymobStatus();
        if (!cancelled) setPaymobAdminStatus(status);
      } catch (e) {
        if (!cancelled) setPaymobAdminStatus({ configured: false, connected: false, enabled: false, error: e?.message || 'Connection check failed' });
      } finally {
        if (!cancelled) setPaymobAdminStatusLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adminTab]);
  const [apiSubTab, setApiSubTab] = useState('keys');
  const [statsPeriod, setStatsPeriod] = useState('7days');
  const [statsCustomFrom, setStatsCustomFrom] = useState('');
  const [statsCustomTo, setStatsCustomTo] = useState('');
  // ===== إحصائيات الإيرادات محسوبة في الداتا بيز (مش في الفرونت) - بديل
  // تدريجي لحساب "إجمالي الإيرادات" اللي كان بيتحسب من statsOrders =====
  const [revenueStats, setRevenueStats] = useState(null);
  const [revenueStatsLoading, setRevenueStatsLoading] = useState(false);
  const [revenueBreakdown, setRevenueBreakdown] = useState(null);
  const [revenueBreakdownLoading, setRevenueBreakdownLoading] = useState(false);
  const [customerStats, setCustomerStats] = useState(null);
  const [customerStatsLoading, setCustomerStatsLoading] = useState(false);
  // ===== جراف المبيعات + إحصائيات متفرقة + مقارنة سنوية - محسوبة في الداتا
  // بيز (مش في الفرونت من statsOrders المحدودة بسقف 1000) =====
  const [salesTrend, setSalesTrend] = useState(null);
  const [salesTrendLoading, setSalesTrendLoading] = useState(false);
  const [dashboardExtras, setDashboardExtras] = useState(null);
  const [dashboardExtrasLoading, setDashboardExtrasLoading] = useState(false);
  const [yearlyComparison, setYearlyComparison] = useState(null);
  const [yearlyComparisonLoading, setYearlyComparisonLoading] = useState(false);
  const [abandonedCartStats, setAbandonedCartStats] = useState(null);
  const [abandonedCartStatsLoading, setAbandonedCartStatsLoading] = useState(false);
  // ===== الأوردرات: تتبع الطلبات المفتوحة (expand/collapse) =====
  const [expandedOrderIds, setExpandedOrderIds] = useState(new Set());
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all'); // 'all' | 'wallet'
  // ===== حالة نموذج استرجاع الفلوس (Kashier/Paymob) لكل طلب =====
  const [refundAmountByOrder, setRefundAmountByOrder] = useState({});
  const [refundLoadingOrderId, setRefundLoadingOrderId] = useState(null);
  // ===== حالة نموذج استرجاع منتج معين (طلب استرجاع - Return Request) =====
  const [returnFormOrderId, setReturnFormOrderId] = useState(null); // أنهي طلب الفورم مفتوح ليه
  const [returnFormSelection, setReturnFormSelection] = useState({}); // itemKey -> qty
  const [returnFormReason, setReturnFormReason] = useState('');
  const [returnFormReasonCode, setReturnFormReasonCode] = useState(''); // سبب الاسترجاع (كود من RETURN_REASONS) - بيحدد هل فيه رسوم
  const [returnFormShippingCost, setReturnFormShippingCost] = useState('');
  const [returnFormLoading, setReturnFormLoading] = useState(false);
  const [returnReviewLoadingOrderId, setReturnReviewLoadingOrderId] = useState(null);
  const [returnTrackingInputByOrder, setReturnTrackingInputByOrder] = useState({});
  const [returnReviewReasonCodeByOrder, setReturnReviewReasonCodeByOrder] = useState({}); // orderId -> reasonCode (الأدمن يقدر يصحح سبب العميل وقت المراجعة)
  const [returnTrackingSavingOrderId, setReturnTrackingSavingOrderId] = useState(null);
  // ===== Bosta Return/Exchange Integration: زرار "مزامنة الآن" (Sync Now) - orderId بيتزامن دلوقتي =====
  const [returnSyncingOrderId, setReturnSyncingOrderId] = useState(null);
  // ===== حالة نموذج طلب استبدال (Exchange Request) =====
  const [returnExchangeChoiceOrderId, setReturnExchangeChoiceOrderId] = useState(null); // أنهي طلب فاتح اختيار Return/Exchange
  const [myExchangeRequests, setMyExchangeRequests] = useState([]); // طلبات الاستبدال بتاعة العميل الحالي
  const [exchangeFormOrderId, setExchangeFormOrderId] = useState(null);
  const [exchangeFormSelection, setExchangeFormSelection] = useState({}); // itemKey -> { quantity, newVariantId, newSize }
  const [exchangeFormReasonCode, setExchangeFormReasonCode] = useState('');
  // ===== Returns & Exchanges - Phase 2B: تبويب الأدمن الموحّد =====
  const [reAdminSubTab, setReAdminSubTab] = useState('list'); // list | settings | reasons
  const [reAdminList, setReAdminList] = useState([]); // قايمة موحّدة (return + exchange) بعد الدمج
  const [reAdminLoading, setReAdminLoading] = useState(false);
  const [reAdminTypeFilter, setReAdminTypeFilter] = useState('all'); // all | return | exchange
  const [reAdminStatusFilter, setReAdminStatusFilter] = useState('');
  const [reAdminSearch, setReAdminSearch] = useState('');
  const [reAdminDateFrom, setReAdminDateFrom] = useState('');
  const [reAdminDateTo, setReAdminDateTo] = useState('');
  const [reAdminSelected, setReAdminSelected] = useState(null); // { type, data } للتفاصيل
  const [reAdminSelectedLoading, setReAdminSelectedLoading] = useState(false);
  const [reAdminNoteDraft, setReAdminNoteDraft] = useState('');
  const [reAdminActionLoading, setReAdminActionLoading] = useState(false);
  const [reAdminNewReasonType, setReAdminNewReasonType] = useState('return'); // فورم إضافة سبب جديد
  const [reAdminNewReasonAr, setReAdminNewReasonAr] = useState('');
  const [reAdminNewReasonEn, setReAdminNewReasonEn] = useState('');
  const [exchangeFormNote, setExchangeFormNote] = useState('');
  const [exchangeFormLoading, setExchangeFormLoading] = useState(false);
  const [exchangeFormProducts, setExchangeFormProducts] = useState({}); // productId -> product (للفاريانتات)

  // ===== قسم الاستبدال جوه Admin → Orders - مطابق بالظبط لقسم الاسترجاع فوق =====
  const [adminExchangeRequests, setAdminExchangeRequests] = useState([]); // كل طلبات الاستبدال (كل الطلبات - للأدمن) - عشان تتفلتر بالـorderId جوه كارت كل طلب
  const [exchangeReviewLoadingId, setExchangeReviewLoadingId] = useState(null); // id بتاع الـExchangeRequest اللي بيتراجع دلوقتي
  const [exchangeReviewReasonCodeById, setExchangeReviewReasonCodeById] = useState({}); // exchangeRequestId -> reasonCode (الأدمن يصحح السبب وقت المراجعة)
  const [exchangeTrackingInputById, setExchangeTrackingInputById] = useState({}); // exchangeRequestId -> نص Input رقم التتبع
  const [exchangeTrackingSavingId, setExchangeTrackingSavingId] = useState(null);
  const [exchangeStatusUpdatingId, setExchangeStatusUpdatingId] = useState(null); // exchangeRequestId - بيتحدّث حالته دلوقتي (pickup_scheduled/received/processing/completed)
  // ===== Bosta Return/Exchange Integration: زرار "مزامنة الآن" (Sync Now) - exchangeRequestId بيتزامن دلوقتي =====
  const [exchangeSyncingId, setExchangeSyncingId] = useState(null);
  // ===== نموذج "تسجيل استبدال يدوي" بواسطة الأدمن (العميل كلّمه تليفونيًا مثلًا) =====
  const [adminExchangeFormOrderId, setAdminExchangeFormOrderId] = useState(null);
  const [adminExchangeFormSelection, setAdminExchangeFormSelection] = useState({}); // itemKey -> { quantity, newVariantId, newSize }
  const [adminExchangeFormProducts, setAdminExchangeFormProducts] = useState({});
  const [adminExchangeFormReasonCode, setAdminExchangeFormReasonCode] = useState('');
  const [adminExchangeFormNote, setAdminExchangeFormNote] = useState('');
  const [adminExchangeFormLoading, setAdminExchangeFormLoading] = useState(false);
  const toggleOrderExpand = useCallback((ordId) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(ordId)) { next.delete(ordId); } else { next.add(ordId); }
      return next;
    });
  }, []);

  // ===== إدارة أقسام الصفحة الرئيسية =====
  const [newSectionType, setNewSectionType] = useState('image-text');
  // حقول خاصة بأقسام المنتجات
  const [newSectionProductCount, setNewSectionProductCount] = useState(4);
  const [newSectionDisplayStyle, setNewSectionDisplayStyle] = useState('grid');
  const [newSectionProductIds, setNewSectionProductIds] = useState([]); // لـ products-custom
  const [newSectionCategoryId, setNewSectionCategoryId] = useState(''); // لـ products-category
  // حقول خاصة بأقسام المنتجات في الصفحات المخصصة
  const [newPageSectionProductCount, setNewPageSectionProductCount] = useState(4);
  const [newPageSectionDisplayStyle, setNewPageSectionDisplayStyle] = useState('grid');
  const [newPageSectionProductIds, setNewPageSectionProductIds] = useState([]);
  const [newSectionTitleAr, setNewSectionTitleAr] = useState('');
  const [newSectionTitleEn, setNewSectionTitleEn] = useState('');
  const [newSectionDescAr, setNewSectionDescAr] = useState('');
  const [newSectionDescEn, setNewSectionDescEn] = useState('');
  const [newSectionImage, setNewSectionImage] = useState('');
  const [newSectionButtonAction, setNewSectionButtonAction] = useState('none');
  const [newSectionButtonTextAr, setNewSectionButtonTextAr] = useState('');
  const [newSectionButtonTextEn, setNewSectionButtonTextEn] = useState('');
  // ===== تعديل السيكشن =====
  const [editingSection, setEditingSection] = useState(null); // الكائن اللي بنعدله
  const [editSecTitleAr, setEditSecTitleAr] = useState('');
  const [editSecTitleEn, setEditSecTitleEn] = useState('');
  const [editSecDescAr, setEditSecDescAr] = useState('');
  const [editSecDescEn, setEditSecDescEn] = useState('');
  const [editSecImage, setEditSecImage] = useState('');
  const [editSecButtonAction, setEditSecButtonAction] = useState('none');
  const [editSecButtonTextAr, setEditSecButtonTextAr] = useState('');
  const [editSecButtonTextEn, setEditSecButtonTextEn] = useState('');
  const [editSecProductCount, setEditSecProductCount] = useState(4);
  const [editSecDisplayStyle, setEditSecDisplayStyle] = useState('grid');
  const [editSecProductIds, setEditSecProductIds] = useState([]);
  const [editSecCategoryId, setEditSecCategoryId] = useState('');

  // ===== حقول فورم إضافة صفحة مخصصة وأقسامها =====
  const [newPageTitleAr, setNewPageTitleAr] = useState('');
  const [newPageTitleEn, setNewPageTitleEn] = useState('');
  const [selectedPageForSection, setSelectedPageForSection] = useState('');
  const [newPageSectionType, setNewPageSectionType] = useState('image-text');
  const [newPageSectionTitleAr, setNewPageSectionTitleAr] = useState('');
  const [newPageSectionTitleEn, setNewPageSectionTitleEn] = useState('');
  const [newPageSectionDescAr, setNewPageSectionDescAr] = useState('');
  const [newPageSectionDescEn, setNewPageSectionDescEn] = useState('');
  const [newPageSectionImage, setNewPageSectionImage] = useState('');
  const [newPageSectionButtonAction, setNewPageSectionButtonAction] = useState('none');
  const [newPageSectionButtonTextAr, setNewPageSectionButtonTextAr] = useState('');
  const [newPageSectionButtonTextEn, setNewPageSectionButtonTextEn] = useState('');

  // ===== إدارة توصيات المنتجات =====
  const [selectedProductForRec, setSelectedProductForRec] = useState(null);
  const [recProductIds, setRecProductIds] = useState([]);
  const [bundleProductIds, setBundleProductIds] = useState([]);
  const [bundleDiscountPercent, setBundleDiscountPercent] = useState(0);
  const [recEnableRec, setRecEnableRec] = useState(true);
  const [recEnableBundle, setRecEnableBundle] = useState(true);
  const [recSearchQuery, setRecSearchQuery] = useState('');

  // ===== دالة مساعدة لجلب النص المترجم من كائن =====
  const getLocalized = useCallback((obj) => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object' && obj !== null) {
      return obj[language] || obj.ar || obj.en || '';
    }
    return String(obj);
  }, [language]);

  // ===== تحميل Font Awesome =====
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }, []);

  // ===== تحميل مكتبة xlsx لتصدير Excel =====
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
    script.async = true;
    document.head.appendChild(script);
    return () => {
      // cleanup not needed
    };
  }, []);

  // ===== دالة التنقل الموحدة: كل تنقل بين الصفحات لازم يمر من هنا =====
  // ده بالظبط اللي بيخلي السلوك زي المواقع الكبيرة (React Router وغيره):
  // كل ضغطة على رابط/زرار تنقل بتزود navKey، فالـ useLayoutEffect تحت بيتنفذ
  // أكيد في كل مرة - حتى لو الصفحة الجديدة نفس اسم الصفحة القديمة (زي الضغط
  // على "المتجر" وأنت أصلاً في صفحة المتجر، أو اختيار قسم/فلتر تاني وانت
  // في نفس الصفحة). الاعتماد القديم على تغيّر قيمة currentPage/selectedProduct
  // بس كان بيخلي التمرير ميحصلش في الحالات دي لأن React مكنش بيعتبرها تغيير.
  const pageToPath = useCallback((page, extra) => {
    if (page === 'home') return '/';
    if (page === 'shop') return '/shop';
    if (page === 'checkout') return '/checkout';
    if (page === 'checkout-details') return '/checkout-details';
    if (page === 'wishlist') return '/wishlist';
    if (page === 'contact') return '/contact';
    if (page === 'account') return '/account';
    if (page === 'returns-policy') return '/returns';
    if (page === 'guest-return-exchange') return '/return-exchange';
    if (page === 'my-orders') return '/my-orders';
    if (page === 'order-confirmation') return '/order-confirmation';
    if (page === 'payment-complete') return '/payment-complete';
    if (page === 'admin') return '/admin';
    if (page === 'product-details' && extra) {
      const slug = (extra.nameAr || extra.nameEn || extra.name?.ar || extra.name?.en || String(extra.id || ''))
        .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u0600-\u06ff-]/g, '');
      return '/product/' + slug;
    }
    if (page === 'custom-page' && extra) return '/page/' + extra;
    return '/';
  }, []);

  const goTo = useCallback((page, extra) => {
    setCurrentPage(page);
    setNavKey(k => k + 1);
    try {
      const path = pageToPath(page, extra);
      window.history.pushState({ page, extra }, '', path);
    } catch {}
  }, [pageToPath]);

  // ===== الأزرار الجاهزة اللي ممكن تتضاف لأي قسم (في الصفحة الرئيسية أو صفحة مخصصة) =====
  // مفيش زرار بيتخترع من الصفر: كل زرار هنا بيستخدم نفس وظيفة زرار موجود فعلاً في الموقع.
  const sectionButtonActions = [
    { key: 'none', label: t('بدون زرار', 'No button') },
    { key: 'shop', label: t('جميع المنتجات', 'All Products'), defaultText: { ar: 'تسوق الآن', en: 'Shop Now' } },
    { key: 'contact', label: t('تواصل معنا', 'Contact Us'), defaultText: { ar: 'تواصل معنا', en: 'Contact Us' } },
    { key: 'home', label: t('الرئيسية', 'Home'), defaultText: { ar: 'الرئيسية', en: 'Home' } },
  ];

  const handleSectionButtonClick = (action) => {
    if (action === 'shop') { setSelectedCategoryFilter('all'); goTo('shop'); }
    else if (action === 'contact') { goTo('contact'); }
    else if (action === 'home') { goTo('home'); }
  };

  // ===== نافذة "الإضافة السريعة للسلة" اللي بتتفتح من زرار الكارت مباشرة =====
  // فيها اختيار لون/مقاس (لو المنتج محتاجهم) وبعدين إضافة للسلة من غير ما نطلع من صفحة المتجر.
  const QuickAddModal = ({ product, onClose }) => {
    const productHasColorsQ = hasColors(product);
    const variants = getVariants(product);
    const [qColor, setQColor] = useState(productHasColorsQ ? '' : (getDefaultVariant(product)?.id || ''));
    const [qSize, setQSize] = useState('');
    const productHasSizesQ = (product.sizes || []).length > 0;
    const colorMissing = productHasColorsQ && !qColor;
    const sizeMissing = productHasSizesQ && !qSize;
    const selectionComplete = !colorMissing && !sizeMissing;
    const currentStock = selectionComplete ? getVariantStock(product, qColor, qSize) : 0;
    const images = getVariantImages(product, qColor);

    const handleConfirm = () => {
      if (!selectionComplete || currentStock === 0) return;
      const ok = addToCart(product, qColor, qSize, null, 1);
      if (ok) onClose();
    };

    let btnLabel = t('أضف إلى السلة', 'Add to Cart');
    if (!selectionComplete) btnLabel = t('اختر الخيارات المطلوبة', 'Select options');
    else if (currentStock === 0) btnLabel = t('غير متوفر', 'Out of Stock');

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[75] p-4" onClick={onClose}>
        <div
          className="bg-[var(--lava-card)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-fade-in"
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-3 end-3 z-10 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-lg hover:scale-110 transition" title={t('إغلاق', 'Close')}>✕</button>
          <div className="h-52 overflow-hidden bg-[var(--lava-secondary)]">
            <img src={images[0]} alt={getLocalized(product.name)} className="w-full h-full object-cover" />
          </div>
          <div className={`p-5 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            <h3 className="font-bold text-lg mb-1">{getLocalized(product.name)}</h3>
            {product.onSale && isSaleActive() ? (
              <p className="font-bold text-base mb-4">
                <span className="line-through text-[var(--lava-muted)] text-sm me-2">{product.price} {t('ج.م', 'EGP')}</span>
                <span style={{ color: theme.card.saleColor || '#dc2626' }}>{product.salePrice} {t('ج.م', 'EGP')}</span>
              </p>
            ) : product.permanentSalePrice ? (
              <p className="font-bold text-base mb-4">
                <span className="line-through text-[var(--lava-muted)] text-sm me-2">{product.price} {t('ج.م', 'EGP')}</span>
                <span style={{ color: theme.card.saleColor || '#dc2626' }}>{product.permanentSalePrice} {t('ج.م', 'EGP')}</span>
              </p>
            ) : (
              <p className="font-bold text-base text-[var(--lava-muted)] mb-4">{product.price} {t('ج.م', 'EGP')}</p>
            )}

            {productHasColorsQ && (
              <div className="mb-4">
                <label className="block font-bold mb-2 text-sm">
                  {t('اختر اللون:', 'Choose color:')}
                  {qColor ? (() => {
                    const v = getVariantById(product, qColor);
                    return v && v.color ? <span className="font-normal text-[var(--lava-muted)]"> ({getLocalized(v.color)})</span> : null;
                  })() : null}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {variants.map((v) => {
                    const variantOut = getVariantTotalStock(v) <= 0;
                    return (
                      <button
                        key={v.id}
                        onClick={() => { setQColor(v.id); setQSize(''); }}
                        title={v.color ? getLocalized(v.color) : ''}
                        style={{ backgroundColor: v.hex || '#eee' }}
                        className={`relative w-9 h-9 rounded-full border-2 transition ${qColor === v.id ? 'ring-2 ring-offset-2 ring-black border-black' : 'border-[var(--lava-border)] hover:border-black'} ${variantOut ? 'opacity-40' : ''}`}
                      >
                        {variantOut && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-red-600">✕</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {productHasSizesQ && (
              <div className="mb-4">
                <label className="block font-bold mb-2 text-sm">{t('اختر المقاس:', 'Choose size:')}</label>
                {colorMissing ? (
                  <p className="text-[var(--lava-muted)] text-xs">{t('اختر اللون أولاً لعرض المقاسات المتاحة.', 'Choose a color first to see available sizes.')}</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {(product.sizes || []).map((size) => {
                      const sizeStock = getVariantStock(product, qColor, size);
                      const sizeOut = sizeStock <= 0;
                      return (
                        <button
                          key={size}
                          disabled={sizeOut}
                          onClick={() => setQSize(size)}
                          title={sizeOut ? t('غير متوفر', 'Out of Stock') : ''}
                          className={`w-10 h-10 rounded-lg font-bold border-2 text-sm transition relative ${qSize === size && !sizeOut ? 'bg-black text-white border-black' : 'bg-[var(--lava-card)] text-black border-[var(--lava-border)] hover:border-black'} ${sizeOut ? 'opacity-40 cursor-not-allowed line-through hover:border-[var(--lava-border)]' : ''}`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!colorMissing && !sizeMissing && currentStock === 0 && (
              <p className="text-red-600 text-xs font-bold mb-3">{t('هذا الاختيار غير متوفر', 'This option is out of stock')}</p>
            )}

            <button
              onClick={handleConfirm}
              disabled={!selectionComplete || currentStock === 0}
              className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {btnLabel} {selectionComplete && currentStock > 0 ? '🛒' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===== مكون كرت منتج مصغر للأقسام =====
  // ===== بادج نسبة الخصم على صورة الكارت (مستخدم في الكروت التلاتة) =====
  const DiscountBadge = ({ product, className = 'absolute top-2 end-2 text-xs font-bold px-2 py-1 rounded' }) => {
    const discountPercent = getDiscountPercent(product);
    if (discountPercent <= 0) return null;
    return (
      <span
        className={className}
        style={{ backgroundColor: theme.card.discountBadgeBg || '#dc2626', color: theme.card.discountBadgeText || '#ffffff' }}
      >
        -{discountPercent}%
      </span>
    );
  };

  // ===== نقط الألوان المتاحة تحت الكارت (مستخدمة في الكروت التلاتة) =====
  const ColorDots = ({ product, className = 'flex items-center gap-1 mt-1' }) => {
    if (!theme.card.showColorDots || !hasColors(product)) return null;
    const variants = getVariants(product).filter(v => v.hex);
    if (variants.length === 0) return null;
    const maxDots = 5;
    const visible = variants.slice(0, maxDots);
    const extra = variants.length - visible.length;
    return (
      <div className={className}>
        {visible.map((v, i) => (
          <span key={v.id || i} className="w-[5px] h-[5px] md:w-1.5 md:h-1.5 rounded-full border border-black/10" style={{ backgroundColor: v.hex }} />
        ))}
        {extra > 0 && <span className="text-[10px] text-[var(--lava-muted)] ms-0.5">+{extra}</span>}
      </div>
    );
  };

  // ===== بادج "كمية محدودة" على صورة الكارت (مستخدم في الكروت التلاتة) =====
  const LowStockBadge = ({ product, stockStatus, className = 'absolute top-2 start-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded' }) => {
    if (!theme.card.showLowStockBadge || stockStatus !== 'low') return null;
    return <span className={className}>{t('كمية محدودة', 'Low Stock')}</span>;
  };

  const SectionProductCard = ({ product }) => {
    const stockStatus = getProductStockStatus(product);
    return (
      <div
        className={`cursor-pointer group overflow-hidden ${theme.card.radius} ${theme.card.shadow} transition-all duration-300 ${theme.card.hoverEffect === 'scale' ? 'hover:scale-105' : theme.card.hoverEffect === 'lift' ? 'hover:-translate-y-1 hover:shadow-xl' : theme.card.hoverEffect === 'glow' ? 'hover:shadow-lg' : ''}`}
        style={{ backgroundColor: theme.colors.cardBg }}
        onClick={() => openProductDetails(product)}
      >
        <div className={`overflow-hidden relative ${theme.card.imageHeight ? theme.card.imageHeight.replace('h-48', 'h-36').replace('md:h-80', 'md:h-64') : 'h-36 md:h-64'}`}
          style={{ backgroundColor: theme.colors.secondary }}>
          <img loading="lazy" src={product.images?.[0]} alt={getLocalized(product.name)} className={`w-full h-full object-cover transition-opacity duration-500 ${product.images?.[1] && stockStatus !== 'out' ? 'absolute inset-0 group-hover:opacity-0' : 'group-hover:scale-105 transition-transform'} ${stockStatus === 'out' ? 'opacity-50 grayscale' : ''}`} />
          {product.images?.[1] && stockStatus !== 'out' && (
            <img loading="lazy" src={product.images[1]} alt={getLocalized(product.name)} className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          )}
          {stockStatus === 'out' && <span className="absolute top-2 start-2 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded">{t('غير متوفر', 'Out of Stock')}</span>}
          <LowStockBadge product={product} stockStatus={stockStatus} />
          <DiscountBadge product={product} />
          {theme.card.showQuickAdd && stockStatus !== 'out' && (
            <button
              onClick={(e) => handleQuickAdd(e, product)}
              style={{ backgroundColor: theme.card.quickAddBg || '#000000', color: theme.card.quickAddText || '#ffffff' }}
              className="absolute bottom-0 inset-x-0 z-10 text-[11px] md:text-xs font-bold tracking-widest py-2.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300"
            >
              {t('إضافة سريعة', 'QUICK ADD')}
            </button>
          )}
        </div>
        <div className={`${theme.card.padding || 'p-3 md:p-4'} ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          <h3 className="font-bold text-sm md:text-base mb-1 line-clamp-2" style={{ color: theme.colors.secondaryFg }}>{getLocalized(product.name)}</h3>
          {product.onSale && isSaleActive() ? (
            <p className="font-semibold text-xs md:text-sm">
              <span className="line-through text-[var(--lava-muted)] me-1">{product.price} {t('ج.م', 'EGP')}</span>
              <span style={{ color: theme.colors.accent }}>{product.salePrice} {t('ج.م', 'EGP')}</span>
            </p>
          ) : product.permanentSalePrice ? (
            <p className="font-semibold text-xs md:text-sm">
              <span className="line-through text-[var(--lava-muted)] me-1">{product.price} {t('ج.م', 'EGP')}</span>
              <span style={{ color: theme.colors.accent }}>{product.permanentSalePrice} {t('ج.م', 'EGP')}</span>
            </p>
          ) : (
            <p className="font-semibold text-xs md:text-sm" style={{ color: theme.colors.secondaryFg }}>{product.price} {t('ج.م', 'EGP')}</p>
          )}
          <ColorDots product={product} />
        </div>
      </div>
    );
  };

  // ===== مكون عرض مجموعة منتجات بالستايل المختار =====
  const ProductsGrid = ({ prods, displayStyle }) => {
    const [carouselIdx, setCarouselIdx] = useState(0);
    const style = displayStyle || 'grid';
    if (!prods || prods.length === 0) return <p className="text-center text-[var(--lava-muted)] py-8">{t('لا توجد منتجات', 'No products')}</p>;

    if (style === 'grid') {
      return (
        <div className={`grid ${theme.card.homeColsMobile || theme.card.colsMobile || 'grid-cols-2'} ${theme.card.homeColsDesktop || theme.card.colsDesktop || 'md:grid-cols-4'} ${theme.card.homeGapMobile || theme.card.gapMobile || 'gap-3'} ${theme.card.homeGapDesktop || theme.card.gapDesktop || 'md:gap-6'}`}>
          {prods.map(p => <SectionProductCard key={p.id} product={p} />)}
        </div>
      );
    }
    if (style === 'masonry') {
      return (
        <div className="columns-2 md:columns-4 gap-3 space-y-3">
          {prods.map((p) => (
            <div key={p.id} className="break-inside-avoid mb-3">
              <SectionProductCard product={p} />
            </div>
          ))}
        </div>
      );
    }
    if (style === 'list') {
      return (
        <div className="flex flex-col gap-4">
          {prods.map(p => {
            const stockStatus = getProductStockStatus(p);
            return (
              <div key={p.id} className={`flex gap-4 cursor-pointer group overflow-hidden ${theme.card.radius} ${theme.card.shadow} transition-all`}
                style={{ backgroundColor: theme.colors.cardBg }} onClick={() => openProductDetails(p)}>
                <div className="w-28 h-28 flex-shrink-0 overflow-hidden" style={{ backgroundColor: theme.colors.secondary }}>
                  <img loading="lazy" src={p.images?.[0]} alt={getLocalized(p.name)} className={`w-full h-full object-cover group-hover:scale-105 transition duration-300 ${stockStatus === 'out' ? 'opacity-50 grayscale' : ''}`} />
                </div>
                <div className={`flex-1 py-3 pe-4 flex flex-col justify-center ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  <h3 className="font-bold text-sm md:text-base mb-1" style={{ color: theme.colors.secondaryFg }}>{getLocalized(p.name)}</h3>
                  {p.onSale && isSaleActive() ? (
                    <p className="font-semibold text-xs md:text-sm">
                      <span className="line-through text-[var(--lava-muted)] me-1">{p.price} {t('ج.م', 'EGP')}</span>
                      <span style={{ color: theme.colors.accent }}>{p.salePrice} {t('ج.م', 'EGP')}</span>
                    </p>
                  ) : p.permanentSalePrice ? (
                    <p className="font-semibold text-xs md:text-sm">
                      <span className="line-through text-[var(--lava-muted)] me-1">{p.price} {t('ج.م', 'EGP')}</span>
                      <span style={{ color: theme.colors.accent }}>{p.permanentSalePrice} {t('ج.م', 'EGP')}</span>
                    </p>
                  ) : (
                    <p className="font-semibold text-xs md:text-sm" style={{ color: theme.colors.secondaryFg }}>{p.price} {t('ج.م', 'EGP')}</p>
                  )}
                  {stockStatus === 'out' && <span className="text-xs text-[var(--lava-muted)] mt-1">{t('غير متوفر', 'Out of Stock')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    if (style === 'carousel') {
      const visible = 2;
      const maxIdx = Math.max(0, prods.length - visible);
      const touchRef = React.useRef(null);
      const touchStartX = React.useRef(null);
      const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
      const handleTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) {
          if (language === 'ar') {
            setCarouselIdx(i => diff > 0 ? Math.max(0, i - 1) : Math.min(maxIdx, i + 1));
          } else {
            setCarouselIdx(i => diff > 0 ? Math.min(maxIdx, i + 1) : Math.max(0, i - 1));
          }
        }
        touchStartX.current = null;
      };
      return (
        <div className="relative group/carousel">
          <div className="overflow-hidden" ref={touchRef}
            onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div className="flex gap-3 md:gap-4 transition-transform duration-300"
              style={{ transform: `translateX(${language === 'ar' ? carouselIdx * 50 : -carouselIdx * 50}%)` }}>
              {prods.map(p => (
                <div key={p.id} className="flex-shrink-0" style={{ width: `calc(50% - 6px)` }}>
                  <SectionProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
          {/* أسهم: تظهر فقط في الكمبيوتر */}
          {prods.length > visible && (
            <>
              <button
                onClick={() => setCarouselIdx(i => language === 'ar' ? Math.min(maxIdx, i + 1) : Math.max(0, i - 1))}
                disabled={language === 'ar' ? carouselIdx >= maxIdx : carouselIdx === 0}
                className="hidden md:flex absolute top-1/2 -translate-y-1/2 -start-5 w-10 h-10 rounded-full items-center justify-center shadow-lg disabled:opacity-20 transition opacity-0 group-hover/carousel:opacity-100 z-10"
                style={{ backgroundColor: theme.colors.primary, color: theme.colors.primaryFg }}>‹</button>
              <button
                onClick={() => setCarouselIdx(i => language === 'ar' ? Math.max(0, i - 1) : Math.min(maxIdx, i + 1))}
                disabled={language === 'ar' ? carouselIdx === 0 : carouselIdx >= maxIdx}
                className="hidden md:flex absolute top-1/2 -translate-y-1/2 -end-5 w-10 h-10 rounded-full items-center justify-center shadow-lg disabled:opacity-20 transition opacity-0 group-hover/carousel:opacity-100 z-10"
                style={{ backgroundColor: theme.colors.primary, color: theme.colors.primaryFg }}>›</button>
              {/* نقاط: تظهر في الموبايل والتابلت بدل الأسهم */}
              <div className="flex md:hidden justify-center gap-1.5 mt-3">
                {Array.from({ length: maxIdx + 1 }).map((_, i) => (
                  <button key={i} onClick={() => setCarouselIdx(i)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{ backgroundColor: carouselIdx === i ? theme.colors.primary : theme.colors.secondary }} />
                ))}
              </div>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  // ===== حساب أكثر المنتجات مبيعاً =====
  const getBestSellingProducts = useCallback((limit = 10) => {
    const salesCount = {};
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const pid = String(item.productId || item.id);
        salesCount[pid] = (salesCount[pid] || 0) + (item.quantity || 1);
      });
    });
    const visible = products.filter(p => isProductVisibleToCustomer(p));
    return visible
      .map(p => ({ ...p, _soldCount: salesCount[String(p.id)] || 0 }))
      .sort((a, b) => b._soldCount - a._soldCount)
      .slice(0, limit);
  }, [orders, products]);

  // دالة مشتركة لعرض أقسام (صورة/نص/زرار/منتجات) - تُستخدم في الصفحة الرئيسية وفي أي صفحة مخصصة
  const renderSectionsList = (sectionsList) => sectionsList.map((section) => (
    <div key={section.id} className="w-full relative group/sec">
      {/* زرار تعديل inline للأدمن فقط */}
      {user && user.role === 'admin' && (
        <button
          onClick={() => openEditSection(section)}
          className="absolute top-2 end-2 z-20 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg opacity-0 group-hover/sec:opacity-100 transition-opacity flex items-center gap-1"
          title={t('تعديل القسم', 'Edit Section')}
        >
          ✏️ {t('تعديل', 'Edit')}
        </button>
      )}
      {section.type === 'image-text' && (
        <div className={`flex flex-col md:flex-row items-center gap-6 bg-[var(--lava-card)] rounded-lg shadow-md overflow-hidden ${language === 'ar' ? 'md:flex-row-reverse' : ''}`}>
          {section.image && (
            <div className="md:w-1/2 h-64 md:h-auto">
              <img loading="lazy" src={section.image} alt={getLocalized(section.title)} className="w-full h-full object-cover" />
            </div>
          )}
          <div className={`p-6 md:w-1/2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {section.title && <h3 className="text-2xl font-bold mb-2">{getLocalized(section.title)}</h3>}
            {section.description && <p className="text-[var(--lava-muted)] text-lg">{getLocalized(section.description)}</p>}
            {section.buttonAction && section.buttonAction !== 'none' && (
              <button onClick={() => handleSectionButtonClick(section.buttonAction)} className="mt-4 bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition">{getLocalized(section.buttonText) || t('تسوق الآن', 'Shop Now')}</button>
            )}
          </div>
        </div>
      )}
      {section.type === 'image-only' && (
        <div className="w-full rounded-lg overflow-hidden shadow-md">
          <img loading="lazy" src={section.image} alt={getLocalized(section.title) || t('قسم', 'Section')} className="w-full h-auto object-cover" />
          {section.buttonAction && section.buttonAction !== 'none' && (
            <div className="text-center mt-2">
              <button onClick={() => handleSectionButtonClick(section.buttonAction)} className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition">{getLocalized(section.buttonText) || t('تسوق الآن', 'Shop Now')}</button>
            </div>
          )}
        </div>
      )}
      {section.type === 'text-only' && (
        <div className="bg-[var(--lava-secondary)] p-8 rounded-lg text-center">
          {section.title && <h3 className="text-2xl font-bold mb-2">{getLocalized(section.title)}</h3>}
          {section.description && <p className="text-[var(--lava-muted)] text-lg">{getLocalized(section.description)}</p>}
          {section.buttonAction && section.buttonAction !== 'none' && (
            <button onClick={() => handleSectionButtonClick(section.buttonAction)} className="mt-4 bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition">{getLocalized(section.buttonText) || t('تسوق الآن', 'Shop Now')}</button>
          )}
        </div>
      )}

      {/* ===== أقسام المنتجات ===== */}
      {section.type === 'products-featured' && (() => {
        const prods = products.filter(p => isProductVisibleToCustomer(p) && p.isFeatured).slice(0, section.productCount || 8);
        if (productsLoading) return (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: theme.colors.secondaryFg }}>
              {getLocalized(section.title) || t('منتجات مميزة', 'Featured Products')}
            </h2>
            <div className={`grid ${theme.card.homeColsMobile || theme.card.colsMobile || 'grid-cols-2'} ${theme.card.homeColsDesktop || theme.card.colsDesktop || 'md:grid-cols-4'} ${theme.card.homeGapMobile || theme.card.gapMobile || 'gap-3'} ${theme.card.homeGapDesktop || theme.card.gapDesktop || 'md:gap-6'}`}>
              {[1,2,3,4].map(i => <div key={i} className="rounded-lg bg-[var(--lava-secondary)] animate-pulse" style={{ height: 220 }} />)}
            </div>
          </div>
        );
        if (prods.length === 0) return null;
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: theme.colors.secondaryFg }}>
              {getLocalized(section.title) || t('منتجات مميزة', 'Featured Products')}
            </h2>
            {section.description && getLocalized(section.description) && (
              <p className="text-center text-[var(--lava-muted)] mb-6">{getLocalized(section.description)}</p>
            )}
            <ProductsGrid prods={prods} displayStyle={section.displayStyle} />
          </div>
        );
      })()}

      {section.type === 'products-bestsellers' && (() => {
        const prods = getBestSellingProducts(section.productCount || 8);
        if (productsLoading) return (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: theme.colors.secondaryFg }}>
              {getLocalized(section.title) || t('الأكثر مبيعاً', 'Best Sellers')}
            </h2>
            <div className={`grid ${theme.card.homeColsMobile || theme.card.colsMobile || 'grid-cols-2'} ${theme.card.homeColsDesktop || theme.card.colsDesktop || 'md:grid-cols-4'} ${theme.card.homeGapMobile || theme.card.gapMobile || 'gap-3'} ${theme.card.homeGapDesktop || theme.card.gapDesktop || 'md:gap-6'}`}>
              {[1,2,3,4].map(i => <div key={i} className="rounded-lg bg-[var(--lava-secondary)] animate-pulse" style={{ height: 220 }} />)}
            </div>
          </div>
        );
        if (prods.length === 0) return null;
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: theme.colors.secondaryFg }}>
              {getLocalized(section.title) || t('الأكثر مبيعاً', 'Best Sellers')}
            </h2>
            {section.description && getLocalized(section.description) && (
              <p className="text-center text-[var(--lava-muted)] mb-6">{getLocalized(section.description)}</p>
            )}
            <ProductsGrid prods={prods} displayStyle={section.displayStyle} />
          </div>
        );
      })()}

      {section.type === 'products-all' && (() => {
        const prods = products.filter(p => isProductVisibleToCustomer(p)).slice(0, section.productCount || 8);
        if (productsLoading) return (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: theme.colors.secondaryFg }}>
              {getLocalized(section.title) || t('جميع المنتجات', 'All Products')}
            </h2>
            <div className={`grid ${theme.card.homeColsMobile || theme.card.colsMobile || 'grid-cols-2'} ${theme.card.homeColsDesktop || theme.card.colsDesktop || 'md:grid-cols-4'} ${theme.card.homeGapMobile || theme.card.gapMobile || 'gap-3'} ${theme.card.homeGapDesktop || theme.card.gapDesktop || 'md:gap-6'}`}>
              {[1,2,3,4].map(i => <div key={i} className="rounded-lg bg-[var(--lava-secondary)] animate-pulse" style={{ height: 220 }} />)}
            </div>
          </div>
        );
        if (prods.length === 0) return null;
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: theme.colors.secondaryFg }}>
              {getLocalized(section.title) || t('جميع المنتجات', 'All Products')}
            </h2>
            {section.description && getLocalized(section.description) && (
              <p className="text-center text-[var(--lava-muted)] mb-6">{getLocalized(section.description)}</p>
            )}
            <ProductsGrid prods={prods} displayStyle={section.displayStyle} />
          </div>
        );
      })()}

      {section.type === 'products-custom' && (() => {
        const ids = (section.productIds || []).map(String);
        const prods = ids.map(id => products.find(p => String(p.id) === id)).filter(Boolean).filter(p => isProductVisibleToCustomer(p));
        if (productsLoading) return (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: theme.colors.secondaryFg }}>
              {getLocalized(section.title) || t('منتجات مختارة', 'Selected Products')}
            </h2>
            <div className={`grid ${theme.card.homeColsMobile || theme.card.colsMobile || 'grid-cols-2'} ${theme.card.homeColsDesktop || theme.card.colsDesktop || 'md:grid-cols-4'} ${theme.card.homeGapMobile || theme.card.gapMobile || 'gap-3'} ${theme.card.homeGapDesktop || theme.card.gapDesktop || 'md:gap-6'}`}>
              {[1,2,3,4].map(i => <div key={i} className="rounded-lg bg-[var(--lava-secondary)] animate-pulse" style={{ height: 220 }} />)}
            </div>
          </div>
        );
        if (prods.length === 0) return null;
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: theme.colors.secondaryFg }}>
              {getLocalized(section.title) || t('منتجات مختارة', 'Selected Products')}
            </h2>
            {section.description && getLocalized(section.description) && (
              <p className="text-center text-[var(--lava-muted)] mb-6">{getLocalized(section.description)}</p>
            )}
            <ProductsGrid prods={prods} displayStyle={section.displayStyle} />
          </div>
        );
      })()}

      {/* ===== قسم: منتجات قسم معين ===== */}
      {section.type === 'products-category' && (() => {
        const cat = categories.find(c => String(c.id) === String(section.categoryId));
        const catName = cat ? getLocalized(cat.name) : (getLocalized(section.title) || '');
        const prods = products
          .filter(p => isProductVisibleToCustomer(p) && p.category && (
            getLocalized(p.category) === getLocalized(cat?.name) ||
            String(p.categoryId) === String(section.categoryId) ||
            (cat && (p.category === cat.id || p.category === getLocalized(cat.name) || getLocalized(p.category) === getLocalized(cat.name)))
          ))
          .slice(0, section.productCount || 8);
        if (productsLoading) return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold" style={{ color: theme.colors.secondaryFg }}>
                {getLocalized(section.title) || catName}
              </h2>
            </div>
            <div className={`grid ${theme.card.homeColsMobile || theme.card.colsMobile || 'grid-cols-2'} ${theme.card.homeColsDesktop || theme.card.colsDesktop || 'md:grid-cols-4'} ${theme.card.homeGapMobile || theme.card.gapMobile || 'gap-3'} ${theme.card.homeGapDesktop || theme.card.gapDesktop || 'md:gap-6'}`}>
              {[1,2,3,4].map(i => <div key={i} className="rounded-lg bg-[var(--lava-secondary)] animate-pulse" style={{ height: 220 }} />)}
            </div>
          </div>
        );
        if (prods.length === 0) return null;
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold" style={{ color: theme.colors.secondaryFg }}>
                {getLocalized(section.title) || catName}
              </h2>
              {cat && (
                <button onClick={() => { setSelectedCategoryFilter(getLocalized(cat.name)); goTo('shop'); }}
                  className="text-sm font-semibold underline opacity-60 hover:opacity-100 transition"
                  style={{ color: theme.colors.primary }}>
                  {t('عرض الكل', 'View All')}
                </button>
              )}
            </div>
            {section.description && getLocalized(section.description) && (
              <p className="text-[var(--lava-muted)] mb-6">{getLocalized(section.description)}</p>
            )}
            <ProductsGrid prods={prods} displayStyle={section.displayStyle} />
          </div>
        );
      })()}
    </div>
  ));

  // ===== إغلاق الموبايل مينو + التمرير لأعلى الصفحة عند أي تنقل =====
  // اكتشفت بالاختبار الفعلي إن window.scrollTo(0,0) لوحده مش كافي: لو الصفحة
  // عندها عنصر تاني (زي #root أو أي div) هو اللي بيعمل السكرول فعلياً (بسبب
  // CSS مثلاً overflow-y:auto مع ارتفاع ثابت)، فـ window.scrollTo ميعملش أي حاجة
  // خالص، والمتصفح بيكتفي إنه "يقصّ" وضع السكرول القديم على أقصى ارتفاع للصفحة
  // الجديدة - وده اللي بيوديك في آخر الصفحة بالظبط زي ما بيحصل معاك. فعشان كده
  // بنصفّر كل حاوية ممكن تكون هي اللي بتعمل سكرول، مش بس الـ window.
  useLayoutEffect(() => {
    setIsMobileMenuOpen(false);

    const resetAllScrollContainers = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      // أي عنصر تاني في الصفحة عنده سكرول فعلي (زي حاوية رئيسية بـ overflow-y-auto)
      document.querySelectorAll('*').forEach((el) => {
        if (el.scrollTop > 0) el.scrollTop = 0;
      });
    };

    resetAllScrollContainers();
    // إعادة التأكيد بعد أول فريم رسم، عشان لو أي صورة استغرقت وقت تحمل
    // وغيّرت ارتفاع الصفحة بعد أول تصفير مباشرة.
    requestAnimationFrame(resetAllScrollContainers);
  }, [navKey]);

  // تأمين إضافي: تعطيل "scroll anchoring" في المتصفح، وهي خاصية بتخلي
  // المتصفح يحرّك مكان السكرول تلقائياً لما محتوى فوق منطقة الرؤية يتغيّر
  // حجمه (زي الصور اللي بتتحمل بعد التمرير لفوق)، وده كان ممكن يسحب المستخدم
  // لمكان تاني غير أول الصفحة حتى بعد ما إحنا نعمل scrollTo(0,0).
  useEffect(() => {
    document.documentElement.style.overflowAnchor = 'none';
    document.body.style.overflowAnchor = 'none';
  }, []);

  // ===== دعم زرار Back/Forward في المتصفح =====
  useEffect(() => {
    const onPop = (e) => {
      const path = window.location.pathname;
      if (path === '/' || path === '') { setCurrentPage('home'); setNavKey(k => k + 1); }
      else if (path === '/shop') { setCurrentPage('shop'); setNavKey(k => k + 1); }
      else if (path === '/checkout') { setCurrentPage('checkout'); setNavKey(k => k + 1); }
      else if (path === '/checkout-details') { setCurrentPage('checkout-details'); setNavKey(k => k + 1); }
      else if (path === '/wishlist') { setCurrentPage('wishlist'); setNavKey(k => k + 1); }
      else if (path === '/contact') { setCurrentPage('contact'); setNavKey(k => k + 1); }
      else if (path === '/account') { setCurrentPage('account'); setNavKey(k => k + 1); }
      else if (path === '/my-orders') { setCurrentPage('my-orders'); setNavKey(k => k + 1); }
      else if (path === '/admin') { setCurrentPage('admin'); setNavKey(k => k + 1); }
      else if (path.startsWith('/product/')) { setCurrentPage('product-details'); setNavKey(k => k + 1); }
      else if (path.startsWith('/page/')) { setCurrentPage('custom-page'); setNavKey(k => k + 1); }
      else { setCurrentPage('not-found'); setNavKey(k => k + 1); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ===== حفظ السلة والمنتج المختار في localStorage =====
  useEffect(() => {
    try { localStorage.setItem('lava_cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  // ===== مزامنة السلة مع الداتا بيز لو العميل مسجل دخول =====
  // عشان لو قفل المتصفح ودخل من جهاز تاني يلاقي نفس السلة، ولو مسحها من جهاز
  // تتمسح معاه من كل مكان (مش بس localStorage اللي بتفضل في نفس الجهاز بس).
  useEffect(() => {
    if (!user) return;
    authAPI.updateCart(cart).catch(() => {});
  }, [cart, user]);

  // ===== حفظ المفضلة (Wishlist) في localStorage — دايماً، حتى لو العميل مسجل دخول =====
  // ده بيضمن إنها متتشلش لو حصل ريفريش قبل ما يخلص طلب المزامنة مع السيرفر
  useEffect(() => {
    try { localStorage.setItem('lava_wishlist', JSON.stringify(wishlist)); } catch {}
  }, [wishlist]);

  // ===== تتبع السلة المتروكة: يبدأ من لحظة وجود منتجات في السلة، وليس فقط عند Checkout =====
  useEffect(() => {
    if (cart.length === 0) {
      // لو السلة فضيت بسبب إتمام طلب بنجاح (مش لأن العميل مسح السلة بنفسه)،
      // متبعتش طلب "امسح السجل" — سيب markRecovered() تعمل شغلها وتفضل
      // السجل موجود (متعافي) عشان يتحسب صح في الإحصائيات.
      if (orderJustCompletedRef.current) {
        orderJustCompletedRef.current = false;
        return;
      }
      abandonedCartAPI.upsert({ sessionId: sessionIdRef.current, items: [] });
      return;
    }
    if (currentPage === 'checkout' || currentPage === 'checkout-details') {
      trafficAPI.trackFunnel(visitorIdRef.current, sessionIdRef.current, 'checkout');
      refreshActivity();
    }
    const timer = setTimeout(() => {
      // لا نرسل بيانات اتصال إلا للعميل المسجل، لأن طلبك يعتمد على وجود Email معروف.
      if (!user?.email) return;
      abandonedCartAPI.upsert({
        sessionId: sessionIdRef.current,
        customerId: user?.id || null,
        customerPhone: user?.phone || null,
        customerEmail: user?.email || null,
        items: cart.map(item => ({ productId:item.id, name:item.name, variantId:item.variantId, size:item.size, price:item.price, quantity:1, image:item.images?.[0] || '' })),
        subtotal: cart.reduce((s, i) => s + Number(i.price || 0), 0),
        governorate: selectedGov || null,
      });
    }, 1200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, cart.length, user?.email]);

  useEffect(() => {
    try {
      if (selectedProduct) localStorage.setItem('lava_selected_product', JSON.stringify(selectedProduct));
      else localStorage.removeItem('lava_selected_product');
    } catch {}
  }, [selectedProduct]);

  // ===== تأثير fade-in عند التمرير =====
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    const observeEl = (el) => {
      if (el && el.classList && !el.classList.contains('visible')) observer.observe(el);
    };

    document.querySelectorAll('.fade-in').forEach(observeEl);

    // ===== عناصر fade-in بتتضاف للصفحة بعد اللحظة دي (زي أقسام بتظهر بعد ما تجيب
    // بيانات المنتجات/الإعدادات من السيرفر) لازم يتم رصدها هي كمان، مش بس اللي كانت
    // موجودة وقت أول تشغيل للـ effect - عشان كده بنستخدم MutationObserver هنا =====
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('fade-in')) observeEl(node);
          if (node.querySelectorAll) node.querySelectorAll('.fade-in').forEach(observeEl);
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [currentPage]);

  // ===== إغلاق الموبايل مينو عند النقر في أي مكان آخر =====
  useEffect(() => {
    const handleClickOutside = (event) => {
      const nav = document.querySelector('nav');
      const menu = document.querySelector('.mobile-menu');
      if (isMobileMenuOpen && nav && !nav.contains(event.target) && menu && !menu.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMobileMenuOpen]);

  // ===== إغلاق قائمة الحساب عند الضغط في أي مكان تاني بالصفحة =====
  useEffect(() => {
    const handleClickOutsideAccount = (event) => {
      const menu = document.querySelector('.account-menu');
      if (showAccountMenu && menu && !menu.contains(event.target)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutsideAccount);
    return () => document.removeEventListener('click', handleClickOutsideAccount);
  }, [showAccountMenu]);

  // ===== إغلاق قائمة اقتراحات البحث عند النقر خارجها =====
  useEffect(() => {
    const handleClickOutsideSearch = (event) => {
      const searchBox = document.getElementById('searchQuery');
      if (showSearchDropdown && searchBox && !searchBox.parentElement.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutsideSearch);
    return () => document.removeEventListener('click', handleClickOutsideSearch);
  }, [showSearchDropdown]);

  // ===== التحكم في إظهار/إخفاء الهيدر بناءً على اتجاه السكرول =====
  const [isBarVisible, setIsBarVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    const TOP_BUFFER = 60;
    const MIN_DELTA = 4;

    const updateHeader = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= TOP_BUFFER) {
        setIsBarVisible(true);
      } else if (delta > MIN_DELTA) {
        setIsBarVisible(false);
        setIsMobileMenuOpen(false);
      } else if (delta < -MIN_DELTA) {
        setIsBarVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
      tickingRef.current = false;
    };

    const handleScroll = () => {
      if (!tickingRef.current) {
        tickingRef.current = true;
        window.requestAnimationFrame(updateHeader);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ===== ظهور بوب أب عرض الترحيب عند تفعيل الإعداد أو عند أول دخول للموقع =====
  // ملحوظة: adminSettings هو useRef (مش reactive)، فعشان الـ effect يشتغل لما
  // الأدمن يحفظ إعداد "تفعيل عرض الترحيب"، لازم نقرأ القيمة من الـ ref جوه الـ effect
  // ونحط settingsVersion (اللي بيزيد مع كل bumpSettings) في dependency array.
  const isGuestWelcomeEligible = !user || user.role === 'customer';
  useEffect(() => {
    const welcomeOfferEnabled = adminSettings.current.promotions?.welcomeOffer?.enabled;
    if (!welcomeOfferEnabled || !isGuestWelcomeEligible) {
      setWelcomeOfferVisible(false);
      // مهم: مش بنعمل setWelcomeOfferClosed(true) هنا لما العرض متوقف، عشان لو الأدمن
      // شغّله تاني، الزبون يشوفه من غير ما يحتاج يعمل refresh.
      return;
    }
    if (welcomeOfferClosed) return;

    const timer = window.setTimeout(() => setWelcomeOfferVisible(true), 500);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeOfferClosed, user, isGuestWelcomeEligible, settingsVersion]);

  // ============================================================
  // دوال تسجيل الدخول والخروج
  // ============================================================
  const applyLoggedInUser = useCallback((loggedInUser) => {
    setUser({
      // ===== FIX: id (رقم العميل) ماكانش بيتحفظ هنا خالص! فكانت السلات
      // المتروكة (وأي حاجة تانية بتحتاج تعرف "مين هو العميل ده" برقمه)
      // بتبعت customerId = null دايمًا حتى لو العميل مسجل دخول فعلاً —
      // وده اللي كان بيخلي كل سلة متروكة لعميل مسجل تتحسب "زائر" (Guest)
      // في شاشة الأدمن، رغم إن الإيميل والتليفون بتوعه بيتسجلوا صح (لأنهم
      // بيتاخدوا من user.email/user.phone مش من الـid).
      id: loggedInUser.id,
      name: loggedInUser.name,
      email: loggedInUser.email,
      phone: loggedInUser.phone || '',
      role: loggedInUser.role,
      address: loggedInUser.role === 'admin'
        ? t('الإدارة العامة', 'General Management')
        : (loggedInUser.role !== 'customer' ? t('مقر العمل', 'Work Location') : ''),
      savedShipping: loggedInUser.savedShipping || null,
      // ===== [RBAC FIX] كانت الصلاحيات (permissions) مش بتتحفظ هنا خالص، فـ canAccess()
      // كان دايمًا بيرجع false لأي موظف role:'staff' (حتى لو الأدمن دّاله صلاحيات فعلية
      // في الداتابيز) - عشان كده كل الأقسام كانت بتختفي من عنده إلا "الطلبات" اللي كانت
      // معمولة alwaysVisible في القائمة الجانبية. لازم نحفظها هنا زي ما هي راجعة من السيرفر. =====
      permissions: Array.isArray(loggedInUser.permissions) ? loggedInUser.permissions : [],
    });
    setHasSavedShipping(!!loggedInUser.savedShipping);
    if (loggedInUser.role === 'customer') {
      const discountUsed = loggedInUser.firstOrderDiscountUsed || false;
      setFirstOrderDiscountEligible(!discountUsed);
      setFirstOrderDiscountUsed(discountUsed);
    }
    // ===== دمج/استرجاع المفضلة المحفوظة في حساب المستخدم من الداتا بيز (لأي دور، مش بس العميل) =====
    syncWishlistFromServer(loggedInUser.wishlist);
    // ===== دمج/استرجاع سلة التسوق المحفوظة في حساب المستخدم من الداتا بيز =====
    syncCartFromServer(loggedInUser.cart);
    setShowLoginModal(false);
    setIsRegistering(false);
    setOtpStep('email');
    setOtpCode('');
    setLoginEmail('');
    setLoginPassword('');
    setLoginPhone('');
    setWelcomeOfferClosed(true);
    setWelcomeOfferVisible(false);

    if (loggedInUser.role === 'admin') {
      goTo('admin');
      showToast(t('مرحباً بك يا أدمن في لوحة التحكم الكاملة!', 'Welcome Admin to the full dashboard!'));
    } else if (loggedInUser.role === 'call_center' || loggedInUser.role === 'packer') {
      goTo('admin');
      setAdminTab('orders');
      showToast(t(`مرحباً بك يا ${loggedInUser.name}`, `Welcome ${loggedInUser.name}`));
    } else {
      showToast(t('تم تسجيل الدخول بنجاح!', 'Logged in successfully!'));
    }
  }, [goTo, showToast, t, syncWishlistFromServer, syncCartFromServer]);

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    try {
      const { user: loggedInUser } = await authAPI.login(loginEmail, loginPassword);
      applyLoggedInUser(loggedInUser);
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || t('بيانات الدخول غير صحيحة.', 'Invalid login credentials.'));
    }
  }, [loginEmail, loginPassword, applyLoggedInUser, showToast, t]);

  const startOtpCooldown = useCallback((seconds = 60) => {
    if (otpCooldownRef.current) window.clearInterval(otpCooldownRef.current);
    setOtpCooldown(seconds);
    otpCooldownRef.current = window.setInterval(() => {
      setOtpCooldown((value) => {
        if (value <= 1) {
          window.clearInterval(otpCooldownRef.current);
          otpCooldownRef.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => {
    if (otpCooldownRef.current) window.clearInterval(otpCooldownRef.current);
  }, []);

  const handleSendOtp = useCallback(async (e) => {
    e?.preventDefault?.();
    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      showToast(t('اكتب البريد الإلكتروني أولاً.', 'Enter your email first.'));
      return;
    }
    if (otpCooldown > 0 || otpSending) return;
    setOtpSending(true);
    try {
      const result = await authAPI.sendCode(email);
      setOtpStep('code');
      setOtpCode('');
      startOtpCooldown(Number(result?.retryAfterSeconds) || 60);
      showToast(t('تم إرسال الكود إلى بريدك الإلكتروني.', 'The verification code was sent to your email.'));
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || t('تعذر إرسال الكود.', 'Could not send the code.'));
    } finally {
      setOtpSending(false);
    }
  }, [loginEmail, otpCooldown, otpSending, startOtpCooldown, showToast, t]);

  // خطوة واحدة موحدة: نبعت الإيميل بس، والباك اند يقول لنا هل ده حساب إدارة (باسورد)
  // أو عميل (باسورد أو كود حسب إعدادات المتجر). مفيش تبويب "عميل/إدارة" تاني.
  const handleCheckEmail = useCallback(async (e) => {
    e?.preventDefault?.();
    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      showToast(t('اكتب البريد الإلكتروني أولاً.', 'Enter your email first.'));
      return;
    }
    setCheckingEmail(true);
    try {
      const result = await authAPI.checkEmail(email);
      if (result?.method === 'code') {
        await handleSendOtp();
      } else {
        setOtpStep('password');
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || t('تعذر التحقق من البريد الإلكتروني.', 'Could not verify the email.'));
    } finally {
      setCheckingEmail(false);
    }
  }, [loginEmail, handleSendOtp, showToast, t]);

  const handleVerifyOtp = useCallback(async (e) => {
    e?.preventDefault?.();
    const email = loginEmail.trim().toLowerCase();
    const code = otpCode.trim();
    if (!email || !/^\d{6}$/.test(code)) {
      showToast(t('اكتب الكود المكون من 6 أرقام.', 'Enter the 6-digit code.'));
      return;
    }
    setOtpVerifying(true);
    try {
      const { user: loggedInUser } = await authAPI.verifyCode(email, code, loginMarketingConsent);
      applyLoggedInUser(loggedInUser);
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || t('الكود غير صحيح.', 'Invalid verification code.'));
    } finally {
      setOtpVerifying(false);
    }
  }, [loginEmail, otpCode, loginMarketingConsent, applyLoggedInUser, showToast, t]);

  const startForgotPasswordCooldown = useCallback((seconds = 60) => {
    if (forgotPasswordCooldownRef.current) window.clearInterval(forgotPasswordCooldownRef.current);
    setForgotPasswordCooldown(seconds);
    forgotPasswordCooldownRef.current = window.setInterval(() => {
      setForgotPasswordCooldown((value) => {
        if (value <= 1) {
          window.clearInterval(forgotPasswordCooldownRef.current);
          forgotPasswordCooldownRef.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => {
    if (forgotPasswordCooldownRef.current) window.clearInterval(forgotPasswordCooldownRef.current);
  }, []);  // بيبعت كود إعادة تعيين كلمة المرور على نفس الإيميل اللي المستخدم كاتبه في خطوة الباسورد
  const handleForgotPassword = useCallback(async (e) => {
    e?.preventDefault?.();
    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      showToast(t('اكتب البريد الإلكتروني أولاً.', 'Enter your email first.'));
      return;
    }
    if (forgotPasswordCooldown > 0 || forgotPasswordSending) return;
    setForgotPasswordSending(true);
    try {
      const result = await authAPI.forgotPassword(email);
      setOtpStep('forgotCode');
      setResetCode('');
      setNewPassword('');
      startForgotPasswordCooldown(Number(result?.retryAfterSeconds) || 60);
      showToast(t('لو الإيميل ده مسجل عندنا، هيوصلك كود إعادة تعيين كلمة المرور.', "If this email is registered, you'll receive a password reset code."));
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || t('تعذر إرسال الكود.', 'Could not send the code.'));
    } finally {
      setForgotPasswordSending(false);
    }
  }, [loginEmail, forgotPasswordCooldown, forgotPasswordSending, startForgotPasswordCooldown, showToast, t]);

  // بيتحقق من الكود، يغيّر كلمة المرور، وبيسجّل دخول المستخدم فورًا (نفس مبدأ handleVerifyOtp)
  const handleResetPassword = useCallback(async (e) => {
    e?.preventDefault?.();
    const email = loginEmail.trim().toLowerCase();
    const code = resetCode.trim();
    if (!email || !/^\d{6}$/.test(code)) {
      showToast(t('اكتب الكود المكون من 6 أرقام.', 'Enter the 6-digit code.'));
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      showToast(t('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'Password must be at least 8 characters'));
      return;
    }
    setResettingPassword(true);
    try {
      const { user: loggedInUser } = await authAPI.resetPassword(email, code, newPassword);
      setResetCode('');
      setNewPassword('');
      applyLoggedInUser(loggedInUser);
      showToast(t('تم تغيير كلمة المرور وتسجيل الدخول بنجاح.', 'Password changed and logged in successfully.'));
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || t('تعذر إعادة تعيين كلمة المرور.', 'Could not reset the password.'));
    } finally {
      setResettingPassword(false);
    }
  }, [loginEmail, resetCode, newPassword, applyLoggedInUser, showToast, t]);

  const startAdminOtpCooldown = useCallback((seconds = 60) => {
    if (adminOtpCooldownRef.current) window.clearInterval(adminOtpCooldownRef.current);
    setAdminOtpCooldown(seconds);
    adminOtpCooldownRef.current = window.setInterval(() => {
      setAdminOtpCooldown((value) => {
        if (value <= 1) {
          window.clearInterval(adminOtpCooldownRef.current);
          adminOtpCooldownRef.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => {
    if (adminOtpCooldownRef.current) window.clearInterval(adminOtpCooldownRef.current);
  }, []);

  // بيبعت كود تأكيد على إيميل الأدمن الحالي (المسجل في الداتابيز)، مطلوب قبل حفظ
  // أي تعديل على إيميل/باسورد/هاتف الأدمن نفسه
  const handleSendAdminOtp = useCallback(async () => {
    if (adminOtpCooldown > 0 || adminOtpSending) return;
    setAdminOtpSending(true);
    try {
      const result = await authAPI.requestAdminConfigOtp();
      setAdminOtpSent(true);
      setAdminOtpCode('');
      setAdminOtpSentTo(result?.sentTo || '');
      startAdminOtpCooldown(Number(result?.retryAfterSeconds) || 60);
      showToast(t('تم إرسال كود التأكيد إلى إيميلك الحالي.', 'A confirmation code was sent to your current email.'));
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || t('تعذر إرسال كود التأكيد.', 'Could not send the confirmation code.'));
    } finally {
      setAdminOtpSending(false);
    }
  }, [adminOtpCooldown, adminOtpSending, startAdminOtpCooldown, showToast, t]);

  const handleRegister = useCallback(async (e) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPhone || !regPassword) {
      showToast(t('من فضلك املأ جميع بيانات التسجيل', 'Please fill in all registration fields'));
      return;
    }
    try {
      const { user: newUser } = await authAPI.register(regName, regEmail, regPhone, regPassword, regMarketingConsent);
      applyLoggedInUser(newUser);
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegPassword('');
      const regDiscountPercentage = adminSettings.current.promotions?.guestDiscount?.percentage || 5;
      showToast(t(`مبروك! تم إنشاء الحساب بنجاح وأصبح لديك خصم ${regDiscountPercentage}% على أول طلب لك.`, `Congratulations! You have a ${regDiscountPercentage}% discount on your first order.`));
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message;
      showToast(msg || t('حصل خطأ أثناء إنشاء الحساب', 'Something went wrong creating the account'));
    }
  }, [regName, regEmail, regPhone, regPassword, regMarketingConsent, applyLoggedInUser, adminSettings, showToast, t]);

  const handleLogout = useCallback(() => {
    setUser(null);
    // بيمسح كوكي الـ JWT من السيرفر (مقدرش أمسحها من الفرونت لأنها HttpOnly)
    authAPI.logout().catch(() => {});
    // ملحوظة: تسجيل الخروج مايلغيش أهلية خصم أول طلب - الأهلية والاستخدام حالتين مستقلتين عن حالة الدخول
    goTo('home');
    setLoginEmail('');
    setLoginPassword('');
    setLoginPhone('');
    setResetCode('');
    setNewPassword('');
    setOtpStep('email');
    showToast(t('تم تسجيل الخروج بنجاح.', 'Logged out successfully.'));
  }, [t]);

  // ===== الأدمن بيشوف كل المنتجات حتى المخفية (مش بس الظاهرة للزوار) =====
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    (async () => {
      try {
        const [list, adminSettingsData, authConfig] = await Promise.all([
          productsAPI.getAllAdmin(),
          settingsAPI.getAdmin(),
          authAPI.getAdminConfig(),
        ]);
        const safeAdminList = Array.isArray(list) ? list : [];
        setProducts(safeAdminList);
        if (authConfig) {
          setAdminAuthConfig({
            customerLoginMethod: authConfig.customerLoginMethod || 'email_password',
            resendFromEmail: authConfig.resendFromEmail || 'onboarding@resend.dev',
            otpEmailProvider: authConfig.otpEmailProvider === 'brevo' ? 'brevo' : 'resend',
            adminEmail: authConfig.admin?.email || '',
            adminPhone: authConfig.admin?.phone || '',
            adminPassword: '',
            resendConfigured: Boolean(authConfig.resendConfigured),
            brevoConfigured: Boolean(authConfig.brevoConfigured),
          });
          adminSettings.current.customerLoginMethod = authConfig.customerLoginMethod || 'email_password';
          adminSettings.current.resendFromEmail = authConfig.resendFromEmail || 'onboarding@resend.dev';
          bumpSettings();
        }
        // CRITICAL FIX: تمرير إعدادات الأدمن عبر normalizePromotionSettings
        // لأن قاعدة البيانات قد لا تحتوي على title/description/buttonText
        // الخاصة بـ welcomeOffer/guestDiscount مما يسبب شاشة بيضاء
        try {
          const bm = await (await import('./api/marketing')).marketingAPI.getSettings();
          setBrevoMarketing(bm.marketing || {});
          setBrevoConfigured(Boolean(bm.configured));
        } catch (e) { console.error('Brevo settings load:', e); }
        const normalizedAdminSettings = normalizePromotionSettings(adminSettingsData);
        Object.assign(adminSettings.current, normalizedAdminSettings);
        if (Array.isArray(normalizedAdminSettings.categories)) setCategories(normalizedAdminSettings.categories);
        if (Array.isArray(normalizedAdminSettings.governorates)) setGovernorates(normalizedAdminSettings.governorates);
        if (Array.isArray(normalizedAdminSettings.countries)) setCountries(normalizedAdminSettings.countries);
        if (Array.isArray(normalizedAdminSettings.homeSections)) setHomeSections(normalizedAdminSettings.homeSections);
        if (Array.isArray(normalizedAdminSettings.customPages)) setCustomPages(normalizedAdminSettings.customPages);
        // ===== تحميل البيانات المحلية من الداتا بيز (للأدمن) =====
        if (Array.isArray(normalizedAdminSettings.campaigns)) setPromotions(normalizedAdminSettings.campaigns);
        if (Array.isArray(normalizedAdminSettings.discountCodes)) setDiscountCodes(normalizedAdminSettings.discountCodes);
        if (normalizedAdminSettings.loyaltyProgram && typeof normalizedAdminSettings.loyaltyProgram === 'object') {
          setLoyaltyProgram(prev => ({ ...prev, ...normalizedAdminSettings.loyaltyProgram }));
        }
        if (Array.isArray(normalizedAdminSettings.expenses)) setExpenses(normalizedAdminSettings.expenses);
        if (Array.isArray(normalizedAdminSettings.contactMessages)) setContactMessages(normalizedAdminSettings.contactMessages);
        if (Array.isArray(normalizedAdminSettings.faqs)) setFaqs(normalizedAdminSettings.faqs);
        if (normalizedAdminSettings.productReviews && typeof normalizedAdminSettings.productReviews === 'object') setProductReviews(normalizedAdminSettings.productReviews);
        if (Array.isArray(normalizedAdminSettings.salesData)) setSalesData(normalizedAdminSettings.salesData);
        bumpSettings();
      } catch (err) {
        console.error('تعذّر تحميل كل المنتجات أو إعدادات الأدمن:', err);
      }
    })();
  }, [user, bumpSettings]);

  // ===== تحميل قايمة الموظفين وقايمة الأقسام المتاحة من السيرفر لما الأدمن يبقى مسجل دخول =====
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    (async () => {
      try {
        const list = await staffAPI.getAll();
        setStaffList(list);
      } catch (err) {
        console.error('تعذّر تحميل قايمة الموظفين:', err);
      }
      try {
        const sections = await staffAPI.getSections();
        setStaffSections(sections);
      } catch (err) {
        console.error('تعذّر تحميل قايمة أقسام الصلاحيات:', err);
      }
    })();
  }, [user]);

  // ===== تحميل صفحة من قايمة العملاء من السيرفر (باجينيشن حقيقية) =====
  const fetchCustomers = useCallback(async ({ silent } = {}) => {
    if (!silent) setCustomersLoading(true);
    try {
      const res = await customersAPI.getAll({ page: customersPage, limit: customersPageSize });
      const items = Array.isArray(res) ? res : (res?.items || []);
      setCustomersList(items);
      if (!Array.isArray(res)) {
        setCustomersTotal(res?.total || 0);
        setCustomersTotalPages(res?.totalPages || 1);
      }
    } catch (err) {
      console.error('تعذّر تحميل قايمة العملاء:', err);
    } finally {
      if (!silent) setCustomersLoading(false);
    }
  }, [customersPage, customersPageSize]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    fetchCustomers();
    // ===== ريفريش تلقائي كل 10 ثواني لنفس الصفحة الحالية =====
    const intervalId = setInterval(() => fetchCustomers({ silent: true }), 10000);
    return () => clearInterval(intervalId);
  }, [user, fetchCustomers]);

  useEffect(() => { setCustomersPage(1); }, [customersPageSize]);

  // ===== تحميل صفحة من السلات المتروكة للأدمن (باجينيشن حقيقية) =====
  const fetchAbandonedCarts = useCallback(async ({ silent } = {}) => {
    if (!silent) setAbandonedCartsLoading(true);
    try {
      const res = await abandonedCartAPI.getAll({ page: abandonedCartsPage, limit: abandonedCartsPageSize });
      const items = Array.isArray(res) ? res : (res?.items || []);
      setAbandonedCarts(items);
      if (!Array.isArray(res)) {
        setAbandonedCartsTotal(res?.total || 0);
        setAbandonedCartsTotalPages(res?.totalPages || 1);
        // ===== FIX: نجيب مدة الخمول الحالية من رد السيرفر ونعرضها في الحقل،
        // عشان الأدمن يشوف القيمة المضبوطة فعليًا (مش رقم افتراضي ثابت) ويقدر يغيّرها.
        if (res && Number(res.abandonedCartIdleMinutes) > 0) {
          setAbandonedCartIdleMinutes(Number(res.abandonedCartIdleMinutes));
          setAbandonedCartIdleMinutesInput(String(Number(res.abandonedCartIdleMinutes)));
        }
      }
    } catch (err) {
      console.error('تعذّر تحميل السلات المتروكة:', err);
    } finally {
      if (!silent) setAbandonedCartsLoading(false);
    }
  }, [abandonedCartsPage, abandonedCartsPageSize]);

  // ===== FIX: حفظ مدة الخمول الجديدة (بالدقايق) في الإعدادات، عشان الأدمن
  // يقدر يتحكم في الوقت اللي السلة تتحسب بعده "متروكة" بدل الرقم الثابت.
  const saveAbandonedCartIdleMinutes = useCallback(async () => {
    const val = Math.max(1, Math.round(Number(abandonedCartIdleMinutesInput) || 0));
    if (!val) { showToast(t('اكتب رقم دقايق صحيح', 'Enter a valid number of minutes')); return; }
    setSavingAbandonedCartIdleMinutes(true);
    try {
      await settingsAPI.update({ abandonedCartIdleMinutes: val });
      setAbandonedCartIdleMinutes(val);
      setAbandonedCartIdleMinutesInput(String(val));
      showToast(t('اتحفظ ✅', 'Saved ✅'));
      fetchAbandonedCarts();
    } catch (err) {
      console.error('تعذّر حفظ مدة الخمول:', err);
      showToast(t('حصل خطأ في الحفظ', 'Failed to save'));
    } finally {
      setSavingAbandonedCartIdleMinutes(false);
    }
  }, [abandonedCartIdleMinutesInput, fetchAbandonedCarts, showToast, t]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    fetchAbandonedCarts();
    const intervalId = setInterval(() => fetchAbandonedCarts({ silent: true }), 10000);
    return () => clearInterval(intervalId);
  }, [user, fetchAbandonedCarts]);

  useEffect(() => { setAbandonedCartsPage(1); }, [abandonedCartsPageSize]);

  // ═══════════════════════════════════════════════════════════════════════
  // session_start — يتنفذ عند أول تحميل، ويعيد المحاولة تلقائياً لو المحاولة
  // اللي قبلها فشلت (مش وصلت للسيرفر) عشان مانضيعش الـ session بالكامل.
  // ─────────────────────────────────────────────────────────────────────
  // آمن من StrictMode: الـ server يرفض duplicate sessionId (unique check)
  // بنبعت لو: (أ) session جديدة فعلاً، أو (ب) session قديمة بس لسه مش
  // متأكدة (isConfirmed=false) - يعني المحاولة اللي قبل كده فشلت.
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isNewSessionRef.current && isSessionConfirmedRef.current) return; // اتسجلت فعلاً - مفيش داعي نبعت تاني
    const urlParams    = new URLSearchParams(window.location.search);
    const utm_source   = urlParams.get('utm_source')   || urlParams.get('source') || null;
    const utm_medium   = urlParams.get('utm_medium')   || null;
    const utm_campaign = urlParams.get('utm_campaign') || null;
    const utm_term     = urlParams.get('utm_term')     || null;
    const utm_content  = urlParams.get('utm_content')  || null;
    const referrer     = document.referrer || null;
    trafficAPI.recordVisit({
      visitorId:    visitorIdRef.current,
      sessionId:    sessionIdRef.current,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referrer,
      page: window.location.pathname,
    }).then((result) => {
      // بنسجّل التأكيد بس لو السيرفر فعلاً رد بنجاح (ok:true) - أي فشل
      // (شبكة/سيرفر مقفول) هيسيب الفلاج زي ما هو عشان يعيد المحاولة في أول تحميل جاي.
      if (result && result.ok) {
        try { localStorage.setItem('lava_session_confirmed_id', sessionIdRef.current); } catch (_) {}
        isSessionConfirmedRef.current = true;
      } else {
        console.warn('lava: session_start لم يتأكد من السيرفر - هيتم إعادة المحاولة في التحميل القادم', result);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════
  // page_view — عند كل تنقل بين صفحات الـ SPA
  // لا يزيد عدد الـ sessions — بس بيزوّد pageViewCount ويحدّث lastActivity
  // ═══════════════════════════════════════════════════════════════════════
  const prevPageRef = useRef(null);
  useEffect(() => {
    if (currentPage === prevPageRef.current) return;
    const isFirstRender = prevPageRef.current === null;
    prevPageRef.current = currentPage;
    if (currentPage === 'admin') return;
    if (isFirstRender) return; // الصفحة الأولى اتغطت في recordVisit/session_start
    const pageMap = {
      home: '/', shop: '/shop', checkout: '/checkout',
      wishlist: '/wishlist', account: '/account',
      'my-orders': '/my-orders', contact: '/contact',
      'order-confirmation': '/order-confirmation',
      // ملحوظة: لازم نضيف الـ id هنا (مش بس '/product/') عشان نقدر نحسب
      // "كام عميل بيشوف صفحة المنتج ده دلوقتي" لكل منتج على حدة
      'product-details': selectedProduct?.id ? `/product/${selectedProduct.id}` : '/product/',
      'custom-page': '/page/',
    };
    const pagePath = pageMap[currentPage] || `/${currentPage}`;
    trafficAPI.recordPageView(sessionIdRef.current, pagePath).catch(() => {});
    refreshActivity(); // مدّد الـ session timeout
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== تحميل إحصائيات الترافيك للأدمن =====
  // بيتنفذ أول مرة، وبعدين بيتكرر تلقائياً كل ما الأدمن:
  //  - غيّر الفترة الزمنية (7/14/30/90 يوم)
  //  - فتح تبويب "الزيارات والترافيك" تاني (كانت البيانات بتفضل "ثابتة"
  //    من أول تحميل، حتى لو زوار جداد دخلوا الموقع فعلياً)
  // + بولّينج خفيف كل 30 ثانية طول ما التبويب مفتوح، عشان الأرقام تتحدث
  // لايف من غير ما الأدمن يعمل refresh يدوي للصفحة كلها.
  const fetchTrafficStats = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    setTrafficLoading(true);
    try {
      const stats = await trafficAPI.getStats(trafficDays);
      setTrafficStats(stats);
    } catch (err) {
      console.error('تعذّر تحميل إحصائيات الترافيك:', err);
    } finally {
      setTrafficLoading(false);
    }
  }, [user, trafficDays]);

  useEffect(() => {
    fetchTrafficStats();
  }, [fetchTrafficStats]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || adminTab !== 'traffic') return;
    fetchTrafficStats(); // تحديث فوري عند الدخول على التبويب
    const interval = setInterval(fetchTrafficStats, 30000); // كل 30 ثانية طول ما التبويب مفتوح
    return () => clearInterval(interval);
  }, [adminTab, user, fetchTrafficStats]);

  // ===== عدد الزوار الأونلاين دلوقتي (لوحة التحكم) =====
  // بيتحدث كل 20 ثانية طول ما الأدمن فاتح التبويب الرئيسي — من غير ما يبوّظ
  // أي حاجة تانية شغالة (منفصل تماماً عن fetchTrafficStats).
  const fetchOnlineNow = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    const data = await trafficAPI.getOnline();
    if (data && typeof data.online === 'number') setOnlineNow(data.online);
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || currentPage !== 'admin') return;
    fetchOnlineNow();
    const interval = setInterval(fetchOnlineNow, 20000);
    return () => clearInterval(interval);
  }, [user, currentPage, fetchOnlineNow]);

  // ===== تحميل جاهزية المتجر (Store Health) عند فتح تبويبها =====
  const fetchStoreHealth = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    setStoreHealthLoading(true);
    try {
      const data = await settingsAPI.getStoreHealth();
      setStoreHealth(data);
    } catch (err) {
      console.error('تعذّر تحميل جاهزية المتجر:', err);
    } finally {
      setStoreHealthLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || adminTab !== 'store_health') return;
    fetchStoreHealth();
  }, [adminTab, user, fetchStoreHealth]);

  // ===== تحميل شرائح العملاء (Customer Segments) عند فتح تبويبها =====
  const fetchCustomerSegments = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    setCustomerSegmentsLoading(true);
    try {
      const data = await customersAPI.getSegments();
      setCustomerSegments(data);
    } catch (err) {
      console.error('تعذّر تحميل شرائح العملاء:', err);
    } finally {
      setCustomerSegmentsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || adminTab !== 'customer_segments') return;
    fetchCustomerSegments();
  }, [adminTab, user, fetchCustomerSegments]);

  // ===== تحميل سجل النشاط (Activity Log) عند فتح تبويبه أو تغيير الفلتر/الصفحة =====
  const fetchActivityLogs = useCallback(async ({ silent } = {}) => {
    if (!user || user.role !== 'admin') return;
    if (!silent) setActivityLogsLoading(true);
    try {
      const params = { page: activityLogsPage, limit: activityLogsPageSize };
      if (activityLogFilter !== 'all') params.entityType = activityLogFilter;
      const data = await activityLogsAPI.getAll(params);
      setActivityLogs(Array.isArray(data?.logs) ? data.logs : []);
      setActivityLogsTotal(data?.total || 0);
      setActivityLogsTotalPages(Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || activityLogsPageSize))));
    } catch (err) {
      console.error('تعذّر تحميل سجل النشاط:', err);
    } finally {
      if (!silent) setActivityLogsLoading(false);
    }
  }, [user, activityLogFilter, activityLogsPage, activityLogsPageSize]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || adminTab !== 'activity_log') return;
    fetchActivityLogs();
    // ===== ريفريش تلقائي كل 10 ثواني لنفس الصفحة الحالية بس وقت ما التبويب مفتوح =====
    const intervalId = setInterval(() => fetchActivityLogs({ silent: true }), 10000);
    return () => clearInterval(intervalId);
  }, [adminTab, user, fetchActivityLogs]);

  useEffect(() => { setActivityLogsPage(1); }, [activityLogsPageSize, activityLogFilter]);

  // ===== تحميل لوحة المدفوعات للأدمن =====
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    (async () => {
      setPaymentsDashboardLoading(true);
      try {
        const data = await ordersAPI.getPaymentsDashboard();
        setPaymentsDashboard(data);
      } catch (err) {
        console.error('تعذّر تحميل لوحة المدفوعات:', err);
      } finally {
        setPaymentsDashboardLoading(false);
      }
    })();
  }, [user, orders.length]);

  // ===== تحميل لوحة الشحن للأدمن =====
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    (async () => {
      setShippingDashboardLoading(true);
      try {
        const data = await ordersAPI.getShippingDashboard();
        setShippingDashboard(data);
      } catch (err) {
        console.error('تعذّر تحميل لوحة الشحن:', err);
      } finally {
        setShippingDashboardLoading(false);
      }
    })();
  }, [user, orders.length]);

  // ===== تحميل بيانات الولاء لما العميل يسجل دخول أو يرجع =====
  useEffect(() => {
    if (!user || user.role !== 'customer') { setLoyaltyInfo(null); return; }
    (async () => {
      try {
        const info = await ordersAPI.getLoyaltyInfo();
        setLoyaltyInfo(info);
      } catch {}
    })();
  }, [user]);

  // ===== تحميل صفحة من الطلبات من السيرفر (باجينيشن حقيقية - مش كل الأوردرات مرة واحدة) =====
  const fetchOrders = useCallback(async ({ silent } = {}) => {
    if (!silent) setOrdersLoading(true);
    try {
      const res = await ordersAPI.getAll({ page: ordersPage, limit: ordersPageSize });
      // لو السيرفر رجّع شكل الباجينيشن {items,total,...} نستخدمه، ولو رجّع array عادي (توافق قديم) نلفه
      const items = Array.isArray(res) ? res : (res?.items || []);
      setOrders(items.map(o => ({ ...o, id: o._id })));
      if (!Array.isArray(res)) {
        setOrdersTotal(res?.total || 0);
        setOrdersTotalPages(res?.totalPages || 1);
      }
    } catch (err) {
      console.error('تعذّر تحميل الطلبات:', err);
    } finally {
      if (!silent) setOrdersLoading(false);
    }
  }, [ordersPage, ordersPageSize]);

  useEffect(() => {
    if (!user) return;
    if (!['admin', 'call_center', 'packer'].includes(user.role) && !canAccess('orders')) return;
    fetchOrders();
    // ===== ريفريش تلقائي لنفس الصفحة الحالية بس كل 10 ثواني (مش كل الطلبات) عشان أي طلب/تحديث جديد يبان على طول =====
    const intervalId = setInterval(() => fetchOrders({ silent: true }), 10000);
    return () => clearInterval(intervalId);
  }, [user, fetchOrders, canAccess]);

  // ============================================================
  // ===== إشعارات الطلبات: فتح الطلب المطلوب مباشرة لو المستخدم جاي من
  // إشعار (سواء بضغطه وهو التاب مقفول - رابط ?admin_order=ID - أو وهو
  // التاب مفتوح بالفعل - رسالة OPEN_ADMIN_ORDER من الـService Worker). =====
  const openAdminOrderById = useCallback((orderId) => {
    if (!orderId) return;
    setAdminTab('orders');
    const found = orders.find(o => String(o.id) === String(orderId));
    if (found) {
      setExpandedOrderIds(prev => new Set(prev).add(found.id));
      setTimeout(() => {
        const el = document.getElementById(`order-row-${found.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    } else if (!ordersLoading) {
      fetchOrders();
    }
  }, [orders, ordersLoading, fetchOrders, setAdminTab, setExpandedOrderIds]);

  useEffect(() => {
    if (currentPage !== 'admin' || !user) return;
    const params = new URLSearchParams(window.location.search);
    const targetOrderId = params.get('admin_order');
    if (!targetOrderId) return;
    openAdminOrderById(targetOrderId);
    // نشيل الباراميتر من الرابط عشان مايتكررش الفتح/التمرير في كل ريندر
    window.history.replaceState({}, '', '/admin');
  }, [currentPage, user, orders, openAdminOrderById]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event) => {
      if (event.data && event.data.type === 'OPEN_ADMIN_ORDER' && event.data.orderId) {
        openAdminOrderById(event.data.orderId);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [openAdminOrderById]);

  // ===== جلب كل طلبات الاستبدال (لكل العملاء) عشان تظهر جوه كارت كل طلب في
  // Admin → Orders بالظبط زي قسم الاسترجاع - نفس منطق fetchOrders فوق. =====
  const fetchAdminExchangeRequests = useCallback(async ({ silent } = {}) => {
    try {
      const res = await exchangeAPI.getAll({});
      const items = Array.isArray(res) ? res : (res?.items || []);
      setAdminExchangeRequests(items.map(e => ({ ...e, id: e._id })));
    } catch (err) {
      if (!silent) console.error('تعذّر تحميل طلبات الاستبدال (أدمن):', err);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!['admin', 'call_center', 'packer'].includes(user.role) && !canAccess('orders')) return;
    fetchAdminExchangeRequests();
    const intervalId = setInterval(() => fetchAdminExchangeRequests({ silent: true }), 10000);
    return () => clearInterval(intervalId);
  }, [user, fetchAdminExchangeRequests, canAccess]);

  // ===== لما حجم الصفحة يتغيّر، نرجّع لصفحة 1 عشان منقعش في صفحة مش موجودة =====
  useEffect(() => {
    setOrdersPage(1);
  }, [ordersPageSize]);

  // ===== تحميل كل الطلبات (مش مقسّمة صفحات) خصيصًا لتبويب "لوحة البيانات" =====
  // ملحوظة: ده بقى بديل احتياطي بس (fallback) لحد ما ردود الـ aggregation
  // endpoints (revenueStats/salesTrend/customerStats/...) توصل - هي المصدر
  // الحقيقي للأرقام دلوقتي. عشان كده بيتحمّل مرة واحدة بس لما التبويب يتفتح
  // (زي باقي أدوات الـ aggregation بالظبط) بدل ما يتكرر كل 30 ثانية على طول
  // ويحمّل السيرفر بطلب تقيل من غير داعي فعلي.
  const fetchStatsOrders = useCallback(async ({ silent } = {}) => {
    if (!silent) setStatsOrdersLoading(true);
    try {
      // بدون page/limit في الكويري: السيرفر بيرجع كل الطلبات (بسقف أمان 5000) مرة واحدة
      const res = await ordersAPI.getAll({});
      const items = Array.isArray(res) ? res : (res?.items || []);
      setStatsOrders(items.map(o => ({ ...o, id: o._id })));
    } catch (err) {
      console.error('تعذّر تحميل بيانات لوحة الإحصائيات:', err);
    } finally {
      if (!silent) setStatsOrdersLoading(false);
    }
  }, []);

  // ===== إحصائيات الإيرادات (من الداتا بيز مباشرة عن طريق aggregation) -
  // بيتحمل من غير أي سقف على عدد الطلبات، وبيتحدث كل ما الفترة تتغيّر =====
  const fetchRevenueStats = useCallback(async ({ silent } = {}) => {
    if (!silent) setRevenueStatsLoading(true);
    try {
      const params = { period: statsPeriod };
      if (statsPeriod === 'custom') {
        if (statsCustomFrom) params.from = statsCustomFrom;
        if (statsCustomTo) params.to = statsCustomTo;
      }
      const res = await ordersAPI.getRevenueStats(params);
      setRevenueStats(res || null);
    } catch (err) {
      console.error('تعذّر تحميل إحصائيات الإيرادات:', err);
    } finally {
      if (!silent) setRevenueStatsLoading(false);
    }
  }, [statsPeriod, statsCustomFrom, statsCustomTo]);

  useEffect(() => {
    if (!user) return;
    if (adminTab !== 'stats') return;
    fetchRevenueStats();
  }, [user, adminTab, fetchRevenueStats]);

  // ===== تفصيل الإيراد حسب المحافظة/المنتج (من الداتا بيز مباشرة عن طريق
  // aggregation) - نفس نمط fetchRevenueStats بالظبط =====
  const fetchRevenueBreakdown = useCallback(async ({ silent } = {}) => {
    if (!silent) setRevenueBreakdownLoading(true);
    try {
      const params = { period: statsPeriod };
      if (statsPeriod === 'custom') {
        if (statsCustomFrom) params.from = statsCustomFrom;
        if (statsCustomTo) params.to = statsCustomTo;
      }
      const res = await ordersAPI.getRevenueBreakdown(params);
      setRevenueBreakdown(res || null);
    } catch (err) {
      console.error('تعذّر تحميل تفاصيل الإيرادات:', err);
    } finally {
      if (!silent) setRevenueBreakdownLoading(false);
    }
  }, [statsPeriod, statsCustomFrom, statsCustomTo]);

  useEffect(() => {
    if (!user) return;
    if (adminTab !== 'stats') return;
    fetchRevenueBreakdown();
  }, [user, adminTab, fetchRevenueBreakdown]);

  // ===== إحصائيات العملاء (عملاء فريدين/جدد/متكررين + معدل الإرجاع) من
  // الداتا بيز مباشرة عن طريق aggregation - نفس نمط fetchRevenueStats بالظبط =====
  const fetchCustomerStats = useCallback(async ({ silent } = {}) => {
    if (!silent) setCustomerStatsLoading(true);
    try {
      const params = { period: statsPeriod };
      if (statsPeriod === 'custom') {
        if (statsCustomFrom) params.from = statsCustomFrom;
        if (statsCustomTo) params.to = statsCustomTo;
      }
      const res = await ordersAPI.getCustomerStats(params);
      setCustomerStats(res || null);
    } catch (err) {
      console.error('تعذّر تحميل إحصائيات العملاء:', err);
    } finally {
      if (!silent) setCustomerStatsLoading(false);
    }
  }, [statsPeriod, statsCustomFrom, statsCustomTo]);

  useEffect(() => {
    if (!user) return;
    if (adminTab !== 'stats') return;
    fetchCustomerStats();
  }, [user, adminTab, fetchCustomerStats]);

  // ===== جراف المبيعات (من الداتا بيز مباشرة عن طريق aggregation) - بديل عن
  // بناء الجراف في الفرونت من statsOrders (سقف 1000 قديم) - نفس نمط
  // fetchRevenueStats بالظبط، وعليه مبني توقع الإيرادات (forecast) كمان =====
  const fetchSalesTrend = useCallback(async ({ silent } = {}) => {
    if (!silent) setSalesTrendLoading(true);
    try {
      const params = { period: statsPeriod };
      if (statsPeriod === 'custom') {
        if (statsCustomFrom) params.from = statsCustomFrom;
        if (statsCustomTo) params.to = statsCustomTo;
      }
      const res = await ordersAPI.getSalesTrend(params);
      setSalesTrend(res || null);
    } catch (err) {
      console.error('تعذّر تحميل جراف المبيعات:', err);
    } finally {
      if (!silent) setSalesTrendLoading(false);
    }
  }, [statsPeriod, statsCustomFrom, statsCustomTo]);

  useEffect(() => {
    if (!user) return;
    if (adminTab !== 'stats') return;
    fetchSalesTrend();
  }, [user, adminTab, fetchSalesTrend]);

  // ===== متوسط وقت التسليم / CLV / مبيعات اليوم وإمبارح / توزيع حالات
  // الطلبات - من الداتا بيز مباشرة، نفس نمط fetchRevenueStats بالظبط =====
  const fetchDashboardExtras = useCallback(async ({ silent } = {}) => {
    if (!silent) setDashboardExtrasLoading(true);
    try {
      const params = { period: statsPeriod };
      if (statsPeriod === 'custom') {
        if (statsCustomFrom) params.from = statsCustomFrom;
        if (statsCustomTo) params.to = statsCustomTo;
      }
      const res = await ordersAPI.getDashboardExtras(params);
      setDashboardExtras(res || null);
    } catch (err) {
      console.error('تعذّر تحميل إحصائيات لوحة البيانات الإضافية:', err);
    } finally {
      if (!silent) setDashboardExtrasLoading(false);
    }
  }, [statsPeriod, statsCustomFrom, statsCustomTo]);

  useEffect(() => {
    if (!user) return;
    if (adminTab !== 'stats') return;
    fetchDashboardExtras();
  }, [user, adminTab, fetchDashboardExtras]);

  // ===== مقارنة سنة بسنة (من الداتا بيز مباشرة) - مش مرتبطة بـstatsPeriod
  // (بتحسب السنة الحالية والسنة اللي قبلها دايمًا)، فبتتحمل مرة واحدة بس
  // لما تبويب الإحصائيات يتفتح =====
  const fetchYearlyComparison = useCallback(async ({ silent } = {}) => {
    if (!silent) setYearlyComparisonLoading(true);
    try {
      const res = await ordersAPI.getYearlyComparison();
      setYearlyComparison(res || null);
    } catch (err) {
      console.error('تعذّر تحميل مقارنة السنوات:', err);
    } finally {
      if (!silent) setYearlyComparisonLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (adminTab !== 'stats') return;
    fetchYearlyComparison();
  }, [user, adminTab, fetchYearlyComparison]);

  // ===== إحصائيات السلات المتروكة (إيراد مفقود/مسترجَع/نسبة استرجاع) من
  // الداتا بيز على *كل* السلات المطابقة، بدون سقف صفحة - مستخدمة في تبويب
  // لوحة البيانات وتبويب السلات المتروكة نفسه =====
  const fetchAbandonedCartStats = useCallback(async ({ silent } = {}) => {
    if (!silent) setAbandonedCartStatsLoading(true);
    try {
      const res = await abandonedCartAPI.getStats();
      setAbandonedCartStats(res || null);
    } catch (err) {
      console.error('تعذّر تحميل إحصائيات السلات المتروكة:', err);
    } finally {
      if (!silent) setAbandonedCartStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (adminTab !== 'stats' && adminTab !== 'abandoned_carts') return;
    fetchAbandonedCartStats();
  }, [user, adminTab, fetchAbandonedCartStats]);

  useEffect(() => {
    if (!user) return;
    if (adminTab !== 'stats') return;
    fetchStatsOrders();
  }, [user, adminTab, fetchStatsOrders]);

  // ===== جلب طلبات العميل نفسه من السيرفر (صفحة "طلباتي") =====
  // ده منفصل عن fetchOrders اللي فوق، لأن ده مخصص بس للأدمن/كول سنتر/باكر.
  // العميل العادي لازم يجيب طلباته من /orders/mine عشان تفضل ظاهرة حتى بعد الريفريش.
  useEffect(() => {
    if (currentPage !== 'my-orders') return;
    if (!user || user.role !== 'customer') return;
    (async () => {
      try {
        const mine = await ordersAPI.getMine();
        const mineMapped = (mine || []).map(o => ({ ...o, id: o._id }));
        setOrders(prev => {
          const merged = [...mineMapped];
          prev.forEach(p => {
            if (!merged.some(m => m.id === p.id)) merged.push(p);
          });
          return merged;
        });
      } catch (err) {
        console.error('تعذّر تحميل طلباتي:', err);
      }
      try {
        const mineExchanges = await exchangeAPI.getMine();
        setMyExchangeRequests((mineExchanges || []).map(e => ({ ...e, id: e._id })));
      } catch (err) {
        console.error('تعذّر تحميل طلبات الاستبدال بتاعتي:', err);
      }
    })();
  }, [currentPage, user]);

  // ===== تقييمات العملاء (لوحة الأدمن) =====
  const [adminReviews, setAdminReviews] = useState([]);
  const [adminReviewsLoading, setAdminReviewsLoading] = useState(false);
  const [adminReviewsStatusFilter, setAdminReviewsStatusFilter] = useState('pending');

  const fetchAdminReviews = useCallback(async () => {
    setAdminReviewsLoading(true);
    try {
      const params = {};
      if (adminReviewsStatusFilter !== 'all') params.status = adminReviewsStatusFilter;
      const result = await settingsAPI.getAdminReviews(params);
      const items = result?.items || result || [];
      setAdminReviews(items.map(r => ({ ...r, id: r.id || r._id })));
    } catch (err) {
      console.error('تعذّر تحميل التقييمات:', err);
    } finally {
      setAdminReviewsLoading(false);
    }
  }, [adminReviewsStatusFilter]);

  useEffect(() => {
    if (adminTab !== 'reviews') return;
    if (!user || !canAccess('reviews')) return;
    fetchAdminReviews();
  }, [adminTab, user, canAccess, fetchAdminReviews]);

  // ===== Returns & Exchanges - Phase 2B: تبويب الأدمن الموحّد (قايمة Return + Exchange) =====
  const fetchReAdminList = useCallback(async () => {
    setReAdminLoading(true);
    try {
      const [returnsRes, exchangesRes] = await Promise.all([
        ordersAPI.getReturnRequests({}).catch(() => []),
        exchangeAPI.getAll({}).catch(() => []),
      ]);
      const returnsArr = Array.isArray(returnsRes) ? returnsRes : (returnsRes?.items || []);
      const exchangesArr = Array.isArray(exchangesRes) ? exchangesRes : (exchangesRes?.items || []);
      const normalizedReturns = returnsArr.map((r) => ({
        type: 'return',
        requestId: r.requestId || String(r.orderId),
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        items: r.items || [],
        reasonCode: r.reasonCode,
        reason: r.reason,
        fee: r.fee,
        currency: r.currency || 'EGP',
        feeType: r.feeType,
        status: r.status,
        createdAt: r.createdAt,
        raw: r,
      }));
      const normalizedExchanges = exchangesArr.map((e) => ({
        type: 'exchange',
        requestId: e.requestId || String(e._id),
        orderId: e.orderId,
        orderNumber: e.orderNumber,
        customerName: e.customerName || null,
        customerPhone: e.customerPhone || null,
        items: e.items || [],
        reasonCode: e.reasonCode,
        reason: e.reason,
        fee: e.fee,
        currency: e.currency || 'EGP',
        feeType: e.feeType,
        status: e.status,
        createdAt: e.createdAt,
        raw: e,
      }));
      const merged = [...normalizedReturns, ...normalizedExchanges].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setReAdminList(merged);
    } catch (err) {
      console.error('Error fetching returns/exchanges list:', err);
      showToast(t('حصل خطأ في جلب طلبات الاسترجاع والاستبدال', 'Failed to fetch returns/exchanges'));
    } finally {
      setReAdminLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    if (adminTab !== 'returns_exchanges' && adminTab !== 'orders') return;
    if (!user || !canAccess('orders')) return;
    if (adminTab === 'returns_exchanges' && reAdminSubTab !== 'list') return;
    fetchReAdminList();
  }, [adminTab, reAdminSubTab, user, canAccess, fetchReAdminList]);

  // ===== خريطة: orderId -> طلبات الاسترجاع/الاستبدال الخاصة بيه (من نفس قايمة
  // تبويب "الاسترجاع والاستبدال" في الأدمن) - بتتستخدم في تبويب "الطلبات" عشان
  // نعرض حالة الاسترجاع/الاستبدال جنب حالة الطلب العادية لكل أوردر. =====
  const reByOrderId = useMemo(() => {
    const map = {};
    (reAdminList || []).forEach((it) => {
      const key = String(it.orderId);
      if (!map[key]) map[key] = [];
      map[key].push(it);
    });
    return map;
  }, [reAdminList]);

  // فتح تفاصيل طلب (Return أو Exchange) في مودال
  const openReAdminDetails = useCallback(async (item) => {
    setReAdminSelected({ type: item.type, data: item.raw });
    setReAdminNoteDraft('');
    if (item.type === 'return') {
      setReAdminSelectedLoading(true);
      try {
        const details = await ordersAPI.getReturnRequestDetails(item.orderId);
        setReAdminSelected({ type: 'return', data: details });
      } catch (err) {
        console.error('Error fetching return request details:', err);
      } finally {
        setReAdminSelectedLoading(false);
      }
    } else {
      setReAdminSelectedLoading(true);
      try {
        const details = await exchangeAPI.getById(item.orderId ? item.raw._id : item.raw._id);
        setReAdminSelected({ type: 'exchange', data: details });
      } catch (err) {
        console.error('Error fetching exchange request details:', err);
      } finally {
        setReAdminSelectedLoading(false);
      }
    }
  }, []);

  // Admin actions موحّدة (approve/reject للـReturn والـExchange)
  const handleReAdminReview = useCallback(async (action) => {
    if (!reAdminSelected) return;
    setReAdminActionLoading(true);
    try {
      if (reAdminSelected.type === 'return') {
        const orderId = reAdminSelected.data.orderId || reAdminSelected.data.order?._id;
        const updated = await ordersAPI.reviewReturnRequest(orderId, { action, adminNote: reAdminNoteDraft || undefined });
        const details = await ordersAPI.getReturnRequestDetails(orderId);
        setReAdminSelected({ type: 'return', data: details });
        void updated;
      } else {
        const id = reAdminSelected.data._id;
        const updated = await exchangeAPI.review(id, { action, adminNote: reAdminNoteDraft || undefined });
        setReAdminSelected({ type: 'exchange', data: updated });
      }
      showToast(action === 'approve' ? t('تمت الموافقة على الطلب', 'Request approved') : t('تم رفض الطلب', 'Request rejected'));
      fetchReAdminList();
    } catch (err) {
      console.error('Error reviewing request:', err);
      showToast(err?.response?.data?.message || t('حصل خطأ أثناء مراجعة الطلب', 'Failed to review request'));
    } finally {
      setReAdminActionLoading(false);
    }
  }, [reAdminSelected, reAdminNoteDraft, fetchReAdminList, showToast, t]);

  // تحديث حالة workflow للاستبدال بعد الموافقة (pickup/received/processing/completed/cancelled)
  const handleReAdminExchangeStatus = useCallback(async (nextStatus) => {
    if (!reAdminSelected || reAdminSelected.type !== 'exchange') return;
    setReAdminActionLoading(true);
    try {
      const updated = await exchangeAPI.updateStatus(reAdminSelected.data._id, nextStatus, reAdminNoteDraft || undefined);
      setReAdminSelected({ type: 'exchange', data: updated });
      showToast(t('تم تحديث حالة الطلب', 'Status updated'));
      fetchReAdminList();
    } catch (err) {
      console.error('Error updating exchange status:', err);
      showToast(err?.response?.data?.message || t('حصل خطأ أثناء تحديث الحالة', 'Failed to update status'));
    } finally {
      setReAdminActionLoading(false);
    }
  }, [reAdminSelected, reAdminNoteDraft, fetchReAdminList, showToast, t]);

  // ===== Phase 2C: تحديث حالة workflow للاسترجاع بعد الموافقة (نفس فكرة
  // handleReAdminExchangeStatus بالظبط لكن للـReturn) =====
  const handleReAdminReturnStatus = useCallback(async (nextStatus) => {
    if (!reAdminSelected || reAdminSelected.type !== 'return') return;
    setReAdminActionLoading(true);
    try {
      const orderId = reAdminSelected.data.orderId || reAdminSelected.data.order?._id;
      await ordersAPI.updateReturnStatus(orderId, nextStatus, reAdminNoteDraft || undefined);
      const details = await ordersAPI.getReturnRequestDetails(orderId);
      setReAdminSelected({ type: 'return', data: details });
      showToast(t('تم تحديث حالة الطلب', 'Status updated'));
      fetchReAdminList();
    } catch (err) {
      console.error('Error updating return status:', err);
      showToast(err?.response?.data?.message || t('حصل خطأ أثناء تحديث الحالة', 'Failed to update status'));
    } finally {
      setReAdminActionLoading(false);
    }
  }, [reAdminSelected, reAdminNoteDraft, fetchReAdminList, showToast, t]);

  // ===== زرار "معاينة" المنتج المرتجع بعد وصوله فعليًا (كويس/مش كويس) في
  // تبويب "الاسترجاع والاستبدال" الموحّد - مستقلة عن handleReAdminReturnStatus
  // فوق لأنها بتنادي endpoint مختلف تمامًا (return-request/inspect) وهي اللي
  // بتقرر رجوع المخزون فعليًا، مش مجرد تقدّم في مراحل الشحن =====
  const handleReAdminReturnInspect = useCallback(async (result) => {
    if (!reAdminSelected || reAdminSelected.type !== 'return') return;
    setReAdminActionLoading(true);
    try {
      const orderId = reAdminSelected.data.orderId || reAdminSelected.data.order?._id;
      await ordersAPI.inspectReturnRequest(orderId, { result });
      const details = await ordersAPI.getReturnRequestDetails(orderId);
      setReAdminSelected({ type: 'return', data: details });
      showToast(result === 'good' ? t('تمام - المنتج رجع للمخزون ✅', 'Good - item returned to stock ✅') : t('تم التسجيل - المنتج مش سليم، منرجعش للمخزون', 'Saved - item not restocked'));
      fetchReAdminList();
    } catch (err) {
      console.error('Error inspecting return request:', err);
      showToast(err?.response?.data?.message || err?.message || t('تعذّر تسجيل المعاينة', 'Could not save inspection'));
    } finally {
      setReAdminActionLoading(false);
    }
  }, [reAdminSelected, fetchReAdminList, showToast, t]);

  // نفس فكرة handleReAdminReturnInspect بالظبط لكن للاستبدال
  // (ExchangeRequest.oldVariantInspectionResult بدل Order.returnInspectionResult).
  const handleReAdminExchangeInspect = useCallback(async (result) => {
    if (!reAdminSelected || reAdminSelected.type !== 'exchange') return;
    setReAdminActionLoading(true);
    try {
      const updated = await exchangeAPI.inspect(reAdminSelected.data._id, { result });
      setReAdminSelected({ type: 'exchange', data: updated });
      showToast(result === 'good' ? t('تمام - المنتج رجع للمخزون ✅', 'Good - item returned to stock ✅') : t('تم التسجيل - المنتج مش سليم، منرجعش للمخزون', 'Saved - item not restocked'));
      fetchReAdminList();
    } catch (err) {
      console.error('Error inspecting exchange request:', err);
      showToast(err?.response?.data?.message || err?.message || t('تعذّر تسجيل المعاينة', 'Could not save inspection'));
    } finally {
      setReAdminActionLoading(false);
    }
  }, [reAdminSelected, fetchReAdminList, showToast, t]);

  // ===== Phase 2C: تسجيل/تأكيد تحويل الفلوس (استرجاع أو استبدال) =====
  const [reAdminMoneyAmount, setReAdminMoneyAmount] = useState('');
  const [reAdminMoneyMethod, setReAdminMoneyMethod] = useState('');
  const [reAdminMoneyDirection, setReAdminMoneyDirection] = useState('refund_to_customer');
  const [reAdminMoneySaving, setReAdminMoneySaving] = useState(false);

  const handleReAdminMoneyTransfer = useCallback(async () => {
    if (!reAdminSelected) return;
    if (!reAdminMoneyMethod) {
      showToast(t('اختار طريقة التحويل (انستا باي / محفظة) الأول', 'Choose a transfer method first'));
      return;
    }
    if (!reAdminMoneyAmount || Number(reAdminMoneyAmount) <= 0) {
      showToast(t('اكتب مبلغ صحيح', 'Enter a valid amount'));
      return;
    }
    setReAdminMoneySaving(true);
    try {
      if (reAdminSelected.type === 'return') {
        const orderId = reAdminSelected.data.orderId || reAdminSelected.data.order?._id;
        await ordersAPI.updateReturnRefund(orderId, {
          amount: reAdminMoneyAmount, method: reAdminMoneyMethod, transferred: true,
        });
        const details = await ordersAPI.getReturnRequestDetails(orderId);
        setReAdminSelected({ type: 'return', data: details });
      } else {
        const id = reAdminSelected.data._id;
        const updated = await exchangeAPI.updateMoney(id, {
          direction: reAdminMoneyDirection, amount: reAdminMoneyAmount, method: reAdminMoneyMethod, transferred: true,
        });
        setReAdminSelected({ type: 'exchange', data: updated });
      }
      showToast(t('تم تسجيل تحويل الفلوس', 'Transfer recorded'));
      fetchReAdminList();
    } catch (err) {
      console.error('Error recording money transfer:', err);
      showToast(err?.response?.data?.message || t('حصل خطأ أثناء تسجيل التحويل', 'Failed to record transfer'));
    } finally {
      setReAdminMoneySaving(false);
    }
  }, [reAdminSelected, reAdminMoneyAmount, reAdminMoneyMethod, reAdminMoneyDirection, fetchReAdminList, showToast, t]);

  const moderateReviewStatus = useCallback(async (reviewId, nextStatus) => {
    try {
      await settingsAPI.moderateReview(reviewId, nextStatus);
      setAdminReviews(prev => prev.filter(r => r.id !== reviewId));
      showToast(nextStatus === 'approved' ? t('تمت الموافقة على التقييم', 'Review approved') : t('تم رفض التقييم', 'Review rejected'));
    } catch (err) {
      console.error('تعذّر تحديث حالة التقييم:', err);
      showToast(t('حصل خطأ أثناء تحديث التقييم', 'Error updating the review'));
    }
  }, [t]);

  const deleteAdminReview = useCallback(async (reviewId) => {
    try {
      await settingsAPI.deleteReview(reviewId);
      setAdminReviews(prev => prev.filter(r => r.id !== reviewId));
      showToast(t('تم حذف التقييم', 'Review deleted'));
    } catch (err) {
      console.error('تعذّر حذف التقييم:', err);
      showToast(t('حصل خطأ أثناء حذف التقييم', 'Error deleting the review'));
    }
  }, [t]);

  // ===== جلب CSRF cookie أول ما الموقع يفتح (لازم قبل أي POST/PUT/PATCH/DELETE) =====
  useEffect(() => {
    authAPI.fetchCsrfToken().catch(() => {});
  }, []);

  // ===== استرجاع تسجيل الدخول تلقائياً بعد تحديث الصفحة =====
  // الكوكي HttpOnly، فمفيش طريقة نتأكد من وجودها من الفرونت غير إننا نسأل السيرفر
  // مباشرة عبر /auth/me. لو الكوكي مش موجودة أو منتهية، السيرفر هيرجع 401 ونتجاهله بهدوء.
  useEffect(() => {
    (async () => {
      try {
        const me = await authAPI.me();
        setUser({
          // ===== FIX: نفس مشكلة applyLoggedInUser — الـid ماكانش بيتحفظ
          // هنا برضو (وقت استرجاع تسجيل الدخول بعد ريفريش الصفحة).
          id: me.id,
          name: me.name,
          email: me.email,
          phone: me.phone,
          role: me.role,
          address: '',
          savedShipping: me.savedShipping || null,
          // ===== [RBAC FIX] نفس فيكس permissions اللي في applyLoggedInUser - لازم تتحفظ برضو
          // هنا عشان بعد أي ريفريش للصفحة الصلاحيات متختفيش وترجع الموظف يشوف "الطلبات" بس. =====
          permissions: Array.isArray(me.permissions) ? me.permissions : [],
        });
        setHasSavedShipping(!!me.savedShipping);
        // ===== استرجاع أهلية خصم أول طلب بعد تحديث الصفحة =====
        if (me.role === 'customer') {
          const discountUsed = me.firstOrderDiscountUsed || false;
          setFirstOrderDiscountEligible(!discountUsed);
          setFirstOrderDiscountUsed(discountUsed);
        }
        // ===== استرجاع المفضلة المحفوظة في الداتا بيز (السيرفر هو المصدر الوحيد هنا) =====
        syncWishlistFromServer(me.wishlist, { merge: false });
        // ===== استرجاع سلة التسوق المحفوظة في الداتا بيز (السيرفر هو المصدر الوحيد هنا) =====
        syncCartFromServer(me.cart, { merge: false });
      } catch (err) {
        // مفيش جلسة صالحة - المستخدم guest، مفيش حاجة نعملها
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // دوال المنتجات وسلة التسوق
  // ============================================================
  const openProductDetails = useCallback((product) => {
    setSelectedProduct(product);
    setActiveImageIndex(0);
    // ===== تسجيل المنتج في "آخر منتجات اتشافت" (localStorage بس) =====
    if (adminSettings.current.showRecentlyViewed && product?.id) {
      setRecentlyViewedIds(prev => {
        const next = [product.id, ...prev.filter(id => id !== product.id)].slice(0, RECENTLY_VIEWED_MAX);
        try { localStorage.setItem('lava_recently_viewed', JSON.stringify(next)); } catch {}
        return next;
      });
    }
    // ===== Pixel: ViewContent =====
    fireEvent('ViewContent', {
      name: product?.name?.ar || product?.name?.en || '',
      price: product?.onSale && product?.salePrice ? product.salePrice : (product?.price || 0),
      currency: 'EGP',
      productId: product?.id || product?._id || '',
      sku: product?.sku || '',
      eventId: `view_${product?.id || product?._id || Date.now()}`,
    });
    // ===== Funnel: Product View =====
    trafficAPI.trackFunnel(visitorIdRef.current, sessionIdRef.current, 'product_view');
    refreshActivity();
    // العميل لازم يختار اللون والمقاس بنفسه - مفيش اختيار تلقائي أبداً.
    // الاستثناء الوحيد: منتج مالوش ألوان أصلاً (فاريانت واحد بدون لون) - مفيش اختيار حقيقي هنا فعملياً،
    // فبنربط الفاريانت الوحيد ده تلقائياً عشان نقدر نحسب المخزون، من غير ما نعتبره "اختيار لون" من العميل.
    const productHasColors = hasColors(product);
    setSelectedColor(productHasColors ? '' : (getDefaultVariant(product)?.id || ''));
    // مفيش اختيار مقاس تلقائي أبداً لو المنتج فيه مقاسات - العميل لازم يختار بنفسه.
    setSelectedSize('');
    setProductQuantity(1);
    setSelectedBundleIds([product.id, ...(product.bundle?.productIds || [])]);
    setBundleSelections({});
    goTo('product-details', product);
  }, [goTo, fireEvent]);

  // ===== زرار الدعوة لاتخاذ إجراء (CTA) في بوب أب عرض الترحيب - يفتح المنتج/القسم/المتجر المحدد من الأدمن =====
  const handleWelcomeOfferCTA = useCallback(() => {
    const offer = adminSettings.current.promotions.welcomeOffer;
    setWelcomeOfferClosed(true);
    if (offer.destinationType === 'product' && offer.productId) {
      const prod = products.find(p => p.id === offer.productId);
      if (prod) { openProductDetails(prod); return; }
    }
    if (offer.destinationType === 'category' && offer.categoryId) {
      const cat = categories.find(c => c.id === offer.categoryId);
      if (cat) { setSelectedCategoryFilter(getLocalized(cat.name)); goTo('shop'); return; }
    }
    setSelectedCategoryFilter('all');
    goTo('shop');
  }, [products, categories, getLocalized, openProductDetails]);

  // ============================================================
  // دوال الويشليست (المفضلة)
  // ============================================================
  const isInWishlist = useCallback((productId) => {
    return wishlist.some(id => id === productId);
  }, [wishlist]);

  const toggleWishlist = useCallback((productId) => {
    setWishlist(prev => {
      const isRemoving = prev.includes(productId);
      const next = isRemoving ? prev.filter(id => id !== productId) : [...prev, productId];
      showToast(isRemoving ? t('تم إزالة المنتج من المفضلة', 'Removed from wishlist') : t('تم إضافة المنتج إلى المفضلة ❤️', 'Added to wishlist ❤️'));
      // لو المستخدم مسجل دخول (أي دور)، احفظ المفضلة في الداتا بيز فوراً عشان متتشلش لما يعمل ريفريش
      if (user) {
        authAPI.updateWishlist(next).catch(() => {});
      }
      return next;
    });
  }, [t, showToast, user]);

  // كمية نفس الفاريانت/المقاس الموجودة بالفعل في السلة
  const getCartQuantityForVariant = useCallback((productId, variantId, size) => {
    return cart.filter(item => item.id === productId && (item.variantId || NO_COLOR_ID) === (variantId || NO_COLOR_ID) && item.size === size).length;
  }, [cart]);

  // تحقق شامل قبل الإضافة للسلة / الشراء المباشر (نفس التحقق لازم يتكرر في السيرفر لاحقاً)
  const validateCartAddition = useCallback((product, variantId, size, quantity) => {
    if (!product) return { ok: false, reason: t('المنتج غير موجود', 'Product not found') };
    if ((product.visibility || 'published') !== 'published') {
      return { ok: false, reason: t('هذا المنتج غير متاح للشراء حالياً', 'This product is not available for purchase') };
    }
    if (hasColors(product) && !variantId) {
      return { ok: false, reason: t('من فضلك اختر اللون أولاً', 'Please select a color first') };
    }
    if (!size) {
      return { ok: false, reason: t('من فضلك اختر المقاس أولاً', 'Please select a size first') };
    }
    const stock = getVariantStock(product, variantId, size);
    if (stock <= 0) {
      return { ok: false, reason: t('هذا الخيار غير متوفر حالياً', 'This option is currently out of stock') };
    }
    const alreadyInCart = getCartQuantityForVariant(product.id, variantId, size);
    const availableToAdd = stock - alreadyInCart;
    if (availableToAdd <= 0) {
      return { ok: false, reason: t('لقد أضفت بالفعل كل الكمية المتاحة من هذا الخيار', "You've already added all available stock of this option") };
    }
    return { ok: true, maxQty: Math.min(quantity, availableToAdd) };
  }, [t, getCartQuantityForVariant]);

  const addToCart = useCallback((product, variantId, size, price, quantity = 1) => {
    const check = validateCartAddition(product, variantId, size, quantity);
    if (!check.ok) {
      showToast(check.reason);
      return false;
    }
    const variant = getVariantById(product, variantId) || getDefaultVariant(product);
    const sizeEntry = getSizeEntry(product, variantId, size);
    const unitPrice = price || getEffectivePrice(product);
    const qty = Math.max(1, check.maxQty);
    const newItems = Array.from({ length: qty }, (_, i) => ({
      ...product,
      price: unitPrice,
      size: size,
      variantId: getCanonicalVariantId(variant),
      colorLabel: variant && variant.color ? getLocalized(variant.color) : null,
      colorHex: variant ? variant.hex : null,
      sku: sizeEntry ? sizeEntry.sku : undefined,
      cartId: Date.now() + i + Math.random()
    }));
    setCart(prev => [...prev, ...newItems]);
    // ===== Pixel: AddToCart =====
    fireEvent('AddToCart', {
      name: product?.name?.ar || product?.name?.en || '',
      price: unitPrice || 0,
      currency: 'EGP',
      quantity: qty,
      productId: product?.id || product?._id || '',
      sku: sizeEntry?.sku || variant?.sku || '',
      items: [{ item_id: sizeEntry?.sku || variant?.id || product?.id || product?._id || '', item_name: product?.name?.ar || product?.name?.en || '', price: unitPrice || 0, quantity: qty }],
      eventId: `cart_${product?.id || product?._id || ''}_${sizeEntry?.sku || variant?.id || ''}_${Date.now()}`,
    });
    // ===== Funnel: Add to Cart =====
    trafficAPI.trackFunnel(visitorIdRef.current, sessionIdRef.current, 'add_to_cart');
    refreshActivity();
    showToast(t('تم إضافة المنتج إلى عربة التسوق بنجاح!', 'Product added to cart!'));
    return true;
  }, [t, validateCartAddition, getLocalized, fireEvent]);

  // ===== زرار "إضافة سريعة" على الكارت: لو المنتج محتاج اختيار لون/مقاس بيفتح نافذة صغيرة،
  // ولو مالوش اختيارات (فاريانت واحد بدون لون ومفيش مقاسات) بيتضاف على طول من غير ما نزعج العميل =====
  const handleQuickAdd = useCallback((e, product) => {
    e.stopPropagation();
    const stockStatus = getProductStockStatus(product);
    if (stockStatus === 'out') { openProductDetails(product); return; }
    const needsColor = hasColors(product);
    const needsSize = (product.sizes || []).length > 0;
    if (!needsColor && !needsSize) {
      const defaultVariant = getDefaultVariant(product);
      addToCart(product, defaultVariant?.id, '', null, 1);
      return;
    }
    setQuickAddProduct(product);
  }, [addToCart, openProductDetails]);

  const buyNow = useCallback((product, variantId, size, price, quantity = 1) => {
    const check = validateCartAddition(product, variantId, size, quantity);
    if (!check.ok) {
      showToast(check.reason);
      return;
    }
    const variant = getVariantById(product, variantId) || getDefaultVariant(product);
    const sizeEntry = getSizeEntry(product, variantId, size);
    const unitPrice = price || getEffectivePrice(product);
    const qty = Math.max(1, check.maxQty);
    const newItems = Array.from({ length: qty }, (_, i) => ({
      ...product,
      price: unitPrice,
      size: size,
      variantId: getCanonicalVariantId(variant),
      colorLabel: variant && variant.color ? getLocalized(variant.color) : null,
      colorHex: variant ? variant.hex : null,
      sku: sizeEntry ? sizeEntry.sku : undefined,
      cartId: Date.now() + i + Math.random()
    }));
    setCart(prev => [...prev, ...newItems]);
    // ===== Pixel: AddToCart =====
    // "اشترِ الآن" بيحط المنتج في السلة فعلياً (مرحلة وسيطة قبل الدفع)، فلازم يتسجل
    // بنفس منطق زرار "أضف إلى السلة" العادي - وإلا الفانيل هيفضل يفتقد خطوة add_to_cart
    // لأي عميل استخدم "اشترِ الآن"، وهيبان إنه قفز من مشاهدة المنتج لصفحة الدفع مباشرة.
    fireEvent('AddToCart', {
      name: product?.name?.ar || product?.name?.en || '',
      price: unitPrice || 0,
      currency: 'EGP',
      quantity: qty,
      productId: product?.id || product?._id || '',
      sku: sizeEntry?.sku || variant?.sku || '',
      items: [{ item_id: sizeEntry?.sku || variant?.id || product?.id || product?._id || '', item_name: product?.name?.ar || product?.name?.en || '', price: unitPrice || 0, quantity: qty }],
      eventId: `cart_${product?.id || product?._id || ''}_${sizeEntry?.sku || variant?.id || ''}_${Date.now()}`,
    });
    // ===== Funnel: Add to Cart =====
    trafficAPI.trackFunnel(visitorIdRef.current, sessionIdRef.current, 'add_to_cart');
    refreshActivity();
    goTo('checkout');
  }, [t, validateCartAddition, getLocalized, fireEvent]);

  const submitProductReview = useCallback(async (productId) => {
    if (!reviewName.trim() || !reviewComment.trim()) {
      showToast(t('من فضلك اكتب اسمك والتعليق', 'Please fill in your name and comment'));
      return;
    }
    setIsSubmittingReview(true);
    try {
      let imageUrl = '';
      if (reviewImageFile) {
        try {
          const uploaded = await settingsAPI.uploadReviewImage(reviewImageFile);
          imageUrl = uploaded?.data?.url || uploaded?.url || '';
        } catch (uploadErr) {
          console.error('تعذّر رفع صورة التقييم:', uploadErr);
          showToast(uploadErr?.message || t('تعذّر رفع الصورة، هيتم إرسال التقييم من غيرها', 'Could not upload the image, submitting the review without it'));
        }
      }
      const saved = await settingsAPI.addReview(productId, {
        name: reviewName.trim(),
        rating: reviewRating,
        comment: reviewComment.trim(),
        image: imageUrl,
      });
      const savedReview = saved.review || saved;
      setProductReviews(prev => {
        const existing = prev[productId] || [];
        return {
          ...prev,
          [productId]: [
            savedReview,
            ...existing,
          ],
        };
      });
      setReviewName('');
      setReviewRating(5);
      setReviewComment('');
      setReviewImageFile(null);
      setReviewImagePreview('');
      if (savedReview.status === 'pending') {
        showToast(t('شكراً لك! تقييمك هيبان بعد ما الأدمن يوافق عليه', 'Thank you! Your review will appear after admin approval'));
      } else {
        showToast(t('شكراً لك! تم إضافة تقييمك بنجاح', 'Thank you! Your review has been added'));
      }
    } catch (err) {
      showToast(err?.message || t('حصل خطأ في حفظ التقييم', 'Error saving review'));
    } finally {
      setIsSubmittingReview(false);
    }
  }, [reviewName, reviewRating, reviewComment, reviewImageFile, t, settingsAPI]);

  const addBundleToCart = useCallback((mainProduct, selectedBundleItems, discountPercent) => {
    if (!selectedSize) {
      showToast(t('من فضلك اختر المقاس أولاً', 'Please select a size first'));
      return;
    }

    const selectedProducts = [mainProduct, ...selectedBundleItems];

    // التحقق من اختيار اللون والمقاس لكل منتج باندل غير المنتج الأساسي
    for (const p of selectedBundleItems) {
      const sel = bundleSelections[p.id] || {};
      if (hasColors(p) && !sel.variantId) {
        showToast(t(`من فضلك اختر اللون لـ ${getLocalized(p.name)}`, `Please select a color for ${getLocalized(p.name)}`));
        return;
      }
      const variantId = sel.variantId || getDefaultVariant(p)?.id;
      const size = sel.size || selectedSize;
      const stock = getVariantStock(p, variantId, size);
      if (stock <= 0) {
        showToast(t(`${getLocalized(p.name)} غير متوفر بالمقاس المختار`, `${getLocalized(p.name)} is out of stock in this size`));
        return;
      }
    }

    // التحقق من المنتج الأساسي
    const mainStock = getVariantStock(mainProduct, selectedColor, selectedSize);
    if (mainStock <= 0) {
      showToast(t(`${getLocalized(mainProduct.name)} غير متوفر بالمقاس المختار`, `${getLocalized(mainProduct.name)} is out of stock in this size`));
      return;
    }

    const newCartItems = selectedProducts.map(p => {
      const isMain = p.id === mainProduct.id;
      const sel = isMain ? {} : (bundleSelections[p.id] || {});
      const variantId = isMain ? selectedColor : (sel.variantId || getDefaultVariant(p)?.id);
      const size = isMain ? selectedSize : (sel.size || selectedSize);
      const variant = getVariantById(p, variantId) || getDefaultVariant(p);
      const sizeEntry = getSizeEntry(p, variantId, size);
      const priceAfterDiscount = Math.round(p.price * (1 - discountPercent / 100) * 100) / 100;
      return {
        ...p,
        size,
        variantId: getCanonicalVariantId(variant),
        colorLabel: variant && variant.color ? getLocalized(variant.color) : null,
        colorHex: variant ? variant.hex : null,
        sku: sizeEntry ? sizeEntry.sku : undefined,
        cartId: Date.now() + Math.random() * 1000,
        price: priceAfterDiscount,
        originalPrice: p.price,
        isBundleItem: true,
        bundleDiscount: discountPercent,
      };
    });
    setCart(prev => [...prev, ...newCartItems]);
    showToast(t('تم إضافة الباقة إلى السلة بنجاح!', 'Bundle added to cart!'));
  }, [selectedSize, selectedColor, bundleSelections, t, getLocalized, hasColors, getDefaultVariant, getVariantStock, getVariantById, getSizeEntry, getCanonicalVariantId]);

  const toggleBundleItem = useCallback((id) => {
    setSelectedBundleIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const removeFromCart = useCallback((cartId) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  }, []);

  const updateCartItemQuantity = useCallback((item, newQty) => {
    const sameLine = (c) => c.id === item.id && c.size === item.size && c.price === item.price && (c.variantId || NO_COLOR_ID) === (item.variantId || NO_COLOR_ID);
    const sameLineItems = cart.filter(sameLine);
    const currentQty = sameLineItems.length;
    if (newQty < 0 || newQty === currentQty) return;

    // النزول لـ 0 معناه إزالة السطر بالكامل من السلة (زي زرار "إزالة" بالظبط)
    if (newQty === 0) {
      setCart(prev => prev.filter(c => !sameLine(c)));
      return;
    }

    if (newQty > currentQty) {
      // ما نتجاوزش المخزون المتاح للفاريانت ده
      const productRef = products.find(p => p.id === item.id);
      const stock = productRef ? getVariantStock(productRef, item.variantId, item.size) : Infinity;
      if (newQty > stock) {
        showToast(t(`أقصى كمية متاحة هي ${stock}`, `Maximum available quantity is ${stock}`));
        return;
      }
      const toAdd = Array.from({ length: newQty - currentQty }, (_, i) => ({
        ...item,
        cartId: Date.now() + i + Math.random()
      }));
      setCart(prev => [...prev, ...toAdd]);
    } else {
      const removeCount = currentQty - newQty;
      setCart(prev => {
        let toRemove = removeCount;
        const next = [...prev];
        for (let i = next.length - 1; i >= 0 && toRemove > 0; i--) {
          if (sameLine(next[i])) {
            next.splice(i, 1);
            toRemove--;
          }
        }
        return next;
      });
    }
  }, [cart, products, t]);

  // ============================================================
  // ================ محرك العروض الترويجية المركزي =================
  // مصدر واحد فقط لحساب أي خصم/قطعة مجانية على السلة بالكامل.
  // ممنوع تكرار هذا الحساب في أي مكان تاني (صفحة المنتج / الكارت / الشيكاوت / البوب أب) -
  // كل الأماكن الأخرى بتستخدم نفس الدوال دي.
  // ============================================================

  // هل العرض شغال دلوقتي (مفعّل + جوه فترة البداية/النهاية لو موجودة)؟
  const isPromotionCurrentlyActive = useCallback((promo) => {
    if (!promo || !promo.active) return false;
    const now = Date.now();
    if (promo.startDate && new Date(promo.startDate).getTime() > now) return false;
    if (promo.endDate && new Date(promo.endDate).getTime() < now) return false;
    return true;
  }, []);

  // إيجاد الـ ID بتاع قسم المنتج (عشان نطابقه مع عروض الأقسام)
  const getProductCategoryId = useCallback((product) => {
    if (!product) return null;
    const cat = categories.find(c =>
      (product.category && (c.name.ar === product.category.ar || c.name.en === product.category.en)) ||
      getLocalized(c.name) === getLocalized(product.category)
    );
    return cat ? cat.id : null;
  }, [categories, getLocalized]);

  // نص وصفي للعرض بالعربي والإنجليزي معاً - مولّد من الإعدادات الحقيقية، مش نص ثابت
  const getPromotionLabel = useCallback((promo) => {
    if (!promo) return { ar: '', en: '' };
    switch (promo.type) {
      case 'bxgy':
        return {
          ar: `اشترِ ${promo.buyQty} واحصل على ${promo.freeQty} مجاناً`,
          en: `Buy ${promo.buyQty} Get ${promo.freeQty} Free`
        };
      case 'quantity_discount':
        return {
          ar: `اشترِ ${promo.minQty} واحصل على خصم ${promo.discountPercent}%`,
          en: `Buy ${promo.minQty} Get ${promo.discountPercent}% OFF`
        };
      case 'percentage': {
        const pct = promo.percentage ?? promo.discountPercent;
        const minQ = Number(promo.minQty) || 1;
        return minQ > 1
          ? { ar: `اشترِ ${minQ} أو أكثر واحصل على خصم ${pct}%`, en: `Buy ${minQ}+ and get ${pct}% OFF` }
          : { ar: `خصم ${pct}%`, en: `${pct}% OFF` };
      }
      case 'fixed': {
        const minQ = Number(promo.minQty) || 1;
        return minQ > 1
          ? { ar: `اشترِ ${minQ} أو أكثر واحصل على خصم ${promo.fixedAmount} ج.م`, en: `Buy ${minQ}+ and get ${promo.fixedAmount} EGP OFF` }
          : { ar: `خصم ${promo.fixedAmount} ج.م`, en: `${promo.fixedAmount} EGP OFF` };
      }
      default:
        return { ar: '', en: '' };
    }
  }, []);

  // عتبة الكمية اللي بيبدأ عندها العرض ينطبق (تستخدم في ترتيب التيرز - جزء 4/5)
  const getProductOfferThreshold = useCallback((offer) => {
    if (!offer) return Infinity;
    return offer.type === 'bxgy' ? (Math.max(0, Number(offer.buyQty) || 0)) : (Math.max(1, Number(offer.minQty) || 1));
  }, []);

  // كل عروض المنتج المفعّلة (Product Offers) مرتبة تصاعدياً حسب عتبة الكمية - تستخدم لعرضها كاملة في صفحة المنتج (جزء 21)
  const getActiveProductOffers = useCallback((product) => {
    if (!product || !Array.isArray(product.offers)) return [];
    return product.offers
      .filter(o => o.active)
      .slice()
      .sort((a, b) => getProductOfferThreshold(a) - getProductOfferThreshold(b));
  }, [getProductOfferThreshold]);

  // أعلى تير (Tier) من عروض المنتج المتعددة ينطبق فعلياً على كمية معينة - بدون أي تراكم (جزء 4/5/6)
  const getBestProductOfferForQty = useCallback((product, qty) => {
    const offers = getActiveProductOffers(product);
    if (offers.length === 0) return null;
    const applicable = offers.filter(o => qty >= getProductOfferThreshold(o));
    if (applicable.length === 0) return null;
    // أعلى عتبة منطبقة هي اللي بتفوز - مفيش تراكم بين التيرز
    return applicable.reduce((best, o) => (getProductOfferThreshold(o) > getProductOfferThreshold(best) ? o : best), applicable[0]);
  }, [getActiveProductOffers, getProductOfferThreshold]);

  // أعلى عرض ينطبق على منتج معيّن حسب الأولوية، لكمية معينة (افتراضياً 1):
  // 1) عرض خاص بالمنتج نفسه (أعلى تير منطبق من بين عروض المنتج المتعددة)
  // 2) عرض حملة مستهدف نفس المنتج بالتحديد
  // 3) عرض حملة مستهدف قسم المنتج
  // 4) عرض حملة مستهدف كل المنتجات
  // العرض الأعلى بيمنع اللي بعده تماماً - مفيش تراكم عروض على نفس المنتج أبداً.
  const resolveActivePromotionForProduct = useCallback((product, qty = 1) => {
    if (!product) return null;

    const bestOffer = getBestProductOfferForQty(product, qty);
    if (bestOffer) {
      return {
        id: `product-offer-${product.id}-${bestOffer.id}`,
        source: 'productOffer',
        target: 'product',
        productId: product.id,
        type: bestOffer.type,
        buyQty: bestOffer.buyQty,
        freeQty: bestOffer.freeQty,
        minQty: bestOffer.minQty,
        discountPercent: bestOffer.discountPercent,
        percentage: bestOffer.percentage,
        fixedAmount: bestOffer.fixedAmount,
      };
    }

    const activePromos = promotions.filter(isPromotionCurrentlyActive);
    if (activePromos.length === 0) return null;

    const productTargeted = activePromos.find(p => p.target === 'product' && p.productId === product.id);
    if (productTargeted) return { ...productTargeted, source: 'campaign' };

    const categoryId = getProductCategoryId(product);
    const categoryTargeted = categoryId ? activePromos.find(p => p.target === 'category' && p.categoryId === categoryId) : null;
    if (categoryTargeted) return { ...categoryTargeted, source: 'campaign' };

    const allTargeted = activePromos.find(p => p.target === 'all');
    if (allTargeted) return { ...allTargeted, source: 'campaign' };

    return null;
  }, [promotions, isPromotionCurrentlyActive, getProductCategoryId, getBestProductOfferForQty]);

  // حساب عدد القطع المجانية بشكل حتمي (deterministic) - اشترِ X احصل على Y مجاناً
  const computeBxGyFreeUnits = useCallback((qty, buyQty, freeQty) => {
    const b = Math.max(0, Number(buyQty) || 0);
    const f = Math.max(0, Number(freeQty) || 0);
    const groupSize = b + f;
    if (b <= 0 || f <= 0 || groupSize <= 0 || qty <= 0) return 0;
    const fullGroups = Math.floor(qty / groupSize);
    const remainder = qty % groupSize;
    const freeInRemainder = Math.max(0, remainder - b);
    return fullGroups * f + freeInRemainder;
  }, []);

  // تطبيق عرض معيّن على مجموعة قطع (وحدات) من نفس المنتج الموجودة فعلياً في السلة
  const computePromotionForLine = useCallback((promo, lineItems) => {
    if (!promo || !lineItems || lineItems.length === 0) {
      return { discountAmount: 0, freeCartIds: [], label: { ar: '', en: '' } };
    }
    const qty = lineItems.length;
    const label = getPromotionLabel(promo);

    if (promo.type === 'bxgy') {
      // القطع المجانية محدودة تلقائياً بعدد القطع الموجودة فعلاً بالسلة (اللي أصلاً محكوم بالمخزون المتاح)
      const freeCount = Math.min(computeBxGyFreeUnits(qty, promo.buyQty, promo.freeQty), qty);
      if (freeCount <= 0) return { discountAmount: 0, freeCartIds: [], label: { ar: '', en: '' } };
      // أرخص القطع هي اللي بتبقى مجاناً (الأكثر أماناً وعدلاً للعميل)
      const sorted = [...lineItems].sort((a, b) => a.price - b.price);
      const freeItems = sorted.slice(0, freeCount);
      const discountAmount = freeItems.reduce((s, it) => s + it.price, 0);
      return { discountAmount, freeCartIds: freeItems.map(it => it.cartId), label };
    }

    if (promo.type === 'quantity_discount') {
      if (qty < Math.max(1, Number(promo.minQty) || 0)) return { discountAmount: 0, freeCartIds: [], label: { ar: '', en: '' } };
      const lineSubtotal = lineItems.reduce((s, it) => s + it.price, 0);
      const discountAmount = lineSubtotal * (Math.max(0, Number(promo.discountPercent) || 0) / 100);
      return { discountAmount, freeCartIds: [], label };
    }

    if (promo.type === 'percentage') {
      const pct = Number(promo.percentage) || Number(promo.discountPercent) || 0;
      const lineSubtotal = lineItems.reduce((s, it) => s + it.price, 0);
      const discountAmount = lineSubtotal * (Math.max(0, pct) / 100);
      return { discountAmount, freeCartIds: [], label };
    }

    if (promo.type === 'fixed') {
      const lineSubtotal = lineItems.reduce((s, it) => s + it.price, 0);
      const discountAmount = Math.min(Math.max(0, Number(promo.fixedAmount) || 0), lineSubtotal);
      return { discountAmount, freeCartIds: [], label };
    }

    return { discountAmount: 0, freeCartIds: [], label: { ar: '', en: '' } };
  }, [getPromotionLabel, computeBxGyFreeUnits]);

  // نقطة الدخول الوحيدة لحساب كل عروض السلة دفعة واحدة - بتتجمع كل قطعة حسب المنتج،
  // وبتطبّق عليها أعلى عرض ينطبق (بدون أي تراكم عروض على نفس المنتج).
  const calculateCartPromotions = useCallback((cartItems) => {
    const byProduct = {};
    (cartItems || []).forEach(item => {
      const key = item.id;
      if (!byProduct[key]) byProduct[key] = [];
      byProduct[key].push(item);
    });

    let totalDiscount = 0;
    const freeCartIds = new Set();
    const appliedLines = [];

    Object.keys(byProduct).forEach(pid => {
      const lineItems = byProduct[pid];
      const product = products.find(p => String(p.id) === String(pid));
      if (!product) return;
      const promo = resolveActivePromotionForProduct(product, lineItems.length);
      if (!promo) return;
      const result = computePromotionForLine(promo, lineItems);
      if (result.discountAmount > 0) {
        totalDiscount += result.discountAmount;
        result.freeCartIds.forEach(id => freeCartIds.add(id));
        appliedLines.push({
          productId: product.id,
          productName: getLocalized(product.name),
          label: result.label,
          discountAmount: result.discountAmount
        });
      }
    });

    return { totalDiscount, freeCartIds, appliedLines };
  }, [products, resolveActivePromotionForProduct, computePromotionForLine, getLocalized]);

  // ============================================================
  // حساب إجمالي سلة التسوق
  // ============================================================
  const calculateCartTotals = useCallback(() => {
    const subtotal = Math.round(cart.reduce((acc, item) => acc + item.price, 0) * 100) / 100;
    let discount = 0;
    let discountType = '';
    let promoResult = { totalDiscount: 0, freeCartIds: new Set(), appliedLines: [] };

    if (user && firstOrderDiscountEligible && !firstOrderDiscountUsed) {
      // نفس السلوك القديم بالظبط - خصم أول طلب للعميل الجديد له الأولوية ولا يتراكم مع العروض الترويجية
      const firstOrderPercentage = adminSettings.current.promotions.guestDiscount.percentage;
      discount = subtotal * (firstOrderPercentage / 100);
      discountType = 'first_order';
    } else {
      // محرك العروض الترويجية الحقيقي (Buy X Get Y / خصم كمية / نسبة / مبلغ ثابت)
      promoResult = calculateCartPromotions(cart);
      if (promoResult.totalDiscount > 0) {
        discount = promoResult.totalDiscount;
        discountType = 'promotion';
      }
    }

    if (appliedDiscount) {
      const remainingAfterFirstDiscount = subtotal - discount;
      if (appliedDiscount.isLoyaltyCode) {
        // كود ولاء: نسبة أو مبلغ ثابت
        if (appliedDiscount.fixedAmount) {
          discount += Math.min(appliedDiscount.fixedAmount, remainingAfterFirstDiscount);
        } else {
          discount += remainingAfterFirstDiscount * ((appliedDiscount.discountPercent || 0) / 100);
        }
        discountType = 'loyalty_code';
      } else {
        const codeDiscount = remainingAfterFirstDiscount * (appliedDiscount.discountPercent / 100);
        discount += codeDiscount;
        discountType = 'code';
      }
    }

    const govObj = selectedGov
      ? governorates.find(g => g.name[language] === selectedGov || g.name.ar === selectedGov || g.name.en === selectedGov)
      : null;
    const qualifiesForFreeShipping = subtotal >= adminSettings.current.freeShippingThreshold;
    const selectedRate = shippingRates.find(r => r.provider === selectedShippingProvider && Number.isFinite(Number(r.amount)));
    let shipping = qualifiesForFreeShipping ? 0 : (selectedRate ? Number(selectedRate.amount) : (govObj ? Number(govObj.cost || 0) : 0));
    let shippingDetermined = qualifiesForFreeShipping || !!selectedRate || !!govObj;

    const total = subtotal - discount + (shippingDetermined ? shipping : 0);
    return {
      subtotal, discount, shipping, shippingDetermined, total, discountType,
      promoFreeCartIds: promoResult.freeCartIds,
      promoAppliedLines: promoResult.appliedLines
    };
  }, [cart, user, firstOrderDiscountEligible, firstOrderDiscountUsed, appliedDiscount, governorates, selectedGov, language, calculateCartPromotions, shippingRates, selectedShippingProvider]);

  useEffect(() => {
    if (!selectedCountry) { setShippingRates([]); setSelectedShippingProvider(''); setShippingHasCandidates(false); return; }
    const countryObj = countries.find(c => getLocalized(c.name) === selectedCountry);
    const countryCode = countryObj?.code || '';
    const candidates = Object.values(shippingProviders).filter(p => p.enabled && (!Array.isArray(p.countries) || p.countries.length === 0 || p.countries.includes(countryCode)));
    setShippingHasCandidates(candidates.length > 0);
    if (!candidates.length) { setShippingRates([]); setSelectedShippingProvider(''); return; }
    let cancelled = false;
    setShippingRatesLoading(true);
    shippingAPI.getRates({ country: selectedCountry, countryCode: countryCode, governorate: selectedGov, address: shippingAddress, zipCode: shippingZipCode, customerName: shippingFullName, customerPhone: shippingPhone, totalAmount: cart.reduce((sum,i)=>sum + Number(i.price||0),0), items: cart }).then(data => {
      if (cancelled) return;
      const rates = Array.isArray(data?.rates) ? data.rates.filter(r => !r.error) : [];
      setShippingRates(rates);
      setSelectedShippingProvider(prev => rates.some(r => r.provider === prev) ? prev : (rates[0]?.provider || ''));
    }).catch(err => { if (!cancelled) console.error('Shipping rates:', err); }).finally(() => { if (!cancelled) setShippingRatesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCountry, selectedGov, shippingAddress, shippingZipCode, shippingFullName, shippingPhone, countries, shippingProviders, cart]);

  // لو العميل غيّر طريقة الدفع لـ"الدفع عند الاستلام" وشركة الشحن المختارة
  // حاليًا مش بتدعم COD فعليًا (زي DHL في المشروع ده - مفيش لها COD موثّق)،
  // لازم نلغي اختيارها تلقائيًا بدل ما نسيب طلب متضارب (COD + شركة شحن
  // هتستلم الشحنة كـ"مدفوعة مقدمًا" من غير ما تحصّل فلوس فعليًا).
  useEffect(() => {
    if (checkoutPaymentMethod !== 'cod') return;
    if (!selectedShippingProvider) return;
    const caps = shippingProviders[selectedShippingProvider]?.capabilities;
    if (caps && caps.supportsCOD === false) {
      const nextValid = shippingRates.find(r => shippingProviders[r.provider]?.capabilities?.supportsCOD !== false);
      setSelectedShippingProvider(nextValid?.provider || '');
    }
  }, [checkoutPaymentMethod, selectedShippingProvider, shippingProviders, shippingRates]);

  // بنجيب قائمة كل المحافظات اللي شركات الشحن "manual_rate" (زي Bosta) بتغطيها
  // وأسعارها، عشان تتعرض للعميل في التشيك أوت حتى قبل ما يحدد محافظته -
  // بدل ما القسم يفضل فاضي لحد ما يختار محافظة.
  useEffect(() => {
    if (!selectedCountry) { setShippingCoverage({}); return; }
    const countryObj = countries.find(c => getLocalized(c.name) === selectedCountry);
    const countryCode = countryObj?.code || '';
    const manualProviders = Object.values(shippingProviders).filter(p => p.enabled && p.mode === 'manual_rate' && (!Array.isArray(p.countries) || p.countries.length === 0 || p.countries.includes(countryCode)));
    if (!manualProviders.length) { setShippingCoverage({}); return; }
    let cancelled = false;
    Promise.all(manualProviders.map(p => shippingAPI.getGovernorates(p.key).then(data => [p.key, Array.isArray(data?.governorates) ? data.governorates : []]).catch((err) => { console.error('Shipping coverage fetch failed for', p.key, err); return [p.key, []]; })))
      .then(results => { if (!cancelled) setShippingCoverage(Object.fromEntries(results)); });
    return () => { cancelled = true; };
  }, [selectedCountry, shippingProviders, countries]);

  // ============================================================
  // إدارة العروض الترويجية (Admin → Promotions → Campaigns)
  // ============================================================
  const resetCampaignForm = useCallback(() => {
    setEditingPromotionId(null);
    setNewPromoName('');
    setNewPromoType('bxgy');
    setNewPromoTarget('product');
    setNewPromoProductId(null);
    setNewPromoCategoryId(null);
    setNewPromoBuyQty(2);
    setNewPromoFreeQty(1);
    setNewPromoMinQty(2);
    setNewPromoDiscountPercent(10);
    setNewPromoPercentage(10);
    setNewPromoFixedAmount(50);
    setNewPromoStartDate('');
    setNewPromoEndDate('');
    setCampaignProductSearch('');
    setCampaignFormOpen(false);
  }, []);

  const openNewCampaignForm = useCallback(() => {
    resetCampaignForm();
    setCampaignFormOpen(true);
  }, [resetCampaignForm]);

  const openEditCampaignForm = useCallback((promo) => {
    setEditingPromotionId(promo.id);
    setNewPromoName(promo.name?.ar || promo.name?.en || '');
    setNewPromoType(promo.type);
    setNewPromoTarget(promo.target);
    setNewPromoProductId(promo.productId ?? null);
    setNewPromoCategoryId(promo.categoryId ?? null);
    setNewPromoBuyQty(promo.buyQty ?? 2);
    setNewPromoFreeQty(promo.freeQty ?? 1);
    setNewPromoMinQty(promo.minQty ?? 2);
    setNewPromoDiscountPercent(promo.discountPercent ?? 10);
    setNewPromoPercentage(promo.percentage ?? 10);
    setNewPromoFixedAmount(promo.fixedAmount ?? 50);
    setNewPromoStartDate(promo.startDate ? toDatetimeLocalValue(promo.startDate) : '');
    setNewPromoEndDate(promo.endDate ? toDatetimeLocalValue(promo.endDate) : '');
    setCampaignProductSearch('');
    setCampaignFormOpen(true);
  }, []);

  const saveCampaignPromotion = useCallback(() => {
    if (!newPromoName.trim()) {
      showToast(t('من فضلك ادخل اسم العرض', 'Please enter a promotion name'));
      return;
    }
    if (newPromoTarget === 'product' && !newPromoProductId) {
      showToast(t('من فضلك اختر منتجاً للعرض', 'Please select a product for this promotion'));
      return;
    }
    if (newPromoTarget === 'category' && !newPromoCategoryId) {
      showToast(t('من فضك اختر قسماً للعرض', 'Please select a category for this promotion'));
      return;
    }
    if (newPromoType === 'bxgy' && (Number(newPromoBuyQty) <= 0 || Number(newPromoFreeQty) <= 0)) {
      showToast(t('من فضلك ادخل كمية شراء وكمية مجانية صحيحة', 'Please enter valid buy/free quantities'));
      return;
    }
    if (newPromoType === 'quantity_discount' && (Number(newPromoMinQty) <= 0 || Number(newPromoDiscountPercent) <= 0)) {
      showToast(t('من فضلك ادخل الحد الأدنى للكمية ونسبة الخصم', 'Please enter minimum quantity and discount percentage'));
      return;
    }

    const payload = {
      id: editingPromotionId || Date.now(),
      name: { ar: newPromoName.trim(), en: newPromoName.trim() },
      type: newPromoType,
      target: newPromoTarget,
      productId: newPromoTarget === 'product' ? newPromoProductId : null,
      categoryId: newPromoTarget === 'category' ? newPromoCategoryId : null,
      buyQty: Number(newPromoBuyQty) || 0,
      freeQty: Number(newPromoFreeQty) || 0,
      minQty: Number(newPromoMinQty) || 0,
      discountPercent: Number(newPromoDiscountPercent) || 0,
      percentage: Number(newPromoPercentage) || 0,
      fixedAmount: Number(newPromoFixedAmount) || 0,
      startDate: newPromoStartDate ? new Date(newPromoStartDate).toISOString() : null,
      endDate: newPromoEndDate ? new Date(newPromoEndDate).toISOString() : null,
      active: editingPromotionId ? (promotions.find(p => p.id === editingPromotionId)?.active ?? true) : true,
      createdAt: editingPromotionId ? (promotions.find(p => p.id === editingPromotionId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    const nextPromotions = editingPromotionId
      ? promotions.map(p => p.id === editingPromotionId ? payload : p)
      : [payload, ...promotions];

    setPromotions(nextPromotions);
    saveAdminSettings(
      editingPromotionId
        ? t('تم تحديث العرض بنجاح!', 'Promotion updated successfully!')
        : t('تم إنشاء العرض بنجاح!', 'Promotion created successfully!'),
      { campaigns: nextPromotions }
    );
    resetCampaignForm();
  }, [editingPromotionId, newPromoName, newPromoType, newPromoTarget, newPromoProductId, newPromoCategoryId, newPromoBuyQty, newPromoFreeQty, newPromoMinQty, newPromoDiscountPercent, newPromoPercentage, newPromoFixedAmount, newPromoStartDate, newPromoEndDate, promotions, resetCampaignForm, t, saveAdminSettings]);

  const togglePromotionActive = useCallback((promoId) => {
    const nextPromotions = promotions.map(p => p.id === promoId ? { ...p, active: !p.active } : p);
    setPromotions(nextPromotions);
    saveAdminSettings(t('تم تحديث حالة العرض', 'Promotion status updated'), { campaigns: nextPromotions });
  }, [promotions, t, saveAdminSettings]);

  const deletePromotion = useCallback((promoId) => {
    const nextPromotions = promotions.filter(p => p.id !== promoId);
    setPromotions(nextPromotions);
    saveAdminSettings(t('تم حذف العرض', 'Promotion deleted'), { campaigns: nextPromotions });
    // لو العرض ده كان مرتبط بعرض الترحيب، نفكّه عشان مايفضلش يشاور على عرض محذوف
    if (adminSettings.current.promotions.welcomeOffer.promotionId === promoId) {
      adminSettings.current.promotions.welcomeOffer.promotionId = null;
      bumpSettings();
    }
    showToast(t('تم حذف العرض', 'Promotion deleted'));
  }, [promotions, t, saveAdminSettings, bumpSettings]);

  // ============================================================
  // دوال الخصم
  // ============================================================
  const applyDiscountCode = useCallback(() => {
    if (!discountInput.trim()) {
      showToast(t('من فضلك ادخل كود الخصم', 'Please enter a discount code'));
      return;
    }

    const inputUpper = discountInput.trim().toUpperCase();

    // تحقق من كود الولاء أولاً
    if (user && loyaltyInfo && loyaltyProgram.enabled) {
      const availableLoyaltyCodes = (loyaltyInfo.availableCodes || []);
      const isLoyaltyCode = availableLoyaltyCodes.includes(inputUpper);
      if (isLoyaltyCode) {
        const lp = loyaltyProgram;
        let discountLabel = '';
        if (lp.rewardType === 'percentage') discountLabel = `${lp.rewardValue}%`;
        else if (lp.rewardType === 'fixed') discountLabel = `${lp.rewardValue} ${t('ج.م', 'EGP')}`;
        setAppliedDiscount({
          code: inputUpper,
          discountPercent: lp.rewardType === 'percentage' ? lp.rewardValue : 0,
          fixedAmount: lp.rewardType === 'fixed' ? lp.rewardValue : 0,
          isLoyaltyCode: true,
          specificProductId: lp.specificProductId || null,
        });
        showToast(t(`تم تطبيق كود الولاء! خصم ${discountLabel}`, `Loyalty code applied! ${discountLabel} off`));
        setDiscountInput('');
        return;
      }
    }

    const foundCode = discountCodes.find(
      c => c.code.toUpperCase() === inputUpper && c.isActive
    );

    if (foundCode) {
      // تحقق من حد الاستخدام
      const maxUses = Number(foundCode.maxUses) || 0;
      const usageCount = Number(foundCode.usageCount) || 0;
      if (maxUses > 0 && usageCount >= maxUses) {
        showToast(t('كود الخصم وصل للحد الأقصى من الاستخدام', 'Discount code has reached its usage limit'));
        return;
      }
      // تحقق من المنتج المحدد (لو فيه)
      if (foundCode.specificProductId) {
        const hasSpecificProduct = cart.some(item => String(item.id) === String(foundCode.specificProductId));
        if (!hasSpecificProduct) {
          const specificProduct = products.find(p => String(p.id) === String(foundCode.specificProductId));
          const productName = specificProduct ? getLocalized(specificProduct.name) : t('منتج محدد', 'a specific product');
          showToast(t(`الكود ده يشتغل بس لو ${productName} في العربية`, `This code only works when ${productName} is in the cart`));
          return;
        }
      }
      setAppliedDiscount(foundCode);
      showToast(t(`تم تطبيق كود الخصم ${foundCode.code} بنسبة ${foundCode.discountPercent}%`, `Discount code ${foundCode.code} applied (${foundCode.discountPercent}%)`));
      setDiscountInput('');
    } else {
      showToast(t('كود الخصم غير صحيح أو غير مفعل', 'Invalid or inactive discount code'));
    }
  }, [discountInput, discountCodes, cart, products, t, user, loyaltyInfo, loyaltyProgram]);

  const removeDiscountCode = useCallback(() => {
    setAppliedDiscount(null);
    showToast(t('تم إلغاء كود الخصم', 'Discount code removed'));
  }, [t]);

  // ============================================================
  // دوال الدفع
  // ============================================================
  const handleCheckoutSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (isPlacingOrder) {
      showToast(t('جارٍ معالجة الطلب الحالي...', 'The current order is being processed...'));
      return;
    }
    if (cart.length === 0) {
      showToast(t('عربة التسوق فارغة!', 'Cart is empty!'));
      return;
    }

    // ===== تحقق نهائي من المخزون قبل إتمام الطلب (تحقق الفرونت إند مش بديل عن تحقق السيرفر) =====
    // ملاحظة: بنستخدم Map بمفتاح مركّب (مش نص بيتقسّم بـ split) عشان NO_COLOR_ID
    // نفسه فيه "__" جواه، وده كان بيبوظ الـ split ويدّي size غلط فيسبب رفض
    // خاطئ للطلب حتى لو المخزون متوفر فعلاً.
    {
      const neededMap = new Map();
      for (const item of cart) {
        const key = `${item.id}::${item.variantId || NO_COLOR_ID}::${item.size}`;
        if (neededMap.has(key)) {
          neededMap.get(key).qty += 1;
        } else {
          neededMap.set(key, { qty: 1, productId: item.id, variantId: item.variantId || NO_COLOR_ID, size: item.size });
        }
      }
      for (const { qty, productId, variantId, size } of neededMap.values()) {
        const productRef = products.find(p => String(p.id) === String(productId));
        if (!productRef || (productRef.visibility || 'published') !== 'published') {
          showToast(t('أحد المنتجات في سلتك لم يعد متاحاً، من فضلك راجع السلة', 'One of the items in your cart is no longer available, please review your cart'));
          return;
        }
        const stock = getVariantStock(productRef, variantId, size);
        if (qty > stock) {
          showToast(t(`الكمية المطلوبة من "${getLocalized(productRef.name)}" غير متوفرة بالكامل حالياً`, `The requested quantity of "${getLocalized(productRef.name)}" is no longer fully available`));
          return;
        }
      }
    }

    let finalAddress, finalPhone, finalName;

    if (user && useExistingAddress && hasSavedShipping) {
      finalName = user.savedShipping.fullName;
      finalPhone = user.savedShipping.phone;
      finalAddress = user.savedShipping.address;
    } else {
      finalAddress = shippingCity ? `${shippingCity} - ${shippingAddress}` : shippingAddress;
      finalPhone = shippingPhone;
      finalName = shippingFullName;
    }

    if (!finalAddress || !finalPhone || !finalName) {
      showToast(t('من فضلك أكمل تفاصيل وعنوان الشحن ورقم الهاتف', 'Please complete shipping details and phone number'));
      return;
    }

    // ===== Phase 2: تحقق UX من رقم الهاتف قبل الإرسال (السيرفر هو المرجع الفعلي) =====
    if (!isValidEgyptianPhone(finalPhone)) {
      showToast(t('رقم الهاتف غير صحيح - يجب أن يكون رقم موبايل مصري صالح (مثال: 01012345678)', 'Invalid phone number - must be a valid Egyptian mobile number (e.g. 01012345678)'));
      return;
    }
    if (shippingPhone2 && !(user && useExistingAddress && hasSavedShipping) && !isValidEgyptianPhone(shippingPhone2)) {
      showToast(t('رقم الهاتف الإضافي غير صحيح', 'Additional phone number is invalid'));
      return;
    }

    if (!(user && useExistingAddress && hasSavedShipping) && !shippingCity) {
      showToast(t('من فضلك اكتب اسم المدينة', 'Please enter the city name'));
      return;
    }

    // ===== Phase 2: المنطقة/الحي (District/Area) مطلوبة عشان تحديد العنوان بدقة =====
    if (!(user && useExistingAddress && hasSavedShipping) && !shippingDistrict.trim()) {
      showToast(t('من فضلك اكتب الحي / المنطقة', 'Please enter the district / area'));
      return;
    }

    if (!selectedGov) {
      showToast(t('من فضلك اختر مكان التوصيل لتحديد سعر الشحن وإتمام الطلب', 'Please select your delivery location to calculate shipping and complete the order'));
      return;
    }

    const totals = calculateCartTotals();

    if (!totals.shippingDetermined) {
      showToast(t('من فضلك اختر مكان توصيل صحيح لتحديد سعر الشحن', 'Please select a valid delivery location to calculate shipping'));
      return;
    }

    // ===== تحقق بيانات الدفع الإلكتروني (وسيلة مختارة) =====
    // ملحوظة: كنا قبل كده بنعمل هنا طلب إضافي لسيرفر (GET /settings/public) قبل
    // إرسال الطلب مباشرة، بس لوسيلة الدفع اليدوي (wallet) بس - عشان الـ _id
    // بتاع وسيلة الدفع كان بيتغيّر بشكل عشوائي في كل حفظة إعدادات من الأدمن،
    // فكنا مضطرين نجيب نسخة "طازة" قبل الإرسال علشان مانرجعش "وسيلة الدفع
    // المختارة غير متاحة" غلط. الطلب الإضافي ده كان بيسبب تأخير 3-4 ثواني في
    // إرسال الطلب لما العميل يختار دفع يدوي (إنستاباي/محافظ)، وده مش موجود
    // في باقي وسائل الدفع.
    // دلوقتي المشكلة الأصلية اتصلحت من الجذر في السيرفر (الـ _id بقى ثابت
    // ومطابق فعليًا لللي في الداتابيز دايماً)، فمبقاش فيه داعي للطلب الإضافي
    // ده خالص - الـ _id اللي اتحمّل مع الصفحة من الأول يفضل صحيح ومطابق.

    const paymentSettings = adminSettings.current.paymentSettings || { manualEnabled: true, codEnabled: true, kashierEnabled: false, paymobEnabled: false };
    const paymentMethodsList = adminSettings.current.paymentMethods || [];
    const usingCod = checkoutPaymentMethod === 'cod';
    const usingWallet = checkoutPaymentMethod === 'wallet';
    const usingKashier = checkoutPaymentMethod === 'kashier';
    const usingPaymob = checkoutPaymentMethod === 'paymob';

    // A payment-method switch is a new checkout attempt. Keep the same key only
    // for retries of the same method/attempt (e.g. a network timeout).
    if (checkoutIdempotencyPaymentMethodRef.current !== checkoutPaymentMethod) {
      checkoutIdempotencyKeyRef.current = null;
      checkoutIdempotencyPaymentMethodRef.current = checkoutPaymentMethod;
    }

    const selectedMethod = usingWallet ? paymentMethodsList.find((m) => m._id === selectedWalletMethodId) : null;
    if (paymentSettings.codEnabled === false && !paymentSettings.manualEnabled && !paymentSettings.kashierEnabled && !paymentSettings.paymobEnabled) {
      showToast(t('لا توجد وسيلة دفع متاحة حالياً', 'No payment method is currently available'));
      return;
    }
    if (usingCod && paymentSettings.codEnabled === false) {
      showToast(t('الدفع عند الاستلام غير متاح حالياً', 'Cash on delivery is currently unavailable'));
      return;
    }
    if (usingKashier && !paymentSettings.kashierEnabled) {
      showToast(t('الدفع الإلكتروني غير متاح حالياً', 'Online payment is currently unavailable'));
      return;
    }
    if (usingPaymob && !paymentSettings.paymobEnabled) {
      showToast(t('الدفع الإلكتروني غير متاح حالياً', 'Online payment is currently unavailable'));
      return;
    }
    if (usingWallet) {
      if (!selectedMethod) {
        showToast(t('من فضلك اختر وسيلة الدفع', 'Please select a payment method'));
        return;
      }
      if (selectedMethod.transferDetailsRequired && (!walletSenderPhone.trim() || !walletTransferDate.trim())) {
        showToast(t('من فضلك ادخل رقم التحويل وتاريخه', 'Please enter the transfer phone number and date'));
        return;
      }
      if (selectedMethod.screenshotRequired && !walletScreenshotFile) {
        showToast(t('من فضلك ارفع صورة تأكيد التحويل', 'Please upload the transfer confirmation screenshot'));
        return;
      }
    }

    if (user && saveShippingInfo) {
      const shippingToSave = {
        fullName: finalName,
        phone: finalPhone,
        phone2: shippingPhone2,
        address: finalAddress,
        governorate: selectedGov,
        country: selectedCountry,
        zipCode: shippingZipCode,
        // ===== Phase 2: حقول إضافية اختيارية - بتتحفظ لو العميل ملاها =====
        email: shippingEmail || undefined,
        district: shippingDistrict || undefined,
        detailedAddress: shippingAddress || undefined,
        buildingNumber: shippingBuildingNumber || undefined,
        floor: shippingFloor || undefined,
        apartment: shippingApartment || undefined,
        landmark: shippingLandmark || undefined,
      };
      // ===== حفظ بيانات الشحن في الداتا بيز عشان تفضل موجودة حتى بعد الريفريش =====
      try {
        await authAPI.updateSavedShipping(shippingToSave);
        setUser(prev => ({ ...prev, savedShipping: shippingToSave }));
        setHasSavedShipping(true);
        showToast(t('تم حفظ بيانات الشحن لحسابك!', 'Shipping info saved to your account!'));
      } catch (err) {
        console.error('تعذّر حفظ بيانات الشحن في الحساب:', err);
        showToast(t('حصل خطأ أثناء حفظ بيانات الشحن، الطلب هيكمل عادي بس البيانات مش هتتحفظ لحسابك', 'Could not save shipping info to your account, but your order will still go through'));
      }
    }

    setIsPlacingOrder(true);

    // ===== الطلب دلوقتي بيتبعت للباك اند الحقيقي، وهو اللي بيخصم المخزون في الداتا بيز =====
    const orderPayload = {
      customerName: finalName,
      customerPhone: finalPhone,
      customerPhone2: shippingPhone2,
      // ===== FIX: كان فيه إيميل وهمي 'guest@lava.com' بيتحط لو الزائر سايب
      // الخانة فاضية - ده كان بيخلي order.customerEmail تبقى قيمة وهمية
      // مش فاضية فعليًا، فبيلخبط أي بحث/تصفية بالإيميل في الأدمن من غير أي
      // فايدة (مفيش حد فعلي بيستلم على الإيميل الوهمي ده أصلاً). دلوقتي لو
      // الزائر سايب الخانة فاضية، بتتبعت null بدل الإيميل الوهمي. =====
      customerEmail: user ? user.email : (shippingEmail || null),
      items: cart.map(item => ({
        productId: item.id,
        name: typeof item.name === 'object' ? item.name : { ar: item.name, en: item.name },
        variantId: item.variantId,
        size: item.size,
        price: item.price,
        originalPrice: item.originalPrice || item.price,
        costPrice: item.costPrice ?? 0,
        quantity: 1,
        isBundleItem: item.isBundleItem || false,
        bundleDiscount: item.bundleDiscount || 0,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountType: totals.discountType,
      discountCode: appliedDiscount ? appliedDiscount.code : null,
      promoLabel: (totals.promoAppliedLines && totals.promoAppliedLines.length > 0)
        ? totals.promoAppliedLines.map(l => `${getLocalized(l.label)} (${l.productName})`).join(' | ')
        : null,
      shippingCost: totals.shipping,
      shippingCompany: selectedShippingProvider || null,
      shippingProviderId: selectedShippingProvider || null,
      totalAmount: totals.total,
      governorate: selectedGov,
      country: selectedCountry,
      address: finalAddress,
      zipCode: shippingZipCode,
      // ===== Phase 2: عنوان منظّم عام لكل شركات الشحن (بالإضافة للحقول القديمة فوق) =====
      // الحقول القديمة (governorate/address/zipCode/customerName/customerPhone)
      // فضلت بتتبعت زي ما هي بالظبط عشان مانكسرش أي حاجة شغالة (Bosta/Aramex/
      // DHL لسه بتقرأ منها في هذه المرحلة - هيتم الربط الفعلي في Phase 3).
      shippingAddress: (user && useExistingAddress && hasSavedShipping) ? {
        fullName: finalName,
        phone: finalPhone,
        phone2: shippingPhone2 || null,
        email: user ? user.email : (shippingEmail || null),
        governorate: selectedGov,
        district: user.savedShipping?.district || null,
        detailedAddress: user.savedShipping?.detailedAddress || finalAddress,
        buildingNumber: user.savedShipping?.buildingNumber || null,
        floor: user.savedShipping?.floor || null,
        apartment: user.savedShipping?.apartment || null,
        landmark: user.savedShipping?.landmark || null,
        country: selectedCountry,
        zipCode: shippingZipCode || null,
      } : {
        fullName: finalName,
        phone: finalPhone,
        phone2: shippingPhone2 || null,
        email: user ? user.email : (shippingEmail || null),
        governorate: selectedGov,
        district: shippingDistrict || null,
        detailedAddress: shippingAddress || null,
        buildingNumber: shippingBuildingNumber || null,
        floor: shippingFloor || null,
        apartment: shippingApartment || null,
        landmark: shippingLandmark || null,
        country: selectedCountry,
        zipCode: shippingZipCode || null,
      },
      notes: checkoutNotes || '',
      paymentMethod: usingKashier ? 'kashier' : (usingPaymob ? 'paymob' : (usingWallet ? 'wallet' : 'cod')),
      walletPayment: usingWallet ? {
        methodId: selectedMethod._id,
        senderPhone: walletSenderPhone || '',
        transferDate: walletTransferDate || '',
      } : undefined,
      // status/packerStatus يتم تعيينهما من السيرفر (القيم الافتراضية في الـ Schema)
    };

    // ===== P1-1: مفتاح idempotency ثابت لمحاولة التأكيد دي - بيتولد مرة
    // واحدة بس ويفضل هو هو لو الطلب اتعاد إرساله (retry بعد فشل/timeout)،
    // عشان الباك اند يمنع إنشاء طلب مكرر. بيتصفّر بعد نجاح فعلي تحت.
    if (!checkoutIdempotencyKeyRef.current) {
      checkoutIdempotencyKeyRef.current = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    let savedOrder;
    try {
      savedOrder = await ordersAPI.create(orderPayload, usingWallet ? walletScreenshotFile : null, checkoutIdempotencyKeyRef.current);
      // نجح إنشاء الطلب فعليًا - أي محاولة تأكيد جاية بعد كده لازم تاخد
      // مفتاح جديد (طلب مختلف)، مش تعيد استخدام مفتاح طلب خلص بنجاح.
      checkoutIdempotencyKeyRef.current = null;
      checkoutIdempotencyPaymentMethodRef.current = null;
    } catch (err) {
      // لو السيرفر رجّع سبب واضح (مثلاً الكمية نفدت لحظة تنفيذ الطلب)، نعرضه للعميل بدل رسالة عامة
      const serverMessage = err?.response?.data?.message;
      showToast(serverMessage || t('حصل خطأ في إرسال الطلب، حاول تاني', 'Something went wrong placing the order, please try again'));
      return;
    } finally {
      setIsPlacingOrder(false);
    }

    // Kashier/Paymob are hosted checkouts: create the order first, then leave
    // the store for the gateway. Payment confirmation comes back through the
    // server webhook/status API.
    if ((usingKashier || usingPaymob) && savedOrder?.paymentUrl) {
      setLastOrderId(savedOrder._id);
      setLastOrderNumber(savedOrder.orderNumber || null);
      orderJustCompletedRef.current = true;
      setCart([]);
      abandonedCartAPI.markRecovered(sessionIdRef.current);
      trafficAPI.markConverted(sessionIdRef.current, savedOrder._id, savedOrder.totalAmount, visitorIdRef.current);
      setShippingFullName('');
      setShippingPhone('');
      setShippingPhone2('');
      setShippingAddress('');
      setShippingCity('');
      setShippingZipCode('');
      setSaveShippingInfo(false);
      setCheckoutNotes('');
      setCheckoutPaymentMethod('cod');
      setSelectedWalletMethodId(null);
      setWalletSenderPhone('');
      setWalletTransferDate('');
      setWalletScreenshotFile(null);
      setWalletScreenshotPreview('');
      setIsPlacingOrder(false);
      window.location.assign(savedOrder.paymentUrl);
      return;
    }

    setOrders(prev => [{ ...savedOrder, id: savedOrder._id }, ...prev]);

    // ===== نظام الولاء: عرض كود المكافأة لو استحق =====
    if (savedOrder.loyaltyReward && savedOrder.loyaltyReward.earned) {
      setLoyaltyRewardModal(savedOrder.loyaltyReward);
      // تحديث loyaltyInfo
      setLoyaltyInfo(prev => prev ? {
        ...prev,
        orderCount: savedOrder.loyaltyReward.orderCount,
        availableCodes: [...(prev.availableCodes || []), savedOrder.loyaltyReward.code],
      } : null);
    } else if (loyaltyInfo) {
      // تحديث العداد
      setLoyaltyInfo(prev => prev ? {
        ...prev,
        orderCount: (prev.orderCount || 0) + 1,
        nextRewardIn: prev.nextRewardIn ? prev.nextRewardIn - 1 : null,
      } : null);
    }
    // لو استخدم كود خصم عادي، زوّد عداد الاستخدام
    if (appliedDiscount && !appliedDiscount.isLoyaltyCode) {
      const nextDiscountCodes = discountCodes.map(c =>
        c.id === appliedDiscount.id ? { ...c, usageCount: (Number(c.usageCount) || 0) + 1 } : c
      );
      setDiscountCodes(nextDiscountCodes);
      saveAdminSettings(null, { discountCodes: nextDiscountCodes });
    }
    // لو استخدم كود ولاء، ابعته من القايمة المتاحة
    if (appliedDiscount && appliedDiscount.isLoyaltyCode) {
      setLoyaltyInfo(prev => prev ? {
        ...prev,
        availableCodes: (prev.availableCodes || []).filter(c => c !== appliedDiscount.code),
        usedCodes: [...(prev.usedCodes || []), appliedDiscount.code],
      } : null);
    }

    // ===== Pixel: Purchase =====
    fireEvent('Purchase', {
      orderId: savedOrder._id || '',
      value: savedOrder.totalAmount || 0,
      currency: 'EGP',
      quantity: cart.reduce((total, item) => total + (item.quantity || 1), 0),
      eventId: savedOrder._id || '',
      items: cart.map((item) => ({
        item_id: item.sku || item.productId || item.id || '',
        item_name: item?.name?.ar || item?.name?.en || '',
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
      })),
    });
    // ===== Funnel: Purchase =====
    trafficAPI.trackFunnel(visitorIdRef.current, sessionIdRef.current, 'purchase');
    refreshActivity();

    // ===== نحدّث المنتجات من السيرفر عشان نعرض المخزون الحقيقي بعد الخصم =====
    try {
      const freshProducts = await productsAPI.getAll();
      setProducts(freshProducts);
    } catch (err) {
      console.error('تعذّر تحديث المنتجات بعد الطلب:', err);
    }

    setAppliedDiscount(null);
    setLastOrderId(savedOrder._id);
    setLastOrderNumber(savedOrder.orderNumber || null);
    setLastOrderPaymentMethod(usingWallet ? 'wallet' : 'cod');
    
    if (user && firstOrderDiscountEligible) {
      setFirstOrderDiscountUsed(true);
      setFirstOrderDiscountEligible(false);
    }
    
    setCart([]);
    // نعلّم السلة المتروكة كمتعافية
    orderJustCompletedRef.current = true;
    abandonedCartAPI.markRecovered(sessionIdRef.current);
    // نربط الزيارة بالأوردر في إحصائيات الترافيك
    trafficAPI.markConverted(sessionIdRef.current, savedOrder._id, savedOrder.totalAmount, visitorIdRef.current);
    
    setShippingFullName('');
    setShippingPhone('');
    setShippingPhone2('');
    setShippingAddress('');
    setShippingCity('');
    setShippingZipCode('');
    setSaveShippingInfo(false);
    setCheckoutNotes('');
    setCheckoutPaymentMethod('cod');
    setSelectedWalletMethodId(null);
    setWalletSenderPhone('');
    setWalletTransferDate('');
    setWalletScreenshotFile(null);
    setWalletScreenshotPreview('');
    
    goTo('order-confirmation');
    
    showToast(t('تم إرسال طلبك بنجاح! 🎉', 'Order placed successfully! 🎉'));
  }, [cart, user, useExistingAddress, hasSavedShipping, shippingAddress, shippingCity, shippingPhone, shippingFullName, shippingPhone2, selectedGov, selectedCountry, shippingZipCode, shippingDistrict, shippingBuildingNumber, shippingFloor, shippingApartment, shippingLandmark, shippingEmail, saveShippingInfo, checkoutNotes, calculateCartTotals, appliedDiscount, firstOrderDiscountEligible, t, language, isPlacingOrder, fireEvent, checkoutPaymentMethod, selectedWalletMethodId, walletSenderPhone, walletTransferDate, walletScreenshotFile]);

  // ============================================================
  // دوال التواصل
  // ============================================================
  const handleContactSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!contactName || !contactPhone || !contactMsg) {
      showToast(t('من فضلك املأ جميع الحقول', 'Please fill in all fields'));
      return;
    }

    try {
      const saved = await settingsAPI.addContactMessage({
        name: contactName,
        phone: contactPhone,
        message: contactMsg,
      });
      const newMsg = saved?.message || saved || {
        id: Date.now(),
        name: contactName,
        phone: contactPhone,
        message: contactMsg,
        date: new Date().toISOString(),
      };

      setContactMessages(prev => [newMsg, ...prev.filter(msg => msg.id !== newMsg.id)]);
      setContactName('');
      setContactPhone('');
      setContactMsg('');
      showToast(t('تم إرسال رسالتك للإدارة بنجاح!', 'Your message has been sent to admin!'));
    } catch (err) {
      console.error('Failed to save contact message:', err);
      showToast(err?.message || t('حدث خطأ أثناء إرسال الرسالة', 'Something went wrong while sending the message'));
    }
  }, [contactName, contactPhone, contactMsg, t, showToast]);

  // ============================================================
  // دوال رفع ومعاينة صور المنتج
  // ============================================================
  const handleProductImageUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const previewUrl = URL.createObjectURL(file);
      setNewProdImageFiles(prev => [
        ...prev,
        { id: Date.now() + Math.random(), dataUrl: previewUrl, file, name: file.name, sourceType: 'local' }
      ]);
    });
    e.target.value = '';
  }, []);

  // ===== رفع صورة بوب أب عرض الترحيب عبر Cloudinary (بدون تحويل نصي للصورة) =====
  const handleWelcomeOfferImageUpload = useCallback(async (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;

    try {
      const uploaded = await settingsAPI.uploadImage(file);
      adminSettings.current.promotions.welcomeOffer.image = uploaded?.url || '';
      bumpSettings();
      showToast(t('تم رفع صورة عرض الترحيب بنجاح', 'Welcome offer image uploaded successfully'));
    } catch (err) {
      console.error('Welcome offer image upload failed:', err);
      showToast(err?.message || t('فشل رفع الصورة', 'Image upload failed'));
    }
  }, [bumpSettings, showToast, t]);

  const removeProductImage = useCallback((id) => {
    setNewProdImageFiles(prev => prev.filter(img => img.id !== id));
  }, []);

  const setProductImageAsPrimary = useCallback((id) => {
    setNewProdImageFiles(prev => {
      const target = prev.find(img => img.id === id);
      if (!target) return prev;
      return [target, ...prev.filter(img => img.id !== id)];
    });
  }, []);

  const handleImageDragStart = useCallback((id) => {
    setDraggedImageId(id);
  }, []);

  const handleImageDrop = useCallback((targetId) => {
    setNewProdImageFiles(prev => {
      if (draggedImageId === null || draggedImageId === targetId) return prev;
      const fromIndex = prev.findIndex(img => img.id === draggedImageId);
      const toIndex = prev.findIndex(img => img.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggedImageId(null);
  }, [draggedImageId]);

  // ============================================================
  // دوال إدارة صور الألوان (كل لون ممكن ياخد أكتر من صورة، بلا حد أقصى)
  // ============================================================
  const handleColorImageUpload = useCallback((colorId, fileList) => {
    const files = Array.from(fileList || []);
    files.forEach(file => {
      const previewUrl = URL.createObjectURL(file);
      setNewProdColorImages(prev => ({
        ...prev,
        [colorId]: [
          ...(prev[colorId] || []),
          { id: `${Date.now()}_${Math.random()}`, dataUrl: previewUrl, file, name: file.name, sourceType: 'local' }
        ]
      }));
    });
  }, []);

  const removeColorImage = useCallback((colorId, imgId) => {
    setNewProdColorImages(prev => ({ ...prev, [colorId]: (prev[colorId] || []).filter(img => img.id !== imgId) }));
  }, []);

  const setColorImageAsPrimary = useCallback((colorId, imgId) => {
    setNewProdColorImages(prev => {
      const list = prev[colorId] || [];
      const target = list.find(img => img.id === imgId);
      if (!target) return prev;
      return { ...prev, [colorId]: [target, ...list.filter(img => img.id !== imgId)] };
    });
  }, []);

  const moveColorImage = useCallback((colorId, imgId, direction) => {
    setNewProdColorImages(prev => {
      const list = [...(prev[colorId] || [])];
      const index = list.findIndex(img => img.id === imgId);
      if (index === -1) return prev;
      const newIndex = direction === 'left' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= list.length) return prev;
      [list[index], list[newIndex]] = [list[newIndex], list[index]];
      return { ...prev, [colorId]: list };
    });
  }, []);

  const handleColorImageDragStart = useCallback((colorId, imgId) => {
    setDraggedColorImageKey({ colorId, imgId });
  }, []);

  const handleColorImageDrop = useCallback((colorId, targetImgId) => {
    setNewProdColorImages(prev => {
      if (!draggedColorImageKey || draggedColorImageKey.colorId !== colorId || draggedColorImageKey.imgId === targetImgId) return prev;
      const list = [...(prev[colorId] || [])];
      const fromIndex = list.findIndex(img => img.id === draggedColorImageKey.imgId);
      const toIndex = list.findIndex(img => img.id === targetImgId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return { ...prev, [colorId]: list };
    });
    setDraggedColorImageKey(null);
  }, [draggedColorImageKey]);

  // ============================================================
  // دوال إدارة المنتجات
  // ============================================================
  // ===== إعادة ضبط نموذج المنتج بالكامل (لإضافة منتج جديد) =====
  const resetProductForm = useCallback(() => {
    setNewProdNameAr(''); setNewProdNameEn('');
    setNewProdPrice(''); setNewProdCost('');
    setNewProdCat(''); setNewProdImgs(''); setNewProdImageFiles([]); setNewProdVideo(null);
    setNewProdDescAr(''); setNewProdDescEn('');
    setNewProdOnSale(false); setNewProdSalePrice(''); setNewProdPermanentSalePrice('');
    setNewProdIsFeatured(false); setNewProdEnableRec(true); setNewProdEnableBundle(true); setNewProdEnableReviews(true);
    setNewProdVisibility('published'); setNewProdLowStockThreshold('');
    setNewProdHasSizes(true); setNewProdSelectedSizes(['S', 'M', 'L', 'XL']); setNewProdCustomSize('');
    setNewProdHasColors(false); setNewProdColors([]);
    setNewProdColorNameAr(''); setNewProdColorNameEn(''); setNewProdColorHex('#000000');
    setNewProdVariantsGenerated(null); setNewProdVariantStockInputs({});
    setNewProdColorImages({});
    setNewProdSlug(''); setNewProdMetaTitleAr(''); setNewProdMetaTitleEn(''); setNewProdMetaDescAr(''); setNewProdMetaDescEn('');
    setNewProdMetaKeywordsAr(''); setNewProdMetaKeywordsEn('');
  }, []);

  // ===== فتح نموذج "إضافة منتج جديد" (فاضي تماماً) =====
  const openAddProduct = useCallback(() => {
    resetProductForm();
    setSelectedManagedProductId(null);
    setProductEditorTab('basic');
    setProductManagerMode('add');
  }, [resetProductForm]);

  // ===== فتح منتج موجود للتعديل (لازم اختيار صريح من الأدمن) =====
  const openEditProduct = useCallback((product) => {
    resetProductForm();
    setNewProdNameAr(product.name?.ar || '');
    setNewProdNameEn(product.name?.en || '');
    setNewProdPrice(product.price ?? '');
    setNewProdCost(product.costPrice ?? '');
    setNewProdCat(getLocalized(product.category) || '');
    const normalizedImages = (product.images || []).map((img, i) => {
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object') return img.url || '';
      return '';
    }).filter(Boolean);
    setNewProdImageFiles(normalizedImages.map((url, i) => ({ id: `existing_${i}_${Date.now()}`, dataUrl: url, name: '', sourceType: 'remote' })));
    setNewProdVideo(product.video && product.video.url ? product.video : null);
    setNewProdDescAr(product.description?.ar || '');
    setNewProdDescEn(product.description?.en || '');
    setNewProdOnSale(!!product.onSale);
    setNewProdSalePrice(product.salePrice ?? '');
    setNewProdPermanentSalePrice(product.permanentSalePrice ?? '');
    setNewProdIsFeatured(!!product.isFeatured);
    setNewProdEnableRec(product.enableRecommendations !== undefined ? product.enableRecommendations : true);
    setNewProdEnableBundle(product.enableBundle !== undefined ? product.enableBundle : true);
    setNewProdEnableReviews(product.enableReviews !== undefined ? product.enableReviews : true);
    setNewProdVisibility(product.visibility || 'published');
    setNewProdLowStockThreshold(product.lowStockThreshold !== undefined && product.lowStockThreshold !== null ? String(product.lowStockThreshold) : '');
    setNewProdHasSizes(Array.isArray(product.sizes) && product.sizes.length > 0);
    setNewProdSelectedSizes(product.sizes && product.sizes.length ? product.sizes : ['S', 'M', 'L', 'XL']);

    const variants = getVariants(product);
    const hasColors = variants.some(v => v.color);
    setNewProdHasColors(hasColors);
    const colorsList = hasColors ? variants.filter(v => v.color).map(v => ({ id: v.id, nameAr: v.color?.ar || '', nameEn: v.color?.en || '', hex: v.hex || '#000000' })) : [];
    setNewProdColors(colorsList);

    // تحميل صور كل لون
    const colorImagesMap = {};
    variants.forEach(v => {
      if (v.color && Array.isArray(v.images) && v.images.length > 0) {
        const normalizedVariantImages = v.images.map((img, i) => {
          if (typeof img === 'string') return img;
          if (img && typeof img === 'object') return img.url || '';
          return '';
        }).filter(Boolean);
        colorImagesMap[v.id] = normalizedVariantImages.map((url, i) => ({ id: `existing_${v.id}_${i}`, dataUrl: url, name: '', sourceType: 'remote' }));
      }
    });
    setNewProdColorImages(colorImagesMap);

    // تحميل جدول الفاريانتس (لون × مقاس) + المخزون الحالي
    // sizeStock: Array of { size, sku, stock } — canonical format
    const combos = [];
    const stockInputs = {};
    variants.forEach(v => {
      const sizeStockArray = getSizeStockArray(v);
      sizeStockArray.forEach(entry => {
        const size = entry.size;
        const key = `${v.id}__${size}`;
        combos.push({ key, colorId: v.id, colorLabel: v.color ? (v.color.ar || v.color.en) : null, hex: v.hex, size });
        stockInputs[key] = { sku: entry.sku || '', stock: entry.stock || 0 };
      });
    });
    setNewProdVariantsGenerated(combos);
    setNewProdVariantStockInputs(stockInputs);

    setNewProdSlug(product.slug || '');
    setNewProdMetaTitleAr(product.metaTitle?.ar || '');
    setNewProdMetaTitleEn(product.metaTitle?.en || '');
    setNewProdMetaDescAr(product.metaDescription?.ar || '');
    setNewProdMetaDescEn(product.metaDescription?.en || '');
    setNewProdMetaKeywordsAr(product.metaKeywords?.ar || '');
    setNewProdMetaKeywordsEn(product.metaKeywords?.en || '');

    setSelectedManagedProductId(product.id);
    setProductEditorTab('basic');
    setProductManagerMode('edit');
  }, [resetProductForm, getLocalized]);

  const closeProductEditor = useCallback((skipConfirm) => {
    if (!skipConfirm && productEditorDirty) {
      const ok = window.confirm(t('في تعديلات لسه مش محفوظة. تأكيد الخروج بدون حفظ؟', 'You have unsaved changes. Leave without saving?'));
      if (!ok) return;
    }
    resetProductForm();
    setSelectedManagedProductId(null);
    setProductManagerMode('closed');
    setProductEditorDirty(false);
  }, [productEditorDirty, resetProductForm, t]);

  const duplicateProduct = useCallback((product) => {
    // مهم: لازم نشيل _id/id بتوع المنتج الأصلي قبل النسخ، وإلا هيتبعتوا مع الطلب الجديد
    // والسيرفر هيحاول يعمل منتج جديد بنفس الـ _id بتاع المنتج الأصلي فيرفض الطلب (duplicate key).
    const { _id, id: _oldId, ...productWithoutIds } = product;
    const copy = {
      ...productWithoutIds,
      name: { ar: `${product.name?.ar || ''} (نسخة)`, en: `${product.name?.en || ''} (Copy)` },
      visibility: 'draft',
      // IMPORTANT: يجب إزالة `_id` من الفاريانتات المنسوخة حتى يولّد Mongo معرفات جديدة
      // (لو اتساب نفس `_id`، الـ stock lookup في الطلبات هيحصل كوليشن مع المنتج الأصلي).
      variants: getVariants(product).map(v => {
        const { _id, ...rest } = v;
        return { ...rest, id: `${v.id}_copy_${Date.now()}`, images: [...(v.images || [])], sizeStock: getSizeStockArray(v).map(s => ({ ...s })) };
      })
    };
    (async () => {
      try {
        await productsAPI.create(copy, []);
        const fresh = await productsAPI.getAllAdmin();
        setProducts(fresh);
        showToast(t('تم نسخ المنتج (كمسودة).', 'Product duplicated (as draft).'));
      } catch (err) {
        const msg = err?.response?.data?.message;
        showToast(msg || t('حصل خطأ في نسخ المنتج', 'Error duplicating product'));
      }
    })();
  }, [showToast, t]);

  const deleteProduct = useCallback(async (productId) => {
    try {
      await productsAPI.remove(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      if (selectedManagedProductId === productId) closeProductEditor(true);
      setConfirmDeleteProductId(null);
      showToast(t('تم حذف المنتج.', 'Product deleted.'));
    } catch (err) {
      showToast(t('حصل خطأ في حذف المنتج', 'Error deleting product'));
    }
  }, [selectedManagedProductId, closeProductEditor, showToast, t]);

  // ===== توليد قائمة الفاريانتس (لون × مقاس) لعرضها في نموذج إضافة منتج =====
  const generateVariantsPreview = useCallback(() => {
    const sizes = newProdHasSizes && newProdSelectedSizes.length > 0 ? newProdSelectedSizes : ['واحد'];
    const colors = newProdHasColors ? newProdColors : [{ id: NO_COLOR_ID, nameAr: '', nameEn: '', hex: null }];
    const combos = [];
    colors.forEach(c => {
      sizes.forEach(size => {
        const key = `${c.id}__${size}`;
        combos.push({
          key,
          colorId: c.id,
          colorLabel: newProdHasColors ? (c.nameAr || c.nameEn || c.hex) : null,
          hex: c.hex,
          size
        });
      });
    });
    setNewProdVariantsGenerated(combos);
    setNewProdVariantStockInputs(prev => {
      const next = { ...prev };
      combos.forEach(combo => {
        if (!next[combo.key]) {
          next[combo.key] = { sku: generateSKU({ name: { en: newProdNameEn || newProdNameAr } }, combo.colorLabel, combo.size), stock: 0 };
        }
      });
      return next;
    });
  }, [newProdHasSizes, newProdSelectedSizes, newProdHasColors, newProdColors, newProdNameEn, newProdNameAr]);

  const handleSaveProduct = useCallback(async (e) => {
    e.preventDefault();
    if (isSavingProduct) {
      showToast(t('جارٍ حفظ المنتج الحالي...', 'The current product save is already in progress...'));
      return;
    }
    window.__lavaDebugSaveState = {
      newProdImageFiles,
      newProdImgs,
      newProdNameAr,
      newProdNameEn,
      newProdPrice,
      newProdCost,
      newProdDescAr,
      newProdDescEn,
    };
    let finalImages; // روابط URL جاهزة (لو الأدمن حط روابط بدل رفع ملفات)
    let imageFilesToUpload = []; // ملفات هترفع فعلياً عن طريق الباك اند إلى Cloudinary
    if (newProdImageFiles.length > 0) {
      finalImages = newProdImageFiles.filter(f => f.sourceType === 'remote').map(f => f.dataUrl);
      imageFilesToUpload = newProdImageFiles
        .filter(f => f.sourceType === 'local' && f.file)
        .map(f => f.file);
    } else {
      const imagesArray = newProdImgs.split('\n').map(img => img.trim()).filter(Boolean);
      finalImages = imagesArray.length > 0 ? imagesArray : [newProdImgs.trim()];
    }
    if (imageFilesToUpload.length === 0 && !finalImages[0]) {
      showToast(t('من فضلك ارفع صورة أو ادخل رابط صورة صحيح', 'Please upload an image or enter a valid image URL'));
      return;
    }
    if (!newProdNameAr.trim() && !newProdNameEn.trim()) {
      showToast(t('من فضلك ادخل اسم المنتج بالعربية أو الإنجليزية', 'Please enter product name in Arabic or English'));
      return;
    }

    setIsSavingProduct(true);

    const sizes = newProdHasSizes && newProdSelectedSizes.length > 0 ? newProdSelectedSizes : ['واحد'];
    const combos = newProdVariantsGenerated && newProdVariantsGenerated.length > 0
      ? newProdVariantsGenerated
      : (() => {
          // لو الأدمن ماضغطش "توليد الفاريانتس"، نولدها تلقائي بمخزون صفر
          const colors = newProdHasColors ? newProdColors : [{ id: NO_COLOR_ID, nameAr: '', nameEn: '', hex: null }];
          const list = [];
          colors.forEach(c => sizes.forEach(size => list.push({ key: `${c.id}__${size}`, colorId: c.id, colorLabel: newProdHasColors ? (c.nameAr || c.nameEn || c.hex) : null, hex: c.hex, size })));
          return list;
        })();

    // تجميع الفاريانتس بحسب اللون
    const colorGroups = {};
    combos.forEach(combo => {
      if (!colorGroups[combo.colorId]) colorGroups[combo.colorId] = [];
      colorGroups[combo.colorId].push(combo);
    });

    const variants = Object.keys(colorGroups).map(colorId => {
      const groupCombos = colorGroups[colorId];
      const colorInfo = newProdHasColors ? newProdColors.find(c => c.id === colorId) : null;
      // ===== Canonical sizeStock: Array of { size, sku, stock } =====
      const sizeStock = groupCombos.map(combo => {
        const stockInput = newProdVariantStockInputs[combo.key];
        return {
          size: combo.size,
          sku: stockInput?.sku || generateSKU({ name: { en: newProdNameEn || newProdNameAr } }, combo.colorLabel, combo.size),
          stock: Math.max(0, Number(stockInput?.stock) || 0)
        };
      });
      // الصور اللي عندها رابط حقيقي بالفعل (remote) بتفضل زي ما هي - الصور الجديدة (local) هترفع بعد حفظ المنتج
      const colorImgsEntries = newProdColorImages[colorId] || [];
      const remoteColorImages = colorImgsEntries.filter(f => f.sourceType === 'remote').map(f => f.dataUrl);
      return {
        id: colorId,
        color: colorInfo ? { ar: colorInfo.nameAr || colorInfo.hex, en: colorInfo.nameEn || colorInfo.hex } : null,
        hex: colorInfo ? colorInfo.hex : null,
        images: remoteColorImages,
        sizeStock
      };
    });

    // الصور الجديدة (لسه ملفات محلية) لكل لون - هترفع فعلياً على R2 بعد ما المنتج يتحفظ
    const variantLocalFilesByIndex = Object.keys(colorGroups).map(colorId => {
      const colorImgsEntries = newProdColorImages[colorId] || [];
      return colorImgsEntries
        .filter(f => f.sourceType === 'local' && f.file)
        .map(f => f.file);
    });

    const isEditing = productManagerMode === 'edit' && selectedManagedProductId !== null;
    const editingProductSnapshot = isEditing ? products.find(p => p.id === selectedManagedProductId) : null;
    const productPayload = {
      name: { ar: newProdNameAr.trim() || newProdNameEn.trim(), en: newProdNameEn.trim() || newProdNameAr.trim() },
      price: Number(newProdPrice),
      costPrice: Number(newProdCost),
      description: { ar: newProdDescAr.trim() || newProdDescEn.trim(), en: newProdDescEn.trim() || newProdDescAr.trim() },
      images: finalImages,
      video: newProdVideo || null,
      sizes: sizes,
      colors: newProdHasColors ? newProdColors.map(c => c.hex) : [],
      variants: variants,
      visibility: newProdVisibility,
      lowStockThreshold: newProdLowStockThreshold === '' ? undefined : Number(newProdLowStockThreshold),
      category: { ar: newProdCat || '', en: newProdCat || '' },
      onSale: newProdOnSale,
      salePrice: newProdOnSale && newProdSalePrice ? Number(newProdSalePrice) : null,
      permanentSalePrice: (newProdPermanentSalePrice && Number(newProdPermanentSalePrice) > 0) ? Number(newProdPermanentSalePrice) : null,
      isFeatured: newProdIsFeatured,
      recommendedIds: Array.isArray(editingProductSnapshot?.recommendedIds) ? editingProductSnapshot.recommendedIds : [],
      bundle: editingProductSnapshot?.bundle ? { productIds: Array.isArray(editingProductSnapshot.bundle.productIds) ? editingProductSnapshot.bundle.productIds : [], discountPercent: Number(editingProductSnapshot.bundle.discountPercent) || 0 } : { productIds: [], discountPercent: 0 },
      enableRecommendations: newProdEnableRec,
      enableBundle: newProdEnableBundle,
      enableReviews: newProdEnableReviews,
      offers: Array.isArray(editingProductSnapshot?.offers) ? editingProductSnapshot.offers : [],
      slug: newProdSlug.trim() || undefined,
      metaTitle: (newProdMetaTitleAr.trim() || newProdMetaTitleEn.trim()) ? { ar: newProdMetaTitleAr.trim(), en: newProdMetaTitleEn.trim() } : undefined,
      metaDescription: (newProdMetaDescAr.trim() || newProdMetaDescEn.trim()) ? { ar: newProdMetaDescAr.trim(), en: newProdMetaDescEn.trim() } : undefined,
      metaKeywords: (newProdMetaKeywordsAr.trim() || newProdMetaKeywordsEn.trim()) ? { ar: newProdMetaKeywordsAr.trim(), en: newProdMetaKeywordsEn.trim() } : undefined,
    };

    try {
      let savedProduct;
      if (isEditing) {
        if (!selectedManagedProductId) {
          showToast(t('خطأ داخلي: معرّف المنتج غير معروف.', 'Internal error: missing product ID.'));
          return;
        }
        savedProduct = await productsAPI.update(selectedManagedProductId, productPayload, imageFilesToUpload);
        showToast(t('تم تحديث المنتج بنجاح!', 'Product updated successfully!'));
      } else {
        savedProduct = await productsAPI.create(productPayload, imageFilesToUpload);
        showToast(t('تم إضافة المنتج بنجاح!', 'Product added successfully!'));
      }

      // رفع صور الألوان الجديدة فعلياً على R2 (لكل فاريانت لوحده، بنفس ترتيب الإنشاء)
      const productIdForVariants = savedProduct.id;
      for (let i = 0; i < variantLocalFilesByIndex.length; i++) {
        if (variantLocalFilesByIndex[i].length > 0) {
          await productsAPI.uploadVariantImages(productIdForVariants, i, variantLocalFilesByIndex[i]);
        }
      }

      const fresh = await productsAPI.getAllAdmin();
      setProducts(fresh);
    } catch (err) {
      const msg = err?.response?.data?.message;
      showToast(msg || t('حصل خطأ في حفظ المنتج', 'Error saving product'));
      return;
    } finally {
      setIsSavingProduct(false);
    }

    resetProductForm();
    setSelectedManagedProductId(null);
    setProductManagerMode('closed');
    setProductEditorDirty(false);
  }, [newProdNameAr, newProdNameEn, newProdPrice, newProdCost, newProdCat, newProdImgs, newProdImageFiles, newProdVideo, newProdDescAr, newProdDescEn, newProdOnSale, newProdSalePrice, newProdPermanentSalePrice, newProdIsFeatured, newProdEnableRec, newProdEnableBundle, newProdEnableReviews, newProdHasSizes, newProdSelectedSizes, newProdHasColors, newProdColors, newProdColorImages, newProdVariantsGenerated, newProdVariantStockInputs, newProdVisibility, newProdLowStockThreshold, newProdSlug, newProdMetaTitleAr, newProdMetaTitleEn, newProdMetaDescAr, newProdMetaDescEn, newProdMetaKeywordsAr, newProdMetaKeywordsEn, productManagerMode, selectedManagedProductId, resetProductForm, t, isSavingProduct, products]);

  // ============================================================
  // فلترة المنتجات
  // ============================================================
  const filteredProducts = useCallback(() => {
    return products.filter(p => {
      if (!isProductVisibleToCustomer(p)) return false;
      const pName = getLocalized(p.name).toLowerCase();
      const matchesSearch = pName.startsWith(searchQuery.toLowerCase()) ||
                            pName.includes(searchQuery.toLowerCase());
      const pCategory = getLocalized(p.category);
      const matchesCategory = selectedCategoryFilter === 'all' || pCategory === selectedCategoryFilter;

      const effectivePrice = getEffectivePrice(p);
      const matchesMinPrice = filterMinPrice === '' || effectivePrice >= Number(filterMinPrice);
      const matchesMaxPrice = filterMaxPrice === '' || effectivePrice <= Number(filterMaxPrice);

      const matchesSize = filterSizes.length === 0 || (p.sizes && p.sizes.some(s => filterSizes.includes(s)));

      const matchesColor = !filterColor || (p.colors && p.colors.includes(filterColor));

      const matchesSale = !filterOnSaleOnly || (p.onSale && isSaleActive());

      const matchesFeatured = !filterFeaturedOnly || !!p.isFeatured;

      return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice && matchesSize && matchesColor && matchesSale && matchesFeatured;
    });
  }, [products, searchQuery, selectedCategoryFilter, getLocalized, filterMinPrice, filterMaxPrice, filterSizes, filterColor, filterOnSaleOnly, filterFeaturedOnly]);

  // ===== جلب صفحة منتجات المتجر من السيرفر (server-side pagination/filter/sort) =====
  const fetchShopPage = useCallback(async (pageNum, append) => {
    // فلتر "مخفض" مع عداد العرض مش شغال = مفيش نتائج أبداً (بنفس منطق الفلترة القديم)
    if (filterOnSaleOnly && !isSaleActive()) {
      setShopItems([]); setShopTotal(0); setShopPageNum(1);
      setShopInitialLoading(false); setShopLoadingMore(false);
      return;
    }
    const params = { page: pageNum, limit: SHOP_PAGE_SIZE };
    if (selectedCategoryFilter !== 'all') params.category = selectedCategoryFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (filterOnSaleOnly) params.onSale = 'true';
    if (filterFeaturedOnly) params.isFeatured = 'true';
    if (filterMinPrice !== '') params.minPrice = filterMinPrice;
    if (filterMaxPrice !== '') params.maxPrice = filterMaxPrice;
    if (filterSizes.length > 0) params.sizes = filterSizes.join(',');
    if (filterColor) params.color = filterColor;
    if (shopSortBy === 'price_asc') { params.sortBy = 'price'; params.sortDir = 'asc'; }
    else if (shopSortBy === 'price_desc') { params.sortBy = 'price'; params.sortDir = 'desc'; }
    else { params.sortBy = 'createdAt'; params.sortDir = 'desc'; }

    if (append) setShopLoadingMore(true); else setShopInitialLoading(true);
    try {
      const res = await productsAPI.getPage(params);
      const items = Array.isArray(res.items) ? res.items : [];
      setShopItems(prev => append ? [...prev, ...items] : items);
      setShopTotal(res.total || 0);
      setShopPageNum(pageNum);
    } catch (err) {
      showToast(t('حصل خطأ في تحميل المنتجات', 'Failed to load products'));
    } finally {
      if (append) setShopLoadingMore(false); else setShopInitialLoading(false);
    }
  }, [selectedCategoryFilter, searchQuery, filterOnSaleOnly, filterFeaturedOnly, filterMinPrice, filterMaxPrice, filterSizes, filterColor, shopSortBy]);

  // ===== رجّع لأول صفحة كل ما الفلاتر/الترتيب/البحث يتغيروا وإحنا في صفحة المتجر =====
  useEffect(() => {
    if (currentPage !== 'shop') return;
    fetchShopPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, selectedCategoryFilter, searchQuery, filterOnSaleOnly, filterFeaturedOnly, filterMinPrice, filterMaxPrice, filterSizes, filterColor, shopSortBy]);

  const priceBounds = useCallback(() => {
    if (products.length === 0) return { min: 0, max: 1000 };
    const prices = products.map(p => getEffectivePrice(p));
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [products]);

  const allAvailableColors = useCallback(() => {
    const colorsSet = new Set();
    products.forEach(p => (p.colors || []).forEach(c => colorsSet.add(c)));
    return Array.from(colorsSet);
  }, [products]);

  const searchSuggestions = useCallback(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p => isProductVisibleToCustomer(p) && getLocalized(p.name).toLowerCase().includes(q)).slice(0, 5);
  }, [products, searchQuery, getLocalized]);

  const randomFeaturedSuggestions = useCallback(() => {
    const visible = products.filter(isProductVisibleToCustomer);
    const featured = visible.filter(p => p.isFeatured);
    const pool = featured.length > 0 ? featured : visible;
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
  }, [products]);

  // ============================================================
  // إدارة أقسام الصفحة الرئيسية
  // ============================================================
  const PRODUCT_SECTION_TYPES = ['products-featured', 'products-bestsellers', 'products-all', 'products-custom', 'products-category'];
  const addHomeSection = (e) => {
    e.preventDefault();
    const isProductSection = PRODUCT_SECTION_TYPES.includes(newSectionType);
    if (!isProductSection && !newSectionTitleAr.trim() && !newSectionTitleEn.trim() && !newSectionDescAr.trim() && !newSectionDescEn.trim()) {
      showToast(t('من فضلك املأ العنوان أو الوصف', 'Please fill in title or description'));
      return;
    }
    if (newSectionType === 'products-custom' && newSectionProductIds.length === 0) {
      showToast(t('من فضلك اختر منتج واحد على الأقل', 'Please select at least one product'));
      return;
    }
    if (newSectionType === 'products-category' && !newSectionCategoryId) {
      showToast(t('من فضلك اختر قسم', 'Please select a category'));
      return;
    }
    const newSection = {
      id: Date.now(),
      type: newSectionType,
      title: { ar: newSectionTitleAr.trim() || newSectionTitleEn.trim(), en: newSectionTitleEn.trim() || newSectionTitleAr.trim() },
      description: { ar: newSectionDescAr.trim() || newSectionDescEn.trim(), en: newSectionDescEn.trim() || newSectionDescAr.trim() },
      image: newSectionImage,
      buttonAction: newSectionButtonAction,
      buttonText: {
        ar: newSectionButtonTextAr.trim() || (sectionButtonActions.find(a => a.key === newSectionButtonAction)?.defaultText?.ar) || '',
        en: newSectionButtonTextEn.trim() || (sectionButtonActions.find(a => a.key === newSectionButtonAction)?.defaultText?.en) || '',
      },
      // حقول أقسام المنتجات
      productCount: newSectionProductCount,
      displayStyle: newSectionDisplayStyle,
      productIds: newSectionProductIds,
      categoryId: newSectionCategoryId,
    };
    const updatedSections = [...homeSections, newSection];
    setHomeSections(updatedSections);
    saveAdminSettings(t('تم حفظ الأقسام بنجاح', 'Sections saved successfully'), { homeSections: updatedSections });
    setNewSectionTitleAr('');
    setNewSectionTitleEn('');
    setNewSectionDescAr('');
    setNewSectionDescEn('');
    setNewSectionImage('');
    setNewSectionButtonAction('none');
    setNewSectionButtonTextAr('');
    setNewSectionButtonTextEn('');
    setNewSectionProductCount(4);
    setNewSectionDisplayStyle('grid');
    setNewSectionProductIds([]);
    setNewSectionCategoryId('');
    showToast(t('تم إضافة القسم بنجاح!', 'Section added!'));
  };

  const deleteHomeSection = (id) => {
    const updatedSections = homeSections.filter(s => s.id !== id);
    setHomeSections(updatedSections);
    saveAdminSettings(t('تم حفظ الأقسام بنجاح', 'Sections saved successfully'), { homeSections: updatedSections });
    showToast(t('تم حذف القسم', 'Section deleted'));
  };

  const openEditSection = (section) => {
    setEditingSection(section);
    setEditSecTitleAr(section.title?.ar || '');
    setEditSecTitleEn(section.title?.en || '');
    setEditSecDescAr(section.description?.ar || '');
    setEditSecDescEn(section.description?.en || '');
    setEditSecImage(section.image || '');
    setEditSecButtonAction(section.buttonAction || 'none');
    setEditSecButtonTextAr(section.buttonText?.ar || '');
    setEditSecButtonTextEn(section.buttonText?.en || '');
    setEditSecProductCount(section.productCount || 4);
    setEditSecDisplayStyle(section.displayStyle || 'grid');
    setEditSecProductIds(section.productIds || []);
    setEditSecCategoryId(section.categoryId || '');
  };

  const updateHomeSection = () => {
    if (!editingSection) return;
    const updated = {
      ...editingSection,
      title: { ar: editSecTitleAr.trim() || editSecTitleEn.trim(), en: editSecTitleEn.trim() || editSecTitleAr.trim() },
      description: { ar: editSecDescAr.trim(), en: editSecDescEn.trim() },
      image: editSecImage,
      buttonAction: editSecButtonAction,
      buttonText: {
        ar: editSecButtonTextAr.trim() || (sectionButtonActions.find(a => a.key === editSecButtonAction)?.defaultText?.ar) || '',
        en: editSecButtonTextEn.trim() || (sectionButtonActions.find(a => a.key === editSecButtonAction)?.defaultText?.en) || '',
      },
      productCount: editSecProductCount,
      displayStyle: editSecDisplayStyle,
      productIds: editSecProductIds,
      categoryId: editSecCategoryId,
    };
    const updatedSections = homeSections.map(s => s.id === editingSection.id ? updated : s);
    setHomeSections(updatedSections);
    saveAdminSettings(t('تم حفظ القسم بنجاح', 'Section saved successfully'), { homeSections: updatedSections });
    setEditingSection(null);
    showToast(t('تم تعديل القسم بنجاح!', 'Section updated!'));
  };

  // ============================================================
  // إدارة الصفحات المخصصة (يضيفها الأدمن براحته + تظهر كزرار في الناف)
  // ============================================================
  const addCustomPage = (e) => {
    e.preventDefault();
    if (!newPageTitleAr.trim() && !newPageTitleEn.trim()) {
      showToast(t('من فضلك اكتب اسم الصفحة', 'Please enter a page name'));
      return;
    }
    const newPage = {
      id: Date.now(),
      title: { ar: newPageTitleAr.trim() || newPageTitleEn.trim(), en: newPageTitleEn.trim() || newPageTitleAr.trim() },
      showInNav: true,
      sections: [],
    };
    const updatedPages = [...customPages, newPage];
    setCustomPages(updatedPages);
    saveAdminSettings(t('تم حفظ الصفحات بنجاح', 'Pages saved successfully'), { customPages: updatedPages });
    setNewPageTitleAr('');
    setNewPageTitleEn('');
    showToast(t('تم إضافة الصفحة بنجاح!', 'Page added!'));
  };

  const deleteCustomPage = (id) => {
    const updatedPages = customPages.filter(p => p.id !== id);
    setCustomPages(updatedPages);
    saveAdminSettings(t('تم حفظ الصفحات بنجاح', 'Pages saved successfully'), { customPages: updatedPages });
    if (activeCustomPageId === id) { setActiveCustomPageId(null); goTo('home'); }
    if (selectedPageForSection === String(id)) setSelectedPageForSection('');
    showToast(t('تم حذف الصفحة', 'Page deleted'));
  };

  const toggleCustomPageInNav = (id) => {
    const updatedPages = customPages.map(p => p.id === id ? { ...p, showInNav: !p.showInNav } : p);
    setCustomPages(updatedPages);
    saveAdminSettings(t('تم حفظ الصفحات بنجاح', 'Pages saved successfully'), { customPages: updatedPages });
  };

  const goToCustomPage = (id) => {
    setActiveCustomPageId(id);
    goTo('custom-page');
  };

  // ===== التعامل مع الضغط على لينك في الفوتر (روابط الأدمن المخصصة) =====
  // target ممكن يكون: 'home' | 'shop' | 'contact' | 'wishlist' | 'my-orders' | 'account' | 'faq' | 'returns'
  // أو 'custom:<pageId>' لصفحة مخصصة، أو 'external' مع رابط خارجي كامل
  const handleFooterLinkClick = useCallback((link) => {
    if (!link) return;
    if (link.target === 'external') {
      if (link.url) window.open(link.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (link.target === 'shop') { setSelectedCategoryFilter('all'); goTo('shop'); return; }
    if (link.target === 'returns') { goTo('returns-policy'); return; }
    if (link.target === 'faq') {
      goTo('home');
      requestAnimationFrame(() => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' }));
      return;
    }
    if (typeof link.target === 'string' && link.target.startsWith('custom:')) {
      goToCustomPage(link.target.slice(7));
      return;
    }
    goTo(link.target || 'home');
  }, [goTo]);

  const addCustomPageSection = (e) => {
    e.preventDefault();
    if (!selectedPageForSection) {
      showToast(t('من فضلك اختر الصفحة الأول', 'Please choose a page first'));
      return;
    }
    const isProductSection = PRODUCT_SECTION_TYPES.includes(newPageSectionType);
    if (!isProductSection && !newPageSectionTitleAr.trim() && !newPageSectionTitleEn.trim() && !newPageSectionDescAr.trim() && !newPageSectionDescEn.trim()) {
      showToast(t('من فضلك املأ العنوان أو الوصف', 'Please fill in title or description'));
      return;
    }
    if (newPageSectionType === 'products-custom' && newPageSectionProductIds.length === 0) {
      showToast(t('من فضلك اختر منتج واحد على الأقل', 'Please select at least one product'));
      return;
    }
    const newSection = {
      id: Date.now(),
      type: newPageSectionType,
      title: { ar: newPageSectionTitleAr.trim() || newPageSectionTitleEn.trim(), en: newPageSectionTitleEn.trim() || newPageSectionTitleAr.trim() },
      description: { ar: newPageSectionDescAr.trim() || newPageSectionDescEn.trim(), en: newPageSectionDescEn.trim() || newPageSectionDescAr.trim() },
      image: newPageSectionImage,
      buttonAction: newPageSectionButtonAction,
      buttonText: {
        ar: newPageSectionButtonTextAr.trim() || (sectionButtonActions.find(a => a.key === newPageSectionButtonAction)?.defaultText?.ar) || '',
        en: newPageSectionButtonTextEn.trim() || (sectionButtonActions.find(a => a.key === newPageSectionButtonAction)?.defaultText?.en) || '',
      },
      productCount: newPageSectionProductCount,
      displayStyle: newPageSectionDisplayStyle,
      productIds: newPageSectionProductIds,
    };
    const updatedPages = customPages.map(p => p.id === Number(selectedPageForSection) ? { ...p, sections: [...p.sections, newSection] } : p);
    setCustomPages(updatedPages);
    saveAdminSettings(t('تم حفظ الصفحات بنجاح', 'Pages saved successfully'), { customPages: updatedPages });
    setNewPageSectionTitleAr('');
    setNewPageSectionTitleEn('');
    setNewPageSectionDescAr('');
    setNewPageSectionDescEn('');
    setNewPageSectionImage('');
    setNewPageSectionButtonAction('none');
    setNewPageSectionButtonTextAr('');
    setNewPageSectionButtonTextEn('');
    setNewPageSectionProductCount(4);
    setNewPageSectionDisplayStyle('grid');
    setNewPageSectionProductIds([]);
    showToast(t('تم إضافة القسم بنجاح!', 'Section added!'));
  };

  const deleteCustomPageSection = (pageId, sectionId) => {
    const updatedPages = customPages.map(p => p.id === pageId ? { ...p, sections: p.sections.filter(s => s.id !== sectionId) } : p);
    setCustomPages(updatedPages);
    saveAdminSettings(t('تم حفظ الصفحات بنجاح', 'Pages saved successfully'), { customPages: updatedPages });
    showToast(t('تم حذف القسم', 'Section deleted'));
  };

  // ============================================================
  // إدارة توصيات المنتجات
  // ============================================================
  const handleProductRecSelect = (productId) => {
    setSelectedProductForRec(productId);
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setRecProductIds(prod.recommendedIds || []);
      setBundleProductIds(prod.bundle?.productIds || []);
      setBundleDiscountPercent(prod.bundle?.discountPercent || 0);
      setRecEnableRec(prod.enableRecommendations !== undefined ? prod.enableRecommendations : true);
      setRecEnableBundle(prod.enableBundle !== undefined ? prod.enableBundle : true);
    }
  };

  const persistProductChanges = useCallback(async (productId, productData, message) => {
    if (!productId || !productData) return null;
    if (productSaveInFlightRef.current.has(productId)) {
      return null;
    }

    const latestProduct = productsRef.current.find(p => p.id === productId) || productData;
    const nextPayload = {
      ...latestProduct,
      ...productData,
      offers: Array.isArray(productData.offers) ? productData.offers : (Array.isArray(latestProduct.offers) ? latestProduct.offers : []),
      recommendedIds: Array.isArray(productData.recommendedIds) ? productData.recommendedIds : (Array.isArray(latestProduct.recommendedIds) ? latestProduct.recommendedIds : []),
      bundle: productData.bundle || latestProduct.bundle || { productIds: [], discountPercent: 0 },
    };
    // ===== إزالة الحقول المحمية التي تسبب VersionError في Mongoose =====
    // لا نرسل _id أو __v أو createdAt أو updatedAt إلى الباك اند عند التحديث
    delete nextPayload._id;
    delete nextPayload.__v;
    delete nextPayload.createdAt;
    delete nextPayload.updatedAt;

    productSaveInFlightRef.current.add(productId);
    try {
      const response = await productsAPI.update(productId, nextPayload, []);
      const savedProduct = response;
      const normalizedProduct = savedProduct && typeof savedProduct === 'object' ? { ...savedProduct, id: savedProduct.id || productId } : savedProduct;
      setProducts(prev => prev.map(p => (p.id === productId ? normalizedProduct : p)));
      productsRef.current = productsRef.current.map(p => (p.id === productId ? normalizedProduct : p));
      showToast(message || t('تم حفظ المنتج بنجاح', 'Product saved successfully'));
      return normalizedProduct;
    } catch (err) {
      console.error('تعذّر حفظ المنتج:', err);
      showToast(err?.message || t('حصل خطأ في حفظ المنتج', 'Error saving product'));
      throw err;
    } finally {
      productSaveInFlightRef.current.delete(productId);
    }
  }, [showToast, t]);

  const saveRecommendations = async () => {
    if (!selectedProductForRec) {
      showToast(t('من فضلك اختر منتجاً أولاً', 'Please select a product first'));
      return;
    }

    const nextProduct = products.find(p => p.id === selectedProductForRec);
    if (!nextProduct) return;

    const productToSave = {
      ...nextProduct,
      recommendedIds: recProductIds,
      bundle: { productIds: bundleProductIds, discountPercent: bundleDiscountPercent },
      enableRecommendations: recEnableRec,
      enableBundle: recEnableBundle,
    };

    setProducts(prev => prev.map(p => (p.id === selectedProductForRec ? productToSave : p)));
    await persistProductChanges(selectedProductForRec, productToSave, t('تم حفظ التوصيات والعروض بنجاح!', 'Recommendations and offers saved!'));
  };

  const toggleProductField = useCallback((productId, field, value) => {
    const currentProduct = products.find(p => p.id === productId);
    if (!currentProduct) return;
    const updatedProduct = { ...currentProduct, [field]: value };
    setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
    // حفظ التغيير فوراً في الداتا بيز حتى لا يضيع مع تحديث الصفحة
    setProductEditorDirty(false);
    (async () => {
      try {
        await persistProductChanges(productId, updatedProduct, null);
      } catch (err) {
        console.error('تعذّر حفظ الحقل:', err);
        // لو فشل الحفظ نرجع الحالة القديمة
        setProducts(prev => prev.map(p => p.id === productId ? currentProduct : p));
      }
    })();
  }, [products, persistProductChanges]);

  const setProductVisibility = useCallback(async (productId, visibility) => {
    const currentProduct = products.find(p => p.id === productId);
    if (!currentProduct) return;
    const updatedProduct = { ...currentProduct, visibility };
    setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
    try {
      await persistProductChanges(productId, updatedProduct, t('تم تحديث حالة الظهور', 'Visibility updated'));
    } catch (err) {
      console.error('تعذّر تحديث الظهور:', err);
    }
  }, [products, persistProductChanges, t]);


  // ============================================================
  // دوال تصدير Excel / CSV
  // ============================================================
  // تصدير الطلبات المؤكدة (تم التأكيد فقط)
  // ملحوظة: كانت الأول بتصدّر من `orders` (صفحة الأدمن الحالية بس)، وبعد كده
  // بقت بتجيب كل الطلبات من endpoint قديم فيه سقف أمان (كان بيوقف عند 5000
  // طلب). دلوقتي بتستخدم مسار الـ pagination الحقيقي وبتلف على كل الصفحات
  // (500 طلب في المرة) لحد ما تجيب كل الطلبات فعليًا - مفيش أي سقف نهائي،
  // يشتغل صح حتى لو المتجر عنده مليون طلب.
  const fetchAllOrdersForExport = useCallback(async () => {
    const pageSize = 500;
    let page = 1;
    let totalPages = 1;
    const all = [];
    do {
      const res = await ordersAPI.getAll({ page, limit: pageSize });
      const items = Array.isArray(res) ? res : (res?.items || []);
      all.push(...items);
      totalPages = Array.isArray(res) ? 1 : (res?.totalPages || 1);
      page += 1;
    } while (page <= totalPages);
    return all;
  }, []);

  // ===== فلترة الطلبات حسب المدة المختارة قبل التصدير =====
  // بتعتمد على تاريخ إنشاء الطلب (createdAt). لو المدة "الكل" مفيش فلترة خالص.
  const filterOrdersByExportRange = useCallback((allOrders) => {
    if (exportRangePreset === 'all') return allOrders;

    let start = null;
    let end = null;
    const now = new Date();

    if (exportRangePreset === 'month') {
      start = new Date(now);
      start.setDate(start.getDate() - 30);
    } else if (exportRangePreset === 'week') {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
    } else if (exportRangePreset === 'twoDays') {
      start = new Date(now);
      start.setDate(start.getDate() - 2);
    } else if (exportRangePreset === 'today') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    } else if (exportRangePreset === 'custom') {
      if (exportRangeFrom) start = new Date(exportRangeFrom + 'T00:00:00');
      if (exportRangeTo) end = new Date(exportRangeTo + 'T23:59:59');
    }

    return allOrders.filter(o => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [exportRangePreset, exportRangeFrom, exportRangeTo]);

  const exportConfirmedOrders = useCallback(async () => {
    try {
      await loadXLSXLibrary();
    } catch {
      showToast(t('تعذّر تحميل مكتبة Excel، تحقق من الاتصال بالإنترنت وحاول تاني', 'Could not load the Excel library, check your internet connection and try again'));
      return;
    }
    showToast(t('جاري تجهيز كل الطلبات المؤكدة...', 'Preparing all confirmed orders...'));
    let allOrders;
    try {
      allOrders = await fetchAllOrdersForExport();
    } catch (err) {
      console.error('تعذّر تحميل الطلبات للتصدير:', err);
      showToast(t('حصل خطأ أثناء تجهيز الطلبات للتصدير', 'An error occurred while preparing orders for export'));
      return;
    }
    let ordersToExport = allOrders.filter(o => 
      o.status === t('تم التأكيد', 'Confirmed')
    );
    ordersToExport = filterOrdersByExportRange(ordersToExport);
    if (ordersToExport.length === 0) {
      showToast(t('لا توجد طلبات مؤكدة في المدة المختارة', 'No confirmed orders in the selected period'));
      return;
    }

    const data = ordersToExport.map(o => ({
      'رقم الطلب': o.orderNumber || o.id || o._id,
      'اسم العميل': o.customerName,
      'الهاتف': o.customerPhone,
      'الهاتف الإضافي': o.customerPhone2 || '',
      'العنوان': o.address,
      'المحافظة': o.governorate,
      'الدولة': o.country || '',
      'الرمز البريدي': o.zipCode || '',
      'المنتجات': (o.items || []).map(i => `${getLocalized(i.name)} (${i.size}) × ${i.qty || 1}`).join('; '),
      'الإجمالي': o.totalAmount,
      'حالة الطلب': o.status,
      'حالة التجهيز': o.packerStatus,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'طلبات مؤكدة');
    XLSX.writeFile(wb, 'confirmed_orders.xlsx');
    showToast(t('تم تصدير الطلبات المؤكدة بنجاح!', 'Confirmed orders exported!'));
  }, [t, getLocalized, showToast, fetchAllOrdersForExport, filterOrdersByExportRange]);

  // تصدير جميع الطلبات
  // نفس ملحوظة exportConfirmedOrders بالظبط: بتستخدم نفس دالة الـ pagination
  // اللي بتلف على كل الصفحات من غير أي سقف نهائي على العدد.
  const exportAllOrders = useCallback(async () => {
    try {
      await loadXLSXLibrary();
    } catch {
      showToast(t('تعذّر تحميل مكتبة Excel، تحقق من الاتصال بالإنترنت وحاول تاني', 'Could not load the Excel library, check your internet connection and try again'));
      return;
    }
    showToast(t('جاري تجهيز كل الطلبات...', 'Preparing all orders...'));
    let allOrders;
    try {
      allOrders = await fetchAllOrdersForExport();
    } catch (err) {
      console.error('تعذّر تحميل الطلبات للتصدير:', err);
      showToast(t('حصل خطأ أثناء تجهيز الطلبات للتصدير', 'An error occurred while preparing orders for export'));
      return;
    }
    allOrders = filterOrdersByExportRange(allOrders);
    if (allOrders.length === 0) {
      showToast(t('لا توجد طلبات للتصدير في المدة المختارة', 'No orders to export in the selected period'));
      return;
    }

    const data = allOrders.map(o => ({
      'رقم الطلب': o.orderNumber || o.id || o._id,
      'اسم العميل': o.customerName,
      'الهاتف': o.customerPhone,
      'الهاتف الإضافي': o.customerPhone2 || '',
      'العنوان': o.address,
      'المحافظة': o.governorate,
      'الدولة': o.country || '',
      'الرمز البريدي': o.zipCode || '',
      'المنتجات': (o.items || []).map(i => `${getLocalized(i.name)} (${i.size}) × ${i.qty || 1}`).join('; '),
      'الإجمالي': o.totalAmount,
      'حالة الطلب': o.status,
      'حالة التجهيز': o.packerStatus,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'جميع الطلبات');
    XLSX.writeFile(wb, 'all_orders.xlsx');
    showToast(t('تم تصدير جميع الطلبات بنجاح!', 'All orders exported!'));
  }, [t, getLocalized, showToast, fetchAllOrdersForExport, filterOrdersByExportRange]);

  // تصدير الكتالوج بصيغة CSV (متوافقة مع ميتا)
  const exportCatalog = useCallback(async () => {
    try {
      await loadXLSXLibrary();
    } catch {
      showToast(t('تعذّر تحميل مكتبة Excel، تحقق من الاتصال بالإنترنت وحاول تاني', 'Could not load the Excel library, check your internet connection and try again'));
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const data = products.map(p => {
      const primaryImage = p.images && p.images.length > 0 ? p.images[0] : '';
      const additionalImages = p.images && p.images.length > 1 ? p.images.slice(1).join(',') : '';
      const price = p.salePrice && isSaleActive() ? p.salePrice : p.price;
      const salePrice = p.salePrice && isSaleActive() ? p.salePrice : '';

      return {
        'id': p.id,
        'title': getLocalized(p.name),
        'description': getLocalized(p.description),
        'price': price,
        'sale_price': salePrice,
        'currency': 'EGP',
        'link': `${origin}/product/${p.id}`,
        'image_link': primaryImage,
        'additional_image_link': additionalImages,
        'availability': 'in stock',
        'condition': 'new',
        'brand': getLocalized(adminSettings.current.storeName),
        'category': getLocalized(p.category),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Catalog');
    // Write as CSV
    XLSX.writeFile(wb, 'catalog.csv', { bookType: 'csv' });
    showToast(t('تم تصدير الكتالوج (CSV) بنجاح!', 'Catalog (CSV) exported!'));
  }, [products, t, getLocalized, adminSettings]);

  // ============================================================
  // 5.9 تحديث عنوان الصفحة (document.title) ووصف الميتا وOpen Graph ديناميكيًا (SEO)
  // بيستخدم metaTitle/metaDescription بتاعة المنتج لو موجودة، وبيرجع لاسم المتجر
  // كـ fallback. ده بيأثر على نتائج البحث وعلى الـ preview لما حد يشارك لينك على واتساب/فيسبوك.
  // ============================================================
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const storeName = getLocalized(adminSettings.current.storeName) || 'LAVA';
    let title = storeName;
    let description = getLocalized(adminSettings.current.aboutText) || '';
    let ogImage = adminSettings.current.logoImage || '';

    if (currentPage === 'product-details' && selectedProduct) {
      const metaTitle = getLocalized(selectedProduct.metaTitle);
      const metaDesc = getLocalized(selectedProduct.metaDescription);
      title = metaTitle || `${getLocalized(selectedProduct.name)} | ${storeName}`;
      description = metaDesc || getLocalized(selectedProduct.description) || description;
      if (selectedProduct.images?.[0]) ogImage = selectedProduct.images[0];
    } else if (currentPage === 'shop') {
      title = `${t('المتجر', 'Shop')} | ${storeName}`;
    } else if (currentPage === 'wishlist') {
      title = `${t('المفضلة', 'Wishlist')} | ${storeName}`;
    } else if (currentPage === 'checkout') {
      title = `${t('إتمام الطلب', 'Checkout')} | ${storeName}`;
    } else if (currentPage === 'checkout-details') {
      title = `${t('بيانات الشحن والدفع', 'Shipping & Payment')} | ${storeName}`;
    } else if (currentPage === 'account') {
      title = `${t('حسابي', 'My Account')} | ${storeName}`;
    } else if (currentPage === 'my-orders') {
      title = `${t('طلباتي', 'My Orders')} | ${storeName}`;
    } else if (currentPage === 'contact') {
      title = `${t('تواصل معنا', 'Contact Us')} | ${storeName}`;
    } else if (currentPage === 'returns-policy') {
      title = `${getLocalized(adminSettings.current.returnsPolicy?.title) || t('الاسترجاع والاستبدال', 'Returns & Exchanges')} | ${storeName}`;
    } else if (currentPage === 'guest-return-exchange') {
      title = `${t('استرجاع أو استبدال طلب', 'Return or Exchange an Order')} | ${storeName}`;
    } else if (currentPage === 'custom-page') {
      const page = customPages.find(p => p.id === activeCustomPageId);
      if (page) title = `${getLocalized(page.title)} | ${storeName}`;
    } else if (currentPage === 'admin') {
      title = `${t('لوحة التحكم', 'Admin Panel')} | ${storeName}`;
    } else if (currentPage === 'not-found') {
      title = `${t('الصفحة غير موجودة', 'Page Not Found')} | ${storeName}`;
    }

    document.title = title;

    const setMeta = (selector, attr, attrValue, content) => {
      if (!content) return;
      let tag = document.querySelector(selector);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, attrValue);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:type"]', 'property', 'og:type', currentPage === 'product-details' ? 'product' : 'website');
    setMeta('meta[property="og:image"]', 'property', 'og:image', ogImage);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');

    // ===== أيقونة المتجر (Favicon) اللي بتبان في تبويب المتصفح =====
    // بتتحدث لايف من غير رفريش لو الأدمن غيّرها من الإعدادات
    const faviconUrl = adminSettings.current.faviconImage;
    if (faviconUrl) {
      ['icon', 'shortcut icon', 'apple-touch-icon'].forEach(rel => {
        let link = document.querySelector(`link[rel="${rel}"]`);
        if (!link) {
          link = document.createElement('link');
          link.setAttribute('rel', rel);
          document.head.appendChild(link);
        }
        link.setAttribute('href', faviconUrl);
      });
    }

    // ===== PWA: تحديث اسم وأيقونة "تثبيت الموقع كبرنامج" (Install / Add to Home Screen) =====
    // بياخد اسم البرنامج من اسم المتجر (storeName) وأيقونته من نفس أيقونة
    // المتجر (faviconImage) - بيتحدث لايف من غير عمل بيلد جديد لو الأدمن غيّرهم.
    updatePwaManifest({ name: storeName, iconUrl: faviconUrl, themeColor: theme.colors.primary });
  }, [currentPage, selectedProduct, language, customPages, activeCustomPageId, getLocalized, t, settingsVersion, theme]);

  // ============================================================
  // 5.95 شاشة التحميل الأولى - قبل ما إعدادات المتجر (الثيم/الخطوط) توصل
  // من الباك إند، منعرضش أي شكل من أشكال الموقع خالص (لا القديم ولا
  // الافتراضي) - بس شاشة بيضاء محايدة. أول ما الإعدادات توصل، الموقع
  // بيتعرض على طول بالشكل النهائي الصح من غير أي فلاش.
  // ============================================================
  if (!settingsReady) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ width: 40, height: 40, borderRadius: '9999px', border: '4px solid #e5e7eb', borderTopColor: '#9ca3af', animation: 'lava-initial-spin 0.8s linear infinite' }} />
        <style>{`@keyframes lava-initial-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ============================================================
  // 6. الـ Render الرئيسي
  // ============================================================
  return (
    <div className={`font-sans min-h-screen flex flex-col bg-[var(--lava-secondary)] ${language === 'ar' ? 'rtl' : 'ltr'}`} dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ fontFamily: activeFontOption.stack, backgroundColor: theme.colors.bg, color: theme.colors.text }}>

      <style>{`
        html, body {
          overflow-x: hidden;
          height: 100%;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 160s linear infinite;
        }
        input, select, textarea {
          transition: all 0.2s ease;
        }
        input:focus, select:focus, textarea:focus {
          box-shadow: 0 0 0 3px rgba(0,0,0,0.1);
          border-color: #000;
        }
        .fade-in {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .fade-in.visible {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes accountMenuFadeIn {
          0% { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: accountMenuFadeIn 0.18s ease-out;
        }
        [dir="rtl"] .text-start {
          text-align: right;
        }
        [dir="rtl"] .text-end {
          text-align: left;
        }
        [dir="ltr"] .text-start {
          text-align: left;
        }
        [dir="ltr"] .text-end {
          text-align: right;
        }
        [dir="rtl"] .flex-row-reverse\\:flex-row-reverse {
          flex-direction: row-reverse;
        }
        [dir="rtl"] .space-x-\\[reverse\\] {
          flex-direction: row-reverse;
        }
      `}</style>

      {/* ============================================================ */}
      {/* الهيدر الكامل */}
      {/* ============================================================ */}
      {/* ===== ناف موبايل سفلي - يظهر لو الثيم عنده mobileBottom=true ===== */}
      {theme.nav.mobileBottom && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 py-2 shadow-[0_-2px_16px_rgba(0,0,0,0.12)]"
          style={{ backgroundColor: theme.colors.navBg, borderTop: `1px solid ${theme.colors.navBorder}` }}
        >
          {theme.nav.mobileBottomItems.map(item => {
            const icons = {
              home: { icon: '🏠', label: t('الرئيسية', 'Home'), action: () => goTo('home') },
              shop: { icon: '👕', label: t('المتجر', 'Shop'), action: () => { setSelectedCategoryFilter('all'); goTo('shop'); } },
              cart: {
                icon: '🛒',
                label: t('العربة', 'Cart'),
                action: () => goTo('checkout'),
                badge: cart.length
              },
              wishlist: {
                icon: '❤️',
                label: t('المفضلة', 'Wishlist'),
                action: () => goTo('wishlist'),
                badge: wishlist.length || 0
              },
              account: {
                icon: user ? '👤' : '🔓',
                label: user ? t('حسابي', 'My Account') : t('دخول', 'Login'),
                action: user ? () => goTo('account') : () => setShowLoginModal(true)
              },
            };
            const entry = icons[item];
            if (!entry) return null;
            return (
              <button
                key={item}
                onClick={entry.action}
                className="flex flex-col items-center gap-0.5 relative px-2 py-1 rounded-xl transition"
                style={{ color: theme.colors.navFg, minWidth: 48 }}
              >
                <span className="text-2xl relative">
                  {entry.icon}
                  {entry.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold" style={{ backgroundColor: theme.colors.accent }}>
                      {entry.badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-bold">{entry.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      <header className={`sticky top-0 z-50 ${theme.nav.mobileBottom ? 'pb-safe' : ''}`}>
        {adminSettings.current.showCountdownBar && (
          <CountdownTimer endDate={adminSettings.current.saleEndDate} onExpire={bumpSettings} t={t} />
        )}

        {/* ===== شريط الشحن المتحرك ===== */}
        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${isBarVisible ? '' : 'pointer-events-none'}`}
          style={{ maxHeight: isBarVisible ? '400px' : '0px', opacity: isBarVisible ? 1 : 0 }}
          aria-hidden={!isBarVisible}
          inert={isBarVisible ? undefined : 'true'}
        >
          <div className="text-center py-1 overflow-hidden text-xs md:text-sm border-b" style={{ backgroundColor: theme.colors.secondary, color: theme.colors.secondaryFg }} dir="ltr">
            <div className="animate-marquee font-medium whitespace-nowrap">
              {/* ===== نكرر النص كذا مرة جوه كل نص عشان يغطي حتى الشاشات الكبيرة (فل إتش دي / شاشات عريضة)
                   من غير ما تفضل فراغات فاضية بتظهر وتختفي فجأة أثناء الحركة ===== */}
              {[0, 1].map(half => (
                <div key={half} className="flex gap-12 px-6" aria-hidden={half === 1 ? 'true' : undefined}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <React.Fragment key={i}>
                      <span>-- FREE SHIPPING ON ALL ORDERS ABOVE {adminSettings.current.freeShippingThreshold} EGP --</span>
                      <span>-- {t('التوصيل مجاني للطلبات فوق', 'Free shipping on orders above')} {adminSettings.current.freeShippingThreshold} {t('جنيه', 'EGP')} --</span>
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== الناف الرئيسي ===== */}
        {/*
          ===== nav.layout options =====
          centered-logo : أيقونات يسار | لوجو في المنتصف (absolute) | لينكات + هامبرجر يمين
          classic        : لوجو يسار | لينكات وسط | أيقونات يمين
          minimal        : لوجو يسار | هامبرجر + عربة يمين (بدون لينكات ديسكتوب)
        */}
        <nav
          className={`relative flex items-center px-4 md:px-8 ${theme.nav.height} ${
            theme.nav.borderBottom ? 'border-b' : ''
          } ${
            // centered-logo: space-between عشان الأيقونات اليسار واليمين يتباعدوا
            // classic/minimal: space-between كمان
            'justify-between'
          } ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}
          style={{
            backgroundColor: theme.nav.transparent ? 'transparent' : theme.colors.navBg,
            borderColor: theme.colors.navBorder,
            color: theme.colors.navFg,
          }}
        >

          {/* ======================================================
              CENTERED-LOGO: أيقونات يسار + لوجو وسط (absolute) + لينكات يمين
             ====================================================== */}
          {(theme.nav.layout === 'centered-logo' || !theme.nav.layout) && (<>

            {/* يسار: حساب + مفضلة + عربة */}
            <div className="flex items-center gap-3 text-lg z-10"
              style={{ color: theme.colors.navFg }}>
              <div className={showTopIconOnMobile('account') ? '' : 'hidden md:block'}>
                {user ? (
                  <div className="relative account-menu">
                    <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="hover:opacity-80 transition text-xl" title={user.name}>👤</button>
                    {showAccountMenu && (
                      <div className={`absolute top-full mt-3 w-64 bg-[var(--lava-card)] border border-[var(--lava-border)] rounded-2xl shadow-2xl py-2 z-50 text-sm font-semibold overflow-hidden animate-fade-in ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                        <div className={`px-4 py-3 border-b bg-[var(--lava-secondary)] flex items-center gap-3 ${language === 'ar' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                          <span className="flex items-center justify-center w-9 h-9 rounded-full text-white text-base" style={{ backgroundColor: theme.colors.primary }}>👤</span>
                          <div className="min-w-0">
                            <p className="text-[var(--lava-text)] truncate">{user.name}</p>
                            {user.email && <p className="text-xs font-normal text-[var(--lava-muted)] truncate">{user.email}</p>}
                          </div>
                        </div>
                        <button onClick={() => { goTo('account'); setShowAccountMenu(false); }} className={`group flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--lava-secondary)] transition-colors ${language === 'ar' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--lava-secondary)] text-base group-hover:bg-black group-hover:text-white transition-colors">👤</span>
                          <span>{t('معلومات الحساب', 'Account Info')}</span>
                        </button>
                        <button onClick={() => { handleLogout(); setShowAccountMenu(false); }} className={`group flex items-center gap-3 w-full px-4 py-3 hover:bg-red-50 text-red-600 transition-colors border-t ${language === 'ar' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-base group-hover:bg-red-600 group-hover:text-white transition-colors">🚪</span>
                          <span>{t('تسجيل الخروج', 'Logout')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => setShowLoginModal(true)} className="hover:opacity-80 transition text-xl" title={t('حسابي', 'My Account')}>👤</button>
                )}
              </div>
              <button onClick={() => goTo('wishlist')} className={`hover:opacity-80 transition relative ${showTopIconOnMobile('wishlist') ? '' : 'hidden md:inline-block'}`} title={t('المفضلة', 'Wishlist')}>
                ❤️
                {wishlist.length > 0 && (
                  <span className="absolute -top-2 -right-2 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.accent }}>{wishlist.length}</span>
                )}
              </button>
              <button onClick={() => goTo('checkout')} className={`hover:opacity-80 transition relative ${showTopIconOnMobile('cart') ? '' : 'hidden md:inline-block'}`} title={t('عربة التسوق', 'Cart')}>
                🛒
                <span className="absolute -top-2 -right-2 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.accent }}>{cart.length}</span>
              </button>
            </div>

            {/* وسط: لوجو (absolute) */}
            <div className="absolute left-1/2 -translate-x-1/2 cursor-pointer whitespace-nowrap z-10" onClick={() => goTo('home')}>
              {adminSettings.current.useLogoImage && adminSettings.current.logoImage ? (
                <img src={adminSettings.current.logoImage} alt={getLocalized(adminSettings.current.logoText)} className="h-10 md:h-12 w-auto object-contain" />
              ) : (
                <span className="text-2xl md:text-3xl font-extrabold tracking-wider uppercase" style={{ color: theme.colors.navFg }}>{getLocalized(adminSettings.current.logoText)}</span>
              )}
            </div>

            {/* يمين: لينكات + لغة + هامبرجر */}
            <div className="flex items-center gap-3 md:gap-5 font-semibold text-sm z-10" style={{ color: theme.colors.navFg }}>
              <div className="hidden md:flex items-center gap-3 md:gap-5">
                <button onClick={() => goTo('home')} className="hover:opacity-70 transition">{t('الرئيسية', 'Home')}</button>
                <button onClick={() => { setSelectedCategoryFilter('all'); goTo('shop'); }} className="hover:opacity-70 transition">{t('المتجر', 'Shop')}</button>
                <button onClick={() => goTo('contact')} className="hover:opacity-70 transition">{t('تواصل', 'Contact')}</button>
                {customPages.filter(p => p.showInNav).map(p => (
                  <button key={p.id} onClick={() => goToCustomPage(p.id)} className="hover:opacity-70 transition">{getLocalized(p.title)}</button>
                ))}
                {user && (user.role === 'admin' || user.role === 'call_center' || user.role === 'packer' || user.role === 'staff') && (
                  <button onClick={() => goTo('admin')} className="text-red-600 font-bold hover:underline">{t('لوحة التحكم', 'Dashboard')}</button>
                )}
              </div>
              <button onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')} className="text-sm font-bold hover:opacity-70 transition">
                {language === 'ar' ? 'EN' : 'عربي'}
              </button>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-2xl hover:opacity-70 transition relative z-[70]" style={{ color: theme.colors.navFg }}>
                {isMobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>

          </>)}

          {/* ======================================================
              CLASSIC: لوجو يسار | لينكات وسط (ديسكتوب) | أيقونات يمين
             ====================================================== */}
          {theme.nav.layout === 'classic' && (<>

            {/* يسار: لوجو */}
            <div className="flex items-center gap-4 z-10">
              <div className="cursor-pointer whitespace-nowrap" onClick={() => goTo('home')}>
                {adminSettings.current.useLogoImage && adminSettings.current.logoImage ? (
                  <img src={adminSettings.current.logoImage} alt={getLocalized(adminSettings.current.logoText)} className="h-10 md:h-12 w-auto object-contain" />
                ) : (
                  <span className="text-2xl md:text-3xl font-extrabold tracking-wider uppercase" style={{ color: theme.colors.navFg }}>{getLocalized(adminSettings.current.logoText)}</span>
                )}
              </div>
              {/* لينكات ديسكتوب بجانب اللوجو في classic */}
              <div className="hidden md:flex items-center gap-4 font-semibold text-sm" style={{ color: theme.colors.navFg }}>
                <button onClick={() => goTo('home')} className="hover:opacity-70 transition">{t('الرئيسية', 'Home')}</button>
                <button onClick={() => { setSelectedCategoryFilter('all'); goTo('shop'); }} className="hover:opacity-70 transition">{t('المتجر', 'Shop')}</button>
                <button onClick={() => goTo('contact')} className="hover:opacity-70 transition">{t('تواصل', 'Contact')}</button>
                {customPages.filter(p => p.showInNav).map(p => (
                  <button key={p.id} onClick={() => goToCustomPage(p.id)} className="hover:opacity-70 transition">{getLocalized(p.title)}</button>
                ))}
                {user && (user.role === 'admin' || user.role === 'call_center' || user.role === 'packer' || user.role === 'staff') && (
                  <button onClick={() => goTo('admin')} className="text-red-600 font-bold hover:underline">{t('لوحة التحكم', 'Dashboard')}</button>
                )}
              </div>
            </div>

            {/* يمين: أيقونات + لغة + هامبرجر */}
            <div className="flex items-center gap-3 text-lg z-10" style={{ color: theme.colors.navFg }}>
              <button onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')} className={`text-sm font-bold hover:opacity-70 transition ${theme.nav.mobileBottom ? 'hidden md:inline-block' : 'inline-block'}`}>
                {language === 'ar' ? 'EN' : 'عربي'}
              </button>
              <div className={showTopIconOnMobile('account') ? '' : 'hidden md:block'}>
                {user ? (
                  <div className="relative account-menu">
                    <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="hover:opacity-80 transition text-xl" title={user.name}>👤</button>
                    {showAccountMenu && (
                      <div className={`absolute top-full mt-3 w-64 bg-[var(--lava-card)] border border-[var(--lava-border)] rounded-2xl shadow-2xl py-2 z-50 text-sm font-semibold overflow-hidden animate-fade-in ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                        <div className={`px-4 py-3 border-b bg-[var(--lava-secondary)] flex items-center gap-3 ${language === 'ar' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                          <span className="flex items-center justify-center w-9 h-9 rounded-full text-white text-base" style={{ backgroundColor: theme.colors.primary }}>👤</span>
                          <div className="min-w-0">
                            <p className="text-[var(--lava-text)] truncate">{user.name}</p>
                            {user.email && <p className="text-xs font-normal text-[var(--lava-muted)] truncate">{user.email}</p>}
                          </div>
                        </div>
                        <button onClick={() => { goTo('account'); setShowAccountMenu(false); }} className={`group flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--lava-secondary)] transition-colors ${language === 'ar' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--lava-secondary)] text-base group-hover:bg-black group-hover:text-white transition-colors">👤</span>
                          <span>{t('معلومات الحساب', 'Account Info')}</span>
                        </button>
                        <button onClick={() => { handleLogout(); setShowAccountMenu(false); }} className={`group flex items-center gap-3 w-full px-4 py-3 hover:bg-red-50 text-red-600 transition-colors border-t ${language === 'ar' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-base group-hover:bg-red-600 group-hover:text-white transition-colors">🚪</span>
                          <span>{t('تسجيل الخروج', 'Logout')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => setShowLoginModal(true)} className="hover:opacity-80 transition text-xl" title={t('حسابي', 'My Account')}>👤</button>
                )}
              </div>
              <button onClick={() => goTo('wishlist')} className={`hover:opacity-80 transition relative ${showTopIconOnMobile('wishlist') ? '' : 'hidden md:inline-block'}`} title={t('المفضلة', 'Wishlist')}>
                ❤️
                {wishlist.length > 0 && (
                  <span className="absolute -top-2 -right-2 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.accent }}>{wishlist.length}</span>
                )}
              </button>
              <button onClick={() => goTo('checkout')} className={`hover:opacity-80 transition relative ${showTopIconOnMobile('cart') ? '' : 'hidden md:inline-block'}`} title={t('عربة التسوق', 'Cart')}>
                🛒
                <span className="absolute -top-2 -right-2 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.accent }}>{cart.length}</span>
              </button>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-2xl hover:opacity-70 transition z-[70]" style={{ color: theme.colors.navFg }}>
                {isMobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>

          </>)}

          {/* ======================================================
              MINIMAL: لوجو يسار | هامبرجر + عربة يمين (بدون لينكات ديسكتوب)
             ====================================================== */}
          {theme.nav.layout === 'minimal' && (<>

            {/* يسار: لوجو */}
            <div className="cursor-pointer whitespace-nowrap z-10" onClick={() => goTo('home')}>
              {adminSettings.current.useLogoImage && adminSettings.current.logoImage ? (
                <img src={adminSettings.current.logoImage} alt={getLocalized(adminSettings.current.logoText)} className="h-10 md:h-12 w-auto object-contain" />
              ) : (
                <span className="text-2xl md:text-3xl font-extrabold tracking-wider uppercase" style={{ color: theme.colors.navFg }}>{getLocalized(adminSettings.current.logoText)}</span>
              )}
            </div>

            {/* يمين: عربة + هامبرجر */}
            <div className="flex items-center gap-3 text-lg z-10" style={{ color: theme.colors.navFg }}>
              <button onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')} className={`text-sm font-bold hover:opacity-70 transition ${theme.nav.mobileBottom ? 'hidden md:inline-block' : 'inline-block'}`}>
                {language === 'ar' ? 'EN' : 'عربي'}
              </button>
              <div className={showTopIconOnMobile('account') ? '' : 'hidden md:block'}>
                {user ? (
                <div className="relative account-menu">
                  <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="hover:opacity-80 transition text-xl" title={user.name}>👤</button>
                  {showAccountMenu && (
                    <div className={`absolute top-full mt-3 w-64 bg-[var(--lava-card)] border border-[var(--lava-border)] rounded-2xl shadow-2xl py-2 z-50 text-sm font-semibold overflow-hidden animate-fade-in ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                      <div className={`px-4 py-3 border-b bg-[var(--lava-secondary)] flex items-center gap-3 ${language === 'ar' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                        <span className="flex items-center justify-center w-9 h-9 rounded-full text-white text-base" style={{ backgroundColor: theme.colors.primary }}>👤</span>
                        <div className="min-w-0">
                          <p className="text-[var(--lava-text)] truncate">{user.name}</p>
                          {user.email && <p className="text-xs font-normal text-[var(--lava-muted)] truncate">{user.email}</p>}
                        </div>
                      </div>
                      <button onClick={() => { goTo('account'); setShowAccountMenu(false); }} className={`group flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--lava-secondary)] transition-colors ${language === 'ar' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--lava-secondary)] text-base group-hover:bg-black group-hover:text-white transition-colors">👤</span>
                        <span>{t('معلومات الحساب', 'Account Info')}</span>
                      </button>
                      <button onClick={() => { handleLogout(); setShowAccountMenu(false); }} className={`group flex items-center gap-3 w-full px-4 py-3 hover:bg-red-50 text-red-600 transition-colors border-t ${language === 'ar' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-base group-hover:bg-red-600 group-hover:text-white transition-colors">🚪</span>
                        <span>{t('تسجيل الخروج', 'Logout')}</span>
                      </button>
                    </div>
                  )}
                </div>
                ) : (
                  <button onClick={() => setShowLoginModal(true)} className="hover:opacity-80 transition text-xl" title={t('حسابي', 'My Account')}>👤</button>
                )}
              </div>
              <button onClick={() => goTo('checkout')} className={`hover:opacity-80 transition relative ${showTopIconOnMobile('cart') ? '' : 'hidden md:inline-block'}`} title={t('عربة التسوق', 'Cart')}>
                🛒
                <span className="absolute -top-2 -right-2 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.accent }}>{cart.length}</span>
              </button>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`text-2xl hover:opacity-70 transition z-[70] ${theme.nav.mobileBottom ? 'hidden md:inline-block' : 'inline-block'}`} style={{ color: theme.colors.navFg }}>
                {isMobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>

          </>)}

        </nav>

        {/* ===== قائمة الموبايل - drawer كامل ===== */}
        {isMobileMenuOpen && (
          <>
            {/* overlay */}
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-[55] backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* الدروار */}
            <div
              className={`md:hidden fixed top-0 ${language === 'ar' ? 'left-0' : 'right-0'} h-full w-72 z-[60] shadow-2xl flex flex-col`}
              style={{ backgroundColor: theme.colors.navBg, color: theme.colors.navFg }}
            >
              {/* هيدر الدروار */}
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: theme.colors.navBorder }}>
                <span className="font-black text-lg tracking-wider">{getLocalized(adminSettings.current.logoText)}</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-2xl opacity-60 hover:opacity-100">✕</button>
              </div>

              {/* اللينكات */}
              <nav className="flex-1 overflow-y-auto py-4">
                {[
                  { label: t('الرئيسية', 'Home'), action: () => { goTo('home'); setIsMobileMenuOpen(false); } },
                  { label: t('المتجر', 'Shop'), action: () => { setSelectedCategoryFilter('all'); goTo('shop'); setIsMobileMenuOpen(false); } },
                  { label: t('تواصل', 'Contact'), action: () => { goTo('contact'); setIsMobileMenuOpen(false); } },
                  ...customPages.filter(p => p.showInNav).map(p => ({
                    label: getLocalized(p.title),
                    action: () => { goToCustomPage(p.id); setIsMobileMenuOpen(false); }
                  })),
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={item.action}
                    className={`w-full text-${language === 'ar' ? 'right' : 'left'} px-5 py-4 font-semibold text-base border-b hover:opacity-70 transition`}
                    style={{ borderColor: theme.colors.navBorder, color: theme.colors.navFg }}
                  >
                    {item.label}
                  </button>
                ))}

                {user && (user.role === 'admin' || user.role === 'call_center' || user.role === 'packer' || user.role === 'staff') && (
                  <button
                    onClick={() => { goTo('admin'); setIsMobileMenuOpen(false); }}
                    className="w-full text-left px-5 py-4 font-bold text-red-500 border-b hover:opacity-70 transition"
                    style={{ borderColor: theme.colors.navBorder }}
                  >
                    {t('لوحة التحكم', 'Dashboard')}
                  </button>
                )}
              </nav>

              {/* فوتر الدروار - اللغة والأكونت */}
              <div className="border-t p-4 space-y-3" style={{ borderColor: theme.colors.navBorder }}>
                <button
                  onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                  className="w-full py-2 rounded-lg text-sm font-bold border hover:opacity-70 transition"
                  style={{ borderColor: theme.colors.navBorder, color: theme.colors.navFg }}
                >
                  {language === 'ar' ? '🌐 English' : '🌐 العربية'}
                </button>
                {user ? (
                  <button
                    onClick={() => { goTo('account'); setIsMobileMenuOpen(false); }}
                    className="w-full py-2 rounded-lg text-sm font-bold text-white transition"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    👤 {user.name}
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowLoginModal(true); setIsMobileMenuOpen(false); }}
                    className="w-full py-2 rounded-lg text-sm font-bold text-white transition"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    {t('تسجيل الدخول', 'Login')}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {/* رسالة التنبيه (toast) */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white py-3 px-6 rounded-lg shadow-2xl z-[60] text-sm font-bold text-center max-w-[90vw]" dir="rtl">
          {toast}
        </div>
      )}

      {/* تنبيه الخصم بعد التسجيل - X هنا بيقفل التذكير بس، مش بيلغي أهلية الخصم */}
      {user && firstOrderDiscountEligible && !firstOrderDiscountUsed && !firstOrderBannerDismissed && (
        <div className="fixed left-4 bottom-4 bg-red-600 text-white py-3 px-4 rounded-lg shadow-2xl z-50 text-sm w-64 flex items-start justify-between animate-bounce" dir="rtl">
          <span>{t(`مفاجأة! لديك خصم ${adminSettings.current.promotions.guestDiscount.percentage}% على أول طلب لك بحسابك الجديد!`, `Surprise! You have ${adminSettings.current.promotions.guestDiscount.percentage}% off your first order!`)}</span>
          <button onClick={() => setFirstOrderBannerDismissed(true)} aria-label={t('إغلاق', 'Close')} className="text-white hover:text-gray-300 font-bold ml-2">X</button>
        </div>
      )}

      {/* رسالة خصم الزائر (Guest Discount) - تظهر فقط للعملاء الغير مسجلين دخول */}
      {!user && adminSettings.current.promotions.guestDiscount.enabled && !guestDiscountDismissed && (
        <div
          className={`fixed bottom-4 ${language === 'ar' ? 'right-4' : 'left-4'} z-50 w-72 max-w-[88vw] bg-[var(--lava-card)] border border-[var(--lava-border)] rounded-xl shadow-2xl overflow-hidden`}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          role="complementary"
          aria-label={t('عرض ترويجي', 'Promotional offer')}
        >
          <div className="bg-black text-white px-4 py-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <span>🎁</span>
              <span>{getLocalized(adminSettings.current.promotions.guestDiscount.title)}</span>
            </div>
            <button
              onClick={() => setGuestDiscountDismissed(true)}
              aria-label={t('إغلاق', 'Close')}
              className="text-white/80 hover:text-white text-lg leading-none font-bold shrink-0 -mt-0.5"
            >
              ✕
            </button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-[var(--lava-text)] leading-relaxed">
              {getLocalized(adminSettings.current.promotions.guestDiscount.message)}
            </p>
            <button
              onClick={() => { setShowLoginModal(true); setIsRegistering(false); }}
              className="w-full bg-black text-white font-bold py-2.5 rounded-lg hover:bg-gray-800 transition text-sm"
            >
              {getLocalized(adminSettings.current.promotions.guestDiscount.buttonText)}
            </button>
          </div>
        </div>
      )}

      {/* بوب أب عرض الترحيب (Welcome Offer) - إغلاقه مستقل تماماً عن خصم أول طلب/خصم الزائر */}
      {adminSettings.current.promotions.welcomeOffer.enabled && welcomeOfferVisible && !welcomeOfferClosed && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setWelcomeOfferClosed(true)}>
          <div
            className="bg-gradient-to-br from-white via-gray-50 to-gray-100 rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden relative animate-fade-in max-h-[90vh] flex flex-col border border-[var(--lava-border)]"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setWelcomeOfferClosed(true)}
              aria-label={t('إغلاق', 'Close')}
              className={`absolute top-3 ${language === 'ar' ? 'left-3' : 'right-3'} z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/70 text-white hover:bg-black transition text-lg font-bold leading-none`}
            >
              ✕
            </button>
            {adminSettings.current.promotions.welcomeOffer.image ? (
              <div className="w-full h-48 bg-[var(--lava-secondary)] shrink-0">
                <img src={adminSettings.current.promotions.welcomeOffer.image} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-32 bg-gradient-to-r from-black via-gray-800 to-gray-600 flex items-center justify-center text-white text-4xl font-black">
                ✨
              </div>
            )}
            <div className="p-6 space-y-3 overflow-y-auto text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                <span>🎁</span>
                <span>{t('عرض خاص', 'Special Offer')}</span>
              </div>
              <h2 className="text-2xl font-extrabold text-[var(--lava-text)]">{getLocalized(adminSettings.current.promotions.welcomeOffer.title)}</h2>
              {getLocalized(adminSettings.current.promotions.welcomeOffer.offerText) && (
                <p className="text-lg font-bold text-red-600">{getLocalized(adminSettings.current.promotions.welcomeOffer.offerText)}</p>
              )}
              {getLocalized(adminSettings.current.promotions.welcomeOffer.description) && (
                <p className="text-sm text-[var(--lava-muted)] leading-relaxed">{getLocalized(adminSettings.current.promotions.welcomeOffer.description)}</p>
              )}
              <button
                onClick={handleWelcomeOfferCTA}
                className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition mt-2 shadow-lg"
              >
                {getLocalized(adminSettings.current.promotions.welcomeOffer.buttonText)}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ===== نافذة الإضافة السريعة للسلة من على الكارت ===== */}
      {quickAddProduct && (
        <QuickAddModal product={quickAddProduct} onClose={() => setQuickAddProduct(null)} />
      )}

      {/* ===== مودال مكافأة الولاء ===== */}
      {loyaltyRewardModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[75] p-4">
          <div
            className="bg-[var(--lava-card)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative animate-fade-in border border-yellow-200"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-6 text-center">
              <div className="text-5xl mb-2">🏆</div>
              <h2 className="text-xl font-extrabold text-white">{loyaltyRewardModal.title ? (language === 'ar' ? loyaltyRewardModal.title.ar : loyaltyRewardModal.title.en) : t('مبروك! استحقيت مكافأة!', 'Congratulations! You earned a reward!')}</h2>
            </div>
            <div className="p-6 space-y-4 text-center">
              <p className="text-[var(--lava-muted)] text-sm">{loyaltyRewardModal.message ? (language === 'ar' ? loyaltyRewardModal.message.ar : loyaltyRewardModal.message.en) : t('كملت العدد المطلوب من الطلبات!', 'You completed the required number of orders!')}</p>
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                <p className="text-xs text-[var(--lava-muted)] mb-1">{t('كود الخصم الخاص بيك:', 'Your discount code:')}</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl font-black tracking-widest text-yellow-700 font-mono">{loyaltyRewardModal.code}</span>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(loyaltyRewardModal.code); showToast(t('تم نسخ الكود!', 'Code copied!')); }}
                    className="bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded hover:bg-yellow-500 transition"
                  >
                    {t('نسخ', 'Copy')}
                  </button>
                </div>
                {loyaltyRewardModal.rewardType === 'percentage' && (
                  <p className="text-sm font-bold text-yellow-700 mt-1">{t(`خصم ${loyaltyRewardModal.rewardValue}% على طلبك`, `${loyaltyRewardModal.rewardValue}% off your order`)}</p>
                )}
                {loyaltyRewardModal.rewardType === 'fixed' && (
                  <p className="text-sm font-bold text-yellow-700 mt-1">{t(`خصم ${loyaltyRewardModal.rewardValue} ج.م`, `${loyaltyRewardModal.rewardValue} EGP off`)}</p>
                )}
                {loyaltyRewardModal.specificProductId && (
                  <p className="text-xs text-[var(--lava-muted)] mt-1">{t('* صالح لمنتج معين فقط', '* Valid for a specific product only')}</p>
                )}
              </div>
              <p className="text-xs text-[var(--lava-muted)]">{t('احتفظ بالكود واستخدمه في طلبك القادم', 'Save this code and use it on your next order')}</p>
              <button
                onClick={() => setLoyaltyRewardModal(null)}
                className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition"
              >
                {t('رائع! شكراً', 'Awesome! Thank you')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--lava-card)] rounded-xl shadow-2xl max-w-md w-full p-8 relative">
            <button
              onClick={() => {
                setShowLoginModal(false);
                setLoginEmail('');
                setLoginPassword('');
                setLoginPhone('');
                setOtpCode('');
                setOtpStep('email');
                setResetCode('');
                setNewPassword('');
              }}
              className={`absolute top-4 ${language === 'ar' ? 'left-4' : 'right-4'} text-[var(--lava-muted)] font-bold text-lg`}
            >✕</button>

            {!isRegistering ? (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">{t('تسجيل الدخول', 'Login')}</h2>

                {otpStep === 'email' && (
                  <form onSubmit={handleCheckEmail} className="space-y-4">
                    <InputField label={t('البريد الإلكتروني', 'Email')} type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required={true} id="loginEmail" />
                    {/* ===== موافقة الماركتنج - نفس checkbox شاشة "إنشاء حساب"، بس هنا =====
                        بتظهر قبل ما نعرف الحساب جديد ولا موجود (زي Shopify بالظبط)،
                        وبتتستخدم بس لو الحساب هيتعمل تلقائي أول مرة (تسجيل دخول بالكود). */}
                    <label htmlFor="loginMarketingConsent" className={`flex items-start gap-2 text-sm text-[var(--lava-muted)] ${language === 'ar' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
                      <input type="checkbox" id="loginMarketingConsent" checked={loginMarketingConsent} onChange={(e) => setLoginMarketingConsent(e.target.checked)} className="mt-1" />
                      <span>{t('عايز أستلم عروض وأخبار عن المنتجات عبر الإيميل', 'I want to receive product offers and news by email')}</span>
                    </label>
                    <button type="submit" disabled={checkingEmail} className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-50">{checkingEmail ? t('جاري التحقق...', 'Checking...') : t('متابعة', 'Continue')}</button>
                  </form>
                )}

                {otpStep === 'password' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <p className="text-sm text-[var(--lava-muted)] text-center">{loginEmail}</p>
                    <InputField label={t('كلمة المرور', 'Password')} type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required={true} id="loginPassword" />
                    <button type="submit" className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition">{t('دخول', 'Login')}</button>
                    <div className="text-center">
                      <button type="button" disabled={forgotPasswordSending} onClick={handleForgotPassword} className="text-sm text-blue-600 hover:underline font-semibold disabled:text-[var(--lava-muted)]">{t('نسيت كلمة المرور؟', 'Forgot password?')}</button>
                    </div>
                  </form>
                )}

                {otpStep === 'forgotCode' && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <p className="text-sm text-[var(--lava-muted)] text-center">{t(`أرسلنا كود إعادة تعيين كلمة المرور إلى ${loginEmail}`, `We sent a password reset code to ${loginEmail}`)}</p>
                    <InputField label={t('كود التحقق', 'Verification Code')} type="text" inputMode="numeric" maxLength={6} value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required={true} id="resetOtpCode" />
                    <InputField label={t('كلمة المرور الجديدة', 'New Password')} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required={true} id="newPassword" />
                    <button type="submit" disabled={resettingPassword} className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-50">{resettingPassword ? t('جاري الحفظ...', 'Saving...') : t('تغيير كلمة المرور والدخول', 'Change password & login')}</button>
                    <div className="flex justify-between text-sm">
                      <button type="button" onClick={() => { setOtpStep('password'); setResetCode(''); setNewPassword(''); }} className="text-blue-600 hover:underline font-semibold">{t('رجوع', 'Back')}</button>
                      <button type="button" disabled={forgotPasswordCooldown > 0 || forgotPasswordSending} onClick={handleForgotPassword} className="text-blue-600 hover:underline font-semibold disabled:text-[var(--lava-muted)]">{forgotPasswordCooldown > 0 ? `${forgotPasswordCooldown}s` : t('إرسال الكود مرة أخرى', 'Resend code')}</button>
                    </div>
                  </form>
                )}

                {otpStep === 'code' && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <p className="text-sm text-[var(--lava-muted)] text-center">{t(`أرسلنا كوداً إلى ${loginEmail}`, `We sent a code to ${loginEmail}`)}</p>
                    <InputField label={t('كود التحقق', 'Verification Code')} type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required={true} id="loginOtpCode" />
                    <button type="submit" disabled={otpVerifying} className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-50">{otpVerifying ? t('جاري التحقق...', 'Verifying...') : t('دخول', 'Login')}</button>
                    <div className="flex justify-between text-sm">
                      <button type="button" onClick={() => { setOtpStep('email'); setOtpCode(''); }} className="text-blue-600 hover:underline font-semibold">{t('تغيير الإيميل', 'Change email')}</button>
                      <button type="button" disabled={otpCooldown > 0 || otpSending} onClick={handleSendOtp} className="text-blue-600 hover:underline font-semibold disabled:text-[var(--lava-muted)]">{otpCooldown > 0 ? `${otpCooldown}s` : t('إرسال الكود مرة أخرى', 'Resend code')}</button>
                    </div>
                  </form>
                )}

                {adminSettings.current.customerLoginMethod === 'email_password' && otpStep !== 'code' && otpStep !== 'forgotCode' && (
                  <div className="mt-4 text-center">
                    <button onClick={() => setIsRegistering(true)} className="text-sm text-blue-600 hover:underline font-semibold">{t(`ليس لديك حساب؟ إنشاء حساب جديد (واحصل على خصم ${adminSettings.current.promotions.guestDiscount.percentage}% على أول طلب)`, `Don't have an account? Sign up (get ${adminSettings.current.promotions.guestDiscount.percentage}% off your first order)`)}</button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">{t('إنشاء حساب جديد', 'Sign Up')}</h2>
                <form onSubmit={handleRegister} className="space-y-4">
                  <InputField label={t('الاسم بالكامل', 'Full Name')} type="text" value={regName} onChange={(e) => setRegName(e.target.value)} required={true} id="regName" />
                  <InputField label={t('البريد الإلكتروني', 'Email')} type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required={true} id="regEmail" />
                  <InputField label={t('رقم الهاتف', 'Phone')} type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} required={true} id="regPhone" />
                  <InputField label={t('كلمة المرور', 'Password')} type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required={true} id="regPassword" />
                  <label htmlFor="regMarketingConsent" className={`flex items-start gap-2 text-sm text-[var(--lava-muted)] ${language === 'ar' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
                    <input type="checkbox" id="regMarketingConsent" checked={regMarketingConsent} onChange={(e) => setRegMarketingConsent(e.target.checked)} className="mt-1" />
                    <span>{t('عايز أستلم عروض وأخبار عن المنتجات عبر الإيميل', 'I want to receive product offers and news by email')}</span>
                  </label>
                  <button type="submit" className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition">{t('تسجيل حساب', 'Sign Up')}</button>
                </form>
                <div className="mt-4 text-center">
                  <button onClick={() => setIsRegistering(false)} className="text-sm text-blue-600 hover:underline font-semibold">{t('لديك حساب بالفعل؟ تسجيل الدخول', 'Already have an account? Login')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* المحتوى الرئيسي */}
      {/* ============================================================ */}
      <main className={`flex-grow ${theme.nav.mobileBottom ? 'pb-16 md:pb-0' : ''}`}>

        {/* ========== الصفحة الرئيسية ========== */}
        {currentPage === 'home' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <HomePage {...{ ProductsGrid, adminSettings, categories, currentPage, faqs, getLocalized, goTo, homeSections, isProductVisibleToCustomer, language, products, productsLoading, renderSectionsList, setSelectedCategoryFilter, t, theme }} />
          </Suspense>
        )}

        {/* ========== صفحة المتجر ========== */}
        {currentPage === 'shop' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <ShopPage {...{ ColorDots, DiscountBadge, LowStockBadge, allAvailableColors, currentPage, fetchShopPage, filterColor, filterFeaturedOnly, filterMaxPrice, filterMinPrice, filterOnSaleOnly, filterSizes, getEffectivePrice, getLocalized, getProductStockStatus, getProductTotalStock, handleQuickAdd, isInWishlist, isSaleActive, language, openProductDetails, priceBounds, randomFeaturedSuggestions, searchQuery, searchSuggestions, selectedCategoryFilter, setFilterColor, setFilterFeaturedOnly, setFilterMaxPrice, setFilterMinPrice, setFilterOnSaleOnly, setFilterSizes, setSearchQuery, setSelectedCategoryFilter, setShopSortBy, setShowSearchDropdown, shopInitialLoading, shopItems, shopLoadingMore, shopPageNum, shopSortBy, shopTotal, showSearchDropdown, t, theme, toggleWishlist }} />
          </Suspense>
        )}

        {/* ========== صفحة المفضلة (Wishlist) ========== */}
        {currentPage === 'wishlist' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <WishlistPage {...{ ColorDots, DiscountBadge, LowStockBadge, addToCart, currentPage, getDefaultVariant, getLocalized, getProductStockStatus, getVariantStock, goTo, hasColors, isSaleActive, language, openProductDetails, products, productsLoading, setSelectedCategoryFilter, t, theme, toggleWishlist, wishlist }} />
          </Suspense>
        )}

        {/* ========== صفحة تفاصيل المنتج ========== */}
        {currentPage === 'product-details' && selectedProduct && (
          <Suspense fallback={<PageLoadingFallback />}>
            <ProductDetailsPage {...{ SectionProductCard, activeImageIndex, addBundleToCart, addToCart, adminSettings, bundleSelections, buyNow, currentPage, getActiveProductOffers, getCanonicalVariantId, getDefaultVariant, getEffectivePrice, getLocalized, getLowStockThreshold, getProductStockStatus, getPromotionLabel, getSizeStockArray, getVariantById, getVariantImages, getVariantStock, getVariantTotalStock, getVariants, goTo, hasColors, isInWishlist, isProductVisibleToCustomer, isReviewsEnabled, isSaleActive, isSubmittingReview, language, openProductDetails, productQuantity, productReviews, products, recentlyViewedIds, resolveActivePromotionForProduct, reviewComment, reviewImagePreview, reviewName, reviewRating, selectedBundleIds, selectedColor, selectedProduct, selectedSize, setActiveImageIndex, setBundleSelections, setProductQuantity, setReviewComment, setReviewImageFile, setReviewImagePreview, setReviewName, setReviewRating, setSelectedColor, setSelectedSize, showToast, submitProductReview, t, toggleBundleItem, toggleWishlist }} />
          </Suspense>
        )}

        {/* ========== صفحة الدفع ========== */}
        {currentPage === 'checkout' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <CheckoutPage {...{ NO_COLOR_ID, adminSettings, appliedDiscount, applyDiscountCode, calculateCartTotals, cart, currentPage, discountInput, getLocalized, getVariantStock, goTo, language, products, removeDiscountCode, removeFromCart, setDiscountInput, t, updateCartItemQuantity }} />
          </Suspense>
        )}


        {/* ========== صفحة بيانات الشحن والدفع (خطوة منفصلة عن السلة) ========== */}
        {currentPage === 'checkout-details' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <CheckoutDetailsPage {...{ adminSettings, appliedDiscount, calculateCartTotals, cart, checkoutNotes, checkoutPaymentMethod, countries, currentPage, getLocalized, goTo, governorates, handleCheckoutSubmit, hasSavedShipping, isPlacingOrder, language, saveShippingInfo, selectedCountry, selectedGov, selectedShippingProvider, selectedWalletMethodId, setCheckoutNotes, setCheckoutPaymentMethod, setSaveShippingInfo, setSelectedCountry, setSelectedGov, setSelectedShippingProvider, setSelectedWalletMethodId, setShippingAddress, setShippingApartment, setShippingBuildingNumber, setShippingCity, setShippingDistrict, setShippingEmail, setShippingFloor, setShippingFullName, setShippingLandmark, setShippingPhone, setShippingPhone2, setShippingZipCode, setUseExistingAddress, setWalletScreenshotFile, setWalletScreenshotPreview, setWalletSenderPhone, setWalletTransferDate, shippingAddress, shippingApartment, shippingBuildingNumber, shippingCity, shippingCoverage, shippingDistrict, shippingEmail, shippingFloor, shippingFullName, shippingHasCandidates, shippingLandmark, shippingPhone, shippingPhone2, shippingProviders, shippingRates, shippingRatesLoading, shippingZipCode, t, useExistingAddress, user, walletScreenshotPreview, walletSenderPhone, walletTransferDate }} />
          </Suspense>
        )}

        {/* ========== صفحة تأكيد الطلب ========== */}
        {currentPage === 'order-confirmation' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <OrderConfirmationPage {...{ currentPage, goTo, lastOrderId, lastOrderNumber, lastOrderPaymentMethod, t }} />
          </Suspense>
        )}

        {/* ========== صفحة الرجوع من بوابة الدفع (Kashier أو Paymob) ========== */}
        {currentPage === 'payment-complete' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <PaymentCompletePage {...{ currentPage, goTo, kashierPaymentOrderId, kashierPaymentStatus, recheckPaymentStatus, t }} />
          </Suspense>
        )}

        {/* ========== صفحة الحساب ========== */}
        {currentPage === 'account' && user && (
          <Suspense fallback={<PageLoadingFallback />}>
            <AccountPage {...{ currentPage, editAccountData, goTo, handleLogout, isEditingAccount, language, setEditAccountData, setIsEditingAccount, setUser, showToast, t, user }} />
          </Suspense>
        )}

        {/* ========== صفحة طلباتي ========== */}
        {currentPage === 'my-orders' && user && (
          <Suspense fallback={<PageLoadingFallback />}>
            <MyOrdersPage {...{ adminSettings, currentPage, exchangeFormLoading, exchangeFormNote, exchangeFormOrderId, exchangeFormProducts, exchangeFormReasonCode, exchangeFormSelection, getCanonicalVariantId, getDefaultVariant, getLocalized, goTo, hasColors, language, myExchangeRequests, orders, returnFormLoading, returnFormOrderId, returnFormReason, returnFormReasonCode, returnFormSelection, setExchangeFormLoading, setExchangeFormNote, setExchangeFormOrderId, setExchangeFormProducts, setExchangeFormReasonCode, setExchangeFormSelection, setMyExchangeRequests, setOrders, setReturnFormLoading, setReturnFormOrderId, setReturnFormReason, setReturnFormReasonCode, setReturnFormSelection, setSelectedCategoryFilter, t, user }} />
          </Suspense>
        )}

        {/* ========== صفحة التواصل ========== */}
        {/* ===== [Lazy Loading] الصفحة اتنقلت لملف مستقل src/pages/ContactPage.jsx
            وبتتحمّل (lazy) بس لما الزائر يدخل عليها - شوف تعريف ContactPage
            (React.lazy) فوق مع باقي الـimports. ===== */}
        {currentPage === 'contact' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <ContactPage
              t={t}
              language={language}
              handleContactSubmit={handleContactSubmit}
              contactName={contactName}
              setContactName={setContactName}
              contactPhone={contactPhone}
              setContactPhone={setContactPhone}
              contactMsg={contactMsg}
              setContactMsg={setContactMsg}
            />
          </Suspense>
        )}

        {/* ========== صفحة الاسترجاع والاستبدال ==========
            المحتوى بالكامل جاي من adminSettings.current.returnsPolicy (Settings في
            الباك اند)، وأي رقم فيه ({{returnFee}}/{{exchangeFee}}/...) بيتستبدل هنا
            وقت العرض من نفس Settings اللي بيعتمد عليها الـBackend Business Logic -
            مفيش رقم Hardcoded في الصفحة دي. */}
        {currentPage === 'returns-policy' && <Suspense fallback={<PageLoadingFallback />}>
            <ReturnsPolicyPage {...{ adminSettings, currentPage, getLocalized, language, t }} />
          </Suspense>}

        {/* ========== صفحة "استرجاع/استبدال بدون تسجيل دخول" ========== */}
        {currentPage === 'guest-return-exchange' && (
          <ErrorBoundary fallbackTitle="حصل خطأ في صفحة الاسترجاع/الاستبدال" fallbackSubtitle="من فضلك رجّع الصفحة وحاول تاني. لو استمرت المشكلة، تواصل مع الدعم الفني.">
            <Suspense fallback={<PageLoadingFallback />}>
              <GuestReturnExchangePage
                t={t}
                getLocalized={getLocalized}
                returnsEnabled={adminSettings.current.enableReturns !== false}
                exchangesEnabled={adminSettings.current.enableExchanges !== false}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* ========== صفحة مخصصة (أضافها الأدمن) ========== */}
        {currentPage === 'custom-page' && <Suspense fallback={<PageLoadingFallback />}>
            <CustomContentPage {...{ activeCustomPageId, currentPage, customPages, getLocalized, renderSectionsList, t }} />
          </Suspense>}

        {/* ========== لوحة التحكم ========== */}
        {currentPage === 'admin' && user && (user.role === 'admin' || user.role === 'call_center' || user.role === 'packer' || user.role === 'staff') && (
          <Suspense fallback={<PageLoadingFallback />}>
          <ErrorBoundary fallbackTitle="حصل خطأ في لوحة التحكم" fallbackSubtitle="من فضلك رجّع الصفحة وحاول تاني. لو استمرت المشكلة، تواصل مع الدعم الفني.">
            <AdminPanel {...{ AVAILABLE_SIZE_OPTIONS, EXPENSE_CATEGORIES, PRODUCT_SECTION_TYPES, abandonedCartIdleMinutes, abandonedCartIdleMinutesInput, abandonedCarts, abandonedCartsLoading, abandonedCartsPage, abandonedCartsPageSize, abandonedCartsTotal, abandonedCartsTotalPages, activeSegmentKey, activityLogFilter, activityLogs, activityLogsLoading, activityLogsPage, activityLogsPageSize, activityLogsTotal, activityLogsTotalPages, addCustomPage, addCustomPageSection, addHomeSection, adminAuthConfig, adminExchangeFormLoading, adminExchangeFormNote, adminExchangeFormOrderId, adminExchangeFormProducts, adminExchangeFormReasonCode, adminExchangeFormSelection, adminExchangeRequests, adminOtpCode, adminOtpCooldown, adminOtpSending, adminOtpSent, adminOtpSentTo, adminProductFilter, adminProductSearch, adminReviews, adminReviewsLoading, adminReviewsStatusFilter, adminSettings, adminSidebarOpen, adminTab, apiSubTab, brevoBusy, brevoCampaign, brevoConfigured, brevoMarketing, brevoStats, bumpSettings, bundleDiscountPercent, bundleProductIds, campaignFormOpen, campaignProductSearch, canAccess, cancellingShipmentOrderId, cartFilter, cartSearch, categories, closeProductEditor, confirmDeleteProductId, contactMessages, countries, creatingShipmentOrderId, currentPage, customPages, customerOrdersLoading, customerSegments, customerSegmentsLoading, customersList, customersLoading, customersPage, customersPageSize, customersTotal, customersTotalPages, deleteAdminReview, deleteCustomPage, deleteCustomPageSection, deleteHomeSection, deleteProduct, deletePromotion, discountCodes, duplicateProduct, editShippingCompany, editShippingNotes, editShippingStatus, editTrackingNumber, editingFaqId, editingProductOfferId, editingPromotionId, editingShippingOrderId, editingStaffId, editingStaffPermissions, exchangeReviewLoadingId, exchangeReviewReasonCodeById, exchangeStatusUpdatingId, exchangeSyncingId, exchangeTrackingInputById, exchangeTrackingSavingId, expandedCart, expandedOrderIds, expenses, exportAllOrders, exportCatalog, exportConfirmedOrders, exportRangePreset, setExportRangePreset, exportRangeFrom, setExportRangeFrom, exportRangeTo, setExportRangeTo, faqs, fetchAbandonedCarts, fetchActivityLogs, fetchCustomerSegments, fetchCustomers, fetchOrders, fetchReAdminList, fetchStoreHealth, fetchTrafficStats, fetchingLabelOrderId, generateVariantsPreview, getCanonicalVariantId, getDefaultVariant, getLocalized, getLowStockThreshold, getProductCategoryId, getProductOfferThreshold, getProductStockStatus, getPromotionLabel, getSizeStockArray, getVariants, governorates, handleColorImageDragStart, handleColorImageDrop, handleColorImageUpload, handleImageDragStart, handleImageDrop, handleProductImageUpload, handleProductRecSelect, handleReAdminExchangeInspect, handleReAdminExchangeStatus, handleReAdminMoneyTransfer, handleReAdminReturnInspect, handleReAdminReturnStatus, handleReAdminReview, handleSaveProduct, handleSendAdminOtp, handleWelcomeOfferImageUpload, hasColors, homeSections, isProductVisibleToCustomer, isPromotionCurrentlyActive, isSavingProduct, kashierAdminStatus, kashierAdminStatusLoading, language, loyaltyProgram, moderateReviewStatus, moveColorImage, newCatImg, newCatNameAr, newCatNameEn, newExpenseAmount, newExpenseCategory, newExpenseDate, newExpenseTitle, newFaqAAr, newFaqAEn, newFaqQAr, newFaqQEn, newGovCost, newGovCountryId, newGovNameAr, newGovNameEn, newPageSectionButtonAction, newPageSectionButtonTextAr, newPageSectionButtonTextEn, newPageSectionDescAr, newPageSectionDescEn, newPageSectionDisplayStyle, newPageSectionImage, newPageSectionProductCount, newPageSectionProductIds, newPageSectionTitleAr, newPageSectionTitleEn, newPageSectionType, newPageTitleAr, newPageTitleEn, newProdCat, newProdColorHex, newProdColorImages, newProdColorNameAr, newProdColorNameEn, newProdColors, newProdCost, newProdCustomSize, newProdDescAr, newProdDescEn, newProdEnableBundle, newProdEnableRec, newProdEnableReviews, newProdHasColors, newProdHasSizes, newProdImageFiles, newProdImgs, newProdIsFeatured, newProdLowStockThreshold, newProdMetaDescAr, newProdMetaDescEn, newProdMetaKeywordsAr, newProdMetaKeywordsEn, newProdMetaTitleAr, newProdMetaTitleEn, newProdNameAr, newProdNameEn, newProdOnSale, newProdPermanentSalePrice, newProdPrice, newProdSalePrice, newProdSelectedSizes, newProdSlug, newProdVariantStockInputs, newProdVariantsGenerated, newProdVideo, newProdVisibility, newPromoBuyQty, newPromoCategoryId, newPromoDiscountPercent, newPromoEndDate, newPromoFixedAmount, newPromoFreeQty, newPromoMinQty, newPromoName, newPromoPercentage, newPromoProductId, newPromoStartDate, newPromoTarget, newPromoType, newSectionButtonAction, newSectionButtonTextAr, newSectionButtonTextEn, newSectionCategoryId, newSectionDescAr, newSectionDescEn, newSectionDisplayStyle, newSectionImage, newSectionProductCount, newSectionProductIds, newSectionTitleAr, newSectionTitleEn, newSectionType, newStaffEmail, newStaffName, newStaffPassword, newStaffPermissions, newStaffPhone, newStaffRole, onlineNow, openAddProduct, openEditCampaignForm, openEditProduct, openEditSection, openNewCampaignForm, openProductDetails, openReAdminDetails, orderPaymentFilter, orders, ordersLoading, ordersPage, ordersPageSize, ordersTotal, ordersTotalPages, paymentsDashboard, paymentsDashboardLoading, paymobAdminStatus, paymobAdminStatusLoading, poActive, poBuyQty, poDiscountPercent, poFixedAmount, poFreeQty, poMinQty, poName, poType, productEditorDirty, productEditorTab, productManagerMode, productOfferFormOpen, products, productsRef, promoPreviewLang, promotions, promotionsSubTab, reAdminActionLoading, reAdminDateFrom, reAdminDateTo, reAdminList, reAdminLoading, reAdminMoneyAmount, reAdminMoneyDirection, reAdminMoneyMethod, reAdminMoneySaving, reAdminNewReasonAr, reAdminNewReasonEn, reAdminNewReasonType, reAdminNoteDraft, reAdminSearch, reAdminSelected, reAdminSelectedLoading, reAdminStatusFilter, reAdminSubTab, reAdminTypeFilter, reByOrderId, recEnableBundle, recEnableRec, recProductIds, recSearchQuery, refundAmountByOrder, refundLoadingOrderId, revenueStats, revenueStatsLoading, revenueBreakdown, revenueBreakdownLoading, customerStats, customerStatsLoading, salesTrend, salesTrendLoading, dashboardExtras, dashboardExtrasLoading, yearlyComparison, yearlyComparisonLoading, abandonedCartStats, abandonedCartStatsLoading, removeColorImage, removeProductImage, resetCampaignForm, returnFormLoading, returnFormOrderId, returnFormReason, returnFormReasonCode, returnFormSelection, returnFormShippingCost, returnReviewLoadingOrderId, returnReviewReasonCodeByOrder, returnSyncingOrderId, returnTrackingInputByOrder, returnTrackingSavingOrderId, saveAbandonedCartIdleMinutes, saveAdminSettings, saveCampaignPromotion, saveRecommendations, savingAbandonedCartIdleMinutes, sectionButtonActions, selectedCustomer, selectedCustomerOrders, selectedManagedProductId, selectedPageForSection, selectedProductForRec, setAbandonedCartIdleMinutesInput, setAbandonedCartsPage, setAbandonedCartsPageSize, setActiveSegmentKey, setActivityLogFilter, setActivityLogsPage, setActivityLogsPageSize, setAdminAuthConfig, setAdminExchangeFormLoading, setAdminExchangeFormNote, setAdminExchangeFormOrderId, setAdminExchangeFormProducts, setAdminExchangeFormReasonCode, setAdminExchangeFormSelection, setAdminExchangeRequests, setAdminOtpCode, setAdminOtpSent, setAdminOtpSentTo, setAdminProductFilter, setAdminProductSearch, setAdminReviewsStatusFilter, setAdminSidebarOpen, setAdminTab, setApiSubTab, setBrevoBusy, setBrevoCampaign, setBrevoConfigured, setBrevoMarketing, setBundleDiscountPercent, setBundleProductIds, setCampaignProductSearch, setCancellingShipmentOrderId, setCartFilter, setCartSearch, setCategories, setColorImageAsPrimary, setConfirmDeleteProductId, setCountries, setCreatingShipmentOrderId, setCustomerOrdersLoading, setCustomersPage, setCustomersPageSize, setDiscountCodes, setEditShippingCompany, setEditShippingNotes, setEditShippingStatus, setEditTrackingNumber, setEditingFaqId, setEditingProductOfferId, setEditingShippingOrderId, setEditingStaffId, setEditingStaffPermissions, setExchangeReviewLoadingId, setExchangeReviewReasonCodeById, setExchangeStatusUpdatingId, setExchangeSyncingId, setExchangeTrackingInputById, setExchangeTrackingSavingId, setExpandedCart, setExpandedOrderIds, setExpenses, setFaqs, setFetchingLabelOrderId, setGovernorates, setKashierAdminStatus, setKashierAdminStatusLoading, setLoyaltyProgram, setNewCatImg, setNewCatNameAr, setNewCatNameEn, setNewExpenseAmount, setNewExpenseCategory, setNewExpenseDate, setNewExpenseTitle, setNewFaqAAr, setNewFaqAEn, setNewFaqQAr, setNewFaqQEn, setNewGovCost, setNewGovCountryId, setNewGovNameAr, setNewGovNameEn, setNewPageSectionButtonAction, setNewPageSectionButtonTextAr, setNewPageSectionButtonTextEn, setNewPageSectionDescAr, setNewPageSectionDescEn, setNewPageSectionDisplayStyle, setNewPageSectionImage, setNewPageSectionProductCount, setNewPageSectionProductIds, setNewPageSectionTitleAr, setNewPageSectionTitleEn, setNewPageSectionType, setNewPageTitleAr, setNewPageTitleEn, setNewProdCat, setNewProdColorHex, setNewProdColorImages, setNewProdColorNameAr, setNewProdColorNameEn, setNewProdColors, setNewProdCost, setNewProdCustomSize, setNewProdDescAr, setNewProdDescEn, setNewProdEnableBundle, setNewProdEnableRec, setNewProdEnableReviews, setNewProdHasColors, setNewProdHasSizes, setNewProdImgs, setNewProdIsFeatured, setNewProdLowStockThreshold, setNewProdMetaDescAr, setNewProdMetaDescEn, setNewProdMetaKeywordsAr, setNewProdMetaKeywordsEn, setNewProdMetaTitleAr, setNewProdMetaTitleEn, setNewProdNameAr, setNewProdNameEn, setNewProdOnSale, setNewProdPermanentSalePrice, setNewProdPrice, setNewProdSalePrice, setNewProdSelectedSizes, setNewProdSlug, setNewProdVariantStockInputs, setNewProdVariantsGenerated, setNewProdVideo, setNewProdVisibility, setNewPromoBuyQty, setNewPromoCategoryId, setNewPromoDiscountPercent, setNewPromoEndDate, setNewPromoFixedAmount, setNewPromoFreeQty, setNewPromoMinQty, setNewPromoName, setNewPromoPercentage, setNewPromoProductId, setNewPromoStartDate, setNewPromoTarget, setNewPromoType, setNewSectionButtonAction, setNewSectionButtonTextAr, setNewSectionButtonTextEn, setNewSectionCategoryId, setNewSectionDescAr, setNewSectionDescEn, setNewSectionDisplayStyle, setNewSectionImage, setNewSectionProductCount, setNewSectionProductIds, setNewSectionTitleAr, setNewSectionTitleEn, setNewSectionType, setNewStaffEmail, setNewStaffName, setNewStaffPassword, setNewStaffPermissions, setNewStaffPhone, setNewStaffRole, setOrderPaymentFilter, setOrders, setOrdersPage, setOrdersPageSize, setPaymentsDashboard, setPaymobAdminStatus, setPaymobAdminStatusLoading, setPoActive, setPoBuyQty, setPoDiscountPercent, setPoFixedAmount, setPoFreeQty, setPoMinQty, setPoName, setPoType, setProductEditorDirty, setProductEditorTab, setProductImageAsPrimary, setProductOfferFormOpen, setProductVisibility, setProducts, setPromoPreviewLang, setPromotionsSubTab, setReAdminDateFrom, setReAdminDateTo, setReAdminMoneyAmount, setReAdminMoneyDirection, setReAdminMoneyMethod, setReAdminNewReasonAr, setReAdminNewReasonEn, setReAdminNewReasonType, setReAdminNoteDraft, setReAdminSearch, setReAdminSelected, setReAdminStatusFilter, setReAdminSubTab, setReAdminTypeFilter, setRecEnableBundle, setRecEnableRec, setRecProductIds, setRecSearchQuery, setRefundAmountByOrder, setRefundLoadingOrderId, setReturnFormLoading, setReturnFormOrderId, setReturnFormReason, setReturnFormReasonCode, setReturnFormSelection, setReturnFormShippingCost, setReturnReviewLoadingOrderId, setReturnReviewReasonCodeByOrder, setReturnSyncingOrderId, setReturnTrackingInputByOrder, setReturnTrackingSavingOrderId, setSelectedCustomer, setSelectedCustomerOrders, setSelectedPageForSection, setShippingConnectionResults, setShippingFilter, setShippingSearch, setStaffList, setStatsCustomFrom, setStatsCustomTo, setStatsPeriod, setTestingProviderKey, setTrackingShipmentOrderId, setTrafficDays, setWelcomeOfferPreviewLang, setWelcomeOfferProductSearch, shippingConnectionResults, shippingDashboard, shippingDashboardLoading, shippingFilter, shippingProviders, shippingSearch, showToast, staffList, staffSections, statsCustomFrom, statsCustomTo, statsOrders, statsOrdersLoading, statsPeriod, storeHealth, storeHealthLoading, t, testingProviderKey, toDatetimeLocalValue, toggleCustomPageInNav, toggleOrderExpand, togglePromotionActive, trackingShipmentOrderId, trafficDays, trafficLoading, trafficStats, user, welcomeOfferPreviewLang, welcomeOfferProductSearch }} />
          </ErrorBoundary>
          </Suspense>
        )}

        {/* ========== صفحة 404 ========== */}
        {currentPage === 'not-found' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <NotFoundPage {...{ t, goTo, storeName: getLocalized(adminSettings.current.storeName) || 'LAVA' }} />
          </Suspense>
        )}

      </main>

      {/* ============================================================ */}
      {/* الفوتر */}
      {/* ============================================================ */}
      <footer className={`py-10 px-6 md:px-12 ${theme.nav.mobileBottom ? 'pb-24 md:pb-8' : ''}`} style={{ backgroundColor: theme.colors.footerBg, color: theme.colors.footerFg }} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {(() => {
          const footerLinksVisible = (adminSettings.current.footerLinks || []).filter(l => l.enabled !== false);
          // ===== رابط "الاسترجاع والاستبدال" - نظامي، بيتضاف تلقائيًا لعمود الروابط
          // السريعة لو صفحة السياسة مفعّلة، من غير ما يبوّظ روابط الأدمن المخصصة =====
          const showReturnsLink = adminSettings.current.returnsPolicy?.enabled !== false;
          const showLinksCol = footerLinksVisible.length > 0 || showReturnsLink;
          const showCategoriesCol = adminSettings.current.showFooterCategories !== false && categories.length > 0;
          const showContactCol = !!(adminSettings.current.showLocation || adminSettings.current.phone || adminSettings.current.whatsapp || adminSettings.current.email || ['socialFacebook','socialInstagram','socialTiktok','socialYoutube','socialLinkedin','socialSnapchat'].some(k => adminSettings.current[k + 'Enabled'] && adminSettings.current[k]));
          // اسم المتجر ثابت دايماً + أي عمود من التلاتة دول مفعّل
          const visibleCount = 1 + (showLinksCol ? 1 : 0) + (showCategoriesCol ? 1 : 0) + (showContactCol ? 1 : 0);
          const isOdd = visibleCount % 2 === 1;
          // على الموبايل: 2 يمين و2 شمال (grid-cols-2). لو العدد فردي، آخر عمود ظاهر
          // ياخد السطر كامل ويتوسط تحت الاتنين اللي فوق.
          const lastVisibleKey = showContactCol ? 'contact' : showCategoriesCol ? 'categories' : showLinksCol ? 'links' : 'store';
          const spanClass = (key) => (isOdd && key === lastVisibleKey) ? 'col-span-2 max-w-xs mx-auto' : '';

          return (
            <>
              <div className={`max-w-5xl mx-auto grid grid-cols-2 gap-x-6 gap-y-10 sm:flex sm:flex-row sm:flex-wrap sm:justify-center sm:gap-10 text-center ${language === 'ar' ? 'sm:text-right' : 'sm:text-left'}`}>
                {/* ===== عمود: اسم المتجر + وصف ===== */}
                <div className={`${spanClass('store')} sm:w-auto sm:flex-1 sm:min-w-[200px] sm:max-w-xs`}>
                  <h3 className="text-xl font-bold">{getLocalized(adminSettings.current.storeName)}</h3>
                  <p className="text-[var(--lava-muted)] text-xs mt-1">{t('اشعل ستايلك مع أحدث صيحات الموضة.', 'Ignite your style with the latest fashion.')}</p>
                </div>

                {/* ===== عمود: روابط سريعة — مُتحكَّم فيها بالكامل من الأدمن (إضافة/حذف) ===== */}
                {showLinksCol && (
                  <div className={`${spanClass('links')} sm:w-auto sm:flex-1 sm:min-w-[160px] sm:max-w-[220px]`}>
                    <p className="font-bold text-sm mb-3">{t('روابط سريعة', 'Quick Links')}</p>
                    <div className="flex flex-col gap-2 text-[var(--lava-muted)] text-sm">
                      {showReturnsLink && (() => {
                        // ===== الاسم بيتغيّر حسب إيه المفعّل من الأدمن (استرجاع/استبدال/الاتنين) =====
                        const returnsOn = adminSettings.current.enableReturns !== false;
                        const exchangesOn = adminSettings.current.enableExchanges !== false;
                        const policyLabel = returnsOn && exchangesOn
                          ? t('سياسة الاسترجاع والاستبدال', 'Returns & Exchanges Policy')
                          : exchangesOn
                            ? t('سياسة الاستبدال', 'Exchange Policy')
                            : t('سياسة الاسترجاع', 'Returns Policy');
                        const requestLabel = returnsOn && exchangesOn
                          ? t('اطلب استرجاع أو استبدال', 'Request a Return / Exchange')
                          : exchangesOn
                            ? t('اطلب استبدال', 'Request an Exchange')
                            : t('اطلب استرجاع', 'Request a Return');
                        return (
                          <>
                            <button onClick={() => goTo('returns-policy')} className="hover:opacity-80 transition text-start w-fit mx-auto sm:mx-0">{policyLabel}</button>
                            <button onClick={() => goTo('guest-return-exchange')} className="hover:opacity-80 transition text-start w-fit mx-auto sm:mx-0">{requestLabel}</button>
                          </>
                        );
                      })()}
                      {footerLinksVisible.map(link => (
                        <button key={link.id} onClick={() => handleFooterLinkClick(link)} className="hover:opacity-80 transition text-start w-fit mx-auto sm:mx-0">{getLocalized(link.label)}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ===== عمود: التصنيفات — بتتحدّث تلقائياً مع أي تصنيف يضيفه الأدمن، والأدمن يقدر يقفلها بالكامل ===== */}
                {showCategoriesCol && (
                  <div className={`${spanClass('categories')} sm:w-auto sm:flex-1 sm:min-w-[160px] sm:max-w-[220px]`}>
                    <p className="font-bold text-sm mb-3">{t('التصنيفات', 'Categories')}</p>
                    <div className="flex flex-col gap-2 text-[var(--lava-muted)] text-sm">
                      {categories.slice(0, 8).map(cat => (
                        <button key={cat.id} onClick={() => { setSelectedCategoryFilter(getLocalized(cat.name)); goTo('shop'); }} className="hover:opacity-80 transition text-start w-fit mx-auto sm:mx-0">{getLocalized(cat.name)}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ===== عمود: بيانات التواصل + السوشيال ميديا ===== */}
                {showContactCol && (
                  <div className={`${spanClass('contact')} sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-xs`}>
                    <p className="font-bold text-sm mb-3">{t('تواصل معنا', 'Get in Touch')}</p>
                    <div className="text-[var(--lava-muted)] text-sm space-y-1">
                      {adminSettings.current.showLocation ? (
                        <p>{getLocalized(adminSettings.current.locationText)}</p>
                      ) : (
                        <p>{t('متجر أونلاين', 'Online Store')}</p>
                      )}
                      {adminSettings.current.phone && (
                        <p>📞 {adminSettings.current.phone}</p>
                      )}
                      {adminSettings.current.whatsapp && (
                        <p>💬 {t('واتساب:', 'WhatsApp:')} {adminSettings.current.whatsapp}</p>
                      )}
                      {adminSettings.current.email && (
                        <p>✉️ {adminSettings.current.email}</p>
                      )}
                    </div>

                    <div className={`flex justify-center gap-4 text-xl mt-4 ${language === 'ar' ? 'sm:justify-start' : 'sm:justify-end'}`}>
                      {[
                        { key: 'socialFacebook', icon: 'fab fa-facebook', color: '#1877f2' },
                        { key: 'socialInstagram', icon: 'fab fa-instagram', color: '#e4405f' },
                        { key: 'socialTiktok', icon: 'fab fa-tiktok', color: '#ffffff' },
                        { key: 'socialYoutube', icon: 'fab fa-youtube', color: '#ff0000' },
                        { key: 'socialLinkedin', icon: 'fab fa-linkedin', color: '#0a66c2' },
                        { key: 'socialSnapchat', icon: 'fab fa-snapchat', color: '#fffc00' },
                      ].map((platform) => {
                        const enabled = adminSettings.current[platform.key + 'Enabled'];
                        const url = adminSettings.current[platform.key];
                        if (!enabled || !url) return null;
                        return (
                          <a key={platform.key} href={url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform duration-200" style={{ color: platform.color }}>
                            <i className={platform.icon}></i>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="max-w-7xl mx-auto border-t border-gray-700 mt-8 pt-4 text-center text-[var(--lava-muted)] text-xs">
                © {new Date().getFullYear()} {getLocalized(adminSettings.current.storeName)}. {t('جميع الحقوق محفوظة.', 'All rights reserved.')}
              </div>
            </>
          );
        })()}
      </footer>

      {/* ===== مودال تعديل السيكشن ===== */}
      {editingSection && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingSection(null); }}>
          <div className="bg-[var(--lava-card)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-[var(--lava-card)] z-10">
              <h2 className="text-xl font-bold">✏️ {t('تعديل القسم', 'Edit Section')}</h2>
              <button onClick={() => setEditingSection(null)} className="text-[var(--lava-muted)] hover:text-[var(--lava-text)] text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* نوع السيكشن - للمعلومة فقط */}
              <div className="bg-[var(--lava-secondary)] rounded-lg px-4 py-2 text-sm text-[var(--lava-muted)]">
                {t('النوع:', 'Type:')} <span className="font-bold text-[var(--lava-text)]">{editingSection.type}</span>
              </div>

              {/* عنوان + وصف */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-sm">{t('العنوان (عربي)', 'Title (Arabic)')}</label>
                  <input type="text" value={editSecTitleAr} onChange={e => setEditSecTitleAr(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-[var(--lava-card)]" dir="rtl" />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-sm">Title (English)</label>
                  <input type="text" value={editSecTitleEn} onChange={e => setEditSecTitleEn(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-[var(--lava-card)]" dir="ltr" />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-sm">{t('الوصف (عربي)', 'Description (Arabic)')}</label>
                  <textarea value={editSecDescAr} onChange={e => setEditSecDescAr(e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-[var(--lava-card)] resize-none" dir="rtl" />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-sm">Description (English)</label>
                  <textarea value={editSecDescEn} onChange={e => setEditSecDescEn(e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-[var(--lava-card)] resize-none" dir="ltr" />
                </div>
              </div>

              {/* حقول أقسام المنتجات */}
              {PRODUCT_SECTION_TYPES.includes(editingSection.type) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="font-bold text-amber-800 text-sm">⚙️ {t('إعدادات عرض المنتجات', 'Product Display Settings')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-sm">{t('عدد المنتجات', 'Number of Products')}</label>
                      <input type="number" min={1} max={24} value={editSecProductCount} onChange={e => setEditSecProductCount(Number(e.target.value))} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-[var(--lava-card)]" />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-sm">{t('شكل العرض', 'Display Style')}</label>
                      <select value={editSecDisplayStyle} onChange={e => setEditSecDisplayStyle(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-[var(--lava-card)]">
                        <option value="grid">⊞ {t('شبكة', 'Grid')}</option>
                        <option value="masonry">▦ {t('موزاييك', 'Masonry')}</option>
                        <option value="list">☰ {t('قائمة', 'List')}</option>
                        <option value="carousel">◁▷ {t('كاروسيل', 'Carousel')}</option>
                      </select>
                    </div>
                  </div>
                  {editingSection.type === 'products-custom' && (
                    <div>
                      <label className="block font-semibold mb-2 text-sm">{t('اختر المنتجات', 'Choose Products')}</label>
                      <div className="max-h-40 overflow-y-auto border rounded-lg bg-[var(--lava-card)] divide-y">
                        {products.filter(p => isProductVisibleToCustomer(p)).map(p => (
                          <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--lava-secondary)] cursor-pointer">
                            <input type="checkbox" checked={editSecProductIds.includes(String(p.id))}
                              onChange={e => { const sid = String(p.id); setEditSecProductIds(prev => e.target.checked ? [...prev, sid] : prev.filter(x => x !== sid)); }}
                              className="w-4 h-4" />
                            {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 object-cover rounded" />}
                            <span className="text-sm font-medium">{getLocalized(p.name)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {editingSection.type === 'products-category' && (
                    <div>
                      <label className="block font-semibold mb-2 text-sm">{t('اختر القسم', 'Choose Category')}</label>
                      <div className="max-h-40 overflow-y-auto border rounded-lg bg-[var(--lava-card)] divide-y">
                        {categories.map(cat => (
                          <label key={cat.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--lava-secondary)] cursor-pointer">
                            <input type="radio" name="editSecCategoryId" checked={editSecCategoryId === String(cat.id)} onChange={() => setEditSecCategoryId(String(cat.id))} className="w-4 h-4" />
                            {cat.image && <img src={cat.image} alt="" className="w-8 h-8 object-cover rounded" />}
                            <span className="text-sm font-medium">{getLocalized(cat.name)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* حقول الصورة والزرار لأقسام المحتوى */}
              {!PRODUCT_SECTION_TYPES.includes(editingSection.type) && (
                <div className="space-y-3">
                  <div>
                    <ImageUrlOrUploadField label={t('صورة القسم', 'Section Image')} value={editSecImage} onChange={(url) => setEditSecImage(url)} placeholder="https://..." id="editSecImage" showToast={showToast} t={t} />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-sm">{t('الزرار', 'Button')}</label>
                    <select value={editSecButtonAction} onChange={e => setEditSecButtonAction(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-[var(--lava-card)]">
                      {sectionButtonActions.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                  </div>
                  {editSecButtonAction !== 'none' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1 text-sm">{t('نص الزرار (عربي)', 'Button Text (Ar)')}</label>
                        <input type="text" value={editSecButtonTextAr} onChange={e => setEditSecButtonTextAr(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-[var(--lava-card)]" dir="rtl" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 text-sm">Button Text (En)</label>
                        <input type="text" value={editSecButtonTextEn} onChange={e => setEditSecButtonTextEn(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-[var(--lava-card)]" dir="ltr" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex gap-3 p-5 border-t sticky bottom-0 bg-[var(--lava-card)]">
              <button onClick={updateHomeSection} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
                💾 {t('حفظ التعديلات', 'Save Changes')}
              </button>
              <button onClick={() => setEditingSection(null)} className="px-6 py-3 rounded-xl font-bold border border-[var(--lava-border)] hover:bg-[var(--lava-secondary)] transition">
                {t('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <CookieConsentBanner
        hasAnyPixel={hasAnyPixel}
        consent={cookieConsent}
        onDecide={setCookieConsent}
        language={language}
      />

    </div>
  );
}