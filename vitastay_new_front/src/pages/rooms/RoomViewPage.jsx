import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, Button, Chip, Avatar, Tooltip, Divider, alpha,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SingleBedIcon from '@mui/icons-material/SingleBed';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import ApartmentIcon from '@mui/icons-material/Apartment';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, getErrorMessage } from '../../services/api';
import { formatCurrency, getMediaUrl } from '../../utils/constants';
import { demoImage } from '../../utils/demoImages';
import { brand } from '../../styles/theme';
import { BED_META, roomPath } from './roomUtils';
import LegacyMediaNotice from '../../components/media/LegacyMediaNotice';

const ageFromDob = (dob) => {
  if (!dob) return null;
  const years = dayjs().diff(dayjs(dob), 'year');
  return Number.isFinite(years) && years >= 0 && years < 120 ? years : null;
};

const initials = (name) => String(name || '?')
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('');

const Fact = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
    <Typography fontWeight={650} fontSize="0.9rem" sx={{ textTransform: 'capitalize' }}>{value || '—'}</Typography>
  </Box>
);

const Stat = ({ label, value, color }) => (
  <Box sx={{ px: 1.25, py: 1, borderRadius: 1.5, bgcolor: alpha(color || brand.navy, 0.06) }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography fontWeight={750} fontSize="1.15rem" lineHeight={1.2} sx={{ color: color || 'text.primary' }}>{value}</Typography>
  </Box>
);

const RoomViewPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const hostelId = searchParams.get('hostelId') || '';
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomPhotos, setRoomPhotos] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/rooms/${id}/details`, { params: { hostelId: hostelId || undefined } });
      const details = extractData(data);
      setRoom(details);
      const hostelKey = hostelId || details?.hostel?.id;
      if (hostelKey) {
        try {
          const mediaRes = await api.get(`/hostels/${hostelKey}/media`, { params: { category: 'room', room_id: id } });
          setRoomPhotos(extractData(mediaRes)?.items || []);
        } catch {
          setRoomPhotos([]);
        }
      }
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      navigate('/rooms');
    } finally {
      setLoading(false);
    }
  }, [id, hostelId, navigate, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  if (loading || !room) return <LoadingSkeleton variant="form" />;

  const beds = room.beds || [];
  const counts = beds.reduce((acc, bed) => ({ ...acc, [bed.status]: (acc[bed.status] || 0) + 1 }), {});
  const occupants = room.occupants || [];
  const inactive = room.is_active === false;
  const monthlyIncome = occupants.reduce((sum, o) => sum + (Number(o.monthly_rent) || 0), 0);

  return (
    <Box>
      <PageHeader
        dense
        title={`Room ${room.room_number}`}
        subtitle={`${room.hostel?.name || 'Hostel'} · Floor ${room.floor}${room.block?.name ? ` · ${room.block.name}` : ''}`}
        breadcrumbs={[{ label: 'Rooms', path: '/rooms' }, { label: `Room ${room.room_number}` }]}
      >
        {room.hostel?.id && (
          <Button variant="outlined" size="small" startIcon={<ApartmentIcon />} component={RouterLink} to={`/hostels/${room.hostel.id}`}>
            Floor plan
          </Button>
        )}
        {!inactive && (
          <Button variant="contained" size="small" startIcon={<EditIcon />} component={RouterLink} to={roomPath(room, '/edit')}>
            Edit room
          </Button>
        )}
      </PageHeader>

      <LegacyMediaNotice images={room.images} kind="room" />

      <Grid container spacing={1.5}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <Box
              component="img"
              src={getMediaUrl(roomPhotos[0]?.thumb_url || roomPhotos[0]?.url) || demoImage('room', room.id)}
              alt={`Room ${room.room_number}`}
              sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
            />
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: alpha(brand.navy, 0.08), color: brand.navy, fontWeight: 800 }}>
                  {room.room_number}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={750} sx={{ textTransform: 'capitalize' }}>
                    {room.room_type} room
                    {room.is_ac && (
                      <Tooltip arrow title="Air conditioned">
                        <AcUnitIcon sx={{ fontSize: 16, color: brand.teal, ml: 0.5, verticalAlign: 'middle' }} />
                      </Tooltip>
                    )}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
                    <StatusChip status={room.status} label={room.status === 'vacant' ? 'Available' : undefined} />
                    <Chip
                      size="small"
                      label={inactive ? 'Inactive' : 'Active'}
                      sx={{
                        height: 22, fontWeight: 700, fontSize: '0.7rem',
                        bgcolor: alpha(inactive ? '#D64545' : '#16A34A', 0.12),
                        color: inactive ? '#D64545' : '#16A34A',
                      }}
                    />
                  </Box>
                </Box>
              </Box>

              {inactive && (
                <Box sx={{ p: 1.25, mb: 1.5, borderRadius: 1.5, bgcolor: alpha('#D64545', 0.07), border: `1px solid ${alpha('#D64545', 0.2)}` }}>
                  <Typography variant="caption" sx={{ color: '#D64545', fontWeight: 700, display: 'block' }}>
                    Inactive since {room.deactivated_at ? dayjs(room.deactivated_at).format('DD MMM YYYY, hh:mm A') : '—'}
                  </Typography>
                  <Typography variant="body2">{room.deactivation_reason || 'No reason given'}</Typography>
                  {room.deactivatedBy && (
                    <Typography variant="caption" color="text.secondary">By {room.deactivatedBy}</Typography>
                  )}
                </Box>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1.5 }}>
                <Stat label="Beds" value={`${beds.length}/${room.capacity}`} color={beds.length > room.capacity ? '#D64545' : undefined} />
                <Stat label="Available" value={counts.vacant || 0} color={BED_META.vacant.color} />
                <Stat label="Tenants" value={occupants.length} color={brand.navy} />
              </Box>

              <Divider sx={{ mb: 1.5 }} />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                <Fact label="Hostel" value={room.hostel?.name} />
                <Fact label="Floor" value={`Floor ${room.floor}`} />
                <Fact label="Block" value={room.block?.name} />
                <Fact label="Room type" value={`${room.room_type} · ${room.capacity} beds`} />
                <Fact label="Rent per bed" value={formatCurrency(room.rent)} />
                <Fact label="Collected monthly" value={formatCurrency(monthlyIncome)} />
                <Fact label="Cleaning" value={room.cleaning_status?.replace(/_/g, ' ')} />
                <Fact label="Maintenance" value={room.maintenance_status === 'none' ? 'None' : room.maintenance_status?.replace(/_/g, ' ')} />
              </Box>
              {room.description && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" display="block">Description</Typography>
                  <Typography variant="body2">{room.description}</Typography>
                </>
              )}
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>Room photos</Typography>
              <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto' }}>
                {(roomPhotos.length ? roomPhotos : [1, 2, 3].map((n) => ({ id: `demo-${n}` }))).slice(0, 6).map((item, index) => (
                  <Box
                    key={item.id}
                    component="img"
                    src={getMediaUrl(item.thumb_url || item.url) || demoImage('room', (room.id || 0) + index)}
                    alt={item.caption || `Room ${room.room_number}`}
                    sx={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 1.5 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
                <Typography fontWeight={750}>Bed layout</Typography>
                <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                  {Object.entries(BED_META).map(([key, meta]) => (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <SingleBedIcon sx={{ fontSize: 15, color: meta.color }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        {meta.label} {counts[key] ? `(${counts[key]})` : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              {beds.length ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1 }}>
                  {beds.map((bed) => {
                    const meta = BED_META[bed.status] || BED_META.vacant;
                    const age = ageFromDob(bed.occupant?.date_of_birth);
                    return (
                      <Box
                        key={bed.id}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5,
                          border: `1px solid ${alpha(meta.color, 0.35)}`, bgcolor: alpha(meta.color, 0.06),
                        }}
                      >
                        <Box sx={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 1, bgcolor: meta.color, color: '#fff' }}>
                          <SingleBedIcon sx={{ fontSize: 20 }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: meta.color, fontWeight: 700, display: 'block', lineHeight: 1.2 }}>
                            Bed {bed.bed_number} · {meta.label}
                          </Typography>
                          <Typography variant="body2" fontWeight={650} noWrap title={bed.occupant?.full_name || ''}>
                            {bed.occupant ? `${bed.occupant.full_name}${age !== null ? `, ${age}` : ''}` : '—'}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">This room has no beds yet.</Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
                <PeopleAltIcon sx={{ fontSize: 20, color: brand.navy }} />
                <Typography fontWeight={750}>Tenants staying ({occupants.length})</Typography>
              </Box>
              {occupants.length ? (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {occupants.map((person) => {
                    const age = ageFromDob(person.date_of_birth);
                    return (
                      <Box
                        key={person.id}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'minmax(180px, 1.3fr) 1fr 1fr auto' },
                          alignItems: 'center',
                          gap: 1.25,
                          p: 1.25,
                          borderRadius: 1.5,
                          border: `1px solid ${alpha(brand.navy, 0.1)}`,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <Avatar src={person.photo ? getMediaUrl(person.photo) : undefined} sx={{ width: 38, height: 38, bgcolor: brand.navy, fontSize: '0.85rem' }}>
                            {initials(person.full_name)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={700} fontSize="0.92rem" noWrap>{person.full_name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                              {[age !== null ? `${age} yrs` : null, person.gender, person.bed_number ? `Bed ${person.bed_number}` : 'No bed'].filter(Boolean).join(' · ')}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} noWrap>
                            <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />{person.phone || '—'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} noWrap title={person.email || ''}>
                            <EmailIcon sx={{ fontSize: 13 }} />{person.email || '—'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={650}>{formatCurrency(person.monthly_rent)}/mo</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {person.move_in_date ? `Since ${dayjs(person.move_in_date).format('DD MMM YYYY')}` : 'Move-in date not set'}
                          </Typography>
                        </Box>
                        <StatusChip status={person.status} />
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No tenants are staying in this room.</Typography>
                  {!inactive && room.hostel?.id && (
                    <Button size="small" sx={{ mt: 1 }} component={RouterLink} to={`/hostels/${room.hostel.id}`}>
                      Book a bed from the floor plan
                    </Button>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RoomViewPage;
