// ============================================================================
// Bosta Address Mapper (Phase 3)
// ------------------------------------------------------------------------
// Order Address (شكل عام - shippingAddress subdocument من Phase 2، أو الحقول
// القديمة المسطّحة كـfallback للطلبات القبل Phase 2)
//        ↓
// bostaAddressMapper (الملف ده)
//        ↓
// Bosta dropOffAddress payload (firstLine/secondLine/city/zone/District/
// buildingNumber/floor/apartment - شكل الـAddress object الموثّق في الـSDKs
// الرسمية بتاعة بوسطة، زي bostaapp/bosta-nodejs و dreidev/bosta.co)
//
// قاعدة أساسية (سبب Error 3000 الأصلي): لو حقل مش عندنا قيمة حقيقية ليه،
// منبعتوش خالص (مش نبعت "" فاضية) - عشان بوسطة تعتبره "غير موجود" مش
// "موجود لكن فاضي وغلط".
// ============================================================================

// بيستخدم دلوقتي الـresolver المشترك (orderAddress.js) بدل نسخة محلية - نفس
// السلوك بالظبط (shippingAddress مع fallback للحقول القديمة)، لكن Aramex/
// DHL/ShipBlu بقوا بيستخدموا نفس المصدر ده كمان (كانوا قبل كده بيقروا
// الحقول القديمة المسطّحة بس ومكانوش بيستفيدوا من district/buildingNumber/
// floor/apartment/landmark اللي جواه shippingAddress خالص).
const { resolveOrderAddress: resolveGenericAddress, buildSecondLine, validateRequiredFields: validateFieldsGeneric } = require('./orderAddress');

function resolveOrderAddress(order) {
  return resolveGenericAddress(order);
}

// الحقول اللي لازم تكون موجودة (بقيمة حقيقية) قبل ما نبعت createDelivery
// لبوسطة أصلاً - دي أسباب Error 3000 المعروفة (insufficient parameters).
// buildingNumber/floor/apartment مش لازمين هنا لأن عناوين كتير (فيلات/شوارع
// عادية) أصلاً معندهاش رقم شقة/دور، لكن district (المنطقة/الحي) لازم لأنه
// أهم سبب معروف لـError 3000 لما بيتبعت فاضي.
const REQUIRED_FIELDS = [
  { key: 'fullName', label: 'اسم العميل' },
  { key: 'phone', label: 'رقم الهاتف' },
  { key: 'governorate', label: 'المحافظة' },
  { key: 'district', label: 'المنطقة / الحي' },
  { key: 'detailedAddress', label: 'العنوان التفصيلي' },
];

// بيتحقق من عنوان الأوردر (بعد الـresolve) ويرجع أسماء الحقول الناقصة (لو
// فيه)، مستخدم قبل أي نداء لـcreateDelivery عشان منستناش بوسطة تكتشف
// النقص (بند 8 في طلب Phase 3).
function validateRequiredFields(resolvedAddress) {
  return validateFieldsGeneric(resolvedAddress, REQUIRED_FIELDS);
}

// بيبني dropOffAddress النهائي اللي هيتبعت لبوسطة. geo (اختياري) لو موجود
// (نتيجة مطابقة ناجحة مع GET /cities و GET /cities/:id/zones الرسميين -
// شوف resolveBostaGeo في bostaService.js) بيستخدم الاسم الرسمي المتطابق
// من بوسطة نفسها لـcity/zone؛ لو مفيش (مفيش تطابق واضح أو الـlookup فشل)
// بيرجع لاستخدام النص اللي كتبه العميل زي ما هو (Bosta's Address shape
// بتقبل city/zone كنصوص - موثق في الـSDKs الرسمية)، مش نبعته فاضي أبدًا.
function buildDropOffAddress(order, geo = null) {
  const addr = resolveOrderAddress(order);
  const secondLine = buildSecondLine(addr);

  const dropOffAddress = {
    firstLine: addr.detailedAddress,
    city: (geo && geo.cityName) || addr.governorate,
  };
  if (secondLine) dropOffAddress.secondLine = secondLine;
  // "zone" هو حقل بوسطة الرسمي لاسم المنطقة/الحي (زي ما موثق في Address
  // shape بتاع الـSDKs) - بنبعت النتيجة المتطابقة رسميًا لو لقيناها، وإلا
  // نص المستخدم نفسه (أحسن من مفيش حاجة خالص).
  if ((geo && geo.zoneName) || addr.district) dropOffAddress.zone = (geo && geo.zoneName) || addr.district;
  if (addr.buildingNumber) dropOffAddress.buildingNumber = addr.buildingNumber;
  if (addr.floor) dropOffAddress.floor = addr.floor;
  if (addr.apartment) dropOffAddress.apartment = addr.apartment;

  return dropOffAddress;
}

module.exports = {
  resolveOrderAddress,
  validateRequiredFields,
  buildDropOffAddress,
};