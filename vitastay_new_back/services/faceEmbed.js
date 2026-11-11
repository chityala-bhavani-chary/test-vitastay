/**
 * v1 still descriptor for Vita Eye. On-prem RGB vector — no third-party face API.
 * Cosine match is PKG-011. Not a commercial identity model.
 */
const sharp = require('sharp');

const SIZE = 16;
const CHANNELS = 3;

const embedStill = async (buffer) => {
  let pixels;
  try {
    pixels = await sharp(buffer)
      .rotate()
      .resize(SIZE, SIZE, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer();
  } catch {
    const err = new Error('Still must be a JPEG, PNG, or WebP photo');
    err.statusCode = 422;
    throw err;
  }
  const need = SIZE * SIZE * CHANNELS;
  if (!pixels || pixels.length < need) {
    const err = new Error('Still must be a JPEG, PNG, or WebP photo');
    err.statusCode = 422;
    throw err;
  }
  const vector = [];
  let sum = 0;
  for (let i = 0; i < need; i += 1) {
    const v = pixels[i] / 255;
    vector.push(Number(v.toFixed(6)));
    sum += v * v;
  }
  const norm = Math.sqrt(sum) || 1;
  return vector.map((v) => Number((v / norm).toFixed(6)));
};

const cosine = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Number(a[i] || 0) * Number(b[i] || 0);
  return sum;
};

const stillJpeg = async (buffer) => {
  try {
    return await sharp(buffer)
      .rotate()
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
  } catch {
    const err = new Error('Still must be a JPEG, PNG, or WebP photo');
    err.statusCode = 422;
    throw err;
  }
};

module.exports = { embedStill, stillJpeg, cosine, EMBED_SIZE: SIZE, EMBED_DIM: SIZE * SIZE * CHANNELS };
