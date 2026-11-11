import { Box, Typography } from '@mui/material';

/**
 * logo.png is a square poster: full VS icon, then the wordmark, then a tagline.
 * The bar shows the complete icon (building + V + S), nothing clipped.
 */
const ICON = { x: 100, y: 96, w: 1054, h: 734, sheet: 1254 };

export const BrandMark = ({ height = 44 }) => {
  const scale = height / ICON.h;
  return (
    <Box
      aria-hidden
      sx={{
        width: Math.round(ICON.w * scale),
        height,
        borderRadius: '8px',
        bgcolor: '#fff',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <Box
        component="img"
        src="/images/logo.png"
        alt=""
        sx={{
          position: 'absolute',
          width: ICON.sheet * scale,
          height: ICON.sheet * scale,
          maxWidth: 'none',
          left: -ICON.x * scale,
          top: -ICON.y * scale,
        }}
      />
    </Box>
  );
};

const BrandLockup = ({ size = 44, showName = true, nameColor = '#fff' }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
    <BrandMark height={size} />
    {showName && (
      <Typography
        component="span"
        sx={{
          fontFamily: '"Syne", "DM Sans", sans-serif',
          fontWeight: 700,
          fontSize: size >= 36 ? '1.05rem' : '0.95rem',
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: nameColor,
          whiteSpace: 'nowrap',
        }}
      >
        Vita Stay
      </Typography>
    )}
  </Box>
);

export default BrandLockup;
