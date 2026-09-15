const { requestJson } = require('./http');
const { getEnvConfig, resolveBaseUrl, lookupGovernorateRate } = require('./config');
const { validateEgyptianPhone, normalizePhone } = require('../../utils/addressValidation');
const { resolveOrderAddress, validateRequiredFields, buildDropOffAddress } = require('./bostaAddressMapper');

// بعد الدمج مع إعدادات الأدمن (تجريبي/حقيقي)، لازم نعيد حساب baseUrl بناءً
// على البيئة النهائية المختارة، مش اللي كانت متحسوبة وقت قراءة الـ.env بس.
function cfg(custom = {}) {
  const merged = { ...getEnvConfig().bosta, ...custom };
  merged.baseUrl = resolveBaseUrl('bosta', merged.environment, process.env.BOSTA_BASE_URL);
  // في وضع التجريبي (Sandbox) بنستخدم مفتاح الحساب التجريبي لو متسجل، لأن
  // مفتاح الإنتاج الحقيقي مش هيتعرف عليه سيرفر الـ Staging بتاع بوسطة.
  if (String(merged.environment).toLowerCase() !== 'production' && merged.sandboxApiKey) {
    merged.apiKey = merged.sandboxApiKey;
  }
  return merged;
}
// ============================================================================
// Locations (Cities / Zones) - موثّقة رسميًا في SDKs بوسطة (bostaapp/bosta-nodejs
// README: bosta.city.getAllCities() و bosta.zone.getCityZones(cityId)) واللي
// بتستخدم داخليًا endpoints بنفس النمط REST المستخدم في باقي الملف ده
// (/pickup-locations, /deliveries) وهو GET /cities و GET /cities/:cityId/zones.
// لو الـendpoint ده اختلف فعليًا في نسخة API عندك، غيّره هنا بس (منطقة واحدة).
//
// بنعمل cache للنتيجة (زي ShipBlu بالظبط في shipbluService.js) عشان منناديش
// الـAPI مع كل عملية إنشاء شحنة أو كل render في الفرونت - المدن/المناطق
// نادرًا ما تتغير.
// ============================================================================
const citiesCache = new Map(); // key: baseUrl -> { cities, fetchedAt }
const zonesCache = new Map();  // key: `${baseUrl}:${cityId}` -> { zones, fetchedAt }
const GEO_CACHE_TTL_MS = 30 * 60 * 1000; // 30 دقيقة

async function getCities(c) {
  const cacheKey = c.baseUrl;
  const cached = citiesCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < GEO_CACHE_TTL_MS) return cached.cities;
  const data = await requestJson(`${c.baseUrl}/cities`, { headers: { Authorization: c.apiKey }, retry: false, timeout: 10000 });
  const cities = Array.isArray(data) ? data : (data?.data || data?.cities || []);
  citiesCache.set(cacheKey, { cities, fetchedAt: Date.now() });
  return cities;
}

async function getZones(c, cityId) {
  const cacheKey = `${c.baseUrl}:${cityId}`;
  const cached = zonesCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < GEO_CACHE_TTL_MS) return cached.zones;
  const data = await requestJson(`${c.baseUrl}/cities/${encodeURIComponent(cityId)}/zones`, { headers: { Authorization: c.apiKey }, retry: false, timeout: 10000 });
  const zones = Array.isArray(data) ? data : (data?.data || data?.zones || []);
  zonesCache.set(cacheKey, { zones, fetchedAt: Date.now() });
  return zones;
}

// مطابقة بسيطة بالاسم (عربي/إنجليزي) - نفس فكرة namesMatch في shipbluService.js.
function namesMatch(a, b) {
  if (!a || !b) return false;
  const norm = (s) => String(s).trim().toLowerCase();
  const x = norm(a); const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}

// بيحاول يطابق محافظة/منطقة الأوردر مع القائمة الرسمية من بوسطة عشان
// نبعت الاسم الرسمي المتطابق بدل نص العميل الحر. لو الـlookup فشل (شبكة/
// إعدادات) أو مفيش تطابق واضح، بيرجع null بهدوء (مش بيوقف إنشاء الشحنة) -
// الـmapper (bostaAddressMapper.js) بيعمل fallback لنص العميل نفسه في الحالة دي.
async function resolveBostaGeo(c, resolvedAddress) {
  try {
    const cities = await getCities(c);
    const cityMatches = cities.filter((city) => namesMatch(city.name, resolvedAddress.governorate));
    if (cityMatches.length !== 1) return null;
    const city = cityMatches[0];

    let zoneName = null;
    if (resolvedAddress.district) {
      const zones = await getZones(c, city._id || city.id);
      const zoneMatches = zones.filter((z) => namesMatch(z.name, resolvedAddress.district));
      if (zoneMatches.length === 1) zoneName = zoneMatches[0].name;
    }
    return { cityName: city.name, zoneName };
  } catch {
    // فشل جلب المدن/المناطق (شبكة/مفتاح غلط) - منوقفش إنشاء الشحنة عشان
    // كده بس، نسيب الـmapper يستخدم النص اللي كتبه العميل.
    return null;
  }
}

// ------------------------------------------------------------------------
// Structured Errors (بند 13 في طلب Phase 3) - err.code/err.fields واضحين
// بدل الاعتماد على err.message بس. الـController بيقرأهم ويرجعهم للأدمن.
// ------------------------------------------------------------------------
function structuredError(message, code, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

// بيتعرف على أخطاء بوسطة المعروفة (subscription / Error 3000) من رسالة أو
// data الرد الراجع من requestJson (شوف http.js - err.message/err.data) ويحوّلها
// لـstructured error بدل ما يسيب رسالة بوسطة الخام تتسرب زي ما هي.
function classifyBostaApiError(err) {
  const raw = `${err?.message || ''} ${JSON.stringify(err?.data || {})}`.toLowerCase();

  if (raw.includes('active bundle subscription') || raw.includes('subscription required')) {
    // بند 7: لا نحاول تجاوزها ولا نعمل retry (400/402/403 مش قابلة لإعادة
    // المحاولة أصلاً حسب http.js - RETRYABLE_STATUS_CODES بتاعته).
    return structuredError(
      'حساب Bosta يحتاج إلى تفعيل Active Bundle Subscription لإنشاء الشحنات.',
      'BOSTA_SUBSCRIPTION_REQUIRED',
      { status: err?.status || 400 },
    );
  }

  if (raw.includes('3000') || raw.includes('insufficient parameters')) {
    // بند 8: نفس الحالة اللي كانت بتحصل قبل كده (dropOffAddress ناقص).
    // الـvalidation قبل الإرسال (validateRequiredFields) المفروض تمنع دي
    // في الحالة العادية، فلو وصلنا هنا يبقى على الأغلب حقل اشترطته بوسطة
    // ومكناش عارفينه (زي city/zone مش من ضمن القائمة المعروفة عندها).
    return structuredError(
      'بيانات عنوان الشحن غير مكتملة أو غير مقبولة من بوسطة.',
      'BOSTA_ADDRESS_INCOMPLETE',
      { status: 422 },
    );
  }

  return null;
}

async function test(custom = {}) {
  const c = cfg(custom); if (!c.apiKey) throw new Error('BOSTA_API_KEY غير موجود');
  // baseUrl بقى شامل نسخة الـ API (/api/v2) فمفيش داعي نضيف مسار نسخة تاني هنا.
  // ملحوظة: "اختبار الاتصال" فعل تفاعلي بيستنى المستخدم رده فورًا - عشان
  // كده بيتعمل بـretry:false ومهلة قصيرة (8 ثواني) بدل الإعدادات الافتراضية
  // (3 محاولات إضافية × حتى 15 ثانية لكل واحدة = ممكن توصل لدقيقة كاملة).
  // النتيجة الحقيقية (بيانات غلط / API فشل / Timeout فعلي) بترجع بسرعة
  // ومن غير ما "تتقنّع" كـTimeout بسبب retries طويلة مخفية عن المستخدم.
  return requestJson(`${c.baseUrl}/pickup-locations`, { headers: { Authorization: c.apiKey, 'Content-Type':'application/json' }, retry: false, timeout: 8000 });
}
function rate({ subtotal = 0, countryCode = 'EG', governorate = '' } = {}, custom = {}) {
  const c = cfg(custom);
  if (countryCode !== 'EG') return null;
  // أولوية سعر المحافظة المحدد (governorateRates)، ولو مفيش نرجع لسعر
  // موحّد لكل البلد (defaultRate). لو مفيش أي منهم، معنى كده لسه محددش
  // سعر أصلاً، فبنرجع null (مش صفر) عشان الواجهة تعرف إن السعر لسه مش متاح.
  const govRate = lookupGovernorateRate(c.governorateRates, governorate);
  const amount = govRate != null ? govRate : (Number(c.defaultRate) > 0 ? Number(c.defaultRate) : null);
  if (amount == null) return null;
  return { amount, currency: 'EGP', provider: 'bosta', source: govRate != null ? 'governorate' : 'default' };
}
// بيتحقق من بيانات العنوان + الهاتف المطلوبة فعليًا لبوسطة قبل ما نبعت أي
// request لها (بند 6 و9) - بيرمي structured error (BOSTA_ADDRESS_INCOMPLETE /
// INVALID_PHONE) بدل ما ننتظر بوسطة تكتشف النقص (بند 8).
function validateOrder(order) {
  const addr = resolveOrderAddress(order);

  const fieldsCheck = validateRequiredFields(addr);
  if (!fieldsCheck.ok) {
    throw structuredError(
      `بيانات عنوان الشحن غير مكتملة: ${fieldsCheck.missingLabels.join('، ')}`,
      'BOSTA_ADDRESS_INCOMPLETE',
      { status: 422, fields: fieldsCheck.missingKeys },
    );
  }

  // رقم مثل "11" لازم يترفض هنا - نستخدم نفس تحقق الهاتف المصري المستخدم
  // في Phase 2 (utils/addressValidation.js)، من غير ما نكرر regex جديد.
  const phoneCheck = validateEgyptianPhone(addr.phone, { label: 'رقم الهاتف' });
  if (!phoneCheck.ok) {
    throw structuredError(phoneCheck.message, 'INVALID_PHONE', { status: 422, fields: ['phone'] });
  }
  if (addr.phone2) {
    const phone2Check = validateEgyptianPhone(addr.phone2, { required: false, label: 'رقم الهاتف الإضافي' });
    if (!phone2Check.ok) {
      throw structuredError(phone2Check.message, 'INVALID_PHONE', { status: 422, fields: ['phone2'] });
    }
  }

  return addr;
}

async function createShipment(order, custom = {}) {
  const c = cfg(custom); if (!c.apiKey) throw new Error('BOSTA_API_KEY غير موجود');

  const addr = validateOrder(order);
  // مطابقة اختيارية مع مدن/مناطق بوسطة الرسمية (بند 4) - بتفشل بهدوء
  // (null) لو مفيش تطابق أو الـlookup مش متاح، والـmapper وقتها بيستخدم
  // النص اللي دخله العميل زي ما هو بدل ما يبعت حاجة فاضية.
  const geo = await resolveBostaGeo(c, addr);
  const dropOffAddress = buildDropOffAddress(order, geo);
  const orderRef = String(order.orderNumber || order._id);

  const payload = {
    type: 10,
    specs: { packageType: 'Small', packageDetails: { description: `LAVA Order ${orderRef}`, itemsCount: order.items?.length || 1 } },
    receiver: {
      firstName: addr.fullName || 'Customer',
      lastName: '',
      phone: normalizePhone(addr.phone),
      secondPhone: addr.phone2 ? normalizePhone(addr.phone2) : '',
      email: addr.email || '',
    },
    dropOffAddress,
    cod: order.paymentMethod === 'cod' ? Number(order.totalAmount || 0) : 0,
    businessReference: orderRef,
  };
  if (c.pickupId) payload.pickupAddress = { pickupId: c.pickupId };

  let data;
  try {
    data = await requestJson(`${c.baseUrl}/deliveries`, { method: 'POST', headers: { Authorization: c.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (err) {
    // بند 7 و8: نترجم أخطاء بوسطة المعروفة (subscription / Error 3000)
    // لـstructured errors واضحة قبل ما نرميها. أي خطأ تاني (شبكة/5xx/auth)
    // بيفضل زي ما هو من http.js عشان الـretry/idempotency layers تتعامل معاه عادي.
    const classified = classifyBostaApiError(err);
    if (classified) throw classified;
    throw err;
  }

  return { raw: data, shipmentId: data?._id || data?.data?._id || data?.trackingNumber || data?.data?.trackingNumber, trackingNumber: data?.trackingNumber || data?.data?.trackingNumber || data?._id || data?.data?._id };
}
async function track(trackingNumber, custom = {}) {
  const c = cfg(custom); if (!c.apiKey) throw new Error('BOSTA_API_KEY غير موجود');
  // لازم "/tracking" في الآخر عشان يرجع حالة الشحنة - من غيرها بترجع بيانات
  // الشحنة العادية بس من غير حالة تتبع حقيقية.
  const data = await requestJson(`${c.baseUrl}/deliveries/${encodeURIComponent(trackingNumber)}/tracking`, { headers:{Authorization:c.apiKey} });
  return { raw:data, status:data?.state || data?.status || data?.data?.state || data?.data?.status };
}
// ملحوظة مهمة: بوسطة (على عكس أرامكس/DHL) مش بترجع رابط بوليصة الشحن (AWB)
// مباشرة وقت إنشاء الشحنة، فلازم طلب منفصل بعد كده. مستندات بوسطة الرسمية
// لتوليد رابط AWB مش موثّقة عندي بشكل مؤكد 100%، فده أفضل تخمين مبني على
// الـ SDKs الرسمية بتاعتهم (printDeliveryAWB) - لو رجع خطأ أو رابط غلط،
// لازم تتأكد من الـ endpoint الصحيح مع Bosta Support أو من API docs بتاعتهم
// (business.bosta.co) وتظبطه هنا.
async function getLabel(trackingNumber, custom = {}) {
  const c = cfg(custom); if (!c.apiKey) throw new Error('BOSTA_API_KEY غير موجود');
  const data = await requestJson(`${c.baseUrl}/deliveries/${encodeURIComponent(trackingNumber)}/awb`, { headers:{Authorization:c.apiKey} });
  const url = data?.deliveryAwb || data?.awb || data?.data?.deliveryAwb || data?.data?.awb || data?.url || null;
  if (!url) throw new Error('لم يتم استلام رابط بوليصة الشحن من بوسطة');
  return { labelUrl: url, raw: data };
}
// ------------------------------------------------------------------------
// Cancel / Terminate Delivery
// موثقة كعملية رسمية باسم "terminateDelivery" / "Delete Delivery" في أربع
// SDKs رسمية بتاعة بوسطة (bostaapp/bosta-nodejs, bostaapp/bosta-ruby,
// bostaapp/bosta-python, bosta/bosta-sdk PHP) - يعني العملية نفسها موجودة
// ومتاحة رسميًا. الـREST path الدقيق مش موثّق حرفيًا في المصادر المتاحة لي
// (زي حالة getLabel/AWB فوق بالظبط)، فبنستخدم نفس نمط الـendpoints التانية
// المؤكدة عندنا (`/deliveries/:id/tracking`, `/deliveries/:id/awb`) كأقرب
// تخمين مبني على الـSDKs الرسمية. لازم تتأكد من الـpath الدقيق مع Bosta
// Support أو الـSwagger الرسمي (business.bosta.co) قبل الاعتماد عليه في
// الإنتاج - لو رجع 404 غيّر المسار هنا فقط (منطقة واحدة، الكود التاني
// مش هيتأثر).
// ------------------------------------------------------------------------
async function cancelShipment(shipmentId, custom = {}) {
  const c = cfg(custom); if (!c.apiKey) throw new Error('BOSTA_API_KEY غير موجود');
  if (!shipmentId) throw new Error('shipmentId مطلوب لإلغاء شحنة بوسطة');
  const data = await requestJson(`${c.baseUrl}/deliveries/${encodeURIComponent(shipmentId)}/terminate`, {
    method: 'PUT',
    headers: { Authorization: c.apiKey, 'Content-Type': 'application/json' },
  });
  return { raw: data };
}
cancelShipment.supported = true;

module.exports = { test, rate, createShipment, track, getLabel, cancelShipment, validateOrder, getCities, getZones };