/**
 * Owner/supervisor booking inbox (BKG-008). Confirm occupies (BKG-009).
 * Instant book occupies on pay. Hold with advance still needs Confirm.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography, alpha,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, getErrorMessage } from '../../services/api';
import { OCCUPANCY_OPTIONS, formatCurrency } from '../../utils/constants';
import { brand } from '../../styles/theme';

const occupancyLabel = (value) =>
  OCCUPANCY_OPTIONS.find((row) => row.value === value)?.label || value;

const BookingInboxPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bookings', { params: { status: 'open' } });
      setRows(extractData(data) || []);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const confirm = async (row) => {
    setSaving(true);
    try {
      await api.post(`/bookings/${row.id}/confirm`);
      enqueueSnackbar(
        row.booking_model === 'request_advance' && row.payment_status === 'paid'
          ? 'Guest is on Tenants as pending. Check them in when they arrive. Hold is on the opening invoice; the rest is still due.'
          : row.payment_status === 'paid'
            ? 'Guest is on Tenants as pending. First rent/deposit was already paid. Check them in when they arrive.'
            : 'Guest is on Tenants as pending. First rent/deposit is on the ledger. Check them in when they arrive.',
        { variant: 'success' }
      );
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setSaving(true);
    try {
      await api.post(`/bookings/${rejecting.id}/reject`, { reason });
      enqueueSnackbar(
        rejecting.payment_status === 'paid'
          ? 'Request declined. Full payment is being refunded. The bed is vacant again.'
          : 'Request declined. The bed is vacant again.',
        { variant: 'success' }
      );
      setRejecting(null);
      setReason('');
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  return (
    <Box>
      <PageHeader
        title="Booking requests"
        subtitle="Confirm occupies the bed and adds the guest as pending on Tenants. Check them in when they arrive. Yellow mattresses are website holds — walk-in needs a written reason."
      />
      {rows.length === 0 && (
        <Alert severity="info">No open requests. Guests who Request to book on a listing appear here.</Alert>
      )}
      <Box sx={{ display: 'grid', gap: 1.25 }}>
        {rows.map((row) => (
          <Box
            key={row.id}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: '#fff',
              border: `1px solid ${alpha(brand.navy, 0.08)}`,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
              <Typography fontWeight={700} sx={{ color: brand.navy }}>{row.code}</Typography>
              <Chip size="small" label={String(row.status || '').replace(/_/g, ' ')} sx={{ textTransform: 'capitalize' }} />
              {row.booking_badge && (
                <Chip size="small" variant="outlined" label={row.booking_badge} />
              )}
              {row.payment_status === 'paid' && (
                <Chip size="small" color="success" label={row.booking_model === 'request_advance' ? 'Hold paid' : 'Paid'} />
              )}
            </Box>
            <Typography>{row.listing_name}</Typography>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              {occupancyLabel(row.room_type)} · move-in {row.move_in_date}
              {row.amount_due != null ? ` · from ${formatCurrency(row.amount_due)} / month` : ''}
              {row.booking_model === 'request_advance' && row.amount_payable != null ? ` · hold ${formatCurrency(row.amount_payable)}` : ''}
            </Typography>
            {row.seeker && (
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                {row.seeker.first_name} {row.seeker.last_name}
                {row.seeker.phone ? ` · ${row.seeker.phone}` : ''}
                {row.seeker.email ? ` · ${row.seeker.email}` : ''}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" disabled={saving} onClick={() => confirm(row)}>
                Confirm
              </Button>
              <Button color="warning" disabled={saving} onClick={() => { setRejecting(row); setReason(''); }}>
                Reject
              </Button>
            </Box>
          </Box>
        ))}
      </Box>

      <Dialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} fullWidth maxWidth="sm">
        <DialogTitle>Decline this request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {rejecting?.payment_status === 'paid'
              ? `The guest will see this reason. They paid ${formatCurrency(rejecting.amount_payable || rejecting.refund_quote?.paid || 0)} — that full amount is refunded and the bed becomes vacant.`
              : 'The guest will see this reason. The held bed becomes vacant.'}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>Keep</Button>
          <Button color="warning" variant="contained" disabled={saving || reason.trim().length < 3} onClick={reject}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookingInboxPage;
