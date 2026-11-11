/**
 * Guest seeker signup (BKG-001). Separate from /auth/login.
 */
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Link, TextField, Typography, alpha,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from 'notistack';
import authService from '../../services/authService';
import { setCredentials } from '../../redux/slices/authSlice';
import { brand } from '../../styles/theme';
import { MOBILE_REGEX } from '../../utils/constants';
import { seekerCardSx, seekerFieldSx, seekerSubtitleSx, seekerTitleSx } from './seekerAuthStyles';

const safeNext = (value) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/account');

const SeekerRegisterPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    email_otp: '',
    phone_otp: '',
  });

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const sendCodes = async (event) => {
    event.preventDefault();
    setError('');
    const digits = String(form.phone).replace(/\D/g, '');
    const mobile = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!MOBILE_REGEX.test(mobile)) {
      setError('Enter a 10-digit Indian mobile number');
      return;
    }
    setBusy(true);
    try {
      await authService.requestSeekerOtp({ email: form.email, phone: form.phone });
      enqueueSnackbar('Codes sent to email and mobile', { variant: 'success' });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not send codes');
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await authService.registerSeeker(form);
      dispatch(setCredentials(data));
      enqueueSnackbar('Account created', { variant: 'success' });
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not create account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box component="form" onSubmit={step === 1 ? sendCodes : createAccount} noValidate sx={{ ...seekerCardSx, maxWidth: 520 }}>
      <Typography sx={seekerTitleSx}>Create a guest account</Typography>
      <Typography sx={seekerSubtitleSx}>
        For wishlists and booking. PG staff should use the operator sign-in.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {step === 1 ? (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
            <TextField required label="First name" value={form.first_name} onChange={set('first_name')} sx={seekerFieldSx} />
            <TextField required label="Last name" value={form.last_name} onChange={set('last_name')} sx={seekerFieldSx} />
          </Box>
          <TextField required fullWidth type="email" label="Email" value={form.email} onChange={set('email')} sx={{ ...seekerFieldSx, mb: 2 }} />
          <TextField required fullWidth label="Mobile" value={form.phone} onChange={set('phone')} helperText="10-digit Indian number" sx={{ ...seekerFieldSx, mb: 2 }} />
          <TextField
            required
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Password"
            value={form.password}
            onChange={set('password')}
            helperText="At least 8 characters"
            sx={{ ...seekerFieldSx, mb: 2.5 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton aria-label="Toggle password" onClick={() => setShowPassword((v) => !v)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ fontWeight: 800, py: 1.25 }}>
            {busy ? <CircularProgress size={22} color="inherit" /> : 'Send email and mobile codes'}
          </Button>
        </>
      ) : (
        <>
          <TextField required fullWidth label="Email code" value={form.email_otp} onChange={set('email_otp')} inputProps={{ maxLength: 6 }} sx={{ ...seekerFieldSx, mb: 2 }} />
          <TextField required fullWidth label="Mobile code" value={form.phone_otp} onChange={set('phone_otp')} inputProps={{ maxLength: 6 }} sx={{ ...seekerFieldSx, mb: 2.5 }} />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ fontWeight: 800, py: 1.25 }}>
            {busy ? <CircularProgress size={22} color="inherit" /> : 'Create account'}
          </Button>
          <Button type="button" fullWidth sx={{ mt: 1 }} onClick={() => setStep(1)} disabled={busy}>
            Back
          </Button>
        </>
      )}

      <Typography sx={{ mt: 3, color: alpha(brand.navy, 0.65) }}>
        Already have an account?{' '}
        <Link component={RouterLink} to={`/account/login${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`} fontWeight={700}>
          Sign in
        </Link>
      </Typography>
      <Typography sx={{ mt: 1, color: alpha(brand.navy, 0.5), fontSize: 13 }}>
        Operator / resident?{' '}
        <Link component={RouterLink} to="/auth/login">Staff login</Link>
      </Typography>
    </Box>
  );
};

export default SeekerRegisterPage;
