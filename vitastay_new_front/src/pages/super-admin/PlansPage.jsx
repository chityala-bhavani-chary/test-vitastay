/**
 * PKG-001 — Super Admin catalog. Empty INR keeps owner checkout off.
 */
import { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, FormControlLabel, Grid,
  Switch, TextField, Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import api, { extractData, getErrorMessage } from '../../services/api';

const emptyForm = {
  monthly_inr: '',
  yearly_inr: '',
  yearly_discount_pct: '',
  gst_pct: '18',
  is_active: true,
};

const checkoutOpen = (row) => {
  const month = Number(row?.monthly_inr);
  const year = Number(row?.yearly_inr);
  return (Number.isFinite(month) && month > 0) || (Number.isFinite(year) && year > 0);
};

const PlansPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [plans, setPlans] = useState([]);
  const [forms, setForms] = useState({});
  const [saving, setSaving] = useState('');

  const patchForm = (code, field, value) => {
    setForms((prev) => ({
      ...prev,
      [code]: { ...emptyForm, ...prev[code], [field]: value },
    }));
  };

  const load = () => {
    api.get('/super-admin/plans')
      .then(({ data }) => {
        const rows = extractData(data)?.plans || [];
        setPlans(rows);
        const next = {};
        rows.forEach((row) => {
          next[row.code] = {
            monthly_inr: row.monthly_inr ?? '',
            yearly_inr: row.yearly_inr ?? '',
            yearly_discount_pct: row.yearly_discount_pct ?? '',
            gst_pct: row.gst_pct ?? 18,
            is_active: row.is_active !== false,
          };
        });
        setForms(next);
      })
      .catch((err) => enqueueSnackbar(getErrorMessage(err), { variant: 'error' }));
  };

  useEffect(() => { load(); }, []);

  const save = async (code) => {
    setSaving(code);
    try {
      const body = forms[code] || emptyForm;
      const toNum = (v) => (v === '' || v == null ? null : Number(v));
      await api.put(`/super-admin/plans/${code}`, {
        monthly_inr: toNum(body.monthly_inr),
        yearly_inr: toNum(body.yearly_inr),
        yearly_discount_pct: toNum(body.yearly_discount_pct),
        gst_pct: toNum(body.gst_pct) ?? 18,
        is_active: body.is_active !== false,
      });
      enqueueSnackbar(`${code} catalog saved. Owner checkout uses these amounts only.`, { variant: 'success' });
      load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSaving('');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Owner packages"
        subtitle="Regular, Silver, and Gold live in master `plans` — not hard-coded rupees. Leave a period empty to keep that checkout off. GST is on the owner invoice, not guest bookings."
      />
      <Grid container spacing={2}>
        {plans.map((row) => {
          const form = forms[row.code] || emptyForm;
          const open = checkoutOpen(form);
          return (
            <Grid item xs={12} md={4} key={row.code}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
                    <Typography fontWeight={700}>{row.name}</Typography>
                    <Chip
                      size="small"
                      color={open && form.is_active ? 'success' : 'default'}
                      label={open && form.is_active ? 'Checkout open' : 'Checkout off'}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Monthly INR (excl. GST)"
                    value={form.monthly_inr}
                    onChange={(event) => patchForm(row.code, 'monthly_inr', event.target.value)}
                    sx={{ mb: 1.5 }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Yearly INR (excl. GST)"
                    value={form.yearly_inr}
                    onChange={(event) => patchForm(row.code, 'yearly_inr', event.target.value)}
                    sx={{ mb: 1.5 }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Yearly discount %"
                    value={form.yearly_discount_pct}
                    onChange={(event) => patchForm(row.code, 'yearly_discount_pct', event.target.value)}
                    helperText="Display only — yearly INR is the billed amount"
                    sx={{ mb: 1.5 }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="GST %"
                    value={form.gst_pct}
                    onChange={(event) => patchForm(row.code, 'gst_pct', event.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={form.is_active !== false}
                        onChange={(event) => patchForm(row.code, 'is_active', event.target.checked)}
                      />
                    )}
                    label="On sale"
                    sx={{ mb: 1.5, display: 'block' }}
                  />
                  <Button variant="contained" onClick={() => save(row.code)} disabled={saving === row.code}>
                    {saving === row.code ? <CircularProgress size={22} /> : 'Save'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default PlansPage;
