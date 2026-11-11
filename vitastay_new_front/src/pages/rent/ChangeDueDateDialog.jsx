import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, InputAdornment, Stack, TextField, Typography,
} from '@mui/material';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import { useSnackbar } from 'notistack';
import api, { extractData, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import { extensionQuote, plural } from './rentUtils';

const QUICK_DAYS = [3, 5, 7, 10, 15];
const fmt = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '—');
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
const alignToDay = (date, day) => {
  const month = dayjs(date).startOf('month');
  return month.date(Math.min(day, month.daysInMonth()));
};

const InfoRow = ({ label, value, strong, color }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.4 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={strong ? 700 : 500} color={color}>{value}</Typography>
  </Box>
);

/** `invoice`: { id, tenant_name, invoice_number, month_year } — null keeps the dialog closed. */
const ChangeDueDateDialog = ({ invoice, onClose, onDone }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newDue, setNewDue] = useState('');
  const [charge, setCharge] = useState('');
  const [chargeEdited, setChargeEdited] = useState(false);
  const [applyFuture, setApplyFuture] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setInfo(null);
    setNewDue('');
    setCharge('');
    setChargeEdited(false);
    setApplyFuture(false);
    setReason('');
    setLoading(true);
    api.get(`/rent/${invoice.id}/due-date`)
      .then(({ data }) => {
        const res = extractData(data);
        setInfo(res);
        setNewDue(dayjs(res.due_date).format('YYYY-MM-DD'));
        setCharge(String(res.extension_charge || 0));
        setChargeEdited(res.extension_charge > 0);
      })
      .catch((err) => {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
        onClose();
      })
      .finally(() => setLoading(false));
  }, [invoice, enqueueSnackbar, onClose]);

  const quote = useMemo(
    () => (info ? extensionQuote(info.amount, info.actual_due_date, newDue) : null),
    [info, newDue],
  );

  useEffect(() => {
    if (quote && !chargeEdited) setCharge(String(quote.suggested));
  }, [quote, chargeEdited]);

  if (!invoice) return null;

  const chargeNum = Number(charge);
  const chargeValid = charge !== '' && Number.isFinite(chargeNum) && chargeNum >= 0;
  const newTotal = info ? info.total_amount - info.extension_charge + (chargeValid ? chargeNum : 0) : 0;
  const balanceAfter = info ? Math.max(0, newTotal - info.paid_amount) : 0;
  const belowPaid = info && chargeValid && info.paid_amount - newTotal > 0.009;
  const unchanged = info && newDue === dayjs(info.due_date).format('YYYY-MM-DD')
    && chargeValid && Math.abs(chargeNum - info.extension_charge) < 0.005 && !applyFuture;
  const futureDay = newDue ? dayjs(newDue).date() : null;
  const futureNext = newDue && futureDay ? alignToDay(dayjs(newDue).add(1, 'month'), futureDay) : null;
  const canSave = info && newDue && dayjs(newDue).isValid() && chargeValid && !belowPaid && !unchanged && !saving;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/rent/${invoice.id}/due-date`, {
        due_date: newDue,
        extension_charge: chargeNum,
        apply_to_future: applyFuture,
        reason: reason.trim() || undefined,
      });
      enqueueSnackbar(data?.message || 'Due date updated', { variant: 'success' });
      onDone?.(extractData(data));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const daysLabel = quote
    ? (quote.days === 0 ? 'No change from the original due date'
      : quote.days > 0 ? `+${plural(quote.days, 'day')} after the original due date`
        : `${plural(-quote.days, 'day')} before the original due date`)
    : '';

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditCalendarIcon color="primary" />
        <Box>
          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Change Due Date</Typography>
          <Typography variant="caption" color="text.secondary">
            {invoice.tenant_name} · {invoice.invoice_number || `#${invoice.id}`}
            {invoice.month_year ? ` · ${dayjs(`${invoice.month_year}-01`).format('MMM YYYY')}` : ''}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading || !info ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
              <InfoRow label="Monthly rent" value={formatCurrency(info.amount)} />
              <InfoRow label="Actual due date" value={fmt(info.actual_due_date)} strong />
              {info.due_date !== info.actual_due_date && (
                <InfoRow label="Currently extended to" value={fmt(info.due_date)} color="warning.main" />
              )}
              {info.tenant?.rent_due_day && (
                <InfoRow label="Billing cycle" value={`${ordinal(info.tenant.rent_due_day)} of every month`} />
              )}
              {info.paid_amount > 0 && <InfoRow label="Paid so far" value={formatCurrency(info.paid_amount)} />}
            </Box>

            <Box>
              <TextField
                fullWidth
                type="date"
                label="New due date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText={daysLabel}
              />
              <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
                {QUICK_DAYS.map((d) => {
                  const target = dayjs(info.actual_due_date).add(d, 'day').format('YYYY-MM-DD');
                  return (
                    <Chip
                      key={d}
                      size="small"
                      label={`+${d} days`}
                      color={newDue === target ? 'primary' : 'default'}
                      variant={newDue === target ? 'filled' : 'outlined'}
                      onClick={() => setNewDue(target)}
                    />
                  );
                })}
                {info.due_date !== info.actual_due_date && (
                  <Chip
                    size="small"
                    label="Reset to original"
                    variant="outlined"
                    onClick={() => { setNewDue(dayjs(info.actual_due_date).format('YYYY-MM-DD')); setChargeEdited(false); }}
                  />
                )}
              </Stack>
            </Box>

            {quote && quote.days > 0 && (
              <Box sx={{ p: 1.5, borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Extension calculation</Typography>
                <InfoRow label="Difference" value={`${plural(quote.days, 'day')} (${fmt(info.actual_due_date)} → ${fmt(newDue)})`} />
                <InfoRow
                  label="Per-day rent"
                  value={`${formatCurrency(quote.perDay)} (${formatCurrency(info.amount)} ÷ ${quote.monthDays} days)`}
                />
                <InfoRow label="Calculated charge" value={formatCurrency(quote.suggested)} strong />
              </Box>
            )}

            <Box>
              <TextField
                fullWidth
                type="number"
                label="Extension charge to collect"
                value={charge}
                onChange={(e) => { setCharge(e.target.value); setChargeEdited(true); }}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                inputProps={{ min: 0, step: '0.01' }}
                error={!chargeValid || belowPaid}
                helperText={
                  !chargeValid ? 'Enter 0 or more'
                    : belowPaid ? 'Invoice total cannot go below the amount already paid'
                      : chargeEdited && quote && Math.abs(chargeNum - quote.suggested) > 0.005
                        ? `Edited (calculated ${formatCurrency(quote.suggested)})`
                        : 'Added to this invoice and collected with the rent. You can edit or waive it.'
                }
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={() => { setChargeEdited(false); setCharge(String(quote?.suggested || 0)); }}>
                  Use calculated
                </Button>
                <Button size="small" color="warning" onClick={() => { setChargeEdited(true); setCharge('0'); }}>
                  Waive (₹0)
                </Button>
              </Stack>
            </Box>

            <Box>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={applyFuture}
                    disabled={!info.is_latest}
                    onChange={(e) => setApplyFuture(e.target.checked)}
                  />
                )}
                label={futureDay
                  ? `Make the ${ordinal(futureDay)} the monthly due date from now on`
                  : 'Apply the new date to future months'}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                {info.is_latest
                  ? (applyFuture && futureNext
                    ? `Next rent will be due on ${fmt(futureNext)}, then the ${ordinal(futureDay)} of every month.`
                    : `Otherwise future rent stays due on the ${ordinal(info.tenant?.rent_due_day || dayjs(info.actual_due_date).date())} (joining-date cycle).`)
                  : 'Only available on the tenant\'s latest invoice.'}
              </Typography>
            </Box>

            <TextField
              fullWidth
              label="Reason (optional)"
              placeholder="e.g. Salary delayed, requested extension"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              inputProps={{ maxLength: 300 }}
            />

            <Divider />
            <Box>
              <InfoRow label="Invoice total" value={`${formatCurrency(info.total_amount)} → ${formatCurrency(newTotal)}`} />
              <InfoRow label="Balance to collect" value={formatCurrency(balanceAfter)} strong color="primary.main" />
            </Box>
            {quote && quote.days < 0 && (
              <Alert severity="info">The new date is earlier than the original due date, so no extension charge is calculated.</Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSave} startIcon={saving ? <CircularProgress size={16} /> : null}>
          Update Due Date
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChangeDueDateDialog;
