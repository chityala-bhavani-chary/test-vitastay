import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Box, TextField, Button, Typography, Link, Alert, CircularProgress, InputAdornment,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSnackbar } from 'notistack';
import authService from '../../services/authService';
import { getErrorMessage } from '../../services/api';

const ForgotPasswordPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await authService.forgotPassword(data.email);
      setSubmitted(true);
      enqueueSnackbar('If the email exists, an OTP has been sent', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Forgot Password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your email and we will send you a one-time password to reset your account
      </Typography>

      {submitted && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Check your email for the OTP, then proceed to reset your password.
        </Alert>
      )}

      <TextField
        fullWidth
        label="Email Address"
        type="email"
        margin="normal"
        {...register('email', {
          required: 'Email is required',
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email address' },
        })}
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

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading}
        sx={{ mt: 3 }}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Reset OTP'}
      </Button>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link component={RouterLink} to="/auth/login" variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ArrowBackIcon fontSize="small" /> Back to login
        </Link>
        {submitted && (
          <Link component={RouterLink} to="/auth/reset-password" variant="body2">
            Enter OTP
          </Link>
        )}
      </Box>
    </Box>
  );
};

export default ForgotPasswordPage;
