const { requestJson } = require('./http');
const { getEnvConfig, resolveBaseUrl } = require('./config');
const { resolveOrderAddress } = require('./orderAddress');
const { validateOrder: validateDhlOrder, buildPostalAddress, buildContactInformation, countryToCode: mapperCountryToCode } = require('./dhlAddressMapper');
const { classifyProviderApiError } = require('./providerErrors');
// بعد الدمج مع إعدادات الأدمن (تجريبي/حقيقي)، لازم نعيد حساب baseUrl بناءً
// على البيئة النهائية المختارة، مش اللي كانت متحسوبة وقت قراءة الـ.env بس.
function cfg(custom={}) {
  const merged = {...getEnvConfig().dhl,...custom};
  merged.baseUrl = resolveBaseUrl('dhl', merged.environment, process.env.DHL_BASE_URL);
  // DHL بتشترط مفتاح API تجريبي منفصل (من developer.dhl.com) عشان تقدر تستخدم سيرفر التست.
  if (String(merged.environment).toLowerCase() !== 'production' && merged.sandboxUsername) {
    merged.username = merged.sandboxUsername; merged.password = merged.sandboxPassword;
    merged.accountNumber = merged.sandboxAccountNumber || merged.accountNumber;
  }
  return merged;
}
function auth(c){ return 'Basic '+Buffer.from(`${c.username}:${c.password}`).toString('base64'); }
// ملحوظة إصلاح (Phase 3 - مراجعة الأربع شركات): query()/createShipment كانوا
// بيبنوا destination من order.governorate/order.address/order.zipCode/order.country
// (الحقول القديمة المسطّحة بس) من غير أي قراءة لـshippingAddress - يعني
// district ومبنى/دور/شقة/علامة مميزة كانوا بيضيعوا في شحنات DHL تمامًا. دلوقتي
// بيستخدم dhlAddressMapper.js اللي بيقرا العنوان الموحّد (shippingAddress مع
// fallback للحقول القديمة).
function query(c, order){
  const resolved = resolveOrderAddress(order);
  const postal = buildPostalAddress(resolved);
  return new URLSearchParams({accountNumber:c.accountNumber,originCountryCode:c.countryCode,originCityName:c.city,originPostalCode:c.postalCode,originStreetAddress:c.address||'',destinationCountryCode:postal.countryCode,destinationCityName:postal.cityName,destinationPostalCode:postal.postalCode,destinationStreetAddress:postal.addressLine1,weight:'1',weightUnitOfMeasure:'kg',length:'10',width:'10',height:'10',dimensionsUnitOfMeasure:'cm',plannedShippingDate:new Date().toISOString().slice(0,10),isCustomsDeclarable:postal.countryCode!==c.countryCode,currencyCode:'EGP',unitOfMeasurement:'metric'}).toString();
}
function countryCode(v){ return mapperCountryToCode(v); }
async function test(custom={}){const c=cfg(custom);if(!c.username||!c.password||!c.accountNumber)throw new Error('بيانات DHL غير مكتملة');return requestJson(`${c.baseUrl}/products?accountNumber=${encodeURIComponent(c.accountNumber)}&originCountryCode=${c.countryCode}&originCityName=${encodeURIComponent(c.city)}&destinationCountryCode=${c.countryCode}&destinationCityName=${encodeURIComponent(c.city)}&weight=1&weightUnitOfMeasure=kg`,{headers:{Authorization:auth(c),Accept:'application/json'},retry:false,timeout:8000});}
async function rate(order,custom={}){const c=cfg(custom);const data=await requestJson(`${c.baseUrl}/rates?${query(c,order)}`,{headers:{Authorization:auth(c),Accept:'application/json'}});const products=data?.products||[];const p=products[0];const amount=p?.totalPrice?.[0]?.price??p?.totalPrice?.[0]?.priceBreakdown?.[0]?.price;if(amount==null)throw new Error('DHL لم يرجع سعرًا');return {amount:Number(amount),currency:p?.totalPrice?.[0]?.currencyType||'EGP',service:p?.productName||p?.productCode,raw:data};}
// بيتحقق من بيانات عنوان الأوردر (بند 7) قبل بناء الـpayload - PROVIDER_ADDRESS_INCOMPLETE
// بدل ما ننتظر DHL نفسها ترفض الطلب.
function validateOrder(order) { return validateDhlOrder(order); }
async function createShipment(order,custom={}){
  const c=cfg(custom); if(!c.username||!c.password||!c.accountNumber) throw new Error('بيانات DHL غير مكتملة (DHL_API_USERNAME/DHL_API_PASSWORD/DHL_ACCOUNT_NUMBER)');
  const resolved = validateOrder(order);
  const receiverPostal = buildPostalAddress(resolved);
  const isExport = receiverPostal.countryCode !== c.countryCode;
  // بند (رقم الأوردر المتسلسل): زي Bosta/Aramex/ShipBlu بالظبط - بنبعت رقم
  // الأوردر المتسلسل (orderNumber: 1001، 1002...) لـDHL كـcustomerReferences
  // عشان يظهر على الشحنة وعلى ورقة الشحن (label) بدل ما يفضل من غير أي مرجع
  // للأوردر عندنا. orderRef بيقع على order._id كـfallback لو الأوردر (نادرًا)
  // معندوش orderNumber (أوردرات قديمة اتعملت قبل نظام الترقيم ده).
  const orderRef = String(order.orderNumber || order._id);
  const body={plannedShippingDateAndTime:new Date().toISOString().slice(0,19)+' GMT+00:00',pickup:{isRequested:false},productCode:'P',accounts:[{typeCode:'shipper',number:c.accountNumber}],customerDetails:{shipperDetails:{postalAddress:{postalCode:c.postalCode,cityName:c.city,countryCode:c.countryCode,addressLine1:c.address||'LAVA'},contactInformation:{fullName:c.contactName||'LAVA Store',companyName:c.contactName||'LAVA Store',phone:c.phone||''}},receiverDetails:{postalAddress:receiverPostal,contactInformation:buildContactInformation(resolved)}},content:{packages:[{weight:1,dimensions:{length:10,width:10,height:10}}],isCustomsDeclarable:isExport,description:'LAVA order',declaredValue:order.totalAmount||0,declaredValueCurrency:'EGP',unitOfMeasurement:'metric',...(isExport?{incoterm:'DAP'}:{})},customerReferences:[{value:orderRef,typeCode:'CU'}]};
  let data;
  try {
    data = await requestJson(`${c.baseUrl}/shipments`,{method:'POST',headers:{Authorization:auth(c),'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
  } catch (err) {
    // بند 10: نصنّف auth/timeout لـstructured errors بدل ما نسيب رسالة DHL الخام.
    const classified = classifyProviderApiError(err);
    if (classified) throw classified;
    throw err;
  }
  const p=data?.shipmentTrackingNumber||data?.packages?.[0]?.trackingNumber;return {raw:data,shipmentId:p,trackingNumber:p,labelUrl:data?.documents?.[0]?.contentUrl};
}
async function track(trackingNumber,custom={}){const c=cfg(custom);if(!c.username||!c.password) throw new Error('بيانات DHL غير مكتملة');const data=await requestJson(`${c.baseUrl}/shipments/${encodeURIComponent(trackingNumber)}/tracking`,{headers:{Authorization:auth(c),Accept:'application/json'}});const ev=data?.shipments?.[0]?.events?.[0];return {raw:data,status:ev?.description||ev?.serviceArea||ev?.typeCode};}
// ------------------------------------------------------------------------
// Cancel Shipment
// موثقة رسميًا في DHL Express MyDHL API (developer.dhl.com/api-reference/
// dhl-express-mydhl-api): DELETE /shipments/{shipmentTrackingNumber}. مسموح
// بس لو الشحنة لسه ما اتستلمتش من مندوب DHL (not yet picked up)، وبعد
// الإلغاء بيبقى الـtracking number غير صالح (irreversible).
// ------------------------------------------------------------------------
async function cancelShipment(trackingNumber, custom = {}) {
  const c = cfg(custom);
  if (!c.username || !c.password) throw new Error('بيانات DHL غير مكتملة');
  if (!trackingNumber) throw new Error('trackingNumber مطلوب لإلغاء شحنة DHL');
  const data = await requestJson(`${c.baseUrl}/shipments/${encodeURIComponent(trackingNumber)}`, {
    method: 'DELETE',
    headers: { Authorization: auth(c), Accept: 'application/json' },
  });
  return { raw: data };
}
cancelShipment.supported = true;

// ------------------------------------------------------------------------
// Returns / Exchanges (DHL Return & Exchange Integration Audit)
// ------------------------------------------------------------------------
// المصدر: DHL Express MyDHL API reference (developer.dhl.com/api-reference/
// dhl-express-mydhl-api). الـAPI الرسمي بيغطي: Rating, Shipment Creation
// (createShipment فوق)، Tracking، Shipment Cancellation (DELETE /shipments/:id
// - متنفذة فوق). **مفيش endpoint موثّق باسم "Return Shipment" أو "Exchange
// Shipment"** كعملية مستقلة - أقرب حاجة موجودة هي إنشاء شحنة عادية تانية
// (createShipment) بعنوان مقلوب (استلام من العميل بدل توصيل له)، وده قرار
// بيزنس مش عملية API جاهزة. عشان كده الـcapability دي false والنظام بيشتغل
// في Manual Mode: الأدمن بينشئ شحنة الإرجاع/الاستبدال يدويًا مع DHL، بعدين
// يدخّل رقم التتبع هنا، والباك اند يحاول يتابعها تلقائيًا (DHL Tracking API
// بتدعم أي شحنة صادرة من الحساب - شوف track() فوق).
// ------------------------------------------------------------------------
async function createReturn() {
  throw new Error('عملية الإرجاع (Return Shipment) عبر DHL Express MyDHL API غير موثّقة كعملية مستقلة - الـAPI الرسمي بيدعم إنشاء شحنة عادية بس. للإرجاع، أنشئ الشحنة يدويًا مع DHL وأدخل رقم التتبع هنا.');
}
createReturn.supported = false;

async function createExchange() {
  throw new Error('عملية الاستبدال (Exchange Shipment) عبر DHL Express MyDHL API غير موثّقة كعملية مستقلة - الـAPI الرسمي بيدعم إنشاء شحنة عادية بس. للاستبدال، أنشئ الشحنة يدويًا مع DHL وأدخل رقم التتبع هنا.');
}
createExchange.supported = false;

module.exports={test,rate,createShipment,track,cancelShipment,createReturn,createExchange,validateOrder};