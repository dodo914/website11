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


export default function OrderConfirmationPage(props) {
  const { currentPage, goTo, lastOrderId, lastOrderNumber, lastOrderPaymentMethod, t } = props;
  return (
    <section className="py-20 px-6 md:px-12 max-w-2xl mx-auto text-center fade-in">
            <div className="bg-[var(--lava-card)] p-8 rounded-xl shadow-lg">
              <div className="text-green-500 text-6xl mb-6">{lastOrderPaymentMethod === 'wallet' ? '⏳' : '✅'}</div>
              <h2 className="text-3xl font-bold mb-4">
                {lastOrderPaymentMethod === 'wallet'
                  ? t('تم استلام طلبك!', 'Your order has been received!')
                  : t('تم تأكيد طلبك بنجاح!', 'Order confirmed successfully!')}
              </h2>
              <p className="text-[var(--lava-muted)] text-lg mb-4">
                {lastOrderPaymentMethod === 'wallet'
                  ? t('طلبك دلوقتي بانتظار تأكيد استلام التحويل. هيتأكد الطلب وتقدر تتابع حالته من صفحة طلباتي.', 'Your order is now pending confirmation of the wallet transfer. We will confirm it shortly and you can track its status from My Orders.')
                  : t('شكراً لتسوقك معنا. سنقوم بمعالجة طلبك في أقرب وقت.', 'Thank you for shopping with us. We will process your order shortly.')}
              </p>
              <div className="bg-[var(--lava-secondary)] p-4 rounded-lg mb-6">
                <p className="text-sm text-[var(--lava-muted)]">{t('رقم الطلب', 'Order Number')}</p>
                <p className="text-2xl font-bold text-[var(--lava-text)]">#{lastOrderNumber || lastOrderId || '----'}</p>
              </div>
              <p className="text-sm text-[var(--lava-muted)] mb-8">{t('تم إرسال تفاصيل الطلب إلى بريدك الإلكتروني', 'Order details have been sent to your email.')}</p>
              <button
                onClick={() => goTo('home')}
                className="bg-black text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-800 transition"
              >
                {t('العودة للتسوق', 'Back to Shopping')} 🛍️
              </button>
            </div>
          </section>
  );
}