import { useEffect, useRef, useState } from 'react';
import {
  Box, Grid, Card, CardContent, TextField, Button, Avatar, Typography, Divider,
  CircularProgress, Tabs, Tab, List, ListItem, ListItemText, IconButton, Tooltip,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import useAuth from '../../hooks/useAuth';
import authService from '../../services/authService';
import { updateUser } from '../../redux/slices/authSlice';
import { getInitials, getMediaUrl, ROLE_LABELS } from '../../utils/constants';
import { getErrorMessage } from '../../services/api';
import { brand } from '../../styles/theme';
import ImageSourceBar from '../../components/media/ImageSourceBar';

const ProfilePage = () => {
  const { user, refreshProfile } = useAuth();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      first_name: '', last_name: '', phone: '', email: '',
    },
  });

  const passwordForm = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user) {
      reset({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
  }, [user, reset]);

  useEffect(() => {
    if (tab === 2) {
      authService.getLoginHistory({ limit: 10 })
        .then((data) => setLoginHistory(data.data || []))
        .catch(() => {});
    }
  }, [tab]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onUpdateProfile = async (formData) => {
    setSubmitting(true);
    try {
      const profile = await authService.updateProfile({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
      });
      dispatch(updateUser(profile));
      enqueueSnackbar('Profile updated successfully', { variant: 'success' });
      await refreshProfile();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const onChangePassword = async (formData) => {
    if (formData.newPassword !== formData.confirmPassword) {
      enqueueSnackbar('Passwords do not match', { variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await authService.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      enqueueSnackbar('Password changed successfully', { variant: 'success' });
      passwordForm.reset();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAvatarClick = () => {
    if (!uploadingAvatar) fileInputRef.current?.click();
  };

  const applyAvatarFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      enqueueSnackbar('Please select an image file (JPG, PNG, or GIF)', { variant: 'warning' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      enqueueSnackbar('Image must be 5MB or smaller', { variant: 'warning' });
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return localPreview;
    });

    setUploadingAvatar(true);
    try {
      const profile = await authService.uploadAvatar(file);
      dispatch(updateUser(profile));
      enqueueSnackbar('Profile photo updated', { variant: 'success' });
      await refreshProfile();
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    await applyAvatarFile(file);
  };

  if (!user) return <LoadingSkeleton variant="form" />;

  const avatarSrc = previewUrl || getMediaUrl(user.avatar);

  return (
    <Box>
      <PageHeader title="Profile" subtitle="Manage your account settings" />

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ position: 'relative', width: 96, height: 96, mx: 'auto', mb: 2 }}>
                <Avatar
                  src={avatarSrc || undefined}
                  sx={{ width: 96, height: 96, bgcolor: 'primary.main', fontSize: '2rem' }}
                >
                  {getInitials(user.first_name, user.last_name)}
                </Avatar>
                <Tooltip title="Upload profile photo">
                  <IconButton
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar}
                    size="small"
                    sx={{
                      position: 'absolute',
                      right: -4,
                      bottom: -4,
                      bgcolor: brand.teal,
                      color: '#fff',
                      border: '2px solid #fff',
                      boxShadow: 2,
                      '&:hover': { bgcolor: brand.tealDark },
                      '&.Mui-disabled': { bgcolor: brand.teal, color: '#fff', opacity: 0.7 },
                    }}
                  >
                    {uploadingAvatar ? (
                      <CircularProgress size={16} sx={{ color: '#fff' }} />
                    ) : (
                      <PhotoCameraIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Tooltip>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  hidden
                  onChange={handleAvatarChange}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Use the camera or pick a photo
              </Typography>
              <ImageSourceBar
                multiple={false}
                accept="image/jpeg,image/png,image/gif,image/webp"
                disabled={uploadingAvatar}
                libraryLabel="Choose photo"
                cameraLabel="Use camera"
                onFiles={(files) => applyAvatarFile(files?.[0])}
              />
              <Typography variant="h6" fontWeight={600}>
                {user.first_name} {user.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {user.email}
              </Typography>
              <Typography variant="caption" color="primary" sx={{ textTransform: 'capitalize' }}>
                {ROLE_LABELS[user.role] || user.role}
              </Typography>
              {user.last_login && (
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
                  Last login: {dayjs(user.last_login).format('DD MMM YYYY, HH:mm')}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, pt: 1 }}>
              <Tab label="Personal Info" />
              <Tab label="Change Password" />
              <Tab label="Login History" />
            </Tabs>
            <Divider />
            <CardContent>
              {tab === 0 && (
                <Box component="form" onSubmit={handleSubmit(onUpdateProfile)}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="First Name" {...register('first_name', { required: true })} error={!!errors.first_name} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Last Name" {...register('last_name', { required: true })} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Email" disabled {...register('email')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Phone" {...register('phone')} />
                    </Grid>
                  </Grid>
                  <Button type="submit" variant="contained" sx={{ mt: 3 }} disabled={submitting}>
                    {submitting ? <CircularProgress size={24} /> : 'Save Changes'}
                  </Button>
                </Box>
              )}

              {tab === 1 && (
                <Box component="form" onSubmit={passwordForm.handleSubmit(onChangePassword)}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Current Password" type="password" {...passwordForm.register('currentPassword', { required: true })} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="New Password" type="password" {...passwordForm.register('newPassword', { required: true, minLength: 8 })} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Confirm Password" type="password" {...passwordForm.register('confirmPassword', { required: true })} />
                    </Grid>
                  </Grid>
                  <Button type="submit" variant="contained" sx={{ mt: 3 }} disabled={submitting}>
                    {submitting ? <CircularProgress size={24} /> : 'Change Password'}
                  </Button>
                </Box>
              )}

              {tab === 2 && (
                <List dense>
                  {loginHistory.length === 0 ? (
                    <Typography color="text.secondary">No login history available.</Typography>
                  ) : (
                    loginHistory.map((entry) => (
                      <ListItem key={entry.id} divider>
                        <ListItemText
                          primary={entry.status === 'success' ? 'Successful login' : `Failed: ${entry.failure_reason || 'Unknown'}`}
                          secondary={`${dayjs(entry.login_at).format('DD MMM YYYY, HH:mm')} • ${entry.ip_address || 'Unknown IP'}`}
                        />
                      </ListItem>
                    ))
                  )}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
