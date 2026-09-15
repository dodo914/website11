import React from 'react';

// ============================================================================
// ===== Error Boundary بسيط =====
// من غير Error Boundary، أي خطأ JS بيحصل أثناء الـrender (حتى لو جوه صفحة
// واحدة بس) بيخلي React (من غير Error Boundary) يشيل الشجرة كلها ويسيب
// الصفحة بيضة تمامًا - وده بالظبط اللي كان بيحصل. الكومبوننت ده بيلقط أي
// خطأ زي ده جوه أي صفحة بيتحط فيها (زي GuestReturnExchangePage) ويعرض
// رسالة واضحة بدل ما الموقع كله يختفي.
//
// P1-6 (Part B): تفاصيل الخطأ التقنية (الرسالة الخام + الـstack trace، اللي
// بيكشف مسارات الملفات الداخلية وبنية الكومبوننتس) بتتعرض بس في وضع
// الديفلوبمنت (import.meta.env.DEV بتاع Vite). في production، اليوزر
// بيشوف رسالة عامة بس - أي تفاصيل تشخيصية بتتسجل في console.error فقط.
// ============================================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.error) {
      const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
      return (
        <section className="py-16 px-6 md:px-12 max-w-xl mx-auto text-center fade-in">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-3">
              {this.props.fallbackTitle || 'حصل خطأ غير متوقع'}
            </h2>
            <p className="text-gray-600 mb-4">
              {this.props.fallbackSubtitle || 'من فضلك رجّع الصفحة وحاول تاني. لو المشكلة استمرت، تواصل مع الدعم الفني.'}
            </p>
            {isDev && (
              <details className="text-start bg-gray-50 border rounded-lg p-3 text-xs text-gray-500 whitespace-pre-wrap break-words">
                <summary className="cursor-pointer font-semibold mb-2">تفاصيل تقنية (وضع التطوير فقط)</summary>
                {String(this.state.error?.message || this.state.error)}
                {this.state.error?.stack ? `\n\n${this.state.error.stack}` : ''}
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-5 bg-black text-white px-6 py-2.5 rounded-lg font-bold"
            >
              تحديث الصفحة
            </button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;