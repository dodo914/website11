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


export default function ProductDetailsPage(props) {
  const { SectionProductCard, activeImageIndex, addBundleToCart, addToCart, adminSettings, bundleSelections, buyNow, currentPage, getActiveProductOffers, getCanonicalVariantId, getDefaultVariant, getEffectivePrice, getLocalized, getLowStockThreshold, getProductStockStatus, getPromotionLabel, getSizeStockArray, getVariantById, getVariantImages, getVariantStock, getVariantTotalStock, getVariants, goTo, hasColors, isInWishlist, isProductVisibleToCustomer, isReviewsEnabled, isSaleActive, isSubmittingReview, language, openProductDetails, productQuantity, productReviews, products, recentlyViewedIds, resolveActivePromotionForProduct, reviewComment, reviewImagePreview, reviewName, reviewRating, selectedBundleIds, selectedColor, selectedProduct, selectedSize, setActiveImageIndex, setBundleSelections, setProductQuantity, setReviewComment, setReviewImageFile, setReviewImagePreview, setReviewName, setReviewRating, setSelectedColor, setSelectedSize, showToast, submitProductReview, t, toggleBundleItem, toggleWishlist } = props;
  return (
    <section className="py-16 px-6 md:px-12 max-w-6xl mx-auto fade-in">
            <button onClick={() => goTo('shop')} className={`mb-6 text-[var(--lava-muted)] hover:text-black font-semibold flex items-center gap-2 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
              {language === 'ar' ? '←' : '→'} {t('العودة للمتجر', 'Back to shop')}
            </button>

            <div className={`bg-[var(--lava-card)] p-8 rounded-xl shadow-md flex flex-col md:flex-row gap-12 ${language === 'ar' ? 'md:flex-row-reverse' : ''}`}>
              <div className="flex-1 flex flex-col gap-4">
                {(() => {
                  const currentImages = getVariantImages(selectedProduct, selectedColor);
                  const activeImg = currentImages[activeImageIndex] || currentImages[0];
                  return (
                    <>
                      <div className="h-96 rounded-lg overflow-hidden bg-[var(--lava-secondary)] shadow-inner">
                        <img src={activeImg} alt={getLocalized(selectedProduct.name)} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-4 flex-wrap">
                        {currentImages.map((img, index) => (
                          <div
                            key={index}
                            onClick={() => setActiveImageIndex(index)}
                            className={`h-20 w-20 rounded-lg overflow-hidden cursor-pointer border-2 ${activeImageIndex === index ? 'border-black' : 'border-transparent'}`}
                          >
                            <img loading="lazy" src={img} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                      {selectedProduct.video && selectedProduct.video.url && (
                        <div className="rounded-lg overflow-hidden bg-black">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video src={selectedProduct.video.url} controls className="w-full max-h-96" />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className={`flex-1 ${language === 'ar' ? 'text-right' : 'text-left'} flex flex-col justify-between`}>
                <div>
                  <span className="text-sm bg-[var(--lava-border)] text-[var(--lava-text)] px-3 py-1 rounded-full font-semibold">{getLocalized(selectedProduct.category)}</span>
                  <div className="flex items-center gap-3 mt-3 mb-2">
                    <h1 className="text-3xl font-bold flex-1">{getLocalized(selectedProduct.name)}</h1>
                    <button
                      onClick={() => toggleWishlist(selectedProduct.id)}
                      title={t('أضف إلى المفضلة', 'Add to wishlist')}
                      className="text-3xl hover:scale-110 transition flex-shrink-0"
                    >
                      <span className={isInWishlist(selectedProduct.id) ? 'text-red-600' : 'text-gray-300'}>❤</span>
                    </button>
                  </div>

                  <LiveViewersBadge
                    productId={selectedProduct.id}
                    enabled={!!adminSettings.current.showLiveViewers}
                    t={t}
                  />

                  {isReviewsEnabled(selectedProduct) && (() => {
                    const reviews = productReviews[selectedProduct.id] || [];
                    if (reviews.length === 0) return null;
                    const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
                    return (
                      <div className="flex items-center gap-2 mb-3 text-sm">
                        <span className="text-yellow-500">{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</span>
                        <span className="text-[var(--lava-muted)]">{avgRating.toFixed(1)} ({reviews.length} {t('تقييم', 'reviews')})</span>
                      </div>
                    );
                  })()}

                  {selectedProduct.onSale && isSaleActive() ? (
                    <p className="text-2xl font-bold text-[var(--lava-text)] mb-6">
                      <span className="line-through text-[var(--lava-muted)] text-lg me-3">{selectedProduct.price} {t('ج.م', 'EGP')}</span>
                      <span className="text-red-600">{selectedProduct.salePrice} {t('ج.م', 'EGP')}</span>
                    </p>
                  ) : selectedProduct.permanentSalePrice ? (
                    <p className="text-2xl font-bold text-[var(--lava-text)] mb-6">
                      <span className="line-through text-[var(--lava-muted)] text-lg me-3">{selectedProduct.price} {t('ج.م', 'EGP')}</span>
                      <span className="text-red-600">{selectedProduct.permanentSalePrice} {t('ج.م', 'EGP')}</span>
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-[var(--lava-text)] mb-6">{selectedProduct.price} {t('ج.م', 'EGP')}</p>
                  )}

                  {(() => {
                    // جزء 21: لو المنتج له عروض متعددة (Product Offers) مفعّلة، نعرضها كلها كقائمة تيرز
                    const productOffers = getActiveProductOffers(selectedProduct);
                    if (productOffers.length > 0) {
                      return (
                        <div className="mb-6 space-y-2">
                          <p className="font-bold text-red-600 text-sm">🔥 {t('عروض خاصة على هذا المنتج', 'Special Offers on this product')}</p>
                          <div className="flex flex-col gap-2">
                            {productOffers.map(o => (
                              <div key={o.id} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                <span className="text-lg">
                                  {o.type === 'bxgy' ? '🎁' : o.type === 'quantity_discount' ? '📦' : o.type === 'fixed' ? '💰' : '🏷️'}
                                </span>
                                <span className="font-bold text-[var(--lava-text)] text-sm">{getLocalized(getPromotionLabel(o))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    // مفيش عروض منتج - نرجع للسلوك القديم (عرض حملة لو موجود)
                    const activePromo = resolveActivePromotionForProduct(selectedProduct, 1);
                    if (!activePromo) return null;
                    const label = getLocalized(getPromotionLabel(activePromo));
                    if (!label) return null;
                    return (
                      <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 inline-block">
                        <p className="font-bold text-red-600 text-sm">🔥 {t('عرض خاص', 'Special Offer')}</p>
                        <p className="font-bold text-[var(--lava-text)]">{label}</p>
                      </div>
                    );
                  })()}

                  <p className="text-[var(--lava-muted)] leading-relaxed mb-6">{getLocalized(selectedProduct.description)}</p>

                  {(() => {
                    const productStockStatus = getProductStockStatus(selectedProduct);
                    const productIsOutOfStock = productStockStatus === 'out';
                    const variants = getVariants(selectedProduct);
                    const productHasColors = hasColors(selectedProduct);
                    const productHasSizes = (selectedProduct.sizes || []).length > 0;

                    // لسه محتاجين اختيار لون؟ لسه محتاجين اختيار مقاس؟ - العميل لازم يختار بنفسه، مفيش اختيار تلقائي.
                    const colorMissing = productHasColors && !selectedColor;
                    const sizeMissing = productHasSizes && !selectedSize;
                    const selectionComplete = !colorMissing && !sizeMissing;

                    // المخزون الحقيقي ميتحسبش غير لما الاختيار يكتمل بالكامل (مفيش تخمين لأي فاريانت)
                    const currentVariantStock = selectionComplete ? getVariantStock(selectedProduct, selectedColor, selectedSize) : 0;

                    const selectColor = (variantId) => {
                      setSelectedColor(variantId);
                      setActiveImageIndex(0);
                      // لما اللون يتغيّر، المقاس المختار قبل كده بقى غير صالح - لازم العميل يختار مقاس من جديد بنفسه.
                      setSelectedSize('');
                      setProductQuantity(1);
                    };

                    let selectionMessage = null;
                    if (colorMissing && sizeMissing) selectionMessage = t('من فضلك اختر لوناً ومقاساً.', 'Please select a color and size.');
                    else if (colorMissing) selectionMessage = t('من فضلك اختر لوناً.', 'Please select a color.');
                    else if (sizeMissing) selectionMessage = t('من فضلك اختر مقاساً.', 'Please select a size.');

                    return (
                      <>
                        {productIsOutOfStock && (
                          <div className="mb-4 bg-gray-900 text-white font-bold px-4 py-2 rounded-lg inline-block">
                            {t('غير متوفر حالياً', 'Out of Stock')}
                          </div>
                        )}

                        {productHasColors && (
                          <div className="mb-6">
                            <label className="block font-bold mb-2">
                              {t('اختر اللون:', 'Choose color:')}
                              {selectedColor ? (() => {
                                const v = getVariantById(selectedProduct, selectedColor);
                                return v && v.color ? <span className="font-normal text-[var(--lava-muted)]"> ({getLocalized(v.color)})</span> : null;
                              })() : (
                                <span className="font-normal text-[var(--lava-muted)] text-sm"> — {t('لم يتم الاختيار بعد', 'not selected yet')}</span>
                              )}
                            </label>
                            <div className="flex gap-3 flex-wrap">
                              {variants.map((v) => {
                                const variantOut = getVariantTotalStock(v) <= 0;
                                return (
                                  <button
                                    key={v.id}
                                    onClick={() => selectColor(v.id)}
                                    title={v.color ? getLocalized(v.color) : ''}
                                    style={{ backgroundColor: v.hex || '#eee' }}
                                    className={`relative w-10 h-10 rounded-full border-2 transition ${selectedColor === v.id ? 'ring-2 ring-offset-2 ring-black border-black' : 'border-[var(--lava-border)] hover:border-black'} ${variantOut ? 'opacity-40' : ''}`}
                                  >
                                    {variantOut && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-red-600">✕</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {productHasSizes && (
                          <div className="mb-6">
                            <label className="block font-bold mb-2">{t('اختر المقاس:', 'Choose size:')}</label>
                            {colorMissing ? (
                              <p className="text-[var(--lava-muted)] text-sm">{t('اختر اللون أولاً لعرض المقاسات المتاحة.', 'Choose a color first to see available sizes.')}</p>
                            ) : (
                              <>
                                <div className="flex gap-3 flex-wrap">
                                  {(selectedProduct.sizes || []).map((size) => {
                                    const sizeStock = getVariantStock(selectedProduct, selectedColor, size);
                                    const sizeOut = sizeStock <= 0;
                                    return (
                                      <button
                                        key={size}
                                        disabled={sizeOut}
                                        onClick={() => { setSelectedSize(size); setProductQuantity(1); }}
                                        title={sizeOut ? t('غير متوفر', 'Out of Stock') : ''}
                                        className={`w-12 h-12 rounded-lg font-bold border-2 transition relative ${selectedSize === size && !sizeOut ? 'bg-black text-white border-black' : 'bg-[var(--lava-card)] text-black border-[var(--lava-border)] hover:border-black'} ${sizeOut ? 'opacity-40 cursor-not-allowed line-through hover:border-[var(--lava-border)]' : ''}`}
                                      >
                                        {size}
                                      </button>
                                    );
                                  })}
                                </div>
                                {!productIsOutOfStock && !sizeMissing && currentVariantStock === 0 && (
                                  <p className="text-red-600 text-sm font-bold mt-2">{t('هذا الاختيار غير متوفر', 'This option is out of stock')}</p>
                                )}
                                {!productIsOutOfStock && currentVariantStock > 0 && currentVariantStock <= getLowStockThreshold(selectedProduct) && (
                                  <p className="text-orange-500 text-sm font-bold mt-2">{t(`باقي ${currentVariantStock} قطع فقط`, `Only ${currentVariantStock} left`)}</p>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {selectionMessage && (
                          <p className="text-[var(--lava-muted)] text-sm font-semibold mb-4">{selectionMessage}</p>
                        )}

                        <div className="mb-6">
                          <label className="block font-bold mb-2">{t('الكمية:', 'Quantity:')}</label>
                          <div className="inline-flex items-center border-2 border-[var(--lava-border)] rounded-lg overflow-hidden">
                            <button
                              onClick={() => setProductQuantity(q => Math.max(1, q - 1))}
                              disabled={!selectionComplete || currentVariantStock === 0}
                              className="w-10 h-10 font-bold text-lg hover:bg-[var(--lava-secondary)] transition disabled:opacity-40"
                              aria-label={t('إنقاص الكمية', 'Decrease quantity')}
                            >−</button>
                            <span className="w-12 h-10 flex items-center justify-center font-bold border-x-2 border-[var(--lava-border)]">{(!selectionComplete || currentVariantStock === 0) ? 0 : productQuantity}</span>
                            <button
                              onClick={() => setProductQuantity(q => {
                                if (q + 1 > currentVariantStock) {
                                  showToast(t(`أقصى كمية متاحة هي ${currentVariantStock}`, `Maximum available quantity is ${currentVariantStock}`));
                                  return q;
                                }
                                return Math.min(99, q + 1);
                              })}
                              disabled={!selectionComplete || currentVariantStock === 0 || productQuantity >= currentVariantStock}
                              className="w-10 h-10 font-bold text-lg hover:bg-[var(--lava-secondary)] transition disabled:opacity-40"
                              aria-label={t('زيادة الكمية', 'Increase quantity')}
                            >+</button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {(() => {
                  const productHasColors = hasColors(selectedProduct);
                  const productHasSizes = (selectedProduct.sizes || []).length > 0;
                  const colorMissing = productHasColors && !selectedColor;
                  const sizeMissing = productHasSizes && !selectedSize;
                  const selectionComplete = !colorMissing && !sizeMissing;
                  const purchaseDisabled = !selectionComplete || getVariantStock(selectedProduct, selectedColor, selectedSize) === 0;

                  let addToCartLabel;
                  if (colorMissing && sizeMissing) addToCartLabel = t('اختر اللون والمقاس', 'Select color & size');
                  else if (colorMissing) addToCartLabel = t('اختر اللون', 'Select color');
                  else if (sizeMissing) addToCartLabel = t('اختر المقاس', 'Select size');
                  else if (getVariantStock(selectedProduct, selectedColor, selectedSize) === 0) addToCartLabel = t('غير متوفر', 'Out of Stock');
                  else addToCartLabel = <>{t('إضافة إلى عربة التسوق', 'Add to Cart')} 🛒</>;

                  return (
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <button
                        onClick={() => addToCart(selectedProduct, selectedColor, selectedSize, null, productQuantity)}
                        disabled={purchaseDisabled}
                        className="flex-1 bg-black text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition shadow-lg text-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-black"
                      >
                        {addToCartLabel}
                      </button>
                      <button
                        onClick={() => buyNow(selectedProduct, selectedColor, selectedSize, null, productQuantity)}
                        disabled={purchaseDisabled}
                        className="flex-1 bg-[var(--lava-card)] text-black font-bold py-4 rounded-xl border-2 border-black hover:bg-[var(--lava-secondary)] transition shadow-lg text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t('اشترِ الآن', 'Buy Now')} ⚡
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="bg-[var(--lava-card)] p-6 md:p-8 rounded-xl shadow-md mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">🚚</span>
                <h4 className="font-bold">{t('شحن سريع', 'Fast Shipping')}</h4>
                <p className="text-sm text-[var(--lava-muted)]">{t(
                  `توصيل خلال ${adminSettings.current.shippingMinDays ?? 3} إلى ${adminSettings.current.shippingMaxDays ?? 5} أيام عمل`,
                  `Delivery within ${adminSettings.current.shippingMinDays ?? 3} to ${adminSettings.current.shippingMaxDays ?? 5} business days`
                )}</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">🎁</span>
                <h4 className="font-bold">{t('شحن مجاني', 'Free Shipping')}</h4>
                <p className="text-sm text-[var(--lava-muted)]">{t('للطلبات فوق', 'On orders over')} {adminSettings.current.freeShippingThreshold} {t('جنيه', 'EGP')}</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">↩️</span>
                <h4 className="font-bold">{t('استرجاع سهل', 'Easy Returns')}</h4>
                <p className="text-sm text-[var(--lava-muted)]">{t(
                  `استرجاع مجاني خلال ${adminSettings.current.returnWindow ?? 14} يوم من الاستلام`,
                  `Free returns within ${adminSettings.current.returnWindow ?? 14} days of delivery`
                )}</p>
              </div>
            </div>

            {adminSettings.current.showBundleOffers && selectedProduct.enableBundle && selectedProduct.bundle && selectedProduct.bundle.productIds && selectedProduct.bundle.productIds.length > 0 && selectedProduct.bundle.discountPercent > 0 && (() => {
              const bundleProducts = selectedProduct.bundle.productIds.map(id => products.find(p => p.id === id)).filter(Boolean);
              const allBundleItems = [selectedProduct, ...bundleProducts];
              const totalOriginal = allBundleItems.reduce((sum, p) => sum + p.price, 0);
              const discountPercent = selectedProduct.bundle.discountPercent;
              const discountAmount = totalOriginal * (discountPercent / 100);
              const totalAfterDiscount = totalOriginal - discountAmount;

              const handleAddBundle = () => {
                const selectedProducts = allBundleItems.filter(p => selectedBundleIds.includes(p.id));
                if (selectedProducts.length === 0) {
                  showToast(t('من فضلك اختر منتجاً واحداً على الأقل', 'Please select at least one product'));
                  return;
                }
                addBundleToCart(selectedProduct, selectedProducts.filter(p => p.id !== selectedProduct.id), discountPercent);
              };

              return (
                <div className="bg-[var(--lava-card)] p-6 md:p-8 rounded-xl shadow-md mt-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <h3 className="text-xl font-bold mb-5">🛍️ {t('غالباً ما يتم شراؤها معاً', 'Frequently Bought Together')}</h3>

                  <div className="flex items-start gap-3 flex-wrap justify-center md:justify-start">
                    {allBundleItems.map((p, index) => (
                      <React.Fragment key={p.id}>
                        <div className="flex flex-col items-center gap-2 w-28">
                          <div
                            onClick={() => toggleBundleItem(p.id)}
                            className="flex flex-col items-center gap-2 cursor-pointer group w-full"
                          >
                            <div className="relative">
                              <img
                                src={p.images[0]}
                                alt={getLocalized(p.name)}
                                className={`w-20 h-20 object-cover rounded-lg border-2 transition ${selectedBundleIds.includes(p.id) ? 'border-black' : 'border-[var(--lava-border)] opacity-50'}`}
                              />
                              <input
                                type="checkbox"
                                checked={selectedBundleIds.includes(p.id)}
                                onChange={() => toggleBundleItem(p.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute -top-2 -right-2 w-5 h-5 accent-black"
                              />
                            </div>
                            <span className="text-xs text-center font-semibold line-clamp-2">
                              {p.id === selectedProduct.id && '✔ '}{getLocalized(p.name)}
                            </span>
                            <span className="text-xs text-[var(--lava-muted)]">{p.price} {t('ج.م', 'EGP')}</span>
                          </div>

                          {/* سيليكتور اللون والمقاس للمنتجات الإضافية في الباندل */}
                          {p.id !== selectedProduct.id && selectedBundleIds.includes(p.id) && (
                            <div className="w-full flex flex-col gap-1 mt-1" onClick={e => e.stopPropagation()}>
                              {hasColors(p) && (
                                <select
                                  value={bundleSelections[p.id]?.variantId || ''}
                                  onChange={e => setBundleSelections(prev => ({
                                    ...prev,
                                    [p.id]: { ...prev[p.id], variantId: e.target.value, size: '' }
                                  }))}
                                  className="w-full text-xs border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-black"
                                >
                                  <option value="">{t('اختر لون', 'Color')}</option>
                                  {getVariants(p).filter(v => v.color).map(v => (
                                    <option key={getCanonicalVariantId(v)} value={getCanonicalVariantId(v)}>
                                      {getLocalized(v.color)}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <select
                                value={bundleSelections[p.id]?.size || ''}
                                onChange={e => setBundleSelections(prev => ({
                                  ...prev,
                                  [p.id]: { ...prev[p.id], size: e.target.value }
                                }))}
                                className="w-full text-xs border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-black"
                              >
                                <option value="">{t('اختر مقاس', 'Size')}</option>
                                {getSizeStockArray(
                                  getVariantById(p, bundleSelections[p.id]?.variantId) || getDefaultVariant(p)
                                ).filter(s => s.stock > 0).map(s => (
                                  <option key={s.size} value={s.size}>{s.size}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        {index < allBundleItems.length - 1 && (
                          <span className="text-2xl text-gray-300 font-bold self-start mt-8">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="mt-6 pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-start">
                      <p className="text-sm text-[var(--lava-muted)]">{t('السعر الإجمالي', 'Total price')}</p>
                      <p>
                        <span className="line-through text-[var(--lava-muted)] me-2">{totalOriginal.toFixed(1)} {t('ج.م', 'EGP')}</span>
                        <span className="text-sm text-green-700 font-bold me-2">−{discountPercent}%</span>
                        <span className="font-extrabold text-xl">{totalAfterDiscount.toFixed(1)} {t('ج.م', 'EGP')}</span>
                      </p>
                    </div>
                    <button
                      onClick={handleAddBundle}
                      className="w-full sm:w-auto bg-black text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-800 transition shadow-md"
                    >
                      {t('إضافة الباقة إلى السلة', 'Add Bundle to Cart')} 🛒
                    </button>
                  </div>
                </div>
              );
            })()}

            {adminSettings.current.showRecommendations && selectedProduct.enableRecommendations && selectedProduct.recommendedIds && selectedProduct.recommendedIds.length > 0 && (
              <div className="mt-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <h3 className="text-xl font-bold mb-5">✨ {t('منتجات قد تعجبك', 'You May Also Like')}</h3>
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                  {selectedProduct.recommendedIds.map(id => {
                    const prod = products.find(p => p.id === id);
                    if (!prod || !isProductVisibleToCustomer(prod)) return null;
                    const onSale = prod.onSale && isSaleActive();
                    const stockStatus = getProductStockStatus(prod);
                    const prodHasColors = hasColors(prod);
                    const quickAdd = (e) => {
                      e.stopPropagation();
                      if (prodHasColors || stockStatus === 'out') { openProductDetails(prod); return; }
                      const defaultVariant = getDefaultVariant(prod);
                      const firstInStock = (prod.sizes || []).find(s => getVariantStock(prod, defaultVariant?.id, s) > 0);
                      addToCart(prod, defaultVariant?.id, firstInStock || (prod.sizes || [])[0] || '', null, 1);
                    };
                    return (
                      <div
                        key={prod.id}
                        className="bg-[var(--lava-card)] rounded-lg shadow-md overflow-hidden group border hover:shadow-xl transition flex-shrink-0 w-40 md:w-48 snap-start"
                      >
                        <div className="h-32 md:h-40 overflow-hidden bg-[var(--lava-secondary)] cursor-pointer relative" onClick={() => openProductDetails(prod)}>
                          <img loading="lazy" src={prod.images[0]} alt={getLocalized(prod.name)} className={`w-full h-full object-cover group-hover:scale-105 transition duration-300 ${stockStatus === 'out' ? 'opacity-50 grayscale' : ''}`} />
                          {stockStatus === 'out' && <span className="absolute top-1 start-1 bg-gray-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{t('غير متوفر', 'Out')}</span>}
                        </div>
                        <div className={`p-3 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                          <h4 className="font-bold text-xs md:text-sm mb-1 cursor-pointer" onClick={() => openProductDetails(prod)}>{getLocalized(prod.name)}</h4>
                          {onSale ? (
                            <p className="text-xs md:text-sm font-bold mb-2">
                              <span className="line-through text-[var(--lava-muted)] me-1">{prod.price}</span>
                              <span className="text-red-600">{prod.salePrice} {t('ج.م', 'EGP')}</span>
                            </p>
                          ) : (
                            <p className="text-[var(--lava-muted)] text-xs md:text-sm font-bold mb-2">{prod.price} {t('ج.م', 'EGP')}</p>
                          )}
                          <button
                            onClick={quickAdd}
                            disabled={stockStatus === 'out'}
                            className="w-full bg-black text-white text-xs font-bold py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {stockStatus === 'out' ? t('غير متوفر', 'Out of Stock') : <>{t('إضافة سريعة', 'Quick Add')} ＋</>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {adminSettings.current.showRecentlyViewed && (() => {
              const recentProducts = recentlyViewedIds
                .filter(id => id !== selectedProduct.id)
                .map(id => products.find(p => p.id === id))
                .filter(p => p && isProductVisibleToCustomer(p))
                .slice(0, 5);
              if (recentProducts.length === 0) return null;
              return (
                <div className="mt-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <h3 className="text-xl font-bold mb-5">🕘 {t('شاهدته مؤخراً', 'Recently Viewed')}</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                    {recentProducts.map(prod => (
                      <div key={prod.id} className="flex-shrink-0 w-40 md:w-48 snap-start">
                        <SectionProductCard product={prod} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {isReviewsEnabled(selectedProduct) && (() => {
              const reviews = productReviews[selectedProduct.id] || [];
              const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;
              return (
                <div className="bg-[var(--lava-card)] p-6 md:p-8 rounded-xl shadow-md mt-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <h3 className="text-xl font-bold mb-1">⭐ {t('تقييمات العملاء', 'Customer Reviews')}</h3>
                  {reviews.length > 0 ? (
                    <p className="text-sm text-[var(--lava-muted)] mb-5">
                      {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))} {avgRating.toFixed(1)} ({reviews.length} {t('تقييم', 'reviews')})
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--lava-muted)] mb-5">{t('لا توجد تقييمات بعد. كن أول من يقيّم هذا المنتج!', 'No reviews yet. Be the first to review this product!')}</p>
                  )}

                  <div className="space-y-4 mb-6">
                    {reviews.map(r => (
                      <div key={r.id} className="border-b pb-4">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-2">
                            {r.name}
                            {r.status === 'pending' && (
                              <span className="text-xs font-normal bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                {t('قيد المراجعة', 'Pending approval')}
                              </span>
                            )}
                          </span>
                          <span className="text-yellow-500 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        </div>
                        <p className="text-sm text-[var(--lava-muted)] mt-1">{r.comment}</p>
                        {r.image && (
                          <img
                            src={r.image}
                            alt={t('صورة التقييم', 'Review image')}
                            className="mt-2 w-24 h-24 object-cover rounded-lg border cursor-pointer"
                            onClick={() => window.open(r.image, '_blank', 'noopener,noreferrer')}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="bg-[var(--lava-secondary)] p-5 rounded-lg border">
                    <h4 className="font-bold mb-3">{t('أضف تقييمك', 'Write a Review')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <InputField
                        label={t('الاسم', 'Name')}
                        value={reviewName}
                        onChange={(e) => setReviewName(e.target.value)}
                        placeholder={t('اسمك', 'Your name')}
                        id="reviewName"
                      />
                      <SelectField
                        label={t('التقييم', 'Rating')}
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                        options={[5, 4, 3, 2, 1].map(n => ({ value: n, label: '★'.repeat(n) + '☆'.repeat(5 - n) }))}
                        id="reviewRating"
                      />
                    </div>
                    <TextareaField
                      label={t('تعليقك', 'Your comment')}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder={t('شاركنا رأيك في المنتج...', 'Share your thoughts about this product...')}
                      rows={3}
                      id="reviewComment"
                    />
                    {adminSettings.current.allowReviewImages !== false && (
                      <div className="mt-3">
                        <label className="block text-sm font-bold mb-1">{t('أضف صورة (اختياري)', 'Add a photo (optional)')}</label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            if (!file) return;
                            setReviewImageFile(file);
                            const reader = new FileReader();
                            reader.onload = () => setReviewImagePreview(reader.result);
                            reader.readAsDataURL(file);
                          }}
                          className="text-sm"
                        />
                        {reviewImagePreview && (
                          <div className="mt-2 relative inline-block">
                            <img src={reviewImagePreview} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                            <button
                              type="button"
                              onClick={() => { setReviewImageFile(null); setReviewImagePreview(''); }}
                              className="absolute -top-2 -end-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => submitProductReview(selectedProduct.id)}
                      disabled={isSubmittingReview}
                      className="mt-3 bg-black text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                    >
                      {isSubmittingReview ? t('جارٍ الإرسال...', 'Submitting...') : t('إرسال التقييم', 'Submit Review')}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ===== شريط ثابت لإضافة المنتج للسلة على الموبايل فقط ===== */}
            {(() => {
              const productHasColors = hasColors(selectedProduct);
              const productHasSizes = (selectedProduct.sizes || []).length > 0;
              const colorMissing = productHasColors && !selectedColor;
              const sizeMissing = productHasSizes && !selectedSize;
              const selectionComplete = !colorMissing && !sizeMissing;
              const currentVariantStock = getVariantStock(selectedProduct, selectedColor, selectedSize);
              const purchaseDisabled = !selectionComplete || currentVariantStock === 0;

              let stickyLabel;
              if (colorMissing && sizeMissing) stickyLabel = t('اختر اللون والمقاس', 'Select color & size');
              else if (colorMissing) stickyLabel = t('اختر اللون', 'Select color');
              else if (sizeMissing) stickyLabel = t('اختر المقاس', 'Select size');
              else if (currentVariantStock === 0) stickyLabel = t('غير متوفر', 'Out of Stock');
              else stickyLabel = t('أضف للسلة', 'Add to Cart');

              return (
                <div
                  className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--lava-card)] border-t border-[var(--lava-border)] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center gap-3"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                >
                  <span className="font-bold text-base shrink-0">{getEffectivePrice(selectedProduct)} {t('ج.م', 'EGP')}</span>
                  <button
                    onClick={() => addToCart(selectedProduct, selectedColor, selectedSize, null, productQuantity)}
                    disabled={purchaseDisabled}
                    className="flex-1 bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {stickyLabel}
                  </button>
                </div>
              );
            })()}

          </section>
  );
}