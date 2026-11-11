const { success, error } = require('../utils/response');
const waitlistService = require('../services/waitlistService');

exports.list = async (req, res, next) => {
  try {
    const data = await waitlistService.listForUser(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.join = async (req, res, next) => {
  try {
    const data = await waitlistService.join(req.user.id, req.body || {});
    return success(res, data, 'We will notify you when a bed opens');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.leave = async (req, res, next) => {
  try {
    const body = {
      id: req.params.id || req.body?.id,
      hostel_id: req.body?.hostel_id,
      code: req.body?.code,
      room_type: req.body?.room_type || req.params.roomType,
    };
    const data = await waitlistService.leave(req.user.id, body);
    return success(res, data, 'Waitlist removed');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.statusForListing = async (req, res, next) => {
  try {
    const hostelId = Number(req.params.hostelId);
    if (!Number.isInteger(hostelId) || hostelId <= 0) {
      return error(res, 'hostelId required', 422);
    }
    const data = await waitlistService.statusForListing(req.user.id, hostelId);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};
