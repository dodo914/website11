import client, { unwrapApiData } from './client';

export const customersAPI = {
  async getAll(params = {}) {
    const response = await client.get('/customers', { params });
    return unwrapApiData(response);
  },
  async getOrders(id) {
    const response = await client.get(`/customers/${id}/orders`);
    return unwrapApiData(response);
  },
  async getSegments() {
    const response = await client.get('/customers/segments');
    return unwrapApiData(response);
  },
};