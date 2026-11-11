import { alpha } from '@mui/material';
import { brand } from './theme';

/** Navy → teal gradient used on login and all authenticated pages */
export const atmosphereBackground = `
  radial-gradient(ellipse 80% 60% at 10% 20%, ${alpha(brand.teal, 0.28)} 0%, transparent 55%),
  radial-gradient(ellipse 70% 50% at 90% 80%, ${alpha(brand.navyLight, 0.5)} 0%, transparent 50%),
  linear-gradient(145deg, ${brand.navyDark} 0%, ${brand.navy} 38%, #006B72 72%, ${brand.tealDark} 100%)
`;

/**
 * Viewport-sized layer only. Never stretch with page height — that was painting
 * a document-tall grid/orbs on every scroll frame.
 */
export const atmosphereLayerSx = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  background: atmosphereBackground,
  contain: 'strict',
  transform: 'translateZ(0)',
};

export const atmosphereRootSx = {
  position: 'relative',
  background: 'transparent',
};

/**
 * Filter fields on calm ops (light mist) content — readable navy labels on white inputs.
 * Kept under this name so list pages do not need a mass import rename.
 */
export const atmosphereFilterSx = {
  '& .MuiInputLabel-root': { color: alpha(brand.navy, 0.65) },
  '& .MuiInputLabel-root.Mui-focused': { color: brand.tealDark },
  '& .MuiOutlinedInput-root': {
    color: brand.charcoal,
    bgcolor: '#fff',
    '& fieldset': { borderColor: alpha(brand.navy, 0.14) },
    '&:hover fieldset': { borderColor: alpha(brand.navy, 0.28) },
    '&.Mui-focused fieldset': { borderColor: brand.teal },
    '& .MuiSvgIcon-root': { color: alpha(brand.navy, 0.55) },
  },
  '& input::placeholder': { color: alpha(brand.navy, 0.4), opacity: 1 },
};

/** Dropdown menus for atmosphere filters — readable dark text on white paper */
export const atmosphereSelectMenuProps = {
  PaperProps: {
    sx: {
      bgcolor: '#fff',
      color: brand.charcoal,
      backgroundImage: 'none',
      '& .MuiMenuItem-root': {
        color: brand.charcoal,
        '&.Mui-selected': {
          bgcolor: alpha(brand.teal, 0.12),
          color: brand.navy,
        },
        '&:hover': { bgcolor: alpha(brand.navy, 0.06) },
      },
    },
  },
};

/** Tabs on calm light content */
export const atmosphereTabsSx = {
  '& .MuiTab-root': {
    color: alpha(brand.navy, 0.55),
    fontWeight: 700,
    '&.Mui-selected': { color: brand.navy },
  },
  '& .MuiTabs-indicator': { backgroundColor: brand.teal },
};

/** Outlined actions on calm ops — standard white secondary */
export const atmosphereOutlinedBtnSx = {
  color: `${brand.navy} !important`,
  border: `1px solid ${alpha(brand.navy, 0.18)}`,
  bgcolor: '#FFFFFF',
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover': {
      color: `${brand.navy} !important`,
      border: `1px solid ${alpha(brand.navy, 0.28)}`,
      bgcolor: brand.mist,
    },
  },
};

export const atmosphereGridSx = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `
    linear-gradient(${alpha('#fff', 0.035)} 1px, transparent 1px),
    linear-gradient(90deg, ${alpha('#fff', 0.035)} 1px, transparent 1px)
  `,
  backgroundSize: '64px 64px',
  maskImage: 'radial-gradient(ellipse 70% 70% at 30% 50%, black 20%, transparent 75%)',
};

export const atmosphereOrbPrimarySx = {
  position: 'absolute',
  width: 520,
  height: 520,
  borderRadius: '50%',
  background: `radial-gradient(circle, ${alpha(brand.tealLight, 0.32)} 0%, transparent 70%)`,
  top: -180,
  left: -100,
};

export const atmosphereOrbSecondarySx = {
  position: 'absolute',
  width: 400,
  height: 400,
  borderRadius: '50%',
  background: `radial-gradient(circle, ${alpha('#fff', 0.1)} 0%, transparent 70%)`,
  bottom: -120,
  right: '18%',
};
