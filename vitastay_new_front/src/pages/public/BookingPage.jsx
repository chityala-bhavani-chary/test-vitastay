/**
 * Seeker booking status (BKG-006). Hosted checkout (BKG-011).
 * Receipt + status timeline layout.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography, alpha,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import api, { extractData, getErrorMessage } from '../../services/api';
import { OCCUPANCY_OPTIONS, ROLES, formatCurrency } from '../../utils/constants';
import { brand } from '../../styles/theme';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import BookingModelBadge from '../../components/public/BookingModelBadge';
import useAuth from '../../hooks/useAuth';
import { payBooking } from '../../utils/payRent';

const occupancyLabel = (value) =>
  OCCUPANCY_OPTIONS.find((row) => row.value === value)?.label || value;

const statusLabel = (status) => String(status || '').replace(/_/g, ' ');

const statusCopy = (booking) => {
  const model = booking.booking_model || 'approval_first';
  const until = booking.hold_expires_at
    ? new Date(booking.hold_expires_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  if (booking.status === 'held' && booking.hold_expires_at) {
    if (model === 'instant') {
      return `A bed is held until ${until}. Pay now. If payment succeeds, the bed is yours. The PG does not need to accept first.`;
    }
    if (model === 'request_advance') {
      return `A bed is held until ${until}. Pay a hold amount now. The PG still confirms. The rest is due after they accept.`;
    }
    return `A bed is held until ${until}. Search will not offer it to someone else. Pay first month + deposit here — you are not a resident until the PG confirms.`;
  }
  if (booking.status === 'awaiting_approval') {
    if (model === 'request_advance') {
      return 'Hold payment received. The PG still has to confirm. The rest of first month and deposit is due after they accept.';
    }
    return 'Payment received. The PG still has to confirm before you are on the hostel roll.';
  }
  if (booking.status === 'confirmed') {
    if (model === 'instant') {
      return 'Payment succeeded. The bed is yours. You are on the hostel roll as pending until the PG checks you in when you arrive.';
    }
    if (model === 'request_advance' && booking.payment_status === 'paid') {
      return 'The PG accepted this request. The bed is yours. You are pending until check-in. The hold is on your opening invoice; the rest is still due.';
    }
    return booking.payment_status === 'paid'
      ? 'The PG accepted this request. The bed is yours. You are pending until check-in. First rent and deposit are already paid.'
      : 'The PG accepted this request. The bed is yours. You are pending until check-in. First rent and deposit (if any) are on your tenant ledger.';
  }
  if (booking.status === 'rejected') {
    const reason = booking.reject_reason ? ` ${booking.reject_reason}` : '';
    if (booking.payment_status === 'refunded' || booking.refund?.status === 'processed') {
      return `The PG declined this request.${reason} ${formatCurrency(booking.refund?.amount || 0)} is being refunded.`;
    }
    return `The PG declined this request.${reason} That bed is free for someone else.`;
  }
  if (booking.status === 'expired') {
    return 'The hold ended. That bed is free for someone else. Send a new request if you still want it.';
  }
  if (booking.status === 'cancelled') {
    if (booking.payment_status === 'failed') {
      return 'Payment did not go through. That bed is free for someone else. Send a new request if you still want it.';
    }
    if (booking.payment_status === 'refunded' || booking.refund?.status === 'processed') {
      if (booking.refund?.kind === 'partial') {
        return `You cancelled. ${formatCurrency(booking.refund.amount)} is being refunded. ${formatCurrency(booking.refund.retained_amount)} was kept as the cancellation fee.`;
      }
      return `You cancelled. ${formatCurrency(booking.refund?.amount || 0)} is being refunded to the same UPI or card.`;
    }
    return 'You cancelled this request.';
  }
  return 'Request sent. The PG will accept or decline. You are not a resident in the ERP until then.';
};

const STEPS = [
  { key: 'requested', label: 'Requested' },
  { key: 'held', label: 'Bed held' },
  { key: 'awaiting_approval', label: 'Awaiting PG' },
  { key: 'confirmed', label: 'Confirmed' },
];

const stepIndexFor = (status) => {
  if (['rejected', 'expired', 'cancelled'].includes(status)) return -1;
  if (status === 'confirmed') return 3;
  if (status === 'awaiting_approval') return 2;
  if (status === 'held') return 1;
  return 0;
};

const BookingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isSeeker } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/bookings/${id}`);
        if (!cancelled) setBooking(extractData(data));
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [id]);

  if (!isAuthenticated) {
    return <Navigate to={`/account/login?next=${encodeURIComponent(`/bookings/${id}`)}`} replace />;
  }
  if (user?.role !== ROLES.SEEKER && user?.role !== ROLES.TENANT && user?.role !== ROLES.OWNER && user?.role !== ROLES.SUPER_ADMIN && user?.role !== ROLES.SUPERVISOR) {
    return <Navigate to="/dashboard" replace />;
  }

  const cancel = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/bookings/${id}/cancel`);
      setBooking(extractData(data));
      setConfirmCancel(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    setError('');
    try {
      const result = await payBooking(id);
      const { data } = await api.get(`/bookings/${id}`);
      setBooking(extractData(data));
      if (result?.already_paid) setError('');
    } catch (err) {
      if (!err.cancelled) setError(getErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <LoadingSkeleton variant="dashboard" />;
  if (error && !booking) {
    return <Alert severity="info" sx={{ borderRadius: 2 }}>{error}</Alert>;
  }

  const canCancel = isSeeker && ['requested', 'held', 'awaiting_approval'].includes(booking?.status);
  const payable = Number(booking?.amount_payable) || ((Number(booking?.amount_due) || 0) + (Number(booking?.deposit_due) || 0));
  const canPay = isSeeker
    && ['requested', 'held', 'awaiting_approval'].includes(booking?.status)
    && booking?.payment_status !== 'paid'
    && payable > 0;
  const activeStep = stepIndexFor(booking?.status);
  const terminal = activeStep < 0;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography
        sx={{
          fontFamily: '"Syne", "DM Sans", sans-serif',
          fontWeight: 800,
          fontSize: { xs: '1.5rem', md: '1.85rem' },
          letterSpacing: '-0.03em',
          color: brand.navy,
          mb: 0.5,
        }}
      >
        Booking receipt
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>
        {booking.code} · track payment and PG confirmation here
      </Typography>

      {/* Timeline */}
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 0.5, sm: 1 },
          mb: 2.5,
          p: 2,
          borderRadius: 2.5,
          bgcolor: '#fff',
          border: `1px solid ${alpha(brand.navy, 0.08)}`,
          overflowX: 'auto',
        }}
      >
        {terminal ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CancelOutlinedIcon sx={{ color: booking.status === 'rejected' ? 'error.main' : 'warning.main' }} />
            <Typography fontWeight={750} sx={{ color: brand.navy, textTransform: 'capitalize' }}>
              {statusLabel(booking.status)}
            </Typography>
          </Box>
        ) : STEPS.map((step, index) => {
          const done = index <= activeStep;
          return (
            <Box key={step.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 100 }}>
              {done
                ? <CheckCircleIcon sx={{ fontSize: 20, color: brand.tealDark }} />
                : <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: alpha(brand.navy, 0.28) }} />}
              <Typography
                variant="caption"
                fontWeight={done ? 800 : 600}
                sx={{ color: done ? brand.navy : alpha(brand.navy, 0.45) }}
              >
                {step.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Summary receipt */}
      <Box
        sx={{
          bgcolor: '#fff',
          borderRadius: 2.5,
          border: `1px solid ${alpha(brand.navy, 0.08)}`,
          boxShadow: `0 8px 24px ${alpha(brand.navy, 0.05)}`,
          overflow: 'hidden',
          mb: 2,
        }}
      >
        <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: `1px solid ${alpha(brand.navy, 0.06)}` }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            <Chip size="small" label={statusLabel(booking.status)} sx={{ textTransform: 'capitalize', fontWeight: 700 }} />
            <BookingModelBadge
              bookingModel={booking.booking_model}
              badge={booking.booking_badge}
              hint={booking.booking_hint}
            />
            {booking.payment_status && booking.payment_status !== 'none' && (
              <Chip
                size="small"
                color={booking.payment_status === 'paid' ? 'success' : booking.payment_status === 'failed' ? 'error' : booking.payment_status === 'refunded' ? 'info' : 'default'}
                label={booking.payment_status === 'paid' ? 'Paid' : statusLabel(booking.payment_status)}
                sx={{ textTransform: 'capitalize', fontWeight: 700 }}
              />
            )}
          </Box>
          <Typography fontWeight={800} sx={{ color: brand.navy, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
            {booking.listing_name}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {occupancyLabel(booking.room_type)} · move-in {booking.move_in_date}
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2, p: { xs: 2, md: 2.5 } }}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>Monthly rent</Typography>
            <Typography fontWeight={800} sx={{ color: brand.navy }}>
              {booking.amount_due != null ? formatCurrency(booking.amount_due) : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>Deposit</Typography>
            <Typography fontWeight={800} sx={{ color: brand.navy }}>
              {booking.deposit_due ? formatCurrency(booking.deposit_due) : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>Amount due now</Typography>
            <Typography fontWeight={800} sx={{ color: brand.navy, fontSize: '1.15rem' }}>
              {payable > 0 ? formatCurrency(payable) : '₹0'}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 2 }}>
            {statusCopy(booking)}
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {canPay && (
              <Button variant="contained" disabled={paying} onClick={pay} sx={{ fontWeight: 800, px: 2.5 }}>
                {paying
                  ? 'Opening checkout…'
                  : booking.booking_model === 'request_advance'
                    ? `Pay hold ${formatCurrency(payable)}`
                    : `Pay ${formatCurrency(payable)}`}
              </Button>
            )}
            {booking.listing_code && (
              <Button component={RouterLink} to={`/listings/${encodeURIComponent(booking.listing_code)}`} variant="outlined">
                Back to listing
              </Button>
            )}
            {isSeeker && (
              <Button component={RouterLink} to="/account" variant="outlined">My requests</Button>
            )}
            {canCancel && (
              <Button color="error" variant="text" disabled={saving} onClick={() => setConfirmCancel(true)}>
                Cancel request
              </Button>
            )}
            {!isSeeker && (
              <Button onClick={() => navigate('/hostels')}>Hostels</Button>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: alpha(brand.navy, 0.04), border: `1px solid ${alpha(brand.navy, 0.06)}` }}>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55, display: 'block' }}>
          Checkout is Razorpay hosted — we never collect card numbers.
          {booking.booking_model === 'instant'
            ? ' If payment succeeds, the bed is yours.'
            : booking.booking_model === 'request_advance'
              ? ' This is a hold amount. The PG still confirms. The rest is due after they accept.'
              : ' Payment does not occupy the bed until the PG confirms.'}
          {' '}Walk-in booking in the ERP is a separate path.
          {booking.refund_policy ? ` ${booking.refund_policy}` : ''}
        </Typography>
      </Box>

      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)} fullWidth maxWidth="sm">
        <DialogTitle>Cancel this request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {booking.payment_status === 'paid' && booking.refund_quote
              ? (booking.refund_quote.kind === 'partial'
                ? `${formatCurrency(booking.refund_quote.amount)} (deposit) will be refunded. ${formatCurrency(booking.refund_quote.retained)} first month is kept as the cancellation fee because move-in is under 48 hours away.`
                : `${formatCurrency(booking.refund_quote.amount)} will be refunded to the same UPI or card.`)
              : 'The held bed becomes vacant. You can send a new request later.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCancel(false)}>Keep request</Button>
          <Button color="error" variant="contained" disabled={saving} onClick={cancel}>
            {saving ? 'Cancelling…' : 'Cancel request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookingPage;
