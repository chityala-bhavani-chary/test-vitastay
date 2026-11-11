/**
 * POST /api/hostels/:hostelId/listing/publish|unpublish
 * Roles: owner, super_admin (supervisor 403)
 */
const { success, error } = require('../utils/response');
const listingPublish = require('../services/listingPublish');

const send = async (res, next, work) => {
  try {
    const result = await work();
    return success(res, result.checklist, result.message);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode, err.errors);
    next(err);
  }
};

const publish = (req, res, next) => send(res, next, () => (
  listingPublish.publishListing({ hostel: req.hostel, user: req.user, req })
));

const unpublish = (req, res, next) => send(res, next, () => (
  listingPublish.unpublishListing({
    hostel: req.hostel,
    user: req.user,
    req,
    reason: req.body?.reason,
    trigger: 'owner',
    clearOverride: true,
  })
));

const moderateUnpublish = (req, res, next) => send(res, next, async () => {
  const { Hostel } = require('../models');
  const hostel = await Hostel.findByPk(req.params.id);
  if (!hostel) {
    const err = new Error('Hostel not found');
    err.statusCode = 404;
    throw err;
  }
  return listingPublish.moderateUnpublishListing({
    hostel,
    user: req.user,
    req,
    reason: req.body?.reason,
  });
});

module.exports = { publish, unpublish, moderateUnpublish };
