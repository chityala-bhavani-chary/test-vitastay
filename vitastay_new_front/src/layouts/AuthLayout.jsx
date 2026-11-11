import { Outlet } from 'react-router-dom';
import { Box, Typography, alpha, keyframes } from '@mui/material';
import { brand } from '../styles/theme';
import AtmosphereBackground from '../components/layout/AtmosphereBackground';

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: translateY(0); }
`;

const lineDraw = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`;

const AuthLayout = () => {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.1fr) minmax(0, 0.9fr)' },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <AtmosphereBackground />

      {/* Left — brand */}
      <Box
        component="aside"
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'center',
          px: { xs: 3, sm: 5, lg: 6 },
          pt: { xs: 5, lg: 6 },
          pb: { xs: 2.5, lg: 4.5 },
          minHeight: { xs: 'auto', lg: '100vh' },
          color: '#fff',
        }}
      >
        <Box
          sx={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: { xs: 2, lg: 0 },
          }}
        >
          <Box
            component="img"
            src="/images/logo.png"
            alt="Vita Stay"
            sx={{
              width: '100%',
              maxWidth: { xs: 220, sm: 280, lg: 340 },
              height: 'auto',
              display: 'block',
              mb: { xs: 3, lg: 4 },
              borderRadius: 3,
              boxShadow: `0 28px 56px ${alpha('#000', 0.4)}`,
              animation: `${fadeUp} 0.65s ease-out both`,
            }}
          />

          <Typography
            component="h1"
            sx={{
              fontFamily: '"Syne", sans-serif',
              fontWeight: 800,
              fontSize: { xs: '3rem', sm: '4rem', lg: '5rem' },
              letterSpacing: '-0.03em',
              lineHeight: 0.92,
              mb: 2,
              animation: `${fadeUp} 0.7s ease-out 0.08s both`,
            }}
          >
            VITA
            <Box
              component="span"
              sx={{
                display: 'block',
                background: `linear-gradient(90deg, ${brand.tealLight} 0%, #7EE8DC 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              STAY
            </Box>
          </Typography>

          <Box
            sx={{
              width: 72,
              height: 3.5,
              borderRadius: 2,
              bgcolor: brand.tealLight,
              mb: 3,
              mx: 'auto',
              transformOrigin: 'center',
              animation: `${lineDraw} 0.8s ease-out 0.35s both`,
            }}
          />

          <Typography
            sx={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: { xs: '1.05rem', sm: '1.15rem', lg: '1.3rem' },
              fontWeight: 400,
              fontStyle: 'italic',
              lineHeight: 1.65,
              color: alpha('#ffffff', 0.85),
              maxWidth: { xs: 340, lg: 440 },
              px: 1,
              animation: `${fadeUp} 0.75s ease-out 0.2s both`,
            }}
          >
            Intelligent infrastructure for modern living — every room, resident,
            and rupee syncing in real time.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            mt: { xs: 4, lg: 0 },
            animation: `${fadeUp} 0.7s ease-out 0.35s both`,
          }}
        >
          <Box sx={{ width: 24, height: 1, bgcolor: alpha('#fff', 0.35) }} />
          <Typography
            sx={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '0.68rem',
              fontWeight: 500,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: alpha('#ffffff', 0.5),
            }}
          >
            Powered by Vita Systems Pvt Ltd
          </Typography>
          <Box sx={{ width: 24, height: 1, bgcolor: alpha('#fff', 0.35) }} />
        </Box>
      </Box>

      {/* Right — form plane */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2.5, sm: 4, lg: 6 },
          py: { xs: 3, lg: 6 },
          '&::before': {
            content: '""',
            display: { xs: 'none', lg: 'block' },
            position: 'absolute',
            left: 0,
            top: '12%',
            bottom: '12%',
            width: 1,
            background: `linear-gradient(180deg, transparent, ${alpha('#fff', 0.25)}, transparent)`,
          },
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 420,
            bgcolor: '#fff',
            borderRadius: 3.5,
            p: { xs: 3.5, sm: 4.5 },
            boxShadow: `
              0 1px 0 ${alpha('#fff', 0.6)} inset,
              0 32px 64px ${alpha('#000', 0.28)},
              0 8px 24px ${alpha(brand.navyDark, 0.2)}
            `,
            animation: `${fadeUp} 0.75s ease-out 0.25s both`,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AuthLayout;
