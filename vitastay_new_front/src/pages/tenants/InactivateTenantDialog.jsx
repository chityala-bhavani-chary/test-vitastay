import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, List, ListItem, ListItemIcon, ListItemText, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SingleBedIcon from '@mui/icons-material/SingleBed';
import LockIcon from '@mui/icons-material/Lock';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import { useSnackbar } from 'notistack';
import api, { extractData, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/constants';

const tenantName = (row) => row?.full_name
  || `${row?.user?.first_name || ''} ${row?.user?.last_name || ''}`.trim()
  || 'this tenant';

const scopeParams = (row) => ({
  hostelId: row?.hostel_id || row?.hostel?.id,
  source: row?.source,
});

const InactivateTenantDialog = ({ tenant, onClose, onDone }) => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [checking, setChecking] = useState(false);
  const [dues, setDues] = useState(null);
  const [moveOutDate, setMoveOutDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setDues(null);
    setConfirmed(false);
    setMoveOutDate(dayjs().format('YYYY-MM-DD'));
    setChecking(true);
    api.get(`/tenants/${tenant.id}/dues`, { params: scopeParams(tenant) })
      .then(({ data }) => setDues(extractData(data)))
      .catch((err) => {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
        onClose();
      })
      .finally(() => setChecking(false));
  }, [tenant, enqueueSnackbar, onClose]);

  const hasDues = (dues?.pending_amount || 0) > 0;
  const room = dues?.room || tenant?.room;
  const bed = dues?.bed || tenant?.bed;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post(`/tenants/${tenant.id}/deactivate`, {
        ...scopeParams(tenant),
        hostel_id: scopeParams(tenant).hostelId,
        move_out_date: moveOutDate,
      });
      enqueueSnackbar(data?.message || 'Tenant marked inactive', { variant: 'success' });
      onDone();
    } catch (err) {
      const details = err.response?.data?.errors;
      if (err.response?.status === 409 && details) {
        setDues((prev) => ({ ...prev, pending_amount: details.pending_amount, pending_items: details.pending_items }));
      }
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(tenant)} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonOffIcon color="warning" />
        Mark {tenantName(tenant)} as Inactive?
      </DialogTitle>
      <DialogContent dividers>
        {checking || !dues ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4, justifyContent: 'center' }}>
            <CircularProgress size={24} />
            <Typography color="text.secondary">Verifying pending dues…</Typography>
          </Box>
        ) : (
          <>
            <List dense disablePadding>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {hasDues ? <ErrorIcon color="error" /> : <CheckCircleIcon color="success" />}
                </ListItemIcon>
                <ListItemText
                  primary={hasDues ? `Pending dues: ${formatCurrency(dues.pending_amount)}` : 'No pending dues'}
                  secondary={hasDues ? 'All dues must be cleared before the tenant can be marked inactive.' : 'Rent and charges are fully settled.'}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}><SingleBedIcon color={bed ? 'primary' : 'disabled'} /></ListItemIcon>
                <ListItemText
                  primary={bed
                    ? `Room ${room?.room_number || '—'} · Bed ${bed.bed_number} will be vacated`
                    : 'No bed currently allocated'}
                  secondary={bed ? 'The bed becomes available for new tenants immediately.' : null}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}><LockIcon color="action" /></ListItemIcon>
                <ListItemText primary="Tenant portal login will be disabled" />
              </ListItem>
              {dues.deposit_amount > 0 && (
                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}><AccountBalanceWalletIcon color="action" /></ListItemIcon>
                  <ListItemText
                    primary={`Security deposit on file: ${formatCurrency(dues.deposit_amount)}`}
                    secondary="Settle the refund as per hostel policy."
                  />
                </ListItem>
              )}
            </List>

            {hasDues ? (
              <>
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice</TableCell>
                      <TableCell>Month</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dues.pending_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.invoice_number || `#${item.id}`}</TableCell>
                        <TableCell>{item.month_year}</TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{item.status}</TableCell>
                        <TableCell align="right">{formatCurrency(item.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Alert severity="error" sx={{ mt: 2 }}>
                  Collect {formatCurrency(dues.pending_amount)} from the tenant first, then try again.
                </Alert>
              </>
            ) : (
              <>
                <TextField
                  type="date"
                  label="Move-out Date"
                  size="small"
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mt: 2, mb: 1 }}
                />
                <FormControlLabel
                  sx={{ display: 'flex' }}
                  control={<Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />}
                  label="I have verified the details and want to mark this tenant inactive"
                />
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        {hasDues ? (
          <Button variant="contained" onClick={() => navigate('/rent')}>Go to Rent Collection</Button>
        ) : (
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirm}
            disabled={checking || !dues || !confirmed || !moveOutDate || submitting}
          >
            {submitting ? 'Processing…' : 'Mark Inactive'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InactivateTenantDialog;
