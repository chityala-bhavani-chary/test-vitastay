/**
 * BIC-022 — My saved PGs (seeker only).
 */
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { Box, Button, Typography, alpha } from '@mui/material';
import useAuth from '../../hooks/useAuth';
import useWishlist from '../../hooks/useWishlist';
import { brand } from '../../styles/theme';
import { ROLES, formatCurrency } from '../../utils/constants';
import { listingCoverSrc, demoImage } from '../../utils/demoImages';
import SaveListingButton from '../../components/public/SaveListingButton';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const SavedListingsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const { items, loading, refresh } = useWishlist();

  if (!isAuthenticated) {
    return <Navigate to={`/account/login?next=${encodeURIComponent('/account/saved')}`} replace />;
  }
  if (user?.role !== ROLES.SEEKER) {
    return <Navigate to="/search" replace />;
  }

  if (loading && !items.length) return <LoadingSkeleton variant="dashboard" />;

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h4" fontWeight={800} sx={{ color: brand.navy, mb: 0.5 }}>
        My saved
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>
        PGs you hearted to compare later. Unpublished listings drop off this list automatically.
      </Typography>

      {!items.length ? (
        <Box sx={{ py: 4 }}>
          <Typography sx={{ mb: 2 }}>No saved PGs yet.</Typography>
          <Button component={RouterLink} to="/search" variant="contained">Find a PG</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {items.map((item) => {
            const to = `/listings/${encodeURIComponent(item.code || item.id)}`;
            const place = [item.area, item.city].filter(Boolean).join(', ');
            const cover = listingCoverSrc(item);
            return (
              <Box
                key={item.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '120px minmax(0, 1fr) auto',
                  gap: 1.5,
                  alignItems: 'center',
                  p: 1.25,
                  bgcolor: '#fff',
                  borderRadius: 2,
                  border: `1px solid ${alpha(brand.navy, 0.1)}`,
                }}
              >
                <Box
                  component={RouterLink}
                  to={to}
                  sx={{ display: 'block', borderRadius: 1.5, overflow: 'hidden', height: 88 }}
                >
                  <Box
                    component="img"
                    src={cover}
                    alt=""
                    onError={(event) => { event.currentTarget.src = demoImage('exterior', item.id); }}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
                <Box component={RouterLink} to={to} sx={{ textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                  <Typography fontWeight={750} sx={{ color: brand.navy }} noWrap>{item.name}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{place || 'PG & hostel'}</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5, color: brand.navy }}>
                    {item.monthly_rent != null ? `From ${formatCurrency(item.monthly_rent)} / mo` : 'See listing'}
                  </Typography>
                </Box>
                <SaveListingButton hostelId={item.id} code={item.code} />
              </Box>
            );
          })}
          <Button onClick={() => refresh()} size="small" sx={{ justifySelf: 'start' }}>Refresh</Button>
        </Box>
      )}
    </Box>
  );
};

export default SavedListingsPage;
