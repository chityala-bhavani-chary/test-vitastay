/**
 * PH-8 / APP-001 / TC-C-01 — one API for website + future store shells.
 * File contract only (no DB). Native binaries are APP-002…006. Daily rates are DAY-*.
 * `/` stays ERP (WEB-001). PWA is the phone client (BIC-087).
 */
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '../..');
const front = path.join(repo, 'vitastay_new_front');
const appJs = fs.readFileSync(path.join(repo, 'vitastay_new_back/app.js'), 'utf8');
const frontApp = fs.readFileSync(path.join(front, 'src/App.jsx'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(front, 'public/manifest.webmanifest'), 'utf8'));
const clientsDoc = fs.readFileSync(path.join(repo, 'docs/16-website-apps-daily-pricing.md'), 'utf8');
const projection = fs.readFileSync(path.join(repo, 'vitastay_new_back/services/listingProjection.js'), 'utf8');

describe('PH-8 client gate (APP-001)', () => {
  test('one Express API serves search, listing, seeker auth, booking, and payments', () => {
    expect(appJs).toMatch(/app\.use\('\/api\/public\/listings'/);
    expect(appJs).toMatch(/app\.use\('\/api\/public\/auth'/);
    expect(appJs).toMatch(/app\.use\('\/api\/bookings'/);
    expect(appJs).toMatch(/app\.use\('\/api\/payments\/webhook'/);
    expect(fs.existsSync(path.join(repo, 'vitastay_mobile_back'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'vitastay_new_back/package.json'))).toBe(true);
  });

  test('tenant website is public routes; `/` stays the ERP', () => {
    expect(frontApp).toMatch(/path="\/search"/);
    expect(frontApp).toMatch(/path="\/listings\/:idOrSlug"/);
    expect(frontApp).toMatch(/path="\/bookings\/:id"/);
    expect(frontApp).toMatch(/path="\/account\/register"/);
    expect(frontApp).toMatch(/path="\/" element=\{<Navigate to="\/dashboard"/);
    expect(frontApp).not.toMatch(/path="\/download"/);
    expect(manifest.start_url).toBe('/search');
    expect(manifest.display).toBe('standalone');
  });

  test('store binaries and daily-rate product are not in this repo yet', () => {
    ['android', 'ios', 'electron', 'windows', 'macos'].forEach((dir) => {
      expect(fs.existsSync(path.join(repo, dir))).toBe(false);
      expect(fs.existsSync(path.join(front, dir))).toBe(false);
    });
    expect(projection).toMatch(/stay_modes:\s*\['monthly'\]/);
    expect(clientsDoc).toMatch(/One backend API/);
    expect(clientsDoc).toMatch(/PWA/);
    expect(clientsDoc).toMatch(/DAY-/);
    expect(clientsDoc).toMatch(/APP-002/);
  });
});
