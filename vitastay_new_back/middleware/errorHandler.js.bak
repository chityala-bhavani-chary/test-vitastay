const logger = require('../config/logger');
const { error } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  if (err.name === 'SequelizeValidationError') {
    return error(res, 'Validation error', 422, err.errors.map((e) => ({ field: e.path, message: e.message })));
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return error(res, 'Duplicate entry', 409, err.errors.map((e) => ({ field: e.path, message: e.message })));
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return error(res, 'Referenced record not found', 400);
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message;

  return error(res, message, statusCode);
};

const notFound = (req, res) => {
  return error(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = { errorHandler, notFound };
