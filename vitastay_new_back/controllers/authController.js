const authService = require('../services/authService');
const { success, error } = require('../utils/response');
const { setAccessCookie, clearAccessCookie } = require('../services/uploadAccess');

exports.login = async (req, res, next) => {
  try {
    const result = await authService.login({ ...req.body, req });
    setAccessCookie(res, result.accessToken);
    return success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return error(res, 'Refresh token required', 400);
    const result = await authService.refreshAccessToken(refreshToken, req);
    setAccessCookie(res, result.accessToken);
    return success(res, result, 'Token refreshed');
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken, req.user.id);
    clearAccessCookie(res);
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const result = await authService.changePassword(req.user.id, req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await authService.getUserProfile(req.user);
    return success(res, profile);
  } catch (err) {
    next(err);
  }
};

exports.getLoginHistory = async (req, res, next) => {
  try {
    const { LoginHistory } = require('../models');
    const { getPagination } = require('../utils/pagination');
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await LoginHistory.findAndCountAll({
      where: { user_id: req.user.id },
      order: [['login_at', 'DESC']],
      limit,
      offset,
    });
    const { paginated } = require('../utils/response');
    return paginated(res, rows, { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const profile = await authService.updateProfile(req.user.id, req.body);
    return success(res, profile, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'Image file is required', 400);
    if (!req.file.mimetype?.startsWith('image/')) {
      return error(res, 'Only image files are allowed', 400);
    }
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const profile = await authService.updateAvatar(req.user.id, avatarPath);
    return success(res, profile, 'Avatar updated successfully');
  } catch (err) {
    next(err);
  }
};
