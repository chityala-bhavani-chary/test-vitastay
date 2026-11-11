/**
 * Disk storage for listing photos / 360° files.
 * Writes /uploads/media/{hostelId}/ now. This module is the driver contract (DEC-07).
 * Swap the body for S3-compatible + CDN in BIC-105 — before a second API node or
 * public 360 ads. Callers must keep path-shaped /uploads/media/… values in the DB.
 * See docs/18-object-storage-migration.md.
 */
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PANO_MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const MEDIA_MAX_PER_HOSTEL = 200;
const MEDIA_MAX_PER_REQUEST = 40;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4']);
const VIDEO_MIME = new Set(['video/mp4']);
const VIDEO_EXT = new Set(['.mp4']);
const INVALID_TYPE_MESSAGE = 'Invalid file type. Use JPEG, PNG, WebP, or MP4 for walkthrough video. GIF and HEIC are not allowed.';
const MULTER_TOO_LARGE_MESSAGE = 'File is too big. Photos max 10 MB; 360° max 25 MB; walkthrough video max 50 MB.';

const tooLargeMessage = (kind) => {
  if (kind === 'panorama_360' || kind === true) return '360° file is too big. Maximum is 25 MB.';
  if (kind === 'video' || kind === 'walkthrough_video') return 'Walkthrough video is too big. Maximum is 50 MB.';
  return 'Photo is too big. Maximum is 10 MB.';
};

const toPublicPath = (absolutePath) => {
  const rel = path.relative(uploadsRoot, absolutePath).replace(/\\/g, '/');
  return `/uploads/${rel}`;
};

const absoluteFromPublic = (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string' || !publicPath.startsWith('/uploads/')) return null;
  const abs = path.resolve(uploadsRoot, publicPath.replace(/^\/uploads\//, ''));
  if (!abs.startsWith(uploadsRoot)) return null;
  return abs;
};

const removeAbs = (absPath) => {
  if (!absPath) return;
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(uploadsRoot)) return;
  fs.unlink(resolved, () => {});
};

const removePublic = (publicPath) => {
  removeAbs(absoluteFromPublic(publicPath));
};

const hostelDir = (hostelId) => path.join(uploadsRoot, 'media', String(hostelId));

const LISTING_MAX_EDGE = 2560;
const LISTING_JPEG_QUALITY = 82;
const THUMB_MAX_EDGE = 400;
const THUMB_CACHE_SECONDS = 86400;
const ORIGINAL_CACHE_SECONDS = 300;
const EQUIRECT_MIN = 1.8;
const EQUIRECT_MAX = 2.2;

const isThumbFile = (filePath) => /_thumb\.(jpe?g|png|webp)$/i.test(String(filePath || ''));

const isListingMediaFile = (filePath) => {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  return /\/uploads\/(media|hostels|rooms)\//i.test(normalized) || /\/media\/\d+\//i.test(normalized);
};

/**
 * Thumbs: long public cache. Listing originals (including 360): short public cache.
 * Everything else (KYC, bills) must not be CDN-cached.
 */
const cacheControlForFile = (filePath) => {
  if (isThumbFile(filePath) && isListingMediaFile(filePath)) {
    return `public, max-age=${THUMB_CACHE_SECONDS}`;
  }
  if (isListingMediaFile(filePath)) {
    return `public, max-age=${ORIGINAL_CACHE_SECONDS}`;
  }
  return 'private, no-store';
};

/**
 * v1 returns the stored /uploads/... path. Set MEDIA_PUBLIC_BASE_URL to a CDN origin later.
 */
const publicAssetUrl = (publicPath) => {
  if (!publicPath) return publicPath;
  if (/^(https?:|blob:|data:)/i.test(publicPath)) return publicPath;
  const base = String(process.env.MEDIA_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return publicPath;
  return `${base}${publicPath.startsWith('/') ? publicPath : `/${publicPath}`}`;
};

const isEquirectangular = (width, height) => {
  if (!width || !height) return null;
  const ratio = Number(width) / Number(height);
  if (!Number.isFinite(ratio)) return null;
  return ratio >= EQUIRECT_MIN && ratio <= EQUIRECT_MAX;
};

/**
 * Shrink listing stills (not 360°) so upload stays light without blurring the building face.
 * Never upscales. Skips rewrite when the compressed file is not smaller.
 */
const compressListingPhoto = async (filePathAbs, mimeType) => {
  const fallback = { width: null, height: null, size: null, compressed: false };
  if (!sharp || !filePathAbs) return fallback;
  try {
    const meta = await sharp(filePathAbs).rotate().metadata();
    const tooWide = (meta.width || 0) > LISTING_MAX_EDGE || (meta.height || 0) > LISTING_MAX_EDGE;
    const tmp = `${filePathAbs}.cmp`;
    let pipeline = sharp(filePathAbs).rotate();
    if (tooWide) {
      pipeline = pipeline.resize({
        width: LISTING_MAX_EDGE,
        height: LISTING_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    const mime = String(mimeType || '').toLowerCase();
    const lower = filePathAbs.toLowerCase();
    if (mime.includes('png') || lower.endsWith('.png')) {
      await pipeline.png({ compressionLevel: 8 }).toFile(tmp);
    } else if (mime.includes('webp') || lower.endsWith('.webp')) {
      await pipeline.webp({ quality: LISTING_JPEG_QUALITY }).toFile(tmp);
    } else {
      await pipeline.jpeg({ quality: LISTING_JPEG_QUALITY }).toFile(tmp);
    }
    const nextSize = fs.statSync(tmp).size;
    const prevSize = fs.statSync(filePathAbs).size;
    if (tooWide || nextSize < prevSize) {
      fs.renameSync(tmp, filePathAbs);
    } else {
      fs.unlinkSync(tmp);
    }
    const after = await sharp(filePathAbs).metadata();
    return {
      width: after.width || meta.width || null,
      height: after.height || meta.height || null,
      size: fs.statSync(filePathAbs).size,
      compressed: true,
    };
  } catch (err) {
    logger.warn(`Listing photo compress failed for ${filePathAbs}: ${err.message}`);
    return fallback;
  }
};

/**
 * ~400px thumbnail next to the original. Falls back to the original URL if sharp is missing.
 */
const writeThumbnail = async (filePathAbs) => {
  const parsed = path.parse(filePathAbs);
  const thumbAbs = path.join(parsed.dir, `${parsed.name}_thumb${parsed.ext}`);
  if (sharp) {
    try {
      const meta = await sharp(filePathAbs).metadata();
      await sharp(filePathAbs)
        .rotate()
        .resize({ width: THUMB_MAX_EDGE, height: THUMB_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .toFile(thumbAbs);
      return {
        thumbPath: toPublicPath(thumbAbs),
        width: meta.width || null,
        height: meta.height || null,
      };
    } catch (err) {
      logger.warn(`Thumbnail failed for ${filePathAbs}: ${err.message}`);
    }
  }
  return { thumbPath: toPublicPath(filePathAbs), width: null, height: null };
};

/**
 * Flat 2:1 still for the 360 tile (equator crop). The original file stays equirectangular.
 */
/**
 * Optional first-frame JPEG via ffmpeg when installed. Transcode deferred (BIC-035).
 */
const writeVideoThumbnail = async (filePathAbs) => {
  const parsed = path.parse(filePathAbs);
  const thumbAbs = path.join(parsed.dir, `${parsed.name}_thumb.jpg`);
  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync(
      'ffmpeg',
      ['-y', '-ss', '1', '-i', filePathAbs, '-frames:v', '1', '-q:v', '4', thumbAbs],
      { encoding: 'utf8', timeout: 20000 }
    );
    if (result.status === 0 && fs.existsSync(thumbAbs)) {
      return { thumbPath: toPublicPath(thumbAbs), width: null, height: null };
    }
  } catch (err) {
    logger.warn(`Video thumbnail skipped: ${err.message}`);
  }
  return { thumbPath: null, width: null, height: null };
};

const writePanoPreview = async (filePathAbs) => {
  const parsed = path.parse(filePathAbs);
  const thumbAbs = path.join(parsed.dir, `${parsed.name}_thumb.jpg`);
  if (sharp) {
    try {
      const meta = await sharp(filePathAbs).metadata();
      await sharp(filePathAbs)
        .rotate()
        .resize({ width: 800, height: 400, fit: 'cover' })
        .jpeg({ quality: 78 })
        .toFile(thumbAbs);
      return {
        thumbPath: toPublicPath(thumbAbs),
        width: meta.width || null,
        height: meta.height || null,
      };
    } catch (err) {
      logger.warn(`360 preview failed for ${filePathAbs}: ${err.message}`);
    }
  }
  return writeThumbnail(filePathAbs);
};

const storageDriver = () => 'local';

module.exports = {
  PHOTO_MAX_BYTES,
  PANO_MAX_BYTES,
  VIDEO_MAX_BYTES,
  MEDIA_MAX_PER_HOSTEL,
  MEDIA_MAX_PER_REQUEST,
  ALLOWED_MIME,
  ALLOWED_EXT,
  VIDEO_MIME,
  VIDEO_EXT,
  INVALID_TYPE_MESSAGE,
  MULTER_TOO_LARGE_MESSAGE,
  tooLargeMessage,
  uploadsRoot,
  toPublicPath,
  absoluteFromPublic,
  removeAbs,
  removePublic,
  hostelDir,
  writeThumbnail,
  writePanoPreview,
  writeVideoThumbnail,
  compressListingPhoto,
  isEquirectangular,
  isThumbFile,
  isListingMediaFile,
  cacheControlForFile,
  publicAssetUrl,
  storageDriver,
  LISTING_MAX_EDGE,
  THUMB_MAX_EDGE,
  THUMB_CACHE_SECONDS,
  ORIGINAL_CACHE_SECONDS,
};
