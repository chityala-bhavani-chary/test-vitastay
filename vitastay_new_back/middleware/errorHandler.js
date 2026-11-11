const logger = require('../config/logger');
const { error } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error('[ERR]', req.method, req.originalUrl, err);
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

  if (
    err.name === 'SequelizeConnectionError'
    || err.name === 'SequelizeConnectionRefusedError'
    || err.name === 'SequelizeHostNotFoundError'
    || err.name === 'SequelizeConnectionTimedOutError'
  ) {
    return error(res, 'Database is reconnecting. Please retry.', 503);
  }

  if (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE') {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.statusCode || 400);
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? (err.message && !/^File too large$/i.test(err.message)
        ? err.message
        : 'File is too big. Photos max 10 MB; 360° max 25 MB.')
      : err.message;
    return error(res, message, statusCode);
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
