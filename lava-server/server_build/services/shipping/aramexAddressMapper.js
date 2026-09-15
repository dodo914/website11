// ============================================================================
// Aramex Address Mapper (Phase 3)
// ------------------------------------------------------------------------
// Generic Order Address (orderAddress.js)
//        ↓
// aramexAddressMapper (الملف ده)
//        ↓
// Aramex PartyAddress + Contact (Aramex's Guide to Embedding the Shipping
// Services API - جدول 20 Address / جدول 21 Contact)
//
// ملحوظة مهمة (كانت الباج قبل الإصلاح): aramexService.js كان بيبني الـaddress
// من order.address/order.governorate/order.country/order.zipCode (الحقول
// القديمة المسطّحة بس)، من غير ما يقرأ shippingAddress خالص. يعني district
// (المنطقة/الحي) ما كانش بيتبعت لأرامكس أبدًا، وLine2 (تفاصيل المبنى/الدور/
// الشقة) برضه. هنا بقى بيستخدم نفس الـresolver المشترك زي بوسطة، ونفس
// buildSecondLine للتفاصيل.
// ============================================================================

const { resolveOrderAddress, buildSecondLine, validateRequiredFields, structuredError } = require('./orderAddress');

const COUNTRY_CODE_MAP = {
  'مصر': 'EG', Egypt: 'EG',
  'السعودية': 'SA', 'Saudi Arabia': 'SA',
  'الإمارات': 'AE', UAE: 'AE',
  'الكويت': 'KW', Kuwait: 'KW',
};
function countryToCode(name) {
  return COUNTRY_CODE_MAP[name] || (String(name || '').length === 2 ? String(name).toUpperCase() : 'EG');
}

// Aramex محتاج فعليًا: اسم + هاتف + محافظة (كـCity) + عنوان تفصيلي (Line1) -
// نفس الحد الأدنى المطلوب لبوسطة تقريبًا، لكن من غير district (Aramex معندهوش
// حقل "zone/district" رسمي في Address shape بتاعه - بس بنبعته جوه Line2 كسياق
// إضافي لو موجود). لا نجعل حقول خاصة ببوسطة (زي buildingNumber) إجبارية هنا.
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
      `بيانات عنوان الشحن غير مكتملة لأرامكس: ${check.missingLabels.join('، ')}`,
      'PROVIDER_ADDRESS_INCOMPLETE',
      { status: 422, fields: check.missingKeys },
    );
  }
  return addr;
}

// بيبني PartyAddress (Line1/Line2/City/CountryCode/PostCode - بدون اسم أو
// تليفون، دول جوه Contact). لو origin=true بيبني عنوان نقطة الاستلام (pickup)
// من إعدادات الأدمن، مش من الأوردر.
function buildPartyAddress(config, order, resolvedAddress, origin = false) {
  if (origin) {
    return {
      Line1: config.pickupAddress || '',
      City: config.pickupCity || '',
      PostCode: config.pickupPostCode || '',
      CountryCode: config.countryCode || 'EG',
    };
  }
  const secondLine = buildSecondLine(resolvedAddress);
  const partyAddress = {
    Line1: resolvedAddress.detailedAddress || '',
    City: resolvedAddress.governorate || '',
    PostCode: resolvedAddress.zipCode || '',
    CountryCode: countryToCode(resolvedAddress.country),
  };
  // Line2/Line3 اختياريين حسب التوثيق - بنستخدمهم لتفاصيل المبنى/الدور/الشقة
  // وبعد كده المنطقة/الحي (district) عشان مندوب أرامكس ياخد أكبر سياق ممكن،
  // من غير ما نخترع حقل "zone" رسمي مش موجود في Address shape بتاع أرامكس.
  if (secondLine) partyAddress.Line2 = secondLine;
  if (resolvedAddress.district) partyAddress.Line3 = resolvedAddress.district;
  return partyAddress;
}

function buildContact(config, order, resolvedAddress, origin = false) {
  if (origin) {
    return {
      PersonName: config.pickupName || 'Shipper',
      CompanyName: config.pickupName || 'Shipper',
      PhoneNumber1: config.pickupPhone || '',
      CellPhone: config.pickupPhone || '',
      EmailAddress: config.pickupEmail || '',
    };
  }
  return {
    PersonName: resolvedAddress.fullName || 'Customer',
    CompanyName: resolvedAddress.fullName || 'Customer',
    PhoneNumber1: resolvedAddress.phone || '',
    CellPhone: resolvedAddress.phone2 || resolvedAddress.phone || '',
    EmailAddress: resolvedAddress.email || '',
  };
}

module.exports = { validateOrder, buildPartyAddress, buildContact, countryToCode };