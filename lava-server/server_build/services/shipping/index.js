const { getEnvConfig, publicConfig } = require('./config');
const { getCapabilities, getAllCapabilities, assertCapability } = require('./capabilities');
const providers = { bosta: require('./bostaService'), aramex: require('./aramexService'), dhl: require('./dhlService'), shipblu: require('./shipbluService') };
function getProvider(key){ const p=providers[String(key||'').toLowerCase()]; if(!p) throw new Error(`شركة الشحن غير مدعومة: ${key}`); return p; }
function getConfig(key){ return getEnvConfig()[key]; }
async function rates(order, saved = {}){
  const configs=getEnvConfig(); const out=[];
  // شركات manual_rate (زي بوسطة و ShipBlu) مالهاش username/API rate call، بتاخد
  // السعر من الجدول اللي الأدمن حطه (defaultRate/governorateRates) بس - فمش
  // لازم نتأكد من وجود username ليها زي أرامكس/DHL.
  for(const key of Object.keys(providers)){
    const c={...configs[key], ...(saved[key]||{})};
    const isManualRate = c.mode === 'manual_rate';
    if(c.enabled===false || (!isManualRate && !c.username)) continue;
    try { const result=isManualRate?providers[key].rate(order,c):await providers[key].rate(order,c); if(result) out.push({provider:key,name:c.name,...result}); }
    catch(error){
      // منسبش تفاصيل الخطأ الداخلي (اتصال المزوّد/بيانات الاعتماد) توصل للعميل -
      // بنسجلها في اللوج بس، وبنرجع flag عام إن السعر مش متاح دلوقتي لشركة الشحن دي.
      console.error(`[shipping-rates] provider ${key} rate() failed:`, error);
      out.push({provider:key,name:c.name,unavailable:true});
    }
  }
  return out;
}

// بتحاول تنشئ شحنة فعلية لشركة الشحن المختارة في الطلب (order.shippingCompany)
// - بتترجع { ok:true, result } لو نجحت، أو { ok:false, message } لو فشلت أو
// مفيش شركة شحن محددة/مفعّلة أصلاً. منعملش throw عشان الكود اللي بينادي
// عليها (إنشاء الطلب) ميقفش لو شركة الشحن فشلت أو مش جاهزة.
async function createShipmentForOrder(order, saved = {}) {
  const key = String(order.shippingCompany || '').toLowerCase();
  if (!key) return { ok: false, message: 'لا توجد شركة شحن محددة لهذا الطلب' };
  const base = getConfig(key);
  if (!base) return { ok: false, message: `شركة الشحن غير مدعومة: ${key}` };
  const config = { ...base, ...(saved[key] || {}) };
  if (config.enabled === false) return { ok: false, message: `شركة الشحن (${config.name || key}) غير مفعّلة حاليًا` };

  const missing = [];
  if (!order.customerName) missing.push('اسم العميل');
  if (!order.customerPhone) missing.push('رقم الهاتف');
  if (!order.address) missing.push('عنوان الشحن');
  if (!order.governorate) missing.push('المحافظة');
  if (missing.length) return { ok: false, message: `بيانات ناقصة في الطلب لإنشاء الشحنة: ${missing.join('، ')}`, code: 'MISSING_FIELDS' };

  try {
    const p = getProvider(key);
    // لو الـprovider عنده validateOrder خاص بيه (زي bosta - شوف
    // bostaService.js) بيتنفذ هنا قبل createShipment فعليًا، عشان منستناش
    // شركة الشحن نفسها تكتشف نقص البيانات (بند 6 في طلب Phase 3). كل شركة
    // شحن تانية (Aramex/DHL/ShipBlu) من غير validateOrder بتفضل شغالة
    // بنفس التحقق العام اللي فوق بس، من غير أي تغيير في سلوكها.
    if (typeof p.validateOrder === 'function') p.validateOrder(order);
    const result = await p.createShipment(order, config);
    return { ok: true, result };
  } catch (e) {
    // P1-6: زي getRates بالظبط - لو الخطأ جايّ من نداء HTTP فعلي لمزوّد الشحن
    // (عليه `.data` من services/shipping/http.js)، ممكن يحتوي نص خام من رد
    // المزوّد. الرسالة دي بتتخزن في order.shippingError وبترجع للعميل نفسه في
    // رد إنشاء الطلب (res.status(201).json(order))، فمينفعش تتسرب زي ما هي.
    const safeMessage = (e && e.data !== undefined)
      ? `فشل الاتصال بشركة الشحن (HTTP ${e.status || 'error'})`
      : (e.message || 'فشل إنشاء الشحنة');
    return { ok: false, message: safeMessage, code: e.code, fields: e.fields };
  }
}

module.exports={providers,getProvider,getConfig,publicConfig,rates,createShipmentForOrder,getCapabilities,getAllCapabilities,assertCapability};