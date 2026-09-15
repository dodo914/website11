const { requestJson } = require('./http');
const { getEnvConfig, resolveBaseUrl } = require('./config');
const { resolveOrderAddress } = require('./orderAddress');
const { validateOrder: validateAramexOrder, buildPartyAddress, buildContact, countryToCode } = require('./aramexAddressMapper');
const { classifyProviderApiError } = require('./providerErrors');
function clientInfo(c) { return { UserName:c.username, Password:c.password, Version:'1.0', AccountNumber:c.accountNumber, AccountPin:c.accountPin, AccountEntity:c.accountEntity, AccountCountryCode:c.countryCode, Source:24 }; }
// ------------------------------------------------------------------------
// Party = PartyAddress + Contact (منفصلين تمامًا حسب التوثيق الرسمي - Aramex's
// Guide to Embedding the Shipping Services API, جدول 19 Party / جدول 20
// Address / جدول 21 Contact). قبل كده كان الكود حاطط الاسم والتليفون
// (ContactPerson/Phone) جوه PartyAddress نفسها، وده غلط: PartyAddress بيقبل
// بس (Line1/Line2/Line3/City/StateOrProvinceCode/PostCode/CountryCode) -
// مفيش فيها حقل اسم أو تليفون أصلًا. النتيجة كانت إن أرامكس مبتستقبلش اسم
// أو رقم تليفون المستلم/المرسل صح (أو ممكن ترفض الطلب لأن Contact.PersonName/
// PhoneNumber1/CellPhone/EmailAddress كلهم Mandatory في التوثيق الرسمي).
//
// ملحوظة إصلاح إضافية (Phase 3 - مراجعة الأربع شركات): address()/contact()
// كانوا بيقروا order.address/order.governorate/order.customerName... (الحقول
// القديمة المسطّحة) بس، من غير ما يلمسوا shippingAddress (عنوان Phase 2
// المنظّم) خالص - يعني district ومبنى/دور/شقة/علامة مميزة كانوا بيتفقدوا
// تمامًا لأرامكس. دلوقتي بيستخدموا aramexAddressMapper.js اللي بيقرا من
// resolveOrderAddress المشترك (بيرجع shippingAddress مع fallback للحقول
// القديمة تلقائيًا).
// ------------------------------------------------------------------------
function address(c, order, origin=false) {
  const resolved = origin ? null : resolveOrderAddress(order);
  return buildPartyAddress(c, order, resolved, origin);
}
function contact(c, order, origin=false) {
  const resolved = origin ? null : resolveOrderAddress(order);
  return buildContact(c, order, resolved, origin);
}
// بعد الدمج مع إعدادات الأدمن (تجريبي/حقيقي)، لازم نعيد حساب baseUrl بناءً
// على البيئة النهائية المختارة، مش اللي كانت متحسوبة وقت قراءة الـ.env بس.
function cfg(custom={}) {
  const merged = {...getEnvConfig().aramex,...custom};
  merged.baseUrl = resolveBaseUrl('aramex', merged.environment, process.env.ARAMEX_BASE_URL);
  // في وضع التجريبي، لو متسجل حساب Aramex اختباري منفصل بنستخدمه؛ لو مش
  // موجود بيفضل يستخدم بيانات حساب الإنتاج (Aramex عادة بتقبلها على السيرفر التجريبي).
  if (String(merged.environment).toLowerCase() !== 'production' && merged.sandboxUsername) {
    merged.username = merged.sandboxUsername; merged.password = merged.sandboxPassword;
    merged.accountNumber = merged.sandboxAccountNumber; merged.accountPin = merged.sandboxAccountPin;
    merged.accountEntity = merged.sandboxAccountEntity;
  }
  return merged;
}
// أسماء الـ services في Aramex REST API لازم تبقى بالحروف دي بالظبط (case-sensitive)،
// والمسار الصحيح فيه "ShippingAPI.V2" مش "shippingapi" — ده كان سبب فشل الاتصال بالكامل.
const ARAMEX_SERVICE_PATHS = { tracking: 'Tracking', ratecalculator: 'RateCalculator', shipping: 'Shipping' };
async function call(c, service, operation, body, opts = {}) {
  const servicePath = ARAMEX_SERVICE_PATHS[String(service).toLowerCase()] || service;
  return requestJson(`${c.baseUrl}/ShippingAPI.V2/${servicePath}/Service_1_0.svc/json/${operation}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body), ...opts});
}
// اختبار الاتصال محتاج رد سريع وصادق (retry:false + مهلة قصيرة) بدل ما
// ياخد لحد دقيقة بسبب الـretry التلقائي (3 محاولات × حتى 15 ثانية) قبل ما
// المستخدم يشوف النتيجة الحقيقية (بيانات غلط/انتهت المهلة فعلًا/إلخ).
async function test(custom={}) { const c=cfg(custom); if(!c.username||!c.password||!c.accountNumber||!c.accountPin||!c.accountEntity) throw new Error('بيانات Aramex غير مكتملة'); return call(c,'tracking','TrackShipments',{ClientInfo:clientInfo(c), Shipments:['0000000000'], GetLastTrackingUpdateOnly:true}, {retry:false, timeout:8000}); }
async function rate(order, custom={}) { const c=cfg(custom); if(!c.username) throw new Error('بيانات Aramex غير مكتملة'); const orderRef=String(order.orderNumber||order._id||'quote'); const body={ClientInfo:clientInfo(c), Transaction:{Reference1:orderRef}, OriginAddress:address(c,order,true), DestinationAddress:address(c,order,false), ShipmentDetails:{NumberOfPieces:1, ProductGroup:'EXP', ProductType:'OND', PaymentType:'P', PaymentOptions:'ACCT', ActualWeight:{Value:1,Unit:'KG'}, ChargeableWeight:{Value:1,Unit:'KG'}}}; const data=await call(c,'ratecalculator','CalculateRate',body); const total=data?.TotalAmount?.Value ?? data?.RateResult?.TotalAmount?.Value ?? data?.data?.TotalAmount?.Value; if(total==null) throw new Error('Aramex لم يرجع سعرًا'); return {amount:Number(total),currency:data?.TotalAmount?.Currency||'EGP',raw:data}; }
// بيتحقق من بيانات عنوان الأوردر (بند 7: كل شركة requirements مختلفة - هنا
// مفيش اشتراط district زي بوسطة لأن Aramex معندهوش حقل zone رسمي) قبل ما
// نبني الـpayload أو نبعت أي request لأرامكس - بيرمي structured error
// (PROVIDER_ADDRESS_INCOMPLETE) بدل ما ننتظر أرامكس نفسها ترفض الطلب.
function validateOrder(order) { return validateAramexOrder(order); }

async function createShipment(order, custom={}) {
  const c=cfg(custom); if(!c.username||!c.password||!c.accountNumber||!c.accountPin||!c.accountEntity) throw new Error('بيانات Aramex غير مكتملة (ARAMEX_USERNAME/PASSWORD/ACCOUNT_NUMBER/ACCOUNT_PIN/ACCOUNT_ENTITY)');
  validateOrder(order);
  const orderRef=String(order.orderNumber||order._id);
  const body={ClientInfo:clientInfo(c),LabelInfo:{ReportID:9201,ReportType:'URL'},Shipments:[{Reference1:orderRef,Shipper:{Reference1:orderRef,AccountNumber:c.accountNumber,PartyAddress:address(c,order,true),Contact:contact(c,order,true)},Consignee:{Reference1:orderRef,PartyAddress:address(c,order,false),Contact:contact(c,order,false)},ShippingDateTime:new Date().toISOString(),DueDate:new Date(Date.now()+5*86400000).toISOString(),Comments:'LAVA order',Details:{Dimensions:{Length:10,Width:10,Height:10,Unit:'CM'},ActualWeight:{Value:1,Unit:'KG'},ProductGroup:'EXP',ProductType:'OND',PaymentType:order.paymentMethod==='cod'?'C':'P',PaymentOptions:'ACCT',NumberOfPieces:1,DescriptionOfGoods:'LAVA order',GoodsOriginCountry:'EG',Items:[]}}]};
  let data;
  try {
    data = await call(c,'shipping','CreateShipments',body);
  } catch (err) {
    // بند 10: نصنّف auth/timeout لـstructured errors واضحة (PROVIDER_AUTH_ERROR/
    // PROVIDER_TIMEOUT) بدل ما نسيب رسالة أرامكس الخام تتسرب زي ما هي.
    const classified = classifyProviderApiError(err);
    if (classified) throw classified;
    throw err;
  }
  const s=data?.Shipments?.[0]||data?.data?.Shipments?.[0]||data?.data||data; return {raw:data,shipmentId:s?.ID||s?.ShipmentNumber,trackingNumber:s?.ID||s?.ShipmentNumber,labelUrl:s?.ShipmentLabel?.LabelURL||s?.LabelURL};
}
async function track(trackingNumber, custom={}) { const c=cfg(custom); if(!c.username||!c.password||!c.accountNumber||!c.accountPin||!c.accountEntity) throw new Error('بيانات Aramex غير مكتملة'); const data=await call(c,'tracking','TrackShipments',{ClientInfo:clientInfo(c),Shipments:[trackingNumber]}); const s=data?.TrackingResults?.[0]||data?.data?.[0]||{}; return {raw:data,status:s?.UpdateCode||s?.UpdateDescription||s?.Status}; }
// ------------------------------------------------------------------------
// Cancel Shipment
// دليل أرامكس الرسمي (Aramex's Guide to Embedding the Shipping Services API
// - aramex.com/docs) بيوضح إن الـShipping Services API الرسمي فيه بس:
// Shipment Creation, Label Printing, Pickup Creation, **Pickup Cancellation**
// (مش Shipment Cancellation), Reserve Shipment Number Range, Get Last
// Shipments Numbers Range, Schedule Delivery. يعني مفيش عملية رسمية موثّقة
// لإلغاء شحنة (Shipment) بعد إنشائها - العملية الوحيدة الموجودة هي إلغاء
// طلب استلام (Pickup) لو كان اتعمل، وده مش نفس حالتنا هنا (بننشئ الشحنة
// مباشرة من غير Pickup request منفصل). عشان كده الـcapability دي false مع
// رسالة واضحة بدل تنفيذ وهمي، بالظبط زي ShipBlu.
// ------------------------------------------------------------------------
async function cancelShipment() {
  throw new Error('إلغاء الشحنة (Shipment) عبر Aramex Shipping API غير موثّق رسميًا - الـAPI الرسمي بيدعم فقط إلغاء طلب الاستلام (Pickup Cancellation)، مش إلغاء الشحنة نفسها بعد إنشائها. للإلغاء الفعلي، تواصل مع دعم أرامكس مباشرة.');
}
cancelShipment.supported = false;

// ------------------------------------------------------------------------
// Returns / Exchanges (Aramex Return & Exchange Integration Audit)
// ------------------------------------------------------------------------
// دليل أرامكس الرسمي (Aramex's Guide to Embedding the Shipping Services API)
// بيوثّق بس: Shipment Creation, Label Printing, Pickup Creation/Cancellation,
// Reserve Shipment Number Range, Get Last Shipments Numbers Range, Schedule
// Delivery. مفيش عملية "Return Shipment" أو "Exchange Shipment" مخصوصة
// موثّقة رسميًا - أقرب حاجة هي إنك تعمل createShipment عادي تاني بعنوان
// مقلوب (Consignee/Shipper) يدويًا من الأدمن، مش عملية API واحدة جاهزة.
// عشان كده الـcapability دي false (زي ShipBlu بالظبط) والنظام بيشتغل في
// Manual Mode: الأدمن بينشئ الشحنة يدويًا مع أرامكس، بعدين يدخّل رقم
// التتبع هنا، والباك اند يحاول يتابعها تلقائيًا (Aramex Tracking API
// بتدعم أي رقم شحنة صادر منها بغض النظر عن الغرض منه - شوف track() فوق).
// ------------------------------------------------------------------------
async function createReturn() {
  throw new Error('عملية الإرجاع (Return Shipment) عبر Aramex Shipping API غير موثّقة كعملية مستقلة - الـAPI الرسمي بيدعم إنشاء شحنة عادية بس. للإرجاع، أنشئ الشحنة يدويًا مع أرامكس وأدخل رقم التتبع هنا.');
}
createReturn.supported = false;

async function createExchange() {
  throw new Error('عملية الاستبدال (Exchange Shipment) عبر Aramex Shipping API غير موثّقة كعملية مستقلة - الـAPI الرسمي بيدعم إنشاء شحنة عادية بس. للاستبدال، أنشئ الشحنة يدويًا مع أرامكس وأدخل رقم التتبع هنا.');
}
createExchange.supported = false;

module.exports={test,rate,createShipment,track,cancelShipment,createReturn,createExchange,validateOrder};