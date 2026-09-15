// ============================================================
// NotFoundPage.jsx — صفحة 404
// ------------------------------------------------------------
// بتظهر لما الزائر يفتح رابط مش موجود (منتج اتمسح، لينك غلط،
// دومين قديم) بدل ما يترمي على الصفحة الرئيسية بصمت من غير ما
// يعرف إن اللينك اللي فتحه أصلاً مش موجود.
// ============================================================

import React from 'react';

export default function NotFoundPage({ t, goTo, storeName }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <p className="text-7xl md:text-8xl font-black text-[var(--lava-text)] opacity-20 mb-2">404</p>
      <h1 className="text-2xl md:text-3xl font-black text-[var(--lava-text)] mb-2">
        {t('الصفحة اللي بتدور عليها مش موجودة', 'This page could not be found')}
      </h1>
      <p className="text-[var(--lava-muted)] mb-8 max-w-md">
        {t(
          'ممكن يكون اللينك غلط أو الصفحة اتشالت. جرب ترجع للرئيسية أو تتصفح المنتجات.',
          'The link might be broken or the page may have been removed. Try going back home or browsing our products.'
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => goTo('home')}
          className="px-6 py-3 rounded-xl font-bold bg-black text-white hover:opacity-90 transition"
        >
          {t('الرجوع للرئيسية', 'Back to Home')}
        </button>
        <button
          type="button"
          onClick={() => goTo('shop')}
          className="px-6 py-3 rounded-xl font-bold border border-[var(--lava-border)] hover:bg-[var(--lava-secondary)] transition"
        >
          {t('تصفح المنتجات', 'Browse Products')}
        </button>
      </div>
    </div>
  );
}