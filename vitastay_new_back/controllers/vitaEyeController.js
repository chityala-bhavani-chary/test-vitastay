/**
 * PKG-010 enrol + PKG-011 capture / watchlist / events + PKG-012 privacy + PKG-014 playbook.
 * Gold-only via route middleware.
 */
const multer = require('multer');
const { success, error } = require('../utils/response');
const { entitlementsOf } = require('../services/ownerPlan');
const enroll = require('../services/vitaEyeEnroll');
const match = require('../services/vitaEyeMatch');
const privacy = require('../services/vitaEyePrivacy');
const support = require('../services/vitaEyeSupport');

const fail = (res, err, next) => {
  if (err.statusCode) return error(res, err.message, err.statusCode, err.errors);
  return next(err);
};

const parseStill = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return cb(null, true);
    const err = new Error('Vita Eye v1 accepts a still JPEG, PNG, or WebP');
    err.statusCode = 422;
    cb(err);
  },
}).single('still');

exports.parseStill = (req, res, next) => {
  parseStill(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.statusCode = 413;
      err.message = 'Still must be 10 MB or smaller';
    }
    return fail(res, err, next);
  });
};

exports.status = async (req, res, next) => {
  try {
    const flags = entitlementsOf(req.hostel);
    const data = await enroll.statusPayload(req.hostel, flags);
    return success(res, data, 'Vita Eye gallery');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.playbook = async (req, res, next) => {
  try {
    const data = await support.playbookOf(req.hostel);
    return success(res, data, 'Vita Eye playbook');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.listEnrollments = async (req, res, next) => {
  try {
    const rows = await enroll.listEnrollments(req.hostel);
    return success(res, { enrollments: rows });
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.enroll = async (req, res, next) => {
  try {
    const data = await enroll.enrollPerson({
      hostel: req.hostel,
      user: req.user,
      body: req.body,
      file: req.file,
      req,
    });
    return success(res, data, 'Face enrolled');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.revoke = async (req, res, next) => {
  try {
    const data = await enroll.revokeEnrollment({
      hostel: req.hostel,
      user: req.user,
      enrollmentId: req.params.enrollmentId,
      req,
    });
    return success(res, data, 'Enrolment removed');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.capture = async (req, res, next) => {
  try {
    const data = await match.captureStill({
      hostel: req.hostel,
      user: req.user,
      body: req.body,
      file: req.file,
      req,
    });
    return success(res, data, data.label_text || 'Captured');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.events = async (req, res, next) => {
  try {
    const events = await match.listEvents(req.hostel);
    return success(res, { events, door_lock: false });
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.ack = async (req, res, next) => {
  try {
    const data = await match.ackEvent({
      hostel: req.hostel,
      user: req.user,
      eventId: req.params.eventId,
      body: req.body,
      req,
    });
    return success(res, data, 'Marked not a match');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.watchlist = async (req, res, next) => {
  try {
    const watchlist = await match.listWatchlist(req.hostel);
    return success(res, { watchlist });
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.addWatchlist = async (req, res, next) => {
  try {
    const data = await match.addWatchlist({
      hostel: req.hostel,
      user: req.user,
      body: req.body,
      file: req.file,
      req,
    });
    return success(res, data, 'Added to blocked list');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.removeWatchlist = async (req, res, next) => {
  try {
    const data = await match.removeWatchlist({
      hostel: req.hostel,
      user: req.user,
      watchlistId: req.params.watchlistId,
      req,
    });
    return success(res, data, 'Removed from blocked list');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.exportRecords = async (req, res, next) => {
  try {
    const data = await privacy.exportHostel({
      hostel: req.hostel,
      user: req.user,
      req,
    });
    return success(res, data, 'Vita Eye export');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.erase = async (req, res, next) => {
  try {
    const data = await privacy.eraseHostel({
      hostel: req.hostel,
      user: req.user,
      body: req.body,
      req,
    });
    return success(res, data, 'Vita Eye records erased for this PG');
  } catch (err) {
    return fail(res, err, next);
  }
};
