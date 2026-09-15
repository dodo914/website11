import client, { unwrapApiData } from './client';

export const settingsAPI = {
  async getPublic() {
    const response = await client.get('/settings/public');
    return unwrapApiData(response);
  },
  async getPixels() {
    const response = await client.get('/settings/pixels');
    return unwrapApiData(response);
  },
  async getAdmin() {
    const response = await client.get('/settings/admin');
    return unwrapApiData(response);
  },
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await client.post('/settings/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapApiData(response);
  },
  // رفع فيديو (زي فيديو البانر الرئيسي) على Cloudinary مباشرة، بدون أي تحويل Base64
  async uploadVideo(file) {
    const formData = new FormData();
    formData.append('video', file);
    const response = await client.post('/settings/video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapApiData(response);
  },
  async update(payload) {
    const response = await client.put('/settings', payload);
    return unwrapApiData(response);
  },
  async addReview(productId, reviewData) {
    const response = await client.post('/settings/reviews', { productId, ...reviewData });
    return unwrapApiData(response);
  },
  async uploadReviewImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await client.post('/settings/reviews/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapApiData(response);
  },
  async addContactMessage(messageData) {
    const response = await client.post('/settings/contact', messageData);
    return unwrapApiData(response);
  },
  async getReviews(productId) {
    const response = await client.get(`/settings/reviews/${productId}`);
    return unwrapApiData(response);
  },
  async getAdminReviews(params = {}) {
    const response = await client.get('/settings/reviews', { params });
    return unwrapApiData(response);
  },
  async moderateReview(id, status) {
    const response = await client.patch(`/settings/reviews/${id}/status`, { status });
    return unwrapApiData(response);
  },
  async deleteReview(id) {
    const response = await client.delete(`/settings/reviews/${id}`);
    return unwrapApiData(response);
  },
  async getStoreHealth() {
    const response = await client.get('/settings/store-health');
    return unwrapApiData(response);
  },
};