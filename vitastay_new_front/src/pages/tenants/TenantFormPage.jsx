import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  Box, Grid, TextField, Button, MenuItem, CircularProgress, Card, CardContent,
  Divider, Typography, FormControlLabel, Checkbox, Stack, IconButton, Avatar,
  FormHelperText, Alert, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { MOBILE_REGEX, displayEmail, formatCurrency } from '../../utils/constants';
import { printRentInvoice } from '../../utils/printRentInvoice';
import RoomBlueprintDialog from './RoomBlueprintDialog';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ID_TYPES = [
  {
    value: 'aadhar', label: 'Aadhaar Card', pattern: /^\d{12}$/, maxLength: 12, numeric: true,
    example: '123456789012', hint: '12 digits',
  },
  {
    value: 'pan', label: 'PAN Card', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/, maxLength: 10,
    example: 'ABCDE1234F', hint: '5 letters + 4 digits + 1 letter',
  },
  {
    value: 'passport', label: 'Passport', pattern: /^[A-Z][0-9]{7}$/, maxLength: 8,
    example: 'A1234567', hint: '1 letter + 7 digits',
  },
  {
    value: 'driving_license', label: 'Driving License', pattern: /^[A-Z]{2}[0-9]{2}[0-9A-Z]{6,12}$/, maxLength: 16,
    example: 'TS0120230012345', hint: 'State code + RTO code + number',
  },
  {
    value: 'voter_id', label: 'Voter ID', pattern: /^[A-Z]{3}[0-9]{7}$/, maxLength: 10,
    example: 'ABC1234567', hint: '3 letters + 7 digits',
  },
];

const idFormat = (type) => ID_TYPES.find((t) => t.value === type) || ID_TYPES[0];

const normalizeIdNumber = (type, value) => {
  const format = idFormat(type);
  const cleaned = String(value || '').toUpperCase().replace(format.numeric ? /\D/g : /[^A-Z0-9]/g, '');
  return cleaned.slice(0, format.maxLength);
};

const ROOM_TYPES = [
  { value: 'single', label: 'Single Sharing' },
  { value: 'double', label: 'Double Sharing' },
  { value: 'triple', label: 'Triple Sharing' },
  { value: 'dormitory', label: 'Dormitory' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'online', label: 'Online' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_MESSAGE = 'Enter 10 digits starting with 6, 7, 8 or 9';

const needsExpiry = (type) => type === 'passport' || type === 'driving_license';
const needsBackImage = (type) => type !== 'pan';
const vacantBeds = (room) => (room.beds || []).filter((b) => b.status === 'vacant').length;
const defaultPayment = (amount = '') => ({ method: 'cash', amount, reference: '' });

const Section = ({ title, subtitle, children }) => (
  <Box sx={{ mb: 1 }}>
    <Typography variant="h6" fontWeight={700} gutterBottom>{title}</Typography>
    {subtitle && (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>
    )}
    {children}
    <Divider sx={{ mt: 3, mb: 3 }} />
  </Box>
);

const FileField = ({ label, file, onChange, accept = 'image/*,.pdf', required, error, camera = false }) => (
  <Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="outlined" component="label" fullWidth sx={{ justifyContent: 'flex-start', py: 1.5 }}>
        {file ? file.name : label}
        <input hidden type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </Button>
      {camera && (
        <Button variant="outlined" component="label" sx={{ minWidth: 56, px: 1 }} aria-label="Use camera">
          <PhotoCameraIcon />
          <input hidden type="file" accept="image/*" capture="environment" onChange={(e) => onChange(e.target.files?.[0] || null)} />
        </Button>
      )}
    </Box>
    {(error || required) && (
      <FormHelperText error={Boolean(error)}>
        {error || (required && !file ? 'Required' : ' ')}
      </FormHelperText>
    )}
  </Box>
);

const defaultIdentity = () => ({
  id_type: 'aadhar',
  id_number: '',
  expiry_date: '',
  front: null,
  back: null,
});

const TenantFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [hostels, setHostels] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [existingDocs, setExistingDocs] = useState([]);
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [createdTenant, setCreatedTenant] = useState(null);
  const [initialStatus, setInitialStatus] = useState('');
  const isInactiveTenant = ['inactive', 'moved_out'].includes(initialStatus);

  const {
    register, handleSubmit, control, reset, watch, setValue, getValues, clearErrors, trigger, formState: { errors },
  } = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      create_login: false,
      password: '',
      confirm_password: '',
      phone: '',
      alternate_phone: '',
      date_of_birth: '',
      gender: '',
      blood_group: '',
      nationality: 'Indian',
      marital_status: '',
      permanent_address: '',
      current_address: '',
      same_as_permanent: true,
      is_student: false,
      emergency_contact_name: '',
      emergency_contact_relation: '',
      emergency_contact_phone: '',
      emergency_contact_alternate: '',
      emergency_contact_address: '',
      guardian_name: '',
      guardian_phone: '',
      guardian_email: '',
      guardian_occupation: '',
      guardian_address: '',
      college: '',
      hostel_id: '',
      room_type: '',
      room_id: '',
      bed_id: '',
      move_in_date: new Date().toISOString().split('T')[0],
      monthly_rent: 0,
      deposit_amount: 0,
      status: 'active',
      identities: [defaultIdentity()],
      payments: [defaultPayment()],
    },
  });

  const { fields, append, remove, update } = useFieldArray({ control, name: 'identities' });
  const {
    fields: paymentFields, append: appendPayment, remove: removePayment,
  } = useFieldArray({ control, name: 'payments' });
  const hostelId = watch('hostel_id');
  const roomType = watch('room_type');
  const sameAsPermanent = watch('same_as_permanent');
  const isStudent = watch('is_student');
  const createLogin = watch('create_login');
  const loginEmail = watch('email');
  const permanentAddress = watch('permanent_address');
  const identities = watch('identities');
  const payments = watch('payments');
  const monthlyRent = Number(watch('monthly_rent')) || 0;
  const depositAmount = Number(watch('deposit_amount')) || 0;

  const billTotal = monthlyRent + depositAmount;
  const paidTotal = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balanceDue = Math.max(0, billTotal - paidTotal);
  const overpaid = paidTotal - billTotal > 0.009;

  const selectedHostel = hostels.find((h) => String(h.id) === String(hostelId));
  const canInvitePortal = Boolean(selectedHostel?.entitlements?.tenant_portal);
  const roomTypeOptions = useMemo(() => ROOM_TYPES
    .map((type) => {
      const typeRooms = rooms.filter((r) => r.room_type === type.value);
      return { ...type, rooms: typeRooms.length, beds: typeRooms.reduce((s, r) => s + vacantBeds(r), 0) };
    })
    .filter((type) => type.rooms > 0), [rooms]);
  const roomsOfType = useMemo(() => rooms.filter((r) => r.room_type === roomType), [rooms, roomType]);

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, []);

  const loadRooms = (forHostelId) => {
    if (!forHostelId) { setRooms([]); return; }
    api.get('/rooms', { params: { hostelId: forHostelId, limit: 100 } })
      .then(({ data }) => setRooms(extractPaginated(data).data))
      .catch(() => setRooms([]));
  };

  useEffect(() => { loadRooms(hostelId); }, [hostelId]);

  useEffect(() => {
    if (canInvitePortal || !createLogin) return undefined;
    setValue('create_login', false);
    setValue('password', '');
    setValue('confirm_password', '');
    clearErrors(['email', 'password', 'confirm_password']);
    return undefined;
  }, [canInvitePortal, createLogin, setValue, clearErrors]);

  const clearBedSelection = () => {
    setSelectedBed(null);
    setValue('room_id', '');
    setValue('bed_id', '');
  };

  const onBedConfirmed = (room, bed) => {
    setSelectedBed({ room, bed });
    setValue('room_id', room.id);
    setValue('bed_id', bed.id);
    setValue('monthly_rent', Number(room.rent) || 0);
    clearErrors('bed_id');
    setBlueprintOpen(false);
  };

  const mobileField = (name, required = false) => {
    const field = register(name, {
      required: required ? 'Required' : false,
      validate: (v) => !v || MOBILE_REGEX.test(v) || MOBILE_MESSAGE,
    });
    return {
      ...field,
      onChange: (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
        return field.onChange(e);
      },
      required,
      error: !!errors[name],
      helperText: errors[name]?.message || (required ? '10-digit mobile number' : ' '),
      inputProps: { maxLength: 10, inputMode: 'numeric' },
    };
  };

  useEffect(() => {
    if (sameAsPermanent) setValue('current_address', permanentAddress || '');
  }, [sameAsPermanent, permanentAddress, setValue]);

  useEffect(() => {
    if (!isEdit) return;
    const fetchTenant = async () => {
      try {
        const { data } = await api.get(`/tenants/${id}`);
        const tenant = extractData(data);
        const docs = tenant.documents || [];
        setExistingDocs(docs);
        setPhotoPreview(tenant.photo || '');
        setInitialStatus(tenant.status || '');

        const mappedIds = docs.length
          ? docs.map((d) => ({
            id_type: d.document_type,
            id_number: d.id_number || '',
            expiry_date: d.expiry_date || '',
            front: null,
            back: null,
          }))
          : [defaultIdentity()];

        reset({
          full_name: tenant.full_name || `${tenant.user?.first_name || ''} ${tenant.user?.last_name || ''}`.trim(),
          email: displayEmail(tenant.user?.email),
          phone: tenant.user?.phone || '',
          alternate_phone: tenant.alternate_phone || '',
          date_of_birth: tenant.date_of_birth || '',
          gender: tenant.gender || '',
          blood_group: tenant.blood_group || '',
          nationality: tenant.nationality || 'Indian',
          marital_status: tenant.marital_status || '',
          permanent_address: tenant.permanent_address || tenant.address || '',
          current_address: tenant.current_address || '',
          same_as_permanent: tenant.same_as_permanent !== false,
          is_student: Boolean(tenant.is_student || tenant.college),
          emergency_contact_name: tenant.emergency_contact_name || '',
          emergency_contact_relation: tenant.emergency_contact_relation || '',
          emergency_contact_phone: tenant.emergency_contact_phone || '',
          emergency_contact_alternate: tenant.emergency_contact_alternate || '',
          emergency_contact_address: tenant.emergency_contact_address || '',
          guardian_name: tenant.guardian_name || '',
          guardian_phone: tenant.guardian_phone || '',
          guardian_email: tenant.guardian_email || '',
          guardian_occupation: tenant.guardian_occupation || '',
          guardian_address: tenant.guardian_address || '',
          college: tenant.college || '',
          hostel_id: tenant.hostel_id || '',
          room_id: tenant.room_id || '',
          bed_id: tenant.bed_id || '',
          move_in_date: tenant.move_in_date || '',
          monthly_rent: Number(tenant.monthly_rent) || 0,
          deposit_amount: Number(tenant.deposit_amount) || 0,
          status: tenant.status || 'active',
          identities: mappedIds,
          create_login: false,
          password: '',
          confirm_password: '',
          room_type: '',
          payments: [],
        });
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
        navigate('/tenants');
      } finally {
        setLoading(false);
      }
    };
    fetchTenant();
  }, [id, isEdit, reset, navigate, enqueueSnackbar]);

  const onPhotoChange = (file) => {
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  };

  const setIdentityFile = (index, side, file) => {
    const current = identities[index] || defaultIdentity();
    update(index, { ...current, [side]: file });
  };

  const onSubmit = async (formData) => {
    if (!isEdit && !photoFile) {
      enqueueSnackbar('Profile photo is required', { variant: 'error' });
      return;
    }
    if (!formData.identities?.length || !formData.identities[0]?.id_number) {
      enqueueSnackbar('At least one identity proof is required', { variant: 'error' });
      return;
    }
    if (!isEdit) {
      const missingFront = formData.identities.findIndex((row) => !row.front);
      if (missingFront >= 0) {
        enqueueSnackbar(`Front image is required for ID #${missingFront + 1}`, { variant: 'error' });
        return;
      }
      const missingBack = formData.identities.findIndex((row) => needsBackImage(row.id_type) && !row.back);
      if (missingBack >= 0) {
        enqueueSnackbar(`Back image is required for ID #${missingBack + 1} (only PAN card is exempt)`, { variant: 'error' });
        return;
      }
      if (!formData.bed_id) {
        enqueueSnackbar('Select a room type and pick a bed from available rooms', { variant: 'error' });
        return;
      }
      if (overpaid) {
        enqueueSnackbar('Total paid amount cannot exceed rent + deposit', { variant: 'error' });
        return;
      }
    }
    if (formData.is_student && !formData.guardian_name) {
      enqueueSnackbar('Parent/Guardian details are mandatory for students', { variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      const {
        identities: idRows,
        password,
        confirm_password: _confirmPassword,
        create_login,
        room_type: _roomType,
        payments: paymentRows,
        same_as_permanent,
        is_student,
        ...rest
      } = formData;

      Object.entries(rest).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        payload.append(key, value);
      });
      payload.append('same_as_permanent', same_as_permanent ? 'true' : 'false');
      payload.append('is_student', is_student ? 'true' : 'false');
      if (!isEdit) {
        payload.append('create_login', create_login ? 'true' : 'false');
        if (create_login) payload.append('password', password);
        const splits = (paymentRows || [])
          .filter((p) => Number(p.amount) > 0)
          .map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference }));
        payload.append('payments', JSON.stringify(splits));
      }

      const identitiesPayload = idRows.map(({ id_type, id_number, expiry_date }) => ({
        id_type,
        document_type: id_type,
        id_number,
        expiry_date: needsExpiry(id_type) ? expiry_date || null : null,
      }));
      payload.append('identities', JSON.stringify(identitiesPayload));

      if (photoFile) payload.append('photo', photoFile);
      idRows.forEach((row, index) => {
        if (row.front) payload.append(`id_${index}_front`, row.front);
        if (row.back) payload.append(`id_${index}_back`, row.back);
      });

      if (isEdit) {
        await api.put(`/tenants/${id}`, payload);
        enqueueSnackbar('Tenant updated successfully', { variant: 'success' });
        navigate('/tenants');
      } else {
        const { data } = await api.post('/tenants', payload);
        enqueueSnackbar('Tenant created successfully', { variant: 'success' });
        setCreatedTenant(extractData(data));
      }
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      if (!isEdit && err.response?.status === 409 && String(getErrorMessage(err)).includes('Bed')) {
        clearBedSelection();
        loadRooms(formData.hostel_id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const printBill = () => {
    const bill = createdTenant?.registration_payment;
    if (!bill) return;
    printRentInvoice({
      ...bill,
      bill_title: 'Registration Bill',
      tenant: { user: createdTenant.user },
      hostel: selectedHostel || createdTenant.hostel,
    });
  };

  if (loading) return <LoadingSkeleton variant="form" />;

  return (
    <Box>
      <PageHeader
        title={isEdit ? 'Edit Tenant' : 'Add Tenant'}
        breadcrumbs={[{ label: 'Tenants', path: '/tenants' }, { label: isEdit ? 'Edit' : 'New' }]}
        subtitle="Complete personal, contact, ID, emergency and guardian details"
      />

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
            <Section title="1. Personal Information" subtitle="Mandatory details as per government ID">
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Stack alignItems="center" spacing={1}>
                    <Avatar
                      src={photoPreview}
                      sx={{ width: 96, height: 96, bgcolor: 'primary.main' }}
                    >
                      <PhotoCameraIcon />
                    </Avatar>
                    <Button variant="outlined" size="small" component="label">
                      Profile Photo {!isEdit && '*'}
                      <input hidden type="file" accept="image/*" onChange={(e) => onPhotoChange(e.target.files?.[0] || null)} />
                    </Button>
                    <Button variant="outlined" size="small" component="label" startIcon={<PhotoCameraIcon />}>
                      Use camera
                      <input hidden type="file" accept="image/*" capture="environment" onChange={(e) => onPhotoChange(e.target.files?.[0] || null)} />
                    </Button>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={9}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        required
                        label="Full Name (as per ID)"
                        {...register('full_name', { required: 'Required' })}
                        error={!!errors.full_name}
                        helperText={errors.full_name?.message}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        required
                        label="Date of Birth"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ max: new Date().toISOString().split('T')[0] }}
                        {...register('date_of_birth', {
                          required: 'Required',
                          validate: (v) => !v || new Date(v) < new Date() || 'Date of birth must be in the past',
                        })}
                        error={!!errors.date_of_birth}
                        helperText={errors.date_of_birth?.message}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Controller
                        name="gender"
                        control={control}
                        rules={{ required: 'Required' }}
                        render={({ field }) => (
                          <TextField select fullWidth required label="Gender" {...field} error={!!errors.gender} helperText={errors.gender?.message}>
                            <MenuItem value="">Select</MenuItem>
                            <MenuItem value="male">Male</MenuItem>
                            <MenuItem value="female">Female</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Controller
                        name="blood_group"
                        control={control}
                        render={({ field }) => (
                          <TextField select fullWidth label="Blood Group (recommended)" {...field}>
                            <MenuItem value="">Select</MenuItem>
                            {BLOOD_GROUPS.map((bg) => <MenuItem key={bg} value={bg}>{bg}</MenuItem>)}
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        required
                        label="Nationality"
                        {...register('nationality', { required: 'Required' })}
                        error={!!errors.nationality}
                        helperText={errors.nationality?.message}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="marital_status"
                        control={control}
                        render={({ field }) => (
                          <TextField select fullWidth label="Marital Status (optional)" {...field}>
                            <MenuItem value="">Select</MenuItem>
                            <MenuItem value="single">Single</MenuItem>
                            <MenuItem value="married">Married</MenuItem>
                            <MenuItem value="divorced">Divorced</MenuItem>
                            <MenuItem value="widowed">Widowed</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Section>

            <Section title="2. Contact Details" subtitle="Primary contact and address information">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Mobile Number" {...mobileField('phone', true)} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Alternate Mobile Number" {...mobileField('alternate_phone')} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required={!isEdit && createLogin}
                    label={!isEdit && createLogin ? 'Email Address' : 'Email Address (optional)'}
                    type="email"
                    disabled={isEdit}
                    {...register('email', {
                      required: !isEdit && createLogin ? 'Required to create tenant login' : false,
                      validate: (v) => !v || EMAIL_REGEX.test(v) || 'Enter a valid email address',
                    })}
                    error={!!errors.email}
                    helperText={errors.email?.message || ' '}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={2}
                    label="Permanent Address"
                    {...register('permanent_address', { required: 'Required' })}
                    error={!!errors.permanent_address}
                    helperText={errors.permanent_address?.message}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="same_as_permanent"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Checkbox checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />}
                        label="Current address same as permanent"
                      />
                    )}
                  />
                </Grid>
                {!sameAsPermanent && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      multiline
                      rows={2}
                      label="Current Address"
                      {...register('current_address', { required: !sameAsPermanent ? 'Required' : false })}
                      error={!!errors.current_address}
                      helperText={errors.current_address?.message}
                    />
                  </Grid>
                )}
              </Grid>

              {!isEdit && (
                <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                  {canInvitePortal ? (
                    <>
                      <Controller
                        name="create_login"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={(
                              <Checkbox
                                checked={Boolean(field.value)}
                                onChange={(e) => {
                                  field.onChange(e.target.checked);
                                  if (!e.target.checked) {
                                    setValue('password', '');
                                    setValue('confirm_password', '');
                                    clearErrors(['email', 'password', 'confirm_password']);
                                  }
                                }}
                              />
                            )}
                            label={<Typography fontWeight={600}>Create tenant login account</Typography>}
                          />
                        )}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                        {createLogin
                          ? 'The tenant will sign in to the tenant portal with the email and password below.'
                          : 'No login will be created. Tick this box only if the tenant needs portal access.'}
                      </Typography>
                      {createLogin && (
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              label="Login ID (email)"
                              value={loginEmail || ''}
                              InputProps={{ readOnly: true }}
                              error={!loginEmail}
                              helperText={loginEmail ? 'Taken from Email Address above' : 'Enter the Email Address above'}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              required
                              label="Password"
                              type="password"
                              autoComplete="new-password"
                              {...register('password', {
                                required: createLogin ? 'Required' : false,
                                minLength: { value: 6, message: 'Min 6 characters' },
                              })}
                              error={!!errors.password}
                              helperText={errors.password?.message || 'Minimum 6 characters'}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              required
                              label="Confirm Password"
                              type="password"
                              autoComplete="new-password"
                              {...register('confirm_password', {
                                validate: (v) => !createLogin || v === getValues('password') || 'Passwords do not match',
                              })}
                              error={!!errors.confirm_password}
                              helperText={errors.confirm_password?.message || ' '}
                            />
                          </Grid>
                        </Grid>
                      )}
                    </>
                  ) : (
                    <Alert severity="info">
                      {hostelId
                        ? 'Upgrade to Silver for tenant logins. You can still add this resident without a portal account.'
                        : 'Select a hostel first. Tenant portal logins need Silver or Gold while the plan is live.'}
                    </Alert>
                  )}
                </Paper>
              )}
            </Section>

            <Section title="3. Identity Proof" subtitle="Collect one or more government-issued IDs. Front and back images are mandatory for every ID except PAN card (front only).">
              {existingDocs.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Existing documents on file: {existingDocs.map((d) => d.title).join(', ')}
                </Typography>
              )}
              {fields.map((field, index) => (
                <Card key={field.id} variant="outlined" sx={{ mb: 2, p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography fontWeight={600}>ID #{index + 1}</Typography>
                    {fields.length > 1 && (
                      <IconButton color="error" onClick={() => remove(index)} size="small">
                        <DeleteOutlineIcon />
                      </IconButton>
                    )}
                  </Stack>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Controller
                        name={`identities.${index}.id_type`}
                        control={control}
                        rules={{ required: true }}
                        render={({ field: f }) => (
                          <TextField
                            select
                            fullWidth
                            required
                            label="ID Type"
                            {...f}
                            onChange={(e) => {
                              const type = e.target.value;
                              f.onChange(type);
                              const numberPath = `identities.${index}.id_number`;
                              const current = getValues(numberPath);
                              if (current) {
                                setValue(numberPath, normalizeIdNumber(type, current));
                                trigger(numberPath);
                              }
                            }}
                          >
                            {ID_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      {(() => {
                        const format = idFormat(identities?.[index]?.id_type);
                        const numberField = register(`identities.${index}.id_number`, {
                          required: 'Required',
                          validate: (v) => {
                            const fmt = idFormat(getValues(`identities.${index}.id_type`));
                            return !v || fmt.pattern.test(v) || `Invalid ${fmt.label} number (${fmt.hint}, e.g. ${fmt.example})`;
                          },
                        });
                        return (
                          <TextField
                            fullWidth
                            required
                            label={`${format.label} Number`}
                            placeholder={format.example}
                            {...numberField}
                            onChange={(e) => {
                              e.target.value = normalizeIdNumber(getValues(`identities.${index}.id_type`), e.target.value);
                              return numberField.onChange(e);
                            }}
                            inputProps={{
                              maxLength: format.maxLength,
                              inputMode: format.numeric ? 'numeric' : 'text',
                              style: { textTransform: 'uppercase', letterSpacing: '0.05em' },
                            }}
                            error={!!errors.identities?.[index]?.id_number}
                            helperText={errors.identities?.[index]?.id_number?.message}
                          />
                        );
                      })()}
                    </Grid>
                    {needsExpiry(identities?.[index]?.id_type) && (
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          required
                          label="Expiry Date"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          {...register(`identities.${index}.expiry_date`, { required: 'Required for this ID' })}
                        />
                      </Grid>
                    )}
                    <Grid item xs={12} md={6}>
                      <FileField
                        label={identities?.[index]?.front?.name || 'Front Image *'}
                        file={identities?.[index]?.front}
                        onChange={(file) => setIdentityFile(index, 'front', file)}
                        required={!isEdit}
                        camera
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FileField
                        label={identities?.[index]?.back?.name || (needsBackImage(identities?.[index]?.id_type)
                          ? 'Back Image *'
                          : 'Back Image (optional for PAN)')}
                        file={identities?.[index]?.back}
                        onChange={(file) => setIdentityFile(index, 'back', file)}
                        required={!isEdit && needsBackImage(identities?.[index]?.id_type)}
                        camera
                      />
                    </Grid>
                  </Grid>
                </Card>
              ))}
              {fields.length < 5 && (
                <Button startIcon={<AddIcon />} onClick={() => append(defaultIdentity())} sx={{ mb: 1 }}>
                  Add another ID
                </Button>
              )}
            </Section>

            <Section title="4. Emergency Contact" subtitle="Mandatory emergency contact person">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    label="Contact Person Name"
                    {...register('emergency_contact_name', { required: 'Required' })}
                    error={!!errors.emergency_contact_name}
                    helperText={errors.emergency_contact_name?.message}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    label="Relationship"
                    {...register('emergency_contact_relation', { required: 'Required' })}
                    error={!!errors.emergency_contact_relation}
                    helperText={errors.emergency_contact_relation?.message}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Mobile Number" {...mobileField('emergency_contact_phone', true)} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Alternate Number" {...mobileField('emergency_contact_alternate')} />
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    required
                    label="Address"
                    {...register('emergency_contact_address', { required: 'Required' })}
                    error={!!errors.emergency_contact_address}
                    helperText={errors.emergency_contact_address?.message}
                  />
                </Grid>
              </Grid>
            </Section>

            <Section title="5. Parent / Guardian Details" subtitle="Mandatory for students">
              <Controller
                name="is_student"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />}
                    label="Tenant is a student (guardian details required)"
                    sx={{ mb: 1 }}
                  />
                )}
              />
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required={isStudent}
                    label="Father / Mother / Guardian Name"
                    {...register('guardian_name', { required: isStudent ? 'Required for students' : false })}
                    error={!!errors.guardian_name}
                    helperText={errors.guardian_name?.message}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Mobile Number" {...mobileField('guardian_phone', isStudent)} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    {...register('guardian_email', { validate: (v) => !v || EMAIL_REGEX.test(v) || 'Enter a valid email address' })}
                    error={!!errors.guardian_email}
                    helperText={errors.guardian_email?.message}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Occupation" {...register('guardian_occupation')} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="College / Institution" {...register('college')} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required={isStudent}
                    label="Guardian Address"
                    {...register('guardian_address', { required: isStudent ? 'Required for students' : false })}
                    error={!!errors.guardian_address}
                    helperText={errors.guardian_address?.message}
                  />
                </Grid>
              </Grid>
            </Section>

            <Section
              title="6. Accommodation"
              subtitle={isEdit ? 'Hostel allocation and rent' : 'Select hostel and room type, then pick a bed from the available rooms'}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Controller
                    name="hostel_id"
                    control={control}
                    rules={{ required: 'Hostel is required' }}
                    render={({ field }) => (
                      <TextField
                        select
                        fullWidth
                        required
                        label="Hostel"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          if (!isEdit) {
                            setValue('room_type', '');
                            clearBedSelection();
                          }
                        }}
                        error={!!errors.hostel_id}
                        helperText={errors.hostel_id?.message}
                      >
                        <MenuItem value="">Select Hostel</MenuItem>
                        {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                      </TextField>
                    )}
                  />
                </Grid>
                {isEdit ? (
                  <Grid item xs={12} md={4}>
                    <Controller
                      name="room_id"
                      control={control}
                      render={({ field }) => (
                        <TextField select fullWidth label="Room" {...field}>
                          <MenuItem value="">Select Room</MenuItem>
                          {rooms.map((r) => <MenuItem key={r.id} value={r.id}>{r.room_number} (Floor {r.floor})</MenuItem>)}
                        </TextField>
                      )}
                    />
                  </Grid>
                ) : (
                  <>
                    <Grid item xs={12} md={4}>
                      <Controller
                        name="room_type"
                        control={control}
                        rules={{ required: 'Room type is required' }}
                        render={({ field }) => (
                          <TextField
                            select
                            fullWidth
                            required
                            label="Room Type"
                            disabled={!hostelId}
                            {...field}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              clearBedSelection();
                            }}
                            error={!!errors.room_type}
                            helperText={errors.room_type?.message || (!hostelId ? 'Select a hostel first' : ' ')}
                          >
                            <MenuItem value="">Select Room Type</MenuItem>
                            {roomTypeOptions.map((t) => (
                              <MenuItem key={t.value} value={t.value} disabled={t.beds === 0}>
                                {t.label} — {t.beds} bed(s) free
                              </MenuItem>
                            ))}
                            {hostelId && roomTypeOptions.length === 0 && (
                              <MenuItem value="" disabled>No rooms configured in this hostel</MenuItem>
                            )}
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Button
                        fullWidth
                        variant={selectedBed ? 'outlined' : 'contained'}
                        startIcon={<MeetingRoomIcon />}
                        disabled={!roomType}
                        onClick={() => setBlueprintOpen(true)}
                        sx={{ height: 56 }}
                      >
                        {selectedBed ? 'Change Bed' : 'View Available Rooms'}
                      </Button>
                      <input type="hidden" {...register('bed_id', { required: 'Pick a bed' })} />
                      <FormHelperText error={!!errors.bed_id} sx={{ mx: 1.75 }}>
                        {errors.bed_id ? 'Bed selection is required' : (!roomType ? 'Select a room type first' : ' ')}
                      </FormHelperText>
                    </Grid>
                    {selectedBed && (
                      <Grid item xs={12}>
                        <Alert icon={<CheckCircleIcon />} severity="success">
                          <strong>Room {selectedBed.room.room_number}</strong>
                          {` · Floor ${selectedBed.room.floor} · Bed ${selectedBed.bed.bed_number}`}
                          {` · ${ROOM_TYPES.find((t) => t.value === selectedBed.room.room_type)?.label || selectedBed.room.room_type}`}
                          {selectedBed.room.is_ac ? ' · AC' : ''}
                          {` · ${formatCurrency(selectedBed.room.rent)}/month`}
                        </Alert>
                      </Grid>
                    )}
                  </>
                )}
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required={!isEdit}
                    label="Move-in Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    {...register('move_in_date', { required: !isEdit ? 'Required' : false })}
                    error={!!errors.move_in_date}
                    helperText={errors.move_in_date?.message}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required={!isEdit}
                    label="Monthly Rent (₹)"
                    type="number"
                    inputProps={{ min: 0 }}
                    {...register('monthly_rent', {
                      valueAsNumber: true,
                      validate: (v) => isEdit || (Number(v) > 0) || 'Enter monthly rent',
                    })}
                    error={!!errors.monthly_rent}
                    helperText={errors.monthly_rent?.message || (!isEdit ? 'Auto-filled from selected room' : '')}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Security Deposit (₹)"
                    type="number"
                    inputProps={{ min: 0 }}
                    {...register('deposit_amount', {
                      valueAsNumber: true,
                      validate: (v) => !v || Number(v) >= 0 || 'Cannot be negative',
                    })}
                    error={!!errors.deposit_amount}
                    helperText={errors.deposit_amount?.message}
                  />
                </Grid>
                {isEdit && (
                  <Grid item xs={12} md={4}>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          select
                          fullWidth
                          label="Status"
                          {...field}
                          disabled={isInactiveTenant}
                          helperText={isInactiveTenant ? 'Tenant is inactive' : 'To deactivate, use "Mark Inactive" in the tenant list'}
                        >
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="pending">Pending</MenuItem>
                          {isInactiveTenant && (
                            <MenuItem value={initialStatus}>{initialStatus === 'moved_out' ? 'Moved Out' : 'Inactive'}</MenuItem>
                          )}
                        </TextField>
                      )}
                    />
                  </Grid>
                )}
              </Grid>
            </Section>

            {!isEdit && selectedBed && (
              <Section title="7. Payment" subtitle="Collect first month rent and security deposit. Split across multiple payment modes if needed.">
                <Grid container spacing={3}>
                  <Grid item xs={12} md={8}>
                    {paymentFields.map((field, index) => (
                      <Grid container spacing={2} key={field.id} sx={{ mb: 1 }} alignItems="flex-start">
                        <Grid item xs={12} sm={3}>
                          <Controller
                            name={`payments.${index}.method`}
                            control={control}
                            render={({ field: f }) => (
                              <TextField select fullWidth label={`Mode ${paymentFields.length > 1 ? `#${index + 1}` : ''}`} {...f}>
                                {PAYMENT_METHODS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                              </TextField>
                            )}
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            label="Amount (₹)"
                            type="number"
                            inputProps={{ min: 0 }}
                            {...register(`payments.${index}.amount`, {
                              validate: (v) => v === '' || Number(v) >= 0 || 'Invalid amount',
                            })}
                            error={!!errors.payments?.[index]?.amount}
                            helperText={errors.payments?.[index]?.amount?.message}
                          />
                        </Grid>
                        <Grid item xs={10} sm={5}>
                          <TextField
                            fullWidth
                            label={payments?.[index]?.method === 'cash' ? 'Note (optional)' : 'Transaction / Reference No.'}
                            {...register(`payments.${index}.reference`)}
                          />
                        </Grid>
                        <Grid item xs={2} sm={1}>
                          {paymentFields.length > 1 && (
                            <IconButton color="error" onClick={() => removePayment(index)} sx={{ mt: 1 }}>
                              <DeleteOutlineIcon />
                            </IconButton>
                          )}
                        </Grid>
                      </Grid>
                    ))}
                    <Stack direction="row" spacing={1}>
                      {paymentFields.length < 5 && (
                        <Button
                          startIcon={<AddIcon />}
                          onClick={() => appendPayment(defaultPayment(balanceDue > 0 ? balanceDue : ''))}
                        >
                          Add split payment
                        </Button>
                      )}
                      {paymentFields.length === 1 && balanceDue > 0 && (
                        <Button onClick={() => setValue('payments.0.amount', billTotal)}>Pay full amount</Button>
                      )}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography fontWeight={700} gutterBottom>Bill Summary</Typography>
                      {[
                        ['First month rent', monthlyRent],
                        ['Security deposit', depositAmount],
                      ].map(([label, value]) => (
                        <Stack key={label} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">{label}</Typography>
                          <Typography variant="body2">{formatCurrency(value)}</Typography>
                        </Stack>
                      ))}
                      <Divider sx={{ my: 1 }} />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography fontWeight={700}>Total payable</Typography>
                        <Typography fontWeight={700}>{formatCurrency(billTotal)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                        <Typography variant="body2" color="success.main">Paid now</Typography>
                        <Typography variant="body2" color="success.main">{formatCurrency(paidTotal)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color={balanceDue > 0 ? 'warning.main' : 'text.secondary'}>Balance due</Typography>
                        <Typography variant="body2" color={balanceDue > 0 ? 'warning.main' : 'text.secondary'}>
                          {formatCurrency(balanceDue)}
                        </Typography>
                      </Stack>
                      {overpaid && (
                        <Alert severity="error" sx={{ mt: 1.5 }}>
                          Paid amount exceeds total by {formatCurrency(paidTotal - billTotal)}
                        </Alert>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              </Section>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/tenants')}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={submitting || (!isEdit && overpaid)}>
                {submitting ? <CircularProgress size={24} /> : isEdit ? 'Update Tenant' : 'Create Tenant & Generate Bill'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {!isEdit && (
        <RoomBlueprintDialog
          open={blueprintOpen}
          onClose={() => setBlueprintOpen(false)}
          rooms={roomsOfType}
          roomTypeLabel={ROOM_TYPES.find((t) => t.value === roomType)?.label || ''}
          hostelName={selectedHostel?.name}
          selectedBedId={selectedBed?.bed.id}
          onConfirm={onBedConfirmed}
        />
      )}

      <Dialog open={Boolean(createdTenant)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" /> Tenant Registered
        </DialogTitle>
        <DialogContent dividers>
          <Typography fontWeight={600}>{createdTenant?.full_name}</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {createdTenant?.registration_payment?.room
              ? `Room ${createdTenant.registration_payment.room.room_number} · Bed ${createdTenant.registration_payment.bed_number}`
              : ''}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {createdTenant?.user?.has_login
              ? `Login created: ${createdTenant.user.email}`
              : 'No login account created for this tenant.'}
          </Typography>
          {createdTenant?.registration_payment && (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Total</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatCurrency(createdTenant.registration_payment.total_amount)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Paid</Typography>
                <Typography variant="body2" color="success.main">
                  {formatCurrency(createdTenant.registration_payment.paid_amount)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Balance</Typography>
                <Typography variant="body2" color="warning.main">
                  {formatCurrency(Math.max(0, Number(createdTenant.registration_payment.total_amount)
                    - Number(createdTenant.registration_payment.paid_amount)))}
                </Typography>
              </Stack>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigate('/tenants')}>Done</Button>
          {createdTenant?.registration_payment && (
            <Button variant="contained" startIcon={<PrintIcon />} onClick={printBill}>Print Bill</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TenantFormPage;
