/**
 * BKG-013 cancellation / refund numbers. BIC-108 legal pages must quote this version.
 * Pre-occupancy only (held / awaiting_approval). Confirmed residents use notice-period settlement.
 */
const dayjs = require('dayjs');

const POLICY_VERSION = 'bkg-013.v1';
const SEEKER_FULL_HOURS = 48;

const POLICY_TEXT = [
  'Before the PG confirms you as a resident:',
  'If the PG declines your request, or gives that bed to a walk-in, we refund the full amount you paid (first month + deposit).',
  `If you cancel ${SEEKER_FULL_HOURS} hours or more before your move-in date, we refund the full amount you paid.`,
  `If you cancel less than ${SEEKER_FULL_HOURS} hours before move-in, we refund your security deposit and keep the first month as a cancellation fee.`,
  'After you are on the hostel roll, deposit settlement follows the hostel notice period — not this policy.',
].join(' ');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const paidTotalOf = (booking) => round2(
  (Number(booking.amount_due) || 0) + (Number(booking.deposit_due) || 0)
);

const hoursUntilMoveIn = (moveInDate, from = new Date()) => {
  if (!moveInDate) return 0;
  return dayjs(moveInDate).startOf('day').diff(dayjs(from), 'hour', true);
};

const quoteRefund = ({ booking, reason, from = new Date() } = {}) => {
  const paid = paidTotalOf(booking || {});
  const deposit = round2(Number(booking?.deposit_due) || 0);
  const rent = round2(Number(booking?.amount_due) || 0);
  const hours = hoursUntilMoveIn(booking?.move_in_date, from);
  const base = {
    policy_version: POLICY_VERSION,
    reason,
    paid,
    hours_until_move_in: Math.round(hours * 10) / 10,
  };

  if (reason === 'owner_reject' || reason === 'walkin_override' || reason === 'plan_lapse') {
    return { ...base, amount: paid, retained: 0, kind: 'full' };
  }

  if (hours >= SEEKER_FULL_HOURS) {
    return { ...base, amount: paid, retained: 0, kind: 'full' };
  }
  return { ...base, amount: deposit, retained: rent, kind: 'partial' };
};

const publicPolicy = () => ({
  version: POLICY_VERSION,
  seeker_full_refund_hours: SEEKER_FULL_HOURS,
  text: POLICY_TEXT,
  rules: [
    { when: 'owner_reject', refund: 'full' },
    { when: 'walkin_override', refund: 'full' },
    { when: 'plan_lapse', refund: 'full' },
    { when: `seeker_cancel_gte_${SEEKER_FULL_HOURS}h`, refund: 'full' },
    { when: `seeker_cancel_lt_${SEEKER_FULL_HOURS}h`, refund: 'deposit_only' },
  ],
});

module.exports = {
  POLICY_VERSION,
  SEEKER_FULL_HOURS,
  POLICY_TEXT,
  round2,
  paidTotalOf,
  hoursUntilMoveIn,
  quoteRefund,
  publicPolicy,
};
