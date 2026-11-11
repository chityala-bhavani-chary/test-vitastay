const { success, error } = require('../utils/response');
const { recordPublicEvent, summarize } = require('../services/listingAnalytics');

exports.ingestPublic = async (req, res, next) => {
  try {
    const result = await recordPublicEvent({
      idOrSlug: req.params.idOrSlug,
      event: req.body?.event,
      tab: req.body?.tab,
      mediaId: req.body?.media_id,
      sessionId: req.body?.session_id,
    });
    return success(res, result, result.recorded ? 'Recorded' : 'Already counted');
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404);
    if (err.statusCode === 422) return error(res, err.message, 422);
    next(err);
  }
};

exports.dashboard = async (req, res, next) => {
  try {
    const data = await summarize({
      user: req.user,
      hostelId: req.query.hostel_id || req.query.hostelId,
      from: req.query.from,
      to: req.query.to,
    });
    return success(res, data);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};
