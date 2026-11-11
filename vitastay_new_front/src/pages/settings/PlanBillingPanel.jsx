/**
 * PKG-006 — Settings → Plan. Copy from docs/17. Downgrade to Regular unpublishes.
 */
import { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, MenuItem, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import { changeOwnerPlan } from '../../utils/payRent';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';

const PLAN_COPY = {
  regular: 'Your PG is management-only. Guests cannot find it online.',
  silver: 'Guests can search, open your listing, and request a bed.',
  gold: 'Everything in Vita Stay, plus Vita Eye at the gate.',
};

const RANK = { regular: 0, silver: 1, gold: 2 };
const money = (value) => (value == null ? 'TBD' : formatCurrency(value));
const periodLabel = (period) => (period === 'year' ? 'Yearly' : period === 'month' ? 'Monthly' : 'Period not set');

const PlanBillingPanel = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState('');
  const [payload, setPayload] = useState(null);
  const [plan, setPlan] = useState('silver');
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/hostels', { params: { limit: 50 } })
      .then(({ data }) => {
        if (cancelled) return;
        const { data: list } = extractPaginated(data);
        setHostels(list);
        if (list[0]?.id) setHostelId(String(list[0].id));
      })
      .catch((err) => enqueueSnackbar(getErrorMessage(err), { variant: 'error' }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (!hostelId) return undefined;
    let cancelled = false;
    api.get(`/hostels/${hostelId}/plan`)
      .then(({ data }) => {
        if (cancelled) return;
        const next = extractData(data);
        setPayload(next);
        if (next?.plan) setPlan(next.plan);
        if (next?.plan_period === 'year' || next?.plan_period === 'month') setPeriod(next.plan_period);
      })
      .catch((err) => enqueueSnackbar(getErrorMessage(err), { variant: 'error' }));
    return () => { cancelled = true; };
  }, [hostelId, enqueueSnackbar]);

  const selected = (payload?.catalog || []).find((row) => row.code === plan);
  const priced = selected
    ? (period === 'year' ? selected.yearly_inr : selected.monthly_inr)
    : null;
  const gstPct = selected?.gst_pct || 0;
  const gst = priced != null ? Math.round(priced * gstPct) / 100 : null;
  const total = priced != null && gst != null ? Math.round((priced + gst) * 100) / 100 : null;
  const checkoutOpen = priced != null && priced > 0;
  const currentRank = RANK[payload?.plan] ?? 0;
  const targetRank = RANK[plan] ?? 0;
  const isDowngrade = targetRank < currentRank;
  const losesListing = isDowngrade && plan === 'regular';
  const alreadyOn = plan === payload?.plan && period === (payload?.plan_period || 'month');
  const canRenew = alreadyOn && checkoutOpen;
  const actionEnabled = Boolean(hostelId) && !paying && (isDowngrade || checkoutOpen);

  const refresh = async () => {
    const { data } = await api.get(`/hostels/${hostelId}/plan`);
    setPayload(extractData(data));
  };

  const submitChange = async ({ confirmUnpublish = false } = {}) => {
    setPaying(true);
    try {
      const result = await changeOwnerPlan(hostelId, {
        plan,
        period,
        confirm_unpublish: confirmUnpublish,
      });
      if (result?.action === 'downgraded') {
        enqueueSnackbar(
          plan === 'regular'
            ? 'Downgraded to Regular. The listing is unpublished.'
            : 'Plan downgraded.',
          { variant: 'success' }
        );
      } else {
        enqueueSnackbar(
          canRenew ? 'Plan renewed. GST invoice is on this page.' : 'Plan paid. GST invoice is on this page.',
          { variant: 'success' }
        );
      }
      await refresh();
    } catch (err) {
      if (err.response?.data?.errors?.needs_confirm) {
        setConfirm('unpublish');
        return;
      }
      if (!err.cancelled) enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const onSubmit = () => {
    if (losesListing && payload?.listing_published) {
      setConfirm('unpublish');
      return;
    }
    if (isDowngrade && plan === 'silver') {
      setConfirm('silver');
      return;
    }
    submitChange({ confirmUnpublish: losesListing });
  };

  const actionLabel = () => {
    if (paying) return <CircularProgress size={22} />;
    if (canRenew) return `Renew ${formatCurrency(total)} incl. GST`;
    if (alreadyOn) return 'Current package';
    if (losesListing) return 'Downgrade to Regular';
    if (isDowngrade) return 'Downgrade to Silver';
    if (!checkoutOpen) return 'Prices not set yet';
    const verb = targetRank > currentRank ? 'Upgrade' : 'Pay';
    return `${verb} ${formatCurrency(total)} incl. GST`;
  };

  if (loading) return <Typography color="text.secondary">Loading plans…</Typography>;

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>Owner plan</Typography>
      <Typography color="text.secondary" paragraph>
        Vita Stay charges a subscription per PG — Regular, Silver, or Gold — monthly or yearly.
        GST is added on the owner invoice. Pay again on the same package to renew — paid-until extends.
        There is no commission on guest bookings.
      </Typography>

      <TextField
        select
        size="small"
        label="PG"
        value={hostelId}
        onChange={(event) => setHostelId(event.target.value)}
        sx={{ minWidth: 260, mb: 2, ...atmosphereFilterSx }}
        SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
      >
        {hostels.map((row) => (
          <MenuItem key={row.id} value={String(row.id)}>{row.name}</MenuItem>
        ))}
      </TextField>

      {payload && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
              <Typography fontWeight={700}>{payload.name}</Typography>
              <Chip size="small" label={(payload.plan || 'regular').toUpperCase()} color="primary" />
              <Chip size="small" variant="outlined" label={periodLabel(payload.plan_period)} />
              <Chip size="small" variant="outlined" label={payload.plan_status || 'comp'} />
              {payload.listing_published ? (
                <Chip size="small" color="success" label="Listing live" />
              ) : (
                <Chip size="small" label="Listing unpublished" />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {payload.copy || PLAN_COPY[payload.plan] || PLAN_COPY.regular}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {periodLabel(payload.plan_period)}
              {payload.current_price != null ? ` · ${formatCurrency(payload.current_price)} excl. GST` : ' · Price TBD until finance fills INR'}
              {payload.plan_expires_at
                ? ` · ${payload.plan_status === 'comp' ? 'Comp until' : 'Paid until'} ${String(payload.plan_expires_at).slice(0, 10)}`
                : ' · Complimentary or unpaid starter'}
            </Typography>
            {payload.plan_status === 'grace' && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                Renewal is in grace. Pay this package to stay live. After grace the PG drops to Regular.
                Occupancy and tenants stay.
              </Typography>
            )}
            {payload.plan_status === 'lapsed' && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                This PG lapsed to Regular. Guests cannot find it online. Occupancy, tenants, and photos are unchanged. Renew Silver or Gold to list again.
              </Typography>
            )}
            {payload.downgrade_unpublishes && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                Downgrade to Regular will unpublish this listing. Guests will not find this PG online.
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {(payload?.catalog || []).map((row) => (
          <Grid item xs={12} md={4} key={row.code}>
            <Card
              variant={plan === row.code ? 'outlined' : 'elevation'}
              onClick={() => setPlan(row.code)}
              sx={{ height: '100%', cursor: 'pointer', borderColor: plan === row.code ? 'primary.main' : undefined }}
            >
              <CardContent>
                <Typography fontWeight={700}>{row.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 48 }}>
                  {row.copy || PLAN_COPY[row.code]}
                </Typography>
                <Typography sx={{ mt: 1 }}>Monthly {money(row.monthly_inr)}</Typography>
                <Typography>
                  Yearly {money(row.yearly_inr)}
                  {row.yearly_discount_pct != null ? ` · ${row.yearly_discount_pct}% off` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">GST {row.gst_pct}%</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          select
          size="small"
          label="Package"
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          sx={{ minWidth: 160, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          {(payload?.catalog || []).map((row) => (
            <MenuItem key={row.code} value={row.code}>{row.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Period"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          sx={{ minWidth: 140, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="month">Monthly</MenuItem>
          <MenuItem value="year">Yearly</MenuItem>
        </TextField>
        <Button
          variant="contained"
          color={losesListing ? 'warning' : 'primary'}
          onClick={onSubmit}
          disabled={!actionEnabled}
        >
          {actionLabel()}
        </Button>
      </Box>
      {!checkoutOpen && !isDowngrade && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Checkout stays off until Super Admin / finance fills this package’s INR amount.
        </Typography>
      )}

      <Typography fontWeight={700} sx={{ mb: 1 }}>GST invoices</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Invoice</TableCell>
            <TableCell>Plan</TableCell>
            <TableCell align="right">Taxable</TableCell>
            <TableCell align="right">GST</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(payload?.invoices || []).length === 0 ? (
            <TableRow><TableCell colSpan={6}>No owner invoices yet.</TableCell></TableRow>
          ) : payload.invoices.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.invoice_number}</TableCell>
              <TableCell>{row.plan} / {row.period}</TableCell>
              <TableCell align="right">{formatCurrency(row.amount_ex_gst)}</TableCell>
              <TableCell align="right">{formatCurrency(row.gst_amount)} ({row.gst_pct}%)</TableCell>
              <TableCell align="right">{formatCurrency(row.total)}</TableCell>
              <TableCell>{row.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={confirm === 'unpublish'} onClose={() => setConfirm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Unpublish this listing?</DialogTitle>
        <DialogContent>
          <Typography>
            Downgrade to Regular will unpublish the listing. Guests will not find this PG online,
            and open booking requests will expire. Occupancy and revenue stay in the ERP.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => { setConfirm(null); submitChange({ confirmUnpublish: true }); }}
          >
            Unpublish and downgrade
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirm === 'silver'} onClose={() => setConfirm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Downgrade to Silver?</DialogTitle>
        <DialogContent>
          <Typography>
            The listing stays online if it is published. Vita Eye at the gate will turn off.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { setConfirm(null); submitChange(); }}>
            Downgrade to Silver
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlanBillingPanel;
