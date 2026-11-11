/**
 * BIC-034 — listing description draft endpoints.
 * Never auto-publishes AI/template text onto hostels.description.
 */
const { success, error } = require('../utils/response');
const descriptionDraft = require('../services/descriptionDraft');

const send = async (res, next, work) => {
  try {
    const result = await work();
    return success(res, result, result.message || 'Success');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode, err.errors);
    next(err);
  }
};

const get = (req, res, next) => send(res, next, () => descriptionDraft.getDraft(req.hostel));

const generate = (req, res, next) => send(res, next, () => descriptionDraft.generateDraft(req.hostel));

const save = (req, res, next) => send(res, next, () => descriptionDraft.saveDraft(req.hostel, req.body));

const approve = (req, res, next) => send(res, next, () => descriptionDraft.approveDraft(req.hostel));

const discard = (req, res, next) => send(res, next, () => descriptionDraft.discardDraft(req.hostel));

module.exports = { get, generate, save, approve, discard };
