import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Link, TextField, Typography, alpha,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useSnackbar } from 'notistack';
import useAuth from '../../hooks/useAuth';
import { brand } from '../../styles/theme';
import { seekerCardSx, seekerFieldSx, seekerSubtitleSx, seekerTitleSx } from './seekerAuthStyles';

const SeekerLoginPage = () => {
  const { login, loading, error, clearError } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const next = params.get('next') || '';

  const onSubmit = async (event) => {
    event.preventDefault();
    clearError();
    const result = await login({ email, password, portal: 'seeker', next });
    if (result.success) enqueueSnackbar('Welcome back', { variant: 'success' });
    else enqueueSnackbar(result.error || 'Sign in failed', { variant: 'error' });
  };

  return (
    <Box component="form" onSubmit={onSubmit} noValidate sx={seekerCardSx}>
      <Typography sx={seekerTitleSx}>Guest sign in</Typography>
      <Typography sx={seekerSubtitleSx}>
        For people looking for a PG. Staff and residents use the operator login.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={clearError}>{error}</Alert>}
      <TextField
        required
        fullWidth
        type="email"
        label="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        sx={{ ...seekerFieldSx, mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <EmailOutlinedIcon sx={{ color: alpha(brand.navy, 0.4), fontSize: 20 }} />
            </InputAdornment>
          ),
        }}
      />
      <TextField
        required
        fullWidth
        type={showPassword ? 'text' : 'password'}
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        sx={{ ...seekerFieldSx, mb: 2.5 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LockOutlinedIcon sx={{ color: alpha(brand.navy, 0.4), fontSize: 20 }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton aria-label="Toggle password" onClick={() => setShowPassword((v) => !v)} edge="end">
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ fontWeight: 800, py: 1.25 }}>
        {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
      </Button>
      <Typography sx={{ mt: 3, color: alpha(brand.navy, 0.65) }}>
        New here?{' '}
        <Link component={RouterLink} to={`/account/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} fontWeight={700}>
          Create a guest account
        </Link>
      </Typography>
      <Typography sx={{ mt: 1, color: alpha(brand.navy, 0.5), fontSize: 13 }}>
        Operator / resident?{' '}
        <Link component={RouterLink} to="/auth/login">Staff login</Link>
      </Typography>
    </Box>
  );
};

export default SeekerLoginPage;
