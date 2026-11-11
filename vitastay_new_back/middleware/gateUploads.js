/**
 * Fail closed: guests do not get KYC or unpublished listing files by guessing URLs.
 */
const { error } = require('../utils/response');
const {
  uploadPathname,
  isPrivateUploadPath,
  isListingUploadPath,
  hasValidSignature,
  optionalUser,
  canReadPrivateFile,
  canReadListingFile,
} = require('../services/uploadAccess');

const notFound = (res) => {
  res.set('Cache-Control', 'private, no-store');
  return error(res, 'Not found', 404);
};

const gateUploads = async (req, res, next) => {
  try {
    const publicPath = uploadPathname(req);
    if (!isPrivateUploadPath(publicPath) && !isListingUploadPath(publicPath)) {
      return next();
    }

    if (isPrivateUploadPath(publicPath)) {
      if (hasValidSignature(req, publicPath)) return next();
      const user = await optionalUser(req);
      if (await canReadPrivateFile(user, publicPath)) {
        res.set('Cache-Control', 'private, no-store');
        return next();
      }
      return notFound(res);
    }

    const user = await optionalUser(req);
    if (await canReadListingFile(user, publicPath)) return next();
    return notFound(res);
  } catch (err) {
    next(err);
  }
};

module.exports = { gateUploads };
