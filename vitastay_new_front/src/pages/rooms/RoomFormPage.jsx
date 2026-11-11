import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Box, Grid, TextField, Button, MenuItem, CircularProgress, Card, CardContent, FormControlLabel, Checkbox,
  Chip, Typography, alpha,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { brand } from '../../styles/theme';

const RoomFormPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const routeHostelId = searchParams.get('hostelId') || '';
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [hostels, setHostels] = useState([]);
  const [existingRooms, setExistingRooms] = useState([]);
  const [original, setOriginal] = useState(null);

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      hostel_id: '', room_number: '', floor: 1, room_type: 'single',
      sharing_type: 1, is_ac: false, has_attached_bath: false, rent: 0, status: 'vacant', description: '',
    },
  });

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    const fetchRoom = async () => {
      try {
        const { data } = await api.get(`/rooms/${id}`, {
          params: { hostelId: routeHostelId || undefined },
        });
        const room = extractData(data);
        setOriginal({ floor: Number(room.floor), room_number: String(room.room_number) });
        reset({
          hostel_id: room.hostel_id || routeHostelId || '',
          room_number: room.room_number || '',
          floor: room.floor || 1,
          room_type: room.room_type || 'single',
          sharing_type: room.sharing_type || 1,
          is_ac: room.is_ac || false,
          has_attached_bath: room.has_attached_bath || false,
          rent: room.rent || 0,
          status: room.status || 'vacant',
          description: room.description || '',
        });
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
        navigate('/rooms');
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [id, isEdit, routeHostelId, reset, navigate, enqueueSnackbar]);

  const roomType = watch('room_type');
  const hostelId = watch('hostel_id');
  const selectedFloor = watch('floor');
  const roomNumber = watch('room_number');
  const sharingByType = { single: 1, double: 2, triple: 3 };
  const selectedHostel = hostels.find((hostel) => String(hostel.id) === String(hostelId));
  const hostelFloors = Math.max(Number(selectedHostel?.total_floors) || 1, 1);
  const floorLimit = Math.max(hostelFloors, original?.floor || 0);
  const floorOptions = Array.from({ length: floorLimit }, (_, index) => index + 1);

  useEffect(() => {
    if (!selectedHostel) return;
    if (Number(selectedFloor) > floorLimit) setValue('floor', floorLimit);
  }, [selectedHostel, selectedFloor, floorLimit, setValue]);

  useEffect(() => {
    if (!hostelId) {
      setExistingRooms([]);
      return;
    }
    api.get('/rooms', { params: { hostelId, limit: 100, active: 'all' } })
      .then(({ data }) => setExistingRooms(extractPaginated(data).data))
      .catch(() => setExistingRooms([]));
  }, [hostelId]);

  const availableNumbers = useMemo(() => {
    const floor = Number(selectedFloor) || 1;
    const taken = new Set(
      existingRooms
        .filter((room) => Number(room.floor) === floor && !(isEdit && String(room.id) === String(id)))
        .map((room) => String(room.room_number))
    );
    const numbers = [];
    let sequence = 1;
    while (numbers.length < 12 && sequence < 80) {
      const value = String(floor * 100 + sequence);
      if (!taken.has(value)) numbers.push(value);
      sequence += 1;
    }
    if (original && original.floor === floor && !numbers.includes(original.room_number)) {
      numbers.unshift(original.room_number);
    }
    return numbers;
  }, [existingRooms, selectedFloor, isEdit, id, original]);

  useEffect(() => {
    if (!availableNumbers.length) return;
    if (!availableNumbers.includes(String(roomNumber))) {
      setValue('room_number', availableNumbers[0], { shouldValidate: true });
    }
  }, [availableNumbers, roomNumber, setValue]);

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        hostel_id: Number(formData.hostel_id),
        sharing_type: formData.room_type === 'dormitory'
          ? Number(formData.sharing_type) || 1
          : sharingByType[formData.room_type] || 1,
      };
      if (isEdit) {
        await api.put(`/rooms/${id}`, payload, { params: { hostelId: payload.hostel_id || undefined } });
        enqueueSnackbar('Room updated successfully', { variant: 'success' });
      } else {
        await api.post('/rooms', payload);
        enqueueSnackbar('Room created successfully', { variant: 'success' });
      }
      navigate('/rooms');
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
        title={isEdit ? 'Edit Room' : 'Add Room'}
        breadcrumbs={[{ label: 'Rooms', path: '/rooms' }, { label: isEdit ? 'Edit' : 'New' }]}
      />

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="hostel_id"
                  control={control}
                  rules={{ required: 'Hostel is required' }}
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="Hostel"
                      {...field}
                      disabled={isEdit}
                      error={!!errors.hostel_id}
                      helperText={errors.hostel_id?.message || (isEdit ? 'A room stays in its hostel' : '')}
                    >
                      <MenuItem value="">Select Hostel</MenuItem>
                      {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Controller
                  name="floor"
                  control={control}
                  rules={{
                    required: 'Floor is required',
                    validate: (value) => (Number(value) >= 1 && Number(value) <= floorLimit) || `Choose a floor from 1 to ${floorLimit}`,
                  }}
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="Floor"
                      {...field}
                      value={field.value || ''}
                      disabled={!selectedHostel}
                      error={!!errors.floor}
                      helperText={errors.floor?.message || (!selectedHostel
                        ? 'Select a hostel first'
                        : floorLimit > hostelFloors
                          ? `Hostel registered with ${hostelFloors} floor${hostelFloors === 1 ? '' : 's'}`
                          : `1 to ${floorLimit}`)}
                    >
                      {floorOptions.map((floor) => (
                        <MenuItem key={floor} value={floor} disabled={floor > hostelFloors && floor !== original?.floor}>
                          Floor {floor}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="room_type"
                  control={control}
                  render={({ field }) => (
                    <TextField select fullWidth label="Room Type" {...field}>
                      <MenuItem value="single">Single</MenuItem>
                      <MenuItem value="double">Double</MenuItem>
                      <MenuItem value="triple">Triple</MenuItem>
                      <MenuItem value="dormitory">Dormitory</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  Room number · floor {selectedFloor || 1}
                </Typography>
                <input type="hidden" {...register('room_number', { required: 'Choose a room number' })} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {availableNumbers.map((number) => {
                    const selected = String(roomNumber) === String(number);
                    return (
                      <Chip
                        key={number}
                        label={number}
                        size="small"
                        onClick={() => setValue('room_number', number, { shouldValidate: true })}
                        sx={{
                          height: 26,
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          bgcolor: selected ? brand.navy : '#fff',
                          color: selected ? '#fff' : brand.navy,
                          border: `1px solid ${alpha(brand.navy, 0.22)}`,
                          '& .MuiChip-label': { color: 'inherit', px: 1 },
                        }}
                      />
                    );
                  })}
                  {!selectedHostel && (
                    <Typography variant="caption" color="text.secondary">Select a hostel and floor first.</Typography>
                  )}
                </Box>
                {errors.room_number && (
                  <Typography variant="caption" color="error">{errors.room_number.message}</Typography>
                )}
              </Grid>
              {roomType === 'dormitory' && (
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Sharing Type"
                    type="number"
                    inputProps={{ min: 1 }}
                    {...register('sharing_type', {
                      valueAsNumber: true,
                      required: 'Sharing type is required for a dormitory',
                      min: { value: 1, message: 'Enter at least 1 bed' },
                    })}
                    error={!!errors.sharing_type}
                    helperText={errors.sharing_type?.message || 'Number of beds in this dormitory'}
                  />
                </Grid>
              )}
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Monthly Rent (₹)" type="number" {...register('rent', { valueAsNumber: true, required: 'Rent is required' })} error={!!errors.rent} helperText={errors.rent?.message} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <TextField select fullWidth label="Status" {...field}>
                      <MenuItem value="vacant">Available</MenuItem>
                      <MenuItem value="occupied">Occupied</MenuItem>
                      <MenuItem value="maintenance">Maintenance</MenuItem>
                      <MenuItem value="reserved">Reserved</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center' }}>
                <Controller
                  name="is_ac"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label="Air Conditioned" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center' }}>
                <Controller
                  name="has_attached_bath"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label="Attached bath" />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description" multiline rows={2} {...register('description')} />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" onClick={() => navigate('/rooms')}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? <CircularProgress size={24} /> : isEdit ? 'Update Room' : 'Create Room'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RoomFormPage;
