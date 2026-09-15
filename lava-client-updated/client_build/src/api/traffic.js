import client, { unwrapApiData } from './client';

// ملحوظة عن معالجة الأخطاء هنا:
// كل دوال التتبع دي لازم "تفشل بهدوء" (fail silently) بالنسبة للعميل - يعني
// أي مشكلة شبكة/سيرفر ما ينفعش توقف أو تبطئ تجربة الشراء أبداً.
// لكن "بهدوء" بالنسبة للعميل لازم ميكونش "بصمت" بالنسبة للمطوّر: من غير
// console.warn هنا، أي مشكلة في الاتصال بالـ traffic endpoint (سيرفر واقف،
// بورت غلط، CORS...) هتفضل مخفية تماماً وهتوهمك إن مفيش زوار خالص من غير
// أي أثر تقدر تشوفه في الـ Network/Console.
const logTrackingFailure = (label, err) => {
  console.warn(`lava traffic: ${label} فشل - مش هيوقف الموقع، لكن الحدث ده مش هيتسجل`, err?.message || err);
};

export const trafficAPI = {
  // session_start — يتبعت عند أول تحميل، ويعاد المحاولة تلقائياً لو فشلت
  // المحاولة اللي قبل كده (شوف useEffect بتاع session_start في App.jsx)
  async recordVisit(payload) {
    try {
      const response = await client.post('/traffic/visit', payload);
      return unwrapApiData(response);
    } catch (err) {
      logTrackingFailure('recordVisit (session_start)', err);
      return null;
    }
  },

  // page_view — يتبعت عند كل navigation داخل نفس الـ session
  async recordPageView(sessionId, page) {
    try {
      const response = await client.post('/traffic/pageview', { sessionId, page });
      return unwrapApiData(response);
    } catch (err) {
      logTrackingFailure('recordPageView', err);
      return null;
    }
  },

  // تحديث حالة الـ session إلى converted بعد الشراء
  async markConverted(sessionId, orderId, orderAmount, visitorId) {
    try {
      const response = await client.put('/traffic/convert', { sessionId, orderId, orderAmount, visitorId });
      return unwrapApiData(response);
    } catch (err) {
      logTrackingFailure('markConverted', err);
      return null;
    }
  },

  // خطوات الـ funnel: 'visit' | 'product_view' | 'add_to_cart' | 'checkout' | 'purchase'
  async trackFunnel(visitorId, sessionId, step) {
    try {
      const response = await client.post('/traffic/funnel', { visitorId, sessionId, step });
      return unwrapApiData(response);
    } catch (err) {
      logTrackingFailure(`trackFunnel (${step})`, err);
      return null;
    }
  },

  async getStats(days = 30) {
    const response = await client.get(`/traffic/stats?days=${days}`);
    return unwrapApiData(response);
  },

  // عدد الزوار الأونلاين دلوقتي — لوحة التحكم (أدمن)
  async getOnline() {
    try {
      const response = await client.get('/traffic/online');
      return unwrapApiData(response);
    } catch (err) {
      logTrackingFailure('getOnline', err);
      return null;
    }
  },

  // كام عميل بيشوف صفحة المنتج ده دلوقتي — صفحة المنتج (عام)
  async getProductViewers(productId) {
    try {
      const response = await client.get(`/traffic/product-viewers/${productId}`);
      return unwrapApiData(response);
    } catch (err) {
      logTrackingFailure('getProductViewers', err);
      return null;
    }
  },
};