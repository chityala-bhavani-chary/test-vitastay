import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Box, Grid, TextField, Button, MenuItem, CircularProgress, Card, CardContent, Typography, Divider,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusChip from '../../components/common/StatusChip';
import api, { extractData, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import { printRentInvoice } from '../../utils/printRentInvoice';
import { METHOD_LABELS } from './rentUtils';

const CollectRentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm({
    defaultValues: {
      paid_amount: 0,
      paid_date: dayjs().format('YYYY-MM-DD'),
      payment_method: 'cash',
      payment_reference: '',
    },
  });

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const { data } = await api.get(`/rent/${id}`);
        const record = extractData(data);
        setPayment(record);
        const remainingAmt = Math.max(
          0,
          parseFloat(record?.total_amount || 0) - parseFloat(record?.paid_amount || 0)
        );
        setValue('paid_amount', remainingAmt);
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
        navigate('/rent');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPayment();
    else {
      enqueueSnackbar('Select a rent invoice to collect', { variant: 'warning' });
      navigate('/rent');
    }
  }, [id, navigate, enqueueSnackbar, setValue]);

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      await api.post(`/rent/${id}/collect`, formData);
      enqueueSnackbar('Payment collected successfully', { variant: 'success' });
      const { data } = await api.get(`/rent/${id}`);
      const updated = extractData(data);
      setPayment(updated);
      printRentInvoice({
        ...updated,
        receipt_amount: formData.paid_amount,
        payment_method: formData.payment_method,
        payment_reference: formData.payment_reference || null,
        paid_date: formData.paid_date,
      });
      navigate('/rent');
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSkeleton variant="form" />;

  const remaining = parseFloat(payment?.total_amount || 0) - parseFloat(payment?.paid_amount || 0);
  const tenantName = payment?.tenant?.full_name?.trim()
    || (payment?.tenant?.user ? `${payment.tenant.user.first_name || ''} ${payment.tenant.user.last_name || ''}`.trim() : '')
    || '—';

  return (
    <Box>
      <PageHeader
        title={`Collect Rent — ${payment?.month_year || ''}`}
        subtitle={payment?.hostel?.name ? `Hostel: ${payment.hostel.name}` : 'Collect payment for this month'}
        breadcrumbs={[{ label: 'Rent', path: '/rent' }, { label: 'Collect' }]}
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Payment Details</Typography>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Hostel</Typography>
                  <Typography fontWeight={600}>{payment?.hostel?.name || '—'}</Typography>
                </Box>
                <Box><Typography variant="caption" color="text.secondary">Tenant</Typography><Typography fontWeight={500}>{tenantName}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Month</Typography><Typography fontWeight={500}>{payment?.month_year}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Room</Typography><Typography fontWeight={500}>{payment?.room?.room_number || '—'}</Typography></Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Due Date</Typography>
                  <Typography fontWeight={500}>{payment?.due_date ? dayjs(payment.due_date).format('DD MMM YYYY') : '—'}</Typography>
                  {payment?.original_due_date && (
                    <Typography variant="caption" color="text.secondary">
                      Extended from {dayjs(payment.original_due_date).format('DD MMM YYYY')} (+{payment.extension_days} days)
                    </Typography>
                  )}
                </Box>
                {Number(payment?.extension_charge) > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Due Date Extension Charge</Typography>
                    <Typography fontWeight={500}>{formatCurrency(payment.extension_charge)}</Typography>
                  </Box>
                )}
                <Box><Typography variant="caption" color="text.secondary">Total Amount</Typography><Typography fontWeight={500}>{formatCurrency(payment?.total_amount)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Paid So Far</Typography><Typography fontWeight={500}>{formatCurrency(payment?.paid_amount)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Remaining</Typography><Typography fontWeight={700} color="warning.main">{formatCurrency(remaining)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Status</Typography><Box sx={{ mt: 0.5 }}><StatusChip status={payment?.status} /></Box></Box>
              </Box>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                sx={{ mt: 2.5 }}
                onClick={() => printRentInvoice(payment)}
              >
                Print Invoice
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Collect Amount for {payment?.month_year}
              </Typography>
              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Amount to Collect (₹)"
                      type="number"
                      {...register('paid_amount', {
                        valueAsNumber: true,
                        required: 'Amount is required',
                        min: { value: 1, message: 'Must be greater than 0' },
                        max: { value: remaining, message: `Cannot exceed ${formatCurrency(remaining)}` },
                      })}
                      error={!!errors.paid_amount}
                      helperText={errors.paid_amount?.message}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="Payment Date" type="date" InputLabelProps={{ shrink: true }} {...register('paid_date', { required: true })} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="payment_method"
                      control={control}
                      render={({ field }) => (
                        <TextField select fullWidth label="Payment Method" {...field}>
                          {Object.entries(METHOD_LABELS).map(([value, label]) => (
                            <MenuItem key={value} value={value}>{label}</MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="Reference / Transaction ID" {...register('payment_reference')} />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="outlined" onClick={() => navigate('/rent')}>Cancel</Button>
                  <Button type="submit" variant="contained" disabled={submitting || remaining <= 0}>
                    {submitting ? <CircularProgress size={24} /> : 'Collect Payment'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CollectRentPage;
