const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const {
  PANO_MAX_BYTES,
  VIDEO_MAX_BYTES,
  MEDIA_MAX_PER_REQUEST,
  ALLOWED_MIME,
  ALLOWED_EXT,
  INVALID_TYPE_MESSAGE,
  MULTER_TOO_LARGE_MESSAGE,
  hostelDir,
} = require('../services/mediaStorage');

const UPLOAD_MAX_BYTES = Math.max(PANO_MAX_BYTES, VIDEO_MAX_BYTES);

const invalidTypeError = () => {
  const err = new Error(INVALID_TYPE_MESSAGE);
  err.statusCode = 400;
  return err;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const hostelId = req.params.hostelId || req.hostel?.id;
    const dir = hostelDir(hostelId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  if (ALLOWED_EXT.has(ext) && ALLOWED_MIME.has(mime)) return cb(null, true);
  cb(invalidTypeError());
};

// Multer ceiling = largest allowed media; per-type caps enforced in the controller.
const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_BYTES, files: MEDIA_MAX_PER_REQUEST },
  fileFilter,
});

const parseFiles = (req, res, next) => {
  upload.array('files', MEDIA_MAX_PER_REQUEST)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.statusCode = 413;
      err.message = MULTER_TOO_LARGE_MESSAGE;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      err.statusCode = 422;
      err.message = `Upload at most ${MEDIA_MAX_PER_REQUEST} files at once`;
    }
    next(err);
  });
};

module.exports = { parseFiles };
