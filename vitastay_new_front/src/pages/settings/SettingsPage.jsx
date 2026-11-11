import { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, TextField, Button, Typography, Divider, Tabs, Tab,
  CircularProgress, FormControlLabel, Switch,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, getErrorMessage } from '../../services/api';
import { atmosphereTabsSx } from '../../styles/atmosphere';
import PlanBillingPanel from './PlanBillingPanel';
import useAuth from '../../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';

const SettingsPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { isOwner, isSuperAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const showPlan = isOwner || isSuperAdmin;
  const [tab, setTab] = useState(searchParams.get('tab') === 'plan' && showPlan ? 3 : 0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState({});
  const [notifyForm, setNotifyForm] = useState({
    email_enabled: true,
    sms_enabled: false,
    rent_due_email: true,
    complaint_email: true,
    rent_reminder_days: 3,
    alert_email: '',
  });
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [testing, setTesting] = useState(false);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      app_name: 'Vita Stay', currency: 'INR', timezone: 'Asia/Kolkata',
      rent_due_day: 5, late_fee_percent: 5, otp_expiry_minutes: 10,
    },
  });

  const supervisorForm = useForm({
    defaultValues: { email: '', password: '', first_name: '', last_name: '', phone: '', hostel_ids: '' },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/settings');
        const result = extractData(data) || {};
        setSettings(result);
        const n = result.notifications || {};
        setNotifyForm({
          email_enabled: n.email_enabled !== 'false' && n.email_enabled !== '0',
          sms_enabled: n.sms_enabled === 'true' || n.sms_enabled === '1',
          rent_due_email: n.rent_due_email !== 'false' && n.rent_due_email !== '0',
          complaint_email: n.complaint_email !== 'false' && n.complaint_email !== '0',
          rent_reminder_days: Number(n.rent_reminder_days) || 3,
          alert_email: n.alert_email || '',
        });
        setSmsAvailable(Boolean(result.delivery?.sms_available));
        const general = result.general || {};
        reset({
          app_name: general.app_name || 'Vita Stay',
          currency: general.currency || 'INR',
          timezone: general.timezone || 'Asia/Kolkata',
          rent_due_day: general.rent_due_day || 5,
          late_fee_percent: general.late_fee_percent || 5,
          otp_expiry_minutes: general.otp_expiry_minutes || 10,
        });
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [reset, enqueueSnackbar]);

  const onSaveGeneral = async (formData) => {
    setSubmitting(true);
    try {
      await api.put('/settings', { group: 'general', settings: formData });
      enqueueSnackbar('Settings saved successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveNotifications = async () => {
    setSubmitting(true);
    try {
      await api.put('/settings', {
        group: 'notifications',
        settings: {
          email_enabled: notifyForm.email_enabled,
          sms_enabled: notifyForm.sms_enabled,
          rent_due_email: notifyForm.rent_due_email,
          complaint_email: notifyForm.complaint_email,
          rent_reminder_days: Number(notifyForm.rent_reminder_days) || 3,
          alert_email: notifyForm.alert_email,
        },
      });
      enqueueSnackbar('Notification settings saved', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const onTestReminder = async () => {
    setTesting(true);
    try {
      const { data } = await api.post('/settings/notifications/test-reminder');
      enqueueSnackbar(data.message || 'Test reminder queued', {
        variant: data.data?.smtp_configured === false ? 'warning' : 'success',
      });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const onCreateSupervisor = async (formData) => {
    setSubmitting(true);
    try {
      await api.post('/settings/supervisors', {
        ...formData,
        hostel_ids: formData.hostel_ids ? formData.hostel_ids.split(',').map((id) => Number(id.trim())) : [],
      });
      enqueueSnackbar('Supervisor created successfully', { variant: 'success' });
      supervisorForm.reset();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSkeleton variant="form" />;

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Preferences, supervisors, and your owner plan" />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, ...atmosphereTabsSx }}>
        <Tab label="General" />
        <Tab label="Supervisors" />
        <Tab label="Notifications" />
        {showPlan && <Tab label="Plan" />}
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>General Settings</Typography>
            <Box component="form" onSubmit={handleSubmit(onSaveGeneral)}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="App Name" {...register('app_name')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Currency" {...register('currency')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Timezone" {...register('timezone')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Rent Due Day" type="number" {...register('rent_due_day', { valueAsNumber: true })} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Late Fee (%)" type="number" {...register('late_fee_percent', { valueAsNumber: true })} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="OTP Expiry (minutes)" type="number" {...register('otp_expiry_minutes', { valueAsNumber: true })} />
                </Grid>
              </Grid>
              <Button type="submit" variant="contained" sx={{ mt: 3 }} disabled={submitting}>
                {submitting ? <CircularProgress size={24} /> : 'Save Settings'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>Create Supervisor</Typography>
            <Box component="form" onSubmit={supervisorForm.handleSubmit(onCreateSupervisor)}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="First Name" {...supervisorForm.register('first_name', { required: true })} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Last Name" {...supervisorForm.register('last_name', { required: true })} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Email" type="email" {...supervisorForm.register('email', { required: true })} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Password" type="password" {...supervisorForm.register('password', { required: true, minLength: 6 })} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Phone" {...supervisorForm.register('phone')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Hostel IDs (comma-separated)" {...supervisorForm.register('hostel_ids')} helperText="e.g. 1, 2, 3" />
                </Grid>
              </Grid>
              <Button type="submit" variant="contained" sx={{ mt: 3 }} disabled={submitting}>
                {submitting ? <CircularProgress size={24} /> : 'Create Supervisor'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>Notification Preferences</Typography>
            <Typography color="text.secondary" paragraph>
              These switches drive real rent-due and complaint emails. In-app bells still appear either way.
              {smsAvailable ? ' SMS is on when the toggle below is enabled.' : ' SMS is hidden until SMS_API_KEY is set on the server.'}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={notifyForm.email_enabled}
                      onChange={(e) => setNotifyForm((s) => ({ ...s, email_enabled: e.target.checked }))}
                    />
                  )}
                  label="Send email (rent + complaints)"
                />
              </Grid>
              {smsAvailable && (
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={notifyForm.sms_enabled}
                        onChange={(e) => setNotifyForm((s) => ({ ...s, sms_enabled: e.target.checked }))}
                      />
                    )}
                    label="Send SMS"
                  />
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={notifyForm.rent_due_email}
                      onChange={(e) => setNotifyForm((s) => ({ ...s, rent_due_email: e.target.checked }))}
                    />
                  )}
                  label="Rent due reminders"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={notifyForm.complaint_email}
                      onChange={(e) => setNotifyForm((s) => ({ ...s, complaint_email: e.target.checked }))}
                    />
                  )}
                  label="Complaint assigned / resolved"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Rent reminder (days before due)"
                  type="number"
                  value={notifyForm.rent_reminder_days}
                  onChange={(e) => setNotifyForm((s) => ({ ...s, rent_reminder_days: e.target.value }))}
                  helperText="Unpaid invoices in this window (and overdue) get an email"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Complaint alert email (CC)"
                  type="email"
                  value={notifyForm.alert_email}
                  onChange={(e) => setNotifyForm((s) => ({ ...s, alert_email: e.target.value }))}
                  helperText="Optional extra inbox when a complaint is assigned"
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={onSaveNotifications} disabled={submitting || testing}>
                {submitting ? <CircularProgress size={24} /> : 'Save Preferences'}
              </Button>
              <Button variant="outlined" onClick={onTestReminder} disabled={submitting || testing}>
                {testing ? <CircularProgress size={24} /> : 'Send test reminder'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {tab === 3 && showPlan && <PlanBillingPanel />}
    </Box>
  );
};

export default SettingsPage;
