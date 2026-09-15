// ============================================================
// LAVA STORE — Service Worker (PWA)
// ============================================================
// الهدف الوحيد من الملف ده: يخلي الموقع قابل للتثبيت (Install / Add to
// Home Screen) من كروم، ويكاش شكل الموقع الأساسي (الصفحة + الأيقونات) بس
// عشان يفتح بسرعة حتى لو النت ضعيف.
//
// عن قصد: مش بيكاش أي حاجة من /api/ خالص (بيانات المنتجات/السلة/الأسعار)
// عشان محدش يشوف بيانات قديمة أو غلط. أي طلب لغير نفس الأصل (other origin،
// زي Cloudinary أو أي CDN) أو أي طلب مش GET بيتجاهل تمامًا ويروح للنت
// العادي زي ما هو من غير أي تدخل من السيرفس ووركر.
// ============================================================

const CACHE_VERSION = 'lava-shell-v2';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ============================================================
// إشعارات الطلبات الجديدة (Web Push) - للأدمن/الموظفين اللي فعّلوا
// الإشعارات من لوحة التحكم فقط. كل إشعار بيوصل مستقل تمامًا عن أي إشعار
// تاني (مفيش "tag" مشترك) - يعني لو جم 100 طلب في نفس اللحظة، هتوصلك
// 100 إشعار منفصل مكدّسين فوق بعض، مش إشعار واحد مجمّع.
// ============================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'LAVA STORE', body: event.data.text() };
  }

  const title = payload.title || 'LAVA STORE';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    data: { orderId: payload.orderId || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// لما حد يدوس على الإشعار: نودّيه للأوردر بالظبط جوه لوحة التحكم.
// لو فيه تاب مفتوح بالفعل بنركّز عليه بدل ما نفتح تاب جديد.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const orderId = event.notification.data?.orderId || null;
  const targetUrl = orderId ? `/?admin_order=${orderId}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'OPEN_ADMIN_ORDER', orderId });
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // بس GET requests من نفس الأصل (نفس الدومين بتاع الموقع)
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // متضربش أي حاجة API خالص - نتها دايمًا هي المصدر الوحيد للحقيقة
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first: يجرب النت الأول، ولو فشل (أوفلاين) يرجع لآخر نسخة متكاشية
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});