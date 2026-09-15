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


export default function ShopPage(props) {
  const { ColorDots, DiscountBadge, LowStockBadge, allAvailableColors, currentPage, fetchShopPage, filterColor, filterFeaturedOnly, filterMaxPrice, filterMinPrice, filterOnSaleOnly, filterSizes, getEffectivePrice, getLocalized, getProductStockStatus, getProductTotalStock, handleQuickAdd, isInWishlist, isSaleActive, language, openProductDetails, priceBounds, randomFeaturedSuggestions, searchQuery, searchSuggestions, selectedCategoryFilter, setFilterColor, setFilterFeaturedOnly, setFilterMaxPrice, setFilterMinPrice, setFilterOnSaleOnly, setFilterSizes, setSearchQuery, setSelectedCategoryFilter, setShopSortBy, setShowSearchDropdown, shopInitialLoading, shopItems, shopLoadingMore, shopPageNum, shopSortBy, shopTotal, showSearchDropdown, t, theme, toggleWishlist } = props;
  return (
    <section className="py-16 px-6 md:px-12 max-w-7xl mx-auto fade-in">
            <h2 className="text-4xl font-bold mb-6 text-center">
              {selectedCategoryFilter === 'all' ? t('كل المنتجات', 'All Products') : `${t('منتجات قسم', 'Products of')}: ${selectedCategoryFilter}`}
            </h2>

            <div className="max-w-md mx-auto mb-6 relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    id="searchQuery"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
                    onFocus={() => setShowSearchDropdown(true)}
                    placeholder={t('ابحث عن منتج...', 'Search for product...')}
                    autoComplete="off"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all bg-[var(--lava-card)]"
                  />
                  {showSearchDropdown && searchQuery.trim() && (
                    <div className="absolute top-full mt-2 w-full bg-[var(--lava-card)] border rounded-lg shadow-xl z-40 overflow-hidden">
                      {searchSuggestions().length > 0 ? (
                        searchSuggestions().map(product => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => { setShowSearchDropdown(false); setSearchQuery(''); openProductDetails(product); }}
                            className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--lava-secondary)] transition border-b last:border-b-0 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                          >
                            <img loading="lazy" src={product.images[0]} alt="" className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate">{getLocalized(product.name)}</p>
                              <p className="text-xs text-[var(--lava-muted)]">{getLocalized(product.category)}</p>
                            </div>
                            <span className="text-sm font-bold text-[var(--lava-text)] flex-shrink-0">{getEffectivePrice(product)} {t('ج.م', 'EGP')}</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-4">
                          <p className="text-center text-[var(--lava-muted)] text-sm mb-3">{t('لا توجد نتائج', 'No results')}</p>
                          <p className="text-xs text-[var(--lava-muted)] font-bold mb-2">{t('قد يعجبك أيضاً:', 'You might like:')}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {randomFeaturedSuggestions().map(product => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => { setShowSearchDropdown(false); setSearchQuery(''); openProductDetails(product); }}
                                className="flex items-center gap-2 hover:bg-[var(--lava-secondary)] rounded-lg p-1 transition"
                              >
                                <img loading="lazy" src={product.images[0]} alt="" className="w-10 h-10 object-cover rounded-md" />
                                <span className="text-xs font-semibold truncate">{getLocalized(product.name)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedCategoryFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedCategoryFilter('all')}
                    className="bg-[var(--lava-border)] text-[var(--lava-text)] px-4 py-2 rounded-lg font-bold text-sm hover:bg-[var(--lava-border)] transition"
                  >
                    {t('إلغاء الفلتر', 'Clear filter')}
                  </button>
                )}
              </div>
            </div>

            <div className="max-w-4xl mx-auto mb-6 bg-[var(--lava-card)] px-4 py-3 rounded-xl shadow-sm border">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">

                {/* Price */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-[var(--lava-muted)] whitespace-nowrap">{t('السعر', 'Price')}</span>
                  <input
                    type="number"
                    value={filterMinPrice}
                    onChange={(e) => setFilterMinPrice(e.target.value)}
                    placeholder={String(priceBounds().min)}
                    className="w-20 px-2 py-1 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <span className="text-[var(--lava-muted)] text-xs">-</span>
                  <input
                    type="number"
                    value={filterMaxPrice}
                    onChange={(e) => setFilterMaxPrice(e.target.value)}
                    placeholder={String(priceBounds().max)}
                    className="w-20 px-2 py-1 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div className="w-px h-6 bg-[var(--lava-border)] hidden sm:block" />

                {/* Sizes */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-[var(--lava-muted)]">{t('المقاس', 'Size')}</span>
                  {['S', 'M', 'L', 'XL'].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFilterSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                      className={`w-8 h-8 rounded-lg text-xs font-bold border-2 transition ${filterSizes.includes(size) ? 'bg-black text-white border-black' : 'bg-[var(--lava-card)] text-black border-[var(--lava-border)] hover:border-black'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                {/* Colors */}
                {allAvailableColors().length > 0 && (
                  <>
                    <div className="w-px h-6 bg-[var(--lava-border)] hidden sm:block" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-bold text-[var(--lava-muted)]">{t('اللون', 'Color')}</span>
                      <button
                        type="button"
                        onClick={() => setFilterColor('')}
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border transition ${!filterColor ? 'bg-black text-white border-black' : 'bg-[var(--lava-card)] text-[var(--lava-muted)] border-[var(--lava-border)]'}`}
                      >
                        {t('الكل', 'All')}
                      </button>
                      {allAvailableColors().map(color => (
                        <button
                          key={color}
                          type="button"
                          title={color}
                          onClick={() => setFilterColor(color)}
                          style={{ backgroundColor: color }}
                          className={`w-6 h-6 rounded-full border-2 transition ${filterColor === color ? 'ring-2 ring-offset-1 ring-black border-black' : 'border-[var(--lava-border)] hover:border-black'}`}
                        />
                      ))}
                    </div>
                  </>
                )}

                <div className="w-px h-6 bg-[var(--lava-border)] hidden sm:block" />

                {/* Checkboxes */}
                <div className="flex items-center gap-3 shrink-0">
                  <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer whitespace-nowrap">
                    <input type="checkbox" checked={filterOnSaleOnly} onChange={(e) => setFilterOnSaleOnly(e.target.checked)} className="w-3.5 h-3.5" />
                    {t('مخفض', 'On sale')}
                  </label>
                  <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer whitespace-nowrap">
                    <input type="checkbox" checked={filterFeaturedOnly} onChange={(e) => setFilterFeaturedOnly(e.target.checked)} className="w-3.5 h-3.5" />
                    {t('مميز', 'Featured')}
                  </label>
                </div>

                {/* Clear all */}
                {(filterMinPrice !== '' || filterMaxPrice !== '' || filterSizes.length > 0 || filterColor || filterOnSaleOnly || filterFeaturedOnly) && (
                  <button
                    type="button"
                    onClick={() => { setFilterMinPrice(''); setFilterMaxPrice(''); setFilterSizes([]); setFilterColor(''); setFilterOnSaleOnly(false); setFilterFeaturedOnly(false); }}
                    className="text-red-500 text-xs font-bold hover:underline ms-auto shrink-0"
                  >
                    {t('مسح', 'Clear')}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <p className="text-xs text-[var(--lava-muted)] font-semibold">
                {!shopInitialLoading && t(`${shopTotal} منتج`, `${shopTotal} products`)}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-[var(--lava-muted)] whitespace-nowrap">{t('ترتيب حسب', 'Sort by')}</label>
                <select
                  value={shopSortBy}
                  onChange={(e) => setShopSortBy(e.target.value)}
                  className="text-xs border border-[var(--lava-border)] rounded-md px-2 py-1.5 bg-[var(--lava-card)]"
                >
                  <option value="newest">{t('الأحدث', 'Newest')}</option>
                  <option value="price_asc">{t('السعر: من الأقل للأعلى', 'Price: Low to High')}</option>
                  <option value="price_desc">{t('السعر: من الأعلى للأقل', 'Price: High to Low')}</option>
                </select>
              </div>
            </div>

            <div className={`grid ${theme.card.colsMobile || 'grid-cols-2'} ${theme.card.colsDesktop || 'md:grid-cols-3'} ${theme.card.gapMobile || 'gap-4'} ${theme.card.gapDesktop || 'md:gap-8'}`}>
              {shopInitialLoading ? (
                [1,2,3,4,5,6].map(i => (
                  <div key={i} className="rounded-lg overflow-hidden bg-[var(--lava-card)] shadow-md">
                    <div className={`${theme.card.imageHeight || 'h-48 md:h-80'} bg-[var(--lava-secondary)] animate-pulse`} />
                    <div className="p-3 md:p-5 space-y-2">
                      <div className="h-2.5 w-1/3 rounded-full bg-[var(--lava-secondary)] animate-pulse" />
                      <div className="h-3.5 w-3/4 rounded-full bg-[var(--lava-secondary)] animate-pulse" />
                      <div className="h-3 w-1/2 rounded-full bg-[var(--lava-secondary)] animate-pulse" />
                    </div>
                  </div>
                ))
              ) : shopItems.length === 0 ? (
                <p className="text-center col-span-2 md:col-span-3 text-[var(--lava-muted)]">{t('لا توجد منتجات تطابق بحثك أو القسم المحدد.', 'No products match your search or category.')}</p>
              ) : (
                shopItems.map((product) => {
                  const stockStatus = getProductStockStatus(product);
                  const totalStock = getProductTotalStock(product);
                  return (
                  <div
                    key={product.id}
                    className="bg-[var(--lava-card)] rounded-lg shadow-md overflow-hidden cursor-pointer group hover:shadow-xl transition relative"
                    onClick={() => openProductDetails(product)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                      className="absolute top-2 end-2 z-10 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-lg hover:scale-110 transition"
                      title={t('أضف إلى المفضلة', 'Add to wishlist')}
                    >
                      <span className={isInWishlist(product.id) ? 'text-red-600' : 'text-gray-300'}>❤</span>
                    </button>
                    <div className={`${theme.card.imageHeight || 'h-48 md:h-80'} overflow-hidden bg-[var(--lava-secondary)] relative`}>
                      <img loading="lazy" src={product.images[0]} alt={getLocalized(product.name)} className={`w-full h-full object-cover transition-opacity duration-500 ${product.images?.[1] && stockStatus !== 'out' ? 'absolute inset-0 group-hover:opacity-0' : 'group-hover:scale-105 transition-transform'} ${stockStatus === 'out' ? 'opacity-50 grayscale' : ''}`} />
                      {product.images?.[1] && stockStatus !== 'out' && (
                        <img loading="lazy" src={product.images[1]} alt={getLocalized(product.name)} className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      )}
                      {stockStatus === 'out' && (
                        <span className="absolute top-2 start-2 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded">{t('غير متوفر', 'Out of Stock')}</span>
                      )}
                      <LowStockBadge product={product} stockStatus={stockStatus} />
                      <DiscountBadge product={product} className="absolute top-2 end-12 text-xs font-bold px-2 py-1 rounded" />
                      {theme.card.showQuickAdd && stockStatus !== 'out' && (
                        <button
                          onClick={(e) => handleQuickAdd(e, product)}
                          style={{ backgroundColor: theme.card.quickAddBg || '#000000', color: theme.card.quickAddText || '#ffffff' }}
                          className="absolute bottom-0 inset-x-0 z-10 text-[11px] md:text-xs font-bold tracking-widest py-2.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300"
                        >
                          {t('إضافة سريعة', 'QUICK ADD')}
                        </button>
                      )}
                    </div>
                    <div className={`p-3 md:p-5 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      <span className="text-xs bg-[var(--lava-secondary)] text-[var(--lava-muted)] px-2.5 py-1 rounded-full font-semibold">{getLocalized(product.category)}</span>
                      <h3 className={`${theme.card.priceEmphasis === 'name' ? 'font-extrabold' : 'font-bold'} ${theme.card.nameFontSize || 'text-sm md:text-xl'} mt-2 mb-2`}>{getLocalized(product.name)}</h3>
                      {product.onSale && isSaleActive() ? (
                        <p className={`${theme.card.priceEmphasis === 'price' ? 'font-extrabold' : 'font-bold'} ${theme.card.priceFontSize || 'text-xs md:text-lg'}`}>
                          <span className="line-through text-[var(--lava-muted)] text-sm me-2">{product.price} {t('ج.م', 'EGP')}</span>
                          <span style={{ color: theme.card.saleColor || '#dc2626' }}>{product.salePrice} {t('ج.م', 'EGP')}</span>
                        </p>
                      ) : product.permanentSalePrice ? (
                        <p className={`${theme.card.priceEmphasis === 'price' ? 'font-extrabold' : 'font-bold'} ${theme.card.priceFontSize || 'text-xs md:text-lg'}`}>
                          <span className="line-through text-[var(--lava-muted)] text-sm me-2">{product.price} {t('ج.م', 'EGP')}</span>
                          <span style={{ color: theme.card.saleColor || '#dc2626' }}>{product.permanentSalePrice} {t('ج.م', 'EGP')}</span>
                        </p>
                      ) : (
                        <p className={`text-[var(--lava-muted)] ${theme.card.priceEmphasis === 'price' ? 'font-extrabold' : 'font-bold'} ${theme.card.priceFontSize || 'text-xs md:text-lg'}`}>{product.price} {t('ج.م', 'EGP')}</p>
                      )}
                      <ColorDots product={product} />
                      {stockStatus === 'out' ? (
                        <p className="text-xs font-bold text-red-600 mt-1">{t('غير متوفر', 'Out of Stock')}</p>
                      ) : stockStatus === 'low' ? (
                        <p className="text-xs font-bold text-orange-500 mt-1">{t(`باقي ${totalStock} فقط`, `Only ${totalStock} left`)}</p>
                      ) : null}
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {!shopInitialLoading && shopItems.length < shopTotal && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => fetchShopPage(shopPageNum + 1, true)}
                  disabled={shopLoadingMore}
                  className="bg-black text-white font-bold px-8 py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {shopLoadingMore ? t('جارٍ التحميل...', 'Loading...') : t('عرض المزيد', 'Load More')}
                </button>
              </div>
            )}
          </section>
  );
}