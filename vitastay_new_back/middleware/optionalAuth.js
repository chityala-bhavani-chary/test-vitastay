/**
 * Attach req.user when a valid Bearer token is present. Never 401.
 * Used so owners can preview unpublished listings; guests still work without a token.
 */
const { verifyAccessToken } = require('../helpers/token');
const { User } = require('../models');

const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();
    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });
    if (user && user.is_active && !user.is_locked) req.user = user;
  } catch {
    // Invalid/expired token: treat as guest. Do not leak unpublished listings.
  }
  next();
};

module.exports = optionalAuth;
