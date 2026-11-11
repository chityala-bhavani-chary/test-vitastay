/**
 * Guest listing chrome — no ERP drawer. Same brand colours as the operator app.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { AppBar, Badge, Box, Button, IconButton, Toolbar, Typography, alpha } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { brand } from '../styles/theme';
import BrandLockup from '../components/common/BrandLockup';
import useAuth from '../hooks/useAuth';
import { getDashboardPath } from '../utils/constants';
import api, { extractPaginated } from '../services/api';
import InstallAppBanner from '../components/pwa/InstallAppBanner';
import { WishlistProvider } from '../hooks/WishlistContext';

const GUEST_BG = '#E8EEF4';
const CONTENT_MAX = 1280;

const PublicListingLayout = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const isSeeker = user?.role === 'seeker';
  const homeTo = '/search';
  const isSearch = location.pathname === '/search'
    || location.pathname === '/listings'
    || location.pathname.startsWith('/pg/');
  const isSavedPage = location.pathname === '/account/saved';
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !isSeeker) {
      setUnread(0);
      return undefined;
    }
    let cancelled = false;
    api.get('/settings/notifications', { params: { unreadOnly: 'true', limit: 1 } })
      .then(({ data }) => {
        if (!cancelled) setUnread(extractPaginated(data).pagination?.total || 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, isSeeker]);

  return (
    <WishlistProvider>
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: `${GUEST_BG} !important`,
          color: brand.charcoal,
        }}
        data-public-shell="1"
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: brand.navyDark,
            pt: 'env(safe-area-inset-top)',
            borderBottom: `1px solid ${alpha('#fff', 0.08)}`,
          }}
        >
          <Toolbar sx={{ gap: { xs: 0.5, sm: 1 }, minHeight: 64, px: { xs: 1.5, md: 3 }, maxWidth: CONTENT_MAX, width: '100%', mx: 'auto' }}>
            <Box
              component={RouterLink}
              to={homeTo}
              aria-label="Vita Stay"
              sx={{ display: 'flex', alignItems: 'center', color: '#fff', textDecoration: 'none', minWidth: 0 }}
            >
              <BrandLockup />
            </Box>
            <Box sx={{ flex: 1 }} />
            <Button
              component={RouterLink}
              to="/search"
              color="inherit"
              startIcon={<SearchIcon />}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                bgcolor: isSearch ? alpha('#fff', 0.12) : 'transparent',
                fontWeight: 700,
              }}
            >
              Find a PG
            </Button>
            <IconButton component={RouterLink} to="/search" color="inherit" aria-label="Search PGs" sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
              <SearchIcon />
            </IconButton>
            {isSeeker && (
              <IconButton
                component={RouterLink}
                to="/account/saved"
                color="inherit"
                aria-label="My saved"
                sx={{ bgcolor: isSavedPage ? alpha('#fff', 0.12) : 'transparent' }}
              >
                <FavoriteBorderIcon />
              </IconButton>
            )}
            {isAuthenticated ? (
              <Button component={RouterLink} to={getDashboardPath(user?.role)} color="inherit" variant="outlined" size="small">
                {isSeeker ? (
                  <Badge color="error" badgeContent={unread} max={9} sx={{ '& .MuiBadge-badge': { right: -10, top: -2 } }}>
                    Account
                  </Badge>
                ) : 'Open ERP'}
              </Button>
            ) : (
              <>
                <Button component={RouterLink} to="/account/register" color="inherit" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                  Create account
                </Button>
                <Button
                  component={RouterLink}
                  to="/account/login"
                  size="small"
                  sx={{
                    color: `${brand.navy} !important`,
                    bgcolor: '#fff',
                    fontWeight: 700,
                    borderRadius: 999,
                    '&:hover': { bgcolor: brand.mist },
                  }}
                >
                  Sign in
                </Button>
              </>
            )}
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flex: 1,
            width: '100%',
            ...(isSearch
              ? { pb: 'calc(16px + env(safe-area-inset-bottom))' }
              : {
                maxWidth: CONTENT_MAX,
                mx: 'auto',
                px: { xs: 2, md: 3 },
                py: { xs: 2.5, md: 3.5 },
                pb: 'calc(24px + env(safe-area-inset-bottom))',
              }),
          }}
        >
          {!isSearch && <InstallAppBanner />}
          <Outlet />
        </Box>

        <Box
          component="footer"
          sx={{
            borderTop: `1px solid ${alpha(brand.navy, 0.08)}`,
            bgcolor: alpha('#fff', 0.55),
            mt: 'auto',
          }}
        >
          <Box
            sx={{
              maxWidth: CONTENT_MAX,
              mx: 'auto',
              px: { xs: 2, md: 3 },
              py: 2.5,
              pb: 'calc(16px + env(safe-area-inset-bottom))',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Box>
              <Typography fontWeight={800} sx={{ color: brand.navy, fontSize: '0.95rem', letterSpacing: '-0.02em' }}>
                Vita Stay
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Find a PG, request a bed, move in with clarity.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Button component={RouterLink} to="/search" size="small" color="inherit">Find a PG</Button>
              <Button component={RouterLink} to="/download" size="small" color="inherit">Downloads</Button>
              <Button component={RouterLink} to="/legal/vita-eye" size="small" color="inherit">Vita Eye privacy</Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </WishlistProvider>
  );
};

export default PublicListingLayout;
