/**
 * POST /api/bookings — seeker booking request (BKG-006).
 * Does not call bookBed and does not occupy a bed.
 */
const { success, created, error } = require('../utils/response');
const bookingService = require('../services/bookingService');

const send = async (res, next, work, createdRow = false) => {
  try {
    const data = await work();
    return createdRow ? created(res, data, 'Booking requested') : success(res, data);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

const create = (req, res, next) => send(
  res,
  next,
  () => bookingService.createBooking({ user: req.user, body: req.body || {}, req }),
  true
);

const listMine = (req, res, next) => send(
  res,
  next,
  () => bookingService.listInbox(req.user, req.query || {})
);

const getById = (req, res, next) => send(
  res,
  next,
  () => bookingService.getBooking({ user: req.user, id: req.params.id })
);

const cancel = (req, res, next) => send(
  res,
  next,
  () => bookingService.cancelBooking({
    user: req.user,
    id: req.params.id,
    reason: req.body?.reason,
    req,
  })
);

const confirm = (req, res, next) => send(
  res,
  next,
  () => bookingService.confirmBooking({ user: req.user, id: req.params.id, req })
);

const reject = (req, res, next) => send(
  res,
  next,
  () => bookingService.rejectBooking({
    user: req.user,
    id: req.params.id,
    reason: req.body?.reason,
    req,
  })
);

module.exports = { create, listMine, getById, cancel, confirm, reject };
