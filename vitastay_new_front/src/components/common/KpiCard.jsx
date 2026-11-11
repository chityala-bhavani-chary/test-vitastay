import { Box, Card, Typography, alpha, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { brand } from '../../styles/theme';

const KpiCard = ({
  label,
  value,
  hint,
  icon: Icon,
  color = 'primary',
  to,
  meter,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tone = theme.palette[color]?.main || brand.teal;
  const paper = isDark ? '#0F2138' : '#FFFFFF';
  const pct = meter == null ? null : Math.max(0, Math.min(100, Number(meter) || 0));

  return (
    <Card
      component={to ? RouterLink : 'div'}
      to={to}
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        minHeight: 128,
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: `${isDark ? '#fff' : brand.charcoal} !important`,
        bgcolor: `${paper} !important`,
        backgroundImage: 'none',
        border: `1px solid ${isDark ? alpha(brand.teal, 0.16) : alpha(brand.navy, 0.08)}`,
        boxShadow: isDark
          ? `0 1px 2px ${alpha('#000', 0.28)}`
          : `0 1px 2px ${alpha(brand.navy, 0.04)}, 0 8px 24px ${alpha(brand.navy, 0.05)}`,
        borderRadius: 2.5,
        transition: 'transform 160ms ease, box-shadow 160ms ease',
        '&:hover': to
          ? {
            color: `${isDark ? '#fff' : brand.charcoal} !important`,
            transform: 'translateY(-2px)',
            boxShadow: isDark
              ? `0 8px 24px ${alpha('#000', 0.35)}`
              : `0 10px 28px ${alpha(brand.navy, 0.1)}`,
          }
          : undefined,
      }}
    >
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: tone }} />
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          px: 2,
          py: 1.75,
          pl: 2.25,
          minWidth: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
          <Typography
            sx={{
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              lineHeight: 1.2,
            }}
            noWrap
          >
            {label}
          </Typography>
          {Icon && (
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.25,
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(tone, isDark ? 0.2 : 0.1),
                color: tone,
                flexShrink: 0,
              }}
            >
              <Icon sx={{ fontSize: 18 }} />
            </Box>
          )}
        </Box>
        <Typography
          noWrap
          sx={{
            fontSize: { xs: '1.35rem', md: '1.5rem' },
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
            color: 'inherit',
          }}
        >
          {value}
        </Typography>
        {hint != null && hint !== false && (
          <Box
            sx={{
              mt: 0.5,
              fontSize: '0.75rem',
              color: 'text.secondary',
              lineHeight: 1.35,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {hint}
          </Box>
        )}
        {pct != null && (
          <Box
            sx={{
              mt: 'auto',
              pt: 1.5,
              height: 4,
              borderRadius: 99,
              bgcolor: alpha(tone, isDark ? 0.22 : 0.12),
              overflow: 'hidden',
            }}
          >
            <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: tone, borderRadius: 99 }} />
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default KpiCard;
