import React, { useState, useEffect } from 'react';
import { guestOrdersAPI } from '../api/orders';
import { productsAPI } from '../api/products';

// ============================================================================
// ===== صفحة "استرجاع/استبدال بدون تسجيل دخول" =====
// أي حد (عامل حساب أو لأ) يقدر يدخل هنا، يكتب رقم أوردره + رقم تليفونه،
// ولو اتطابقوا مع أوردر فعلي، يقدر يطلب استرجاع أو استبدال - بالظبط زي
// الفورم الموجود في صفحة "طلباتي" بتاعة الأعضاء (نفس الأسباب، نفس التحقق
// من الأهلية والرسوم، نفس صور الإثبات) لكن من غير أي تسجيل دخول.
// الطلب اللي بيتقدّم من هنا بيظهر في لوحة الأدمن بالظبط زي أي طلب عادي.
//
// المكوّن ده بياخد language/t/getLocalized كـprops عشان يفضل متسق مع باقي
// الموقع (نفس دالة الترجمة وnfs طريقة عرض النص متعدد اللغات) من غير ما
// يعتمد على أي state داخلي من App.jsx.
// ============================================================================

const EGYPT_PHONE_REGEX = /^01[0125]\d{8}$/;
const isValidEgyptianPhone = (raw) => {
  let s = String(raw || '').trim().replace(/[\s\-()]/g, '');
  if (s.startsWith('+20')) s = '0' + s.slice(3);
  else if (s.startsWith('0020')) s = '0' + s.slice(4);
  else if (s.startsWith('20') && s.length === 12) s = '0' + s.slice(2);
  return EGYPT_PHONE_REGEX.test(s);
};

const itemKey = (item) => `${item.productId}__${item.variantId || ''}__${item.size || ''}`;

// ===== نفس منطق hasColors/getDefaultVariant الموجود في App.jsx - عشان لو المنتج
// مالوش ألوان أصلاً نختار الفاريانت الوحيد تلقائي ومنعرضش اختيار لون فاضي =====
const productHasColors = (product) => {
  const variants = (product && Array.isArray(product.variants)) ? product.variants : [];
  return variants.length > 1 || !!(variants[0] && variants[0].color);
};
const getDefaultVariant = (product) => {
  const variants = (product && Array.isArray(product.variants)) ? product.variants : [];
  return variants[0] || null;
};
const getCanonicalVariantId = (variant) => {
  if (!variant) return '';
  if (variant._id != null) return String(variant._id);
  return variant.id || '';
};

export default function GuestReturnExchangePage({ t, getLocalized, returnsEnabled = true, exchangesEnabled = true }) {
  // ===== خطوة 1: التحقق برقم الأوردر + رقم الهاتف =====
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [order, setOrder] = useState(null); // نتيجة guestOrdersAPI.lookup

  // ===== خطوة 2: اختيار النوع (استرجاع/استبدال) + المنتجات =====
  const [mode, setMode] = useState(null); // 'return' | 'exchange'
  const [selection, setSelection] = useState({}); // key -> { quantity, newVariantId, newSize } (للاستبدال بس)
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [reasons, setReasons] = useState([]);
  const [productsCache, setProductsCache] = useState({});
  const [evidenceImages, setEvidenceImages] = useState([]);
  const [evidenceRequired, setEvidenceRequired] = useState(false);
  const [feeInfo, setFeeInfo] = useState(null); // { fee, currency, feeType } - جاي من السيرفر (eligibility check)
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  const resetAll = () => {
    setOrderNumber('');
    setPhone('');
    setVerifyError('');
    setOrder(null);
    setMode(null);
    setSelection({});
    setReasonCode('');
    setNote('');
    setReasons([]);
    setEvidenceImages([]);
    setSubmitError('');
    setSubmitResult(null);
    setFeeInfo(null);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyError('');
    if (!orderNumber.trim()) {
      setVerifyError(t('من فضلك اكتب رقم الأوردر', 'Please enter your order number'));
      return;
    }
    if (!isValidEgyptianPhone(phone)) {
      setVerifyError(t('من فضلك اكتب رقم هاتف مصري صحيح', 'Please enter a valid Egyptian phone number'));
      return;
    }
    setVerifying(true);
    try {
      const data = await guestOrdersAPI.lookup(orderNumber.trim(), phone.trim());
      setOrder(data);
    } catch (err) {
      setVerifyError(err?.response?.data?.message || t('رقم الطلب أو رقم الهاتف غير صحيح', 'Order number or phone number is incorrect'));
    } finally {
      setVerifying(false);
    }
  };

  const chooseMode = async (nextMode) => {
    setMode(nextMode);
    setSelection({});
    setReasonCode('');
    setNote('');
    setEvidenceImages([]);
    setSubmitError('');
    setFeeInfo(null);
    try {
      const list = nextMode === 'return'
        ? await guestOrdersAPI.getReturnReasons()
        : await guestOrdersAPI.getExchangeReasons();
      setReasons(Array.isArray(list) ? list : []);
    } catch {
      setReasons([]);
    }
  };

  // ===== لو الأدمن مفعّل نوع واحد بس (استرجاع أو استبدال)، منعرضش شاشة
  // الاختيار خالص - بنختار النوع المتاح تلقائي ونكمل على طول =====
  useEffect(() => {
    if (order && !mode && returnsEnabled !== exchangesEnabled) {
      chooseMode(returnsEnabled ? 'return' : 'exchange');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, mode, returnsEnabled, exchangesEnabled]);

  // ===== لما السبب يتغيّر، بنتحقق من الأهلية + هل صور الإثبات مطلوبة =====
  const handleReasonChange = async (code) => {
    setReasonCode(code);
    setFeeInfo(null);
    if (!code || !order) return;
    try {
      const result = mode === 'return'
        ? await guestOrdersAPI.getReturnEligibility(order.orderNumber, phone.trim(), code)
        : await guestOrdersAPI.getExchangeEligibility(order.orderNumber, phone.trim(), code);
      setEvidenceRequired(!!result?.evidenceRequired);
      if (result && result.eligible === false) {
        setSubmitError(result.message || '');
      } else {
        setSubmitError('');
      }
      if (result && result.fee) {
        setFeeInfo(result.fee);
      }
    } catch {
      setEvidenceRequired(false);
    }
  };

  const toggleItem = async (item) => {
    const key = itemKey(item);
    setSelection((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { quantity: 1, newVariantId: '', newSize: '' };
      }
      return next;
    });
    if (mode === 'exchange' && !selection[key]) {
      let product = productsCache[item.productId];
      if (!product) {
        try {
          product = await productsAPI.getById(item.productId);
          setProductsCache((prev) => ({ ...prev, [item.productId]: product }));
        } catch (err) {
          console.error('تعذّر تحميل بيانات المنتج:', err);
        }
      }
      // المنتج ده مالوش ألوان أصلاً - اختار الفاريانت الوحيد تلقائيًا
      if (product && !productHasColors(product)) {
        const defVariant = getDefaultVariant(product);
        if (defVariant) {
          setSelection((prev) => ({ ...prev, [key]: { ...prev[key], newVariantId: getCanonicalVariantId(defVariant) } }));
        }
      }
    }
  };

  const handleEvidenceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEvidence(true);
    try {
      const uploaded = await guestOrdersAPI.uploadEvidenceImage(file);
      const url = uploaded?.data?.url || uploaded?.url;
      if (url) setEvidenceImages((prev) => [...prev, url].slice(0, 10));
    } catch (err) {
      alert(err?.response?.data?.message || t('تعذر رفع الصورة، حاول مرة أخرى', 'Could not upload the image, please try again'));
    } finally {
      setUploadingEvidence(false);
    }
  };

  const selectedItems = order ? (order.items || []).filter((item) => selection[itemKey(item)]) : [];
  const canSubmitReturn = mode === 'return' && selectedItems.length > 0 && reasonCode;
  const canSubmitExchange = mode === 'exchange' && selectedItems.length > 0 && reasonCode
    && selectedItems.every((item) => {
      const sel = selection[itemKey(item)];
      if (!sel || !sel.newVariantId) return false;
      const pd = productsCache[item.productId];
      const needsSize = pd ? (pd.sizes || []).length > 0 : true;
      return needsSize ? !!sel.newSize : true;
    });

  const handleSubmit = async () => {
    if (!order) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      if (mode === 'return') {
        const items = selectedItems.map((item) => {
          const sel = selection[itemKey(item)];
          return {
            productId: item.productId,
            variantId: item.variantId || null,
            size: item.size || null,
            quantity: sel.quantity,
          };
        });
        const result = await guestOrdersAPI.requestReturn(order.orderNumber, phone.trim(), {
          items, reasonCode, reason: note, evidenceImages,
        });
        setSubmitResult({ type: 'return', ...result });
      } else {
        const items = selectedItems.map((item) => {
          const sel = selection[itemKey(item)];
          return {
            productId: item.productId,
            oldVariantId: item.variantId || null,
            oldSize: item.size || null,
            quantity: sel.quantity,
            requestedNewVariant: { variantId: sel.newVariantId, size: sel.newSize },
          };
        });
        const result = await guestOrdersAPI.requestExchange(order.orderNumber, phone.trim(), {
          items, reasonCode, customerNote: note, evidenceImages,
        });
        setSubmitResult({ type: 'exchange', ...result });
      }
    } catch (err) {
      setSubmitError(err?.response?.data?.message || t('حصل خطأ أثناء إرسال الطلب، حاول مرة أخرى', 'Something went wrong while sending the request, please try again'));
    } finally {
      setSubmitting(false);
    }
  };

  // ===== حالة النجاح =====
  if (submitResult) {
    return (
      <section className="py-16 px-6 md:px-12 max-w-xl mx-auto text-center animate-fade-in">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-3">
            {submitResult.type === 'return'
              ? t('تم إرسال طلب الاسترجاع بنجاح', 'Your return request has been sent')
              : t('تم إرسال طلب الاستبدال بنجاح', 'Your exchange request has been sent')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('هنراجع طلبك ونتواصل معاك في أقرب وقت.', "We'll review your request and reach out to you soon.")}
          </p>
          <button onClick={resetAll} className="bg-black text-white px-6 py-2.5 rounded-lg font-bold">
            {t('تقديم طلب تاني', 'Submit another request')}
          </button>
        </div>
      </section>
    );
  }

  // ===== خطوة 1: التحقق =====
  if (!order) {
    return (
      <section className="py-16 px-6 md:px-12 max-w-md mx-auto animate-fade-in">
        <h2 className="text-3xl font-bold mb-2 text-center">{t('استرجاع أو استبدال طلب', 'Return or Exchange an Order')}</h2>
        <p className="text-gray-600 text-center mb-8">
          {t('اكتب رقم الأوردر ورقم الهاتف المسجّل بيه عشان تقدر تطلب استرجاع أو استبدال.', 'Enter your order number and the phone number used for it to request a return or exchange.')}
        </p>
        <form onSubmit={handleVerify} className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <div>
            <label className="block font-semibold mb-1 text-sm">
              {t('رقم الأوردر', 'Order Number')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder={t('مثال: 1001', 'e.g. 1001')}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-sm">
              {t('رقم الهاتف', 'Phone Number')} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
              autoComplete="off"
            />
          </div>
          {verifyError && <p className="text-red-500 text-sm">{verifyError}</p>}
          <button
            type="submit"
            disabled={verifying}
            className="w-full bg-black text-white px-4 py-2.5 rounded-lg font-bold disabled:bg-gray-300"
          >
            {verifying ? t('جاري البحث...', 'Searching...') : t('بحث عن الطلب', 'Find my order')}
          </button>
        </form>
      </section>
    );
  }

  // ===== خطوة 2: اختيار النوع =====
  if (!mode) {
    return (
      <section className="py-16 px-6 md:px-12 max-w-xl mx-auto animate-fade-in">
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="font-bold text-lg mb-1">{t('الطلب رقم', 'Order #')} {order.orderNumber}</h3>
          <p className="text-gray-500 text-sm">{order.customerName}</p>
          <div className="pt-3 mt-3 border-t space-y-2">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <span className="flex-1">{getLocalized(item.name)} {item.size ? `(${item.size})` : ''}</span>
                <span className="font-bold">{item.price} {t('ج.م', 'EGP')}</span>
              </div>
            ))}
          </div>
        </div>
        {order.returnRequestStatus && order.returnRequestStatus !== 'none' && (
          <p className="text-amber-600 text-sm text-center mb-4">
            {t('ملحوظة: فيه طلب استرجاع مسجل بالفعل لهذا الطلب.', 'Note: a return request already exists for this order.')}
          </p>
        )}
        {order.hasActiveExchangeRequest && (
          <p className="text-amber-600 text-sm text-center mb-4">
            {t('ملحوظة: فيه طلب استبدال قيد المعالجة بالفعل لهذا الطلب.', 'Note: an exchange request is already in progress for this order.')}
          </p>
        )}
        {!returnsEnabled && !exchangesEnabled ? (
          <p className="text-gray-500 text-center py-4">
            {t('خدمة الاسترجاع والاستبدال غير متاحة حاليًا.', 'Return and exchange requests are currently unavailable.')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {returnsEnabled && (
              <button onClick={() => chooseMode('return')} className="bg-white border-2 border-black hover:bg-black hover:text-white transition p-6 rounded-lg font-bold">
                {t('استرجاع', 'Return')}
              </button>
            )}
            {exchangesEnabled && (
              <button onClick={() => chooseMode('exchange')} className="bg-black text-white hover:opacity-90 transition p-6 rounded-lg font-bold">
                {t('استبدال', 'Exchange')}
              </button>
            )}
          </div>
        )}
        <button onClick={resetAll} className="w-full text-center text-sm text-gray-500 hover:text-black mt-6">
          {t('رجوع', 'Back')}
        </button>
      </section>
    );
  }

  // ===== خطوة 3: تفاصيل الطلب (منتجات + سبب) =====
  return (
    <section className="py-16 px-6 md:px-12 max-w-xl mx-auto animate-fade-in">
      <h3 className="font-bold text-xl mb-1 text-center">
        {mode === 'return' ? t('طلب استرجاع', 'Return Request') : t('طلب استبدال', 'Exchange Request')}
      </h3>
      <p className="text-gray-500 text-sm text-center mb-6">{t('الطلب رقم', 'Order #')} {order.orderNumber}</p>

      <div className="bg-white p-6 rounded-lg shadow-md space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-2">
            {t('اختار المنتجات', 'Select products')} <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            {(order.items || []).map((item, idx) => {
              const key = itemKey(item);
              const checked = !!selection[key];
              const sel = selection[key];
              const productData = productsCache[item.productId];
              return (
                <div key={idx} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item)} />
                    <span className="flex-1 text-sm">{getLocalized(item.name)} {item.size ? `(${item.size})` : ''}</span>
                    {checked && (item.quantity || 1) > 1 && (
                      <input
                        type="number"
                        min="1"
                        max={item.quantity || 1}
                        value={sel.quantity}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(item.quantity || 1, Number(e.target.value) || 1));
                          setSelection((prev) => ({ ...prev, [key]: { ...prev[key], quantity: v } }));
                        }}
                        className="w-16 border rounded px-2 py-1 text-xs"
                      />
                    )}
                  </div>
                  {checked && mode === 'exchange' && (
                    <div className="pl-7 mt-2">
                      {!productData ? (
                        <p className="text-xs text-gray-400">{t('جاري تحميل الاختيارات...', 'Loading options...')}</p>
                      ) : (() => {
                        const hasColorsOpt = productHasColors(productData);
                        const hasSizesOpt = (productData.sizes || []).length > 0;
                        const variant = (productData.variants || []).find((v) => (v._id || v.id) === sel.newVariantId);
                        return (
                          <div className="flex flex-wrap gap-2">
                            {hasColorsOpt && (
                              <select
                                value={sel.newVariantId}
                                onChange={(e) => setSelection((prev) => ({ ...prev, [key]: { ...prev[key], newVariantId: e.target.value, newSize: '' } }))}
                                className="border rounded-lg px-2 py-1.5 text-xs bg-white"
                              >
                                <option value="">{t('اختار اللون...', 'Select color...')}</option>
                                {(productData.variants || []).map((v) => (
                                  <option key={v._id || v.id} value={v._id || v.id}>{getLocalized(v.color) || v.hex || ''}</option>
                                ))}
                              </select>
                            )}
                            {hasSizesOpt && (
                              <select
                                value={sel.newSize}
                                onChange={(e) => setSelection((prev) => ({ ...prev, [key]: { ...prev[key], newSize: e.target.value } }))}
                                disabled={hasColorsOpt && !sel.newVariantId}
                                className="border rounded-lg px-2 py-1.5 text-xs bg-white disabled:bg-gray-100"
                              >
                                <option value="">{t('اختار المقاس...', 'Select size...')}</option>
                                {(variant?.sizeStock || []).map((s) => (
                                  <option key={s.size} value={s.size} disabled={Number(s.stock) < 1}>
                                    {s.size} {Number(s.stock) < 1 ? t('(غير متوفر)', '(out of stock)') : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                            {!hasColorsOpt && !hasSizesOpt && (
                              <p className="text-xs text-gray-400">{t('مفيش اختيارات تانية لازم تحددها لهذا المنتج.', 'No further options needed for this product.')}</p>
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
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">
            {t('السبب', 'Reason')} <span className="text-red-500">*</span>
          </label>
          <select
            value={reasonCode}
            onChange={(e) => handleReasonChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">{t('اختار السبب...', 'Select a reason...')}</option>
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>{t(r.ar, r.en)}</option>
            ))}
          </select>
        </div>

        {reasonCode && feeInfo && (
          feeInfo.fee > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-bold">
              ⚠️ {mode === 'return'
                ? t(
                    `هيتم خصم ${feeInfo.fee} ${feeInfo.currency === 'EGP' ? 'ج.م' : feeInfo.currency} من قيمة الاسترجاع كرسوم شحن.`,
                    `${feeInfo.fee} ${feeInfo.currency} will be deducted from your refund as a return shipping fee.`
                  )
                : t(
                    `هيتم تحصيل ${feeInfo.fee} ${feeInfo.currency === 'EGP' ? 'ج.م' : feeInfo.currency} رسوم شحن الاستبدال.`,
                    `${feeInfo.fee} ${feeInfo.currency} will be charged as an exchange shipping fee.`
                  )}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 font-bold">
              ✅ {mode === 'return'
                ? t('استرجاع مجاني - مش هيتم خصم أي رسوم شحن.', 'Free return - no shipping fee will be deducted.')
                : t('استبدال مجاني - مش هيتم خصم أي رسوم شحن.', 'Free exchange - no shipping fee will be charged.')}
            </div>
          )
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('تفاصيل إضافية (اختياري لبعض الأسباب)', 'Additional details (required for some reasons)')}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          rows={3}
        />

        {evidenceRequired && (
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              {t('صورة إثبات', 'Evidence photo')} <span className="text-red-500">*</span>
            </label>
            <input type="file" accept="image/*" onChange={handleEvidenceUpload} disabled={uploadingEvidence} className="text-sm" />
            {uploadingEvidence && <p className="text-xs text-gray-400 mt-1">{t('جاري الرفع...', 'Uploading...')}</p>}
            {evidenceImages.length > 0 && (
              <div className="flex gap-2 mt-2">
                {evidenceImages.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-14 h-14 object-cover rounded-md border" />
                ))}
              </div>
            )}
          </div>
        )}

        {submitError && <p className="text-red-500 text-sm">{submitError}</p>}

        <div className="flex gap-2">
          <button
            disabled={
              submitting
              || (mode === 'return' && !canSubmitReturn)
              || (mode === 'exchange' && !canSubmitExchange)
              || (evidenceRequired && evidenceImages.length === 0)
            }
            onClick={handleSubmit}
            className="flex-1 bg-black text-white px-4 py-2.5 rounded-lg font-bold disabled:bg-gray-300"
          >
            {submitting ? t('جاري الإرسال...', 'Sending...') : t('إرسال الطلب', 'Send request')}
          </button>
          <button onClick={() => setMode(null)} className="text-sm text-gray-500 hover:text-black px-3 py-2">
            {t('رجوع', 'Back')}
          </button>
        </div>
      </div>
    </section>
  );
}