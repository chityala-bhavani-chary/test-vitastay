const rateLimit = require('express-rate-limit');
const config = require('../config');

// A single SPA screen fires several API calls (lists, counts, filters), so the general limit only
// guards against abuse. CORS preflights are not real requests and must not use up the quota.
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  skip: (req) => req.method === 'OPTIONS'
    || config.nodeEnv === 'test'
    || String(req.originalUrl || '').startsWith('/api/payments/webhook')
    || (config.nodeEnv === 'development' && !config.rateLimit.enforceInDev),
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => config.nodeEnv === 'test',
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

module.exports = { apiLimiter, authLimiter };
