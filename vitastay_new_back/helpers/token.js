const jwt = require('jsonwebtoken');
const config = require('../config');

const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

const generateOtp = (length = 6) => {
  return Math.floor(Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1)).toString();
};

const generateReceiptNumber = (prefix = 'RCP') => {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${ymd}-${rand}`;
};

const generateInvoiceNumber = (prefix = 'INV') => {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${ymd}-${rand}`;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateOtp,
  generateReceiptNumber,
  generateInvoiceNumber,
};
