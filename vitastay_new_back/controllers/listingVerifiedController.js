/**
 * BIC-039 — Super Admin grants or revokes the Vita Stay verified badge.
 */
const { Hostel } = require('../models');
const { success, error } = require('../utils/response');
const listingVerified = require('../services/listingVerified');

const send = async (res, next, work) => {
  try {
    const result = await work();
    return success(res, result, result.message || 'Success');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode, err.errors);
    next(err);
  }
};

const load = async (id) => {
  const hostel = await Hostel.findByPk(id);
  if (!hostel) {
    const err = new Error('Hostel not found');
    err.statusCode = 404;
    throw err;
  }
  return hostel;
};

const criteria = (req, res, next) => send(res, next, async () => {
  const hostel = await load(req.params.id);
  return listingVerified.criteriaFor(hostel);
});

const grant = (req, res, next) => send(res, next, async () => {
  const hostel = await load(req.params.id);
  return listingVerified.grant({ hostel, user: req.user });
});

const revoke = (req, res, next) => send(res, next, async () => {
  const hostel = await load(req.params.id);
  return listingVerified.revoke({ hostel });
});

module.exports = { criteria, grant, revoke };
