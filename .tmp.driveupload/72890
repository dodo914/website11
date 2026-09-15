// ============================================================
// CookieConsentBanner.jsx — بانر موافقة الكوكيز
// ------------------------------------------------------------
// بيظهر بس لو فيه بيكسل تتبّع واحد على الأقل متفعّل (Meta/TikTok/
// Google/Snapchat) — لو صاحب المتجر معملش تفعيل لأي بيكسل، مفيش
// سكريبت تتبّع بيتحمّل أصلاً (شوف usePixels.js) فمفيش داعي نزعج
// الزائر ببانر مالوش لازمة.
//
// القرار (قبول/رفض) بيتخزّن في localStorage وبيتحدد بيه هل
// pixelIds اللي بيوصل لـ usePixels() فعلي ولا فاضي — يعني الرفض
// بيمنع تحميل السكريبتات فعليًا، مش بس بيخفي البانر.
// ============================================================

import { useEffect, useState } from 'react';

export const COOKIE_CONSENT_KEY = 'lava_cookie_consent'; // 'accepted' | 'declined'

export function getStoredCookieConsent() {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch (_) {
    return null;
  }
}

export default function CookieConsentBanner({ hasAnyPixel, consent, onDecide, language = 'ar' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // بنستنى تحميل الإعدادات (hasAnyPixel) قبل ما نقرر نبان أو لأ.
    if (hasAnyPixel && !consent) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [hasAnyPixel, consent]);

  if (!visible) return null;

  const t = (ar, en) => (language === 'ar' ? ar : en);

  const decide = (value) => {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
    } catch (_) { /* localStorage غير متاح — القرار هيتسأل تاني المرة الجاية، مش خطأ فادح */ }
    onDecide?.(value);
    setVisible(false);
  };

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="fixed bottom-0 inset-x-0 z-[9999] p-3 md:p-4"
      role="dialog"
      aria-live="polite"
      aria-label={t('إشعار الكوكيز', 'Cookie notice')}
    >
      <div className="max-w-3xl mx-auto bg-[var(--lava-card,#111)] text-[var(--lava-text,#fff)] border border-[var(--lava-border,#333)] rounded-2xl shadow-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
        <p className="text-sm leading-relaxed flex-1">
          {t(
            'بنستخدم كوكيز لتحسين تجربتك وقياس أداء الإعلانات على الموقع. تقدر توافق أو ترفض في أي وقت.',
            'We use cookies to improve your experience and measure ad performance on this site. You can accept or decline anytime.'
          )}
        </p>
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => decide('declined')}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold bg-transparent border border-[var(--lava-border,#444)] hover:bg-white/5 transition"
          >
            {t('رفض', 'Decline')}
          </button>
          <button
            type="button"
            onClick={() => decide('accepted')}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold bg-white text-black hover:opacity-90 transition"
          >
            {t('موافق', 'Accept')}
          </button>
        </div>
      </div>
    </div>
  );
}