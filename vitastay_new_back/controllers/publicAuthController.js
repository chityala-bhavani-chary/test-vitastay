const publicAuth = require('../services/publicAuth');
const { success, created } = require('../utils/response');
const { setAccessCookie } = require('../services/uploadAccess');

exports.requestOtp = async (req, res, next) => {
  try {
    const result = await publicAuth.requestRegisterOtp(req.body);
    return success(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    const result = await publicAuth.registerSeeker({ ...req.body, req });
    setAccessCookie(res, result.accessToken);
    return created(res, result, 'Account created');
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await publicAuth.loginSeeker({ ...req.body, req });
    setAccessCookie(res, result.accessToken);
    return success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};
