import client, { unwrapApiData } from './client';

export const paymentsAPI = {
  async getKashierStatus() {
    const response = await client.get('/payments/kashier/status');
    return unwrapApiData(response);
  },
  async getPaymentStatus(orderId) {
    const response = await client.get(`/payments/kashier/status/${encodeURIComponent(orderId)}`);
    return unwrapApiData(response);
  },
  async getPaymobStatus() {
    const response = await client.get('/payments/paymob/status');
    return unwrapApiData(response);
  },
  async getPaymobPaymentStatus(orderId) {
    const response = await client.get(`/payments/paymob/status/${encodeURIComponent(orderId)}`);
    return unwrapApiData(response);
  },
};