import client, { unwrapApiData } from './client';
export const shippingAPI = {
  async getProviders(){ return unwrapApiData(await client.get('/shipping/providers')); },
  // قائمة capabilities كل الشركات مع بعض (بديل خفيف عن getProviders لو
  // محتاج الـcapabilities بس من غير باقي بيانات الإعدادات).
  async getCapabilities(){ return unwrapApiData(await client.get('/shipping/capabilities')); },
  async connect(provider){ return unwrapApiData(await client.post(`/shipping/providers/${provider}/connect`)); },
  async getRates(payload){ return unwrapApiData(await client.post('/shipping/rates', payload)); },
  async getGovernorates(provider){ return unwrapApiData(await client.get(`/shipping/providers/${provider}/governorates`)); },
  async createShipment(orderId, provider){ return unwrapApiData(await client.post(`/shipping/orders/${orderId}/create`, {provider})); },
  async cancelShipment(orderId){ return unwrapApiData(await client.post(`/shipping/orders/${orderId}/cancel`)); },
  async getLabel(orderId){ return unwrapApiData(await client.get(`/shipping/orders/${orderId}/label`)); },
  async track(orderId, provider){ return unwrapApiData(await client.get(`/shipping/orders/${orderId}/track`, {params:{provider}})); },
  // Return/Exchange: الباك اند بيرجع 400 برسالة "غير مدعومة" (code:
  // UNSUPPORTED_OPERATION) لو الشركة مش بتدعم العملية دي رسميًا - الفرونت
  // أصلاً بيخفي الزرار في الحالة دي (شوف capabilities)، فالنداء ده مش
  // المفروض يحصل غير لما capability=true فعلاً.
  async createReturn(orderId){ return unwrapApiData(await client.post(`/shipping/orders/${orderId}/return`)); },
  async createExchange(orderId){ return unwrapApiData(await client.post(`/shipping/orders/${orderId}/exchange`)); },
  // ===== Manual Mode - Bosta Return/Exchange Integration =====
  // بتتستخدم لما createReturn/createExchange ترجع UNSUPPORTED_OPERATION (الشركة
  // مش بتدعم إنشاء تلقائي) - الأدمن بيعمل العملية يدويًا على موقع/تطبيق شركة
  // الشحن وبعدين يدخّل رقم التتبع هنا. لو الشركة supportsTracking، الباك اند
  // بيحاول مزامنة فورية تلقائيًا (شوف رد trackingMode: 'auto'|'manual').
  async setReturnTracking(orderId, { trackingNumber, provider, syncEnabled }){
    return unwrapApiData(await client.post(`/shipping/orders/${orderId}/return/tracking`, { trackingNumber, provider, syncEnabled }));
  },
  async syncReturnTracking(orderId){ return unwrapApiData(await client.post(`/shipping/orders/${orderId}/return/sync`)); },
  async setExchangeTracking(orderId, { trackingNumber, provider, syncEnabled }){
    return unwrapApiData(await client.post(`/shipping/orders/${orderId}/exchange/tracking`, { trackingNumber, provider, syncEnabled }));
  },
  async syncExchangeTracking(orderId){ return unwrapApiData(await client.post(`/shipping/orders/${orderId}/exchange/sync`)); },
};