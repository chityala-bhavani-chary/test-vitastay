import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { useTheme, Box } from '@mui/material';
import { chartTooltipBox, formatAxisRupee } from './chartFormat';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BarChart = ({
  labels,
  datasets,
  title,
  height = '100%',
  horizontal = false,
  onLabelClick,
  currency = true,
  legend = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const clickable = typeof onLabelClick === 'function';

  const data = useMemo(() => ({
    labels,
    datasets: datasets.map((ds) => ({
      borderRadius: 8,
      borderSkipped: false,
      barPercentage: 0.64,
      categoryPercentage: 0.7,
      ...ds,
    })),
  }), [labels, datasets]);

  const options = useMemo(() => ({
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 0,
    animation: false,
    layout: { padding: { top: 4, right: 12, left: 0, bottom: 0 } },
    onClick: (event, _elements, chart) => {
      if (!clickable || !chart) return;
      const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
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
        grid: {
          display: horizontal,
          color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,45,98,0.06)',
          drawBorder: false,
        },
        ticks: {
          color: theme.palette.text.secondary,
          maxRotation: 0,
          autoSkip: true,
          font: { size: 11, weight: 500 },
          callback: horizontal && currency ? formatAxisRupee : undefined,
        },
      },
      y: {
        border: { display: false },
        grid: {
          display: !horizontal,
          color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,45,98,0.06)',
          drawBorder: false,
        },
        ticks: {
          color: theme.palette.text.secondary,
          font: { size: 11 },
          callback: !horizontal && currency ? formatAxisRupee : undefined,
        },
        beginAtZero: true,
        grace: '8%',
      },
    },
  }), [theme, isDark, title, horizontal, clickable, onLabelClick, labels, currency, legend]);

  return (
    <Box sx={{ height, width: '100%', minWidth: 0 }}>
      <Bar data={data} options={options} />
    </Box>
  );
};

export default BarChart;
