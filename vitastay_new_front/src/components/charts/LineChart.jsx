import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { useTheme, Box } from '@mui/material';
import { areaFill, chartTooltipBox, formatAxisRupee } from './chartFormat';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const LineChart = ({
  labels,
  datasets,
  title,
  height = '100%',
  onLabelClick,
  selectedIndex = -1,
  currency = true,
  legend = true,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const clickable = typeof onLabelClick === 'function';
  const accent = theme.palette.primary.main;

  const data = useMemo(() => ({
    labels,
    datasets: datasets.map((ds, dsIndex) => {
      const color = ds.borderColor || (dsIndex === 0 ? accent : theme.palette.secondary.main);
      const fill = ds.fill ?? dsIndex === 0;
      return {
        ...ds,
        tension: 0.4,
        borderWidth: 2.5,
        fill,
        borderDash: ds.borderDash,
        borderColor: color,
        backgroundColor: fill === false ? 'transparent' : areaFill(color),
        pointHoverRadius: 7,
        pointBorderWidth: 2,
        pointBorderColor: '#fff',
        pointRadius: (labels || []).map((_, index) => (index === selectedIndex ? 6 : (clickable ? 3 : 0))),
        pointBackgroundColor: (labels || []).map((_, index) => (
          index === selectedIndex ? theme.palette.warning.main : color
        )),
      };
    }),
  }), [labels, datasets, selectedIndex, clickable, accent, theme.palette.secondary.main, theme.palette.warning.main]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 0,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 4, right: 8, left: 0, bottom: 0 } },
    onClick: (event, _elements, chart) => {
      if (!clickable || !chart) return;
      const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: false }, true);
      if (!points.length) return;
      const index = points[0].index;
      if (labels[index]) onLabelClick(labels[index], index);
    },
    plugins: {
      legend: {
        display: legend,
        position: 'top',
        align: 'end',
        labels: {
          color: theme.palette.text.secondary,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 12,
          boxWidth: 8,
          font: { size: 11, weight: 600 },
        },
      },
      title: title ? { display: true, text: title, color: theme.palette.text.primary } : { display: false },
      tooltip: chartTooltipBox(theme, isDark),
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: theme.palette.text.secondary,
          maxRotation: 0,
          autoSkip: true,
          font: { size: 11, weight: 500 },
        },
      },
      y: {
        border: { display: false },
        grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,45,98,0.06)', drawBorder: false },
        ticks: {
          color: theme.palette.text.secondary,
          font: { size: 11 },
          callback: currency ? formatAxisRupee : (v) => v,
          padding: 8,
        },
        beginAtZero: true,
        grace: '8%',
      },
    },
  }), [theme, isDark, title, clickable, onLabelClick, labels, currency, legend]);

  return (
    <Box sx={{ height, width: '100%', minWidth: 0 }}>
      <Line data={data} options={options} />
    </Box>
  );
};

export default LineChart;
