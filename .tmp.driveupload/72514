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


export default function WishlistPage(props) {
  const { ColorDots, DiscountBadge, LowStockBadge, addToCart, currentPage, getDefaultVariant, getLocalized, getProductStockStatus, getVariantStock, goTo, hasColors, isSaleActive, language, openProductDetails, products, productsLoading, setSelectedCategoryFilter, t, theme, toggleWishlist, wishlist } = props;
  return (
    <section className="py-16 px-6 md:px-12 max-w-7xl mx-auto fade-in">
            <h2 className="text-4xl font-bold mb-10 text-center">{t('المفضلة', 'Wishlist')} ❤️</h2>
            {productsLoading ? (
              <div className={`grid ${theme.card.colsMobile || 'grid-cols-2'} ${theme.card.colsDesktop || 'md:grid-cols-3'} ${theme.card.gapMobile || 'gap-4'} ${theme.card.gapDesktop || 'md:gap-8'}`}>
                {[1,2,3].map(i => (
                  <div key={i} className="rounded-lg overflow-hidden bg-[var(--lava-card)] shadow-md">
                    <div className={`${theme.card.imageHeight || 'h-48 md:h-80'} bg-[var(--lava-secondary)] animate-pulse`} />
                    <div className="p-3 md:p-5 space-y-2">
                      <div className="h-3.5 w-3/4 rounded-full bg-[var(--lava-secondary)] animate-pulse" />
                      <div className="h-3 w-1/2 rounded-full bg-[var(--lava-secondary)] animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : wishlist.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[var(--lava-muted)] text-lg mb-4">{t('قائمة المفضلة فارغة حالياً', 'Your wishlist is empty')}</p>
                <button onClick={() => { setSelectedCategoryFilter('all'); goTo('shop'); }} className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition">
                  {t('تصفح المنتجات', 'Browse Products')}
                </button>
              </div>
            ) : (
              <div className={`grid ${theme.card.colsMobile || 'grid-cols-2'} ${theme.card.colsDesktop || 'md:grid-cols-3'} ${theme.card.gapMobile || 'gap-4'} ${theme.card.gapDesktop || 'md:gap-8'}`}>
                {wishlist.map(id => products.find(p => p.id === id)).filter(Boolean).map(product => {
                  const stockStatus = getProductStockStatus(product);
                  const productHasColors = hasColors(product);
                  const quickAdd = () => {
                    if (productHasColors || stockStatus === 'out') {
                      // لازم يختار اللون (أو يشوف تفاصيل المنتج) قبل الإضافة
                      openProductDetails(product);
                      return;
                    }
                    const defaultVariant = getDefaultVariant(product);
                    const firstInStock = (product.sizes || []).find(s => getVariantStock(product, defaultVariant?.id, s) > 0);
                    addToCart(product, defaultVariant?.id, firstInStock || (product.sizes || [])[0] || '', null, 1);
                  };
                  return (
                  <div key={product.id} className="bg-[var(--lava-card)] rounded-lg shadow-md overflow-hidden group hover:shadow-xl transition relative">
                    <button
                      onClick={() => toggleWishlist(product.id)}
                      className="absolute top-2 end-2 z-10 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-lg hover:scale-110 transition"
                      title={t('إزالة من المفضلة', 'Remove from wishlist')}
                    >
                      <span className="text-red-600">❤</span>
                    </button>
                    <div className={`${theme.card.imageHeight || 'h-48 md:h-80'} overflow-hidden bg-[var(--lava-secondary)] cursor-pointer relative`} onClick={() => openProductDetails(product)}>
                      <img loading="lazy" src={product.images[0]} alt={getLocalized(product.name)} className={`w-full h-full object-cover transition-opacity duration-500 ${product.images?.[1] && stockStatus !== 'out' ? 'absolute inset-0 group-hover:opacity-0' : 'group-hover:scale-105 transition-transform'} ${stockStatus === 'out' ? 'opacity-50 grayscale' : ''}`} />
                      {product.images?.[1] && stockStatus !== 'out' && (
                        <img loading="lazy" src={product.images[1]} alt={getLocalized(product.name)} className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      )}
                      {stockStatus === 'out' && (
                        <span className="absolute top-2 start-2 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded">{t('غير متوفر', 'Out of Stock')}</span>
                      )}
                      <LowStockBadge product={product} stockStatus={stockStatus} />
                      <DiscountBadge product={product} className="absolute top-2 end-12 text-xs font-bold px-2 py-1 rounded" />
                    </div>
                    <div className={`p-3 md:p-5 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      <h3 className={`${theme.card.priceEmphasis === 'name' ? 'font-extrabold' : 'font-bold'} ${theme.card.nameFontSize || 'text-sm md:text-xl'} mt-1 mb-2 cursor-pointer`} onClick={() => openProductDetails(product)}>{getLocalized(product.name)}</h3>
                      {product.onSale && isSaleActive() ? (
                        <p className={`${theme.card.priceEmphasis === 'price' ? 'font-extrabold' : 'font-bold'} ${theme.card.priceFontSize || 'text-xs md:text-lg'} mb-3`}>
                          <span className="line-through text-[var(--lava-muted)] text-sm me-2">{product.price} {t('ج.م', 'EGP')}</span>
                          <span style={{ color: theme.card.saleColor || '#dc2626' }}>{product.salePrice} {t('ج.م', 'EGP')}</span>
                        </p>
                      ) : product.permanentSalePrice ? (
                        <p className={`${theme.card.priceEmphasis === 'price' ? 'font-extrabold' : 'font-bold'} ${theme.card.priceFontSize || 'text-xs md:text-lg'} mb-3`}>
                          <span className="line-through text-[var(--lava-muted)] text-sm me-2">{product.price} {t('ج.م', 'EGP')}</span>
                          <span style={{ color: theme.card.saleColor || '#dc2626' }}>{product.permanentSalePrice} {t('ج.م', 'EGP')}</span>
                        </p>
                      ) : (
                        <p className={`text-[var(--lava-muted)] ${theme.card.priceEmphasis === 'price' ? 'font-extrabold' : 'font-bold'} ${theme.card.priceFontSize || 'text-xs md:text-lg'} mb-3`}>{product.price} {t('ج.م', 'EGP')}</p>
                      )}
                      <ColorDots product={product} className="flex items-center gap-1 mb-3 -mt-2" />
                      <button
                        onClick={quickAdd}
                        disabled={stockStatus === 'out'}
                        className="w-full bg-black text-white text-xs md:text-sm font-bold py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {stockStatus === 'out' ? t('غير متوفر', 'Out of Stock') : <>{t('أضف إلى السلة', 'Add to Cart')} 🛒</>}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
  );
}