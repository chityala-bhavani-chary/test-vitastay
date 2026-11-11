import { alpha } from '@mui/material';
import { brand } from '../../styles/theme';

export const seekerFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: alpha(brand.navy, 0.02),
    transition: 'box-shadow 0.2s ease, background-color 0.2s ease',
    '&:hover': { bgcolor: alpha(brand.navy, 0.035) },
    '&.Mui-focused': {
      bgcolor: '#fff',
      boxShadow: `0 0 0 3px ${alpha(brand.teal, 0.18)}`,
    },
    '& fieldset': { borderColor: alpha(brand.navy, 0.12) },
    '&:hover fieldset': { borderColor: alpha(brand.navy, 0.28) },
    '&.Mui-focused fieldset': { borderColor: brand.teal, borderWidth: 1.5 },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: brand.tealDark },
};

export const seekerCardSx = {
  width: '100%',
  maxWidth: 460,
  mx: 'auto',
  bgcolor: '#fff',
  borderRadius: 3,
  p: { xs: 3, sm: 4 },
  border: `1px solid ${alpha(brand.navy, 0.08)}`,
  boxShadow: `0 12px 40px ${alpha(brand.navy, 0.08)}`,
};

export const seekerTitleSx = {
  fontFamily: '"Syne", "DM Sans", sans-serif',
  fontWeight: 800,
  fontSize: { xs: '1.55rem', sm: '1.75rem' },
  letterSpacing: '-0.03em',
  color: brand.navy,
  mb: 0.75,
};

export const seekerSubtitleSx = {
  fontFamily: '"DM Sans", sans-serif',
  fontSize: '0.95rem',
  color: alpha(brand.navy, 0.55),
  mb: 3,
  lineHeight: 1.5,
};
