import { memo } from 'react';
import { Box, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import KpiCard from './KpiCard';

/**
 * Dashboard KPI wrapper — same visual language as OwnerDashboard KpiCard.
 * Keeps the StatCard API (title/value/subtitle/trend) used across ops pages.
 */
const StatCard = ({ title, value, subtitle, icon, trend, trendValue, color = 'primary', size = 'default' }) => {
  const isPositive = trend === 'up';
  const compact = size === 'small';

  let hint = subtitle || null;
  if (trend && trendValue) {
    hint = (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {isPositive ? (
          <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
        ) : (
          <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
        )}
        <Typography
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: isPositive ? 'success.main' : 'error.main',
          }}
        >
          {trendValue}
        </Typography>
        {subtitle ? (
          <Typography component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 0.5 }}>
            · {subtitle}
          </Typography>
        ) : null}
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', minHeight: compact ? 108 : 128, '& > *': { minHeight: 'inherit' } }}>
      <KpiCard label={title} value={value} hint={hint} icon={icon} color={color} />
    </Box>
  );
};

export default memo(StatCard);
