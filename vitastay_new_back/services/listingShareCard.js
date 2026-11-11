/**
 * BIC-033 — HTML share card. WhatsApp does not run the SPA, so og:image must be in this document.
 */
const config = require('../config');
const { publicAssetUrl } = require('./mediaStorage');

const esc = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const firstHeader = (value) => String(value || '').split(',')[0].trim();

const absoluteUrl = (base, pathOrUrl) => {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const root = String(base || '').replace(/\/$/, '');
  return `${root}${raw.startsWith('/') ? raw : `/${raw}`}`;
};

/** Prefer the public site the crawler actually fetched. Loopback API hosts fall back to APP_URL. */
const publicBaseFrom = (req) => {
  const forwardedHost = firstHeader(req.get('x-forwarded-host'));
  const host = forwardedHost || firstHeader(req.get('host'));
  const loopback = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  if (host && (forwardedHost || !loopback)) {
    const proto = firstHeader(req.get('x-forwarded-proto')) || req.protocol || 'http';
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return String(config.appUrl || `${req.protocol}://${host}`).replace(/\/$/, '');
};

const renderShareCard = ({ hostel, seo, availability, req }) => {
  const publicBase = publicBaseFrom(req);
  const code = encodeURIComponent(hostel.code || hostel.id);
  const listingUrl = `${publicBase}/listings/${code}`;
  const shareUrl = `${publicBase}/api/public/listings/${code}/share`;
  const image = absoluteUrl(publicBase, publicAssetUrl(seo.share_image) || seo.share_image);
  const from = availability?.monthly_rent_from;
  const price = from != null ? `From ₹${Math.round(Number(from))}/month` : '';
  const place = [hostel.area, hostel.city].filter(Boolean).join(', ');
  const title = seo.title || `${hostel.name} · Vita Stay`;
  const description = [price, place, seo.description].filter(Boolean).join(' · ').slice(0, 300);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(shareUrl)}" />
  ${image ? `<meta property="og:image" content="${esc(image)}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  ${image ? `<meta name="twitter:image" content="${esc(image)}" />` : ''}
  <link rel="canonical" href="${esc(listingUrl)}" />
  <meta name="robots" content="noindex" />
</head>
<body>
  <p><a href="${esc(listingUrl)}">${esc(hostel.name)}</a></p>
  <script>location.replace(${JSON.stringify(listingUrl)});</script>
</body>
</html>`;
};

module.exports = { renderShareCard };
