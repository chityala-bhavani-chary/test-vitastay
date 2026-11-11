/**
 * BKG-013 — refund a paid booking. Idempotent on booking_id.
 * Owner payouts (BIC-055) subtract finance_transactions category booking_refund.
 */
const dayjs = require('dayjs');
const { BookingRefund, PaymentOrder, FinanceTransaction } = require('../models');
const { getGateway } = require('./paymentGateway');
const { quoteRefund, POLICY_VERSION } = require('./bookingRefundPolicy');
const logger = require('../config/logger');

const httpError = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  throw err;
};

const isUnique = (err) => {
  if (!err) return false;
  if (err.name === 'SequelizeUniqueConstraintError') return true;
  const code = err.original?.code || err.parent?.code;
  const errno = Number(err.original?.errno || err.parent?.errno);
  return code === 'ER_DUP_ENTRY' || errno === 1062 || /Duplicate entry/i.test(err.message || '');
};

const toRefundPublic = (row) => {
  if (!row) return null;
  const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
  return {
    id: json.id,
    booking_id: json.booking_id,
    amount: Number(json.amount) || 0,
    retained_amount: Number(json.retained_amount) || 0,
    paid_amount: Number(json.paid_amount) || 0,
    reason: json.reason,
    kind: json.kind,
    policy_version: json.policy_version,
    status: json.status,
    gateway_refund_id: json.gateway_refund_id || null,
  };
};

const loadRefund = async (bookingId) => BookingRefund.findOne({ where: { booking_id: bookingId } });

const loadPaidOrder = async (bookingId) => PaymentOrder.findOne({
  where: { booking_id: bookingId, status: 'paid' },
  order: [['id', 'DESC']],
});

const writePayoutOffset = async (refund, hostelId, actorId) => {
  const amount = Number(refund.amount) || 0;
  if (amount <= 0.009) return;
  const existing = await FinanceTransaction.findOne({
    where: { reference_type: 'booking_refund', reference_id: refund.id },
  });
  if (existing) return existing;
  return FinanceTransaction.create({
    hostel_id: hostelId,
    type: 'expense',
    category: 'booking_refund',
    amount,
    reference_id: refund.id,
    reference_type: 'booking_refund',
    transaction_date: dayjs().format('YYYY-MM-DD'),
    description: `Booking refund ${refund.kind} (${refund.reason}) · ${refund.policy_version}`,
    created_by: actorId || null,
  });
};

const processRefund = async ({ booking, reason, actorId }) => {
  if (!booking) return null;
  if (booking.payment_status === 'refunded') {
    return loadRefund(booking.id);
  }
  if (booking.payment_status !== 'paid') return null;

  const existing = await loadRefund(booking.id);
  if (existing?.status === 'processed') {
    if (booking.payment_status !== 'refunded' && Number(existing.amount) > 0.009) {
      await booking.update({ payment_status: 'refunded' });
    }
    return existing;
  }

  const quote = quoteRefund({ booking, reason });
  const order = await loadPaidOrder(booking.id);
  const gateway = getGateway();

  let row = existing;
  if (!row) {
    try {
      row = await BookingRefund.create({
        booking_id: booking.id,
        hostel_id: booking.hostel_id,
        payment_order_id: order?.id || null,
        provider: gateway.name,
        gateway_payment_id: order?.gateway_payment_id || null,
        amount: quote.amount,
        retained_amount: quote.retained,
        paid_amount: quote.paid,
        reason,
        kind: quote.kind,
        policy_version: POLICY_VERSION,
        status: 'pending',
      });
    } catch (err) {
      if (!isUnique(err)) throw err;
      row = await loadRefund(booking.id);
    }
  }

  if (row?.status === 'processed') {
    if (Number(row.amount) > 0.009) await booking.update({ payment_status: 'refunded' });
    return row;
  }

  if (quote.amount > 0.009) {
    const paymentId = order?.gateway_payment_id || row.gateway_payment_id;
    if (!paymentId) httpError(422, 'No captured payment to refund');
    if (!row.gateway_refund_id) {
      try {
        const result = await gateway.refund({
          paymentId,
          amountRupees: quote.amount,
          notes: {
            booking_id: String(booking.id),
            booking_code: booking.code || '',
            reason,
            policy_version: POLICY_VERSION,
          },
        });
        await row.update({
          gateway_refund_id: result.id,
          gateway_payment_id: paymentId,
          payload: JSON.stringify(result),
          status: 'processed',
        });
      } catch (err) {
        await row.update({ status: 'failed', payload: String(err.message || err) }).catch(() => {});
        logger.error(`Booking refund failed for ${booking.id}: ${err.message}`);
        httpError(502, 'Refund could not be sent to the payment gateway. Try again.');
      }
    } else {
      await row.update({ status: 'processed' });
    }
  } else {
    await row.update({ status: 'processed' });
  }

  await row.reload();
  if (Number(row.amount) > 0.009) {
    await booking.update({ payment_status: 'refunded' });
  }
  await writePayoutOffset(row, booking.hostel_id, actorId);

  const notify = require('./notifyService');
  notify.notifyBookingRefunded(booking, row).catch(() => {});
  return row;
};

module.exports = {
  toRefundPublic,
  loadRefund,
  processRefund,
};
