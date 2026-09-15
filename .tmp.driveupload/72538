// ============================================================
// PWA: بناء وتحديث الـ Web App Manifest ديناميكيًا من إعدادات المتجر
// ============================================================
// الهدف: لما حد "يضيف الموقع للشاشة الرئيسية / يثبت البرنامج" من كروم،
// اسم البرنامج وأيقونته يطلعوا مطابقين لاسم المتجر ولوجو الموقع اللي
// الأدمن ضابطه فعليًا من لوحة التحكم (storeName / faviconImage) — حتى لو
// اتغيّروا بعد كده من غير ما حد يعمل بيلد جديد للموقع.
//
// الطريقة: بنعمل ملف manifest.json صغير في الذاكرة (Blob) ونربطه بـ
// <link rel="manifest"> بدل الملف الثابت. الملف الثابت (public/manifest.webmanifest)
// بيفضل موجود كـ fallback (لحد ما إعدادات المتجر توصل من الـ API أو لو JS
// اتعطل لأي سبب).
// ============================================================

let currentManifestBlobUrl = null;

const FALLBACK_ICONS = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

const getOrCreateLink = (rel) => {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }
  return link;
};

const getOrCreateMeta = (name) => {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  return tag;
};

/**
 * بيحدّث اسم وأيقونة الـ PWA (Web App Manifest) عشان تطابق اسم المتجر ولوجو
 * الموقع الحاليين.
 *
 * @param {Object} opts
 * @param {string} opts.name - اسم المتجر الكامل (بيتاخد من storeName)
 * @param {string} [opts.iconUrl] - رابط أيقونة/لوجو المتجر (بيتاخد من faviconImage لو موجودة)
 * @param {string} [opts.themeColor] - لون الثيم الأساسي بتاع المتجر (theme.colors.primary)
 */
export function updatePwaManifest({ name, iconUrl, themeColor } = {}) {
  if (typeof document === 'undefined') return;

  const safeName = String(name || 'LAVA STORE').trim().slice(0, 45) || 'LAVA STORE';
  const safeShortName = safeName.length > 12 ? safeName.slice(0, 12).trim() : safeName;
  const safeThemeColor = themeColor || '#000000';

  // لو فيه أيقونة مخصصة من إعدادات المتجر، نستخدمها. غير كده نرجع للأيقونة
  // الافتراضية المرفقة مع الموقع.
  const icons = iconUrl
    ? [
        { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ]
    : FALLBACK_ICONS;

  const manifest = {
    name: safeName,
    short_name: safeShortName,
    description: safeName,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: safeThemeColor,
    lang: 'ar',
    dir: 'rtl',
    icons,
  };

  try {
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const url = URL.createObjectURL(blob);

    getOrCreateLink('manifest').setAttribute('href', url);

    // نمسح رابط الـ Blob القديم بعد ما نستبدله عشان مانسربش الذاكرة
    if (currentManifestBlobUrl) {
      URL.revokeObjectURL(currentManifestBlobUrl);
    }
    currentManifestBlobUrl = url;
  } catch (err) {
    console.error('تعذّر تحديث الـ PWA manifest:', err);
  }

  // اسم البرنامج لما يتفتح "standalone" على آيفون (add to home screen)
  getOrCreateMeta('apple-mobile-web-app-title').setAttribute('content', safeShortName);

  // لون شريط المتصفح/شاشة البداية يطابق لون المتجر
  getOrCreateMeta('theme-color').setAttribute('content', safeThemeColor);
}

/**
 * تسجيل الـ Service Worker (لازم عشان الموقع يبقى "قابل للتثبيت" من كروم).
 * آمن تمامًا: بيتجاهل أي طلب لـ /api/ ومش بيكاش غير شكل الموقع الأساسي.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('تعذّر تسجيل الـ Service Worker:', err);
    });
  });
}