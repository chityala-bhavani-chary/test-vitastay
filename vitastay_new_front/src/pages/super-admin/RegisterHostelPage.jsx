import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Box, Grid, TextField, Button, MenuItem, CircularProgress, Card, CardContent,
  Typography, FormGroup, FormControlLabel, Checkbox, Divider,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import api, { extractData, getErrorMessage } from '../../services/api';
import {
  HOSTEL_FEATURES,
  DEFAULT_HOSTEL_FEATURES,
  AMENITY_OPTIONS,
} from '../../utils/constants';

const RegisterHostelPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [features, setFeatures] = useState({ ...DEFAULT_HOSTEL_FEATURES });
  const [amenities, setAmenities] = useState(['WiFi', 'CCTV', 'Power Backup']);

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: {
      owner_first_name: '',
      owner_last_name: '',
      owner_email: '',
      owner_password: '',
      owner_phone: '',
      name: '',
      code: '',
      description: '',
      address: '',
      city: '',
      area: '',
      gender_policy: 'unisex',
      state: '',
      pincode: '',
      country: 'India',
      total_floors: 1,
      capacity: 0,
      security_deposit: 0,
      notice_period_months: 1,
      contact_phone: '',
      contact_email: '',
      status: 'active',
    },
  });

  const toggleFeature = (key) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAmenity = (amenity) => {
    setAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const res = await api.post('/super-admin/hostels', {
        owner: {
          first_name: formData.owner_first_name,
          last_name: formData.owner_last_name,
          email: formData.owner_email,
          password: formData.owner_password,
          phone: formData.owner_phone || undefined,
        },
        hostel: {
          name: formData.name,
          code: formData.code || undefined,
          description: formData.description || undefined,
          address: formData.address,
          city: formData.city,
          area: formData.area || undefined,
          gender_policy: formData.gender_policy,
          state: formData.state,
          pincode: formData.pincode,
          country: formData.country,
          total_floors: formData.total_floors,
          capacity: formData.capacity,
          security_deposit: formData.security_deposit,
          notice_period_months: formData.notice_period_months,
          contact_phone: formData.contact_phone || formData.owner_phone,
          contact_email: formData.contact_email || formData.owner_email,
          status: formData.status,
          amenities,
          features,
        },
      });
      const hostel = extractData(res);
      enqueueSnackbar('Hostel registered. Complete the photo pack — tech often uploads the 360.', { variant: 'success' });
      if (hostel?.id) navigate(`/hostels/${hostel.id}/media`);
      else navigate('/hostels');
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Register New Hostel"
        subtitle="Create owner account, hostel profile, amenities and module features"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard/super-admin' },
          { label: 'Register Hostel' },
        ]}
      />

      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>Owner Account</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Login credentials for the hostel owner
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="First Name" {...register('owner_first_name', { required: 'Required' })} error={!!errors.owner_first_name} helperText={errors.owner_first_name?.message} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Last Name" {...register('owner_last_name', { required: 'Required' })} error={!!errors.owner_last_name} helperText={errors.owner_last_name?.message} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Owner Email" type="email" {...register('owner_email', { required: 'Required' })} error={!!errors.owner_email} helperText={errors.owner_email?.message} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Owner Password" type="password" {...register('owner_password', { required: 'Required', minLength: { value: 6, message: 'Min 6 characters' } })} error={!!errors.owner_password} helperText={errors.owner_password?.message} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Owner Phone" {...register('owner_phone')} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>Hostel Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Hostel Name" {...register('name', { required: 'Required' })} error={!!errors.name} helperText={errors.name?.message} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Code" {...register('code')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description" multiline rows={2} {...register('description')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Address" {...register('address', { required: 'Required' })} error={!!errors.address} helperText={errors.address?.message} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="City" {...register('city', { required: 'Required' })} error={!!errors.city} helperText={errors.city?.message} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Area" {...register('area')} />
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
                <TextField fullWidth label="State" {...register('state', { required: 'Required' })} error={!!errors.state} helperText={errors.state?.message} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Pincode" {...register('pincode', { required: 'Required' })} error={!!errors.pincode} helperText={errors.pincode?.message} />
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
                  {...register('notice_period_months', { valueAsNumber: true })}
                  helperText="Tenant notice period before vacating"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Contact Phone" {...register('contact_phone')} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Contact Email" type="email" {...register('contact_email')} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <TextField select fullWidth label="Status" {...field}>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="maintenance">Maintenance</MenuItem>
                      <MenuItem value="on_hold">On Hold</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>Amenities</Typography>
            <FormGroup row>
              {AMENITY_OPTIONS.map((amenity) => (
                <FormControlLabel
                  key={amenity}
                  control={<Checkbox checked={amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />}
                  label={amenity}
                />
              ))}
            </FormGroup>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" fontWeight={600} gutterBottom>Module Features</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Enable or disable modules available for this hostel
            </Typography>
            <FormGroup row>
              {HOSTEL_FEATURES.map((feature) => (
                <FormControlLabel
                  key={feature.key}
                  control={<Checkbox checked={Boolean(features[feature.key])} onChange={() => toggleFeature(feature.key)} />}
                  label={feature.label}
                  sx={{ minWidth: 180 }}
                />
              ))}
            </FormGroup>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={() => navigate('/dashboard/super-admin')}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={24} /> : 'Register Hostel'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default RegisterHostelPage;
