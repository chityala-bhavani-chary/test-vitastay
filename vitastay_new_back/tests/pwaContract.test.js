/**
 * BKG-017 / BIC-087 / TC-B-20 — PWA is the phone app until native stores.
 * File contract only (no DB). SW must never cache API or KYC.
 */
const fs = require('fs');
const path = require('path');

const front = path.join(__dirname, '../../vitastay_new_front');

describe('BKG-017 PWA website-first contract', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(front, 'public/manifest.webmanifest'), 'utf8'));
  const sw = fs.readFileSync(path.join(front, 'public/sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(front, 'index.html'), 'utf8');

  test('manifest is installable and opens guest search, not a store binary', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/search');
    expect(manifest.theme_color).toBe('#002D62');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('index links the manifest and iOS home-screen tags', () => {
    expect(html).toMatch(/rel="manifest"/);
    expect(html).toMatch(/apple-mobile-web-app-capable/);
    expect(html).toMatch(/viewport-fit=cover/);
  });

  test('service worker never caches API, tenant KYC, or Vita Eye stills', () => {
    expect(sw).toMatch(/\/api/);
    expect(sw).toMatch(/uploads\/tenants/);
    expect(sw).toMatch(/uploads\/vita-eye/);
    expect(sw).toMatch(/shouldBypass/);
    expect(sw).not.toMatch(/caches\.open\([^)]+\)[\s\S]{0,200}\/api/);
  });
});
