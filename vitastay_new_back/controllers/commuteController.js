const { success, error } = require('../utils/response');
const commuteService = require('../services/commuteService');

exports.times = async (req, res, next) => {
  try {
    let origin = req.body?.origin;
    if (req.body?.use_saved_office) {
      if (!req.user?.id) return error(res, 'Sign in as a seeker to use your saved office', 401);
      origin = await commuteService.officeAsOrigin(req.user.id);
    }
    if (origin == null || origin === '') {
      return error(res, 'origin (address) or use_saved_office is required', 422);
    }
    const hostelIds = req.body?.hostel_ids || req.body?.hostelIds || [];
    const data = await commuteService.commuteTimes({
      origin,
      hostel_ids: hostelIds,
      mode: req.body?.mode,
    });
    return success(res, data);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.getOffice = async (req, res, next) => {
  try {
    const data = await commuteService.getSavedOffice(req.user.id);
    return success(res, { office: data, configured: commuteService.isConfigured() });
  } catch (err) {
    next(err);
  }
};

exports.saveOffice = async (req, res, next) => {
  try {
    const office = await commuteService.saveOffice(req.user.id, req.body || {});
    return success(res, { office }, 'Saved as my office');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.clearOffice = async (req, res, next) => {
  try {
    const data = await commuteService.clearOffice(req.user.id);
    return success(res, data, data.removed ? 'Office cleared' : 'No saved office');
  } catch (err) {
    next(err);
  }
};

exports.status = async (req, res) => {
  return success(res, { configured: commuteService.isConfigured() });
};
