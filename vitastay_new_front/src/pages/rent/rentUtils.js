import dayjs from 'dayjs';

export const METHOD_LABELS = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank: 'Bank Transfer',
  online: 'Online',
};

export const methodLabel = (method) => METHOD_LABELS[method]
  || String(method || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const PENDING_GRACE_DAYS = 3;

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Label + MUI color for an unpaid invoice relative to its due date (positive = days late). */
export const dueIndicator = (daysPastDue, monthsPastDue = Math.floor(Math.max(0, daysPastDue) / 30)) => {
  if (daysPastDue > PENDING_GRACE_DAYS) {
    const months = monthsPastDue >= 1 ? ` (${plural(monthsPastDue, 'month')})` : '';
    return { label: `Overdue by ${plural(daysPastDue, 'day')}${months}`, color: 'error' };
  }
  if (daysPastDue >= 1) {
    const left = PENDING_GRACE_DAYS - daysPastDue;
    return {
      label: `${plural(daysPastDue, 'day')} late · ${left ? `${plural(left, 'day')} grace left` : 'last grace day'}`,
      color: 'warning',
    };
  }
  if (daysPastDue === 0) return { label: 'Due today', color: 'warning' };
  if (daysPastDue === -1) return { label: 'Due tomorrow', color: 'info' };
  return { label: `Due in ${plural(-daysPastDue, 'day')}`, color: 'info' };
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Mirrors the server: monthly rent ÷ days in the original due month × days pushed out. */
export const extensionQuote = (monthlyRent, actualDue, newDue) => {
  const from = dayjs(actualDue).startOf('day');
  const days = newDue ? dayjs(newDue).startOf('day').diff(from, 'day') : 0;
  const monthDays = from.daysInMonth();
  const perDay = (Number(monthlyRent) || 0) / monthDays;
  return {
    days,
    monthDays,
    perDay: round2(perDay),
    suggested: days > 0 ? round2(perDay * days) : 0,
  };
};
