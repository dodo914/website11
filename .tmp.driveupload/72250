import axios from 'axios';

export const unwrapApiData = (response) => {
  const payload = response?.data ?? response ?? {};

  if (payload && typeof payload === 'object') {
    if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
      if (payload.data !== undefined) {
        return payload.data;
      }
      if (
        Object.prototype.hasOwnProperty.call(payload, 'success') ||
        Object.prototype.hasOwnProperty.call(payload, 'ok')
      ) {
        return payload;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(payload, 'ok') &&
      payload.ok === true &&
      payload.data !== undefined
    ) {
      return payload.data;
    }
  }

  return payload;
};

// رابط السيرفر
// محلياً أو عند استخدام Cloudflare Tunnel:
// VITE_API_URL=/api
//
// ويمكن تغييره في ملف .env الخاص بالفرونت إذا احتجت API مختلف.
const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  // JWT بقى في HttpOnly Cookie بدل localStorage،
  // فلازم كل request يبعت الكوكيز للسيرفر.
  withCredentials: true,
});

// بيقرأ قيمة كوكي CSRF القابلة للقراءة من JavaScript
const readCsrfCookie = () => {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(/(?:^|;\s*)lava_csrf=([^;]+)/);

  return match ? decodeURIComponent(match[1]) : null;
};

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

// بيحط CSRF token تلقائياً في كل request بيغيّر بيانات
// (double-submit cookie pattern).
client.interceptors.request.use((config) => {
  const method = String(config.method || '').toLowerCase();

  if (MUTATING_METHODS.has(method)) {
    const csrfToken = readCsrfCookie();

    if (csrfToken) {
      config.headers['x-csrf-token'] = csrfToken;
    }
  }

  return config;
});

// معالج الأخطاء العام
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const backendMessage =
      error.response?.data?.message ||
      error.message ||
      'Unknown request error';

    const normalizedError = new Error(backendMessage);

    normalizedError.status = error.response?.status;
    normalizedError.response = error.response;
    normalizedError.code = error.code;

    if (error.code === 'ECONNREFUSED') {
      normalizedError.message =
        'لا يمكن الاتصال بالسيرفر. تأكد من أن السيرفر يعمل.';
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      normalizedError.message =
        'انتهت مهلة الاتصال. حاول مرة أخرى.';
    }

    // ملحوظة إصلاح: كان بيستبدل أي رسالة خطأ من السيرفر بـ"الطلب غير موجود
    // على السيرفر" لمجرد إن الكود 404، حتى لو السيرفر بعت رسالة حقيقية
    // ومفيدة (زي أخطاء شركات الشحن Bosta/Aramex/DHL اللي بترجع 404 برسالة
    // واضحة). ده كان بيضيّع سبب الخطأ الحقيقي. دلوقتي بنستخدم الرسالة العامة
    // بس لو السيرفر مبعتش رسالة مفيدة أصلاً.
    if (error.response?.status === 404 && !error.response?.data?.message) {
      normalizedError.message =
        'الطلب غير موجود على السيرفر.';
    }

    if (error.response?.status === 500) {
      normalizedError.message =
        backendMessage ||
        'حصل خطأ في السيرفر. حاول مرة أخرى لاحقاً.';
    }

    if (error.response?.status === 429) {
      normalizedError.message =
        'تم إرسال طلبات كثيرة. انتظر قليلاً وحاول مرة أخرى.';
    }

    return Promise.reject(normalizedError);
  }
);

export default client;