/**
 * BKG-007 — time-boxed reserved hold. Does not occupy. Walk-in sees reserved as not vacant.
 */
const { Op } = require('sequelize');
const logger = require('../config/logger');
const config = require('../config');
const { getModelsForHostel } = require('../helpers/hostelContext');
const {
  pickAndReserveBed,
  releaseReservedBed,
  projectHostelAvailability,
} = require('./occupancyService');

const HOLD_OPEN = ['held', 'requested'];

const holdDurationMs = (paymentFirst = false) => {
  if (paymentFirst) return config.booking.holdMinutes * 60 * 1000;
  return config.booking.approvalHoldHours * 60 * 60 * 1000;
};

const computeHoldExpiresAt = ({ paymentFirst = false, from = new Date() } = {}) => (
  new Date(from.getTime() + holdDurationMs(paymentFirst))
);

const placeHold = async ({ hostel, roomType, roomId, bedId, paymentFirst = false }) => {
  const holdExpiresAt = computeHoldExpiresAt({ paymentFirst });
  const ctx = await getModelsForHostel(hostel);
  const bed = await pickAndReserveBed({
    ctx,
    hostel,
    roomType,
    roomId,
    bedId,
    holdExpiresAt,
  });
  if (!bed) {
    const err = new Error('No vacant beds of that type right now');
    err.statusCode = 409;
    throw err;
  }
  return { bed, holdExpiresAt };
};

const releaseHold = async (booking) => {
  if (!booking?.bed_id) return null;
  const ctx = await getModelsForHostel(booking.hostel_id);
  const t = await ctx.sequelize.transaction();
  try {
    const bed = await releaseReservedBed({ ctx, bedId: booking.bed_id, transaction: t });
    await t.commit();
    return bed;
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

const expireOne = async (booking) => {
  await releaseHold(booking);
  const { Booking } = require('../models');
  const [count] = await Booking.update(
    { status: 'expired' },
    { where: { id: booking.id, status: { [Op.in]: HOLD_OPEN } } }
  );
  if (!count) return false;
  await projectHostelAvailability(booking.hostel_id);
  const { notifyBookingHoldExpired } = require('./notifyService');
  await notifyBookingHoldExpired(booking);
  const analytics = require('./listingAnalytics');
  analytics.recordBookingEvent(booking, 'booking_cancelled').catch(() => {});
  return true;
};

const expireHolds = async (now = new Date()) => {
  const { Booking } = require('../models');
  const due = await Booking.findAll({
    where: {
      status: { [Op.in]: HOLD_OPEN },
      payment_status: { [Op.notIn]: ['paid'] },
      hold_expires_at: { [Op.lte]: now },
    },
    order: [['id', 'ASC']],
    limit: 200,
  });
  let expired = 0;
  for (const booking of due) {
    try {
      if (await expireOne(booking)) expired += 1;
    } catch (err) {
      logger.warn(`Hold expiry failed for booking ${booking.id}: ${err.message}`);
    }
  }
  if (expired) logger.info(`booking holds expired: ${expired}`);
  return { expired, scanned: due.length };
};

const TICK_MS = 30 * 1000;

const startHoldExpiryScheduler = () => {
  const run = () => expireHolds().catch((err) => {
    logger.error(`Hold expiry job failed: ${err.message}`);
  });
  setTimeout(run, 15 * 1000).unref();
  setInterval(run, TICK_MS).unref();
};

module.exports = {
  HOLD_OPEN,
  holdDurationMs,
  computeHoldExpiresAt,
  placeHold,
  releaseHold,
  expireHolds,
  startHoldExpiryScheduler,
};
