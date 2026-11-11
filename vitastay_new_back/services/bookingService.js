/**
 * BKG-006 / BKG-007 — public booking request + reserved hold.
 * Never call walk-in bed assignment. Confirm/occupy is BKG-009.
 */
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { generateReceiptNumber } = require('../helpers/token');
const { loadChecklist, isListingPubliclyVisible } = require('./mediaPublishGuard');
const { readListingAvailability, projectHostelAvailability } = require('./occupancyService');
const { placeHold, releaseHold } = require('./bookingHold');
const { fulfillConfirmedBooking } = require('./bookingOccupancy');
const { createAuditLog } = require('../helpers/audit');
const { quoteRefund, POLICY_TEXT } = require('./bookingRefundPolicy');
const { processRefund, loadRefund, toRefundPublic } = require('./bookingRefund');
const { assertEntitlement } = require('./ownerPlan');
const {
  normalizeModel,
  normalizeAdvancePercent,
  checkoutAmount,
  totalDue,
  publicMeta,
} = require('./bookingModel');

const OPEN_STATUSES = ['requested', 'held', 'awaiting_approval'];
const CANCELABLE = ['requested', 'held', 'awaiting_approval'];
const ROOM_TYPES = new Set(['single', 'double', 'triple', 'dormitory']);

const httpError = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  throw err;
};

const assertSeekerKyc = (user) => {
  if (!user?.email_verified) {
    httpError(422, 'Verify your email before requesting a booking');
  }
  if (!String(user?.phone || '').trim()) {
    httpError(422, 'Add a mobile number before requesting a booking');
  }
};

const toPublic = (row, { includeSeeker = false } = {}) => {
  const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
  const payload = {
    id: json.id,
    code: json.code,
    hostel_id: json.hostel_id,
    listing_name: json.listing_name,
    listing_code: json.listing_code,
    room_id: json.room_id,
    bed_id: json.bed_id,
    room_type: json.room_type,
    move_in_date: json.move_in_date,
    stay_type: json.stay_type,
    status: json.status,
    hold_expires_at: json.hold_expires_at,
    amount_due: json.amount_due == null ? null : Number(json.amount_due),
    deposit_due: json.deposit_due == null ? null : Number(json.deposit_due),
    amount_total: totalDue(json.amount_due, json.deposit_due),
    amount_payable: checkoutAmount({
      rent: json.amount_due,
      deposit: json.deposit_due,
      model: json.booking_model,
      advancePercent: json.advance_percent,
    }) || null,
    booking_model: normalizeModel(json.booking_model),
    advance_percent: normalizeModel(json.booking_model) === 'request_advance'
      ? normalizeAdvancePercent(json.advance_percent)
      : null,
    ...publicMeta(json),
    payment_status: json.payment_status,
    refund_policy: POLICY_TEXT,
    erp_tenant_id: json.erp_tenant_id || null,
    reject_reason: json.reject_reason || null,
    cancel_reason: json.cancel_reason || null,
    created_at: json.created_at,
  };
  if (includeSeeker && json.seeker) {
    payload.seeker = {
      id: json.seeker.id,
      first_name: json.seeker.first_name,
      last_name: json.seeker.last_name,
      email: json.seeker.email,
      phone: json.seeker.phone,
    };
  }
  return payload;
};

const decoratePublic = async (row, opts) => {
  const payload = toPublic(row, opts);
  if (payload.payment_status === 'paid' && OPEN_STATUSES.includes(payload.status)) {
    payload.refund_quote = quoteRefund({
      booking: row,
      reason: opts?.quoteReason || 'seeker_cancel',
    });
  }
  const refund = await loadRefund(row.id);
  payload.refund = toRefundPublic(refund);
  return payload;
};

const parseMoveIn = (raw) => {
  const date = dayjs(raw);
  if (!date.isValid()) httpError(422, 'move_in_date must be YYYY-MM-DD');
  if (date.endOf('day').isBefore(dayjs().startOf('day'))) {
    httpError(422, 'move_in_date cannot be in the past');
  }
  return date.format('YYYY-MM-DD');
};

const resolveHostel = async (body) => {
  const { Hostel } = require('../models');
  const id = body.hostel_id || body.listing_id;
  const code = String(body.listing_code || body.code || '').trim();
  let hostel = null;
  if (id && /^\d+$/.test(String(id))) hostel = await Hostel.findByPk(id);
  if (!hostel && code) hostel = await Hostel.findOne({ where: { code } });
  if (!hostel) httpError(404, 'Listing not found');
  return hostel;
};

const vacancyForType = async (hostel, roomType) => {
  let availability = await readListingAvailability(hostel.id);
  if (!availability) availability = await projectHostelAvailability(hostel);
  const row = (availability?.occupancy || []).find((item) => item.room_type === roomType);
  const beds = row ? Number(row.beds_available) || 0 : 0;
  const rent = row?.monthly_rent_from ?? availability?.monthly_rent_from ?? null;
  return { beds, rent, availability };
};

const createBooking = async ({ user, body, req }) => {
  if (user.role !== 'seeker') httpError(403, 'Guests book from a guest account');
  assertSeekerKyc(user);
  const hostel = await resolveHostel(body);
  assertEntitlement(hostel, 'online_booking');
  const checklist = await loadChecklist(hostel);
  if (!isListingPubliclyVisible(hostel, checklist)) {
    httpError(404, 'Listing not found');
  }

  const stayType = String(body.stay_type || 'monthly').toLowerCase();
  if (stayType !== 'monthly') httpError(422, 'Only monthly stay requests are open for now');
  const moveIn = parseMoveIn(body.move_in_date || body.move_in);

  let roomType = String(body.room_type || '').trim().toLowerCase() || null;
  if (roomType && !ROOM_TYPES.has(roomType)) {
    httpError(422, 'room_type must be single, double, triple, or dormitory');
  }
  const bedId = body.bed_id ? Number(body.bed_id) : null;
  const roomId = body.room_id ? Number(body.room_id) : null;
  if (!roomType && !bedId && !roomId) httpError(422, 'Choose a room type');

  const { Booking } = require('../models');
  const open = await Booking.findOne({
    where: {
      seeker_user_id: user.id,
      hostel_id: hostel.id,
      status: { [Op.in]: OPEN_STATUSES },
    },
  });
  if (open) httpError(409, 'You already have an open request for this PG');

  const vacancy = roomType ? await vacancyForType(hostel, roomType) : { beds: 1, rent: null };
  if (roomType && vacancy.beds < 1) httpError(409, 'No vacant beds of that type right now');

  const paymentFirst = String(body.payment_first || '') === 'true';
  let held;
  try {
    held = await placeHold({
      hostel,
      roomType,
      roomId,
      bedId,
      paymentFirst,
    });
  } catch (err) {
    if (err.statusCode) throw err;
    throw err;
  }

  const type = held.bed.room?.room_type || roomType;
  const model = normalizeModel(hostel.booking_model);
  const advancePercent = model === 'request_advance'
    ? normalizeAdvancePercent(hostel.advance_percent)
    : null;
  let row;
  try {
    row = await Booking.create({
      code: generateReceiptNumber('BKG'),
      seeker_user_id: user.id,
      hostel_id: hostel.id,
      room_id: held.bed.room_id,
      bed_id: held.bed.id,
      room_type: type,
      move_in_date: moveIn,
      stay_type: 'monthly',
      status: 'held',
      hold_expires_at: held.holdExpiresAt,
      amount_due: vacancy.rent,
      deposit_due: Number(hostel.security_deposit) || 0,
      payment_status: 'none',
      listing_name: hostel.name,
      listing_code: hostel.code,
      booking_model: model,
      advance_percent: advancePercent,
    });
  } catch (err) {
    await releaseHold({ hostel_id: hostel.id, bed_id: held.bed.id });
    throw err;
  }

  await projectHostelAvailability(hostel);

  const notify = require('./notifyService');
  notify.notifyBookingRequested(row).catch(() => {});
  const analytics = require('./listingAnalytics');
  analytics.recordBookingEvent(row, 'booking_started').catch(() => {});

  await createAuditLog({
    userId: user.id,
    action: 'BOOKING_CREATE',
    entityType: 'booking',
    entityId: row.id,
    newValues: {
      code: row.code,
      hostel_id: hostel.id,
      room_type: type,
      bed_id: held.bed.id,
      move_in_date: moveIn,
      occupied: false,
      reserved: true,
      hold_expires_at: held.holdExpiresAt,
    },
    req,
  });

  return toPublic(row);
};

const canViewBooking = async (user, booking) => {
  if (!user || !booking) return false;
  if (user.role === 'super_admin') return true;
  if (Number(booking.seeker_user_id) === Number(user.id)) return true;
  const { Hostel, SupervisorHostel } = require('../models');
  const hostel = await Hostel.findByPk(booking.hostel_id);
  if (!hostel) return false;
  if (user.role === 'owner' && Number(hostel.owner_id) === Number(user.id)) return true;
  if (user.role === 'supervisor') {
    const assigned = await SupervisorHostel.findOne({
      where: { supervisor_id: user.id, hostel_id: hostel.id },
    });
    return Boolean(assigned);
  }
  return false;
};

const SEEKER_ATTRS = ['id', 'first_name', 'last_name', 'email', 'phone'];

const getBooking = async ({ user, id }) => {
  const { Booking, User } = require('../models');
  const row = await Booking.findByPk(id, {
    include: [{ model: User, as: 'seeker', attributes: SEEKER_ATTRS, required: false }],
  });
  if (!row) httpError(404, 'Booking not found');
  if (!(await canViewBooking(user, row))) httpError(403, 'Forbidden');
  return decoratePublic(row, {
    includeSeeker: user.role !== 'seeker',
    quoteReason: user.role === 'seeker' ? 'seeker_cancel' : 'owner_reject',
  });
};

const listSeekerBookings = async (user) => {
  if (user.role !== 'seeker' && user.role !== 'tenant') httpError(403, 'Forbidden');
  const { Booking } = require('../models');
  const rows = await Booking.findAll({
    where: { seeker_user_id: user.id },
    order: [['id', 'DESC']],
    limit: 50,
  });
  return Promise.all(rows.map((row) => decoratePublic(row, { quoteReason: 'seeker_cancel' })));
};

const operatorHostelIds = async (user, { marketplaceOnly = false } = {}) => {
  const { Hostel, SupervisorHostel } = require('../models');
  let rows = [];
  if (user.role === 'super_admin') {
    rows = await Hostel.findAll({ attributes: ['id', 'plan', 'plan_status'] });
  } else if (user.role === 'owner') {
    rows = await Hostel.findAll({
      where: { owner_id: user.id },
      attributes: ['id', 'plan', 'plan_status'],
    });
  } else if (user.role === 'supervisor') {
    const assigned = await SupervisorHostel.findAll({
      where: { supervisor_id: user.id },
      attributes: ['hostel_id'],
    });
    const ids = assigned.map((row) => row.hostel_id);
    if (!ids.length) return [];
    rows = await Hostel.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'plan', 'plan_status'],
    });
  }
  if (marketplaceOnly) {
    const { entitlementsOf } = require('./ownerPlan');
    rows = rows.filter((hostel) => entitlementsOf(hostel).online_booking);
  }
  return rows.map((row) => row.id);
};

const listInbox = async (user, query = {}) => {
  if (user.role === 'seeker' || user.role === 'tenant') return listSeekerBookings(user);
  const ids = await operatorHostelIds(user, {
    marketplaceOnly: user.role === 'owner' || user.role === 'supervisor',
  });
  if (!ids.length) {
    if (user.role === 'owner' || user.role === 'supervisor') {
      const { UPGRADE_COPY } = require('./ownerPlan');
      httpError(403, UPGRADE_COPY.online_booking);
    }
    return [];
  }
  let hostelIds = ids;
  if (query.hostel_id) {
    const wanted = Number(query.hostel_id);
    if (!ids.map(Number).includes(wanted)) {
      const { UPGRADE_COPY } = require('./ownerPlan');
      httpError(403, user.role === 'supervisor' ? 'This hostel is not assigned to you' : UPGRADE_COPY.online_booking);
    }
    hostelIds = [wanted];
  }
  const { Booking, User } = require('../models');
  const where = { hostel_id: { [Op.in]: hostelIds } };
  const status = String(query.status || 'open').toLowerCase();
  if (status === 'open') where.status = { [Op.in]: OPEN_STATUSES };
  else if (status !== 'all') where.status = status;
  const rows = await Booking.findAll({
    where,
    include: [{ model: User, as: 'seeker', attributes: SEEKER_ATTRS, required: false }],
    order: [['id', 'DESC']],
    limit: 100,
  });
  return Promise.all(rows.map((row) => decoratePublic(row, {
    includeSeeker: true,
    quoteReason: 'owner_reject',
  })));
};

const requireOperator = async (user, booking) => {
  if (user.role === 'seeker') httpError(403, 'Forbidden');
  if (!(await canViewBooking(user, booking))) {
    httpError(user.role === 'supervisor' ? 403 : 403, user.role === 'supervisor'
      ? 'This hostel is not assigned to you'
      : 'Forbidden');
  }
};

const cancelBooking = async ({ user, id, reason, req }) => {
  const { Booking } = require('../models');
  const row = await Booking.findByPk(id);
  if (!row) httpError(404, 'Booking not found');
  if (Number(row.seeker_user_id) !== Number(user.id)) httpError(403, 'Forbidden');
  if (!CANCELABLE.includes(row.status)) {
    httpError(422, 'This booking can no longer be cancelled here');
  }
  const previous = row.status;
  if (row.payment_status === 'paid' || row.payment_status === 'refunded') {
    await processRefund({ booking: row, reason: 'seeker_cancel', actorId: user.id });
    await row.reload();
  }
  await releaseHold(row);
  await row.update({
    status: 'cancelled',
    cancel_reason: reason ? String(reason).trim().slice(0, 500) : null,
    hold_expires_at: null,
  });
  await projectHostelAvailability(row.hostel_id);
  const notify = require('./notifyService');
  notify.notifyBookingCancelled(row).catch(() => {});
  const analytics = require('./listingAnalytics');
  analytics.recordBookingEvent(row, 'booking_cancelled').catch(() => {});
  await createAuditLog({
    userId: user.id,
    action: 'BOOKING_CANCEL',
    entityType: 'booking',
    entityId: row.id,
    oldValues: { status: previous },
    newValues: { status: 'cancelled', payment_status: row.payment_status },
    req,
  });
  return decoratePublic(row);
};

const confirmBooking = async ({ user, id, req }) => {
  const { Booking } = require('../models');
  const row = await Booking.findByPk(id);
  if (!row) httpError(404, 'Booking not found');
  await requireOperator(user, row);
  if (row.status === 'expired') httpError(409, 'This hold has expired');
  if (row.payment_status === 'refunded') {
    httpError(422, 'This booking was refunded and cannot be confirmed');
  }
  if (!OPEN_STATUSES.includes(row.status)) {
    httpError(422, 'This booking cannot be confirmed');
  }
  const previous = row.status;
  const fulfilled = await fulfillConfirmedBooking({ booking: row, actor: user });
  await row.update({
    status: 'confirmed',
    hold_expires_at: null,
    decided_by: user.id,
    decided_at: new Date(),
    erp_tenant_id: fulfilled.tenant.id,
  });
  const notify = require('./notifyService');
  notify.notifyBookingConfirmed(row).catch(() => {});
  await createAuditLog({
    userId: user.id,
    action: 'BOOKING_CONFIRM',
    entityType: 'booking',
    entityId: row.id,
    oldValues: { status: previous },
    newValues: {
      status: 'confirmed',
      occupied: true,
      erp_tenant_id: fulfilled.tenant.id,
      invoice_id: fulfilled.invoice?.id || null,
    },
    req,
  });
  return toPublic(row);
};

const rejectBooking = async ({ user, id, reason, req }) => {
  const { Booking } = require('../models');
  const row = await Booking.findByPk(id);
  if (!row) httpError(404, 'Booking not found');
  await requireOperator(user, row);
  const text = String(reason || '').trim();
  if (text.length < 3) httpError(422, 'Rejection reason is required');
  if (row.status === 'expired') httpError(409, 'This hold has expired');
  if (!OPEN_STATUSES.includes(row.status)) {
    httpError(422, 'This booking cannot be rejected');
  }
  const previous = row.status;
  if (row.payment_status === 'paid' || row.payment_status === 'refunded') {
    await processRefund({ booking: row, reason: 'owner_reject', actorId: user.id });
    await row.reload();
  }
  await releaseHold(row);
  await row.update({
    status: 'rejected',
    reject_reason: text.slice(0, 500),
    hold_expires_at: null,
    decided_by: user.id,
    decided_at: new Date(),
  });
  await projectHostelAvailability(row.hostel_id);
  const notify = require('./notifyService');
  notify.notifyBookingRejected(row).catch(() => {});
  const analytics = require('./listingAnalytics');
  analytics.recordBookingEvent(row, 'booking_cancelled').catch(() => {});
  await createAuditLog({
    userId: user.id,
    action: 'BOOKING_REJECT',
    entityType: 'booking',
    entityId: row.id,
    oldValues: { status: previous },
    newValues: { status: 'rejected', reason: text.slice(0, 200), payment_status: row.payment_status },
    req,
  });
  return decoratePublic(row, { includeSeeker: true });
};

const displaceOpenBookingsForBed = async ({ hostelId, bedId, reason, actor, req }) => {
  const { Booking } = require('../models');
  const rows = await Booking.findAll({
    where: {
      hostel_id: hostelId,
      bed_id: bedId,
      status: { [Op.in]: OPEN_STATUSES },
    },
  });
  const notify = require('./notifyService');
  const text = String(reason || 'Walk-in override').slice(0, 500);
  for (const row of rows) {
    const previous = row.status;
    if (row.payment_status === 'paid' || row.payment_status === 'refunded') {
      await processRefund({ booking: row, reason: 'walkin_override', actorId: actor?.id });
      await row.reload();
    }
    await row.update({
      status: 'cancelled',
      cancel_reason: text,
      hold_expires_at: null,
      decided_by: actor?.id || null,
      decided_at: new Date(),
    });
    notify.notifyBookingDisplaced(row).catch(() => {});
    const analytics = require('./listingAnalytics');
    analytics.recordBookingEvent(row, 'booking_cancelled').catch(() => {});
    await createAuditLog({
      userId: actor?.id,
      action: 'WALKIN_OVERRIDE',
      entityType: 'booking',
      entityId: row.id,
      oldValues: { status: previous, bed_id: bedId },
      newValues: { status: 'cancelled', reason: text },
      req,
    });
  }
  return rows;
};

module.exports = {
  OPEN_STATUSES,
  createBooking,
  getBooking,
  listSeekerBookings,
  listInbox,
  cancelBooking,
  confirmBooking,
  rejectBooking,
  displaceOpenBookingsForBed,
  toPublic,
};
