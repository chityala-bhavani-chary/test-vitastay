const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const {
  compressListingPhoto,
  writePanoPreview,
  writeThumbnail,
  isEquirectangular,
  cacheControlForFile,
  publicAssetUrl,
  LISTING_MAX_EDGE,
  THUMB_MAX_EDGE,
  THUMB_CACHE_SECONDS,
  ORIGINAL_CACHE_SECONDS,
} = require('../services/mediaStorage');

describe('listing photo compress', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-media-'));

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('downsizes a wide facade so the building stays under the listing max edge', async () => {
    const file = path.join(dir, 'facade.jpg');
    await sharp({
      create: { width: 3200, height: 1800, channels: 3, background: { r: 70, g: 110, b: 160 } },
    }).jpeg({ quality: 95 }).toFile(file);

    const result = await compressListingPhoto(file, 'image/jpeg');
    expect(result.compressed).toBe(true);
    expect(result.width).toBeLessThanOrEqual(LISTING_MAX_EDGE);
    expect(result.height).toBeLessThanOrEqual(LISTING_MAX_EDGE);
    expect(result.width).toBeGreaterThan(1200);
  });

  test('360 preview is a 2:1 still and does not rewrite the original', async () => {
    const file = path.join(dir, 'pano.jpg');
    await sharp({
      create: { width: 1600, height: 800, channels: 3, background: { r: 30, g: 80, b: 120 } },
    }).jpeg({ quality: 90 }).toFile(file);
    const before = fs.statSync(file).size;
    const preview = await writePanoPreview(file);
    expect(preview.width).toBe(1600);
    expect(preview.height).toBe(800);
    expect(isEquirectangular(preview.width, preview.height)).toBe(true);
    expect(fs.statSync(file).size).toBe(before);
    const thumbAbs = path.join(dir, 'pano_thumb.jpg');
    expect(fs.existsSync(thumbAbs)).toBe(true);
    const meta = await sharp(thumbAbs).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(400);
  });

  test('writeThumbnail is ~400px on the long edge', async () => {
    const file = path.join(dir, 'wide.jpg');
    await sharp({
      create: { width: 1600, height: 900, channels: 3, background: { r: 40, g: 90, b: 70 } },
    }).jpeg({ quality: 90 }).toFile(file);
    const thumb = await writeThumbnail(file);
    expect(thumb.thumbPath).toMatch(/wide_thumb\.jpg$/);
    const meta = await sharp(path.join(dir, 'wide_thumb.jpg')).metadata();
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(THUMB_MAX_EDGE);
    expect(Math.max(meta.width, meta.height)).toBeGreaterThan(200);
  });
});

describe('media cache and CDN seam', () => {
  test('thumbs cache a day; listing originals five minutes; KYC is private', () => {
    expect(cacheControlForFile('/uploads/media/1/abc_thumb.jpg')).toBe(`public, max-age=${THUMB_CACHE_SECONDS}`);
    expect(cacheControlForFile('/uploads/hostels/old_thumb.png')).toBe(`public, max-age=${THUMB_CACHE_SECONDS}`);
    expect(cacheControlForFile('/uploads/media/1/abc.jpg')).toBe(`public, max-age=${ORIGINAL_CACHE_SECONDS}`);
    expect(cacheControlForFile('/uploads/tenants/aadhar.jpg')).toBe('private, no-store');
  });

  test('publicAssetUrl stays relative until MEDIA_PUBLIC_BASE_URL is set', () => {
    const prev = process.env.MEDIA_PUBLIC_BASE_URL;
    delete process.env.MEDIA_PUBLIC_BASE_URL;
    expect(publicAssetUrl('/uploads/media/1/a.jpg')).toBe('/uploads/media/1/a.jpg');
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://cdn.example.com/';
    expect(publicAssetUrl('/uploads/media/1/a.jpg')).toBe('https://cdn.example.com/uploads/media/1/a.jpg');
    expect(publicAssetUrl('https://cdn.example.com/uploads/media/1/a.jpg')).toBe(
      'https://cdn.example.com/uploads/media/1/a.jpg',
    );
    if (prev == null) delete process.env.MEDIA_PUBLIC_BASE_URL;
    else process.env.MEDIA_PUBLIC_BASE_URL = prev;
  });
});
