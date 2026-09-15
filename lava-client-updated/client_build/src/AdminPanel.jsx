import React, { useState, useEffect, useLayoutEffect, memo, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import { usePixels } from './usePixels';
import { authAPI } from './api/auth';
import { productsAPI } from './api/products';
import { ordersAPI, abandonedCartAPI, exchangeAPI } from './api/orders';
import { trafficAPI } from './api/traffic';
import { staffAPI } from './api/staff';
import { customersAPI } from './api/customers';
import { settingsAPI } from './api/settings';
import { paymentsAPI } from './api/payments';
import { shippingAPI } from './api/shipping';
import { activityLogsAPI } from './api/activityLogs';
import { THEMES, THEME_LIST, getTheme, DEFAULT_THEME_ID, PRESETS, FONT_OPTIONS, DEFAULT_FONT_ID, getFontOption } from './themes';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationBell from './components/NotificationBell';

// ===== [Lazy Loading] الصفحات/المكونات دي مش لازمة إلا لما الزائر يدخل عليها
// فعلاً (صفحة استرجاع/استبدال الضيوف، أداة بناء الثيمات في الأدمن، وصفحة
// التواصل) - React.lazy بيخليها تتحمّل في chunk منفصل بس وقت الحاجة، مش مع
// كل صفحات الموقع من البداية. الـfallback البسيط ده بيظهر لحظة التحميل بس. =====
const ThemeBuilder = lazy(() => import('./components/ThemeBuilder'));
const GuestReturnExchangePage = lazy(() => import('./pages/GuestReturnExchangePage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));

const PageLoadingFallback = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-10 h-10 border-4 border-[var(--lava-border)] border-t-black rounded-full animate-spin" />
  </div>
);


import { EGYPT_GOVERNORATES } from './constants/governorates';
import { RETURN_REASONS, EXCHANGE_REASONS, EXCHANGE_STATUS_LABELS, EXCHANGE_WORKFLOW_ORDER } from './constants/returnExchange';
import { EGYPT_PHONE_REGEX, isValidEgyptianPhone } from './utils/egyptPhone';
import { WELCOME_OFFER_STORAGE_KEY, loadWelcomeOfferFromStorage, saveWelcomeOfferToStorage } from './utils/welcomeOfferStorage';
import {
  CountdownTimer, LiveViewersBadge, InputField, SelectField, TextareaField,
  ImageUrlOrUploadField, VideoUploadField, MaskedKeyField, AdminPaginationBar,
} from './components/SharedFields';


export default function AdminPanel(props) {
  const { AVAILABLE_SIZE_OPTIONS, EXPENSE_CATEGORIES, PRODUCT_SECTION_TYPES, abandonedCartIdleMinutes, abandonedCartIdleMinutesInput, abandonedCarts, abandonedCartsLoading, abandonedCartsPage, abandonedCartsPageSize, abandonedCartsTotal, abandonedCartsTotalPages, activeSegmentKey, activityLogFilter, activityLogs, activityLogsLoading, activityLogsPage, activityLogsPageSize, activityLogsTotal, activityLogsTotalPages, addCustomPage, addCustomPageSection, addHomeSection, adminAuthConfig, adminExchangeFormLoading, adminExchangeFormNote, adminExchangeFormOrderId, adminExchangeFormProducts, adminExchangeFormReasonCode, adminExchangeFormSelection, adminExchangeRequests, adminOtpCode, adminOtpCooldown, adminOtpSending, adminOtpSent, adminOtpSentTo, adminProductFilter, adminProductSearch, adminReviews, adminReviewsLoading, adminReviewsStatusFilter, adminSettings, adminSidebarOpen, adminTab, apiSubTab, brevoBusy, brevoCampaign, brevoConfigured, brevoMarketing, brevoStats, bumpSettings, bundleDiscountPercent, bundleProductIds, campaignFormOpen, campaignProductSearch, canAccess, cancellingShipmentOrderId, cartFilter, cartSearch, categories, closeProductEditor, confirmDeleteProductId, contactMessages, countries, creatingShipmentOrderId, currentPage, customPages, customerOrdersLoading, customerSegments, customerSegmentsLoading, customersList, customersLoading, customersPage, customersPageSize, customersTotal, customersTotalPages, deleteAdminReview, deleteCustomPage, deleteCustomPageSection, deleteHomeSection, deleteProduct, deletePromotion, discountCodes, duplicateProduct, editShippingCompany, editShippingNotes, editShippingStatus, editTrackingNumber, editingFaqId, editingProductOfferId, editingPromotionId, editingShippingOrderId, editingStaffId, editingStaffPermissions, exchangeReviewLoadingId, exchangeReviewReasonCodeById, exchangeStatusUpdatingId, exchangeSyncingId, exchangeTrackingInputById, exchangeTrackingSavingId, expandedCart, expandedOrderIds, expenses, exportAllOrders, exportCatalog, exportConfirmedOrders, exportRangePreset, setExportRangePreset, exportRangeFrom, setExportRangeFrom, exportRangeTo, setExportRangeTo, faqs, fetchAbandonedCarts, fetchActivityLogs, fetchCustomerSegments, fetchCustomers, fetchOrders, fetchReAdminList, fetchStoreHealth, fetchTrafficStats, fetchingLabelOrderId, generateVariantsPreview, getCanonicalVariantId, getDefaultVariant, getLocalized, getLowStockThreshold, getProductCategoryId, getProductOfferThreshold, getProductStockStatus, getPromotionLabel, getSizeStockArray, getVariants, governorates, handleColorImageDragStart, handleColorImageDrop, handleColorImageUpload, handleImageDragStart, handleImageDrop, handleProductImageUpload, handleProductRecSelect, handleReAdminExchangeInspect, handleReAdminExchangeStatus, handleReAdminMoneyTransfer, handleReAdminReturnInspect, handleReAdminReturnStatus, handleReAdminReview, handleSaveProduct, handleSendAdminOtp, handleWelcomeOfferImageUpload, hasColors, homeSections, isProductVisibleToCustomer, isPromotionCurrentlyActive, isSavingProduct, kashierAdminStatus, kashierAdminStatusLoading, language, loyaltyProgram, moderateReviewStatus, moveColorImage, newCatImg, newCatNameAr, newCatNameEn, newExpenseAmount, newExpenseCategory, newExpenseDate, newExpenseTitle, newFaqAAr, newFaqAEn, newFaqQAr, newFaqQEn, newGovCost, newGovCountryId, newGovNameAr, newGovNameEn, newPageSectionButtonAction, newPageSectionButtonTextAr, newPageSectionButtonTextEn, newPageSectionDescAr, newPageSectionDescEn, newPageSectionDisplayStyle, newPageSectionImage, newPageSectionProductCount, newPageSectionProductIds, newPageSectionTitleAr, newPageSectionTitleEn, newPageSectionType, newPageTitleAr, newPageTitleEn, newProdCat, newProdColorHex, newProdColorImages, newProdColorNameAr, newProdColorNameEn, newProdColors, newProdCost, newProdCustomSize, newProdDescAr, newProdDescEn, newProdEnableBundle, newProdEnableRec, newProdEnableReviews, newProdHasColors, newProdHasSizes, newProdImageFiles, newProdImgs, newProdIsFeatured, newProdLowStockThreshold, newProdMetaDescAr, newProdMetaDescEn, newProdMetaKeywordsAr, newProdMetaKeywordsEn, newProdMetaTitleAr, newProdMetaTitleEn, newProdNameAr, newProdNameEn, newProdOnSale, newProdPermanentSalePrice, newProdPrice, newProdSalePrice, newProdSelectedSizes, newProdSlug, newProdVariantStockInputs, newProdVariantsGenerated, newProdVideo, newProdVisibility, newPromoBuyQty, newPromoCategoryId, newPromoDiscountPercent, newPromoEndDate, newPromoFixedAmount, newPromoFreeQty, newPromoMinQty, newPromoName, newPromoPercentage, newPromoProductId, newPromoStartDate, newPromoTarget, newPromoType, newSectionButtonAction, newSectionButtonTextAr, newSectionButtonTextEn, newSectionCategoryId, newSectionDescAr, newSectionDescEn, newSectionDisplayStyle, newSectionImage, newSectionProductCount, newSectionProductIds, newSectionTitleAr, newSectionTitleEn, newSectionType, newStaffEmail, newStaffName, newStaffPassword, newStaffPermissions, newStaffPhone, newStaffRole, onlineNow, openAddProduct, openEditCampaignForm, openEditProduct, openEditSection, openNewCampaignForm, openProductDetails, openReAdminDetails, orderPaymentFilter, orders, ordersLoading, ordersPage, ordersPageSize, ordersTotal, ordersTotalPages, paymentsDashboard, paymentsDashboardLoading, paymobAdminStatus, paymobAdminStatusLoading, poActive, poBuyQty, poDiscountPercent, poFixedAmount, poFreeQty, poMinQty, poName, poType, productEditorDirty, productEditorTab, productManagerMode, productOfferFormOpen, products, productsRef, promoPreviewLang, promotions, promotionsSubTab, reAdminActionLoading, reAdminDateFrom, reAdminDateTo, reAdminList, reAdminLoading, reAdminMoneyAmount, reAdminMoneyDirection, reAdminMoneyMethod, reAdminMoneySaving, reAdminNewReasonAr, reAdminNewReasonEn, reAdminNewReasonType, reAdminNoteDraft, reAdminSearch, reAdminSelected, reAdminSelectedLoading, reAdminStatusFilter, reAdminSubTab, reAdminTypeFilter, reByOrderId, recEnableBundle, recEnableRec, recProductIds, recSearchQuery, refundAmountByOrder, refundLoadingOrderId, revenueStats, revenueStatsLoading, revenueBreakdown, revenueBreakdownLoading, customerStats, customerStatsLoading, salesTrend, salesTrendLoading, dashboardExtras, dashboardExtrasLoading, yearlyComparison, yearlyComparisonLoading, abandonedCartStats, abandonedCartStatsLoading, removeColorImage, removeProductImage, resetCampaignForm, returnFormLoading, returnFormOrderId, returnFormReason, returnFormReasonCode, returnFormSelection, returnFormShippingCost, returnReviewLoadingOrderId, returnReviewReasonCodeByOrder, returnSyncingOrderId, returnTrackingInputByOrder, returnTrackingSavingOrderId, saveAbandonedCartIdleMinutes, saveAdminSettings, saveCampaignPromotion, saveRecommendations, savingAbandonedCartIdleMinutes, sectionButtonActions, selectedCustomer, selectedCustomerOrders, selectedManagedProductId, selectedPageForSection, selectedProductForRec, setAbandonedCartIdleMinutesInput, setAbandonedCartsPage, setAbandonedCartsPageSize, setActiveSegmentKey, setActivityLogFilter, setActivityLogsPage, setActivityLogsPageSize, setAdminAuthConfig, setAdminExchangeFormLoading, setAdminExchangeFormNote, setAdminExchangeFormOrderId, setAdminExchangeFormProducts, setAdminExchangeFormReasonCode, setAdminExchangeFormSelection, setAdminExchangeRequests, setAdminOtpCode, setAdminOtpSent, setAdminOtpSentTo, setAdminProductFilter, setAdminProductSearch, setAdminReviewsStatusFilter, setAdminSidebarOpen, setAdminTab, setApiSubTab, setBrevoBusy, setBrevoCampaign, setBrevoConfigured, setBrevoMarketing, setBundleDiscountPercent, setBundleProductIds, setCampaignProductSearch, setCancellingShipmentOrderId, setCartFilter, setCartSearch, setCategories, setColorImageAsPrimary, setConfirmDeleteProductId, setCountries, setCreatingShipmentOrderId, setCustomerOrdersLoading, setCustomersPage, setCustomersPageSize, setDiscountCodes, setEditShippingCompany, setEditShippingNotes, setEditShippingStatus, setEditTrackingNumber, setEditingFaqId, setEditingProductOfferId, setEditingShippingOrderId, setEditingStaffId, setEditingStaffPermissions, setExchangeReviewLoadingId, setExchangeReviewReasonCodeById, setExchangeStatusUpdatingId, setExchangeSyncingId, setExchangeTrackingInputById, setExchangeTrackingSavingId, setExpandedCart, setExpandedOrderIds, setExpenses, setFaqs, setFetchingLabelOrderId, setGovernorates, setKashierAdminStatus, setKashierAdminStatusLoading, setLoyaltyProgram, setNewCatImg, setNewCatNameAr, setNewCatNameEn, setNewExpenseAmount, setNewExpenseCategory, setNewExpenseDate, setNewExpenseTitle, setNewFaqAAr, setNewFaqAEn, setNewFaqQAr, setNewFaqQEn, setNewGovCost, setNewGovCountryId, setNewGovNameAr, setNewGovNameEn, setNewPageSectionButtonAction, setNewPageSectionButtonTextAr, setNewPageSectionButtonTextEn, setNewPageSectionDescAr, setNewPageSectionDescEn, setNewPageSectionDisplayStyle, setNewPageSectionImage, setNewPageSectionProductCount, setNewPageSectionProductIds, setNewPageSectionTitleAr, setNewPageSectionTitleEn, setNewPageSectionType, setNewPageTitleAr, setNewPageTitleEn, setNewProdCat, setNewProdColorHex, setNewProdColorImages, setNewProdColorNameAr, setNewProdColorNameEn, setNewProdColors, setNewProdCost, setNewProdCustomSize, setNewProdDescAr, setNewProdDescEn, setNewProdEnableBundle, setNewProdEnableRec, setNewProdEnableReviews, setNewProdHasColors, setNewProdHasSizes, setNewProdImgs, setNewProdIsFeatured, setNewProdLowStockThreshold, setNewProdMetaDescAr, setNewProdMetaDescEn, setNewProdMetaKeywordsAr, setNewProdMetaKeywordsEn, setNewProdMetaTitleAr, setNewProdMetaTitleEn, setNewProdNameAr, setNewProdNameEn, setNewProdOnSale, setNewProdPermanentSalePrice, setNewProdPrice, setNewProdSalePrice, setNewProdSelectedSizes, setNewProdSlug, setNewProdVariantStockInputs, setNewProdVariantsGenerated, setNewProdVideo, setNewProdVisibility, setNewPromoBuyQty, setNewPromoCategoryId, setNewPromoDiscountPercent, setNewPromoEndDate, setNewPromoFixedAmount, setNewPromoFreeQty, setNewPromoMinQty, setNewPromoName, setNewPromoPercentage, setNewPromoProductId, setNewPromoStartDate, setNewPromoTarget, setNewPromoType, setNewSectionButtonAction, setNewSectionButtonTextAr, setNewSectionButtonTextEn, setNewSectionCategoryId, setNewSectionDescAr, setNewSectionDescEn, setNewSectionDisplayStyle, setNewSectionImage, setNewSectionProductCount, setNewSectionProductIds, setNewSectionTitleAr, setNewSectionTitleEn, setNewSectionType, setNewStaffEmail, setNewStaffName, setNewStaffPassword, setNewStaffPermissions, setNewStaffPhone, setNewStaffRole, setOrderPaymentFilter, setOrders, setOrdersPage, setOrdersPageSize, setPaymentsDashboard, setPaymobAdminStatus, setPaymobAdminStatusLoading, setPoActive, setPoBuyQty, setPoDiscountPercent, setPoFixedAmount, setPoFreeQty, setPoMinQty, setPoName, setPoType, setProductEditorDirty, setProductEditorTab, setProductImageAsPrimary, setProductOfferFormOpen, setProductVisibility, setProducts, setPromoPreviewLang, setPromotionsSubTab, setReAdminDateFrom, setReAdminDateTo, setReAdminMoneyAmount, setReAdminMoneyDirection, setReAdminMoneyMethod, setReAdminNewReasonAr, setReAdminNewReasonEn, setReAdminNewReasonType, setReAdminNoteDraft, setReAdminSearch, setReAdminSelected, setReAdminStatusFilter, setReAdminSubTab, setReAdminTypeFilter, setRecEnableBundle, setRecEnableRec, setRecProductIds, setRecSearchQuery, setRefundAmountByOrder, setRefundLoadingOrderId, setReturnFormLoading, setReturnFormOrderId, setReturnFormReason, setReturnFormReasonCode, setReturnFormSelection, setReturnFormShippingCost, setReturnReviewLoadingOrderId, setReturnReviewReasonCodeByOrder, setReturnSyncingOrderId, setReturnTrackingInputByOrder, setReturnTrackingSavingOrderId, setSelectedCustomer, setSelectedCustomerOrders, setSelectedPageForSection, setShippingConnectionResults, setShippingFilter, setShippingSearch, setStaffList, setStatsCustomFrom, setStatsCustomTo, setStatsPeriod, setTestingProviderKey, setTrackingShipmentOrderId, setTrafficDays, setWelcomeOfferPreviewLang, setWelcomeOfferProductSearch, shippingConnectionResults, shippingDashboard, shippingDashboardLoading, shippingFilter, shippingProviders, shippingSearch, showToast, staffList, staffSections, statsCustomFrom, statsCustomTo, statsOrders, statsOrdersLoading, statsPeriod, storeHealth, storeHealthLoading, t, testingProviderKey, toDatetimeLocalValue, toggleCustomPageInNav, toggleOrderExpand, togglePromotionActive, trackingShipmentOrderId, trafficDays, trafficLoading, trafficStats, user, welcomeOfferPreviewLang, welcomeOfferProductSearch } = props;

  // ===== إضافة: خانة كتابة كود التتبع في مودال تفاصيل الطلب في تبويب
  // "الاسترجاع والاستبدال" الموحّد - نفس الخانة الموجودة في تبويب الأوردرات
  // (returnTrackingInputByOrder / exchangeTrackingInputById) لكن هنا بتخدم
  // reAdminSelected (سواء استرجاع أو استبدال) في نفس المكان. =====
  const [reAdminTrackingInput, setReAdminTrackingInput] = useState(null);
  const [reAdminTrackingSaving, setReAdminTrackingSaving] = useState(false);
  const [reAdminTrackingSyncing, setReAdminTrackingSyncing] = useState(false);
  // ===== معاينة المنتج المرتجع/القديم بعد وصوله فعليًا - بتقرر رجوع المخزون
  // (كويس -> يرجع، مش كويس -> منرجعوش) - شوف inspectReturnRequest /
  // inspectExchangeRequest في الباك اند. مستخدمة جوه قسم الاسترجاع والاستبدال
  // تحت (كل واحد بيستدعيها بمنطق applyUpdatedOrder الخاص بيه). =====
  const [inspectSavingId, setInspectSavingId] = useState(null);
  const reAdminTrackingKey = reAdminSelected
    ? (reAdminSelected.type === 'return'
        ? String(reAdminSelected.data.orderId || reAdminSelected.data.order?._id || '')
        : String(reAdminSelected.data._id || ''))
    : null;
  useEffect(() => {
    setReAdminTrackingInput(null);
  }, [reAdminTrackingKey]);

  return (
    <section className="py-8 md:py-16 px-3 sm:px-6 md:px-12 max-w-7xl mx-auto" dir="rtl">
            <h1 className="text-2xl md:text-4xl font-extrabold mb-3 md:mb-4 text-center">{t('لوحة تحكم المتجر', 'Dashboard')}</h1>
            <NotificationBell />
            <p className="text-center text-[var(--lava-muted)] mb-6 md:mb-8 text-sm md:text-base font-semibold">{t('الصلاحية:', 'Role:')} <span className="text-red-600">{user.role === 'admin' ? t('المدير', 'Admin') : user.role === 'packer' ? t('محضر طلبات', 'Packer') : user.role === 'staff' ? t('موظف بصلاحيات مخصصة', 'Custom permissions staff') : t('مؤكد طلبات', 'Call Center')}</span></p>

            {(() => {
              // ===== تجميع تبويبات الأدمن في قائمة جانبية منظمة حسب القسم =====
              // كل قسم وكل تبويب معاه "hint" وصف قصير — بيتعرض كـ tooltip وكمان في هيدر الصفحة
              // عشان أي حد جديد يدخل يفهم كل تبويب بيعمل إيه من غير ما حد يشرحله.
              const sidebarGroups = [
                {
                  section: t('نظرة عامة', 'OVERVIEW'),
                  hint: t('ملخص سريع لحالة المتجر والأداء العام', 'Quick summary of store status and overall performance'),
                  items: [
                    { key: 'stats', label: t('لوحة البيانات', 'Dashboard'), icon: '📊', hint: t('أرقام وإحصائيات المبيعات والزوار في نظرة واحدة', 'Sales and visitor stats at a glance') },
                    { key: 'store_health', label: t('جاهزية المتجر', 'Store Health'), icon: '🟠', hint: t('فحص سريع لو فيه مشاكل أو نواقص في إعدادات المتجر', 'Quick check for issues or missing store setup') },
                  ],
                },
                {
                  section: t('المتجر', 'STORE'),
                  hint: t('كل حاجة تخص المنتجات والطلبات وحركة البيع', 'Everything about products, orders, and sales flow'),
                  items: [
                    { key: 'orders', label: t('الطلبات', 'Orders'), icon: '📦', alwaysVisible: true, hint: t('عرض ومتابعة كل طلبات العملاء وتغيير حالتها', 'View and manage all customer orders and their status') },
                    { key: 'returns_exchanges', label: t('الاسترجاع والاستبدال', 'Returns & Exchanges'), icon: '🔄', hint: t('متابعة طلبات الاسترجاع والاستبدال، الإعدادات، وإدارة الأسباب', 'Track return/exchange requests, settings, and reasons') },
                    { key: 'products', label: t('المنتجات', 'Products'), icon: '👕', hint: t('إضافة وتعديل منتجات المتجر ومقاساتها وألوانها ومخزونها', 'Add and edit store products, variants, and stock') },
                    { key: 'categories', label: t('الأقسام', 'Categories'), icon: '📁', hint: t('تقسيم المنتجات على أقسام عشان تظهر منظمة في المتجر', 'Organize products into categories for the storefront') },
                    { key: 'payments_dashboard', label: t('المدفوعات', 'Payments'), icon: '💳', hint: t('متابعة حالة الدفع لكل طلب (مدفوع / لسه مستني)', 'Track payment status per order (paid / pending)') },
                    { key: 'shipping_dashboard', label: t('لوحة الشحن', 'Shipping Board'), icon: '🚚', hint: t('متابعة الطلبات بعد التجهيز لحد ما توصل للعميل', 'Track orders after packing until delivery') },
                    { key: 'abandoned_carts', label: t('السلات المتروكة', 'Abandoned Carts'), icon: '🛒', hint: t('عملاء ضافوا منتجات ومكملوش الطلب — ممكن تتابعهم', 'Customers who added items but didn\'t finish checkout') },
                  ],
                },
                {
                  section: t('العملاء', 'CUSTOMERS'),
                  hint: t('كل حاجة تخص العملاء وتفاعلهم مع المتجر', 'Everything about customers and their interactions'),
                  items: [
                    { key: 'customers', label: t('العملاء', 'Customers'), icon: '🧑‍💼', hint: t('قايمة كل العملاء المسجلين وعدد وقيمة طلباتهم', 'List of registered customers and their order history') },
                    { key: 'customer_segments', label: t('شرائح العملاء', 'Customer Segments'), icon: '🟡', hint: t('تقسيم العملاء حسب سلوكهم (زبون دايم، زبون جديد...)', 'Group customers by behavior (loyal, new, etc.)') },
                    { key: 'messages', label: t('الرسائل', 'Messages'), icon: '✉️', hint: t('رسائل التواصل اللي بعتها العملاء من فورم "اتصل بينا"', 'Contact-form messages sent by customers') },
                    { key: 'reviews', label: t('تقييمات العملاء', 'Customer Reviews'), icon: '⭐', hint: t('تقييمات وآراء العملاء على المنتجات', 'Customer ratings and reviews on products') },
                  ],
                },
                {
                  section: t('التسويق', 'MARKETING'),
                  hint: t('أدوات زيادة المبيعات والوصول للعملاء', 'Tools to boost sales and reach customers'),
                  items: [
                    { key: 'promotions', label: t('العروض الترويجية', 'Promotions'), icon: '🎁', hint: t('عروض وخصومات مؤقتة على المتجر أو منتجات معينة', 'Temporary offers and discounts store-wide or per product') },
                    { key: 'discounts', label: t('أكواد الخصم', 'Discounts'), icon: '🏷️', hint: t('أكواد كوبون يدخلها العميل وقت الشراء عشان يخصم', 'Coupon codes customers apply at checkout') },
                    { key: 'loyalty', label: t('الولاء', 'Loyalty'), icon: '🏆', hint: t('نظام نقاط أو مكافآت للعملاء اللي بيشتروا باستمرار', 'Points/rewards system for repeat customers') },
                    { key: 'recommendations', label: t('التوصيات والعروض', 'Recommendations & Offers'), icon: '🎯', hint: t('اقتراح منتجات تانية للعميل زي "منتجات ذات صلة"', 'Suggested products like "related items"') },
                    { key: 'brevo_marketing', label: t('Brevo Marketing', 'Brevo Marketing'), icon: '📨', hint: t('إرسال إيميلات تسويقية جماعية للعملاء عن طريق Brevo', 'Send bulk marketing emails to customers via Brevo') },
                    { key: 'traffic', label: t('الزيارات والترافيك', 'Traffic & Visitors'), icon: '📊', hint: t('عدد زوار المتجر ومصادرهم وسلوكهم', 'Store visitor numbers, sources, and behavior') },
                  ],
                },
                {
                  section: t('العمليات', 'OPERATIONS'),
                  hint: t('الإدارة الداخلية للمتجر والفريق', 'Internal store and team management'),
                  items: [
                    { key: 'shipping', label: t('الشحن', 'Shipping'), icon: '🚚', hint: t('إعداد مناطق ورسوم وشركات الشحن', 'Configure shipping zones, fees, and couriers') },
                    { key: 'expenses', label: t('المصاريف', 'Expenses'), icon: '💸', hint: t('تسجيل مصاريف المتجر لحساب الأرباح الحقيقية', 'Log store expenses to track real profit') },
                    { key: 'staff', label: t('الموظفين', 'Staff'), icon: '👥', hint: t('إضافة موظفين وتحديد صلاحيات كل واحد فيهم', 'Add staff members and set their permissions') },
                    { key: 'activity_log', label: t('سجل النشاط', 'Activity Log'), icon: '🟡', hint: t('سجل بكل التعديلات اللي حصلت في لوحة التحكم ومين عملها', 'Log of every change made in the dashboard and by whom') },
                  ],
                },
                {
                  section: t('المحتوى', 'CONTENT'),
                  hint: t('شكل ومحتوى صفحات المتجر اللي بيشوفها العميل', 'Look and content of the pages customers see'),
                  items: [
                    { key: 'home_sections', label: t('الصفحة الرئيسية', 'Homepage'), icon: '🏠', hint: t('ترتيب وتحكم في الأقسام الظاهرة بالصفحة الرئيسية', 'Arrange and control sections shown on the homepage') },
                    { key: 'content', label: t('شكل الموقع والعداد', 'Design & Timer'), icon: '⚙️', hint: t('ألوان وشكل عام للمتجر، وعداد العروض المؤقتة', 'Store colors/appearance and countdown timers') },
                    { key: 'themes', label: t('الثيمات', 'Themes'), icon: '🎨', hint: t('اختيار وتخصيص شكل المتجر العام (ثيم)', 'Pick and customize the overall store theme') },
                    { key: 'custom_pages', label: t('الصفحات', 'Pages'), icon: '📄', hint: t('صفحات ثابتة زي "من نحن" أو "سياسة الاستبدال"', 'Static pages like "About us" or "Return policy"') },
                    { key: 'faqs', label: t('الأسئلة الشائعة', 'FAQs'), icon: '❓', hint: t('الأسئلة المتكررة اللي بتظهر للعميل في المتجر', 'Frequently asked questions shown to customers') },
                  ],
                },
                {
                  section: t('الإعدادات', 'SETTINGS'),
                  hint: t('إعدادات تقنية وأمان عامة للمتجر', 'General technical and security settings'),
                  items: [
                    { key: 'checkout_settings', label: t('إعدادات التشيك اوت', 'Checkout Settings'), icon: '🧾', hint: t('التحكم في خطوات وحقول صفحة إتمام الشراء', 'Control the checkout page steps and fields') },
                    { key: 'payment_settings', label: t('إعدادات الدفع', 'Payment Settings'), icon: '💳', hint: t('تفعيل أو إيقاف الدفع اليدوي وKashier وPaymob ومتابعة حالة الاتصال', 'Enable or disable manual payment, Kashier and Paymob, and check connection status') },
                    { key: 'seo_settings', label: t('تحسين محركات البحث (SEO)', 'SEO'), icon: '🔎', hint: t('عنوان ووصف المتجر في نتائج البحث، الكلمات المفتاحية، وربط أدوات جوجل', 'Store title/description in search results, keywords, and Google tools') },
                    { key: 'auth_settings', label: t('تسجيل الدخول والأمان', 'Login & Security'), icon: '🔐', hint: t('إعدادات تسجيل دخول العملاء والتحقق والأمان', 'Customer login, verification, and security settings') },
                    { key: 'apikeys', label: t('مفاتيح API / التتبع', 'API / Tracking'), icon: '🔑', hint: t('ربط بيكسلات فيسبوك وتيك توك وجوجل لتتبع الإعلانات', 'Connect Facebook/TikTok/Google pixels for ad tracking') },
                  ],
                },
              ];

              // ===== خريطة تبويب لوحة التحكم → القسم المطابق له في نظام الصلاحيات بالسيرفر =====
              const TAB_SECTION_MAP = {
                stats: 'settings', apikeys: 'settings', products: 'products',
                categories: 'settings', shipping: 'settings', auth_settings: 'auth_settings',
                checkout_settings: 'settings', payment_settings: 'settings', seo_settings: 'settings', promotions: 'settings', discounts: 'settings',
                loyalty: 'settings', expenses: 'settings', faqs: 'settings', messages: 'messages',
                customers: 'customers', customer_segments: 'customer_segments', store_health: 'store_health',
                activity_log: 'activity_log', traffic: 'traffic', payments_dashboard: 'payments_dashboard',
                shipping_dashboard: 'shipping_dashboard', abandoned_carts: 'abandoned_carts',
                brevo_marketing: 'brevo_marketing', themes: 'settings', content: 'settings',
                home_sections: 'settings', custom_pages: 'settings', recommendations: 'settings',
                orders: 'orders', returns_exchanges: 'orders',
                // 'staff' مقصود عدم وجوده هنا — إدارة الموظفين للأدمن بس
              };

              // ===== الموظفين غير الأدمن (محضر/مؤكد طلبات أو صلاحيات مخصصة) بيشوفوا اللي مسموحلهم بيه بس =====
              // ===== [RBAC FIX] "alwaysVisible" (زي تبويب الطلبات) كان بيتفعّل لأي دور بما فيهم
              // "staff" (صلاحيات مخصصة) حتى لو الأدمن ماداهوش صلاحية "orders" أصلاً - فكان الموظف
              // بصلاحيات مخصصة يشوف الطلبات دايمًا غصب عنه، وبقية الأقسام تختفي (لو مشكلة الصلاحيات
              // الفاضية مأثرتش على canAccess زي ما كانت). دلوقتي alwaysVisible بيفضل شغال زي ما هو بس
              // لموظفي "كول سنتر/باكر" (اللي أصلاً مالهمش نظام صلاحيات مخصصة)، أما "staff" فلازم
              // يعدي من canAccess() الحقيقي زي أي قسم تاني - بدون أي استثناء. =====
              const visibleGroups = sidebarGroups
                .map(g => ({
                  ...g,
                  items: g.items.filter(i => {
                    if (user.role === 'admin') return true;
                    if (i.alwaysVisible && (user.role === 'call_center' || user.role === 'packer')) return true;
                    return user.role === 'staff' && canAccess(TAB_SECTION_MAP[i.key]);
                  }),
                }))
                .filter(g => g.items.length > 0);

              const currentItem = visibleGroups.flatMap(g => g.items).find(i => i.key === adminTab);

              const renderNav = (closeOnSelect) => (
                <nav className="space-y-5">
                  {visibleGroups.map(group => (
                    <div key={group.section}>
                      <p
                        className="text-[11px] font-extrabold tracking-wider text-[var(--lava-muted)] uppercase px-2 mb-1.5"
                        title={group.hint}
                      >
                        {group.section}
                      </p>
                      <div className="space-y-1">
                        {group.items.map(item => (
                          <button
                            key={item.key}
                            onClick={() => { setAdminTab(item.key); if (closeOnSelect) setAdminSidebarOpen(false); }}
                            title={item.hint}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold text-start transition ${adminTab === item.key ? 'bg-black text-white' : 'text-[var(--lava-muted)] hover:bg-[var(--lava-secondary)]'}`}
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              );

              return (
                <>
                  {/* ===== زرار فتح القائمة على الموبايل ===== */}
                  <div className="lg:hidden mb-4">
                    <button
                      onClick={() => setAdminSidebarOpen(true)}
                      className="w-full bg-[var(--lava-card)] border rounded-xl px-4 py-3 font-bold text-sm flex items-center justify-between gap-2 shadow-sm"
                    >
                      <span className="flex items-center gap-2 flex-shrink-0">☰ {t('القائمة', 'Menu')}</span>
                      <span className="text-[var(--lava-muted)] text-xs font-semibold truncate min-w-0">{currentItem ? `${currentItem.icon} ${currentItem.label}` : ''}</span>
                    </button>
                  </div>

                  {/* ===== درج القائمة على الموبايل ===== */}
                  {adminSidebarOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                      <div className="absolute inset-0 bg-black/50" onClick={() => setAdminSidebarOpen(false)}></div>
                      <div className={`absolute top-0 ${language === 'ar' ? 'right-0' : 'left-0'} h-full w-72 max-w-[85%] bg-[var(--lava-card)] shadow-xl overflow-y-auto p-4`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-extrabold">{t('لوحة تحكم المتجر', 'Dashboard')}</h3>
                          <button onClick={() => setAdminSidebarOpen(false)} className="text-[var(--lava-muted)] text-2xl leading-none">✕</button>
                        </div>
                        {renderNav(true)}
                      </div>
                    </div>
                  )}

                  {/* ===== صف الشاشة: القائمة الجانبية (ديسكتوب) + المحتوى ===== */}
                  <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <aside className="hidden lg:block w-64 flex-shrink-0 bg-[var(--lava-card)] border rounded-xl shadow-sm p-4 sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
                      {renderNav(false)}
                    </aside>

                    {/* ===== منطقة المحتوى الرئيسية ===== */}
                    <div className="flex-1 w-full min-w-0 space-y-8">

            {/* ===== بانر توضيحي بيظهر فوق أي تبويب — بيشرح باختصار الصفحة دي بتعمل إيه، عشان أي حد جديد يفهم لوحده ===== */}
            {currentItem?.hint && (
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 text-blue-800 rounded-lg px-4 py-2.5 text-sm">
                <span className="text-base leading-none mt-0.5">{currentItem.icon}</span>
                <p><span className="font-bold">{currentItem.label}:</span> {currentItem.hint}</p>
              </div>
            )}

            {/* ===== تبويب الإحصائيات ===== */}
            {adminTab === 'stats' && canAccess('settings') && (
              <div className="bg-[var(--lava-secondary)] p-6 md:p-8 rounded-xl shadow-md space-y-6 border">
                <h2 className="text-3xl font-extrabold mb-2 text-[var(--lava-text)] border-b pb-4">{t('لوحة البيانات', 'Dashboard')}</h2>
                {statsOrdersLoading && statsOrders.length === 0 && (
                  <p className="text-sm text-[var(--lava-muted)]">{t('جاري تحميل كل الطلبات...', 'Loading all orders...')}</p>
                )}
                {(() => {
                  // كل حسابات لوحة البيانات (خصوصًا الإيرادات) لازم تكون على كل
                  // الطلبات مش صفحة واحدة بس — عشان كده بنستخدم statsOrders هنا
                  // (بتتحمل كاملة لوحدها) بدل الـ orders العادية اللي مقسّمة صفحات.
                  const orders = statsOrders;
                  const now = new Date();

                  // ===== حساب نطاق التاريخ حسب الفترة المختارة =====
                  let rangeStart = null;
                  let rangeEnd = new Date(now);
                  rangeEnd.setHours(23, 59, 59, 999);

                  if (statsPeriod === '7days') {
                    rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 6); rangeStart.setHours(0,0,0,0);
                  } else if (statsPeriod === '14days') {
                    rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 13); rangeStart.setHours(0,0,0,0);
                  } else if (statsPeriod === '30days') {
                    rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 29); rangeStart.setHours(0,0,0,0);
                  } else if (statsPeriod === '90days') {
                    rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 89); rangeStart.setHours(0,0,0,0);
                  } else if (statsPeriod === 'monthly') {
                    rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1); rangeStart.setHours(0,0,0,0);
                  } else if (statsPeriod === 'yearly') {
                    rangeStart = new Date(now.getFullYear() - 3, 0, 1); rangeStart.setHours(0,0,0,0);
                  } else if (statsPeriod === 'custom') {
                    if (statsCustomFrom) { rangeStart = new Date(statsCustomFrom); rangeStart.setHours(0,0,0,0); }
                    if (statsCustomTo) { rangeEnd = new Date(statsCustomTo); rangeEnd.setHours(23,59,59,999); }
                  }

                  // فلترة الأوردرات حسب النطاق
                  const filteredOrders = rangeStart
                    ? orders.filter(o => {
                        if (!o.createdAt) return false;
                        const d = new Date(o.createdAt);
                        return d >= rangeStart && d <= rangeEnd;
                      })
                    : orders;

                  // الأوردرات الكاملة (بدون فلتر) للـ KPIs الثابتة
                  const allOrders = orders;

                  const deliveredFiltered = filteredOrders.filter(o => o.status === 'تم التسليم' || o.status === 'Delivered' || o.shippingStatus === 'delivered');

                  // ===== تكلفة الوحدة الحقيقية لكل عنصر طلب =====
                  // الطلبات الجديدة بتحفظ costPrice كـ "سنابشوت" وقت الشراء، وده صح.
                  // لكن أي طلب قديم (قبل إضافة الحقل ده) أو أي عنصر متسجل بدون
                  // تكلفة، كان بيتحسب بـ (costPrice || 0) => تكلفة = صفر => الربح
                  // المعروض = سعر المنتج بالكامل مش الربح الحقيقي. عشان كده لو
                  // السنابشوت مش موجود أو = 0، بنرجع لتكلفة المنتج الحالية من
                  // لوحة المنتجات كبديل بدل ما نعتبرها صفر.
                  const getItemUnitCost = (item) => {
                    const snapshotCost = Number(item?.costPrice) || 0;
                    if (snapshotCost > 0) return snapshotCost;
                    const pid = String(item?.productId || item?.id || '');
                    const prod = products.find(p => String(p.id) === pid);
                    return prod ? (Number(prod.costPrice) || 0) : 0;
                  };

                  // ===== نسبة الاسترجاع لكل طلب (تقريب احتياطي) =====
                  // لو الطلب معاه تفاصيل استرجاع دقيقة لكل منتج (returnItems مع
                  // returnRequestStatus === 'approved')، بنستخدمها بالظبط. لو مش
                  // موجودة (طلبات قديمة أو استرجاع فلوس يدوي بدون تحديد منتج)،
                  // بنرجع لتوزيع نسبة المبلغ المسترجع بالتساوي على كل العناصر
                  // كأقرب تقريب ممكن.
                  const getOrderRefundRatio = (order) => {
                    const refunded = Number(order?.refundedAmount) || 0;
                    const total = Number(order?.totalAmount) || 0;
                    if (refunded <= 0 || total <= 0) return 0;
                    return Math.min(1, refunded / total);
                  };

                  // بيرجع "نسبة الاحتفاظ" (اللي معاكسة لنسبة الاسترجاع) لعنصر
                  // معين جوه طلب معين — يتطبق على الإيراد والتكلفة بنفس النسبة.
                  // 1 = العنصر ده كامل مبيعتش منه حاجة اترجعت. أقل من 1 = جزء
                  // أو كل الكمية دي اترجعت.
                  const getItemKeepRatio = (order, item) => {
                    const qty = item.quantity || 1;
                    if (Array.isArray(order.returnItems) && order.returnItems.length > 0 && order.returnRequestStatus === 'approved') {
                      const pid = String(item.productId || item.id || '');
                      const vId = String(item.variantId || '');
                      const size = String(item.size || '');
                      const returnedQty = order.returnItems.reduce((sum, ri) => {
                        if (String(ri.productId || '') === pid && String(ri.variantId || '') === vId && String(ri.size || '') === size) {
                          return sum + (Number(ri.quantity) || 0);
                        }
                        return sum;
                      }, 0);
                      return Math.max(0, qty - returnedQty) / qty;
                    }
                    return 1 - getOrderRefundRatio(order);
                  };

                  // "إجمالي الإيرادات": قيمة كل الطلبات في النطاق (أي حالة) ناقص أي
                  // استرجاع فلوس، زائد أي فرق فلوس اتحصّل من العميل وقت الاستبدال
                  // (exchangeExtraCollected) — ده مؤشر إجمالي على حجم المبيعات المطلوبة.
                  // "المكتملة فقط" (totalSales): نفس الفكرة بس للطلبات المتسلمة بس،
                  // وده اللي بيتحسب منه صافي الربح لأنه الوحيد المؤكد فعليًا.
                  const clientTotalAllRevenue = filteredOrders.reduce((acc, o) => acc + ((o.totalAmount || 0) + (o.exchangeExtraCollected || 0) - (o.refundedAmount || 0)), 0);
                  const clientTotalSales = deliveredFiltered.reduce((acc, o) => acc + ((o.totalAmount || 0) + (o.exchangeExtraCollected || 0) - (o.refundedAmount || 0)), 0);
                  // ===== لو الداتا بيز رجعت الأرقام دي (aggregation بدون سقف عدد
                  // الطلبات)، بنستخدمها بدل الحساب المحلي في كل حاجة تانية في
                  // الصفحة (صافي الربح، متوسط الطلب، التقارير...) عشان الأرقام
                  // تفضل متسقة مع بعضها. لو لسه بيتحمل أو الطلب فشل، بنرجع
                  // للحساب القديم من statsOrders تلقائيًا (fallback آمن). =====
                  const totalAllRevenue = revenueStats ? revenueStats.totalAllRevenue : clientTotalAllRevenue;
                  const totalSales = revenueStats ? revenueStats.totalSales : clientTotalSales;
                  // بنقلل التكلفة كمان بنفس نسبة الاسترجاع لكل عنصر، عشان لو جزء
                  // من الطلب اترجع، الجزء ده مايتحسبش لا في الإيراد ولا في التكلفة —
                  // نفس منطق totalSales بالظبط لكن على التكلفة.
                  const clientTotalCost = deliveredFiltered.reduce((acc, o) => {
                    const orderCost = o.items ? o.items.reduce((s, i) => s + getItemUnitCost(i) * (i.quantity || 1) * getItemKeepRatio(o, i), 0) : 0;
                    return acc + orderCost;
                  }, 0);
                  // نفس فكرة totalAllRevenue/totalSales بالظبط: نفضّل رقم الداتا بيز
                  // (aggregation بدون سقف عدد الطلبات)، ولو مش متاح بنرجع للحساب
                  // المحلي القديم تلقائيًا.
                  const totalCost = revenueStats ? revenueStats.totalCost : clientTotalCost;
                  // ===== تكلفة الشحن =====
                  // الطلبات المتسلمة: تكلفة الشحن (shippingCost) اتدفعت فعلاً وبتقلل الربح.
                  // الطلبات المرتجعة/الملغية بعد الشحن: بندفع تكلفة الشحن مرتين (ذهاب + رجوع)
                  // تقريبًا، لأن مفيش حقل منفصل لتكلفة شحن الإرجاع حاليًا في الأوردر.
                  const shippedBackStatuses = new Set(['مرتجع', 'Returned', 'ملغي', 'Cancelled']);
                  const returnedShippedFiltered = filteredOrders.filter(o =>
                    shippedBackStatuses.has(o.status) && (o.shippingStatus && o.shippingStatus !== 'pending')
                  );
                  const clientTotalShippingCost = deliveredFiltered.reduce((acc, o) => acc + (o.shippingCost || 0), 0);
                  const clientReturnShippingCost = returnedShippedFiltered.reduce((acc, o) => acc + (o.returnShippingCost != null ? o.returnShippingCost : (o.shippingCost || 0) * 2), 0);
                  // نفس فكرة totalAllRevenue/totalSales بالظبط: نفضّل رقم الداتا بيز
                  // (aggregation بدون سقف عدد الطلبات)، ولو مش متاح بنرجع للحساب
                  // المحلي القديم تلقائيًا.
                  const totalShippingCost = revenueStats ? revenueStats.totalShippingCost : clientTotalShippingCost;
                  const returnShippingCost = revenueStats ? revenueStats.returnShippingCost : clientReturnShippingCost;
                  // بنستخدم تاريخ المصروف الحقيقي (e.date) لو موجود، ولو مصروف قديم
                  // من غير تاريخ (اتسجل قبل الميزة دي) بنرجع لـ e.id (وقت الإضافة) كتقريب.
                  const expenseTime = (e) => (e.date ? new Date(e.date).getTime() : (e.id || 0));
                  const totalExpenses = rangeStart
                    ? expenses.reduce((acc, e) => acc + ((expenseTime(e) >= rangeStart.getTime() && expenseTime(e) <= rangeEnd.getTime()) ? e.amount : 0), 0)
                    : expenses.reduce((acc, e) => acc + e.amount, 0);
                  const netProfit = totalSales - totalCost - totalShippingCost - returnShippingCost - totalExpenses;
                  // نفس فكرة totalAllRevenue بالظبط: عدد الطلبات من الداتا بيز
                  // (بدون سقف الـ1000 القديم)، ولو مش متاح بنرجع لطول
                  // filteredOrders المحلي (اللي فيه السقف).
                  const clientOrdersCount = filteredOrders.length;
                  const ordersCount = revenueStats ? revenueStats.ordersCount : clientOrdersCount;
                  // نفس الفكرة: avgOrderValue جاهز من الداتا بيز أصلاً (totalAllRevenue
                  // الصحيح ÷ ordersCount الصحيح)، بدل ما نعيد حسابه هنا بتقسيم
                  // totalAllRevenue (المصحح) على filteredOrders.length (لسه فيه سقف الـ1000).
                  const clientAvgOrderValue = filteredOrders.length > 0 ? Math.round(totalAllRevenue / filteredOrders.length) : 0;
                  const avgOrderValue = revenueStats ? revenueStats.avgOrderValue : clientAvgOrderValue;

                  // Unique customers في النطاق
                  const uniqueCustomerSet = new Set();
                  filteredOrders.forEach(o => {
                    if (o.customerId) uniqueCustomerSet.add(String(o.customerId));
                    else if (o.customerPhone) uniqueCustomerSet.add(o.customerPhone.trim());
                    else if (o.customerEmail) uniqueCustomerSet.add(o.customerEmail.trim().toLowerCase());
                  });
                  const clientUniqueCustomersCount = uniqueCustomerSet.size;
                  // نفس فكرة totalAllRevenue/totalSales بالظبط: نفضّل رقم الداتا بيز
                  // (aggregation بدون سقف عدد الطلبات)، ولو مش متاح بنرجع للحساب
                  // المحلي القديم تلقائيًا.
                  const uniqueCustomersCount = customerStats ? customerStats.uniqueCustomersCount : clientUniqueCustomersCount;

                  // اليوم وأمس (دايماً) - زي uniqueCustomersCount بالظبط: نفضّل
                  // رقم الداتا بيز (بدون سقف 1000)، ولو لسه بيتحمّل بنرجع
                  // للحساب المحلي المبني على statsOrders تلقائيًا.
                  const todayStr2 = now.toDateString();
                  const todayOrders2 = allOrders.filter(o => o.createdAt && new Date(o.createdAt).toDateString() === todayStr2);
                  const clientTodaySales2 = todayOrders2.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
                  const yesterday2 = new Date(); yesterday2.setDate(yesterday2.getDate() - 1);
                  const yesterdayOrders2 = allOrders.filter(o => o.createdAt && new Date(o.createdAt).toDateString() === yesterday2.toDateString());
                  const clientYesterdaySales2 = yesterdayOrders2.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
                  const todaySales2 = dashboardExtras ? dashboardExtras.todaySales : clientTodaySales2;
                  const yesterdaySales2 = dashboardExtras ? dashboardExtras.yesterdaySales : clientYesterdaySales2;
                  const todayVsYesterday2 = yesterdaySales2 > 0 ? (((todaySales2 - yesterdaySales2) / yesterdaySales2) * 100).toFixed(1) : null;

                  // نسبة الإكمال
                  const conversionRate = filteredOrders.length > 0 ? ((deliveredFiltered.length / filteredOrders.length) * 100).toFixed(1) : 0;

                  // أكثر المنتجات مبيعاً في النطاق
                  const clientProductSalesMap2 = {};
                  filteredOrders.forEach(o => {
                    (o.items || []).forEach(item => {
                      const pid = String(item.productId || item.id || '');
                      const qty = item.quantity || 1;
                      if (!clientProductSalesMap2[pid]) clientProductSalesMap2[pid] = { qty: 0, revenue: 0 };
                      clientProductSalesMap2[pid].qty += qty;
                      clientProductSalesMap2[pid].revenue += (item.price || 0) * qty;
                    });
                  });
                  // نفس فكرة totalAllRevenue/totalSales بالظبط: نفضّل رقم الداتا بيز
                  // (aggregation بدون سقف عدد الطلبات، أعلى 50 منتج بعدد القطع)، ولو
                  // مش متاح بنرجع للحساب المحلي القديم تلقائيًا. المصدر هنا
                  // byProductAllOrders (كل حالات الطلب) مش byProduct (المتسلم بس)
                  // عشان يطابق نطاق clientProductSalesMap2 بالظبط.
                  const productSalesMap2 = revenueBreakdown && revenueBreakdown.byProductAllOrders
                    ? revenueBreakdown.byProductAllOrders.reduce((acc, p) => {
                        acc[String(p.productId)] = { qty: p.qty, revenue: p.revenue };
                        return acc;
                      }, {})
                    : clientProductSalesMap2;
                  const topProducts2 = Object.entries(productSalesMap2)
                    .sort((a, b) => b[1].qty - a[1].qty)
                    .slice(0, 5)
                    .map(([pid, data]) => {
                      const prod = products.find(p => String(p.id) === pid);
                      return { name: prod ? getLocalized(prod.name) : t('منتج محذوف', 'Deleted'), qty: data.qty, revenue: Math.round(data.revenue) };
                    });

                  // ===== هامش الربح لكل منتج =====
                  // بنحسب على الطلبات المتسلمة بس (deliveredFiltered) عشان الربح يكون
                  // مؤكد فعليًا، زي باقي حسابات صافي الربح. ولو الطلب فيه استرجاع
                  // جزئي (refundedAmount) بنوزّع نسبة الاسترجاع على كل عناصر الطلب
                  // (راجع شرح getOrderRefundRatio فوق) عشان الإيراد والتكلفة لكل
                  // منتج يبقوا حقيقيين حتى لو مفيش تحديد لمنتج بعينه اترجع.
                  const clientProductProfitMap = {};
                  deliveredFiltered.forEach(o => {
                    (o.items || []).forEach(item => {
                      const pid = String(item.productId || item.id || '');
                      if (!pid) return;
                      const qty = item.quantity || 1;
                      const keepRatio = getItemKeepRatio(o, item);
                      const revenue = (item.price || 0) * qty * keepRatio;
                      const cost = getItemUnitCost(item) * qty * keepRatio;
                      if (!clientProductProfitMap[pid]) clientProductProfitMap[pid] = { qty: 0, revenue: 0, cost: 0 };
                      clientProductProfitMap[pid].qty += qty;
                      clientProductProfitMap[pid].revenue += revenue;
                      clientProductProfitMap[pid].cost += cost;
                    });
                  });
                  // نفس فكرة totalAllRevenue/totalSales بالظبط: نفضّل رقم الداتا بيز
                  // (aggregation بدون سقف عدد الطلبات، أعلى 50 منتج بالإيراد)، ولو
                  // مش متاح بنرجع للحساب المحلي القديم تلقائيًا.
                  const productProfitMap = revenueBreakdown
                    ? revenueBreakdown.byProduct.reduce((acc, p) => {
                        acc[String(p.productId)] = { qty: p.qty, revenue: p.revenue, cost: p.cost };
                        return acc;
                      }, {})
                    : clientProductProfitMap;
                  const productProfitList = Object.entries(productProfitMap)
                    .map(([pid, data]) => {
                      const prod = products.find(p => String(p.id) === pid);
                      const profit = data.revenue - data.cost;
                      const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
                      return {
                        pid,
                        name: prod ? getLocalized(prod.name) : t('منتج محذوف', 'Deleted'),
                        qty: data.qty,
                        revenue: Math.round(data.revenue),
                        cost: Math.round(data.cost),
                        profit: Math.round(profit),
                        margin,
                      };
                    })
                    .filter(p => p.revenue > 0)
                    .sort((a, b) => b.margin - a.margin);
                  // ===== تقسيم أعلى/أضعف هامش ربح =====
                  // لو عدد المنتجات اللي ليها مبيعات في الفترة قليل (5 أو أقل)،
                  // مبنديش كل المنتجات لـ"أعلى هامش" ونسيب "أضعف هامش" فاضية —
                  // بنقسم القايمة نصين (نص فوق للأعلى، نص تحت للأضعف) عشان الكارت
                  // الاتنين يبقى ليهم معنى حتى مع عدد قليل من المنتجات. لو المنتجات
                  // كتير (أكتر من 5)، بترجع لسلوكها الطبيعي: أعلى 5 وأضعف 5 بدون تداخل.
                  const totalProfitProducts = productProfitList.length;
                  const bestCount = totalProfitProducts > 5 ? 5 : Math.ceil(totalProfitProducts / 2);
                  const bestMarginProducts = productProfitList.slice(0, bestCount);
                  const remainingForWorst = productProfitList.slice(bestCount);
                  const worstMarginProducts = [...remainingForWorst]
                    .sort((a, b) => a.margin - b.margin)
                    .slice(0, 5);

                  // ===== معدل الإرجاع لكل منتج =====
                  // بنقارن كمية المنتج في الطلبات المرتجعة بكمية نفس المنتج في كل
                  // الطلبات بالفترة (productSalesMap2) — عشان نعرف مين المنتجات اللي
                  // بترجع أكتر من غيرها.
                  const returnedOrdersForProducts = filteredOrders.filter(o => o.status === 'مرتجع' || o.status === 'Returned');
                  const clientProductReturnQtyMap = {};
                  returnedOrdersForProducts.forEach(o => {
                    (o.items || []).forEach(item => {
                      const pid = String(item.productId || item.id || '');
                      if (!pid) return;
                      clientProductReturnQtyMap[pid] = (clientProductReturnQtyMap[pid] || 0) + (item.quantity || 1);
                    });
                  });
                  // نفس مصدر productSalesMap2 بالظبط (byProductAllOrders) - كل منتج
                  // فيه returnedQty جاهزة من نفس الـ aggregation، فمفيش داعي لأي طلب
                  // إضافي. لو مش متاح بنرجع للحساب المحلي القديم تلقائيًا.
                  const productReturnQtyMap = revenueBreakdown && revenueBreakdown.byProductAllOrders
                    ? revenueBreakdown.byProductAllOrders.reduce((acc, p) => {
                        if (p.returnedQty > 0) acc[String(p.productId)] = p.returnedQty;
                        return acc;
                      }, {})
                    : clientProductReturnQtyMap;
                  const productReturnRateList = Object.entries(productSalesMap2)
                    .filter(([pid]) => productReturnQtyMap[pid])
                    .map(([pid, data]) => {
                      const prod = products.find(p => String(p.id) === pid);
                      const returnedQty = productReturnQtyMap[pid] || 0;
                      const rate = data.qty > 0 ? (returnedQty / data.qty) * 100 : 0;
                      return { name: prod ? getLocalized(prod.name) : t('منتج محذوف', 'Deleted'), returnedQty, soldQty: data.qty, rate };
                    })
                    .filter(p => p.soldQty >= 3) // نتجاهل المنتجات بعدد مبيعات صغير جدًا عشان النسبة تكون ذات معنى
                    .sort((a, b) => b.rate - a.rate)
                    .slice(0, 5);

                  // ===== أسباب الإرجاع الأكثر تكرارًا في الفترة =====
                  const returnReasonMap = {};
                  returnedOrdersForProducts.forEach(o => {
                    const reason = (o.returnReason || '').trim();
                    if (!reason) return;
                    returnReasonMap[reason] = (returnReasonMap[reason] || 0) + 1;
                  });
                  const topReturnReasons = Object.entries(returnReasonMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

                  // حالات الطلبات في النطاق
                  const statusColors2 = { 'جديد': '#3b82f6', 'تم التأكيد': '#8b5cf6', 'قيد التجهيز': '#f59e0b', 'تم الشحن': '#06b6d4', 'تم التسليم': '#10b981', 'ملغي': '#ef4444', 'مرتجع': '#f97316', 'مستبدل': '#a855f7' };
                  // نفس فكرة totalAllRevenue بالظبط: نفضّل رقم الداتا بيز
                  // (aggregation بدون سقف عدد الطلبات)، ولو مش متاح بنرجع
                  // للحساب المحلي القديم تلقائيًا.
                  const clientStatusMap2 = {};
                  filteredOrders.forEach(o => { clientStatusMap2[o.status] = (clientStatusMap2[o.status] || 0) + 1; });
                  const statusMap2 = (dashboardExtras && dashboardExtras.statusDistribution)
                    ? dashboardExtras.statusDistribution.reduce((acc, s) => { acc[s.status] = s.count; return acc; }, {})
                    : clientStatusMap2;

                  // ===== المبيعات حسب المحافظة =====
                  // زي "إجمالي الإيرادات": كل الطلبات في النطاق ناقص أي استرجاع.
                  const clientGovMap = {};
                  filteredOrders.forEach(o => {
                    const gov = (o.governorate || '').trim();
                    if (!gov) return;
                    if (!clientGovMap[gov]) clientGovMap[gov] = { orders: 0, revenue: 0 };
                    clientGovMap[gov].orders += 1;
                    clientGovMap[gov].revenue += (o.totalAmount || 0) + (o.exchangeExtraCollected || 0) - (o.refundedAmount || 0);
                  });
                  // نفس فكرة totalAllRevenue/totalSales بالظبط: نفضّل رقم الداتا بيز
                  // (aggregation بدون سقف عدد الطلبات)، ولو مش متاح بنرجع للحساب
                  // المحلي القديم تلقائيًا.
                  const govMap = revenueBreakdown
                    ? revenueBreakdown.byGovernorate.reduce((acc, g) => {
                        acc[g.governorate] = { orders: g.ordersCount, revenue: g.revenue };
                        return acc;
                      }, {})
                    : clientGovMap;
                  const topGovernorates = Object.entries(govMap)
                    .sort((a, b) => b[1].orders - a[1].orders)
                    .slice(0, 10);
                  const maxGovOrders = topGovernorates.length > 0 ? topGovernorates[0][1].orders : 1;

                  // ===== بيانات الرسم البياني حسب الفترة =====
                  const monthNames = [
                    { ar: 'يناير', en: 'Jan' }, { ar: 'فبراير', en: 'Feb' },
                    { ar: 'مارس', en: 'Mar' }, { ar: 'أبريل', en: 'Apr' },
                    { ar: 'مايو', en: 'May' }, { ar: 'يونيو', en: 'Jun' },
                    { ar: 'يوليو', en: 'Jul' }, { ar: 'أغسطس', en: 'Aug' },
                    { ar: 'سبتمبر', en: 'Sep' }, { ar: 'أكتوبر', en: 'Oct' },
                    { ar: 'نوفمبر', en: 'Nov' }, { ar: 'ديسمبر', en: 'Dec' },
                  ];

                  // ===== جراف المبيعات - بديل احتياطي (client-side) لو لسه
                  // بيتحمّل رد الداتا بيز أو فشل الطلب. الحساب هنا بيفضل محدود
                  // بسقف statsOrders (1000) زي القديم بالظبط - عشان كده بنفضّل
                  // salesTrend من الداتا بيز (aggregation بدون سقف) لو متاح. =====
                  let clientActiveSalesData = [];

                  if (statsPeriod === '7days' || statsPeriod === '14days' || statsPeriod === '30days' || statsPeriod === '90days' || statsPeriod === 'custom') {
                    // بنحسب عدد الأيام
                    const start = rangeStart || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                    const end = rangeEnd;
                    const msPerDay = 86400000;
                    const totalDays = Math.max(1, Math.round((end - start) / msPerDay) + 1);
                    // لو الأيام أكتر من 31 نجمّع أسبوعياً، لو أكتر من 90 شهرياً
                    if (totalDays <= 31) {
                      // يومي
                      const dayMap = {};
                      for (let i = 0; i < totalDays; i++) {
                        const d = new Date(start.getTime() + i * msPerDay);
                        const key = d.toISOString().slice(0,10);
                        dayMap[key] = 0;
                      }
                      filteredOrders.forEach(o => {
                        if (!o.createdAt) return;
                        const key = new Date(o.createdAt).toISOString().slice(0,10);
                        if (dayMap[key] !== undefined) dayMap[key] += (o.totalAmount || 0);
                      });
                      clientActiveSalesData = Object.entries(dayMap).map(([date, amount]) => {
                        const d = new Date(date);
                        return { day: { ar: `${d.getDate()}/${d.getMonth()+1}`, en: `${d.getMonth()+1}/${d.getDate()}` }, amount: Math.round(amount) };
                      });
                    } else {
                      // أسبوعي
                      const weekMap = {};
                      filteredOrders.forEach(o => {
                        if (!o.createdAt) return;
                        const d = new Date(o.createdAt);
                        const weekStart = new Date(d);
                        weekStart.setDate(d.getDate() - d.getDay());
                        const key = weekStart.toISOString().slice(0,10);
                        if (!weekMap[key]) weekMap[key] = 0;
                        weekMap[key] += (o.totalAmount || 0);
                      });
                      clientActiveSalesData = Object.entries(weekMap).sort((a,b) => a[0].localeCompare(b[0])).map(([date, amount]) => {
                        const d = new Date(date);
                        return { day: { ar: `أسبوع ${d.getDate()}/${d.getMonth()+1}`, en: `Wk ${d.getMonth()+1}/${d.getDate()}` }, amount: Math.round(amount) };
                      });
                    }
                  } else if (statsPeriod === 'monthly') {
                    const monthlyMap = {};
                    for (let i = 5; i >= 0; i--) {
                      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const key = `${d.getFullYear()}-${d.getMonth()}`;
                      monthlyMap[key] = { month: d.getMonth(), year: d.getFullYear(), amount: 0 };
                    }
                    filteredOrders.forEach(o => {
                      if (!o.createdAt) return;
                      const d = new Date(o.createdAt);
                      const key = `${d.getFullYear()}-${d.getMonth()}`;
                      if (monthlyMap[key] !== undefined) monthlyMap[key].amount += (o.totalAmount || 0);
                    });
                    clientActiveSalesData = Object.values(monthlyMap).map(m => ({ day: monthNames[m.month], amount: Math.round(m.amount) }));
                  } else if (statsPeriod === 'yearly') {
                    const yearlyMap = {};
                    for (let i = 3; i >= 0; i--) { yearlyMap[now.getFullYear() - i] = 0; }
                    filteredOrders.forEach(o => {
                      if (!o.createdAt) return;
                      const y = new Date(o.createdAt).getFullYear();
                      if (yearlyMap[y] !== undefined) yearlyMap[y] += (o.totalAmount || 0);
                    });
                    clientActiveSalesData = Object.entries(yearlyMap).map(([y, amount]) => ({ day: { ar: y, en: y }, amount: Math.round(amount) }));
                  }

                  // ===== نفضّل salesTrend من الداتا بيز (aggregation بدون سقف
                  // 1000 أوردر) لو متاح ومطابق للفترة الحالية، ولو لسه بيتحمّل
                  // أو مش متاح بنرجع للحساب المحلي فوق تلقائيًا. =====
                  const activeSalesData = (salesTrend && salesTrend.period === statsPeriod && Array.isArray(salesTrend.points))
                    ? salesTrend.points.map(p => {
                        if (salesTrend.granularity === 'month') return { day: monthNames[p.month], amount: p.amount };
                        if (salesTrend.granularity === 'year') return { day: { ar: String(p.year), en: String(p.year) }, amount: p.amount };
                        const d = new Date(p.date);
                        return salesTrend.granularity === 'week'
                          ? { day: { ar: `أسبوع ${d.getDate()}/${d.getMonth()+1}`, en: `Wk ${d.getMonth()+1}/${d.getDate()}` }, amount: p.amount }
                          : { day: { ar: `${d.getDate()}/${d.getMonth()+1}`, en: `${d.getMonth()+1}/${d.getDate()}` }, amount: p.amount };
                      })
                    : clientActiveSalesData;

                  const maxSaleAmount = Math.max(...activeSalesData.map(d => d.amount), 1);

                  // عنوان الفترة
                  const periodLabel = {
                    '7days': t('آخر 7 أيام', 'Last 7 Days'),
                    '14days': t('آخر 14 يوم', 'Last 14 Days'),
                    '30days': t('آخر 30 يوم', 'Last 30 Days'),
                    '90days': t('آخر 90 يوم', 'Last 90 Days'),
                    'monthly': t('آخر 6 شهور', 'Last 6 Months'),
                    'yearly': t('آخر 4 سنوات', 'Last 4 Years'),
                    'custom': t('نطاق مخصص', 'Custom Range'),
                  }[statsPeriod] || '';

                  return (
                    <div className="space-y-6">

                      {/* ===== Date Range Selector ===== */}
                      <div className="bg-[var(--lava-card)] p-4 rounded-xl border shadow-sm">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs font-bold text-[var(--lava-muted)] ml-1">{t('الفترة:', 'Period:')}</span>
                          {[
                            { key: '7days', label: t('7 أيام', '7 Days') },
                            { key: '14days', label: t('14 يوم', '14 Days') },
                            { key: '30days', label: t('30 يوم', '30 Days') },
                            { key: '90days', label: t('90 يوم', '90 Days') },
                            { key: 'monthly', label: t('6 شهور', '6 Months') },
                            { key: 'yearly', label: t('4 سنوات', '4 Years') },
                            { key: 'custom', label: t('مخصص', 'Custom') },
                          ].map(p => (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => setStatsPeriod(p.key)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${statsPeriod === p.key ? 'bg-black text-white border-black' : 'bg-[var(--lava-secondary)] text-[var(--lava-muted)] border-[var(--lava-border)] hover:bg-[var(--lava-secondary)]'}`}
                            >{p.label}</button>
                          ))}
                          {statsPeriod === 'custom' && (
                            <div className="flex gap-2 items-center ml-2">
                              <input type="date" value={statsCustomFrom} onChange={e => setStatsCustomFrom(e.target.value)}
                                className="border rounded-lg px-2 py-1 text-xs font-bold text-[var(--lava-text)] focus:outline-none focus:ring-2 focus:ring-black" />
                              <span className="text-xs text-[var(--lava-muted)]">→</span>
                              <input type="date" value={statsCustomTo} onChange={e => setStatsCustomTo(e.target.value)}
                                max={new Date().toISOString().slice(0,10)}
                                className="border rounded-lg px-2 py-1 text-xs font-bold text-[var(--lava-text)] focus:outline-none focus:ring-2 focus:ring-black" />
                            </div>
                          )}
                          <span className="ml-auto text-xs font-bold text-[var(--lava-muted)] italic">{periodLabel}</span>
                        </div>
                      </div>

                      {/* ===== حسابات إضافية للـ KPI Trends + New vs Repeat + Stock Alerts ===== */}
                      {(() => {
                        // ---- Previous period for trend comparison ----
                        let prevStart = null, prevEnd = null;
                        if (rangeStart) {
                          const span = rangeEnd.getTime() - rangeStart.getTime();
                          prevEnd = new Date(rangeStart.getTime() - 1);
                          prevStart = new Date(rangeStart.getTime() - span);
                        }
                        const prevOrders = (prevStart && prevEnd)
                          ? orders.filter(o => { if (!o.createdAt) return false; const d = new Date(o.createdAt); return d >= prevStart && d <= prevEnd; })
                          : [];
                        const prevDelivered = prevOrders.filter(o => o.status === 'تم التسليم' || o.status === 'Delivered' || o.shippingStatus === 'delivered');
                        // زي حساب الفترة الحالية بالظبط: revenue = كل الطلبات ناقص استرجاع، sales = المتسلم بس ناقص استرجاع
                        const clientPrevRevenue = prevOrders.reduce((s, o) => s + ((o.totalAmount || 0) + (o.exchangeExtraCollected || 0) - (o.refundedAmount || 0)), 0);
                        const clientPrevSales = prevDelivered.reduce((s, o) => s + ((o.totalAmount || 0) + (o.exchangeExtraCollected || 0) - (o.refundedAmount || 0)), 0);
                        // نفس فكرة totalAllRevenue/totalSales: لو الداتا بيز رجعت رقم
                        // الفترة السابقة، نستخدمه بدل الحساب المحلي.
                        const prevRevenue = revenueStats ? revenueStats.prevRevenue : clientPrevRevenue;
                        const prevSales = revenueStats ? revenueStats.prevSales : clientPrevSales;
                        const clientPrevCost = prevDelivered.reduce((s, o) => s + (o.items||[]).reduce((ss,i)=>ss+getItemUnitCost(i)*(i.quantity||1),0)*(1-getOrderRefundRatio(o)),0);
                        // نفس فكرة prevRevenue/prevSales: لو الداتا بيز رجعت رقم الفترة
                        // السابقة، نستخدمه بدل الحساب المحلي.
                        const prevCost = revenueStats ? revenueStats.prevCost : clientPrevCost;
                        const prevTotalExpenses = (prevStart && prevEnd)
                          ? expenses.reduce((s, e) => s + ((expenseTime(e) >= prevStart.getTime() && expenseTime(e) <= prevEnd.getTime()) ? e.amount : 0), 0)
                          : 0;
                        const prevNetProfit = prevSales - prevCost - prevTotalExpenses;
                        // نفس فكرة prevRevenue/prevSales: لو الداتا بيز رجعت عدد طلبات
                        // الفترة السابقة (prevOrdersCount)، نستخدمه بدل طول المصفوفة
                        // المحلية (اللي فيها سقف الـ1000) - وده بيصحح متوسط قيمة الطلب
                        // للفترة السابقة كمان.
                        const prevOrdersCount = revenueStats ? revenueStats.prevOrdersCount : prevOrders.length;
                        const clientPrevAvgOrder = prevOrders.length > 0 ? Math.round(clientPrevRevenue/prevOrders.length) : 0;
                        const prevAvgOrder = prevOrdersCount > 0 ? Math.round(prevRevenue/prevOrdersCount) : clientPrevAvgOrder;
                        const prevConversion = prevOrders.length > 0 ? ((prevDelivered.length / prevOrders.length) * 100).toFixed(1) : 0;
                        const prevUniqueSet = new Set();
                        prevOrders.forEach(o => {
                          if (o.customerId) prevUniqueSet.add(String(o.customerId));
                          else if (o.customerPhone) prevUniqueSet.add(o.customerPhone.trim());
                          else if (o.customerEmail) prevUniqueSet.add(o.customerEmail.trim().toLowerCase());
                        });

                        const trendPct = (curr, prev) => {
                          if (!prev || prev === 0) return null;
                          return (((curr - prev) / Math.abs(prev)) * 100).toFixed(1);
                        };
                        const TrendBadge = ({ curr, prev, invert }) => {
                          const pct = trendPct(curr, prev);
                          if (pct === null) return <span className="text-xs text-[var(--lava-muted)]">{t('لا يوجد مقارنة', 'No prev data')}</span>;
                          const up = parseFloat(pct) >= 0;
                          // invert: للمؤشرات اللي زيادتها سيئة (زي معدل الإرجاع) - نلوّن عكسي
                          const good = invert ? !up : up;
                          return (
                            <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${good ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {up ? '▲' : '▼'} {Math.abs(pct)}%
                            </span>
                          );
                        };

                        // ---- New vs Repeat customers ----
                        // ===== FIX: كل طلب من نفس العميل كان بيتحسب "عميل جديد"
                        // لو أول طلب ليه وقع جوه الفترة المفلترة — يعني لو عميل
                        // واحد اشترى 5 مرات كلهم في نفس الفترة (زي فترة اختبار)،
                        // الـ5 طلبات كانوا بيتحسبوا "عملاء جدد" بدل ما يتحسب بس
                        // الطلب الأول "جديد" والباقي "متكرر". دلوقتي بنقارن كل
                        // طلب بأول طلب فعلي لنفس العميل (مش بس تاريخه) — لو هو
                        // نفسه الطلب الأول، يبقى "جديد"، غير كده "متكرر".
                        const allOrdersCustomerMap = {};
                        const sortedAll = [...orders].sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0));
                        sortedAll.forEach(o => {
                          const key = o.customerId ? String(o.customerId) : (o.customerPhone||o.customerEmail||'').trim().toLowerCase();
                          if (!key) return;
                          if (!allOrdersCustomerMap[key]) allOrdersCustomerMap[key] = [];
                          allOrdersCustomerMap[key].push(o);
                        });
                        let clientNewCustomers = 0, clientRepeatCustomers = 0;
                        filteredOrders.forEach(o => {
                          const key = o.customerId ? String(o.customerId) : (o.customerPhone||o.customerEmail||'').trim().toLowerCase();
                          if (!key) return;
                          const allCustOrders = allOrdersCustomerMap[key] || [];
                          const firstOrderEver = allCustOrders.length > 0 ? allCustOrders[0] : null;
                          const isFirstOrderEver = firstOrderEver && String(firstOrderEver._id) === String(o._id);
                          if (isFirstOrderEver) {
                            clientNewCustomers++;
                          } else {
                            clientRepeatCustomers++;
                          }
                        });
                        // ===== ملحوظة: تعريف الداتا بيز مختلف عن الحساب المحلي هنا -
                        // الداتا بيز بتحسب "لكل عميل فريد" (متكرر = عنده أوردر قبل بداية
                        // الفترة)، والحساب المحلي بيحسب "لكل أوردر" (كل أوردر بيتصنف
                        // جديد/متكرر حسب هل هو أول أوردر للعميل ده عبر كل التاريخ). الرقمين
                        // متوقع ميتطابقوش. زي باقي الحقول، نفضّل رقم الداتا بيز لو متاح.
                        const newCustomers = customerStats ? customerStats.newCustomersCount : clientNewCustomers;
                        const repeatCustomers = customerStats ? customerStats.repeatCustomersCount : clientRepeatCustomers;
                        const totalCustOrders = newCustomers + repeatCustomers;
                        const newPct = totalCustOrders > 0 ? Math.round((newCustomers / totalCustOrders) * 100) : 0;
                        const repeatPct = totalCustOrders > 0 ? Math.round((repeatCustomers / totalCustOrders) * 100) : 0;

                        // ---- Live Orders Feed (last 10 orders overall) ----
                        const liveOrders = [...orders]
                          .filter(o => o.createdAt)
                          .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
                          .slice(0, 10);

                        // ---- Avg Delivery Time ----
                        // بديل احتياطي (client-side، محدود بسقف statsOrders القديم)
                        const deliveredWithDates = orders.filter(o =>
                          (o.status === 'تم التسليم' || o.status === 'Delivered') &&
                          o.createdAt && o.deliveredAt
                        );
                        const clientAvgDeliveryMs = deliveredWithDates.length > 0
                          ? deliveredWithDates.reduce((s,o) => s + (new Date(o.deliveredAt) - new Date(o.createdAt)), 0) / deliveredWithDates.length
                          : null;
                        const clientAvgDeliveryDays = clientAvgDeliveryMs !== null ? (clientAvgDeliveryMs / 86400000).toFixed(1) : null;

                        // fallback: estimate from status timestamps if deliveredAt not present
                        const deliveredFallback = deliveredFiltered.filter(o => o.createdAt && o.updatedAt && o.updatedAt !== o.createdAt);
                        const clientAvgDeliveryFallbackMs = (clientAvgDeliveryMs === null && deliveredFallback.length > 0)
                          ? deliveredFallback.reduce((s,o) => s + (new Date(o.updatedAt) - new Date(o.createdAt)), 0) / deliveredFallback.length
                          : null;
                        const clientAvgDeliveryFallbackDays = clientAvgDeliveryFallbackMs !== null ? (clientAvgDeliveryFallbackMs / 86400000).toFixed(1) : null;
                        const clientDisplayAvgDelivery = clientAvgDeliveryDays || clientAvgDeliveryFallbackDays;
                        // نفضّل رقم الداتا بيز (aggregation على كل تاريخ المتجر
                        // بدون سقف 1000) لو متاح، وإلا الحساب المحلي فوق.
                        const displayAvgDelivery = (dashboardExtras && dashboardExtras.avgDeliveryDays !== null && dashboardExtras.avgDeliveryDays !== undefined)
                          ? dashboardExtras.avgDeliveryDays
                          : clientDisplayAvgDelivery;

                        // ---- Return Rate ----
                        const returnedOrders = filteredOrders.filter(o => o.status === 'مرتجع' || o.status === 'Returned');
                        const clientReturnRate = filteredOrders.length > 0 ? ((returnedOrders.length / filteredOrders.length) * 100).toFixed(1) : 0;
                        const clientReturnRevenueLost = returnedOrders.reduce((s,o) => s + (o.totalAmount||0), 0);
                        // نفس فكرة totalAllRevenue/totalSales بالظبط: نفضّل رقم الداتا بيز
                        // (aggregation بدون سقف عدد الطلبات)، ولو مش متاح بنرجع للحساب
                        // المحلي القديم تلقائيًا.
                        const returnRate = customerStats ? customerStats.returnRate : clientReturnRate;
                        const returnRevenueLost = customerStats ? customerStats.returnRevenueLost : clientReturnRevenueLost;
                        // نسبة المرتجعات في الفترة السابقة (لمقارنة الارتفاع المفاجئ)
                        const prevReturnedOrders = prevOrders.filter(o => o.status === 'مرتجع' || o.status === 'Returned');
                        const prevReturnRate = prevOrders.length > 0 ? ((prevReturnedOrders.length / prevOrders.length) * 100) : 0;
                        // تنبيه لو المعدل ارتفع بشكل ملحوظ (زيادة 5 نقاط مئوية على الأقل
                        // وبنسبة نسبية 40% على الأقل، عشان منتفعش من تقلبات بسيطة في أعداد صغيرة)
                        const returnRateJumped = prevOrders.length >= 5 && filteredOrders.length >= 5
                          && (parseFloat(returnRate) - prevReturnRate) >= 5
                          && (prevReturnRate === 0 ? parseFloat(returnRate) >= 10 : (parseFloat(returnRate) / prevReturnRate) >= 1.4);

                        // ---- Customer Lifetime Value (CLV) ----
                        // بديل احتياطي (client-side، محدود بسقف statsOrders القديم)
                        const customerSpendMap = {};
                        orders.forEach(o => {
                          const key = o.customerId ? String(o.customerId) : (o.customerPhone||o.customerEmail||'').trim().toLowerCase();
                          if (!key) return;
                          if (!customerSpendMap[key]) customerSpendMap[key] = 0;
                          customerSpendMap[key] += (o.totalAmount || 0);
                        });
                        const clvValues = Object.values(customerSpendMap);
                        const clientAvgCLV = clvValues.length > 0 ? Math.round(clvValues.reduce((s,v)=>s+v,0) / clvValues.length) : 0;
                        const clientTopCLV = clvValues.length > 0 ? Math.round(Math.max(...clvValues)) : 0;
                        // نفضّل رقم الداتا بيز (aggregation على كل تاريخ المتجر
                        // بدون سقف 1000) لو متاح، وإلا الحساب المحلي فوق.
                        const avgCLV = dashboardExtras ? dashboardExtras.clvAvg : clientAvgCLV;
                        const topCLV = dashboardExtras ? dashboardExtras.clvTop : clientTopCLV;

                        // ---- Revenue Forecast (linear regression on last N points) ----
                        const forecastPoints = activeSalesData.length >= 3 ? activeSalesData.slice(-Math.min(activeSalesData.length, 14)) : [];
                        let forecastNext = null;
                        if (forecastPoints.length >= 3) {
                          const n = forecastPoints.length;
                          const xs = forecastPoints.map((_,i) => i);
                          const ys = forecastPoints.map(d => d.amount);
                          const sumX = xs.reduce((s,x)=>s+x,0);
                          const sumY = ys.reduce((s,y)=>s+y,0);
                          const sumXY = xs.reduce((s,x,i)=>s+x*ys[i],0);
                          const sumXX = xs.reduce((s,x)=>s+x*x,0);
                          const slope = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX);
                          const intercept = (sumY - slope*sumX) / n;
                          forecastNext = Math.max(0, Math.round(slope*n + intercept));
                        }
                        // build forecast line extended by 3 points
                        const forecastData = forecastPoints.length >= 3 ? (() => {
                          const n = forecastPoints.length;
                          const xs = forecastPoints.map((_,i)=>i);
                          const ys = forecastPoints.map(d=>d.amount);
                          const sumX=xs.reduce((s,x)=>s+x,0), sumY=ys.reduce((s,y)=>s+y,0);
                          const sumXY=xs.reduce((s,x,i)=>s+x*ys[i],0), sumXX=xs.reduce((s,x)=>s+x*x,0);
                          const slope=(n*sumXY-sumX*sumY)/(n*sumXX-sumX*sumX||1);
                          const intercept=(sumY-slope*sumX)/n;
                          return [...forecastPoints.map((_,i)=>Math.max(0,Math.round(slope*i+intercept))),
                            Math.max(0,Math.round(slope*n+intercept)),
                            Math.max(0,Math.round(slope*(n+1)+intercept)),
                            Math.max(0,Math.round(slope*(n+2)+intercept))];
                        })() : [];

                        // ---- Export CSV ----
                        const exportCSV = () => {
                          const headers = [
                            t('رقم الطلب','Order ID'),
                            t('التاريخ','Date'),
                            t('العميل','Customer'),
                            t('المحافظة','Governorate'),
                            t('الحالة','Status'),
                            t('المبلغ','Amount'),
                            t('التكلفة','Cost'),
                          ];
                          const rows = filteredOrders.map(o => [
                            o.orderNumber || o._id || o.id || '',
                            o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-EG') : '',
                            o.customerName || o.customerPhone || '',
                            o.governorate || '',
                            o.status || '',
                            o.totalAmount || 0,
                            (o.items||[]).reduce((s,i)=>s+getItemUnitCost(i)*(i.quantity||1),0),
                          ]);
                          const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
                          const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a'); a.href=url; a.download=`orders-${new Date().toISOString().slice(0,10)}.csv`; a.click();
                          URL.revokeObjectURL(url);
                        };

                        // ---- تصدير تقرير شهري جاهز للمحاسب (Excel — CSV متوافق) ----
                        const exportMonthlyExcel = () => {
                          const esc = (v) => `"${String(v).replace(/"/g,'""')}"`;
                          const lines = [];
                          lines.push([t('تقرير مالي شهري','Monthly Financial Report')]);
                          lines.push([t('الفترة','Period'), periodLabel]);
                          lines.push([t('من','From'), rangeStart ? rangeStart.toLocaleDateString('ar-EG') : '—']);
                          lines.push([t('إلى','To'), rangeEnd.toLocaleDateString('ar-EG')]);
                          lines.push([]);
                          lines.push([t('البند','Item'), t('القيمة (ج.م)','Value (EGP)')]);
                          lines.push([t('إجمالي الإيرادات','Total Revenue'), Math.round(totalAllRevenue)]);
                          lines.push([t('المبيعات المكتملة (متسلمة)','Completed Sales (delivered)'), Math.round(totalSales)]);
                          lines.push([t('تكلفة المنتجات','Product Cost'), -Math.round(totalCost)]);
                          lines.push([t('تكلفة الشحن','Shipping Cost'), -Math.round(totalShippingCost)]);
                          lines.push([t('تكلفة شحن المرتجعات','Return Shipping Cost'), -Math.round(returnShippingCost)]);
                          lines.push([t('مصاريف أخرى','Other Expenses'), -Math.round(totalExpenses)]);
                          lines.push([t('صافي الربح','Net Profit'), Math.round(netProfit)]);
                          lines.push([]);
                          lines.push([t('عدد الطلبات','Orders'), ordersCount]);
                          lines.push([t('نسبة الإكمال %','Completion Rate %'), conversionRate]);
                          lines.push([t('معدل الإرجاع %','Return Rate %'), returnRate]);
                          lines.push([]);
                          lines.push([t('هامش الربح حسب المنتج','Profit Margin by Product')]);
                          lines.push([t('المنتج','Product'), t('الكمية','Qty'), t('الإيراد','Revenue'), t('التكلفة','Cost'), t('الربح','Profit'), t('الهامش %','Margin %')]);
                          productProfitList.forEach(p => {
                            lines.push([p.name, p.qty, p.revenue, p.cost, p.profit, p.margin.toFixed(1)]);
                          });
                          const csv = lines.map(row => row.map(esc).join(',')).join('\n');
                          const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a'); a.href=url; a.download=`monthly-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
                          URL.revokeObjectURL(url);
                        };

                        // ---- تصدير تقرير PDF (عبر نافذة طباعة المتصفح — "حفظ كـ PDF") ----
                        const escapeHtml = (value) => String(value ?? '')
                          .replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/\"/g, '&quot;')
                          .replace(/'/g, '&#39;');

                        const exportMonthlyPDF = () => {
                          const win = window.open('', '_blank');
                          if (!win) return;
                          const rows = productProfitList.map(p => `
                            <tr>
                              <td>${escapeHtml(p.name)}</td>
                              <td>${p.qty}</td>
                              <td>${p.revenue.toLocaleString()}</td>
                              <td>${p.cost.toLocaleString()}</td>
                              <td>${p.profit.toLocaleString()}</td>
                              <td>${p.margin.toFixed(1)}%</td>
                            </tr>`).join('');
                          const html = `
                            <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
                            <head>
                              <meta charset="utf-8" />
                              <title>${t('تقرير مالي شهري','Monthly Financial Report')}</title>
                              <style>
                                body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
                                h1 { font-size: 20px; margin-bottom: 4px; }
                                p.sub { color: #666; margin-top: 0; font-size: 12px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
                                th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: start; }
                                th { background: #f3f4f6; }
                                .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 16px; }
                                .summary div { border: 1px solid #eee; padding: 8px 12px; border-radius: 6px; font-size: 13px; }
                                .net { font-weight: bold; font-size: 16px; margin-top: 16px; }
                                @media print { .noprint { display: none; } }
                              </style>
                            </head>
                            <body>
                              <h1>${t('تقرير مالي شهري','Monthly Financial Report')}</h1>
                              <p class="sub">${periodLabel} — ${rangeStart ? rangeStart.toLocaleDateString('ar-EG') : ''} → ${rangeEnd.toLocaleDateString('ar-EG')}</p>
                              <div class="summary">
                                <div>${t('إجمالي الإيرادات','Total Revenue')}: ${Math.round(totalAllRevenue).toLocaleString()} ${t('ج.م','EGP')}</div>
                                <div>${t('المبيعات المكتملة','Completed Sales')}: ${Math.round(totalSales).toLocaleString()} ${t('ج.م','EGP')}</div>
                                <div>${t('تكلفة المنتجات','Product Cost')}: ${Math.round(totalCost).toLocaleString()} ${t('ج.م','EGP')}</div>
                                <div>${t('تكلفة الشحن','Shipping Cost')}: ${Math.round(totalShippingCost).toLocaleString()} ${t('ج.م','EGP')}</div>
                                <div>${t('تكلفة شحن المرتجعات','Return Shipping Cost')}: ${Math.round(returnShippingCost).toLocaleString()} ${t('ج.م','EGP')}</div>
                                <div>${t('مصاريف أخرى','Other Expenses')}: ${Math.round(totalExpenses).toLocaleString()} ${t('ج.م','EGP')}</div>
                                <div>${t('عدد الطلبات','Orders')}: ${ordersCount}</div>
                                <div>${t('معدل الإرجاع','Return Rate')}: ${returnRate}%</div>
                              </div>
                              <p class="net">${t('صافي الربح','Net Profit')}: ${Math.round(netProfit).toLocaleString()} ${t('ج.م','EGP')}</p>
                              <h3>${t('هامش الربح حسب المنتج','Profit Margin by Product')}</h3>
                              <table>
                                <thead><tr>
                                  <th>${t('المنتج','Product')}</th><th>${t('الكمية','Qty')}</th>
                                  <th>${t('الإيراد','Revenue')}</th><th>${t('التكلفة','Cost')}</th>
                                  <th>${t('الربح','Profit')}</th><th>${t('الهامش','Margin')}</th>
                                </tr></thead>
                                <tbody>${rows}</tbody>
                              </table>
                            </body>
                            </html>`;
                          win.document.open();
                          win.document.write(html);
                          win.document.close();
                          win.focus();
                          setTimeout(() => { win.print(); }, 300);
                        };

                        // ---- Low Stock / Out of Stock — لكل (لون × مقاس) على حدة ----
                        // ===== FIX: كان بيتحسب على إجمالي مخزون المنتج كله (كل
                        // المقاسات مجمّعة مع بعض)، فلو تيشيرت عنده 4 مقاسات ومقاسين
                        // منهم خلصوا خالص بس الباقي لسه فوق العتبة، الإجمالي كان
                        // يفضل "متوفر" ومكانش بيظهر أي تنبيه خالص عن المقاسين اللي
                        // خلصوا. دلوقتي بنفحص كل (لون × مقاس) لوحده، فلو أي مقاس أو
                        // لون معين خلص أو منخفض، هيظهر تنبيه خاص بيه هو، حتى لو باقي
                        // المقاسات في نفس المنتج متوفرة عادي.
                        const outOfStockEntries = [];
                        const lowStockEntries = [];
                        products.forEach((p) => {
                          const threshold = getLowStockThreshold(p);
                          getVariants(p).forEach((v) => {
                            getSizeStockArray(v).forEach((s) => {
                              const stock = Math.max(0, Number(s.stock) || 0);
                              const entry = {
                                key: `${p._id || p.id}_${getCanonicalVariantId(v)}_${s.size}`,
                                product: p,
                                colorLabel: v && v.color ? getLocalized(v.color) : null,
                                size: s.size,
                                stock,
                                threshold,
                              };
                              if (stock <= 0) outOfStockEntries.push(entry);
                              else if (stock <= threshold) lowStockEntries.push(entry);
                            });
                          });
                        });
                        lowStockEntries.sort((a, b) => a.stock - b.stock);
                        const outOfStockProducts = outOfStockEntries;
                        const lowStockProducts = lowStockEntries;

                        // ---- Area Chart path builder ----
                        const buildAreaPath = (data, w, h, max) => {
                          if (!data || data.length < 2) return { line: '', area: '' };
                          const pts = data.map((d, i) => {
                            const x = (i / (data.length - 1)) * w;
                            const y = h - (max > 0 ? (d.amount / max) * h : 0);
                            return [x, y];
                          });
                          // smooth curve using cubic bezier
                          let line = `M ${pts[0][0]},${pts[0][1]}`;
                          for (let i = 1; i < pts.length; i++) {
                            const [x0, y0] = pts[i-1];
                            const [x1, y1] = pts[i];
                            const cx = (x0 + x1) / 2;
                            line += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
                          }
                          const area = `${line} L ${pts[pts.length-1][0]},${h} L ${pts[0][0]},${h} Z`;
                          return { line, area };
                        };

                        const chartW = 560, chartH = 180;
                        const { line: areaLine, area: areaFill } = buildAreaPath(activeSalesData, chartW, chartH, maxSaleAmount);

                        // ---- Revenue per governorate sorted by revenue ----
                        const topGovByRevenue = [...topGovernorates].sort((a,b)=>b[1].revenue - a[1].revenue);
                        const maxGovRevenue = topGovByRevenue.length > 0 ? topGovByRevenue[0][1].revenue : 1;

                        // ---- Donut chart data ----
                        const statusEntries = Object.entries(statusMap2).sort((a,b)=>b[1]-a[1]);
                        const totalStatusOrders = statusEntries.reduce((s,[,c])=>s+c,0);
                        const donutColors = {
                          'جديد': '#3b82f6', 'تم التأكيد': '#8b5cf6', 'قيد التجهيز': '#f59e0b',
                          'تم الشحن': '#06b6d4', 'تم التسليم': '#10b981', 'ملغي': '#ef4444', 'مرتجع': '#f97316', 'مستبدل': '#a855f7'
                        };
                        // Build donut arcs
                        const donutR = 70, donutCX = 90, donutCY = 90, donutStroke = 28;
                        const donutCircumference = 2 * Math.PI * donutR;
                        let donutOffset = 0;
                        const donutArcs = statusEntries.map(([status, count]) => {
                          const pct = totalStatusOrders > 0 ? count / totalStatusOrders : 0;
                          const dash = pct * donutCircumference;
                          const arc = { status, count, pct, dash, offset: donutOffset, color: donutColors[status] || '#6b7280' };
                          donutOffset += dash;
                          return arc;
                        });

                        // ---- المصاريف حسب الفئة (في الفترة المختارة) ----
                        const expenseCatMap = {};
                        (rangeStart
                          ? expenses.filter(e => expenseTime(e) >= rangeStart.getTime() && expenseTime(e) <= rangeEnd.getTime())
                          : expenses
                        ).forEach(e => {
                          const cat = e.category || 'أخرى';
                          expenseCatMap[cat] = (expenseCatMap[cat] || 0) + (e.amount || 0);
                        });
                        const expensesByCategory = Object.entries(expenseCatMap).sort((a, b) => b[1] - a[1]);
                        const maxExpenseCat = expensesByCategory.length > 0 ? expensesByCategory[0][1] : 1;

                        return (
                          <div className="space-y-6">

                            {/* ===== تنبيهات ذكية ===== */}
                            {(netProfit < 0 || returnRateJumped) && (
                              <div className="space-y-3">
                                {netProfit < 0 && (
                                  <div className="flex items-start gap-3 bg-red-50 border-2 border-red-200 text-red-800 rounded-xl px-4 py-3">
                                    <span className="text-xl leading-none">🚨</span>
                                    <div>
                                      <p className="font-extrabold text-sm">{t('صافي الربح سالب في الفترة المختارة', 'Net profit is negative for the selected period')}</p>
                                      <p className="text-xs text-red-700 mt-0.5">
                                        {t('صافي الربح', 'Net profit')}: {Math.round(netProfit).toLocaleString()} {t('ج.م', 'EGP')} — {t('راجع تكلفة المنتجات والشحن والمصاريف في هذه الفترة.', 'Review product cost, shipping, and expenses for this period.')}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {returnRateJumped && (
                                  <div className="flex items-start gap-3 bg-orange-50 border-2 border-orange-200 text-orange-800 rounded-xl px-4 py-3">
                                    <span className="text-xl leading-none">⚠️</span>
                                    <div>
                                      <p className="font-extrabold text-sm">{t('معدل الإرجاع ارتفع فجأة', 'Return rate spiked')}</p>
                                      <p className="text-xs text-orange-700 mt-0.5">
                                        {t('من', 'From')} {prevReturnRate.toFixed(1)}% {t('إلى', 'to')} {returnRate}% {t('مقارنة بالفترة السابقة — يستحق المراجعة.', 'vs the previous period — worth investigating.')}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ===== Row 1: KPI Cards with Trend Indicators ===== */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                {
                                  label: t('إجمالي الطلبات', 'Total Orders'),
                                  value: ordersCount,
                                  prev: prevOrdersCount,
                                  sub: t('في الفترة المختارة', 'In selected period'),
                                  icon: '🛒', color: 'gray'
                                },
                                {
                                  label: t('إجمالي الإيرادات', 'Total Revenue'),
                                  value: Math.round(totalAllRevenue),
                                  prev: Math.round(prevRevenue),
                                  sub: t('ج.م — كل الطلبات', 'EGP — all orders'),
                                  icon: '💰', color: 'gray', fmt: true
                                },
                                {
                                  label: t('المبيعات المكتملة', 'Completed Sales'),
                                  value: Math.round(totalSales),
                                  prev: Math.round(prevSales),
                                  sub: t('ج.م — تم التسليم', 'EGP — delivered'),
                                  icon: '✅', color: 'green', fmt: true
                                },
                                {
                                  label: t('صافي الربح', 'Net Profit'),
                                  value: Math.round(netProfit),
                                  prev: Math.round(prevNetProfit),
                                  sub: t('ج.م بعد التكاليف', 'EGP after costs'),
                                  icon: netProfit >= 0 ? '📈' : '📉',
                                  color: netProfit >= 0 ? 'emerald' : 'red', fmt: true
                                },
                              ].map((kpi, ki) => {
                                const colorMap = {
                                  gray: 'text-[var(--lava-text)] border-[var(--lava-border)]',
                                  green: 'text-green-600 border-green-300',
                                  emerald: 'text-emerald-600 border-emerald-300',
                                  red: 'text-red-600 border-red-300',
                                };
                                const textColor = { gray: 'text-[var(--lava-text)]', green: 'text-green-600', emerald: 'text-emerald-600', red: 'text-red-600' }[kpi.color];
                                const borderColor = { gray: 'border-[var(--lava-border)]', green: 'border-green-300', emerald: 'border-emerald-300', red: 'border-red-300' }[kpi.color];
                                return (
                                  <div key={ki} className={`bg-[var(--lava-card)] p-5 rounded-xl border-2 shadow-sm ${borderColor}`}>
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-xs font-bold text-[var(--lava-muted)] uppercase leading-tight">{kpi.label}</span>
                                      <span className="text-lg">{kpi.icon}</span>
                                    </div>
                                    <p className={`text-2xl font-black ${textColor} mb-1`}>
                                      {kpi.fmt ? kpi.value.toLocaleString() : kpi.value}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <TrendBadge curr={kpi.value} prev={kpi.prev} />
                                    </div>
                                    <p className="text-xs text-[var(--lava-muted)] mt-1">{kpi.sub}</p>
                                  </div>
                                );
                              })}
                            </div>

                            {/* ===== Row 2: KPI Row 2 with Trends ===== */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                {
                                  label: t('مبيعات اليوم', "Today's Sales"),
                                  value: Math.round(todaySales2),
                                  prev: Math.round(yesterdaySales2),
                                  sub: t('مقارنة بأمس', 'vs yesterday'),
                                  icon: '📅', fmt: true
                                },
                                {
                                  label: t('متوسط قيمة الطلب', 'Avg Order Value'),
                                  value: avgOrderValue,
                                  prev: prevAvgOrder,
                                  sub: t('ج.م متوسط', 'EGP average'),
                                  icon: '🎯', fmt: true
                                },
                                {
                                  label: t('عملاء فريدون', 'Unique Customers'),
                                  value: uniqueCustomersCount,
                                  prev: prevUniqueSet.size,
                                  sub: t('في الفترة المختارة', 'in selected period'),
                                  icon: '👥'
                                },
                                {
                                  label: t('نسبة الإكمال', 'Completion Rate'),
                                  value: parseFloat(conversionRate),
                                  prev: parseFloat(prevConversion),
                                  sub: t('طلبات مكتملة', 'completed orders'),
                                  icon: '📊', isPct: true
                                },
                                {
                                  label: t('معدل الإرجاع', 'Return Rate'),
                                  value: parseFloat(returnRate),
                                  prev: parseFloat(prevReturnRate.toFixed(1)),
                                  sub: t('% من إجمالي الطلبات', '% of total orders'),
                                  icon: '↩️', isPct: true, invert: true
                                },
                              ].map((kpi, ki) => (
                                <div key={ki} className="bg-[var(--lava-card)] p-5 rounded-xl border shadow-sm">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-[var(--lava-muted)] uppercase leading-tight">{kpi.label}</span>
                                    <span className="text-lg">{kpi.icon}</span>
                                  </div>
                                  <p className="text-2xl font-black text-[var(--lava-text)] mb-1">
                                    {kpi.isPct ? `${kpi.value}%` : (kpi.fmt ? kpi.value.toLocaleString() : kpi.value)}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <TrendBadge curr={kpi.value} prev={kpi.prev} invert={kpi.invert} />
                                  </div>
                                  {kpi.isPct && (
                                    <div className="mt-2 h-1.5 bg-[var(--lava-secondary)] rounded-full">
                                      <div className={`h-1.5 rounded-full transition-all ${kpi.invert ? 'bg-orange-500' : 'bg-green-500'}`} style={{width:`${Math.min(kpi.value,100)}%`}}></div>
                                    </div>
                                  )}
                                  <p className="text-xs text-[var(--lava-muted)] mt-1">{kpi.sub}</p>
                                </div>
                              ))}
                            </div>

                            {/* ===== Row 3: Area Chart + Profit Details ===== */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Area/Line Chart */}
                              <div className="lg:col-span-2 bg-[var(--lava-card)] p-6 rounded-xl shadow-sm border">
                                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                  <h3 className="text-lg font-bold text-[var(--lava-text)]">
                                    {t('المبيعات', 'Sales')} <span className="text-sm font-normal text-[var(--lava-muted)]">({periodLabel})</span>
                                  </h3>
                                  <span className="text-xs font-bold text-[var(--lava-muted)] bg-[var(--lava-secondary)] px-2 py-1 rounded-lg">
                                    {t('الإجمالي:', 'Total:')} {Math.round(totalAllRevenue).toLocaleString()} {t('ج.م', 'EGP')}
                                  </span>
                                </div>
                                {activeSalesData.length > 0 ? (
                                  <div className="relative" style={{height: '220px'}}>
                                    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-full" preserveAspectRatio="none">
                                      <defs>
                                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25"/>
                                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02"/>
                                        </linearGradient>
                                      </defs>
                                      {/* Y-axis grid lines */}
                                      {[0.25,0.5,0.75,1].map(frac => (
                                        <line key={frac} x1="0" y1={chartH*(1-frac)} x2={chartW} y2={chartH*(1-frac)}
                                          stroke="#f3f4f6" strokeWidth="1.5" strokeDasharray="4,4"/>
                                      ))}
                                      {/* Area fill */}
                                      {areaFill && <path d={areaFill} fill="url(#areaGrad)"/>}
                                      {/* Line */}
                                      {areaLine && <path d={areaLine} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
                                      {/* Dots */}
                                      {activeSalesData.map((d, i) => {
                                        const x = activeSalesData.length > 1 ? (i / (activeSalesData.length-1)) * chartW : chartW/2;
                                        const y = chartH - (maxSaleAmount > 0 ? (d.amount/maxSaleAmount)*chartH : 0);
                                        return d.amount > 0 ? (
                                          <circle key={i} cx={x} cy={y} r="4" fill="#6366f1" stroke="white" strokeWidth="2"/>
                                        ) : null;
                                      })}
                                    </svg>
                                    {/* X labels */}
                                    <div className="flex justify-between mt-1 px-1">
                                      {activeSalesData.filter((_,i)=> activeSalesData.length<=10 || i%(Math.ceil(activeSalesData.length/8))===0 || i===activeSalesData.length-1).map((d,i)=>(
                                        <span key={i} className="text-xs text-[var(--lava-muted)] font-bold" style={{fontSize:'10px'}}>{getLocalized(d.day)}</span>
                                      ))}
                                    </div>
                                    {/* Y labels */}
                                    <div className="absolute top-0 left-0 flex flex-col justify-between h-full py-1 pointer-events-none">
                                      {[1,0.75,0.5,0.25,0].map(frac => (
                                        <span key={frac} className="text-xs text-gray-300 font-bold leading-none" style={{fontSize:'9px'}}>
                                          {Math.round(maxSaleAmount * frac).toLocaleString()}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-40 text-[var(--lava-muted)] text-sm">{t('لا يوجد بيانات', 'No data')}</div>
                                )}
                              </div>

                              {/* Profit Details */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl shadow-sm border flex flex-col">
                                <h3 className="text-lg font-bold mb-4 text-[var(--lava-text)]">{t('تفاصيل الأرباح', 'Profit Details')}</h3>
                                <div className="space-y-3 text-sm flex-grow">
                                  {[
                                    { label: t('إجمالي الإيرادات', 'Total Revenue'), value: Math.round(totalAllRevenue), icon: '🛒', bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', sign: '' },
                                    { label: t('المكتملة فقط', 'Completed only'), value: Math.round(totalSales), icon: '✅', bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', sign: '' },
                                    { label: t('تكلفة المنتجات', 'Product Cost'), value: Math.round(totalCost), icon: '📦', bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', sign: '- ' },
                                    { label: t('تكلفة الشحن', 'Shipping Cost'), value: Math.round(totalShippingCost), icon: '🚚', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', sign: '- ' },
                                    { label: t('تكلفة شحن المرتجعات', 'Return Shipping Cost'), value: Math.round(returnShippingCost), icon: '↩️', bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', sign: '- ' },
                                    { label: t('مصاريف أخرى', 'Other Expenses'), value: Math.round(totalExpenses), icon: '💸', bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', sign: '- ' },
                                  ].map((item, idx) => (
                                    <div key={idx} className={`flex justify-between items-center p-3 ${item.bg} rounded-lg border ${item.border}`}>
                                      <span className={`${item.text} font-bold text-xs`}>{item.icon} {item.label}</span>
                                      <span className={`font-black text-sm ${item.text}`}>{item.sign}{item.value.toLocaleString()} {t('ج.م','EGP')}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-4 pt-4 border-t-2 border-dashed border-[var(--lava-border)] flex justify-between items-center">
                                  <span className="font-extrabold text-[var(--lava-text)] text-sm">{t('صافي الربح:', 'Net Profit:')}</span>
                                  <span className={`text-xl font-black px-3 py-2 rounded-lg ${netProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {Math.round(netProfit).toLocaleString()} {t('ج.م','EGP')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* ===== Row 4: Donut Chart (Orders by Status) + New vs Repeat Customers ===== */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                              {/* Donut Chart — Orders by Status */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--lava-text)] mb-4">📋 {t('توزيع حالات الطلبات', 'Orders by Status')}</h3>
                                {donutArcs.length > 0 ? (
                                  <div className="flex items-center gap-6">
                                    {/* SVG Donut */}
                                    <div className="flex-shrink-0">
                                      <svg width="180" height="180" viewBox="0 0 180 180">
                                        {donutArcs.map((arc, i) => (
                                          <circle
                                            key={i}
                                            cx={donutCX} cy={donutCY} r={donutR}
                                            fill="none"
                                            stroke={arc.color}
                                            strokeWidth={donutStroke}
                                            strokeDasharray={`${arc.dash} ${donutCircumference - arc.dash}`}
                                            strokeDashoffset={-arc.offset}
                                            style={{transform:'rotate(-90deg)', transformOrigin:'50% 50%', transition:'stroke-dasharray 0.5s ease'}}
                                          />
                                        ))}
                                        <text x={donutCX} y={donutCY - 8} textAnchor="middle" className="text-[var(--lava-text)]" style={{fontWeight:800, fontSize:'22px', fill:'#111'}}>
                                          {totalStatusOrders}
                                        </text>
                                        <text x={donutCX} y={donutCY + 12} textAnchor="middle" style={{fontSize:'11px', fill:'#9ca3af', fontWeight:600}}>
                                          {t('طلب', 'orders')}
                                        </text>
                                      </svg>
                                    </div>
                                    {/* Legend */}
                                    <div className="flex-1 space-y-2">
                                      {donutArcs.map((arc, i) => (
                                        <div key={i} className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: arc.color}}></span>
                                            <span className="text-xs font-bold text-[var(--lava-text)] truncate">{arc.status}</span>
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs font-black text-[var(--lava-text)]">{arc.count}</span>
                                            <span className="text-xs text-[var(--lava-muted)] w-8 text-right">{Math.round(arc.pct * 100)}%</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-32 text-[var(--lava-muted)] text-sm">{t('لا يوجد طلبات بعد', 'No orders yet')}</div>
                                )}
                              </div>

                              {/* New vs Repeat Customers */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--lava-text)] mb-4">👥 {t('عملاء جدد مقابل متكررين', 'New vs Repeat Customers')}</h3>
                                <div className="space-y-5">
                                  {/* Visual bar */}
                                  <div>
                                    <div className="flex h-8 rounded-xl overflow-hidden mb-3">
                                      {newPct > 0 && (
                                        <div className="h-full bg-indigo-500 flex items-center justify-center transition-all duration-500" style={{width:`${newPct}%`}}>
                                          <span className="text-white text-xs font-black">{newPct > 12 ? `${newPct}%` : ''}</span>
                                        </div>
                                      )}
                                      {repeatPct > 0 && (
                                        <div className="h-full bg-emerald-400 flex items-center justify-center transition-all duration-500" style={{width:`${repeatPct}%`}}>
                                          <span className="text-white text-xs font-black">{repeatPct > 12 ? `${repeatPct}%` : ''}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-4">
                                      <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                                        <span className="text-xs font-bold text-[var(--lava-text)]">{t('جديد', 'New')}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                                        <span className="text-xs font-bold text-[var(--lava-text)]">{t('متكرر', 'Repeat')}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                                      <p className="text-xs font-bold text-indigo-600 mb-1">{t('عملاء جدد', 'New Customers')}</p>
                                      <p className="text-3xl font-black text-indigo-700">{newCustomers}</p>
                                      <p className="text-xs text-indigo-400 mt-1">{newPct}% {t('من الإجمالي', 'of total')}</p>
                                    </div>
                                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                                      <p className="text-xs font-bold text-emerald-600 mb-1">{t('عملاء متكررون', 'Repeat Customers')}</p>
                                      <p className="text-3xl font-black text-emerald-700">{repeatCustomers}</p>
                                      <p className="text-xs text-emerald-400 mt-1">{repeatPct}% {t('من الإجمالي', 'of total')}</p>
                                    </div>
                                  </div>
                                  {totalCustOrders === 0 && <p className="text-[var(--lava-muted)] text-sm text-center py-2">{t('لا يوجد بيانات بعد', 'No data yet')}</p>}
                                </div>
                              </div>
                            </div>

                            {/* ===== Row 5: Revenue per Governorate (Horizontal Bars) + Top Products ===== */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                              {/* Revenue per Governorate — Horizontal */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--lava-text)] mb-5">🗺️ {t('الإيرادات حسب المحافظة', 'Revenue by Governorate')}</h3>
                                {topGovByRevenue.length > 0 ? (
                                  <div className="space-y-3">
                                    {topGovByRevenue.slice(0,8).map(([gov, data], i) => {
                                      const pct = maxGovRevenue > 0 ? (data.revenue / maxGovRevenue) * 100 : 0;
                                      const barColors = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#818cf8','#4f46e5','#3730a3'];
                                      return (
                                        <div key={gov} className="flex items-center gap-3">
                                          <div className="w-24 text-right flex-shrink-0">
                                            <span className="text-xs font-bold text-[var(--lava-text)] truncate block">{gov}</span>
                                          </div>
                                          <div className="flex-1 bg-[var(--lava-secondary)] rounded-full h-6 relative overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                                              style={{width:`${Math.max(pct, 3)}%`, backgroundColor: barColors[i % barColors.length]}}
                                            >
                                              {pct > 20 && <span className="text-white text-xs font-black">{Math.round(data.revenue).toLocaleString()}</span>}
                                            </div>
                                          </div>
                                          <div className="w-20 flex-shrink-0 text-left">
                                            {pct <= 20 && <span className="text-xs font-black text-[var(--lava-text)]">{Math.round(data.revenue).toLocaleString()}</span>}
                                            <span className="block text-xs text-[var(--lava-muted)]">{data.orders} {t('طلب','orders')}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-[var(--lava-muted)] text-sm text-center py-6">{t('لا يوجد بيانات محافظات بعد', 'No governorate data yet')}</p>
                                )}
                              </div>

                              {/* Top Products */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--lava-text)] mb-4">🏆 {t('أكثر المنتجات مبيعاً', 'Top Products')}</h3>
                                <div className="space-y-3">
                                  {topProducts2.length > 0 ? topProducts2.map((prod, i) => {
                                    const maxQty = topProducts2[0]?.qty || 1;
                                    const barPct = maxQty > 0 ? (prod.qty / maxQty) * 100 : 0;
                                    return (
                                      <div key={i} className="flex items-center gap-3">
                                        <span className={`text-sm font-black w-6 flex-shrink-0 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-[var(--lava-muted)]' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>#{i+1}</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-bold text-[var(--lava-text)] truncate">{prod.name}</p>
                                          <div className="mt-1 h-1.5 bg-[var(--lava-secondary)] rounded-full">
                                            <div className="h-1.5 rounded-full bg-indigo-400 transition-all" style={{width:`${barPct}%`}}></div>
                                          </div>
                                          <p className="text-xs text-[var(--lava-muted)] mt-0.5">{prod.qty} {t('قطعة', 'units')}</p>
                                        </div>
                                        <span className="text-sm font-black text-[var(--lava-text)] whitespace-nowrap flex-shrink-0">{prod.revenue.toLocaleString()} {t('ج.م', 'EGP')}</span>
                                      </div>
                                    );
                                  }) : <p className="text-[var(--lava-muted)] text-sm text-center py-4">{t('لا يوجد بيانات بعد', 'No data yet')}</p>}
                                </div>
                              </div>
                            </div>

                            {/* ===== المصاريف حسب الفئة ===== */}
                            {expensesByCategory.length > 0 && (
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--lava-text)] mb-4">🗂️ {t('المصاريف حسب الفئة', 'Expenses by Category')}</h3>
                                <div className="space-y-3">
                                  {expensesByCategory.map(([cat, amount], i) => {
                                    const pct = maxExpenseCat > 0 ? (amount / maxExpenseCat) * 100 : 0;
                                    const catLabel = EXPENSE_CATEGORIES.find(c => c.key === cat)?.en || cat;
                                    return (
                                      <div key={cat} className="flex items-center gap-3">
                                        <div className="w-28 text-right flex-shrink-0">
                                          <span className="text-xs font-bold text-[var(--lava-text)] truncate block">{t(cat, catLabel)}</span>
                                        </div>
                                        <div className="flex-1 bg-[var(--lava-secondary)] rounded-full h-5 relative overflow-hidden">
                                          <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${Math.max(pct, 3)}%` }}></div>
                                        </div>
                                        <span className="w-24 flex-shrink-0 text-xs font-black text-[var(--lava-text)]">{Math.round(amount).toLocaleString()} {t('ج.م', 'EGP')}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* ===== Row 5.5: هامش الربح لكل منتج + معدل الإرجاع لكل منتج ===== */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* أعلى المنتجات ربحًا (هامش) */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--lava-text)] mb-1">💎 {t('أعلى المنتجات هامش ربح', 'Best Profit Margin')}</h3>
                                <p className="text-xs text-[var(--lava-muted)] mb-4">{t('على الطلبات المتسلمة فقط في الفترة المختارة', 'Delivered orders only, selected period')}</p>
                                <div className="space-y-2">
                                  {bestMarginProducts.length > 0 ? bestMarginProducts.map((p, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-green-50 border border-green-100">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[var(--lava-text)] truncate">{p.name}</p>
                                        <p className="text-xs text-[var(--lava-muted)] mt-0.5">
                                          {t('ربح','Profit')}: {p.profit.toLocaleString()} {t('ج.م','EGP')} · {p.qty} {t('قطعة','units')}
                                        </p>
                                      </div>
                                      <span className="text-sm font-black text-green-700 flex-shrink-0">{p.margin.toFixed(0)}%</span>
                                    </div>
                                  )) : <p className="text-[var(--lava-muted)] text-sm text-center py-4">{t('لا يوجد بيانات كافية بعد', 'Not enough data yet')}</p>}
                                </div>
                              </div>

                              {/* أضعف المنتجات ربحًا (هامش) */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--lava-text)] mb-1">📉 {t('أضعف المنتجات هامش ربح', 'Weakest Profit Margin')}</h3>
                                <p className="text-xs text-[var(--lava-muted)] mb-4">{t('منتجات بتاخد مجهود وربحها ضعيف — راجع سعرها أو تكلفتها', 'Products with low margin — worth reviewing price or cost')}</p>
                                <div className="space-y-2">
                                  {worstMarginProducts.length > 0 ? worstMarginProducts.map((p, i) => (
                                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${p.margin < 0 ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[var(--lava-text)] truncate">{p.name}</p>
                                        <p className="text-xs text-[var(--lava-muted)] mt-0.5">
                                          {t('ربح','Profit')}: {p.profit.toLocaleString()} {t('ج.م','EGP')} · {p.qty} {t('قطعة','units')}
                                        </p>
                                      </div>
                                      <span className={`text-sm font-black flex-shrink-0 ${p.margin < 0 ? 'text-red-700' : 'text-orange-700'}`}>{p.margin.toFixed(0)}%</span>
                                    </div>
                                  )) : <p className="text-[var(--lava-muted)] text-sm text-center py-4">{t('لا يوجد بيانات كافية بعد', 'Not enough data yet')}</p>}
                                </div>
                              </div>

                              {/* أكثر المنتجات إرجاعًا */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--lava-text)] mb-1">🔁 {t('أكثر المنتجات إرجاعًا', 'Highest Return Rate')}</h3>
                                <p className="text-xs text-[var(--lava-muted)] mb-4">{t('نسبة الكمية المرتجعة من إجمالي المباع', '% of sold quantity returned')}</p>
                                <div className="space-y-2">
                                  {productReturnRateList.length > 0 ? productReturnRateList.map((p, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-rose-50 border border-rose-100">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[var(--lava-text)] truncate">{p.name}</p>
                                        <p className="text-xs text-[var(--lava-muted)] mt-0.5">
                                          {p.returnedQty} / {p.soldQty} {t('قطعة مرتجعة','units returned')}
                                        </p>
                                      </div>
                                      <span className="text-sm font-black text-rose-700 flex-shrink-0">{p.rate.toFixed(0)}%</span>
                                    </div>
                                  )) : <p className="text-[var(--lava-muted)] text-sm text-center py-4">{t('لا يوجد إرجاعات كافية بعد', 'Not enough returns yet')}</p>}
                                </div>
                                {topReturnReasons.length > 0 && (
                                  <div className="mt-4 pt-4 border-t">
                                    <p className="text-xs font-bold text-[var(--lava-muted)] mb-2">{t('أكثر أسباب الإرجاع', 'Top Return Reasons')}</p>
                                    <div className="space-y-1.5">
                                      {topReturnReasons.map(([reason, count], i) => (
                                        <div key={i} className="flex justify-between text-xs">
                                          <span className="text-[var(--lava-text)] truncate">{reason}</span>
                                          <span className="font-bold text-[var(--lava-muted)] flex-shrink-0">{count}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ===== Row 6: Stock Alerts ===== */}
                            {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border-2 border-orange-200 shadow-sm">
                                <div className="flex items-center justify-between mb-5">
                                  <h3 className="text-lg font-bold text-[var(--lava-text)]">⚠️ {t('تنبيهات المخزون', 'Stock Alerts')}</h3>
                                  <div className="flex gap-2">
                                    {outOfStockProducts.length > 0 && (
                                      <span className="bg-red-100 text-red-700 text-xs font-black px-3 py-1 rounded-full">
                                        {outOfStockProducts.length} {t('نفد المخزون', 'Out of Stock')}
                                      </span>
                                    )}
                                    {lowStockProducts.length > 0 && (
                                      <span className="bg-orange-100 text-orange-700 text-xs font-black px-3 py-1 rounded-full">
                                        {lowStockProducts.length} {t('مخزون منخفض', 'Low Stock')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Out of Stock */}
                                  {outOfStockProducts.length > 0 && (
                                    <div>
                                      <p className="text-xs font-black text-red-600 uppercase mb-2">🚫 {t('نفد المخزون', 'Out of Stock')}</p>
                                      <div className="space-y-2">
                                        {outOfStockProducts.map((e) => (
                                          <div key={e.key} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                                            {e.product.images?.[0] && <img src={e.product.images[0]} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0"/>}
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-[var(--lava-text)] truncate">{getLocalized(e.product.name)}</p>
                                              <p className="text-xs font-black text-red-600">
                                                {[e.colorLabel, e.size].filter(Boolean).join(' - ')} — {t('لا يوجد مخزون', 'No stock')}
                                              </p>
                                            </div>
                                            <button onClick={() => { setAdminTab('products'); }} className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg font-bold hover:bg-red-700 flex-shrink-0">
                                              {t('تعديل', 'Edit')}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {/* Low Stock */}
                                  {lowStockProducts.length > 0 && (
                                    <div>
                                      <p className="text-xs font-black text-orange-600 uppercase mb-2">📦 {t('مخزون منخفض', 'Low Stock')}</p>
                                      <div className="space-y-2">
                                        {lowStockProducts.map((e) => {
                                          const pct = e.threshold > 0 ? Math.min((e.stock / (e.threshold * 3)) * 100, 100) : 50;
                                          return (
                                            <div key={e.key} className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
                                              {e.product.images?.[0] && <img src={e.product.images[0]} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0"/>}
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[var(--lava-text)] truncate">
                                                  {getLocalized(e.product.name)}
                                                  {(e.colorLabel || e.size) && <span className="text-[var(--lava-muted)] font-normal"> ({[e.colorLabel, e.size].filter(Boolean).join(' - ')})</span>}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                  <div className="flex-1 h-1.5 bg-orange-200 rounded-full">
                                                    <div className="h-1.5 bg-orange-500 rounded-full transition-all" style={{width:`${pct}%`}}></div>
                                                  </div>
                                                  <span className="text-xs font-black text-orange-600 flex-shrink-0">{e.stock} {t('قطعة','pcs')}</span>
                                                </div>
                                              </div>
                                              <button onClick={() => { setAdminTab('products'); }} className="text-xs bg-orange-500 text-white px-2 py-1 rounded-lg font-bold hover:bg-orange-600 flex-shrink-0">
                                                {t('تعديل', 'Edit')}
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* ===== Row 7: KPI Extra — Delivery Time + Return Rate + CLV ===== */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                              {/* Avg Delivery Time */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                  <span className="text-xs font-bold text-[var(--lava-muted)] uppercase">{t('متوسط وقت التوصيل', 'Avg Delivery Time')}</span>
                                  <span className="text-xl">🚚</span>
                                </div>
                                {displayAvgDelivery ? (
                                  <>
                                    <p className="text-3xl font-black text-blue-600">{displayAvgDelivery}</p>
                                    <p className="text-xs text-[var(--lava-muted)] mt-1">{t('يوم من الطلب للتسليم', 'days from order to delivery')}</p>
                                    <div className="mt-3 flex gap-1">
                                      {[1,2,3,4,5].map(d => (
                                        <div key={d} className={`flex-1 h-2 rounded-full ${parseFloat(displayAvgDelivery) <= d ? 'bg-blue-500' : 'bg-[var(--lava-secondary)]'}`}></div>
                                      ))}
                                    </div>
                                    <p className="text-xs mt-1 font-bold" style={{color: parseFloat(displayAvgDelivery) <= 3 ? '#10b981' : parseFloat(displayAvgDelivery) <= 5 ? '#f59e0b' : '#ef4444'}}>
                                      {parseFloat(displayAvgDelivery) <= 3 ? '✅ ' + t('ممتاز', 'Excellent') : parseFloat(displayAvgDelivery) <= 5 ? '⚠️ ' + t('مقبول', 'Acceptable') : '🔴 ' + t('بطيء', 'Slow')}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-3xl font-black text-gray-300">—</p>
                                    <p className="text-xs text-[var(--lava-muted)] mt-1">{t('لا يوجد بيانات كافية', 'Not enough data')}</p>
                                    <p className="text-xs text-[var(--lava-muted)] mt-2 bg-[var(--lava-secondary)] p-2 rounded-lg">{t('يحتاج حقل deliveredAt في الطلبات', 'Needs deliveredAt field in orders')}</p>
                                  </>
                                )}
                              </div>

                              {/* Return Rate */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                  <span className="text-xs font-bold text-[var(--lava-muted)] uppercase">{t('نسبة المرتجعات', 'Return Rate')}</span>
                                  <span className="text-xl">↩️</span>
                                </div>
                                <p className={`text-3xl font-black ${parseFloat(returnRate) === 0 ? 'text-green-600' : parseFloat(returnRate) < 5 ? 'text-yellow-500' : 'text-red-600'}`}>
                                  {returnRate}%
                                </p>
                                <p className="text-xs text-[var(--lava-muted)] mt-1">{returnedOrders.length} {t('طلب مرتجع', 'returned orders')}</p>
                                <div className="mt-3 h-2 bg-[var(--lava-secondary)] rounded-full">
                                  <div className="h-2 rounded-full transition-all" style={{width:`${Math.min(parseFloat(returnRate)*5,100)}%`, backgroundColor: parseFloat(returnRate)===0?'#10b981':parseFloat(returnRate)<5?'#f59e0b':'#ef4444'}}></div>
                                </div>
                                {returnRevenueLost > 0 && (
                                  <p className="text-xs font-bold text-red-500 mt-2">
                                    {t('خسارة:', 'Lost:')} {Math.round(returnRevenueLost).toLocaleString()} {t('ج.م', 'EGP')}
                                  </p>
                                )}
                              </div>

                              {/* Customer Lifetime Value */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                  <span className="text-xs font-bold text-[var(--lava-muted)] uppercase">{t('قيمة العميل مدى الحياة', 'Customer LTV')}</span>
                                  <span className="text-xl">💎</span>
                                </div>
                                <p className="text-3xl font-black text-purple-600">{avgCLV.toLocaleString()}</p>
                                <p className="text-xs text-[var(--lava-muted)] mt-1">{t('ج.م متوسط لكل عميل', 'EGP avg per customer')}</p>
                                <div className="mt-3 pt-3 border-t border-[var(--lava-border)] flex justify-between items-center">
                                  <div>
                                    <p className="text-xs text-[var(--lava-muted)]">{t('أعلى عميل', 'Top customer')}</p>
                                    <p className="text-sm font-black text-[var(--lava-text)]">{topCLV.toLocaleString()} {t('ج.م', 'EGP')}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[var(--lava-muted)]">{t('إجمالي عملاء', 'Total customers')}</p>
                                    <p className="text-sm font-black text-[var(--lava-text)]">{clvValues.length}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* ===== Row 8: Revenue Forecast + Live Orders Feed ===== */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                              {/* Revenue Forecast */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                  <h3 className="text-lg font-bold text-[var(--lava-text)]">🔮 {t('توقع الإيرادات', 'Revenue Forecast')}</h3>
                                  {forecastNext !== null && (
                                    <span className="bg-purple-100 text-purple-700 text-xs font-black px-3 py-1 rounded-full">
                                      {t('الفترة القادمة:', 'Next period:')} {forecastNext.toLocaleString()} {t('ج.م','EGP')}
                                    </span>
                                  )}
                                </div>
                                {forecastData.length > 0 ? (() => {
                                  const allVals = [...activeSalesData.map(d=>d.amount), ...forecastData];
                                  const maxVal = Math.max(...allVals, 1);
                                  const fw = 560, fh = 140;
                                  const actualLen = activeSalesData.length;
                                  const totalLen = actualLen + 3;
                                  // actual line
                                  const actualPts = activeSalesData.map((d,i) => [(i/(totalLen-1))*fw, fh-(d.amount/maxVal)*fh]);
                                  // forecast line (starts from last actual point)
                                  const forecastPts = forecastData.map((_,i) => {
                                    const xi = i < actualLen ? i : i;
                                    return [(xi/(totalLen-1))*fw, fh-(forecastData[i]/maxVal)*fh];
                                  });
                                  const toPath = pts => {
                                    if(pts.length<2) return '';
                                    let p = `M ${pts[0][0]},${pts[0][1]}`;
                                    for(let i=1;i<pts.length;i++){
                                      const cx=(pts[i-1][0]+pts[i][0])/2;
                                      p+=` C ${cx},${pts[i-1][1]} ${cx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`;
                                    }
                                    return p;
                                  };
                                  const actualPath = toPath(actualPts);
                                  const forecastPath = toPath(forecastPts.slice(actualLen-1));
                                  return (
                                    <div>
                                      <svg viewBox={`0 0 ${fw} ${fh}`} className="w-full" style={{height:'140px'}} preserveAspectRatio="none">
                                        <defs>
                                          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15"/>
                                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
                                          </linearGradient>
                                        </defs>
                                        {[0.25,0.5,0.75].map(f=>(
                                          <line key={f} x1="0" y1={fh*(1-f)} x2={fw} y2={fh*(1-f)} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4,4"/>
                                        ))}
                                        {/* vertical divider actual vs forecast */}
                                        {actualPts.length>0 && (
                                          <line x1={actualPts[actualPts.length-1][0]} y1="0" x2={actualPts[actualPts.length-1][0]} y2={fh} stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="4,3"/>
                                        )}
                                        {/* actual area */}
                                        {actualPath && <path d={actualPath+` L ${actualPts[actualPts.length-1][0]},${fh} L 0,${fh} Z`} fill="url(#forecastGrad)"/>}
                                        {/* actual line */}
                                        {actualPath && <path d={actualPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"/>}
                                        {/* forecast dashed */}
                                        {forecastPath && <path d={forecastPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="6,4" strokeLinecap="round"/>}
                                        {/* forecast dots */}
                                        {forecastPts.slice(actualLen).map((pt,i)=>(
                                          <circle key={i} cx={pt[0]} cy={pt[1]} r="5" fill="white" stroke="#a78bfa" strokeWidth="2.5"/>
                                        ))}
                                      </svg>
                                      <div className="flex items-center gap-4 mt-3 text-xs text-[var(--lava-muted)]">
                                        <div className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-indigo-500 inline-block rounded"></span>{t('فعلي','Actual')}</div>
                                        <div className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-purple-400 inline-block rounded" style={{borderTop:'2px dashed #a78bfa', height:0}}></span>{t('متوقع','Forecast')}</div>
                                        <span className="text-[var(--lava-muted)] mr-auto">{t('بناءً على الترند الحالي','Based on current trend')}</span>
                                      </div>
                                    </div>
                                  );
                                })() : (
                                  <div className="flex items-center justify-center h-32 flex-col gap-2">
                                    <p className="text-[var(--lava-muted)] text-sm">{t('يحتاج 3 نقاط بيانات على الأقل', 'Needs at least 3 data points')}</p>
                                    <p className="text-xs text-gray-300">{t('اختر فترة أطول', 'Choose a longer period')}</p>
                                  </div>
                                )}
                              </div>

                              {/* Live Orders Feed */}
                              <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                  <h3 className="text-lg font-bold text-[var(--lava-text)]">
                                    🔴 <span className="relative inline-flex">
                                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75 top-0.5 -right-3"></span>
                                    </span>
                                    {t('آخر الطلبات', 'Live Orders Feed')}
                                  </h3>
                                  <span className="text-xs text-[var(--lava-muted)] font-bold">{t('آخر 10 طلبات','Last 10 orders')}</span>
                                </div>
                                <div className="space-y-2 max-h-72 overflow-y-auto">
                                  {liveOrders.length > 0 ? liveOrders.map((o, i) => {
                                    const statusColor = {
                                      'جديد':'bg-blue-100 text-blue-700','تم التأكيد':'bg-purple-100 text-purple-700',
                                      'قيد التجهيز':'bg-yellow-100 text-yellow-700','تم الشحن':'bg-cyan-100 text-cyan-700',
                                      'تم التسليم':'bg-green-100 text-green-700','ملغي':'bg-red-100 text-red-700','مرتجع':'bg-orange-100 text-orange-700','مستبدل':'bg-purple-100 text-purple-700'
                                    }[o.status] || 'bg-[var(--lava-secondary)] text-[var(--lava-muted)]';
                                    const timeAgo = (() => {
                                      const diff = Date.now() - new Date(o.createdAt).getTime();
                                      const mins = Math.floor(diff/60000);
                                      const hrs = Math.floor(diff/3600000);
                                      const days = Math.floor(diff/86400000);
                                      if(days>0) return language==='ar'?`${days} يوم`:`${days}d ago`;
                                      if(hrs>0) return language==='ar'?`${hrs} ساعة`:`${hrs}h ago`;
                                      return language==='ar'?`${mins} دقيقة`:`${mins}m ago`;
                                    })();
                                    return (
                                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--lava-secondary)] transition border border-gray-50">
                                        <div className="w-8 h-8 rounded-full bg-[var(--lava-secondary)] flex items-center justify-center text-sm font-black text-[var(--lava-muted)] flex-shrink-0">
                                          {(o.customerName||o.customerPhone||'?')[0]?.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-bold text-[var(--lava-text)] truncate">{o.customerName || o.customerPhone || t('عميل','Customer')}</p>
                                          <p className="text-xs text-[var(--lava-muted)]">{o.governorate || ''} · {timeAgo}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                          <span className="text-sm font-black text-[var(--lava-text)]">{(o.totalAmount||0).toLocaleString()} {t('ج.م','EGP')}</span>
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor}`}>{o.status}</span>
                                        </div>
                                      </div>
                                    );
                                  }) : (
                                    <p className="text-[var(--lava-muted)] text-sm text-center py-8">{t('لا يوجد طلبات بعد','No orders yet')}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* ===== Row 9: Abandoned Checkout ===== */}
                            {(() => {
                              // ===== ملحوظة: abandonedCarts هنا مُصفّحة (صفحة واحدة بس من
                              // السيرفر)، فمينفعش نحسب الإجماليات منها زي ما كان بيحصل
                              // قديمًا. الأرقام دي بتيجي من abandonedCartStats (aggregation
                              // على *كل* السلات المطابقة بدون سقف صفحة). القايمة
                              // notRecovered/recovered لسه مستخدمة تحت بس لعرض "أكثر
                              // المنتجات تتركها الناس" من الصفحة الحالية - ده تفصيل
                              // استكشافي مش رقم إجمالي، فمقبول يفضل على الصفحة المعروضة. =====
                              const notRecovered = abandonedCarts.filter(c => !c.recoveredAt);
                              const recovered = abandonedCarts.filter(c => c.recoveredAt);
                              const clientTotalAbandoned = notRecovered.length;
                              const clientTotalRecovered = recovered.length;
                              const clientRecoveryRate = abandonedCarts.length > 0 ? ((clientTotalRecovered / abandonedCarts.length) * 100).toFixed(1) : 0;
                              const clientLostRevenue = notRecovered.reduce((s, c) => s + (c.subtotal || 0), 0);
                              const clientRecoveredRevenue = recovered.reduce((s, c) => s + (c.subtotal || 0), 0);

                              const totalAbandoned = abandonedCartStats ? abandonedCartStats.notRecoveredCount : clientTotalAbandoned;
                              const totalRecovered = abandonedCartStats ? abandonedCartStats.recoveredCount : clientTotalRecovered;
                              const recoveryRate = abandonedCartStats ? abandonedCartStats.recoveryRate : clientRecoveryRate;
                              const lostRevenue = abandonedCartStats ? abandonedCartStats.lostRevenue : clientLostRevenue;
                              const recoveredRevenue = abandonedCartStats ? abandonedCartStats.recoveredRevenue : clientRecoveredRevenue;

                              // أكثر المنتجات تتركها الناس
                              const abandonedProductMap = {};
                              notRecovered.forEach(c => {
                                (c.items || []).forEach(item => {
                                  const pid = String(item.productId || '');
                                  const name = item.name?.ar || item.name?.en || item.name || '';
                                  if (!pid) return;
                                  if (!abandonedProductMap[pid]) abandonedProductMap[pid] = { name, count: 0 };
                                  abandonedProductMap[pid].count++;
                                });
                              });
                              const topAbandoned = Object.values(abandonedProductMap).sort((a,b)=>b.count-a.count).slice(0,5);

                              // توزيع بالمحافظة
                              const govAbandonMap = {};
                              notRecovered.forEach(c => {
                                const gov = (c.governorate || t('غير محدد','Unknown')).trim();
                                govAbandonMap[gov] = (govAbandonMap[gov] || 0) + 1;
                              });
                              const topGovAbandoned = Object.entries(govAbandonMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

                              return (
                                <div className="bg-[var(--lava-card)] p-6 rounded-xl border-2 border-orange-200 shadow-sm">
                                  <div className="flex items-center justify-between mb-5">
                                    <div>
                                      <h3 className="text-lg font-bold text-[var(--lava-text)]">🛒 {t('السلات المتروكة', 'Abandoned Checkout')}</h3>
                                      <p className="text-xs text-[var(--lava-muted)] mt-0.5">{t('آخر 30 يوم', 'Last 30 days')}</p>
                                    </div>
                                    {abandonedCartsLoading && <span className="text-xs text-[var(--lava-muted)] animate-pulse">{t('جاري التحميل...','Loading...')}</span>}
                                  </div>

                                  {/* KPI row */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    {[
                                      { label: t('سلات متروكة','Abandoned Carts'), value: totalAbandoned, icon: '😶', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
                                      { label: t('تم الإكمال','Recovered'), value: totalRecovered, icon: '✅', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                                      { label: t('نسبة الإنقاذ','Recovery Rate'), value: `${recoveryRate}%`, icon: '📈', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
                                      { label: t('إيرادات ضائعة','Lost Revenue'), value: `${Math.round(lostRevenue).toLocaleString()} ${t('ج.م','EGP')}`, icon: '💸', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
                                    ].map((kpi, ki) => (
                                      <div key={ki} className={`p-4 rounded-xl border-2 ${kpi.bg}`}>
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="text-xs font-bold text-[var(--lava-muted)] leading-tight">{kpi.label}</span>
                                          <span className="text-base">{kpi.icon}</span>
                                        </div>
                                        <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* أكثر المنتجات إهمالاً */}
                                    <div>
                                      <h4 className="text-sm font-bold text-[var(--lava-text)] mb-3">📦 {t('أكثر المنتجات تتركها الناس','Most Abandoned Products')}</h4>
                                      {topAbandoned.length > 0 ? (
                                        <div className="space-y-2">
                                          {topAbandoned.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                                              <span className="text-sm font-semibold text-[var(--lava-text)] truncate">{p.name || t('منتج','Product')}</span>
                                              <span className="text-xs font-black text-orange-600 flex-shrink-0 ml-2">{p.count} {t('مرة','times')}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : <p className="text-[var(--lava-muted)] text-sm">{t('لا يوجد بيانات بعد','No data yet')}</p>}
                                    </div>

                                    {/* توزيع المحافظات */}
                                    <div>
                                      <h4 className="text-sm font-bold text-[var(--lava-text)] mb-3">🗺️ {t('توزيع السلات المتروكة بالمحافظة','Abandoned by Governorate')}</h4>
                                      {topGovAbandoned.length > 0 ? (
                                        <div className="space-y-2">
                                          {topGovAbandoned.map(([gov, cnt], i) => {
                                            const maxCnt = topGovAbandoned[0][1];
                                            const pct = maxCnt > 0 ? (cnt / maxCnt) * 100 : 0;
                                            return (
                                              <div key={i} className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-[var(--lava-muted)] w-24 truncate flex-shrink-0">{gov}</span>
                                                <div className="flex-1 h-4 bg-[var(--lava-secondary)] rounded-full overflow-hidden">
                                                  <div className="h-full bg-orange-400 rounded-full" style={{width:`${Math.max(pct,4)}%`}}></div>
                                                </div>
                                                <span className="text-xs font-black text-[var(--lava-text)] flex-shrink-0">{cnt}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : <p className="text-[var(--lava-muted)] text-sm">{t('لا يوجد بيانات بعد','No data yet')}</p>}
                                    </div>
                                  </div>

                                  {/* آخر السلات المتروكة */}
                                  {notRecovered.length > 0 && (
                                    <div className="mt-5">
                                      <h4 className="text-sm font-bold text-[var(--lava-text)] mb-3">⏰ {t('آخر السلات المتروكة','Recent Abandoned Carts')}</h4>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b">
                                              <th className="py-2 text-start font-bold text-[var(--lava-muted)]">{t('العميل','Customer')}</th>
                                              <th className="py-2 text-start font-bold text-[var(--lava-muted)]">{t('المنتجات','Items')}</th>
                                              <th className="py-2 text-start font-bold text-[var(--lava-muted)]">{t('المجموع','Total')}</th>
                                              <th className="py-2 text-start font-bold text-[var(--lava-muted)]">{t('المحافظة','Gov.')}</th>
                                              <th className="py-2 text-start font-bold text-[var(--lava-muted)]">{t('التاريخ','Date')}</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {notRecovered.slice(0, 10).map((c, i) => (
                                              <tr key={i} className="border-b last:border-0 hover:bg-orange-50 transition">
                                                <td className="py-2 font-semibold text-[var(--lava-text)]">{c.customerPhone || c.customerEmail || t('زائر','Visitor')}</td>
                                                <td className="py-2 text-[var(--lava-muted)]">{(c.items||[]).length} {t('منتج','items')}</td>
                                                <td className="py-2 font-black text-orange-600">{Math.round(c.subtotal||0).toLocaleString()} {t('ج.م','EGP')}</td>
                                                <td className="py-2 text-[var(--lava-muted)]">{c.governorate || '—'}</td>
                                                <td className="py-2 text-[var(--lava-muted)]">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-EG') : '—'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* ===== Row 10: Traffic Analytics ===== */}
                            {(() => {
                              // ======================================================
                              // Traffic analytics — مبنية على بيانات الزيارات الحقيقية
                              // من trafficStats (TrafficEvent / FunnelEvent في الـ DB)
                              // وليس من الطلبات أو السلات المتروكة
                              // ======================================================

                              // ساعات اليوم الأكثر نشاطاً — من الزيارات الحقيقية
                              // (trafficStats.byHour) بدل الطلبات/السلات المتروكة،
                              // عشان يبان صح حتى لو مفيش طلبات كتير لسه.
                              const hourMap = {};
                              for (let h = 0; h < 24; h++) hourMap[h] = 0;
                              (trafficStats?.byHour || []).forEach((r) => {
                                if (r && r.hour >= 0 && r.hour < 24) hourMap[r.hour] = r.count || 0;
                              });
                              const maxHourVal = Math.max(...Object.values(hourMap), 1);
                              const peakHour = Object.entries(hourMap).sort((a,b)=>b[1]-a[1])[0];

                              // أيام الأسبوع — من الطلبات (للعرض فقط)
                              const dayNames = language === 'ar'
                                ? ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
                                : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                              const weekdayMap = {};
                              dayNames.forEach((d, i) => weekdayMap[i] = { name: d, orders: 0, abandoned: 0 });
                              filteredOrders.forEach(o => {
                                if (!o.createdAt) return;
                                const d = new Date(o.createdAt).getDay();
                                weekdayMap[d].orders++;
                              });
                              abandonedCarts.forEach(c => {
                                if (!c.createdAt) return;
                                const d = new Date(c.createdAt).getDay();
                                weekdayMap[d].abandoned++;
                              });
                              const weekdayData = Object.values(weekdayMap);
                              const maxWeekday = Math.max(...weekdayData.map(d=>d.orders+d.abandoned), 1);

                              // ======================================================
                              // الزوار الحقيقيون — من TrafficEvent (session tracking)
                              // لا نستخدم orders أو carts لحساب عدد الزوار أبداً
                              // ======================================================
                              const realVisitors  = trafficStats?.summary?.totalVisitors  ?? trafficStats?.summary?.totalSessions ?? 0;
                              const realSessions  = trafficStats?.summary?.totalSessions  || 0;
                              const realPageViews = trafficStats?.summary?.totalPageViews || 0;
                              const realOrders    = trafficStats?.summary?.totalOrders     || 0;
                              const realConvPct   = trafficStats?.summary?.overallConversionRate || '0.0';

                              // زيارات اليوم من الـ daily data
                              const todayStr = new Date().toISOString().slice(0, 10);
                              const todayData = trafficStats?.daily?.find(d => d.date === todayStr);
                              const todayVisits = todayData?.visits || 0;

                              return (
                                <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                  <div className="flex items-center justify-between mb-5">
                                    <div>
                                      <h3 className="text-lg font-bold text-[var(--lava-text)]">📊 {t('تحليلات الزيارات', 'Traffic Analytics')}</h3>
                                      <p className="text-xs text-[var(--lava-muted)] mt-0.5">{t('مبنية على زيارات حقيقية — بيانات session tracking','Based on real visitor sessions — not orders or carts')}</p>
                                    </div>
                                  </div>

                                  {/* KPI row */}
                                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                                    {[
                                      { label: t('أونلاين دلوقتي','Online Now'), value: onlineNow == null ? '—' : onlineNow.toLocaleString(), icon: '🟢', color: 'text-green-600', live: true },
                                      { label: t('الزوار الفريدون','Unique Visitors'), value: realVisitors.toLocaleString(), icon: '🧑', color: 'text-violet-700' },
                                      { label: t('الجلسات','Sessions'), value: realSessions.toLocaleString(), icon: '👥', color: 'text-blue-600' },
                                      { label: t('مشاهدات الصفحات','Page Views'), value: realPageViews.toLocaleString(), icon: '👁️', color: 'text-indigo-600' },
                                      { label: t('معدل التحويل','Conversion Rate'), value: `${realConvPct}%`, icon: '🎯', color: 'text-green-600' },
                                      { label: t('زوار اليوم','Today Visitors'), value: todayVisits.toLocaleString(), icon: '📅', color: 'text-orange-600' },
                                    ].map((kpi, ki) => (
                                      <div key={ki} className={`p-4 rounded-xl border ${kpi.live ? 'bg-green-50 border-green-200' : 'bg-[var(--lava-secondary)]'}`}>
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="text-xs font-bold text-[var(--lava-muted)] flex items-center gap-1">
                                            {kpi.live && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"></span>}
                                            {kpi.label}
                                          </span>
                                          <span className="text-base">{kpi.icon}</span>
                                        </div>
                                        <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* ساعات النشاط */}
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-[var(--lava-text)]">🕐 {t('ساعات النشاط','Activity by Hour')}</h4>
                                        {peakHour && hourMap[peakHour[0]] > 0 && (
                                          <span className="text-xs bg-blue-100 text-blue-700 font-black px-2 py-1 rounded-full">
                                            {t('الذروة:','Peak:')} {peakHour[0]}:00
                                          </span>
                                        )}
                                      </div>
                                      {/* ===== FIX: العمود الحاوي لكل ساعة مكانش ليه ارتفاع محدد
                                      (لأن items-end بيخلي عناصر flex تاخد حجم محتواها بس، مش
                                      تمتد لطول الحاوية) — فالعمود الداخلي اللي بيرسم "height: X%"
                                      كان بيحسب النسبة دي من ارتفاع أبوه، وأبوه ارتفاعه "auto"
                                      (مش رقم محدد)، فالنسبة كانت بتترجم لصفر دايمًا والعمود بيختفي
                                      خالص — بغض النظر عن البيانات نفسها (سواء قليلة أو كتير). ده
                                      السبب الحقيقي إن الرسم كان فاضي من الأول، مش مشكلة في مصدر
                                      البيانات. إضافة h-full هنا بتدي العمود ارتفاع حقيقي (نفس
                                      ارتفاع الحاوية h-24) عشان النسبة المئوية جوه تتحسب صح. ===== */}
                                      <div className="flex items-end gap-0.5 h-24">
                                        {Array.from({length:24},(_,h)=>(
                                          <div key={h} className="flex-1 h-full flex flex-col justify-end items-center gap-0.5 group relative">
                                            <div
                                              className="w-full rounded-sm transition-all duration-300"
                                              style={{
                                                height: `${Math.max((hourMap[h]/maxHourVal)*100, 2)}%`,
                                                backgroundColor: hourMap[h] === maxHourVal ? '#6366f1' : hourMap[h] > 0 ? '#a5b4fc' : '#f3f4f6'
                                              }}
                                            ></div>
                                            <span className="text-[7px] text-gray-300 hidden group-hover:block absolute -bottom-4">{h}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="flex justify-between text-[9px] text-gray-300 mt-1 px-0.5">
                                        <span>12ص</span><span>6ص</span><span>12م</span><span>6م</span><span>11م</span>
                                      </div>
                                    </div>

                                    {/* أيام الأسبوع */}
                                    <div>
                                      <h4 className="text-sm font-bold text-[var(--lava-text)] mb-3">📅 {t('أيام الأسبوع','Weekday Breakdown')}</h4>
                                      <div className="space-y-2">
                                        {weekdayData.map((d, i) => {
                                          const total = d.orders + d.abandoned;
                                          const pct = maxWeekday > 0 ? (total / maxWeekday) * 100 : 0;
                                          return (
                                            <div key={i} className="flex items-center gap-3">
                                              <span className="text-xs font-bold text-[var(--lava-muted)] w-14 flex-shrink-0">{d.name}</span>
                                              <div className="flex-1 h-5 bg-[var(--lava-secondary)] rounded-full overflow-hidden relative">
                                                {/* orders bar */}
                                                <div className="absolute inset-y-0 left-0 bg-indigo-400 rounded-full transition-all" style={{width:`${maxWeekday>0?(d.orders/maxWeekday)*100:0}%`}}></div>
                                                {/* abandoned bar (stacked) */}
                                                <div className="absolute inset-y-0 bg-orange-300 rounded-full transition-all" style={{left:`${maxWeekday>0?(d.orders/maxWeekday)*100:0}%`, width:`${maxWeekday>0?(d.abandoned/maxWeekday)*100:0}%`}}></div>
                                              </div>
                                              <div className="text-xs text-[var(--lava-muted)] flex-shrink-0 flex gap-2 w-24">
                                                {d.orders > 0 && <span className="text-indigo-600 font-bold">{d.orders} {t('طلب','ord.')}</span>}
                                                {d.abandoned > 0 && <span className="text-orange-500">{d.abandoned} {t('مترو','abd.')}</span>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="flex gap-4 mt-3 text-xs text-[var(--lava-muted)]">
                                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-400 inline-block"></span>{t('طلبات','Orders')}</div>
                                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-300 inline-block"></span>{t('سلات متروكة','Abandoned')}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* ===== مقارنة سنة بسنة ===== */}
                            {(() => {
                              const thisYear = now.getFullYear();
                              const lastYear = thisYear - 1;
                              // بديل احتياطي (client-side، محدود بسقف statsOrders القديم)
                              const buildClientYearStats = (year) => {
                                const yStart = new Date(year, 0, 1, 0, 0, 0, 0);
                                const yEnd = new Date(year, 11, 31, 23, 59, 59, 999);
                                const yOrders = orders.filter(o => o.createdAt && new Date(o.createdAt) >= yStart && new Date(o.createdAt) <= yEnd);
                                const yDelivered = yOrders.filter(o => o.status === 'تم التسليم' || o.status === 'Delivered' || o.shippingStatus === 'delivered');
                                const yRevenue = yOrders.reduce((s,o)=>s+((o.totalAmount||0)+(o.exchangeExtraCollected||0)-(o.refundedAmount||0)),0);
                                const ySales = yDelivered.reduce((s,o)=>s+((o.totalAmount||0)+(o.exchangeExtraCollected||0)-(o.refundedAmount||0)),0);
                                const yCost = yDelivered.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>ss+getItemUnitCost(i)*(i.quantity||1),0)*(1-getOrderRefundRatio(o)),0);
                                const yShipping = yDelivered.reduce((s,o)=>s+(o.shippingCost||0),0);
                                const yReturned = yOrders.filter(o => shippedBackStatuses.has(o.status) && (o.shippingStatus && o.shippingStatus !== 'pending'));
                                const yReturnShipping = yReturned.reduce((s,o)=>s+(o.returnShippingCost != null ? o.returnShippingCost : (o.shippingCost||0)*2),0);
                                const yExpenses = expenses.reduce((s,e)=>s+((expenseTime(e)>=yStart.getTime() && expenseTime(e)<=yEnd.getTime())?e.amount:0),0);
                                const yNetProfit = ySales - yCost - yShipping - yReturnShipping - yExpenses;
                                const yReturnedForRate = yOrders.filter(o => o.status === 'مرتجع' || o.status === 'Returned');
                                const yReturnRate = yOrders.length > 0 ? ((yReturnedForRate.length / yOrders.length) * 100) : 0;
                                return { orders: yOrders.length, revenue: yRevenue, sales: ySales, netProfit: yNetProfit, returnRate: yReturnRate };
                              };
                              // نفضّل رقم الداتا بيز (aggregation بدون سقف 1000) لو متاح
                              // لنفس السنة المطلوبة - المصاريف (expenses) بتتضاف من
                              // القايمة المحلية زي ما هي (مش نتيجة أوردرات، فمفيهاش
                              // مشكلة سقف أصلاً).
                              const buildYearStats = (year) => {
                                const dbYear = yearlyComparison
                                  ? [yearlyComparison.thisYear, yearlyComparison.lastYear].find(y => y && y.year === year)
                                  : null;
                                if (!dbYear) return buildClientYearStats(year);
                                const yStart = new Date(year, 0, 1, 0, 0, 0, 0);
                                const yEnd = new Date(year, 11, 31, 23, 59, 59, 999);
                                const yExpenses = expenses.reduce((s,e)=>s+((expenseTime(e)>=yStart.getTime() && expenseTime(e)<=yEnd.getTime())?e.amount:0),0);
                                const yNetProfit = dbYear.sales - dbYear.cost - dbYear.shippingCost - dbYear.returnShippingCost - yExpenses;
                                return { orders: dbYear.orders, revenue: dbYear.revenue, sales: dbYear.sales, netProfit: yNetProfit, returnRate: dbYear.returnRate };
                              };
                              const currYearStats = buildYearStats(thisYear);
                              const prevYearStats = buildYearStats(lastYear);
                              const yoyPct = (curr, prev) => (prev ? (((curr - prev) / Math.abs(prev)) * 100).toFixed(1) : null);

                              return (
                                <div className="bg-[var(--lava-card)] p-6 rounded-xl border shadow-sm">
                                  <h3 className="text-lg font-bold text-[var(--lava-text)] mb-1">📆 {t('مقارنة سنة بسنة', 'Year-over-Year Comparison')}</h3>
                                  <p className="text-xs text-[var(--lava-muted)] mb-4">{t(`${lastYear} مقابل ${thisYear} — كل السنة لحد النهارده`, `${lastYear} vs ${thisYear} — full year to date`)}</p>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                      { label: t('عدد الطلبات', 'Orders'), curr: currYearStats.orders, prev: prevYearStats.orders, fmt: false },
                                      { label: t('إجمالي الإيرادات', 'Total Revenue'), curr: Math.round(currYearStats.revenue), prev: Math.round(prevYearStats.revenue), fmt: true },
                                      { label: t('صافي الربح', 'Net Profit'), curr: Math.round(currYearStats.netProfit), prev: Math.round(prevYearStats.netProfit), fmt: true },
                                      { label: t('معدل الإرجاع', 'Return Rate'), curr: parseFloat(currYearStats.returnRate.toFixed(1)), prev: parseFloat(prevYearStats.returnRate.toFixed(1)), fmt: false, pct: true, invert: true },
                                    ].map((row, i) => {
                                      const pct = yoyPct(row.curr, row.prev);
                                      const up = pct !== null && parseFloat(pct) >= 0;
                                      const good = row.invert ? !up : up;
                                      return (
                                        <div key={i} className="p-4 rounded-xl border bg-[var(--lava-secondary)]">
                                          <p className="text-xs font-bold text-[var(--lava-muted)] mb-2">{row.label}</p>
                                          <p className="text-lg font-black text-[var(--lava-text)]">
                                            {row.pct ? `${row.curr}%` : (row.fmt ? row.curr.toLocaleString() : row.curr)}
                                            <span className="text-xs text-[var(--lava-muted)] font-bold"> {thisYear}</span>
                                          </p>
                                          <p className="text-xs text-[var(--lava-muted)] mt-0.5">
                                            {row.pct ? `${row.prev}%` : (row.fmt ? row.prev.toLocaleString() : row.prev)} <span className="text-gray-300">{lastYear}</span>
                                          </p>
                                          {pct !== null && (
                                            <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full mt-2 ${good ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                              {up ? '▲' : '▼'} {Math.abs(pct)}%
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* ===== Export Button ===== */}
                            <div className="bg-[var(--lava-card)] p-5 rounded-xl border shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                  <h3 className="text-base font-bold text-[var(--lava-text)]">📤 {t('تصدير التقارير', 'Export Reports')}</h3>
                                  <p className="text-xs text-[var(--lava-muted)] mt-0.5">{t('تصدير بيانات الطلبات في الفترة المختارة', 'Export order data for selected period')}</p>
                                </div>
                                <div className="flex gap-3 flex-wrap">
                                  <button
                                    onClick={exportCSV}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition shadow-sm"
                                  >
                                    📊 {t('تصدير CSV', 'Export CSV')} ({filteredOrders.length} {t('طلب','orders')})
                                  </button>
                                  <button
                                    onClick={() => {
                                      const summary = [
                                        `${t('لوحة البيانات','Dashboard Report')} — ${periodLabel}`,
                                        `${t('إجمالي الطلبات','Total Orders')}: ${ordersCount}`,
                                        `${t('إجمالي الإيرادات','Total Revenue')}: ${Math.round(totalAllRevenue).toLocaleString()} ${t('ج.م','EGP')}`,
                                        `${t('صافي الربح','Net Profit')}: ${Math.round(netProfit).toLocaleString()} ${t('ج.م','EGP')}`,
                                        `${t('نسبة الإكمال','Completion Rate')}: ${conversionRate}%`,
                                        `${t('نسبة المرتجعات','Return Rate')}: ${returnRate}%`,
                                        displayAvgDelivery ? `${t('متوسط التوصيل','Avg Delivery')}: ${displayAvgDelivery} ${t('يوم','days')}` : '',
                                        `${t('متوسط LTV','Avg LTV')}: ${avgCLV.toLocaleString()} ${t('ج.م','EGP')}`,
                                      ].filter(Boolean).join('\n');
                                      const blob = new Blob([summary], {type:'text/plain;charset=utf-8;'});
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a'); a.href=url; a.download=`dashboard-summary-${new Date().toISOString().slice(0,10)}.txt`; a.click();
                                      URL.revokeObjectURL(url);
                                    }}
                                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition shadow-sm"
                                  >
                                    📋 {t('ملخص نصي', 'Text Summary')}
                                  </button>
                                  <button
                                    onClick={exportMonthlyExcel}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition shadow-sm"
                                  >
                                    📗 {t('تقرير شهري Excel', 'Monthly Report (Excel)')}
                                  </button>
                                  <button
                                    onClick={exportMonthlyPDF}
                                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition shadow-sm"
                                  >
                                    📕 {t('تقرير شهري PDF', 'Monthly Report (PDF)')}
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-[var(--lava-muted)] mt-3">{t('تقرير Excel/PDF جاهز للمحاسب — يشمل الإيرادات، التكاليف، الشحن، المصاريف، صافي الربح، وهامش الربح لكل منتج.', 'Accountant-ready Excel/PDF report — includes revenue, costs, shipping, expenses, net profit, and per-product margin.')}</p>
                            </div>

                          </div>
                        );
                      })()}

                    </div>
                  );
                })()}
              </div>
            )}

            {/* ===== تبويب مفاتيح API ===== */}
            {adminTab === 'apikeys' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-1">🔑 {t('مركز ربط منصات الإعلانات', 'Ad Platforms Integration')}</h2>
                <p className="text-[var(--lava-muted)] text-sm mb-4">{t('من هنا تقدر تربط مفاتيح الـ API، تضيف البيكسلات، تفعّل الكتالوج، وتتابع أداء الحملات.', 'Connect API keys, add pixels, enable catalogs, and track campaign performance.')}</p>

                <div className="flex flex-wrap gap-2 border-b pb-4">
                  <button onClick={() => setApiSubTab('keys')} className={`px-4 py-2 rounded-lg font-bold text-sm ${apiSubTab === 'keys' ? 'bg-black text-white' : 'bg-[var(--lava-secondary)] text-[var(--lava-text)]'}`}>🔑 {t('مفاتيح API', 'API Keys')}</button>
                  <button onClick={() => setApiSubTab('pixels')} className={`px-4 py-2 rounded-lg font-bold text-sm ${apiSubTab === 'pixels' ? 'bg-black text-white' : 'bg-[var(--lava-secondary)] text-[var(--lava-text)]'}`}>🎯 {t('البيكسلات', 'Pixels')}</button>
                  <button onClick={() => setApiSubTab('catalog')} className={`px-4 py-2 rounded-lg font-bold text-sm ${apiSubTab === 'catalog' ? 'bg-black text-white' : 'bg-[var(--lava-secondary)] text-[var(--lava-text)]'}`}>🗂️ {t('الكتالوج', 'Catalog')}</button>
                  <button onClick={() => setApiSubTab('dashboard')} className={`px-4 py-2 rounded-lg font-bold text-sm ${apiSubTab === 'dashboard' ? 'bg-black text-white' : 'bg-[var(--lava-secondary)] text-[var(--lava-text)]'}`}>📈 {t('داشبورد الأداء', 'Performance Dashboard')}</button>
                </div>

                {apiSubTab === 'keys' && (
                  <div className="space-y-6">
                    <p className="text-[var(--lava-muted)] text-xs bg-blue-50 border border-blue-200 rounded-lg p-3">{t('المفتاح ده هو الـ Access Token اللي بيدي الموقع صلاحية يبعت أحداث وبيانات لحساب الإعلانات بتاعك.', 'This is the Access Token that allows the site to send events and data to your ad accounts.')}</p>
                    <MaskedKeyField platformIcon="🎵" label={t('تيك توك — Access Token', 'TikTok — Access Token')} value={adminSettings.current.tiktokApiKey} onChange={(e) => { adminSettings.current.tiktokApiKey = e.target.value; bumpSettings(); }} onRemove={() => { adminSettings.current.tiktokApiKey = ''; bumpSettings(); showToast(t('تم حذف مفتاح تيك توك', 'TikTok key removed')); }} placeholder={t('الصق التوكن هنا...', 'Paste token here...')} id="tiktokApiKey" t={t} />
                    <MaskedKeyField platformIcon="📘" label={t('ميتا (فيسبوك/انستجرام) — Access Token', 'Meta (Facebook/Instagram) — Access Token')} value={adminSettings.current.metaApiKey} onChange={(e) => { adminSettings.current.metaApiKey = e.target.value; bumpSettings(); }} onRemove={() => { adminSettings.current.metaApiKey = ''; bumpSettings(); showToast(t('تم حذف مفتاح ميتا', 'Meta key removed')); }} placeholder={t('الصق التوكن هنا...', 'Paste token here...')} id="metaApiKey" t={t} />
                    <MaskedKeyField platformIcon="👻" label={t('سناب شات — Access Token', 'Snapchat — Access Token')} value={adminSettings.current.snapchatApiKey} onChange={(e) => { adminSettings.current.snapchatApiKey = e.target.value; bumpSettings(); }} onRemove={() => { adminSettings.current.snapchatApiKey = ''; bumpSettings(); showToast(t('تم حذف مفتاح سناب شات', 'Snapchat key removed')); }} placeholder={t('الصق التوكن هنا...', 'Paste token here...')} id="snapchatApiKey" t={t} />
                    <MaskedKeyField platformIcon="🔍" label={t('جوجل — API Key', 'Google — API Key')} value={adminSettings.current.googleApiKey} onChange={(e) => { adminSettings.current.googleApiKey = e.target.value; bumpSettings(); }} onRemove={() => { adminSettings.current.googleApiKey = ''; bumpSettings(); showToast(t('تم حذف مفتاح جوجل', 'Google key removed')); }} placeholder={t('الصق التوكن هنا...', 'Paste token here...')} id="googleApiKey" t={t} />
                    <button onClick={() => saveAdminSettings(t('تم حفظ مفاتيح API بنجاح!', 'API keys saved!'))} className="bg-black text-white px-8 py-3 rounded-lg font-bold mt-2">{t('حفظ مفاتيح API', 'Save API Keys')}</button>
                  </div>
                )}

                {apiSubTab === 'pixels' && (
                  <div className="space-y-6">
                    <p className="text-[var(--lava-muted)] text-xs bg-blue-50 border border-blue-200 rounded-lg p-3">{t('البيكسل (Pixel ID) هو كود بيتزرع في صفحات الموقع علشان يتابع زوار الموقع.', 'Pixel ID is a code inserted into site pages to track visitors.')}</p>
                    <MaskedKeyField platformIcon="📘" label="Meta Pixel ID" value={adminSettings.current.metaPixelId} onChange={(e) => { adminSettings.current.metaPixelId = e.target.value; bumpSettings(); }} onRemove={() => { adminSettings.current.metaPixelId = ''; bumpSettings(); showToast(t('تم حذف بيكسل ميتا', 'Meta pixel removed')); }} placeholder={t('مثال: 1234567890123456', 'Example: 1234567890123456')} id="metaPixelId" t={t} />
                    <MaskedKeyField platformIcon="🎵" label="TikTok Pixel ID" value={adminSettings.current.tiktokPixelId} onChange={(e) => { adminSettings.current.tiktokPixelId = e.target.value; bumpSettings(); }} onRemove={() => { adminSettings.current.tiktokPixelId = ''; bumpSettings(); showToast(t('تم حذف بيكسل تيك توك', 'TikTok pixel removed')); }} placeholder={t('مثال: CXXXXXXXXXXXXXXXXX', 'Example: CXXXXXXXXXXXXXXXXX')} id="tiktokPixelId" t={t} />
                    <MaskedKeyField platformIcon="🔍" label="Google Tag / Measurement ID" value={adminSettings.current.googlePixelId} onChange={(e) => { adminSettings.current.googlePixelId = e.target.value; bumpSettings(); }} onRemove={() => { adminSettings.current.googlePixelId = ''; bumpSettings(); showToast(t('تم حذف كود جوجل', 'Google tag removed')); }} placeholder={t('مثال: G-XXXXXXXXXX أو AW-XXXXXXXXX', 'Example: G-XXXXXXXXXX or AW-XXXXXXXXX')} id="googlePixelId" t={t} />
                    <MaskedKeyField platformIcon="👻" label="Snapchat Pixel ID" value={adminSettings.current.snapchatPixelId} onChange={(e) => { adminSettings.current.snapchatPixelId = e.target.value; bumpSettings(); }} onRemove={() => { adminSettings.current.snapchatPixelId = ''; bumpSettings(); showToast(t('تم حذف بيكسل سناب شات', 'Snapchat pixel removed')); }} placeholder={t('مثال: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'Example: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')} id="snapchatPixelId" t={t} />
                    <button onClick={() => saveAdminSettings(t('تم حفظ البيكسلات بنجاح!', 'Pixels saved!'))} className="bg-black text-white px-8 py-3 rounded-lg font-bold mt-2">{t('حفظ البيكسلات', 'Save Pixels')}</button>
                  </div>
                )}

                {apiSubTab === 'catalog' && (
                  <div className="space-y-6">
                    <p className="text-[var(--lava-muted)] text-xs bg-blue-50 border border-blue-200 rounded-lg p-3">{t('الكتالوج بيولّد رابط (Feed URL) فيه كل منتجاتك بصيغة تفهمها كل منصة.', 'The catalog generates a Feed URL with all your products in a format understood by each platform.')}</p>
                    {[
                      { key: 'metaCatalogEnabled', icon: '📘', label: t('كتالوج ميتا (فيسبوك/انستجرام)', 'Meta Catalog (Facebook/Instagram)'), path: 'meta-catalog.xml' },
                      { key: 'tiktokCatalogEnabled', icon: '🎵', label: t('كتالوج تيك توك', 'TikTok Catalog'), path: 'tiktok-catalog.csv' },
                      { key: 'googleCatalogEnabled', icon: '🔍', label: t('كتالوج جوجل (Merchant Center)', 'Google Catalog (Merchant Center)'), path: 'google-catalog.xml' },
                      { key: 'snapchatCatalogEnabled', icon: '👻', label: t('كتالوج سناب شات', 'Snapchat Catalog'), path: 'snapchat-catalog.csv' },
                    ].map((platform) => {
                      const isEnabled = adminSettings.current[platform.key];
                      const feedUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/feeds/${platform.path}`;
                      return (
                        <div key={platform.key} className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{platform.icon} {platform.label}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={isEnabled} onChange={(e) => { adminSettings.current[platform.key] = e.target.checked; bumpSettings(); }} />
                              <div className="w-11 h-6 bg-[var(--lava-border)] rounded-full peer peer-checked:bg-green-500 transition-all"></div>
                              <div className="absolute right-1 top-1 w-4 h-4 bg-[var(--lava-card)] rounded-full transition-all peer-checked:-translate-x-5"></div>
                            </label>
                          </div>
                          {isEnabled && (
                            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-[var(--lava-card)] border rounded-lg p-3">
                              <code className="flex-1 text-xs text-[var(--lava-text)] break-all font-mono" dir="ltr">{feedUrl}</code>
                              <button type="button" onClick={() => { if (typeof navigator !== 'undefined' && navigator.clipboard) { navigator.clipboard.writeText(feedUrl); } showToast(t('تم نسخ رابط الكتالوج!', 'Catalog link copied!')); }} className="bg-black text-white px-4 py-2 rounded-lg font-bold text-xs whitespace-nowrap">{t('نسخ الرابط', 'Copy Link')}</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {apiSubTab === 'dashboard' && (
                  <div className="space-y-4">
                    <p className="text-[var(--lava-muted)] text-xs bg-blue-50 border border-blue-200 rounded-lg p-3">
                      {t('من هنا تقدر تفتح لوحة تحكم كل منصة مباشرةً — الأرقام والتقارير بتتحدث في الموقع بتاعهم.', 'Open each platform\'s dashboard directly — stats update on their site.')}
                    </p>
                    {[
                      {
                        icon: '📘',
                        name: 'Meta (Facebook / Instagram)',
                        color: 'bg-blue-600',
                        pixelId: adminSettings.current.metaPixelId,
                        links: [
                          { label: t('Ads Manager', 'Ads Manager'), url: 'https://adsmanager.facebook.com' },
                          { label: t('Business Manager', 'Business Manager'), url: 'https://business.facebook.com' },
                          { label: t('Events Manager (بيكسل)', 'Events Manager (Pixel)'), url: adminSettings.current.metaPixelId ? `https://business.facebook.com/events_manager2/list/pixel/${adminSettings.current.metaPixelId}/overview` : 'https://business.facebook.com/events_manager' },
                        ],
                      },
                      {
                        icon: '🎵',
                        name: 'TikTok',
                        color: 'bg-black',
                        pixelId: adminSettings.current.tiktokPixelId,
                        links: [
                          { label: t('TikTok Ads Manager', 'TikTok Ads Manager'), url: 'https://ads.tiktok.com' },
                          { label: t('Events Manager (بيكسل)', 'Events Manager (Pixel)'), url: 'https://ads.tiktok.com/i18n/events_manager' },
                        ],
                      },
                      {
                        icon: '🔍',
                        name: 'Google',
                        color: 'bg-red-500',
                        pixelId: adminSettings.current.googlePixelId,
                        links: [
                          { label: 'Google Ads', url: 'https://ads.google.com' },
                          { label: 'Google Analytics', url: 'https://analytics.google.com' },
                          { label: 'Merchant Center', url: 'https://merchants.google.com' },
                        ],
                      },
                      {
                        icon: '👻',
                        name: 'Snapchat',
                        color: 'bg-yellow-400',
                        pixelId: adminSettings.current.snapchatPixelId,
                        links: [
                          { label: t('Snap Ads Manager', 'Snap Ads Manager'), url: 'https://ads.snapchat.com' },
                        ],
                      },
                    ].map((platform) => (
                      <div key={platform.name} className="bg-[var(--lava-card)] rounded-xl border shadow-sm overflow-hidden">
                        <div className={`${platform.color} px-5 py-3 flex items-center justify-between`}>
                          <span className="text-white font-bold text-base">{platform.icon} {platform.name}</span>
                          {platform.pixelId
                            ? <span className="text-white/80 text-xs font-mono" dir="ltr">ID: {platform.pixelId.slice(0, 6)}••••</span>
                            : <span className="text-white/60 text-xs">{t('لم يُضف Pixel ID بعد', 'No Pixel ID added yet')}</span>
                          }
                        </div>
                        <div className="p-4 flex flex-wrap gap-2">
                          {platform.links.map((link) => (
                            <a
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-[var(--lava-secondary)] hover:bg-[var(--lava-border)] text-[var(--lava-text)] font-semibold text-sm px-4 py-2 rounded-lg transition"
                            >
                              {link.label} ↗
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== تبويب الطلبات ===== */}
            {/* ===== [RBAC FIX] تبويب "الطلبات" كان الوحيد من بين كل تبويبات لوحة التحكم اللي مفهوش
                أي شرط canAccess() على محتواه (كل التبويبات التانية زي products/customers/... عندها
                الشرط ده). ده كان معناه إن أي حد يعرف يغيّر adminTab من الكونسول كان يقدر يشوف
                ويعدل الطلبات حتى لو الأدمن ماداهوش صلاحية عليها. ضفنا نفس الشرط اللي في القائمة
                الجانبية: أدمن دايمًا، كول سنتر/باكر زي ما كانوا بالظبط (صلاحيتهم مش من نظام
                permissions أصلاً)، وموظف "صلاحيات مخصصة" لازم يبقى عنده صلاحية "orders" فعلية. ===== */}
            {adminTab === 'orders' && (user.role === 'admin' || user.role === 'call_center' || user.role === 'packer' || canAccess('orders')) && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h2 className="text-2xl font-bold">{t('إدارة ومتابعة الطلبات', 'Order Management')}</h2>
                  <button
                    type="button"
                    onClick={() => fetchOrders()}
                    disabled={ordersLoading}
                    className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition disabled:opacity-60"
                  >
                    {ordersLoading ? '⏳' : '🔄'} {t('تحديث', 'Refresh')}
                  </button>
                  {(user.role === 'admin' || (user.role === 'call_center' && adminSettings.current.showConfirmedExportForCallCenter)) && (
                    <button
                      onClick={exportConfirmedOrders}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition"
                    >
                      📤 {t('تصدير الطلبات المؤكدة (Excel)', 'Export Confirmed Orders (Excel)')}
                    </button>
                  )}
                  {user.role === 'admin' && (
                    <button
                      onClick={exportAllOrders}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition"
                    >
                      📤 {t('تصدير جميع الطلبات (Excel)', 'Export All Orders (Excel)')}
                    </button>
                  )}
                </div>

                {/* ===== مدة تصدير الطلبات: كل الأوردرات / شهر / أسبوع / يومين / النهاردة / تحديد يدوي ===== */}
                {(user.role === 'admin' || (user.role === 'call_center' && adminSettings.current.showConfirmedExportForCallCenter)) && (
                  <div className="bg-[var(--lava-secondary)] border rounded-lg p-3 space-y-3">
                    <div className="text-sm font-bold text-[var(--lava-text)]">
                      {t('مدة التصدير', 'Export Period')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'all', label: t('كل الأوردرات', 'All Orders') },
                        { key: 'month', label: t('من شهر', 'Last Month') },
                        { key: 'week', label: t('من أسبوع', 'Last Week') },
                        { key: 'twoDays', label: t('من يومين', 'Last 2 Days') },
                        { key: 'today', label: t('النهاردة', 'Today') },
                        { key: 'custom', label: t('تحديد يدوي', 'Custom Range') },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setExportRangePreset(opt.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            exportRangePreset === opt.key
                              ? 'bg-[var(--lava-primary)] text-white border-[var(--lava-primary)]'
                              : 'bg-[var(--lava-card)] text-[var(--lava-text)] border-[var(--lava-border)] hover:bg-[var(--lava-border)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {exportRangePreset === 'custom' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs font-semibold text-[var(--lava-muted)]">
                          {t('من', 'From')}
                          <input
                            type="date"
                            value={exportRangeFrom}
                            onChange={(e) => setExportRangeFrom(e.target.value)}
                            className="block mt-1 border rounded-lg px-2 py-1 text-sm bg-[var(--lava-card)] text-[var(--lava-text)]"
                          />
                        </label>
                        <label className="text-xs font-semibold text-[var(--lava-muted)]">
                          {t('إلى', 'To')}
                          <input
                            type="date"
                            value={exportRangeTo}
                            onChange={(e) => setExportRangeTo(e.target.value)}
                            className="block mt-1 border rounded-lg px-2 py-1 text-sm bg-[var(--lava-card)] text-[var(--lava-text)]"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {user.role === 'admin' && (
                  <label className="flex items-center gap-2 text-sm font-semibold bg-[var(--lava-secondary)] border rounded-lg p-3 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={!!adminSettings.current.showConfirmedExportForCallCenter}
                      onChange={(e) => { adminSettings.current.showConfirmedExportForCallCenter = e.target.checked; bumpSettings(); }}
                      className="w-5 h-5"
                    />
                    {t('إظهار زرار تصدير الطلبات المؤكدة لموظف الكول سنتر', 'Show "Export Confirmed Orders" button for call center staff')}
                  </label>
                )}

                {/* ===== تنبيه: طلبات استرجاع محتاجة مراجعة ===== */}
                {(() => {
                  const pendingReturnOrders = orders.filter(o => o.returnRequestStatus === 'pending');
                  if (pendingReturnOrders.length === 0) return null;
                  return (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-amber-800">
                        🔔 {t(`عندك ${pendingReturnOrders.length} طلب استرجاع محتاج مراجعة`, `You have ${pendingReturnOrders.length} return request(s) pending review`)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pendingReturnOrders.map(o => (
                          <button
                            key={o.id}
                            onClick={() => {
                              setExpandedOrderIds(prev => new Set(prev).add(o.id));
                              const el = document.getElementById(`order-row-${o.id}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="bg-[var(--lava-card)] border border-amber-300 hover:bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-lg"
                          >
                            #{o.id} — {o.customerName || o.customerPhone || t('عميل', 'Customer')}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ===== فلتر طريقة الدفع: الكل / الدفع الإلكتروني ===== */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderPaymentFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${orderPaymentFilter === 'all' ? 'bg-black text-white border-black' : 'bg-[var(--lava-secondary)] text-[var(--lava-muted)] hover:bg-[var(--lava-secondary)]'}`}
                  >
                    📦 {t('كل الطلبات', 'All Orders')} ({ordersTotal})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderPaymentFilter('wallet')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${orderPaymentFilter === 'wallet' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}`}
                  >
                    📱 {t('الدفع الإلكتروني', 'Electronic Payment')} ({orders.filter(o => o.paymentMethod === 'wallet').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderPaymentFilter('kashier')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${orderPaymentFilter === 'kashier' ? 'bg-black text-white border-black' : 'bg-[var(--lava-secondary)] text-[var(--lava-text)] hover:bg-[var(--lava-secondary)] border-[var(--lava-border)]'}`}
                  >
                    💳 Kashier ({orders.filter(o => o.paymentMethod === 'kashier').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderPaymentFilter('paymob')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${orderPaymentFilter === 'paymob' ? 'bg-black text-white border-black' : 'bg-[var(--lava-secondary)] text-[var(--lava-text)] hover:bg-[var(--lava-secondary)] border-[var(--lava-border)]'}`}
                  >
                    💳 Paymob ({orders.filter(o => o.paymentMethod === 'paymob').length})
                  </button>
                  <span className="text-xs text-[var(--lava-muted)] self-center">
                    {t('فلتر الدفع بيشتغل على الصفحة الحالية بس', 'Payment filter applies to the current page only')}
                  </span>
                </div>

                {/* ===== شريط التحكم في الباجينيشن: عدد الأوردرات في الصفحة + تنقل بين الصفحات ===== */}
                <AdminPaginationBar
                  page={ordersPage} setPage={setOrdersPage}
                  pageSize={ordersPageSize} setPageSize={setOrdersPageSize}
                  totalPages={ordersTotalPages} total={ordersTotal}
                  onRefresh={() => fetchOrders()} loading={ordersLoading} t={t}
                />

                {(() => {
                  let visibleOrders = user.role === 'packer'
                      ? orders.filter(o => o.status === t('تم التأكيد', 'Confirmed'))
                      : orders;

                  if (orderPaymentFilter === 'wallet') {
                    visibleOrders = visibleOrders.filter(o => o.paymentMethod === 'wallet');
                  } else if (orderPaymentFilter === 'kashier') {
                    visibleOrders = visibleOrders.filter(o => o.paymentMethod === 'kashier');
                  } else if (orderPaymentFilter === 'paymob') {
                    visibleOrders = visibleOrders.filter(o => o.paymentMethod === 'paymob');
                  }

                  if (ordersLoading && visibleOrders.length === 0) return <p className="text-[var(--lava-muted)]">{t('جاري التحميل...', 'Loading...')}</p>;
                  if (visibleOrders.length === 0) return <p className="text-[var(--lava-muted)]">{t('لا توجد طلبات حالياً.', 'No orders yet.')}</p>;

                  return visibleOrders.map(ord => {
                    const isExpanded = expandedOrderIds.has(ord.id);
                    // هل الأوردر ده فيه بندل؟ (اشترى منتجين بخصم %)
                    const hasBundleItems = (ord.items || []).some(item => item.bundleDiscount > 0 || item.isBundleItem);
                    return (
                    <div key={ord.id} id={`order-row-${ord.id}`} className="border rounded-xl bg-[var(--lava-secondary)] overflow-hidden">
                      {/* ===== هيدر الأوردر (دايماً ظاهر) ===== */}
                      <div
                        className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer hover:bg-[var(--lava-secondary)] transition-colors select-none"
                        onClick={() => toggleOrderExpand(ord.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base">{t('طلب', 'Order')} #{ord.orderNumber || ord.id}</span>
                            {hasBundleItems && (
                              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full border border-purple-200">
                                🎁 {t('باندل', 'Bundle')}
                              </span>
                            )}
                            <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                              ord.status === t('تم التسليم', 'Delivered') ? 'bg-green-100 text-green-700' :
                              ord.status === t('تم التأكيد', 'Confirmed') ? 'bg-blue-100 text-blue-700' :
                              ord.status === t('ملغي', 'Cancelled') ? 'bg-red-100 text-red-700' :
                              ord.status === t('مرتجع', 'Returned') ? 'bg-orange-100 text-orange-700' :
                              ord.status === t('مستبدل', 'Exchanged') ? 'bg-purple-100 text-purple-700' :
                              'bg-[var(--lava-border)] text-[var(--lava-muted)]'
                            }`}>{ord.status}</span>
                            {ord.returnRequestStatus === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                🔔 {t('طلب استرجاع جديد', 'New return request')}
                              </span>
                            )}
                            {/* ===== حالة الاسترجاع/الاستبدال (من تبويب الاسترجاع والاستبدال) - جنب حالة الطلب ===== */}
                            {(reByOrderId[String(ord.id)] || []).map((it) => {
                              const reStatusLabel = (s) => ({
                                pending: t('قيد الانتظار', 'Pending'),
                                under_review: t('قيد المراجعة', 'Under Review'),
                                approved: t('تمت الموافقة', 'Approved'),
                                rejected: t('مرفوض', 'Rejected'),
                                pickup_scheduled: t('تم جدولة الاستلام', 'Pickup Scheduled'),
                                received: t('تم الاستلام', 'Received'),
                                processing: t('جاري المعالجة', 'Processing'),
                                completed: t('مكتمل', 'Completed'),
                                cancelled: t('ملغي', 'Cancelled'),
                                carrier_picked_up: t('شركة الشحن استلمت المنتج', 'Picked up by carrier'),
                                received_at_warehouse: t('وصل المخزن', 'Arrived at warehouse'),
                                inspecting: t('جاري المعاينة', 'Inspecting'),
                                shipped_to_customer: t('في الطريق للعميل', 'Shipped to customer'),
                              }[s] || s);
                              const reStatusColor = (s) => ({
                                pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                                under_review: 'bg-blue-100 text-blue-800 border-blue-200',
                                approved: 'bg-green-100 text-green-800 border-green-200',
                                rejected: 'bg-red-100 text-red-800 border-red-200',
                                pickup_scheduled: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                                received: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                                processing: 'bg-purple-100 text-purple-800 border-purple-200',
                                completed: 'bg-green-100 text-green-800 border-green-200',
                                cancelled: 'bg-[var(--lava-border)] text-[var(--lava-text)] border-[var(--lava-border)]',
                                carrier_picked_up: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                                received_at_warehouse: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                                inspecting: 'bg-purple-100 text-purple-800 border-purple-200',
                                shipped_to_customer: 'bg-teal-100 text-teal-800 border-teal-200',
                              }[s] || 'bg-[var(--lava-secondary)] text-[var(--lava-text)] border-[var(--lava-border)]');
                              return (
                                <span
                                  key={it.requestId}
                                  className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${reStatusColor(it.status)}`}
                                  title={it.type === 'return' ? t('حالة طلب الاسترجاع', 'Return request status') : t('حالة طلب الاستبدال', 'Exchange request status')}
                                >
                                  {it.type === 'return' ? '↩️' : '🔁'} {it.type === 'return' ? t('استرجاع', 'Return') : t('استبدال', 'Exchange')}: {reStatusLabel(it.status)}
                                </span>
                              );
                            })}
                            {ord.paymentMethod === 'wallet' && (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${ord.walletPayment?.confirmed ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                📱 {ord.walletPayment?.methodName || t('دفع إلكتروني', 'E-Payment')} {ord.walletPayment?.confirmed ? `✓ ${t('مؤكد', 'Confirmed')}` : `⏳ ${t('بانتظار التأكيد', 'Pending')}`}
                              </span>
                            )}
                            {ord.paymentMethod === 'kashier' && (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${ord.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : ord.paymentStatus === 'failed' ? 'bg-red-100 text-red-700 border-red-200' : ord.paymentStatus === 'refunded' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                💳 Kashier {ord.paymentStatus === 'paid' ? `✓ ${t('مدفوع', 'Paid')}` : ord.paymentStatus === 'failed' ? `✕ ${t('فشل', 'Failed')}` : ord.paymentStatus === 'refunded' ? `↩️ ${t('مسترجع', 'Refunded')}` : `⏳ ${t('بانتظار الدفع', 'Payment pending')}`}
                              </span>
                            )}
                            {ord.paymentMethod === 'paymob' && (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${ord.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : ord.paymentStatus === 'failed' ? 'bg-red-100 text-red-700 border-red-200' : ord.paymentStatus === 'refunded' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                💳 Paymob {ord.paymentStatus === 'paid' ? `✓ ${t('مدفوع', 'Paid')}` : ord.paymentStatus === 'failed' ? `✕ ${t('فشل', 'Failed')}` : ord.paymentStatus === 'refunded' ? `↩️ ${t('مسترجع', 'Refunded')}` : `⏳ ${t('بانتظار الدفع', 'Payment pending')}`}
                              </span>
                            )}
                            {(ord.paymentMethod === 'kashier' || ord.paymentMethod === 'paymob') && Number(ord.refundedAmount || 0) > 0 && (() => {
                              const refundedAmt = Number(ord.refundedAmount || 0);
                              const isFullRefund = ord.paymentStatus === 'refunded' || refundedAmt >= Number(ord.totalAmount || 0) - 0.01;
                              return (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-200">
                                  ↩️ {isFullRefund
                                    ? t(`استرجاع كلي — ${refundedAmt} ج.م`, `Full refund — ${refundedAmt} EGP`)
                                    : t(`استرجاع جزئي — ${refundedAmt} ج.م`, `Partial refund — ${refundedAmt} EGP`)}
                                </span>
                              );
                            })()}
                            {ord.emailConfirmation?.enabled && (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${ord.emailConfirmation?.cancelledAt ? 'bg-red-100 text-red-700 border-red-200' : ord.emailConfirmation?.confirmedAt ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                                ✉️ {ord.emailConfirmation?.cancelledAt ? t('ألغى الطلب من الإيميل', 'Cancelled by email') : ord.emailConfirmation?.confirmedAt ? t('أكد من الإيميل', 'Confirmed by email') : t('لم يؤكد من الإيميل', 'Email confirmation pending')}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-[var(--lava-muted)] mt-0.5 truncate">
                            <span className="font-semibold">{ord.customerName}</span>
                            <span className="mx-2 text-gray-300">|</span>
                            <span dir="ltr">{ord.customerPhone}</span>
                            <span className="mx-2 text-gray-300">|</span>
                            <span>{ord.governorate}{ord.country ? ` - ${ord.country}` : ''}</span>
                            {ord.shippingCompany && (
                              <>
                                <span className="mx-2 text-gray-300">|</span>
                                <span className="text-blue-600 font-semibold">🚚 {ord.shippingCompany}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-bold text-base text-[var(--lava-text)]">{ord.totalAmount} {t('ج.م', 'EGP')}</span>
                          <span className={`text-[var(--lava-muted)] transition-transform duration-200 text-lg ${isExpanded ? 'rotate-180' : ''}`} style={{display:'inline-block'}}>▼</span>
                        </div>
                      </div>

                      {/* ===== التفاصيل (تظهر عند الضغط) ===== */}
                      {isExpanded && (
                        <div className="border-t px-5 pb-5 pt-4 space-y-4 bg-[var(--lava-card)]">
                          {/* بيانات العميل الكاملة */}
                          <div className="bg-[var(--lava-secondary)] rounded-lg border px-4 py-3 text-sm space-y-1">
                            <p className="font-bold text-[var(--lava-text)] mb-1">👤 {t('بيانات العميل', 'Customer Details')}</p>
                            <p>{t('الاسم:', 'Name:')} <span className="font-semibold">{ord.customerName}</span></p>
                            <p>{t('الهاتف:', 'Phone:')} <span className="font-semibold" dir="ltr">{ord.customerPhone}</span></p>
                            {ord.customerPhone2 && <p>{t('هاتف إضافي:', 'Additional phone:')} <span className="font-semibold" dir="ltr">{ord.customerPhone2}</span></p>}
                            <p>{t('العنوان:', 'Address:')} <span className="font-semibold">{ord.address}</span></p>
                            <p>{t('المحافظة:', 'Governorate:')} <span className="font-semibold">{ord.governorate}</span></p>
                            {ord.country && <p>{t('الدولة:', 'Country:')} <span className="font-semibold">{ord.country}</span></p>}
                            {ord.zipCode && <p>ZIP: <span className="font-semibold" dir="ltr">{ord.zipCode}</span></p>}
                            {ord.shippingCompany && <p>{t('شركة الشحن:', 'Shipping company:')} <span className="font-semibold text-blue-700">🚚 {ord.shippingCompany}</span></p>}
                            {ord.shippingStatus && <p>{t('حالة الشحن الحالية:', 'Current shipping status:')} <span className="font-semibold">{ord.shippingStatus}</span></p>}
                            {ord.shippingProviderId && <p>{t('رقم الشحنة (Shipment ID):', 'Shipment ID:')} <span className="font-semibold font-mono" dir="ltr">{ord.shippingProviderId}</span></p>}
                            {ord.trackingNumber && <p>{t('رقم التتبع:', 'Tracking number:')} <span className="font-semibold font-mono" dir="ltr">{ord.trackingNumber}</span></p>}
                            {ord.shippingRawStatus && <p>{t('حالة الشركة الخام:', 'Raw carrier status:')} <span className="font-semibold font-mono">{ord.shippingRawStatus}</span></p>}
                            {ord.shippingUpdatedAt && <p>{t('آخر مزامنة:', 'Last sync:')} <span className="font-semibold">{new Date(ord.shippingUpdatedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</span></p>}
                            {ord.returnTrackingNumber && <p className="text-purple-700">{t('رقم تتبع المرتجع:', 'Return tracking number:')} <span className="font-semibold font-mono" dir="ltr">{ord.returnTrackingNumber}</span> {ord.returnStatus ? `(${ord.returnStatus})` : ''}</p>}
                            {ord.exchangeTrackingNumber && <p className="text-indigo-700">{t('رقم تتبع الاستبدال:', 'Exchange tracking number:')} <span className="font-semibold font-mono" dir="ltr">{ord.exchangeTrackingNumber}</span> {ord.exchangeStatus ? `(${ord.exchangeStatus})` : ''}</p>}
                            {ord.shippingError && <p className="text-red-600">{t('خطأ الشحن:', 'Shipping error:')} <span className="font-semibold">{ord.shippingError}</span></p>}
                            {ord.discountCode && <p className="text-green-600">{t('كود الخصم:', 'Discount code:')} <span className="font-semibold">{ord.discountCode}</span></p>}
                            {ord.discountType === 'first_order' && <p className="text-green-600">{t(`تم تطبيق خصم ${adminSettings.current.promotions.guestDiscount.percentage}% للحساب الجديد`, `${adminSettings.current.promotions.guestDiscount.percentage}% new user discount applied`)}</p>}
                            {ord.promoLabel && <p className="text-green-600">🎁 {ord.promoLabel}</p>}
                            {ord.notes && <p className="text-blue-600">{t('ملاحظات:', 'Notes:')} <span className="font-semibold">{ord.notes}</span></p>}
                          </div>

                          {/* ===== بيانات الدفع الإلكتروني (محفظة) ===== */}
                          {ord.paymentMethod === 'wallet' && (
                            <div className={`rounded-lg border px-4 py-3 text-sm space-y-2 ${ord.walletPayment?.confirmed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                              <p className="font-bold text-[var(--lava-text)] mb-1">📱 {t('بيانات الدفع الإلكتروني', 'Electronic Payment Details')} {ord.walletPayment?.methodName ? `- ${ord.walletPayment.methodName}` : ''}</p>
                              {ord.walletPayment?.walletPhoneNumber && (
                                <p>{t('حوّل على رقم:', 'Transferred to:')} <span className="font-semibold" dir="ltr">{ord.walletPayment.walletPhoneNumber}</span></p>
                              )}
                              {ord.walletPayment?.senderPhone && (
                                <p>{t('حوّل من رقم:', 'Transferred from:')} <span className="font-semibold" dir="ltr">{ord.walletPayment.senderPhone}</span></p>
                              )}
                              {ord.walletPayment?.transferDate && (
                                <p>{t('تاريخ التحويل:', 'Transfer date:')} <span className="font-semibold">{ord.walletPayment.transferDate}</span></p>
                              )}
                              {ord.walletPayment?.screenshotUrl && (
                                <a href={ord.walletPayment.screenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                                  <img src={ord.walletPayment.screenshotUrl} alt="screenshot" className="max-h-32 rounded-lg border mt-1" />
                                </a>
                              )}
                              {(user.role === 'admin' || user.role === 'call_center') && (
                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={async () => {
                                      setOrders(prev => prev.map(o => o.id === ord.id ? { ...o, walletPayment: { ...o.walletPayment, confirmed: true } } : o));
                                      try { await ordersAPI.confirmPayment(ord.id, true); } catch (err) { console.error('تعذّر تأكيد الدفع:', err); }
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                  >
                                    ✓ {t('تأكيد استلام الفلوس', 'Confirm Payment Received')}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      setOrders(prev => prev.map(o => o.id === ord.id ? { ...o, walletPayment: { ...o.walletPayment, confirmed: false } } : o));
                                      try { await ordersAPI.confirmPayment(ord.id, false); } catch (err) { console.error('تعذّر إلغاء تأكيد الدفع:', err); }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                  >
                                    ✗ {t('إلغاء التأكيد', 'Unconfirm')}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ===== استرجاع فلوس Kashier / Paymob (كامل أو جزئي) ===== */}
                          {(ord.paymentMethod === 'kashier' || ord.paymentMethod === 'paymob') && ord.paymentStatus === 'paid' && user.role === 'admin' && (() => {
                            const alreadyRefunded = Number(ord.refundedAmount || 0);
                            const remaining = Math.round((Number(ord.totalAmount || 0) - alreadyRefunded) * 100) / 100;
                            if (remaining <= 0) return null;
                            const hasGatewayRef = ord.paymentMethod === 'kashier'
                              ? !!ord.paymentGateway?.kashierOrderId
                              : !!ord.paymentGateway?.transactionId;
                            const inputValue = refundAmountByOrder[ord.id] ?? '';
                            const isLoading = refundLoadingOrderId === ord.id;

                            const doRefund = async (amount) => {
                              if (!window.confirm(t(
                                `هترجع ${amount} جنيه فعليًا للعميل عن طريق ${ord.paymentMethod === 'kashier' ? 'Kashier' : 'Paymob'}. متأكد؟`,
                                `This will actually refund ${amount} EGP to the customer via ${ord.paymentMethod === 'kashier' ? 'Kashier' : 'Paymob'}. Are you sure?`
                              ))) return;
                              setRefundLoadingOrderId(ord.id);
                              try {
                                const updated = await ordersAPI.refundPayment(ord.id, amount);
                                setOrders(prev => prev.map(o => (o.id === ord.id ? { ...o, ...updated, id: o.id } : o)));
                                setRefundAmountByOrder(prev => ({ ...prev, [ord.id]: '' }));
                              } catch (err) {
                                console.error('تعذّر استرجاع الفلوس:', err);
                                alert(err?.response?.data?.message || t('تعذّر استرجاع الفلوس، حاول تاني', 'Could not process the refund, please try again'));
                              } finally {
                                setRefundLoadingOrderId(null);
                              }
                            };

                            return (
                              <div className="rounded-lg border px-4 py-3 text-sm space-y-2 bg-rose-50 border-rose-200">
                                <p className="font-bold text-[var(--lava-text)] mb-1">
                                  💸 {t('استرجاع فلوس', 'Refund')} - {ord.paymentMethod === 'kashier' ? 'Kashier' : 'Paymob'}
                                </p>
                                {alreadyRefunded > 0 && (
                                  <p className="text-xs text-rose-700">
                                    {t(`اترجع قبل كده: ${alreadyRefunded} جنيه — الباقي القابل للاسترجاع: ${remaining} جنيه`, `Already refunded: ${alreadyRefunded} EGP — remaining refundable: ${remaining} EGP`)}
                                  </p>
                                )}
                                {!hasGatewayRef && (
                                  <p className="text-xs text-amber-700">
                                    {t('مفيش رقم عملية محفوظ على الطلب ده — استرجع الفلوس يدويًا من لوحة تحكم البوابة.', 'No gateway transaction reference saved on this order — refund manually from the gateway dashboard.')}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={remaining}
                                    step="0.01"
                                    placeholder={t(`المبلغ (الكل = ${remaining})`, `Amount (all = ${remaining})`)}
                                    value={inputValue}
                                    onChange={(e) => setRefundAmountByOrder(prev => ({ ...prev, [ord.id]: e.target.value }))}
                                    disabled={!hasGatewayRef || isLoading}
                                    className="border rounded-lg px-2 py-1.5 text-xs w-40 disabled:bg-[var(--lava-secondary)]"
                                  />
                                  <button
                                    onClick={() => doRefund(inputValue ? Number(inputValue) : undefined)}
                                    disabled={!hasGatewayRef || isLoading || (inputValue !== '' && (!Number(inputValue) || Number(inputValue) <= 0 || Number(inputValue) > remaining))}
                                    className="bg-rose-600 hover:bg-rose-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                  >
                                    {isLoading ? t('جاري الاسترجاع...', 'Refunding...') : (inputValue ? t('استرجاع جزئي', 'Partial refund') : t('استرجاع الكل', 'Refund all'))}
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                          {/* ===== استرجاع منتج معين من الطلب (Return Request) ===== */}
                          {user.role === 'admin' && adminSettings.current.enableReturns !== false && (() => {
                            const itemKey = (item) => `${item.productId || item.id || ''}|${item.variantId || ''}|${item.size || ''}`;
                            const isFormOpen = returnFormOrderId === ord.id;
                            const isReviewLoading = returnReviewLoadingOrderId === ord.id;

                            const applyUpdatedOrder = (updated) => {
                              setOrders(prev => prev.map(o => (o.id === ord.id ? { ...o, ...updated, id: o.id } : o)));
                            };

                            // ===== حالة 1: فيه طلب استرجاع من العميل قيد المراجعة =====
                            if (ord.returnRequestStatus === 'pending') {
                              return (
                                <div className="rounded-lg border px-4 py-3 text-sm space-y-2 bg-amber-50 border-amber-200">
                                  <p className="font-bold text-amber-800">⏳ {t('طلب استرجاع من العميل قيد المراجعة', "Customer return request pending review")}</p>
                                  <div className="space-y-1">
                                    {(ord.returnItems || []).map((ri, i) => {
                                      const matchedItem = (ord.items || []).find(it => itemKey(it) === `${ri.productId || ''}|${ri.variantId || ''}|${ri.size || ''}`);
                                      return (
                                        <p key={i} className="text-xs text-amber-700">
                                          • {matchedItem ? getLocalized(matchedItem.name) : t('منتج', 'Item')} {ri.size ? `(${ri.size})` : ''} × {ri.quantity}
                                          {ri.reason && <span className="text-amber-600"> — {ri.reason}</span>}
                                        </p>
                                      );
                                    })}
                                  </div>
                                  {ord.returnRequestReason && (
                                    <p className="text-xs text-amber-700">{t('سبب العميل:', "Customer's reason:")} {ord.returnRequestReason}</p>
                                  )}
                                  {(() => {
                                    const currentCode = returnReviewReasonCodeByOrder[ord.id] ?? (ord.returnRequestReasonCode || '');
                                    const selectedReason = RETURN_REASONS.find(r => r.code === currentCode);
                                    const feeAmount = Number(adminSettings.current.returnFeeAmount ?? 80);
                                    return (
                                      <div className="space-y-1 pt-1">
                                        <label className="block text-xs font-bold text-amber-800">
                                          {t('سبب الاسترجاع (يقدر الأدمن يصححه لو مختلف):', "Return reason (admin can correct it if different):")}
                                        </label>
                                        <select
                                          value={currentCode}
                                          onChange={(e) => setReturnReviewReasonCodeByOrder(prev => ({ ...prev, [ord.id]: e.target.value }))}
                                          className="w-full border border-amber-300 rounded-lg px-2 py-1.5 text-xs bg-[var(--lava-card)]"
                                        >
                                          <option value="">{t('غير محدد', 'Not specified')}</option>
                                          {RETURN_REASONS.map(r => (
                                            <option key={r.code} value={r.code}>{t(r.ar, r.en)}</option>
                                          ))}
                                        </select>
                                        {selectedReason && (
                                          <p className={`text-xs font-bold ${selectedReason.feeApplies ? 'text-amber-700' : 'text-green-700'}`}>
                                            {selectedReason.feeApplies
                                              ? `💸 ${t(`هيتم خصم ${feeAmount} ج.م رسوم شحن استرجاع من مبلغ الاسترجاع`, `${feeAmount} EGP return shipping fee will be deducted from the refund`)}`
                                              : `✅ ${t('استرجاع مجاني - مفيش رسوم', 'Free return - no fee')}`}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      disabled={isReviewLoading}
                                      onClick={async () => {
                                        setReturnReviewLoadingOrderId(ord.id);
                                        try {
                                          const reasonCode = returnReviewReasonCodeByOrder[ord.id] ?? (ord.returnRequestReasonCode || undefined);
                                          const updated = await ordersAPI.reviewReturnRequest(ord.id, { action: 'approve', reasonCode });
                                          applyUpdatedOrder(updated);
                                          showToast(t('تمت الموافقة على الاسترجاع ✅', 'Return approved ✅'));
                                        } catch (err) {
                                          console.error('تعذّرت الموافقة على الاسترجاع:', err);
                                          alert(err?.response?.data?.message || err?.message || t('تعذّرت الموافقة على الاسترجاع', 'Could not approve the return'));
                                        } finally {
                                          setReturnReviewLoadingOrderId(null);
                                        }
                                      }}
                                      className="bg-green-600 hover:bg-green-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                    >
                                      ✓ {t('موافقة', 'Approve')}
                                    </button>
                                    <button
                                      disabled={isReviewLoading}
                                      onClick={async () => {
                                        const note = window.prompt(t('سبب الرفض (اختياري):', 'Rejection reason (optional):'), '');
                                        setReturnReviewLoadingOrderId(ord.id);
                                        try {
                                          const updated = await ordersAPI.reviewReturnRequest(ord.id, { action: 'reject', adminNote: note || undefined });
                                          applyUpdatedOrder(updated);
                                        } catch (err) {
                                          console.error('تعذّر رفض الاسترجاع:', err);
                                          alert(err?.response?.data?.message || err?.message || t('تعذّر رفض الاسترجاع', 'Could not reject the return'));
                                        } finally {
                                          setReturnReviewLoadingOrderId(null);
                                        }
                                      }}
                                      className="bg-red-600 hover:bg-red-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                    >
                                      ✗ {t('رفض', 'Reject')}
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            // ===== حالة 2: طلب معتمد بالفعل - محتاج رقم تتبع المرتجع يدويًا =====
                            if (ord.returnRequestStatus === 'approved') {
                              const trackingInput = returnTrackingInputByOrder[ord.id] ?? (ord.returnTrackingNumber || '');
                              const isSaving = returnTrackingSavingOrderId === ord.id;
                              return (
                                <div className="rounded-lg border px-4 py-3 text-sm space-y-2 bg-purple-50 border-purple-200">
                                  <p className="font-bold text-purple-800">↩️ {t('تم استرجاع منتجات من الطلب ده', 'Items from this order were returned')}</p>
                                  {ord.returnFeeCharged > 0 && (
                                    <p className="text-xs text-purple-700">
                                      💸 {t(`تم خصم ${ord.returnFeeCharged} ج.م رسوم شحن استرجاع من مبلغ الاسترجاع`, `${ord.returnFeeCharged} EGP return shipping fee was deducted from the refund`)}
                                    </p>
                                  )}
                                  {ord.returnTrackingNumber ? (
                                    <>
                                      <p className="text-xs text-purple-700">
                                        {t('رقم تتبع المرتجع:', 'Return tracking number:')} <span className="font-mono font-bold" dir="ltr">{ord.returnTrackingNumber}</span>
                                        {ord.returnTrackingProvider && <span className="text-purple-500"> · {ord.returnTrackingProvider}</span>}
                                      </p>
                                      {/* ===== حالة/Badge المزامنة + آخر مزامنة ===== */}
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                          {ord.returnStatus || t('غير معروف', 'Unknown')}
                                        </span>
                                        {ord.returnLastTrackingSyncAt && (
                                          <span className="text-xs text-purple-500">
                                            {t('آخر مزامنة:', 'Last sync:')} {new Date(ord.returnLastTrackingSyncAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                                          </span>
                                        )}
                                      </div>
                                      {ord.returnLastProviderEvent && (
                                        <p className="text-xs text-purple-500">{ord.returnLastProviderEvent}</p>
                                      )}
                                      {/* ===== زرار "مزامنة الآن" - بيستخدم shippingAPI.syncReturnTracking (endpoint جاهز بالفعل بالباك اند) ===== */}
                                      <button
                                        disabled={returnSyncingOrderId === ord.id}
                                        onClick={async () => {
                                          setReturnSyncingOrderId(ord.id);
                                          try {
                                            const res = await shippingAPI.syncReturnTracking(ord.id);
                                            applyUpdatedOrder(res?.order);
                                            showToast(t('تم تحديث حالة المرتجع ✅', 'Return status refreshed ✅'));
                                          } catch (err) {
                                            console.error('تعذّرت مزامنة المرتجع:', err);
                                            const msg = err?.code === 'MANUAL_TRACKING_ONLY' || err?.response?.data?.code === 'MANUAL_TRACKING_ONLY'
                                              ? t('شركة الشحن دي مش بتدعم المزامنة الآلية - التحديث يدوي', 'This carrier doesn\'t support automatic sync - update manually')
                                              : (err?.response?.data?.message || err?.message || t('تعذّرت المزامنة', 'Sync failed'));
                                            showToast(msg);
                                          } finally {
                                            setReturnSyncingOrderId(null);
                                          }
                                        }}
                                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs w-fit"
                                      >
                                        {returnSyncingOrderId === ord.id ? `⏳ ${t('جاري المزامنة...', 'Syncing...')}` : `🔄 ${t('مزامنة الآن', 'Sync Now')}`}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-xs text-purple-700">
                                        {t('روح موقع شركة الشحن واعمل طلب استرجاع، ولما تاخد رقم التتبع حطه هنا:', "Go to the courier's website, create the return request, then paste the tracking number here:")}
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        <input
                                          type="text"
                                          dir="ltr"
                                          value={trackingInput}
                                          onChange={(e) => setReturnTrackingInputByOrder(prev => ({ ...prev, [ord.id]: e.target.value }))}
                                          placeholder={t('رقم تتبع المرتجع', 'Return tracking number')}
                                          className="border rounded-lg px-3 py-1.5 text-xs flex-1 min-w-[160px]"
                                        />
                                        <button
                                          disabled={isSaving || !trackingInput.trim()}
                                          onClick={async () => {
                                            setReturnTrackingSavingOrderId(ord.id);
                                            try {
                                              // ===== Bosta Return/Exchange Integration: بنستخدم endpoint المخصص
                                              // بدل التحديث العام - بيحاول يعمل مزامنة فورية لو الشركة بتدعم تتبع آلي =====
                                              const res = await shippingAPI.setReturnTracking(ord.id, { trackingNumber: trackingInput.trim() });
                                              applyUpdatedOrder(res?.order);
                                              showToast(t('تم حفظ رقم تتبع المرتجع ✅', 'Return tracking number saved ✅'));
                                            } catch (err) {
                                              console.error('تعذّر حفظ رقم تتبع المرتجع:', err);
                                              alert(err?.response?.data?.message || err?.message || t('تعذّر الحفظ', 'Could not save'));
                                            } finally {
                                              setReturnTrackingSavingOrderId(null);
                                            }
                                          }}
                                          className="bg-purple-600 hover:bg-purple-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                        >
                                          {isSaving ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  {/* ===== معاينة المنتج بعد وصوله فعليًا - هي اللي بتقرر رجوع المخزون
                                      (مش زرار الموافقة) - شوف Order.returnInspectionResult ===== */}
                                  {ord.returnInspectionResult === 'pending' && (
                                    <div className="border-t border-purple-200 pt-2 mt-2 space-y-1.5">
                                      <p className="text-xs font-bold text-purple-800">📦 {t('المنتج وصل؟ عاينه:', 'Item arrived? Inspect it:')}</p>
                                      <div className="flex gap-2">
                                        <button
                                          disabled={inspectSavingId === `return:${ord.id}`}
                                          onClick={async () => {
                                            setInspectSavingId(`return:${ord.id}`);
                                            try {
                                              const updated = await ordersAPI.inspectReturnRequest(ord.id, { result: 'good' });
                                              applyUpdatedOrder(updated);
                                              showToast(t('تمام - المنتج رجع للمخزون ✅', 'Good - item returned to stock ✅'));
                                            } catch (err) {
                                              console.error('تعذّر تسجيل المعاينة:', err);
                                              alert(err?.response?.data?.message || err?.message || t('تعذّر تسجيل المعاينة', 'Could not save inspection'));
                                            } finally {
                                              setInspectSavingId(null);
                                            }
                                          }}
                                          className="bg-green-600 hover:bg-green-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                        >
                                          {inspectSavingId === `return:${ord.id}` ? `⏳ ${t('جاري الحفظ...', 'Saving...')}` : `✅ ${t('كويس - رجّع للمخزون', 'Good - restock')}`}
                                        </button>
                                        <button
                                          disabled={inspectSavingId === `return:${ord.id}`}
                                          onClick={async () => {
                                            setInspectSavingId(`return:${ord.id}`);
                                            try {
                                              const updated = await ordersAPI.inspectReturnRequest(ord.id, { result: 'bad' });
                                              applyUpdatedOrder(updated);
                                              showToast(t('تم التسجيل - المنتج مش سليم، منرجعش للمخزون', 'Saved - item not restocked'));
                                            } catch (err) {
                                              console.error('تعذّر تسجيل المعاينة:', err);
                                              alert(err?.response?.data?.message || err?.message || t('تعذّر تسجيل المعاينة', 'Could not save inspection'));
                                            } finally {
                                              setInspectSavingId(null);
                                            }
                                          }}
                                          className="bg-red-600 hover:bg-red-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                        >
                                          {inspectSavingId === `return:${ord.id}` ? `⏳ ${t('جاري الحفظ...', 'Saving...')}` : `❌ ${t('مش كويس - متترجعش للمخزون', 'Bad - do not restock')}`}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  {ord.returnInspectionResult === 'good' && (
                                    <p className="text-xs font-bold text-green-700 border-t border-purple-200 pt-2 mt-2">✅ {t('اتعاين: المنتج سليم ورجع للمخزون', 'Inspected: item was good and restocked')}</p>
                                  )}
                                  {ord.returnInspectionResult === 'bad' && (
                                    <p className="text-xs font-bold text-red-700 border-t border-purple-200 pt-2 mt-2">❌ {t('اتعاين: المنتج مش سليم - منرجعش للمخزون', 'Inspected: item was bad - not restocked')}</p>
                                  )}
                                </div>
                              );
                            }

                            // ===== حالة 3: مفيش طلب استرجاع - الأدمن يقدر يبدأ استرجاع بنفسه
                            // (مثلاً العميل كلّمه تليفونيًا وطلب يرجّع منتج معين) =====
                            const isDeliveredOrd = ord.status === t('تم التسليم', 'Delivered') || ord.shippingStatus === 'delivered';
                            if (!isDeliveredOrd) return null;
                            return (
                              <div className="rounded-lg border px-4 py-3 text-sm space-y-2">
                                {!isFormOpen ? (
                                  <button
                                    onClick={() => { setReturnFormOrderId(ord.id); setReturnFormSelection({}); setReturnFormReason(''); setReturnFormShippingCost(''); setReturnFormReasonCode(''); }}
                                    className="text-sm font-bold text-[var(--lava-text)] hover:text-black underline"
                                  >
                                    ↩️ {t('تسجيل استرجاع منتج (العميل طلب تليفونيًا مثلًا)', 'Log a return (e.g. customer called in)')}
                                  </button>
                                ) : (
                                  <>
                                    <p className="font-bold text-sm">{t('اختار المنتج (المنتجات) اللي هترجع:', 'Select the item(s) being returned:')}</p>
                                    <div className="space-y-2">
                                      {(ord.items || []).map((item, idx) => {
                                        const key = itemKey(item);
                                        const checked = returnFormSelection[key] != null;
                                        return (
                                          <div key={idx} className="flex items-center gap-3 text-sm border rounded-lg px-3 py-2">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={(e) => {
                                                setReturnFormSelection(prev => {
                                                  const next = { ...prev };
                                                  if (e.target.checked) next[key] = 1; else delete next[key];
                                                  return next;
                                                });
                                              }}
                                            />
                                            <span className="flex-1">{getLocalized(item.name)} {item.size ? `(${item.size})` : ''}</span>
                                            {checked && (item.quantity || 1) > 1 && (
                                              <input
                                                type="number"
                                                min="1"
                                                max={item.quantity || 1}
                                                value={returnFormSelection[key]}
                                                onChange={(e) => {
                                                  const v = Math.max(1, Math.min(item.quantity || 1, Number(e.target.value) || 1));
                                                  setReturnFormSelection(prev => ({ ...prev, [key]: v }));
                                                }}
                                                className="w-16 border rounded px-2 py-1 text-xs"
                                              />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-[var(--lava-muted)] mb-1">{t('سبب الاسترجاع:', 'Return reason:')}</label>
                                      <select
                                        value={returnFormReasonCode}
                                        onChange={(e) => setReturnFormReasonCode(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm bg-[var(--lava-card)]"
                                      >
                                        <option value="">{t('غير محدد (هيتحسب كأنه رسوم)', 'Not specified (will be treated as fee-applicable)')}</option>
                                        {RETURN_REASONS.map(r => (
                                          <option key={r.code} value={r.code}>{t(r.ar, r.en)}</option>
                                        ))}
                                      </select>
                                      {(() => {
                                        const selectedReason = RETURN_REASONS.find(r => r.code === returnFormReasonCode);
                                        if (!selectedReason) return null;
                                        const feeAmount = Number(adminSettings.current.returnFeeAmount ?? 80);
                                        return (
                                          <p className={`text-xs font-bold mt-1 ${selectedReason.feeApplies ? 'text-amber-700' : 'text-green-700'}`}>
                                            {selectedReason.feeApplies
                                              ? `💸 ${t(`هيتم خصم ${feeAmount} ج.م رسوم شحن استرجاع`, `${feeAmount} EGP return shipping fee will be deducted`)}`
                                              : `✅ ${t('استرجاع مجاني - مفيش رسوم', 'Free return - no fee')}`}
                                          </p>
                                        );
                                      })()}
                                    </div>
                                    <textarea
                                      value={returnFormReason}
                                      onChange={(e) => setReturnFormReason(e.target.value)}
                                      placeholder={t('ملاحظة/سبب الاسترجاع (اختياري)', 'Return note/reason (optional)')}
                                      className="w-full border rounded-lg px-3 py-2 text-sm"
                                      rows={2}
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      value={returnFormShippingCost}
                                      onChange={(e) => setReturnFormShippingCost(e.target.value)}
                                      placeholder={t('تكلفة شحن الإرجاع بالجنيه (اختياري)', 'Return shipping cost in EGP (optional)')}
                                      className="w-full border rounded-lg px-3 py-2 text-sm"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        disabled={returnFormLoading || Object.keys(returnFormSelection).length === 0}
                                        onClick={async () => {
                                          const items = (ord.items || [])
                                            .filter(item => returnFormSelection[itemKey(item)] != null)
                                            .map(item => ({
                                              productId: item.productId || item.id,
                                              variantId: item.variantId || null,
                                              size: item.size || null,
                                              quantity: returnFormSelection[itemKey(item)],
                                            }));
                                          setReturnFormLoading(true);
                                          try {
                                            const updated = await ordersAPI.reviewReturnRequest(ord.id, {
                                              action: 'create',
                                              items,
                                              adminNote: returnFormReason || undefined,
                                              returnShippingCost: returnFormShippingCost !== '' ? Number(returnFormShippingCost) : undefined,
                                              reasonCode: returnFormReasonCode || undefined,
                                            });
                                            applyUpdatedOrder(updated);
                                            setReturnFormOrderId(null);
                                            showToast(t('تم تسجيل الاسترجاع ✅', 'Return logged ✅'));
                                          } catch (err) {
                                            console.error('تعذّر تسجيل الاسترجاع:', err);
                                            alert(err?.response?.data?.message || err?.message || t('تعذّر تسجيل الاسترجاع', 'Could not log the return'));
                                          } finally {
                                            setReturnFormLoading(false);
                                          }
                                        }}
                                        className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold disabled:bg-[var(--lava-border)]"
                                      >
                                        {returnFormLoading ? t('جاري التسجيل...', 'Logging...') : t('تسجيل الاسترجاع', 'Log return')}
                                      </button>
                                      <button onClick={() => setReturnFormOrderId(null)} className="text-sm text-[var(--lava-muted)] hover:text-black px-3 py-2">
                                        {t('إلغاء', 'Cancel')}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}

                          {/* ===== قسم الاستبدال جوه Admin → Orders - مطابق تمامًا لقسم الاسترجاع فوق =====
                              3 حالات زي الاسترجاع بالظبط:
                              1) فيه طلب استبدال pending من العميل → موافقة/رفض.
                              2) طلب approved ومفيش رقم تتبع لسه → Input يدوي + حفظ.
                              3) مفيش طلب استبدال خالص → الأدمن يقدر يسجّله بنفسه (العميل كلّمه تليفونيًا مثلًا). */}
                          {(() => {
                            if (adminSettings.current.enableExchanges === false) return null;
                            const itemKey = (item) => `${item.productId || item.id || ''}|${item.variantId || ''}|${item.size || ''}`;
                            const orderExchanges = adminExchangeRequests.filter(e => String(e.orderId) === String(ord.id));
                            const pendingExchange = orderExchanges.find(e => ['pending', 'under_review'].includes(e.status));
                            const activeExchange = orderExchanges.find(e => ['approved', 'pickup_scheduled', 'received', 'processing'].includes(e.status));
                            const isReviewLoadingHere = exchangeReviewLoadingId != null;

                            const applyUpdatedExchange = (updated) => {
                              const uid = updated?._id || updated?.id;
                              setAdminExchangeRequests(prev => prev.map(e => (e.id === uid ? { ...e, ...updated, id: e.id } : e)));
                            };

                            // ===== حالة 1: فيه طلب استبدال من العميل قيد المراجعة =====
                            if (pendingExchange) {
                              const currentCode = exchangeReviewReasonCodeById[pendingExchange.id] ?? (pendingExchange.reasonCode || '');
                              const selectedReason = EXCHANGE_REASONS.find(r => r.code === currentCode);
                              const feeAmount = Number(adminSettings.current.exchangeFeeAmount ?? 80);
                              return (
                                <div className="rounded-lg border px-4 py-3 text-sm space-y-2 bg-amber-50 border-amber-200">
                                  <p className="font-bold text-amber-800">⏳ {t('طلب استبدال من العميل قيد المراجعة', 'Customer exchange request pending review')}</p>
                                  <div className="space-y-1">
                                    {(pendingExchange.items || []).map((ei, i) => {
                                      const matchedItem = (ord.items || []).find(it => itemKey(it) === `${ei.productId || ''}|${ei.oldVariant?.variantId || ''}|${ei.oldVariant?.size || ''}`);
                                      return (
                                        <p key={i} className="text-xs text-amber-700">
                                          • {matchedItem ? getLocalized(matchedItem.name) : t('منتج', 'Item')} {ei.oldVariant?.size ? `(${ei.oldVariant.size})` : ''} → {ei.requestedNewVariant?.size ? `(${ei.requestedNewVariant.size})` : ''} × {ei.quantity}
                                        </p>
                                      );
                                    })}
                                  </div>
                                  {pendingExchange.customerNote && (
                                    <p className="text-xs text-amber-700">{t('سبب العميل:', "Customer's reason:")} {pendingExchange.customerNote}</p>
                                  )}
                                  <div className="space-y-1 pt-1">
                                    <label className="block text-xs font-bold text-amber-800">
                                      {t('سبب الاستبدال (يقدر الأدمن يصححه لو مختلف):', "Exchange reason (admin can correct it if different):")}
                                    </label>
                                    <select
                                      value={currentCode}
                                      onChange={(e) => setExchangeReviewReasonCodeById(prev => ({ ...prev, [pendingExchange.id]: e.target.value }))}
                                      className="w-full border border-amber-300 rounded-lg px-2 py-1.5 text-xs bg-[var(--lava-card)]"
                                    >
                                      <option value="">{t('غير محدد', 'Not specified')}</option>
                                      {EXCHANGE_REASONS.map(r => (
                                        <option key={r.code} value={r.code}>{t(r.ar, r.en)}</option>
                                      ))}
                                    </select>
                                    {selectedReason && (
                                      <p className={`text-xs font-bold ${selectedReason.feeApplies ? 'text-amber-700' : 'text-green-700'}`}>
                                        {selectedReason.feeApplies
                                          ? `💸 ${t(`هيتم تحصيل ${feeAmount} ج.م رسوم استبدال`, `${feeAmount} EGP exchange fee will apply`)}`
                                          : `✅ ${t('استبدال مجاني - مفيش رسوم', 'Free exchange - no fee')}`}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      disabled={isReviewLoadingHere}
                                      onClick={async () => {
                                        setExchangeReviewLoadingId(pendingExchange.id);
                                        try {
                                          const reasonCode = exchangeReviewReasonCodeById[pendingExchange.id] ?? (pendingExchange.reasonCode || undefined);
                                          const updated = await exchangeAPI.review(pendingExchange.id, { action: 'approve', reasonCode });
                                          applyUpdatedExchange(updated);
                                          showToast(t('تمت الموافقة على الاستبدال ✅', 'Exchange approved ✅'));
                                        } catch (err) {
                                          console.error('تعذّرت الموافقة على الاستبدال:', err);
                                          alert(err?.response?.data?.message || err?.message || t('تعذّرت الموافقة على الاستبدال', 'Could not approve the exchange'));
                                        } finally {
                                          setExchangeReviewLoadingId(null);
                                        }
                                      }}
                                      className="bg-green-600 hover:bg-green-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                    >
                                      ✓ {t('موافقة', 'Approve')}
                                    </button>
                                    <button
                                      disabled={isReviewLoadingHere}
                                      onClick={async () => {
                                        const note = window.prompt(t('سبب الرفض (اختياري):', 'Rejection reason (optional):'), '');
                                        setExchangeReviewLoadingId(pendingExchange.id);
                                        try {
                                          const updated = await exchangeAPI.review(pendingExchange.id, { action: 'reject', adminNote: note || undefined });
                                          applyUpdatedExchange(updated);
                                        } catch (err) {
                                          console.error('تعذّر رفض الاستبدال:', err);
                                          alert(err?.response?.data?.message || err?.message || t('تعذّر رفض الاستبدال', 'Could not reject the exchange'));
                                        } finally {
                                          setExchangeReviewLoadingId(null);
                                        }
                                      }}
                                      className="bg-red-600 hover:bg-red-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                    >
                                      ✗ {t('رفض', 'Reject')}
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            // ===== حالة 2: طلب معتمد بالفعل - محتاج رقم تتبع الاستبدال يدويًا =====
                            if (activeExchange) {
                              const trackingInput = exchangeTrackingInputById[activeExchange.id] ?? (activeExchange.trackingNumber || '');
                              const isSaving = exchangeTrackingSavingId === activeExchange.id;
                              return (
                                <div className="rounded-lg border px-4 py-3 text-sm space-y-2 bg-indigo-50 border-indigo-200">
                                  <p className="font-bold text-indigo-800">🔄 {t('تم اعتماد استبدال منتجات من الطلب ده', 'An exchange for items in this order was approved')}</p>
                                  <p className="text-xs font-bold text-indigo-700">
                                    {t('الحالة الحالية:', 'Current status:')} {t(EXCHANGE_STATUS_LABELS[activeExchange.status]?.ar || activeExchange.status, EXCHANGE_STATUS_LABELS[activeExchange.status]?.en || activeExchange.status)}
                                  </p>
                                  {activeExchange.fee > 0 && (
                                    <p className="text-xs text-indigo-700">
                                      💸 {t(`رسوم الاستبدال: ${activeExchange.fee} ${activeExchange.currency || 'ج.م'}`, `Exchange fee: ${activeExchange.fee} ${activeExchange.currency || 'EGP'}`)}
                                    </p>
                                  )}
                                  {activeExchange.trackingNumber ? (
                                    <>
                                      <p className="text-xs text-indigo-700">
                                        {t('رقم تتبع الاستبدال:', 'Exchange tracking number:')} <span className="font-mono font-bold" dir="ltr">{activeExchange.trackingNumber}</span>
                                        {activeExchange.provider && <span className="text-indigo-500"> · {activeExchange.provider}</span>}
                                      </p>
                                      {/* ===== حالة/Badge تتبع الشحنة (مختلف عن status الـworkflow فوق) + آخر مزامنة ===== */}
                                      {activeExchange.trackingStatus && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                            {activeExchange.trackingStatus}
                                          </span>
                                          {activeExchange.lastTrackingSyncAt && (
                                            <span className="text-xs text-indigo-500">
                                              {t('آخر مزامنة:', 'Last sync:')} {new Date(activeExchange.lastTrackingSyncAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {activeExchange.lastProviderEvent && (
                                        <p className="text-xs text-indigo-500">{activeExchange.lastProviderEvent}</p>
                                      )}
                                      {/* ===== زرار "مزامنة الآن" - بيستخدم exchangeAPI.syncTracking (endpoint جاهز بالفعل بالباك اند) ===== */}
                                      <button
                                        disabled={exchangeSyncingId === activeExchange.id}
                                        onClick={async () => {
                                          setExchangeSyncingId(activeExchange.id);
                                          try {
                                            const res = await exchangeAPI.syncTracking(activeExchange.id);
                                            applyUpdatedExchange(res?.exchangeRequest);
                                            showToast(t('تم تحديث حالة الاستبدال ✅', 'Exchange status refreshed ✅'));
                                          } catch (err) {
                                            console.error('تعذّرت مزامنة الاستبدال:', err);
                                            const msg = err?.code === 'MANUAL_TRACKING_ONLY' || err?.response?.data?.code === 'MANUAL_TRACKING_ONLY'
                                              ? t('شركة الشحن دي مش بتدعم المزامنة الآلية - التحديث يدوي', 'This carrier doesn\'t support automatic sync - update manually')
                                              : (err?.response?.data?.message || err?.message || t('تعذّرت المزامنة', 'Sync failed'));
                                            showToast(msg);
                                          } finally {
                                            setExchangeSyncingId(null);
                                          }
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs w-fit"
                                      >
                                        {exchangeSyncingId === activeExchange.id ? `⏳ ${t('جاري المزامنة...', 'Syncing...')}` : `🔄 ${t('مزامنة الآن', 'Sync Now')}`}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-xs text-indigo-700">
                                        {t('روح موقع شركة الشحن واعمل طلب استبدال، ولما تاخد رقم التتبع حطه هنا:', "Go to the courier's website, create the exchange shipment, then paste the tracking number here:")}
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        <input
                                          type="text"
                                          dir="ltr"
                                          value={trackingInput}
                                          onChange={(e) => setExchangeTrackingInputById(prev => ({ ...prev, [activeExchange.id]: e.target.value }))}
                                          placeholder={t('رقم تتبع الاستبدال', 'Exchange tracking number')}
                                          className="border rounded-lg px-3 py-1.5 text-xs flex-1 min-w-[160px]"
                                        />
                                        <button
                                          disabled={isSaving || !trackingInput.trim()}
                                          onClick={async () => {
                                            setExchangeTrackingSavingId(activeExchange.id);
                                            try {
                                              const updated = await exchangeAPI.updateTracking(activeExchange.id, trackingInput.trim());
                                              applyUpdatedExchange(updated);
                                              showToast(t('تم حفظ رقم تتبع الاستبدال ✅', 'Exchange tracking number saved ✅'));
                                            } catch (err) {
                                              console.error('تعذّر حفظ رقم تتبع الاستبدال:', err);
                                              alert(err?.response?.data?.message || err?.message || t('تعذّر الحفظ', 'Could not save'));
                                            } finally {
                                              setExchangeTrackingSavingId(null);
                                            }
                                          }}
                                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                        >
                                          {isSaving ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
                                        </button>
                                      </div>
                                    </>
                                  )}
                                  {activeExchange.status !== 'completed' && (() => {
                                    const currentIdx = EXCHANGE_WORKFLOW_ORDER.indexOf(activeExchange.status);
                                    const nextStages = EXCHANGE_WORKFLOW_ORDER.slice(Math.max(currentIdx, 0) + 1);
                                    const isUpdatingStatus = exchangeStatusUpdatingId === activeExchange.id;
                                    const advanceStatus = async (nextStatus) => {
                                      setExchangeStatusUpdatingId(activeExchange.id);
                                      try {
                                        const updated = await exchangeAPI.updateStatus(activeExchange.id, nextStatus);
                                        applyUpdatedExchange(updated);
                                        showToast(t('تم تحديث حالة الاستبدال ✅', 'Exchange status updated ✅'));
                                      } catch (err) {
                                        console.error('تعذّر تحديث حالة الاستبدال:', err);
                                        alert(err?.response?.data?.message || err?.message || t('تعذّر تحديث الحالة', 'Could not update status'));
                                      } finally {
                                        setExchangeStatusUpdatingId(null);
                                      }
                                    };
                                    return (
                                      <div className="pt-1">
                                        <label className="block text-xs font-bold text-indigo-800 mb-1">
                                          {t('حدّث حالة الاستبدال:', 'Update exchange status:')}
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                          {nextStages.map((stage) => (
                                            <button
                                              key={stage}
                                              disabled={isUpdatingStatus}
                                              onClick={() => advanceStatus(stage)}
                                              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                            >
                                              {isUpdatingStatus ? t('جاري التحديث...', 'Updating...') : t(EXCHANGE_STATUS_LABELS[stage]?.ar || stage, EXCHANGE_STATUS_LABELS[stage]?.en || stage)}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* ===== معاينة الفاريانت القديم بعد وصوله فعليًا من العميل - هي اللي
                                      بتقرر رجوع المخزون (مش زرار الموافقة) ===== */}
                                  {activeExchange.oldVariantInspectionResult === 'pending' && (
                                    <div className="border-t border-indigo-200 pt-2 mt-2 space-y-1.5">
                                      <p className="text-xs font-bold text-indigo-800">📦 {t('المنتج القديم وصل؟ عاينه:', 'Old item arrived? Inspect it:')}</p>
                                      <div className="flex gap-2">
                                        <button
                                          disabled={inspectSavingId === `exchange:${activeExchange.id}`}
                                          onClick={async () => {
                                            setInspectSavingId(`exchange:${activeExchange.id}`);
                                            try {
                                              const updated = await exchangeAPI.inspect(activeExchange.id, { result: 'good' });
                                              applyUpdatedExchange(updated);
                                              showToast(t('تمام - المنتج القديم رجع للمخزون ✅', 'Good - old item returned to stock ✅'));
                                            } catch (err) {
                                              console.error('تعذّر تسجيل المعاينة:', err);
                                              alert(err?.response?.data?.message || err?.message || t('تعذّر تسجيل المعاينة', 'Could not save inspection'));
                                            } finally {
                                              setInspectSavingId(null);
                                            }
                                          }}
                                          className="bg-green-600 hover:bg-green-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                        >
                                          {inspectSavingId === `exchange:${activeExchange.id}` ? `⏳ ${t('جاري الحفظ...', 'Saving...')}` : `✅ ${t('كويس - رجّع للمخزون', 'Good - restock')}`}
                                        </button>
                                        <button
                                          disabled={inspectSavingId === `exchange:${activeExchange.id}`}
                                          onClick={async () => {
                                            setInspectSavingId(`exchange:${activeExchange.id}`);
                                            try {
                                              const updated = await exchangeAPI.inspect(activeExchange.id, { result: 'bad' });
                                              applyUpdatedExchange(updated);
                                              showToast(t('تم التسجيل - المنتج القديم مش سليم، منرجعش للمخزون', 'Saved - old item not restocked'));
                                            } catch (err) {
                                              console.error('تعذّر تسجيل المعاينة:', err);
                                              alert(err?.response?.data?.message || err?.message || t('تعذّر تسجيل المعاينة', 'Could not save inspection'));
                                            } finally {
                                              setInspectSavingId(null);
                                            }
                                          }}
                                          className="bg-red-600 hover:bg-red-700 disabled:bg-[var(--lava-border)] text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                                        >
                                          {inspectSavingId === `exchange:${activeExchange.id}` ? `⏳ ${t('جاري الحفظ...', 'Saving...')}` : `❌ ${t('مش كويس - متترجعش للمخزون', 'Bad - do not restock')}`}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  {activeExchange.oldVariantInspectionResult === 'good' && (
                                    <p className="text-xs font-bold text-green-700 border-t border-indigo-200 pt-2 mt-2">✅ {t('اتعاين: المنتج القديم سليم ورجع للمخزون', 'Inspected: old item was good and restocked')}</p>
                                  )}
                                  {activeExchange.oldVariantInspectionResult === 'bad' && (
                                    <p className="text-xs font-bold text-red-700 border-t border-indigo-200 pt-2 mt-2">❌ {t('اتعاين: المنتج القديم مش سليم - منرجعش للمخزون', 'Inspected: old item was bad - not restocked')}</p>
                                  )}
                                </div>
                              );
                            }

                            // ===== حالة 3: مفيش طلب استبدال - الأدمن يقدر يبدأ استبدال بنفسه
                            // (مثلاً العميل كلّمه تليفونيًا وطلب يستبدل منتج) =====
                            const isDeliveredOrd = ord.status === t('تم التسليم', 'Delivered') || ord.shippingStatus === 'delivered';
                            if (!isDeliveredOrd) return null;
                            const isFormOpen = adminExchangeFormOrderId === ord.id;
                            return (
                              <div className="rounded-lg border px-4 py-3 text-sm space-y-2">
                                {!isFormOpen ? (
                                  <button
                                    onClick={() => {
                                      setAdminExchangeFormOrderId(ord.id);
                                      setAdminExchangeFormSelection({});
                                      setAdminExchangeFormReasonCode('');
                                      setAdminExchangeFormNote('');
                                    }}
                                    className="text-sm font-bold text-[var(--lava-text)] hover:text-black underline"
                                  >
                                    🔄 {t('تسجيل استبدال منتج (العميل طلب تليفونيًا مثلًا)', 'Log an exchange (e.g. customer called in)')}
                                  </button>
                                ) : (
                                  <>
                                    <p className="font-bold text-sm">{t('اختار المنتج اللي هيتستبدل والفاريانت الجديد:', 'Select the item to exchange and the new variant:')}</p>
                                    <div className="space-y-2">
                                      {(ord.items || []).map((item, idx) => {
                                        const key = itemKey(item);
                                        const sel = adminExchangeFormSelection[key];
                                        const checked = !!sel;
                                        const productId = item.productId || item.id;
                                        const productData = adminExchangeFormProducts[productId];
                                        return (
                                          <div key={idx} className="border rounded-lg px-3 py-2 text-sm space-y-2">
                                            <div className="flex items-center gap-3">
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={async (e) => {
                                                  if (e.target.checked) {
                                                    setAdminExchangeFormSelection(prev => ({ ...prev, [key]: { quantity: 1, newVariantId: '', newSize: '' } }));
                                                    let product = adminExchangeFormProducts[productId];
                                                    if (!product) {
                                                      try {
                                                        product = await productsAPI.getById(productId);
                                                        setAdminExchangeFormProducts(prev => ({ ...prev, [productId]: product }));
                                                      } catch (err) {
                                                        console.error('تعذّر تحميل بيانات المنتج:', err);
                                                      }
                                                    }
                                                    // المنتج ده مالوش ألوان أصلاً - اختار الفاريانت الوحيد تلقائيًا
                                                    if (product && !hasColors(product)) {
                                                      const defVariant = getDefaultVariant(product);
                                                      if (defVariant) {
                                                        setAdminExchangeFormSelection(prev => ({ ...prev, [key]: { ...prev[key], newVariantId: getCanonicalVariantId(defVariant) } }));
                                                      }
                                                    }
                                                  } else {
                                                    setAdminExchangeFormSelection(prev => {
                                                      const next = { ...prev };
                                                      delete next[key];
                                                      return next;
                                                    });
                                                  }
                                                }}
                                              />
                                              <span className="flex-1">{getLocalized(item.name)} {item.size ? `(${item.size})` : ''}</span>
                                              {checked && (item.quantity || 1) > 1 && (
                                                <input
                                                  type="number"
                                                  min="1"
                                                  max={item.quantity || 1}
                                                  value={sel.quantity}
                                                  onChange={(e) => {
                                                    const v = Math.max(1, Math.min(item.quantity || 1, Number(e.target.value) || 1));
                                                    setAdminExchangeFormSelection(prev => ({ ...prev, [key]: { ...prev[key], quantity: v } }));
                                                  }}
                                                  className="w-16 border rounded px-2 py-1 text-xs"
                                                />
                                              )}
                                            </div>
                                            {checked && (
                                              <div className="pl-7">
                                                {!productData ? (
                                                  <p className="text-xs text-[var(--lava-muted)]">{t('جاري تحميل الاختيارات...', 'Loading options...')}</p>
                                                ) : (() => {
                                                  const productHasColors = hasColors(productData);
                                                  const productHasSizes = (productData.sizes || []).length > 0;
                                                  const variant = (productData.variants || []).find(v => (v._id || v.id) === sel.newVariantId);
                                                  return (
                                                    <div className="flex flex-wrap gap-2">
                                                      {productHasColors && (
                                                        <select
                                                          value={sel.newVariantId}
                                                          onChange={(e) => setAdminExchangeFormSelection(prev => ({ ...prev, [key]: { ...prev[key], newVariantId: e.target.value, newSize: '' } }))}
                                                          className="border rounded-lg px-2 py-1.5 text-xs bg-[var(--lava-card)]"
                                                        >
                                                          <option value="">{t('اختار اللون...', 'Select color...')}</option>
                                                          {(productData.variants || []).map((v) => (
                                                            <option key={v._id || v.id} value={v._id || v.id}>{getLocalized(v.color) || v.hex || ''}</option>
                                                          ))}
                                                        </select>
                                                      )}
                                                      {productHasSizes && (
                                                        <select
                                                          value={sel.newSize}
                                                          onChange={(e) => setAdminExchangeFormSelection(prev => ({ ...prev, [key]: { ...prev[key], newSize: e.target.value } }))}
                                                          disabled={productHasColors && !sel.newVariantId}
                                                          className="border rounded-lg px-2 py-1.5 text-xs bg-[var(--lava-card)] disabled:bg-[var(--lava-secondary)]"
                                                        >
                                                          <option value="">{t('اختار المقاس...', 'Select size...')}</option>
                                                          {(variant?.sizeStock || []).map((s) => (
                                                            <option key={s.size} value={s.size} disabled={Number(s.stock) < 1}>
                                                              {s.size} {Number(s.stock) < 1 ? t('(غير متوفر)', '(out of stock)') : ''}
                                                            </option>
                                                          ))}
                                                        </select>
                                                      )}
                                                      {!productHasColors && !productHasSizes && (
                                                        <p className="text-xs text-[var(--lava-muted)]">{t('مفيش اختيارات تانية لازم تحددها لهذا المنتج.', 'No further options needed for this product.')}</p>
                                                      )}
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-[var(--lava-muted)] mb-1">{t('سبب الاستبدال:', 'Exchange reason:')}</label>
                                      <select
                                        value={adminExchangeFormReasonCode}
                                        onChange={(e) => setAdminExchangeFormReasonCode(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm bg-[var(--lava-card)]"
                                      >
                                        <option value="">{t('اختار السبب...', 'Select a reason...')}</option>
                                        {EXCHANGE_REASONS.map(r => (
                                          <option key={r.code} value={r.code}>{t(r.ar, r.en)}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <textarea
                                      value={adminExchangeFormNote}
                                      onChange={(e) => setAdminExchangeFormNote(e.target.value)}
                                      placeholder={t('ملاحظة/سبب الاستبدال (اختياري إلا لو السبب "أخرى")', 'Exchange note/reason (optional unless reason is "other")')}
                                      className="w-full border rounded-lg px-3 py-2 text-sm"
                                      rows={2}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        disabled={
                                          adminExchangeFormLoading ||
                                          Object.keys(adminExchangeFormSelection).length === 0 ||
                                          !adminExchangeFormReasonCode ||
                                          (adminExchangeFormReasonCode === 'other' && !adminExchangeFormNote.trim()) ||
                                          Object.entries(adminExchangeFormSelection).some(([k, s]) => {
                                            if (!s.newVariantId) return true;
                                            const it = (ord.items || []).find(i => itemKey(i) === k);
                                            const pd = it ? adminExchangeFormProducts[it.productId || it.id] : null;
                                            const needsSize = pd ? (pd.sizes || []).length > 0 : true;
                                            return needsSize && !s.newSize;
                                          })
                                        }
                                        onClick={async () => {
                                          const items = (ord.items || [])
                                            .filter(item => adminExchangeFormSelection[itemKey(item)] != null)
                                            .map(item => {
                                              const sel = adminExchangeFormSelection[itemKey(item)];
                                              return {
                                                productId: item.productId || item.id,
                                                oldVariantId: item.variantId || null,
                                                oldSize: item.size || null,
                                                quantity: sel.quantity,
                                                requestedNewVariant: { variantId: sel.newVariantId, size: sel.newSize },
                                              };
                                            });
                                          setAdminExchangeFormLoading(true);
                                          try {
                                            const created = await ordersAPI.requestExchange(ord.id, { items, reasonCode: adminExchangeFormReasonCode, customerNote: adminExchangeFormNote });
                                            setAdminExchangeRequests(prev => [{ ...created, id: created._id, orderId: ord.id }, ...prev]);
                                            setAdminExchangeFormOrderId(null);
                                            showToast(t('تم تسجيل الاستبدال ✅', 'Exchange logged ✅'));
                                          } catch (err) {
                                            console.error('تعذّر تسجيل الاستبدال:', err);
                                            alert(err?.response?.data?.message || err?.message || t('تعذّر تسجيل الاستبدال', 'Could not log the exchange'));
                                          } finally {
                                            setAdminExchangeFormLoading(false);
                                          }
                                        }}
                                        className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold disabled:bg-[var(--lava-border)]"
                                      >
                                        {adminExchangeFormLoading ? t('جاري التسجيل...', 'Logging...') : t('تسجيل الاستبدال', 'Log exchange')}
                                      </button>
                                      <button onClick={() => setAdminExchangeFormOrderId(null)} className="text-sm text-[var(--lava-muted)] hover:text-black px-3 py-2">
                                        {t('إلغاء', 'Cancel')}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}

                          {/* ===== تفاصيل المنتجات ===== */}
                          <div className="space-y-2">
                            <p className="font-bold text-[var(--lava-text)] text-sm">📦 {t('المنتجات', 'Items')}</p>
                            {(ord.items || []).map((item, idx) => {
                              const isBundleItem = item.bundleDiscount > 0 || item.isBundleItem;
                              const originalPrice = item.originalPrice || item.price;
                              const bundlePricePerUnit = isBundleItem && item.bundleDiscount > 0
                                ? Math.round(originalPrice * (1 - item.bundleDiscount / 100))
                                : (item.bundlePrice || item.price);
                              return (
                                <div key={idx} className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${isBundleItem ? 'bg-purple-50 border-purple-200' : 'bg-[var(--lava-card)]'}`}>
                                  {item.productImage && (
                                    <img src={typeof item.productImage === 'string' ? item.productImage : (item.productImage?.url || '')} alt="" className="w-12 h-12 object-cover rounded-lg border flex-shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold truncate">{getLocalized(item.name) || getLocalized(item.productName) || t('منتج', 'Product')}</p>
                                      {isBundleItem && (
                                        <span className="inline-flex items-center gap-0.5 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                                          🎁 {t('باندل', 'Bundle')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--lava-muted)] text-xs mt-0.5">
                                      {item.size && <span>{t('المقاس:', 'Size:')} <span className="font-semibold text-[var(--lava-text)]">{item.size}</span></span>}
                                      {item.color && <span>{t('اللون:', 'Color:')} <span className="font-semibold text-[var(--lava-text)]">{getLocalized(item.color)}</span>{item.colorHex && <span className="inline-block w-3 h-3 rounded-full border ms-1 align-middle" style={{backgroundColor: item.colorHex}}></span>}</span>}
                                      {item.quantity && <span>{t('الكمية:', 'Qty:')} <span className="font-semibold text-[var(--lava-text)]">{item.quantity}</span></span>}
                                      {isBundleItem ? (
                                        <span className="flex items-center gap-1">
                                          {t('السعر:', 'Price:')}
                                          <span className="line-through text-[var(--lava-muted)] ms-1">{originalPrice} {t('ج.م', 'EGP')}</span>
                                          <span className="font-bold text-purple-700">{bundlePricePerUnit} {t('ج.م', 'EGP')}</span>
                                          {item.bundleDiscount > 0 && <span className="text-purple-600 font-bold">(-{item.bundleDiscount}%)</span>}
                                        </span>
                                      ) : (
                                        <span>{t('السعر:', 'Price:')} <span className="font-semibold text-[var(--lava-text)]">{item.price} {t('ج.م', 'EGP')}</span></span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* ===== ملخص الطلب المالي ===== */}
                          <div className="bg-[var(--lava-secondary)] rounded-lg border px-4 py-3 space-y-1 text-sm">
                            <div className="flex justify-between text-[var(--lava-muted)]">
                              <span>{t('المجموع الفرعي', 'Subtotal')}</span>
                              <span>{ord.subtotal} {t('ج.م', 'EGP')}</span>
                            </div>
                            {ord.discount > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>
                                  {t('الخصم', 'Discount')}
                                  {ord.promoLabel && <span className="text-xs ms-1">({ord.promoLabel})</span>}
                                  {ord.discountCode && <span className="text-xs ms-1">({ord.discountCode})</span>}
                                </span>
                                <span>- {ord.discount} {t('ج.م', 'EGP')}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-[var(--lava-muted)]">
                              <span>{t('الشحن', 'Shipping')}</span>
                              <span>{ord.shippingCost > 0 ? `${ord.shippingCost} ${t('ج.م', 'EGP')}` : t('مجاني', 'Free')}</span>
                            </div>
                            <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                              <span>{t('الإجمالي', 'Total')}</span>
                              <span>{ord.totalAmount} {t('ج.م', 'EGP')}</span>
                            </div>
                          </div>

                          {/* ===== تغيير الحالة ===== */}
                          <div className="flex gap-3 items-center flex-wrap">
                            <select
                              disabled={user.role === 'packer'}
                              value={ord.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                let extra = {};
                                // لو الحالة الجديدة "مرتجع"، بنسأل عن السبب وتكلفة شحن الإرجاع
                                // عشان تحليل الربح والإرجاعات يكون دقيق (اختياري - ممكن يتخطاها).
                                if (newStatus === t('مرتجع', 'Returned') && ord.status !== newStatus) {
                                  const reason = window.prompt(t('سبب الإرجاع (اختياري):', 'Return reason (optional):'), '');
                                  const costStr = window.prompt(t('تكلفة شحن الإرجاع بالجنيه (اختياري):', 'Return shipping cost in EGP (optional):'), '');
                                  if (reason && reason.trim()) extra.returnReason = reason.trim();
                                  if (costStr && !Number.isNaN(Number(costStr))) extra.returnShippingCost = Number(costStr);
                                }
                                setOrders(orders.map(o => o.id === ord.id ? { ...o, status: newStatus, ...extra } : o));
                                try { await ordersAPI.updateStatus(ord.id, newStatus, extra); } catch (err) { console.error('تعذّر تحديث حالة الطلب:', err); }
                              }}
                              className="px-3 py-1.5 border rounded bg-[var(--lava-card)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value={t('جديد', 'New')}>{t('جديد', 'New')}</option>
                              <option value={t('جاري التأكيد', 'Confirming')}>{t('جاري التأكيد', 'Confirming')}</option>
                              <option value={t('تم التأكيد', 'Confirmed')}>{t('تم التأكيد', 'Confirmed')}</option>
                              <option value={t('تم التسليم', 'Delivered')}>{t('تم التسليم', 'Delivered')}</option>
                              <option value={t('ملغي', 'Cancelled')}>{t('ملغي', 'Cancelled')}</option>
                              <option value={t('مرتجع', 'Returned')}>{t('مرتجع', 'Returned')}</option>
                              <option value={t('مستبدل', 'Exchanged')}>{t('مستبدل', 'Exchanged')}</option>
                            </select>
                            <select
                              disabled={user.role === 'call_center'}
                              value={ord.packerStatus}
                              onChange={async (e) => {
                                const newPackerStatus = e.target.value;
                                setOrders(orders.map(o => o.id === ord.id ? { ...o, packerStatus: newPackerStatus } : o));
                                try { await ordersAPI.updatePackerStatus(ord.id, newPackerStatus); } catch (err) { console.error('تعذّر تحديث حالة التجهيز:', err); }
                              }}
                              className="px-3 py-1.5 border rounded bg-[var(--lava-card)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value={t('لم يتم التجهيز', 'Not prepared')}>{t('لم يتم التجهيز', 'Not prepared')}</option>
                              <option value={t('تم التجهيز', 'Prepared')}>{t('تم التجهيز', 'Prepared')}</option>
                              <option value={t('تم التسليم لشركة الشحن', 'Handed to courier')}>{t('تم التسليم لشركة الشحن', 'Handed to courier')}</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* ===== تبويب الاسترجاع والاستبدال (Phase 2B) ===== */}
            {adminTab === 'returns_exchanges' && canAccess('orders') && (() => {
              const statusLabel = (s) => ({
                pending: t('قيد الانتظار', 'Pending'),
                under_review: t('قيد المراجعة', 'Under Review'),
                approved: t('تمت الموافقة', 'Approved'),
                rejected: t('مرفوض', 'Rejected'),
                pickup_scheduled: t('تم جدولة الاستلام', 'Pickup Scheduled'),
                received: t('تم الاستلام', 'Received'),
                processing: t('جاري المعالجة', 'Processing'),
                completed: t('مكتمل', 'Completed'),
                cancelled: t('ملغي', 'Cancelled'),
                // ===== Phase 2C =====
                carrier_picked_up: t('شركة الشحن استلمت المنتج', 'Picked up by carrier'),
                received_at_warehouse: t('وصل المخزن', 'Arrived at warehouse'),
                inspecting: t('جاري المعاينة', 'Inspecting'),
                shipped_to_customer: t('في الطريق للعميل', 'Shipped to customer'),
              }[s] || s);
              const statusColor = (s) => ({
                pending: 'bg-yellow-100 text-yellow-800',
                under_review: 'bg-blue-100 text-blue-800',
                approved: 'bg-green-100 text-green-800',
                rejected: 'bg-red-100 text-red-800',
                pickup_scheduled: 'bg-indigo-100 text-indigo-800',
                received: 'bg-indigo-100 text-indigo-800',
                processing: 'bg-purple-100 text-purple-800',
                completed: 'bg-green-100 text-green-800',
                cancelled: 'bg-[var(--lava-border)] text-[var(--lava-text)]',
                // ===== Phase 2C =====
                carrier_picked_up: 'bg-indigo-100 text-indigo-800',
                received_at_warehouse: 'bg-indigo-100 text-indigo-800',
                inspecting: 'bg-purple-100 text-purple-800',
                shipped_to_customer: 'bg-teal-100 text-teal-800',
              }[s] || 'bg-[var(--lava-secondary)] text-[var(--lava-text)]');
              const moneyDirectionLabel = (d) => ({
                collect_from_customer: t('تحصيل من العميل', 'Collect from customer'),
                refund_to_customer: t('تحويل للعميل', 'Refund to customer'),
                none: t('لا يوجد', 'None'),
              }[d] || d);

              const filteredList = reAdminList.filter((it) => {
                if (reAdminTypeFilter !== 'all' && it.type !== reAdminTypeFilter) return false;
                if (reAdminStatusFilter && it.status !== reAdminStatusFilter) return false;
                if (reAdminDateFrom && new Date(it.createdAt) < new Date(reAdminDateFrom)) return false;
                if (reAdminDateTo && new Date(it.createdAt) > new Date(reAdminDateTo + 'T23:59:59')) return false;
                if (reAdminSearch) {
                  const s = reAdminSearch.trim().toLowerCase();
                  const hay = `${it.requestId} ${it.customerName || ''} ${it.customerPhone || ''} ${it.orderId || ''}`.toLowerCase();
                  if (!hay.includes(s)) return false;
                }
                return true;
              });

              return (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">🔄 {t('الاسترجاع والاستبدال', 'Returns & Exchanges')}</h2>
                    <div className="flex gap-2 bg-[var(--lava-secondary)] p-1 rounded-lg">
                      {[
                        { key: 'list', label: t('الطلبات', 'Requests') },
                        { key: 'settings', label: t('الإعدادات', 'Settings') },
                        { key: 'reasons', label: t('الأسباب', 'Reasons') },
                        { key: 'policy', label: t('السياسة', 'Policy') },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setReAdminSubTab(tab.key)}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${reAdminSubTab === tab.key ? 'bg-black text-white' : 'text-[var(--lava-muted)] hover:bg-[var(--lava-border)]'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ===== قايمة الطلبات ===== */}
                  {reAdminSubTab === 'list' && (
                    <div className="bg-[var(--lava-card)] p-4 md:p-6 rounded-xl shadow-md space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <input
                          type="text" value={reAdminSearch} onChange={(e) => setReAdminSearch(e.target.value)}
                          placeholder={t('بحث (اسم/تليفون/رقم طلب)', 'Search (name/phone/order)')}
                          className="px-3 py-2 border rounded-lg md:col-span-2"
                        />
                        <select value={reAdminTypeFilter} onChange={(e) => setReAdminTypeFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
                          <option value="all">{t('الكل (استرجاع + استبدال)', 'All (Return + Exchange)')}</option>
                          <option value="return">{t('استرجاع فقط', 'Returns only')}</option>
                          <option value="exchange">{t('استبدال فقط', 'Exchanges only')}</option>
                        </select>
                        <select value={reAdminStatusFilter} onChange={(e) => setReAdminStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
                          <option value="">{t('كل الحالات', 'All statuses')}</option>
                          {['pending', 'under_review', 'approved', 'rejected', 'carrier_picked_up', 'received_at_warehouse', 'inspecting', 'shipped_to_customer', 'completed', 'cancelled'].map((s) => (
                            <option key={s} value={s}>{statusLabel(s)}</option>
                          ))}
                        </select>
                        <button onClick={fetchReAdminList} className="px-3 py-2 border rounded-lg font-bold hover:bg-[var(--lava-secondary)]">
                          🔄 {t('تحديث', 'Refresh')}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-[var(--lava-muted)] shrink-0">{t('من تاريخ', 'From')}</label>
                          <input type="date" value={reAdminDateFrom} onChange={(e) => setReAdminDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg w-full" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-[var(--lava-muted)] shrink-0">{t('إلى تاريخ', 'To')}</label>
                          <input type="date" value={reAdminDateTo} onChange={(e) => setReAdminDateTo(e.target.value)} className="px-3 py-2 border rounded-lg w-full" />
                        </div>
                      </div>

                      {reAdminLoading ? (
                        <p className="text-center text-[var(--lava-muted)] py-10">{t('جاري التحميل...', 'Loading...')}</p>
                      ) : filteredList.length === 0 ? (
                        <p className="text-center text-[var(--lava-muted)] py-10">{t('لا توجد طلبات استرجاع أو استبدال', 'No return or exchange requests')}</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-start text-[var(--lava-muted)] border-b">
                                <th className="py-2 px-2">{t('رقم الطلب', 'Request ID')}</th>
                                <th className="py-2 px-2">{t('رقم الأوردر', 'Order #')}</th>
                                <th className="py-2 px-2">{t('العميل', 'Customer')}</th>
                                <th className="py-2 px-2">{t('النوع', 'Type')}</th>
                                <th className="py-2 px-2">{t('المنتجات', 'Products')}</th>
                                <th className="py-2 px-2">{t('السبب', 'Reason')}</th>
                                <th className="py-2 px-2">{t('الرسوم', 'Fee')}</th>
                                <th className="py-2 px-2">{t('الحالة', 'Status')}</th>
                                <th className="py-2 px-2">{t('الفلوس', 'Money')}</th>
                                <th className="py-2 px-2">{t('التاريخ', 'Created At')}</th>
                                <th className="py-2 px-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredList.map((it) => (
                                <tr key={`${it.type}-${it.requestId}`} className="border-b hover:bg-[var(--lava-secondary)]">
                                  <td className="py-2 px-2 font-mono text-xs">{it.requestId}</td>
                                  <td className="py-2 px-2 font-mono text-xs">{it.orderNumber || String(it.orderId).slice(-6)}</td>
                                  <td className="py-2 px-2">{it.customerName || '-'}<br /><span className="text-xs text-[var(--lava-muted)]">{it.customerPhone}</span></td>
                                  <td className="py-2 px-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${it.type === 'return' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {it.type === 'return' ? t('استرجاع', 'Return') : t('استبدال', 'Exchange')}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2">{(it.items || []).length} {t('منتج', 'item(s)')}</td>
                                  <td className="py-2 px-2 text-xs">{it.reasonCode || '-'}</td>
                                  <td className="py-2 px-2 font-bold">{it.fee > 0 ? `${it.fee} ${it.currency}` : t('مجاني', 'Free')}</td>
                                  <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(it.status)}`}>{statusLabel(it.status)}</span></td>
                                  <td className="py-2 px-2">
                                    {(() => {
                                      const raw = it.raw || {};
                                      const transferredAt = it.type === 'return' ? raw.refundTransferredAt : raw.moneyTransferredAt;
                                      const amount = it.type === 'return' ? raw.refundAmount : raw.moneyAmount;
                                      const direction = it.type === 'return' ? 'refund_to_customer' : raw.moneyDirection;
                                      if (transferredAt && amount > 0) {
                                        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">✅ {direction === 'collect_from_customer' ? t('استلمنا', 'Received') : t('اتحول', 'Sent')}</span>;
                                      }
                                      const pending = (it.type === 'return' && !['pending', 'rejected', 'none'].includes(it.status)) ||
                                        (it.type === 'exchange' && direction && direction !== 'none' && amount > 0);
                                      if (pending) {
                                        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">⏳ {direction === 'collect_from_customer' ? t('هيتحصل', 'To collect') : t('هيتحول', 'To send')}</span>;
                                      }
                                      return <span className="text-xs text-gray-300">—</span>;
                                    })()}
                                  </td>
                                  <td className="py-2 px-2 text-xs text-[var(--lava-muted)]">{it.createdAt ? new Date(it.createdAt).toLocaleDateString() : '-'}</td>
                                  <td className="py-2 px-2">
                                    <button onClick={() => openReAdminDetails(it)} className="text-blue-600 font-bold text-xs hover:underline">
                                      {t('عرض', 'View')}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ===== إعدادات الاسترجاع والاستبدال ===== */}
                  {reAdminSubTab === 'settings' && (
                    <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-8">
                      <div>
                        <h3 className="text-xl font-bold mb-4">↩️ {t('الاسترجاع (Returns)', 'Returns')}</h3>
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                            <input type="checkbox" id="enableReturns" checked={!!adminSettings.current.enableReturns} onChange={(e) => { adminSettings.current.enableReturns = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                            <label htmlFor="enableReturns" className="font-bold cursor-pointer">{t('تفعيل خدمة الاسترجاع', 'Enable Returns')}</label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('رسوم الاسترجاع (ج.م)', 'Return Fee (EGP)')}</label>
                              <input type="number" min="0" value={adminSettings.current.returnFeeAmount ?? 0} onChange={(e) => { adminSettings.current.returnFeeAmount = Number(e.target.value); bumpSettings(); }} className="px-3 py-2 border rounded-lg w-full" />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('مدة الاسترجاع (أيام)', 'Return Window (days)')}</label>
                              <input type="number" min="0" value={adminSettings.current.returnWindow ?? 0} onChange={(e) => { adminSettings.current.returnWindow = Number(e.target.value); bumpSettings(); }} className="px-3 py-2 border rounded-lg w-full" />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('مدة استرجاع المنتج المعيب (أيام)', 'Defective Product Window (days)')}</label>
                              <input type="number" min="0" value={adminSettings.current.defectiveProductWindow ?? 0} onChange={(e) => { adminSettings.current.defectiveProductWindow = Number(e.target.value); bumpSettings(); }} className="px-3 py-2 border rounded-lg w-full" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t">
                        <h3 className="text-xl font-bold mb-4">🔁 {t('الاستبدال (Exchanges)', 'Exchanges')}</h3>
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                            <input type="checkbox" id="enableExchanges" checked={!!adminSettings.current.enableExchanges} onChange={(e) => { adminSettings.current.enableExchanges = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                            <label htmlFor="enableExchanges" className="font-bold cursor-pointer">{t('تفعيل خدمة الاستبدال', 'Enable Exchanges')}</label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('رسوم الاستبدال (ج.م)', 'Exchange Fee (EGP)')}</label>
                              <input type="number" min="0" value={adminSettings.current.exchangeFeeAmount ?? 0} onChange={(e) => { adminSettings.current.exchangeFeeAmount = Number(e.target.value); bumpSettings(); }} className="px-3 py-2 border rounded-lg w-full" />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('مدة الاستبدال (أيام)', 'Exchange Window (days)')}</label>
                              <input type="number" min="0" value={adminSettings.current.exchangeWindow ?? 0} onChange={(e) => { adminSettings.current.exchangeWindow = Number(e.target.value); bumpSettings(); }} className="px-3 py-2 border rounded-lg w-full" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t">
                        <h3 className="text-xl font-bold mb-4">⚙️ {t('عام', 'General')}</h3>
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                            <input type="checkbox" id="requireEvidenceImages" checked={!!adminSettings.current.requireEvidenceImages} onChange={(e) => { adminSettings.current.requireEvidenceImages = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                            <label htmlFor="requireEvidenceImages" className="font-bold cursor-pointer">{t('إلزام صور إثبات للأسباب اللي تحتاجها', 'Require evidence images where applicable')}</label>
                          </div>
                          <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                            <input type="checkbox" id="freeStoreErrorReturns" checked={!!adminSettings.current.freeStoreErrorReturns} onChange={(e) => { adminSettings.current.freeStoreErrorReturns = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                            <label htmlFor="freeStoreErrorReturns" className="font-bold cursor-pointer">{t('استرجاع مجاني في حالة خطأ المتجر', 'Free Return for Store Error')}</label>
                          </div>
                          <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                            <input type="checkbox" id="freeStoreErrorExchanges" checked={!!adminSettings.current.freeStoreErrorExchanges} onChange={(e) => { adminSettings.current.freeStoreErrorExchanges = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                            <label htmlFor="freeStoreErrorExchanges" className="font-bold cursor-pointer">{t('استبدال مجاني في حالة خطأ المتجر', 'Free Exchange for Store Error')}</label>
                          </div>
                        </div>
                      </div>

                      <button onClick={() => saveAdminSettings()} className="bg-black text-white px-8 py-3 rounded-lg font-bold mt-4">
                        {t('حفظ الإعدادات', 'Save Settings')}
                      </button>
                    </div>
                  )}

                  {/* ===== إدارة الأسباب ===== */}
                  {reAdminSubTab === 'reasons' && (
                    <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-8">
                      {[
                        { key: 'returnReasons', title: t('أسباب الاسترجاع', 'Return Reasons') },
                        { key: 'exchangeReasons', title: t('أسباب الاستبدال', 'Exchange Reasons') },
                      ].map(({ key, title }) => {
                        const list = Array.isArray(adminSettings.current[key]) ? adminSettings.current[key] : [];
                        return (
                          <div key={key} className="space-y-3">
                            <h3 className="text-xl font-bold">{title}</h3>
                            <div className="space-y-2">
                              {list.map((reason, idx) => (
                                <div key={reason.code} className="flex flex-col md:flex-row md:items-center gap-2 bg-[var(--lava-secondary)] p-3 rounded-lg border">
                                  <span className="text-xs font-mono text-[var(--lava-muted)] w-28 shrink-0">{reason.code}</span>
                                  <input
                                    type="text" value={reason.ar || ''}
                                    onChange={(e) => {
                                      const next = [...list]; next[idx] = { ...next[idx], ar: e.target.value };
                                      adminSettings.current[key] = next; bumpSettings();
                                    }}
                                    placeholder={t('النص بالعربي', 'Arabic label')}
                                    className="px-3 py-1.5 border rounded-lg flex-1"
                                  />
                                  <input
                                    type="text" value={reason.en || ''}
                                    onChange={(e) => {
                                      const next = [...list]; next[idx] = { ...next[idx], en: e.target.value };
                                      adminSettings.current[key] = next; bumpSettings();
                                    }}
                                    placeholder={t('النص بالإنجليزي', 'English label')}
                                    className="px-3 py-1.5 border rounded-lg flex-1"
                                  />
                                  <label className="flex items-center gap-1 text-xs font-bold shrink-0">
                                    <input type="checkbox" checked={reason.enabled !== false} onChange={(e) => {
                                      const next = [...list]; next[idx] = { ...next[idx], enabled: e.target.checked };
                                      adminSettings.current[key] = next; bumpSettings();
                                    }} />
                                    {t('مفعّل', 'Enabled')}
                                  </label>
                                  <label className="flex items-center gap-1 text-xs font-bold shrink-0">
                                    <input type="checkbox" checked={reason.feeApplies !== false} onChange={(e) => {
                                      const next = [...list]; next[idx] = { ...next[idx], feeApplies: e.target.checked };
                                      adminSettings.current[key] = next; bumpSettings();
                                    }} />
                                    {t('عليه رسوم', 'Fee applies')}
                                  </label>
                                  <label className="flex items-center gap-1 text-xs font-bold shrink-0">
                                    <input type="checkbox" checked={!!reason.evidenceRequired} onChange={(e) => {
                                      const next = [...list]; next[idx] = { ...next[idx], evidenceRequired: e.target.checked };
                                      adminSettings.current[key] = next; bumpSettings();
                                    }} />
                                    {t('يحتاج صورة', 'Needs evidence')}
                                  </label>
                                  {reason.custom && (
                                    <button
                                      onClick={() => {
                                        const next = list.filter((_, i) => i !== idx);
                                        adminSettings.current[key] = next;
                                        saveAdminSettings(t('تم حذف السبب', 'Reason deleted'), { [key]: next });
                                      }}
                                      className="text-red-600 font-bold text-xs shrink-0"
                                    >
                                      {t('حذف', 'Delete')}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={() => saveAdminSettings(t('تم حفظ الأسباب', 'Reasons saved'), { [key]: list })}
                              className="bg-black text-white px-5 py-2 rounded-lg font-bold text-sm"
                            >
                              {t('حفظ التعديلات', 'Save changes')}
                            </button>
                          </div>
                        );
                      })}

                      {/* إضافة سبب جديد (custom) */}
                      <div className="pt-6 border-t space-y-3">
                        <h3 className="text-lg font-bold">{t('إضافة سبب جديد', 'Add New Reason')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <select value={reAdminNewReasonType} onChange={(e) => setReAdminNewReasonType(e.target.value)} className="px-3 py-2 border rounded-lg">
                            <option value="return">{t('سبب استرجاع', 'Return reason')}</option>
                            <option value="exchange">{t('سبب استبدال', 'Exchange reason')}</option>
                          </select>
                          <input type="text" value={reAdminNewReasonAr} onChange={(e) => setReAdminNewReasonAr(e.target.value)} placeholder={t('النص بالعربي', 'Arabic label')} className="px-3 py-2 border rounded-lg" />
                          <input type="text" value={reAdminNewReasonEn} onChange={(e) => setReAdminNewReasonEn(e.target.value)} placeholder={t('النص بالإنجليزي', 'English label')} className="px-3 py-2 border rounded-lg" />
                          <button
                            onClick={() => {
                              if (!reAdminNewReasonAr.trim()) { showToast(t('اكتب النص بالعربي على الأقل', 'Enter Arabic label at least')); return; }
                              const key = reAdminNewReasonType === 'return' ? 'returnReasons' : 'exchangeReasons';
                              const list = Array.isArray(adminSettings.current[key]) ? adminSettings.current[key] : [];
                              const code = `custom_${Date.now().toString(36)}`;
                              const nextList = [...list, { code, ar: reAdminNewReasonAr.trim(), en: reAdminNewReasonEn.trim() || reAdminNewReasonAr.trim(), feeApplies: true, evidenceRequired: false, enabled: true, custom: true }];
                              adminSettings.current[key] = nextList;
                              saveAdminSettings(t('تم إضافة السبب', 'Reason added'), { [key]: nextList });
                              setReAdminNewReasonAr(''); setReAdminNewReasonEn('');
                            }}
                            className="bg-black text-white px-4 py-2 rounded-lg font-bold"
                          >
                            {t('إضافة', 'Add')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===== محرر صفحة السياسة (Returns & Exchanges Phase 3) ===== */}
                  {reAdminSubTab === 'policy' && (() => {
                    const policy = adminSettings.current.returnsPolicy || {};
                    const updatePolicy = (patch) => {
                      adminSettings.current.returnsPolicy = { ...policy, ...patch };
                      bumpSettings();
                    };
                    const updateLocalized = (field, lang, value) => {
                      const current = policy[field] || {};
                      updatePolicy({ [field]: { ...current, [lang]: value } });
                    };
                    return (
                      <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                        <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                          <input type="checkbox" id="returnsPolicyEnabled" checked={policy.enabled !== false} onChange={(e) => updatePolicy({ enabled: e.target.checked })} className="w-5 h-5" />
                          <label htmlFor="returnsPolicyEnabled" className="font-bold cursor-pointer">{t('تفعيل صفحة السياسة (/returns)', 'Enable policy page (/returns)')}</label>
                        </div>

                        <p className="text-xs text-[var(--lava-muted)] bg-blue-50 border border-blue-200 rounded-lg p-3">
                          {t('تقدر تستخدم داخل النص: {{returnFee}}، {{exchangeFee}}، {{returnWindow}}، {{exchangeWindow}}، {{currency}} - وهتتستبدل تلقائيًا بالقيم الحالية من تبويب الإعدادات، بدل ما تكتب رقم ثابت.', 'You can use these placeholders in the text: {{returnFee}}, {{exchangeFee}}, {{returnWindow}}, {{exchangeWindow}}, {{currency}} - they auto-fill from the Settings tab instead of a fixed number.')}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('العنوان (عربي)', 'Title (Arabic)')}</label>
                            <input type="text" value={policy.title?.ar || ''} onChange={(e) => updateLocalized('title', 'ar', e.target.value)} className="px-3 py-2 border rounded-lg w-full" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('العنوان (إنجليزي)', 'Title (English)')}</label>
                            <input type="text" value={policy.title?.en || ''} onChange={(e) => updateLocalized('title', 'en', e.target.value)} className="px-3 py-2 border rounded-lg w-full" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('المقدمة (عربي)', 'Intro (Arabic)')}</label>
                            <TextareaField value={policy.intro?.ar || ''} onChange={(e) => updateLocalized('intro', 'ar', e.target.value)} rows={2} id="policyIntroAr" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('المقدمة (إنجليزي)', 'Intro (English)')}</label>
                            <TextareaField value={policy.intro?.en || ''} onChange={(e) => updateLocalized('intro', 'en', e.target.value)} rows={2} id="policyIntroEn" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('محتوى السياسة (عربي)', 'Policy Content (Arabic)')}</label>
                            <TextareaField value={policy.content?.ar || ''} onChange={(e) => updateLocalized('content', 'ar', e.target.value)} rows={12} id="policyContentAr" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[var(--lava-muted)] mb-1">{t('محتوى السياسة (إنجليزي)', 'Policy Content (English)')}</label>
                            <TextareaField value={policy.content?.en || ''} onChange={(e) => updateLocalized('content', 'en', e.target.value)} rows={12} id="policyContentEn" />
                          </div>
                        </div>

                        {policy.lastUpdated && (
                          <p className="text-xs text-[var(--lava-muted)]">{t('آخر تحديث:', 'Last updated:')} {new Date(policy.lastUpdated).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</p>
                        )}

                        <button
                          onClick={() => saveAdminSettings(t('تم حفظ السياسة', 'Policy saved'), { returnsPolicy: adminSettings.current.returnsPolicy })}
                          className="bg-black text-white px-8 py-3 rounded-lg font-bold"
                        >
                          {t('حفظ السياسة', 'Save Policy')}
                        </button>
                      </div>
                    );
                  })()}

                  {/* ===== مودال تفاصيل الطلب ===== */}
                  {reAdminSelected && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReAdminSelected(null)}>
                      <div className="bg-[var(--lava-card)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-xl font-bold">
                            {reAdminSelected.type === 'return' ? t('تفاصيل طلب استرجاع', 'Return Request Details') : t('تفاصيل طلب استبدال', 'Exchange Request Details')}
                          </h3>
                          <button onClick={() => setReAdminSelected(null)} className="text-[var(--lava-muted)] text-2xl leading-none">✕</button>
                        </div>

                        {reAdminSelectedLoading ? (
                          <p className="text-center text-[var(--lava-muted)] py-10">{t('جاري التحميل...', 'Loading...')}</p>
                        ) : (
                          <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                              <div><span className="text-[var(--lava-muted)]">{t('الحالة', 'Status')}</span><br /><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(reAdminSelected.data.status)}`}>{statusLabel(reAdminSelected.data.status)}</span></div>
                              <div><span className="text-[var(--lava-muted)]">{t('الرسوم', 'Fee')}</span><br /><span className="font-bold">{reAdminSelected.data.fee > 0 ? `${reAdminSelected.data.fee} ${reAdminSelected.data.currency || 'EGP'}` : t('مجاني', 'Free')}</span></div>
                              <div><span className="text-[var(--lava-muted)]">{t('العميل', 'Customer')}</span><br />{reAdminSelected.data.order?.customerName || reAdminSelected.data.customerName || '-'}</div>
                              <div><span className="text-[var(--lava-muted)]">{t('السبب', 'Reason')}</span><br />{reAdminSelected.data.reasonCode || '-'}</div>
                            </div>

                            {reAdminSelected.data.customerNote && (
                              <div><span className="text-[var(--lava-muted)]">{t('ملاحظة العميل', 'Customer Note')}</span><p>{reAdminSelected.data.customerNote}</p></div>
                            )}

                            <div>
                              <span className="text-[var(--lava-muted)]">{t('المنتجات', 'Products')}</span>
                              <div className="space-y-2 mt-1">
                                {(reAdminSelected.data.items || []).map((it, i) => (
                                  <div key={i} className="bg-[var(--lava-secondary)] p-2 rounded border text-xs">
                                    {t('الكمية', 'Qty')}: {it.quantity} — {reAdminSelected.type === 'exchange' ? (
                                      <span>{t('من', 'from')} {it.oldVariant?.size}/{getLocalized(it.oldVariant?.color)} {t('إلى', 'to')} {it.requestedNewVariant?.size}/{getLocalized(it.requestedNewVariant?.color)}</span>
                                    ) : (
                                      <span>{it.size} {it.color ? `- ${it.color}` : ''}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {Array.isArray(reAdminSelected.data.evidenceImages) && reAdminSelected.data.evidenceImages.length > 0 && (
                              <div>
                                <span className="text-[var(--lava-muted)]">{t('صور الإثبات', 'Evidence Images')}</span>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {reAdminSelected.data.evidenceImages.map((img, i) => (
                                    <a key={i} href={img} target="_blank" rel="noreferrer">
                                      <img src={img} alt="" className="w-20 h-20 object-cover rounded border" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {Array.isArray(reAdminSelected.data.statusHistory) && reAdminSelected.data.statusHistory.length > 0 && (
                              <div>
                                <span className="text-[var(--lava-muted)]">{t('سجل الحالة', 'Status History')}</span>
                                <div className="space-y-1 mt-1">
                                  {reAdminSelected.data.statusHistory.map((h, i) => (
                                    <div key={i} className="text-xs flex justify-between border-b pb-1">
                                      <span className="font-bold">{statusLabel(h.status)}</span>
                                      <span className="text-[var(--lava-muted)]">{h.at ? new Date(h.at).toLocaleString() : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="block text-[var(--lava-muted)] mb-1">{t('ملاحظة الأدمن', 'Admin Note')}</label>
                              <textarea
                                value={reAdminNoteDraft || reAdminSelected.data.adminNote || ''}
                                onChange={(e) => setReAdminNoteDraft(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder={t('اكتب ملاحظة (اختياري)', 'Write a note (optional)')}
                              />
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                              {['pending', 'under_review'].includes(reAdminSelected.data.status) && (
                                <>
                                  <button disabled={reAdminActionLoading} onClick={() => handleReAdminReview('approve')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                    {t('موافقة', 'Approve')}
                                  </button>
                                  <button disabled={reAdminActionLoading} onClick={() => handleReAdminReview('reject')} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                    {t('رفض', 'Reject')}
                                  </button>
                                </>
                              )}
                              {reAdminSelected.type === 'exchange' && reAdminSelected.data.status === 'approved' && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminExchangeStatus('carrier_picked_up')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('شركة الشحن استلمت المنتج', 'Mark Picked Up by Carrier')}
                                </button>
                              )}
                              {reAdminSelected.type === 'exchange' && reAdminSelected.data.status === 'carrier_picked_up' && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminExchangeStatus('received_at_warehouse')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('وصل المخزن', 'Mark Arrived at Warehouse')}
                                </button>
                              )}
                              {reAdminSelected.type === 'exchange' && reAdminSelected.data.status === 'received_at_warehouse' && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminExchangeStatus('inspecting')} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('بدء المعاينة', 'Start Inspecting')}
                                </button>
                              )}
                              {reAdminSelected.type === 'exchange' && reAdminSelected.data.status === 'inspecting' && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminExchangeStatus('shipped_to_customer')} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('تم شحن المنتج للعميل', 'Mark Shipped to Customer')}
                                </button>
                              )}
                              {reAdminSelected.type === 'exchange' && reAdminSelected.data.status === 'shipped_to_customer' && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminExchangeStatus('completed')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('العميل استلم - إكمال الطلب', 'Customer Received - Mark Completed')}
                                </button>
                              )}
                              {reAdminSelected.type === 'exchange' && !['completed', 'cancelled', 'rejected'].includes(reAdminSelected.data.status) && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminExchangeStatus('cancelled')} className="bg-gray-400 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('إلغاء', 'Cancel')}
                                </button>
                              )}
                              {/* ===== Phase 2C: سير عمل الاسترجاع بعد الموافقة (نفس فكرة الاستبدال بالظبط) ===== */}
                              {reAdminSelected.type === 'return' && reAdminSelected.data.status === 'approved' && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminReturnStatus('carrier_picked_up')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('شركة الشحن استلمت المنتج', 'Mark Picked Up by Carrier')}
                                </button>
                              )}
                              {reAdminSelected.type === 'return' && reAdminSelected.data.status === 'carrier_picked_up' && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminReturnStatus('received_at_warehouse')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('وصل المخزن', 'Mark Arrived at Warehouse')}
                                </button>
                              )}
                              {reAdminSelected.type === 'return' && reAdminSelected.data.status === 'received_at_warehouse' && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminReturnStatus('inspecting')} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('بدء المعاينة', 'Start Inspecting')}
                                </button>
                              )}
                              {reAdminSelected.type === 'return' && reAdminSelected.data.status === 'inspecting' && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminReturnStatus('completed')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('إكمال الطلب', 'Mark Completed')}
                                </button>
                              )}
                              {reAdminSelected.type === 'return' && !['none', 'pending', 'rejected', 'completed', 'cancelled'].includes(reAdminSelected.data.status) && (
                                <button disabled={reAdminActionLoading} onClick={() => handleReAdminReturnStatus('cancelled')} className="bg-gray-400 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                  {t('إلغاء', 'Cancel')}
                                </button>
                              )}
                              {/* ===== معاينة المنتج بعد وصوله فعليًا - هي اللي بتقرر رجوع المخزون
                                  فعلاً (مش زرار تقدّم الشحن اللي فوق) - شوف Order.returnInspectionResult /
                                  ExchangeRequest.oldVariantInspectionResult. بتبان بس لما الطلب يوصل
                                  فعليًا لمرحلة "جاري المعاينة" (status === 'inspecting') ولسه محدّش
                                  سجّل نتيجة (لسه 'pending') - مش من ساعة الموافقة على طول ===== */}
                              {reAdminSelected.type === 'return' && reAdminSelected.data.status === 'inspecting' && reAdminSelected.data.returnInspectionResult === 'pending' && (
                                <>
                                  <button disabled={reAdminActionLoading} onClick={() => handleReAdminReturnInspect('good')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                    ✅ {t('كويس - رجّع للمخزون', 'Good - restock')}
                                  </button>
                                  <button disabled={reAdminActionLoading} onClick={() => handleReAdminReturnInspect('bad')} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                    ❌ {t('مش كويس - متترجعش للمخزون', 'Bad - do not restock')}
                                  </button>
                                </>
                              )}
                              {reAdminSelected.type === 'exchange' && reAdminSelected.data.status === 'inspecting' && reAdminSelected.data.oldVariantInspectionResult === 'pending' && (
                                <>
                                  <button disabled={reAdminActionLoading} onClick={() => handleReAdminExchangeInspect('good')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                    ✅ {t('كويس - رجّع للمخزون', 'Good - restock')}
                                  </button>
                                  <button disabled={reAdminActionLoading} onClick={() => handleReAdminExchangeInspect('bad')} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                    ❌ {t('مش كويس - متترجعش للمخزون', 'Bad - do not restock')}
                                  </button>
                                </>
                              )}
                            </div>
                            {/* ===== لابل نتيجة المعاينة بعد ما تتسجل - عشان الأدمن يشوف إن المخزون
                                رجع فعلاً ولا لأ من غير ما يفتح الطلب في مكان تاني ===== */}
                            {reAdminSelected.type === 'return' && reAdminSelected.data.returnInspectionResult === 'good' && (
                              <p className="text-xs font-bold text-green-700">✅ {t('اتعاين: المنتج سليم ورجع للمخزون', 'Inspected: item was good and restocked')}</p>
                            )}
                            {reAdminSelected.type === 'return' && reAdminSelected.data.returnInspectionResult === 'bad' && (
                              <p className="text-xs font-bold text-red-700">❌ {t('اتعاين: المنتج مش سليم - منرجعش للمخزون', 'Inspected: item was bad - not restocked')}</p>
                            )}
                            {reAdminSelected.type === 'exchange' && reAdminSelected.data.oldVariantInspectionResult === 'good' && (
                              <p className="text-xs font-bold text-green-700">✅ {t('اتعاين: المنتج سليم ورجع للمخزون', 'Inspected: item was good and restocked')}</p>
                            )}
                            {reAdminSelected.type === 'exchange' && reAdminSelected.data.oldVariantInspectionResult === 'bad' && (
                              <p className="text-xs font-bold text-red-700">❌ {t('اتعاين: المنتج مش سليم - منرجعش للمخزون', 'Inspected: item was bad - not restocked')}</p>
                            )}

                            {/* ===== إضافة: خانة كود التتبع - بتبان بعد ما الطلب يتوافق عليه (approved
                                فيما بعد)، سواء استرجاع أو استبدال. بتستخدم نفس الـAPI الموجود بالظبط
                                (shippingAPI.setReturnTracking / exchangeAPI.updateTracking) - نفس
                                الخانة الي في تبويب الأوردرات، هنا كمان عشان الأدمن يقدر يكتبها من هنا
                                برضو ولما تتكتب من أي مكان تبان في المكانين. ===== */}
                            {!['none', 'pending', 'under_review', 'rejected'].includes(reAdminSelected.data.status) && (() => {
                              const isReturn = reAdminSelected.type === 'return';
                              const orderIdForTracking = isReturn ? (reAdminSelected.data.orderId || reAdminSelected.data.order?._id) : null;
                              const exchangeIdForTracking = !isReturn ? reAdminSelected.data._id : null;
                              const savedTracking = reAdminSelected.data.trackingNumber || '';
                              const trackingInputValue = reAdminTrackingInput !== null ? reAdminTrackingInput : savedTracking;
                              return (
                                <div className="border-t pt-4 space-y-2">
                                  <p className="font-bold text-[var(--lava-text)]">📦 {t('كود التتبع', 'Tracking Number')}</p>
                                  {savedTracking ? (
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm space-y-1">
                                      <p>{t('رقم التتبع:', 'Tracking number:')} <span className="font-mono font-bold" dir="ltr">{savedTracking}</span></p>
                                      {reAdminSelected.data.trackingStatus && (
                                        <p className="text-xs text-[var(--lava-muted)]">{t('حالة الشحنة:', 'Shipment status:')} {reAdminSelected.data.trackingStatus}</p>
                                      )}
                                      {reAdminSelected.data.lastTrackingSyncAt && (
                                        <p className="text-xs text-[var(--lava-muted)]">
                                          {t('آخر مزامنة:', 'Last sync:')} {new Date(reAdminSelected.data.lastTrackingSyncAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                                        </p>
                                      )}
                                      <button
                                        disabled={reAdminTrackingSyncing}
                                        onClick={async () => {
                                          setReAdminTrackingSyncing(true);
                                          try {
                                            if (isReturn) {
                                              await shippingAPI.syncReturnTracking(orderIdForTracking);
                                              const details = await ordersAPI.getReturnRequestDetails(orderIdForTracking);
                                              setReAdminSelected({ type: 'return', data: details });
                                            } else {
                                              const updated = await exchangeAPI.syncTracking(exchangeIdForTracking);
                                              setReAdminSelected({ type: 'exchange', data: updated });
                                            }
                                            showToast(t('تم تحديث حالة التتبع', 'Tracking status updated'));
                                            fetchReAdminList();
                                          } catch (err) {
                                            const msg = (err?.code === 'MANUAL_TRACKING_ONLY' || err?.response?.data?.code === 'MANUAL_TRACKING_ONLY')
                                              ? t('الشركة دي مبتدعمش المزامنة التلقائية - حدّث الحالة يدويًا', "This carrier doesn't support auto-sync - update the status manually")
                                              : (err?.response?.data?.message || err?.message || t('تعذّرت مزامنة التتبع', 'Could not sync tracking'));
                                            showToast(msg);
                                          } finally {
                                            setReAdminTrackingSyncing(false);
                                          }
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs disabled:opacity-50"
                                      >
                                        {reAdminTrackingSyncing ? `⏳ ${t('جاري المزامنة...', 'Syncing...')}` : `🔄 ${t('مزامنة الآن', 'Sync Now')}`}
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-[var(--lava-muted)]">
                                      {t('روح موقع شركة الشحن واعمل الطلب، ولما تاخد رقم التتبع حطه هنا:', "Go to the courier's website, create the shipment, then paste the tracking number here:")}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <input
                                      type="text"
                                      dir="ltr"
                                      value={trackingInputValue}
                                      onChange={(e) => setReAdminTrackingInput(e.target.value)}
                                      placeholder={t('رقم التتبع', 'Tracking number')}
                                      className="px-3 py-2 border rounded-lg flex-1 min-w-[180px]"
                                    />
                                    <button
                                      disabled={reAdminTrackingSaving || !trackingInputValue.trim()}
                                      onClick={async () => {
                                        setReAdminTrackingSaving(true);
                                        try {
                                          if (isReturn) {
                                            await shippingAPI.setReturnTracking(orderIdForTracking, { trackingNumber: trackingInputValue.trim() });
                                            const details = await ordersAPI.getReturnRequestDetails(orderIdForTracking);
                                            setReAdminSelected({ type: 'return', data: details });
                                          } else {
                                            const updated = await exchangeAPI.updateTracking(exchangeIdForTracking, trackingInputValue.trim());
                                            setReAdminSelected({ type: 'exchange', data: updated });
                                          }
                                          setReAdminTrackingInput(null);
                                          showToast(t('تم حفظ رقم التتبع ✅', 'Tracking number saved ✅'));
                                          fetchReAdminList();
                                        } catch (err) {
                                          showToast(err?.response?.data?.message || err?.message || t('تعذّر حفظ رقم التتبع', 'Could not save tracking number'));
                                        } finally {
                                          setReAdminTrackingSaving(false);
                                        }
                                      }}
                                      className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                                    >
                                      {reAdminTrackingSaving ? '⏳' : '💾'} {t('حفظ', 'Save')}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* ===== Phase 2C: تحويل الفلوس (انستا باي / محفظة) - استرجاع أو استبدال ===== */}
                            {reAdminSelected.type === 'return' && !['none', 'pending', 'rejected'].includes(reAdminSelected.data.status) && (() => {
                              const alreadyTransferred = !!reAdminSelected.data.refundTransferredAt;
                              const suggested = reAdminSelected.data.refundAmount ?? reAdminSelected.data.suggestedRefundAmount ?? 0;
                              return (
                                <div className="border-t pt-4 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-[var(--lava-text)]">💸 {t('تحويل فلوس الاسترجاع للعميل', 'Refund Transfer to Customer')}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${alreadyTransferred ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {alreadyTransferred ? t('تم التحويل', 'Transferred') : t('⏳ لسه معلقة', '⏳ Pending')}
                                    </span>
                                  </div>
                                  {alreadyTransferred ? (
                                    <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm font-bold">
                                      ✅ {t(`تم تحويل ${reAdminSelected.data.refundAmount} ${reAdminSelected.data.currency || 'EGP'} عبر ${reAdminSelected.data.refundMethod === 'instapay' ? 'انستا باي' : 'المحفظة'} بتاريخ ${new Date(reAdminSelected.data.refundTransferredAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}`, `Transferred ${reAdminSelected.data.refundAmount} ${reAdminSelected.data.currency || 'EGP'} via ${reAdminSelected.data.refundMethod === 'instapay' ? 'Instapay' : 'wallet'} on ${new Date(reAdminSelected.data.refundTransferredAt).toLocaleString('en-US')}`)}
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2 items-center">
                                      <input
                                        type="number" min="0" step="0.01"
                                        value={reAdminMoneyAmount || suggested}
                                        onChange={(e) => setReAdminMoneyAmount(e.target.value)}
                                        placeholder={t('المبلغ (ج.م)', 'Amount (EGP)')}
                                        className="px-3 py-2 border rounded-lg w-40"
                                      />
                                      <select value={reAdminMoneyMethod} onChange={(e) => setReAdminMoneyMethod(e.target.value)} className="px-3 py-2 border rounded-lg">
                                        <option value="">{t('اختار طريقة التحويل', 'Choose method')}</option>
                                        <option value="instapay">{t('انستا باي', 'Instapay')}</option>
                                        <option value="wallet">{t('محفظة', 'Wallet')}</option>
                                      </select>
                                      <button disabled={reAdminMoneySaving} onClick={handleReAdminMoneyTransfer} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                        {reAdminMoneySaving ? '⏳' : '✅'} {t('تم التحويل', 'Mark Transferred')}
                                      </button>
                                      <span className="text-xs text-[var(--lava-muted)] w-full">{t(`المبلغ المقترح تلقائيًا: ${suggested} ج.م (بعد خصم رسوم الاسترجاع لو فيه)`, `Auto-suggested amount: ${suggested} EGP (after return fee deduction if any)`)}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {reAdminSelected.type === 'exchange' && !['pending', 'under_review', 'rejected'].includes(reAdminSelected.data.status) && (() => {
                              const alreadyTransferred = !!reAdminSelected.data.moneyTransferredAt;
                              return (
                                <div className="border-t pt-4 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-[var(--lava-text)]">💸 {t('تحويل فلوس الاستبدال (لو فيه فرق سعر أو رسوم)', 'Exchange Money Transfer (fee or price difference)')}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${alreadyTransferred ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {alreadyTransferred
                                        ? (reAdminSelected.data.moneyDirection === 'collect_from_customer' ? t('استلمنا الفلوس', 'Received') : t('تم التحويل', 'Transferred'))
                                        : t('⏳ لسه معلقة', '⏳ Pending')}
                                    </span>
                                  </div>
                                  {alreadyTransferred ? (
                                    <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm font-bold">
                                      ✅ {reAdminSelected.data.moneyDirection === 'collect_from_customer'
                                        ? t(`العميل حوّل ${reAdminSelected.data.moneyAmount} ${reAdminSelected.data.moneyCurrency || 'EGP'} عبر ${reAdminSelected.data.moneyMethod === 'instapay' ? 'انستا باي' : 'المحفظة'} بتاريخ ${new Date(reAdminSelected.data.moneyTransferredAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}`, `Customer transferred ${reAdminSelected.data.moneyAmount} ${reAdminSelected.data.moneyCurrency || 'EGP'} via ${reAdminSelected.data.moneyMethod}`)
                                        : t(`تم تحويل ${reAdminSelected.data.moneyAmount} ${reAdminSelected.data.moneyCurrency || 'EGP'} للعميل عبر ${reAdminSelected.data.moneyMethod === 'instapay' ? 'انستا باي' : 'المحفظة'} بتاريخ ${new Date(reAdminSelected.data.moneyTransferredAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}`, `Transferred ${reAdminSelected.data.moneyAmount} ${reAdminSelected.data.moneyCurrency || 'EGP'} to customer via ${reAdminSelected.data.moneyMethod}`)}
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2 items-center">
                                      <select value={reAdminMoneyDirection} onChange={(e) => setReAdminMoneyDirection(e.target.value)} className="px-3 py-2 border rounded-lg">
                                        <option value="collect_from_customer">{t('تحصيل من العميل', 'Collect from customer')}</option>
                                        <option value="refund_to_customer">{t('تحويل للعميل (فرق سعر)', 'Refund to customer (price diff)')}</option>
                                      </select>
                                      <input
                                        type="number" min="0" step="0.01"
                                        value={reAdminMoneyAmount || reAdminSelected.data.fee || ''}
                                        onChange={(e) => setReAdminMoneyAmount(e.target.value)}
                                        placeholder={t('المبلغ (ج.م)', 'Amount (EGP)')}
                                        className="px-3 py-2 border rounded-lg w-40"
                                      />
                                      <select value={reAdminMoneyMethod} onChange={(e) => setReAdminMoneyMethod(e.target.value)} className="px-3 py-2 border rounded-lg">
                                        <option value="">{t('اختار طريقة التحويل', 'Choose method')}</option>
                                        <option value="instapay">{t('انستا باي', 'Instapay')}</option>
                                        <option value="wallet">{t('محفظة', 'Wallet')}</option>
                                      </select>
                                      <button disabled={reAdminMoneySaving} onClick={handleReAdminMoneyTransfer} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                        {reAdminMoneySaving ? '⏳' : '✅'} {t('تم التحويل', 'Mark Transferred')}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ===== تبويب المنتجات ===== */}
            {adminTab === 'products' && canAccess('products') && (
              <div className="space-y-6">
                <div className="bg-[var(--lava-card)] p-6 md:p-8 rounded-xl shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
                    <div>
                      <h2 className="text-2xl font-bold">{t('إدارة المنتجات', 'Product Management')}</h2>
                      <p className="text-[var(--lava-muted)] text-sm mt-1">{t('اختر منتج من القائمة لتعديله، أو أضف منتج جديد.', 'Select a product from the list to edit it, or add a new one.')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={exportCatalog}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition"
                      >
                        📥 {t('تصدير الكتالوج (CSV لميتا)', 'Export Catalog (CSV for Meta)')}
                      </button>
                      {productManagerMode === 'closed' && (
                        <button
                          onClick={openAddProduct}
                          className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition"
                        >
                          ＋ {t('إضافة منتج جديد', 'Add New Product')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ===================================================== */}
                {/* حالة القائمة: مفيش منتج مختار — لازم اختيار صريح من الأدمن */}
                {/* ===================================================== */}
                {productManagerMode === 'closed' && (() => {
                  const q = adminProductSearch.trim().toLowerCase();
                  const matchesSearch = (p) => {
                    if (!q) return true;
                    const nameAr = (p.name?.ar || '').toLowerCase();
                    const nameEn = (p.name?.en || '').toLowerCase();
                    const skus = getVariants(p).flatMap(v => Object.values(v.sizeStock || {}).map(s => (s.sku || '').toLowerCase()));
                    const cat = (getLocalized(p.category) || '').toLowerCase();
                    return nameAr.includes(q) || nameEn.includes(q) || cat.includes(q) || skus.some(s => s.includes(q));
                  };
                  const matchesFilter = (p) => {
                    const vis = p.visibility || 'published';
                    const stockStatus = getProductStockStatus(p);
                    switch (adminProductFilter) {
                      case 'published': return vis === 'published';
                      case 'hidden': return vis === 'hidden';
                      case 'draft': return vis === 'draft';
                      case 'in_stock': return stockStatus === 'in';
                      case 'low_stock': return stockStatus === 'low';
                      case 'out_of_stock': return stockStatus === 'out';
                      case 'featured': return !!p.isFeatured;
                      case 'on_sale': return !!p.onSale || !!(p.permanentSalePrice && p.permanentSalePrice > 0);
                      default: return true;
                    }
                  };
                  const visibleList = products.filter(p => matchesSearch(p) && matchesFilter(p));
                  const filterOptions = [
                    { key: 'all', label: t('الكل', 'All') },
                    { key: 'published', label: t('منشور', 'Published') },
                    { key: 'hidden', label: t('مخفي', 'Hidden') },
                    { key: 'draft', label: t('مسودة', 'Draft') },
                    { key: 'in_stock', label: t('متوفر', 'In Stock') },
                    { key: 'low_stock', label: t('مخزون منخفض', 'Low Stock') },
                    { key: 'out_of_stock', label: t('غير متوفر', 'Out of Stock') },
                    { key: 'featured', label: t('مميز', 'Featured') },
                    { key: 'on_sale', label: t('عرض', 'On Sale') },
                  ];
                  return (
                    <div className="bg-[var(--lava-card)] p-6 md:p-8 rounded-xl shadow-md space-y-5">
                      <div className="flex flex-col md:flex-row gap-3 md:items-center">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={adminProductSearch}
                            onChange={(e) => setAdminProductSearch(e.target.value)}
                            placeholder={t('ابحث بالاسم أو SKU أو القسم...', 'Search by name, SKU, or category...')}
                            className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {filterOptions.map(f => (
                          <button
                            key={f.key}
                            onClick={() => setAdminProductFilter(f.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${adminProductFilter === f.key ? 'bg-black text-white border-black' : 'bg-[var(--lava-secondary)] text-[var(--lava-muted)] hover:bg-[var(--lava-secondary)]'}`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {products.length === 0 ? (
                        <div className="text-center py-16 text-[var(--lava-muted)]">
                          <div className="text-4xl mb-3">📦</div>
                          <p className="font-bold text-[var(--lava-muted)]">{t('لا يوجد منتجات بعد.', 'No products yet.')}</p>
                          <p className="text-sm mt-1">{t('اضغط "إضافة منتج جديد" للبدء.', 'Click "Add New Product" to get started.')}</p>
                        </div>
                      ) : visibleList.length === 0 ? (
                        <div className="text-center py-16 text-[var(--lava-muted)]">
                          <div className="text-4xl mb-3">🔍</div>
                          <p className="font-bold text-[var(--lava-muted)]">{t('مفيش منتجات مطابقة للبحث/الفلتر.', 'No products match your search or filter.')}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {visibleList.map(prod => {
                            const stockStatus = getProductStockStatus(prod);
                            const visibility = prod.visibility || 'published';
                            const firstSku = getVariants(prod).flatMap(v => Object.values(v.sizeStock || {})).map(s => s.sku)[0];
                            return (
                              <div key={prod.id} className="border rounded-lg bg-[var(--lava-secondary)] hover:shadow-md transition overflow-hidden group">
                                <div className="cursor-pointer" onClick={() => openEditProduct(prod)}>
                                  <div className="relative">
                                    <img src={prod.images?.[0]} alt="" className="w-full h-40 object-cover" />
                                    <span className={`absolute top-1.5 start-1.5 text-[10px] font-bold px-2 py-0.5 rounded text-white ${stockStatus === 'out' ? 'bg-red-600' : stockStatus === 'low' ? 'bg-orange-500' : 'bg-green-600'}`}>
                                      {stockStatus === 'out' ? `🔴 ${t('غير متوفر', 'Out of Stock')}` : stockStatus === 'low' ? `🟡 ${t('مخزون منخفض', 'Low Stock')}` : `🟢 ${t('متوفر', 'In Stock')}`}
                                    </span>
                                    <span className={`absolute top-1.5 end-1.5 text-[10px] font-bold px-2 py-0.5 rounded text-white ${visibility === 'published' ? 'bg-green-700' : visibility === 'draft' ? 'bg-yellow-600' : 'bg-gray-500'}`}>
                                      {visibility === 'published' ? `🟢 ${t('منشور', 'Published')}` : visibility === 'draft' ? `🟡 ${t('مسودة', 'Draft')}` : `⚪ ${t('مخفي', 'Hidden')}`}
                                    </span>
                                  </div>
                                  <div className="p-3">
                                    <h4 className="font-bold truncate">{getLocalized(prod.name)}</h4>
                                    <p className="text-xs text-[var(--lava-muted)] truncate">{getLocalized(prod.category) || t('بدون قسم', 'No category')}{firstSku ? ` · SKU: ${firstSku}` : ''}</p>
                                    {prod.onSale && prod.salePrice ? (
                                      <div className="mt-1">
                                        <span className="inline-block text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded mb-0.5">⏱ {t('عرض موقوت', 'Timed Sale')}</span>
                                        <p className="text-sm"><span className="line-through text-[var(--lava-muted)] me-2">{prod.price} {t('ج.م', 'EGP')}</span><span className="text-red-600 font-bold">{prod.salePrice} {t('ج.م', 'EGP')}</span></p>
                                      </div>
                                    ) : prod.permanentSalePrice ? (
                                      <div className="mt-1">
                                        <span className="inline-block text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded mb-0.5">🏷️ {t('خصم ثابت', 'Fixed Discount')} {Math.round((1 - prod.permanentSalePrice / prod.price) * 100)}%</span>
                                        <p className="text-sm"><span className="line-through text-[var(--lava-muted)] me-2">{prod.price} {t('ج.م', 'EGP')}</span><span className="text-green-700 font-bold">{prod.permanentSalePrice} {t('ج.م', 'EGP')}</span></p>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-[var(--lava-muted)] mt-1">{prod.price} {t('ج.م', 'EGP')}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="px-3 pb-3 flex flex-wrap gap-1.5 border-t pt-2">
                                  <button onClick={() => openEditProduct(prod)} className="text-xs font-bold px-2.5 py-1 rounded bg-[var(--lava-card)] border hover:bg-[var(--lava-secondary)]">✏️ {t('تعديل', 'Edit')}</button>
                                  <button
                                    onClick={() => setProductVisibility(prod.id, visibility === 'published' ? 'hidden' : 'published')}
                                    className="text-xs font-bold px-2.5 py-1 rounded bg-[var(--lava-card)] border hover:bg-[var(--lava-secondary)]"
                                  >{visibility === 'published' ? `🙈 ${t('إخفاء', 'Hide')}` : `👁️ ${t('إظهار', 'Show')}`}</button>
                                  <button onClick={() => duplicateProduct(prod)} className="text-xs font-bold px-2.5 py-1 rounded bg-[var(--lava-card)] border hover:bg-[var(--lava-secondary)]">🧬 {t('نسخ', 'Duplicate')}</button>
                                  <button onClick={() => openProductDetails(prod)} className="text-xs font-bold px-2.5 py-1 rounded bg-[var(--lava-card)] border hover:bg-[var(--lava-secondary)]">🔗 {t('عرض', 'View')}</button>
                                  <button onClick={() => setConfirmDeleteProductId(prod.id)} className="text-xs font-bold px-2.5 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 ms-auto">🗑️ {t('حذف', 'Delete')}</button>
                                </div>
                                {confirmDeleteProductId === prod.id && (
                                  <div className="p-3 bg-red-50 border-t border-red-200 text-xs">
                                    <p className="font-bold text-red-700 mb-2">{t('متأكد إنك عايز تحذف المنتج ده؟ الإجراء ده لا يمكن التراجع عنه.', 'Delete this product? This action cannot be undone.')}</p>
                                    <div className="flex gap-2">
                                      <button onClick={() => deleteProduct(prod.id)} className="bg-red-600 text-white px-3 py-1 rounded font-bold">{t('تأكيد الحذف', 'Confirm Delete')}</button>
                                      <button onClick={() => setConfirmDeleteProductId(null)} className="bg-[var(--lava-card)] border px-3 py-1 rounded font-bold">{t('إلغاء', 'Cancel')}</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ===================================================== */}
                {/* محرر المنتج: يظهر فقط بعد اختيار/إضافة صريح */}
                {/* ===================================================== */}
                {(productManagerMode === 'add' || productManagerMode === 'edit') && (() => {
                  const editorTabs = [
                    { key: 'basic', label: t('البيانات الأساسية', 'Basic Information'), icon: '📝' },
                    { key: 'media', label: t('الوسائط', 'Media'), icon: '🖼️' },
                    { key: 'variants', label: t('الألوان والمقاسات', 'Variants'), icon: '🎨' },
                    { key: 'inventory', label: t('المخزون', 'Inventory'), icon: '📦' },
                    { key: 'visibility', label: t('الظهور', 'Visibility'), icon: '👁️' },
                    { key: 'marketing', label: t('التسويق', 'Marketing'), icon: '📣' },
                    { key: 'seo', label: t('تحسين محركات البحث', 'SEO'), icon: '🔎' },
                    { key: 'offers', label: t('عروض المنتج', 'Product Offers'), icon: '🎁' },
                  ];
                  const editingProduct = productManagerMode === 'edit' ? products.find(p => p.id === selectedManagedProductId) : null;
                  return (
                    <form onSubmit={handleSaveProduct} className="bg-[var(--lava-card)] rounded-xl shadow-md overflow-hidden">
                      {/* ===== شريط علوي: رجوع + اسم المنتج + حفظ ===== */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-6 border-b bg-[var(--lava-secondary)]">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => closeProductEditor(false)} className="text-[var(--lava-muted)] hover:text-black font-bold flex items-center gap-1.5">
                            {language === 'ar' ? '→' : '←'} {t('رجوع للقائمة', 'Back to list')}
                          </button>
                          <span className="text-gray-300">|</span>
                          <h3 className="font-extrabold text-lg">
                            {productManagerMode === 'add' ? t('إضافة منتج جديد', 'Add New Product') : `${t('تعديل:', 'Editing:')} ${getLocalized(editingProduct?.name) || ''}`}
                          </h3>
                          {productEditorDirty && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">{t('تعديلات غير محفوظة', 'Unsaved changes')}</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => closeProductEditor(false)} className="bg-[var(--lava-card)] border px-4 py-2 rounded-lg font-bold text-sm">{t('إلغاء', 'Cancel')}</button>
                          <button type="submit" disabled={isSavingProduct} className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-lg font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                            {isSavingProduct ? t('جارٍ الحفظ...', 'Saving...') : (productManagerMode === 'add' ? t('إضافة المنتج', 'Add Product') : t('حفظ التغييرات', 'Save Changes'))}
                          </button>
                        </div>
                      </div>

                      {/* ===== تبويبات المحرر ===== */}
                      <div className="flex flex-wrap gap-1.5 p-3 md:px-6 bg-[var(--lava-secondary)] border-b overflow-x-auto">
                        {editorTabs.map(tab => (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setProductEditorTab(tab.key)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap flex items-center gap-1 ${productEditorTab === tab.key ? 'bg-black text-white' : 'bg-[var(--lava-card)] border text-[var(--lava-muted)] hover:bg-[var(--lava-secondary)]'}`}
                          >
                            {tab.icon} {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="p-4 md:p-8 space-y-6">
                        {/* ===== البيانات الأساسية ===== */}
                        {productEditorTab === 'basic' && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <InputField label={`${t('اسم المنتج', 'Product Name')} (${t('عربي', 'Arabic')})`} type="text" value={newProdNameAr} onChange={(e) => setNewProdNameAr(e.target.value)} id="newProdNameAr" />
                              <InputField label={`${t('اسم المنتج', 'Product Name')} (English)`} type="text" value={newProdNameEn} onChange={(e) => setNewProdNameEn(e.target.value)} id="newProdNameEn" />
                              <div>
                                <label className="block text-sm font-semibold mb-1">{t('القسم', 'Category')}</label>
                                <select value={newProdCat} onChange={(e) => setNewProdCat(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]">
                                  <option value="">{t('اختر القسم', 'Select category')}</option>
                                  {categories.map(c => <option key={c.id} value={getLocalized(c.name)}>{getLocalized(c.name)}</option>)}
                                </select>
                              </div>
                              <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                  <InputField label={t('سعر البيع', 'Selling Price')} type="number" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} required={true} id="newProdPrice" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-1 mb-1">
                                    <label className="block text-sm font-semibold" htmlFor="newProdPermanentSalePriceInline">🏷️ {t('سعر الخصم الثابت', 'Fixed Discount Price')}</label>
                                    {newProdPermanentSalePrice && newProdPrice && Number(newProdPermanentSalePrice) > 0 && Number(newProdPrice) > 0 && (
                                      <span className="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                                        -{Math.round((1 - Number(newProdPermanentSalePrice) / Number(newProdPrice)) * 100)}%
                                      </span>
                                    )}
                                  </div>
                                  <input
                                    id="newProdPermanentSalePriceInline"
                                    type="number"
                                    value={newProdPermanentSalePrice}
                                    onChange={(e) => setNewProdPermanentSalePrice(e.target.value)}
                                    placeholder={t('اتركه فاضي لو مفيش خصم', 'Leave empty if no discount')}
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
                                  />
                                </div>
                              </div>
                              <InputField label={t('تكلفة القطعة', 'Cost per Item')} type="number" value={newProdCost} onChange={(e) => setNewProdCost(e.target.value)} required={true} id="newProdCost" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <TextareaField label={`${t('الوصف', 'Description')} (${t('عربي', 'Arabic')})`} value={newProdDescAr} onChange={(e) => setNewProdDescAr(e.target.value)} rows={3} id="newProdDescAr" />
                              <TextareaField label={`${t('الوصف', 'Description')} (English)`} value={newProdDescEn} onChange={(e) => setNewProdDescEn(e.target.value)} rows={3} id="newProdDescEn" />
                            </div>
                          </div>
                        )}

                        {/* ===== الوسائط (صور عامة للمنتج) ===== */}
                        {productEditorTab === 'media' && (
                          <div className="space-y-3">
                            <label className="block font-semibold mb-1 text-sm">{t('رفع صور المنتج العامة', 'Upload general product images')}</label>
                            <p className="text-xs text-[var(--lava-muted)]">{t('دي الصور الافتراضية. لو عايز صور مخصصة لكل لون، ضيفها من تبويب "الألوان والمقاسات".', 'These are the default images. For color-specific images, add them in the "Variants" tab.')}</p>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              onChange={handleProductImageUpload}
                              className="w-full text-sm border rounded-lg px-3 py-2 bg-[var(--lava-card)] file:me-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-black file:text-white file:font-bold file:cursor-pointer"
                            />
                            {newProdImageFiles.length > 0 ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                {newProdImageFiles.map((img, index) => (
                                  <div
                                    key={img.id}
                                    draggable
                                    onDragStart={() => handleImageDragStart(img.id)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleImageDrop(img.id)}
                                    className={`relative border-2 rounded-lg overflow-hidden cursor-move bg-[var(--lava-card)] ${index === 0 ? 'border-black' : 'border-[var(--lava-border)]'}`}
                                  >
                                    <img src={img.dataUrl} alt={img.name} className="w-full h-20 object-cover" />
                                    {index === 0 && (
                                      <span className="absolute top-1 start-1 bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{t('أساسية', 'Primary')}</span>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 px-1 py-0.5">
                                      {index !== 0 && (
                                        <button
                                          type="button"
                                          onClick={() => setProductImageAsPrimary(img.id)}
                                          className="text-white text-[10px] font-bold hover:underline"
                                          title={t('تعيين كصورة أساسية', 'Set as primary')}
                                        >★</button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => removeProductImage(img.id)}
                                        className="text-red-400 text-[10px] font-bold hover:underline ms-auto"
                                        title={t('حذف', 'Remove')}
                                      >✕</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-[var(--lava-muted)] italic py-4 text-center border rounded-lg bg-[var(--lava-secondary)]">{t('لا يوجد صور مضافة بعد.', 'No images added yet.')}</p>
                            )}
                            <p className="text-xs text-[var(--lava-muted)]">{t('اسحب وأفلت الصور لإعادة ترتيبها، واضغط ★ لتعيين الصورة الأساسية.', 'Drag & drop to reorder, click ★ to set the primary image.')}</p>
                            <TextareaField label={t('أو روابط الصور (كل رابط في سطر) — تُستخدم فقط لو مفيش صور مرفوعة', 'Or Image URLs (one per line) — used only if no images were uploaded')} value={newProdImgs} onChange={(e) => setNewProdImgs(e.target.value)} placeholder="https://..." rows={3} id="newProdImgs" />

                            {/* ===== فيديو المنتج (اختياري) — بيترفع مباشرة على Cloudinary ===== */}
                            <div className="pt-4 border-t">
                              <VideoUploadField
                                label={t('فيديو المنتج (اختياري)', 'Product Video (optional)')}
                                value={newProdVideo}
                                onChange={(uploaded) => setNewProdVideo(uploaded)}
                                id="newProdVideo"
                                showToast={showToast}
                                t={t}
                                uploader={productsAPI.uploadVideo}
                              />
                            </div>
                          </div>
                        )}

                        {/* ===== الألوان والمقاسات (فاريانتس) ===== */}
                        {productEditorTab === 'variants' && (
                          <div className="space-y-6">
                            {/* ----- المقاسات ----- */}
                            <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-3">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" id="newProdHasSizes" checked={newProdHasSizes} onChange={(e) => { setNewProdHasSizes(e.target.checked); setNewProdVariantsGenerated(null); }} className="w-5 h-5" />
                                <label htmlFor="newProdHasSizes" className="font-bold cursor-pointer">{t('هل المنتج له مقاسات؟', 'Has sizes?')}</label>
                              </div>
                              {newProdHasSizes && (
                                <>
                                  <div className="flex flex-wrap gap-4">
                                    {AVAILABLE_SIZE_OPTIONS.map(size => (
                                      <label key={size} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={newProdSelectedSizes.includes(size)}
                                          onChange={(e) => {
                                            setNewProdSelectedSizes(prev => e.target.checked ? [...prev, size] : prev.filter(s => s !== size));
                                            setNewProdVariantsGenerated(null);
                                          }}
                                        />
                                        {size}
                                      </label>
                                    ))}
                                  </div>
                                  <div className="flex gap-2 items-end">
                                    <InputField label={t('مقاس مخصص', 'Custom size')} value={newProdCustomSize} onChange={(e) => setNewProdCustomSize(e.target.value)} placeholder={t('مثال: 42', 'e.g. 42')} id="newProdCustomSize" className="flex-1" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const v = newProdCustomSize.trim();
                                        if (v && !newProdSelectedSizes.includes(v)) {
                                          setNewProdSelectedSizes(prev => [...prev, v]);
                                          setNewProdVariantsGenerated(null);
                                        }
                                        setNewProdCustomSize('');
                                      }}
                                      className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-sm"
                                    >{t('إضافة مقاس', 'Add size')}</button>
                                  </div>
                                  {newProdSelectedSizes.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {newProdSelectedSizes.map(size => (
                                        <span key={size} className="bg-black text-white text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
                                          {size}
                                          <button type="button" onClick={() => { setNewProdSelectedSizes(prev => prev.filter(s => s !== size)); setNewProdVariantsGenerated(null); }} className="hover:text-red-400">✕</button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* ----- الألوان ----- */}
                            <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-4">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" id="newProdHasColors" checked={newProdHasColors} onChange={(e) => { setNewProdHasColors(e.target.checked); setNewProdVariantsGenerated(null); }} className="w-5 h-5" />
                                <label htmlFor="newProdHasColors" className="font-bold cursor-pointer">{t('هل المنتج له ألوان؟', 'Has colors?')}</label>
                              </div>
                              {newProdHasColors && (
                                <>
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <InputField label={t('اسم اللون (عربي)', 'Color name (Arabic)')} value={newProdColorNameAr} onChange={(e) => setNewProdColorNameAr(e.target.value)} id="newProdColorNameAr" />
                                    <InputField label={t('اسم اللون (إنجليزي)', 'Color name (English)')} value={newProdColorNameEn} onChange={(e) => setNewProdColorNameEn(e.target.value)} id="newProdColorNameEn" />
                                    <div>
                                      <label className="block text-sm font-semibold mb-1">{t('اللون', 'Color')}</label>
                                      <input type="color" value={newProdColorHex} onChange={(e) => setNewProdColorHex(e.target.value)} className="w-full h-10 border rounded-lg cursor-pointer" />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!newProdColorNameAr.trim() && !newProdColorNameEn.trim()) {
                                          showToast(t('من فضلك ادخل اسم اللون', 'Please enter a color name'));
                                          return;
                                        }
                                        setNewProdColors(prev => [...prev, { id: `c${Date.now()}`, nameAr: newProdColorNameAr.trim(), nameEn: newProdColorNameEn.trim(), hex: newProdColorHex }]);
                                        setNewProdColorNameAr(''); setNewProdColorNameEn(''); setNewProdColorHex('#000000');
                                        setNewProdVariantsGenerated(null);
                                      }}
                                      className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-sm h-10"
                                    >{t('إضافة لون', 'Add color')}</button>
                                  </div>

                                  {newProdColors.length === 0 ? (
                                    <p className="text-sm text-[var(--lava-muted)] italic">{t('هذا المنتج ليس له ألوان بعد.', 'This product has no colors yet.')}</p>
                                  ) : (
                                    <div className="space-y-4">
                                      {newProdColors.map(c => {
                                        const colorImgs = newProdColorImages[c.id] || [];
                                        return (
                                          <div key={c.id} className="bg-[var(--lava-card)] border rounded-lg p-4 space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 font-bold">
                                                <span className="w-5 h-5 rounded-full border inline-block" style={{ backgroundColor: c.hex }}></span>
                                                {c.nameAr || c.nameEn || c.hex}
                                              </div>
                                              <button type="button" onClick={() => { setNewProdColors(prev => prev.filter(x => x.id !== c.id)); setNewProdColorImages(prev => { const n = { ...prev }; delete n[c.id]; return n; }); setNewProdVariantsGenerated(null); }} className="text-red-500 hover:text-red-700 text-sm font-bold">✕ {t('حذف اللون', 'Remove color')}</button>
                                            </div>

                                            <div>
                                              <label className="block text-xs font-bold text-[var(--lava-muted)] mb-1.5">{t('صور هذا اللون', 'Images for this color')}</label>
                                              <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                multiple
                                                onChange={(e) => { handleColorImageUpload(c.id, e.target.files); e.target.value = ''; }}
                                                className="w-full text-sm border rounded-lg px-3 py-2 bg-[var(--lava-card)] file:me-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-800 file:text-white file:font-bold file:cursor-pointer"
                                              />
                                              {colorImgs.length === 0 ? (
                                                <p className="text-xs text-[var(--lava-muted)] italic mt-2">{t('لا يوجد صور مضافة لهذا اللون بعد.', 'No images added for this color.')}</p>
                                              ) : (
                                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 mt-2.5">
                                                  {colorImgs.map((img, index) => (
                                                    <div
                                                      key={img.id}
                                                      draggable
                                                      onDragStart={() => handleColorImageDragStart(c.id, img.id)}
                                                      onDragOver={(e) => e.preventDefault()}
                                                      onDrop={() => handleColorImageDrop(c.id, img.id)}
                                                      className={`relative border-2 rounded-lg overflow-hidden cursor-move bg-[var(--lava-card)] ${index === 0 ? 'border-black' : 'border-[var(--lava-border)]'}`}
                                                    >
                                                      <img src={img.dataUrl} alt={img.name} className="w-full h-16 object-cover" />
                                                      {index === 0 && (
                                                        <span className="absolute top-0.5 start-0.5 bg-black text-white text-[9px] font-bold px-1 py-0.5 rounded">{t('أساسية', 'Primary')}</span>
                                                      )}
                                                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1 py-0.5 gap-0.5">
                                                        <button type="button" onClick={() => moveColorImage(c.id, img.id, 'left')} className="text-white text-[9px] font-bold" title={t('لليسار', 'Move left')}>◂</button>
                                                        {index !== 0 && (
                                                          <button type="button" onClick={() => setColorImageAsPrimary(c.id, img.id)} className="text-white text-[9px] font-bold" title={t('تعيين كأساسية', 'Set as primary')}>★</button>
                                                        )}
                                                        <button type="button" onClick={() => moveColorImage(c.id, img.id, 'right')} className="text-white text-[9px] font-bold" title={t('لليمين', 'Move right')}>▸</button>
                                                        <button type="button" onClick={() => removeColorImage(c.id, img.id)} className="text-red-400 text-[9px] font-bold" title={t('حذف', 'Remove')}>✕</button>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* ----- توليد الفاريانتس ----- */}
                            <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-3">
                              <button type="button" onClick={generateVariantsPreview} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm">
                                🔄 {t('توليد الفاريانتس (لون × مقاس) وضبط المخزون', 'Generate Variants (color × size) & set stock')}
                              </button>
                              {newProdVariantsGenerated && newProdVariantsGenerated.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-[var(--lava-border)] text-left">
                                        {newProdHasColors && <th className="px-2 py-1.5">{t('اللون', 'Color')}</th>}
                                        <th className="px-2 py-1.5">{t('المقاس', 'Size')}</th>
                                        <th className="px-2 py-1.5">SKU</th>
                                        <th className="px-2 py-1.5">{t('المخزون', 'Stock')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {newProdVariantsGenerated.map(combo => {
                                        const entry = newProdVariantStockInputs[combo.key] || { sku: '', stock: 0 };
                                        return (
                                          <tr key={combo.key} className="border-b bg-[var(--lava-card)]">
                                            {newProdHasColors && (
                                              <td className="px-2 py-1.5 flex items-center gap-2">
                                                {combo.hex && <span className="w-3.5 h-3.5 rounded-full border inline-block" style={{ backgroundColor: combo.hex }}></span>}
                                                {combo.colorLabel}
                                              </td>
                                            )}
                                            <td className="px-2 py-1.5">{combo.size}</td>
                                            <td className="px-2 py-1.5">
                                              <input
                                                type="text"
                                                value={entry.sku}
                                                onChange={(e) => setNewProdVariantStockInputs(prev => ({ ...prev, [combo.key]: { ...prev[combo.key], sku: e.target.value } }))}
                                                className="w-32 px-2 py-1 border rounded"
                                              />
                                            </td>
                                            <td className="px-2 py-1.5">
                                              <input
                                                type="number"
                                                min="0"
                                                value={entry.stock}
                                                onChange={(e) => setNewProdVariantStockInputs(prev => ({ ...prev, [combo.key]: { ...prev[combo.key], stock: Math.max(0, Number(e.target.value) || 0) } }))}
                                                className="w-24 px-2 py-1 border rounded"
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-[var(--lava-muted)] italic">{t('لا يوجد فاريانتس تم توليدها بعد.', 'No variants created yet.')}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ===== المخزون ===== */}
                        {productEditorTab === 'inventory' && (
                          <div className="space-y-4">
                            <InputField label={t('حد التنبيه للمخزون المنخفض (اختياري)', 'Low stock threshold (optional)')} type="number" value={newProdLowStockThreshold} onChange={(e) => setNewProdLowStockThreshold(e.target.value)} placeholder={String(adminSettings.current.defaultLowStockThreshold)} id="newProdLowStockThreshold" />
                            {newProdVariantsGenerated && newProdVariantsGenerated.length > 0 ? (
                              <div className="border-t pt-4">
                                <p className="text-sm font-bold text-[var(--lava-muted)] mb-2">{t('تعديل الكمية لكل خيار (لون / مقاس)', 'Adjust quantity for each color / size option')}</p>
                                <div className="space-y-1.5">
                                  {newProdVariantsGenerated.map(combo => {
                                    const entry = newProdVariantStockInputs[combo.key] || { sku: '', stock: 0 };
                                    const s = Math.max(0, Number(entry.stock) || 0);
                                    const threshold = newProdLowStockThreshold !== '' ? Number(newProdLowStockThreshold) : adminSettings.current.defaultLowStockThreshold;
                                    const status = s <= 0 ? t('غير متوفر', 'Out') : s <= threshold ? t('منخفض', 'Low') : t('متوفر', 'In Stock');
                                    const statusColor = s <= 0 ? 'text-red-600' : s <= threshold ? 'text-orange-500' : 'text-green-600';
                                    // كل تعديل هنا بيروح لنفس الـ state اللي تبويب "الألوان والمقاسات" وزرار "حفظ التغييرات" بيقروا منه -
                                    // مفيش مصدرين مختلفين للمخزون، وده اللي كان بيسبب رجوع الكمية لصفر بعد الحفظ.
                                    const setStock = (val) => {
                                      const clamped = Math.max(0, Math.floor(Number(val)) || 0);
                                      setNewProdVariantStockInputs(prev => ({ ...prev, [combo.key]: { ...(prev[combo.key] || {}), sku: (prev[combo.key] && prev[combo.key].sku) || entry.sku, stock: clamped } }));
                                      setProductEditorDirty(true);
                                    };
                                    return (
                                      <div key={combo.key} className="flex items-center gap-2 bg-[var(--lava-secondary)] border rounded px-2 py-1.5 text-sm">
                                        {combo.hex && <span className="w-3 h-3 rounded-full border flex-shrink-0" style={{ backgroundColor: combo.hex }}></span>}
                                        <span className="flex-1 truncate">{combo.colorLabel ? `${combo.colorLabel} / ` : ''}{combo.size} <span className="text-[var(--lava-muted)]">({entry.sku})</span></span>
                                        <button type="button" onClick={() => setStock(s - 1)} className="w-6 h-6 border rounded font-bold hover:bg-[var(--lava-secondary)]">−</button>
                                        <input
                                          type="number"
                                          min="0"
                                          value={s}
                                          onChange={(e) => setStock(e.target.value)}
                                          className="w-16 px-1 py-0.5 border rounded text-center"
                                        />
                                        <button type="button" onClick={() => setStock(s + 1)} className="w-6 h-6 border rounded font-bold hover:bg-[var(--lava-secondary)]">+</button>
                                        <span className={`font-bold ${statusColor} whitespace-nowrap text-xs`}>{status}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-xs text-[var(--lava-muted)] font-semibold mt-3">{t('⚠️ الكميات هنا بتتحفظ فعلياً لما تدوس "حفظ التغييرات" تحت.', '⚠️ Quantities here are actually saved when you click "Save Changes" below.')}</p>
                              </div>
                            ) : (
                              <p className="text-sm text-[var(--lava-muted)] italic">{t('اضبط الألوان والمقاسات أولاً من تبويب "الألوان والمقاسات" (وولّد الفاريانتس) عشان تظهر خيارات المخزون هنا.', 'Set up colors/sizes first in the "Variants" tab (and generate variants) so inventory options appear here.')}</p>
                            )}
                          </div>
                        )}

                        {/* ===== الظهور ===== */}
                        {productEditorTab === 'visibility' && (
                          <div className="space-y-3 max-w-md">
                            <label className="block text-sm font-semibold mb-1">{t('حالة الظهور', 'Visibility')}</label>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setNewProdVisibility('published')} className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${newProdVisibility === 'published' ? 'bg-green-600 text-white' : 'bg-[var(--lava-secondary)] border text-[var(--lava-muted)]'}`}>🟢 {t('منشور', 'Published')}</button>
                              <button type="button" onClick={() => setNewProdVisibility('hidden')} className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${newProdVisibility === 'hidden' ? 'bg-gray-800 text-white' : 'bg-[var(--lava-secondary)] border text-[var(--lava-muted)]'}`}>⚪ {t('مخفي', 'Hidden')}</button>
                              <button type="button" onClick={() => setNewProdVisibility('draft')} className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${newProdVisibility === 'draft' ? 'bg-yellow-600 text-white' : 'bg-[var(--lava-secondary)] border text-[var(--lava-muted)]'}`}>🟡 {t('مسودة', 'Draft')}</button>
                            </div>
                            <p className="text-xs text-[var(--lava-muted)] pt-2">
                              {t('منشور: يظهر للعملاء. مخفي: لا يظهر في المتجر. مسودة: غير جاهز للنشر بعد. الأدمن يقدر يدير المنتج في الحالتين.', 'Published: visible to customers. Hidden: not shown on the storefront. Draft: not ready yet. The admin can still manage hidden/draft products.')}
                            </p>
                          </div>
                        )}

                        {/* ===== التسويق ===== */}
                        {productEditorTab === 'marketing' && (
                          <div className="flex flex-col gap-3 bg-[var(--lava-secondary)] p-4 rounded-lg border max-w-xl">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" id="newProdOnSale" checked={newProdOnSale} onChange={(e) => setNewProdOnSale(e.target.checked)} className="w-5 h-5" />
                                <label htmlFor="newProdOnSale" className="font-bold cursor-pointer">⏱ {t('عرض موقوت (مرتبط بعداد الموقع)', 'Timed Sale (linked to site countdown)')}</label>
                                {newProdOnSale && (
                                  <input type="number" placeholder={t('سعر العرض الموقوت', 'Timed Sale Price')} value={newProdSalePrice} onChange={(e) => setNewProdSalePrice(e.target.value)} className="px-3 py-1.5 border rounded-lg w-36 focus:outline-none focus:ring-2 focus:ring-black" />
                                )}
                              </div>
                              <p className="text-xs text-[var(--lava-muted)] bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 leading-relaxed">
                                ⚠️ {t('العرض الموقوت بيشتغل مع عداد العد التنازلي اللي في إعدادات الموقع. لما الوقت يخلص، المنتج بيرجع لسعر الخصم الثابت (لو موجود) أو للسعر الأصلي.', 'The timed sale works with the countdown timer in site settings. When time runs out, the product reverts to the fixed discount price (if set) or the original price.')}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t">
                              <input type="checkbox" id="newProdIsFeatured" checked={newProdIsFeatured} onChange={(e) => setNewProdIsFeatured(e.target.checked)} className="w-5 h-5" />
                              <label htmlFor="newProdIsFeatured" className="font-bold cursor-pointer text-blue-700">⭐ {t('عرض في قائمة "المنتجات المميزة" في الصفحة الرئيسية', 'Show in "Featured Products" on home page')}</label>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t">
                              <input type="checkbox" id="newProdEnableRec" checked={newProdEnableRec} onChange={(e) => setNewProdEnableRec(e.target.checked)} className="w-5 h-5" />
                              <label htmlFor="newProdEnableRec" className="font-bold cursor-pointer text-blue-700">📌 {t('تفعيل عرض المنتجات المقترحة لهذا المنتج', 'Enable recommended products for this product')}</label>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t">
                              <input type="checkbox" id="newProdEnableBundle" checked={newProdEnableBundle} onChange={(e) => setNewProdEnableBundle(e.target.checked)} className="w-5 h-5" />
                              <label htmlFor="newProdEnableBundle" className="font-bold cursor-pointer text-blue-700">🛒 {t('تفعيل عرض عروض الباقة لهذا المنتج', 'Enable bundle offers for this product')}</label>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t">
                              <input type="checkbox" id="newProdEnableReviews" checked={newProdEnableReviews} onChange={(e) => setNewProdEnableReviews(e.target.checked)} className="w-5 h-5" />
                              <label htmlFor="newProdEnableReviews" className="font-bold cursor-pointer text-blue-700">⭐ {t('تفعيل التقييمات والمراجعات لهذا المنتج', 'Enable reviews & ratings for this product')}</label>
                            </div>
                          </div>
                        )}

                        {/* ===== SEO ===== */}
                        {productEditorTab === 'seo' && (
                          <div className="space-y-4 max-w-2xl">
                            <InputField label={t('الرابط المختصر (Slug)', 'Slug')} value={newProdSlug} onChange={(e) => setNewProdSlug(e.target.value)} placeholder="classic-tshirt-black" id="newProdSlug" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <InputField label={`Meta Title (${t('عربي', 'Arabic')})`} value={newProdMetaTitleAr} onChange={(e) => setNewProdMetaTitleAr(e.target.value)} id="newProdMetaTitleAr" />
                              <InputField label="Meta Title (English)" value={newProdMetaTitleEn} onChange={(e) => setNewProdMetaTitleEn(e.target.value)} id="newProdMetaTitleEn" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <TextareaField label={`Meta Description (${t('عربي', 'Arabic')})`} value={newProdMetaDescAr} onChange={(e) => setNewProdMetaDescAr(e.target.value)} rows={2} id="newProdMetaDescAr" />
                              <TextareaField label="Meta Description (English)" value={newProdMetaDescEn} onChange={(e) => setNewProdMetaDescEn(e.target.value)} rows={2} id="newProdMetaDescEn" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <InputField label={`${t('كلمات مفتاحية', 'Meta Keywords')} (${t('عربي', 'Arabic')})`} value={newProdMetaKeywordsAr} onChange={(e) => setNewProdMetaKeywordsAr(e.target.value)} placeholder={t('تيشيرت, قطن, رجالي', 'tshirt, cotton, men')} id="newProdMetaKeywordsAr" />
                              <InputField label="Meta Keywords (English)" value={newProdMetaKeywordsEn} onChange={(e) => setNewProdMetaKeywordsEn(e.target.value)} placeholder="tshirt, cotton, men" id="newProdMetaKeywordsEn" />
                            </div>
                            <p className="text-xs text-[var(--lava-muted)]">{t('افصل بين الكلمات بفاصلة (,)', 'Separate keywords with a comma (,)')}</p>
                            <div className="border rounded-lg p-3 bg-[var(--lava-secondary)]">
                              <p className="text-xs text-[var(--lava-muted)] mb-1">{t('معاينة نتيجة البحث', 'Search result preview')}</p>
                              <p className="text-blue-700 text-base leading-tight truncate">{(newProdMetaTitleAr || newProdMetaTitleEn || newProdNameAr || newProdNameEn) || t('عنوان المنتج', 'Product title')}</p>
                              <p className="text-green-700 text-xs">{(newProdSlug ? `${t('اسم-الموقع', 'yourstore')}.com/product/${newProdSlug}` : `${t('اسم-الموقع', 'yourstore')}.com/product/...`)}</p>
                              <p className="text-[var(--lava-muted)] text-sm leading-snug">{(newProdMetaDescAr || newProdMetaDescEn || newProdDescAr || newProdDescEn || '').slice(0, 160) || t('وصف المنتج سيظهر هنا', 'Product description preview will appear here')}</p>
                            </div>
                          </div>
                        )}

                        {/* ===== عروض المنتج المتعددة (Product Offers) - جزء 1-8 ===== */}
                        {productEditorTab === 'offers' && (
                          <div className="max-w-2xl space-y-5">
                            {!editingProduct ? (
                              <p className="text-sm text-[var(--lava-muted)] bg-[var(--lava-secondary)] border border-dashed rounded-lg p-6 text-center">
                                {t('احفظ المنتج أولاً عشان تقدر تضيف له عروضاً.', 'Please save the product first before adding offers to it.')}
                              </p>
                            ) : (() => {
                              const offers = Array.isArray(editingProduct.offers) ? editingProduct.offers : [];
                              const hasCampaignOverlap = promotions.some(pr => isPromotionCurrentlyActive(pr) && (
                                (pr.target === 'product' && pr.productId === editingProduct.id) ||
                                (pr.target === 'category' && pr.categoryId === getProductCategoryId(editingProduct)) ||
                                pr.target === 'all'
                              ));

                              const resetProductOfferForm = () => {
                                setEditingProductOfferId(null);
                                setPoName('');
                                setPoType('quantity_discount');
                                setPoMinQty(2);
                                setPoDiscountPercent(10);
                                setPoFixedAmount(50);
                                setPoBuyQty(2);
                                setPoFreeQty(1);
                                setPoActive(true);
                                setProductOfferFormOpen(false);
                              };

                              const openNewProductOfferForm = () => {
                                resetProductOfferForm();
                                setProductOfferFormOpen(true);
                              };

                              const openEditProductOfferForm = (o) => {
                                setEditingProductOfferId(o.id);
                                setPoName(o.name || '');
                                setPoType(o.type);
                                setPoMinQty(o.minQty ?? 2);
                                setPoDiscountPercent(o.discountPercent ?? 10);
                                setPoFixedAmount(o.fixedAmount ?? 50);
                                setPoBuyQty(o.buyQty ?? 2);
                                setPoFreeQty(o.freeQty ?? 1);
                                setPoActive(o.active !== false);
                                setProductOfferFormOpen(true);
                              };

                              const syncProductOffers = async (nextOffers, message) => {
                                if (!editingProduct?.id) return;
                                const latestProduct = productsRef.current.find(p => p.id === editingProduct.id) || editingProduct;
                                const nextProduct = { ...latestProduct, offers: nextOffers };
                                // ===== إزالة الحقول المحمية التي تسبب VersionError في Mongoose =====
                                // لا نرسل _id أو __v أو createdAt أو updatedAt إلى الباك اند عند التحديث
                                delete nextProduct._id;
                                delete nextProduct.__v;
                                delete nextProduct.createdAt;
                                delete nextProduct.updatedAt;
                                setProducts(prev => prev.map(p => p.id === editingProduct.id ? nextProduct : p));
                                try {
                                  const savedProduct = await productsAPI.update(editingProduct.id, nextProduct, []);
                                  const finalProduct = savedProduct ?? nextProduct;
                                  setProducts(prev => prev.map(p => p.id === editingProduct.id ? finalProduct : p));
                                  productsRef.current = productsRef.current.map(p => p.id === editingProduct.id ? finalProduct : p);
                                  if (message) showToast(message);
                                } catch (err) {
                                  console.error('تعذّر حفظ عروض المنتج:', err);
                                  showToast(t('حصل خطأ في حفظ عروض المنتج', 'Error saving product offers'));
                                }
                              };

                              const saveProductOffer = async () => {
                                const offerData = {
                                  id: editingProductOfferId || `po-${Date.now()}`,
                                  name: poName.trim(),
                                  type: poType,
                                  minQty: Number(poMinQty) || 1,
                                  discountPercent: Number(poDiscountPercent) || 0,
                                  percentage: Number(poDiscountPercent) || 0,
                                  fixedAmount: Number(poFixedAmount) || 0,
                                  buyQty: Number(poBuyQty) || 0,
                                  freeQty: Number(poFreeQty) || 0,
                                  active: poActive,
                                };
                                const existing = Array.isArray(editingProduct?.offers) ? editingProduct.offers : [];
                                const nextOffers = editingProductOfferId
                                  ? existing.map(o => o.id === editingProductOfferId ? offerData : o)
                                  : [...existing, offerData];
                                await syncProductOffers(nextOffers, t('تم حفظ العرض بنجاح', 'Offer saved successfully'));
                                resetProductOfferForm();
                              };

                              const toggleProductOfferActive = async (offerId) => {
                                const existing = Array.isArray(editingProduct?.offers) ? editingProduct.offers : [];
                                const nextOffers = existing.map(o => o.id === offerId ? { ...o, active: !o.active } : o);
                                await syncProductOffers(nextOffers, t('تم تحديث حالة العرض', 'Offer status updated'));
                              };

                              const deleteProductOffer = async (offerId) => {
                                const existing = Array.isArray(editingProduct?.offers) ? editingProduct.offers : [];
                                const nextOffers = existing.filter(o => o.id !== offerId);
                                await syncProductOffers(nextOffers, t('تم حذف العرض', 'Offer deleted'));
                              };

                              return (
                                <>
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold">{t('عروض المنتج', 'Product Offers')}</h3>
                                    {!productOfferFormOpen && (
                                      <button type="button" onClick={openNewProductOfferForm} className="bg-black text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-800">
                                        + {t('إضافة عرض', 'Add Offer')}
                                      </button>
                                    )}
                                  </div>

                                  {hasCampaignOverlap && (
                                    <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                      ⚠️ {t('في عرض حملة (Campaign) شغال كمان بيغطي المنتج ده. عروض المنتج دي هتاخد الأولوية دايماً ولن تتراكم العروض.', 'There is also an active campaign promotion covering this product. These product offers always take priority — offers never stack.')}
                                    </p>
                                  )}

                                  {!productOfferFormOpen && offers.length === 0 && (
                                    <p className="text-sm text-[var(--lava-muted)] bg-[var(--lava-secondary)] border border-dashed rounded-lg p-6 text-center">
                                      {t('لا يوجد عروض مضافة لهذا المنتج.', 'No product offers configured.')}
                                    </p>
                                  )}

                                  {!productOfferFormOpen && offers.length > 0 && (
                                    <div className="space-y-3">
                                      {offers.slice().sort((a, b) => getProductOfferThreshold(a) - getProductOfferThreshold(b)).map((o, idx) => (
                                        <div key={o.id} className="border rounded-lg p-4 bg-[var(--lava-card)] space-y-2">
                                          <div className="flex items-center justify-between">
                                            <p className="font-bold text-[var(--lava-text)]">{t('عرض', 'Offer')} #{idx + 1}{o.name ? ` — ${o.name}` : ''}</p>
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${o.active ? 'bg-green-100 text-green-700' : 'bg-[var(--lava-border)] text-[var(--lava-muted)]'}`}>
                                              {o.active ? t('نشط', 'ACTIVE') : t('غير نشط', 'INACTIVE')}
                                            </span>
                                          </div>
                                          <p className="text-sm text-[var(--lava-muted)]">{getLocalized(getPromotionLabel(o))}</p>
                                          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--lava-muted)]">
                                            <p>{t('الحد الأدنى للكمية', 'Minimum Quantity')}: {o.type === 'bxgy' ? o.buyQty : o.minQty}</p>
                                            <p>
                                              {o.type === 'percentage' || o.type === 'quantity_discount' ? `${t('الخصم', 'Discount')}: ${o.discountPercent}%` : ''}
                                              {o.type === 'fixed' ? `${t('الخصم', 'Discount')}: ${o.fixedAmount} ${t('ج.م', 'EGP')}` : ''}
                                              {o.type === 'bxgy' ? `${t('مجاناً', 'Free')}: ${o.freeQty}` : ''}
                                            </p>
                                          </div>
                                          <div className="flex gap-2 pt-2 border-t">
                                            <button type="button" onClick={() => openEditProductOfferForm(o)} className="text-xs font-bold px-3 py-1.5 rounded-lg border hover:bg-[var(--lava-secondary)]">
                                              {t('تعديل', 'Edit')}
                                            </button>
                                            <button type="button" onClick={() => toggleProductOfferActive(o.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg border hover:bg-[var(--lava-secondary)]">
                                              {o.active ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable')}
                                            </button>
                                            <button type="button" onClick={() => deleteProductOffer(o.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                                              {t('حذف', 'Delete')}
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {productOfferFormOpen && (
                                    <div className="border rounded-lg p-5 bg-[var(--lava-secondary)] space-y-4">
                                      <InputField label={t('اسم العرض', 'Offer Name')} type="text" value={poName} onChange={(e) => setPoName(e.target.value)} id="poName" placeholder={t('اختياري', 'Optional')} />

                                      <div>
                                        <label className="block font-semibold mb-2 text-sm">{t('نوع العرض', 'Offer Type')}</label>
                                        <div className="flex gap-2 flex-wrap">
                                          {[
                                            { key: 'percentage', label: t('خصم نسبة %', 'Percentage Discount') },
                                            { key: 'fixed', label: t('خصم مبلغ ثابت', 'Fixed Amount Discount') },
                                            { key: 'bxgy', label: t('اشترِ X واحصل على Y مجاناً', 'Buy X Get Y Free') },
                                            { key: 'quantity_discount', label: t('خصم كمية', 'Quantity Discount') },
                                          ].map(opt => (
                                            <button
                                              key={opt.key}
                                              type="button"
                                              onClick={() => setPoType(opt.key)}
                                              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${poType === opt.key ? 'bg-black text-white' : 'bg-[var(--lava-card)] border text-[var(--lava-muted)] hover:bg-[var(--lava-secondary)]'}`}
                                            >
                                              {opt.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {poType === 'bxgy' ? (
                                        <div className="grid grid-cols-2 gap-4">
                                          <InputField label={t('اشترِ (Buy)', 'Buy Quantity')} type="number" value={poBuyQty} onChange={(e) => setPoBuyQty(e.target.value)} id="poBuyQty" />
                                          <InputField label={t('احصل مجاناً على (Free)', 'Free Quantity')} type="number" value={poFreeQty} onChange={(e) => setPoFreeQty(e.target.value)} id="poFreeQty" />
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                          <InputField label={t('الحد الأدنى للكمية', 'Minimum Quantity')} type="number" value={poMinQty} onChange={(e) => setPoMinQty(e.target.value)} id="poMinQty" />
                                          {poType === 'fixed' ? (
                                            <InputField label={t('الخصم الثابت', 'Fixed Discount')} type="number" value={poFixedAmount} onChange={(e) => setPoFixedAmount(e.target.value)} id="poFixedAmount" />
                                          ) : (
                                            <InputField label={t('نسبة الخصم (%)', 'Discount Percentage')} type="number" value={poDiscountPercent} onChange={(e) => setPoDiscountPercent(e.target.value)} id="poDiscountPercent" />
                                          )}
                                        </div>
                                      )}

                                      <p className="text-xs text-[var(--lava-muted)] bg-[var(--lava-card)] p-3 rounded-lg border">
                                        {getLocalized(getPromotionLabel({ type: poType, buyQty: Number(poBuyQty) || 0, freeQty: Number(poFreeQty) || 0, minQty: Number(poMinQty) || 1, discountPercent: Number(poDiscountPercent) || 0, percentage: Number(poDiscountPercent) || 0, fixedAmount: Number(poFixedAmount) || 0 }))}
                                      </p>

                                      <div className="flex items-center justify-between bg-[var(--lava-card)] p-3 rounded-lg border">
                                        <label className="font-bold cursor-pointer text-sm">{t('الحالة', 'Status')}</label>
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={poActive}
                                          onClick={() => setPoActive(!poActive)}
                                          className={`w-14 h-8 rounded-full relative transition-colors ${poActive ? 'bg-green-500' : 'bg-[var(--lava-border)]'}`}
                                        >
                                          <span className={`absolute top-1 ${poActive ? (language === 'ar' ? 'right-1' : 'left-7') : (language === 'ar' ? 'right-7' : 'left-1')} w-6 h-6 bg-[var(--lava-card)] rounded-full shadow transition-all`}></span>
                                        </button>
                                      </div>

                                      <div className="flex gap-2 pt-2">
                                        <button type="button" onClick={saveProductOffer} className="bg-black text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-gray-800">
                                          {t('حفظ العرض', 'Save Offer')}
                                        </button>
                                        <button type="button" onClick={resetProductOfferForm} className="bg-[var(--lava-card)] border px-5 py-2 rounded-lg font-bold text-sm hover:bg-[var(--lava-secondary)]">
                                          {t('إلغاء', 'Cancel')}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 p-4 md:p-6 border-t bg-[var(--lava-secondary)]">
                        <button type="button" onClick={() => closeProductEditor(false)} className="bg-[var(--lava-card)] border px-4 py-2 rounded-lg font-bold text-sm">{t('إلغاء', 'Cancel')}</button>
                        <button type="submit" disabled={isSavingProduct} className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-lg font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                          {isSavingProduct ? t('جارٍ الحفظ...', 'Saving...') : (productManagerMode === 'add' ? t('إضافة المنتج', 'Add Product') : t('حفظ التغييرات', 'Save Changes'))}
                        </button>
                      </div>
                    </form>
                  );
                })()}
              </div>
            )}

            {/* ===== تبويب الأقسام ===== */}
            {adminTab === 'categories' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">{t('إدارة الأقسام', 'Category Management')}</h2>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if ((!newCatNameAr.trim() && !newCatNameEn.trim()) || !newCatImg) {
                    showToast(t('من فضلك املأ جميع الحقول', 'Please fill in all fields'));
                    return;
                  }
                  const updatedCategories = [...categories, { id: Date.now(), name: { ar: newCatNameAr.trim() || newCatNameEn.trim(), en: newCatNameEn.trim() || newCatNameAr.trim() }, image: newCatImg.trim() }];
                  setCategories(updatedCategories);
                  saveAdminSettings(t('تم حفظ الأقسام بنجاح', 'Categories saved successfully'), { categories: updatedCategories });
                  setNewCatNameAr('');
                  setNewCatNameEn('');
                  setNewCatImg('');
                  showToast(t('تم إضافة القسم بنجاح!', 'Category added!'));
                }} className="space-y-4 border-b pb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label={`${t('اسم القسم', 'Category Name')} (${t('عربي', 'Arabic')})`} type="text" value={newCatNameAr} onChange={(e) => setNewCatNameAr(e.target.value)} id="newCatNameAr" />
                    <InputField label={`${t('اسم القسم', 'Category Name')} (English)`} type="text" value={newCatNameEn} onChange={(e) => setNewCatNameEn(e.target.value)} id="newCatNameEn" />
                  </div>
                  <ImageUrlOrUploadField label={t('صورة القسم', 'Category Image')} value={newCatImg} onChange={(url) => setNewCatImg(url)} required={true} id="newCatImg" placeholder="https://..." showToast={showToast} t={t} />
                  <button type="submit" disabled={isSavingProduct} className="bg-black text-white px-6 py-2 rounded-lg font-bold disabled:opacity-60 disabled:cursor-not-allowed">{t('إضافة قسم', 'Add Category')}</button>
                </form>
                <div className="space-y-3 pt-4">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between bg-[var(--lava-secondary)] p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <img src={cat.image} alt="" className="w-12 h-12 object-cover rounded-md" />
                        <span className="font-bold text-lg">{getLocalized(cat.name)}</span>
                      </div>
                      <button onClick={() => { const updated = categories.filter(c => c.id !== cat.id); setCategories(updated); saveAdminSettings(t('تم حفظ الأقسام بنجاح', 'Categories saved successfully'), { categories: updated }); }} className="text-red-600 font-bold px-3 py-1 bg-red-50 rounded">{t('حذف', 'Delete')}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== تبويب الشحن ===== */}
            {adminTab === 'shipping' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">{t('إدارة الشحن والمحافظات', 'Shipping & Governorates')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-8">
                  <div>
                    <label className="block text-sm font-semibold mb-1">{t('حد الشحن المجاني (ج.م)', 'Free Shipping Threshold (EGP)')}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={adminSettings.current.freeShippingThreshold ?? 0}
                        onChange={(e) => { adminSettings.current.freeShippingThreshold = Number(e.target.value) || 0; bumpSettings(); }}
                        onBlur={() => saveAdminSettings(t('تم حفظ حد الشحن المجاني بنجاح', 'Free shipping threshold saved'))}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      />
                      <button
                        type="button"
                        onClick={() => saveAdminSettings(t('تم حفظ حد الشحن المجاني بنجاح', 'Free shipping threshold saved'))}
                        className="bg-black text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap"
                      >
                        {t('حفظ', 'Save')}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">↩️ {t('رسوم شحن الاسترجاع (ج.م)', 'Return Shipping Fee (EGP)')}</label>
                    <p className="text-xs text-[var(--lava-muted)] mb-1">{t(
                      'بتتخصم من مبلغ الاسترجاع تلقائيًا لو العميل اختار سبب "اختياري" زي مقاس مش مظبوط أو غيّر رأيه. لو السبب عيب في المنتج/غلط منا، الاسترجاع بيفضل مجاني.',
                      'Automatically deducted from the refund when the customer picks a "choice" reason like wrong size or changed mind. Free when the reason is a product defect or store mistake.'
                    )}</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        value={adminSettings.current.returnFeeAmount ?? 80}
                        onChange={(e) => { adminSettings.current.returnFeeAmount = Number(e.target.value) || 0; bumpSettings(); }}
                        onBlur={() => saveAdminSettings(t('تم حفظ رسوم الاسترجاع بنجاح', 'Return fee saved'))}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      />
                      <button
                        type="button"
                        onClick={() => saveAdminSettings(t('تم حفظ رسوم الاسترجاع بنجاح', 'Return fee saved'))}
                        className="bg-black text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap"
                      >
                        {t('حفظ', 'Save')}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-8">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold mb-1">🚚 {t('مدة التوصيل المعروضة للعميل (أيام عمل)', 'Delivery Time Shown to Customers (business days)')}</label>
                    <p className="text-xs text-[var(--lava-muted)] mb-2">{t(
                      'النص ده بيظهر للعميل في صفحة المنتج ("شحن سريع") - غيّره من هنا بدل ما يفضل رقم ثابت في الكود.',
                      'This text appears to customers on the product page ("Fast Shipping") - change it here instead of a hardcoded number.'
                    )}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-[var(--lava-muted)] mb-1">{t('من (يوم)', 'From (days)')}</label>
                        <input
                          type="number"
                          min="0"
                          value={adminSettings.current.shippingMinDays ?? 3}
                          onChange={(e) => { adminSettings.current.shippingMinDays = Number(e.target.value) || 0; bumpSettings(); }}
                          onBlur={() => saveAdminSettings(t('تم حفظ مدة التوصيل بنجاح', 'Delivery time saved'))}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>
                      <span className="text-[var(--lava-muted)] mt-5">{t('إلى', 'to')}</span>
                      <div className="flex-1">
                        <label className="block text-xs text-[var(--lava-muted)] mb-1">{t('إلى (يوم)', 'To (days)')}</label>
                        <input
                          type="number"
                          min="0"
                          value={adminSettings.current.shippingMaxDays ?? 5}
                          onChange={(e) => { adminSettings.current.shippingMaxDays = Number(e.target.value) || 0; bumpSettings(); }}
                          onBlur={() => saveAdminSettings(t('تم حفظ مدة التوصيل بنجاح', 'Delivery time saved'))}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => saveAdminSettings(t('تم حفظ مدة التوصيل بنجاح', 'Delivery time saved'))}
                        className="bg-black text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap mt-5"
                      >
                        {t('حفظ', 'Save')}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 pt-4 border-b pb-8">
                  <h3 className="font-bold text-lg">🔌 {t('تكاملات شركات الشحن', 'Shipping Integrations')}</h3>
                  <p className="text-sm text-[var(--lava-muted)]">{t('بيانات API نفسها توضع في .env الخاص بالباك اند. من هنا تتحكم في تفعيل الشركات والدول التي تظهر لها.', 'API credentials are configured in the backend .env. Use this section to enable providers and control their destination countries.')}</p>
                  {Object.values(shippingProviders).map(provider => {
                    const current = adminSettings.current.shippingIntegrations?.[provider.key] || { enabled: provider.enabled, countries: provider.countries || [], environment: provider.environment || 'sandbox' };
                    const currentEnv = current.environment || provider.environment || 'sandbox';
                    const isProduction = currentEnv === 'production';
                    // الـcapabilities الحقيقية جايه من الباك اند (services/shipping/
                    // capabilities.js) - مش افتراض إن كل الشركات بتدعم نفس العمليات.
                    const caps = provider.capabilities || {};
                    const capLabels = [
                      ['supportsTracking', t('تتبع', 'Tracking')],
                      ['supportsCancellation', t('إلغاء', 'Cancel')],
                      ['supportsLabels', t('بوليصة/AWB', 'Label/AWB')],
                      ['supportsCOD', t('الدفع عند الاستلام', 'COD')],
                      ['supportsPickup', t('استلام من المتجر', 'Pickup')],
                      ['supportsReturns', t('إرجاع', 'Return')],
                      ['supportsExchange', t('استبدال', 'Exchange')],
                      ['supportsWebhooks', t('Webhooks', 'Webhooks')],
                    ];
                    const connResult = shippingConnectionResults[provider.key];
                    // نصوص + ألوان واضحة لكل نتيجة Test Connection ممكنة من الباك اند.
                    const CONN_RESULT_META = {
                      CONNECTED: { label: t('متصل ✅', 'Connected ✅'), cls: 'bg-green-100 text-green-700' },
                      INVALID_CREDENTIALS: { label: t('بيانات دخول غير صحيحة', 'Invalid credentials'), cls: 'bg-red-100 text-red-700' },
                      AUTH_ERROR: { label: t('خطأ في التوثيق (Auth)', 'Authentication error'), cls: 'bg-red-100 text-red-700' },
                      API_ERROR: { label: t('خطأ في API الشركة', 'Carrier API error'), cls: 'bg-red-100 text-red-700' },
                      TIMEOUT: { label: t('انتهت المهلة (Timeout)', 'Timeout'), cls: 'bg-orange-100 text-orange-700' },
                      NOT_CONFIGURED: { label: t('لم يتم إدخال بيانات الاتصال', 'Not configured'), cls: 'bg-[var(--lava-secondary)] text-[var(--lava-muted)]' },
                    };
                    return <div key={provider.key} className="border rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div><b>{provider.name}</b><div className="text-xs text-[var(--lava-muted)]">{provider.configured ? 'API configured' : 'API credentials not configured'}</div></div>
                        <div className="flex items-center gap-2">
                          {/* زرار تجريبي/حقيقي: بيتحكم فعليًا في السيرفر اللي هيتبعتله الطلب (Sandbox أو Production)
                              زي شوبيفاي بالظبط — من غير ما تحتاج تلمس الكود أو الـ.env. */}
                          <div className="flex rounded-lg overflow-hidden border text-xs font-bold">
                            <button
                              type="button"
                              onClick={()=>{ adminSettings.current.shippingIntegrations={...(adminSettings.current.shippingIntegrations||{}),[provider.key]:{...current,environment:'sandbox'}}; bumpSettings(); }}
                              className={`px-3 py-2 ${!isProduction ? 'bg-yellow-400 text-black' : 'bg-[var(--lava-card)] text-[var(--lava-muted)]'}`}
                            >{t('تجريبي','Sandbox')}</button>
                            <button
                              type="button"
                              onClick={()=>{ adminSettings.current.shippingIntegrations={...(adminSettings.current.shippingIntegrations||{}),[provider.key]:{...current,environment:'production'}}; bumpSettings(); }}
                              className={`px-3 py-2 ${isProduction ? 'bg-green-600 text-white' : 'bg-[var(--lava-card)] text-[var(--lava-muted)]'}`}
                            >{t('حقيقي','Production')}</button>
                          </div>
                          <button
                            type="button"
                            disabled={testingProviderKey === provider.key}
                            onClick={async()=>{
                              setTestingProviderKey(provider.key);
                              // نصوص الـtoast لكل نتيجة اتصال ممكنة - نفس النصوص اللي بتتعرض
                              // تحت في الكارت بالظبط (CONN_RESULT_META)، عشان الأدمن يشوف
                              // الرسالة الصح فورًا وهو لسه واقف على الزرار، مش لازم ينزل
                              // يقرا تحت. أهم حاجة: مبقاش بيقول "تم الاتصال بنجاح" لأي نتيجة
                              // تانية غير CONNECTED فعليًا.
                              const TOAST_BY_RESULT = {
                                CONNECTED: t('تم الاتصال بنجاح ✅', 'Connection successful ✅'),
                                NOT_CONFIGURED: t('لم يتم إدخال بيانات الاتصال لهذه الشركة - من فضلك أدخل بياناتك أولاً', 'No connection details set for this carrier yet - please enter your credentials first'),
                                INVALID_CREDENTIALS: t('بيانات الدخول غير صحيحة - راجع البيانات المدخلة', 'Invalid credentials - please check what you entered'),
                                AUTH_ERROR: t('فشل التوثيق مع شركة الشحن - راجع بيانات الدخول', 'Authentication failed with the carrier - please check your credentials'),
                                API_ERROR: t('حدث خطأ من جهة شركة الشحن، حاول مرة أخرى لاحقًا', 'The carrier API returned an error - please try again later'),
                                TIMEOUT: t('انتهت مهلة الاتصال بشركة الشحن، حاول مرة أخرى', 'Connection to the carrier timed out - please try again'),
                              };
                              try {
                                const r = await shippingAPI.connect(provider.key);
                                const result = r?.connectionResult || 'CONNECTED';
                                setShippingConnectionResults(prev => ({ ...prev, [provider.key]: { result, message: null } }));
                                showToast(TOAST_BY_RESULT[result] || TOAST_BY_RESULT.API_ERROR);
                              } catch(e) {
                                const result = e?.data?.connectionResult || 'API_ERROR';
                                setShippingConnectionResults(prev => ({ ...prev, [provider.key]: { result, message: e.message } }));
                                showToast(e.message || t('فشل الاتصال','Connection failed'));
                              } finally {
                                setTestingProviderKey(null);
                              }
                            }}
                            className="px-3 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50"
                          >
                            {testingProviderKey === provider.key ? `⏳ ${t('جاري الاختبار...', 'Testing...')}` : t('اختبار الاتصال','Test Connection')}
                          </button>
                        </div>
                      </div>
                      {connResult && (
                        <div className={`text-xs font-bold rounded-lg px-3 py-2 ${CONN_RESULT_META[connResult.result]?.cls || 'bg-[var(--lava-secondary)] text-[var(--lava-muted)]'}`}>
                          {CONN_RESULT_META[connResult.result]?.label || connResult.result}
                          {connResult.message && <span className="font-normal opacity-80"> — {connResult.message}</span>}
                        </div>
                      )}
                      <div className={`text-xs font-bold rounded-lg px-3 py-2 ${isProduction ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {isProduction
                          ? t('وضع حقيقي: أي شحنة هتتعمل هتتبعت فعليًا لشركة الشحن.', 'Production mode: any shipment created here is sent to the real carrier.')
                          : t('وضع تجريبي: هتتبعت لسيرفر الاختبار بتاع الشركة، ومفيش أي شحنة حقيقية هتتعمل.', 'Sandbox mode: requests go to the carrier\'s test server, no real shipment is created.')}
                      </div>
                      {/* Capabilities حقيقية من الباك اند - أخضر = مدعوم فعليًا عبر الـofficial
                          API، رمادي = غير مدعوم. مفيش أي عملية بتتحط "مدعومة" هنا إلا لو
                          فعلاً متنفذة (شوف services/shipping/capabilities.js). */}
                      <div>
                        <div className="text-xs font-semibold text-[var(--lava-muted)] mb-1.5">{t('العمليات المدعومة (Capabilities)', 'Supported operations (Capabilities)')}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {capLabels.map(([key, label]) => (
                            <span key={key} className={`text-xs px-2 py-1 rounded-full font-bold ${caps[key] ? 'bg-blue-100 text-blue-700' : 'bg-[var(--lava-secondary)] text-[var(--lava-muted)] line-through'}`}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <label className="flex gap-2 items-center text-sm font-bold"><input type="checkbox" checked={current.enabled !== false} onChange={e=>{ adminSettings.current.shippingIntegrations={...(adminSettings.current.shippingIntegrations||{}),[provider.key]:{...current,enabled:e.target.checked}}; bumpSettings(); }} /> {t('تفعيل الشركة','Enable provider')}</label>
                      <div><div className="text-sm font-semibold mb-2">{t('الدول المتاحة (اتركها فارغة لو كل الدول التي تدعمها الشركة)','Destination countries (leave empty for all supported countries)')}</div><div className="flex flex-wrap gap-2">{countries.map(c=><label key={c.id} className="text-xs border rounded-full px-3 py-1 flex gap-1 items-center"><input type="checkbox" checked={(current.countries||[]).includes(c.code)} onChange={e=>{ const arr=new Set(current.countries||[]); e.target.checked?arr.add(c.code):arr.delete(c.code); adminSettings.current.shippingIntegrations={...(adminSettings.current.shippingIntegrations||{}),[provider.key]:{...current,countries:[...arr]}}; bumpSettings(); }} /> {getLocalized(c.name)}</label>)}</div></div>
                      {provider.mode === 'manual_rate' && (
                        <div>
                          <div className="text-sm font-semibold mb-2">{t('سعر الشحن لكل محافظة (اتركها فارغة لاستخدام سعر موحّد لكل مصر)', 'Per-governorate shipping price (leave blank to use one flat price for all of Egypt)')}</div>
                          <div className="mb-2">
                            <label className="text-xs text-[var(--lava-muted)]">{t('السعر الموحّد الافتراضي', 'Flat default price')}</label>
                            <input type="number" value={current.defaultRate ?? ''} onChange={e=>{ adminSettings.current.shippingIntegrations={...(adminSettings.current.shippingIntegrations||{}),[provider.key]:{...current,defaultRate:Number(e.target.value)||0}}; bumpSettings(); }} className="ms-2 w-32 px-3 py-1.5 border rounded-lg" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg bg-[var(--lava-card)]">
                            {EGYPT_GOVERNORATES.map(g => (
                              <div key={g.ar} className="flex items-center justify-between gap-2 text-xs">
                                <span>{language === 'ar' ? g.ar : g.en}</span>
                                <input
                                  type="number"
                                  value={current.governorateRates?.[g.ar] ?? ''}
                                  onChange={e=>{ const rates={...(current.governorateRates||{})}; if(e.target.value===''){delete rates[g.ar];}else{rates[g.ar]=Number(e.target.value)||0;} adminSettings.current.shippingIntegrations={...(adminSettings.current.shippingIntegrations||{}),[provider.key]:{...current,governorateRates:rates}}; bumpSettings(); }}
                                  className="w-20 px-2 py-1 border rounded"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <button type="button" onClick={()=>saveAdminSettings(t('تم حفظ إعدادات شركات الشحن','Shipping integration settings saved'))} className="px-4 py-2 rounded-lg border font-bold">{t('حفظ إعدادات الشحن','Save shipping settings')}</button>
                    </div>
                  })}
                </div>
                <div className="space-y-4 pt-4">
                  <h3 className="font-bold text-lg">{t('المحافظات وأسعارها', 'Governorates & Rates')}</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if ((!newGovNameAr.trim() && !newGovNameEn.trim()) || !newGovCost) {
                      showToast(t('من فضلك املأ جميع الحقول', 'Please fill in all fields'));
                      return;
                    }
                    const updatedGovernorates = [...governorates, { id: Date.now(), name: { ar: newGovNameAr.trim() || newGovNameEn.trim(), en: newGovNameEn.trim() || newGovNameAr.trim() }, cost: Number(newGovCost), countryId: newGovCountryId || null }];
                    setGovernorates(updatedGovernorates);
                    saveAdminSettings(t('تم حفظ المحافظات بنجاح', 'Governorates saved successfully'), { governorates: updatedGovernorates });
                    setNewGovNameAr('');
                    setNewGovNameEn('');
                    setNewGovCost('');
                    setNewGovCountryId('');
                    showToast(t('تم إضافة المحافظة بنجاح!', 'Governorate added!'));
                  }} className="flex flex-wrap gap-4">
                    <input type="text" value={newGovNameAr} onChange={(e) => setNewGovNameAr(e.target.value)} placeholder={`${t('اسم المحافظة', 'Governorate Name')} (${t('عربي', 'Arabic')})`} className="px-4 py-2 border rounded-lg flex-1 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-black" />
                    <input type="text" value={newGovNameEn} onChange={(e) => setNewGovNameEn(e.target.value)} placeholder="Governorate Name (English)" className="px-4 py-2 border rounded-lg flex-1 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-black" />
                    <input type="number" value={newGovCost} onChange={(e) => setNewGovCost(e.target.value)} placeholder={t('سعر الشحن', 'Shipping Cost')} className="px-4 py-2 border rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-black" required />
                    {countries.length > 0 && (
                      <select value={newGovCountryId} onChange={(e) => setNewGovCountryId(e.target.value)} className="px-4 py-2 border rounded-lg flex-1 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-black">
                        <option value="">{t('-- اختر الدولة (اختياري) --', '-- Select Country (optional) --')}</option>
                        {countries.map(c => (
                          <option key={c.id} value={String(c.id)}>{getLocalized(c.name)}</option>
                        ))}
                      </select>
                    )}
                    <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold">{t('إضافة', 'Add')}</button>
                  </form>
                  <div className="space-y-2 pt-2">
                    {countries.length > 0 ? (
                      countries.map(c => {
                        const countryGovs = governorates.filter(g => String(g.countryId) === String(c.id));
                        const unassignedGovs = governorates.filter(g => !g.countryId);
                        return (
                          <div key={c.id} className="mb-4">
                            <h4 className="font-bold text-base mb-2 text-blue-700">🌍 {getLocalized(c.name)}</h4>
                            {countryGovs.length === 0 ? (
                              <p className="text-[var(--lava-muted)] text-sm ps-2">{t('لا توجد محافظات لهذه الدولة بعد', 'No governorates added for this country yet')}</p>
                            ) : (
                              countryGovs.map(g => (
                                <div key={g.id} className="flex justify-between items-center bg-[var(--lava-secondary)] p-3 rounded border mb-1 ms-4">
                                  <span className="font-semibold">{getLocalized(g.name)}</span>
                                  <div className="flex items-center gap-4">
                                    <span className="font-bold text-blue-600">{g.cost} {t('ج.م', 'EGP')}</span>
                                    <button onClick={() => { const updated = governorates.filter(x => x.id !== g.id); setGovernorates(updated); saveAdminSettings(t('تم حفظ المحافظات بنجاح', 'Governorates saved successfully'), { governorates: updated }); }} className="text-red-600 font-bold text-sm">{t('حذف', 'Delete')}</button>
                                  </div>
                                </div>
                              ))
                            )}
                            {c === countries[countries.length - 1] && unassignedGovs.length > 0 && (
                              <div className="mt-3">
                                <h4 className="font-bold text-base mb-2 text-[var(--lava-muted)]">🗂️ {t('محافظات غير مرتبطة بدولة', 'Unassigned Governorates')}</h4>
                                {unassignedGovs.map(g => (
                                  <div key={g.id} className="flex justify-between items-center bg-[var(--lava-secondary)] p-3 rounded border mb-1 ms-4">
                                    <span className="font-semibold">{getLocalized(g.name)}</span>
                                    <div className="flex items-center gap-4">
                                      <span className="font-bold text-blue-600">{g.cost} {t('ج.م', 'EGP')}</span>
                                      <button onClick={() => { const updated = governorates.filter(x => x.id !== g.id); setGovernorates(updated); saveAdminSettings(t('تم حفظ المحافظات بنجاح', 'Governorates saved successfully'), { governorates: updated }); }} className="text-red-600 font-bold text-sm">{t('حذف', 'Delete')}</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      governorates.map(g => (
                        <div key={g.id} className="flex justify-between items-center bg-[var(--lava-secondary)] p-3 rounded border">
                          <span className="font-semibold">{getLocalized(g.name)}</span>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-blue-600">{g.cost} {t('ج.م', 'EGP')}</span>
                            <button onClick={() => { const updated = governorates.filter(x => x.id !== g.id); setGovernorates(updated); saveAdminSettings(t('تم حفظ المحافظات بنجاح', 'Governorates saved successfully'), { governorates: updated }); }} className="text-red-600 font-bold text-sm">{t('حذف', 'Delete')}</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===== تبويب تحسين محركات البحث (SEO) ===== */}
            {adminTab === 'seo_settings' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-7">
                <div>
                  <h2 className="text-2xl font-bold">🔎 {t('تحسين محركات البحث (SEO)', 'Search Engine Optimization (SEO)')}</h2>
                  <p className="text-sm text-[var(--lava-muted)] mt-2">{t('الإعدادات دي بتتحكم في شكل ظهور متجرك في نتائج بحث جوجل ومشاركاته على السوشيال ميديا.', 'These settings control how your store appears in Google search results and when shared on social media.')}</p>
                </div>

                <div className="space-y-4 border-b pb-6">
                  <h3 className="text-lg font-extrabold">{t('العنوان والوصف الأساسي للمتجر', 'Store Title & Meta Description')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                      label={`${t('عنوان الميتا', 'Meta Title')} (${t('عربي', 'Arabic')})`}
                      value={adminSettings.current.seo?.metaTitle?.ar || ''}
                      onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), metaTitle: { ...(adminSettings.current.seo?.metaTitle || {}), ar: e.target.value } }; bumpSettings(); }}
                      id="seoMetaTitleAr"
                      placeholder={t('اسم المتجر - أفضل تشكيلة أونلاين', 'Store Name - Best selection online')}
                    />
                    <InputField
                      label="Meta Title (English)"
                      value={adminSettings.current.seo?.metaTitle?.en || ''}
                      onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), metaTitle: { ...(adminSettings.current.seo?.metaTitle || {}), en: e.target.value } }; bumpSettings(); }}
                      id="seoMetaTitleEn"
                      placeholder="Store Name - Best selection online"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextareaField
                      label={`${t('وصف الميتا', 'Meta Description')} (${t('عربي', 'Arabic')})`}
                      value={adminSettings.current.seo?.metaDescription?.ar || ''}
                      onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), metaDescription: { ...(adminSettings.current.seo?.metaDescription || {}), ar: e.target.value } }; bumpSettings(); }}
                      rows={2}
                      id="seoMetaDescAr"
                    />
                    <TextareaField
                      label="Meta Description (English)"
                      value={adminSettings.current.seo?.metaDescription?.en || ''}
                      onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), metaDescription: { ...(adminSettings.current.seo?.metaDescription || {}), en: e.target.value } }; bumpSettings(); }}
                      rows={2}
                      id="seoMetaDescEn"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                      label={`${t('كلمات مفتاحية', 'Meta Keywords')} (${t('عربي', 'Arabic')})`}
                      value={adminSettings.current.seo?.keywords?.ar || ''}
                      onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), keywords: { ...(adminSettings.current.seo?.keywords || {}), ar: e.target.value } }; bumpSettings(); }}
                      id="seoKeywordsAr"
                      placeholder={t('متجر, أونلاين, أزياء', 'store, online, fashion')}
                    />
                    <InputField
                      label="Meta Keywords (English)"
                      value={adminSettings.current.seo?.keywords?.en || ''}
                      onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), keywords: { ...(adminSettings.current.seo?.keywords || {}), en: e.target.value } }; bumpSettings(); }}
                      id="seoKeywordsEn"
                      placeholder="store, online, fashion"
                    />
                  </div>
                </div>

                <div className="space-y-4 border-b pb-6">
                  <h3 className="text-lg font-extrabold">{t('روابط ومشاركة', 'Sharing & Links')}</h3>
                  <InputField
                    label={t('رابط الموقع الأساسي (Canonical Domain)', 'Canonical Site URL')}
                    value={adminSettings.current.seo?.canonicalBaseUrl || ''}
                    onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), canonicalBaseUrl: e.target.value }; bumpSettings(); }}
                    id="seoCanonicalUrl"
                    placeholder="https://www.yourstore.com"
                  />
                  <p className="text-xs text-[var(--lava-muted)]">{t('نفس الرابط اللي متظبط في FRONTEND_URL على السيرفر، بيتحط تلقائياً في sitemap.xml و robots.txt.', 'Same URL configured as FRONTEND_URL on the server; used automatically in sitemap.xml and robots.txt.')}</p>
                  <InputField
                    label={t('صورة المشاركة الافتراضية (Open Graph Image)', 'Default Social Share Image (OG Image)')}
                    value={adminSettings.current.seo?.ogImage || ''}
                    onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), ogImage: e.target.value }; bumpSettings(); }}
                    id="seoOgImage"
                    placeholder="https://.../og-image.jpg"
                  />
                  <p className="text-xs text-[var(--lava-muted)]">{t('الصورة اللي هتظهر لو حد شارك رابط متجرك على فيسبوك أو واتساب أو تويتر (المفضّل مقاس 1200×630).', 'The image shown when your store link is shared on Facebook, WhatsApp, or Twitter (recommended size 1200×630).')}</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold">{t('أدوات مالكي المواقع (Search Console)', 'Webmaster Verification')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                      label={t('كود تحقق Google Search Console', 'Google Search Console Verification')}
                      value={adminSettings.current.seo?.googleSiteVerification || ''}
                      onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), googleSiteVerification: e.target.value }; bumpSettings(); }}
                      id="seoGoogleVerification"
                      placeholder={t('الكود بس، من دون علامة <meta>', 'Just the content code, no <meta> tag')}
                    />
                    <InputField
                      label={t('كود تحقق Bing Webmaster', 'Bing Webmaster Verification')}
                      value={adminSettings.current.seo?.bingSiteVerification || ''}
                      onChange={(e) => { adminSettings.current.seo = { ...(adminSettings.current.seo || {}), bingSiteVerification: e.target.value }; bumpSettings(); }}
                      id="seoBingVerification"
                    />
                  </div>
                  <p className="text-xs text-[var(--lava-muted)]">
                    {t('sitemap.xml و robots.txt شغالين تلقائياً من السيرفر (', 'sitemap.xml and robots.txt are generated automatically by the server (')}
                    <code className="bg-[var(--lava-secondary)] px-1 rounded">/sitemap.xml</code>{' , '}<code className="bg-[var(--lava-secondary)] px-1 rounded">/robots.txt</code>
                    {t(') — ضيف الرابط ده في Google Search Console.', ') — submit this URL in Google Search Console.')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => saveAdminSettings(t('تم حفظ إعدادات SEO بنجاح', 'SEO settings saved successfully'))}
                  className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition"
                >
                  {t('حفظ إعدادات SEO', 'Save SEO Settings')}
                </button>
              </div>
            )}

            {/* ===== تبويب تسجيل الدخول والأمان ===== */}
            {adminTab === 'auth_settings' && canAccess('auth_settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-7">
                <div>
                  <h2 className="text-2xl font-bold">🔐 {t('تسجيل الدخول والأمان', 'Login & Security')}</h2>
                  <p className="text-sm text-[var(--lava-muted)] mt-2">{t('اختار طريقة دخول العملاء. الأدمن والموظفين دائماً يدخلوا بالإيميل والباسورد.', 'Choose how customers sign in. Admins and staff always use email + password.')}</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <button type="button" onClick={() => setAdminAuthConfig(c => ({ ...c, customerLoginMethod: 'email_password' }))} className={`text-right p-5 rounded-xl border-2 transition ${adminAuthConfig.customerLoginMethod === 'email_password' ? 'border-black bg-[var(--lava-secondary)]' : 'border-[var(--lava-border)]'}`}>
                    <div className="font-extrabold">📧 {t('إيميل + باسورد', 'Email + Password')}</div>
                    <div className="text-sm text-[var(--lava-muted)] mt-1">{t('العميل ينشئ حساباً بالباسورد ويسجل به.', 'Customers create an account with a password.')}</div>
                  </button>
                  <button type="button" onClick={() => setAdminAuthConfig(c => ({ ...c, customerLoginMethod: 'email_code' }))} className={`text-right p-5 rounded-xl border-2 transition ${adminAuthConfig.customerLoginMethod === 'email_code' ? 'border-black bg-[var(--lava-secondary)]' : 'border-[var(--lava-border)]'}`}>
                    <div className="font-extrabold">🔢 {t('إيميل + كود', 'Email + Code')}</div>
                    <div className="text-sm text-[var(--lava-muted)] mt-1">{t('العميل يكتب الإيميل، يستلم كود من Resend، والحساب يتعمل تلقائياً لو جديد.', 'Customers receive a Resend code and a new account is created automatically.')}</div>
                  </button>
                </div>
                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-lg font-extrabold">📨 {t('شركة إرسال رسايل الكود (OTP)', 'OTP Email Provider')}</h3>
                  <p className="text-sm text-[var(--lava-muted)]">{t('اختار الشركة اللي هتبعت بيها رسايل الكود (تسجيل الدخول / إعادة تعيين الباسورد / تأكيد تعديل بيانات الأدمن). رسايل تأكيد الطلب والماركتينج بتفضل زي ما هي بتتبعت بـ Brevo دايماً.', 'Choose which provider sends OTP emails (login codes, password reset, admin confirmation). Order confirmation and marketing emails keep using Brevo as before.')}</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <button type="button" onClick={() => setAdminAuthConfig(c => ({ ...c, otpEmailProvider: 'resend' }))} className={`text-right p-5 rounded-xl border-2 transition ${adminAuthConfig.otpEmailProvider === 'resend' ? 'border-black bg-[var(--lava-secondary)]' : 'border-[var(--lava-border)]'}`}>
                      <div className="font-extrabold">🟢 Resend</div>
                      <div className="text-sm text-[var(--lava-muted)] mt-1">{t('إرسال رسايل الكود عن طريق Resend.', 'Send OTP emails via Resend.')}</div>
                    </button>
                    <button type="button" onClick={() => setAdminAuthConfig(c => ({ ...c, otpEmailProvider: 'brevo' }))} className={`text-right p-5 rounded-xl border-2 transition ${adminAuthConfig.otpEmailProvider === 'brevo' ? 'border-black bg-[var(--lava-secondary)]' : 'border-[var(--lava-border)]'}`}>
                      <div className="font-extrabold">🔵 Brevo</div>
                      <div className="text-sm text-[var(--lava-muted)] mt-1">{t('إرسال رسايل الكود عن طريق Brevo.', 'Send OTP emails via Brevo.')}</div>
                    </button>
                  </div>
                  {adminAuthConfig.otpEmailProvider === 'brevo' ? (
                    <div className={`p-3 rounded-lg text-sm ${adminAuthConfig.brevoConfigured ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {adminAuthConfig.brevoConfigured ? t('بيانات Brevo موجودة على السيرفر.', 'Brevo credentials are configured on the server.') : t('أضف BREVO_API_KEY و BREVO_FROM_EMAIL في .env على السيرفر قبل تفعيل الدخول بالكود عن طريق Brevo.', 'Add BREVO_API_KEY and BREVO_FROM_EMAIL to the server .env before enabling code login via Brevo.')}
                    </div>
                  ) : (
                    <div className={`p-3 rounded-lg text-sm ${adminAuthConfig.resendConfigured ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {adminAuthConfig.resendConfigured ? t('Resend API Key موجود على السيرفر.', 'Resend API Key is configured on the server.') : t('أضف RESEND_API_KEY في .env على السيرفر قبل تفعيل الدخول بالكود.', 'Add RESEND_API_KEY to the server .env before enabling code login.')}
                    </div>
                  )}
                  <InputField label={t('إيميل الإرسال (Resend)', 'Sender Email (Resend)')} type="email" value={adminAuthConfig.resendFromEmail} onChange={(e) => setAdminAuthConfig(c => ({ ...c, resendFromEmail: e.target.value }))} id="resendFromEmail" placeholder="onboarding@resend.dev" />
                  <p className="text-xs text-[var(--lava-muted)]">{t('أثناء التجربة استخدم onboarding@resend.dev. بعد توثيق الدومين في Resend غيّر الإيميل هنا إلى إيميل الدومين. (الحقل ده خاص بـ Resend فقط، إيميل إرسال Brevo بيتضبط من .env على السيرفر).', 'Use onboarding@resend.dev for testing. After verifying your domain in Resend, change this to your domain sender. (This field is Resend-only — the Brevo sender email is set via the server .env.)')}</p>
                </div>
                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-lg font-extrabold">👤 {t('بيانات دخول الأدمن', 'Admin Login')}</h3>
                  <InputField label={t('إيميل الأدمن', 'Admin Email')} type="email" value={adminAuthConfig.adminEmail} onChange={(e) => setAdminAuthConfig(c => ({ ...c, adminEmail: e.target.value }))} id="adminAuthEmail" />
                  <InputField label={t('رقم هاتف الأدمن', 'Admin Phone')} type="tel" value={adminAuthConfig.adminPhone} onChange={(e) => setAdminAuthConfig(c => ({ ...c, adminPhone: e.target.value }))} id="adminAuthPhone" />
                  <InputField label={t('باسورد جديد (اختياري)', 'New Password (optional)')} type="password" value={adminAuthConfig.adminPassword} onChange={(e) => setAdminAuthConfig(c => ({ ...c, adminPassword: e.target.value }))} id="adminAuthPassword" placeholder={t('سيبها فاضية لو مش عايز تغيّره', 'Leave empty to keep current password')} />

                  <div className="bg-[var(--lava-secondary)] border rounded-xl p-4 space-y-3">
                    <p className="text-sm text-[var(--lava-muted)]">{t('تعديل الإيميل أو الباسورد أو الهاتف محتاج كود تأكيد يتبعت على إيميلك الحالي أولاً.', 'Changing the email, password, or phone requires a confirmation code sent to your current email first.')}</p>
                    <div className="flex items-center gap-3">
                      <button type="button" disabled={adminOtpCooldown > 0 || adminOtpSending} onClick={handleSendAdminOtp} className="bg-[var(--lava-card)] border border-black text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[var(--lava-secondary)] transition disabled:opacity-50 disabled:cursor-not-allowed">
                        {adminOtpSending ? t('جاري الإرسال...', 'Sending...') : adminOtpCooldown > 0 ? `${adminOtpCooldown}s` : adminOtpSent ? t('إرسال كود جديد', 'Resend code') : t('إرسال كود التأكيد', 'Send confirmation code')}
                      </button>
                      {adminOtpSent && adminOtpSentTo && (
                        <span className="text-xs text-[var(--lava-muted)]">{t(`اتبعت على ${adminOtpSentTo}`, `Sent to ${adminOtpSentTo}`)}</span>
                      )}
                    </div>
                    {adminOtpSent && (
                      <InputField label={t('كود التأكيد', 'Confirmation Code')} type="text" inputMode="numeric" maxLength={6} value={adminOtpCode} onChange={(e) => setAdminOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} id="adminSecurityOtp" />
                    )}
                  </div>
                </div>
                <button type="button" onClick={async () => {
                  try {
                    const result = await authAPI.updateAdminConfig({ ...adminAuthConfig, otpCode: adminOtpCode });
                    setAdminAuthConfig(c => ({ ...c, adminPassword: '', adminEmail: result.admin?.email || c.adminEmail, adminPhone: result.admin?.phone || c.adminPhone, otpEmailProvider: result.otpEmailProvider === 'brevo' ? 'brevo' : 'resend', resendConfigured: Boolean(result.resendConfigured), brevoConfigured: Boolean(result.brevoConfigured) }));
                    setAdminOtpCode('');
                    setAdminOtpSent(false);
                    setAdminOtpSentTo('');
                    adminSettings.current.customerLoginMethod = result.customerLoginMethod;
                    adminSettings.current.resendFromEmail = result.resendFromEmail;
                    adminSettings.current.otpEmailProvider = result.otpEmailProvider;
                    bumpSettings();
                    showToast(t('تم حفظ إعدادات تسجيل الدخول والأمان بنجاح.', 'Login and security settings saved successfully.'));
                  } catch (err) {
                    showToast(err?.response?.data?.message || err?.message || t('تعذر حفظ الإعدادات.', 'Could not save settings.'));
                  }
                }} className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition">{t('حفظ إعدادات الأمان', 'Save Security Settings')}</button>
              </div>
            )}


            {/* ===== تبويب إعدادات التشيك اوت ===== */}
            {adminTab === 'checkout_settings'  && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">⚙️ {t('إعدادات التشيك اوت', 'Checkout Settings')}</h2>
                <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showZip" checked={adminSettings.current.showZipCode} onChange={(e) => { adminSettings.current.showZipCode = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showZip" className="font-bold text-lg cursor-pointer">{t('إظهار حقل الرمز البريدي (ZIP Code)', 'Show ZIP Code field')}</label>
                  </div>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showCountry" checked={adminSettings.current.showCountry} onChange={(e) => { adminSettings.current.showCountry = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showCountry" className="font-bold text-lg cursor-pointer">{t('إظهار حقل الدولة', 'Show Country field')}</label>
                  </div>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showPhone2" checked={adminSettings.current.showPhone2} onChange={(e) => { adminSettings.current.showPhone2 = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showPhone2" className="font-bold text-lg cursor-pointer">{t('إظهار حقل رقم الهاتف الإضافي', 'Show additional phone field')}</label>
                  </div>
                  {adminSettings.current.showPhone2 && (
                    <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border me-8">
                      <input type="checkbox" id="requiredPhone2" checked={adminSettings.current.requiredPhone2} onChange={(e) => { adminSettings.current.requiredPhone2 = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                      <label htmlFor="requiredPhone2" className="font-bold text-lg cursor-pointer">{t('جعل رقم الهاتف الإضافي إجباري', 'Make additional phone required')}</label>
                    </div>
                  )}
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showCheckoutNotes" checked={adminSettings.current.showCheckoutNotes} onChange={(e) => { adminSettings.current.showCheckoutNotes = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showCheckoutNotes" className="font-bold text-lg cursor-pointer">{t('إظهار حقل "ملاحظات إضافية" في التشيك اوت', 'Show "Additional Notes" in checkout')}</label>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h3 className="text-xl font-bold mb-4">🌍 {t('إدارة الدول', 'Manage Countries')}</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const nameAr = prompt(t('ادخل اسم الدولة بالعربية:', 'Enter country name in Arabic:'));
                    const nameEn = prompt(t('ادخل اسم الدولة بالإنجليزية:', 'Enter country name in English:'));
                    if (nameAr || nameEn) {
                      const updatedCountries = [...countries, { id: Date.now(), name: { ar: nameAr || nameEn, en: nameEn || nameAr }, code: (nameEn || nameAr).substring(0, 2).toUpperCase() }];
                      setCountries(updatedCountries);
                      saveAdminSettings(t('تم حفظ الدول بنجاح', 'Countries saved successfully'), { countries: updatedCountries });
                    }
                  }} className="mb-4">
                    <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold">{t('إضافة دولة جديدة', 'Add New Country')}</button>
                  </form>
                  <div className="space-y-2">
                    {countries.map(c => (
                      <div key={c.id} className="flex justify-between items-center bg-[var(--lava-secondary)] p-3 rounded border">
                        <span className="font-semibold">{getLocalized(c.name)} ({c.code})</span>
                        <button onClick={() => { const updated = countries.filter(x => x.id !== c.id); setCountries(updated); saveAdminSettings(t('تم حفظ الدول بنجاح', 'Countries saved successfully'), { countries: updated }); }} className="text-red-600 font-bold text-sm">{t('حذف', 'Delete')}</button>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => saveAdminSettings()} className="bg-black text-white px-8 py-3 rounded-lg font-bold mt-4">{t('حفظ الإعدادات', 'Save Settings')}</button>
              </div>
            )}

            {/* ===== تبويب إعدادات الدفع ===== */}
            {adminTab === 'payment_settings' && canAccess('settings') && (
              <div className="space-y-6">
                <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">💳 {t('إعدادات الدفع', 'Payment Settings')}</h2>
                    <p className="text-sm text-[var(--lava-muted)] mt-1">{t('من هنا تتحكم في كل طرق الدفع التي تظهر للعميل في صفحة التشيك اوت.', 'Control every payment method shown to customers at checkout from one place.')}</p>
                  </div>

                  {/* Kashier */}
                  <div className={`rounded-xl border-2 p-5 ${adminSettings.current.paymentSettings?.kashierEnabled ? 'border-green-200 bg-green-50/40' : 'border-[var(--lava-border)] bg-[var(--lava-secondary)]'}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="text-xl font-extrabold">💳 Kashier</h3>
                        <p className="text-sm text-[var(--lava-muted)] mt-1">{t('الدفع بالفيزا والمحافظ من خلال صفحة الدفع المستضافة من Kashier.', 'Card and wallet payments through Kashier hosted checkout.')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {kashierAdminStatusLoading ? (
                          <span className="text-sm font-bold text-[var(--lava-muted)]">⏳ {t('جاري الفحص...', 'Checking...')}</span>
                        ) : kashierAdminStatus?.connected ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 text-sm font-bold">● {t('متصل', 'Connected')}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 text-sm font-bold">● {t('غير متصل', 'Not connected')}</span>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            setKashierAdminStatusLoading(true);
                            try { setKashierAdminStatus(await paymentsAPI.getKashierStatus()); }
                            catch (e) { setKashierAdminStatus({ connected: false, configured: false, error: e?.message }); }
                            finally { setKashierAdminStatusLoading(false); }
                          }}
                          className="px-3 py-1.5 rounded-lg border bg-[var(--lava-card)] text-sm font-bold hover:bg-[var(--lava-secondary)]"
                        >
                          🔄 {t('فحص', 'Check')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 flex-wrap bg-[var(--lava-card)] p-4 rounded-lg border">
                      <div>
                        <p className="font-bold">{t('تفعيل Kashier في التشيك اوت', 'Enable Kashier at checkout')}</p>
                        <p className="text-xs text-[var(--lava-muted)] mt-1">{t('لو مقفول، طريقة Kashier لن تظهر للعميل حتى لو المفاتيح موجودة في .env.', 'When disabled, Kashier will not appear even if the .env credentials are present.')}</p>
                      </div>
                      <label className="inline-flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adminSettings.current.paymentSettings?.kashierEnabled === true}
                          onChange={(e) => {
                            const next = { ...(adminSettings.current.paymentSettings || {}), kashierEnabled: e.target.checked };
                            adminSettings.current.paymentSettings = next;
                            bumpSettings();
                            saveAdminSettings(t('تم تحديث إعداد Kashier', 'Kashier setting updated'), { paymentSettings: next });
                          }}
                          className="w-5 h-5"
                        />
                        <span className="font-extrabold">{adminSettings.current.paymentSettings?.kashierEnabled ? t('مفعّل', 'Enabled') : t('موقوف', 'Disabled')}</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
                      <div className="bg-[var(--lava-card)] rounded-lg border p-3"><span className="text-[var(--lava-muted)]">MID</span><div className="font-bold mt-1">{kashierAdminStatus?.configured ? '••••••••' : '—'}</div></div>
                      <div className="bg-[var(--lava-card)] rounded-lg border p-3"><span className="text-[var(--lava-muted)]">{t('الوضع', 'Mode')}</span><div className="font-bold mt-1 uppercase">{kashierAdminStatus?.mode || '—'}</div></div>
                      <div className="bg-[var(--lava-card)] rounded-lg border p-3"><span className="text-[var(--lava-muted)]">{t('العملة', 'Currency')}</span><div className="font-bold mt-1">{kashierAdminStatus?.currency || 'EGP'}</div></div>
                    </div>
                    {!kashierAdminStatus?.configured && !kashierAdminStatusLoading && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        ⚠️ {t('أضف KASHIER_MID و KASHIER_API_KEY و KASHIER_SECRET_KEY في .env على السيرفر ثم أعد تشغيل السيرفر.', 'Add KASHIER_MID, KASHIER_API_KEY and KASHIER_SECRET_KEY to the server .env, then restart the server.')}
                      </div>
                    )}
                  </div>

                  {/* Paymob */}
                  <div className={`rounded-xl border-2 p-5 ${adminSettings.current.paymentSettings?.paymobEnabled ? 'border-green-200 bg-green-50/40' : 'border-[var(--lava-border)] bg-[var(--lava-secondary)]'}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="text-xl font-extrabold">💳 Paymob</h3>
                        <p className="text-sm text-[var(--lava-muted)] mt-1">{t('الدفع بالفيزا والمحافظ من خلال صفحة الدفع المستضافة من Paymob.', 'Card and wallet payments through Paymob hosted checkout.')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {paymobAdminStatusLoading ? (
                          <span className="text-sm font-bold text-[var(--lava-muted)]">⏳ {t('جاري الفحص...', 'Checking...')}</span>
                        ) : paymobAdminStatus?.connected ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 text-sm font-bold">● {t('متصل', 'Connected')}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 text-sm font-bold">● {t('غير متصل', 'Not connected')}</span>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            setPaymobAdminStatusLoading(true);
                            try { setPaymobAdminStatus(await paymentsAPI.getPaymobStatus()); }
                            catch (e) { setPaymobAdminStatus({ connected: false, configured: false, error: e?.message }); }
                            finally { setPaymobAdminStatusLoading(false); }
                          }}
                          className="px-3 py-1.5 rounded-lg border bg-[var(--lava-card)] text-sm font-bold hover:bg-[var(--lava-secondary)]"
                        >
                          🔄 {t('فحص', 'Check')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 flex-wrap bg-[var(--lava-card)] p-4 rounded-lg border">
                      <div>
                        <p className="font-bold">{t('تفعيل Paymob في التشيك اوت', 'Enable Paymob at checkout')}</p>
                        <p className="text-xs text-[var(--lava-muted)] mt-1">{t('لو مقفول، طريقة Paymob لن تظهر للعميل حتى لو المفاتيح موجودة في .env.', 'When disabled, Paymob will not appear even if the .env credentials are present.')}</p>
                      </div>
                      <label className="inline-flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adminSettings.current.paymentSettings?.paymobEnabled === true}
                          onChange={(e) => {
                            const next = { ...(adminSettings.current.paymentSettings || {}), paymobEnabled: e.target.checked };
                            adminSettings.current.paymentSettings = next;
                            bumpSettings();
                            saveAdminSettings(t('تم تحديث إعداد Paymob', 'Paymob setting updated'), { paymentSettings: next });
                          }}
                          className="w-5 h-5"
                        />
                        <span className="font-extrabold">{adminSettings.current.paymentSettings?.paymobEnabled ? t('مفعّل', 'Enabled') : t('موقوف', 'Disabled')}</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
                      <div className="bg-[var(--lava-card)] rounded-lg border p-3"><span className="text-[var(--lava-muted)]">{t('الحالة', 'Status')}</span><div className="font-bold mt-1">{paymobAdminStatus?.configured ? '••••••••' : '—'}</div></div>
                      <div className="bg-[var(--lava-card)] rounded-lg border p-3"><span className="text-[var(--lava-muted)]">{t('العملة', 'Currency')}</span><div className="font-bold mt-1">{paymobAdminStatus?.currency || 'EGP'}</div></div>
                    </div>
                    {!paymobAdminStatus?.configured && !paymobAdminStatusLoading && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        ⚠️ {t('أضف PAYMOB_SECRET_KEY و PAYMOB_PUBLIC_KEY و PAYMOB_INTEGRATION_ID و PAYMOB_HMAC_SECRET في .env على السيرفر ثم أعد تشغيل السيرفر.', 'Add PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY, PAYMOB_INTEGRATION_ID and PAYMOB_HMAC_SECRET to the server .env, then restart the server.')}
                      </div>
                    )}
                  </div>

                  {/* مهلة انتظار الدفع الإلكتروني — لو العميل دخل صفحة Kashier/Paymob وماكملش
                      (رجع بالسهم لورا، قفل التاب...) الطلب بيفضل "قيد الانتظار" والمخزون محجوز
                      لحد ما المهلة دي تخلص، وقتها يتحول تلقائيًا لـ"فشل" ويترجع المخزون. */}
                  <div className="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-5">
                    <h3 className="text-lg font-extrabold">⏱️ {t('مهلة انتظار الدفع الإلكتروني', 'Online payment timeout')}</h3>
                    <p className="text-xs text-[var(--lava-muted)] mt-1">
                      {t(
                        'لو العميل دخل صفحة الدفع (Kashier/Paymob) وماكملش الدفع أو رجع، الطلب هيفضل "قيد الانتظار" ومخزونه محجوز لحد ما المهلة دي تخلص، وبعدين هيتحول تلقائيًا لـ"فشل" ويترجع المخزون للمتجر.',
                        'If a customer opens the Kashier/Paymob payment page and never finishes or navigates back, the order stays "pending" with stock reserved until this timeout elapses — then it is automatically marked "failed" and the stock is released back to the store.'
                      )}
                    </p>
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={adminSettings.current.paymentSettings?.pendingTimeoutMinutes ?? 20}
                        onChange={(e) => {
                          const next = { ...(adminSettings.current.paymentSettings || {}), pendingTimeoutMinutes: e.target.value === '' ? '' : Number(e.target.value) };
                          adminSettings.current.paymentSettings = next;
                          bumpSettings();
                        }}
                        onBlur={(e) => {
                          const raw = Number(e.target.value);
                          const safe = Number.isFinite(raw) && raw >= 1 ? Math.round(raw) : 20;
                          const next = { ...(adminSettings.current.paymentSettings || {}), pendingTimeoutMinutes: safe };
                          adminSettings.current.paymentSettings = next;
                          bumpSettings();
                          saveAdminSettings(t('تم تحديث مهلة انتظار الدفع', 'Payment timeout updated'), { paymentSettings: next });
                        }}
                        className="w-28 border rounded-lg px-3 py-2 text-center font-bold"
                      />
                      <span className="text-sm font-bold text-[var(--lava-muted)]">{t('دقيقة', 'minutes')}</span>
                    </div>
                  </div>

                  {/* Cash on Delivery — مستقل تمامًا عن وسائل الدفع اليدوية (المحافظ) */}
                  <div className={`rounded-xl border-2 p-5 ${adminSettings.current.paymentSettings?.codEnabled !== false ? 'border-green-200 bg-green-50/30' : 'border-[var(--lava-border)] bg-[var(--lava-secondary)]'}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="text-xl font-extrabold">💵 {t('الدفع عند الاستلام', 'Cash on Delivery')}</h3>
                        <p className="text-sm text-[var(--lava-muted)] mt-1">{t('السماح للعميل باختيار الدفع نقدًا عند استلام الطلب.', 'Allow customers to choose to pay in cash when the order is delivered.')}</p>
                      </div>
                      <label className="inline-flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adminSettings.current.paymentSettings?.codEnabled !== false}
                          onChange={(e) => {
                            const next = { ...(adminSettings.current.paymentSettings || {}), codEnabled: e.target.checked };
                            adminSettings.current.paymentSettings = next;
                            bumpSettings();
                            saveAdminSettings(t('تم تحديث إعداد الدفع عند الاستلام', 'Cash on delivery setting updated'), { paymentSettings: next });
                          }}
                          className="w-5 h-5"
                        />
                        <span className="font-extrabold">{adminSettings.current.paymentSettings?.codEnabled !== false ? t('مفعّل', 'Enabled') : t('موقوف', 'Disabled')}</span>
                      </label>
                    </div>
                  </div>

                  {/* Manual payment */}
                  <div className={`rounded-xl border-2 p-5 ${adminSettings.current.paymentSettings?.manualEnabled !== false ? 'border-blue-200 bg-blue-50/30' : 'border-[var(--lava-border)] bg-[var(--lava-secondary)]'}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="text-xl font-extrabold">📱 {t('الدفع اليدوي (المحافظ/إنستاباي)', 'Manual Payment (Wallets/InstaPay)')}</h3>
                        <p className="text-sm text-[var(--lava-muted)] mt-1">{t('المحافظ/إنستاباي التي تضيفها يدويًا من نفس الصفحة.', 'The manual wallet/InstaPay methods configured below.')}</p>
                      </div>
                      <label className="inline-flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adminSettings.current.paymentSettings?.manualEnabled !== false}
                          onChange={(e) => {
                            const next = { ...(adminSettings.current.paymentSettings || {}), manualEnabled: e.target.checked };
                            adminSettings.current.paymentSettings = next;
                            bumpSettings();
                            saveAdminSettings(t('تم تحديث إعداد الدفع اليدوي', 'Manual payment setting updated'), { paymentSettings: next });
                          }}
                          className="w-5 h-5"
                        />
                        <span className="font-extrabold">{adminSettings.current.paymentSettings?.manualEnabled !== false ? t('مفعّل', 'Enabled') : t('موقوف', 'Disabled')}</span>
                      </label>
                    </div>

                    {adminSettings.current.paymentSettings?.manualEnabled !== false && (
                      <div className="mt-5 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="text-lg font-bold">{t('وسائل الدفع اليدوية', 'Manual payment methods')}</h4>
                          <button
                            type="button"
                            onClick={() => {
                              const newMethod = {
                                _id: `pm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                name: { ar: '', en: '' }, phoneNumber: '', instructions: { ar: '', en: '' }, icon: '📱', enabled: true,
                                screenshotRequired: false, transferDetailsRequired: true,
                              };
                              adminSettings.current.paymentMethods = [...(adminSettings.current.paymentMethods || []), newMethod];
                              bumpSettings();
                            }}
                            className="bg-black text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-800"
                          >+ {t('إضافة وسيلة دفع', 'Add Payment Method')}</button>
                        </div>

                        {(adminSettings.current.paymentMethods || []).map((method, idx) => {
                          const updateMethod = (patch) => {
                            const updated = [...(adminSettings.current.paymentMethods || [])];
                            updated[idx] = { ...updated[idx], ...patch };
                            adminSettings.current.paymentMethods = updated;
                            bumpSettings();
                          };
                          return (
                            <div key={method._id} className={`space-y-4 p-4 rounded-lg border-2 ${method.enabled ? 'border-blue-100 bg-blue-50/30' : 'border-[var(--lava-border)] bg-[var(--lava-secondary)]'}`}>
                              <div className="flex items-center justify-between flex-wrap gap-3">
                                <label className="flex items-center gap-2 font-bold cursor-pointer">
                                  <input type="checkbox" checked={!!method.enabled} onChange={(e) => updateMethod({ enabled: e.target.checked })} className="w-5 h-5" />
                                  {getLocalized(method.name) || t('وسيلة دفع بدون اسم', 'Unnamed method')}
                                </label>
                                <button type="button" onClick={() => { adminSettings.current.paymentMethods = (adminSettings.current.paymentMethods || []).filter((_, i) => i !== idx); bumpSettings(); }} className="text-red-600 hover:text-red-800 text-sm font-bold">🗑 {t('حذف', 'Delete')}</button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField label={`${t('اسم الوسيلة', 'Method name')} (${t('عربي', 'Arabic')})`} type="text" value={method.name?.ar || ''} onChange={(e) => updateMethod({ name: { ...method.name, ar: e.target.value } })} placeholder={t('مثال: انستاباي', 'e.g. InstaPay')} id={`pmNameAr_${method._id}`} />
                                <InputField label={`${t('اسم الوسيلة', 'Method name')} (English)`} type="text" value={method.name?.en || ''} onChange={(e) => updateMethod({ name: { ...method.name, en: e.target.value } })} placeholder="e.g. InstaPay" id={`pmNameEn_${method._id}`} />
                                <InputField label={t('رقم الاستلام', 'Receiving number')} type="tel" value={method.phoneNumber || ''} onChange={(e) => updateMethod({ phoneNumber: e.target.value })} placeholder="01012345678" id={`pmPhone_${method._id}`} />
                                <InputField label={t('إيموجي/أيقونة', 'Emoji/Icon')} type="text" value={method.icon || ''} onChange={(e) => updateMethod({ icon: e.target.value })} placeholder="📱" id={`pmIcon_${method._id}`} />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TextareaField label={`${t('تعليمات إضافية', 'Additional instructions')} (${t('عربي', 'Arabic')})`} value={method.instructions?.ar || ''} onChange={(e) => updateMethod({ instructions: { ...method.instructions, ar: e.target.value } })} rows={2} id={`pmInstrAr_${method._id}`} />
                                <TextareaField label={`${t('تعليمات إضافية', 'Additional instructions')} (English)`} value={method.instructions?.en || ''} onChange={(e) => updateMethod({ instructions: { ...method.instructions, en: e.target.value } })} rows={2} id={`pmInstrEn_${method._id}`} />
                              </div>
                              <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2 bg-[var(--lava-card)] p-3 rounded-lg border text-sm font-semibold"><input type="checkbox" checked={!!method.transferDetailsRequired} onChange={(e) => updateMethod({ transferDetailsRequired: e.target.checked })} className="w-5 h-5" />{t('رقم التحويل وتاريخه إجباري', 'Transfer phone & date required')}</label>
                                <label className="flex items-center gap-2 bg-[var(--lava-card)] p-3 rounded-lg border text-sm font-semibold"><input type="checkbox" checked={!!method.screenshotRequired} onChange={(e) => updateMethod({ screenshotRequired: e.target.checked })} className="w-5 h-5" />{t('صورة التحويل إجبارية', 'Transfer screenshot required')}</label>
                              </div>
                            </div>
                          );
                        })}
                        <button type="button" onClick={() => saveAdminSettings(t('تم حفظ إعدادات الدفع اليدوي', 'Manual payment settings saved'))} className="bg-black text-white px-8 py-3 rounded-lg font-bold">{t('حفظ إعدادات الدفع', 'Save Payment Settings')}</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===== تبويب أكواد الخصم ===== */}
            {/* ===== تبويب مركز العروض الترويجية (Promotions Hub) ===== */}
            {adminTab === 'promotions' && canAccess('settings') && (
              <div className="space-y-6">
                <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">🎁 {t('مركز العروض الترويجية', 'Promotions Hub')}</h2>
                    <p className="text-sm text-[var(--lava-muted)]">{t('المكان المركزي لإدارة كل العروض الترويجية في المتجر.', 'The central place to manage all promotional settings in the store.')}</p>
                  </div>

                  {/* ===== تابات مركز العروض الترويجية - جزء 9/26 ===== */}
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    {[
                      { key: 'overview', label: t('نظرة عامة', 'Overview'), icon: '📊' },
                      { key: 'campaigns', label: t('الحملات', 'Campaigns'), icon: '🏷️' },
                      { key: 'welcome', label: t('عرض الترحيب', 'Welcome Offer'), icon: '🎉' },
                      { key: 'guest', label: t('خصم الزائر / أول طلب', 'Guest / First Order'), icon: '👤' },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setPromotionsSubTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${promotionsSubTab === tab.key ? 'bg-black text-white' : 'bg-[var(--lava-secondary)] text-[var(--lava-muted)] hover:bg-[var(--lava-border)]'}`}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ===== نظرة عامة (Overview) - جزء 10 ===== */}
                {promotionsSubTab === 'overview' && (() => {
                  const activeCampaigns = promotions.filter(isPromotionCurrentlyActive).length;
                  const inactiveCampaigns = promotions.length - activeCampaigns;
                  const productsWithOffersCount = products.filter(p => Array.isArray(p.offers) && p.offers.some(o => o.active)).length;
                  return (
                    <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                      <h3 className="text-lg font-bold border-b pb-4">{t('نظرة عامة على العروض', 'Promotions Overview')}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                          <p className="text-2xl font-extrabold text-green-700">{activeCampaigns}</p>
                          <p className="text-xs font-bold text-[var(--lava-muted)] mt-1">{t('عروض نشطة', 'ACTIVE PROMOTIONS')}</p>
                        </div>
                        <div className="bg-[var(--lava-secondary)] border border-[var(--lava-border)] rounded-lg p-4 text-center">
                          <p className="text-2xl font-extrabold text-[var(--lava-text)]">{inactiveCampaigns}</p>
                          <p className="text-xs font-bold text-[var(--lava-muted)] mt-1">{t('غير نشطة', 'INACTIVE')}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                          <p className="text-lg font-extrabold text-blue-700">{adminSettings.current.promotions.welcomeOffer.enabled ? t('مفعّل', 'ACTIVE') : t('غير مفعّل', 'INACTIVE')}</p>
                          <p className="text-xs font-bold text-[var(--lava-muted)] mt-1">{t('عرض الترحيب', 'WELCOME OFFER')}</p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                          <p className="text-2xl font-extrabold text-purple-700">{adminSettings.current.promotions.guestDiscount.enabled ? `${adminSettings.current.promotions.guestDiscount.percentage}%` : t('معطّل', 'OFF')}</p>
                          <p className="text-xs font-bold text-[var(--lava-muted)] mt-1">{t('خصم أول طلب', 'FIRST ORDER')}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                          <p className="text-2xl font-extrabold text-amber-700">{productsWithOffersCount}</p>
                          <p className="text-xs font-bold text-[var(--lava-muted)] mt-1">{t('منتجات لها عروض', 'PRODUCT OFFERS')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ===== خصم العميل الجديد على أول طلب (Guest / First Order) ===== */}
                {promotionsSubTab === 'guest' && (
                  <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                  <div className="border-t-0 pt-0 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold">{t('خصم العميل الجديد على أول طلب (Guest / New Customer First Order Discount)', 'Guest / New Customer First Order Discount')}</h3>
                      <p className="text-sm text-[var(--lava-muted)]">{t('يجب على العميل إنشاء حساب ليصبح مؤهلاً. الخصم يُستخدم مرة واحدة فقط على أول طلب له.', 'Customers must create an account to become eligible. The discount can only be used on their first order.')}</p>
                    </div>

                    {/* الحالة والنسبة */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between bg-[var(--lava-secondary)] p-4 rounded-lg border">
                        <label htmlFor="guestDiscountEnabled" className="font-bold cursor-pointer">{t('حالة خصم الزائر', 'Guest Discount Status')}</label>
                        <button
                          id="guestDiscountEnabled"
                          type="button"
                          role="switch"
                          aria-checked={adminSettings.current.promotions.guestDiscount.enabled}
                          onClick={() => { adminSettings.current.promotions.guestDiscount.enabled = !adminSettings.current.promotions.guestDiscount.enabled; bumpSettings(); }}
                          className={`w-14 h-8 rounded-full relative transition-colors ${adminSettings.current.promotions.guestDiscount.enabled ? 'bg-green-500' : 'bg-[var(--lava-border)]'}`}
                        >
                          <span className={`absolute top-1 ${adminSettings.current.promotions.guestDiscount.enabled ? (language === 'ar' ? 'right-1' : 'left-7') : (language === 'ar' ? 'right-7' : 'left-1')} w-6 h-6 bg-[var(--lava-card)] rounded-full shadow transition-all`}></span>
                        </button>
                      </div>
                      <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border">
                        <label htmlFor="guestDiscountPercentage" className="block font-bold mb-1">{t('نسبة الخصم', 'Discount Percentage')}</label>
                        <div className="flex items-center gap-2">
                          <input
                            id="guestDiscountPercentage"
                            type="number"
                            min="0"
                            max="100"
                            value={adminSettings.current.promotions.guestDiscount.percentage}
                            onChange={(e) => { adminSettings.current.promotions.guestDiscount.percentage = Math.max(0, Math.min(100, Number(e.target.value) || 0)); bumpSettings(); }}
                            className="w-28 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]"
                          />
                          <span className="font-bold text-[var(--lava-muted)]">%</span>
                        </div>
                      </div>
                    </div>

                    {/* العنوان */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label={`${t('العنوان', 'Title')} (${t('عربي', 'Arabic')})`} type="text" value={adminSettings.current.promotions.guestDiscount.title.ar} onChange={(e) => { adminSettings.current.promotions.guestDiscount.title = { ...adminSettings.current.promotions.guestDiscount.title, ar: e.target.value }; bumpSettings(); }} id="guestDiscountTitleAr" />
                      <InputField label={`${t('العنوان', 'Title')} (English)`} type="text" value={adminSettings.current.promotions.guestDiscount.title.en} onChange={(e) => { adminSettings.current.promotions.guestDiscount.title = { ...adminSettings.current.promotions.guestDiscount.title, en: e.target.value }; bumpSettings(); }} id="guestDiscountTitleEn" />
                    </div>

                    {/* نص الرسالة */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextareaField label={`${t('نص الرسالة', 'Message')} (${t('عربي', 'Arabic')})`} value={adminSettings.current.promotions.guestDiscount.message.ar} onChange={(e) => { adminSettings.current.promotions.guestDiscount.message = { ...adminSettings.current.promotions.guestDiscount.message, ar: e.target.value }; bumpSettings(); }} rows={3} id="guestDiscountMessageAr" />
                      <TextareaField label={`${t('نص الرسالة', 'Message')} (English)`} value={adminSettings.current.promotions.guestDiscount.message.en} onChange={(e) => { adminSettings.current.promotions.guestDiscount.message = { ...adminSettings.current.promotions.guestDiscount.message, en: e.target.value }; bumpSettings(); }} rows={3} id="guestDiscountMessageEn" />
                    </div>
                    <p className="text-xs text-[var(--lava-muted)]">{t('يمكنك كتابة نص مخصص بالكامل ولا يشترط ذكر النسبة داخل النص.', "You can write fully custom text — the message doesn't have to mention the percentage.")}</p>

                    {/* نص الزرار */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label={`${t('نص الزرار', 'Button Text')} (${t('عربي', 'Arabic')})`} type="text" value={adminSettings.current.promotions.guestDiscount.buttonText.ar} onChange={(e) => { adminSettings.current.promotions.guestDiscount.buttonText = { ...adminSettings.current.promotions.guestDiscount.buttonText, ar: e.target.value }; bumpSettings(); }} id="guestDiscountButtonAr" />
                      <InputField label={`${t('نص الزرار', 'Button Text')} (English)`} type="text" value={adminSettings.current.promotions.guestDiscount.buttonText.en} onChange={(e) => { adminSettings.current.promotions.guestDiscount.buttonText = { ...adminSettings.current.promotions.guestDiscount.buttonText, en: e.target.value }; bumpSettings(); }} id="guestDiscountButtonEn" />
                    </div>

                    {/* معاينة العميل */}
                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold">{t('معاينة العميل', 'Customer Preview')}</h4>
                        <div className="flex items-center gap-1 bg-[var(--lava-secondary)] rounded-lg p-1">
                          <button type="button" onClick={() => setPromoPreviewLang('ar')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${promoPreviewLang === 'ar' ? 'bg-[var(--lava-card)] shadow text-black' : 'text-[var(--lava-muted)]'}`}>{t('عربي', 'Arabic')}</button>
                          <button type="button" onClick={() => setPromoPreviewLang('en')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${promoPreviewLang === 'en' ? 'bg-[var(--lava-card)] shadow text-black' : 'text-[var(--lava-muted)]'}`}>English</button>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--lava-muted)] mb-3">{t('هذه معاينة فقط، وليست الإشعار الفعلي اللي هيظهر للعميل.', 'This is a preview only — not the actual customer-facing notification.')}</p>
                      <div className="w-72 max-w-full bg-[var(--lava-card)] border border-[var(--lava-border)] rounded-xl shadow-lg overflow-hidden mx-auto" dir={promoPreviewLang === 'ar' ? 'rtl' : 'ltr'}>
                        <div className="bg-black text-white px-4 py-3 flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 font-extrabold text-sm">
                            <span>🎁</span>
                            <span>{adminSettings.current.promotions.guestDiscount.title[promoPreviewLang] || ''}</span>
                          </div>
                          <span className="text-white/80 text-lg leading-none font-bold shrink-0 -mt-0.5">✕</span>
                        </div>
                        <div className="p-4 space-y-3">
                          <p className="text-sm text-[var(--lava-text)] leading-relaxed">{adminSettings.current.promotions.guestDiscount.message[promoPreviewLang] || ''}</p>
                          <div className="w-full bg-black text-white font-bold py-2.5 rounded-lg text-sm text-center">
                            {adminSettings.current.promotions.guestDiscount.buttonText[promoPreviewLang] || ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => saveAdminSettings(t('تم حفظ إعدادات العروض الترويجية بنجاح.', 'Promotion settings saved successfully.'))}
                      className="bg-black text-white px-8 py-3 rounded-lg font-bold"
                    >
                      {t('حفظ التغييرات', 'Save Changes')}
                    </button>
                  </div>
                  </div>
                )}

                {/* ===== عرض الترحيب (Welcome Offer) ===== */}
                {promotionsSubTab === 'welcome' && (
                <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                  <div>
                    <h3 className="text-lg font-bold">🎉 {t('عرض الترحيب (Welcome Offer)', 'Welcome Offer')}</h3>
                    <p className="text-sm text-[var(--lava-muted)]">{t('بوب أب ترويجي يظهر للعميل عند دخوله الموقع.', 'A promotional popup shown to customers when they enter the site.')}</p>
                  </div>

                  <div className="border-t pt-6 space-y-6">
                    {/* الحالة */}
                    <div className="flex items-center justify-between bg-[var(--lava-secondary)] p-4 rounded-lg border">
                      <label htmlFor="welcomeOfferEnabled" className="font-bold cursor-pointer">{t('حالة عرض الترحيب', 'Welcome Offer Status')}</label>
                      <button
                        id="welcomeOfferEnabled"
                        type="button"
                        role="switch"
                        aria-checked={adminSettings.current.promotions.welcomeOffer.enabled}
                        onClick={() => { adminSettings.current.promotions.welcomeOffer.enabled = !adminSettings.current.promotions.welcomeOffer.enabled; bumpSettings(); }}
                        className={`w-14 h-8 rounded-full relative transition-colors ${adminSettings.current.promotions.welcomeOffer.enabled ? 'bg-green-500' : 'bg-[var(--lava-border)]'}`}
                      >
                        <span className={`absolute top-1 ${adminSettings.current.promotions.welcomeOffer.enabled ? (language === 'ar' ? 'right-1' : 'left-7') : (language === 'ar' ? 'right-7' : 'left-1')} w-6 h-6 bg-[var(--lava-card)] rounded-full shadow transition-all`}></span>
                      </button>
                    </div>

                    {/* الصورة */}
                    <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-3">
                      <label className="block font-bold">{t('صورة البوب أب', 'Popup Image')}</label>
                      {adminSettings.current.promotions.welcomeOffer.image ? (
                        <div className="space-y-2">
                          <img src={adminSettings.current.promotions.welcomeOffer.image} alt="" className="w-full max-w-xs h-40 object-cover rounded-lg border" />
                          <div className="flex gap-3">
                            <label htmlFor="welcomeOfferImageInput" className="cursor-pointer text-sm font-bold bg-[var(--lava-card)] border px-4 py-2 rounded-lg hover:bg-[var(--lava-secondary)]">
                              {t('استبدال الصورة', 'Replace Image')}
                            </label>
                            <button
                              type="button"
                              onClick={() => { adminSettings.current.promotions.welcomeOffer.image = ''; bumpSettings(); }}
                              className="text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100"
                            >
                              {t('إزالة الصورة', 'Remove Image')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label htmlFor="welcomeOfferImageInput" className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 cursor-pointer hover:bg-[var(--lava-secondary)] text-[var(--lava-muted)]">
                          <span className="text-3xl">🖼️</span>
                          <span className="text-sm font-bold">{t('اختيار صورة', 'Select Image')}</span>
                        </label>
                      )}
                      <input id="welcomeOfferImageInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleWelcomeOfferImageUpload} className="hidden" />
                      <InputField label={t('أو رابط صورة جاهز', 'Or paste an image URL')} type="text" value={adminSettings.current.promotions.welcomeOffer.image} onChange={(e) => { adminSettings.current.promotions.welcomeOffer.image = e.target.value; bumpSettings(); }} placeholder="https://..." id="welcomeOfferImageUrl" />
                    </div>

                    {/* العنوان */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label={`${t('العنوان', 'Title')} (${t('عربي', 'Arabic')})`} type="text" value={adminSettings.current.promotions.welcomeOffer.title.ar} onChange={(e) => { adminSettings.current.promotions.welcomeOffer.title = { ...adminSettings.current.promotions.welcomeOffer.title, ar: e.target.value }; bumpSettings(); }} id="welcomeOfferTitleAr" />
                      <InputField label={`${t('العنوان', 'Title')} (English)`} type="text" value={adminSettings.current.promotions.welcomeOffer.title.en} onChange={(e) => { adminSettings.current.promotions.welcomeOffer.title = { ...adminSettings.current.promotions.welcomeOffer.title, en: e.target.value }; bumpSettings(); }} id="welcomeOfferTitleEn" />
                    </div>

                    {/* اختيار عرض ترويجي حقيقي (Part 16/29) */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                      <label className="block font-bold text-sm">{t('اختر عرضاً ترويجياً حقيقياً (اختياري)', 'Select a real promotion (optional)')}</label>
                      <select
                        value={adminSettings.current.promotions.welcomeOffer.promotionId || ''}
                        onChange={(e) => {
                          const id = e.target.value ? Number(e.target.value) : null;
                          const promo = id ? promotions.find(p => p.id === id) : null;
                          adminSettings.current.promotions.welcomeOffer.promotionId = id;
                          if (promo) {
                            const label = getPromotionLabel(promo);
                            adminSettings.current.promotions.welcomeOffer.offerText = label;
                            if (promo.target === 'product') {
                              adminSettings.current.promotions.welcomeOffer.destinationType = 'product';
                              adminSettings.current.promotions.welcomeOffer.productId = promo.productId;
                              adminSettings.current.promotions.welcomeOffer.categoryId = null;
                            } else if (promo.target === 'category') {
                              adminSettings.current.promotions.welcomeOffer.destinationType = 'category';
                              adminSettings.current.promotions.welcomeOffer.categoryId = promo.categoryId;
                              adminSettings.current.promotions.welcomeOffer.productId = null;
                            } else {
                              adminSettings.current.promotions.welcomeOffer.destinationType = 'shop';
                              adminSettings.current.promotions.welcomeOffer.productId = null;
                              adminSettings.current.promotions.welcomeOffer.categoryId = null;
                            }
                          }
                          bumpSettings();
                        }}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]"
                      >
                        <option value="">{t('بدون ربط - نص ترويجي فقط', 'No link - promotional text only')}</option>
                        {promotions.filter(isPromotionCurrentlyActive).map(p => (
                          <option key={p.id} value={p.id}>{p.name?.ar || p.name?.en}</option>
                        ))}
                      </select>
                      <p className="text-xs text-blue-700">{t('لو اخترت عرضاً هنا، البوب أب هيعرض بياناته الحقيقية وزرار الدعوة هيوديك لنفس هدف العرض (منتج/قسم/المتجر)، والحساب الفعلي في السلة بيتم من محرك العروض نفسه - مش من البوب أب.', "If you select a promotion here, the popup shows its real info and the CTA takes the customer to that promotion's target (product/category/shop). The actual cart calculation always comes from the promotion engine, not from the popup itself.")}</p>
                    </div>

                    {/* الوصف */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextareaField label={`${t('الوصف', 'Description')} (${t('عربي', 'Arabic')})`} value={adminSettings.current.promotions.welcomeOffer.description.ar} onChange={(e) => { adminSettings.current.promotions.welcomeOffer.description = { ...adminSettings.current.promotions.welcomeOffer.description, ar: e.target.value }; bumpSettings(); }} rows={2} id="welcomeOfferDescAr" />
                      <TextareaField label={`${t('الوصف', 'Description')} (English)`} value={adminSettings.current.promotions.welcomeOffer.description.en} onChange={(e) => { adminSettings.current.promotions.welcomeOffer.description = { ...adminSettings.current.promotions.welcomeOffer.description, en: e.target.value }; bumpSettings(); }} rows={2} id="welcomeOfferDescEn" />
                    </div>

                    {/* نص العرض */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label={`${t('نص العرض', 'Offer Text')} (${t('عربي', 'Arabic')})`} type="text" value={adminSettings.current.promotions.welcomeOffer.offerText.ar} onChange={(e) => { adminSettings.current.promotions.welcomeOffer.offerText = { ...adminSettings.current.promotions.welcomeOffer.offerText, ar: e.target.value }; bumpSettings(); }} placeholder={t('مثال: اشترِ 2 واحصل على 1 مجاناً', 'e.g. Buy 2 Get 1 Free')} id="welcomeOfferOfferAr" />
                      <InputField label={`${t('نص العرض', 'Offer Text')} (English)`} type="text" value={adminSettings.current.promotions.welcomeOffer.offerText.en} onChange={(e) => { adminSettings.current.promotions.welcomeOffer.offerText = { ...adminSettings.current.promotions.welcomeOffer.offerText, en: e.target.value }; bumpSettings(); }} placeholder="e.g. Buy 2 Get 1 Free" id="welcomeOfferOfferEn" />
                    </div>
                    <p className="text-xs text-[var(--lava-muted)]">{t('لو مرتبط بعرض حقيقي من فوق، النص هنا بيتحدّث تلقائياً منه. تقدر تعدّله يدوياً كمان، لكن الحساب الفعلي في السلة بيفضل دايماً تابع لإعدادات العرض نفسه في Campaigns، مش للنص المكتوب هنا.', 'If linked to a real promotion above, this text auto-fills from it. You can still edit it manually, but the actual cart calculation always follows the promotion settings in Campaigns, never this text.')}</p>

                    {/* نص الزرار */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label={`${t('نص الزرار', 'Button Text')} (${t('عربي', 'Arabic')})`} type="text" value={adminSettings.current.promotions.welcomeOffer.buttonText.ar} onChange={(e) => { adminSettings.current.promotions.welcomeOffer.buttonText = { ...adminSettings.current.promotions.welcomeOffer.buttonText, ar: e.target.value }; bumpSettings(); }} id="welcomeOfferButtonAr" />
                      <InputField label={`${t('نص الزرار', 'Button Text')} (English)`} type="text" value={adminSettings.current.promotions.welcomeOffer.buttonText.en} onChange={(e) => { adminSettings.current.promotions.welcomeOffer.buttonText = { ...adminSettings.current.promotions.welcomeOffer.buttonText, en: e.target.value }; bumpSettings(); }} id="welcomeOfferButtonEn" />
                    </div>

                    {/* وجهة الزرار */}
                    <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-3">
                      <label className="block font-bold">{t('وجهة الزرار', 'Button Destination')}</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'shop', label: t('المتجر', 'Shop') },
                          { key: 'category', label: t('قسم', 'Category') },
                          { key: 'product', label: t('منتج', 'Product') },
                        ].map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => { adminSettings.current.promotions.welcomeOffer.destinationType = opt.key; bumpSettings(); }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${adminSettings.current.promotions.welcomeOffer.destinationType === opt.key ? 'bg-black text-white' : 'bg-[var(--lava-card)] border text-[var(--lava-muted)] hover:bg-[var(--lava-secondary)]'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* اختيار منتج */}
                      {adminSettings.current.promotions.welcomeOffer.destinationType === 'product' && (
                        <div className="pt-2 space-y-2">
                          {adminSettings.current.promotions.welcomeOffer.productId ? (
                            (() => {
                              const selectedProd = products.find(p => p.id === adminSettings.current.promotions.welcomeOffer.productId);
                              return (
                                <div className="flex items-center justify-between bg-[var(--lava-card)] border rounded-lg p-3">
                                  <div>
                                    <p className="text-xs text-[var(--lava-muted)]">{t('المنتج المختار', 'Selected Product')}</p>
                                    <p className="font-bold">{selectedProd ? getLocalized(selectedProd.name) : t('منتج محذوف', 'Deleted product')}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => { adminSettings.current.promotions.welcomeOffer.productId = null; bumpSettings(); }} className="text-xs font-bold text-[var(--lava-muted)] bg-[var(--lava-secondary)] px-3 py-1.5 rounded-lg hover:bg-[var(--lava-border)]">{t('تغيير', 'Change')}</button>
                                    <button type="button" onClick={() => { adminSettings.current.promotions.welcomeOffer.productId = null; bumpSettings(); }} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100">{t('إزالة', 'Remove')}</button>
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <>
                              <p className="text-sm font-bold text-orange-600">⚠️ {t('لا يوجد منتج مختار', 'No product selected')}</p>
                              <input
                                type="text"
                                value={welcomeOfferProductSearch}
                                onChange={(e) => setWelcomeOfferProductSearch(e.target.value)}
                                placeholder={t('ابحث عن منتج...', 'Search for a product...')}
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]"
                              />
                              <div className="max-h-40 overflow-y-auto border rounded-lg divide-y bg-[var(--lava-card)]">
                                {products.filter(p => getLocalized(p.name).toLowerCase().includes(welcomeOfferProductSearch.toLowerCase())).map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => { adminSettings.current.promotions.welcomeOffer.productId = p.id; setWelcomeOfferProductSearch(''); bumpSettings(); }}
                                    className="w-full text-start px-3 py-2 text-sm hover:bg-[var(--lava-secondary)]"
                                  >
                                    {getLocalized(p.name)}
                                  </button>
                                ))}
                                {products.filter(p => getLocalized(p.name).toLowerCase().includes(welcomeOfferProductSearch.toLowerCase())).length === 0 && (
                                  <p className="text-xs text-[var(--lava-muted)] px-3 py-3 text-center">{t('لا توجد نتائج', 'No results')}</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* اختيار قسم */}
                      {adminSettings.current.promotions.welcomeOffer.destinationType === 'category' && (
                        <div className="pt-2 space-y-2">
                          {adminSettings.current.promotions.welcomeOffer.categoryId ? (
                            (() => {
                              const selectedCat = categories.find(c => c.id === adminSettings.current.promotions.welcomeOffer.categoryId);
                              return (
                                <div className="flex items-center justify-between bg-[var(--lava-card)] border rounded-lg p-3">
                                  <div>
                                    <p className="text-xs text-[var(--lava-muted)]">{t('القسم المختار', 'Selected Category')}</p>
                                    <p className="font-bold">{selectedCat ? getLocalized(selectedCat.name) : t('قسم محذوف', 'Deleted category')}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => { adminSettings.current.promotions.welcomeOffer.categoryId = null; bumpSettings(); }} className="text-xs font-bold text-[var(--lava-muted)] bg-[var(--lava-secondary)] px-3 py-1.5 rounded-lg hover:bg-[var(--lava-border)]">{t('تغيير', 'Change')}</button>
                                    <button type="button" onClick={() => { adminSettings.current.promotions.welcomeOffer.categoryId = null; bumpSettings(); }} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100">{t('إزالة', 'Remove')}</button>
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <>
                              <p className="text-sm font-bold text-orange-600">⚠️ {t('لا يوجد قسم مختار', 'No category selected')}</p>
                              <div className="flex flex-wrap gap-2">
                                {categories.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => { adminSettings.current.promotions.welcomeOffer.categoryId = c.id; bumpSettings(); }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-[var(--lava-card)] border hover:bg-[var(--lava-secondary)]"
                                  >
                                    {getLocalized(c.name)}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {adminSettings.current.promotions.welcomeOffer.destinationType === 'shop' && (
                        <p className="text-xs text-[var(--lava-muted)] pt-1">{t('الزرار هيفتح صفحة المتجر مباشرة.', 'The button will open the Shop page directly.')}</p>
                      )}
                    </div>

                    {/* معاينة العميل */}
                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold">{t('معاينة العميل', 'Customer Preview')}</h4>
                        <div className="flex items-center gap-1 bg-[var(--lava-secondary)] rounded-lg p-1">
                          <button type="button" onClick={() => setWelcomeOfferPreviewLang('ar')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${welcomeOfferPreviewLang === 'ar' ? 'bg-[var(--lava-card)] shadow text-black' : 'text-[var(--lava-muted)]'}`}>{t('عربي', 'Arabic')}</button>
                          <button type="button" onClick={() => setWelcomeOfferPreviewLang('en')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${welcomeOfferPreviewLang === 'en' ? 'bg-[var(--lava-card)] shadow text-black' : 'text-[var(--lava-muted)]'}`}>English</button>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--lava-muted)] mb-3">{t('هذه معاينة فقط، وليست البوب أب الفعلي اللي هيظهر للعميل.', 'This is a preview only — not the actual customer-facing popup.')}</p>
                      <div className="w-full max-w-xs bg-[var(--lava-card)] border border-[var(--lava-border)] rounded-2xl shadow-lg overflow-hidden mx-auto" dir={welcomeOfferPreviewLang === 'ar' ? 'rtl' : 'ltr'}>
                        {adminSettings.current.promotions.welcomeOffer.image && (
                          <div className="w-full h-32 bg-[var(--lava-secondary)]">
                            <img src={adminSettings.current.promotions.welcomeOffer.image} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-4 space-y-2 text-center">
                          <p className="font-extrabold text-lg">{adminSettings.current.promotions.welcomeOffer.title[welcomeOfferPreviewLang] || ''}</p>
                          {adminSettings.current.promotions.welcomeOffer.offerText[welcomeOfferPreviewLang] && (
                            <p className="text-red-600 font-bold text-sm">{adminSettings.current.promotions.welcomeOffer.offerText[welcomeOfferPreviewLang]}</p>
                          )}
                          {adminSettings.current.promotions.welcomeOffer.description[welcomeOfferPreviewLang] && (
                            <p className="text-xs text-[var(--lava-muted)]">{adminSettings.current.promotions.welcomeOffer.description[welcomeOfferPreviewLang]}</p>
                          )}
                          <div className="w-full bg-black text-white font-bold py-2 rounded-lg text-sm mt-2">
                            {adminSettings.current.promotions.welcomeOffer.buttonText[welcomeOfferPreviewLang] || ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => saveAdminSettings(t('تم حفظ إعدادات عرض الترحيب بنجاح.', 'Welcome offer settings saved successfully.'))}
                      className="bg-black text-white px-8 py-3 rounded-lg font-bold"
                    >
                      {t('حفظ التغييرات', 'Save Changes')}
                    </button>
                  </div>
                </div>
                )}

                {/* ===== العروض الترويجية الحقيقية (Campaigns) ===== */}
                {promotionsSubTab === 'campaigns' && (
                <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">🏷️ {t('العروض الترويجية (Campaigns)', 'Promotions / Campaigns')}</h3>
                      <p className="text-sm text-[var(--lava-muted)]">{t('هنا بتتحكم في العروض الحقيقية اللي بتتحسب فعلياً في السلة: اشترِ X واحصل على Y مجاناً، خصم كمية، خصم نسبة أو مبلغ ثابت.', 'This is where the real promotions that actually calculate in the cart live: Buy X Get Y Free, quantity discounts, percentage or fixed discounts.')}</p>
                    </div>
                    {!campaignFormOpen && (
                      <button type="button" onClick={openNewCampaignForm} className="bg-black text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-800">
                        + {t('إنشاء عرض جديد', 'Create New Promotion')}
                      </button>
                    )}
                  </div>

                  {/* ===== قائمة العروض الحالية ===== */}
                  {!campaignFormOpen && (
                    promotions.length === 0 ? (
                      <p className="text-sm text-[var(--lava-muted)] bg-[var(--lava-secondary)] border border-dashed rounded-lg p-6 text-center">{t('لا توجد عروض حتى الآن. اضغط "إنشاء عرض جديد" للبدء.', 'No promotions yet. Click "Create New Promotion" to get started.')}</p>
                    ) : (
                      <div className="space-y-3">
                        {promotions.map(promo => {
                          const isActiveNow = isPromotionCurrentlyActive(promo);
                          const targetLabel = promo.target === 'product'
                            ? `${t('منتج', 'Product')}: ${getLocalized(products.find(p => p.id === promo.productId)?.name) || t('منتج محذوف', 'deleted product')}`
                            : promo.target === 'category'
                              ? `${t('قسم', 'Category')}: ${getLocalized(categories.find(c => c.id === promo.categoryId)?.name) || t('قسم محذوف', 'deleted category')}`
                              : t('كل المنتجات', 'All Products');
                          const condLabel = getLocalized(getPromotionLabel(promo));
                          return (
                            <div key={promo.id} className="border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 bg-[var(--lava-secondary)]">
                              <div>
                                <p className="font-bold">{getLocalized(promo.name)}</p>
                                <p className="text-xs text-[var(--lava-muted)] mt-0.5">{targetLabel} · {condLabel}</p>
                                {(promo.startDate || promo.endDate) && (
                                  <p className="text-[11px] text-[var(--lava-muted)] mt-0.5">
                                    {promo.startDate && `${t('من', 'From')} ${new Date(promo.startDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}`}
                                    {promo.startDate && promo.endDate && ' — '}
                                    {promo.endDate && `${t('إلى', 'To')} ${new Date(promo.endDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}`}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${isActiveNow ? 'bg-green-100 text-green-700' : 'bg-[var(--lava-border)] text-[var(--lava-muted)]'}`}>
                                  {promo.active ? (isActiveNow ? t('فعّال الآن', 'Active now') : t('مفعّل - خارج المدة', 'Enabled - outside date range')) : t('غير مفعّل', 'Inactive')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => togglePromotionActive(promo.id)}
                                  className="text-xs font-bold bg-[var(--lava-card)] border px-3 py-1.5 rounded-lg hover:bg-[var(--lava-secondary)]"
                                >
                                  {promo.active ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditCampaignForm(promo)}
                                  className="text-xs font-bold bg-[var(--lava-card)] border px-3 py-1.5 rounded-lg hover:bg-[var(--lava-secondary)]"
                                >
                                  {t('تعديل', 'Edit')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { if (window.confirm(t('تأكيد حذف هذا العرض؟', 'Confirm deleting this promotion?'))) deletePromotion(promo.id); }}
                                  className="text-xs font-bold bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                                >
                                  {t('حذف', 'Delete')}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* ===== فورم إنشاء / تعديل عرض ===== */}
                  {campaignFormOpen && (
                    <div className="border-t pt-6 space-y-5">
                      <h4 className="font-bold text-base">{editingPromotionId ? t('تعديل العرض', 'Edit Promotion') : t('إنشاء عرض جديد', 'Create New Promotion')}</h4>

                      <InputField
                        label={t('اسم العرض (داخلي - للأدمن فقط)', 'Promotion Name (internal - admin only)')}
                        type="text"
                        value={newPromoName}
                        onChange={(e) => setNewPromoName(e.target.value)}
                        placeholder={t('مثال: اشترِ 2 واحصل على 1 مجاناً — بناطيل', 'e.g. Buy 2 Get 1 Free — Pants')}
                        id="newPromoName"
                      />

                      {/* نوع العرض */}
                      <div>
                        <label className="block font-semibold mb-2 text-sm">{t('نوع العرض', 'Promotion Type')}</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { key: 'bxgy', label: t('اشترِ X واحصل على Y مجاناً', 'Buy X Get Y Free') },
                            { key: 'quantity_discount', label: t('خصم كمية %', 'Quantity Discount %') },
                            { key: 'percentage', label: t('خصم نسبة %', 'Percentage Discount') },
                            { key: 'fixed', label: t('خصم مبلغ ثابت', 'Fixed Amount Discount') },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setNewPromoType(opt.key)}
                              className={`px-3 py-2 rounded-lg text-xs font-bold transition ${newPromoType === opt.key ? 'bg-black text-white' : 'bg-[var(--lava-card)] border text-[var(--lava-muted)] hover:bg-[var(--lava-secondary)]'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* شروط العرض حسب النوع */}
                      {newPromoType === 'bxgy' && (
                        <div className="grid grid-cols-2 gap-4">
                          <InputField label={t('اشترِ (Buy Quantity)', 'Buy Quantity')} type="number" value={newPromoBuyQty} onChange={(e) => setNewPromoBuyQty(e.target.value)} id="newPromoBuyQty" />
                          <InputField label={t('احصل مجاناً على (Free Quantity)', 'Free Quantity')} type="number" value={newPromoFreeQty} onChange={(e) => setNewPromoFreeQty(e.target.value)} id="newPromoFreeQty" />
                        </div>
                      )}
                      {newPromoType === 'quantity_discount' && (
                        <div className="grid grid-cols-2 gap-4">
                          <InputField label={t('الحد الأدنى للكمية', 'Minimum Quantity')} type="number" value={newPromoMinQty} onChange={(e) => setNewPromoMinQty(e.target.value)} id="newPromoMinQty" />
                          <InputField label={t('نسبة الخصم (%)', 'Discount Percentage (%)')} type="number" value={newPromoDiscountPercent} onChange={(e) => setNewPromoDiscountPercent(e.target.value)} id="newPromoDiscountPercent" />
                        </div>
                      )}
                      {newPromoType === 'percentage' && (
                        <InputField label={t('نسبة الخصم (%)', 'Discount Percentage (%)')} type="number" value={newPromoPercentage} onChange={(e) => setNewPromoPercentage(e.target.value)} id="newPromoPercentage" />
                      )}
                      {newPromoType === 'fixed' && (
                        <InputField label={t('مبلغ الخصم (ج.م)', 'Discount Amount (EGP)')} type="number" value={newPromoFixedAmount} onChange={(e) => setNewPromoFixedAmount(e.target.value)} id="newPromoFixedAmount" />
                      )}

                      {/* الهدف (Target) */}
                      <div>
                        <label className="block font-semibold mb-2 text-sm">{t('هدف العرض (Target)', 'Promotion Target')}</label>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { key: 'product', label: t('منتج محدد', 'Specific Product') },
                            { key: 'category', label: t('قسم', 'Category') },
                            { key: 'all', label: t('كل المنتجات', 'All Products') },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => { setNewPromoTarget(opt.key); setNewPromoProductId(null); setNewPromoCategoryId(null); setCampaignProductSearch(''); }}
                              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${newPromoTarget === opt.key ? 'bg-black text-white' : 'bg-[var(--lava-card)] border text-[var(--lava-muted)] hover:bg-[var(--lava-secondary)]'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* اختيار المنتج - لا يوجد اختيار افتراضي أبداً */}
                      {newPromoTarget === 'product' && (
                        <div>
                          {newPromoProductId ? (() => {
                            const p = products.find(pr => pr.id === newPromoProductId);
                            return (
                              <div className="flex items-center justify-between bg-[var(--lava-secondary)] border rounded-lg p-3">
                                <span className="font-semibold text-sm">{p ? getLocalized(p.name) : t('منتج محذوف', 'Deleted product')}</span>
                                <button type="button" onClick={() => setNewPromoProductId(null)} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100">{t('تغيير', 'Change')}</button>
                              </div>
                            );
                          })() : (
                            <div className="space-y-2">
                              <p className="text-sm text-[var(--lava-muted)] font-semibold">{t('لا يوجد منتج محدد بعد', 'No product selected')}</p>
                              <input
                                type="text"
                                value={campaignProductSearch}
                                onChange={(e) => setCampaignProductSearch(e.target.value)}
                                placeholder={t('ابحث عن منتج...', 'Search for a product...')}
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]"
                              />
                              <div className="w-full border rounded-lg bg-[var(--lava-card)] max-h-44 overflow-y-auto divide-y">
                                {products.filter(p => getLocalized(p.name).toLowerCase().includes(campaignProductSearch.toLowerCase())).map(p => (
                                  <button
                                    type="button"
                                    key={p.id}
                                    onClick={() => setNewPromoProductId(p.id)}
                                    className="w-full text-start px-3 py-2 text-sm hover:bg-[var(--lava-secondary)]"
                                  >
                                    {getLocalized(p.name)}
                                  </button>
                                ))}
                                {products.filter(p => getLocalized(p.name).toLowerCase().includes(campaignProductSearch.toLowerCase())).length === 0 && (
                                  <p className="text-xs text-[var(--lava-muted)] px-3 py-2">{t('لا توجد منتجات مطابقة', 'No matching products')}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* اختيار القسم - لا يوجد اختيار افتراضي أبداً */}
                      {newPromoTarget === 'category' && (
                        <div>
                          {newPromoCategoryId ? (() => {
                            const c = categories.find(cat => cat.id === newPromoCategoryId);
                            return (
                              <div className="flex items-center justify-between bg-[var(--lava-secondary)] border rounded-lg p-3">
                                <span className="font-semibold text-sm">{c ? getLocalized(c.name) : t('قسم محذوف', 'Deleted category')}</span>
                                <button type="button" onClick={() => setNewPromoCategoryId(null)} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100">{t('تغيير', 'Change')}</button>
                              </div>
                            );
                          })() : (
                            <div className="space-y-2">
                              <p className="text-sm text-[var(--lava-muted)] font-semibold">{t('لا يوجد قسم محدد بعد', 'No category selected')}</p>
                              <div className="flex flex-wrap gap-2">
                                {categories.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setNewPromoCategoryId(c.id)}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-[var(--lava-card)] border text-[var(--lava-muted)] hover:bg-[var(--lava-secondary)]"
                                  >
                                    {getLocalized(c.name)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {newPromoTarget === 'all' && (
                        <p className="text-sm text-[var(--lava-muted)] bg-[var(--lava-secondary)] border rounded-lg p-3">{t('العرض هيتطبق على كل المنتجات المؤهلة في المتجر تلقائياً.', 'This promotion applies automatically to all eligible products in the store.')}</p>
                      )}

                      {/* التواريخ (اختياري) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold mb-1 text-sm">{t('تاريخ البداية (اختياري)', 'Start Date (optional)')}</label>
                          <input type="datetime-local" value={newPromoStartDate} onChange={(e) => setNewPromoStartDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-sm">{t('تاريخ النهاية (اختياري)', 'End Date (optional)')}</label>
                          <input type="datetime-local" value={newPromoEndDate} onChange={(e) => setNewPromoEndDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]" />
                        </div>
                      </div>
                      <p className="text-xs text-[var(--lava-muted)]">{t('لو سبتهم فاضيين، العرض هيفضل شغال طول ما هو "مفعّل". العرض غير المفعّل أو الخارج عن نطاق التاريخ مابيأثرش على السلة أبداً.', 'If left empty, the promotion stays active as long as it is "Enabled". A disabled or out-of-date-range promotion never affects the cart.')}</p>

                      <div className="flex gap-2 pt-2">
                        <button type="button" onClick={resetCampaignForm} className="bg-[var(--lava-card)] border px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-[var(--lava-secondary)]">{t('إلغاء', 'Cancel')}</button>
                        <button type="button" onClick={saveCampaignPromotion} className="bg-black text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-800">
                          {editingPromotionId ? t('حفظ التعديلات', 'Save Changes') : t('إنشاء العرض', 'Create Promotion')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <p className="text-xs text-[var(--lava-muted)]">⚠️ {t('هذه المرحلة فرونت إند فقط - العروض محسوبة في المتصفح ومش محفوظة على سيرفر. أي تطبيق حقيقي للإنتاج لازم يتحقق من العروض من السيرفر (Backend) بما فيها المخزون وتاريخ استخدام العميل، عشان مايتحايلش عليها من جهة العميل.', "This stage is frontend-only — promotions are calculated in the browser and not persisted on a server. A real production system must validate promotions server-side (including stock and usage history) so they can't be manipulated client-side.")}</p>
                  </div>
                </div>
                )}
              </div>
            )}

            {adminTab === 'discounts' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">🏷️ {t('إدارة أكواد الخصم', 'Discount Codes')}</h2>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const code = document.getElementById('discountCode').value.trim();
                  const percent = document.getElementById('discountPercent').value;
                  const maxUses = Number(document.getElementById('discountMaxUses').value) || 0;
                  const specificProductId = document.getElementById('discountSpecificProduct').value || null;
                  if (!code || !percent) {
                    showToast(t('من فضلك املأ جميع الحقول', 'Please fill in all fields'));
                    return;
                  }
                  const nextDiscountCodes = [...discountCodes, {
                    id: Date.now(),
                    code: code.toUpperCase(),
                    discountPercent: Number(percent),
                    isActive: true,
                    maxUses,
                    usageCount: 0,
                    specificProductId,
                  }];
                  setDiscountCodes(nextDiscountCodes);
                  saveAdminSettings(t('تم إضافة كود الخصم بنجاح!', 'Discount code added!'), { discountCodes: nextDiscountCodes });
                  document.getElementById('discountCode').value = '';
                  document.getElementById('discountPercent').value = '';
                  document.getElementById('discountMaxUses').value = '';
                  document.getElementById('discountSpecificProduct').value = '';
                }} className="space-y-4 border-b pb-8">
                  <div className="flex gap-4 flex-wrap">
                    <input id="discountCode" type="text" placeholder={t('اسم الكود (مثال: WELCOME10)', 'Code name (e.g. WELCOME10)')} className="px-4 py-2 border rounded-lg flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-black" required />
                    <input id="discountPercent" type="number" placeholder={t('نسبة الخصم %', 'Discount %')} className="px-4 py-2 border rounded-lg w-36 focus:outline-none focus:ring-2 focus:ring-black" required min="0" max="100" />
                  </div>
                  <div className="flex gap-4 flex-wrap items-end">
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-sm font-semibold mb-1 text-[var(--lava-muted)]">{t('حد الاستخدام (0 = غير محدود)', 'Max Uses (0 = unlimited)')}</label>
                      <input id="discountMaxUses" type="number" min="0" defaultValue="0" placeholder="0" className="px-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-sm font-semibold mb-1 text-[var(--lava-muted)]">{t('منتج معين فقط (اختياري)', 'Specific Product Only (Optional)')}</label>
                      <select id="discountSpecificProduct" className="px-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]">
                        <option value="">{t('ينطبق على كل المنتجات', 'Applies to all products')}</option>
                        {products.filter(p => (p.visibility || 'published') === 'published').map(p => (
                          <option key={p.id} value={p.id}>{getLocalized(p.name)}</option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold whitespace-nowrap">{t('إضافة كود', 'Add Code')}</button>
                  </div>
                </form>
                <div className="space-y-3 pt-4">
                  <h3 className="font-bold text-lg">{t('أكواد الخصم المتاحة', 'Available Discount Codes')}</h3>
                  {discountCodes.map(c => {
                    const maxUses = Number(c.maxUses) || 0;
                    const usageCount = Number(c.usageCount) || 0;
                    const specificProduct = c.specificProductId ? products.find(p => String(p.id) === String(c.specificProductId)) : null;
                    return (
                    <div key={c.id} className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-2">
                      <div className="flex justify-between items-center flex-wrap gap-3">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="font-bold text-lg bg-black text-white px-4 py-1 rounded font-mono">{c.code}</span>
                          <span className="text-green-600 font-bold">{c.discountPercent}% {t('خصم', 'off')}</span>
                          <span className={`text-sm font-semibold ${c.isActive ? 'text-green-600' : 'text-red-600'}`}>
                            {c.isActive ? '✅ ' + t('مفعل', 'Active') : '❌ ' + t('غير مفعل', 'Inactive')}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => {
                            const nextDiscountCodes = discountCodes.map(x => x.id === c.id ? { ...x, isActive: !x.isActive } : x);
                            setDiscountCodes(nextDiscountCodes);
                            saveAdminSettings(t('تم تحديث حالة كود الخصم', 'Discount code status updated'), { discountCodes: nextDiscountCodes });
                          }} className={`px-3 py-1 rounded text-sm font-bold ${c.isActive ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {c.isActive ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable')}
                          </button>
                          <button onClick={() => {
                            const nextDiscountCodes = discountCodes.filter(x => x.id !== c.id);
                            setDiscountCodes(nextDiscountCodes);
                            saveAdminSettings(t('تم حذف كود الخصم', 'Discount code deleted'), { discountCodes: nextDiscountCodes });
                          }} className="text-red-600 font-bold px-3 py-1 bg-red-50 rounded text-sm">{t('حذف', 'Delete')}</button>
                        </div>
                      </div>
                      <div className="flex gap-4 flex-wrap text-xs text-[var(--lava-muted)]">
                        <span>🔢 {t('الاستخدام:', 'Uses:')} <strong>{usageCount}</strong>{maxUses > 0 ? ` / ${maxUses}` : ` (${t('غير محدود', 'unlimited')})`}</span>
                        {specificProduct && (
                          <span>🎯 {t('منتج:', 'Product:')} <strong>{getLocalized(specificProduct.name)}</strong></span>
                        )}
                        {maxUses > 0 && usageCount >= maxUses && (
                          <span className="text-red-500 font-bold">⚠️ {t('وصل للحد الأقصى', 'Reached limit')}</span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===== تبويب نظام الولاء ===== */}
            {adminTab === 'loyalty' && canAccess('settings') && (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏆</span>
                      <div>
                        <h3 className="font-bold text-lg">{t('نظام الولاء', 'Loyalty Program')}</h3>
                        <p className="text-sm text-[var(--lava-muted)]">{t('كافئ عملاءك الدائمين تلقائياً', 'Automatically reward your loyal customers')}</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => {
                          const next = { ...loyaltyProgram, enabled: !loyaltyProgram.enabled };
                          setLoyaltyProgram(next);
                          adminSettings.current.loyaltyProgram = next;
                          saveAdminSettings(t('تم تحديث نظام الولاء', 'Loyalty program updated'), { loyaltyProgram: next });
                        }}
                        className={`w-12 h-6 rounded-full transition-all cursor-pointer flex items-center px-1 ${loyaltyProgram.enabled ? 'bg-yellow-400' : 'bg-[var(--lava-border)]'}`}
                      >
                        <div className={`w-4 h-4 bg-[var(--lava-card)] rounded-full shadow transition-all ${loyaltyProgram.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                      <span className="font-bold text-sm">{loyaltyProgram.enabled ? t('مفعّل', 'Active') : t('متوقف', 'Inactive')}</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-1">{t('عدد الطلبات للمكافأة', 'Orders Required for Reward')}</label>
                      <input
                        type="number"
                        min="1"
                        value={loyaltyProgram.ordersRequired}
                        onChange={e => setLoyaltyProgram(p => ({ ...p, ordersRequired: Number(e.target.value) || 10 }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                      <p className="text-xs text-[var(--lava-muted)] mt-1">{t('مثال: 10 يعني كل 10 طلبات تلقائياً يبعتله كود', 'e.g. 10 means every 10 orders they get a reward code')}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">{t('نوع المكافأة', 'Reward Type')}</label>
                      <select
                        value={loyaltyProgram.rewardType}
                        onChange={e => setLoyaltyProgram(p => ({ ...p, rewardType: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      >
                        <option value="percentage">{t('نسبة خصم %', 'Percentage Discount %')}</option>
                        <option value="fixed">{t('مبلغ ثابت', 'Fixed Amount')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">
                        {loyaltyProgram.rewardType === 'percentage' ? t('نسبة الخصم %', 'Discount Percentage %') : t('مبلغ الخصم', 'Discount Amount')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={loyaltyProgram.rewardValue}
                        onChange={e => setLoyaltyProgram(p => ({ ...p, rewardValue: Number(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">{t('بادئة الكود', 'Code Prefix')}</label>
                      <input
                        type="text"
                        value={loyaltyProgram.codePrefix}
                        onChange={e => setLoyaltyProgram(p => ({ ...p, codePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                        placeholder="LOYALTY"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono"
                      />
                      <p className="text-xs text-[var(--lava-muted)] mt-1">{t('الكود سيكون مثلاً: LOYALTY-ABC12345', 'Code will look like: LOYALTY-ABC12345')}</p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold mb-1">{t('منتج معين فقط (اختياري)', 'Specific Product Only (Optional)')}</label>
                      <select
                        value={loyaltyProgram.specificProductId || ''}
                        onChange={e => setLoyaltyProgram(p => ({ ...p, specificProductId: e.target.value || null }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      >
                        <option value="">{t('ينطبق على كل الطلبات', 'Applies to all orders')}</option>
                        {products.filter(p => (p.visibility || 'published') === 'published').map(p => (
                          <option key={p.id} value={p.id}>{getLocalized(p.name)}</option>
                        ))}
                      </select>
                      <p className="text-xs text-[var(--lava-muted)] mt-1">{t('لو اخترت منتج، الكود بيشتغل فقط لو المنتج ده في الطلب', 'If selected, code only works if this product is in the order')}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">{t('رسالة الاستحقاق (عربي)', 'Reward Message (Arabic)')}</label>
                      <input
                        type="text"
                        value={loyaltyProgram.message?.ar || ''}
                        onChange={e => setLoyaltyProgram(p => ({ ...p, message: { ...p.message, ar: e.target.value } }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">{t('رسالة الاستحقاق (إنجليزي)', 'Reward Message (English)')}</label>
                      <input
                        type="text"
                        value={loyaltyProgram.message?.en || ''}
                        onChange={e => setLoyaltyProgram(p => ({ ...p, message: { ...p.message, en: e.target.value } }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      adminSettings.current.loyaltyProgram = loyaltyProgram;
                      saveAdminSettings(t('تم حفظ إعدادات الولاء!', 'Loyalty settings saved!'), { loyaltyProgram });
                    }}
                    className="mt-4 bg-yellow-400 text-black font-bold px-6 py-2.5 rounded-xl hover:bg-yellow-500 transition flex items-center gap-2"
                  >
                    💾 {t('حفظ إعدادات الولاء', 'Save Loyalty Settings')}
                  </button>
                </div>

                {/* ===== ملخص إحصائيات الولاء ===== */}
                <div className="bg-[var(--lava-card)] border rounded-xl p-5">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <span>📊</span> {t('إحصائيات الولاء', 'Loyalty Statistics')}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <p className="text-2xl font-black text-yellow-600">
                        {orders.filter(o => o.customerId).length}
                      </p>
                      <p className="text-xs text-[var(--lava-muted)] mt-1">{t('طلبات العملاء المسجلين', 'Registered Customer Orders')}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <p className="text-2xl font-black text-yellow-600">
                        {orders.filter(o => o.discountType === 'loyalty_code').length}
                      </p>
                      <p className="text-xs text-[var(--lava-muted)] mt-1">{t('طلبات بكود ولاء', 'Orders with Loyalty Code')}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <p className="text-2xl font-black text-yellow-600">
                        {loyaltyProgram.ordersRequired}
                      </p>
                      <p className="text-xs text-[var(--lava-muted)] mt-1">{t('طلبات للمكافأة', 'Orders for Reward')}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <p className="text-2xl font-black text-yellow-600">
                        {loyaltyProgram.rewardType === 'percentage' ? `${loyaltyProgram.rewardValue}%` : `${loyaltyProgram.rewardValue} ج.م`}
                      </p>
                      <p className="text-xs text-[var(--lava-muted)] mt-1">{t('قيمة المكافأة', 'Reward Value')}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== تبويب المصاريف ===== */}
            {adminTab === 'expenses' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">{t('المصاريف النثرية', 'Miscellaneous Expenses')}</h2>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!newExpenseTitle || !newExpenseAmount) return;
                  // بنسجل تاريخ المصروف اللي اختاره الأدمن (مش وقت الإضافة نفسه)،
                  // عشان لو حد ضاف مصروف قديم متأخر، يتحسب في الفترة الصح في
                  // لوحة البيانات مش في فترة النهاردة بالغلط.
                  const chosenDate = newExpenseDate || new Date().toISOString().slice(0, 10);
                  const nextExpenses = [...expenses, { id: Date.now(), title: newExpenseTitle, amount: Number(newExpenseAmount), date: chosenDate, category: newExpenseCategory || 'أخرى' }];
                  setExpenses(nextExpenses);
                  saveAdminSettings(t('تم تسجيل المصروف!', 'Expense recorded!'), { expenses: nextExpenses });
                  setNewExpenseTitle('');
                  setNewExpenseAmount('');
                  setNewExpenseDate(new Date().toISOString().slice(0, 10));
                }} className="flex flex-wrap gap-4 border-b pb-8">
                  <input type="text" value={newExpenseTitle} onChange={(e) => setNewExpenseTitle(e.target.value)} placeholder={t('اسم المصروف', 'Expense Name')} className="px-4 py-2 border rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-black" required />
                  <select value={newExpenseCategory} onChange={(e) => setNewExpenseCategory(e.target.value)} className="px-4 py-2 border rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-black">
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c.key} value={c.key}>{t(c.key, c.en)}</option>
                    ))}
                  </select>
                  <input type="number" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} placeholder={t('المبلغ', 'Amount')} className="px-4 py-2 border rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-black" required />
                  <input type="date" value={newExpenseDate} onChange={(e) => setNewExpenseDate(e.target.value)} className="px-4 py-2 border rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-black" required />
                  <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold">{t('إضافة', 'Add')}</button>
                </form>
                <div className="space-y-2 pt-4">
                  {[...expenses].sort((a, b) => {
                    const da = a.date ? new Date(a.date).getTime() : (a.id || 0);
                    const db = b.date ? new Date(b.date).getTime() : (b.id || 0);
                    return db - da;
                  }).map(ex => (
                    <div key={ex.id} className="flex justify-between items-center bg-[var(--lava-secondary)] p-3 rounded border gap-3">
                      <div className="flex flex-col">
                        <span>{ex.title} {ex.category && <span className="text-xs text-[var(--lava-muted)] font-normal">— {t(ex.category, EXPENSE_CATEGORIES.find(c=>c.key===ex.category)?.en || ex.category)}</span>}</span>
                        <span className="text-xs text-[var(--lava-muted)]">
                          {ex.date
                            ? new Date(ex.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB')
                            : t('بدون تاريخ (مصروف قديم)', 'No date (legacy expense)')}
                        </span>
                      </div>
                      <span className="font-bold text-red-600 whitespace-nowrap">{ex.amount} {t('ج.م', 'EGP')}</span>
                      <button onClick={() => {
                        const nextExpenses = expenses.filter(e => e.id !== ex.id);
                        setExpenses(nextExpenses);
                        saveAdminSettings(t('تم حذف المصروف', 'Expense deleted'), { expenses: nextExpenses });
                      }} className="text-red-600 font-bold px-2 hover:underline">{t('حذف', 'Delete')}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== تبويب الأسئلة الشائعة ===== */}
            {adminTab === 'faqs' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">{t('الأسئلة الشائعة', 'FAQs')} ({faqs.length})</h2>

                {/* فورم الإضافة / التعديل */}
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!newFaqQAr || !newFaqAAr) {
                    showToast(t('من فضلك أدخل السؤال والجواب بالعربي على الأقل', 'Please enter question and answer in Arabic at least'));
                    return;
                  }
                  const faqEntry = {
                    id: editingFaqId || Date.now(),
                    q: { ar: newFaqQAr.trim(), en: newFaqQEn.trim() },
                    a: { ar: newFaqAAr.trim(), en: newFaqAEn.trim() },
                  };
                  const nextFaqs = editingFaqId
                    ? faqs.map(f => f.id === editingFaqId ? faqEntry : f)
                    : [...faqs, faqEntry];
                  setFaqs(nextFaqs);
                  saveAdminSettings(
                    editingFaqId ? t('تم تعديل السؤال!', 'FAQ updated!') : t('تم إضافة السؤال!', 'FAQ added!'),
                    { faqs: nextFaqs }
                  );
                  setNewFaqQAr(''); setNewFaqQEn(''); setNewFaqAAr(''); setNewFaqAEn('');
                  setEditingFaqId(null);
                }} className="space-y-3 border-b pb-8">
                  <p className="font-bold text-[var(--lava-text)]">{editingFaqId ? t('تعديل السؤال', 'Edit FAQ') : t('إضافة سؤال جديد', 'Add New FAQ')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text" value={newFaqQAr} onChange={e => setNewFaqQAr(e.target.value)}
                      placeholder={t('السؤال بالعربي *', 'Question in Arabic *')}
                      className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required
                    />
                    <input
                      type="text" value={newFaqQEn} onChange={e => setNewFaqQEn(e.target.value)}
                      placeholder={t('السؤال بالإنجليزي', 'Question in English')}
                      className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <textarea
                      value={newFaqAAr} onChange={e => setNewFaqAAr(e.target.value)}
                      placeholder={t('الجواب بالعربي *', 'Answer in Arabic *')}
                      rows={3}
                      className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none" required
                    />
                    <textarea
                      value={newFaqAEn} onChange={e => setNewFaqAEn(e.target.value)}
                      placeholder={t('الجواب بالإنجليزي', 'Answer in English')}
                      rows={3}
                      className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold">
                      {editingFaqId ? t('حفظ التعديل', 'Save Changes') : t('إضافة', 'Add')}
                    </button>
                    {editingFaqId && (
                      <button type="button" onClick={() => {
                        setEditingFaqId(null);
                        setNewFaqQAr(''); setNewFaqQEn(''); setNewFaqAAr(''); setNewFaqAEn('');
                      }} className="px-6 py-2 rounded-lg font-bold border border-[var(--lava-border)] hover:bg-[var(--lava-secondary)]">
                        {t('إلغاء', 'Cancel')}
                      </button>
                    )}
                  </div>
                </form>

                {/* قائمة الأسئلة */}
                <div className="space-y-3 pt-2">
                  {faqs.length === 0 && (
                    <p className="text-[var(--lava-muted)] text-center py-6">{t('لا توجد أسئلة شائعة حتى الآن.', 'No FAQs yet.')}</p>
                  )}
                  {faqs.map((faq, index) => (
                    <div key={faq.id} className="bg-[var(--lava-secondary)] border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--lava-text)]">{faq.q?.ar || faq.q}</p>
                          {faq.q?.en && <p className="text-sm text-[var(--lava-muted)]">{faq.q.en}</p>}
                          <p className="text-[var(--lava-muted)] mt-1 text-sm">{faq.a?.ar || faq.a}</p>
                          {faq.a?.en && <p className="text-xs text-[var(--lava-muted)]">{faq.a.en}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => {
                            setEditingFaqId(faq.id);
                            setNewFaqQAr(faq.q?.ar || '');
                            setNewFaqQEn(faq.q?.en || '');
                            setNewFaqAAr(faq.a?.ar || '');
                            setNewFaqAEn(faq.a?.en || '');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} className="text-blue-600 font-bold px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-sm">
                            {t('تعديل', 'Edit')}
                          </button>
                          <button onClick={() => {
                            const nextFaqs = faqs.filter(f => f.id !== faq.id);
                            setFaqs(nextFaqs);
                            saveAdminSettings(t('تم حذف السؤال', 'FAQ deleted'), { faqs: nextFaqs });
                          }} className="text-red-600 font-bold px-3 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition text-sm">
                            {t('حذف', 'Delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== تبويب الرسائل ===== */}
            {adminTab === 'messages' && canAccess('messages') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">{t('رسائل العملاء', 'Customer Messages')} ({contactMessages.length})</h2>
                {contactMessages.map(msg => (
                  <div key={msg.id} className="border p-4 rounded-lg bg-[var(--lava-secondary)] space-y-2">
                    <p className="font-bold">{msg.name} ({msg.phone})</p>
                    <p className="text-[var(--lava-text)] bg-[var(--lava-card)] p-3 rounded border">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ===== تبويب تقييمات العملاء (موافقة/رفض) ===== */}
            {adminTab === 'reviews' && canAccess('reviews') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-2xl font-bold">{t('تقييمات العملاء', 'Customer Reviews')}</h2>
                  <div className="flex gap-2">
                    {[
                      { value: 'pending', label: t('قيد المراجعة', 'Pending') },
                      { value: 'approved', label: t('تمت الموافقة', 'Approved') },
                      { value: 'rejected', label: t('مرفوضة', 'Rejected') },
                      { value: 'all', label: t('الكل', 'All') },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setAdminReviewsStatusFilter(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold ${adminReviewsStatusFilter === opt.value ? 'bg-black text-white' : 'bg-[var(--lava-secondary)] text-[var(--lava-text)]'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {adminReviewsLoading ? (
                  <p className="text-[var(--lava-muted)]">{t('جارٍ التحميل...', 'Loading...')}</p>
                ) : adminReviews.length === 0 ? (
                  <p className="text-[var(--lava-muted)]">{t('لا توجد تقييمات في هذه القائمة', 'No reviews in this list')}</p>
                ) : (
                  <div className="space-y-4">
                    {adminReviews.map(r => (
                      <div key={r.id} className="border rounded-lg p-4 bg-[var(--lava-secondary)] flex flex-col md:flex-row gap-4">
                        {r.image && (
                          <img
                            src={r.image}
                            alt=""
                            className="w-24 h-24 object-cover rounded-lg border shrink-0 cursor-pointer"
                            onClick={() => window.open(r.image, '_blank', 'noopener,noreferrer')}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-bold">{r.name}</span>
                              {r.productId?.name && (
                                <span className="text-sm text-[var(--lava-muted)] ms-2">— {getLocalized(r.productId.name)}</span>
                              )}
                              {r.verifiedPurchase && (
                                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full ms-2">{t('عملية شراء موثقة', 'Verified Purchase')}</span>
                              )}
                            </div>
                            <span className="text-yellow-500 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          </div>
                          <p className="text-sm text-[var(--lava-text)] mt-2 bg-[var(--lava-card)] p-3 rounded border">{r.comment}</p>
                          <div className="flex gap-2 mt-3">
                            {r.status !== 'approved' && (
                              <button onClick={() => moderateReviewStatus(r.id, 'approved')} className="bg-green-600 text-white text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-green-700">
                                {t('موافقة', 'Approve')}
                              </button>
                            )}
                            {r.status !== 'rejected' && (
                              <button onClick={() => moderateReviewStatus(r.id, 'rejected')} className="bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-red-700">
                                {t('رفض', 'Reject')}
                              </button>
                            )}
                            <button onClick={() => deleteAdminReview(r.id)} className="bg-[var(--lava-border)] text-[var(--lava-text)] text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-[var(--lava-border)]">
                              {t('حذف', 'Delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== تبويب الموظفين ===== */}
            {adminTab === 'staff' && user.role === 'admin' && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">{t('إدارة الموظفين', 'Staff Management')}</h2>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if(!newStaffName || !newStaffEmail || !newStaffPassword) return;
                    const permissionsPayload = Object.entries(newStaffPermissions)
                      .filter(([, access]) => access === 'view' || access === 'edit')
                      .map(([section, access]) => ({ section, access }));
                    if (newStaffRole === 'staff' && permissionsPayload.length === 0) {
                      showToast(t('لازم تحدد قسم واحد على الأقل للموظف', 'Pick at least one section for this staff member'));
                      return;
                    }
                    try {
                      await staffAPI.add({
                          name: newStaffName,
                          email: newStaffEmail,
                          phone: newStaffPhone,
                          password: newStaffPassword,
                          role: newStaffRole,
                          permissions: newStaffRole === 'staff' ? permissionsPayload : undefined,
                      });
                      const freshList = await staffAPI.getAll();
                      setStaffList(freshList);
                      setNewStaffName('');
                      setNewStaffEmail('');
                      setNewStaffPhone('');
                      setNewStaffPassword('');
                      setNewStaffRole('call_center');
                      setNewStaffPermissions({});
                      showToast(t('تم إضافة الموظف بنجاح!', 'Staff added!'));
                    } catch (err) {
                      const msg = err?.response?.data?.message;
                      showToast(msg || t('حصل خطأ في إضافة الموظف', 'Error adding staff'));
                    }
                }} className="space-y-4 border-b pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label={t('اسم الموظف', 'Staff Name')} type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} required={true} id="sName"/>
                        <InputField label={t('البريد الإلكتروني', 'Email')} type="email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} required={true} id="sEmail"/>
                        <InputField label={t('كلمة المرور', 'Password')} type="text" value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} required={true} id="sPass"/>
                        <InputField label={t('رقم الهاتف', 'Phone')} type="tel" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)} id="sPhone"/>
                        <SelectField label={t('الصلاحية', 'Role')} value={newStaffRole} onChange={e => { setNewStaffRole(e.target.value); setNewStaffPermissions({}); }} options={[
                          {value: 'call_center', label: t('مؤكد طلبات / خدمة عملاء', 'Call Center / Support')},
                          {value: 'packer', label: t('محضر طلبات', 'Packer')},
                          {value: 'staff', label: t('صلاحيات مخصصة (تختارها أنت)', 'Custom permissions (you choose)')},
                        ]} id="sRole" />
                    </div>

                    {newStaffRole === 'staff' && (
                      <div className="border rounded-lg p-4 bg-[var(--lava-secondary)] space-y-3">
                        <p className="font-bold text-sm">{t('حدد الأقسام اللي الموظف ده يقدر يشوفها، ولكل قسم اختار "عرض فقط" أو "عرض وتعديل":', 'Pick the sections this staff member can access, and for each one choose "View only" or "View & edit":')}</p>
                        {staffSections.length === 0 ? (
                          <p className="text-sm text-[var(--lava-muted)]">{t('جاري تحميل الأقسام...', 'Loading sections...')}</p>
                        ) : (
                          <div className="space-y-2 max-h-80 overflow-y-auto pe-2">
                            {staffSections.map(sec => (
                              <div key={sec.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-[var(--lava-card)] border rounded-lg p-3">
                                <span className="text-sm font-semibold">{sec.label}</span>
                                <div className="flex gap-2">
                                  {[
                                    { value: 'none', label: t('بدون', 'None') },
                                    { value: 'view', label: t('عرض فقط', 'View only') },
                                    { value: 'edit', label: t('عرض وتعديل', 'View & edit') },
                                  ].map(opt => (
                                    <button
                                      type="button"
                                      key={opt.value}
                                      onClick={() => setNewStaffPermissions(prev => {
                                        const next = { ...prev };
                                        if (opt.value === 'none') delete next[sec.key];
                                        else next[sec.key] = opt.value;
                                        return next;
                                      })}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                                        (newStaffPermissions[sec.key] || 'none') === opt.value
                                          ? 'bg-black text-white border-black'
                                          : 'bg-[var(--lava-card)] text-[var(--lava-muted)] border-[var(--lava-border)] hover:bg-[var(--lava-secondary)]'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold">{t('إضافة موظف', 'Add Staff')}</button>
                </form>
                <div className="space-y-3 pt-4">
                    {staffList.length === 0 ? <p className="text-[var(--lava-muted)]">{t('لا يوجد موظفين حتى الآن.', 'No staff yet.')}</p> : staffList.map(staff => {
                      const sid = staff._id || staff.id;
                      const roleLabel = staff.role === 'packer'
                        ? t('محضر طلبات', 'Packer')
                        : staff.role === 'staff'
                          ? t('صلاحيات مخصصة', 'Custom permissions')
                          : t('مؤكد طلبات', 'Call Center');
                      const isEditing = editingStaffId === sid;
                      return (
                        <div key={sid} className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-3">
                            <div className="flex justify-between items-center">
                              <div>
                                  <p className="font-bold">{staff.name} <span className="text-sm text-blue-600 me-2">({roleLabel})</span></p>
                                  <p className="text-sm text-[var(--lava-muted)] mt-1">{t('الايميل:', 'Email:')} {staff.email}</p>
                                  {staff.role === 'staff' && Array.isArray(staff.permissions) && staff.permissions.length > 0 && (
                                    <p className="text-xs text-[var(--lava-muted)] mt-1">
                                      {staff.permissions.map(p => {
                                        const secLabel = staffSections.find(s => s.key === p.section)?.label || p.section;
                                        return `${secLabel} (${p.access === 'edit' ? t('تعديل', 'edit') : t('عرض', 'view')})`;
                                      }).join(' • ')}
                                    </p>
                                  )}
                              </div>
                              <div className="flex gap-2">
                                {staff.role === 'staff' && (
                                  <button onClick={() => {
                                    if (isEditing) { setEditingStaffId(null); return; }
                                    const map = {};
                                    (staff.permissions || []).forEach(p => { map[p.section] = p.access; });
                                    setEditingStaffPermissions(map);
                                    setEditingStaffId(sid);
                                  }} className="text-blue-600 font-bold px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-sm">
                                    {isEditing ? t('إلغاء', 'Cancel') : t('تعديل الصلاحيات', 'Edit permissions')}
                                  </button>
                                )}
                                <button onClick={async () => {
                                    try {
                                      await staffAPI.remove(sid);
                                      setStaffList(staffList.filter(s => (s._id || s.id) !== sid));
                                    } catch (err) {
                                      showToast(t('حصل خطأ في حذف الموظف', 'Error deleting staff'));
                                    }
                                }} className="text-red-600 font-bold px-4 py-2 bg-red-50 hover:bg-red-100 rounded-lg transition text-sm">{t('حذف', 'Delete')}</button>
                              </div>
                            </div>

                            {isEditing && (
                              <div className="border rounded-lg p-4 bg-[var(--lava-card)] space-y-2">
                                {staffSections.map(sec => (
                                  <div key={sec.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
                                    <span className="text-sm font-semibold">{sec.label}</span>
                                    <div className="flex gap-2">
                                      {[
                                        { value: 'none', label: t('بدون', 'None') },
                                        { value: 'view', label: t('عرض فقط', 'View only') },
                                        { value: 'edit', label: t('عرض وتعديل', 'View & edit') },
                                      ].map(opt => (
                                        <button
                                          type="button"
                                          key={opt.value}
                                          onClick={() => setEditingStaffPermissions(prev => {
                                            const next = { ...prev };
                                            if (opt.value === 'none') delete next[sec.key];
                                            else next[sec.key] = opt.value;
                                            return next;
                                          })}
                                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                                            (editingStaffPermissions[sec.key] || 'none') === opt.value
                                              ? 'bg-black text-white border-black'
                                              : 'bg-[var(--lava-card)] text-[var(--lava-muted)] border-[var(--lava-border)] hover:bg-[var(--lava-secondary)]'
                                          }`}
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const permissionsPayload = Object.entries(editingStaffPermissions)
                                      .filter(([, access]) => access === 'view' || access === 'edit')
                                      .map(([section, access]) => ({ section, access }));
                                    if (permissionsPayload.length === 0) {
                                      showToast(t('لازم تحدد قسم واحد على الأقل للموظف', 'Pick at least one section for this staff member'));
                                      return;
                                    }
                                    try {
                                      await staffAPI.update(sid, { permissions: permissionsPayload });
                                      const freshList = await staffAPI.getAll();
                                      setStaffList(freshList);
                                      setEditingStaffId(null);
                                      showToast(t('تم تحديث صلاحيات الموظف', 'Staff permissions updated'));
                                    } catch (err) {
                                      const msg = err?.response?.data?.message;
                                      showToast(msg || t('حصل خطأ في تحديث الصلاحيات', 'Error updating permissions'));
                                    }
                                  }}
                                  className="bg-black text-white px-5 py-2 rounded-lg font-bold text-sm"
                                >
                                  {t('حفظ الصلاحيات', 'Save permissions')}
                                </button>
                              </div>
                            )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ===== تبويب العملاء ===== */}
            {adminTab === 'customers' && canAccess('customers') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">{t('العملاء', 'Customers')}</h2>
                <AdminPaginationBar
                  page={customersPage} setPage={setCustomersPage}
                  pageSize={customersPageSize} setPageSize={setCustomersPageSize}
                  totalPages={customersTotalPages} total={customersTotal}
                  onRefresh={() => fetchCustomers()} loading={customersLoading} t={t}
                />
                {customersLoading && customersList.length === 0 ? (
                  <p className="text-[var(--lava-muted)]">{t('جاري التحميل...', 'Loading...')}</p>
                ) : customersList.length === 0 ? (
                  <p className="text-[var(--lava-muted)]">{t('لا يوجد عملاء مسجلين حتى الآن.', 'No registered customers yet.')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-start border-collapse">
                      <thead>
                        <tr className="border-b text-[var(--lava-muted)] font-bold">
                          <th className="py-2 px-3 text-start">{t('الاسم', 'Name')}</th>
                          <th className="py-2 px-3 text-start">{t('البريد الإلكتروني', 'Email')}</th>
                          <th className="py-2 px-3 text-start">{t('رقم الهاتف', 'Phone')}</th>
                          <th className="py-2 px-3 text-start">{t('عدد الطلبات', 'Orders')}</th>
                          <th className="py-2 px-3 text-start">{t('إجمالي المشتريات', 'Total Spent')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customersList.map((cust) => (
                          <tr
                            key={cust._id || cust.id}
                            onClick={async () => {
                              setSelectedCustomer(cust);
                              setSelectedCustomerOrders([]);
                              setCustomerOrdersLoading(true);
                              try {
                                const result = await customersAPI.getOrders(cust._id || cust.id);
                                setSelectedCustomerOrders((result?.orders || []).map(o => ({ ...o, id: o._id })));
                              } catch (err) {
                                console.error('تعذّر تحميل طلبات العميل:', err);
                                showToast(t('حصل خطأ في جلب طلبات العميل', 'Error loading customer orders'));
                              } finally {
                                setCustomerOrdersLoading(false);
                              }
                            }}
                            className="border-b hover:bg-[var(--lava-secondary)] cursor-pointer transition"
                          >
                            <td className="py-2.5 px-3 font-semibold">{cust.name}</td>
                            <td className="py-2.5 px-3 text-[var(--lava-muted)]" dir="ltr">{cust.email}</td>
                            <td className="py-2.5 px-3 text-[var(--lava-muted)]" dir="ltr">{cust.phone}</td>
                            <td className="py-2.5 px-3">{cust.ordersCount || 0}</td>
                            <td className="py-2.5 px-3 font-semibold">{cust.totalSpent || 0} {t('ج.م', 'EGP')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ===== مودال طلبات العميل ===== */}
                {selectedCustomer && (
                  <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    <div
                      className="bg-[var(--lava-card)] rounded-xl shadow-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold">{selectedCustomer.name}</h3>
                          <p className="text-sm text-[var(--lava-muted)] mt-1" dir="ltr">{selectedCustomer.email}</p>
                          <p className="text-sm text-[var(--lava-muted)]" dir="ltr">{selectedCustomer.phone}</p>
                        </div>
                        <button
                          onClick={() => setSelectedCustomer(null)}
                          className="text-[var(--lava-muted)] hover:text-[var(--lava-text)] text-2xl leading-none"
                        >
                          &times;
                        </button>
                      </div>

                      <div className="border-t pt-4 space-y-3">
                        <p className="font-bold text-[var(--lava-text)] text-sm">📦 {t('الطلبات السابقة', 'Previous Orders')}</p>
                        {customerOrdersLoading ? (
                          <p className="text-[var(--lava-muted)] text-sm">{t('جاري التحميل...', 'Loading...')}</p>
                        ) : selectedCustomerOrders.length === 0 ? (
                          <p className="text-[var(--lava-muted)] text-sm">{t('مفيش طلبات لهذا العميل.', 'No orders for this customer.')}</p>
                        ) : (
                          selectedCustomerOrders.map((ord) => (
                            <div key={ord.id} className="border rounded-lg p-4 bg-[var(--lava-secondary)] space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="font-bold text-sm">{t('طلب', 'Order')} #{ord.orderNumber || ord.id}</span>
                                <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                                  ord.status === t('تم التسليم', 'Delivered') ? 'bg-green-100 text-green-700' :
                                  ord.status === t('تم التأكيد', 'Confirmed') ? 'bg-blue-100 text-blue-700' :
                                  ord.status === t('ملغي', 'Cancelled') ? 'bg-red-100 text-red-700' :
                                  ord.status === t('مرتجع', 'Returned') ? 'bg-orange-100 text-orange-700' :
                                  ord.status === t('مستبدل', 'Exchanged') ? 'bg-purple-100 text-purple-700' :
                                  'bg-[var(--lava-border)] text-[var(--lava-muted)]'
                                }`}>{ord.status}</span>
                              </div>
                              <p className="text-xs text-[var(--lava-muted)]">
                                {new Date(ord.createdAt).toLocaleDateString()}
                              </p>
                              <div className="space-y-1">
                                {(ord.items || []).map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-[var(--lava-text)]">
                                      {getLocalized(item.name) || getLocalized(item.productName) || t('منتج', 'Product')}
                                      {item.size ? ` (${item.size})` : ''}
                                      {item.quantity ? ` × ${item.quantity}` : ''}
                                    </span>
                                    <span className="text-[var(--lava-muted)]">{item.price} {t('ج.م', 'EGP')}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between font-bold text-sm border-t pt-2">
                                <span>{t('الإجمالي', 'Total')}</span>
                                <span>{ord.totalAmount} {t('ج.م', 'EGP')}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== تبويب شرائح العملاء (Customer Segments) ===== */}
            {adminTab === 'customer_segments' && canAccess('customer_segments') && (() => {
              const segmentDefs = [
                { key: 'newCustomers', label: t('عملاء جدد', 'New Customers'), icon: '🆕', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                { key: 'returningCustomers', label: t('عملاء عائدون', 'Returning Customers'), icon: '🔁', color: 'bg-green-50 text-green-700 border-green-200' },
                { key: 'vip', label: t('عملاء VIP', 'VIP'), icon: '👑', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                { key: 'highSpenders', label: t('كثيرو الإنفاق', 'High Spenders'), icon: '💰', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                { key: 'inactiveCustomers', label: t('عملاء غير نشطين', 'Inactive Customers'), icon: '😴', color: 'bg-[var(--lava-secondary)] text-[var(--lava-muted)] border-[var(--lava-border)]' },
                { key: 'frequentBuyers', label: t('متكررو الشراء', 'Frequent Buyers'), icon: '🛍️', color: 'bg-pink-50 text-pink-700 border-pink-200' },
              ];
              return (
                <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">{t('شرائح العملاء', 'Customer Segments')}</h2>
                    <button
                      onClick={fetchCustomerSegments}
                      className="text-sm font-bold text-blue-600 hover:underline"
                    >
                      {t('تحديث', 'Refresh')}
                    </button>
                  </div>

                  {customerSegmentsLoading ? (
                    <p className="text-[var(--lava-muted)]">{t('جاري التحميل...', 'Loading...')}</p>
                  ) : !customerSegments ? (
                    <p className="text-[var(--lava-muted)]">{t('لا توجد بيانات حتى الآن.', 'No data yet.')}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {segmentDefs.map(seg => {
                          const list = customerSegments.segments?.[seg.key] || [];
                          const isActive = activeSegmentKey === seg.key;
                          return (
                            <button
                              type="button"
                              key={seg.key}
                              onClick={() => setActiveSegmentKey(isActive ? null : seg.key)}
                              className={`text-start border rounded-xl p-4 transition-all ${seg.color} ${isActive ? 'ring-2 ring-offset-1 ring-black shadow-md' : 'hover:shadow-sm'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-2xl">{seg.icon}</span>
                                <span className="text-2xl font-extrabold">{customerSegments.summary?.[seg.key] || 0}</span>
                              </div>
                              <p className="font-bold text-sm">{seg.label}</p>
                              <p className="text-xs mt-1 opacity-70">
                                {list.length === 0
                                  ? t('لا يوجد عملاء', 'No customers')
                                  : isActive
                                    ? t('اضغط للإخفاء ▲', 'Click to hide ▲')
                                    : t('اضغط لعرض التفاصيل ▼', 'Click to view details ▼')}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      {/* ===== تفاصيل الشريحة المختارة ===== */}
                      {activeSegmentKey && (() => {
                        const seg = segmentDefs.find(s => s.key === activeSegmentKey);
                        const list = customerSegments.segments?.[activeSegmentKey] || [];
                        if (!seg) return null;
                        return (
                          <div className="pt-4 border-t">
                            <h3 className="font-bold text-[var(--lava-text)] mb-2 flex items-center gap-2">
                              <span>{seg.icon}</span> {seg.label} <span className="text-[var(--lava-muted)] font-normal">({list.length})</span>
                            </h3>
                            {list.length === 0 ? (
                              <p className="text-[var(--lava-muted)] text-sm">{t('لا يوجد عملاء في هذه الشريحة.', 'No customers in this segment.')}</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm text-start border-collapse">
                                  <thead>
                                    <tr className="border-b text-[var(--lava-muted)] font-bold">
                                      <th className="py-2 px-3 text-start">{t('الاسم', 'Name')}</th>
                                      <th className="py-2 px-3 text-start">{t('رقم الهاتف', 'Phone')}</th>
                                      <th className="py-2 px-3 text-start">{t('عدد الطلبات', 'Orders')}</th>
                                      <th className="py-2 px-3 text-start">{t('إجمالي المشتريات', 'Total Spent')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {list.slice(0, 20).map((cust) => (
                                      <tr key={cust._id} className="border-b">
                                        <td className="py-2 px-3 font-semibold">{cust.name}</td>
                                        <td className="py-2 px-3 text-[var(--lava-muted)]" dir="ltr">{cust.phone}</td>
                                        <td className="py-2 px-3">{cust.ordersCount || 0}</td>
                                        <td className="py-2 px-3 font-semibold">{cust.totalSpent || 0} {t('ج.م', 'EGP')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {list.length > 20 && (
                                  <p className="text-xs text-[var(--lava-muted)] mt-2">{t(`+${list.length - 20} عميل آخر`, `+${list.length - 20} more`)}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              );
            })()}

            {/* ===== تبويب جاهزية المتجر (Store Health) ===== */}
            {adminTab === 'store_health' && canAccess('store_health') && (() => {
              const checklist = storeHealth?.checklist || [];
              const percentage = storeHealth?.percentage ?? 0;
              const firstMissing = checklist.find(c => !c.done);
              const missingTabMap = {
                logo: 'content',
                theme: 'themes',
                products: 'products',
                shipping: 'shipping',
                payment: 'checkout_settings',
                domain: 'apikeys',
                seo: 'products',
              };
              return (
                <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">{t('جاهزية المتجر', 'Store Health')}</h2>
                    <button
                      onClick={fetchStoreHealth}
                      className="text-sm font-bold text-blue-600 hover:underline"
                    >
                      {t('تحديث', 'Refresh')}
                    </button>
                  </div>

                  {storeHealthLoading ? (
                    <p className="text-[var(--lava-muted)]">{t('جاري التحميل...', 'Loading...')}</p>
                  ) : !storeHealth ? (
                    <p className="text-[var(--lava-muted)]">{t('لا توجد بيانات حتى الآن.', 'No data yet.')}</p>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-[var(--lava-text)]">{t(`متجرك جاهز بنسبة ${percentage}%`, `Your store is ${percentage}% ready`)}</p>
                          <span className="text-2xl font-extrabold" style={{ color: percentage === 100 ? '#16a34a' : percentage >= 60 ? '#f59e0b' : '#dc2626' }}>{percentage}%</span>
                        </div>
                        <div className="w-full h-3 bg-[var(--lava-secondary)] rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-500"
                            style={{ width: `${percentage}%`, backgroundColor: percentage === 100 ? '#16a34a' : percentage >= 60 ? '#f59e0b' : '#dc2626' }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {checklist.map(item => (
                          <div key={item.key} className="flex items-center justify-between bg-[var(--lava-secondary)] border rounded-lg px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className={item.done ? 'text-green-600' : 'text-orange-500'}>{item.done ? '✅' : '⚠️'}</span>
                              <span className="font-semibold text-[var(--lava-text)]">{getLocalized(item.label)}</span>
                            </div>
                            {!item.done && missingTabMap[item.key] && (
                              <button
                                onClick={() => setAdminTab(missingTabMap[item.key])}
                                className="text-sm font-bold text-blue-600 hover:underline"
                              >
                                {t('إكمال الإعداد →', 'Complete setup →')}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {firstMissing && missingTabMap[firstMissing.key] && (
                        <button
                          onClick={() => setAdminTab(missingTabMap[firstMissing.key])}
                          className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition"
                        >
                          {t('إكمال الإعداد →', 'Complete setup →')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {/* ===== تبويب سجل النشاط (Activity Log) ===== */}
            {adminTab === 'activity_log' && canAccess('activity_log') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold">{t('سجل النشاط', 'Activity Log')}</h2>
                  <div className="flex items-center gap-2">
                    <SelectField
                      value={activityLogFilter}
                      onChange={(e) => setActivityLogFilter(e.target.value)}
                      options={[
                        { value: 'all', label: t('الكل', 'All') },
                        { value: 'product', label: t('المنتجات', 'Products') },
                        { value: 'order', label: t('الطلبات', 'Orders') },
                        { value: 'settings', label: t('الإعدادات', 'Settings') },
                        { value: 'staff', label: t('الموظفين', 'Staff') },
                      ]}
                      id="activityLogFilter"
                    />
                    <button
                      onClick={() => fetchActivityLogs()}
                      className="text-sm font-bold text-blue-600 hover:underline whitespace-nowrap"
                    >
                      {t('تحديث', 'Refresh')}
                    </button>
                  </div>
                </div>

                <AdminPaginationBar
                  page={activityLogsPage} setPage={setActivityLogsPage}
                  pageSize={activityLogsPageSize} setPageSize={setActivityLogsPageSize}
                  totalPages={activityLogsTotalPages} total={activityLogsTotal}
                  onRefresh={() => fetchActivityLogs()} loading={activityLogsLoading} t={t}
                />

                {activityLogsLoading && activityLogs.length === 0 ? (
                  <p className="text-[var(--lava-muted)]">{t('جاري التحميل...', 'Loading...')}</p>
                ) : activityLogs.length === 0 ? (
                  <p className="text-[var(--lava-muted)]">{t('لا يوجد نشاط مسجل حتى الآن.', 'No activity logged yet.')}</p>
                ) : (
                  <div className="space-y-2">
                    {activityLogs.map((log) => (
                      <div key={log._id} className="flex items-start justify-between gap-3 bg-[var(--lava-secondary)] border rounded-lg px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[var(--lava-text)]">{log.description}</p>
                          <p className="text-xs text-[var(--lava-muted)] mt-1">{log.userName} · {log.userRole}</p>
                        </div>
                        <span className="text-xs text-[var(--lava-muted)] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== تبويب الزيارات والترافيك ===== */}
            {adminTab === 'traffic' && canAccess('traffic') && (() => {
              const s = trafficStats;
              const sourceIcons = { facebook: '📘', instagram: '📸', tiktok: '🎵', google: '🔍', snapchat: '👻', youtube: '▶️', twitter: '🐦', direct: '🔗', other: '🌐' };
              const sourceColors = {
                facebook:  { bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',   bar: 'bg-blue-500' },
                instagram: { bg: 'bg-pink-50',    border: 'border-pink-200',  text: 'text-pink-700',   bar: 'bg-pink-500' },
                tiktok:    { bg: 'bg-gray-900',   border: 'border-gray-700',  text: 'text-white',      bar: 'bg-[var(--lava-card)]' },
                google:    { bg: 'bg-yellow-50',  border: 'border-yellow-200',text: 'text-yellow-700', bar: 'bg-yellow-500' },
                snapchat:  { bg: 'bg-yellow-50',  border: 'border-yellow-300',text: 'text-yellow-800', bar: 'bg-yellow-400' },
                direct:    { bg: 'bg-[var(--lava-secondary)]',    border: 'border-[var(--lava-border)]',  text: 'text-[var(--lava-text)]',   bar: 'bg-gray-500' },
                other:     { bg: 'bg-purple-50',  border: 'border-purple-200',text: 'text-purple-700', bar: 'bg-purple-500' },
              };
              // ملحوظة: نستخدم عدد الزوار الحقيقيين (visitorId الفريد) لكل مصدر — مش عدد الجلسات
              // ومش orders/carts — عشان يطابق تعريف "Visitors" في تحليلات الترافيك الحقيقية.
              const maxVisits = s?.bySource ? Math.max(...s.bySource.map(r => r.visitors ?? r.visits ?? 0), 1) : 1;

              return (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-2xl font-black text-[var(--lava-text)]">📊 {t('الزيارات والترافيك', 'Traffic & Visitors')}</h2>
                      <p className="text-sm text-[var(--lava-muted)] mt-0.5">{t('مصادر الزيارات وربطها بالمبيعات', 'Visit sources linked to sales')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={fetchTrafficStats}
                        disabled={trafficLoading}
                        title={t('تحديث الأرقام دلوقتي', 'Refresh now')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--lava-secondary)] text-[var(--lava-muted)] hover:bg-[var(--lava-border)] transition flex items-center gap-1 disabled:opacity-50"
                      >
                        <span className={trafficLoading ? 'animate-spin inline-block' : ''}>🔄</span>
                        {t('تحديث', 'Refresh')}
                      </button>
                      {[7, 14, 30, 90].map(d => (
                        <button
                          key={d}
                          onClick={() => setTrafficDays(d)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${trafficDays === d ? 'bg-black text-white' : 'bg-[var(--lava-secondary)] text-[var(--lava-muted)] hover:bg-[var(--lava-border)]'}`}
                        >
                          {d} {t('يوم', 'd')}
                        </button>
                      ))}
                      {trafficLoading && <span className="text-xs text-[var(--lava-muted)] animate-pulse">{t('جاري التحميل...', 'Loading...')}</span>}
                    </div>
                  </div>

                  {!s && !trafficLoading && (
                    <div className="p-12 text-center text-[var(--lava-muted)] bg-[var(--lava-card)] rounded-xl border">
                      <div className="text-5xl mb-3">📊</div>
                      <p className="font-bold">{t('لا توجد بيانات زيارات بعد', 'No traffic data yet')}</p>
                      <p className="text-sm mt-1">{t('البيانات هتبدأ تظهر بعد أول زيارة للموقع', 'Data will appear after the first visit')}</p>
                    </div>
                  )}

                  {s && (
                    <>
                      {/* KPIs — الزوار الفريدون (visitorId) والجلسات (sessionId) منفصلان */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {[
                          { label: t('الزوار الفريدون', 'Unique Visitors'), value: (s.summary.totalVisitors ?? s.summary.totalSessions ?? 0).toLocaleString(), icon: '🧑', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
                          { label: t('الجلسات', 'Sessions'),                 value: (s.summary.totalSessions || 0).toLocaleString(),                            icon: '👥', color: 'text-[var(--lava-text)]',   bg: 'bg-[var(--lava-secondary)] border-[var(--lava-border)]' },
                          { label: t('مشاهدات الصفحات', 'Page Views'),       value: (s.summary.totalPageViews || 0).toLocaleString(),                           icon: '👁️', color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
                          { label: t('الطلبات', 'Orders'),                   value: (s.summary.totalOrders || 0).toLocaleString(),                              icon: '📦', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                          { label: t('الإيرادات', 'Revenue'),                value: `${(s.summary.totalRevenue || 0).toLocaleString()} ${t('ج.م','EGP')}`,     icon: '💰', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                          { label: t('معدل التحويل', 'Conv. Rate'),          value: `${s.summary.overallConversionRate || '0.0'}%`,                            icon: '🎯', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
                        ].map((kpi, i) => (
                          <div key={i} className={`p-4 rounded-xl border-2 ${kpi.bg}`}>
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-[var(--lava-muted)]">{kpi.label}</span>
                              <span className="text-lg">{kpi.icon}</span>
                            </div>
                            <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* By Source Table */}
                      <div className="bg-[var(--lava-card)] border rounded-xl overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b bg-[var(--lava-secondary)]">
                          <h3 className="font-black text-[var(--lava-text)]">{t('الأداء حسب المصدر', 'Performance by Source')}</h3>
                        </div>
                        {(!s.bySource || s.bySource.length === 0) ? (
                          <div className="p-8 text-center text-[var(--lava-muted)] text-sm">{t('لا توجد بيانات', 'No data')}</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b">
                                <tr>
                                  <th className="px-5 py-3 text-start text-xs font-bold text-[var(--lava-muted)]">{t('المصدر', 'Source')}</th>
                                  <th className="px-5 py-3 text-start text-xs font-bold text-[var(--lava-muted)]">{t('الزوار', 'Visitors')}</th>
                                  <th className="px-5 py-3 text-start text-xs font-bold text-[var(--lava-muted)]">{t('الطلبات', 'Orders')}</th>
                                  <th className="px-5 py-3 text-start text-xs font-bold text-[var(--lava-muted)]">{t('الإيرادات', 'Revenue')}</th>
                                  <th className="px-5 py-3 text-start text-xs font-bold text-[var(--lava-muted)]">{t('معدل التحويل', 'Conv. Rate')}</th>
                                  <th className="px-5 py-3 text-start text-xs font-bold text-[var(--lava-muted)]">{t('إيراد / زيارة', 'Rev/Visit')}</th>
                                  <th className="px-5 py-3 text-start text-xs font-bold text-[var(--lava-muted)] min-w-[120px]">{t('الحجم', 'Share')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {s.bySource.map((row, i) => {
                                  const c = sourceColors[row.source] || sourceColors.other;
                                  const rowVisitors = row.visitors ?? row.visits ?? 0;
                                  const barPct = Math.round((rowVisitors / maxVisits) * 100);
                                  return (
                                    <tr key={i} className="hover:bg-[var(--lava-secondary)] transition">
                                      <td className="px-5 py-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.border} ${c.text}`}>
                                          {sourceIcons[row.source] || '🌐'} {row.source}
                                        </span>
                                      </td>
                                      <td className="px-5 py-3 font-bold text-[var(--lava-text)]">{rowVisitors.toLocaleString()}</td>
                                      <td className="px-5 py-3 font-bold text-green-600">{row.orders.toLocaleString()}</td>
                                      <td className="px-5 py-3 font-black text-[var(--lava-text)]">{row.revenue.toLocaleString()} <span className="font-normal text-[var(--lava-muted)] text-xs">{t('ج.م','EGP')}</span></td>
                                      <td className="px-5 py-3">
                                        <span className={`font-bold ${parseFloat(row.conversionRate) >= 2 ? 'text-green-600' : parseFloat(row.conversionRate) >= 0.5 ? 'text-yellow-600' : 'text-red-400'}`}>
                                          {row.conversionRate}%
                                        </span>
                                      </td>
                                      <td className="px-5 py-3 text-[var(--lava-muted)] font-bold">{row.revenuePerVisit.toLocaleString()} <span className="font-normal text-xs text-[var(--lava-muted)]">{t('ج.م','EGP')}</span></td>
                                      <td className="px-5 py-3">
                                        <div className="w-full bg-[var(--lava-secondary)] rounded-full h-2">
                                          <div className={`h-2 rounded-full ${c.bar}`} style={{ width: `${barPct}%` }} />
                                        </div>
                                        <span className="text-xs text-[var(--lava-muted)] mt-0.5 block">{barPct}%</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Device Breakdown + Top Source highlight */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Best Source */}
                        {s.bySource.length > 0 && (() => {
                          const best = [...s.bySource].sort((a, b) => b.revenue - a.revenue)[0];
                          const c = sourceColors[best.source] || sourceColors.other;
                          return (
                            <div className={`p-5 rounded-xl border-2 ${c.bg} ${c.border}`}>
                              <p className={`text-xs font-bold mb-2 ${c.text} opacity-70`}>🏆 {t('أفضل مصدر إيرادات', 'Top Revenue Source')}</p>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-3xl">{sourceIcons[best.source] || '🌐'}</span>
                                <span className={`text-xl font-black capitalize ${c.text}`}>{best.source}</span>
                              </div>
                              <div className={`grid grid-cols-3 gap-2 text-center`}>
                                <div><p className={`text-lg font-black ${c.text}`}>{(best.visitors ?? best.visits ?? 0).toLocaleString()}</p><p className={`text-xs ${c.text} opacity-60`}>{t('زائر','visitors')}</p></div>
                                <div><p className={`text-lg font-black ${c.text}`}>{best.orders}</p><p className={`text-xs ${c.text} opacity-60`}>{t('طلب','orders')}</p></div>
                                <div><p className={`text-lg font-black ${c.text}`}>{best.revenue.toLocaleString()}</p><p className={`text-xs ${c.text} opacity-60`}>{t('ج.م','EGP')}</p></div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Device breakdown */}
                        <div className="bg-[var(--lava-card)] border rounded-xl p-5">
                          <h4 className="font-black text-[var(--lava-text)] mb-4">📱 {t('توزيع الأجهزة', 'Device Breakdown')}</h4>
                          {(!s.byDevice || s.byDevice.length === 0) ? (
                            <p className="text-sm text-[var(--lava-muted)]">{t('لا توجد بيانات', 'No data')}</p>
                          ) : (() => {
                            const total = s.byDevice.reduce((sum, d) => sum + d.count, 0);
                            const deviceIcons = { mobile: '📱', desktop: '💻', tablet: '📟', unknown: '❓' };
                            const deviceColors = { mobile: 'bg-blue-500', desktop: 'bg-gray-700', tablet: 'bg-purple-500', unknown: 'bg-[var(--lava-border)]' };
                            return (
                              <div className="space-y-3">
                                {s.byDevice.sort((a, b) => b.count - a.count).map((d, i) => (
                                  <div key={i}>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-sm font-bold text-[var(--lava-text)]">{deviceIcons[d.device] || '❓'} {t(d.device, d.device)}</span>
                                      <span className="text-sm font-bold text-[var(--lava-muted)]">{Math.round((d.count / total) * 100)}% <span className="font-normal text-[var(--lava-muted)] text-xs">({d.count.toLocaleString()})</span></span>
                                    </div>
                                    <div className="w-full bg-[var(--lava-secondary)] rounded-full h-2">
                                      <div className={`h-2 rounded-full ${deviceColors[d.device] || 'bg-gray-400'}`} style={{ width: `${Math.round((d.count / total) * 100)}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Daily trend */}
                      {s.daily && s.daily.length > 0 && (
                        <div className="bg-[var(--lava-card)] border rounded-xl p-5">
                          <h4 className="font-black text-[var(--lava-text)] mb-4">📈 {t('الزيارات اليومية', 'Daily Visits')} ({trafficDays} {t('يوم','days')})</h4>
                          <div className="overflow-x-auto">
                            <div className="flex items-end gap-1 min-w-max" style={{ height: '100px' }}>
                              {s.daily.slice(-30).map((day, i) => {
                                const maxV = Math.max(...s.daily.map(d => d.visits), 1);
                                const pct = Math.round((day.visits / maxV) * 100);
                                return (
                                  <div key={i} className="flex flex-col items-center gap-1 group relative" style={{ width: '24px' }}>
                                    <div
                                      className="w-4 bg-black rounded-t hover:bg-gray-600 transition cursor-default"
                                      style={{ height: `${Math.max(pct, 4)}px` }}
                                      title={`${day.date}: ${day.visits} ${t('زيارة','visits')} | ${day.orders} ${t('طلب','orders')}`}
                                    />
                                    {day.orders > 0 && (
                                      <div className="w-4 bg-green-400 rounded-t" style={{ height: `${Math.round((day.orders / Math.max(day.visits, 1)) * 40)}px`, marginTop: '-4px' }} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-[var(--lava-muted)]">
                              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-black rounded inline-block" /> {t('زيارات','Visits')}</span>
                              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded inline-block" /> {t('طلبات','Orders')}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Note */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                      {/* ===== Conversion Funnel ===== */}
                      {s.funnel && s.funnel.length > 0 && (() => {
                        const STEP_LABELS = {
                          visit:        { ar: 'الزوار',          en: 'Visitors',      icon: '👥' },
                          product_view: { ar: 'مشاهدة المنتج',   en: 'Product Views', icon: '👁️' },
                          add_to_cart:  { ar: 'إضافة للسلة',     en: 'Add to Cart',   icon: '🛒' },
                          checkout:     { ar: 'صفحة الدفع',      en: 'Checkout',      icon: '💳' },
                          purchase:     { ar: 'الشراء',          en: 'Purchase',      icon: '✅' },
                        };
                        const topCount = s.funnel[0]?.count || 1;
                        const barColors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500'];

                        return (
                          <div className="bg-[var(--lava-card)] border rounded-xl overflow-hidden shadow-sm">
                            <div className="px-5 py-4 border-b bg-[var(--lava-secondary)] flex items-center justify-between">
                              <div>
                                <h3 className="font-black text-[var(--lava-text)]">🔽 {t('قمع التحويل', 'Conversion Funnel')}</h3>
                                <p className="text-xs text-[var(--lava-muted)] mt-0.5">{t('فين العملاء بيخرجوا من الـ Flow', 'Where customers drop off')}</p>
                              </div>
                              <div className="text-xs text-[var(--lava-muted)] bg-[var(--lava-secondary)] px-3 py-1.5 rounded-lg font-bold">
                                {t('إجمالي إلى شراء', 'Visit → Purchase')}: <span className="text-green-600">{s.funnel[s.funnel.length-1]?.convFromTop || '0.0'}%</span>
                              </div>
                            </div>

                            <div className="p-6 space-y-3">
                              {s.funnel.map((row, i) => {
                                const label = STEP_LABELS[row.step] || { ar: row.step, en: row.step, icon: '▪️' };
                                const barPct = topCount > 0 ? Math.round((row.count / topCount) * 100) : 0;
                                const isLast = i === s.funnel.length - 1;
                                // ملحوظة مهمة: نسبة التسرب اللي المفروض تتعرض في السهم اللي بعد
                                // خطوة i هي نسبة اللي "طلعوا من الخطوة دي ومكملوش للي بعدها"
                                // يعني dropoffRate بتاع الخطوة i+1 (مش بتاعت الخطوة i نفسها).
                                // كان فيه خلط: row.dropoffRate بيعبّر عن التسرب اللي حصل *قبل*
                                // الوصول للخطوة دي (من الخطوة اللي قبلها)، مش التسرب اللي هيحصل
                                // *بعدها*. فكان مثلاً: دخل 4 للـ checkout، اشترى 3 بس (25% تسرب)
                                // بس النسبة دي كانت بتتحسب على صف "الدفع" نفسه (اللي هو 0% تسرب
                                // من "إضافة للسلة") بدل ما تتحسب على صف "الشراء" اللي فعلاً فيه
                                // التسرب - فالسهم بعد "الدفع" كان بيفضل فاضي من غير نسبة.
                                const nextDropoffRate = s.funnel[i + 1]?.dropoffRate;
                                const dropoff = parseFloat(nextDropoffRate);

                                return (
                                  <div key={row.step}>
                                    {/* Step row */}
                                    <div className="flex items-center gap-4">
                                      {/* Icon + label */}
                                      <div className="w-36 flex-shrink-0 flex items-center gap-2">
                                        <span className="text-xl">{label.icon}</span>
                                        <span className="text-sm font-bold text-[var(--lava-text)]">{t(label.ar, label.en)}</span>
                                      </div>

                                      {/* Bar */}
                                      <div className="flex-1 relative">
                                        <div className="w-full bg-[var(--lava-secondary)] rounded-full h-8 overflow-hidden">
                                          <div
                                            className={`h-8 rounded-full ${barColors[i]} flex items-center justify-end pr-3 transition-all duration-500`}
                                            style={{ width: `${Math.max(barPct, 3)}%` }}
                                          >
                                            {barPct > 15 && (
                                              <span className="text-white text-xs font-black">{row.count.toLocaleString()}</span>
                                            )}
                                          </div>
                                        </div>
                                        {barPct <= 15 && (
                                          <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full ps-2 text-sm font-black text-[var(--lava-text)]">{row.count.toLocaleString()}</span>
                                        )}
                                      </div>

                                      {/* Stats */}
                                      <div className="w-28 flex-shrink-0 text-end">
                                        <span className="text-sm font-black text-[var(--lava-text)]">{row.convFromTop}%</span>
                                        <span className="text-xs text-[var(--lava-muted)] block">{t('من الزوار', 'of visitors')}</span>
                                      </div>
                                    </div>

                                    {/* Dropoff arrow between steps */}
                                    {!isLast && (
                                      <div className="flex items-center gap-4 my-1 ps-[9.5rem]">
                                        <div className="flex-1 flex items-center gap-2 ps-1">
                                          <span className="text-gray-300 text-lg">↓</span>
                                          {dropoff > 0 && (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                              dropoff >= 70 ? 'bg-red-100 text-red-600' :
                                              dropoff >= 40 ? 'bg-orange-100 text-orange-600' :
                                              'bg-yellow-100 text-yellow-700'
                                            }`}>
                                              -{nextDropoffRate}% {t('خرجوا هنا', 'dropped off')}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Bottom summary */}
                            <div className="border-t px-6 py-4 bg-[var(--lava-secondary)] grid grid-cols-3 gap-4 text-center">
                              {(() => {
                                const visitCount   = s.funnel.find(r => r.step === 'visit')?.count || 0;
                                const cartCount    = s.funnel.find(r => r.step === 'add_to_cart')?.count || 0;
                                const purchaseCount= s.funnel.find(r => r.step === 'purchase')?.count || 0;
                                // بيانات التسرب الحقيقية موجودة في كل الخطوات من التانية للأخيرة
                                // (أول خطوة "الزوار" مالهاش تسرب أصلاً لأنها نقطة البداية - قيمتها
                                // ثابتة 0.0%). كان في السابق بيتم استبعاد آخر خطوة (الشراء) بالغلط
                                // بدل أول خطوة، فكان بيضيع بالظبط الحالة اللي إنت بتسأل عنها
                                // (خطوة الدفع → الشراء) من حساب "أكبر تسرب".
                                const biggestDrop  = [...s.funnel].slice(1).sort((a,b) => parseFloat(b.dropoffRate)-parseFloat(a.dropoffRate))[0];
                                const biggestLabel = biggestDrop ? STEP_LABELS[biggestDrop.step] : null;
                                return (
                                  <>
                                    <div>
                                      <p className="text-lg font-black text-blue-600">{visitCount > 0 ? ((cartCount/visitCount)*100).toFixed(1) : '0.0'}%</p>
                                      <p className="text-xs text-[var(--lava-muted)]">{t('زيارة → سلة', 'Visit → Cart')}</p>
                                    </div>
                                    <div>
                                      <p className="text-lg font-black text-green-600">{visitCount > 0 ? ((purchaseCount/visitCount)*100).toFixed(1) : '0.0'}%</p>
                                      <p className="text-xs text-[var(--lava-muted)]">{t('زيارة → شراء', 'Visit → Purchase')}</p>
                                    </div>
                                    <div>
                                      <p className="text-lg font-black text-red-500">
                                        {biggestLabel ? `${biggestDrop.dropoffRate}%` : '—'}
                                      </p>
                                      <p className="text-xs text-[var(--lava-muted)]">
                                        {biggestLabel ? `${t('أكبر تسرب:', 'Biggest drop:')} ${t(biggestLabel.ar, biggestLabel.en)}` : t('لا يوجد بيانات', 'No data')}
                                      </p>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Note */}
                        💡 <strong>{t('ملاحظة:', 'Note:')}</strong> {t('البيانات بتتحسب من لحظة إضافة هذه الميزة. الزيارات القديمة قبل التفعيل مش موجودة في الإحصائيات.', 'Data is collected from when this feature was added. Older visits before activation are not included.')}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* ===== تبويب لوحة المدفوعات ===== */}
            {adminTab === 'payments_dashboard' && canAccess('payments_dashboard') && (() => {
              const pd = paymentsDashboard;
              if (paymentsDashboardLoading || !pd) return (
                <div className="flex items-center justify-center py-24">
                  <div className="text-center">
                    <div className="text-4xl mb-3 animate-pulse">💳</div>
                    <p className="text-[var(--lava-muted)] font-bold">{t('جاري تحميل بيانات المدفوعات...', 'Loading payment data...')}</p>
                  </div>
                </div>
              );
              return (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-[var(--lava-text)]">💳 {t('لوحة المدفوعات', 'Payments Dashboard')}</h2>

                  {/* بطاقات الإحصائيات الرئيسية */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: t('إجمالي الإيرادات', 'Total Revenue'), value: `${pd.totalRevenue?.toLocaleString()} ${t('ج.م','EGP')}`, color: 'bg-green-50 border-green-200', textColor: 'text-green-700', icon: '✅' },
                      { label: t('في الانتظار', 'Pending'), value: `${pd.pendingAmount?.toLocaleString()} ${t('ج.م','EGP')}`, sub: `${pd.pendingCount} ${t('طلب','orders')}`, color: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-700', icon: '⏳' },
                      { label: t('فشل الدفع', 'Failed'), value: `${pd.failedAmount?.toLocaleString()} ${t('ج.م','EGP')}`, sub: `${pd.failedCount} ${t('طلب','orders')}`, color: 'bg-red-50 border-red-200', textColor: 'text-red-700', icon: '❌' },
                      { label: t('مسترجع', 'Refunded'), value: `${pd.refundedAmount?.toLocaleString()} ${t('ج.م','EGP')}`, sub: `${pd.refundedCount} ${t('طلب','orders')}`, color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700', icon: '↩️' },
                    ].map((card, i) => (
                      <div key={i} className={`${card.color} border rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{card.icon}</span>
                          <p className="text-xs font-bold text-[var(--lava-muted)]">{card.label}</p>
                        </div>
                        <p className={`text-lg font-black ${card.textColor}`}>{card.value}</p>
                        {card.sub && <p className="text-xs text-[var(--lava-muted)] mt-0.5">{card.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* توزيع وسائل الدفع */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[var(--lava-card)] border rounded-xl p-5">
                      <h3 className="font-black text-[var(--lava-text)] mb-4">📊 {t('توزيع وسائل الدفع', 'Payment Method Breakdown')}</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-[var(--lava-secondary)] rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">💵</span>
                            <span className="font-bold text-sm">{t('دفع عند الاستلام (COD)', 'Cash on Delivery (COD)')}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-[var(--lava-text)]">{pd.byCodAmount?.toLocaleString()} {t('ج.م','EGP')}</p>
                            <p className="text-xs text-[var(--lava-muted)]">{pd.codCount} {t('طلب','orders')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">📱</span>
                            <span className="font-bold text-sm">{t('دفع إلكتروني (محفظة)', 'Digital Payment (Wallet)')}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-blue-700">{pd.byWalletAmount?.toLocaleString()} {t('ج.م','EGP')}</p>
                            <p className="text-xs text-[var(--lava-muted)]">{pd.walletCount} {t('طلب','orders')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-[var(--lava-secondary)] rounded-lg border">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">💳</span>
                            <span className="font-bold text-sm">Kashier</span>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-[var(--lava-text)]">{pd.byKashierAmount?.toLocaleString()} {t('ج.م','EGP')}</p>
                            <p className="text-xs text-[var(--lava-muted)]">{pd.kashierCount || 0} {t('طلب','orders')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-[var(--lava-secondary)] rounded-lg border">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">💳</span>
                            <span className="font-bold text-sm">Paymob</span>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-[var(--lava-text)]">{pd.byPaymobAmount?.toLocaleString()} {t('ج.م','EGP')}</p>
                            <p className="text-xs text-[var(--lava-muted)]">{pd.paymobCount || 0} {t('طلب','orders')}</p>
                          </div>
                        </div>
                        {/* تفصيل وسائل الدفع الإلكتروني */}
                        {pd.walletMethods && Object.keys(pd.walletMethods).length > 0 && (
                          <div className="ms-4 space-y-2 border-s-2 border-blue-200 ps-4">
                            {Object.entries(pd.walletMethods).map(([name, data]) => (
                              <div key={name} className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-[var(--lava-muted)]">• {name}</span>
                                <div className="text-right">
                                  <span className="font-black text-[var(--lava-text)]">{data.amount?.toLocaleString()} {t('ج.م','EGP')}</span>
                                  <span className="text-xs text-[var(--lava-muted)] ms-2">({data.count})</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* إيصالات في انتظار المراجعة */}
                    <div className="bg-[var(--lava-card)] border rounded-xl p-5">
                      <h3 className="font-black text-[var(--lava-text)] mb-4">
                        🔍 {t('إيصالات في انتظار المراجعة', 'Proof Pending Review')}
                        {pd.pendingProofReview?.length > 0 && (
                          <span className="ms-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{pd.pendingProofReview.length}</span>
                        )}
                      </h3>
                      {!pd.pendingProofReview || pd.pendingProofReview.length === 0 ? (
                        <div className="text-center py-8 text-[var(--lava-muted)]">
                          <div className="text-3xl mb-2">✅</div>
                          <p className="text-sm font-bold">{t('مفيش إيصالات في الانتظار', 'No pending proofs')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {pd.pendingProofReview.map((proof) => (
                            <div key={proof._id} className="border border-orange-200 bg-orange-50 rounded-lg p-3">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="font-bold text-sm text-[var(--lava-text)]">{proof.customerName}</p>
                                  <p className="text-xs text-[var(--lava-muted)]">{proof.customerPhone} • {proof.methodName}</p>
                                  <p className="text-xs text-[var(--lava-muted)]">{t('المبلغ:', 'Amount:')} <span className="font-black text-orange-700">{proof.totalAmount} {t('ج.م','EGP')}</span></p>
                                  {proof.senderPhone && <p className="text-xs text-[var(--lava-muted)]">{t('رقم التحويل:', 'Transfer phone:')} {proof.senderPhone}</p>}
                                  {proof.transferDate && <p className="text-xs text-[var(--lava-muted)]">{t('التاريخ:', 'Date:')} {proof.transferDate}</p>}
                                </div>
                                {proof.screenshotUrl && (
                                  <a href={proof.screenshotUrl} target="_blank" rel="noopener noreferrer">
                                    <img src={proof.screenshotUrl} alt="proof" className="w-16 h-16 object-cover rounded-lg border shadow" />
                                  </a>
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    await ordersAPI.confirmPayment(proof._id, true);
                                    setPaymentsDashboard(prev => ({
                                      ...prev,
                                      pendingProofReview: prev.pendingProofReview.filter(p => p._id !== proof._id)
                                    }));
                                    showToast(t('تم تأكيد الدفع ✅', 'Payment confirmed ✅'));
                                  } catch { showToast(t('حصل خطأ', 'Error occurred')); }
                                }}
                                className="w-full bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg hover:bg-green-700 transition"
                              >
                                ✅ {t('تأكيد استلام الدفع', 'Confirm Payment Received')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* جدول الطلبات حسب حالة الدفع */}
                  <div className="bg-[var(--lava-card)] border rounded-xl p-5">
                    <h3 className="font-black text-[var(--lava-text)] mb-4">📋 {t('الطلبات حسب حالة الدفع', 'Orders by Payment Status')}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-[var(--lava-secondary)]">
                            <th className="text-start p-2 font-bold text-[var(--lava-muted)]">{t('العميل', 'Customer')}</th>
                            <th className="text-start p-2 font-bold text-[var(--lava-muted)]">{t('المبلغ', 'Amount')}</th>
                            <th className="text-start p-2 font-bold text-[var(--lava-muted)]">{t('طريقة الدفع', 'Method')}</th>
                            <th className="text-start p-2 font-bold text-[var(--lava-muted)]">{t('حالة الدفع', 'Payment Status')}</th>
                            <th className="text-start p-2 font-bold text-[var(--lava-muted)]">{t('تغيير', 'Change')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.filter(o => o.paymentMethod === 'wallet').slice(0, 20).map(order => {
                            const ps = order.paymentStatus || 'pending';
                            const psColors = { paid: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', failed: 'bg-red-100 text-red-700', refunded: 'bg-purple-100 text-purple-700' };
                            const psLabels = { paid: t('مدفوع','Paid'), pending: t('في الانتظار','Pending'), failed: t('فشل','Failed'), refunded: t('مسترجع','Refunded') };
                            return (
                              <tr key={order._id || order.id} className="border-b hover:bg-[var(--lava-secondary)]">
                                <td className="p-2">
                                  <p className="font-bold text-[var(--lava-text)] text-xs">{order.customerName}</p>
                                  <p className="text-[var(--lava-muted)] text-xs">{order.customerPhone}</p>
                                </td>
                                <td className="p-2 font-black text-[var(--lava-text)]">{order.totalAmount} {t('ج.م','EGP')}</td>
                                <td className="p-2 text-xs">
                                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                    📱 {order.walletPayment?.methodName || t('محفظة','Wallet')}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${psColors[ps] || 'bg-[var(--lava-secondary)] text-[var(--lava-muted)]'}`}>
                                    {psLabels[ps] || ps}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <select
                                    value={ps}
                                    onChange={async (e) => {
                                      try {
                                        await ordersAPI.updatePaymentStatus(order._id || order.id, e.target.value);
                                        setOrders(prev => prev.map(o => (o._id || o.id) === (order._id || order.id) ? { ...o, paymentStatus: e.target.value } : o));
                                        showToast(t('تم تحديث حالة الدفع', 'Payment status updated'));
                                      } catch { showToast(t('حصل خطأ', 'Error')); }
                                    }}
                                    className="text-xs border rounded px-1 py-0.5 bg-[var(--lava-card)]"
                                  >
                                    <option value="pending">{t('في الانتظار','Pending')}</option>
                                    <option value="paid">{t('مدفوع','Paid')}</option>
                                    <option value="failed">{t('فشل','Failed')}</option>
                                    <option value="refunded">{t('مسترجع','Refunded')}</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {orders.filter(o => o.paymentMethod === 'wallet').length === 0 && (
                        <p className="text-center text-[var(--lava-muted)] py-6 text-sm">{t('لا توجد طلبات بدفع إلكتروني', 'No digital payment orders yet')}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ===== تبويب لوحة الشحن ===== */}
            {adminTab === 'shipping_dashboard' && canAccess('shipping_dashboard') && (() => {
              const sd = shippingDashboard;

              const shippingStatuses = [
                { key: 'all', label: t('الكل', 'All'), icon: '📦', count: orders.length },
                { key: 'pending', label: t('في الانتظار', 'Pending'), icon: '⏳', count: sd?.pending || 0, color: 'bg-[var(--lava-secondary)] text-[var(--lava-text)]' },
                { key: 'preparing', label: t('قيد التجهيز', 'Preparing'), icon: '📋', count: sd?.preparing || 0, color: 'bg-yellow-100 text-yellow-700' },
                { key: 'shipped', label: t('تم الشحن', 'Shipped'), icon: '🚚', count: sd?.shipped || 0, color: 'bg-blue-100 text-blue-700' },
                { key: 'delivered', label: t('تم التسليم', 'Delivered'), icon: '✅', count: sd?.delivered || 0, color: 'bg-green-100 text-green-700' },
                { key: 'failed_delivery', label: t('فشل التسليم', 'Failed Delivery'), icon: '❌', count: sd?.failedDelivery || 0, color: 'bg-red-100 text-red-700' },
                { key: 'returned', label: t('مرتجع', 'Returned'), icon: '↩️', count: sd?.returned || 0, color: 'bg-purple-100 text-purple-700' },
              ];

              const filteredShipOrders = orders.filter(o => {
                const matchStatus = shippingFilter === 'all' || (o.shippingStatus || 'pending') === shippingFilter;
                const q = shippingSearch.toLowerCase();
                const matchSearch = !q || o.customerName?.toLowerCase().includes(q) ||
                  o.trackingNumber?.toLowerCase().includes(q) ||
                  o.shippingCompany?.toLowerCase().includes(q) ||
                  o.governorate?.toLowerCase().includes(q);
                return matchStatus && matchSearch;
              });

              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-2xl font-black text-[var(--lava-text)]">🚚 {t('لوحة الشحن', 'Shipping Dashboard')}</h2>
                    {shippingDashboardLoading && (
                      <span className="text-xs text-[var(--lava-muted)] animate-pulse">{t('جاري التحميل...', 'Loading...')}</span>
                    )}
                  </div>

                  {/* بطاقات الإحصائيات */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {shippingStatuses.slice(1).map(s => (
                      <button
                        key={s.key}
                        onClick={() => setShippingFilter(shippingFilter === s.key ? 'all' : s.key)}
                        className={`rounded-xl p-3 text-center border-2 transition ${shippingFilter === s.key ? 'border-black shadow-md' : 'border-transparent'} ${s.color || 'bg-[var(--lava-secondary)]'}`}
                      >
                        <div className="text-2xl mb-1">{s.icon}</div>
                        <div className="text-lg font-black">{s.count}</div>
                        <div className="text-xs font-bold mt-0.5 leading-tight">{s.label}</div>
                      </button>
                    ))}
                  </div>

                  {/* شركات الشحن المستخدمة */}
                  {sd?.companies && Object.keys(sd.companies).length > 0 && (
                    <div className="bg-[var(--lava-card)] border rounded-xl p-5">
                      <h3 className="font-black text-[var(--lava-text)] mb-4">🏢 {t('شركات الشحن المستخدمة', 'Shipping Companies Used')}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(sd.companies).map(([company, data]) => (
                          <div key={company} className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                            <p className="font-black text-blue-800 text-sm">{company}</p>
                            <p className="text-2xl font-black text-blue-600 mt-1">{data.count}</p>
                            <div className="flex justify-center gap-3 mt-2 text-xs">
                              <span className="text-green-600 font-bold">✅ {data.delivered}</span>
                              <span className="text-red-600 font-bold">❌ {data.failed}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* مشاكل الشحن */}
                  {sd?.issues && sd.issues.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                      <h3 className="font-black text-red-800 mb-4">⚠️ {t('مشاكل الشحن', 'Shipping Issues')} ({sd.issues.length})</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {sd.issues.map(issue => (
                          <div key={issue._id} className="bg-[var(--lava-card)] border border-red-200 rounded-lg p-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-sm text-[var(--lava-text)]">{issue.customerName} - {issue.governorate}</p>
                              <p className="text-xs text-[var(--lava-muted)]">{issue.customerPhone} • {issue.shippingCompany || t('بدون شركة','No company')}</p>
                              {issue.trackingNumber && <p className="text-xs font-mono text-[var(--lava-muted)]">📦 {issue.trackingNumber}</p>}
                              {issue.shippingNotes && <p className="text-xs text-red-600 mt-1">⚠️ {issue.shippingNotes}</p>}
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${issue.shippingStatus === 'returned' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                              {issue.shippingStatus === 'returned' ? t('مرتجع','Returned') : t('فشل التسليم','Failed Delivery')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* بحث في الطلبات */}
                  <div>
                    <input
                      type="text"
                      value={shippingSearch}
                      onChange={e => setShippingSearch(e.target.value)}
                      placeholder={t('ابحث باسم العميل / رقم التتبع / الشركة / المحافظة...', 'Search by name / tracking / company / governorate...')}
                      className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                    />
                  </div>

                  {/* جدول الطلبات مع بيانات الشحن */}
                  <div className="bg-[var(--lava-card)] border rounded-xl overflow-hidden">
                    <div className="p-4 border-b bg-[var(--lava-secondary)] flex items-center justify-between">
                      <h3 className="font-black text-[var(--lava-text)]">
                        📋 {t('الطلبات', 'Orders')} ({filteredShipOrders.length})
                      </h3>
                    </div>
                    <div className="divide-y max-h-[600px] overflow-y-auto">
                      {filteredShipOrders.length === 0 ? (
                        <p className="text-center text-[var(--lava-muted)] py-8 text-sm">{t('لا توجد طلبات', 'No orders found')}</p>
                      ) : filteredShipOrders.map(order => {
                        const ordId = order._id || order.id;
                        const shStatus = order.shippingStatus || 'pending';
                        const isEditing = editingShippingOrderId === ordId;
                        // capabilities حقيقية لشركة الشحن المحددة على الأوردر ده (جايه من
                        // الباك اند عبر shippingProviders) - بتتحكم في إظهار/إخفاء زراير
                        // الإلغاء/البوليصة/الإرجاع/الاستبدال. لو الشركة مش معروفة أو
                        // capabilities لسه ما وصلتش، بيبقى الكل false افتراضيًا (نخفي بدل
                        // ما نظهر عملية مش متأكدين هي مدعومة فعلاً ولا لأ).
                        const orderCaps = shippingProviders[String(order.shippingCompany || '').toLowerCase()]?.capabilities || {};
                        const statusColors = {
                          pending: 'bg-[var(--lava-secondary)] text-[var(--lava-text)]',
                          preparing: 'bg-yellow-100 text-yellow-700',
                          shipped: 'bg-blue-100 text-blue-700',
                          delivered: 'bg-green-100 text-green-700',
                          failed_delivery: 'bg-red-100 text-red-700',
                          returned: 'bg-purple-100 text-purple-700',
                        };
                        const statusLabels = {
                          pending: t('في الانتظار','Pending'),
                          preparing: t('قيد التجهيز','Preparing'),
                          shipped: t('تم الشحن','Shipped'),
                          delivered: t('تم التسليم','Delivered'),
                          failed_delivery: t('فشل التسليم','Failed Delivery'),
                          returned: t('مرتجع','Returned'),
                        };
                        return (
                          <div key={ordId} className="p-4">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className="font-black text-sm text-[var(--lava-text)]">{order.customerName}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColors[shStatus] || 'bg-[var(--lava-secondary)] text-[var(--lava-muted)]'}`}>
                                    {statusLabels[shStatus] || shStatus}
                                  </span>
                                </div>
                                <p className="text-xs text-[var(--lava-muted)]">{order.customerPhone} • {order.governorate} • {order.totalAmount} {t('ج.م','EGP')}</p>
                                {order.shippingCompany && (
                                  <p className="text-xs text-blue-600 font-bold mt-0.5">🏢 {order.shippingCompany}</p>
                                )}
                                {order.trackingNumber && (
                                  <p className="text-xs font-mono text-[var(--lava-muted)] mt-0.5">📦 {order.trackingNumber}</p>
                                )}
                                {order.shippingProviderId && order.shippingProviderId !== order.trackingNumber && (
                                  <p className="text-xs font-mono text-[var(--lava-muted)] mt-0.5">🆔 {order.shippingProviderId}</p>
                                )}
                                {order.shippingRawStatus && (
                                  <p className="text-xs text-[var(--lava-muted)] mt-0.5">{t('حالة الشركة الخام:', 'Raw carrier status:')} <span className="font-mono">{order.shippingRawStatus}</span></p>
                                )}
                                {order.shippingUpdatedAt && (
                                  <p className="text-xs text-[var(--lava-muted)] mt-0.5">{t('آخر تحديث:', 'Last sync:')} {new Date(order.shippingUpdatedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</p>
                                )}
                                {order.shippingNotes && (
                                  <p className="text-xs text-orange-600 mt-0.5">⚠️ {order.shippingNotes}</p>
                                )}
                                {order.shippingError && (
                                  <p className="text-xs text-red-600 mt-0.5">❌ {order.shippingError}</p>
                                )}
                                {order.returnTrackingNumber && (
                                  <p className="text-xs text-purple-600 mt-0.5">↩️ {t('مرتجع:', 'Return:')} <span className="font-mono">{order.returnTrackingNumber}</span> {order.returnStatus ? `(${order.returnStatus})` : ''}</p>
                                )}
                                {order.exchangeTrackingNumber && (
                                  <p className="text-xs text-indigo-600 mt-0.5">🔁 {t('استبدال:', 'Exchange:')} <span className="font-mono">{order.exchangeTrackingNumber}</span> {order.exchangeStatus ? `(${order.exchangeStatus})` : ''}</p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1.5 flex-shrink-0">
                                {order.shippingCompany && !['shipped', 'created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'].includes(shStatus) && (
                                  <button
                                    disabled={creatingShipmentOrderId === ordId}
                                    onClick={async () => {
                                      setCreatingShipmentOrderId(ordId);
                                      try {
                                        const res = await shippingAPI.createShipment(ordId, order.shippingCompany);
                                        const updated = res?.order;
                                        setOrders(prev => prev.map(o => (o._id || o.id) === ordId ? {
                                          ...o,
                                          shippingStatus: updated?.shippingStatus || 'shipped',
                                          trackingNumber: updated?.trackingNumber || o.trackingNumber,
                                          shippingError: null,
                                        } : o));
                                        showToast(res?.deduplicated ? t('الشحنة متعملة بالفعل لهذا الطلب ✅', 'A shipment already exists for this order ✅') : t('تم إرسال الشحنة لشركة الشحن ✅', 'Shipment sent to the carrier ✅'));
                                      } catch (err) {
                                        // 409 من الباك اند = عملية إنشاء شحنة تانية شغالة دلوقتي بالظبط
                                        // لنفس الأوردر (idempotency lock) - منسجلش الحالة "failed" في
                                        // الحالة دي عشان منمسحش نتيجة العملية التانية اللي لسه شغالة.
                                        if (err?.status !== 409) {
                                          setOrders(prev => prev.map(o => (o._id || o.id) === ordId ? {
                                            ...o,
                                            shippingStatus: 'failed',
                                            shippingError: err?.message || t('فشل إنشاء الشحنة', 'Failed to create shipment'),
                                          } : o));
                                        }
                                        showToast(err?.message || t('فشل إرسال الشحنة لشركة الشحن', 'Failed to send shipment to carrier'));
                                      } finally {
                                        setCreatingShipmentOrderId(null);
                                      }
                                    }}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {creatingShipmentOrderId === ordId ? `⏳ ${t('جاري الإرسال...', 'Sending...')}` : (shStatus === 'failed' ? `🔁 ${t('إعادة محاولة الإرسال', 'Retry Send')}` : `🚀 ${t('إرسال لشركة الشحن', 'Send to Carrier')}`)}
                                  </button>
                                )}
                                {order.trackingNumber && (
                                  <button
                                    disabled={trackingShipmentOrderId === ordId}
                                    onClick={async () => {
                                      setTrackingShipmentOrderId(ordId);
                                      try {
                                        const res = await shippingAPI.track(ordId, order.shippingCompany);
                                        const updated = res?.order;
                                        setOrders(prev => prev.map(o => (o._id || o.id) === ordId ? {
                                          ...o,
                                          shippingStatus: updated?.shippingStatus || res?.internalStatus || o.shippingStatus,
                                          shippingRawStatus: updated?.shippingRawStatus || res?.status || o.shippingRawStatus,
                                          shippingUpdatedAt: updated?.shippingUpdatedAt || new Date().toISOString(),
                                        } : o));
                                        showToast(t('تم تحديث حالة الشحنة ✅', 'Shipment status refreshed ✅'));
                                      } catch (err) {
                                        showToast(err?.message || t('فشل تحديث حالة الشحنة', 'Failed to refresh shipment status'));
                                      } finally {
                                        setTrackingShipmentOrderId(null);
                                      }
                                    }}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0 bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                                  >
                                    {trackingShipmentOrderId === ordId ? `⏳ ${t('جاري التحديث...', 'Refreshing...')}` : `🔄 ${t('تحديث التتبع', 'Refresh Tracking')}`}
                                  </button>
                                )}
                                {/* البوليصة (AWB/Label) - بتظهر بس لو الشركة بتدعمها فعليًا
                                    (supportsLabels=true من الباك اند). بتفتح عن طريق بروكسي
                                    الباك اند (/label/file) مش برابط شركة الشحن مباشرة - عشان
                                    شركات زي ShipBlu اللي رابطها محتاج مفتاح API سري ميقدرش
                                    المتصفح يبعته؛ الباك اند هو اللي بيتصل بيهم ويرجّع الملف
                                    جاهز. نفس الزرار شغال لباقي الشركات (Aramex/DHL) عادي. */}
                                {order.trackingNumber && orderCaps.supportsLabels && (
                                  <button
                                    disabled={fetchingLabelOrderId === ordId}
                                    onClick={() => {
                                      setFetchingLabelOrderId(ordId);
                                      const apiBase = import.meta.env.VITE_API_URL || '/api';
                                      window.open(`${apiBase}/shipping/orders/${ordId}/label/file`, '_blank', 'noopener,noreferrer');
                                      // مفيش نداء API منفصل هنا - الرابط ده نفسه بيولّد/يحمّل البوليصة
                                      // ويعرضها في التبويب الجديد مباشرة (الباك اند بيتولى المصادقة).
                                      setFetchingLabelOrderId(null);
                                    }}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0 bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50"
                                  >
                                    {fetchingLabelOrderId === ordId ? `⏳ ${t('جاري التحميل...', 'Loading...')}` : `🖨️ ${t('طباعة البوليصة', 'Print Label')}`}
                                  </button>
                                )}
                                {/* الإلغاء - بيظهر بس لو الشركة بتدعم الإلغاء فعليًا عبر الـAPI
                                    الرسمي (supportsCancellation=true). أرامكس وShipBlu مثلاً
                                    مبيظهرش لهم الزرار ده لأنهم مش بيدعموه رسميًا حاليًا. */}
                                {order.trackingNumber && orderCaps.supportsCancellation && !['delivered', 'cancelled', 'returned'].includes(shStatus) && (
                                  <button
                                    disabled={cancellingShipmentOrderId === ordId}
                                    onClick={async () => {
                                      if (!window.confirm(t('هل أنت متأكد من إلغاء هذه الشحنة؟', 'Are you sure you want to cancel this shipment?'))) return;
                                      setCancellingShipmentOrderId(ordId);
                                      try {
                                        const res = await shippingAPI.cancelShipment(ordId);
                                        const updated = res?.order;
                                        setOrders(prev => prev.map(o => (o._id || o.id) === ordId ? {
                                          ...o,
                                          shippingStatus: updated?.shippingStatus || 'cancelled',
                                        } : o));
                                        showToast(res?.deduplicated ? t('الشحنة ملغاة بالفعل ✅', 'Shipment already cancelled ✅') : t('تم إلغاء الشحنة ✅', 'Shipment cancelled ✅'));
                                      } catch (err) {
                                        // 409 من الباك اند معناها العملية دي قيد التنفيذ فعلاً من
                                        // request تاني أو حصلت بالفعل - رسالة الباك اند واضحة
                                        // وموحّدة (idempotency)، فبنعرضها زي ما هي.
                                        showToast(err?.message || t('فشل إلغاء الشحنة', 'Failed to cancel shipment'));
                                      } finally {
                                        setCancellingShipmentOrderId(null);
                                      }
                                    }}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {cancellingShipmentOrderId === ordId ? `⏳ ${t('جاري الإلغاء...', 'Cancelling...')}` : `🛑 ${t('إلغاء الشحنة', 'Cancel Shipment')}`}
                                  </button>
                                )}
                                {/* إرجاع / استبدال - بتظهر بس لو supportsReturns / supportsExchange
                                    = true فعليًا من الباك اند. حاليًا مفيش شركة من الأربعة بتدعمهم
                                    رسميًا، فالزرارين دول مش هيظهروا لحد ما شركة تضيف official API
                                    موثّق للعملية دي (شوف services/shipping/capabilities.js بالباك اند). */}
                                {order.trackingNumber && orderCaps.supportsReturns && shStatus === 'delivered' && !order.returnTrackingNumber && (
                                  <button
                                    disabled={creatingShipmentOrderId === `return-${ordId}`}
                                    onClick={async () => {
                                      if (!window.confirm(t('تأكيد إنشاء مرتجع لهذا الطلب؟', 'Confirm creating a return for this order?'))) return;
                                      setCreatingShipmentOrderId(`return-${ordId}`);
                                      try {
                                        const res = await shippingAPI.createReturn(ordId);
                                        const updated = res?.order;
                                        setOrders(prev => prev.map(o => (o._id || o.id) === ordId ? { ...o, returnTrackingNumber: updated?.returnTrackingNumber, returnStatus: updated?.returnStatus } : o));
                                        showToast(t('تم إنشاء المرتجع ✅', 'Return created ✅'));
                                      } catch (err) {
                                        showToast(err?.message || t('فشل إنشاء المرتجع', 'Failed to create return'));
                                      } finally {
                                        setCreatingShipmentOrderId(null);
                                      }
                                    }}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                                  >
                                    {creatingShipmentOrderId === `return-${ordId}` ? `⏳ ${t('جاري الإنشاء...', 'Creating...')}` : `↩️ ${t('إنشاء مرتجع', 'Create Return')}`}
                                  </button>
                                )}
                                {order.trackingNumber && orderCaps.supportsExchange && shStatus === 'delivered' && !order.exchangeTrackingNumber && (
                                  <button
                                    disabled={creatingShipmentOrderId === `exchange-${ordId}`}
                                    onClick={async () => {
                                      if (!window.confirm(t('تأكيد إنشاء استبدال لهذا الطلب؟', 'Confirm creating an exchange for this order?'))) return;
                                      setCreatingShipmentOrderId(`exchange-${ordId}`);
                                      try {
                                        const res = await shippingAPI.createExchange(ordId);
                                        const updated = res?.order;
                                        setOrders(prev => prev.map(o => (o._id || o.id) === ordId ? { ...o, exchangeTrackingNumber: updated?.exchangeTrackingNumber, exchangeStatus: updated?.exchangeStatus } : o));
                                        showToast(t('تم إنشاء الاستبدال ✅', 'Exchange created ✅'));
                                      } catch (err) {
                                        showToast(err?.message || t('فشل إنشاء الاستبدال', 'Failed to create exchange'));
                                      } finally {
                                        setCreatingShipmentOrderId(null);
                                      }
                                    }}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {creatingShipmentOrderId === `exchange-${ordId}` ? `⏳ ${t('جاري الإنشاء...', 'Creating...')}` : `🔁 ${t('إنشاء استبدال', 'Create Exchange')}`}
                                  </button>
                                )}
                              <button
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingShippingOrderId(null);
                                  } else {
                                    setEditingShippingOrderId(ordId);
                                    setEditShippingStatus(order.shippingStatus || 'pending');
                                    setEditShippingCompany(order.shippingCompany || '');
                                    setEditTrackingNumber(order.trackingNumber || '');
                                    setEditShippingNotes(order.shippingNotes || '');
                                  }
                                }}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0 ${isEditing ? 'bg-[var(--lava-border)] text-[var(--lava-text)]' : 'bg-black text-white hover:bg-gray-800'}`}
                              >
                                {isEditing ? t('إلغاء','Cancel') : t('تحديث الشحن','Update Shipping')}
                              </button>
                              </div>
                            </div>

                            {/* فورم تعديل بيانات الشحن */}
                            {isEditing && (
                              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-bold text-[var(--lava-muted)] mb-1">{t('حالة الشحن', 'Shipping Status')}</label>
                                    <select value={editShippingStatus} onChange={e => setEditShippingStatus(e.target.value)}
                                      className="w-full text-xs border rounded-lg px-2 py-1.5 bg-[var(--lava-card)] focus:outline-none focus:ring-2 focus:ring-black">
                                      <option value="pending">{t('في الانتظار','Pending')}</option>
                                      <option value="preparing">{t('قيد التجهيز','Preparing')}</option>
                                      <option value="shipped">{t('تم الشحن','Shipped')}</option>
                                      <option value="delivered">{t('تم التسليم','Delivered')}</option>
                                      <option value="failed_delivery">{t('فشل التسليم','Failed Delivery')}</option>
                                      <option value="returned">{t('مرتجع','Returned')}</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[var(--lava-muted)] mb-1">{t('شركة الشحن', 'Shipping Company')}</label>
                                    <input type="text" value={editShippingCompany} onChange={e => setEditShippingCompany(e.target.value)}
                                      placeholder="Aramex, Bosta, J&T..."
                                      className="w-full text-xs border rounded-lg px-2 py-1.5 bg-[var(--lava-card)] focus:outline-none focus:ring-2 focus:ring-black" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-[var(--lava-muted)] mb-1">{t('رقم التتبع', 'Tracking Number')}</label>
                                  <input type="text" value={editTrackingNumber} onChange={e => setEditTrackingNumber(e.target.value)}
                                    placeholder={t('رقم الشحن / التتبع', 'Tracking / Shipment number')}
                                    className="w-full text-xs border rounded-lg px-2 py-1.5 bg-[var(--lava-card)] focus:outline-none focus:ring-2 focus:ring-black font-mono" dir="ltr" />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-[var(--lava-muted)] mb-1">{t('ملاحظات الشحن / مشاكل', 'Shipping Notes / Issues')}</label>
                                  <input type="text" value={editShippingNotes} onChange={e => setEditShippingNotes(e.target.value)}
                                    placeholder={t('مثلاً: لم يرد على التليفون، غلط عنوان...', 'e.g. No answer, wrong address...')}
                                    className="w-full text-xs border rounded-lg px-2 py-1.5 bg-[var(--lava-card)] focus:outline-none focus:ring-2 focus:ring-black" />
                                </div>
                                <button
                                  onClick={async () => {
                                    try {
                                      await ordersAPI.updateShipping(ordId, {
                                        shippingStatus: editShippingStatus,
                                        shippingCompany: editShippingCompany,
                                        trackingNumber: editTrackingNumber,
                                        shippingNotes: editShippingNotes,
                                      });
                                      setOrders(prev => prev.map(o => (o._id || o.id) === ordId ? {
                                        ...o,
                                        shippingStatus: editShippingStatus,
                                        shippingCompany: editShippingCompany,
                                        trackingNumber: editTrackingNumber,
                                        shippingNotes: editShippingNotes,
                                      } : o));
                                      setEditingShippingOrderId(null);
                                      showToast(t('تم تحديث بيانات الشحن ✅', 'Shipping info updated ✅'));
                                    } catch { showToast(t('حصل خطأ', 'Error occurred')); }
                                  }}
                                  className="w-full bg-black text-white font-bold py-2 rounded-lg hover:bg-gray-800 transition text-sm"
                                >
                                  💾 {t('حفظ بيانات الشحن', 'Save Shipping Data')}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ===== تبويب السلات المتروكة ===== */}
            {adminTab === 'abandoned_carts' && canAccess('abandoned_carts') && (() => {
              // ===== نفس ملحوظة تبويب لوحة البيانات: abandonedCarts هنا مُصفّحة
              // (صفحة واحدة)، فالإجماليات جايه من abandonedCartStats بدل ما
              // تتحسب من الصفحة المعروضة بس. =====
              const notRecovered = abandonedCarts.filter(c => !c.recoveredAt);
              const recovered = abandonedCarts.filter(c => c.recoveredAt);
              const clientTotalLostRevenue = notRecovered.reduce((s, c) => s + (c.subtotal || 0), 0);
              const clientRecoveredRevenue = recovered.reduce((s, c) => s + (c.subtotal || 0), 0);
              const clientRecoveryRate = abandonedCarts.length > 0
                ? ((recovered.length / abandonedCarts.length) * 100).toFixed(1) : 0;
              const totalLostRevenue = abandonedCartStats ? abandonedCartStats.lostRevenue : clientTotalLostRevenue;
              const recoveredRevenue = abandonedCartStats ? abandonedCartStats.recoveredRevenue : clientRecoveredRevenue;
              const recoveryRate = abandonedCartStats ? abandonedCartStats.recoveryRate : clientRecoveryRate;

              const filtered = abandonedCarts.filter(c => {
                if (cartFilter === 'abandoned' && c.recoveredAt) return false;
                if (cartFilter === 'recovered' && !c.recoveredAt) return false;
                const q = cartSearch.toLowerCase();
                if (!q) return true;
                return (
                  (c.customerName || '').toLowerCase().includes(q) ||
                  (c.customerPhone || '').toLowerCase().includes(q) ||
                  (c.customerEmail || '').toLowerCase().includes(q) ||
                  (c.governorate || '').toLowerCase().includes(q)
                );
              });

              const formatTime = (iso) => {
                if (!iso) return '—';
                const d = new Date(iso);
                const pad = n => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
              };

              const timeSince = (iso) => {
                if (!iso) return '';
                const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
                if (mins < 60) return `${mins} ${t('دقيقة', 'min')}`;
                if (mins < 1440) return `${Math.round(mins/60)} ${t('ساعة', 'hr')}`;
                return `${Math.round(mins/1440)} ${t('يوم', 'd')}`;
              };

              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-2xl font-black text-[var(--lava-text)]">🛒 {t('السلات المتروكة', 'Abandoned Carts')}</h2>
                      <p className="text-sm text-[var(--lava-muted)] mt-0.5">{t('آخر 30 يوم', 'Last 30 days')} — {abandonedCartsTotal} {t('سلة', 'carts')}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-[var(--lava-secondary)] border rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-[var(--lava-muted)] whitespace-nowrap">
                        ⏱️ {t('اعتبرها متروكة بعد', 'Mark abandoned after')}
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={abandonedCartIdleMinutesInput}
                        onChange={(e) => setAbandonedCartIdleMinutesInput(e.target.value)}
                        className="w-16 text-xs border rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-black"
                      />
                      <span className="text-xs font-bold text-[var(--lava-muted)] whitespace-nowrap">{t('دقيقة خمول', 'min idle')}</span>
                      <button
                        onClick={saveAbandonedCartIdleMinutes}
                        disabled={savingAbandonedCartIdleMinutes || Number(abandonedCartIdleMinutesInput) === abandonedCartIdleMinutes}
                        className="text-xs bg-black text-white font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {savingAbandonedCartIdleMinutes ? '...' : t('حفظ', 'Save')}
                      </button>
                    </div>
                    {abandonedCartsLoading && (
                      <span className="text-xs text-[var(--lava-muted)] animate-pulse">{t('جاري التحميل...', 'Loading...')}</span>
                    )}
                  </div>

                  <AdminPaginationBar
                    page={abandonedCartsPage} setPage={setAbandonedCartsPage}
                    pageSize={abandonedCartsPageSize} setPageSize={setAbandonedCartsPageSize}
                    totalPages={abandonedCartsTotalPages} total={abandonedCartsTotal}
                    onRefresh={() => fetchAbandonedCarts()} loading={abandonedCartsLoading} t={t}
                  />

                  {/* KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: t('إجمالي السلات', 'Total Carts'), value: abandonedCarts.length, icon: '🛒', color: 'text-[var(--lava-text)]', bg: 'bg-[var(--lava-secondary)] border-[var(--lava-border)]' },
                      { label: t('سلات متروكة', 'Abandoned'), value: notRecovered.length, icon: '😶', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
                      { label: t('تم الإكمال', 'Recovered'), value: recovered.length, icon: '✅', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                      { label: t('نسبة الإنقاذ', 'Recovery Rate'), value: `${recoveryRate}%`, icon: '📈', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
                    ].map((kpi, i) => (
                      <div key={i} className={`p-4 rounded-xl border-2 ${kpi.bg}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-[var(--lava-muted)]">{kpi.label}</span>
                          <span>{kpi.icon}</span>
                        </div>
                        <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
                      <p className="text-xs font-bold text-red-400 mb-1">💸 {t('إيرادات ضائعة', 'Lost Revenue')}</p>
                      <p className="text-3xl font-black text-red-600">{Math.round(totalLostRevenue).toLocaleString()} {t('ج.م', 'EGP')}</p>
                      <p className="text-xs text-red-400 mt-1">{notRecovered.length} {t('سلة لم تكتمل', 'carts not completed')}</p>
                    </div>
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                      <p className="text-xs font-bold text-green-400 mb-1">💰 {t('إيرادات مستردة', 'Recovered Revenue')}</p>
                      <p className="text-3xl font-black text-green-600">{Math.round(recoveredRevenue).toLocaleString()} {t('ج.م', 'EGP')}</p>
                      <p className="text-xs text-green-400 mt-1">{recovered.length} {t('سلة اكتملت', 'carts completed')}</p>
                    </div>
                  </div>

                  {/* Search & Filter */}
                  <div className="bg-[var(--lava-card)] border rounded-xl p-4 flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={cartSearch}
                      onChange={e => setCartSearch(e.target.value)}
                      placeholder={t('بحث بالاسم أو الهاتف أو الإيميل...', 'Search by name, phone, email...')}
                      className="flex-1 px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <div className="flex gap-2">
                      {[
                        { key: 'all', label: t('الكل', 'All') },
                        { key: 'abandoned', label: t('المتروكة', 'Abandoned') },
                        { key: 'recovered', label: t('المكتملة', 'Recovered') },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setCartFilter(f.key)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition ${cartFilter === f.key ? 'bg-black text-white' : 'bg-[var(--lava-secondary)] text-[var(--lava-muted)] hover:bg-[var(--lava-border)]'}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Carts Table */}
                  <div className="bg-[var(--lava-card)] border rounded-xl overflow-hidden shadow-sm">
                    {filtered.length === 0 ? (
                      <div className="p-12 text-center text-[var(--lava-muted)]">
                        <div className="text-5xl mb-4">🛒</div>
                        <p className="font-bold">{t('لا توجد سلات', 'No carts found')}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-[var(--lava-secondary)] border-b">
                            <tr>
                              <th className="px-4 py-3 text-start font-bold text-[var(--lava-muted)] text-xs">{t('العميل', 'Customer')}</th>
                              <th className="px-4 py-3 text-start font-bold text-[var(--lava-muted)] text-xs">{t('التواصل', 'Contact')}</th>
                              <th className="px-4 py-3 text-start font-bold text-[var(--lava-muted)] text-xs">{t('المنتجات', 'Items')}</th>
                              <th className="px-4 py-3 text-start font-bold text-[var(--lava-muted)] text-xs">{t('القيمة', 'Value')}</th>
                              <th className="px-4 py-3 text-start font-bold text-[var(--lava-muted)] text-xs">{t('المحافظة', 'Gov.')}</th>
                              <th className="px-4 py-3 text-start font-bold text-[var(--lava-muted)] text-xs">{t('وقت الترك', 'Abandoned At')}</th>
                              <th className="px-4 py-3 text-start font-bold text-[var(--lava-muted)] text-xs">{t('الحالة', 'Status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filtered.map((cart, idx) => {
                              const isExpanded = expandedCart === (cart._id || idx);
                              const isRecovered = !!cart.recoveredAt;
                              const displayName = cart.customerName || (cart.isGuest ? t('زائر', 'Guest') : t('عميل', 'Customer'));
                              return (
                                <React.Fragment key={cart._id || idx}>
                                  <tr
                                    className={`hover:bg-[var(--lava-secondary)] cursor-pointer transition ${isRecovered ? 'bg-green-50/30' : ''}`}
                                    onClick={() => setExpandedCart(isExpanded ? null : (cart._id || idx))}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${cart.isGuest ? 'bg-gray-400' : 'bg-blue-500'}`}>
                                          {cart.isGuest ? '👤' : (displayName[0] || '?')}
                                        </div>
                                        <div>
                                          <p className="font-bold text-[var(--lava-text)] text-xs">{displayName}</p>
                                          {cart.isGuest && <p className="text-[10px] text-[var(--lava-muted)]">{t('بدون حساب', 'No account')}</p>}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="space-y-0.5">
                                        {cart.customerPhone && (
                                          <a href={`tel:${cart.customerPhone}`} onClick={e => e.stopPropagation()} className="block text-xs text-blue-600 hover:underline font-mono">{cart.customerPhone}</a>
                                        )}
                                        {cart.customerEmail && (
                                          <a href={`mailto:${cart.customerEmail}`} onClick={e => e.stopPropagation()} className="block text-[10px] text-[var(--lava-muted)] hover:underline truncate max-w-[140px]">{cart.customerEmail}</a>
                                        )}
                                        {!cart.customerPhone && !cart.customerEmail && (
                                          <span className="text-[10px] text-[var(--lava-muted)]">{t('لا يوجد بيانات', 'No contact info')}</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs font-bold text-[var(--lava-text)]">{(cart.items || []).length} {t('منتج', 'items')}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-sm font-black text-[var(--lava-text)]">{Math.round(cart.subtotal || 0).toLocaleString()}</span>
                                      <span className="text-xs text-[var(--lava-muted)] mr-1">{t('ج.م', 'EGP')}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs text-[var(--lava-muted)]">{cart.governorate || '—'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div>
                                        <p className="text-xs text-[var(--lava-muted)]">{formatTime(cart.createdAt)}</p>
                                        <p className="text-[10px] text-[var(--lava-muted)]">{t('منذ', 'ago')} {timeSince(cart.createdAt)}</p>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {isRecovered ? (
                                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full">✅ {t('مكتمل', 'Completed')}</span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full">⏳ {t('متروكة', 'Abandoned')}</span>
                                      )}
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr className="bg-[var(--lava-secondary)]">
                                      <td colSpan={7} className="px-6 py-4">
                                        <div className="space-y-3">
                                          <h4 className="font-bold text-sm text-[var(--lava-text)]">📦 {t('محتويات السلة', 'Cart Items')}</h4>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {(cart.items || []).map((item, ii) => (
                                              <div key={ii} className="bg-[var(--lava-card)] border rounded-lg p-3 flex items-center gap-3">
                                                {item.image && (
                                                  <img src={item.image} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-bold text-[var(--lava-text)] truncate">{item.name?.ar || item.name?.en || item.name || t('منتج', 'Product')}</p>
                                                  <div className="flex gap-2 mt-0.5">
                                                    {item.size && <span className="text-[10px] bg-[var(--lava-secondary)] text-[var(--lava-muted)] px-1.5 py-0.5 rounded font-bold">{item.size}</span>}
                                                    <span className="text-[10px] text-[var(--lava-muted)]">{item.quantity || 1} {t('قطعة', 'pcs')}</span>
                                                  </div>
                                                  <p className="text-xs font-black text-[var(--lava-text)] mt-0.5">{item.price} {t('ج.م', 'EGP')}</p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="flex flex-wrap gap-4 mt-2 pt-2 border-t text-xs text-[var(--lava-muted)]">
                                            <span>🕐 {t('آخر ظهور', 'Last seen')}: {formatTime(cart.lastSeen)}</span>
                                            {cart.recoveredAt && <span>✅ {t('اكتمل في', 'Recovered at')}: {formatTime(cart.recoveredAt)}</span>}
                                            <span>🔑 Session: <code className="text-[10px] font-mono text-[var(--lava-muted)]">{cart.sessionId?.slice(0,20)}...</code></span>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ===== Brevo Marketing ===== */}
            {adminTab === 'brevo_marketing' && canAccess('brevo_marketing') && (
              <div className="space-y-6 fade-in">
                <div className="bg-[var(--lava-card)] rounded-2xl border shadow-sm p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-2xl font-black">📨 Brevo Marketing</h2><p className="text-sm text-[var(--lava-muted)] mt-1">إرسال الرسائل يتم من الـ Backend فقط، ومفتاح Brevo لا يظهر للمتصفح.</p></div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${brevoConfigured ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{brevoConfigured ? 'Brevo Connected' : 'Brevo API غير مهيأ'}</span>
                  </div>
                  {brevoStats && (
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center"><div className="text-2xl font-black text-yellow-700">{brevoStats.pending}</div><div className="text-xs text-yellow-700">في الانتظار</div></div>
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><div className="text-2xl font-black text-green-700">{brevoStats.sent}</div><div className="text-xs text-green-700">اتبعتت</div></div>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><div className="text-2xl font-black text-red-700">{brevoStats.failed}</div><div className="text-xs text-red-700">فشلت</div></div>
                    </div>
                  )}
                  <div className="mt-5 flex items-center justify-between bg-[var(--lava-secondary)] rounded-xl p-4"><span className="font-bold">تفعيل نظام التسويق بالكامل</span><input type="checkbox" checked={!!brevoMarketing.enabled} onChange={e=>setBrevoMarketing(v=>({...v,enabled:e.target.checked}))} /></div>
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <label className="border rounded-xl p-4 flex items-center justify-between"><span className="font-bold">تأكيد الطلب عبر الإيميل/واتساب</span><input type="checkbox" checked={!!brevoMarketing.orderConfirmation} onChange={e=>setBrevoMarketing(v=>({...v,orderConfirmation:e.target.checked}))}/></label>
                    <label className="border rounded-xl p-4"><span className="font-bold block mb-2">قناة تأكيد الطلب</span><select className="w-full border rounded-lg p-2" value={brevoMarketing.orderConfirmationChannel||'email'} onChange={e=>setBrevoMarketing(v=>({...v,orderConfirmationChannel:e.target.value}))}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label>
                  </div>
                  <div className="mt-4 flex items-center justify-between border rounded-xl p-4"><span className="font-bold">رسائل حالات الطلب والشحن</span><input type="checkbox" checked={!!brevoMarketing.statusNotifications} onChange={e=>setBrevoMarketing(v=>({...v,statusNotifications:e.target.checked}))}/></div>
                  <button disabled={brevoBusy} onClick={async()=>{setBrevoBusy(true);try{const r=await (await import('./api/marketing')).marketingAPI.updateSettings(brevoMarketing);setBrevoMarketing(r.marketing||brevoMarketing);setBrevoConfigured(Boolean(r.configured));showToast('تم حفظ إعدادات Brevo');}catch(e){showToast(e.message||'تعذر الحفظ');}finally{setBrevoBusy(false)}}} className="mt-5 bg-black text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">حفظ إعدادات Brevo</button>
                </div>

                {/* ===== رسائل حالات الطلب/الشحن — الأدمن يحدد لكل حالة: تتبعت ولا لأ، وعلى إيميل ولا واتساب، ونص الرسالة ===== */}
                <div className="bg-[var(--lava-card)] rounded-2xl border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-black">🚚 رسائل حالات الطلب والشحن</h3>
                    <button onClick={()=>setBrevoMarketing(v=>({...v,statusChannels:[...(v.statusChannels||[]),{status:'',enabled:true,channel:'email',subject:'',content:''}]}))} className="text-sm font-bold bg-[var(--lava-secondary)] hover:bg-[var(--lava-border)] rounded-lg px-3 py-2">+ إضافة حالة</button>
                  </div>
                  <p className="text-xs text-[var(--lava-muted)] mb-4">اختار الحالة (من حالة الطلب أو حالة الشحن) وحدد هل تتبعت رسالة لما الطلب يوصلها، والقناة، ونص الرسالة. تفاصيل المنتجات والإجمالي وحالة الطلب بتظهر تلقائي في تصميم الإيميل، والنص اللي هتكتبه هنا بيظهر كملاحظة فوقهم.</p>
                  {(brevoMarketing.statusChannels||[]).length === 0 && <p className="text-sm text-[var(--lava-muted)] border border-dashed rounded-xl p-6 text-center">مفيش حالات مضافة، دوس "إضافة حالة" علشان تبدأ.</p>}
                  <div className="space-y-3">
                    {(brevoMarketing.statusChannels||[]).map((row,idx)=>{
                      const update = (patch)=> setBrevoMarketing(v=>({...v, statusChannels: v.statusChannels.map((r,i)=> i===idx ? {...r,...patch} : r)}));
                      const remove = ()=> setBrevoMarketing(v=>({...v, statusChannels: v.statusChannels.filter((_,i)=>i!==idx)}));
                      return (
                        <div key={idx} className="border rounded-xl p-4 bg-[var(--lava-secondary)]">
                          <div className="grid md:grid-cols-4 gap-3">
                            <select className="border rounded-lg p-2 bg-[var(--lava-card)]" value={row.status||''} onChange={e=>update({status:e.target.value})}>
                              <option value="">اختر الحالة...</option>
                              <optgroup label="حالة الطلب">
                                {['جديد','جاري التأكيد','تم التأكيد','تم التسليم','ملغي','مرتجع','مستبدل'].map(s=>(<option key={s} value={s}>{s}</option>))}
                              </optgroup>
                              <optgroup label="حالة الشحن">
                                {['لم يتم التجهيز','تم التجهيز','تم التسليم لشركة الشحن'].map(s=>(<option key={s} value={s}>{s}</option>))}
                              </optgroup>
                              {/* ===== FIX: حالات طلب الاسترجاع (اتضافت للنظام من كذا يوم، ماكانتش موجودة هنا فمكانتش بتتبعت لها رسائل) ===== */}
                              <optgroup label="حالة طلب الاسترجاع">
                                {['طلب استرجاع قيد المراجعة','تم قبول طلب الاسترجاع','تم رفض طلب الاسترجاع','شركة الشحن استلمت المرتجع','المرتجع وصل المخزن','جاري فحص المرتجع','تم استرجاع الفلوس بنجاح','تم إلغاء طلب الاسترجاع'].map(s=>(<option key={s} value={s}>{s}</option>))}
                              </optgroup>
                              {/* ===== FIX: حالات طلب الاستبدال (كانت مفقودة زي حالات الاسترجاع بالظبط) ===== */}
                              <optgroup label="حالة طلب الاستبدال">
                                {Object.values(EXCHANGE_STATUS_LABELS).map(l=>l.ar).filter((v,i,arr)=>arr.indexOf(v)===i).map(s=>(<option key={s} value={s}>{s}</option>))}
                              </optgroup>
                            </select>
                            <select className="border rounded-lg p-2 bg-[var(--lava-card)]" value={row.channel||'email'} onChange={e=>update({channel:e.target.value})}>
                              <option value="email">Email</option>
                              <option value="whatsapp">WhatsApp</option>
                            </select>
                            <label className="flex items-center gap-2 bg-[var(--lava-card)] border rounded-lg p-2 justify-center">
                              <span className="text-sm font-bold">تتبعت؟</span>
                              <input type="checkbox" checked={!!row.enabled} onChange={e=>update({enabled:e.target.checked})}/>
                            </label>
                            <button onClick={remove} className="text-red-600 font-bold text-sm bg-[var(--lava-card)] border rounded-lg p-2">حذف الحالة</button>
                          </div>
                          <input className="w-full border rounded-lg p-2 mt-3 bg-[var(--lava-card)]" placeholder="عنوان الإيميل (لو القناة إيميل)" value={row.subject||''} onChange={e=>update({subject:e.target.value})}/>
                          <textarea className="w-full border rounded-lg p-2 mt-2 min-h-24 bg-[var(--lava-card)]" placeholder="نص الرسالة..." value={row.content||''} onChange={e=>update({content:e.target.value})}/>
                        </div>
                      );
                    })}
                  </div>
                  <button disabled={brevoBusy} onClick={async()=>{setBrevoBusy(true);try{const r=await (await import('./api/marketing')).marketingAPI.updateSettings(brevoMarketing);setBrevoMarketing(r.marketing||brevoMarketing);setBrevoConfigured(Boolean(r.configured));showToast('تم حفظ رسائل الحالات');}catch(e){showToast(e.message||'تعذر الحفظ');}finally{setBrevoBusy(false)}}} className="mt-4 bg-black text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">حفظ رسائل الحالات</button>
                </div>

                {/* ===== أتمتة السلة المتروكة ===== */}
                <div className="bg-[var(--lava-card)] rounded-2xl border shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black">🛒 أتمتة السلة المتروكة</h3>
                    <input type="checkbox" checked={!!brevoMarketing.abandonedCart?.enabled} onChange={e=>setBrevoMarketing(v=>({...v,abandonedCart:{...(v.abandonedCart||{}),enabled:e.target.checked}}))}/>
                  </div>
                  <p className="text-xs text-[var(--lava-muted)] mt-2 mb-4">الرسالة بتتبعت لو العميل حط منتج في السلة (وهو مسجل دخول) وسابها من غير ما يكمل الشراء. المنتجات وكود الخصم بيظهروا تلقائي في تصميم الإيميل، والنص اللي هتكتبه هنا بيظهر فوقهم كرسالة ترحيبية.</p>
                  <div className="space-y-3">
                    {(brevoMarketing.abandonedCart?.steps||[]).map((step,idx)=>{
                      const update = (patch)=> setBrevoMarketing(v=>({...v, abandonedCart:{...v.abandonedCart, steps: v.abandonedCart.steps.map((s,i)=> i===idx ? {...s,...patch} : s)}}));
                      const remove = ()=> setBrevoMarketing(v=>({...v, abandonedCart:{...v.abandonedCart, steps: v.abandonedCart.steps.filter((_,i)=>i!==idx)}}));
                      return (
                        <div key={idx} className="border rounded-xl p-4 bg-[var(--lava-secondary)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm">الرسالة رقم {idx+1}</span>
                            <button onClick={remove} className="text-red-600 font-bold text-sm bg-[var(--lava-card)] border rounded-lg px-3 py-1.5">حذف الرسالة</button>
                          </div>
                          <div className="grid md:grid-cols-3 gap-3">
                            <label className="bg-[var(--lava-card)] border rounded-lg p-2">
                              <span className="text-xs text-[var(--lava-muted)] block mb-1">تتبعت بعد (بالدقايق)</span>
                              <input type="number" min="1" className="w-full outline-none" value={step.delayMinutes||120} onChange={e=>update({delayMinutes:Number(e.target.value)||120})}/>
                            </label>
                            <select className="border rounded-lg p-2 bg-[var(--lava-card)]" value={step.channel||'email'} onChange={e=>update({channel:e.target.value})}>
                              <option value="email">Email</option>
                              <option value="whatsapp">WhatsApp</option>
                            </select>
                            <input className="border rounded-lg p-2 bg-[var(--lava-card)]" placeholder="كود خصم (اختياري)" value={step.couponCode||''} onChange={e=>update({couponCode:e.target.value})}/>
                          </div>
                          <input className="w-full border rounded-lg p-2 mt-3 bg-[var(--lava-card)]" placeholder="عنوان الإيميل" value={step.subject||''} onChange={e=>update({subject:e.target.value})}/>
                          <textarea className="w-full border rounded-lg p-2 mt-2 min-h-24 bg-[var(--lava-card)]" placeholder="نص الرسالة..." value={step.content||''} onChange={e=>update({content:e.target.value})}/>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={()=>setBrevoMarketing(v=>({...v,abandonedCart:{...(v.abandonedCart||{}),steps:[...(v.abandonedCart?.steps||[]),{delayMinutes:120,channel:'email',subject:'لسه حاجاتك في السلة',content:'وحشتنا! لسه المنتجات دي محفوظة في عربيتك.',couponCode:''}]}}))} className="mt-3 text-sm font-bold bg-[var(--lava-secondary)] hover:bg-[var(--lava-border)] rounded-lg px-3 py-2">+ إضافة رسالة جديدة</button>
                  <div className="mt-4 p-4 rounded-xl bg-blue-50 text-blue-800 text-sm">الرسائل المجدولة بتتلغي تلقائيًا لو السلة اتعافت بعمل أوردر حقيقي.</div>
                  <button disabled={brevoBusy} onClick={async()=>{setBrevoBusy(true);try{const r=await (await import('./api/marketing')).marketingAPI.updateSettings(brevoMarketing);setBrevoMarketing(r.marketing||brevoMarketing);setBrevoConfigured(Boolean(r.configured));showToast('تم حفظ أتمتة السلة المتروكة');}catch(e){showToast(e.message||'تعذر الحفظ');}finally{setBrevoBusy(false)}}} className="mt-4 bg-black text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">حفظ أتمتة السلة المتروكة</button>
                </div>

                <div className="bg-[var(--lava-card)] rounded-2xl border shadow-sm p-6">
                  <h3 className="text-xl font-black mb-4">📣 حملة تسويقية للعملاء</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <select className="border rounded-lg p-3" value={brevoCampaign.channel} onChange={e=>setBrevoCampaign(v=>({...v,channel:e.target.value}))}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select>
                    <select className="border rounded-lg p-3" value={brevoCampaign.audience} onChange={e=>setBrevoCampaign(v=>({...v,audience:e.target.value}))}>
                      <option value="all">كل العملاء</option>
                      <option value="with_orders">العملاء أصحاب الطلبات</option>
                      <option value="abandoned_cart">حطوا حاجات في السلة وماكملوش</option>
                      <option value="inactive_customers">عملاء ماطلبوش من فترة (60 يوم)</option>
                    </select>
                  </div>
                  {brevoCampaign.channel === 'whatsapp' && (
                    <input className="w-full border rounded-lg p-3 mt-3" placeholder="Brevo WhatsApp Template ID" value={brevoCampaign.whatsappTemplateId} onChange={e=>setBrevoCampaign(v=>({...v,whatsappTemplateId:e.target.value}))}/>
                  )}
                  <input className="w-full border rounded-lg p-3 mt-3" placeholder="عنوان الإيميل" value={brevoCampaign.subject} onChange={e=>setBrevoCampaign(v=>({...v,subject:e.target.value}))}/>
                  <textarea className="w-full border rounded-lg p-3 mt-3 min-h-40" placeholder="اكتب رسالة الحملة..." value={brevoCampaign.content} onChange={e=>setBrevoCampaign(v=>({...v,content:e.target.value}))}/>
                  <button disabled={brevoBusy} onClick={async()=>{setBrevoBusy(true);try{const r=await (await import('./api/marketing')).marketingAPI.sendCampaign(brevoCampaign);showToast(`تم تجهيز ${r.queued||0} رسالة للإرسال`);}catch(e){showToast(e.message||'تعذر إرسال الحملة');}finally{setBrevoBusy(false)}}} className="mt-4 bg-black text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">تجهيز وإرسال الحملة</button>
                </div>
              </div>
            )}

            {/* ===== تبويب الثيمات ===== */}
            {adminTab === 'themes' && canAccess('settings') && (
              <Suspense fallback={<PageLoadingFallback />}>
                <ThemeBuilder
                  adminSettings={adminSettings}
                  bumpSettings={bumpSettings}
                  showToast={showToast}
                  t={t}
                  getLocalized={getLocalized}
                />
              </Suspense>
            )}

                        {/* ===== تبويب إعدادات المحتوى ===== */}
            {adminTab === 'content' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">{t('إعدادات شكل الموقع', 'Site Design Settings')}</h2>
                <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                  <input type="checkbox" id="showCount" checked={adminSettings.current.showCountdownBar} onChange={(e) => { adminSettings.current.showCountdownBar = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                  <label htmlFor="showCount" className="font-bold text-lg cursor-pointer">{t('إظهار شريط العداد التنازلي', 'Show Countdown Bar')}</label>
                </div>
                <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-2">
                  <label htmlFor="saleEndDate" className="block font-bold">{t('العرض هيخلص إمتى؟', 'When does the sale end?')}</label>
                  <input type="datetime-local" id="saleEndDate" value={toDatetimeLocalValue(adminSettings.current.saleEndDate)} onChange={(e) => { if (!e.target.value) return; adminSettings.current.saleEndDate = new Date(e.target.value).toISOString(); bumpSettings(); }} className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]" />
                  <p className="text-xs text-[var(--lava-muted)]">{t('العداد فوق الموقع والأسعار المخفّضة هترجع تلقائي للسعر العادي أول ما الوقت ده يخلص.', 'The counter and sale prices will revert automatically when this time expires.')}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <InputField label={`${t('اسم المتجر', 'Store Name')} (${t('عربي', 'Arabic')})`} type="text" value={getLocalized(adminSettings.current.storeName)} onChange={(e) => { adminSettings.current.storeName = { ...adminSettings.current.storeName, ar: e.target.value }; adminSettings.current.logoText = { ...adminSettings.current.logoText, ar: e.target.value }; bumpSettings(); }} id="storeNameAr" />
                  <InputField label={`${t('اسم المتجر', 'Store Name')} (English)`} type="text" value={adminSettings.current.storeName.en || ''} onChange={(e) => { adminSettings.current.storeName = { ...adminSettings.current.storeName, en: e.target.value }; adminSettings.current.logoText = { ...adminSettings.current.logoText, en: e.target.value }; bumpSettings(); }} id="storeNameEn" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ImageUrlOrUploadField label={t('صورة البانر (الصفحة الرئيسية)', 'Hero/Banner Image')} value={adminSettings.current.heroImage} onChange={(url) => { adminSettings.current.heroImage = url; bumpSettings(); }} id="heroImage" showToast={showToast} t={t} />
                  <div>
                    <VideoUploadField
                      label={t('فيديو البانر (اختياري — لو موجود بيظهر بدل الصورة)', 'Hero/Banner Video (optional — shown instead of the image if set)')}
                      value={adminSettings.current.heroVideo}
                      onChange={(uploaded) => { adminSettings.current.heroVideo = uploaded?.url || ''; bumpSettings(); }}
                      id="heroVideo"
                      showToast={showToast}
                      t={t}
                      uploader={settingsAPI.uploadVideo}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 pt-4 border-t">
                  <h3 className="text-xl font-bold">{t('نص البانر (الصفحة الرئيسية)', 'Banner Text (Home Page)')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label={`${t('العنوان الرئيسي', 'Main Title')} (${t('عربي', 'Arabic')})`} type="text" value={getLocalized(adminSettings.current.heroTitle)} onChange={(e) => { adminSettings.current.heroTitle = { ...adminSettings.current.heroTitle, ar: e.target.value }; bumpSettings(); }} id="heroTitleAr" />
                    <InputField label={`${t('العنوان الرئيسي', 'Main Title')} (English)`} type="text" value={adminSettings.current.heroTitle.en || ''} onChange={(e) => { adminSettings.current.heroTitle = { ...adminSettings.current.heroTitle, en: e.target.value }; bumpSettings(); }} id="heroTitleEn" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label={`${t('العنوان الفرعي', 'Subtitle')} (${t('عربي', 'Arabic')})`} type="text" value={getLocalized(adminSettings.current.heroSubtitle)} onChange={(e) => { adminSettings.current.heroSubtitle = { ...adminSettings.current.heroSubtitle, ar: e.target.value }; bumpSettings(); }} id="heroSubtitleAr" />
                    <InputField label={`${t('العنوان الفرعي', 'Subtitle')} (English)`} type="text" value={adminSettings.current.heroSubtitle.en || ''} onChange={(e) => { adminSettings.current.heroSubtitle = { ...adminSettings.current.heroSubtitle, en: e.target.value }; bumpSettings(); }} id="heroSubtitleEn" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 pt-4 border-t">
                  <h3 className="text-xl font-bold">{t('اللوجو في الهيدر', 'Header Logo')}</h3>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="useLogoImage" checked={!!adminSettings.current.useLogoImage} onChange={(e) => { adminSettings.current.useLogoImage = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="useLogoImage" className="font-semibold cursor-pointer">{t('استخدام صورة لوجو بدل اسم المتجر في المنتصف', 'Use a logo image instead of the store name in the header')}</label>
                  </div>
                  {adminSettings.current.useLogoImage && (
                    <ImageUrlOrUploadField label={t('صورة اللوجو', 'Logo Image')} value={adminSettings.current.logoImage} onChange={(url) => { adminSettings.current.logoImage = url; bumpSettings(); }} placeholder="https://example.com/logo.png" id="logoImageUrl" showToast={showToast} t={t} />
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 pt-4 border-t">
                  <h3 className="text-xl font-bold">{t('أيقونة المتجر (Favicon)', 'Store Icon (Favicon)')}</h3>
                  <p className="text-sm text-[var(--lava-muted)] -mt-2">
                    {t('الصورة اللي بتبان جنب اسم الموقع فوق في تبويب المتصفح. الأفضل صورة مربعة (زي 512×512) بخلفية واضحة.', 'The small icon shown next to the site name in the browser tab. Best as a square image (e.g. 512×512) with a clear background.')}
                  </p>
                  <ImageUrlOrUploadField label={t('صورة الأيقونة', 'Icon Image')} value={adminSettings.current.faviconImage} onChange={(url) => { adminSettings.current.faviconImage = url; bumpSettings(); }} placeholder="https://example.com/favicon.png" id="faviconImageUrl" showToast={showToast} t={t} />
                </div>
                <div className="grid grid-cols-1 gap-6 pt-4 border-t">
                  <h3 className="text-xl font-bold">{t('إعدادات قسم "عن المكان"', 'About Section Settings')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextareaField label={`${t('نص نبذة عن المتجر', 'About Text')} (${t('عربي', 'Arabic')})`} value={getLocalized(adminSettings.current.aboutText)} onChange={(e) => { adminSettings.current.aboutText = { ...adminSettings.current.aboutText, ar: e.target.value }; bumpSettings(); }} rows={4} id="aboutTextAr" />
                    <TextareaField label={`${t('نص نبذة عن المتجر', 'About Text')} (English)`} value={adminSettings.current.aboutText.en || ''} onChange={(e) => { adminSettings.current.aboutText = { ...adminSettings.current.aboutText, en: e.target.value }; bumpSettings(); }} rows={4} id="aboutTextEn" />
                  </div>
                  <ImageUrlOrUploadField label={t('صورة نبذة عن المتجر', 'About Image')} value={adminSettings.current.aboutImage} onChange={(url) => { adminSettings.current.aboutImage = url; bumpSettings(); }} id="aboutImage" showToast={showToast} t={t} />
                </div>
                <div className="grid grid-cols-1 gap-6 pt-6 border-t">
                  <h3 className="text-xl font-bold">⚙️ {t('إعدادات الفوتر', 'Footer Settings')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label={`${t('نص العنوان', 'Address Text')} (${t('عربي', 'Arabic')})`} type="text" value={getLocalized(adminSettings.current.locationText)} onChange={(e) => { adminSettings.current.locationText = { ...adminSettings.current.locationText, ar: e.target.value }; bumpSettings(); }} placeholder={t('مثال: القاهرة، مصر', 'e.g. Cairo, Egypt')} id="locationTextAr" />
                    <InputField label={`${t('نص العنوان', 'Address Text')} (English)`} type="text" value={adminSettings.current.locationText.en || ''} onChange={(e) => { adminSettings.current.locationText = { ...adminSettings.current.locationText, en: e.target.value }; bumpSettings(); }} placeholder="e.g. Cairo, Egypt" id="locationTextEn" />
                  </div>
                  <InputField label={t('رقم الهاتف', 'Phone')} type="tel" value={adminSettings.current.phone} onChange={(e) => { adminSettings.current.phone = e.target.value; bumpSettings(); }} placeholder={t('مثال: 01091900530', 'e.g. 01091900530')} id="footerPhone" />
                  <InputField label={t('رقم واتساب (اختياري)', 'WhatsApp (optional)')} type="tel" value={adminSettings.current.whatsapp} onChange={(e) => { adminSettings.current.whatsapp = e.target.value; bumpSettings(); }} placeholder={t('مثال: 01012345678', 'e.g. 01012345678')} id="footerWhatsapp" />
                  <InputField label={t('البريد الإلكتروني', 'Email')} type="email" value={adminSettings.current.email} onChange={(e) => { adminSettings.current.email = e.target.value; bumpSettings(); }} placeholder={t('مثال: info@lava.com', 'e.g. info@lava.com')} id="footerEmail" />
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showLocation" checked={adminSettings.current.showLocation} onChange={(e) => { adminSettings.current.showLocation = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showLocation" className="font-bold text-lg cursor-pointer">{t('إظهار العنوان / الفرع', 'Show Address / Branch')}</label>
                  </div>
                  <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-4">
                    <p className="font-bold">{t('روابط التواصل الاجتماعي', 'Social Media Links')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: 'socialFacebook', label: t('فيسبوك', 'Facebook'), icon: 'fab fa-facebook', defaultUrl: 'https://facebook.com' },
                        { key: 'socialInstagram', label: t('انستجرام', 'Instagram'), icon: 'fab fa-instagram', defaultUrl: 'https://instagram.com' },
                        { key: 'socialTiktok', label: t('تيك توك', 'TikTok'), icon: 'fab fa-tiktok', defaultUrl: 'https://tiktok.com' },
                        { key: 'socialYoutube', label: t('يوتيوب', 'YouTube'), icon: 'fab fa-youtube', defaultUrl: '' },
                        { key: 'socialLinkedin', label: t('لينكد إن', 'LinkedIn'), icon: 'fab fa-linkedin', defaultUrl: '' },
                        { key: 'socialSnapchat', label: t('سناب شات', 'Snapchat'), icon: 'fab fa-snapchat', defaultUrl: '' },
                      ].map((platform) => {
                        const enabledKey = platform.key + 'Enabled';
                        const urlValue = adminSettings.current[platform.key] || '';
                        return (
                          <div key={platform.key} className="space-y-2 border-b pb-3">
                            <div className="flex items-center gap-3">
                              <input type="checkbox" id={enabledKey} checked={adminSettings.current[enabledKey] || false} onChange={(e) => { adminSettings.current[enabledKey] = e.target.checked; bumpSettings(); }} className="w-4 h-4" />
                              <label htmlFor={enabledKey} className="font-semibold text-sm"><i className={platform.icon}></i> {platform.label}</label>
                            </div>
                            <input type="text" value={urlValue} onChange={(e) => { adminSettings.current[platform.key] = e.target.value; bumpSettings(); }} placeholder={`${t('رابط', 'Link')} ${platform.label}`} className="w-full px-4 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm" dir="ltr" />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ===== إدارة روابط الفوتر (Quick Links) — الأدمن يضيف/يشيل اللي هو عايزه بس ===== */}
                  <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-bold">🔗 {t('روابط سريعة في الفوتر', 'Footer Quick Links')}</p>
                      <button
                        type="button"
                        onClick={() => {
                          const newLink = {
                            id: `fl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                            label: { ar: '', en: '' },
                            target: 'home',
                            url: '',
                            enabled: true,
                          };
                          adminSettings.current.footerLinks = [...(adminSettings.current.footerLinks || []), newLink];
                          bumpSettings();
                        }}
                        className="bg-black text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-800"
                      >
                        + {t('إضافة رابط', 'Add Link')}
                      </button>
                    </div>
                    <p className="text-xs text-[var(--lava-muted)]">{t('اختار بالظبط الروابط اللي عايز تظهر للعميل تحت في الفوتر. لو مسحت كل الروابط، الجزء ده هيختفي من الفوتر تلقائياً.', 'Choose exactly the links you want shown to customers in the footer. If you remove all links, this section disappears from the footer automatically.')}</p>

                    {(!adminSettings.current.footerLinks || adminSettings.current.footerLinks.length === 0) && (
                      <p className="text-[var(--lava-muted)] text-sm">{t('لسه مفيش روابط مضافة.', 'No links added yet.')}</p>
                    )}

                    {(adminSettings.current.footerLinks || []).map((link, idx) => {
                      const updateLink = (patch) => {
                        const updated = [...adminSettings.current.footerLinks];
                        updated[idx] = { ...updated[idx], ...patch };
                        adminSettings.current.footerLinks = updated;
                        bumpSettings();
                      };
                      return (
                        <div key={link.id} className={`space-y-3 p-3 rounded-lg border-2 ${link.enabled !== false ? 'border-blue-100 bg-[var(--lava-card)]' : 'border-[var(--lava-border)] bg-[var(--lava-secondary)]'}`}>
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <label className="flex items-center gap-2 font-bold cursor-pointer text-sm">
                              <input type="checkbox" checked={link.enabled !== false} onChange={(e) => updateLink({ enabled: e.target.checked })} className="w-5 h-5" />
                              {getLocalized(link.label) || t('رابط بدون اسم', 'Unnamed link')}
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = adminSettings.current.footerLinks.filter((_, i) => i !== idx);
                                adminSettings.current.footerLinks = updated;
                                bumpSettings();
                              }}
                              className="text-red-600 hover:text-red-800 text-sm font-bold"
                            >
                              🗑 {t('حذف', 'Delete')}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="text" value={link.label?.ar || ''} onChange={(e) => updateLink({ label: { ...link.label, ar: e.target.value } })} placeholder={t('اسم الرابط (عربي)', 'Link name (Arabic)')} className="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm" dir="rtl" />
                            <input type="text" value={link.label?.en || ''} onChange={(e) => updateLink({ label: { ...link.label, en: e.target.value } })} placeholder={t('اسم الرابط (إنجليزي)', 'Link name (English)')} className="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm" dir="ltr" />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <select value={link.target || 'home'} onChange={(e) => updateLink({ target: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm bg-[var(--lava-card)]">
                              <option value="home">{t('الصفحة الرئيسية', 'Home')}</option>
                              <option value="shop">{t('المتجر', 'Shop')}</option>
                              <option value="contact">{t('تواصل معنا', 'Contact')}</option>
                              <option value="wishlist">{t('المفضلة', 'Wishlist')}</option>
                              <option value="my-orders">{t('طلباتي', 'My Orders')}</option>
                              <option value="account">{t('حسابي', 'Account')}</option>
                              {faqs.length > 0 && <option value="faq">{t('الأسئلة الشائعة', 'FAQ')}</option>}
                              {customPages.map(p => (
                                <option key={p.id} value={`custom:${p.id}`}>{getLocalized(p.title)}</option>
                              ))}
                              <option value="external">{t('رابط خارجي (مخصص)', 'External Link')}</option>
                            </select>
                            {link.target === 'external' && (
                              <input type="text" value={link.url || ''} onChange={(e) => updateLink({ url: e.target.value })} placeholder="https://..." className="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm" dir="ltr" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ===== التحكم في ظهور عمود التصنيفات في الفوتر ===== */}
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showFooterCategories" checked={adminSettings.current.showFooterCategories !== false} onChange={(e) => { adminSettings.current.showFooterCategories = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showFooterCategories" className="font-bold text-lg cursor-pointer">🏷️ {t('إظهار عمود "التصنيفات" في الفوتر', 'Show "Categories" column in footer')}</label>
                  </div>
                  <p className="text-xs text-[var(--lava-muted)] px-1">{t('لو معطّل، عمود التصنيفات مش هيبان في الفوتر خالص، حتى لو عندك تصنيفات مضافة.', 'If disabled, the Categories column won\'t show in the footer at all, even if you have categories added.')}</p>
                </div>
                <div className="pt-6 border-t">
                  <h3 className="text-xl font-bold">{t('إعدادات التوصيات والعروض', 'Recommendations & Offers Settings')}</h3>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showRecommendations" checked={adminSettings.current.showRecommendations} onChange={(e) => { adminSettings.current.showRecommendations = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showRecommendations" className="font-bold text-lg cursor-pointer">{t('إظهار المنتجات المقترحة', 'Show Recommended Products')}</label>
                  </div>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showBundleOffers" checked={adminSettings.current.showBundleOffers} onChange={(e) => { adminSettings.current.showBundleOffers = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showBundleOffers" className="font-bold text-lg cursor-pointer">{t('إظهار عروض الشراء المشترك', 'Show Bundle Offers')}</label>
                  </div>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showRecentlyViewed" checked={!!adminSettings.current.showRecentlyViewed} onChange={(e) => { adminSettings.current.showRecentlyViewed = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showRecentlyViewed" className="font-bold text-lg cursor-pointer">{t('إظهار "شاهدته مؤخراً" تحت تفاصيل المنتج', 'Show "Recently Viewed" under product details')}</label>
                  </div>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showLiveViewers" checked={adminSettings.current.showLiveViewers || false} onChange={(e) => { adminSettings.current.showLiveViewers = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showLiveViewers" className="font-bold text-lg cursor-pointer">👀 {t('إظهار عدد العملاء اللي بيشوفوا صفحة المنتج دلوقتي', 'Show live viewers count on product page')}</label>
                  </div>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="showReviews" checked={adminSettings.current.showReviews} onChange={(e) => { adminSettings.current.showReviews = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="showReviews" className="font-bold text-lg cursor-pointer">⭐ {t('تفعيل التقييمات والمراجعات (عام)', 'Enable Reviews & Ratings (global)')}</label>
                  </div>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="reviewsRequireApproval" checked={adminSettings.current.reviewsRequireApproval !== false} onChange={(e) => { adminSettings.current.reviewsRequireApproval = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="reviewsRequireApproval" className="font-bold text-lg cursor-pointer">✅ {t('لازم موافقة الأدمن قبل نشر أي تقييم', 'Require admin approval before publishing reviews')}</label>
                  </div>
                  <p className="text-xs text-[var(--lava-muted)] px-1">{t('لو مفعّل، أي تقييم جديد من العملاء هيفضل مخفي لحد ما توافق عليه من تبويب "تقييمات العملاء". لو معطّل، التقييمات هتظهر فوراً من غير مراجعة.', 'If enabled, new customer reviews stay hidden until you approve them from the "Customer Reviews" tab. If disabled, reviews appear instantly without review.')}</p>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="allowReviewImages" checked={adminSettings.current.allowReviewImages !== false} onChange={(e) => { adminSettings.current.allowReviewImages = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="allowReviewImages" className="font-bold text-lg cursor-pointer">📷 {t('السماح للعميل برفع صورة مع التقييم', 'Allow customers to attach a photo to their review')}</label>
                  </div>
                  <p className="text-xs text-[var(--lava-muted)] px-1">{t('لو معطّل، خيار رفع الصورة مش هيبان للعميل أصلاً وهو بيكتب تقييمه.', 'If disabled, the photo upload option won\'t be shown to customers writing a review at all.')}</p>
                  <p className="text-xs text-[var(--lava-muted)] px-1">{t('يمكنك أيضاً تفعيل/تعطيل التقييمات لكل منتج على حدة من تبويب "إدارة المنتجات".', 'You can also enable/disable reviews per individual product from the "Product Management" tab.')}</p>
                </div>
                <div className="pt-6 border-t space-y-3">
                  <h3 className="text-xl font-bold">{t('إعدادات المخزون والتوفر', 'Inventory & Availability Settings')}</h3>
                  <div className="flex items-center gap-4 bg-[var(--lava-secondary)] p-4 rounded-lg border">
                    <input type="checkbox" id="displayOutOfStockProducts" checked={adminSettings.current.displayOutOfStockProducts} onChange={(e) => { adminSettings.current.displayOutOfStockProducts = e.target.checked; bumpSettings(); }} className="w-5 h-5" />
                    <label htmlFor="displayOutOfStockProducts" className="font-bold text-lg cursor-pointer">{t('إظهار المنتجات غير المتوفرة للعملاء (بعلامة "غير متوفر")', 'Display out-of-stock products to customers (with "Out of Stock" badge)')}</label>
                  </div>
                  <p className="text-xs text-[var(--lava-muted)] px-1">{t('لو الخيار مقفول، المنتجات اللي كل الفاريانتس بتاعتها بمخزون صفر هتتخفي تماماً من الرئيسية والمتجر والبحث والتوصيات.', 'When off, products with zero stock across all variants are hidden entirely from home, shop, search, and recommendations.')}</p>
                  <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border max-w-xs">
                    <label className="block font-bold text-sm mb-1">{t('حد التنبيه الافتراضي للمخزون المنخفض', 'Default low stock threshold')}</label>
                    <input
                      type="number"
                      min="0"
                      value={adminSettings.current.defaultLowStockThreshold}
                      onChange={(e) => { adminSettings.current.defaultLowStockThreshold = Math.max(0, Number(e.target.value) || 0); bumpSettings(); }}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]"
                    />
                    <p className="text-xs text-[var(--lava-muted)] mt-1">{t('ينطبق على أي منتج مالوش حد مخصص خاص بيه.', 'Applies to any product without its own custom threshold.')}</p>
                  </div>
                </div>
                <button onClick={() => saveAdminSettings()} className="bg-black text-white px-8 py-3 rounded-lg font-bold">{t('حفظ التعديلات', 'Save Changes')}</button>
              </div>
            )}

            {/* ===== تبويب أقسام الصفحة الرئيسية ===== */}
            {adminTab === 'home_sections' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">🏠 {t('إدارة أقسام الصفحة الرئيسية', 'Home Page Sections')}</h2>
                <p className="text-sm text-[var(--lava-muted)] mb-4">{t('أضف أقساماً جديدة تظهر في الصفحة الرئيسية (صورة، نص، أو كلاهما).', 'Add new sections to the home page (image, text, or both).')}</p>

                {/* ===== التحكم في المنتجات المميزة ===== */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-blue-800">⭐ {t('قسم المنتجات المميزة', 'Featured Products Section')}</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm font-medium text-blue-700">{t('ظاهر', 'Visible')}</span>
                      <input type="checkbox"
                        checked={adminSettings.current.showFeaturedSection !== false}
                        onChange={(e) => { adminSettings.current.showFeaturedSection = e.target.checked; saveAdminSettings(t('تم الحفظ', 'Saved'), { showFeaturedSection: e.target.checked }); bumpSettings(); }}
                        className="w-4 h-4 accent-blue-600" />
                    </label>
                  </div>
                  {adminSettings.current.showFeaturedSection !== false && (<>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <InputField label={t('عنوان القسم (عربي)', 'Section Title (AR)')} type="text"
                        value={adminSettings.current.featuredSectionTitle?.ar || ''}
                        onChange={(e) => { adminSettings.current.featuredSectionTitle = { ...adminSettings.current.featuredSectionTitle, ar: e.target.value }; bumpSettings(); }}
                        placeholder={t('منتجات مميزة', 'Featured Products')} id="featuredTitleAr" />
                      <InputField label={t('عنوان القسم (EN)', 'Section Title (EN)')} type="text"
                        value={adminSettings.current.featuredSectionTitle?.en || ''}
                        onChange={(e) => { adminSettings.current.featuredSectionTitle = { ...adminSettings.current.featuredSectionTitle, en: e.target.value }; bumpSettings(); }}
                        placeholder="Featured Products" id="featuredTitleEn" />
                    </div>
                    <p className="text-xs text-blue-600">{t('شكل عرض المنتجات المميزة', 'Display style')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { value: 'grid', label: t('شبكة', 'Grid'), icon: '⊞' },
                        { value: 'masonry', label: t('موزاييك', 'Masonry'), icon: '▦' },
                        { value: 'list', label: t('قائمة', 'List'), icon: '☰' },
                        { value: 'carousel', label: t('كاروسيل', 'Carousel'), icon: '◁▷' },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => { adminSettings.current.featuredDisplayStyle = opt.value; saveAdminSettings(t('تم الحفظ', 'Saved'), { featuredDisplayStyle: opt.value }); bumpSettings(); }}
                          className={`py-3 rounded-lg font-bold text-sm border-2 transition ${(adminSettings.current.featuredDisplayStyle || 'grid') === opt.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--lava-border)] bg-[var(--lava-card)] text-[var(--lava-text)] hover:border-blue-400'}`}>
                          <div className="text-xl mb-1">{opt.icon}</div>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button type="button"
                      onClick={() => saveAdminSettings(t('تم الحفظ', 'Saved'), { featuredDisplayStyle: adminSettings.current.featuredDisplayStyle, featuredSectionTitle: adminSettings.current.featuredSectionTitle })}
                      className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold">
                      {t('حفظ التغييرات', 'Save Changes')}
                    </button>
                  </>)}
                </div>

                {/* ===== التحكم في نبذة عن المتجر ===== */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-green-800">🏪 {t('قسم نبذة عن المتجر', 'About Store Section')}</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm font-medium text-green-700">{t('ظاهر', 'Visible')}</span>
                      <input type="checkbox"
                        checked={adminSettings.current.showAboutSection !== false}
                        onChange={(e) => { adminSettings.current.showAboutSection = e.target.checked; saveAdminSettings(t('تم الحفظ', 'Saved'), { showAboutSection: e.target.checked }); bumpSettings(); }}
                        className="w-4 h-4 accent-green-600" />
                    </label>
                  </div>
                  {adminSettings.current.showAboutSection !== false && (
                    <p className="text-xs text-green-700">{t('لتعديل نص النبذة والصورة، اذهب إلى إعدادات المتجر ← المحتوى', 'To edit about text and image, go to Store Settings → Content')}</p>
                  )}
                </div>

                <form onSubmit={addHomeSection} className="space-y-4 border-b pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SelectField
                      label={t('نوع القسم', 'Section Type')}
                      value={newSectionType}
                      onChange={(e) => { setNewSectionType(e.target.value); }}
                      options={[
                        { value: 'image-text', label: '🖼️ ' + t('صورة + نص', 'Image + Text') },
                        { value: 'image-only', label: '📷 ' + t('صورة فقط', 'Image Only') },
                        { value: 'text-only', label: '📝 ' + t('نص فقط', 'Text Only') },
                        { value: 'products-featured', label: '⭐ ' + t('منتجات مميزة', 'Featured Products') },
                        { value: 'products-bestsellers', label: '🔥 ' + t('الأكثر مبيعاً', 'Best Sellers') },
                        { value: 'products-all', label: '📦 ' + t('جميع المنتجات', 'All Products') },
                        { value: 'products-custom', label: '✋ ' + t('منتجات بالاختيار', 'Custom Products') },
                        { value: 'products-category', label: '🗂️ ' + t('منتجات قسم معين', 'Category Products') },
                      ]}
                      id="sectionType"
                    />
                  </div>

                  {/* عنوان ووصف — يظهروا دايماً */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label={`${t('العنوان', 'Title')} (${t('عربي', 'Arabic')})`} type="text" value={newSectionTitleAr} onChange={(e) => setNewSectionTitleAr(e.target.value)} placeholder={t('عنوان القسم', 'Section Title')} id="sectionTitleAr" />
                    <InputField label={`${t('العنوان', 'Title')} (English)`} type="text" value={newSectionTitleEn} onChange={(e) => setNewSectionTitleEn(e.target.value)} placeholder="Section Title" id="sectionTitleEn" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextareaField label={`${t('الوصف', 'Description')} (${t('عربي', 'Arabic')})`} value={newSectionDescAr} onChange={(e) => setNewSectionDescAr(e.target.value)} placeholder={t('وصف القسم', 'Section description')} rows={2} id="sectionDescAr" />
                    <TextareaField label={`${t('الوصف', 'Description')} (English)`} value={newSectionDescEn} onChange={(e) => setNewSectionDescEn(e.target.value)} placeholder="Section description" rows={2} id="sectionDescEn" />
                  </div>

                  {/* حقول المنتجات — تظهر فقط لو النوع منتجات */}
                  {PRODUCT_SECTION_TYPES.includes(newSectionType) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <p className="font-bold text-amber-800 text-sm">⚙️ {t('إعدادات عرض المنتجات', 'Product Display Settings')}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold mb-1 text-sm">{t('عدد المنتجات', 'Number of Products')}</label>
                          <input type="number" min={1} max={24} value={newSectionProductCount}
                            onChange={e => setNewSectionProductCount(Number(e.target.value))}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]" />
                        </div>
                        <SelectField label={t('شكل العرض', 'Display Style')} value={newSectionDisplayStyle}
                          onChange={e => setNewSectionDisplayStyle(e.target.value)}
                          options={[
                            { value: 'grid', label: '⊞ ' + t('شبكة', 'Grid') },
                            { value: 'masonry', label: '▦ ' + t('موزاييك', 'Masonry') },
                            { value: 'list', label: '☰ ' + t('قائمة عمودية', 'List') },
                            { value: 'carousel', label: '◁▷ ' + t('كاروسيل', 'Carousel') },
                          ]} id="sectionDisplayStyle" />
                      </div>
                      {newSectionType === 'products-custom' && (
                        <div>
                          <label className="block font-semibold mb-2 text-sm">{t('اختر المنتجات', 'Choose Products')}</label>
                          <div className="max-h-48 overflow-y-auto border rounded-lg bg-[var(--lava-card)] divide-y">
                            {products.filter(p => isProductVisibleToCustomer(p)).map(p => (
                              <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--lava-secondary)] cursor-pointer">
                                <input type="checkbox" checked={newSectionProductIds.includes(String(p.id))}
                                  onChange={e => {
                                    const sid = String(p.id);
                                    setNewSectionProductIds(prev => e.target.checked ? [...prev, sid] : prev.filter(x => x !== sid));
                                  }} className="w-4 h-4" />
                                {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 object-cover rounded" />}
                                <span className="text-sm font-medium">{getLocalized(p.name)}</span>
                                <span className="text-xs text-[var(--lava-muted)] mr-auto">{p.price} {t('ج.م', 'EGP')}</span>
                              </label>
                            ))}
                          </div>
                          {newSectionProductIds.length > 0 && <p className="text-xs text-amber-700 mt-1">✓ {newSectionProductIds.length} {t('منتج مختار', 'selected')}</p>}
                        </div>
                      )}
                      {newSectionType === 'products-category' && (
                        <div>
                          <label className="block font-semibold mb-2 text-sm">{t('اختر القسم', 'Choose Category')}</label>
                          {categories.length === 0
                            ? <p className="text-sm text-[var(--lava-muted)]">{t('لا توجد أقسام مضافة بعد', 'No categories added yet')}</p>
                            : <div className="max-h-48 overflow-y-auto border rounded-lg bg-[var(--lava-card)] divide-y">
                                {categories.map(cat => (
                                  <label key={cat.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--lava-secondary)] cursor-pointer">
                                    <input type="radio" name="sectionCategoryId"
                                      checked={newSectionCategoryId === String(cat.id)}
                                      onChange={() => setNewSectionCategoryId(String(cat.id))}
                                      className="w-4 h-4" />
                                    {cat.image && <img src={cat.image} alt="" className="w-8 h-8 object-cover rounded" />}
                                    <span className="text-sm font-medium">{getLocalized(cat.name)}</span>
                                  </label>
                                ))}
                              </div>
                          }
                          {newSectionCategoryId && <p className="text-xs text-green-700 mt-1">✓ {t('تم اختيار القسم', 'Category selected')}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* حقول الصورة والزرار — تظهر فقط لأقسام المحتوى */}
                  {!PRODUCT_SECTION_TYPES.includes(newSectionType) && (<>
                    <ImageUrlOrUploadField label={t('صورة القسم', 'Section Image')} value={newSectionImage} onChange={(url) => setNewSectionImage(url)} placeholder="https://example.com/image.jpg" id="sectionImage" showToast={showToast} t={t} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SelectField
                        label={t('الزرار (اختياري)', 'Button (optional)')}
                        value={newSectionButtonAction}
                        onChange={(e) => setNewSectionButtonAction(e.target.value)}
                        options={sectionButtonActions.map(a => ({ value: a.key, label: a.label }))}
                        id="sectionButtonAction"
                      />
                    </div>
                    {newSectionButtonAction !== 'none' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label={`${t('نص الزرار', 'Button Text')} (${t('عربي', 'Arabic')})`} type="text" value={newSectionButtonTextAr} onChange={(e) => setNewSectionButtonTextAr(e.target.value)} placeholder={t('مثال: تسوق الآن', 'e.g. Shop Now')} id="sectionButtonTextAr" />
                        <InputField label={`${t('نص الزرار', 'Button Text')} (English)`} type="text" value={newSectionButtonTextEn} onChange={(e) => setNewSectionButtonTextEn(e.target.value)} placeholder="e.g. Shop Now" id="sectionButtonTextEn" />
                      </div>
                    )}
                  </>)}

                  <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold">{t('إضافة القسم', 'Add Section')}</button>
                </form>

                <div className="space-y-4 mt-4">
                  <h3 className="font-bold text-lg">{t('الأقسام الحالية', 'Current Sections')}</h3>
                  {homeSections.length === 0 && <p className="text-[var(--lava-muted)]">{t('لا توجد أقسام مضافة.', 'No sections added.')}</p>}
                  {homeSections.map((section, idx) => (
                    <div key={section.id} className="flex justify-between items-center bg-[var(--lava-secondary)] p-4 rounded-lg border">
                      <div className="flex-1">
                        <span className="font-semibold">#{idx+1}</span>
                        <span className="me-2 text-sm bg-[var(--lava-border)] px-2 py-1 rounded">{section.type}</span>
                        {section.title && <span className="me-2">{getLocalized(section.title)}</span>}
                        {section.image && <span className="text-xs text-[var(--lava-muted)] me-2">(🖼️ {t('صورة', 'Image')})</span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEditSection(section)} className="text-blue-600 font-bold px-3 py-1 bg-blue-50 rounded hover:bg-blue-100">✏️ {t('تعديل', 'Edit')}</button>
                        <button onClick={() => deleteHomeSection(section.id)} className="text-red-600 font-bold px-3 py-1 bg-red-50 rounded hover:bg-red-100">{t('حذف', 'Delete')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== تبويب الصفحات المخصصة ===== */}
            {adminTab === 'custom_pages' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">📄 {t('إدارة الصفحات', 'Pages Management')}</h2>
                <p className="text-sm text-[var(--lava-muted)] mb-4">{t('أضف صفحات جديدة براحتك، وهتظهر كزرار في القائمة العلوية. كل صفحة ممكن تحتوي على أقسام (صورة/نص/زرار) زي أقسام الصفحة الرئيسية.', 'Add as many pages as you like — each one shows as a button in the top nav. Each page can hold sections (image/text/button) just like the home page sections.')}</p>

                <form onSubmit={addCustomPage} className="space-y-4 border-b pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label={`${t('اسم الصفحة', 'Page Name')} (${t('عربي', 'Arabic')})`} type="text" value={newPageTitleAr} onChange={(e) => setNewPageTitleAr(e.target.value)} placeholder={t('مثال: عروضنا', 'e.g. Our Offers')} id="pageTitleAr" />
                    <InputField label={`${t('اسم الصفحة', 'Page Name')} (English)`} type="text" value={newPageTitleEn} onChange={(e) => setNewPageTitleEn(e.target.value)} placeholder="e.g. Our Offers" id="pageTitleEn" />
                  </div>
                  <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold">{t('إضافة صفحة جديدة', 'Add New Page')}</button>
                </form>

                <div className="space-y-3">
                  <h3 className="font-bold text-lg">{t('الصفحات الحالية', 'Current Pages')}</h3>
                  {customPages.length === 0 && <p className="text-[var(--lava-muted)]">{t('لا توجد صفحات مضافة بعد.', 'No pages added yet.')}</p>}
                  {customPages.map(page => (
                    <div key={page.id} className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-2">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <span className="font-bold">{getLocalized(page.title)}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                            <input type="checkbox" checked={page.showInNav} onChange={() => toggleCustomPageInNav(page.id)} className="w-4 h-4" />
                            {t('إظهار في القائمة العلوية', 'Show in nav')}
                          </label>
                          <button onClick={() => deleteCustomPage(page.id)} className="text-red-600 font-bold px-3 py-1 bg-red-50 rounded hover:bg-red-100 text-sm">{t('حذف الصفحة', 'Delete Page')}</button>
                        </div>
                      </div>
                      {page.sections.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                          {page.sections.map((section, idx) => (
                            <div key={section.id} className="flex justify-between items-center bg-[var(--lava-card)] p-3 rounded border text-sm">
                              <div className="flex-1">
                                <span className="font-semibold">#{idx + 1}</span>
                                <span className="mx-2 text-xs bg-[var(--lava-border)] px-2 py-1 rounded">{section.type}</span>
                                {section.title && <span className="me-2">{getLocalized(section.title)}</span>}
                              </div>
                              <button onClick={() => deleteCustomPageSection(page.id, section.id)} className="text-red-600 font-bold px-2 py-1 bg-red-50 rounded hover:bg-red-100 text-xs">{t('حذف', 'Delete')}</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {customPages.length > 0 && (
                  <div className="pt-6 border-t space-y-4">
                    <h3 className="font-bold text-lg">{t('إضافة قسم للصفحة', 'Add a section to a page')}</h3>
                    <SelectField
                      label={t('اختر الصفحة', 'Choose Page')}
                      value={selectedPageForSection}
                      onChange={(e) => setSelectedPageForSection(e.target.value)}
                      options={[
                        { value: '', label: '-- ' + t('اختر صفحة', 'Choose a page') + ' --' },
                        ...customPages.map(p => ({ value: String(p.id), label: getLocalized(p.title) }))
                      ]}
                      id="selectedPageForSection"
                    />
                    {selectedPageForSection && (
                      <form onSubmit={addCustomPageSection} className="space-y-4">
                        <SelectField
                          label={t('نوع القسم', 'Section Type')}
                          value={newPageSectionType}
                          onChange={(e) => setNewPageSectionType(e.target.value)}
                          options={[
                            { value: 'image-text', label: '🖼️ ' + t('صورة + نص', 'Image + Text') },
                            { value: 'image-only', label: '📷 ' + t('صورة فقط', 'Image Only') },
                            { value: 'text-only', label: '📝 ' + t('نص فقط', 'Text Only') },
                            { value: 'products-featured', label: '⭐ ' + t('منتجات مميزة', 'Featured Products') },
                            { value: 'products-bestsellers', label: '🔥 ' + t('الأكثر مبيعاً', 'Best Sellers') },
                            { value: 'products-all', label: '📦 ' + t('جميع المنتجات', 'All Products') },
                            { value: 'products-custom', label: '✋ ' + t('منتجات بالاختيار', 'Custom Products') },
                          ]}
                          id="pageSectionType"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <InputField label={`${t('العنوان', 'Title')} (${t('عربي', 'Arabic')})`} type="text" value={newPageSectionTitleAr} onChange={(e) => setNewPageSectionTitleAr(e.target.value)} placeholder={t('عنوان القسم', 'Section Title')} id="pageSectionTitleAr" />
                          <InputField label={`${t('العنوان', 'Title')} (English)`} type="text" value={newPageSectionTitleEn} onChange={(e) => setNewPageSectionTitleEn(e.target.value)} placeholder="Section Title" id="pageSectionTitleEn" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextareaField label={`${t('الوصف', 'Description')} (${t('عربي', 'Arabic')})`} value={newPageSectionDescAr} onChange={(e) => setNewPageSectionDescAr(e.target.value)} placeholder={t('وصف القسم', 'Section description')} rows={2} id="pageSectionDescAr" />
                          <TextareaField label={`${t('الوصف', 'Description')} (English)`} value={newPageSectionDescEn} onChange={(e) => setNewPageSectionDescEn(e.target.value)} placeholder="Section description" rows={2} id="pageSectionDescEn" />
                        </div>

                        {/* إعدادات المنتجات للصفحات المخصصة */}
                        {PRODUCT_SECTION_TYPES.includes(newPageSectionType) && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                            <p className="font-bold text-amber-800 text-sm">⚙️ {t('إعدادات عرض المنتجات', 'Product Display Settings')}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block font-semibold mb-1 text-sm">{t('عدد المنتجات', 'Number of Products')}</label>
                                <input type="number" min={1} max={24} value={newPageSectionProductCount}
                                  onChange={e => setNewPageSectionProductCount(Number(e.target.value))}
                                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]" />
                              </div>
                              <SelectField label={t('شكل العرض', 'Display Style')} value={newPageSectionDisplayStyle}
                                onChange={e => setNewPageSectionDisplayStyle(e.target.value)}
                                options={[
                                  { value: 'grid', label: '⊞ ' + t('شبكة', 'Grid') },
                                  { value: 'masonry', label: '▦ ' + t('موزاييك', 'Masonry') },
                                  { value: 'list', label: '☰ ' + t('قائمة عمودية', 'List') },
                                  { value: 'carousel', label: '◁▷ ' + t('كاروسيل', 'Carousel') },
                                ]} id="pageSectionDisplayStyle" />
                            </div>
                            {newPageSectionType === 'products-custom' && (
                              <div>
                                <label className="block font-semibold mb-2 text-sm">{t('اختر المنتجات', 'Choose Products')}</label>
                                <div className="max-h-48 overflow-y-auto border rounded-lg bg-[var(--lava-card)] divide-y">
                                  {products.filter(p => isProductVisibleToCustomer(p)).map(p => (
                                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--lava-secondary)] cursor-pointer">
                                      <input type="checkbox" checked={newPageSectionProductIds.includes(String(p.id))}
                                        onChange={e => {
                                          const sid = String(p.id);
                                          setNewPageSectionProductIds(prev => e.target.checked ? [...prev, sid] : prev.filter(x => x !== sid));
                                        }} className="w-4 h-4" />
                                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 object-cover rounded" />}
                                      <span className="text-sm font-medium">{getLocalized(p.name)}</span>
                                      <span className="text-xs text-[var(--lava-muted)] mr-auto">{p.price} {t('ج.م', 'EGP')}</span>
                                    </label>
                                  ))}
                                </div>
                                {newPageSectionProductIds.length > 0 && <p className="text-xs text-amber-700 mt-1">✓ {newPageSectionProductIds.length} {t('منتج مختار', 'selected')}</p>}
                              </div>
                            )}
                          </div>
                        )}

                        {/* حقول الصورة والزرار لأقسام المحتوى فقط */}
                        {!PRODUCT_SECTION_TYPES.includes(newPageSectionType) && (<>
                          <ImageUrlOrUploadField label={t('صورة القسم', 'Section Image')} value={newPageSectionImage} onChange={(url) => setNewPageSectionImage(url)} placeholder="https://example.com/image.jpg" id="pageSectionImage" showToast={showToast} t={t} />
                          <SelectField
                            label={t('الزرار (اختياري)', 'Button (optional)')}
                            value={newPageSectionButtonAction}
                            onChange={(e) => setNewPageSectionButtonAction(e.target.value)}
                            options={sectionButtonActions.map(a => ({ value: a.key, label: a.label }))}
                            id="pageSectionButtonAction"
                          />
                          {newPageSectionButtonAction !== 'none' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <InputField label={`${t('نص الزرار', 'Button Text')} (${t('عربي', 'Arabic')})`} type="text" value={newPageSectionButtonTextAr} onChange={(e) => setNewPageSectionButtonTextAr(e.target.value)} placeholder={t('مثال: تسوق الآن', 'e.g. Shop Now')} id="pageSectionButtonTextAr" />
                              <InputField label={`${t('نص الزرار', 'Button Text')} (English)`} type="text" value={newPageSectionButtonTextEn} onChange={(e) => setNewPageSectionButtonTextEn(e.target.value)} placeholder="e.g. Shop Now" id="pageSectionButtonTextEn" />
                            </div>
                          )}
                        </>)}

                        <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold">{t('إضافة القسم', 'Add Section')}</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===== تبويب توصيات وعروض المنتجات ===== */}
            {adminTab === 'recommendations' && canAccess('settings') && (
              <div className="bg-[var(--lava-card)] p-4 md:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold mb-4">🎯 {t('إدارة التوصيات والعروض', 'Recommendations & Offers')}</h2>
                <p className="text-sm text-[var(--lava-muted)] mb-4">{t('اختر منتجاً، ثم حدد المنتجات المقترحة وعروض الشراء المشترك.', 'Select a product, then set recommended products and bundle offers.')}</p>

                <div className="space-y-4">
                  <SelectField
                    label={t('اختر المنتج', 'Select Product')}
                    value={selectedProductForRec || ''}
                    onChange={(e) => handleProductRecSelect(e.target.value)}
                    options={[
                      { value: '', label: '-- ' + t('اختر منتجاً', 'Choose a product') + ' --' },
                      ...products.map(p => ({ value: p.id, label: getLocalized(p.name) }))
                    ]}
                    id="productRecSelect"
                  />

                  {selectedProductForRec && (
                    <>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="recEnableRec" checked={recEnableRec} onChange={(e) => setRecEnableRec(e.target.checked)} className="w-5 h-5" />
                          <label htmlFor="recEnableRec" className="font-bold cursor-pointer">📌 {t('تفعيل التوصيات لهذا المنتج', 'Enable recommendations for this product')}</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="recEnableBundle" checked={recEnableBundle} onChange={(e) => setRecEnableBundle(e.target.checked)} className="w-5 h-5" />
                          <label htmlFor="recEnableBundle" className="font-bold cursor-pointer">🛒 {t('تفعيل عروض الباقة لهذا المنتج', 'Enable bundle offers for this product')}</label>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-sm mb-1">{t('بحث في المنتجات', 'Search products')}</label>
                        <input
                          type="text"
                          value={recSearchQuery}
                          onChange={(e) => setRecSearchQuery(e.target.value)}
                          placeholder={t('ابحث عن منتج...', 'Search for product...')}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-[var(--lava-card)]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-sm mb-1">{t('المنتجات المقترحة', 'Recommended Products')}</label>
                        {recProductIds.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {recProductIds.map(id => {
                              const p = products.find(pr => pr.id === id);
                              if (!p) return null;
                              return (
                                <span key={id} className="inline-flex items-center gap-2 bg-black text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                                  {getLocalized(p.name)}
                                  <button
                                    type="button"
                                    onClick={() => setRecProductIds(prev => prev.filter(i => i !== id))}
                                    className="hover:text-red-400 font-bold leading-none"
                                    aria-label={t('إزالة', 'Remove')}
                                  >×</button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="w-full border rounded-lg bg-[var(--lava-card)] max-h-44 overflow-y-auto divide-y">
                          {products
                            .filter(p => p.id !== selectedProductForRec)
                            .filter(p => getLocalized(p.name).toLowerCase().includes(recSearchQuery.toLowerCase()))
                            .map(p => (
                              <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--lava-secondary)]">
                                <input
                                  type="checkbox"
                                  checked={recProductIds.includes(p.id)}
                                  onChange={(e) => {
                                    setRecProductIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(i => i !== p.id));
                                  }}
                                  className="w-4 h-4"
                                />
                                {getLocalized(p.name)}
                              </label>
                            ))}
                          {products.filter(p => p.id !== selectedProductForRec && getLocalized(p.name).toLowerCase().includes(recSearchQuery.toLowerCase())).length === 0 && (
                            <p className="text-xs text-[var(--lava-muted)] px-3 py-2">{t('لا توجد منتجات مطابقة', 'No matching products')}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-sm mb-1">{t('منتجات العروض المشتركة', 'Bundle Products')}</label>
                        {bundleProductIds.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {bundleProductIds.map(id => {
                              const p = products.find(pr => pr.id === id);
                              if (!p) return null;
                              return (
                                <span key={id} className="inline-flex items-center gap-2 bg-black text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                                  {getLocalized(p.name)}
                                  <button
                                    type="button"
                                    onClick={() => setBundleProductIds(prev => prev.filter(i => i !== id))}
                                    className="hover:text-red-400 font-bold leading-none"
                                    aria-label={t('إزالة', 'Remove')}
                                  >×</button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="w-full border rounded-lg bg-[var(--lava-card)] max-h-44 overflow-y-auto divide-y">
                          {products
                            .filter(p => p.id !== selectedProductForRec)
                            .filter(p => getLocalized(p.name).toLowerCase().includes(recSearchQuery.toLowerCase()))
                            .map(p => (
                              <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--lava-secondary)]">
                                <input
                                  type="checkbox"
                                  checked={bundleProductIds.includes(p.id)}
                                  onChange={(e) => {
                                    setBundleProductIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(i => i !== p.id));
                                  }}
                                  className="w-4 h-4"
                                />
                                {getLocalized(p.name)}
                              </label>
                            ))}
                          {products.filter(p => p.id !== selectedProductForRec && getLocalized(p.name).toLowerCase().includes(recSearchQuery.toLowerCase())).length === 0 && (
                            <p className="text-xs text-[var(--lava-muted)] px-3 py-2">{t('لا توجد منتجات مطابقة', 'No matching products')}</p>
                          )}
                        </div>
                      </div>

                      <InputField
                        label={t('نسبة الخصم على العرض المشترك (%)', 'Bundle Discount (%)')}
                        type="number"
                        value={bundleDiscountPercent}
                        onChange={(e) => setBundleDiscountPercent(Number(e.target.value))}
                        placeholder={t('مثال: 15', 'e.g. 15')}
                        id="bundleDiscount"
                      />

                      <button
                        onClick={saveRecommendations}
                        className="bg-black text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-800 transition"
                      >
                        {t('حفظ التوصيات والعروض', 'Save Recommendations & Offers')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

                    </div>
                  </div>
                </>
              );
            })()}

          </section>
  );
}