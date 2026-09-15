import { useState, useEffect, useRef, memo } from 'react';
import { trafficAPI } from '../api/traffic';
import { settingsAPI } from '../api/settings';

// ============================================================
// 1. العداد التنازلي - مربوط بتاريخ نهاية عرض حقيقي من الأدمن
// ============================================================
export const CountdownTimer = memo(({ endDate, onExpire, t }) => {
  const [remainingMs, setRemainingMs] = useState(() => (endDate ? Math.max(0, new Date(endDate).getTime() - Date.now()) : 0));
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    if (!endDate) return;
    hasExpiredRef.current = false;

    const tick = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      setRemainingMs(Math.max(0, diff));
      if (diff <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpire && onExpire();
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endDate, onExpire]);

  // لو مفيش تاريخ نهاية، أو العرض خلص فعلاً، العداد بيختفي تماماً من الهيدر
  // (مش بيسيب شريط "انتهى العرض" ثابت لحاله في كل صفحات الموقع للأبد).
  if (!endDate || remainingMs <= 0) return null;

  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="bg-gray-900 text-white text-center py-2 text-sm font-bold tracking-wide">
      {t('استعجل! العرض ينتهي في: ', 'Hurry up! Sale ends in: ')}
      <span className="text-red-500" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
        {days > 0 ? `${days}d ` : ''}{pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
});

// ============================================================
// 1.5 مؤشر "كام عميل بيشوف المنتج ده دلوقتي" — صفحة المنتج
// بيتفعّل بس لو الأدمن فعّل showLiveViewers من الإعدادات، وبيختفي
// تلقائياً لو العدد صفر (مفيش داعي نعرض "0 يشوفوا المنتج ده دلوقتي")
// ============================================================
export const LiveViewersBadge = memo(({ productId, enabled, t }) => {
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    if (!enabled || !productId) { setViewers(0); return; }
    let cancelled = false;
    const fetchViewers = async () => {
      const data = await trafficAPI.getProductViewers(productId);
      if (!cancelled && data && typeof data.viewers === 'number') setViewers(data.viewers);
    };
    fetchViewers();
    const interval = setInterval(fetchViewers, 20000); // كل 20 ثانية
    return () => { cancelled = true; clearInterval(interval); };
  }, [productId, enabled]);

  if (!enabled || viewers <= 0) return null;

  return (
    <div className="flex items-center gap-2 mb-3 text-sm font-bold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full w-fit">
      <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse inline-block"></span>
      👀 {t(`${viewers} عميل بيشوف المنتج ده دلوقتي`, `${viewers} people viewing this now`)}
    </div>
  );
});

// ============================================================
// 2. مكون Input محسن
// ============================================================
export const InputField = memo(({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  className = '',
  id,
  hint
}) => {
  const inputRef = useRef(null);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block font-semibold mb-1 text-sm">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all bg-[var(--lava-card)]"
        autoComplete="off"
      />
      {/* ===== إضافة: نص توضيحي اختياري تحت الخانة (hint) - مستخدم حاليًا في
          خانة إيميل الزائر بالتشيك أوت عشان يوضحله ليه يكتب إيميله =====*/}
      {hint && (
        <p className="mt-1 text-xs text-[var(--lava-muted)] leading-relaxed">{hint}</p>
      )}
    </div>
  );
});

// ============================================================
// 3. مكون Select محسن
// ============================================================
export const SelectField = memo(({
  label,
  value,
  onChange,
  options,
  required = false,
  className = '',
  id
}) => {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block font-semibold mb-1 text-sm">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all bg-[var(--lava-card)]"
      >
        {options.map((opt, index) => (
          <option key={index} value={opt.value || opt.name}>
            {opt.label || opt.name}
          </option>
        ))}
      </select>
    </div>
  );
});

// ============================================================
// 4. مكون Textarea محسن
// ============================================================
export const TextareaField = memo(({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  rows = 4,
  id
}) => {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block font-semibold mb-1 text-sm">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all bg-[var(--lava-card)]"
      />
    </div>
  );
});

// ============================================================
// 4.6 مكون صورة "رابط أو رفع من الجهاز" — بيدّي الاتنين مع بعض:
//     تقدر تلصق رابط صورة مباشرة، أو تدوس "ارفع من الجهاز" وترفع صورة
//     فعلياً على Cloudinary (مفيش أي تحويل Base64 ولا تخزين في الداتا بيز).
//     لو الرفع فشل (مشكلة في الاتصال بـ Cloudinary مثلاً) بيرفض بوضوح
//     وبيوريك رسالة الخطأ عن طريق showToast من غير ما يغيّر قيمة الحقل.
// ============================================================
export const ImageUrlOrUploadField = memo(({ label, value, onChange, required = false, placeholder, id, showToast, t }) => {
  const [uploading, setUploading] = useState(false);
  const tr = (ar, en) => (typeof t === 'function' ? t(ar, en) : ar);

  const handleFileChange = async (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await settingsAPI.uploadImage(file);
      if (uploaded?.url) {
        onChange(uploaded.url);
        showToast?.(tr('تم رفع الصورة بنجاح', 'Image uploaded successfully'));
      } else {
        showToast?.(tr('تعذر رفع الصورة، حاول مرة أخرى', 'Could not upload the image, please try again'));
      }
    } catch (err) {
      // فشل الرفع (مشكلة في Cloudinary أو الاتصال) — بنرفض ونوري المستخدم بوضوح
      // من غير ما نلمس قيمة الحقل أو نلجأ لأي تخزين بديل (زي Base64).
      showToast?.(err?.message || tr('تعذر رفع الصورة إلى خدمة التخزين. حاول مرة أخرى.', 'Could not upload the image to storage. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block font-semibold mb-1 text-sm">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id={id}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="flex-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all bg-[var(--lava-card)]"
          autoComplete="off"
          dir="ltr"
        />
        <label className={`shrink-0 inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg font-bold text-sm border transition whitespace-nowrap ${uploading ? 'bg-[var(--lava-border)] text-[var(--lava-muted)] cursor-not-allowed' : 'bg-[var(--lava-secondary)] hover:bg-[var(--lava-border)] text-[var(--lava-text)] border-[var(--lava-border)] cursor-pointer'}`}>
          {uploading ? tr('جاري الرفع...', 'Uploading...') : `📤 ${tr('ارفع من الجهاز', 'Upload from device')}`}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      </div>
      {value ? (
        <img src={value} alt="" className="mt-2 h-20 w-20 object-cover rounded-lg border" onError={(e) => { e.target.style.display = 'none'; }} />
      ) : null}
    </div>
  );
});

// ============================================================
// 4.55 مكون رفع فيديو (لفيديو المنتج وفيديو البانر الرئيسي)
// بيرفع الفيديو فعلياً على Cloudinary عن طريق الـ uploader الممرر (productsAPI.uploadVideo
// أو settingsAPI.uploadVideo)، ومفيش أي تحويل Base64 أو تخزين وسيط.
// لو الرفع فشل بيوري toast برسالة "حصل خطأ في رفع الفيديو" من غير ما يغيّر القيمة الحالية.
// value ممكن يكون string (رابط) أو object فيه url — والمكون بيتعامل مع الاتنين.
// ============================================================
export const VideoUploadField = memo(({ label, value, onChange, id, showToast, t, uploader }) => {
  const [uploading, setUploading] = useState(false);
  const tr = (ar, en) => (typeof t === 'function' ? t(ar, en) : ar);
  const videoUrl = typeof value === 'string' ? value : (value?.url || '');

  const handleFileChange = async (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploader(file);
      if (uploaded?.url) {
        onChange(uploaded);
        showToast?.(tr('تم رفع الفيديو بنجاح', 'Video uploaded successfully'));
      } else {
        showToast?.(tr('حصل خطأ في رفع الفيديو', 'Error uploading the video'));
      }
    } catch (err) {
      // فشل الرفع (Cloudinary أو الاتصال) — بنرفض بوضوح ومنلمسش القيمة الحالية،
      // ومفيش أي مسار بديل بيخزن الفيديو كـ Base64.
      showToast?.(err?.message || tr('حصل خطأ في رفع الفيديو', 'Error uploading the video'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block font-semibold mb-1 text-sm">{label}</label>
      )}
      {videoUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={videoUrl} controls className="w-full max-w-xs h-40 rounded-lg border bg-black object-contain" />
          <div className="flex gap-3">
            <label className={`text-sm font-bold bg-[var(--lava-card)] border px-4 py-2 rounded-lg hover:bg-[var(--lava-secondary)] ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
              {uploading ? tr('جاري الرفع...', 'Uploading...') : tr('استبدال الفيديو', 'Replace Video')}
              <input id={id} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleFileChange} disabled={uploading} />
            </label>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100"
            >
              {tr('إزالة الفيديو', 'Remove Video')}
            </button>
          </div>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 text-[var(--lava-muted)] ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:bg-[var(--lava-secondary)]'}`}>
          <span className="text-3xl">🎬</span>
          <span className="text-sm font-bold">{uploading ? tr('جاري الرفع...', 'Uploading...') : tr('اختيار فيديو (MP4 / WebM / MOV)', 'Select Video (MP4 / WebM / MOV)')}</span>
          <input id={id} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      )}
    </div>
  );
});

export const MaskedKeyField = memo(({ label, value, onChange, onRemove, placeholder, id, platformIcon, t }) => {
  const [isEditing, setIsEditing] = useState(!value);

  return (
    <div className="bg-[var(--lava-secondary)] p-4 rounded-lg border space-y-2">
      <label htmlFor={id} className="block font-semibold mb-1 text-sm">
        {platformIcon} {label}
      </label>

      {!isEditing && value ? (
        <div className="flex items-center justify-between gap-3 bg-[var(--lava-card)] border rounded-lg px-4 py-2">
          <span className="font-mono text-[var(--lava-text)] tracking-widest" dir="ltr">
            **** **** **** {value.slice(-4)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-blue-600 text-xs font-bold hover:underline"
            >
              {t('ربط كود جديد', 'Link new key')}
            </button>
            <button
              type="button"
              onClick={() => { onRemove(); setIsEditing(true); }}
              className="text-red-600 text-xs font-bold hover:underline"
            >
              {t('حذف', 'Delete')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            id={id}
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all bg-[var(--lava-card)] font-mono"
            autoComplete="off"
            dir="ltr"
          />
          {value && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="bg-black text-white px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap"
            >
              {t('حفظ', 'Save')}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ===== شريط باجينيشن عام لأي جدول بيانات في لوحة الأدمن (يستخدم في الطلبات/العملاء/السلات المتروكة/سجل النشاط...) =====
export function AdminPaginationBar({ page, setPage, pageSize, setPageSize, totalPages, total, onRefresh, loading, t, pageSizeOptions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--lava-secondary)] border rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span>{t('عدد العناصر في الصفحة:', 'Items per page:')}</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="px-2 py-1 border rounded bg-[var(--lava-card)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-black"
        >
          {(pageSizeOptions || [10, 20, 30, 50, 100]).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        {typeof total === 'number' && (
          <span className="text-[var(--lava-muted)] font-normal">({total} {t('إجمالي', 'total')})</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          className="px-3 py-1.5 border rounded bg-[var(--lava-card)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--lava-secondary)]"
        >
          {t('السابق', 'Prev')}
        </button>
        <span>{t('صفحة', 'Page')} {page} {t('من', 'of')} {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          className="px-3 py-1.5 border rounded bg-[var(--lava-card)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--lava-secondary)]"
        >
          {t('التالي', 'Next')}
        </button>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="bg-gray-800 hover:bg-black text-white px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5 transition disabled:opacity-60"
          >
            {loading ? '⏳' : '🔄'} {t('تحديث', 'Refresh')}
          </button>
        )}
      </div>
    </div>
  );
}