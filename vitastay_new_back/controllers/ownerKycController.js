/**
 * BIC-038 — owner KYC submit and Super Admin review.
 */
const { Hostel } = require('../models');
const { success, error } = require('../utils/response');
const ownerKyc = require('../services/ownerKyc');

const send = async (res, next, work) => {
  try {
    const result = await work();
    return success(res, result, result.message || 'Success');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

const loadOwned = async (req) => {
  const hostel = await Hostel.findByPk(req.params.id);
  if (!hostel) {
    const err = new Error('Hostel not found');
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === 'owner' && Number(hostel.owner_id) !== Number(req.user.id)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return hostel;
};

const get = (req, res, next) => send(res, next, async () => {
  const hostel = await loadOwned(req);
  const reveal = req.user.role === 'super_admin';
  return ownerKyc.statusPayload(hostel, { reveal });
});

const submit = (req, res, next) => send(res, next, async () => {
  const hostel = await loadOwned(req);
  return ownerKyc.submit({ hostel, user: req.user, body: req.body, file: req.file });
});

const verify = (req, res, next) => send(res, next, async () => {
  const hostel = await Hostel.findByPk(req.params.id);
  if (!hostel) {
    const err = new Error('Hostel not found');
    err.statusCode = 404;
    throw err;
  }
  return ownerKyc.verify({ hostel, user: req.user });
});

const reject = (req, res, next) => send(res, next, async () => {
  const hostel = await Hostel.findByPk(req.params.id);
  if (!hostel) {
    const err = new Error('Hostel not found');
    err.statusCode = 404;
    throw err;
  }
  return ownerKyc.reject({ hostel, reason: req.body?.reason });
});

module.exports = { get, submit, verify, reject };
