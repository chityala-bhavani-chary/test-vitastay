/**
 * BIC-039 — Super Admin checklist for the Vita Stay verified badge.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import api, { extractData, getErrorMessage } from '../../services/api';
import useAuth from '../../hooks/useAuth';

const Row = ({ ok, label }) => (
  <Typography variant="body2" color={ok ? 'success.main' : 'text.secondary'}>
    {ok ? 'Ready' : 'Missing'} — {label}
  </Typography>
);

const VerifiedAdminPanel = ({ hostelId }) => {
  const { isSuperAdmin } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [criteria, setCriteria] = useState(null);

  const load = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await api.get(`/super-admin/hostels/${hostelId}/verified`);
      setCriteria(extractData(res));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  }, [hostelId, isSuperAdmin, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  if (!isSuperAdmin || !criteria) return null;

  const act = async (method) => {
    try {
      const res = method === 'delete'
        ? await api.delete(`/super-admin/hostels/${hostelId}/verified`)
        : await api.post(`/super-admin/hostels/${hostelId}/verified`);
      setCriteria(extractData(res));
      enqueueSnackbar(method === 'delete' ? 'Badge removed' : 'Badge granted', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>Vita Stay verified</Typography>
      <Alert severity={criteria.verified ? 'success' : 'info'} sx={{ mb: 1 }}>
        {criteria.verified
          ? 'This PG shows the verified badge on search and the listing.'
          : 'Only a Vita Stay admin can grant this. Owners cannot badge themselves.'}
      </Alert>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Row ok={criteria.photo_pack} label="photo pack minima" />
        <Row ok={criteria.address_pin} label="address pin" />
        <Row ok={criteria.owner_kyc} label="owner KYC verified" />
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={!criteria.ready} onClick={() => act('post')}>
          Grant badge
        </Button>
        <Button color="inherit" disabled={!criteria.verified} onClick={() => act('delete')}>
          Remove badge
        </Button>
      </Stack>
    </Box>
  );
};

export default VerifiedAdminPanel;
