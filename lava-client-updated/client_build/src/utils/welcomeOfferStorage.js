// ============================================================
// ثبات إعدادات عرض الترحيب عبر LocalStorage (Part 15-18)
// مفتاح واحد فقط مخصص لعرض الترحيب - لا تتفرق الإعدادات في مفاتيح متعددة.
// هذا ثبات مؤقت للواجهة الأمامية فقط، وسيُنقل لاحقاً لقاعدة البيانات عند بناء الباك إند.
// ============================================================
export const WELCOME_OFFER_STORAGE_KEY = 'welcomeOffer';

export function loadWelcomeOfferFromStorage(defaults) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return defaults;
    const raw = window.localStorage.getItem(WELCOME_OFFER_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    // دمج آمن مع الإعدادات الافتراضية عشان لو اتضافت حقول جديدة مستقبلاً متتفقدش
    return {
      ...defaults,
      ...parsed,
      title: { ...defaults.title, ...(parsed.title || {}) },
      description: { ...defaults.description, ...(parsed.description || {}) },
      offerText: { ...defaults.offerText, ...(parsed.offerText || {}) },
      buttonText: { ...defaults.buttonText, ...(parsed.buttonText || {}) },
    };
  } catch (e) {
    return defaults;
  }
}

export function saveWelcomeOfferToStorage(welcomeOfferConfig) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(WELCOME_OFFER_STORAGE_KEY, JSON.stringify(welcomeOfferConfig));
  } catch (e) {
    // لو LocalStorage مش متاح (خاص/ممتلئ) - نتجاهل بهدوء من غير ما نكسر الموقع
  }
}