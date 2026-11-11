const { verifyAccessToken } = require('../helpers/token');
const { User } = require('../models');
const { error } = require('../utils/response');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return error(res, 'Access token required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user || !user.is_active) {
      return error(res, 'User not found or inactive', 401);
    }

    if (user.is_locked) {
      return error(res, 'Account is locked. Contact administrator.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired', 401);
    }
    return error(res, 'Invalid token', 401);
  }
};

module.exports = authenticate;
