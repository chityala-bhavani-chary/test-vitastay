/**
 * BIC-029 — seeker books a visit/video slot. Never holds a bed.
 */
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Typography, alpha } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import api, { extractData, getErrorMessage } from '../../services/api';
import { brand } from '../../styles/theme';
import useAuth from '../../hooks/useAuth';

const VisitBookPanel = ({ idOrSlug, listingPath, preview }) => {
  const { isSeeker, isAuthenticated } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState(null);

  useEffect(() => {
    if (!idOrSlug || preview) {
      setSlots([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    api.get(`/public/listings/${encodeURIComponent(idOrSlug)}/visit-slots`)
      .then(({ data }) => {
        if (!cancelled) setSlots(extractData(data)?.items || []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [idOrSlug, preview]);

  const book = async (slotId) => {
    setBookingId(slotId);
    try {
      await api.post('/visits', { slot_id: slotId });
      enqueueSnackbar('Visit requested — no bed is held', { variant: 'success' });
      setSlots((prev) => prev.map((row) => (
        row.id === slotId
          ? { ...row, remaining: Math.max(0, row.remaining - 1), booked: row.booked + 1 }
          : row
      )).filter((row) => row.remaining > 0 || row.id !== slotId));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setBookingId(null);
    }
  };

  if (preview || loading) return null;
  if (!slots.length) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography fontWeight={700} sx={{ mb: 0.5, color: brand.navy }}>Schedule a visit</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
        See the PG or join a video tour before you pay. This does not reserve a bed.
      </Typography>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {slots.slice(0, 6).map((slot) => (
          <Box
            key={slot.id}
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              alignItems: 'center',
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: '#fff',
              border: `1px solid ${alpha(brand.navy, 0.08)}`,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 160 }}>
              <Typography fontWeight={650}>
                {dayjs(slot.starts_at).format('ddd D MMM · h:mm A')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {slot.visit_mode === 'video' ? 'Video tour' : 'Physical visit'}
                {' · '}
                {slot.remaining} left
              </Typography>
            </Box>
            <Chip size="small" label={slot.visit_mode === 'video' ? 'Video' : 'In person'} />
            {isSeeker ? (
              <Button
                size="small"
                variant="outlined"
                disabled={bookingId === slot.id || slot.remaining <= 0}
                onClick={() => book(slot.id)}
              >
                Book visit
              </Button>
            ) : (
              <Button
                size="small"
                component={RouterLink}
                to={isAuthenticated
                  ? listingPath
                  : `/account/login?next=${encodeURIComponent(listingPath)}`}
              >
                Sign in to book
              </Button>
            )}
          </Box>
        ))}
      </Box>
      {!isSeeker && !isAuthenticated && (
        <Alert severity="info" sx={{ mt: 1 }}>Create a guest account to request a visit.</Alert>
      )}
    </Box>
  );
};

export default VisitBookPanel;
