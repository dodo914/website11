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


export default function HomePage(props) {
  const { ProductsGrid, adminSettings, categories, currentPage, faqs, getLocalized, goTo, homeSections, isProductVisibleToCustomer, language, products, productsLoading, renderSectionsList, setSelectedCategoryFilter, t, theme } = props;
  return (
    <>
            <section
              className="relative w-full bg-cover bg-center flex items-end justify-start fade-in visible overflow-hidden"
              style={{ height: '85vh', backgroundImage: adminSettings.current.heroVideo ? 'none' : `url('${adminSettings.current.heroImage}')` }}
            >
              {adminSettings.current.heroVideo && (
                <video
                  src={adminSettings.current.heroVideo}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-black bg-opacity-40"></div>
              <div className={`relative z-10 p-8 md:p-16 text-white max-w-xl ${language === 'ar' ? 'text-right' : 'text-left'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <h1 className={`text-5xl md:text-6xl font-bold mb-4 drop-shadow-lg ${language === 'ar' ? 'text-right' : 'text-left'}`}>{getLocalized(adminSettings.current.heroTitle)}</h1>
                <p className={`text-lg mb-6 drop-shadow-md ${language === 'ar' ? 'text-right' : 'text-left'}`}>{getLocalized(adminSettings.current.heroSubtitle)}</p>
                <div className={language === 'ar' ? 'text-right' : 'text-left'}>
                  <button onClick={() => { setSelectedCategoryFilter('all'); goTo('shop'); }} style={{ backgroundColor: theme.colors.heroButtonBg || '#ffffff', color: theme.colors.heroButtonText || '#000000' }} className="font-bold py-3 px-8 rounded-full hover:opacity-85 transition shadow-lg">
                    {t('تسوق الآن', 'Shop Now')}
                  </button>
                </div>
              </div>
            </section>

            <section className="py-16 px-6 md:px-12 max-w-7xl mx-auto text-center fade-in">
              <h2 className="text-3xl font-bold mb-10 border-b-2 inline-block pb-2" style={{ borderColor: theme.colors.primary }}>{t('الأقسام', 'Categories')}</h2>

              {/* ===== scroll أفقي ===== */}
              {(theme.categories?.style === 'scroll' || theme.categories?.style === 'carousel') && (
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory -mx-6 px-6">
                  {categories.map(cat => (
                    <div key={cat.id}
                      className="flex-shrink-0 snap-start cursor-pointer group"
                      style={{ width: theme.categories?.style === 'carousel' ? 280 : 160 }}
                      onClick={() => { setSelectedCategoryFilter(getLocalized(cat.name)); goTo('shop'); }}
                    >
                      <div className={`overflow-hidden relative ${
                        theme.categories?.shape === 'circle' ? 'rounded-full aspect-square' :
                        theme.categories?.shape === 'rounded' ? 'rounded-xl' : 'rounded-none'
                      }`} style={{ height: theme.categories?.style === 'carousel' ? 200 : 160, backgroundColor: theme.colors.secondary }}>
                        <img loading="lazy" src={cat.image} alt={getLocalized(cat.name)} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                        {theme.categories?.showLabel !== 'none' && theme.categories?.labelStyle === 'overlay' && (
                          <div className={`absolute inset-0 bg-black/30 flex items-end p-3 transition ${theme.categories?.showLabel === 'hover' ? 'opacity-0 group-hover:opacity-100' : ''}`}>
                            <span className="text-white font-bold text-sm">{getLocalized(cat.name)}</span>
                          </div>
                        )}
                      </div>
                      {theme.categories?.showLabel !== 'none' && theme.categories?.labelStyle !== 'overlay' && (
                        <p className={`mt-2 font-semibold text-sm text-center transition ${theme.categories?.showLabel === 'hover' ? 'opacity-0 group-hover:opacity-100' : ''}`}
                          style={{ color: theme.colors.secondaryFg }}>
                          {getLocalized(cat.name)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ===== grid ===== */}
              {theme.categories?.style === 'grid' && (
                <div className={`grid gap-4 ${theme.categories?.columns === 3 ? 'grid-cols-3' : theme.categories?.columns === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  {categories.map(cat => (
                    <div key={cat.id} className="cursor-pointer group"
                      onClick={() => { setSelectedCategoryFilter(getLocalized(cat.name)); goTo('shop'); }}>
                      <div className={`overflow-hidden relative ${
                        theme.categories?.shape === 'circle' ? 'rounded-full aspect-square' :
                        theme.categories?.shape === 'rounded' ? 'rounded-xl' : 'rounded-none'
                      } h-40 md:h-56`} style={{ backgroundColor: theme.colors.secondary }}>
                        <img loading="lazy" src={cat.image} alt={getLocalized(cat.name)} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                        {theme.categories?.showLabel !== 'none' && theme.categories?.labelStyle === 'overlay' && (
                          <div className={`absolute inset-0 bg-black/30 flex items-end p-3 ${theme.categories?.showLabel === 'hover' ? 'opacity-0 group-hover:opacity-100 transition' : ''}`}>
                            <span className="text-white font-bold text-sm">{getLocalized(cat.name)}</span>
                          </div>
                        )}
                      </div>
                      {theme.categories?.showLabel !== 'none' && theme.categories?.labelStyle !== 'overlay' && (
                        <p className={`mt-2 font-semibold text-sm text-center ${theme.categories?.showLabel === 'hover' ? 'opacity-0 group-hover:opacity-100 transition' : ''}`}
                          style={{ color: theme.colors.secondaryFg }}>
                          {getLocalized(cat.name)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ===== list عمودية ===== */}
              {theme.categories?.style === 'list' && (
                <div className="space-y-3 max-w-2xl mx-auto">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-4 cursor-pointer group p-3 rounded-xl hover:shadow-md transition"
                      style={{ backgroundColor: theme.colors.cardBg }}
                      onClick={() => { setSelectedCategoryFilter(getLocalized(cat.name)); goTo('shop'); }}>
                      <div className="w-20 h-20 flex-shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: theme.colors.secondary }}>
                        <img loading="lazy" src={cat.image} alt={getLocalized(cat.name)} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                      </div>
                      <span className="font-bold text-lg" style={{ color: theme.colors.secondaryFg }}>{getLocalized(cat.name)}</span>
                      <span className="mr-auto text-xl opacity-40" style={{ color: theme.colors.secondaryFg }}>←</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== masonry (الافتراضي) ===== */}
              {(!theme.categories?.style || theme.categories?.style === 'masonry') && (
                <div className="grid grid-cols-2 gap-4">
                  {categories.map((cat, index) => {
                    const total = categories.length;
                    const isFirst = index === 0;
                    const isLast = index === total - 1;
                    const remainingCount = total - 1;
                    let colSpan = 'col-span-1';
                    let heightClass = 'h-64';
                    if (total > 2) {
                      if (isFirst) { colSpan = 'col-span-2'; heightClass = 'h-80'; }
                      else if (isLast && remainingCount % 2 === 1) { colSpan = 'col-span-2'; heightClass = 'h-48'; }
                    }
                    const shapeClass = theme.categories?.shape === 'circle' ? 'rounded-full' : theme.categories?.shape === 'rounded' ? 'rounded-xl' : 'rounded-none';
                    return (
                      <div key={cat.id} className={`${colSpan} group cursor-pointer`}
                        onClick={() => { setSelectedCategoryFilter(getLocalized(cat.name)); goTo('shop'); }}>
                        <div className={`${heightClass} ${shapeClass} overflow-hidden relative shadow-sm`} style={{ backgroundColor: theme.colors.secondary }}>
                          <img loading="lazy" src={cat.image} alt={getLocalized(cat.name)} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                          {isFirst && total > 2 && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <span className="text-white text-4xl font-bold">{getLocalized(cat.name)}</span>
                            </div>
                          )}
                        </div>
                        {!(isFirst && total > 2) && (
                          <h3 className="mt-3 text-lg font-semibold" style={{ color: theme.colors.secondaryFg }}>{getLocalized(cat.name)}</h3>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {homeSections.length > 0 && (
              <section className="py-12 px-6 md:px-12 max-w-7xl mx-auto fade-in">
                <div className="space-y-8">
                  {renderSectionsList(homeSections)}
                </div>
              </section>
            )}

            {/* ===== منتجات مميزة - شكل العرض يتحكم فيه الأدمن ===== */}
            {(() => {
              const featuredProds = products.filter(p => isProductVisibleToCustomer(p) && p.isFeatured);
              if (adminSettings.current.showFeaturedSection === false) return null;
              if (!productsLoading && featuredProds.length === 0) return null;
              return (
                <section className="py-12 px-4 md:px-12 max-w-7xl mx-auto fade-in">
                  <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center" style={{ color: theme.colors.secondaryFg }}>
                    {adminSettings.current.featuredSectionTitle
                      ? getLocalized(adminSettings.current.featuredSectionTitle)
                      : t('منتجات مميزة', 'Featured Products')}
                  </h2>
                  {productsLoading ? (
                    <div className={`grid ${theme.card.homeColsMobile || theme.card.colsMobile || 'grid-cols-2'} ${theme.card.homeColsDesktop || theme.card.colsDesktop || 'md:grid-cols-4'} ${theme.card.homeGapMobile || theme.card.gapMobile || 'gap-3'} ${theme.card.homeGapDesktop || theme.card.gapDesktop || 'md:gap-6'}`}>
                      {[1,2,3,4].map(i => (
                        <div key={i} className="rounded-lg bg-[var(--lava-secondary)] animate-pulse" style={{ height: 240 }} />
                      ))}
                    </div>
                  ) : (
                    <ProductsGrid
                      prods={featuredProds}
                      displayStyle={adminSettings.current.featuredDisplayStyle || 'grid'}
                    />
                  )}
                </section>
              );
            })()}

            {/* ===== نبذة عن المتجر ===== */}
            {adminSettings.current.showAboutSection !== false && (
              (adminSettings.current.aboutText?.ar || adminSettings.current.aboutText?.en || adminSettings.current.aboutImage || faqs.length > 0) && (
            <section className="py-10 md:py-16 px-4 md:px-12 fade-in" style={{ backgroundColor: theme.colors.bg }}>
              <div className="max-w-5xl mx-auto flex flex-col gap-8 md:gap-16">
                {(adminSettings.current.aboutImage || adminSettings.current.aboutText?.ar || adminSettings.current.aboutText?.en) && (
                <div className={`flex flex-col md:flex-row items-center gap-6 md:gap-8 ${language === 'ar' ? 'md:flex-row-reverse' : ''}`}>
                  {adminSettings.current.aboutImage && (
                  <div className="w-full md:flex-1 h-52 md:h-64 rounded-lg overflow-hidden shadow-lg">
                    <img loading="lazy" src={adminSettings.current.aboutImage} alt="About Store" className="w-full h-full object-cover" />
                  </div>
                  )}
                  <div className={`w-full md:flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">{t('عن', 'About')} {getLocalized(adminSettings.current.storeName)}</h2>
                    <p className="text-[var(--lava-muted)] leading-relaxed text-base md:text-lg">{getLocalized(adminSettings.current.aboutText)}</p>
                  </div>
                </div>
                )}

                {faqs.length > 0 && (
                <div id="faq-section" className="w-full p-5 md:p-8 rounded-lg shadow-sm" style={{ backgroundColor: theme.colors.secondary, color: theme.colors.secondaryFg }}>
                  <h2 className="text-2xl md:text-3xl font-bold mb-5 md:mb-6 text-center">{t('الأسئلة الشائعة', 'FAQ')}</h2>
                  <div className="space-y-3 md:space-y-4 max-w-3xl mx-auto">
                    {faqs.map(faq => (
                      <details key={faq.id} className="p-3 md:p-4 rounded shadow-sm cursor-pointer" style={{ backgroundColor: theme.colors.cardBg }}>
                        <summary className="font-semibold text-base md:text-lg">{getLocalized(faq.q)}</summary>
                        <p className="text-sm text-[var(--lava-muted)] mt-2">{getLocalized(faq.a)}</p>
                      </details>
                    ))}
                  </div>
                </div>
                )}
              </div>
            </section>
              )
            )}
          </>
  );
}