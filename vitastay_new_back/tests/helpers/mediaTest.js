/**
 * Shared media QA helpers (MED-020): tiny 2:1 fixture, upload POST, disk cleanup.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { request, app, auth } = require('./http');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');
const PANO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'pano-2x1.jpg');
const PANO_WIDTH = 64;
const PANO_HEIGHT = 32;

const TEST_LEFTOVER_REL = [
  path.join('media', '_med018'),
  path.join('tenants', 'aadhar-secret.jpg'),
  path.join('tenants', 'med019-aadhar.jpg'),
];

const TEST_NAME_RE = /^(?:pub-|quota-|hidden-unpublished|orphan-gone|extra-del|med019-|aadhar-secret|_med018)/i;

const mediaUrl = (hostelId, suffix = '') => `/api/hostels/${hostelId}/media${suffix}`;

const pixel = async (format, width = 8, height = 8, background = { r: 40, g: 90, b: 160 }) => {
  const img = sharp({
    create: { width, height, channels: 3, background },
  });
  if (format === 'png') return img.png().toBuffer();
  if (format === 'webp') return img.webp().toBuffer();
  return img.jpeg().toBuffer();
};

const ensurePanoFixture = async () => {
  fs.mkdirSync(path.dirname(PANO_FIXTURE), { recursive: true });
  const missing = !fs.existsSync(PANO_FIXTURE);
  const tiny = !missing && fs.statSync(PANO_FIXTURE).size < 80;
  if (missing || tiny) {
    await sharp({
      create: {
        width: PANO_WIDTH,
        height: PANO_HEIGHT,
        channels: 3,
        background: { r: 18, g: 72, b: 118 },
      },
    }).jpeg({ quality: 70 }).toFile(PANO_FIXTURE);
  }
  return PANO_FIXTURE;
};

const loadPanoFixture = async () => {
  const file = await ensurePanoFixture();
  return fs.readFileSync(file);
};

const postMedia = (token, hostelId, fields, files) => {
  let req = request(app).post(mediaUrl(hostelId)).set(auth(token));
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) req = req.field(key, String(value));
  });
  files.forEach((file, i) => {
    req = req.attach('files', file.buffer, {
      filename: file.filename || `photo-${i}.jpg`,
      contentType: file.contentType || 'image/jpeg',
    });
  });
  return req;
};

const rmQuiet = (abs) => {
  try {
    fs.rmSync(abs, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 });
  } catch {
    // Windows can keep a handle on a just-written upload until process exit.
  }
};

const cleanupHostelMediaDirs = (hostelIds = []) => {
  hostelIds.filter(Boolean).forEach((id) => {
    rmQuiet(path.join(UPLOADS_ROOT, 'media', String(id)));
  });
};

const walkNamedTestFiles = (dir) => {
  if (!fs.existsSync(dir)) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.forEach((ent) => {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (TEST_NAME_RE.test(ent.name)) rmQuiet(abs);
      else walkNamedTestFiles(abs);
    } else if (TEST_NAME_RE.test(ent.name)) {
      rmQuiet(abs);
    }
  });
};

const cleanupNamedTestUploads = () => {
  TEST_LEFTOVER_REL.forEach((rel) => rmQuiet(path.join(UPLOADS_ROOT, rel)));
  walkNamedTestFiles(path.join(UPLOADS_ROOT, 'media'));
  walkNamedTestFiles(path.join(UPLOADS_ROOT, 'tenants'));
};

const cleanupTestUploads = (hostelIds = []) => {
  cleanupHostelMediaDirs(hostelIds);
  cleanupNamedTestUploads();
};

const loadFrontEsmAsCjs = (absPath) => {
  const { Module } = require('module');
  const exported = [];
  let src = fs.readFileSync(absPath, 'utf8');
  src = src.replace(/export\s+const\s+(\w+)/g, (_, name) => {
    exported.push(name);
    return `const ${name}`;
  });
  src += `\nmodule.exports = { ${exported.join(', ')} };\n`;
  const m = new Module(absPath);
  m.filename = absPath;
  m.paths = Module._nodeModulePaths(path.dirname(absPath));
  m._compile(src, absPath);
  return m.exports;
};

module.exports = {
  PANO_FIXTURE,
  PANO_WIDTH,
  PANO_HEIGHT,
  UPLOADS_ROOT,
  mediaUrl,
  pixel,
  ensurePanoFixture,
  loadPanoFixture,
  postMedia,
  cleanupHostelMediaDirs,
  cleanupNamedTestUploads,
  cleanupTestUploads,
  loadFrontEsmAsCjs,
};
