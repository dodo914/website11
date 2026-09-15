// ============================================================
// sitemapController.js — sitemap.xml و robots.txt
//
// GET /sitemap.xml  → خريطة الموقع (منتجات + صفحات ثابتة + صفحات مخصصة)
//                     عشان جوجل يقدر يكتشف ويفهرس صفحات المتجر
// GET /robots.txt   → توجيهات محركات البحث (بيستثني صفحة الأدمن والتشيك آوت)
// ============================================================

const Product = require('../models/Product');
const Settings = require('../models/Settings');

// دومين الفرونت اند الفعلي (مش دومين الـ API) — أولوية لـ FRONTEND_URL في .env،
// ولو مش متظبط بنرجع لرابط SEO المتظبط من لوحة الأدمن (Settings.seo.canonicalBaseUrl)
const getFrontendUrl = async () => {
  const envUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || '').replace(/\/$/, '');
  if (envUrl) return envUrl;
  try {
    const settings = await Settings.findOne({}).select('seo').lean();
    const seoUrl = settings?.seo?.canonicalBaseUrl || '';
    return seoUrl.replace(/\/$/, '');
  } catch (err) {
    return '';
  }
};

const escapeXml = (str = '') => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const getProductSlugOrId = (p) => p.slug || p._id;

// GET /sitemap.xml
const getSitemap = async (req, res) => {
  try {
    const baseUrl = await getFrontendUrl();
    if (!baseUrl) {
      // مفيش FRONTEND_URL متظبط — بنرجع sitemap فاضي بدل ما نبني روابط غلط
      res.set('Content-Type', 'application/xml');
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }

    const [products, settings] = await Promise.all([
      Product.find({ visibility: 'published' }).select('slug updatedAt').lean(),
      Settings.findOne({}).select('customPages').lean(),
    ]);

    const staticPages = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/shop', priority: '0.9', changefreq: 'daily' },
      { path: '/contact', priority: '0.5', changefreq: 'monthly' },
    ];

    const customPages = (settings?.customPages || [])
      .filter((p) => p.slug)
      .map((p) => ({ path: `/page/${p.slug}`, priority: '0.6', changefreq: 'monthly' }));

    const urls = [
      ...staticPages.map((p) => ({
        loc: `${baseUrl}${p.path}`,
        priority: p.priority,
        changefreq: p.changefreq,
      })),
      ...customPages.map((p) => ({
        loc: `${baseUrl}${p.path}`,
        priority: p.priority,
        changefreq: p.changefreq,
      })),
      ...products.map((p) => ({
        loc: `${baseUrl}/product/${getProductSlugOrId(p)}`,
        priority: '0.8',
        changefreq: 'weekly',
        lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : undefined,
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <priority>${u.priority}</priority>\n    <changefreq>${u.changefreq}</changefreq>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>`)
      .join('\n')}\n</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600'); // كاش لمدة ساعة، الـ sitemap مش محتاج يتحدث كل ثانية
    res.status(200).send(xml);
  } catch (err) {
    console.error('Error generating sitemap:', err);
    res.status(500).json({ message: 'حصل خطأ في إنشاء sitemap' });
  }
};

// GET /robots.txt
const getRobotsTxt = async (req, res) => {
  const baseUrl = await getFrontendUrl();
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /checkout',
    'Disallow: /account',
    'Disallow: /my-orders',
    ...(baseUrl ? [`Sitemap: ${baseUrl}/sitemap.xml`] : []),
  ];
  res.set('Content-Type', 'text/plain');
  res.status(200).send(lines.join('\n'));
};

module.exports = { getSitemap, getRobotsTxt };