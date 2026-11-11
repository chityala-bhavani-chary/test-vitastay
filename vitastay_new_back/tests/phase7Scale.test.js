/**
 * PH-7 / DEC-07 / TC-S-01 — scale gate: local driver, CDN seam, PWA phone client, one API.
 * File contract only (no DB). S3 driver is BIC-105. Native Android is BIC-088 / PH-8.
 */
const fs = require('fs');
const path = require('path');
const mediaStorage = require('../services/mediaStorage');
const { isPrivateUploadPath, signPrivateUrl } = require('../services/uploadAccess');

const repo = path.join(__dirname, '../..');
const front = path.join(repo, 'vitastay_new_front');
const plan = fs.readFileSync(path.join(repo, 'docs/18-object-storage-migration.md'), 'utf8');

describe('PH-7 scale gate', () => {
  test('local disk is the storage driver until BIC-105', () => {
    expect(mediaStorage.storageDriver()).toBe('local');
    [
      'hostelDir',
      'toPublicPath',
      'absoluteFromPublic',
      'removePublic',
      'writeThumbnail',
      'writePanoPreview',
      'compressListingPhoto',
      'publicAssetUrl',
      'cacheControlForFile',
      'storageDriver',
    ].forEach((name) => {
      expect(typeof mediaStorage[name]).toBe('function');
    });
  });

  test('CDN seam prefixes listing paths; KYC is never a public cache', () => {
    const prev = process.env.MEDIA_PUBLIC_BASE_URL;
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://cdn.example.com';
    expect(mediaStorage.publicAssetUrl('/uploads/media/1/a.jpg')).toBe(
      'https://cdn.example.com/uploads/media/1/a.jpg',
    );
    if (prev == null) delete process.env.MEDIA_PUBLIC_BASE_URL;
    else process.env.MEDIA_PUBLIC_BASE_URL = prev;

    expect(mediaStorage.cacheControlForFile('/uploads/media/1/a_thumb.jpg')).toMatch(/^public,/);
    expect(mediaStorage.cacheControlForFile('/uploads/tenants/aadhar.jpg')).toBe('private, no-store');
    expect(mediaStorage.cacheControlForFile('/uploads/vita-eye/still.jpg')).toBe('private, no-store');
    expect(isPrivateUploadPath('/uploads/tenants/x.jpg')).toBe(true);
    expect(signPrivateUrl('/uploads/tenants/x.jpg')).toMatch(/[?&]sig=/);
  });

  test('PWA is the phone app; there is no native Android/iOS tree; one API', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(front, 'public/manifest.webmanifest'), 'utf8'));
    expect(manifest.start_url).toBe('/search');
    expect(manifest.display).toBe('standalone');
    const sw = fs.readFileSync(path.join(front, 'public/sw.js'), 'utf8');
    expect(sw).toMatch(/shouldBypass/);
    expect(sw).toMatch(/\/api/);
    expect(fs.existsSync(path.join(repo, 'android'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'ios'))).toBe(false);
    expect(fs.existsSync(path.join(front, 'android'))).toBe(false);
    const appJs = fs.readFileSync(path.join(repo, 'vitastay_new_back/app.js'), 'utf8');
    expect(appJs).toMatch(/app\.use\('\/api\/public\/listings'/);
  });

  test('migration plan records when to move and that Android is later', () => {
    expect(plan).toMatch(/DEC-07/);
    expect(plan).toMatch(/BIC-105/);
    expect(plan).toMatch(/second API/);
    expect(plan).toMatch(/Dual-read/);
    expect(plan).toMatch(/One API/);
    expect(plan).toMatch(/BIC-088/);
    expect(plan).not.toMatch(/commission withhold/i);
  });
});
