const dashboardService = require('../services/dashboardService');
const { success } = require('../utils/response');

exports.getOwnerDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getOwnerDashboard(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.getSupervisorDashboard = async (req, res, next) => {
  try {
    const hostelId = req.query.hostelId || req.params.hostelId;
    const data = await dashboardService.getSupervisorDashboard(req.user.id, hostelId);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.getTenantDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getTenantDashboard(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.getStaffDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getStaffDashboard(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};
