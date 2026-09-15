import client, { unwrapApiData } from './client';

export const ordersAPI = {
  // ===== P1-1: idempotencyKey اختياري - لو اتبعت، بيتحط في هيدر
  // "Idempotency-Key" عشان الباك اند يمنع إنشاء أكتر من طلب واحد لنفس
  // محاولة الـcheckout (double-click/retry بعد timeout/إعادة إرسال من
  // الشبكة). شوف src/App.jsx (handleCheckoutSubmit) لطريقة توليد المفتاح،
  // و controllers/orderController.js في السيرفر لمنطق الحماية نفسه.
  async create(orderPayload, screenshotFile, idempotencyKey) {
    let response;
    const config = idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined;
    if (screenshotFile) {
      const formData = new FormData();
      formData.append('data', JSON.stringify(orderPayload));
      formData.append('screenshot', screenshotFile);
      response = await client.post('/orders', formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      });
    } else {
      response = await client.post('/orders', orderPayload, config);
    }
    return unwrapApiData(response);
  },
  async confirmPayment(id, confirmed) {
    const response = await client.put(`/orders/${id}/confirm-payment`, { confirmed });
    return unwrapApiData(response);
  },
  async getAll(params = {}) {
    const response = await client.get('/orders', { params });
    return unwrapApiData(response);
  },
  async getMine() {
    const response = await client.get('/orders/mine');
    return unwrapApiData(response);
  },
  // ===== إحصائيات الإيرادات محسوبة في الداتا بيز (aggregation) - بديل
  // عن تحميل كل الطلبات وحساب الإيراد في الفرونت =====
  async getRevenueStats(params = {}) {
    const response = await client.get('/orders/revenue-stats', { params });
    return unwrapApiData(response);
  },
  async getRevenueBreakdown(params = {}) {
    const response = await client.get('/orders/revenue-breakdown', { params });
    return unwrapApiData(response);
  },
  async getCustomerStats(params = {}) {
    const response = await client.get('/orders/customer-stats', { params });
    return unwrapApiData(response);
  },
  // ===== جراف المبيعات (aggregation بدون سقف 1000) - بديل عن بناء الجراف في الفرونت من statsOrders =====
  async getSalesTrend(params = {}) {
    const response = await client.get('/orders/sales-trend', { params });
    return unwrapApiData(response);
  },
  // ===== متوسط وقت التسليم / CLV / مبيعات اليوم وإمبارح / توزيع حالات الطلبات =====
  async getDashboardExtras(params = {}) {
    const response = await client.get('/orders/dashboard-extras', { params });
    return unwrapApiData(response);
  },
  // ===== مقارنة سنة بسنة (aggregation بدون سقف 1000) =====
  async getYearlyComparison() {
    const response = await client.get('/orders/yearly-comparison');
    return unwrapApiData(response);
  },
  async updateStatus(id, status, extra = {}) {
    const response = await client.put(`/orders/${id}/status`, { status, ...extra });
    return unwrapApiData(response);
  },
  async updatePackerStatus(id, packerStatus) {
    const response = await client.put(`/orders/${id}/packer-status`, { packerStatus });
    return unwrapApiData(response);
  },
  async getLoyaltyInfo() {
    const response = await client.get('/orders/loyalty-info');
    return unwrapApiData(response);
  },
  // ===== لوحات البيانات =====
  async getPaymentsDashboard() {
    const response = await client.get('/orders/payments-dashboard');
    return unwrapApiData(response);
  },
  async getShippingDashboard() {
    const response = await client.get('/orders/shipping-dashboard');
    return unwrapApiData(response);
  },
  async updateShipping(id, data) {
    const response = await client.put(`/orders/${id}/shipping`, data);
    return unwrapApiData(response);
  },
  async updatePaymentStatus(id, paymentStatus) {
    const response = await client.put(`/orders/${id}/payment-status`, { paymentStatus });
    return unwrapApiData(response);
  },
  async refundPayment(id, amount, reason) {
    const payload = {};
    if (amount != null && amount !== '') payload.amount = amount;
    if (reason) payload.reason = reason;
    const response = await client.put(`/orders/${id}/refund`, payload);
    return unwrapApiData(response);
  },
  // ===== استرجاع منتجات محددة من الطلب =====
  async requestReturn(id, { items, reason, reasonCode } = {}) {
    const response = await client.post(`/orders/${id}/return-request`, { items, reason, reasonCode });
    return unwrapApiData(response);
  },
  async reviewReturnRequest(id, { action, items, adminNote, returnShippingCost, reasonCode } = {}) {
    const payload = { action };
    if (items) payload.items = items;
    if (adminNote) payload.adminNote = adminNote;
    if (returnShippingCost != null && returnShippingCost !== '') payload.returnShippingCost = returnShippingCost;
    if (reasonCode) payload.reasonCode = reasonCode;
    const response = await client.put(`/orders/${id}/return-request`, payload);
    return unwrapApiData(response);
  },
  // ===== طلب استبدال (Exchange) منتج من الطلب =====
  async requestExchange(id, { items, reasonCode, customerNote } = {}) {
    const response = await client.post(`/orders/${id}/exchange-request`, { items, reasonCode, customerNote });
    return unwrapApiData(response);
  },
  // ===== Returns & Exchanges - Phase 2B: قايمة/تفاصيل طلبات الاسترجاع =====
  async getReturnRequests(params = {}) {
    const response = await client.get('/orders/return-requests', { params });
    return unwrapApiData(response);
  },
  async getReturnRequestDetails(id) {
    const response = await client.get(`/orders/${id}/return-request`);
    return unwrapApiData(response);
  },
  // ===== Returns & Exchanges - Phase 2C: سير عمل الاسترجاع بعد الموافقة =====
  async updateReturnStatus(id, status, note) {
    const payload = {};
    if (status) payload.status = status;
    if (note) payload.note = note;
    const response = await client.put(`/orders/${id}/return-request/status`, payload);
    return unwrapApiData(response);
  },
  // ===== Returns & Exchanges - Phase 2C: تحويل فلوس الاسترجاع (انستا باي/محفظة) =====
  async updateReturnRefund(id, { amount, method, reference, transferred } = {}) {
    const payload = {};
    if (amount !== undefined) payload.amount = amount;
    if (method !== undefined) payload.method = method;
    if (reference !== undefined) payload.reference = reference;
    if (transferred !== undefined) payload.transferred = transferred;
    const response = await client.put(`/orders/${id}/return-request/refund`, payload);
    return unwrapApiData(response);
  },
  // ===== معاينة المنتج المرتجع بعد وصوله فعليًا - هي اللي بتقرر رجوع المخزون =====
  async inspectReturnRequest(id, { result, note } = {}) {
    const payload = { result };
    if (note) payload.note = note;
    const response = await client.put(`/orders/${id}/return-request/inspect`, payload);
    return unwrapApiData(response);
  },
};

export const exchangeAPI = {
  async getMine() {
    const response = await client.get('/exchange-requests/mine');
    return unwrapApiData(response);
  },
  async getAll(params = {}) {
    const response = await client.get('/exchange-requests', { params });
    return unwrapApiData(response);
  },
  async getById(id) {
    const response = await client.get(`/exchange-requests/${id}`);
    return unwrapApiData(response);
  },
  async review(id, { action, adminNote, reasonCode } = {}) {
    const payload = { action };
    if (adminNote) payload.adminNote = adminNote;
    if (reasonCode) payload.reasonCode = reasonCode;
    const response = await client.put(`/exchange-requests/${id}/review`, payload);
    return unwrapApiData(response);
  },
  async updateStatus(id, status, note) {
    const payload = {};
    if (status) payload.status = status;
    if (note) payload.note = note;
    const response = await client.put(`/exchange-requests/${id}/status`, payload);
    return unwrapApiData(response);
  },
  // ===== رقم تتبع شحنة الاستبدال - يدوي بواسطة الأدمن (زي updateShipping بتاع الاسترجاع) =====
  // provider اختياري - لو مبعتش، الباك اند بياخد shippingCompany بتاع الأوردر
  // الأصلي كافتراضي (شوف updateExchangeStatus في exchangeController.js).
  async updateTracking(id, trackingNumber, provider) {
    const payload = { trackingNumber };
    if (provider) payload.provider = provider;
    const response = await client.put(`/exchange-requests/${id}/status`, payload);
    return unwrapApiData(response);
  },
  // ===== Bosta Return/Exchange Integration: زرار "مزامنة التتبع الآن" =====
  // بيرجع 400 بـ code:'MANUAL_TRACKING_ONLY' لو الشركة مش بتدعم تتبع آلي -
  // الفرونت لازم يعرض "تحديث يدوي فقط" بدل ما يفضل يحاول يعيد المحاولة.
  async syncTracking(id) {
    const response = await client.post(`/exchange-requests/${id}/sync-tracking`);
    return unwrapApiData(response);
  },
  async cancel(id) {
    const response = await client.put(`/exchange-requests/${id}/cancel`);
    return unwrapApiData(response);
  },
  // ===== Returns & Exchanges - Phase 2C: تحويل فلوس الاستبدال (رسوم من العميل أو فرق سعر للعميل) =====
  async updateMoney(id, { direction, amount, method, reference, transferred } = {}) {
    const payload = {};
    if (direction !== undefined) payload.direction = direction;
    if (amount !== undefined) payload.amount = amount;
    if (method !== undefined) payload.method = method;
    if (reference !== undefined) payload.reference = reference;
    if (transferred !== undefined) payload.transferred = transferred;
    const response = await client.put(`/exchange-requests/${id}/money`, payload);
    return unwrapApiData(response);
  },
  // ===== معاينة الفاريانت القديم بعد وصوله فعليًا - هي اللي بتقرر رجوع المخزون =====
  async inspect(id, { result, note } = {}) {
    const payload = { result };
    if (note) payload.note = note;
    const response = await client.put(`/exchange-requests/${id}/inspect`, payload);
    return unwrapApiData(response);
  },
};
export const abandonedCartAPI = {
  async upsert(payload) {
    try {
      const response = await client.post('/abandoned-carts', payload);
      return unwrapApiData(response);
    } catch (e) {
      // silent fail - مش لازم تأثر على تجربة العميل
      return null;
    }
  },
  async markRecovered(sessionId) {
    try {
      const response = await client.put('/abandoned-carts/recover', { sessionId });
      return unwrapApiData(response);
    } catch (e) {
      return null;
    }
  },
  async getAll(params = {}) {
    const response = await client.get('/abandoned-carts', { params });
    return unwrapApiData(response);
  },
  // ===== إحصائيات (إيراد مفقود/مسترجَع/نسبة استرجاع) على كل السلات المطابقة
  // بدون سقف صفحة - بديل عن حسابها من قايمة abandonedCarts المُصفّحة =====
  async getStats() {
    const response = await client.get('/abandoned-carts/stats');
    return unwrapApiData(response);
  },
};

export const ordersLoyaltyAPI = {
  async getLoyaltyInfo() {
    const response = await client.get('/orders/loyalty-info');
    return unwrapApiData(response);
  },
};
export const guestOrdersAPI = {
  // ============================================================
  // ===== استرجاع/استبدال بدون تسجيل دخول (تحقق برقم الأوردر + رقم الهاتف) =====
  // نفس بالظبط orders/exchange-requests بتاعة العميل المسجّل (server-side)،
  // بس من غير أي auth - شوف controllers/guestOrderController.js.
  // ============================================================
  async lookup(orderNumber, phone) {
    const response = await client.post('/orders/guest/lookup', { orderNumber, phone });
    return unwrapApiData(response);
  },
  async getReturnReasons() {
    const response = await client.get('/orders/guest/return-reasons');
    return unwrapApiData(response);
  },
  async getExchangeReasons() {
    const response = await client.get('/orders/guest/exchange-reasons');
    return unwrapApiData(response);
  },
  async getReturnEligibility(orderNumber, phone, reasonCode) {
    const response = await client.get('/orders/guest/return-eligibility', { params: { orderNumber, phone, reasonCode } });
    return unwrapApiData(response);
  },
  async getExchangeEligibility(orderNumber, phone, reasonCode) {
    const response = await client.get('/orders/guest/exchange-eligibility', { params: { orderNumber, phone, reasonCode } });
    return unwrapApiData(response);
  },
  async uploadEvidenceImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await client.post('/orders/guest/evidence-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapApiData(response);
  },
  async requestReturn(orderNumber, phone, { items, reason, reasonCode, evidenceImages } = {}) {
    const response = await client.post('/orders/guest/return-request', { orderNumber, phone, items, reason, reasonCode, evidenceImages });
    return unwrapApiData(response);
  },
  async requestExchange(orderNumber, phone, { items, reasonCode, customerNote, evidenceImages } = {}) {
    const response = await client.post('/orders/guest/exchange-request', { orderNumber, phone, items, reasonCode, customerNote, evidenceImages });
    return unwrapApiData(response);
  },
};