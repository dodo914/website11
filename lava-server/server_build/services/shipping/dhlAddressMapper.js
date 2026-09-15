// ============================================================================
// DHL Address Mapper (Phase 3)
// ------------------------------------------------------------------------
// Generic Order Address (orderAddress.js)
//        ↓
// dhlAddressMapper (الملف ده)
//        ↓
// DHL Express MyDHL API postalAddress (addressLine1/addressLine2/cityName/
// postalCode/countryCode) + contactInformation (fullName/phone)
//
// ملحوظة (نفس باج Aramex): dhlService.js كان بيبني query()/body العنوان من
// order.governorate/order.address/order.zipCode/order.country مباشرة (الحقول
// القديمة بس)، من غير أي قراءة لـshippingAddress - يعني district ومبنى/دور/
// شقة كانوا بيضيعوا تمامًا في شحنات DHL. دلوقتي بيستخدم نفس resolver
// المشترك زي بوسطة وأرامكس.
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

// DHL محتاج فعليًا: اسم + هاتف + محافظة (كـcityName) + عنوان تفصيلي - نفس
// أرامكس بالظبط، من غير اشتراط district (مفيش حقل zone رسمي في postalAddress
// بتاع DHL أصلاً - بيتبعت جوه addressLine2 كسياق إضافي بس لو موجود).
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
      `بيانات عنوان الشحن غير مكتملة لـDHL: ${check.missingLabels.join('، ')}`,
      'PROVIDER_ADDRESS_INCOMPLETE',
      { status: 422, fields: check.missingKeys },
    );
  }
  return addr;
}

function buildPostalAddress(resolvedAddress) {
  const secondLine = buildSecondLine(resolvedAddress);
  const line2 = [secondLine, resolvedAddress.district ? `منطقة: ${resolvedAddress.district}` : ''].filter(Boolean).join(' - ');
  const postal = {
    postalCode: resolvedAddress.zipCode || '',
    cityName: resolvedAddress.governorate || '',
    countryCode: countryToCode(resolvedAddress.country),
    addressLine1: resolvedAddress.detailedAddress || '',
  };
  if (line2) postal.addressLine2 = line2;
  return postal;
}

function buildContactInformation(resolvedAddress) {
  return {
    fullName: resolvedAddress.fullName || 'Customer',
    companyName: resolvedAddress.fullName || 'Customer',
    phone: resolvedAddress.phone || '',
  };
}

module.exports = { validateOrder, buildPostalAddress, buildContactInformation, countryToCode };