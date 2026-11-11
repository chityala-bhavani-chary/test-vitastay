/**
 * Client-side compress for listing stills. Max edge 2560px, JPEG ~0.84 —
 * enough to keep a building facade readable, small enough for 10 MB POST.
 */
const MAX_EDGE = 2560;
const QUALITY = 0.84;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export const LISTING_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PANO_MAX_BYTES = 25 * 1024 * 1024;
const EQUIRECT_MIN = 1.8;
const EQUIRECT_MAX = 2.2;

export const isNearEquirectangular = (width, height) => {
  if (!width || !height) return true;
  const ratio = Number(width) / Number(height);
  if (!Number.isFinite(ratio)) return true;
  return ratio >= EQUIRECT_MIN && ratio <= EQUIRECT_MAX;
};

const loadBitmap = async (file) => {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo'));
    };
    image.src = url;
  });
};

export const compressListingPhoto = async (file, { maxEdge = MAX_EDGE, quality = QUALITY } = {}) => {
  if (!file) throw new Error('Choose a photo');
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Use JPEG, PNG, or WebP. GIF and HEIC are not allowed.');
  }
  if (file.size > LISTING_PHOTO_MAX_BYTES) {
    throw new Error('Photo must be 10 MB or smaller.');
  }

  let bitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    return file;
  }

  const width = bitmap.width || 1;
  const height = bitmap.height || 1;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const nextW = Math.max(1, Math.round(width * scale));
  const nextH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = nextW;
  canvas.height = nextH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, nextW, nextH);
  if (bitmap.close) bitmap.close();

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
  if (!blob || blob.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
};

/**
 * 360 files stay original pixels (equirectangular). Warn, do not block, if aspect is not ~2:1.
 */
export const inspectPanoramaFile = async (file) => {
  if (!file) throw new Error('Choose a 360 photo');
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Use JPEG, PNG, or WebP. GIF and HEIC are not allowed.');
  }
  if (file.size > PANO_MAX_BYTES) {
    throw new Error('360° file must be 25 MB or smaller.');
  }

  let width = null;
  let height = null;
  try {
    const bitmap = await loadBitmap(file);
    width = bitmap.width || null;
    height = bitmap.height || null;
    if (bitmap.close) bitmap.close();
  } catch {
    // still upload; server stores the original
  }

  return {
    file,
    width,
    height,
    aspectOk: isNearEquirectangular(width, height),
  };
};

export const snapshotVideoFrame = async (video, { name = 'capture.jpg', quality = 0.9 } = {}) => {
  if (!video?.videoWidth) throw new Error('Camera is not ready yet');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not capture that frame');
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
};

/** Assemble phone stills into a 2:1 canvas the 360 viewer can load. */
export const stitchEquirectangular = async (files, { width = 4096, height = 2048 } = {}) => {
  if (!files?.length) throw new Error('Capture at least two angles');
  const bitmaps = [];
  for (const file of files) {
    bitmaps.push(await loadBitmap(file));
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const sliceW = width / bitmaps.length;
  bitmaps.forEach((bmp, i) => {
    const bw = bmp.width || 1;
    const bh = bmp.height || 1;
    const scale = Math.max(sliceW / bw, height / bh);
    const dw = bw * scale;
    const dh = bh * scale;
    ctx.drawImage(bmp, i * sliceW + (sliceW - dw) / 2, (height - dh) / 2, dw, dh);
    if (bmp.close) bmp.close();
  });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Could not build the 360 photo');
  return new File([blob], `pano-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
};
