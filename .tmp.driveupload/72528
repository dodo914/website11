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


export default function MyOrdersPage(props) {
  const { adminSettings, currentPage, exchangeFormLoading, exchangeFormNote, exchangeFormOrderId, exchangeFormProducts, exchangeFormReasonCode, exchangeFormSelection, getCanonicalVariantId, getDefaultVariant, getLocalized, goTo, hasColors, language, myExchangeRequests, orders, returnFormLoading, returnFormOrderId, returnFormReason, returnFormReasonCode, returnFormSelection, setExchangeFormLoading, setExchangeFormNote, setExchangeFormOrderId, setExchangeFormProducts, setExchangeFormReasonCode, setExchangeFormSelection, setMyExchangeRequests, setOrders, setReturnFormLoading, setReturnFormOrderId, setReturnFormReason, setReturnFormReasonCode, setReturnFormSelection, setSelectedCategoryFilter, t, user } = props;
  return (
    <section className={`py-16 px-6 md:px-12 max-w-4xl mx-auto ${language === 'ar' ? 'text-right' : 'text-left'} fade-in`}>
            <button onClick={() => goTo('account')} className={`mb-6 text-[var(--lava-muted)] hover:text-black font-semibold flex items-center gap-2 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
              {language === 'ar' ? '←' : '→'} {t('العودة للحساب', 'Back to account')}
            </button>
            <h1 className="text-3xl font-bold mb-8">{t('طلباتي', 'My Orders')}</h1>

            {/* ===== Returns & Exchanges - Phase 2B: My Returns & Exchanges (تتبع) ===== */}
            {(() => {
              const myOrdersForRe = orders.filter(o => o.customerEmail === user.email);
              const myReturns = myOrdersForRe
                .filter(o => o.returnRequestStatus && o.returnRequestStatus !== 'none')
                .map(o => ({
                  type: 'return',
                  requestId: o.id,
                  orderId: o.id,
                  productsCount: (o.returnItems || []).length,
                  fee: o.returnFeeCharged,
                  currency: o.returnFeeCurrency || 'EGP',
                  status: o.returnRequestStatus,
                  createdAt: o.returnRequestedAt || o.createdAt,
                  moneyDirection: 'refund_to_customer',
                  moneyAmount: o.returnRefundAmount,
                  moneyMethod: o.returnRefundMethod,
                  moneyTransferredAt: o.returnRefundTransferredAt,
                }));
              const myExchanges = (myExchangeRequests || []).map(e => ({
                type: 'exchange',
                requestId: e.requestId || e.id,
                orderId: e.orderId,
                productsCount: (e.items || []).length,
                fee: e.fee,
                currency: e.currency || 'EGP',
                status: e.status,
                createdAt: e.createdAt,
                moneyDirection: e.moneyDirection,
                moneyAmount: e.moneyAmount,
                moneyMethod: e.moneyMethod,
                moneyTransferredAt: e.moneyTransferredAt,
              }));
              const myReList = [...myReturns, ...myExchanges].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
              if (myReList.length === 0) return null;

              const reStatusLabel = (s) => ({
                pending: t('قيد الانتظار', 'Pending'), under_review: t('قيد المراجعة', 'Under Review'),
                approved: t('تمت الموافقة', 'Approved'), rejected: t('مرفوض', 'Rejected'),
                pickup_scheduled: t('تم جدولة الاستلام', 'Pickup Scheduled'), received: t('تم الاستلام', 'Received'),
                processing: t('جاري المعالجة', 'Processing'), completed: t('مكتمل', 'Completed'), cancelled: t('ملغي', 'Cancelled'),
                carrier_picked_up: t('شركة الشحن استلمت المنتج', 'Picked up by carrier'),
                received_at_warehouse: t('وصل المخزن', 'Arrived at warehouse'),
                inspecting: t('جاري المعاينة', 'Inspecting'),
                shipped_to_customer: t('في الطريق للعميل', 'Shipped to you'),
              }[s] || s);

              return (
                <div className="mb-10 bg-[var(--lava-card)] p-5 md:p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold mb-4">🔄 {t('طلبات الاسترجاع والاستبدال', 'My Returns & Exchanges')}</h2>
                  <div className="space-y-2">
                    {myReList.map((it) => (
                      <div key={`${it.type}-${it.requestId}`} className="flex flex-col gap-1.5 bg-[var(--lava-secondary)] border rounded-lg p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${it.type === 'return' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                              {it.type === 'return' ? t('استرجاع', 'Return') : t('استبدال', 'Exchange')}
                            </span>
                            <span className="font-mono text-xs text-[var(--lava-muted)]">#{String(it.orderId).slice(-6)}</span>
                            <span className="text-[var(--lava-muted)] text-xs">{it.productsCount} {t('منتج', 'item(s)')}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-xs">{it.fee > 0 ? `${it.fee} ${it.currency}` : t('مجاني', 'Free')}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--lava-border)] text-[var(--lava-text)]">{reStatusLabel(it.status)}</span>
                            <span className="text-xs text-[var(--lava-muted)]">{it.createdAt ? new Date(it.createdAt).toLocaleDateString() : ''}</span>
                          </div>
                        </div>
                        {/* ===== Phase 2C: حالة تحويل الفلوس (انستا باي / محفظة) - تبان للعميل قبل وبعد التحويل ===== */}
                        {it.moneyTransferredAt && it.moneyAmount > 0 ? (
                          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 text-xs font-bold rounded-lg px-2.5 py-1.5 w-fit">
                            ✅ {it.moneyDirection === 'collect_from_customer'
                              ? t(`استلمنا منك ${it.moneyAmount} ${it.currency} عبر ${it.moneyMethod === 'instapay' ? 'انستا باي' : 'المحفظة'}`, `We received ${it.moneyAmount} ${it.currency} from you via ${it.moneyMethod === 'instapay' ? 'Instapay' : 'wallet'}`)
                              : t(`تم تحويل ${it.moneyAmount} ${it.currency} لك عبر ${it.moneyMethod === 'instapay' ? 'انستا باي' : 'المحفظة'}`, `We transferred ${it.moneyAmount} ${it.currency} to you via ${it.moneyMethod === 'instapay' ? 'Instapay' : 'wallet'}`)}
                          </div>
                        ) : (
                          (it.type === 'return' && !['pending', 'rejected', 'none'].includes(it.status)) ||
                          (it.type === 'exchange' && it.moneyDirection && it.moneyDirection !== 'none' && it.moneyAmount > 0)
                        ) && (
                          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-lg px-2.5 py-1.5 w-fit">
                            ⏳ {it.type === 'return'
                              ? t('هيتم تحويل مبلغ الاسترجاع لك قريبًا', 'Your refund will be transferred to you soon')
                              : (it.moneyDirection === 'collect_from_customer'
                                  ? t(`في انتظار استلام ${it.moneyAmount ? `${it.moneyAmount} ${it.currency}` : 'المبلغ'} منك`, `Awaiting ${it.moneyAmount ? `${it.moneyAmount} ${it.currency}` : 'payment'} from you`)
                                  : t('هيتم تحويل المبلغ لك قريبًا', 'The amount will be transferred to you soon'))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--lava-muted)] mt-3">{t('التفاصيل الكاملة لكل طلب موجودة تحت الأوردر الخاص بيه بالأسفل.', 'Full details for each request are shown under its order below.')}</p>
                </div>
              );
            })()}

            {(() => {
              const myOrders = orders.filter(o => o.customerEmail === user.email);
              if (myOrders.length === 0) {
                return (
                  <div className="text-center py-12 bg-[var(--lava-card)] rounded-xl shadow-md">
                    <p className="text-[var(--lava-muted)] text-lg mb-4">{t('لا يوجد لديك طلبات سابقة', "You don't have any orders yet")}</p>
                    <button onClick={() => { setSelectedCategoryFilter('all'); goTo('shop'); }} className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition">
                      {t('تسوق الآن', 'Shop Now')}
                    </button>
                  </div>
                );
              }

              const orderStages = [
                { key: t('جديد', 'New'), label: t('جديد', 'New') },
                { key: t('جاري التأكيد', 'Confirming'), label: t('جاري التأكيد', 'Confirming') },
                { key: t('تم التأكيد', 'Confirmed'), label: t('تم التأكيد', 'Confirmed') },
                { key: t('تم التسليم', 'Delivered'), label: t('تم التسليم', 'Delivered') },
              ];

              return (
                <div className="space-y-6">
                  {myOrders.map(ord => {
                    const isCancelledOrReturned = ord.status === t('ملغي', 'Cancelled') || ord.status === t('مرتجع', 'Returned') || ord.status === t('مستبدل', 'Exchanged');
                    const currentStageIndex = orderStages.findIndex(s => s.key === ord.status);
                    const baseDate = new Date();
                    return (
                      <div key={ord.id} className="bg-[var(--lava-card)] p-6 rounded-xl shadow-md space-y-5">
                        <div className="flex justify-between items-center flex-wrap gap-2 border-b pb-3">
                          <div>
                            <h3 className="font-bold text-lg">{t('طلب', 'Order')} #{ord.orderNumber || ord.id}</h3>
                            <p className="text-xs text-[var(--lava-muted)]">{ord.createdAt}</p>
                          </div>
                          <span className="font-bold text-lg">{ord.totalAmount} {t('ج.م', 'EGP')}</span>
                        </div>

                        {isCancelledOrReturned ? (
                          <div className={`p-3 rounded-lg font-bold text-sm ${ord.status === t('مرتجع', 'Returned') ? 'bg-orange-50 text-orange-700' : ord.status === t('مستبدل', 'Exchanged') ? 'bg-purple-50 text-purple-700' : 'bg-red-50 text-red-700'}`}>
                            {ord.status === t('مرتجع', 'Returned') ? '↩️' : ord.status === t('مستبدل', 'Exchanged') ? '🔁' : '❌'} {ord.status}
                          </div>
                        ) : (
                          <div className="flex items-center">
                            {orderStages.map((stage, index) => {
                              const isDone = currentStageIndex >= 0 && index <= currentStageIndex;
                              const stageDate = new Date(baseDate.getTime() - (currentStageIndex - index) * 86400000);
                              return (
                                <React.Fragment key={stage.key}>
                                  <div className="flex flex-col items-center flex-1 text-center">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isDone ? 'bg-black text-white' : 'bg-[var(--lava-border)] text-[var(--lava-muted)]'}`}>
                                      {isDone ? '✓' : index + 1}
                                    </div>
                                    <span className={`text-[11px] mt-1.5 font-semibold ${isDone ? 'text-black' : 'text-[var(--lava-muted)]'}`}>{stage.label}</span>
                                    {isDone && <span className="text-[10px] text-[var(--lava-muted)]">{stageDate.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>}
                                  </div>
                                  {index < orderStages.length - 1 && (
                                    <div className={`h-0.5 flex-1 -mt-5 ${index < currentStageIndex ? 'bg-black' : 'bg-[var(--lava-border)]'}`}></div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}

                        {(ord.paymentMethod === 'kashier' || ord.paymentMethod === 'paymob') && (() => {
                          const refundedAmt = Number(ord.refundedAmount || 0);
                          const isFullRefund = ord.paymentStatus === 'refunded' || refundedAmt >= Number(ord.totalAmount || 0) - 0.01;
                          let label; let cls;
                          if (ord.paymentStatus === 'refunded' || (refundedAmt > 0 && isFullRefund)) {
                            label = t(`تم استرجاع كامل المبلغ — ${refundedAmt} ج.م`, `Fully refunded — ${refundedAmt} EGP`);
                            cls = 'bg-purple-50 text-purple-700';
                          } else if (refundedAmt > 0) {
                            label = t(`تم استرجاع جزء من المبلغ — ${refundedAmt} ج.م`, `Partially refunded — ${refundedAmt} EGP`);
                            cls = 'bg-purple-50 text-purple-700';
                          } else if (ord.paymentStatus === 'paid') {
                            label = t('تم الدفع بنجاح', 'Payment successful');
                            cls = 'bg-green-50 text-green-700';
                          } else if (ord.paymentStatus === 'failed') {
                            label = t('فشلت عملية الدفع', 'Payment failed');
                            cls = 'bg-red-50 text-red-700';
                          } else {
                            label = t('في انتظار تأكيد الدفع', 'Awaiting payment confirmation');
                            cls = 'bg-amber-50 text-amber-700';
                          }
                          return (
                            <div className={`p-2.5 rounded-lg text-sm font-bold ${cls}`}>
                              💳 {label}
                            </div>
                          );
                        })()}

                        {/* ===== تتبع الشحنة - بيظهر بس لو الأدمن حدد شركة شحن للطلب ده ===== */}
                        {ord.shippingCompany && (() => {
                          // نفس فكرة statusLabels في لوحة الأدمن، لكن بأسماء مفهومة للعميل
                          // ومحدودة فقط بالحالات الآمن عرضها له (بدون تفاصيل داخلية).
                          const CUSTOMER_TRACKING_LABELS = {
                            pending: t('في انتظار الشحن', 'Awaiting shipment'),
                            preparing: t('جاري تجهيز الشحنة', 'Preparing shipment'),
                            created: t('تم إنشاء الشحنة', 'Shipment created'),
                            shipped: t('تم تسليم الشحنة لشركة الشحن', 'Handed to carrier'),
                            picked_up: t('تم استلام الشحنة من المندوب', 'Picked up by carrier'),
                            in_transit: t('الشحنة في الطريق', 'In transit'),
                            out_for_delivery: t('الشحنة خارجة للتوصيل', 'Out for delivery'),
                            delivered: t('تم التسليم', 'Delivered'),
                            failed: t('حدثت مشكلة في التوصيل', 'Delivery issue'),
                            failed_delivery: t('حدثت مشكلة في التوصيل', 'Delivery issue'),
                            cancelled: t('تم إلغاء الشحنة', 'Shipment cancelled'),
                            returned: t('تم إرجاع الشحنة', 'Shipment returned'),
                          };
                          const trackingLabel = CUSTOMER_TRACKING_LABELS[ord.shippingStatus] || t('جاري التحديث', 'Updating');
                          return (
                            <div className="bg-[var(--lava-secondary)] border rounded-xl p-4 space-y-1.5">
                              <p className="text-xs font-bold text-[var(--lava-muted)] mb-1">🚚 {t('تتبع الشحنة', 'Shipment Tracking')}</p>
                              <p className="text-sm"><span className="text-[var(--lava-muted)]">{t('شركة الشحن:', 'Carrier:')}</span> <span className="font-bold">{ord.shippingCompany}</span></p>
                              {ord.trackingNumber && (
                                <p className="text-sm"><span className="text-[var(--lava-muted)]">{t('رقم التتبع:', 'Tracking number:')}</span> <span className="font-mono font-bold">{ord.trackingNumber}</span></p>
                              )}
                              <p className="text-sm"><span className="text-[var(--lava-muted)]">{t('الحالة:', 'Status:')}</span> <span className="font-bold">{trackingLabel}</span></p>
                              {ord.shippingUpdatedAt && (
                                <p className="text-xs text-[var(--lava-muted)]">{t('آخر تحديث:', 'Last updated:')} {new Date(ord.shippingUpdatedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</p>
                              )}
                            </div>
                          );
                        })()}

                        {/* ===== طلب استرجاع منتج (العميل يختار المنتج والسبب) ===== */}
                        {(() => {
                          if (adminSettings.current.enableReturns === false) return null;
                          const isDeliveredOrd = ord.status === t('تم التسليم', 'Delivered') || ord.shippingStatus === 'delivered';
                          if (!isDeliveredOrd) return null;
                          if (ord.returnRequestStatus === 'pending') {
                            return (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                                <p className="font-bold text-amber-800">⏳ {t('طلب الاسترجاع بتاعك قيد المراجعة', 'Your return request is under review')}</p>
                              </div>
                            );
                          }
                          if (ord.returnRequestStatus === 'approved') {
                            return (
                              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
                                <p className="font-bold text-green-800">✅ {t('تمت الموافقة على طلب الاسترجاع', 'Your return request was approved')}</p>
                              </div>
                            );
                          }
                          if (ord.returnRequestStatus === 'rejected') {
                            return (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
                                <p className="font-bold text-red-700">❌ {t('تم رفض طلب الاسترجاع', 'Your return request was rejected')}</p>
                                {ord.returnAdminNote && <p className="text-red-600 text-xs mt-1">{ord.returnAdminNote}</p>}
                              </div>
                            );
                          }
                          const isFormOpen = returnFormOrderId === ord.id;
                          const itemKey = (item) => `${item.productId || item.id || ''}|${item.variantId || ''}|${item.size || ''}`;
                          return (
                            <div className="border rounded-xl p-4 space-y-3">
                              {!isFormOpen ? (
                                <button
                                  onClick={() => { setReturnFormOrderId(ord.id); setReturnFormSelection({}); setReturnFormReason(''); setReturnFormReasonCode(''); }}
                                  className="text-sm font-bold text-[var(--lava-text)] hover:text-black underline"
                                >
                                  ↩️ {t('طلب استرجاع منتج من الطلب ده', 'Request a return for an item in this order')}
                                </button>
                              ) : (
                                <>
                                  <p className="font-bold text-sm">{t('اختار المنتج (المنتجات) اللي عايز ترجعها:', 'Select the item(s) you want to return:')}</p>
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
                                    <label className="block text-xs font-bold text-[var(--lava-muted)] mb-1">
                                      {t('سبب الاسترجاع:', 'Return reason:')} <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                      value={returnFormReasonCode}
                                      onChange={(e) => setReturnFormReasonCode(e.target.value)}
                                      className="w-full border rounded-lg px-3 py-2 text-sm bg-[var(--lava-card)]"
                                    >
                                      <option value="">{t('اختار السبب...', 'Select a reason...')}</option>
                                      {RETURN_REASONS.map(r => (
                                        <option key={r.code} value={r.code}>{t(r.ar, r.en)}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {(() => {
                                    const selectedReason = RETURN_REASONS.find(r => r.code === returnFormReasonCode);
                                    if (!selectedReason) return null;
                                    const feeAmount = Number(adminSettings.current.returnFeeAmount ?? 80);
                                    if (!selectedReason.feeApplies) {
                                      return (
                                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 font-bold">
                                          ✅ {t('استرجاع مجاني - مش هيتم خصم أي رسوم شحن.', 'Free return - no shipping fee will be deducted.')}
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-bold">
                                        ⚠️ {t(
                                          `هيتم خصم ${feeAmount} ج.م من قيمة الاسترجاع كرسوم شحن.`,
                                          `${feeAmount} EGP will be deducted from your refund as a return shipping fee.`
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <textarea
                                    value={returnFormReason}
                                    onChange={(e) => setReturnFormReason(e.target.value)}
                                    placeholder={t('تفاصيل إضافية عن سبب الاسترجاع (اختياري)', 'Additional details about the return reason (optional)')}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      disabled={returnFormLoading || Object.keys(returnFormSelection).length === 0 || !returnFormReasonCode}
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
                                          const updated = await ordersAPI.requestReturn(ord.id, { items, reason: returnFormReason, reasonCode: returnFormReasonCode });
                                          setOrders(prev => prev.map(o => (o.id === ord.id ? { ...o, ...updated, id: o.id } : o)));
                                          setReturnFormOrderId(null);
                                        } catch (err) {
                                          console.error('تعذّر إرسال طلب الاسترجاع:', err);
                                          alert(err?.response?.data?.message || err?.message || t('تعذّر إرسال طلب الاسترجاع، حاول تاني', 'Could not send the return request, please try again'));
                                        } finally {
                                          setReturnFormLoading(false);
                                        }
                                      }}
                                      className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold disabled:bg-[var(--lava-border)]"
                                    >
                                      {returnFormLoading ? t('جاري الإرسال...', 'Sending...') : t('إرسال طلب الاسترجاع', 'Send return request')}
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

                        {/* ===== طلب استبدال (Exchange) - منتج/فاريانت جديد بدل القديم ===== */}
                        {(() => {
                          if (adminSettings.current.enableExchanges === false) return null;
                          const isDeliveredOrd = ord.status === t('تم التسليم', 'Delivered') || ord.shippingStatus === 'delivered';
                          if (!isDeliveredOrd) return null;

                          const myExchangesForOrder = myExchangeRequests.filter(e => String(e.orderId) === String(ord.id));
                          const activeExchange = myExchangesForOrder.find(e => !['rejected', 'cancelled', 'completed'].includes(e.status));
                          const lastExchange = myExchangesForOrder[0]; // الأحدث (السيرفر بيرجعهم مرتبين createdAt: -1)

                          if (activeExchange) {
                            const label = EXCHANGE_STATUS_LABELS[activeExchange.status] || { ar: activeExchange.status, en: activeExchange.status, cls: 'amber' };
                            const clsMap = { amber: 'bg-amber-50 border-amber-200 text-amber-800', green: 'bg-green-50 border-green-200 text-green-800', red: 'bg-red-50 border-red-200 text-red-700' };
                            return (
                              <div className={`border rounded-xl p-4 text-sm ${clsMap[label.cls]}`}>
                                <p className="font-bold">🔄 {t(label.ar, label.en)}</p>
                                <p className="text-xs opacity-70 mt-1">{t('رقم الطلب:', 'Request ID:')} {activeExchange.requestId}</p>
                                {activeExchange.status === 'pending' && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const updated = await exchangeAPI.cancel(activeExchange.id);
                                        setMyExchangeRequests(prev => prev.map(e => (e.id === activeExchange.id ? { ...e, ...updated, id: e.id } : e)));
                                      } catch (err) {
                                        alert(err?.response?.data?.message || err?.message || t('تعذّر إلغاء طلب الاستبدال', 'Could not cancel the exchange request'));
                                      }
                                    }}
                                    className="text-xs underline mt-2 font-bold"
                                  >
                                    {t('إلغاء طلب الاستبدال', 'Cancel exchange request')}
                                  </button>
                                )}
                              </div>
                            );
                          }
                          if (lastExchange && lastExchange.status === 'rejected') {
                            return (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-1">
                                <p className="font-bold">❌ {t('تم رفض طلب الاستبدال', 'Your exchange request was rejected')}</p>
                                {lastExchange.adminNote && <p className="text-xs mt-1">{lastExchange.adminNote}</p>}
                              </div>
                            );
                          }

                          const isFormOpen = exchangeFormOrderId === ord.id;
                          const itemKey = (item) => `${item.productId || item.id || ''}|${item.variantId || ''}|${item.size || ''}`;

                          if (!isFormOpen) {
                            return (
                              <button
                                onClick={() => {
                                  setExchangeFormOrderId(ord.id);
                                  setExchangeFormSelection({});
                                  setExchangeFormReasonCode('');
                                  setExchangeFormNote('');
                                }}
                                className="text-sm font-bold text-[var(--lava-text)] hover:text-black underline"
                              >
                                🔄 {t('طلب استبدال منتج من الطلب ده', 'Request an exchange for an item in this order')}
                              </button>
                            );
                          }

                          return (
                            <div className="border rounded-xl p-4 space-y-3">
                              <p className="font-bold text-sm">{t('اختار المنتج اللي عايز تستبدله والفاريانت الجديد:', 'Select the item to exchange and the new variant:')}</p>
                              <div className="space-y-3">
                                {(ord.items || []).map((item, idx) => {
                                  const key = itemKey(item);
                                  const sel = exchangeFormSelection[key];
                                  const checked = !!sel;
                                  const productId = item.productId || item.id;
                                  const productData = exchangeFormProducts[productId];
                                  return (
                                    <div key={idx} className="border rounded-lg px-3 py-2 text-sm space-y-2">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={async (e) => {
                                            if (e.target.checked) {
                                              setExchangeFormSelection(prev => ({ ...prev, [key]: { quantity: 1, newVariantId: '', newSize: '' } }));
                                              let product = exchangeFormProducts[productId];
                                              if (!product) {
                                                try {
                                                  product = await productsAPI.getById(productId);
                                                  setExchangeFormProducts(prev => ({ ...prev, [productId]: product }));
                                                } catch (err) {
                                                  console.error('تعذّر تحميل بيانات المنتج:', err);
                                                }
                                              }
                                              // المنتج ده مالوش ألوان أصلاً - اختار الفاريانت الوحيد تلقائيًا عشان يبان اختيار المقاس على طول
                                              if (product && !hasColors(product)) {
                                                const defVariant = getDefaultVariant(product);
                                                if (defVariant) {
                                                  setExchangeFormSelection(prev => ({ ...prev, [key]: { ...prev[key], newVariantId: getCanonicalVariantId(defVariant) } }));
                                                }
                                              }
                                            } else {
                                              setExchangeFormSelection(prev => {
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
                                              setExchangeFormSelection(prev => ({ ...prev, [key]: { ...prev[key], quantity: v } }));
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
                                                    onChange={(e) => setExchangeFormSelection(prev => ({ ...prev, [key]: { ...prev[key], newVariantId: e.target.value, newSize: '' } }))}
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
                                                    onChange={(e) => setExchangeFormSelection(prev => ({ ...prev, [key]: { ...prev[key], newSize: e.target.value } }))}
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
                                <label className="block text-xs font-bold text-[var(--lava-muted)] mb-1">
                                  {t('سبب الاستبدال:', 'Exchange reason:')} <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={exchangeFormReasonCode}
                                  onChange={(e) => setExchangeFormReasonCode(e.target.value)}
                                  className="w-full border rounded-lg px-3 py-2 text-sm bg-[var(--lava-card)]"
                                >
                                  <option value="">{t('اختار السبب...', 'Select a reason...')}</option>
                                  {EXCHANGE_REASONS.map(r => (
                                    <option key={r.code} value={r.code}>{t(r.ar, r.en)}</option>
                                  ))}
                                </select>
                              </div>
                              {(() => {
                                const selectedExchangeReason = EXCHANGE_REASONS.find(r => r.code === exchangeFormReasonCode);
                                if (!selectedExchangeReason) return null;
                                const exFeeAmount = Number(adminSettings.current.exchangeFeeAmount ?? 180);
                                if (!selectedExchangeReason.feeApplies) {
                                  return (
                                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 font-bold">
                                      ✅ {t('استبدال مجاني - مش هيتم خصم أي رسوم شحن.', 'Free exchange - no shipping fee will be charged.')}
                                    </div>
                                  );
                                }
                                return (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-bold">
                                    ⚠️ {t(
                                      `هيتم تحصيل ${exFeeAmount} ج.م رسوم شحن الاستبدال.`,
                                      `${exFeeAmount} EGP will be charged as an exchange shipping fee.`
                                    )}
                                  </div>
                                );
                              })()}
                              {exchangeFormReasonCode === 'other' && (
                                <textarea
                                  value={exchangeFormNote}
                                  onChange={(e) => setExchangeFormNote(e.target.value)}
                                  placeholder={t('اكتب تفاصيل السبب (إلزامي)', 'Write the reason details (required)')}
                                  className="w-full border rounded-lg px-3 py-2 text-sm"
                                  rows={2}
                                />
                              )}
                              {exchangeFormReasonCode && exchangeFormReasonCode !== 'other' && (
                                <textarea
                                  value={exchangeFormNote}
                                  onChange={(e) => setExchangeFormNote(e.target.value)}
                                  placeholder={t('ملاحظة إضافية (اختياري)', 'Additional note (optional)')}
                                  className="w-full border rounded-lg px-3 py-2 text-sm"
                                  rows={2}
                                />
                              )}
                              <div className="flex gap-2">
                                <button
                                  disabled={
                                    exchangeFormLoading ||
                                    Object.keys(exchangeFormSelection).length === 0 ||
                                    !exchangeFormReasonCode ||
                                    (exchangeFormReasonCode === 'other' && !exchangeFormNote.trim()) ||
                                    Object.entries(exchangeFormSelection).some(([k, s]) => {
                                      if (!s.newVariantId) return true;
                                      const it = (ord.items || []).find(i => itemKey(i) === k);
                                      const pd = it ? exchangeFormProducts[it.productId || it.id] : null;
                                      const needsSize = pd ? (pd.sizes || []).length > 0 : true;
                                      return needsSize && !s.newSize;
                                    })
                                  }
                                  onClick={async () => {
                                    const items = (ord.items || [])
                                      .filter(item => exchangeFormSelection[itemKey(item)] != null)
                                      .map(item => {
                                        const sel = exchangeFormSelection[itemKey(item)];
                                        return {
                                          productId: item.productId || item.id,
                                          oldVariantId: item.variantId || null,
                                          oldSize: item.size || null,
                                          quantity: sel.quantity,
                                          requestedNewVariant: { variantId: sel.newVariantId, size: sel.newSize },
                                        };
                                      });
                                    setExchangeFormLoading(true);
                                    try {
                                      const created = await ordersAPI.requestExchange(ord.id, { items, reasonCode: exchangeFormReasonCode, customerNote: exchangeFormNote });
                                      setMyExchangeRequests(prev => [{ ...created, id: created._id, orderId: ord.id }, ...prev]);
                                      setExchangeFormOrderId(null);
                                    } catch (err) {
                                      console.error('تعذّر إرسال طلب الاستبدال:', err);
                                      alert(err?.response?.data?.message || err?.message || t('تعذّر إرسال طلب الاستبدال، حاول تاني', 'Could not send the exchange request, please try again'));
                                    } finally {
                                      setExchangeFormLoading(false);
                                    }
                                  }}
                                  className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold disabled:bg-[var(--lava-border)]"
                                >
                                  {exchangeFormLoading ? t('جاري الإرسال...', 'Sending...') : t('إرسال طلب الاستبدال', 'Send exchange request')}
                                </button>
                                <button onClick={() => setExchangeFormOrderId(null)} className="text-sm text-[var(--lava-muted)] hover:text-black px-3 py-2">
                                  {t('إلغاء', 'Cancel')}
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="pt-3 border-t space-y-2">
                          {(ord.items || []).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-sm">
                              <img loading="lazy" src={item.images ? item.images[0] : ''} alt="" className="w-10 h-10 object-cover rounded-md" />
                              <span className="flex-1">{getLocalized(item.name)} ({item.size})</span>
                              <span className="font-bold">{item.price} {t('ج.م', 'EGP')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>
  );
}