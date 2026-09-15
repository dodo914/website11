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


export default function AccountPage(props) {
  const { currentPage, editAccountData, goTo, handleLogout, isEditingAccount, language, setEditAccountData, setIsEditingAccount, setUser, showToast, t, user } = props;
  return (
    <section className={`py-16 px-6 md:px-12 max-w-4xl mx-auto ${language === 'ar' ? 'text-right' : 'text-left'} fade-in`}>
            <h1 className="text-3xl font-bold mb-6">{t('حسابي الشخصي', 'My Account')}</h1>
            <div className="bg-[var(--lava-card)] p-6 rounded-xl shadow-md mb-8">
              <div className={`flex justify-between items-center mb-4 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
                <h2 className="text-xl font-bold">{t('بيانات الحساب', 'Account Details')}</h2>
                {!isEditingAccount && (
                  <button onClick={() => setIsEditingAccount(true)} className="text-blue-600 font-bold hover:underline">{t('تعديل البيانات', 'Edit')}</button>
                )}
              </div>

              {isEditingAccount ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  setUser({...user, ...editAccountData});
                  setIsEditingAccount(false);
                  showToast(t('تم تحديث بيانات الحساب بنجاح!', 'Account updated successfully!'));
                }} className="space-y-4">
                  <InputField label={t('الاسم', 'Name')} value={editAccountData.name} onChange={e => setEditAccountData({...editAccountData, name: e.target.value})} required={true} id="editName" />
                  <InputField label={t('البريد الإلكتروني', 'Email')} type="email" value={editAccountData.email} onChange={e => setEditAccountData({...editAccountData, email: e.target.value})} required={true} id="editEmail" />
                  <InputField label={t('رقم الهاتف', 'Phone')} type="tel" value={editAccountData.phone} onChange={e => setEditAccountData({...editAccountData, phone: e.target.value})} required={true} id="editPhone" />
                  <div className="flex gap-4 pt-4">
                    <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold">{t('حفظ التغييرات', 'Save Changes')}</button>
                    <button type="button" onClick={() => setIsEditingAccount(false)} className="px-6 py-2 rounded-lg font-bold border">{t('إلغاء', 'Cancel')}</button>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="mb-2"><strong>{t('الاسم:', 'Name:')}</strong> {user.name}</p>
                  <p className="mb-2"><strong>{t('البريد الإلكتروني:', 'Email:')}</strong> {user.email}</p>
                  <p className="mb-2"><strong>{t('رقم الهاتف:', 'Phone:')}</strong> {user.phone}</p>
                  {user.savedShipping && (
                    <div className="mt-6 pt-4 border-t">
                      <h3 className="font-bold mb-2 text-green-700">✅ {t('بيانات الشحن المحفوظة', 'Saved Shipping Info')}</h3>
                      <p className="text-sm text-[var(--lava-muted)] mb-1">{user.savedShipping.fullName}</p>
                      <p className="text-sm text-[var(--lava-muted)] mb-1">{user.savedShipping.phone}</p>
                      <p className="text-sm text-[var(--lava-muted)]">{user.savedShipping.address}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ===== موافقة الماركتنج - زي Shopify: العميل يقدر يوقف/يشغّل استلام إيميلات العروض من هنا ===== */}
            <div className="bg-[var(--lava-card)] p-6 rounded-xl shadow-md mb-8 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold mb-1">📧 {t('إيميلات العروض والتسويق', 'Marketing Emails')}</h2>
                <p className="text-sm text-[var(--lava-muted)]">{t('استلام عروض وأخبار عن المنتجات على إيميلك', 'Receive product offers and news by email')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={user.marketingConsent !== false}
                  onChange={async (e) => {
                    const nextValue = e.target.checked;
                    try {
                      const updatedUser = await authAPI.updateMarketingConsent(nextValue);
                      setUser(updatedUser);
                      showToast(nextValue ? t('تم تفعيل استلام إيميلات العروض', 'Marketing emails enabled') : t('تم إلغاء استلام إيميلات العروض', 'Marketing emails disabled'));
                    } catch (err) {
                      showToast(err?.response?.data?.message || err?.message || t('حصل خطأ أثناء حفظ الإعداد', 'Something went wrong saving this setting'));
                    }
                  }}
                />
                <div className="w-11 h-6 bg-[var(--lava-border)] rounded-full peer peer-checked:bg-black transition-colors"></div>
                <div className="absolute top-0.5 start-0.5 bg-[var(--lava-card)] w-5 h-5 rounded-full transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5"></div>
              </label>
            </div>

            <button
              onClick={() => goTo('my-orders')}
              className="w-full bg-[var(--lava-card)] p-6 rounded-xl shadow-md flex items-center justify-between hover:shadow-lg transition text-start"
            >
              <span className="font-bold text-lg">📦 {t('طلباتي', 'My Orders')}</span>
              <span className="text-[var(--lava-muted)]">{language === 'ar' ? '←' : '→'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full bg-[var(--lava-card)] p-6 rounded-xl shadow-md flex items-center justify-between hover:shadow-lg transition text-start mt-4 text-red-600"
            >
              <span className="font-bold text-lg">🚪 {t('تسجيل الخروج', 'Logout')}</span>
              <span className="text-[var(--lava-muted)]">{language === 'ar' ? '←' : '→'}</span>
            </button>
          </section>
  );
}