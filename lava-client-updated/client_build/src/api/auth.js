import client, { unwrapApiData } from './client';

export const authAPI = {
  async getConfig() {
    const response = await client.get('/auth/config');
    return unwrapApiData(response);
  },
  async login(email, password) {
    const response = await client.post('/auth/login', { email, password });
    return unwrapApiData(response);
  },
  async register(name, email, phone, password, marketingConsent) {
    const response = await client.post('/auth/register', { name, email, phone, password, marketingConsent });
    return unwrapApiData(response);
  },
  async checkEmail(email) {
    const response = await client.post('/auth/check-email', { email });
    return unwrapApiData(response);
  },
  async sendCode(email) {
    const response = await client.post('/auth/send-code', { email });
    return unwrapApiData(response);
  },
  async verifyCode(email, code, marketingConsent) {
    const response = await client.post('/auth/verify-code', { email, code, marketingConsent });
    return unwrapApiData(response);
  },
  async forgotPassword(email) {
    const response = await client.post('/auth/forgot-password', { email });
    return unwrapApiData(response);
  },
  async resetPassword(email, code, newPassword) {
    const response = await client.post('/auth/reset-password', { email, code, newPassword });
    return unwrapApiData(response);
  },
  async getAdminConfig() {
    const response = await client.get('/auth/admin-config');
    return unwrapApiData(response);
  },
  async requestAdminConfigOtp() {
    const response = await client.post('/auth/admin-config/send-otp');
    return unwrapApiData(response);
  },
  async updateAdminConfig(payload) {
    const response = await client.put('/auth/admin-config', payload);
    return unwrapApiData(response);
  },
  async me() {
    const response = await client.get('/auth/me');
    const payload = unwrapApiData(response);
    return payload?.user ?? payload;
  },
  async updateSavedShipping(payload) {
    const response = await client.put('/auth/saved-shipping', payload);
    const data = unwrapApiData(response);
    return data?.user ?? data;
  },
  async updateWishlist(wishlist) {
    const response = await client.put('/auth/wishlist', { wishlist });
    const data = unwrapApiData(response);
    return data?.user ?? data;
  },
  async updateMarketingConsent(marketingConsent) {
    const response = await client.put('/auth/marketing-consent', { marketingConsent });
    const data = unwrapApiData(response);
    return data?.user ?? data;
  },
  async updateCart(cart) {
    const response = await client.put('/auth/cart', { cart });
    const data = unwrapApiData(response);
    return data?.user ?? data;
  },
  async logout() {
    const response = await client.post('/auth/logout');
    return unwrapApiData(response);
  },
  // لازم تتنادى مرة عند فتح الموقع عشان تجيب CSRF cookie قبل أي POST/PUT/PATCH/DELETE
  async fetchCsrfToken() {
    const response = await client.get('/auth/csrf-token');
    return unwrapApiData(response);
  },
};