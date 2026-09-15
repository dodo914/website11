const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 7000;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/[^0-9+]/g, '').replace(/^00/, '+');
const normalizeExternalId = (value) => String(value || '').trim();

const hashIfPresent = (value, normalizer) => {
  const normalized = normalizer(value);
  return normalized ? sha256(normalized) : null;
};

const fetchJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.CONVERSION_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = { raw: text }; }
    if (!response.ok) {
      const error = new Error(`Conversion API HTTP ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
};

const buildItems = (order) => (order.items || []).map((item) => ({
  id: String(item.sku || item.productId || item.variantId || ''),
  quantity: Number(item.quantity || 1),
  price: Number(item.price || 0),
  name: item.name?.en || item.name?.ar || '',
})).filter((item) => item.id);

const buildUser = (order) => {
  const email = hashIfPresent(order.customerEmail || order.shippingAddress?.email, normalizeEmail);
  const phone = hashIfPresent(order.customerPhone || order.shippingAddress?.phone, normalizePhone);
  const externalId = hashIfPresent(order.customerId, normalizeExternalId);
  return { email, phone, externalId };
};

const buildMetaPayload = ({ order, eventId, sourceUrl, ip, userAgent }) => {
  const user = buildUser(order);
  const items = buildItems(order);
  const userData = {};
  if (user.email) userData.em = [user.email];
  if (user.phone) userData.ph = [user.phone];
  if (user.externalId) userData.external_id = [user.externalId];
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;

  return {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: sourceUrl || undefined,
      user_data: userData,
      custom_data: {
        value: Number(order.totalAmount || 0),
        currency: 'EGP',
        content_type: 'product',
        content_ids: items.map((item) => item.id),
        contents: items.map((item) => ({ id: item.id, quantity: item.quantity, item_price: item.price })),
        order_id: String(order.orderNumber || order._id),
        num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      },
    }],
  };
};

const buildTikTokPayload = ({ order, eventId, sourceUrl, ip, userAgent }) => {
  const user = buildUser(order);
  const items = buildItems(order);
  const userData = {};
  if (user.email) userData.email = [user.email];
  if (user.phone) userData.phone = [user.phone];
  if (user.externalId) userData.external_id = [user.externalId];
  if (ip) userData.ip = ip;
  if (userAgent) userData.user_agent = userAgent;

  return {
    event_source: 'web',
    event_source_id: String(process.env.TIKTOK_PIXEL_ID),
    data: [{
      event: 'CompletePayment',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      user: userData,
      properties: {
        value: Number(order.totalAmount || 0),
        currency: 'EGP',
        content_type: 'product',
        contents: items.map((item) => ({ content_id: item.id, content_name: item.name, price: item.price, quantity: item.quantity })),
        order_id: String(order.orderNumber || order._id),
      },
      page: { url: sourceUrl || undefined },
    }],
  };
};

const buildSnapPayload = ({ order, eventId, sourceUrl, ip, userAgent }) => {
  const user = buildUser(order);
  const items = buildItems(order);
  const userData = {};
  if (user.email) userData.em = [user.email];
  if (user.phone) userData.ph = [user.phone];
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;

  return {
    data: [{
      event_type: 'PURCHASE',
      event_conversion_type: 'WEB',
      event_tag: 'purchase',
      event_id: eventId,
      timestamp: Math.floor(Date.now() / 1000) * 1000,
      price: String(Number(order.totalAmount || 0)),
      currency: 'EGP',
      transaction_id: String(order.orderNumber || order._id),
      item_ids: items.map((item) => item.id),
      user_data: userData,
      page_url: sourceUrl || undefined,
    }],
  };
};

const sendPurchaseConversions = async (order, context = {}) => {
  if (!order) return { attempted: false, results: {} };

  const sourceUrl = context.sourceUrl || process.env.FRONTEND_URL || undefined;
  const common = {
    order,
    eventId: String(order._id),
    sourceUrl,
    ip: context.ip,
    userAgent: context.userAgent,
  };
  const results = {};
  const tasks = [];

  if (process.env.META_PIXEL_ID && process.env.META_API_KEY) {
    const url = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || 'v26.0'}/${encodeURIComponent(process.env.META_PIXEL_ID)}/events?access_token=${encodeURIComponent(process.env.META_API_KEY)}`;
    tasks.push(fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildMetaPayload(common)) })
      .then((body) => { results.meta = { ok: true, body }; })
      .catch((error) => { results.meta = { ok: false, message: error.message }; console.error('[Conversions] Meta CAPI failed:', error.message); }));
  }

  if (process.env.TIKTOK_PIXEL_ID && process.env.TIKTOK_API_KEY) {
    tasks.push(fetchJson('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': process.env.TIKTOK_API_KEY },
      body: JSON.stringify(buildTikTokPayload(common)),
    }).then((body) => { results.tiktok = { ok: true, body }; })
      .catch((error) => { results.tiktok = { ok: false, message: error.message }; console.error('[Conversions] TikTok Events API failed:', error.message); }));
  }

  if (process.env.SNAPCHAT_PIXEL_ID && process.env.SNAPCHAT_API_KEY) {
    const url = `https://tr.snapchat.com/v3/${encodeURIComponent(process.env.SNAPCHAT_PIXEL_ID)}/events?access_token=${encodeURIComponent(process.env.SNAPCHAT_API_KEY)}`;
    tasks.push(fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildSnapPayload(common)) })
      .then((body) => { results.snapchat = { ok: true, body }; })
      .catch((error) => { results.snapchat = { ok: false, message: error.message }; console.error('[Conversions] Snapchat CAPI failed:', error.message); }));
  }

  if (tasks.length === 0) return { attempted: false, results };
  await Promise.all(tasks);
  return { attempted: true, results };
};

module.exports = { sendPurchaseConversions, sha256 };
