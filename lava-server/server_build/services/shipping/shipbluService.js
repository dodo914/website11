const { requestJson } = require('./http');
const { getEnvConfig, resolveBaseUrl, lookupGovernorateRate } = require('./config');
const { resolveOrderAddress, buildSecondLine, validateRequiredFields, structuredError } = require('./orderAddress');
const { classifyProviderApiError } = require('./providerErrors');

// ShipBlu محتاج فعليًا: اسم + هاتف + محافظة (للبحث عن zoneID) + عنوان
// تفصيلي (line1). زي بوسطة، district هنا مهم جدًا لأنه أساس مطابقة الـzone
// (شوف resolveZoneId تحت) - قبل الإصلاح كان بيتحقق من zoneID بس داخل
// resolveZoneId (يرمي Error عادي مش structured)، من غير أي تحقق مبكر على
// باقي الحقول (اسم/هاتف) قبل ما نستهلك نداءات جغرافية.
const REQUIRED_FIELDS = [
  { key: 'fullName', label: 'اسم العميل' },
  { key: 'phone', label: 'رقم الهاتف' },
  { key: 'governorate', label: 'المحافظة' },
  { key: 'detailedAddress', label: 'العنوان التفصيلي' },
];

function validateOrder(order) {
  const addr = resolveOrderAddress(order);
  const check = validateRequiredFields(addr, REQUIRED_FIELDS);
  if (!check.ok) {
    throw structuredError(
      `بيانات عنوان الشحن غير مكتملة لـShipBlu: ${check.missingLabels.join('، ')}`,
      'PROVIDER_ADDRESS_INCOMPLETE',
      { status: 422, fields: check.missingKeys },
    );
  }
  return addr;
}

// ========================================================================
// ShipBlu Adapter
// ------------------------------------------------------------------------
// المصدر الرسمي المعتمد لكل تفاصيل الـAPI هنا: https://docs.shipblu.com
// (Quick Start / Tutorial / JS Client / API Reference) + المقالات الرسمية
// على support.shipblu.com. أي endpoint أو حقل مش موثّق في المصادر دي معمولوش
// implementation هنا، وبيترجع Error واضح بدل ما نخترع سلوك.
//
// Auth: Header ثابت "Authorization: Api-Key <API-KEY>" (موثق في docs.shipblu.com/quick-start
// وفي كل أمثلة الـcurl بالـTutorial). القيم دايمًا Server-side من الـ.env.
//
// Base URLs (موثقة في docs.shipblu.com):
//   Production: https://api.shipblu.com/api/v1
//   Sandbox   : https://api.staging.shipblu.com/api/v1
//   (الـSwagger بتاع بيئة الـSandbox نفسها موجود على api.staging.shipblu.com/docs/)
// ========================================================================

function cfg(custom = {}) {
  const merged = { ...getEnvConfig().shipblu, ...custom };
  merged.baseUrl = resolveBaseUrl('shipblu', merged.environment, process.env.SHIPBLU_BASE_URL);
  // زي باقي الشركات: لو فيه مفتاح Sandbox منفصل مسجل، نستخدمه وإحنا في وضع
  // تجريبي (بعض حسابات ShipBlu التجريبية بتاخد مفتاح مختلف عن الإنتاج).
  if (String(merged.environment).toLowerCase() !== 'production' && merged.sandboxApiKey) {
    merged.apiKey = merged.sandboxApiKey;
  }
  return merged;
}

function authHeaders(c) {
  return { Authorization: `Api-Key ${c.apiKey}`, 'Content-Type': 'application/json' };
}

function requireApiKey(c) {
  if (!c.apiKey) throw new Error('SHIPBLU_API_KEY غير موجود');
}

// ------------------------------------------------------------------------
// Geography (governorates -> cities -> zones)
// موثقة في docs.shipblu.com/tutorial تحت "Geographic Availability":
//   GET /governorates/
//   GET /governorates/<id>/cities/
//   GET /cities/<id>/zones/
// ShipBlu محتاجة zoneID رقمي وقت إنشاء الـCustomer (موثق في docs.shipblu.com/js-client)،
// وده حقل مش موجود عندنا في Order model حاليًا (عندنا governorate كـ نص فقط،
// من غير city/zone). فبنحاول نلاقي التطابق تلقائيًا من اسم المحافظة، ولو
// معرفناش نحدد مدينة/منطقة بدقة (أكتر من نتيجة ممكنة) بنوقف ونطلب تدقيق
// العنوان بدل ما "نخمن" منطقة غلط ممكن توصل الشحنة غلط.
// ------------------------------------------------------------------------

const geoCache = new Map(); // key: `${baseUrl}` -> { governorates, fetchedAt }
const GEO_CACHE_TTL_MS = 30 * 60 * 1000; // 30 دقيقة كفاية، القائمة نادرًا ما تتغير

async function getGovernorates(c) {
  const cacheKey = c.baseUrl;
  const cached = geoCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < GEO_CACHE_TTL_MS) return cached.governorates;
  const data = await requestJson(`${c.baseUrl}/governorates/`, { headers: authHeaders(c) });
  const governorates = Array.isArray(data) ? data : (data?.results || []);
  geoCache.set(cacheKey, { governorates, fetchedAt: Date.now() });
  return governorates;
}

async function getCities(c, governorateId) {
  const data = await requestJson(`${c.baseUrl}/governorates/${encodeURIComponent(governorateId)}/cities/`, { headers: authHeaders(c) });
  return Array.isArray(data) ? data : (data?.results || []);
}

async function getZones(c, cityId) {
  const data = await requestJson(`${c.baseUrl}/cities/${encodeURIComponent(cityId)}/zones/`, { headers: authHeaders(c) });
  return Array.isArray(data) ? data : (data?.results || []);
}

// اسم ShipBlu بيرجع بصيغة "العربي - English" (مثال: "القاهرة - Cairo"),
// فبنطابق لو أي جزء من الاسم (عربي أو إنجليزي) متطابق مع نص المحافظة عندنا.
function namesMatch(shipbluName, ourName) {
  if (!shipbluName || !ourName) return false;
  const norm = (s) => String(s).trim().toLowerCase();
  const parts = norm(shipbluName).split('-').map((p) => p.trim());
  const target = norm(ourName);
  return parts.some((p) => p && (p === target || p.includes(target) || target.includes(p)));
}

// بيدور على المحافظة والمدينة والمنطقة المناسبين لعنوان أوردر (resolvedAddress
// - ناتج resolveOrderAddress، مش order الخام).
//
// إصلاح مهم (كان باج فعلي قبل كده): كان بيطابق المدينة والمنطقة (city/zone)
// باستخدام order.address - وده نص العنوان التفصيلي الحر (الشارع/رقم
// العمارة...) نفسه يتقارن مرتين، مرة كـ"مدينة" ومرة كـ"منطقة" لنفس النص!
// ده كان عمليًا بيفشل في المطابقة دايمًا تقريبًا (النص التفصيلي مش هيتطابق
// مع اسم مدينة أو منطقة رسمية)، ويقع على fallback "مدينة/منطقة واحدة بس
// متاحة" أو يرمي Error يطلب توضيح. الصح: نستخدم resolvedAddress.district
// (المنطقة/الحي اللي العميل اختاره فعليًا في Checkout - shippingAddress.district
// من Phase 2) للمطابقة مع المدينة والمنطقة، مش تفاصيل الشارع.
async function resolveZoneId(c, resolvedAddress) {
  const governorates = await getGovernorates(c);
  const govMatches = governorates.filter((g) => namesMatch(g.name, resolvedAddress.governorate));
  if (govMatches.length === 0) {
    throw structuredError(`لا يمكن مطابقة المحافظة "${resolvedAddress.governorate || ''}" مع محافظات ShipBlu المدعومة. راجع GET /governorates/ لتأكيد الاسم الصحيح.`, 'PROVIDER_ADDRESS_INCOMPLETE', { status: 422, fields: ['governorate'] });
  }
  if (govMatches.length > 1) {
    throw structuredError(`اسم المحافظة "${resolvedAddress.governorate}" غير محدد بدقة (تطابق أكثر من محافظة في ShipBlu). يرجى توضيح المحافظة في الطلب.`, 'PROVIDER_ADDRESS_INCOMPLETE', { status: 422, fields: ['governorate'] });
  }
  const governorate = govMatches[0];

  const cities = await getCities(c, governorate.id);
  if (!cities.length) {
    throw structuredError(`لا توجد مدن مغطاة من ShipBlu ضمن محافظة "${resolvedAddress.governorate}".`, 'PROVIDER_ADDRESS_INCOMPLETE', { status: 422, fields: ['governorate'] });
  }
  // نطابق اسم المدينة من district (المنطقة/الحي اللي دخلها العميل فعليًا)،
  // مش من تفاصيل الشارع الحرة. لو المحافظة عندها مدينة واحدة بس بتغطيها
  // ShipBlu، نستخدمها مباشرة من غير الحاجة لمطابقة.
  let city = null;
  if (resolvedAddress.district) {
    const cityMatches = cities.filter((ct) => namesMatch(ct.name, resolvedAddress.district));
    if (cityMatches.length === 1) city = cityMatches[0];
  }
  if (!city) {
    if (cities.length === 1) city = cities[0];
    else {
      const options = cities.map((ct) => ct.name).join('، ');
      throw structuredError(`تعذّر تحديد المدينة (City) داخل "${resolvedAddress.governorate}" لإنشاء شحنة ShipBlu - المنطقة/الحي المدخل لا يحدد ذلك بدقة. المدن المتاحة: ${options}`, 'PROVIDER_ADDRESS_INCOMPLETE', { status: 422, fields: ['district'] });
    }
  }

  const zones = await getZones(c, city.id);
  if (!zones.length) {
    throw structuredError(`لا توجد مناطق (Zones) مغطاة من ShipBlu ضمن مدينة "${city.name}".`, 'PROVIDER_ADDRESS_INCOMPLETE', { status: 422, fields: ['district'] });
  }
  let zone = null;
  if (resolvedAddress.district) {
    const zoneMatches = zones.filter((z) => namesMatch(z.name, resolvedAddress.district));
    if (zoneMatches.length === 1) zone = zoneMatches[0];
  }
  if (!zone) {
    if (zones.length === 1) zone = zones[0];
    else {
      const options = zones.map((z) => z.name).join('، ');
      throw structuredError(`تعذّر تحديد المنطقة (Zone) داخل "${city.name}" لإنشاء شحنة ShipBlu - المنطقة/الحي المدخل لا يحدد ذلك بدقة. المناطق المتاحة: ${options}`, 'PROVIDER_ADDRESS_INCOMPLETE', { status: 422, fields: ['district'] });
    }
  }
  return zone.id;
}

// ------------------------------------------------------------------------
// Test Connection
// موثق في docs.shipblu.com/quick-start: GET /merchants/ بيرجع بيانات الحساب
// التاجر ويتأكد إن المفتاح شغال فعليًا (مش مجرد فحص إن الـenv مش فاضي).
// ------------------------------------------------------------------------
async function test(custom = {}) {
  const c = cfg(custom);
  requireApiKey(c);
  // نفس ملحوظة Bosta: اختبار الاتصال محتاج رد سريع وصادق - من غير retry
  // تلقائي طويل بيأخر ظهور النتيجة الحقيقية للمستخدم.
  return requestJson(`${c.baseUrl}/merchants/`, { headers: authHeaders(c), retry: false, timeout: 8000 });
}

// ------------------------------------------------------------------------
// Rates
// مفيش endpoint رسمي موثق لحساب سعر الشحن مقدمًا (Rate Calculator) في توثيق
// ShipBlu المتاح، وده متوقع فعليًا: ShipBlu نفسها بتوضح إن أسعار الشحن بتتحدد
// حسب "the signed pricing offer" الموقّع مع التاجر (مصدر: صفحة تطبيق ShipBlu
// الرسمي)، مش عن طريق API لايف. فبنعاملها زي بوسطة بالظبط: سعر يدوي من لوحة
// التحكم (defaultRate موحّد لكل مصر، أو سعر مخصوص لكل محافظة governorateRates).
// ------------------------------------------------------------------------
function rate({ subtotal = 0, countryCode = 'EG', governorate = '' } = {}, custom = {}) {
  const c = cfg(custom);
  if (countryCode !== 'EG') return null;
  const govRate = lookupGovernorateRate(c.governorateRates, governorate);
  const amount = govRate != null ? govRate : (Number(c.defaultRate) > 0 ? Number(c.defaultRate) : null);
  if (amount == null) return null;
  return { amount, currency: 'EGP', provider: 'shipblu', source: govRate != null ? 'governorate' : 'default' };
}

// ------------------------------------------------------------------------
// Create Delivery Order
// موثق في docs.shipblu.com/tutorial (POST /delivery-orders/) وفي
// docs.shipblu.com/js-client (شكل customer/packages/cashAmount/orderReference/notes).
// ------------------------------------------------------------------------
async function createShipment(order, custom = {}) {
  const c = cfg(custom);
  requireApiKey(c);

  // بند 7: نتحقق من الحقول الأساسية (اسم/هاتف/محافظة/عنوان تفصيلي) قبل أي
  // نداء جغرافي - PROVIDER_ADDRESS_INCOMPLETE structured error بدل انتظار
  // ShipBlu أو resolveZoneId يكتشفوا النقص.
  const resolved = validateOrder(order);
  const zoneID = await resolveZoneId(c, resolved);

  const secondLine = buildSecondLine(resolved);
  const packageSize = Number(c.packageSize) || 1; // 1: Small, 2: Medium, 3: Large, 4: Extra Large (موثق في JS Client)
  const orderRef = String(order.orderNumber || order._id);
  const payload = {
    customer: {
      fullName: resolved.fullName || '',
      phone: resolved.phone || '',
      line1: resolved.detailedAddress || '',
      line2: secondLine || '',
      zoneID,
      email: resolved.email || undefined,
      secondaryPhone: resolved.phone2 || undefined,
    },
    packages: [
      { package_size: packageSize, description: `LAVA Order ${orderRef}`, fragile: false },
    ],
    cashAmount: order.paymentMethod === 'cod' ? Number(order.totalAmount || 0) : 0,
    orderReference: orderRef,
    notes: order.notes || '',
  };

  let data;
  try {
    data = await requestJson(`${c.baseUrl}/delivery-orders/`, {
      method: 'POST',
      headers: authHeaders(c),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // بند 10: auth/timeout -> structured error بدل رسالة ShipBlu الخام.
    const classified = classifyProviderApiError(err);
    if (classified) throw classified;
    throw err;
  }

  const trackingNumber = data?.tracking_number || data?.trackingNumber || data?.id;
  return { raw: data, shipmentId: data?.id, trackingNumber };
}

// ------------------------------------------------------------------------
// Update Delivery Order
// موثق في docs.shipblu.com/tutorial: PATCH لنفس شكل الـbody المستخدم في الإنشاء.
// (التوثيق بيوضح إن الـbody زي POST، والتحديث بيتم على الـorder المحدد بالـID،
// نفس نمط order.update(orderID, body) في JS Client).
// ------------------------------------------------------------------------
async function updateShipment(shipmentId, patch = {}, custom = {}) {
  const c = cfg(custom);
  requireApiKey(c);
  if (!shipmentId) throw new Error('shipmentId مطلوب لتحديث شحنة ShipBlu');
  const data = await requestJson(`${c.baseUrl}/delivery-orders/${encodeURIComponent(shipmentId)}/`, {
    method: 'PATCH',
    headers: authHeaders(c),
    body: JSON.stringify(patch),
  });
  return { raw: data };
}

// ------------------------------------------------------------------------
// Tracking
// موثق ضمنيًا في docs.shipblu.com/js-client (order.retrieve(orderID)) وفي
// Tutorial (GET /delivery-orders/). بنجيب الطلب بالـID ونرجّع حالته الحالية.
// ------------------------------------------------------------------------
async function track(trackingNumber, custom = {}) {
  const c = cfg(custom);
  requireApiKey(c);
  const data = await requestJson(`${c.baseUrl}/delivery-orders/${encodeURIComponent(trackingNumber)}/`, { headers: authHeaders(c) });
  const status = data?.status || data?.state || data?.current_status;
  return { raw: data, status };
}

// ------------------------------------------------------------------------
// Cancellation
// مفيش endpoint API رسمي موثق للإلغاء المباشر في docs.shipblu.com. المقالات
// الرسمية على support.shipblu.com بتوضح إن الإلغاء بعد الاستلام بيتم من
// لوحة تحكم ShipBlu نفسها (زرار "Return to Origin")، مش عبر الـAPI العام.
// عشان كده الـcapability دي false مع رسالة واضحة بدل تنفيذ وهمي.
// ------------------------------------------------------------------------
async function cancelShipment() {
  throw new Error('إلغاء الشحنة عبر ShipBlu API غير موثّق رسميًا حاليًا. يجب إلغاء/إرجاع الشحنة من لوحة تحكم ShipBlu مباشرة (Return to Origin).');
}
cancelShipment.supported = false;

// ------------------------------------------------------------------------
// Returns / Exchanges
// موجودة مفاهيميًا في JS Client (ShipBlu.ReturnOrder) لكن من غير توثيق كافٍ
// لشكل الـrequest/response أو الـendpoint الدقيق لطلبات الإرجاع/الاستبدال في
// المصادر المتاحة لي، فمش هنخترعها. لو احتجتوها لازم تأكيد من فريق ShipBlu
// (tech@shipblu.com) أو من الـSwagger على api.staging.shipblu.com/docs/.
// ------------------------------------------------------------------------
async function createReturn() {
  throw new Error('عملية الإرجاع (Return Order) عبر ShipBlu API غير موثّقة بتفاصيل كافية حاليًا - تحتاج تأكيد رسمي من ShipBlu قبل التنفيذ.');
}
createReturn.supported = false;

async function createExchange() {
  throw new Error('عملية الاستبدال (Exchange) عبر ShipBlu API غير موثّقة بتفاصيل كافية حاليًا - تحتاج تأكيد رسمي من ShipBlu قبل التنفيذ.');
}
createExchange.supported = false;

// ------------------------------------------------------------------------
// Shipping Label / AWB
// موثق صراحة في docs.shipblu.com/tutorial:
//   GET /orders/shipping-label/?tracking_numbers=<n1,n2,...>&type=pdf|html
// ------------------------------------------------------------------------
async function getLabel(trackingNumber, custom = {}) {
  const c = cfg(custom);
  requireApiKey(c);
  const url = `${c.baseUrl}/orders/shipping-label/?tracking_numbers=${encodeURIComponent(trackingNumber)}&type=pdf`;
  // الرد هنا ملف (PDF) مباشرة حسب التوثيق، مش JSON. requestJson بترجع
  // {raw: text} تلقائيًا لو الرد مش JSON صالح (من غير ما تعتبره خطأ)، وترمي
  // Error فقط لو HTTP status نفسه فشل - فبنسيبها تتأكد من نجاح الطلب فعليًا
  // قبل ما نرجّع الرابط كـlabelUrl (الـController بيحفظه في order.shippingLabelUrl).
  //
  // ملحوظة مهمة جدًا: على عكس Aramex/DHL، ده مش رابط عام (public URL) -
  // ShipBlu بتطلب Header اسمه "Authorization: Api-Key <...>" على كل request
  // بما فيه الـendpoint ده نفسه. يعني لو المتصفح فتح الرابط ده مباشرة
  // (window.open) من غير الـHeader ده، هيرجع 401/403 لأن مفتاح الـAPI مش
  // موجود، والمفتاح ده سري ومينفعش نبعته للفرونت أصلاً (قاعدة الأمان رقم 11).
  // عشان كده لازم الطباعة تتم عن طريق getLabelBytes تحت (بروكسي من الباك اند)
  // مش برجوع الرابط ده مباشرة للفرونت.
  await requestJson(url, { headers: authHeaders(c) });
  return { labelUrl: url, raw: null };
}

// ------------------------------------------------------------------------
// Shipping Label - تحميل فعلي للبايتات (Binary) عبر الباك اند (Proxy)
// ------------------------------------------------------------------------
// نفس الـendpoint الموثق فوق بالظبط، لكن هنا بنجيب محتوى الملف نفسه (PDF
// بايتات) بدل ما نرجّع رابط. ده ضروري لأن الرابط الأصلي محتاج API Key سري
// في الـHeader (شوف الملحوظة في getLabel فوق) - فالباك اند هو اللي بيتصل
// بـShipBlu بالمفتاح السري، وبيبعت البايتات جاهزة للمتصفح من غير ما
// المتصفح يحتاج يعرف المفتاح خالص. requestJson مش مناسبة هنا لأنها بتحاول
// تقرأ الرد كـtext/JSON دايمًا، وده هيكسر بيانات الـPDF الثنائية.
async function getLabelBytes(trackingNumber, custom = {}) {
  const c = cfg(custom);
  requireApiKey(c);
  const url = `${c.baseUrl}/orders/shipping-label/?tracking_numbers=${encodeURIComponent(trackingNumber)}&type=pdf`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { headers: authHeaders(c), signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new Error(text || `فشل تحميل بوليصة ShipBlu (HTTP ${response.status})`);
      err.status = response.status;
      throw err;
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') || 'application/pdf',
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  test,
  rate,
  createShipment,
  updateShipment,
  track,
  cancelShipment,
  createReturn,
  createExchange,
  getLabel,
  getLabelBytes,
  resolveZoneId,
  validateOrder,
};