/**
 * Client-side storage errors for the Media Manager dropzone.
 * Match API copy so owners see the same reason before and after POST.
 */
export const LISTING_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PANO_MAX_BYTES = 25 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
const VIDEO_TYPES = new Set(['video/mp4']);
const VIDEO_EXT = new Set(['mp4']);

const fileName = (file) => file?.name || 'That file';

const extOf = (file) => {
  const name = String(file?.name || '');
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
};

export const storageErrorForFile = (file, { panorama = false, video = false } = {}) => {
  if (!file) return video ? 'Choose an MP4 walkthrough.' : 'Choose a photo.';
  const type = String(file.type || '').toLowerCase();
  const ext = extOf(file);
  if (video) {
    const typeOk = VIDEO_TYPES.has(type) || VIDEO_EXT.has(ext);
    if (!typeOk) {
      return `${fileName(file)} must be an MP4 walkthrough video.`;
    }
    if (file.size > VIDEO_MAX_BYTES) {
      return `${fileName(file)} is too big. Walkthrough videos must be 50 MB or smaller.`;
    }
    return null;
  }
  const typeOk = ALLOWED_TYPES.has(type) || ALLOWED_EXT.has(ext);
  if (!typeOk || ext === 'gif' || ext === 'heic' || ext === 'heif' || ext === 'exe' || ext === 'mp4') {
    return `${fileName(file)} is the wrong type. Use JPEG, PNG, or WebP — not GIF or HEIC.`;
  }
  const max = panorama ? PANO_MAX_BYTES : LISTING_PHOTO_MAX_BYTES;
  if (file.size > max) {
    return panorama
      ? `${fileName(file)} is too big. 360° files must be 25 MB or smaller.`
      : `${fileName(file)} is too big. Photos must be 10 MB or smaller.`;
  }
  return null;
};

export const storageErrorForFiles = (files, { panorama = false, video = false } = {}) => {
  const list = [...(files || [])];
  for (const file of list) {
    const message = storageErrorForFile(file, { panorama, video });
    if (message) return message;
  }
  return null;
};
