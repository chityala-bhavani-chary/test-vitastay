/**
 * BIC-038 — owner submits PAN and UPI or a cancelled cheque. Admin verifies before publish.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Stack, TextField, Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import api, { extractData, getErrorMessage } from '../../services/api';

const OwnerKycPanel = ({ hostelId }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [pan, setPan] = useState('');
  const [gstin, setGstin] = useState('');
  const [upi, setUpi] = useState('');
  const [file, setFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/hostels/${hostelId}/owner-kyc`);
      setStatus(extractData(res));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [hostelId, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('pan', pan.trim().toUpperCase());
      if (gstin.trim()) form.append('gstin', gstin.trim().toUpperCase());
      if (upi.trim()) form.append('upi', upi.trim());
      if (file) form.append('bank_proof', file);
      const res = await api.post(`/hostels/${hostelId}/owner-kyc`, form);
      setStatus(extractData(res));
      setPan('');
      setFile(null);
      enqueueSnackbar('KYC submitted for verification', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const state = status?.status || 'none';
  const severity = state === 'verified' ? 'success' : state === 'rejected' ? 'error' : 'info';
  const copy = {
    none: 'Add PAN and a UPI ID or cancelled cheque before this PG can be published.',
    submitted: 'Submitted. Vita Stay will verify the proof before the listing can go public.',
    verified: 'Owner identity is verified. You can publish when the photo pack is ready.',
    rejected: status?.reject_reason || 'Verification was rejected. Update the details and submit again.',
  }[state];

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>Owner verification</Typography>
      <Alert severity={severity} sx={{ mb: 1.5 }}>{copy}</Alert>
      {state !== 'verified' && (
        <Stack spacing={1.25}>
          <TextField
            label="PAN"
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
            inputProps={{ maxLength: 10 }}
            placeholder="ABCDE1234F"
          />
          <TextField
            label="GSTIN (optional)"
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            inputProps={{ maxLength: 15 }}
          />
          <TextField
            label="UPI ID"
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="name@oksbi"
            helperText="Or upload a cancelled cheque below"
          />
          <Button variant="outlined" component="label" disabled={busy}>
            {file ? file.name : 'Upload cancelled cheque'}
            <input
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Button>
          <Button variant="contained" disabled={busy || pan.trim().length < 10} onClick={submit}>
            Submit for verification
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default OwnerKycPanel;
