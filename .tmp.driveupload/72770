import client, { unwrapApiData } from './client';

// ============================================================
// API إشعارات الطلبات الجديدة (Web Push) - للأدمن/الموظفين بس.
// ============================================================
export const pushAPI = {
  async getVapidPublicKey() {
    const res = await client.get('/push/vapid-public-key');
    return unwrapApiData(res);
  },
  async subscribe(subscription) {
    const res = await client.post('/push/subscribe', subscription);
    return unwrapApiData(res);
  },
  async unsubscribe(endpoint) {
    const res = await client.post('/push/unsubscribe', { endpoint });
    return unwrapApiData(res);
  },
};