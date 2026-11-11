/**
 * PKG-014 — Super Admin Vita Eye support queue.
 * Enrol failures and last-capture-too-old. Gold only — not a separate SKU.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, getErrorMessage } from '../../services/api';
import { atmosphereOutlinedBtnSx } from '../../styles/atmosphere';

const ISSUE_LABEL = {
  enrol_failure: 'Enrol failed',
  enrol_gap: 'Residents not enrolled',
  never_captured: 'Never captured',
  stale_capture: 'Last capture too old',
  notify_unconfirmed: 'Notification not confirmed',
};

const ISSUE_COLOR = {
  enrol_failure: 'error',
  enrol_gap: 'warning',
  never_captured: 'warning',
  stale_capture: 'error',
  notify_unconfirmed: 'info',
};

const VitaEyeQueuePage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await api.get('/super-admin/vita-eye');
        setQueue(extractData(data));
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [enqueueSnackbar]);

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  const items = queue?.items || [];

  return (
    <Box>
      <PageHeader
        title="Vita Eye support"
        subtitle="Gold playbook queue — enrol gaps and last-capture-too-old. Not a separate SKU."
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        Included in Gold. Open a PG to walk the owner through enrol, blocked list, one capture, and a notification.
        Stale means no capture in the last {queue?.stale_hours || 24} hours.
      </Alert>

      {items.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              No Gold PGs need help right now. Healthy galleries (residents enrolled, a recent notified capture) stay off this list.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        items.map((row) => (
          <Card key={row.id} sx={{ mb: 1.5 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography fontWeight={700}>{row.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {row.code} · {row.enrolled_residents} of {row.residents} residents enrolled
                    {row.last_captured_at
                      ? ` · last capture ${String(row.last_captured_at).slice(0, 16).replace('T', ' ')}`
                      : ' · never captured'}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                    {(row.issues || []).map((issue) => (
                      <Chip
                        key={issue}
                        size="small"
                        color={ISSUE_COLOR[issue] || 'default'}
                        label={ISSUE_LABEL[issue] || issue}
                      />
                    ))}
                  </Box>
                </Box>
                <Button
                  component={RouterLink}
                  to={`/hostels/${row.id}/vita-eye`}
                  variant="outlined"
                  sx={atmosphereOutlinedBtnSx}
                >
                  Open Vita Eye
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
};

export default VitaEyeQueuePage;
