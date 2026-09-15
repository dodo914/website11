// ============================================================
// feedController.js — Product Feed Endpoints لـ LAVA Store
//
// GET /feeds/meta-catalog.xml     → ميتا / إنستجرام (RSS XML)
// GET /feeds/google-catalog.xml   → جوجل Merchant Center (RSS XML)
// GET /feeds/tiktok-catalog.csv   → تيك توك (CSV)
// GET /feeds/snapchat-catalog.csv → سناب شات (CSV)
//
// كل endpoint بيتحقق إن الكتالوج المقابل enabled في الـ settings
// لو disabled → يرجع 403
// ============================================================

const Product = require('../models/Product');
const Settings = require('../models/Settings');

// ===== helpers =====

const getSettings = async () => {
  let s = await Settings.findOne({});
  if (!s) s = await Settings.create({});
  return s;
};

const getActiveProducts = async () => {
  return Product.find({ visibility: 'published' }).lean();
};

const getLocalized = (field, lang = 'ar') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field['en'] || field['ar'] || '';
};

const getProductPrice = (p) => {
  const isOnSale = p.onSale && p.salePrice && p.salePrice < p.price;
  return isOnSale ? p.salePrice : p.price;
};

const getSalePrice = (p) => {
  if (p.onSale && p.salePrice && p.salePrice < p.price) return p.salePrice;
  return null;
};

const getFirstImage = (p) => {
  if (!p.images || p.images.length === 0) {
    // جرب صور الفاريانت الأول
    if (p.variants && p.variants.length > 0) {
      const v = p.variants[0];
      if (v.images && v.images.length > 0) return v.images[0].url || '';
    }
    return '';
  }
  const img = p.images[0];
  return img.url || img || '';
};

const getAdditionalImages = (p) => {
  const urls = [];
  if (p.images && p.images.length > 1) {
    p.images.slice(1).forEach(img => {
      const u = img.url || img;
      if (u) urls.push(u);
    });
  }
  return urls.slice(0, 10); // max 10 additional
};

const getTotalStock = (p) => {
  if (p.variants && p.variants.length > 0) {
    return p.variants.reduce((sum, v) => {
      const vStock = (v.sizeStock || []).reduce((s, ss) => s + (ss.stock || 0), 0);
      return sum + vStock;
    }, 0);
  }
  return 1; // لو مفيش فاريانت نعتبره متاح
};

const escapeXml = (str) => {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const escapeCsv = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildProductUrl = (p, origin) => {
  const slug = p.slug || p._id.toString();
  return `${origin}/product/${slug}`;
};

// ===== Meta / Google XML Feed (RSS 2.0 + g: namespace) =====

const getVariantRows = (p) => {
  const rows = [];
  const variants = Array.isArray(p.variants) ? p.variants : [];

  if (variants.length === 0) {
    return [{
      id: p._id.toString(),
      itemGroupId: null,
      sku: p.sku || p._id.toString(),
      color: '',
      size: '',
      image: getFirstImage(p),
    }];
  }

  for (const variant of variants) {
    const variantId = variant.id || variant._id?.toString() || '';
    const color = getLocalized(variant.color);
    const variantImage = variant.images?.[0]?.url || variant.images?.[0] || getFirstImage(p);
    const sizes = Array.isArray(variant.sizeStock) && variant.sizeStock.length > 0
      ? variant.sizeStock
      : [{ size: '', sku: '' }];

    for (const sizeEntry of sizes) {
      const sku = sizeEntry.sku || variantId || `${p._id}-${color || 'default'}${sizeEntry.size ? `-${sizeEntry.size}` : ''}`;
      rows.push({
        id: sku,
        itemGroupId: variants.length > 1 || sizes.length > 1 ? p._id.toString() : null,
        sku,
        color,
        size: sizeEntry.size || '',
        image: variantImage,
      });
    }
  }

  return rows.length > 0 ? rows : [{
    id: p._id.toString(), itemGroupId: null, sku: p._id.toString(), color: '', size: '', image: getFirstImage(p),
  }];
};

const getSaleEffectiveDate = (settings, p) => {
  if (!p.onSale || !(p.salePrice > 0 && p.salePrice < p.price)) return '';
  const end = settings?.saleEndDate ? new Date(settings.saleEndDate) : null;
  if (!end || Number.isNaN(end.getTime())) return '';
  const start = new Date();
  return `${start.toISOString()}/${end.toISOString()}`;
};

// ===== Meta / Google XML Feed (RSS 2.0 + g: namespace) =====
const buildXmlFeed = (products, settings, origin, platform) => {
  const storeName = getLocalized(settings.storeName) || 'LAVA Store';
  const storeDesc = getLocalized(settings.storeDescription) || storeName;
  const storeUrl = origin;

  const items = products.flatMap((p) => getVariantRows(p).map((variantRow) => {
    const titleBase = getLocalized(p.name);
    const title = escapeXml(variantRow.color || variantRow.size ? `${titleBase}${variantRow.color ? ` - ${variantRow.color}` : ''}${variantRow.size ? ` - ${variantRow.size}` : ''}` : titleBase);
    const description = escapeXml(getLocalized(p.description) || titleBase);
    const link = escapeXml(buildProductUrl(p, origin));
    const imageLink = escapeXml(variantRow.image || getFirstImage(p));
    const additionalImages = getAdditionalImages(p);
    const price = getProductPrice(p);
    const salePrice = getSalePrice(p);
    const stock = variantRow.size || variantRow.color
      ? (() => {
          const variant = (p.variants || []).find(v => String(v.id || v._id) === String(variantRow.itemGroupId || variantRow.sku) || (v.sizeStock || []).some(ss => String(ss.sku) === String(variantRow.sku)));
          const size = variant?.sizeStock?.find(ss => String(ss.sku) === String(variantRow.sku));
          return size ? Number(size.stock || 0) : getTotalStock(p);
        })()
      : getTotalStock(p);
    const availability = stock > 0 ? 'in stock' : 'out of stock';
    const brand = escapeXml(storeName);
    const category = escapeXml(getLocalized(p.googleProductCategory) || getLocalized(p.category));
    const googleTaxonomy = escapeXml(getLocalized(p.googleProductCategory) || getLocalized(p.category));
    const gtin = p.gtin || p.barcode || '';
    const saleEffectiveDate = getSaleEffectiveDate(settings, p);

    let additionalImagesXml = '';
    additionalImages.forEach(url => { additionalImagesXml += `\n      <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`; });
    let salePriceXml = salePrice ? `\n      <g:sale_price>${salePrice} EGP</g:sale_price>` : '';
    let saleEffectiveXml = saleEffectiveDate ? `\n      <g:sale_price_effective_date>${escapeXml(saleEffectiveDate)}</g:sale_price_effective_date>` : '';
    let variantXml = '';
    if (variantRow.itemGroupId) variantXml += `\n      <g:item_group_id>${escapeXml(variantRow.itemGroupId)}</g:item_group_id>`;
    if (variantRow.color) variantXml += `\n      <g:color>${escapeXml(variantRow.color)}</g:color>`;
    if (variantRow.size) variantXml += `\n      <g:size>${escapeXml(variantRow.size)}</g:size>`;
    const identifierXml = gtin
      ? `\n      <g:gtin>${escapeXml(gtin)}</g:gtin>\n      <g:identifier_exists>true</g:identifier_exists>`
      : `\n      <g:identifier_exists>false</g:identifier_exists>`;

    return `
    <item>
      <g:id>${escapeXml(variantRow.id)}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${link}</g:link>
      <g:image_link>${imageLink}</g:image_link>${additionalImagesXml}
      <g:price>${price} EGP</g:price>${salePriceXml}${saleEffectiveXml}
      <g:availability>${availability}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${brand}</g:brand>
      <g:product_type>${category}</g:product_type>
      <g:google_product_category>${googleTaxonomy}</g:google_product_category>${variantXml}${identifierXml}
    </item>`;
  })).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(storeName)}</title>
    <link>${escapeXml(storeUrl)}</link>
    <description>${escapeXml(storeDesc)}</description>${items}
  </channel>
</rss>`;
};

// ===== TikTok / Snapchat CSV Feed =====
const buildCsvFeed = (products, settings, origin) => {
  const storeName = getLocalized(settings.storeName) || 'LAVA Store';
  const headers = [
    'sku_id', 'item_group_id', 'title', 'description', 'availability',
    'condition', 'price', 'sale_price', 'link', 'image_link',
    'additional_image_link', 'brand', 'product_type', 'color', 'size',
  ];

  const rows = products.flatMap(p => getVariantRows(p).map(variantRow => {
    const title = getLocalized(p.name);
    const description = getLocalized(p.description) || title;
    const stock = (() => {
      const variant = (p.variants || []).find(v => (v.sizeStock || []).some(ss => String(ss.sku) === String(variantRow.sku)));
      const size = variant?.sizeStock?.find(ss => String(ss.sku) === String(variantRow.sku));
      return size ? Number(size.stock || 0) : getTotalStock(p);
    })();
    const availability = stock > 0 ? 'in stock' : 'out of stock';
    const price = getProductPrice(p);
    const salePrice = getSalePrice(p);
    const link = buildProductUrl(p, origin);
    const imageLink = variantRow.image || getFirstImage(p);
    const additionalImages = getAdditionalImages(p).join('|');
    const category = getLocalized(p.category);
    return [
      variantRow.sku,
      variantRow.itemGroupId || '',
      variantRow.color || variantRow.size ? `${title}${variantRow.color ? ` - ${variantRow.color}` : ''}${variantRow.size ? ` - ${variantRow.size}` : ''}` : title,
      description, availability, 'new', `${price} EGP`, salePrice ? `${salePrice} EGP` : '',
      link, imageLink, additionalImages, storeName, category, variantRow.color, variantRow.size,
    ].map(escapeCsv).join(',');
  }));

  return [headers.join(','), ...rows].join('\n');
};

// ===== Route Handlers =====

// GET /feeds/meta-catalog.xml
const getMetaCatalog = async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings.metaCatalogEnabled) {
      return res.status(403).json({ message: 'Meta catalog is disabled' });
    }
    const products = await getActiveProducts();
    const origin = `${req.protocol}://${req.get('host')}`;
    const xml = buildXmlFeed(products, settings, origin, 'meta');
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600'); // cache ساعة
    res.send(xml);
  } catch (err) {
    console.error('Meta catalog feed error:', err);
    res.status(500).json({ message: 'Feed generation failed'});
  }
};

// GET /feeds/google-catalog.xml
const getGoogleCatalog = async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings.googleCatalogEnabled) {
      return res.status(403).json({ message: 'Google catalog is disabled' });
    }
    const products = await getActiveProducts();
    const origin = `${req.protocol}://${req.get('host')}`;
    const xml = buildXmlFeed(products, settings, origin, 'google');
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('Google catalog feed error:', err);
    res.status(500).json({ message: 'Feed generation failed'});
  }
};

// GET /feeds/tiktok-catalog.csv
const getTikTokCatalog = async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings.tiktokCatalogEnabled) {
      return res.status(403).json({ message: 'TikTok catalog is disabled' });
    }
    const products = await getActiveProducts();
    const origin = `${req.protocol}://${req.get('host')}`;
    const csv = buildCsvFeed(products, settings, origin);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="tiktok-catalog.csv"');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(csv);
  } catch (err) {
    console.error('TikTok catalog feed error:', err);
    res.status(500).json({ message: 'Feed generation failed'});
  }
};

// GET /feeds/snapchat-catalog.csv
const getSnapchatCatalog = async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings.snapchatCatalogEnabled) {
      return res.status(403).json({ message: 'Snapchat catalog is disabled' });
    }
    const products = await getActiveProducts();
    const origin = `${req.protocol}://${req.get('host')}`;
    const csv = buildCsvFeed(products, settings, origin);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="snapchat-catalog.csv"');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(csv);
  } catch (err) {
    console.error('Snapchat catalog feed error:', err);
    res.status(500).json({ message: 'Feed generation failed'});
  }
};

module.exports = {
  getMetaCatalog,
  getGoogleCatalog,
  getTikTokCatalog,
  getSnapchatCatalog,
};