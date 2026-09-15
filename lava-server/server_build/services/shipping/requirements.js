// ============================================================================
// Provider Requirements Registry (Checkout Dynamic Fields - Phase 4)
// ------------------------------------------------------------------------
// الهدف: مصدر واحد يوصف "الحقول العامة (Generic Order Address) المطلوبة
// فعليًا لكل شركة شحن" - بيتقرأ من نفس REQUIRED_FIELDS المستخدمة فعليًا في
// كل provider-specific mapper (bostaAddressMapper.js/aramexAddressMapper.js/
// dhlAddressMapper.js/shipbluService.js) عشان الـfrontend يقدر يبني Checkout
// ديناميكي (يعرض الحقول المطلوبة فقط لما العميل يختار provider معين) من غير
// ما نكرر نفس الـlist مرتين (مرة في الباك اند للـvalidation الحقيقية، ومرة
// جوه كومبوننتات الفرونت كـhard-code منفصل).
//
// ملحوظة: دي وصف للحقول العامة (fullName/phone/governorate/district/
// detailedAddress...) بس - مش provider-specific IDs (زي bostaZoneId) واللي
// لازم تفضل جوه provider mapping/location layer زي ما اتحدد في الطلب.
//
// email: مفيش provider من الأربعة بيشترط email فعليًا في الـpayload الرسمي
// بتاعه (Bosta/Aramex/DHL/ShipBlu كلهم بيبعتوا email لو موجود بس من غير ما
// يرفضوا الطلب لو فاضي) - عشان كده مش موجود في requiredFields لأي شركة هنا،
// وبالتبعية Checkout لازم يفضل يعامله كـoptional لكل الشركات (مش بس Step 1).
// ============================================================================

const bostaMapper = require('./bostaAddressMapper');
const aramexMapper = require('./aramexAddressMapper');
const dhlMapper = require('./dhlAddressMapper');

// كل قايمة هنا لازم تفضل مطابقة تمامًا لـREQUIRED_FIELDS الفعلية جوه
// الـmapper بتاع كل شركة (مصدر الحقيقة الوحيد هو الـvalidateOrder بتاعها) -
// عشان كده بنبنيها هنا بالرجوع لنفس الدوال بدل ما نكتب نسخة تانية يدويًا
// ممكن تتفرق عن الحقيقي مع الوقت.
function requiredFieldsFor(providerKey) {
  const probeAddress = {}; // عنوان فاضي عمدًا - الهدف بس نطلع أسماء الحقول الناقصة (missingKeys) من نفس منطق الـvalidation الحقيقي، مش نتحقق من عنوان حقيقي.
  try {
    switch (providerKey) {
      case 'bosta': {
        const check = bostaMapper.validateRequiredFields(probeAddress);
        return check.missingKeys;
      }
      case 'aramex': {
        // aramexAddressMapper.validateOrder بيرمي - بنمسك الـfields من الخطأ.
        try { aramexMapper.validateOrder({}); } catch (e) { return e.fields || []; }
        return [];
      }
      case 'dhl': {
        try { dhlMapper.validateOrder({}); } catch (e) { return e.fields || []; }
        return [];
      }
      case 'shipblu': {
        // shipbluService.validateOrder جوه shipbluService.js نفسها (مش ملف
        // مapper منفصل - الشركة معندهاش transformation معقدة زي باقي
        // الشركات، بس geo lookup) - بنطلبه lazily هنا عشان نتفادى circular
        // require (shipbluService بيستخدم orderAddress.js برضه بس مش
        // requirements.js).
        const shipblu = require('./shipbluService');
        try { shipblu.validateOrder({}); } catch (e) { return e.fields || []; }
        return [];
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

const PROVIDER_KEYS = ['bosta', 'aramex', 'dhl', 'shipblu'];

// الحقول العامة الكاملة المتاحة أصلاً في shippingAddress (Order.js) - أي
// حقل موجود هنا ومش موجود في requiredFields provider معين يبقى "اختياري"
// بالنسبة لهذا الـprovider (ممكن يتبعت لو العميل دخله، بس مش هيتمنع الطلب
// لو فاضي).
const ALL_GENERIC_FIELDS = [
  'fullName', 'phone', 'phone2', 'email', 'governorate', 'district',
  'detailedAddress', 'buildingNumber', 'floor', 'apartment', 'landmark',
  'zipCode',
];

// بيرجع { requiredFields, optionalFields } لشركة شحن معينة - مستخدم من
// getProviders في shippingController.js عشان الـfrontend يبني Checkout
// ديناميكي (يعرض/يطلب بس الحقول اللي الـprovider المختار محتاجها فعليًا).
function getProviderRequirements(providerKey) {
  const requiredFields = requiredFieldsFor(String(providerKey || '').toLowerCase());
  const optionalFields = ALL_GENERIC_FIELDS.filter((f) => !requiredFields.includes(f));
  return { requiredFields, optionalFields };
}

function getAllProviderRequirements() {
  const out = {};
  for (const key of PROVIDER_KEYS) out[key] = getProviderRequirements(key);
  return out;
}

module.exports = { getProviderRequirements, getAllProviderRequirements, ALL_GENERIC_FIELDS };