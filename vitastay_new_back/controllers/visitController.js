const { success, error } = require('../utils/response');
const visitService = require('../services/visitService');

exports.listOwnerSlots = async (req, res, next) => {
  try {
    const data = await visitService.listOwnerSlots(req.user, req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.createSlot = async (req, res, next) => {
  try {
    const data = await visitService.createSlot(req.user, req.params.id, req.body || {});
    return success(res, data, 'Visit slot created');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.cancelSlot = async (req, res, next) => {
  try {
    const data = await visitService.cancelSlot(req.user, req.params.id, req.params.slotId);
    return success(res, data, 'Slot cancelled');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.listOwnerVisits = async (req, res, next) => {
  try {
    const data = await visitService.listOwnerVisits(req.user, req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.updateVisit = async (req, res, next) => {
  try {
    const data = await visitService.updateVisitStatus(
      req.user,
      req.params.id,
      req.params.visitId,
      req.body || {}
    );
    return success(res, data, 'Visit updated');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.listPublicSlots = async (req, res, next) => {
  try {
    const data = await visitService.listPublicSlots(req.params.idOrSlug);
    res.set('Cache-Control', 'public, max-age=30');
    return success(res, data);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.listMine = async (req, res, next) => {
  try {
    const data = await visitService.listSeekerVisits(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.book = async (req, res, next) => {
  try {
    const data = await visitService.bookVisit(req.user.id, req.body || {});
    return success(res, data, 'Visit requested — no bed is held');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.cancelMine = async (req, res, next) => {
  try {
    const data = await visitService.cancelSeekerVisit(req.user.id, req.params.id);
    return success(res, data, 'Visit cancelled');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};
