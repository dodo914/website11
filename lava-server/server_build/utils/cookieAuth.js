// إدارة الـ Cookies الخاصة بالـ Authentication (JWT + CSRF)
// JWT اتخزن في Cookie من نوع HttpOnly عشان الـ JavaScript في المتصفح مايقدرش يقراه (بيحمي من XSS).
// CSRF token اتخزن في Cookie تانية قابلة للقراءة من الـ JS عشان نطبق نمط Double-Submit Cookie.

const crypto = require('crypto');

const AUTH_COOKIE_NAME = 'lava_jwt';
const CSRF_COOKIE_NAME = 'lava_csrf';

// يحسب مدة الكوكي بالـ ms من نفس القيمة المستخدمة في JWT_EXPIRES_IN (زي '7d', '12h', إلخ)
const parseDurationToMs = (value, fallbackMs) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d+)\s*(d|h|m|s)?$/i);
  if (!match) return fallbackMs;
  const amount = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return amount * (unitMs[unit] || unitMs.s);
};

const getAuthCookieMaxAgeMs = () => parseDurationToMs(process.env.JWT_EXPIRES_IN || '7d', 7 * 24 * 60 * 60 * 1000);

const isProduction = () => process.env.NODE_ENV === 'production';

// إعدادات الكوكي الأساسية (مشتركة بين JWT و CSRF)
const baseCookieOptions = () => ({
  secure: isProduction(),
  sameSite: isProduction() ? 'lax' : 'lax',
  path: '/',
});

const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: getAuthCookieMaxAgeMs(),
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...baseCookieOptions(),
    httpOnly: true,
  });
};

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

// الكوكي دي لازم تبقى قابلة للقراءة من الفرونت (مش HttpOnly) عشان يرسلها كـ Header
const setCsrfCookie = (res) => {
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge: getAuthCookieMaxAgeMs(),
  });
  return csrfToken;
};

const clearCsrfCookie = (res) => {
  res.clearCookie(CSRF_COOKIE_NAME, {
    ...baseCookieOptions(),
    httpOnly: false,
  });
};

module.exports = {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  setCsrfCookie,
  clearCsrfCookie,
};
