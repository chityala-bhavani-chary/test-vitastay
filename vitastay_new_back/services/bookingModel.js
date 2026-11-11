/**
 * DEC-01 — each PG chooses one booking model. Default is approval_first (live).
 * Instant occupy-on-pay and request+advance are per-hostel overrides, not a second API.
 */
const MODELS = ['approval_first', 'instant', 'request_advance'];
const DEFAULT_MODEL = 'approval_first';
const DEFAULT_ADVANCE_PERCENT = 20;

const COPY = {
  approval_first: {
    badge: 'Request to book',
    hint: 'We hold a bed so nobody else can take it. The PG still has to confirm. Paying now does not give you the bed until they confirm.',
  },
  instant: {
    badge: 'Instant book',
    hint: 'Pay now. If payment succeeds, the bed is yours. The PG does not need to accept first.',
  },
  request_advance: {
    badge: 'Hold with advance',
    hint: 'Pay a hold amount now. The PG still confirms. The rest is due after they accept.',
  },
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const normalizeModel = (raw) => {
  const value = String(raw || DEFAULT_MODEL).trim().toLowerCase();
  return MODELS.includes(value) ? value : DEFAULT_MODEL;
};

const normalizeAdvancePercent = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_ADVANCE_PERCENT;
  return Math.min(100, Math.max(1, Math.round(n * 100) / 100));
};

const copyOf = (model) => COPY[normalizeModel(model)];

const totalDue = (rent, deposit) => round2((Number(rent) || 0) + (Number(deposit) || 0));

const checkoutAmount = ({ rent, deposit, model, advancePercent }) => {
  const total = totalDue(rent, deposit);
  if (normalizeModel(model) !== 'request_advance') return total;
  return round2(total * (normalizeAdvancePercent(advancePercent) / 100));
};

const publicMeta = (hostelOrBooking = {}) => {
  const model = normalizeModel(hostelOrBooking.booking_model);
  const advancePercent = normalizeAdvancePercent(hostelOrBooking.advance_percent);
  const copy = copyOf(model);
  return {
    booking_model: model,
    advance_percent: model === 'request_advance' ? advancePercent : null,
    booking_badge: copy.badge,
    booking_hint: copy.hint,
  };
};

const sanitizeHostelPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.booking_model != null && payload.booking_model !== '') {
    payload.booking_model = normalizeModel(payload.booking_model);
  } else {
    delete payload.booking_model;
  }
  if (payload.advance_percent != null && payload.advance_percent !== '') {
    payload.advance_percent = normalizeAdvancePercent(payload.advance_percent);
  } else {
    delete payload.advance_percent;
  }
  return payload;
};

module.exports = {
  MODELS,
  DEFAULT_MODEL,
  DEFAULT_ADVANCE_PERCENT,
  COPY,
  round2,
  normalizeModel,
  normalizeAdvancePercent,
  copyOf,
  totalDue,
  checkoutAmount,
  publicMeta,
  sanitizeHostelPayload,
};
