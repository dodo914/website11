// ============================================================
// loadXLSX.js — تحميل مكتبة SheetJS (XLSX) من CDN عند الحاجة فقط
// ------------------------------------------------------------
// ===== FIX: App.jsx (exportConfirmedOrders / exportAllOrders /
// catalog export) كان بيتحقق من `typeof XLSX === 'undefined'`
// على أساس إن المكتبة هتتحمّل "من مكان تاني" وقت الحاجة - لكن
// مفيش أي كود في المشروع كله كان بيحمّلها فعليًا (لا <script> في
// index.html، ولا حزمة npm، ولا تحميل ديناميكي). يعني الشرط ده
// كان صحيح دايمًا، وزراير تصدير Excel التلاتة كانت مستحيل تشتغل
// من الأساس - الأدمن يشوف بس رسالة "جاري تحميل المكتبة" للأبد.
//
// الحل: تحميل ديناميكي حقيقي عند أول ضغطة على أي زرار تصدير (لا
// نحمّل المكتبة دي (~600 كيلوبايت) مع كل صفحات الموقع من غير
// داعي) - النتيجة متخزّنة (cached) فمحاولات لاحقة مش بتعيد التحميل.
// ============================================================

const XLSX_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

let loadPromise = null;

export function loadXLSXLibrary() {
  // خلاص متحمّلة (مثلاً حد تاني حمّلها بنفس الطريقة قبل كده)
  if (typeof window !== 'undefined' && window.XLSX) {
    return Promise.resolve(window.XLSX);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${XLSX_CDN_URL}"]`);
    if (existing) {
      if (window.XLSX) return resolve(window.XLSX);
      existing.addEventListener('load', () => resolve(window.XLSX));
      existing.addEventListener('error', () => reject(new Error('XLSX_LOAD_FAILED')));
      return;
    }

    const script = document.createElement('script');
    script.src = XLSX_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.XLSX) resolve(window.XLSX);
      else reject(new Error('XLSX_LOAD_FAILED'));
    };
    script.onerror = () => {
      // فشل التحميل (مثلاً مشكلة إنترنت) - نصفّر الـpromise عشان تسمح
      // بمحاولة تحميل تانية لاحقًا بدل ما تفضل عالقة على فشل قديم.
      loadPromise = null;
      reject(new Error('XLSX_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}