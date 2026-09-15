// ============================================================
// usePixels.js — نظام البيكسلات لـ LAVA Store
// بيعمل inject للبيكسل في الصفحة ويوفر دوال لإطلاق الأحداث
// ============================================================

import { useEffect, useRef, useCallback } from 'react';

/**
 * usePixels(pixelIds)
 *
 * @param {{ metaPixelId, tiktokPixelId, googlePixelId, snapchatPixelId }} pixelIds
 *
 * بيعمل inject لأكواد البيكسل في الـ <head> مرة واحدة بس،
 * وبيرجع دالة fireEvent لإطلاق الأحداث من أي مكان في App.jsx
 *
 * الأحداث المدعومة:
 *   ViewContent  → بمجرد فتح صفحة منتج
 *   AddToCart    → بمجرد إضافة للعربة
 *   Purchase     → بعد إتمام الطلب بنجاح
 *   PageView     → تلقائي عند التحميل
 */
export function usePixels(pixelIds = {}) {
  const injectedRef = useRef({
    meta: false,
    tiktok: false,
    google: false,
    snapchat: false,
  });

  const { metaPixelId, tiktokPixelId, googlePixelId, snapchatPixelId } = pixelIds;

  // ===================== META (Facebook/Instagram) =====================
  useEffect(() => {
    if (!metaPixelId || injectedRef.current.meta) return;
    injectedRef.current.meta = true;

    const script = document.createElement('script');
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${metaPixelId}');
      fbq('track', 'PageView');
    `;
    document.head.appendChild(script);

    const noscript = document.createElement('noscript');
    noscript.innerHTML = `<img height="1" width="1" style="display:none"
      src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1"/>`;
    document.head.appendChild(noscript);
  }, [metaPixelId]);

  // ===================== TIKTOK =====================
  useEffect(() => {
    if (!tiktokPixelId || injectedRef.current.tiktok) return;
    injectedRef.current.tiktok = true;

    const script = document.createElement('script');
    script.innerHTML = `
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
        ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],
        ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
        for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
        ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},
        ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,
        ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");
        o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
        var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load('${tiktokPixelId}');
        ttq.page();
      }(window, document, 'ttq');
    `;
    document.head.appendChild(script);
  }, [tiktokPixelId]);

  // ===================== GOOGLE (gtag) =====================
  useEffect(() => {
    if (!googlePixelId || injectedRef.current.google) return;
    injectedRef.current.google = true;

    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${googlePixelId}`;
    document.head.appendChild(gtagScript);

    const inlineScript = document.createElement('script');
    inlineScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${googlePixelId}');
    `;
    document.head.appendChild(inlineScript);
  }, [googlePixelId]);

  // ===================== SNAPCHAT =====================
  useEffect(() => {
    if (!snapchatPixelId || injectedRef.current.snapchat) return;
    injectedRef.current.snapchat = true;

    const script = document.createElement('script');
    script.innerHTML = `
      (function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function()
      {a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
      a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;
      r.src='https://sc-static.net/scevent.min.js';
      var u=t.getElementsByTagName(s)[0];
      u.parentNode.insertBefore(r,u);})(window,document);
      snaptr('init', '${snapchatPixelId}');
      snaptr('track', 'PAGE_VIEW');
    `;
    document.head.appendChild(script);
  }, [snapchatPixelId]);

  // ===================== fireEvent =====================
  /**
   * fireEvent(eventName, data?)
   *
   * eventName: 'ViewContent' | 'AddToCart' | 'Purchase'
   * data: { name, price, currency, quantity, orderId, value }
   */
  const fireEvent = useCallback((eventName, data = {}) => {
    const { name = '', price = 0, currency = 'EGP', quantity = 1, orderId = '', value = 0, productId = '', sku = '', items = [] } = data;
    const eventId = data.eventId || orderId || `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const normalizedItems = Array.isArray(items) && items.length > 0
      ? items
      : [{ item_id: sku || productId || '', item_name: name, price: Number(price || 0), quantity: Number(quantity || 1) }];
    const contentIds = normalizedItems.map((item) => item.item_id || item.sku || item.product_id).filter(Boolean);
    const contents = normalizedItems.map((item) => ({
      id: item.item_id || item.sku || item.product_id || '',
      quantity: Number(item.quantity || 1),
      item_price: Number(item.price || 0),
    })).filter((item) => item.id);
    const metaOptions = { eventID: eventId };

    // ---- META ----
    try {
      if (window.fbq && metaPixelId) {
        const eventMap = {
          ViewContent: () => window.fbq('track', 'ViewContent', {
            content_name: name,
            content_type: 'product',
            content_ids: contentIds,
            contents,
            currency,
            value: price,
          }, metaOptions),
          AddToCart: () => window.fbq('track', 'AddToCart', {
            content_name: name,
            content_type: 'product',
            content_ids: contentIds,
            contents,
            currency,
            value: price,
            num_items: quantity,
          }, metaOptions),
          Purchase: () => window.fbq('track', 'Purchase', {
            currency,
            value,
            num_items: quantity,
            content_type: 'product',
            content_ids: contentIds,
            contents,
            order_id: orderId,
          }, metaOptions),
        };
        eventMap[eventName]?.();
      }
    } catch (e) { console.warn('[Pixel] Meta error:', e); }

    // ---- TIKTOK ----
    try {
      if (window.ttq && tiktokPixelId) {
        const ttqMap = {
          ViewContent: () => window.ttq.track('ViewContent', {
            content_name: name,
            content_type: 'product',
            content_id: productId || sku,
            content_ids: contentIds,
            currency,
            value: price,
            event_id: eventId,
          }),
          AddToCart: () => window.ttq.track('AddToCart', {
            content_name: name,
            content_type: 'product',
            content_id: productId || sku,
            content_ids: contentIds,
            currency,
            value: price,
            quantity,
            event_id: eventId,
          }),
          Purchase: () => window.ttq.track('CompletePayment', {
            currency,
            value,
            quantity,
            content_ids: contentIds,
            content_type: 'product',
            order_id: orderId,
            event_id: eventId,
          }),
        };
        ttqMap[eventName]?.();
      }
    } catch (e) { console.warn('[Pixel] TikTok error:', e); }

    // ---- GOOGLE ----
    try {
      if (window.gtag && googlePixelId) {
        const gaMap = {
          ViewContent: () => window.gtag('event', 'view_item', {
            currency,
            value: price,
            items: normalizedItems.map((item) => ({ item_id: item.item_id || item.sku || item.product_id || '', item_name: item.item_name || name, price: Number(item.price || price || 0), quantity: Number(item.quantity || 1) })),
          }),
          AddToCart: () => window.gtag('event', 'add_to_cart', {
            currency,
            value: price,
            items: normalizedItems.map((item) => ({ item_id: item.item_id || item.sku || item.product_id || '', item_name: item.item_name || name, price: Number(item.price || price || 0), quantity: Number(item.quantity || 1) })),
          }),
          Purchase: () => window.gtag('event', 'purchase', {
            transaction_id: orderId,
            currency,
            value,
            items: normalizedItems.map((item) => ({ item_id: item.item_id || item.sku || item.product_id || '', item_name: item.item_name || name || 'Order', price: Number(item.price || 0), quantity: Number(item.quantity || 1) })),
          }),
        };
        gaMap[eventName]?.();
      }
    } catch (e) { console.warn('[Pixel] Google error:', e); }

    // ---- SNAPCHAT ----
    try {
      if (window.snaptr && snapchatPixelId) {
        const snapMap = {
          ViewContent: () => window.snaptr('track', 'VIEW_CONTENT', {
            price,
            currency,
            item_ids: contentIds,
            item_category: name,
            event_id: eventId,
          }),
          AddToCart: () => window.snaptr('track', 'ADD_CART', {
            price,
            currency,
            item_ids: contentIds,
            event_id: eventId,
          }),
          Purchase: () => window.snaptr('track', 'PURCHASE', {
            price: value,
            currency,
            item_ids: contentIds,
            transaction_id: orderId,
            event_id: eventId,
          }),
        };
        snapMap[eventName]?.();
      }
    } catch (e) { console.warn('[Pixel] Snapchat error:', e); }
  }, [metaPixelId, tiktokPixelId, googlePixelId, snapchatPixelId]);

  return { fireEvent };
}
