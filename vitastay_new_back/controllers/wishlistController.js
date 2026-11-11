const { success, error } = require('../utils/response');
const wishlistService = require('../services/wishlistService');

exports.list = async (req, res, next) => {
  try {
    const data = await wishlistService.listForUser(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.add = async (req, res, next) => {
  try {
    const idOrCode = req.body?.hostel_id || req.body?.code || req.params.idOrCode;
    if (!idOrCode) return error(res, 'hostel_id or code is required', 422);
    const data = await wishlistService.add(req.user.id, idOrCode);
    return success(res, data, 'Saved');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const data = await wishlistService.remove(req.user.id, req.params.idOrCode);
    return success(res, data, data.removed ? 'Removed from saved' : 'Not in saved');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};
