import { createTheme, alpha } from '@mui/material/styles';

/** Vita Stay brand — matched to logo.png */
export const brand = {
  navy: '#002D62',
  navyDark: '#001A3D',
  navyMid: '#0A3A6E',
  navyLight: '#1A4F8A',
  teal: '#00A896',
  tealDark: '#008F7A',
  tealLight: '#2EC4B6',
  tealSoft: '#E6F7F5',
  mist: '#F0F5F9',
  charcoal: '#1C2B3A',
};

const sharedTypography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  h1: { fontWeight: 700, letterSpacing: '-0.02em' },
  h2: { fontWeight: 700, letterSpacing: '-0.02em' },
  h3: { fontWeight: 600, letterSpacing: '-0.01em' },
  h4: { fontWeight: 600, letterSpacing: '-0.01em' },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
};

const pressable = {
  transition: [
    'transform 0.16s cubic-bezier(0.22, 1, 0.36, 1)',
    'box-shadow 0.2s ease',
    'background 0.2s ease',
    'background-color 0.2s ease',
    'border-color 0.2s ease',
    'color 0.2s ease',
    'filter 0.2s ease',
  ].join(', '),
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover': { transform: 'translateY(-1px)' },
  },
  '&:active': { transform: 'translateY(1px) scale(0.97)' },
  '&.Mui-disabled': { transform: 'none', boxShadow: 'none', filter: 'none' },
};

const whiteButton = {
  color: `${brand.navy} !important`,
  backgroundColor: '#FFFFFF',
  backgroundImage: 'none',
  border: `1px solid ${alpha(brand.navy, 0.14)}`,
  boxShadow: `0 1px 3px ${alpha(brand.navyDark, 0.14)}`,
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover': {
      color: `${brand.navy} !important`,
      backgroundColor: brand.mist,
      backgroundImage: 'none',
      boxShadow: `0 2px 8px ${alpha(brand.navyDark, 0.18)}`,
    },
  },
  '&:active': {
    backgroundColor: alpha(brand.navy, 0.06),
    boxShadow: `inset 0 2px 4px ${alpha('#000', 0.12)}`,
  },
  '&.Mui-disabled': {
    color: `${alpha(brand.navy, 0.38)} !important`,
    backgroundColor: alpha('#FFFFFF', 0.7),
    backgroundImage: 'none',
    border: `1px dashed ${alpha(brand.navy, 0.2)}`,
    boxShadow: 'none',
  },
  '& .MuiButton-startIcon, & .MuiButton-endIcon, & .MuiSvgIcon-root': {
    color: 'inherit',
  },
};

const glassStyles = (mode) => ({
  MuiCssBaseline: {
    styleOverrides: {
      html: {
        scrollBehavior: 'auto',
      },
      body: {
        backgroundColor: mode === 'dark' ? brand.navyDark : brand.mist,
        overscrollBehaviorY: 'none',
      },
      '::-webkit-scrollbar-thumb': {
        background: mode === 'dark' ? alpha(brand.teal, 0.35) : alpha(brand.navy, 0.25),
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: mode === 'dark' ? alpha(brand.teal, 0.55) : alpha(brand.navy, 0.4),
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        borderRadius: 16,
        backgroundColor: mode === 'dark' ? '#0F2138' : '#FFFFFF',
        border: `1px solid ${mode === 'dark' ? alpha(brand.teal, 0.12) : alpha(brand.navy, 0.06)}`,
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        backgroundColor: mode === 'dark' ? '#0F2138' : '#FFFFFF',
        border: `1px solid ${mode === 'dark' ? alpha(brand.teal, 0.12) : alpha(brand.navy, 0.06)}`,
        boxShadow: mode === 'dark'
          ? `0 1px 2px ${alpha('#000', 0.24)}, 0 8px 20px ${alpha(brand.navyDark, 0.28)}`
          : `0 1px 2px ${alpha(brand.navy, 0.04)}, 0 8px 20px ${alpha(brand.navy, 0.06)}`,
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderRadius: 0,
        backgroundColor: brand.navyDark,
        borderRight: `1px solid ${alpha(brand.teal, 0.2)}`,
        color: '#ffffff',
        backgroundImage: 'none',
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: 'none',
        backgroundColor: brand.navyDark,
        borderBottom: `1px solid ${alpha(brand.teal, 0.2)}`,
        color: '#ffffff',
      },
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
      disableRipple: true,
    },
    styleOverrides: {
      root: {
        ...pressable,
        borderRadius: 10,
        fontWeight: 700,
        letterSpacing: '0.01em',
        lineHeight: 1.2,
        padding: '8px 18px',
        minHeight: 40,
        textTransform: 'none',
      },
      sizeSmall: {
        minHeight: 32,
        padding: '5px 14px',
        fontSize: '0.8125rem',
        borderRadius: 8,
      },
      sizeLarge: {
        minHeight: 48,
        padding: '12px 22px',
        fontSize: '0.95rem',
      },
      startIcon: {
        marginRight: 8,
        '& > *:nth-of-type(1)': { fontSize: '1.125rem' },
      },
      endIcon: {
        marginLeft: 8,
        '& > *:nth-of-type(1)': { fontSize: '1.125rem' },
      },
      containedPrimary: {
        backgroundColor: mode === 'dark' ? brand.teal : brand.navy,
        color: '#fff',
        border: 'none',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            backgroundColor: mode === 'dark' ? brand.tealLight : brand.navyMid,
            color: '#fff',
          },
        },
      },
      containedSecondary: {
        backgroundColor: brand.teal,
        color: '#fff',
        border: 'none',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': { backgroundColor: brand.tealDark, color: '#fff' },
        },
      },
      containedError: {
        backgroundColor: mode === 'dark' ? '#FF453A' : '#D32F2F',
        color: '#fff',
        border: 'none',
      },
      containedSuccess: {
        backgroundColor: mode === 'dark' ? '#30D158' : '#2E8B57',
        color: '#fff',
        border: 'none',
      },
      outlined: {
        backgroundColor: '#fff',
        border: `1px solid ${alpha(brand.navy, 0.18)}`,
        color: brand.navy,
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            backgroundColor: brand.mist,
            borderColor: alpha(brand.navy, 0.28),
            color: brand.navy,
          },
        },
      },
      outlinedPrimary: {
        backgroundColor: '#fff',
        border: `1px solid ${alpha(brand.navy, 0.22)}`,
        color: brand.navy,
      },
      outlinedError: {
        backgroundColor: '#fff',
        border: `1px solid ${alpha('#D32F2F', 0.4)}`,
        color: '#D32F2F',
      },
      text: {
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': { backgroundColor: alpha(brand.navy, 0.06) },
        },
      },
      textError: {
        color: '#D32F2F',
        backgroundColor: 'transparent',
        border: 'none',
      },
      // White pill only when forced via inherit on navy chrome (AppBar CTAs)
      containedInherit: whiteButton,
      outlinedInherit: whiteButton,
    },
  },
  MuiIconButton: {
    defaultProps: { disableRipple: true },
    styleOverrides: {
      root: {
        transition: 'transform 0.16s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.16s ease',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': { transform: 'translateY(-1px)' },
        },
        '&:active': { transform: 'scale(0.9)' },
        '&.Mui-disabled': { transform: 'none' },
      },
    },
  },
  MuiToggleButton: {
    defaultProps: { disableRipple: true },
    styleOverrides: {
      root: {
        ...pressable,
        textTransform: 'none',
        fontWeight: 600,
      },
    },
  },
  MuiFab: {
    defaultProps: { disableRipple: true },
    styleOverrides: {
      root: {
        ...pressable,
        color: brand.navy,
        backgroundColor: '#FFFFFF',
        boxShadow: `0 2px 8px ${alpha(brand.navyDark, 0.18)}`,
      },
      primary: {
        color: brand.navy,
        backgroundColor: '#FFFFFF',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': { backgroundColor: brand.mist, color: brand.navy },
        },
      },
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: {
        gap: 8,
        padding: '16px 24px',
        '& > :not(style) ~ :not(style)': { marginLeft: 0 },
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 10,
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: brand.teal,
          },
        },
        '& .MuiInputLabel-root.Mui-focused': {
          color: mode === 'dark' ? brand.tealLight : brand.tealDark,
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: brand.teal,
        },
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 8 },
      colorPrimary: {
        borderColor: alpha(mode === 'dark' ? brand.tealLight : brand.navy, 0.45),
        color: mode === 'dark' ? brand.tealLight : brand.navy,
      },
      colorSecondary: {
        borderColor: alpha(brand.teal, 0.5),
        color: mode === 'dark' ? brand.tealLight : brand.tealDark,
      },
      colorDefault: {
        borderColor: mode === 'dark' ? alpha('#fff', 0.25) : alpha(brand.navy, 0.25),
        color: mode === 'dark' ? alpha('#fff', 0.85) : brand.charcoal,
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      head: {
        backgroundColor: mode === 'dark' ? '#0F2138' : '#FFFFFF',
        color: mode === 'dark' ? '#F5FAFC' : brand.charcoal,
        fontWeight: 600,
      },
      stickyHeader: {
        backgroundColor: mode === 'dark' ? '#0F2138' : '#FFFFFF',
        color: mode === 'dark' ? '#F5FAFC' : brand.charcoal,
      },
    },
  },
  MuiTablePagination: {
    styleOverrides: {
      root: {
        color: mode === 'dark' ? alpha('#fff', 0.85) : brand.charcoal,
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 10,
        '&.Mui-selected': {
          backgroundColor: alpha(brand.teal, mode === 'dark' ? 0.18 : 0.12),
          color: mode === 'dark' ? brand.tealLight : brand.navy,
          '& .MuiListItemIcon-root': {
            color: mode === 'dark' ? brand.tealLight : brand.tealDark,
          },
          '&:hover': {
            backgroundColor: alpha(brand.teal, mode === 'dark' ? 0.24 : 0.16),
          },
        },
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        '&.Mui-selected': {
          color: mode === 'dark' ? brand.tealLight : brand.tealDark,
        },
      },
    },
  },
  MuiTabs: {
    styleOverrides: {
      indicator: { backgroundColor: brand.teal },
    },
  },
  MuiSwitch: {
    styleOverrides: {
      colorPrimary: {
        '&.Mui-checked': { color: brand.teal },
        '&.Mui-checked + .MuiSwitch-track': { backgroundColor: brand.teal },
      },
    },
  },
  MuiCheckbox: {
    styleOverrides: {
      colorPrimary: {
        '&.Mui-checked': { color: brand.teal },
      },
    },
  },
  MuiRadio: {
    styleOverrides: {
      colorPrimary: {
        '&.Mui-checked': { color: brand.teal },
      },
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      colorPrimary: {
        backgroundColor: mode === 'dark' ? alpha(brand.teal, 0.15) : alpha(brand.navy, 0.12),
      },
      barColorPrimary: {
        background: `linear-gradient(90deg, ${brand.navy} 0%, ${brand.teal} 100%)`,
      },
    },
  },
  MuiLink: {
    styleOverrides: {
      root: { color: mode === 'dark' ? brand.tealLight : brand.tealDark },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        color: mode === 'dark' ? '#F5FAFC' : brand.charcoal,
      },
    },
  },
});

export const createAppTheme = (mode = 'light') =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? brand.tealLight : brand.navy,
        light: mode === 'dark' ? '#5ED4C8' : brand.navyLight,
        dark: mode === 'dark' ? brand.teal : brand.navyDark,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: mode === 'dark' ? brand.teal : brand.teal,
        light: brand.tealLight,
        dark: brand.tealDark,
        contrastText: '#FFFFFF',
      },
      info: {
        main: mode === 'dark' ? '#4DB6AC' : '#00897B',
        light: brand.tealLight,
        dark: brand.tealDark,
      },
      success: {
        main: mode === 'dark' ? '#30D158' : '#2E8B57',
      },
      warning: {
        main: mode === 'dark' ? '#FFD60A' : '#E6A23C',
      },
      error: {
        main: mode === 'dark' ? '#FF453A' : '#D32F2F',
      },
      background: {
        default: 'transparent',
        paper: mode === 'dark' ? '#0F2138' : '#FFFFFF',
      },
      text: {
        primary: mode === 'dark' ? '#F5FAFC' : brand.charcoal,
        secondary: mode === 'dark' ? alpha('#FFFFFF', 0.65) : alpha(brand.navy, 0.65),
      },
      divider: mode === 'dark' ? alpha(brand.teal, 0.15) : alpha(brand.navy, 0.1),
    },
    typography: sharedTypography,
    shape: { borderRadius: 12 },
    components: glassStyles(mode),
  });

export default createAppTheme;
