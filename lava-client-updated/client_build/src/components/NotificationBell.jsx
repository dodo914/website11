import React, { useEffect, useState } from 'react';
import { pushAPI } from '../api/push';

// ============================================================
// زرار "تفعيل إشعارات الطلبات" - مكوّن مستقل بالكامل (بيدير حالته
// بنفسه) عشان نقدر نحطه في أي مكان في لوحة التحكم من غير ما نلمس
// قائمة الـprops الطويلة بتاعة AdminPanel.
//
// بيحوّل مفتاح VAPID العام (Base64 URL-safe) لـUint8Array عشان
// pushManager.subscribe بيطلبه بالشكل ده بالظبط.
// ============================================================
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationBell() {
  // 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'
  const [status, setStatus] = useState('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('denied');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        setStatus(existing ? 'subscribed' : 'default');
      } catch {
        setStatus('default');
      }
    })();
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'default');
        setBusy(false);
        return;
      }

      const { publicKey } = await pushAPI.getVapidPublicKey();
      if (!publicKey) {
        alert('السيرفر لسه مش مظبط مفاتيح الإشعارات (VAPID). راجع ملف .env.');
        setBusy(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await pushAPI.subscribe(subscription.toJSON());
      setStatus('subscribed');
    } catch (err) {
      console.error('تعذّر تفعيل إشعارات الطلبات:', err);
      alert('حصل خطأ أثناء تفعيل الإشعارات، حاول تاني.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await pushAPI.unsubscribe(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
      }
      setStatus('default');
    } catch (err) {
      console.error('تعذّر إلغاء تفعيل إشعارات الطلبات:', err);
    } finally {
      setBusy(false);
    }
  };

  if (status === 'checking') return null;

  if (status === 'unsupported') {
    return (
      <div className="text-xs text-[var(--lava-muted)] bg-[var(--lava-secondary)] border rounded-lg px-3 py-2 w-fit mx-auto mb-4">
        🔕 المتصفح ده مش بيدعم إشعارات الطلبات
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 w-fit mx-auto mb-4">
        🔕 إشعارات الطلبات متمنوعة من إعدادات المتصفح - فعّلها يدويًا من إعدادات الموقع في المتصفح
      </div>
    );
  }

  if (status === 'subscribed') {
    return (
      <div className="flex items-center gap-2 justify-center mb-4">
        <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          🔔 إشعارات الطلبات مفعّلة على الجهاز ده
        </span>
        <button
          type="button"
          onClick={handleDisable}
          disabled={busy}
          className="text-xs font-bold text-[var(--lava-muted)] underline hover:text-black disabled:opacity-50"
        >
          إلغاء
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center mb-4">
      <button
        type="button"
        onClick={handleEnable}
        disabled={busy}
        className="bg-black hover:bg-gray-800 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-60"
      >
        🔔 {busy ? 'جاري التفعيل...' : 'فعّل إشعارات الطلبات الجديدة'}
      </button>
    </div>
  );
}