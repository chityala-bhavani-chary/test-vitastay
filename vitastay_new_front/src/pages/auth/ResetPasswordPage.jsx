import { useState } from 'react';
import { Link as RouterLink, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Box, TextField, Button, Typography, Link, InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import PinIcon from '@mui/icons-material/Pin';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSnackbar } from 'notistack';
import authService from '../../services/authService';
import { getErrorMessage } from '../../services/api';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      email: searchParams.get('email') || '',
      otp: searchParams.get('otp') || '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await authService.resetPassword({
        email: data.email,
        otp: data.otp,
        newPassword: data.newPassword,
      });
      enqueueSnackbar('Password reset successfully. Please sign in.', { variant: 'success' });
      navigate('/auth/login', { replace: true });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Reset Password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter the OTP sent to your email and choose a new password
      </Typography>

      <TextField
        fullWidth
        label="Email Address"
        type="email"
        margin="normal"
        {...register('email', { required: 'Email is required' })}
        error={!!errors.email}
        helperText={errors.email?.message}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <EmailIcon color="action" fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        fullWidth
        label="OTP Code"
        margin="normal"
        {...register('otp', { required: 'OTP is required', minLength: { value: 4, message: 'Enter valid OTP' } })}
        error={!!errors.otp}
        helperText={errors.otp?.message}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <PinIcon color="action" fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        fullWidth
        label="New Password"
        type={showPassword ? 'text' : 'password'}
        margin="normal"
        {...register('newPassword', {
          required: 'Password is required',
          minLength: { value: 8, message: 'Minimum 8 characters' },
        })}
        error={!!errors.newPassword}
        helperText={errors.newPassword?.message}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LockIcon color="action" fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <TextField
        fullWidth
        label="Confirm Password"
        type={showPassword ? 'text' : 'password'}
        margin="normal"
        {...register('confirmPassword', {
          required: 'Please confirm password',
          validate: (val) => val === watch('newPassword') || 'Passwords do not match',
        })}
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword?.message}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading}
        sx={{ mt: 3 }}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : 'Reset Password'}
      </Button>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Link component={RouterLink} to="/auth/login" variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <ArrowBackIcon fontSize="small" /> Back to login
        </Link>
      </Box>
    </Box>
  );
};

export default ResetPasswordPage;
