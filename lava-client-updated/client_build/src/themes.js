// ============================================================
// نظام الثيمات - LAVA Store Themes System
// كل ثيم بيحتوي على:
//   - id: معرّف فريد
//   - name: اسم الثيم (عربي + إنجليزي)
//   - preview: لون معاينة سريعة (hex)
//   - nav: إعدادات شكل الناف
//   - categories: إعدادات شكل قسم الأقسام
//   - colors: ألوان الثيم الأساسية
//   - fonts: خطوط الثيم
//   - buttons: شكل الأزرار
// ============================================================

// ============================================================
// خطوط جاهزة (عربي + إنجليزي) — تتطبق على كل الموقع
// كل فونط بيغطي عربي وإنجليزي مع بعض عشان الاسم/المنتجات تفضل متناسقة
// ============================================================
export const FONT_OPTIONS = [
  {
    id: 'system',
    name: { ar: 'افتراضي', en: 'System Default' },
    google: null, // مفيش تحميل — فونط النظام
    stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif",
  },
  {
    id: 'cairo',
    name: { ar: 'القاهرة', en: 'Cairo' },
    google: 'Cairo:wght@300;400;600;700;800',
    stack: "'Cairo', ui-sans-serif, sans-serif",
  },
  {
    id: 'tajawal',
    name: { ar: 'تجول', en: 'Tajawal' },
    google: 'Tajawal:wght@300;400;500;700;800',
    stack: "'Tajawal', ui-sans-serif, sans-serif",
  },
  {
    id: 'almarai',
    name: { ar: 'المراعي', en: 'Almarai' },
    google: 'Almarai:wght@300;400;700;800',
    stack: "'Almarai', ui-sans-serif, sans-serif",
  },
  {
    id: 'ibm-plex-arabic',
    name: { ar: 'آي بي إم بلكس', en: 'IBM Plex Sans Arabic' },
    google: 'IBM+Plex+Sans+Arabic:wght@300;400;500;600;700',
    stack: "'IBM Plex Sans Arabic', ui-sans-serif, sans-serif",
  },
  {
    id: 'el-messiri',
    name: { ar: 'المسيري (أنيق)', en: 'El Messiri' },
    google: 'El+Messiri:wght@400;500;600;700',
    stack: "'El Messiri', ui-sans-serif, sans-serif",
  },
  {
    id: 'changa',
    name: { ar: 'تشانجا (جريء)', en: 'Changa' },
    google: 'Changa:wght@300;400;600;700;800',
    stack: "'Changa', ui-sans-serif, sans-serif",
  },
];

export const DEFAULT_FONT_ID = 'system';

export const getFontOption = (id) => FONT_OPTIONS.find(f => f.id === id) || FONT_OPTIONS[0];

export const THEMES = {

  // ==============================
  // ثيم 1 - Classic (الأصلي الحالي)
  // ==============================
  classic: {
    id: 'classic',
    name: { ar: 'كلاسيك', en: 'Classic' },
    preview: '#000000',
    description: { ar: 'الثيم الأصلي - ناف علوي بسيط، أقسام شبكة', en: 'Original theme - simple top nav, grid categories' },

    colors: {
      primary: '#000000',
      primaryFg: '#ffffff',
      secondary: '#f3f4f6',
      secondaryFg: '#111827',
      accent: '#dc2626',
      bg: '#ffffff',
      // ===== لون النص الأساسي على خلفية الصفحة (عناوين زي "الأقسام" وأي نص افتراضي) =====
      text: '#111827',
      navBg: '#ffffff',
      navFg: '#374151',
      navBorder: 'rgba(0,0,0,0.08)',
      footerBg: '#111827',
      footerFg: '#ffffff',
      cardBg: '#ffffff',
      cardShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
      badgeBg: '#f3f4f6',
      badgeFg: '#4b5563',
      // ===== لون زرار "تسوق الآن" في صورة الهيرو الرئيسية =====
      heroButtonBg: '#ffffff',
      heroButtonText: '#000000',
    },

    nav: {
      style: 'top',           // top | bottom-mobile | split
      layout: 'classic',      // classic | centered-logo | mega | minimal
      height: 'h-16',
      sticky: true,
      showSearch: false,
      searchStyle: 'inline',  // inline | overlay | sidebar
      mobileMenu: 'dropdown', // dropdown | fullscreen | drawer-right | drawer-left
      mobileBottom: false,    // هل في ناف تحت على موبايل؟
      mobileBottomItems: [],  // الأيقونات في الناف التحتاني
      mobileTopItems: [],  // أيقونات (حساب/مفضلة/عربة) تفضل ظاهرة فوق مع الناف التحتاني
      logoPosition: 'center', // center | left | right
      linksPosition: 'right', // right | left | center
      iconsPosition: 'left',  // left | right
      borderBottom: true,
      transparent: false,     // شفاف فوق الهيرو؟
    },

    categories: {
      style: 'masonry',       // masonry | carousel | grid | list | scroll
      columns: 2,
      showLabel: 'hover',     // always | hover | none
      labelStyle: 'overlay',  // overlay | below | pill
      shape: 'rounded',       // square | rounded | circle
      aspectRatio: 'auto',    // square | landscape | portrait | auto
      gap: 'gap-6',
      firstItemFull: true,    // الأول بيأخد العرض كامل
    },

    buttons: {
      radius: 'rounded-full',  // rounded-none | rounded-md | rounded-lg | rounded-full
      size: 'px-8 py-3',
      style: 'filled',         // filled | outline | ghost
      font: 'font-bold',
    },

    card: {
      radius: 'rounded-lg',
      shadow: 'shadow-md',
      hoverEffect: 'scale',   // scale | lift | glow | none
      imageHeight: 'h-48 md:h-80',
      padding: 'p-3 md:p-5',
      // ===== عدد الكروت في الصف والمسافة بينهم — منفصل بين الموبايل والكمبيوتر =====
      colsMobile: 'grid-cols-2',
      colsDesktop: 'md:grid-cols-3',
      gapMobile: 'gap-4',
      gapDesktop: 'md:gap-8',
      nameFontSize: 'text-sm md:text-xl',
      priceFontSize: 'text-xs md:text-lg',
      priceEmphasis: 'price', // price | name — مين يبقى أبرز في الكارت
      saleColor: '#dc2626',
      showQuickAdd: false, // إظهار زرار الإضافة السريعة للسلة فوق الكارت
      quickAddBg: '#000000',   // خلفية زرار الإضافة السريعة
      quickAddText: '#ffffff', // لون كتابة زرار الإضافة السريعة
      // ===== شارة نسبة الخصم على صورة الكارت =====
      discountBadgeBg: '#dc2626',   // خلفية شارة نسبة الخصم (-XX%)
      discountBadgeText: '#ffffff', // لون كتابة شارة نسبة الخصم
      // ===== نقط الألوان المتاحة تحت الكارت =====
      showColorDots: false, // إظهار نقط الألوان المتاحة للمنتج تحت الكارت
      // ===== شارة "كمية محدودة" على صورة الكارت =====
      showLowStockBadge: false, // إظهار شارة "كمية محدودة" على صورة الكارت لما المخزون منخفض
      // ===== عدد الكروت/المسافة في أقسام الصفحة الرئيسية بس — منفصلة عن إعدادات صفحة المتجر فوق =====
      homeColsMobile: '',   // فاضي = يستخدم إعداد المتجر (colsMobile) تلقائياً
      homeColsDesktop: '',
      homeGapMobile: '',
      homeGapDesktop: '',
    },

    font: {
      body: 'font-sans',
      heading: 'font-extrabold',
      tracking: 'tracking-normal',
    },
    fontFamily: 'system',
  },

  // ==============================
  // ثيم 2 - Luxe Dark (فاخر داكن)
  // ==============================
  luxe: {
    id: 'luxe',
    name: { ar: 'لوكس - داكن', en: 'Luxe Dark' },
    preview: '#1a1a2e',
    description: { ar: 'ثيم فاخر داكن - ناف شفاف فوق الهيرو، أقسام كاروسيل', en: 'Luxury dark theme - transparent nav, carousel categories' },

    colors: {
      primary: '#c9a96e',       // ذهبي
      primaryFg: '#1a1a2e',
      secondary: '#16213e',
      secondaryFg: '#e8d5b7',
      accent: '#c9a96e',
      bg: '#0f0f1a',
      text: '#e8d5b7',
      navBg: 'rgba(15,15,26,0.95)',
      navFg: '#e8d5b7',
      navBorder: 'rgba(201,169,110,0.2)',
      footerBg: '#0a0a12',
      footerFg: '#e8d5b7',
      cardBg: '#16213e',
      cardShadow: '0 8px 32px rgba(201,169,110,0.1)',
      badgeBg: 'rgba(201,169,110,0.15)',
      badgeFg: '#c9a96e',
      heroButtonBg: '#0f0f1a',
      heroButtonText: '#c9a96e',
    },

    nav: {
      style: 'top',
      layout: 'centered-logo',
      height: 'h-20',
      sticky: true,
      showSearch: false,
      searchStyle: 'overlay',
      mobileMenu: 'fullscreen',
      mobileBottom: false,
      mobileBottomItems: [],
      mobileTopItems: [],  // أيقونات (حساب/مفضلة/عربة) تفضل ظاهرة فوق مع الناف التحتاني
      logoPosition: 'center',
      linksPosition: 'left',
      iconsPosition: 'right',
      borderBottom: false,
      transparent: true,
    },

    categories: {
      style: 'carousel',
      columns: 1,
      showLabel: 'always',
      labelStyle: 'overlay',
      shape: 'rounded',
      aspectRatio: 'landscape',
      gap: 'gap-4',
      firstItemFull: false,
    },

    buttons: {
      radius: 'rounded-none',
      size: 'px-10 py-3',
      style: 'outline',
      font: 'font-bold tracking-widest uppercase text-xs',
    },

    card: {
      radius: 'rounded-none',
      shadow: 'shadow-none',
      hoverEffect: 'glow',
      imageHeight: 'h-56 md:h-96',
      padding: 'p-4 md:p-6',
      // ===== عدد الكروت في الصف والمسافة بينهم — منفصل بين الموبايل والكمبيوتر =====
      colsMobile: 'grid-cols-2',
      colsDesktop: 'md:grid-cols-3',
      gapMobile: 'gap-4',
      gapDesktop: 'md:gap-8',
      nameFontSize: 'text-sm md:text-xl',
      priceFontSize: 'text-xs md:text-lg',
      priceEmphasis: 'price', // price | name — مين يبقى أبرز في الكارت
      saleColor: '#dc2626',
      showQuickAdd: false, // إظهار زرار الإضافة السريعة للسلة فوق الكارت
      quickAddBg: '#000000',   // خلفية زرار الإضافة السريعة
      quickAddText: '#ffffff', // لون كتابة زرار الإضافة السريعة
      // ===== شارة نسبة الخصم على صورة الكارت =====
      discountBadgeBg: '#dc2626',   // خلفية شارة نسبة الخصم (-XX%)
      discountBadgeText: '#ffffff', // لون كتابة شارة نسبة الخصم
      // ===== نقط الألوان المتاحة تحت الكارت =====
      showColorDots: false, // إظهار نقط الألوان المتاحة للمنتج تحت الكارت
      // ===== شارة "كمية محدودة" على صورة الكارت =====
      showLowStockBadge: false, // إظهار شارة "كمية محدودة" على صورة الكارت لما المخزون منخفض
      // ===== عدد الكروت/المسافة في أقسام الصفحة الرئيسية بس — منفصلة عن إعدادات صفحة المتجر فوق =====
      homeColsMobile: '',   // فاضي = يستخدم إعداد المتجر (colsMobile) تلقائياً
      homeColsDesktop: '',
      homeGapMobile: '',
      homeGapDesktop: '',
    },

    font: {
      body: 'font-sans',
      heading: 'font-bold tracking-widest uppercase',
      tracking: 'tracking-widest',
    },
    fontFamily: 'el-messiri',
  },

  // ==============================
  // ثيم 3 - Street (ستريت وير)
  // ==============================
  street: {
    id: 'street',
    name: { ar: 'ستريت', en: 'Street' },
    preview: '#ff3c00',
    description: { ar: 'ثيم ستريت وير - ناف سفلي موبايل، أقسام سكرول', en: 'Streetwear theme - mobile bottom nav, scrollable categories' },

    colors: {
      primary: '#ff3c00',       // برتقالي نار
      primaryFg: '#ffffff',
      secondary: '#1a1a1a',
      secondaryFg: '#f5f5f5',
      accent: '#ff3c00',
      bg: '#ffffff',
      text: '#1a1a1a',
      navBg: '#1a1a1a',
      navFg: '#ffffff',
      navBorder: 'transparent',
      footerBg: '#1a1a1a',
      footerFg: '#f5f5f5',
      cardBg: '#f5f5f5',
      cardShadow: 'none',
      badgeBg: '#ff3c00',
      badgeFg: '#ffffff',
      heroButtonBg: '#ff3c00',
      heroButtonText: '#ffffff',
    },

    nav: {
      style: 'top',
      layout: 'minimal',
      height: 'h-14',
      sticky: true,
      showSearch: true,
      searchStyle: 'overlay',
      mobileMenu: 'drawer-right',
      mobileBottom: true,
      mobileBottomItems: ['home', 'shop', 'cart', 'wishlist', 'account'],
      mobileTopItems: [],  // أيقونات (حساب/مفضلة/عربة) تفضل ظاهرة فوق مع الناف التحتاني
      logoPosition: 'center',
      linksPosition: 'right',
      iconsPosition: 'left',
      borderBottom: false,
      transparent: false,
    },

    categories: {
      style: 'scroll',          // أقسام على نفس خط أفقي سكرول
      columns: 1,
      showLabel: 'always',
      labelStyle: 'below',
      shape: 'square',
      aspectRatio: 'portrait',
      gap: 'gap-3',
      firstItemFull: false,
    },

    buttons: {
      radius: 'rounded-sm',
      size: 'px-6 py-2.5',
      style: 'filled',
      font: 'font-black uppercase tracking-wider text-sm',
    },

    card: {
      radius: 'rounded-none',
      shadow: 'shadow-none',
      hoverEffect: 'lift',
      imageHeight: 'h-52 md:h-80',
      padding: 'p-3',
      // ===== عدد الكروت في الصف والمسافة بينهم — منفصل بين الموبايل والكمبيوتر =====
      colsMobile: 'grid-cols-2',
      colsDesktop: 'md:grid-cols-3',
      gapMobile: 'gap-4',
      gapDesktop: 'md:gap-8',
      nameFontSize: 'text-sm md:text-xl',
      priceFontSize: 'text-xs md:text-lg',
      priceEmphasis: 'price', // price | name — مين يبقى أبرز في الكارت
      saleColor: '#dc2626',
      showQuickAdd: false, // إظهار زرار الإضافة السريعة للسلة فوق الكارت
      quickAddBg: '#000000',   // خلفية زرار الإضافة السريعة
      quickAddText: '#ffffff', // لون كتابة زرار الإضافة السريعة
      // ===== شارة نسبة الخصم على صورة الكارت =====
      discountBadgeBg: '#dc2626',   // خلفية شارة نسبة الخصم (-XX%)
      discountBadgeText: '#ffffff', // لون كتابة شارة نسبة الخصم
      // ===== نقط الألوان المتاحة تحت الكارت =====
      showColorDots: false, // إظهار نقط الألوان المتاحة للمنتج تحت الكارت
      // ===== شارة "كمية محدودة" على صورة الكارت =====
      showLowStockBadge: false, // إظهار شارة "كمية محدودة" على صورة الكارت لما المخزون منخفض
      // ===== عدد الكروت/المسافة في أقسام الصفحة الرئيسية بس — منفصلة عن إعدادات صفحة المتجر فوق =====
      homeColsMobile: '',   // فاضي = يستخدم إعداد المتجر (colsMobile) تلقائياً
      homeColsDesktop: '',
      homeGapMobile: '',
      homeGapDesktop: '',
    },

    font: {
      body: 'font-sans',
      heading: 'font-black uppercase',
      tracking: 'tracking-tight',
    },
    fontFamily: 'changa',
  },

  // ==============================
  // ثيم 4 - Minimal Rose (مينيمال وردي)
  // ==============================
  minimal: {
    id: 'minimal',
    name: { ar: 'مينيمال روز', en: 'Minimal Rose' },
    preview: '#f9a8d4',
    description: { ar: 'ثيم مينيمال ناعم - ناف مع سيرش كبير، أقسام شبكة مربعة', en: 'Soft minimal theme - search-forward nav, grid categories' },

    colors: {
      primary: '#be185d',       // وردي داكن
      primaryFg: '#ffffff',
      secondary: '#fdf2f8',
      secondaryFg: '#831843',
      accent: '#f472b6',
      bg: '#fffbfd',
      text: '#4a1d3a',
      navBg: '#fffbfd',
      navFg: '#831843',
      navBorder: 'rgba(190,24,93,0.1)',
      footerBg: '#fdf2f8',
      footerFg: '#831843',
      cardBg: '#ffffff',
      cardShadow: '0 2px 8px rgba(190,24,93,0.08)',
      badgeBg: '#fdf2f8',
      badgeFg: '#be185d',
      heroButtonBg: '#ffffff',
      heroButtonText: '#be185d',
    },

    nav: {
      style: 'top',
      layout: 'mega',          // ناف مع شريط بحث كبير بيطلع في الوسط
      height: 'h-16',
      sticky: true,
      showSearch: true,
      searchStyle: 'inline',
      mobileMenu: 'drawer-left',
      mobileBottom: false,
      mobileBottomItems: [],
      mobileTopItems: [],  // أيقونات (حساب/مفضلة/عربة) تفضل ظاهرة فوق مع الناف التحتاني
      logoPosition: 'left',
      linksPosition: 'right',
      iconsPosition: 'right',
      borderBottom: true,
      transparent: false,
    },

    categories: {
      style: 'grid',
      columns: 3,
      showLabel: 'always',
      labelStyle: 'below',
      shape: 'circle',
      aspectRatio: 'square',
      gap: 'gap-4',
      firstItemFull: false,
    },

    buttons: {
      radius: 'rounded-full',
      size: 'px-8 py-3',
      style: 'filled',
      font: 'font-semibold',
    },

    card: {
      radius: 'rounded-2xl',
      shadow: 'shadow-sm',
      hoverEffect: 'scale',
      imageHeight: 'h-48 md:h-72',
      padding: 'p-4',
      // ===== عدد الكروت في الصف والمسافة بينهم — منفصل بين الموبايل والكمبيوتر =====
      colsMobile: 'grid-cols-2',
      colsDesktop: 'md:grid-cols-3',
      gapMobile: 'gap-4',
      gapDesktop: 'md:gap-8',
      nameFontSize: 'text-sm md:text-xl',
      priceFontSize: 'text-xs md:text-lg',
      priceEmphasis: 'price', // price | name — مين يبقى أبرز في الكارت
      saleColor: '#dc2626',
      showQuickAdd: false, // إظهار زرار الإضافة السريعة للسلة فوق الكارت
      quickAddBg: '#000000',   // خلفية زرار الإضافة السريعة
      quickAddText: '#ffffff', // لون كتابة زرار الإضافة السريعة
      // ===== شارة نسبة الخصم على صورة الكارت =====
      discountBadgeBg: '#dc2626',   // خلفية شارة نسبة الخصم (-XX%)
      discountBadgeText: '#ffffff', // لون كتابة شارة نسبة الخصم
      // ===== نقط الألوان المتاحة تحت الكارت =====
      showColorDots: false, // إظهار نقط الألوان المتاحة للمنتج تحت الكارت
      // ===== شارة "كمية محدودة" على صورة الكارت =====
      showLowStockBadge: false, // إظهار شارة "كمية محدودة" على صورة الكارت لما المخزون منخفض
      // ===== عدد الكروت/المسافة في أقسام الصفحة الرئيسية بس — منفصلة عن إعدادات صفحة المتجر فوق =====
      homeColsMobile: '',   // فاضي = يستخدم إعداد المتجر (colsMobile) تلقائياً
      homeColsDesktop: '',
      homeGapMobile: '',
      homeGapDesktop: '',
    },

    font: {
      body: 'font-sans',
      heading: 'font-bold',
      tracking: 'tracking-normal',
    },
    fontFamily: 'tajawal',
  },

  // ==============================
  // ثيم 5 - Retro (ريترو)
  // ==============================
  retro: {
    id: 'retro',
    name: { ar: 'ريترو', en: 'Retro' },
    preview: '#f59e0b',
    description: { ar: 'ثيم ريترو - ناف علوي مع سبليت ناف موبايل، قوائم قسم كلاسيكية', en: 'Retro theme - split mobile nav, classic category list' },

    colors: {
      primary: '#92400e',       // بني ريترو
      primaryFg: '#fef3c7',
      secondary: '#fef3c7',
      secondaryFg: '#78350f',
      accent: '#f59e0b',
      bg: '#fffbeb',
      text: '#451a03',
      navBg: '#78350f',
      navFg: '#fef3c7',
      navBorder: '#92400e',
      footerBg: '#451a03',
      footerFg: '#fef3c7',
      cardBg: '#ffffff',
      cardShadow: '2px 2px 0px #92400e',
      badgeBg: '#fef3c7',
      badgeFg: '#92400e',
      heroButtonBg: '#ffffff',
      heroButtonText: '#92400e',
    },

    nav: {
      style: 'top',
      layout: 'classic',
      height: 'h-16',
      sticky: true,
      showSearch: false,
      searchStyle: 'inline',
      mobileMenu: 'dropdown',
      // ===== موبايل بوتوم ناف - ناف تحتاني كامل على الموبايل مع أيقونات =====
      mobileBottom: true,
      mobileBottomItems: ['home', 'shop', 'cart', 'wishlist', 'account'],
      mobileTopItems: [],  // أيقونات (حساب/مفضلة/عربة) تفضل ظاهرة فوق مع الناف التحتاني
      logoPosition: 'center',
      linksPosition: 'right',
      iconsPosition: 'left',
      borderBottom: false,
      transparent: false,
    },

    categories: {
      style: 'list',
      columns: 1,
      showLabel: 'always',
      labelStyle: 'overlay',
      shape: 'rounded',
      aspectRatio: 'landscape',
      gap: 'gap-3',
      firstItemFull: false,
    },

    buttons: {
      radius: 'rounded-sm',
      size: 'px-6 py-2.5',
      style: 'filled',
      font: 'font-bold uppercase tracking-wide',
    },

    card: {
      radius: 'rounded-sm',
      shadow: 'shadow-none',
      hoverEffect: 'none',
      imageHeight: 'h-48 md:h-72',
      padding: 'p-3 md:p-4',
      // ===== عدد الكروت في الصف والمسافة بينهم — منفصل بين الموبايل والكمبيوتر =====
      colsMobile: 'grid-cols-2',
      colsDesktop: 'md:grid-cols-3',
      gapMobile: 'gap-4',
      gapDesktop: 'md:gap-8',
      nameFontSize: 'text-sm md:text-xl',
      priceFontSize: 'text-xs md:text-lg',
      priceEmphasis: 'price', // price | name — مين يبقى أبرز في الكارت
      saleColor: '#dc2626',
      showQuickAdd: false, // إظهار زرار الإضافة السريعة للسلة فوق الكارت
      quickAddBg: '#000000',   // خلفية زرار الإضافة السريعة
      quickAddText: '#ffffff', // لون كتابة زرار الإضافة السريعة
      // ===== شارة نسبة الخصم على صورة الكارت =====
      discountBadgeBg: '#dc2626',   // خلفية شارة نسبة الخصم (-XX%)
      discountBadgeText: '#ffffff', // لون كتابة شارة نسبة الخصم
      // ===== نقط الألوان المتاحة تحت الكارت =====
      showColorDots: false, // إظهار نقط الألوان المتاحة للمنتج تحت الكارت
      // ===== شارة "كمية محدودة" على صورة الكارت =====
      showLowStockBadge: false, // إظهار شارة "كمية محدودة" على صورة الكارت لما المخزون منخفض
      // ===== عدد الكروت/المسافة في أقسام الصفحة الرئيسية بس — منفصلة عن إعدادات صفحة المتجر فوق =====
      homeColsMobile: '',   // فاضي = يستخدم إعداد المتجر (colsMobile) تلقائياً
      homeColsDesktop: '',
      homeGapMobile: '',
      homeGapDesktop: '',
    },

    font: {
      body: 'font-serif',
      heading: 'font-bold',
      tracking: 'tracking-wide',
    },
    fontFamily: 'almarai',
  },
};

// الثيم الافتراضي
export const DEFAULT_THEME_ID = 'classic';

/**
 * getTheme(id, adminSettingsRef?)
 *
 * الأولوية:
 *  1. لو ThemeBuilder شغال وعامل _liveTheme → يتطبق فوراً (live preview)
 *  2. لو id === 'custom' وفيه customTheme محفوظ → نرجعه
 *  3. لو id موجود في THEMES → نرجع الثيم الجاهز
 *  4. fallback → classic
 *
 * adminSettingsRef هو adminSettings (useRef) من App.jsx — اختياري
 */
export const getTheme = (id, adminSettingsRef = null) => {
  const settings = adminSettingsRef?.current ?? null;

  // Live preview من ThemeBuilder (بييجي لحظة التعديل قبل الحفظ)
  if (settings?._liveTheme?.colors) return settings._liveTheme;

  // ثيم مخصص محفوظ في DB
  if (id === 'custom' && settings?.customTheme?.colors) return settings.customTheme;

  // ثيم جاهز
  return THEMES[id] || THEMES[DEFAULT_THEME_ID];
};

// للـ ThemeBuilder (نفس الـ THEMES بـ alias)
export const PRESETS = THEMES;

// قائمة الثيمات للعرض في الأدمن
export const THEME_LIST = Object.values(THEMES);