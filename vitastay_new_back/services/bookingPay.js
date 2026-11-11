/**
 * BKG-011 — seeker pays via hosted checkout (DEC-08).
 * DEC-01 default approval_first: capture marks paid and does not occupy.
 * Instant: capture then occupy (BKG-009). request_advance: pay a percent, still Confirm.
 */
const { Op } = require('sequelize');
const { sequelize, Booking, PaymentOrder, Hostel, User } = require('../models');
const { getGateway } = require('./paymentGateway');
const { recordEvent } = require('./rentPay');
const { mapGatewayMethod } = require('./rentCollect');
const { releaseHold } = require('./bookingHold');
const { projectHostelAvailability } = require('./occupancyService');
const { checkoutAmount, normalizeModel, copyOf } = require('./bookingModel');

const OPEN_STATUSES = ['requested', 'held', 'awaiting_approval'];

const ORDER_REUSE_MS = 25 * 60 * 1000;

const httpError = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  throw err;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const payableOf = (booking, hostel) => {
  const rent = Number(booking.amount_due) || 0;
  const deposit = booking.deposit_due != null
    ? Number(booking.deposit_due)
    : Number(hostel?.security_deposit) || 0;
  return checkoutAmount({
    rent,
    deposit,
    model: booking.booking_model || hostel?.booking_model,
    advancePercent: booking.advance_percent != null ? booking.advance_percent : hostel?.advance_percent,
  });
};

const loadBooking = async (id, transaction) => Booking.findByPk(id, {
  include: [
    { model: User, as: 'seeker', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
    { model: Hostel, as: 'hostel', attributes: ['id', 'name', 'code', 'security_deposit', 'booking_model', 'advance_percent'] },
  ],
  transaction,
  lock: transaction ? transaction.LOCK.UPDATE : undefined,
});

const assertSeekerOwner = (user, booking) => {
  if (!user || Number(booking.seeker_user_id) !== Number(user.id)) {
    httpError(403, 'Forbidden');
  }
  if (user.role !== 'seeker' && user.role !== 'tenant') {
    httpError(403, 'Forbidden');
  }
};

const reuseOpenOrder = async (booking, amount, provider) => PaymentOrder.findOne({
  where: {
    booking_id: booking.id,
    provider,
    status: 'created',
    amount,
    created_at: { [Op.gte]: new Date(Date.now() - ORDER_REUSE_MS) },
  },
  order: [['id', 'DESC']],
});

const formatOrder = (order, booking, hostel, gateway, seeker) => {
  const amount = Number(order.amount);
  const user = seeker || booking.seeker || {};
  return {
    already_paid: false,
    gateway: gateway.name,
    sandbox: gateway.name === 'mock',
    key_id: gateway.publicKey(),
    order_id: order.gateway_order_id,
    amount,
    amount_paise: Math.round(amount * 100),
    currency: order.currency || 'INR',
    name: booking.listing_name || hostel?.name || 'Vita Stay',
    description: normalizeModel(booking.booking_model) === 'request_advance'
      ? `${booking.code} · ${copyOf('request_advance').badge}`
      : `${booking.code} · first month + deposit`,
    booking: {
      id: booking.id,
      code: booking.code,
      status: booking.status,
      payment_status: booking.payment_status,
      amount_due: Number(booking.amount_due) || 0,
      deposit_due: Number(booking.deposit_due) || Number(hostel?.security_deposit) || 0,
      amount_payable: amount,
      booking_model: normalizeModel(booking.booking_model),
      hold_expires_at: booking.hold_expires_at,
    },
    prefill: {
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      email: user.email || '',
      contact: user.phone || '',
    },
  };
};

const createBookingPayOrder = async (bookingId, user) => {
  const booking = await loadBooking(bookingId);
  if (!booking) httpError(404, 'Booking not found');
  assertSeekerOwner(user, booking);

  if (booking.payment_status === 'paid') {
    return {
      already_paid: true,
      payment_status: 'paid',
      booking: {
        id: booking.id,
        code: booking.code,
        status: booking.status,
        payment_status: booking.payment_status,
      },
    };
  }
  if (!OPEN_STATUSES.includes(booking.status)) {
    httpError(422, 'This booking cannot be paid');
  }
  if (booking.hold_expires_at && new Date(booking.hold_expires_at).getTime() < Date.now()) {
    httpError(409, 'This hold has expired');
  }

  const hostel = booking.hostel || await Hostel.findByPk(booking.hostel_id);
  const amount = payableOf(booking, hostel);
  if (amount <= 0.009) httpError(422, 'Nothing to pay on this booking');

  const gateway = getGateway();
  const existing = await reuseOpenOrder(booking, amount, gateway.name);
  if (existing) return formatOrder(existing, booking, hostel, gateway, booking.seeker);

  const created = await gateway.createOrder({
    amountRupees: amount,
    receipt: booking.code,
    notes: {
      booking_id: String(booking.id),
      booking_code: booking.code,
    },
  });

  const order = await PaymentOrder.create({
    rent_payment_id: null,
    tenant_id: null,
    booking_id: booking.id,
    owner_invoice_id: null,
    order_type: 'booking',
    hostel_id: booking.hostel_id,
    provider: gateway.name,
    gateway_order_id: created.id,
    amount,
    currency: created.currency || 'INR',
    status: 'created',
  });

  await booking.update({
    payment_status: 'pending',
    gateway_order_id: created.id,
    deposit_due: booking.deposit_due != null
      ? booking.deposit_due
      : (Number(hostel?.security_deposit) || 0),
  });

  return formatOrder(order, booking, hostel, gateway, booking.seeker);
};

const captureBookingOrder = async ({
  gatewayOrderId,
  gatewayPaymentId,
  method,
  eventId,
  eventType,
  payload,
}) => {
  const t = await sequelize.transaction();
  try {
    const order = await PaymentOrder.findOne({
      where: { gateway_order_id: gatewayOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order || !order.booking_id) {
      await t.rollback();
      const err = new Error('Gateway order not found');
      err.statusCode = 404;
      throw err;
    }

    const recorded = await recordEvent({
      provider: order.provider,
      eventId: eventId || gatewayPaymentId,
      eventType,
      rentPaymentId: null,
      payload,
      transaction: t,
    });

    const booking = await Booking.findByPk(order.booking_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!booking) {
      await t.rollback();
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    if (order.status === 'paid' || booking.payment_status === 'paid') {
      await t.commit();
      await maybeFulfillInstant(booking);
      return { booking, order, duplicate: true };
    }

    if (!OPEN_STATUSES.includes(booking.status)) {
      await t.commit();
      return { booking, order, duplicate: recorded.duplicate, skipped: true };
    }

    const resolvedMethod = mapGatewayMethod(method);
    await order.update({
      status: 'paid',
      gateway_payment_id: gatewayPaymentId || order.gateway_payment_id,
      payment_method: resolvedMethod,
    }, { transaction: t });

    await booking.update({
      payment_status: 'paid',
      gateway_order_id: order.gateway_order_id,
      status: 'awaiting_approval',
    }, { transaction: t });

    await t.commit();

    const notify = require('./notifyService');
    notify.notifyBookingPaid(booking).catch(() => {});
    const analytics = require('./listingAnalytics');
    analytics.recordBookingEvent(booking, 'booking_paid').catch(() => {});
    await maybeFulfillInstant(booking);

    return { booking, order, duplicate: recorded.duplicate };
  } catch (err) {
    try { await t.rollback(); } catch { /* already rolled back */ }
    throw err;
  }
};

const failBookingOrder = async ({
  gatewayOrderId,
  gatewayPaymentId,
  eventId,
  eventType,
  payload,
}) => {
  const t = await sequelize.transaction();
  let booking;
  let order;
  let recorded = { duplicate: false };
  let shouldRelease = false;
  let shouldNotify = false;
  try {
    order = await PaymentOrder.findOne({
      where: { gateway_order_id: gatewayOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order || !order.booking_id) {
      await t.rollback();
      const err = new Error('Gateway order not found');
      err.statusCode = 404;
      throw err;
    }

    recorded = await recordEvent({
      provider: order.provider,
      eventId: eventId || gatewayPaymentId,
      eventType,
      rentPaymentId: null,
      payload,
      transaction: t,
    });

    booking = await Booking.findByPk(order.booking_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!booking) {
      await t.rollback();
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    if (booking.payment_status === 'paid' || order.status === 'paid') {
      await t.commit();
      return { booking, order, duplicate: recorded.duplicate, ignored: true };
    }

    if (order.status === 'created') {
      await order.update({
        status: 'failed',
        gateway_payment_id: gatewayPaymentId || order.gateway_payment_id,
      }, { transaction: t });
    }

    if (OPEN_STATUSES.includes(booking.status)) {
      await booking.update({
        payment_status: 'failed',
        status: 'cancelled',
        cancel_reason: 'Payment failed or was cancelled at the gateway. Hold released.',
        hold_expires_at: null,
      }, { transaction: t });
      shouldRelease = true;
      shouldNotify = true;
    } else if (booking.status === 'cancelled' && booking.payment_status === 'failed') {
      shouldRelease = true;
    }

    await t.commit();
  } catch (err) {
    try { await t.rollback(); } catch { /* already rolled back */ }
    throw err;
  }

  if (shouldRelease && booking) {
    try {
      await releaseHold(booking);
      await projectHostelAvailability(booking.hostel_id);
    } catch (err) {
      const logger = require('../config/logger');
      logger.warn(`Failed-payment hold release skipped for booking ${booking.id}: ${err.message}`);
    }
  }
  if (shouldNotify && booking) {
    const notify = require('./notifyService');
    notify.notifyBookingPaymentFailed(booking).catch(() => {});
    const analytics = require('./listingAnalytics');
    analytics.recordBookingEvent(booking, 'booking_cancelled').catch(() => {});
  }

  return { booking, order, duplicate: recorded.duplicate };
};

const maybeFulfillInstant = async (booking) => {
  if (!booking || normalizeModel(booking.booking_model) !== 'instant') return booking;
  if (booking.payment_status !== 'paid') return booking;
  if (!OPEN_STATUSES.includes(booking.status)) return booking;
  try {
    const { fulfillConfirmedBooking } = require('./bookingOccupancy');
    const fulfilled = await fulfillConfirmedBooking({
      booking,
      actor: { id: booking.seeker_user_id },
    });
    await booking.update({
      status: 'confirmed',
      hold_expires_at: null,
      erp_tenant_id: fulfilled.tenant.id,
      decided_at: new Date(),
    });
    await booking.reload();
    const notify = require('./notifyService');
    notify.notifyBookingConfirmed(booking).catch(() => {});
  } catch (err) {
    const logger = require('../config/logger');
    logger.warn(`Instant book occupy deferred for booking ${booking.id}: ${err.message}`);
  }
  return booking;
};

module.exports = {
  payableOf,
  loadBooking,
  createBookingPayOrder,
  captureBookingOrder,
  failBookingOrder,
};
