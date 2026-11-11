import { formatCurrency } from '../../utils/constants';

export const formatAxisRupee = (value) => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `₹${n}`;
};

export const rupeeTooltip = {
  callbacks: {
    label: (ctx) => {
      const raw = ctx.parsed?.y ?? ctx.parsed?.x ?? ctx.raw ?? 0;
      return ` ${ctx.dataset.label}: ${formatCurrency(raw)}`;
    },
  },
};

export const chartTooltipBox = (theme, isDark) => ({
  backgroundColor: isDark ? 'rgba(15,33,56,0.94)' : 'rgba(255,255,255,0.96)',
  titleColor: theme.palette.text.primary,
  bodyColor: theme.palette.text.secondary,
  borderColor: theme.palette.divider,
  borderWidth: 1,
  padding: 10,
  cornerRadius: 10,
  displayColors: true,
  boxPadding: 4,
  ...rupeeTooltip,
});

export const areaFill = (color) => (context) => {
  const { chart } = context;
  const { ctx, chartArea } = chart || {};
  if (!chartArea) return `${color}22`;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, `${color}55`);
  gradient.addColorStop(1, `${color}00`);
  return gradient;
};
