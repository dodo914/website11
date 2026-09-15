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


export default function CheckoutDetailsPage(props) {
  const { adminSettings, appliedDiscount, calculateCartTotals, cart, checkoutNotes, checkoutPaymentMethod, countries, currentPage, getLocalized, goTo, governorates, handleCheckoutSubmit, hasSavedShipping, isPlacingOrder, language, saveShippingInfo, selectedCountry, selectedGov, selectedShippingProvider, selectedWalletMethodId, setCheckoutNotes, setCheckoutPaymentMethod, setSaveShippingInfo, setSelectedCountry, setSelectedGov, setSelectedShippingProvider, setSelectedWalletMethodId, setShippingAddress, setShippingApartment, setShippingBuildingNumber, setShippingCity, setShippingDistrict, setShippingEmail, setShippingFloor, setShippingFullName, setShippingLandmark, setShippingPhone, setShippingPhone2, setShippingZipCode, setUseExistingAddress, setWalletScreenshotFile, setWalletScreenshotPreview, setWalletSenderPhone, setWalletTransferDate, shippingAddress, shippingApartment, shippingBuildingNumber, shippingCity, shippingCoverage, shippingDistrict, shippingEmail, shippingFloor, shippingFullName, shippingHasCandidates, shippingLandmark, shippingPhone, shippingPhone2, shippingProviders, shippingRates, shippingRatesLoading, shippingZipCode, t, useExistingAddress, user, walletScreenshotPreview, walletSenderPhone, walletTransferDate } = props;
  return (
    <section className={`py-16 px-6 md:px-12 max-w-6xl mx-auto ${language === 'ar' ? 'text-right' : 'text-left'} fade-in`}>
            <button
              onClick={() => goTo('checkout')}
              className={`mb-6 text-[var(--lava-muted)] hover:text-black font-semibold flex items-center gap-2 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}
            >
              {language === 'ar' ? '←' : '→'} {t('العودة إلى السلة', 'Back to cart')}
            </button>

            {cart.length === 0 ? (
              <div className="text-center py-12 bg-[var(--lava-card)] rounded-xl shadow-md">
                <p className="text-[var(--lava-muted)] text-lg mb-4">{t('عربة التسوق فارغة', 'Your cart is empty')}</p>
                <button
                  onClick={() => goTo('shop')}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition"
                >
                  {t('تسوق الآن', 'Shop Now')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 bg-[var(--lava-card)] p-8 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold mb-6 border-b pb-3">{t('بيانات الشحن والدفع', 'Shipping & Payment')}</h2>

                {user && hasSavedShipping && (
                  <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="useExisting"
                        checked={useExistingAddress}
                        onChange={(e) => {
                          setUseExistingAddress(e.target.checked);
                          if (e.target.checked && user.savedShipping) {
                            setShippingFullName(user.savedShipping.fullName || '');
                            setShippingPhone(user.savedShipping.phone || '');
                            setShippingPhone2(user.savedShipping.phone2 || '');
                            setShippingAddress(user.savedShipping.address || '');
                            setSelectedGov(user.savedShipping.governorate || '');
                            setSelectedCountry(user.savedShipping.country || '');
                            setShippingZipCode(user.savedShipping.zipCode || '');
                            // ===== Phase 2: استرجاع الحقول الإضافية لو محفوظة (fallback فاضي للحسابات القديمة) =====
                            setShippingEmail(user.savedShipping.email || '');
                            setShippingDistrict(user.savedShipping.district || '');
                            setShippingBuildingNumber(user.savedShipping.buildingNumber || '');
                            setShippingFloor(user.savedShipping.floor || '');
                            setShippingApartment(user.savedShipping.apartment || '');
                            setShippingLandmark(user.savedShipping.landmark || '');
                          }
                        }}
                        className="w-5 h-5"
                      />
                      <label htmlFor="useExisting" className="font-bold text-blue-700 cursor-pointer text-base">
                        {t('استخدام العنوان المسجل في حسابي', 'Use saved address')}
                      </label>
                    </div>
                    {user.savedShipping && (
                      <div className="mt-2 text-sm text-[var(--lava-muted)] me-8">
                        <p>📦 {user.savedShipping.fullName}</p>
                        <p>📞 {user.savedShipping.phone} {user.savedShipping.phone2 && `| ${user.savedShipping.phone2}`}</p>
                        <p>📍 {user.savedShipping.address}</p>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  {(!user || !useExistingAddress) && (
                    <>
                      <InputField label={t('الاسم بالكامل', 'Full Name')} type="text" value={shippingFullName} onChange={(e) => setShippingFullName(e.target.value)} placeholder={t('ادخل اسمك بالكامل', 'Enter your full name')} required={true} id="shippingFullName" />
                      <InputField label={t('رقم الهاتف', 'Phone')} type="tel" value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} placeholder={t('مثال: 01012345678', 'e.g. 01012345678')} required={true} id="shippingPhone" />
                      {adminSettings.current.showPhone2 && (
                        <InputField label={`${t('رقم هاتف إضافي', 'Additional phone')} ${!adminSettings.current.requiredPhone2 ? `(${t('اختياري', 'optional')})` : ''}`} type="tel" value={shippingPhone2} onChange={(e) => setShippingPhone2(e.target.value)} placeholder={t('رقم هاتف إضافي', 'Additional phone')} required={adminSettings.current.requiredPhone2} id="shippingPhone2" />
                      )}
                      {!user && (
                        <InputField
                          label={`${t('البريد الإلكتروني', 'Email')} (${t('اختياري', 'optional')})`}
                          type="email"
                          value={shippingEmail}
                          onChange={(e) => setShippingEmail(e.target.value)}
                          placeholder={t('example@email.com', 'example@email.com')}
                          id="shippingEmail"
                          hint={t(
                            'هنبعتلك تأكيد الطلب وتحديثات حالته على الإيميل ده',
                            "We'll send your order confirmation and status updates to this email"
                          )}
                        />
                      )}
                      {adminSettings.current.showCountry && (
                        <SelectField label={t('الدولة', 'Country')} value={selectedCountry} onChange={(e) => { setSelectedCountry(e.target.value); setSelectedGov(''); }} options={[{ value: '', label: t('-- اختر الدولة --', '-- Select Country --') }, ...countries.map(c => ({ value: getLocalized(c.name), label: getLocalized(c.name) }))]} required={true} id="selectedCountry" />
                      )}
                      {(() => {
                        const selectedCountryObj = countries.find(c => getLocalized(c.name) === selectedCountry);
                        const filteredGovs = selectedCountry && selectedCountryObj
                          ? governorates.filter(g => String(g.countryId) === String(selectedCountryObj.id))
                          : [];
                        // بنجمع محافظات شركات الشحن المتصلة (زي Bosta - shippingCoverage)
                        // مع القائمة القديمة (governorates) عشان الليستة تبقى شاملة،
                        // بس من غير سعر هنا - السعر بيبان بعد كده لما يختار شركة الشحن.
                        const govSource = selectedCountry
                          ? (Object.values(shippingCoverage).some(l => l.length) ? EGYPT_GOVERNORATES : filteredGovs.map(g => ({ ar: g.name.ar, en: g.name.en })))
                          : [];
                        return (
                          <SelectField
                            label={t('المحافظة', 'Governorate')}
                            value={selectedGov}
                            onChange={(e) => {
                              if (!selectedCountry) {
                                alert(t('الرجاء اختيار الدولة أولاً', 'Please select a country first'));
                                return;
                              }
                              setSelectedGov(e.target.value);
                            }}
                            options={[{ value: '', label: t('-- اختر المحافظة --', '-- Select Governorate --') }, ...govSource.map(g => ({ value: language === 'ar' ? g.ar : g.en, label: language === 'ar' ? g.ar : g.en }))]}
                            required={true}
                            id="selectedGov"
                          />
                        );
                      })()}
                      <InputField label={t('المدينة', 'City')} type="text" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} placeholder={t('اكتب اسم المدينة', 'Enter city name')} required={true} id="shippingCity" />
                      {/* ===== Phase 2: الحي / المنطقة - مطلوب لدقة تحديد العنوان (يُستخدم لاحقًا لربط شركات الشحن) ===== */}
                      <InputField label={t('الحي / المنطقة', 'District / Area')} type="text" value={shippingDistrict} onChange={(e) => setShippingDistrict(e.target.value)} placeholder={t('مثال: مدينة نصر، المعادي...', 'e.g. Nasr City, Maadi...')} required={true} id="shippingDistrict" />
                      <InputField label={t('العنوان التفصيلي', 'Detailed Address')} type="text" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder={t('الشارع، رقم العمارة، الشقة...', 'Street, building, apartment...')} required={true} id="shippingAddress" />
                      {/* ===== Phase 2: تفاصيل إضافية اختيارية - بتساعد شركة الشحن توصل بدقة أكتر، مش إجبارية ===== */}
                      <div className="grid grid-cols-3 gap-3">
                        <InputField label={`${t('رقم العمارة', 'Building No.')} (${t('اختياري', 'optional')})`} type="text" value={shippingBuildingNumber} onChange={(e) => setShippingBuildingNumber(e.target.value)} placeholder={t('مثال: 12', 'e.g. 12')} id="shippingBuildingNumber" />
                        <InputField label={`${t('الدور', 'Floor')} (${t('اختياري', 'optional')})`} type="text" value={shippingFloor} onChange={(e) => setShippingFloor(e.target.value)} placeholder={t('مثال: 3', 'e.g. 3')} id="shippingFloor" />
                        <InputField label={`${t('الشقة', 'Apartment')} (${t('اختياري', 'optional')})`} type="text" value={shippingApartment} onChange={(e) => setShippingApartment(e.target.value)} placeholder={t('مثال: 5', 'e.g. 5')} id="shippingApartment" />
                      </div>
                      <InputField label={`${t('علامة مميزة قريبة', 'Nearby Landmark')} (${t('اختياري', 'optional')})`} type="text" value={shippingLandmark} onChange={(e) => setShippingLandmark(e.target.value)} placeholder={t('مثال: بجوار صيدلية...', 'e.g. next to a pharmacy...')} id="shippingLandmark" />
                      {adminSettings.current.showZipCode && (
                        <InputField label={t('الرمز البريدي (ZIP Code)', 'ZIP Code')} type="text" value={shippingZipCode} onChange={(e) => setShippingZipCode(e.target.value)} placeholder={t('مثال: 12345', 'e.g. 12345')} id="shippingZipCode" />
                      )}
                    </>
                  )}

                  {adminSettings.current.showCheckoutNotes && (
                    <TextareaField label={t('ملاحظات إضافية (اختياري)', 'Additional notes (optional)')} value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} placeholder={t('اكتب أي ملاحظات إضافية هنا...', 'Write any additional notes...')} rows={3} id="checkoutNotes" />
                  )}

                  {/* ===== شركة الشحن - محطوطة هنا قبل "طريقة الدفع" على طول،
                      وبرّه بلوك "العنوان الجديد" اللي فوق عشان تفضل ظاهرة حتى لو
                      العميل مستخدم عنوانه المحفوظ (useExistingAddress). كانت قبل
                      كده جوا البلوك اللي بيختفي كله لما يفعّل "استخدام العنوان
                      المحفوظ"، فالعميل مكانش عنده أي طريقة يغيّر شركة الشحن في
                      الحالة دي. selectedGov بتتحدد برضو من العنوان المحفوظ (شوف
                      onChange بتاع checkbox "استخدام العنوان المحفوظ" فوق)،
                      فالشرط ده لسه شغال صح في الحالتين. ===== */}
                  {selectedGov && shippingHasCandidates && (() => {
                    // لو العميل على "الدفع عند الاستلام"، نستبعد شركات الشحن اللي
                    // مش بتدعم COD فعليًا (زي DHL حاليًا) من قائمة الاختيار خالص -
                    // مش مجرد تعطيل بصري، لأن اختيارها كان هيؤدي لشحنة "مدفوعة
                    // مقدمًا" عند الشركة من غير ما تحصّل فلوس من العميل فعليًا.
                    const visibleRates = shippingRates.filter(r => checkoutPaymentMethod !== 'cod' || shippingProviders[r.provider]?.capabilities?.supportsCOD !== false);
                    return (
                    <div>
                      <label className="block text-sm font-semibold mb-1">{t('شركة الشحن', 'Shipping company')}</label>
                      {shippingRatesLoading ? (
                        <div className="text-sm text-[var(--lava-muted)] border rounded-lg p-3">{t('جاري حساب أسعار الشحن...', 'Calculating shipping rates...')}</div>
                      ) : visibleRates.length === 1 ? (
                        // شركة شحن واحدة مفعّلة بس - تتختار أوتوماتيك، مفيش داعي نعرض اختيار.
                        <div className="flex items-center justify-between p-3 rounded-lg border border-black bg-[var(--lava-secondary)]">
                          <b>{visibleRates[0].name}</b>
                          <span className="font-bold">{Number(visibleRates[0].amount).toFixed(2)} {visibleRates[0].currency || 'EGP'}</span>
                        </div>
                      ) : visibleRates.length > 1 ? (
                        <div className="space-y-2">
                          {visibleRates.map(rate => (
                            <label key={rate.provider} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${selectedShippingProvider === rate.provider ? 'border-black' : 'border-[var(--lava-border)]'}`}>
                              <span className="flex items-center gap-2"><input type="radio" name="shippingProvider" checked={selectedShippingProvider === rate.provider} onChange={() => setSelectedShippingProvider(rate.provider)} /> <b>{rate.name}</b></span>
                              <span className="font-bold">{Number(rate.amount).toFixed(2)} {rate.currency || 'EGP'}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-[var(--lava-muted)] border rounded-lg p-3">
                          {checkoutPaymentMethod === 'cod' && shippingRates.length > 0
                            ? t('لا توجد شركة شحن تدعم الدفع عند الاستلام لهذه المحافظة - جرّب وسيلة دفع أخرى.', 'No shipping company here supports Cash on Delivery - try another payment method.')
                            : t('لا توجد شركة شحن متاحة لهذه المحافظة حاليًا.', 'No shipping company is available for this governorate yet.')}
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {(() => {
                    const paymentSettings = adminSettings.current.paymentSettings || { manualEnabled: true, codEnabled: true, kashierEnabled: false, paymobEnabled: false };
                    const codAvailable = paymentSettings.codEnabled !== false;
                    const enabledMethods = paymentSettings.manualEnabled
                      ? (adminSettings.current.paymentMethods || []).filter((m) => m.enabled)
                      : [];
                    const manualAvailable = paymentSettings.manualEnabled === true;
                    const kashierAvailable = paymentSettings.kashierEnabled === true;
                    const paymobAvailable = paymentSettings.paymobEnabled === true;
                    if (!codAvailable && !manualAvailable && !kashierAvailable && !paymobAvailable) return null;
                    const selectedMethod = enabledMethods.find((m) => m._id === selectedWalletMethodId);
                    return (
                      <div className="pt-4 border-t mt-2">
                        <label className="block font-semibold mb-2 text-sm">{t('طريقة الدفع', 'Payment Method')}</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          {codAvailable && (
                            <button
                              type="button"
                              onClick={() => { setCheckoutPaymentMethod('cod'); setSelectedWalletMethodId(null); }}
                              className={`px-4 py-3 rounded-lg border-2 font-bold text-sm transition ${checkoutPaymentMethod === 'cod' ? 'border-black bg-black text-white' : 'border-[var(--lava-border)] bg-[var(--lava-card)] text-[var(--lava-muted)]'}`}
                            >
                              💵 {t('الدفع عند الاستلام', 'Cash on Delivery')}
                            </button>
                          )}
                          {enabledMethods.map((method) => (
                            <button
                              key={method._id}
                              type="button"
                              onClick={() => { setCheckoutPaymentMethod('wallet'); setSelectedWalletMethodId(method._id); }}
                              className={`px-4 py-3 rounded-lg border-2 font-bold text-sm transition ${checkoutPaymentMethod === 'wallet' && selectedWalletMethodId === method._id ? 'border-black bg-black text-white' : 'border-[var(--lava-border)] bg-[var(--lava-card)] text-[var(--lava-muted)]'}`}
                            >
                              {method.icon || '📱'} {getLocalized(method.name) || t('محفظة إلكترونية', 'E-Wallet')}
                            </button>
                          ))}
                          {kashierAvailable && (
                            <button
                              type="button"
                              onClick={() => { setCheckoutPaymentMethod('kashier'); setSelectedWalletMethodId(null); }}
                              className={`px-4 py-3 rounded-lg border-2 font-bold text-sm transition ${checkoutPaymentMethod === 'kashier' ? 'border-black bg-black text-white' : 'border-[var(--lava-border)] bg-[var(--lava-card)] text-[var(--lava-muted)]'}`}
                            >
                              💳 {t('الدفع بالفيزا أو المحافظ', 'Pay by Card or Wallet')} — Kashier
                            </button>
                          )}
                          {paymobAvailable && (
                            <button
                              type="button"
                              onClick={() => { setCheckoutPaymentMethod('paymob'); setSelectedWalletMethodId(null); }}
                              className={`px-4 py-3 rounded-lg border-2 font-bold text-sm transition ${checkoutPaymentMethod === 'paymob' ? 'border-black bg-black text-white' : 'border-[var(--lava-border)] bg-[var(--lava-card)] text-[var(--lava-muted)]'}`}
                            >
                              💳 {t('الدفع بالفيزا أو المحافظ', 'Pay by Card or Wallet')} — Paymob
                            </button>
                          )}
                        </div>

                        {checkoutPaymentMethod === 'kashier' && kashierAvailable && (
                          <div className="bg-[var(--lava-secondary)] border border-[var(--lava-border)] rounded-lg p-4 text-sm text-[var(--lava-muted)]">
                            {t('بعد تأكيد الطلب هتنتقل لصفحة دفع Kashier الآمنة لإتمام الدفع بالفيزا أو المحافظ، وبعدها هترجع للموقع تلقائياً.', 'After submitting the order, you will be redirected to Kashier secure checkout to pay by card or wallet, then returned to the store automatically.')}
                          </div>
                        )}

                        {checkoutPaymentMethod === 'paymob' && paymobAvailable && (
                          <div className="bg-[var(--lava-secondary)] border border-[var(--lava-border)] rounded-lg p-4 text-sm text-[var(--lava-muted)]">
                            {t('بعد تأكيد الطلب هتنتقل لصفحة دفع Paymob الآمنة لإتمام الدفع بالفيزا أو المحافظ، وبعدها هترجع للموقع تلقائياً.', 'After submitting the order, you will be redirected to Paymob secure checkout to pay by card or wallet, then returned to the store automatically.')}
                          </div>
                        )}

                        {checkoutPaymentMethod === 'wallet' && selectedMethod && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                            <div>
                              <p className="text-sm text-[var(--lava-text)]">{t('برجاء تحويل قيمة الطلب على الرقم التالي:', 'Please transfer the order amount to the following number:')}</p>
                              <p className="text-2xl font-extrabold text-blue-700 mt-1" dir="ltr">{selectedMethod.phoneNumber || '---'}</p>
                              {getLocalized(selectedMethod.instructions) && (
                                <p className="text-xs text-[var(--lava-muted)] mt-2">{getLocalized(selectedMethod.instructions)}</p>
                              )}
                            </div>

                            <InputField
                              label={`${t('رقم الهاتف الذي تم التحويل منه', 'Phone number you transferred from')}${selectedMethod.transferDetailsRequired ? '' : ` (${t('اختياري', 'optional')})`}`}
                              type="tel"
                              value={walletSenderPhone}
                              onChange={(e) => setWalletSenderPhone(e.target.value)}
                              placeholder={t('مثال: 01012345678', 'e.g. 01012345678')}
                              required={!!selectedMethod.transferDetailsRequired}
                              id="walletSenderPhone"
                            />
                            <InputField
                              label={`${t('تاريخ التحويل', 'Transfer date')}${selectedMethod.transferDetailsRequired ? '' : ` (${t('اختياري', 'optional')})`}`}
                              type="date"
                              value={walletTransferDate}
                              onChange={(e) => setWalletTransferDate(e.target.value)}
                              required={!!selectedMethod.transferDetailsRequired}
                              id="walletTransferDate"
                            />

                            <div>
                              <label className="block font-semibold mb-1 text-sm">
                                {t('صورة تأكيد التحويل (اسكرين شوت)', 'Transfer confirmation screenshot')}{' '}
                                {selectedMethod.screenshotRequired
                                  ? <span className="text-red-500">*</span>
                                  : <span className="text-[var(--lava-muted)] text-xs">({t('اختياري', 'optional')})</span>}
                              </label>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                id="walletScreenshotInput"
                                onChange={(e) => {
                                  const file = e.target.files && e.target.files[0];
                                  setWalletScreenshotFile(file || null);
                                  if (file) {
                                    setWalletScreenshotPreview(URL.createObjectURL(file));
                                  } else {
                                    setWalletScreenshotPreview('');
                                  }
                                }}
                                className="w-full px-4 py-2 border rounded-lg bg-[var(--lava-card)] text-sm"
                              />
                              {walletScreenshotPreview && (
                                <img src={walletScreenshotPreview} alt="preview" className="mt-2 max-h-40 rounded-lg border" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {user && (
                    <div className="flex items-center gap-3 pt-2 border-t mt-4">
                      <input type="checkbox" id="saveShipping" checked={saveShippingInfo} onChange={(e) => setSaveShippingInfo(e.target.checked)} className="w-5 h-5" />
                      <label htmlFor="saveShipping" className="font-semibold text-sm cursor-pointer">{t('حفظ بيانات الشحن للمرة القادمة', 'Save shipping info for next time')}</label>
                    </div>
                  )}

                  <button type="submit" disabled={isPlacingOrder} className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition mt-4 text-lg disabled:opacity-60 disabled:cursor-not-allowed">
                    {isPlacingOrder ? t('جارٍ الإكمال...', 'Processing...') : t('تأكيد الطلب', 'Confirm Order')} 🛒
                  </button>
                </form>
              </div>

              {/* ===== كارت "إجمالي الطلب" - نفس تصميم صفحة السلة (CheckoutPage.jsx)
                  بالظبط، بس هنا بيتحدّث لايف أول ما العميل يختار محافظته تحت،
                  عشان يشوف سعر الشحن والإجمالي النهائي وهو لسه بيكتب بياناته. ===== */}
              <div className="lg:col-span-1">
                <div className="bg-[var(--lava-secondary)] p-6 rounded-xl shadow-md sticky top-24">
                  <h2 className="text-xl font-bold mb-4 border-b pb-3">{t('إجمالي الطلب', 'Order Total')}</h2>
                  {(() => {
                    // ===== حماية دفاعية: لو الدالة دي معملهاش تمرير صح من
                    // App.jsx (مثلاً نسخة قديمة من App.jsx لسه متحدّثتش)،
                    // منكسرش الصفحة كلها - نوري رسالة بسيطة بدل الكراش. =====
                    if (typeof calculateCartTotals !== 'function') {
                      return (
                        <p className="text-sm text-[var(--lava-muted)]">
                          {t('جاري تحميل الإجمالي...', 'Loading total...')}
                        </p>
                      );
                    }
                    const totals = calculateCartTotals();
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--lava-muted)]">{t('المجموع الفرعي', 'Subtotal')}</span>
                          <span className="font-bold">{totals.subtotal} {t('ج.م', 'EGP')}</span>
                        </div>

                        {totals.discount > 0 && (
                          <div className="text-sm text-green-600 space-y-1">
                            {totals.discountType === 'promotion' && totals.promoAppliedLines && totals.promoAppliedLines.length > 0 ? (
                              totals.promoAppliedLines.map((line, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>🎁 {getLocalized(line.label)} ({line.productName})</span>
                                  <span className="font-bold">- {line.discountAmount.toFixed(1)} {t('ج.م', 'EGP')}</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex justify-between">
                                <span>{t('الخصم', 'Discount')}</span>
                                <span className="font-bold">- {totals.discount.toFixed(1)} {t('ج.م', 'EGP')}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--lava-muted)]">{t('التوصيل', 'Shipping')}</span>
                          <span className={`font-bold ${!totals.shippingDetermined ? 'text-[var(--lava-muted)] text-xs' : ''}`}>
                            {!totals.shippingDetermined
                              ? t('اختر المحافظة لتحديد سعر الشحن', 'Select your governorate to calculate shipping')
                              : totals.shipping === 0
                                ? t('مجاناً 🎉', 'Free 🎉')
                                : `${totals.shipping} ${t('ج.م', 'EGP')}`}
                          </span>
                        </div>

                        {!totals.shippingDetermined && (
                          <p className="text-xs text-amber-600 -mt-2">
                            {t('سعر الشحن هيتحدد أول ما تختار المحافظة تحت', 'Shipping cost will update once you select your governorate below')}
                          </p>
                        )}

                        <div className="border-t pt-3 mt-3">
                          <div className="flex justify-between text-lg font-bold">
                            <span>{t('الإجمالي', 'Total')}</span>
                            <span>{totals.total.toFixed(1)} {t('ج.م', 'EGP')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              </div>
            )}
          </section>
  );
}