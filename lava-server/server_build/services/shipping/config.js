const providerDefaults = {
  bosta: { key: 'bosta', name: 'Bosta', mode: 'manual_rate', countries: ['EG'], enabled: false },
  aramex: { key: 'aramex', name: 'Aramex', mode: 'api', countries: ['EG','SA','AE','KW'], enabled: false },
  dhl: { key: 'dhl', name: 'DHL Express', mode: 'api', countries: ['EG','SA','AE','KW'], enabled: false },
  shipblu: { key: 'shipblu', name: 'ShipBlu', mode: 'manual_rate', countries: ['EG'], enabled: false },
};

// المحافظات الـ27 اللي بوسطة بتوصلها فعليًا في مصر (تغطية على مستوى الجمهورية).
// دي القائمة اللي بتتعرض للأدمن عشان يحدد سعر كل محافظة، ونفس القائمة بترجع
// للعميل في التشيك أوت (Coverage list) لو الأدمن لسه ما حددش سعر مخصص للمحافظة.
const EGYPT_GOVERNORATES = [
  { ar: 'القاهرة', en: 'Cairo' }, { ar: 'الجيزة', en: 'Giza' }, { ar: 'الإسكندرية', en: 'Alexandria' },
  { ar: 'القليوبية', en: 'Qalyubia' }, { ar: 'الشرقية', en: 'Sharqia' }, { ar: 'الدقهلية', en: 'Dakahlia' },
  { ar: 'الغربية', en: 'Gharbia' }, { ar: 'المنوفية', en: 'Monufia' }, { ar: 'كفر الشيخ', en: 'Kafr El Sheikh' },
  { ar: 'البحيرة', en: 'Beheira' }, { ar: 'دمياط', en: 'Damietta' }, { ar: 'بورسعيد', en: 'Port Said' },
  { ar: 'الإسماعيلية', en: 'Ismailia' }, { ar: 'السويس', en: 'Suez' }, { ar: 'شمال سيناء', en: 'North Sinai' },
  { ar: 'جنوب سيناء', en: 'South Sinai' }, { ar: 'الفيوم', en: 'Fayoum' }, { ar: 'بني سويف', en: 'Beni Suef' },
  { ar: 'المنيا', en: 'Minya' }, { ar: 'أسيوط', en: 'Asyut' }, { ar: 'سوهاج', en: 'Sohag' },
  { ar: 'قنا', en: 'Qena' }, { ar: 'الأقصر', en: 'Luxor' }, { ar: 'أسوان', en: 'Aswan' },
  { ar: 'البحر الأحمر', en: 'Red Sea' }, { ar: 'الوادي الجديد', en: 'New Valley' }, { ar: 'مطروح', en: 'Matrouh' },
];

const PROVIDER_COVERAGE = { bosta: EGYPT_GOVERNORATES, shipblu: EGYPT_GOVERNORATES };

// بيرجع سعر شحن محافظة معينة من الجدول اللي الأدمن حدده (governorateRates)
// لشركة الشحن دي، بمطابقة الاسم بالعربي أو الإنجليزي. لو مفيش سعر مخصوص
// للمحافظة دي، بيرجع null (عشان الكود اللي بيستخدمها يقرر يرجع للسعر
// الافتراضي defaultRate ولا لأ).
function lookupGovernorateRate(governorateRates, governorateName) {
  const name = String(governorateName || '').trim();
  if (!name || !governorateRates) return null;
  const entry = Object.entries(governorateRates).find(([key]) => {
    if (key === name) return true;
    const gov = EGYPT_GOVERNORATES.find((g) => g.ar === key || g.en === key);
    return gov && (gov.ar === name || gov.en === name);
  });
  if (!entry) return null;
  const value = Number(entry[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// بيرجع قائمة كل المحافظات اللي شركة الشحن دي بتغطيها مع السعر المحدد لكل
// واحدة (لو الأدمن حددهولها) أو null لو لسه معملهاش. ده اللي بيتعرض في
// لوحة التحكم (عشان الأدمن يعبي الأسعار) وفي صفحة التشيك أوت (Coverage).
function getCoverageWithRates(key, governorateRates = {}) {
  const list = PROVIDER_COVERAGE[key] || [];
  return list.map((g) => ({ ...g, price: lookupGovernorateRate(governorateRates, g.ar) }));
}

const bool = (v, fallback = false) => {
  if (v === undefined) return fallback;
  return ['1','true','yes','on'].includes(String(v).toLowerCase());
};

// روابط الـ Sandbox (تجريبي) والـ Production (حقيقي) لكل شركة شحن.
// ده اللي بيخلي زرار "تجريبي/حقيقي" في لوحة التحكم يشتغل فعليًا زي شوبيفاي:
// وانت في وضع "تجريبي" أي طلب بيروح لسيرفر الشركة التجريبي (Sandbox) ومفيش
// أي شحنة حقيقية بتتبعت، ولما تحول لـ"حقيقي" بيبدأ يستخدم سيرفر الإنتاج الفعلي.
const ENVIRONMENT_BASE_URLS = {
  bosta: { production: 'https://app.bosta.co/api/v2', sandbox: 'https://stg-app.bosta.co/api/v2' },
  aramex: { production: 'https://ws.aramex.net', sandbox: 'https://ws.sbx.aramex.net' },
  dhl: { production: 'https://express.api.dhl.com/mydhlapi', sandbox: 'https://express.api.dhl.com/mydhlapi/test' },
  // موثقة في docs.shipblu.com (Quick Start / Tutorial / API Reference).
  shipblu: { production: 'https://api.shipblu.com/api/v1', sandbox: 'https://api.staging.shipblu.com/api/v1' },
};

// بيرجع الرابط الصح حسب البيئة المختارة (production/sandbox). لو حد حدد
// رابط يدوي في متغيرات الـ.env (زي BOSTA_BASE_URL) بيبقى له الأولوية دايمًا.
function resolveBaseUrl(key, environment, explicitOverride) {
  if (explicitOverride) return explicitOverride;
  const env = String(environment || '').toLowerCase() === 'production' ? 'production' : 'sandbox';
  return ENVIRONMENT_BASE_URLS[key]?.[env];
}

function getEnvironmentDefault(envVarValue) {
  return String(envVarValue || '').toLowerCase() === 'production' ? 'production' : 'sandbox';
}

function getEnvConfig() {
  return {
    bosta: {
      ...providerDefaults.bosta,
      enabled: bool(process.env.BOSTA_ENABLED, false),
      environment: getEnvironmentDefault(process.env.BOSTA_ENVIRONMENT),
      apiKey: process.env.BOSTA_API_KEY || '',
      // مفتاح API منفصل للحساب التجريبي (Sandbox) - بوسطة بتديك حساب Staging لوحده
      // بمفتاح مختلف عن حساب الإنتاج. لو مش موجود، هيرجع يستخدم المفتاح العادي
      // (ومعظم الوقت هيفشل لو كان مفتاح إنتاج فعلي، فده مقصود عشان تعرف تحطه).
      sandboxApiKey: process.env.BOSTA_SANDBOX_API_KEY || '',
      baseUrl: process.env.BOSTA_BASE_URL || '',
      defaultRate: Number(process.env.BOSTA_DEFAULT_RATE || 0),
      pickupId: process.env.BOSTA_PICKUP_ID || '',
      // Secret بيتحط كجزء من رابط الـWebhook نفسه (مش HMAC signature، لأن
      // بوسطة رسميًا مبتوفرش توقيع رسمي للـWebhook - شوف تعليق الـwebhook
      // handler في shippingController.js) عشان نتأكد إن اللي بيبعت لينا هو
      // فعلاً بوسطة ومش أي حد عارف الرابط بالصدفة.
      webhookSecret: process.env.BOSTA_WEBHOOK_SECRET || '',
      // جدول أسعار الشحن لكل محافظة على حدة، بيتحط من لوحة التحكم (Settings ->
      // shippingIntegrations.bosta.governorateRates) مش من الـ.env. لو محافظة
      // مالهاش سعر هنا، هيترجع لـ defaultRate كسعر موحّد لكل مصر.
      governorateRates: {},
    },
    aramex: {
      ...providerDefaults.aramex,
      enabled: bool(process.env.ARAMEX_ENABLED, false),
      environment: getEnvironmentDefault(process.env.ARAMEX_ENVIRONMENT),
      username: process.env.ARAMEX_USERNAME || '', password: process.env.ARAMEX_PASSWORD || '',
      accountNumber: process.env.ARAMEX_ACCOUNT_NUMBER || '', accountPin: process.env.ARAMEX_ACCOUNT_PIN || '',
      accountEntity: process.env.ARAMEX_ACCOUNT_ENTITY || '', countryCode: process.env.ARAMEX_ACCOUNT_COUNTRY_CODE || 'EG',
      // بيانات حساب Aramex التجريبي (Sandbox) - لو عندك حساب اختباري منفصل حطه هنا،
      // لو سبتها فاضية هيستخدم بيانات حساب الإنتاج نفسها (Aramex بتسمح بده غالبًا).
      sandboxUsername: process.env.ARAMEX_SANDBOX_USERNAME || '', sandboxPassword: process.env.ARAMEX_SANDBOX_PASSWORD || '',
      sandboxAccountNumber: process.env.ARAMEX_SANDBOX_ACCOUNT_NUMBER || '', sandboxAccountPin: process.env.ARAMEX_SANDBOX_ACCOUNT_PIN || '',
      sandboxAccountEntity: process.env.ARAMEX_SANDBOX_ACCOUNT_ENTITY || '',
      baseUrl: process.env.ARAMEX_BASE_URL || '',
      pickupAddress: process.env.ARAMEX_PICKUP_ADDRESS || '', pickupCity: process.env.ARAMEX_PICKUP_CITY || 'Cairo',
      pickupPostCode: process.env.ARAMEX_PICKUP_POST_CODE || '', pickupPhone: process.env.ARAMEX_PICKUP_PHONE || '',
      pickupName: process.env.ARAMEX_PICKUP_NAME || '',
      // Contact.EmailAddress حقل إجباري (Mandatory) في هيكل الـParty الرسمي
      // بتاع أرامكس (شوف تعليق Contact structure في aramexService.js) - لازم
      // نضيفه هنا عشان نقدر نبعته فعليًا مع بيانات المُرسِل (Shipper).
      pickupEmail: process.env.ARAMEX_PICKUP_EMAIL || '',
    },
    dhl: {
      ...providerDefaults.dhl,
      enabled: bool(process.env.DHL_ENABLED, false),
      environment: getEnvironmentDefault(process.env.DHL_ENVIRONMENT),
      username: process.env.DHL_API_USERNAME || '',
      password: process.env.DHL_API_PASSWORD || '', accountNumber: process.env.DHL_ACCOUNT_NUMBER || '',
      // بيانات حساب DHL التجريبي (Sandbox) - DHL بتدي مفتاح Test API لوحده من
      // developer.dhl.com، لازم يتحط هنا لأن مفتاح الإنتاج مش هيشتغل على سيرفر التست.
      sandboxUsername: process.env.DHL_SANDBOX_API_USERNAME || '', sandboxPassword: process.env.DHL_SANDBOX_API_PASSWORD || '',
      sandboxAccountNumber: process.env.DHL_SANDBOX_ACCOUNT_NUMBER || '',
      countryCode: process.env.DHL_ORIGIN_COUNTRY_CODE || 'EG', city: process.env.DHL_ORIGIN_CITY || 'Cairo',
      address: process.env.DHL_ORIGIN_ADDRESS || '', postalCode: process.env.DHL_ORIGIN_POSTAL_CODE || '',
      // Contact.fullName/phone حقول إجبارية في customerDetails.shipperDetails.contactInformation
      // الرسمية بتاعة MyDHL API (شوف تعليق createShipment في dhlService.js) -
      // كانت ناقصة قبل كده.
      contactName: process.env.DHL_ORIGIN_CONTACT_NAME || 'LAVA Store',
      phone: process.env.DHL_ORIGIN_PHONE || '',
      baseUrl: process.env.DHL_BASE_URL || '',
    },
    shipblu: {
      ...providerDefaults.shipblu,
      enabled: bool(process.env.SHIPBLU_ENABLED, false),
      environment: getEnvironmentDefault(process.env.SHIPBLU_ENVIRONMENT),
      apiKey: process.env.SHIPBLU_API_KEY || '',
      // مفتاح API منفصل لحساب Sandbox لو موجود (زي بوسطة) - لو مش موجود
      // هيفضل يستخدم apiKey العادي.
      sandboxApiKey: process.env.SHIPBLU_SANDBOX_API_KEY || '',
      baseUrl: process.env.SHIPBLU_BASE_URL || '',
      // 1: Small, 2: Medium, 3: Large, 4: Extra Large (موثق في docs.shipblu.com/js-client)
      packageSize: process.env.SHIPBLU_DEFAULT_PACKAGE_SIZE || '1',
      // زي بوسطة بالظبط: ShipBlu بتسعّر حسب عرض سعر موقّع مع التاجر مش عن طريق
      // API (مفيش Rate endpoint موثق رسميًا)، فالسعر بيتحط يدويًا من لوحة التحكم.
      defaultRate: Number(process.env.SHIPBLU_DEFAULT_RATE || 0),
      governorateRates: {},
      // ShipBlu بتوفر Webhook رسمي (بتتفعّل من لوحة تحكم ShipBlu نفسها -
      // Integrations - مش من عندنا، وبتختار هناك أي حالات عايز تستقبلها).
      // الـsecret ده بتحطه إنت في رابط الـWebhook اللي هتدّيه لـShipBlu.
      webhookSecret: process.env.SHIPBLU_WEBHOOK_SECRET || '',
    },
  };
}

function publicConfig() {
  const c = getEnvConfig();
  return Object.fromEntries(Object.entries(c).map(([key, p]) => [key, {
    key: p.key, name: p.name, mode: p.mode, enabled: p.enabled, countries: p.countries,
    environment: p.environment,
    configured: key === 'bosta' ? !!p.apiKey : key === 'aramex' ? !!(p.username && p.password && p.accountNumber && p.accountPin && p.accountEntity) : key === 'shipblu' ? !!p.apiKey : !!(p.username && p.password && p.accountNumber),
    defaultRate: key === 'bosta' || key === 'shipblu' ? p.defaultRate : undefined,
  }]));
}

module.exports = { providerDefaults, getEnvConfig, publicConfig, resolveBaseUrl, EGYPT_GOVERNORATES, PROVIDER_COVERAGE, lookupGovernorateRate, getCoverageWithRates };