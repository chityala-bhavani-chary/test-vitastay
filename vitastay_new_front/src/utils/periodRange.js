import dayjs from 'dayjs';

export const currentMonthKey = () => dayjs().format('YYYY-MM');

export const formatMonthLabel = (ym) => {
  if (!ym) return 'This month';
  const parsed = dayjs(`${ym}-01`);
  return parsed.isValid() ? parsed.format('MMM YYYY') : String(ym);
};

/** Short axis tick: "Sep" or "Jan '26" when the year changes. */
export const formatChartMonth = (ym, allKeys = []) => {
  const parsed = dayjs(`${ym}-01`);
  if (!parsed.isValid()) return String(ym);
  const years = new Set((allKeys || []).map((key) => String(key).slice(0, 4)));
  if (years.size > 1 && (parsed.month() === 0 || ym === allKeys[0])) {
    return parsed.format("MMM 'YY");
  }
  return parsed.format('MMM');
};

export const monthsEndingAt = (ym, count = 6) => {
  const end = dayjs(`${ym || currentMonthKey()}-01`);
  return Array.from({ length: count }, (_, i) => end.subtract(count - 1 - i, 'month').format('YYYY-MM'));
};

export const listPreviousMonths = (count = 24) =>
  Array.from({ length: count }, (_, i) => dayjs().subtract(i, 'month').format('YYYY-MM'));

export const monthsInLookback = (months) =>
  Array.from({ length: months }, (_, i) =>
    dayjs().subtract(months - 1 - i, 'month').format('YYYY-MM')
  );

export const monthBounds = (ym) => {
  const d = dayjs(`${ym}-01`);
  return {
    start: d.startOf('month').format('YYYY-MM-DD'),
    end: d.endOf('month').format('YYYY-MM-DD'),
  };
};

export const rangeBounds = (months) => ({
  start: dayjs().subtract(months - 1, 'month').startOf('month').format('YYYY-MM-DD'),
  end: dayjs().endOf('month').format('YYYY-MM-DD'),
});

export const defaultPeriod = () => ({ kind: 'month', month: currentMonthKey() });

export const periodBounds = (period) => {
  if (period?.kind === 'range') return rangeBounds(Number(period.months) || 6);
  return monthBounds(period?.month || currentMonthKey());
};

export const periodMonthKeys = (period) => {
  if (period?.kind === 'range') return monthsInLookback(Number(period.months) || 6);
  return [period?.month || currentMonthKey()];
};

export const fillMonthSeries = (rows, monthKeys, valueKey = 'total') =>
  monthKeys.map((month) => {
    const hit = (rows || []).find((row) => String(row.month_year) === String(month));
    return { month_year: month, total: Number(hit?.[valueKey] || 0) };
  });

export const sumSeries = (rows) =>
  (rows || []).reduce((sum, row) => sum + Number(row.total || 0), 0);

export const filterRowsByMonths = (rows, monthKeys, field = 'month_year') => {
  const set = new Set(monthKeys);
  return (rows || []).filter((row) => set.has(String(row[field])));
};

export const mergeCategoryTotals = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = row?.category || 'other';
    map.set(key, (map.get(key) || 0) + Number(row.total || row.amount || 0));
  });
  return [...map.entries()].map(([category, total]) => ({ category, total }));
};

export const prettyCategory = (value) =>
  String(value || 'other')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

