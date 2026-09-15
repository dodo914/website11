const crypto = require('crypto');
const { getEmailBrandSettings, wrapEmailHtml } = require('../utils/emailTemplate');

const apiKey = () => String(process.env.BREVO_API_KEY || '').trim();
const fromEmail = () => String(process.env.BREVO_FROM_EMAIL || '').trim();
const fromName = () => String(process.env.BREVO_FROM_NAME || 'LAVA Store').trim();

const configured = () => Boolean(apiKey() && fromEmail());

async function brevoRequest(path, body) {
  if (!apiKey()) {
    const err = new Error('Brevo API key is not configured');
    err.code = 'BREVO_NOT_CONFIGURED';
    throw err;
  }
  const response = await fetch(`https://api.brevo.com/v3${path}`, {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': apiKey(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || `Brevo request failed (${response.status})`);
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
}

async function sendEmail({ to, name, subject, html, text, tags = [] }) {
  if (!fromEmail()) {
    const err = new Error('BREVO_FROM_EMAIL is not configured');
    err.code = 'BREVO_FROM_NOT_CONFIGURED';
    throw err;
  }
  const payload = {
    sender: { email: fromEmail(), name: fromName() },
    to: [{ email: String(to).trim().toLowerCase(), name: name || undefined }],
    subject,
    htmlContent: html,
    textContent: text || undefined,
  };
  if (Array.isArray(tags) && tags.length > 0) {
    payload.tags = tags;
  }
  return brevoRequest('/smtp/email', payload);
}

async function sendWhatsApp({ phone, templateId, senderNumber, params = {}, bodyText }) {
  const normalizedPhone = String(phone || '').replace(/[^\d]/g, '');
  if (!normalizedPhone) throw new Error('WhatsApp phone is missing');
  const body = { contactNumbers: [normalizedPhone] };
  if (templateId) {
    body.templateId = Number(templateId);
    body.senderNumber = String(senderNumber || process.env.BREVO_WHATSAPP_SENDER || '').replace(/[^\d]/g, '');
    if (Object.keys(params).length) body.params = params;
  } else if (bodyText) {
    body.text = bodyText;
    body.senderNumber = String(senderNumber || process.env.BREVO_WHATSAPP_SENDER || '').replace(/[^\d]/g, '');
  } else {
    throw new Error('WhatsApp requires templateId for this integration');
  }
  return brevoRequest('/whatsapp/sendMessage', body);
}

function makeConfirmationToken(orderId, email, ttlMs = 7 * 24 * 60 * 60 * 1000) {
  const data = { orderId: String(orderId), exp: Date.now() + ttlMs, email: String(email).trim().toLowerCase() };
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const secret = String(process.env.JWT_SECRET || process.env.BREVO_API_KEY || '');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyConfirmationToken(token) {
  try {
    const [payload, sig] = String(token || '').split('.');
    if (!payload || !sig) return null;
    const secret = String(process.env.JWT_SECRET || process.env.BREVO_API_KEY || '');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.orderId || !data?.email || Number(data.exp) < Date.now()) return null;
    return { orderId: String(data.orderId), email: String(data.email).toLowerCase(), exp: Number(data.exp) };
  } catch { return null; }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

async function orderHtml(order, confirmationUrl, cancelUrl) {
  const settings = await getEmailBrandSettings();
  const rows = (order.items || []).map(i => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.name?.ar || i.name?.en || 'Product')} ${i.size ? `(${escapeHtml(i.size)})` : ''}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.quantity || 1}</td><td style="padding:8px;border-bottom:1px solid #eee">${Number(i.price || 0).toLocaleString()} EGP</td></tr>`).join('');
  const buttonsHtml = `<div style="margin-top:10px">
      <a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:bold;margin:4px 6px">✅ تأكيد الطلب</a>
      ${cancelUrl ? `<a href="${escapeHtml(cancelUrl)}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:bold;margin:4px 6px">❌ إلغاء الطلب</a>` : ''}
    </div>`;
  const inner = `<div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <h2 style="margin:0 0 6px">تأكيد طلبك #${escapeHtml(order.orderNumber ?? order._id)}</h2>
    <p style="margin:0 0 16px">مرحباً ${escapeHtml(order.customerName)}, دي تفاصيل طلبك:</p>
    <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:right;padding:8px">المنتج</th><th style="padding:8px">الكمية</th><th style="padding:8px">السعر</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="font-size:18px;font-weight:bold;margin-top:14px">الإجمالي: ${Number(order.totalAmount || 0).toLocaleString()} EGP</p>
    ${buttonsHtml}
    <p style="color:#777;font-size:12px;margin-top:20px">ده تأكيد إنك استلمت تفاصيل الطلب. لو الطلب مش صحيح أو مش عايزه، دوس إلغاء الطلب.</p>
  </div>`;
  return wrapEmailHtml(inner, settings);
}

// ===== قالب رسالة تحديث حالة الطلب/الشحن — نفس شكل صندوق تأكيد الطلب =====
async function orderStatusHtml(order, statusLabel, note) {
  const settings = await getEmailBrandSettings();
  const rows = (order.items || []).map(i => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.name?.ar || i.name?.en || 'Product')} ${i.size ? `(${escapeHtml(i.size)})` : ''}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.quantity || 1}</td><td style="padding:8px;border-bottom:1px solid #eee">${Number(i.price || 0).toLocaleString()} EGP</td></tr>`).join('');
  const statusColors = {
    'جديد': '#3b82f6', 'جاري التأكيد': '#f59e0b', 'تم التأكيد': '#8b5cf6', 'تم التسليم': '#10b981',
    'ملغي': '#ef4444', 'مرتجع': '#f97316', 'لم يتم التجهيز': '#6b7280', 'تم التجهيز': '#0ea5e9', 'تم التسليم لشركة الشحن': '#06b6d4',
  };
  const color = statusColors[statusLabel] || '#111111';
  const inner = `<div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <h2 style="margin:0 0 6px">تحديث حالة طلبك #${escapeHtml(order.orderNumber ?? order._id)}</h2>
    <p style="color:#555;margin:0 0 18px">مرحباً ${escapeHtml(order.customerName || '')}، الحالة الجديدة لطلبك هي:</p>
    <div style="display:inline-block;background:${color}1a;color:${color};border:1px solid ${color}55;padding:8px 18px;border-radius:999px;font-weight:bold;margin-bottom:18px">${escapeHtml(statusLabel)}</div>
    ${note ? `<p style="background:#f8f8f8;border-radius:10px;padding:14px;margin:0 0 18px;white-space:pre-wrap;line-height:1.7">${escapeHtml(note)}</p>` : ''}
    <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:right;padding:8px">المنتج</th><th style="padding:8px">الكمية</th><th style="padding:8px">السعر</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="font-size:18px;font-weight:bold;margin-top:14px">الإجمالي: ${Number(order.totalAmount || 0).toLocaleString()} EGP</p>
    <p style="color:#999;font-size:12px;margin-top:24px">طلب رقم #${escapeHtml(order.orderNumber ?? order._id)}</p>
  </div>`;
  return wrapEmailHtml(inner, settings);
}

// ===== قالب رسالة السلة المتروكة — نفس شكل صندوق تأكيد الطلب مع كود خصم اختياري =====
async function abandonedCartHtml(cart, note, couponCode) {
  const settings = await getEmailBrandSettings();
  const rows = (cart.items || []).map(i => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.name?.ar || i.name?.en || i.name || 'Product')} ${i.size ? `(${escapeHtml(i.size)})` : ''}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.quantity || 1}</td><td style="padding:8px;border-bottom:1px solid #eee">${Number(i.price || 0).toLocaleString()} EGP</td></tr>`).join('');
  const clientUrl = String(process.env.CLIENT_URL || process.env.FRONTEND_URL || '/').replace(/\/$/, '');
  const inner = `<div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <h2 style="margin:0 0 6px">🛒 لسه حاجاتك مستنياك</h2>
    ${note ? `<p style="color:#555;margin:0 0 18px;white-space:pre-wrap;line-height:1.7">${escapeHtml(note)}</p>` : ''}
    <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:right;padding:8px">المنتج</th><th style="padding:8px">الكمية</th><th style="padding:8px">السعر</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="font-size:18px;font-weight:bold;margin-top:14px">الإجمالي: ${Number(cart.subtotal || 0).toLocaleString()} EGP</p>
    ${couponCode ? `<div style="margin-top:18px;border:2px dashed #111;border-radius:10px;padding:14px;text-align:center"><div style="font-size:12px;color:#777">كود الخصم بتاعك</div><div style="font-size:22px;font-weight:bold;letter-spacing:2px;margin-top:4px">${escapeHtml(couponCode)}</div></div>` : ''}
    <a href="${escapeHtml(clientUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:bold;margin-top:22px">إكمال الطلب</a>
  </div>`;
  return wrapEmailHtml(inner, settings);
}

// ===== قالب الرسالة التسويقية (حملة عامة) — نفس تصميم صندوق تأكيد الطلب =====
async function campaignHtml(subject, content) {
  const settings = await getEmailBrandSettings();
  const paragraphs = String(content || '').split(/\n{2,}/).map(p => `<p style="margin:0 0 14px;line-height:1.8">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  const inner = `<div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    ${subject ? `<h2 style="margin:0 0 18px">${escapeHtml(subject)}</h2>` : ''}
    ${paragraphs}
  </div>`;
  return wrapEmailHtml(inner, settings);
}

module.exports = { configured, sendEmail, sendWhatsApp, makeConfirmationToken, verifyConfirmationToken, orderHtml, orderStatusHtml, abandonedCartHtml, campaignHtml, escapeHtml };