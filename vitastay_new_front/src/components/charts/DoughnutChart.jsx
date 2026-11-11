import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useTheme, Box } from '@mui/material';

ChartJS.register(ArcElement, Tooltip, Legend);

const DoughnutChart = ({ labels, data: chartData, title, height = '100%', colors, compact = false, legend = true }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const data = useMemo(() => {
    const palette = colors || [
      theme.palette.primary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main,
      theme.palette.secondary.main,
      theme.palette.info?.main || '#5AC8FA',
    ];
    return {
      labels,
      datasets: [{
        data: chartData,
        backgroundColor: palette.slice(0, chartData.length),
        borderWidth: 0,
        hoverOffset: 0,
      }],
    };
  }, [labels, chartData, colors, theme]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 0,
    animation: false,
    cutout: '65%',
    plugins: {
      legend: {
        display: legend,
        position: 'bottom',
        labels: {
          color: theme.palette.text.secondary,
          usePointStyle: true,
          padding: compact ? 8 : 14,
          boxWidth: compact ? 8 : 10,
          font: { size: compact ? 11 : 12, weight: 600 },
        },
      },
      title: title ? { display: true, text: title, color: theme.palette.text.primary } : { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(28,28,30,0.9)' : 'rgba(255,255,255,0.95)',
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
  }), [theme, isDark, title, compact, legend]);

  return (
    <Box sx={{ height, width: '100%', minWidth: 0 }}>
      <Doughnut data={data} options={options} />
    </Box>
  );
};

export default DoughnutChart;
