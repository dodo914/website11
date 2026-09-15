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


export default function CheckoutPage(props) {
  const { NO_COLOR_ID, adminSettings, appliedDiscount, applyDiscountCode, calculateCartTotals, cart, currentPage, discountInput, getLocalized, getVariantStock, goTo, language, products, removeDiscountCode, removeFromCart, setDiscountInput, t, updateCartItemQuantity } = props;
  return (
    <section className={`py-16 px-6 md:px-12 max-w-6xl mx-auto ${language === 'ar' ? 'text-right' : 'text-left'} fade-in`}>
            <h1 className="text-3xl font-bold mb-8">{t('عربة التسوق والدفع', 'Cart & Checkout')}</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              <div className="lg:col-span-2 bg-[var(--lava-card)] p-6 rounded-xl shadow-md space-y-4">
                <h2 className="text-xl font-bold mb-4 border-b pb-3">{t('ملخص الطلب', 'Order Summary')}</h2>

                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[var(--lava-muted)] text-lg">{t('عربة التسوق فارغة', 'Your cart is empty')}</p>
                    <button
                      onClick={() => goTo('shop')}
                      className="mt-4 bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition"
                    >
                      {t('تسوق الآن', 'Shop Now')}
                    </button>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const grouped = [];
                      cart.forEach(item => {
                        const existing = grouped.find(g => g.id === item.id && g.size === item.size && g.price === item.price && (g.variantId || NO_COLOR_ID) === (item.variantId || NO_COLOR_ID));
                        if (existing) {
                          existing.qty += 1;
                          existing.cartIds.push(item.cartId);
                        } else {
                          grouped.push({ ...item, qty: 1, cartIds: [item.cartId] });
                        }
                      });
                      const cartTotalsForItems = calculateCartTotals();
                      return grouped.map(item => {
                        const productRef = products.find(p => p.id === item.id);
                        const currentStock = productRef ? getVariantStock(productRef, item.variantId, item.size) : Infinity;
                        const freeUnitsInLine = item.cartIds.filter(cid => cartTotalsForItems.promoFreeCartIds && cartTotalsForItems.promoFreeCartIds.has(cid)).length;
                        return (
                        <div key={item.cartIds[0]} className="flex justify-between items-start border-b pb-4 mb-4">
                          <div className="flex gap-4">
                            <img loading="lazy" src={item.images[0]} alt="" className="w-20 h-20 object-cover rounded-lg" />
                            <div>
                              <h4 className="font-bold">{getLocalized(item.name)}</h4>
                              <p className="text-sm text-[var(--lava-muted)]">
                                {t('المقاس:', 'Size:')} {item.size}
                                {item.colorLabel && <> · {t('اللون:', 'Color:')} {item.colorLabel}</>}
                              </p>
                              {freeUnitsInLine > 0 && (
                                <p className="text-xs font-bold text-green-600 mt-1">🎁 {t(`${freeUnitsInLine} قطعة مجاناً (عرض ترويجي)`, `${freeUnitsInLine} free (promotion)`)}</p>
                              )}
                              {currentStock < item.qty && (
                                <p className="text-xs font-bold text-red-600 mt-1">{t(`متوفر فقط ${currentStock} - من فضلك عدّل الكمية`, `Only ${currentStock} available - please adjust quantity`)}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2">
                                <div className="inline-flex items-center border-2 border-[var(--lava-border)] rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => updateCartItemQuantity(item, item.qty - 1)}
                                    className="w-7 h-7 font-bold hover:bg-[var(--lava-secondary)] transition"
                                    aria-label={t('إنقاص الكمية', 'Decrease quantity')}
                                  >−</button>
                                  <span className="w-8 h-7 flex items-center justify-center font-bold text-sm border-x-2 border-[var(--lava-border)]">{item.qty}</span>
                                  <button
                                    onClick={() => updateCartItemQuantity(item, item.qty + 1)}
                                    className="w-7 h-7 font-bold hover:bg-[var(--lava-secondary)] transition"
                                    aria-label={t('زيادة الكمية', 'Increase quantity')}
                                  >+</button>
                                </div>
                                <button
                                  onClick={() => item.cartIds.forEach(cid => removeFromCart(cid))}
                                  className="text-red-600 text-sm font-semibold hover:underline"
                                >
                                  {t('إزالة', 'Remove')}
                                </button>
                              </div>
                            </div>
                          </div>
                          <span className="font-bold text-lg">{item.price * item.qty} {t('ج.م', 'EGP')}</span>
                        </div>
                        );
                      });
                    })()}

                    <div className="mt-6 pt-4 border-t">
                      {appliedDiscount ? (
                        <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg">
                          <div>
                            <span className="font-bold text-green-700">✓ {appliedDiscount.code}</span>
                            <span className="text-sm text-[var(--lava-muted)] me-2">({appliedDiscount.discountPercent}% {t('خصم', 'off')})</span>
                          </div>
                          <button
                            onClick={removeDiscountCode}
                            className="text-red-600 text-sm font-bold hover:underline"
                          >
                            {t('إلغاء', 'Cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={discountInput}
                            onChange={(e) => setDiscountInput(e.target.value)}
                            placeholder={t('كود الخصم...', 'Discount code...')}
                            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                          />
                          <button
                            onClick={applyDiscountCode}
                            className="bg-black text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-800 transition"
                          >
                            {t('تطبيق', 'Apply')}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className="bg-[var(--lava-secondary)] p-6 rounded-xl shadow-md sticky top-24">
                  <h2 className="text-xl font-bold mb-4 border-b pb-3">{t('إجمالي الطلب', 'Order Total')}</h2>

                  {cart.length > 0 ? (
                    <>
                      {(() => {
                        const totals = calculateCartTotals();
                        const threshold = adminSettings.current.freeShippingThreshold;
                        const remainingForFreeShipping = Math.max(0, threshold - totals.subtotal);
                        const progressPercent = Math.min(100, (totals.subtotal / threshold) * 100);
                        return (
                          <div className="space-y-3">
                            <div className="mb-2">
                              {remainingForFreeShipping > 0 ? (
                                <p className="text-xs font-semibold text-[var(--lava-muted)] mb-2">
                                  {t('باقي', 'You need')} <span className="text-black font-bold">{remainingForFreeShipping.toFixed(0)} {t('ج.م', 'EGP')}</span> {t('عشان توصل للشحن المجاني', 'more for free shipping')}
                                </p>
                              ) : (
                                <p className="text-xs font-bold text-green-600 mb-2">{t('مبروك! أنت مؤهل للشحن المجاني 🎉', "Congrats! You've unlocked free shipping 🎉")}</p>
                              )}
                              <div className="w-full h-2.5 bg-[var(--lava-border)] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${remainingForFreeShipping > 0 ? 'bg-black' : 'bg-green-500'}`}
                                  style={{ width: `${progressPercent}%` }}
                                ></div>
                              </div>
                            </div>
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
                                    <span>{t('الخصم', 'Discount')} {totals.discountType === 'first_order' ? `(${t(`خصم ${adminSettings.current.promotions.guestDiscount.percentage}% للحساب الجديد`, `${adminSettings.current.promotions.guestDiscount.percentage}% new user`)})` : ''}</span>
                                    <span className="font-bold">- {totals.discount.toFixed(1)} {t('ج.م', 'EGP')}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex justify-between text-sm">
                              <span className="text-[var(--lava-muted)]">{t('التوصيل', 'Shipping')}</span>
                              <span className={`font-bold ${!totals.shippingDetermined ? 'text-[var(--lava-muted)] text-xs' : ''}`}>
                                {!totals.shippingDetermined
                                  ? t('اختر مكان التوصيل لتحديد سعر الشحن', 'Select your location to calculate shipping')
                                  : totals.shipping === 0
                                    ? t('مجاناً 🎉', 'Free 🎉')
                                    : `${totals.shipping} ${t('ج.م', 'EGP')}`}
                              </span>
                            </div>

                            {!totals.shippingDetermined && (
                              <p className="text-xs text-amber-600 -mt-2">
                                {t('سعر الشحن سيُحسب بعد اختيار المحافظة في نموذج الشحن أدناه', 'Shipping will be calculated once you select your governorate in the shipping form below')}
                              </p>
                            )}

                            <div className="border-t pt-3 mt-3">
                              <div className="flex justify-between text-lg font-bold">
                                <span>{t('الإجمالي', 'Total')}</span>
                                <span>{totals.total.toFixed(1)} {t('ج.م', 'EGP')}</span>
                              </div>
                              {!totals.shippingDetermined && (
                                <p className="text-xs text-[var(--lava-muted)] mt-1">
                                  {t('(بدون الشحن)', '(shipping not included yet)')}
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => goTo('checkout-details')}
                              className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition mt-4"
                            >
                              {t('إتمام الدفع', 'Proceed to Checkout')}
                            </button>

                            <button
                              onClick={() => goTo('shop')}
                              className="w-full text-[var(--lava-muted)] font-semibold py-2 hover:text-black transition text-sm"
                            >
                              {language === 'ar' ? '←' : '→'} {t('الاستمرار في التسوق', 'Continue Shopping')}
                            </button>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[var(--lava-muted)]">{t('عربة التسوق فارغة', 'Your cart is empty')}</p>
                      <button
                        onClick={() => goTo('shop')}
                        className="mt-4 bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition w-full"
                      >
                        {t('تسوق الآن', 'Shop Now')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </section>
  );
}