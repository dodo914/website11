import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import { registerServiceWorker } from './utils/pwaManifest'

// ===== PWA: تسجيل الـ Service Worker عشان الموقع يبقى قابل للتثبيت (Install / Add to Home Screen) من كروم =====
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="حصل خطأ في الموقع" fallbackSubtitle="من فضلك حدّث الصفحة وحاول تاني. لو المشكلة استمرت، تواصل مع الدعم الفني.">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)