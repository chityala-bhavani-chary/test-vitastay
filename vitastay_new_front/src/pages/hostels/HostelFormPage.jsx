import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Box, Grid, TextField, Button, MenuItem, CircularProgress, Card, CardContent, Alert,
  Typography, alpha, FormControlLabel, Switch,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import useAuth from '../../hooks/useAuth';
import api, { extractData, getErrorMessage } from '../../services/api';
import { getMediaUrl } from '../../utils/constants';
import { brand } from '../../styles/theme';
import LegacyMediaNotice from '../../components/media/LegacyMediaNotice';
import ImageSourceBar from '../../components/media/ImageSourceBar';

const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const HostelFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isSuperAdmin, isOwner, isSupervisor } = useAuth();
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [legacyImages, setLegacyImages] = useState([]);
  const logoInputRef = useRef(null);

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: '', name_hi: '', code: '', description: '', description_hi: '', address: '', city: '', area: '', state: '', gender_policy: 'unisex',
      pincode: '', country: 'India', total_floors: 1, capacity: 0,
      electricity_charge: 0, security_deposit: 0, notice_period_months: 1,
      booking_model: 'approval_first', advance_percent: 20,
      supervisor_media_upload: true,
      contact_phone: '', contact_email: '', status: 'pending_approval',
    },
  });

  const currentStatus = watch('status');
  const bookingModel = watch('booking_model');

  useEffect(() => {
    if (!isEdit) return;
    const fetchHostel = async () => {
      try {
        const { data } = await api.get(`/hostels/${id}`);
        const hostel = extractData(data);
        reset({
          name: hostel.name || '',
          code: hostel.code || '',
          description: hostel.description || '',
          description_hi: hostel.description_hi || '',
          name_hi: hostel.name_hi || '',
          address: hostel.address || '',
          city: hostel.city || '',
          area: hostel.area || '',
          gender_policy: hostel.gender_policy || 'unisex',
          state: hostel.state || '',
          pincode: hostel.pincode || '',
          country: hostel.country || 'India',
          total_floors: hostel.total_floors || 1,
          capacity: hostel.capacity || 0,
          security_deposit: hostel.security_deposit || 0,
          notice_period_months: hostel.notice_period_months || 1,
          booking_model: hostel.booking_model || 'approval_first',
          advance_percent: hostel.advance_percent == null ? 20 : Number(hostel.advance_percent),
          supervisor_media_upload: hostel.supervisor_media_upload !== false,
          contact_phone: hostel.contact_phone || '',
          contact_email: hostel.contact_email || '',
          status: hostel.status || 'pending_approval',
        });
        setLogoPreview(hostel.logo ? getMediaUrl(hostel.logo) : '');
        setLogoFile(null);
        setLogoRemoved(false);
        setLegacyImages(Array.isArray(hostel.images) ? hostel.images.filter(Boolean) : []);
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
        navigate('/hostels');
      } finally {
        setLoading(false);
      }
    };
    fetchHostel();
  }, [id, isEdit, reset, navigate, enqueueSnackbar]);

  const acceptLogo = (file) => {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > LOGO_MAX_BYTES) {
      enqueueSnackbar('Use a PNG, JPG, WEBP, or GIF under 2 MB', { variant: 'warning' });
      return;
    }
    setLogoFile(file);
    setLogoRemoved(false);
    setLogoPreview(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setLogoRemoved(true);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'status' && !isSuperAdmin) return;
        if (value === undefined || value === null) return;
        payload.append(key, value);
      });
      if (logoFile) payload.append('logo', logoFile);
      else if (logoRemoved) payload.append('remove_logo', 'true');

      if (isEdit) {
        await api.put(`/hostels/${id}`, payload);
        enqueueSnackbar('Hostel updated successfully', { variant: 'success' });
      } else {
        const { data } = await api.post('/hostels', payload);
        const message = data?.message || (isSuperAdmin
          ? 'Hostel created successfully'
          : 'Branch submitted for Super Admin approval');
        enqueueSnackbar(message, { variant: 'success' });
      }
      navigate('/hostels');
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSkeleton variant="form" />;

  return (
    <Box>
      <PageHeader
        title={isEdit ? 'Edit Branch' : isSuperAdmin ? 'Add Hostel' : 'Add Branch'}
        breadcrumbs={[
          { label: 'Hostels', path: '/hostels' },
          { label: isEdit ? 'Edit' : isSuperAdmin ? 'New' : 'New Branch' },
        ]}
        subtitle={!isEdit && !isSuperAdmin ? 'New branches require Super Admin approval before going live' : undefined}
      />

      {!isEdit && !isSuperAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          After you create this branch, its status will be <strong>Pending Approval</strong> until a Super Admin reviews and activates it.
        </Alert>
      )}

      {isEdit && currentStatus === 'pending_approval' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This branch is waiting for Super Admin approval.
        </Alert>
      )}

      {isEdit && currentStatus === 'rejected' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          This branch registration was rejected by Super Admin.
        </Alert>
      )}

      <LegacyMediaNotice images={legacyImages} />

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box
                  onClick={() => logoInputRef.current?.click()}
                  onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    acceptLogo(event.dataTransfer.files?.[0]);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') logoInputRef.current?.click();
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: '1.5px dashed',
                    borderColor: dragOver ? brand.teal : alpha(brand.navy, 0.2),
                    bgcolor: dragOver ? alpha(brand.teal, 0.08) : alpha(brand.navy, 0.03),
                  }}
                >
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: 2,
                      flexShrink: 0,
                      overflow: 'hidden',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: '#fff',
                      border: `1px solid ${alpha(brand.navy, 0.08)}`,
                    }}
                  >
                    {logoPreview ? (
                      <Box component="img" src={logoPreview} alt="Branch logo preview" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <ImageOutlinedIcon sx={{ color: alpha(brand.navy, 0.35) }} />
                    )}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CloudUploadIcon fontSize="small" color="primary" />
                      Branch logo
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Drop an image, choose from the gallery, or use the camera. Square PNG or JPG looks best. Max 2 MB.
                    </Typography>
                    <ImageSourceBar
                      multiple={false}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      libraryLabel="Choose logo"
                      cameraLabel="Use camera"
                      onFiles={(files) => acceptLogo(files?.[0])}
                    />
                    {logoFile && (
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {logoFile.name}
                      </Typography>
                    )}
                  </Box>
                  {logoPreview && (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={(event) => { event.stopPropagation(); clearLogo(); }}
                    >
                      Remove
                    </Button>
                  )}
                </Box>
                <input
                  ref={logoInputRef}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => acceptLogo(event.target.files?.[0])}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Hostel Name" {...register('name', { required: 'Name is required' })} error={!!errors.name} helperText={errors.name?.message} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Code" {...register('code')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description (English)" multiline rows={2} {...register('description')} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Name (Hindi, optional)" {...register('name_hi')} helperText="Shown when seekers switch to हिन्दी" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Description (Hindi, optional)" multiline rows={2} {...register('description_hi')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Address" {...register('address', { required: 'Address is required' })} error={!!errors.address} helperText={errors.address?.message} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="City" {...register('city', { required: 'City is required' })} error={!!errors.city} helperText={errors.city?.message} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Area" {...register('area')} helperText="Locality shown on public search" />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="gender_policy"
                  control={control}
                  render={({ field }) => (
                    <TextField select fullWidth label="Guest gender" {...field}>
                      <MenuItem value="unisex">Unisex / co-ed</MenuItem>
                      <MenuItem value="male">Men</MenuItem>
                      <MenuItem value="female">Women</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="State" {...register('state', { required: 'State is required' })} error={!!errors.state} helperText={errors.state?.message} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Pincode" {...register('pincode', { required: 'Pincode is required' })} error={!!errors.pincode} helperText={errors.pincode?.message} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Country" {...register('country')} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Total Floors" type="number" {...register('total_floors', { valueAsNumber: true })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Capacity" type="number" {...register('capacity', { valueAsNumber: true })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Security Deposit (₹)" type="number" {...register('security_deposit', { valueAsNumber: true })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Notice Period (months)"
                  type="number"
                  inputProps={{ min: 0, max: 24 }}
                  {...register('notice_period_months', { valueAsNumber: true, min: { value: 0, message: 'Invalid' } })}
                  helperText="Tenant notice period before vacating"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="booking_model"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="How guests book"
                      helperText="Seekers see this on search and the listing. Do not switch a live PG during UAT."
                      {...field}
                    >
                      <MenuItem value="approval_first">Request to book — pay does not occupy until you Confirm</MenuItem>
                      <MenuItem value="instant">Instant book — pay occupies the bed</MenuItem>
                      <MenuItem value="request_advance">Hold with advance — guest pays a percent; you still Confirm</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              {bookingModel === 'request_advance' && (
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Advance percent"
                    type="number"
                    inputProps={{ min: 1, max: 100, step: 1 }}
                    {...register('advance_percent', { valueAsNumber: true, min: 1, max: 100 })}
                    helperText="Percent of first month + deposit to hold. Not platform commission."
                  />
                </Grid>
              )}
              {(isOwner || isSuperAdmin) && (
                <Grid item xs={12}>
                  <Controller
                    name="supervisor_media_upload"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={(
                          <Switch
                            checked={field.value !== false}
                            onChange={(event) => field.onChange(event.target.checked)}
                            color="primary"
                          />
                        )}
                        label="Supervisors may upload listing photos for this branch"
                      />
                    )}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 0.5, mt: -0.5 }}>
                    On by default — the warden usually has the phone camera. Turn off if only you or Vita tech should change public photos.
                  </Typography>
                </Grid>
              )}
              {isSupervisor && (
                <Grid item xs={12}>
                  <Alert severity="info">
                    Listing photo upload for this branch is controlled by the owner. You can upload when they leave it on.
                  </Alert>
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Contact Phone" {...register('contact_phone')} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Contact Email" type="email" {...register('contact_email')} />
              </Grid>
              {isSuperAdmin && (
                <Grid item xs={12} md={4}>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        select
                        fullWidth
                        label="Status"
                        helperText="Operations only (active / hold). Not the seeker listing — publish from Photos."
                        {...field}
                      >
                        <MenuItem value="pending_approval">Pending Approval</MenuItem>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                        <MenuItem value="maintenance">Maintenance</MenuItem>
                        <MenuItem value="on_hold">On Hold</MenuItem>
                        <MenuItem value="rejected">Rejected</MenuItem>
                      </TextField>
                    )}
                  />
                </Grid>
              )}
            </Grid>

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" onClick={() => navigate('/hostels')}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting
                  ? <CircularProgress size={24} />
                  : isEdit
                    ? (isSuperAdmin ? 'Update Hostel' : 'Update Branch')
                    : isSuperAdmin
                      ? 'Create Hostel'
                      : 'Submit Branch for Approval'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default HostelFormPage;
