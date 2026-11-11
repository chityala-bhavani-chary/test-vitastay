import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import authStorage from '../../utils/authStorage';
import {
  Box, TextField, Button, Typography, Link, FormControlLabel,
  Checkbox, InputAdornment, IconButton, Alert, CircularProgress, alpha,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useSnackbar } from 'notistack';
import useAuth from '../../hooks/useAuth';
import { brand } from '../../styles/theme';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: alpha(brand.navy, 0.02),
    transition: 'box-shadow 0.2s ease, background-color 0.2s ease',
    '&:hover': { bgcolor: alpha(brand.navy, 0.035) },
    '&.Mui-focused': {
      bgcolor: '#fff',
      boxShadow: `0 0 0 3px ${alpha(brand.teal, 0.18)}`,
    },
    '& fieldset': { borderColor: alpha(brand.navy, 0.12) },
    '&:hover fieldset': { borderColor: alpha(brand.navy, 0.28) },
    '&.Mui-focused fieldset': { borderColor: brand.teal, borderWidth: 1.5 },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: brand.tealDark },
};

const LoginPage = () => {
  const { login, loading, error, clearError } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: {
      email: authStorage.getSavedEmail(),
      password: '',
      rememberMe: authStorage.getRememberMePreference(),
    },
  });

  const onSubmit = async (data) => {
    clearError();
    const result = await login(data);
    if (result.success) {
      enqueueSnackbar('Welcome back!', { variant: 'success' });
    } else {
      enqueueSnackbar(result.error || 'Login failed', { variant: 'error' });
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography
        sx={{
          fontFamily: '"Syne", "DM Sans", sans-serif',
          fontWeight: 700,
          fontSize: '1.75rem',
          letterSpacing: '-0.03em',
          color: brand.navy,
          mb: 0.75,
        }}
      >
        Sign In
      </Typography>
      <Typography
        sx={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '0.9rem',
          color: alpha(brand.navy, 0.55),
          mb: 3.5,
          lineHeight: 1.5,
        }}
      >
        Enter your credentials to access your account
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      <TextField
        fullWidth
        label="Email Address"
        type="email"
        autoComplete="email"
        sx={{ ...fieldSx, mb: 2 }}
        {...register('email', {
          required: 'Email is required',
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email address' },
        })}
        error={!!errors.email}
        helperText={errors.email?.message}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <EmailOutlinedIcon sx={{ color: alpha(brand.navy, 0.4), fontSize: 20 }} />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        fullWidth
        label="Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        sx={fieldSx}
        {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
        error={!!errors.password}
        helperText={errors.password?.message}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LockOutlinedIcon sx={{ color: alpha(brand.navy, 0.4), fontSize: 20 }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                size="small"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 1.5,
          mb: 0.5,
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <FormControlLabel
          control={
            <Controller
              name="rememberMe"
              control={control}
              render={({ field }) => (
                <Checkbox
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  size="small"
                  sx={{
                    color: alpha(brand.navy, 0.35),
                    '&.Mui-checked': { color: brand.teal },
                  }}
                />
              )}
            />
          }
          label={
            <Typography sx={{ fontFamily: '"DM Sans", sans-serif', fontSize: '0.875rem', color: alpha(brand.navy, 0.7) }}>
              Remember me
            </Typography>
          }
        />
        <Link
          component={RouterLink}
          to="/auth/forgot-password"
          underline="hover"
          sx={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: brand.tealDark,
          }}
        >
          Forgot password?
        </Link>
      </Box>

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading}
        endIcon={!loading && <ArrowForwardRoundedIcon />}
        sx={{ mt: 3 }}
      >
        {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
      </Button>

      <Typography
        sx={{
          mt: 3,
          textAlign: 'center',
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '0.72rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: alpha(brand.navy, 0.35),
        }}
      >
        Encrypted session · Role-based access
      </Typography>
      <Typography sx={{ mt: 2, textAlign: 'center', fontSize: '0.875rem', color: alpha(brand.navy, 0.55) }}>
        Looking for a PG?{' '}
        <Link component={RouterLink} to="/account/register" underline="hover" sx={{ fontWeight: 600, color: brand.tealDark }}>
          Create a guest account
        </Link>
      </Typography>
    </Box>
  );
};

export default LoginPage;
