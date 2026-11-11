const { Hostel } = require('../models');
const { success, error } = require('../utils/response');
const { listCatalog, toPublicPlan } = require('../services/ownerPlan');
const billing = require('../services/ownerPlanBilling');

const loadHostel = async (req) => {
  const hostel = await Hostel.findByPk(req.params.id || req.params.hostelId);
  if (!hostel) {
    const err = new Error('Hostel not found');
    err.statusCode = 404;
    throw err;
  }
  return hostel;
};

const fail = (res, err, next) => {
  if (err.statusCode) return error(res, err.message, err.statusCode, err.errors);
  return next(err);
};

exports.catalog = async (req, res, next) => {
  try {
    const activeOnly = req.user?.role !== 'super_admin';
    const rows = await listCatalog({ activeOnly });
    return success(res, { plans: rows });
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.updateCatalog = async (req, res, next) => {
  try {
    const row = await billing.updateCatalogPlan({
      user: req.user,
      code: req.params.code,
      body: req.body || {},
    });
    return success(res, toPublicPlan(row), 'Plan catalog updated');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.getHostelPlan = async (req, res, next) => {
  try {
    const hostel = await loadHostel(req);
    const data = await billing.getHostelPlan({ hostel, user: req.user });
    return success(res, data);
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.changePlan = async (req, res, next) => {
  try {
    const hostel = await loadHostel(req);
    const data = await billing.changePlan({
      hostel,
      user: req.user,
      plan: req.body?.plan,
      period: req.body?.period,
      confirmUnpublish: req.body?.confirm_unpublish,
      req,
    });
    const message = data.action === 'downgraded'
      ? (data.plan === 'regular'
        ? 'Plan downgraded. The listing is unpublished.'
        : 'Plan downgraded.')
      : 'Pay this GST invoice to activate the plan';
    return success(res, data, message);
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.pay = async (req, res, next) => {
  try {
    const hostel = await loadHostel(req);
    const data = await billing.createPayOrder({
      hostel,
      user: req.user,
      plan: req.body?.plan,
      period: req.body?.period,
    });
    return success(res, data, 'Pay this GST invoice to activate the plan');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.confirmPay = async (req, res, next) => {
  try {
    const hostel = await loadHostel(req);
    const data = await billing.confirmPay({
      hostel,
      user: req.user,
      body: req.body || {},
    });
    return success(res, data, data.duplicate ? 'Already paid' : 'Plan paid');
  } catch (err) {
    return fail(res, err, next);
  }
};

exports.assign = async (req, res, next) => {
  try {
    const hostel = await loadHostel(req);
    const data = await billing.assignPlan({
      hostel,
      user: req.user,
      plan: req.body?.plan,
      period: req.body?.period,
      reason: req.body?.reason,
      expiresAt: req.body?.expires_at || req.body?.comp_until,
      req,
    });
    return success(res, data, 'Plan assigned');
  } catch (err) {
    return fail(res, err, next);
  }
};
