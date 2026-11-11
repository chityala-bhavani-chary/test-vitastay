/**
 * DEC-02 entitlements. Regular = ERP only. Silver/Gold = marketplace while active/comp/grace.
 * Prices live in `plans` — never hard-code rupees here.
 */
const PLAN_CODES = ['regular', 'silver', 'gold'];
const PERIODS = ['month', 'year'];
const PLAN_RANK = { regular: 0, silver: 1, gold: 2 };
/** Live marketplace: paid active, renewal grace, or Super Admin gift (`comp`). Pending/lapsed are off. */
const PAID_OK = new Set(['comp', 'active', 'grace']);

/** Owner Settings → Plan (docs/17). Do not paraphrase. */
const PLAN_OWNER_COPY = {
  regular: 'Your PG is management-only. Guests cannot find it online.',
  silver: 'Guests can search, open your listing, and request a bed.',
  gold: 'Everything in Vita Stay, plus Vita Eye at the gate.',
};

const UNPUBLISH_DOWNGRADE_MESSAGE =
  'Downgrade to Regular unpublishes the listing. Guests will not find this PG online. Confirm to continue.';

const httpError = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  throw err;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const planOf = (hostel) => {
  const raw = String(hostel?.plan || 'regular').toLowerCase();
  return PLAN_CODES.includes(raw) ? raw : 'regular';
};

const statusOf = (hostel) => {
  const raw = String(hostel?.plan_status || 'comp').toLowerCase();
  return raw || 'comp';
};

const planIsLive = (hostel) => PAID_OK.has(statusOf(hostel));

const entitlementsOf = (hostel) => {
  const plan = planOf(hostel);
  const live = planIsLive(hostel);
  const silver = live && (plan === 'silver' || plan === 'gold');
  const gold = live && plan === 'gold';
  return {
    plan,
    plan_status: statusOf(hostel),
    erp: true,
    occupancy: true,
    revenue: true,
    public_search: silver,
    online_booking: silver,
    tenant_portal: silver,
    listing_analytics: silver,
    listing_publish: silver,
    vita_eye: gold,
    full_product: gold,
  };
};

const marketplaceOk = (hostel) => Boolean(entitlementsOf(hostel).public_search);

/** New extras (sheet 10 / 11) use this unless the ticket says Silver. Vita Eye uses `vita_eye`. */
const NEW_EXTRA_FLAG = 'full_product';

const UPGRADE_COPY = {
  public_search: 'Upgrade to Silver to list this PG online',
  online_booking: 'Upgrade to Silver to list this PG online',
  listing_publish: 'Upgrade to Silver to list this PG online',
  listing_analytics: 'Upgrade to Silver to list this PG online',
  tenant_portal: 'Upgrade to Silver for tenant logins',
  vita_eye: 'Upgrade to Gold for Vita Eye',
  full_product: 'Upgrade to Gold for this feature',
};

const assertEntitlement = (hostel, flag, message) => {
  const flags = entitlementsOf(hostel);
  if (flags[flag]) return flags;
  httpError(403, message || UPGRADE_COPY[flag] || 'Upgrade your plan to use this');
  return flags;
};

const withEntitlements = (hostel) => {
  const json = hostel?.toJSON ? hostel.toJSON() : { ...(hostel || {}) };
  json.entitlements = entitlementsOf(hostel);
  return json;
};

const hostelIdFromReq = (req) => (
  req.hostel?.id
  || req.params?.hostelId
  || req.body?.hostel_id
  || req.body?.hostelId
  || req.query?.hostel_id
  || req.query?.hostelId
  || (req.params?.id && !Number.isNaN(Number(req.params.id)) ? req.params.id : null)
);

const requireEntitlement = (flag) => async (req, res, next) => {
  const { error } = require('../utils/response');
  try {
    let hostel = req.hostel;
    if (!hostel) {
      const id = hostelIdFromReq(req);
      if (id == null || id === '') return error(res, 'Hostel is required', 422);
      const { Hostel } = require('../models');
      hostel = await Hostel.findByPk(id);
      if (!hostel) return error(res, 'Listing not found', 404);
      req.hostel = hostel;
    }
    assertEntitlement(hostel, flag);
    req.entitlements = entitlementsOf(hostel);
    return next();
  } catch (err) {
    if (err.statusCode === 403) return error(res, err.message, 403);
    return next(err);
  }
};

const toPublicPlan = (row) => {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    code: json.code,
    name: json.name,
    monthly_inr: json.monthly_inr != null ? Number(json.monthly_inr) : null,
    yearly_inr: json.yearly_inr != null ? Number(json.yearly_inr) : null,
    yearly_discount_pct: json.yearly_discount_pct != null ? Number(json.yearly_discount_pct) : null,
    gst_pct: Number(json.gst_pct) || 0,
    is_active: Boolean(json.is_active),
    sort_order: Number(json.sort_order) || 0,
  };
};

const listCatalog = async ({ activeOnly = true } = {}) => {
  const { Plan } = require('../models');
  const where = activeOnly ? { is_active: true } : {};
  const rows = await Plan.findAll({ where, order: [['sort_order', 'ASC']] });
  return rows.map(toPublicPlan);
};

const loadPlan = async (code) => {
  const raw = String(code || '').toLowerCase();
  if (!PLAN_CODES.includes(raw)) httpError(422, 'plan must be regular, silver, or gold');
  const { Plan } = require('../models');
  const row = await Plan.findOne({ where: { code: raw } });
  if (!row) httpError(404, 'Plan not found');
  return row;
};

const quote = (planRow, period) => {
  const per = String(period || '').toLowerCase();
  if (!PERIODS.includes(per)) httpError(422, 'period must be month or year');
  const catalog = toPublicPlan(planRow);
  const ex = per === 'year' ? catalog.yearly_inr : catalog.monthly_inr;
  if (ex == null || !Number.isFinite(ex) || ex <= 0) {
    return {
      checkout_open: false,
      plan: catalog.code,
      period: per,
      amount_ex_gst: null,
      gst_pct: catalog.gst_pct,
      gst_amount: null,
      total: null,
      message: 'Checkout is off until finance fills this plan’s price',
    };
  }
  const gstPct = catalog.gst_pct;
  const gst = round2(ex * gstPct / 100);
  return {
    checkout_open: true,
    plan: catalog.code,
    period: per,
    amount_ex_gst: round2(ex),
    gst_pct: gstPct,
    gst_amount: gst,
    total: round2(ex + gst),
    currency: 'INR',
  };
};

const hostelPlanPayload = (hostel, catalog = []) => {
  const plan = planOf(hostel);
  const period = hostel.plan_period || null;
  const current = (catalog || []).find((row) => row.code === plan);
  const currentPrice = current
    ? (period === 'year' ? current.yearly_inr : current.monthly_inr)
    : null;
  return {
    hostel_id: hostel.id,
    name: hostel.name,
    code: hostel.code,
    plan,
    plan_period: period,
    plan_status: statusOf(hostel),
    plan_starts_at: hostel.plan_starts_at || null,
    plan_expires_at: hostel.plan_expires_at || null,
    plan_grace_ends_at: hostel.plan_grace_ends_at || null,
    listing_published: Boolean(hostel.listing_published),
    copy: PLAN_OWNER_COPY[plan] || PLAN_OWNER_COPY.regular,
    current_price: currentPrice,
    downgrade_unpublishes: Boolean(hostel.listing_published) && marketplaceOk(hostel),
    entitlements: entitlementsOf(hostel),
    catalog: (catalog || []).map((row) => ({
      ...row,
      copy: PLAN_OWNER_COPY[row.code] || PLAN_OWNER_COPY.regular,
    })),
  };
};

module.exports = {
  PLAN_CODES,
  PERIODS,
  PLAN_RANK,
  PLAN_OWNER_COPY,
  UNPUBLISH_DOWNGRADE_MESSAGE,
  planOf,
  statusOf,
  planIsLive,
  entitlementsOf,
  hostelEntitlements: entitlementsOf,
  entitlement: entitlementsOf,
  marketplaceOk,
  NEW_EXTRA_FLAG,
  assertEntitlement,
  requireEntitlement,
  withEntitlements,
  UPGRADE_COPY,
  listCatalog,
  loadPlan,
  quote,
  toPublicPlan,
  hostelPlanPayload,
  round2,
  httpError,
};
