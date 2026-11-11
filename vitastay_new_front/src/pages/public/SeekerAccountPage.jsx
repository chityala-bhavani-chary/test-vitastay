import { useEffect, useState } from 'react';
import { Link as RouterLink, Navigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Chip, Typography, alpha } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import useAuth from '../../hooks/useAuth';
import { brand } from '../../styles/theme';
import { OCCUPANCY_OPTIONS, ROLES } from '../../utils/constants';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';

const occupancyLabel = (value) =>
  OCCUPANCY_OPTIONS.find((row) => row.value === value)?.label || value;

const noticeData = (row) => {
  const raw = row?.data;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
};

const noticeHref = (row) => {
  const data = noticeData(row);
  const id = data.entity_id || data.booking_id;
  return id ? `/bookings/${id}` : '/account';
};

const cardSx = {
  display: 'block',
  textDecoration: 'none',
  color: 'inherit',
  p: 1.75,
  borderRadius: 2,
  bgcolor: '#fff',
  border: `1px solid ${alpha(brand.navy, 0.08)}`,
  transition: 'transform 140ms ease, box-shadow 140ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: `0 8px 20px ${alpha(brand.navy, 0.08)}`,
  },
};

const SeekerAccountPage = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [params] = useSearchParams();
  const listingCode = params.get('listing');
  const [bookings, setBookings] = useState([]);
  const [notices, setNotices] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || user?.role !== ROLES.SEEKER) return undefined;
    let cancelled = false;
    api.get('/bookings')
      .then(({ data }) => {
        if (!cancelled) setBookings(extractData(data) || []);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    api.get('/settings/notifications', { params: { limit: 12 } })
      .then(({ data }) => {
        if (!cancelled) setNotices(extractPaginated(data).data || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.role]);

  const markNoticeRead = (id) => {
    if (!id) return;
    api.patch(`/settings/notifications/${id}/read`).catch(() => {});
    setNotices((prev) => prev.map((row) => (row.id === id ? { ...row, is_read: true } : row)));
  };

  if (!isAuthenticated) {
    return <Navigate to="/account/login" replace />;
  }
  if (user?.role === ROLES.TENANT) {
    return <Navigate to="/dashboard/tenant" replace />;
  }
  if (user?.role !== ROLES.SEEKER) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography
        sx={{
          fontFamily: '"Syne", "DM Sans", sans-serif',
          fontWeight: 800,
          fontSize: { xs: '1.55rem', md: '1.85rem' },
          letterSpacing: '-0.03em',
          color: brand.navy,
          mb: 0.5,
        }}
      >
        {user.first_name} {user.last_name}
      </Typography>
      <Typography sx={{ color: alpha(brand.navy, 0.65), mb: 1 }}>
        {user.email}
        {user.phone ? ` · ${user.phone}` : ''}
      </Typography>
      <Typography sx={{ mb: 3, color: 'text.secondary' }}>
        Guest account — a booking request does not make you a resident until the PG confirms.
      </Typography>

      {listingCode && (
        <Box sx={{ mb: 2, p: 1.75, borderRadius: 2, bgcolor: alpha(brand.teal, 0.08), border: `1px solid ${alpha(brand.teal, 0.25)}` }}>
          <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>Continue to the listing to send a request.</Typography>
          <Button variant="contained" component={RouterLink} to={`/listings/${encodeURIComponent(listingCode)}`}>
            Back to listing
          </Button>
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      {notices.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography fontWeight={800} sx={{ color: brand.navy, mb: 1.25 }}>Updates</Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {notices.map((row) => (
              <Box
                key={row.id}
                component={RouterLink}
                to={noticeHref(row)}
                onClick={() => markNoticeRead(row.id)}
                sx={{
                  ...cardSx,
                  borderColor: row.is_read ? alpha(brand.navy, 0.08) : alpha(brand.teal, 0.35),
                  bgcolor: row.is_read ? '#fff' : alpha(brand.teal, 0.04),
                }}
              >
                <Typography fontWeight={row.is_read ? 650 : 800} sx={{ color: brand.navy }}>
                  {row.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                  {row.message}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {bookings.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography fontWeight={800} sx={{ color: brand.navy, mb: 1.25 }}>Your requests</Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {bookings.map((row) => (
              <Box
                key={row.id}
                component={RouterLink}
                to={`/bookings/${row.id}`}
                sx={{
                  ...cardSx,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={750} noWrap sx={{ color: brand.navy }}>
                    {row.listing_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {occupancyLabel(row.room_type)}
                    {row.move_in_date ? ` · move-in ${row.move_in_date}` : ''}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <Chip
                    size="small"
                    label={String(row.status || '').replace(/_/g, ' ')}
                    sx={{ textTransform: 'capitalize', fontWeight: 700 }}
                  />
                  {row.payment_status === 'paid' && <Chip size="small" color="success" label="Paid" />}
                  {row.payment_status === 'failed' && <Chip size="small" color="error" label="Failed" />}
                  {row.payment_status === 'refunded' && <Chip size="small" color="info" label="Refunded" />}
                  <ChevronRightIcon sx={{ color: 'text.disabled' }} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {bookings.length === 0 && notices.length === 0 && (
        <Box sx={{ mb: 3, p: 3, borderRadius: 2.5, bgcolor: '#fff', border: `1px dashed ${alpha(brand.navy, 0.2)}`, textAlign: 'center' }}>
          <Typography fontWeight={750} sx={{ color: brand.navy, mb: 0.5 }}>No requests yet</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Search published PGs and request a bed when you are ready.</Typography>
          <Button variant="contained" component={RouterLink} to="/search">Find a PG</Button>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" component={RouterLink} to="/search">Find a PG</Button>
        <Button variant="outlined" component={RouterLink} to="/account/saved">My saved</Button>
        <Button variant="text" onClick={() => logout()}>Sign out</Button>
      </Box>
    </Box>
  );
};

export default SeekerAccountPage;
