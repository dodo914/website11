const Settings = require('../models/Settings');

// ===== كاش بسيط للإعدادات (اسم الموقع/السوشيال/الرقم/الإيميل/الثيم) لمدة دقيقة =====
// عشان مانضربش الداتا بيز في كل رسالة، وفي نفس الوقت أي تغيير من الأدمن
// (تغيير اسم الموقع، لينك سوشيال ميديا، رقم، إيميل، لون الثيم...) بيتحدث خلال دقيقة كحد أقصى.
let cachedSettings = null;
let cachedAt = 0;
const SETTINGS_CACHE_MS = 60 * 1000;

const SETTINGS_SELECT = 'storeName phone whatsapp email socialFacebook socialInstagram socialTiktok socialYoutube socialLinkedin socialSnapchat socialFacebookEnabled socialInstagramEnabled socialTiktokEnabled socialYoutubeEnabled socialLinkedinEnabled socialSnapchatEnabled activeTheme customTheme';

async function getEmailBrandSettings() {
  const now = Date.now();
  if (cachedSettings && now - cachedAt < SETTINGS_CACHE_MS) return cachedSettings;
  const settings = await Settings.findOne().select(SETTINGS_SELECT).lean();
  cachedSettings = settings || {};
  cachedAt = now;
  return cachedSettings;
}

// بيتنادى من أي مكان بيغيّر الإعدادات دي عشان الرسالة الجاية تطلع محدثة على طول
// من غير ما تستنى دقيقة الكاش.
function invalidateEmailBrandCache() {
  cachedSettings = null;
  cachedAt = 0;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

// ===== نفس ألوان الثيمات الجاهزة الموجودة في الفرونت (client_build/src/themes.js) =====
// لو المتجر شغال على ثيم جاهز (مش كستم)، نجيب لون البراند بتاعه من هنا
// عشان الإيميل يطلع بنفس ألوان الموقع بالظبط.
const THEME_PRESET_COLORS = {
  classic: { primary: '#000000', primaryFg: '#ffffff', footerBg: '#111827', footerFg: '#ffffff' },
  luxe: { primary: '#c9a96e', primaryFg: '#1a1a2e', footerBg: '#0a0a12', footerFg: '#e8d5b7' },
  street: { primary: '#ff3c00', primaryFg: '#ffffff', footerBg: '#1a1a1a', footerFg: '#f5f5f5' },
  minimal: { primary: '#be185d', primaryFg: '#ffffff', footerBg: '#fdf2f8', footerFg: '#831843' },
  retro: { primary: '#92400e', primaryFg: '#fef3c7', footerBg: '#451a03', footerFg: '#fef3c7' },
};

// أيقونات حقيقية (لوجو كل منصة بلونها الرسمي) بدل الإيموجي
const SOCIAL_ICON_COLORS = {
  facebook: '1877F2',
  instagram: 'E4405F',
  tiktok: '000000',
  youtube: 'FF0000',
  linkedin: '0A66C2',
  snapchat: 'FFFC00',
};

function socialIconUrl(key) {
  return `https://cdn.simpleicons.org/${key}/${SOCIAL_ICON_COLORS[key]}`;
}

// بيحدد ألوان البراند (اللي بتتلوّن بيها هيدر اسم الموقع + الفوتر) حسب ثيم المتجر:
// لو فيه ثيم كستم متحفوظ بيستخدمه، ولو لأ بيجيب ألوان الثيم الجاهز المفعّل حاليًا.
function resolveBrandColors(settings) {
  const custom = settings?.customTheme?.colors;
  if (custom && custom.primary) {
    return {
      primary: custom.primary || THEME_PRESET_COLORS.classic.primary,
      primaryFg: custom.primaryFg || '#ffffff',
      footerBg: custom.footerBg || custom.primary || THEME_PRESET_COLORS.classic.footerBg,
      footerFg: custom.footerFg || '#ffffff',
    };
  }
  return THEME_PRESET_COLORS[settings?.activeTheme] || THEME_PRESET_COLORS.classic;
}

// ===== يبني هيدر (اسم الموقع) وفوتر (سوشيال ميديا + رقم + إيميل) حوالين أي محتوى =====
// كل القيم جاية لايف من Settings في الداتا بيز، فأي تعديل من الأدمن بيبان في
// الرسالة الجاية على طول (خلال دقيقة كحد أقصى بسبب الكاش البسيط فوق)، بما فيها لون
// الموقع نفسه (هيدر اسم الموقع + الفوتر بياخدوا نفس لون ثيم المتجر أوتوماتيك).
function wrapEmailHtml(innerHtml, settings) {
  const s = settings || {};
  const storeName = s.storeName?.ar || s.storeName?.en || 'المتجر';
  const brand = resolveBrandColors(s);

  const socialLinks = [
    s.socialFacebookEnabled && s.socialFacebook && { key: 'facebook', label: 'فيسبوك', url: s.socialFacebook },
    s.socialInstagramEnabled && s.socialInstagram && { key: 'instagram', label: 'انستجرام', url: s.socialInstagram },
    s.socialTiktokEnabled && s.socialTiktok && { key: 'tiktok', label: 'تيك توك', url: s.socialTiktok },
    s.socialYoutubeEnabled && s.socialYoutube && { key: 'youtube', label: 'يوتيوب', url: s.socialYoutube },
    s.socialLinkedinEnabled && s.socialLinkedin && { key: 'linkedin', label: 'لينكدإن', url: s.socialLinkedin },
    s.socialSnapchatEnabled && s.socialSnapchat && { key: 'snapchat', label: 'سناب شات', url: s.socialSnapchat },
  ].filter(Boolean);

  const socialsHtml = socialLinks
    .map((l) => `
      <a href="${escapeHtml(l.url)}" title="${l.label}" style="display:inline-block;margin:0 6px 10px;text-decoration:none;vertical-align:middle">
        <span style="display:inline-block;width:38px;height:38px;line-height:38px;border-radius:50%;background:rgba(255,255,255,0.12);text-align:center">
          <img src="${socialIconUrl(l.key)}" width="18" height="18" alt="${l.label}" style="vertical-align:middle;border:0;display:inline-block" />
        </span>
      </a>`)
    .join('');

  const contactBits = [
    s.phone && `<span style="white-space:nowrap">📞 <span dir="ltr">${escapeHtml(s.phone)}</span></span>`,
    s.email && `<span style="white-space:nowrap">✉️ ${escapeHtml(s.email)}</span>`,
  ].filter(Boolean).join('&nbsp;&nbsp;|&nbsp;&nbsp;');

  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px">
    <div style="text-align:center;padding:22px 16px;background:${brand.primary};border-radius:14px 14px 0 0">
      <div style="font-size:24px;font-weight:800;color:${brand.primaryFg};letter-spacing:.5px">${escapeHtml(storeName)}</div>
    </div>
    <div style="background:#ffffff;padding:24px 4px">
      ${innerHtml}
    </div>
    <div style="text-align:center;padding:26px 16px 22px;background:${brand.footerBg};color:${brand.footerFg};border-radius:0 0 14px 14px">
      ${socialsHtml ? `<div style="margin-bottom:14px">${socialsHtml}</div>` : ''}
      ${contactBits ? `<div style="margin-bottom:10px;font-size:13px;opacity:.9">${contactBits}</div>` : ''}
      <div style="height:1px;background:rgba(255,255,255,0.15);margin:0 auto 12px;max-width:420px"></div>
      <div style="font-size:12px;opacity:.75">© ${new Date().getFullYear()} ${escapeHtml(storeName)}</div>
    </div>
  </div>
</body></html>`;
}

module.exports = { getEmailBrandSettings, invalidateEmailBrandCache, wrapEmailHtml, escapeHtml };