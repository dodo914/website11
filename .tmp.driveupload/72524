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


export default function PaymentCompletePage(props) {
  const { currentPage, goTo, kashierPaymentOrderId, kashierPaymentStatus, recheckPaymentStatus, t } = props;
  return (
    <section className="py-20 px-6 md:px-12 max-w-2xl mx-auto text-center fade-in">
            <div className="bg-[var(--lava-card)] p-8 rounded-xl shadow-lg">
              <div className="text-6xl mb-6">{kashierPaymentStatus === 'paid' ? '✅' : kashierPaymentStatus === 'failed' ? '❌' : kashierPaymentStatus === 'timeout' ? '🔄' : '⏳'}</div>
              <h2 className="text-3xl font-bold mb-4">
                {kashierPaymentStatus === 'paid'
                  ? t('تم الدفع بنجاح!', 'Payment successful!')
                  : kashierPaymentStatus === 'failed'
                    ? t('لم يتم إتمام الدفع', 'Payment was not completed')
                    : kashierPaymentStatus === 'timeout'
                      ? t('لسه بنستنى تأكيد الدفع', 'Still waiting for payment confirmation')
                      : t('بنتحقق من حالة الدفع...', 'Checking payment status...')}
              </h2>
              <p className="text-[var(--lava-muted)] text-lg mb-4">
                {kashierPaymentStatus === 'paid'
                  ? t('تم تأكيد الدفع الإلكتروني وسيتم تجهيز طلبك.', 'Your online payment was confirmed and your order will be processed.')
                  : kashierPaymentStatus === 'failed'
                    ? t('لو حابب، تقدر ترجع للتشيك اوت وتحاول مرة تانية.', 'You can return to checkout and try again.')
                    : kashierPaymentStatus === 'timeout'
                      ? t('ده مش معناه إن الدفع فشل — ممكن يكون التأكيد لسه في الطريق. اضغط "تحقق الآن" أو راجع طلباتك بعد شوية.', 'This doesn\'t mean the payment failed — confirmation may still be on its way. Press "Check now" or check your orders again shortly.')
                    : t('قد يستغرق تأكيد الدفع بضع ثوانٍ.', 'Payment confirmation may take a few seconds.')}
              </p>
              {kashierPaymentOrderId && (
                <div className="bg-[var(--lava-secondary)] p-4 rounded-lg mb-6">
                  <p className="text-sm text-[var(--lava-muted)]">{t('رقم الطلب', 'Order Number')}</p>
                  <p className="text-2xl font-bold text-[var(--lava-text)]">#{kashierPaymentOrderId}</p>
                </div>
              )}
              {kashierPaymentStatus === 'timeout' && (
                <button onClick={recheckPaymentStatus} className="bg-black text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-800 transition mb-3 mx-2">
                  {t('تحقق الآن', 'Check now')} 🔄
                </button>
              )}
              {(kashierPaymentStatus === 'paid' || kashierPaymentStatus === 'failed' || kashierPaymentStatus === 'timeout') && (
                <button onClick={() => goTo(kashierPaymentStatus === 'paid' ? 'home' : (kashierPaymentStatus === 'timeout' ? 'my-orders' : 'checkout-details'))} className="bg-black text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-800 transition mx-2">
                  {kashierPaymentStatus === 'paid' ? t('العودة للتسوق', 'Back to Shopping') : kashierPaymentStatus === 'timeout' ? t('طلباتي', 'My Orders') : t('العودة للدفع', 'Back to Checkout')} 🛍️
                </button>
              )}
            </div>
          </section>
  );
}