import React, { useState, useEffect, useLayoutEffect, memo, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import { usePixels } from '../usePixels';
import { authAPI } from '../api/auth';
import { productsAPI } from '../api/products';
import { ordersAPI, abandonedCartAPI, exchangeAPI } from '../api/orders';
import { trafficAPI } from '../api/traffic';
import { staffAPI } from '../api/staff';
import { customersAPI } from '../api/customers';
import { settingsAPI } from '../api/settings';
import { paymentsAPI } from '../api/payments';
import { shippingAPI } from '../api/shipping';
import { activityLogsAPI } from '../api/activityLogs';
import { THEMES, THEME_LIST, getTheme, DEFAULT_THEME_ID, PRESETS, FONT_OPTIONS, DEFAULT_FONT_ID, getFontOption } from '../themes';
import ErrorBoundary from '../components/ErrorBoundary';

// ===== [Lazy Loading] الصفحات/المكونات دي مش لازمة إلا لما الزائر يدخل عليها
// فعلاً (صفحة استرجاع/استبدال الضيوف، أداة بناء الثيمات في الأدمن، وصفحة
// التواصل) - React.lazy بيخليها تتحمّل في chunk منفصل بس وقت الحاجة، مش مع
// كل صفحات الموقع من البداية. الـfallback البسيط ده بيظهر لحظة التحميل بس. =====
const ThemeBuilder = lazy(() => import('../components/ThemeBuilder'));
const GuestReturnExchangePage = lazy(() => import('../pages/GuestReturnExchangePage'));
const ContactPage = lazy(() => import('../pages/ContactPage'));

const PageLoadingFallback = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-10 h-10 border-4 border-[var(--lava-border)] border-t-black rounded-full animate-spin" />
  </div>
);


import { EGYPT_GOVERNORATES } from '../constants/governorates';
import { RETURN_REASONS, EXCHANGE_REASONS, EXCHANGE_STATUS_LABELS, EXCHANGE_WORKFLOW_ORDER } from '../constants/returnExchange';
import { EGYPT_PHONE_REGEX, isValidEgyptianPhone } from '../utils/egyptPhone';
import { WELCOME_OFFER_STORAGE_KEY, loadWelcomeOfferFromStorage, saveWelcomeOfferToStorage } from '../utils/welcomeOfferStorage';
import {
  CountdownTimer, LiveViewersBadge, InputField, SelectField, TextareaField,
  ImageUrlOrUploadField, VideoUploadField, MaskedKeyField, AdminPaginationBar,
} from '../components/SharedFields';


export default function ReturnsPolicyPage(props) {
  const { adminSettings, currentPage, getLocalized, language, t } = props;
  return (
    (() => {
          const policy = adminSettings.current.returnsPolicy || {};
          if (policy.enabled === false) {
            return (
              <section className="py-16 px-6 md:px-12 max-w-3xl mx-auto text-center fade-in">
                <p className="text-[var(--lava-muted)] text-lg">{t('هذه الصفحة غير متاحة حاليًا.', 'This page is currently unavailable.')}</p>
              </section>
            );
          }
          const fillTokens = (str) => String(str || '')
            .replaceAll('{{returnFee}}', String(adminSettings.current.returnFeeAmount ?? 0))
            .replaceAll('{{exchangeFee}}', String(adminSettings.current.exchangeFeeAmount ?? 0))
            .replaceAll('{{returnWindow}}', String(adminSettings.current.returnWindow ?? 0))
            .replaceAll('{{exchangeWindow}}', String(adminSettings.current.exchangeWindow ?? 0))
            .replaceAll('{{currency}}', t('ج.م', 'EGP'));
          const title = fillTokens(getLocalized(policy.title)) || t('الاسترجاع والاستبدال', 'Returns & Exchanges');
          const intro = fillTokens(getLocalized(policy.intro));
          const content = fillTokens(getLocalized(policy.content));
          return (
            <section className={`py-16 px-6 md:px-12 max-w-3xl mx-auto ${language === 'ar' ? 'text-right' : 'text-left'} fade-in`}>
              <h2 className="text-4xl font-bold mb-4 text-center">{title}</h2>
              {intro && <p className="text-[var(--lava-muted)] text-center mb-8 max-w-xl mx-auto">{intro}</p>}
              <div className="bg-[var(--lava-card)] p-6 md:p-8 rounded-lg shadow-md">
                <div className="whitespace-pre-line leading-8 text-[var(--lava-text)]">{content}</div>
                {policy.lastUpdated && (
                  <p className="text-xs text-[var(--lava-muted)] mt-8 pt-4 border-t">
                    {t('آخر تحديث:', 'Last updated:')} {new Date(policy.lastUpdated).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </p>
                )}
              </div>
            </section>
          );
        })()
  );
}