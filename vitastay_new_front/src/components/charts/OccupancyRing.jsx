import { Box, Typography, alpha, useTheme } from '@mui/material';
import { brand } from '../../styles/theme';

const OccupancyRing = ({ occupied = 0, vacant = 0, occupiedBeds, vacantBeds, lossLabel, size = 168 }) => {
  const theme = useTheme();
  const occ = Number(occupied) || 0;
  const vac = Number(vacant) || 0;
  const total = occ + vac;
  const rate = total ? Math.round((occ / total) * 100) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (rate / 100) * c;
  const track = alpha(theme.palette.text.primary, 0.1);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, minWidth: 0 }}>
      <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg viewBox="0 0 140 140" width="100%" height="100%">
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={track}
            strokeWidth="12"
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={brand.teal}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform="rotate(-90 70 70)"
          />
        </svg>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography sx={{ fontSize: size > 150 ? '1.85rem' : '1.45rem', fontWeight: 800, lineHeight: 1 }}>
            {rate}%
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.3 }}>
            occupied
          </Typography>
        </Box>
      </Box>
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: brand.teal, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Occupied</Typography>
          </Box>
          <Typography fontWeight={800} sx={{ fontSize: '1.35rem', lineHeight: 1.1 }}>{occ}</Typography>
        </Box>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: alpha(theme.palette.text.primary, 0.22), flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Vacant</Typography>
          </Box>
          <Typography fontWeight={800} sx={{ fontSize: '1.35rem', lineHeight: 1.1 }}>{vac}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {total} rooms
          {(Number(occupiedBeds) || 0) + (Number(vacantBeds) || 0) > 0
            ? ` · ${(Number(occupiedBeds) || 0) + (Number(vacantBeds) || 0)} beds`
            : ''}
        </Typography>
        {lossLabel && (
          <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700 }}>
            {lossLabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default OccupancyRing;
