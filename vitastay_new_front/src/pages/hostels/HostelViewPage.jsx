import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, Button, Chip, Avatar, alpha, Tooltip,
  Dialog, DialogContent, IconButton, CircularProgress, Divider, TextField, MenuItem, Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SingleBedIcon from '@mui/icons-material/SingleBed';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { formatCurrency, getMediaUrl } from '../../utils/constants';
import { hostelLogoSrc, demoImage, personPhotoSrc } from '../../utils/demoImages';
import { brand } from '../../styles/theme';
import useAuth from '../../hooks/useAuth';
import LegacyMediaNotice from '../../components/media/LegacyMediaNotice';
import PublishChecklist from '../../components/media/PublishChecklist';
import HostelVisitsPanel from '../../components/hostels/HostelVisitsPanel';

const BED_META = {
  occupied: { color: brand.navy, label: 'Occupied' },
  vacant: { color: '#16A34A', label: 'Available' },
  reserved: { color: '#E6A23C', label: 'Held (website)' },
  maintenance: { color: '#D64545', label: 'Maintenance' },
};

const formatHeldUntil = (iso) => {
  if (!iso) return 'Held for an online guest';
  const when = dayjs(iso);
  if (!when.isValid()) return 'Held for an online guest';
  if (when.isBefore(dayjs())) return 'Hold ended — Reject in Bookings or wait for expiry';
  return `Held until ${when.format('h:mm A, D MMM')}`;
};

const holdCopy = (bed) => {
  const until = formatHeldUntil(bed?.hold?.hold_expires_at || bed?.hold_expires_at);
  const who = bed?.hold?.seeker_name;
  const code = bed?.hold?.booking_code;
  return [until, who, code].filter(Boolean).join(' · ');
};

const roomLabel = (type) => (type || '').replace(/_/g, ' ');

const roomCapacity = (room) => {
  if (room?.room_type === 'single') return 1;
  if (room?.room_type === 'double') return 2;
  if (room?.room_type === 'triple') return 3;
  const sharing = Number(room?.sharing_type);
  return Number.isFinite(sharing) && sharing > 0 ? sharing : 1;
};

const ageFromDob = (dob) => {
  if (!dob) return null;
  const years = dayjs().diff(dayjs(dob), 'year');
  return Number.isFinite(years) && years >= 0 && years < 120 ? years : null;
};

const Fact = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block">
      {label}
    </Typography>
    <Typography fontWeight={650} fontSize="0.92rem">
      {value || '—'}
    </Typography>
  </Box>
);

const Stat = ({ label, value, hint }) => (
  <Box sx={{ px: 1.25, py: 1, borderRadius: 1.5, bgcolor: alpha(brand.navy, 0.04) }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography fontWeight={750} fontSize="1.15rem" lineHeight={1.2}>{value}</Typography>
    {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
  </Box>
);

const HostelViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isOwner, isSuperAdmin, isSupervisor } = useAuth();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [floor, setFloor] = useState(1);
  const [blockId, setBlockId] = useState('all');
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [bedDialog, setBedDialog] = useState(null);
  const [bedAction, setBedAction] = useState(null);
  const [freeTenants, setFreeTenants] = useState([]);
  const [pickedTenant, setPickedTenant] = useState('');
  const [targetRoomId, setTargetRoomId] = useState('');
  const [shiftBlock, setShiftBlock] = useState('');
  const [shiftFloor, setShiftFloor] = useState('');
  const [savingBed, setSavingBed] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [tenantMove, setTenantMove] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [planDialog, setPlanDialog] = useState(false);
  const [planForm, setPlanForm] = useState({ plan: 'silver', period: 'year', reason: '', compUntil: '' });
  const [savingPlan, setSavingPlan] = useState(false);

  const loadTenants = async () => {
    try {
      const { data } = await api.get('/tenants', { params: { hostelId: id, limit: 200 } });
      const { data: list } = extractPaginated(data);
      setTenants(list.filter((tenant) => tenant.status !== 'moved_out'));
    } catch {
      setTenants([]);
    }
  };

  const refreshPlan = async () => {
    const { data } = await api.get(`/hostels/${id}/blueprint`);
    setPayload(extractData(data));
    await loadTenants();
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/hostels/${id}/blueprint`);
        const body = extractData(data);
        setPayload(body);
        const rooms = body?.rooms || [];
        const top = Math.max(Number(body?.summary?.floors) || 1, ...rooms.map((room) => Number(room.floor) || 1));
        setFloor(top);
        await loadTenants();
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
        navigate('/hostels');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, enqueueSnackbar, navigate]);

  const hostel = payload?.hostel || {};
  const rooms = payload?.rooms || [];
  const blocks = payload?.blocks || [];
  const summary = payload?.summary || {};

  const floorCount = summary.floors || 1;
  const floors = useMemo(
    () => Array.from({ length: floorCount }, (_, index) => floorCount - index),
    [floorCount]
  );

  const floorRooms = useMemo(() => rooms
    .filter((room) => Number(room.floor) === Number(floor))
    .filter((room) => blockId === 'all' || String(room.block_id || room.block?.id || '') === String(blockId))
    .slice()
    .sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })),
  [rooms, floor, blockId]);

  const selectedRoom = floorRooms.find((room) => room.id === selectedRoomId) || floorRooms[0] || null;

  const occupancy = summary.beds
    ? Math.round((summary.occupiedBeds / summary.beds) * 100)
    : 0;

  const address = [hostel.address, hostel.city, hostel.state, hostel.pincode, hostel.country]
    .filter(Boolean)
    .join(', ');

  const amenities = Array.isArray(hostel.amenities) ? hostel.amenities : [];

  const loadFreeTenants = async () => {
    try {
      const { data } = await api.get('/tenants', { params: { hostelId: id, limit: 200 } });
      const { data: list } = extractPaginated(data);
      setFreeTenants(list.filter((tenant) => !tenant.bed_id && tenant.status !== 'moved_out'));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const openBed = async (room, bed) => {
    const available = bed.status === 'vacant' && !bed.currentTenant;
    if (available) {
      setPickedTenant('');
      setOverrideReason('');
      setBedAction({ room, bed, mode: 'choose' });
      return;
    }
    if (bed.status === 'reserved') {
      setPickedTenant('');
      setOverrideReason('');
      setBedAction({ room, bed, mode: 'override' });
      await loadFreeTenants();
      return;
    }
    setBedDialog({ room, bed, detail: null, loading: true });
    try {
      const { data } = await api.get(`/hostels/${id}/beds/${bed.id}`);
      setBedDialog({ room, bed, detail: extractData(data), loading: false });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      setBedDialog((current) => (current ? { ...current, loading: false } : current));
    }
  };

  const startBook = async () => {
    setBedAction((current) => ({ ...current, mode: 'book' }));
    setPickedTenant('');
    await loadFreeTenants();
  };

  const otherRooms = useMemo(() => [...rooms]
    .filter((room) => String(room.id) !== String(bedAction?.room?.id))
    .filter((room) => (room.beds || []).length < roomCapacity(room))
    .sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })),
  [rooms, bedAction]);

  const blockName = (room) => room?.block?.name || 'No block';

  const shiftBlocks = useMemo(() => [...new Set(otherRooms.map(blockName))].sort(), [otherRooms]);

  const shiftFloors = useMemo(() => [...new Set(
    otherRooms.filter((room) => blockName(room) === shiftBlock).map((room) => String(room.floor))
  )].sort((a, b) => Number(a) - Number(b)), [otherRooms, shiftBlock]);

  const shiftRooms = useMemo(() => otherRooms.filter((room) =>
    blockName(room) === shiftBlock && String(room.floor) === String(shiftFloor)
  ), [otherRooms, shiftBlock, shiftFloor]);

  const pickShiftBlock = (block) => {
    setShiftBlock(block);
    const floors = [...new Set(
      otherRooms.filter((room) => blockName(room) === block).map((room) => String(room.floor))
    )].sort((a, b) => Number(a) - Number(b));
    const floor = floors[0] || '';
    setShiftFloor(floor);
    const match = otherRooms.find((room) => blockName(room) === block && String(room.floor) === floor);
    setTargetRoomId(match ? String(match.id) : '');
  };

  const pickShiftFloor = (floor) => {
    setShiftFloor(floor);
    const match = otherRooms.find((room) => blockName(room) === shiftBlock && String(room.floor) === String(floor));
    setTargetRoomId(match ? String(match.id) : '');
  };

  const availableBeds = useMemo(() => rooms.flatMap((room) => (room.beds || [])
    .filter((bed) => bed.status === 'vacant' && !bed.currentTenant)
    .map((bed) => ({
      id: bed.id,
      bedNumber: bed.bed_number,
      roomNumber: room.room_number,
      floor: room.floor,
      block: room.block?.name,
    })))
    .sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true })
      || String(a.bedNumber).localeCompare(String(b.bedNumber), undefined, { numeric: true })),
  [rooms]);

  const confirmBedAction = async () => {
    if (!bedAction || !pickedTenant) return;
    const isOverride = bedAction.mode === 'override';
    if (isOverride && overrideReason.trim().length < 3) return;
    setSavingBed(true);
    try {
      const payload = { tenant_id: pickedTenant };
      if (isOverride) {
        payload.override_hold = true;
        payload.reason = overrideReason.trim();
      }
      await api.post(`/hostels/${id}/beds/${bedAction.bed.id}/book`, payload);
      enqueueSnackbar(isOverride ? 'Walk-in override booked' : 'Bed booked', { variant: 'success' });
      setBedAction(null);
      setOverrideReason('');
      await refreshPlan();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSavingBed(false);
    }
  };

  const shiftEmptyBed = async () => {
    if (!bedAction || !targetRoomId) return;
    setSavingBed(true);
    try {
      await api.post(`/hostels/${id}/beds/${bedAction.bed.id}/shift`, { room_id: targetRoomId });
      enqueueSnackbar('Empty bed moved to the selected room', { variant: 'success' });
      setBedAction(null);
      await refreshPlan();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSavingBed(false);
    }
  };

  const confirmTenantMove = async () => {
    if (!tenantMove?.tenantId || !tenantMove.targetBedId) return;
    setSavingBed(true);
    try {
      await api.post(`/hostels/${id}/beds/${tenantMove.targetBedId}/transfer`, { tenant_id: tenantMove.tenantId });
      enqueueSnackbar('Tenant moved to the selected bed', { variant: 'success' });
      setTenantMove(null);
      setBedDialog(null);
      await refreshPlan();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSavingBed(false);
    }
  };

  const occupant = bedDialog?.detail?.tenant;
  const occupantUser = bedDialog?.detail?.user;
  const occupantName = occupant?.full_name
    || [occupantUser?.first_name, occupantUser?.last_name].filter(Boolean).join(' ')
    || bedDialog?.bed?.currentTenant?.full_name
    || '';

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  return (
    <Box>
      <PageHeader
        dense
        title={hostel.name || 'Hostel'}
        subtitle={hostel.code ? `Code ${hostel.code}` : 'Branch overview and floor plan'}
        breadcrumbs={[{ label: 'Hostels', path: '/hostels' }, { label: hostel.name || 'View' }]}
        actionLabel={(isOwner || isSuperAdmin || isSupervisor) ? 'Edit' : undefined}
        actionIcon={EditIcon}
        actionTo={(isOwner || isSuperAdmin || isSupervisor) ? `/hostels/${id}/edit` : undefined}
      >
        {(isOwner || isSuperAdmin || isSupervisor) && (
          <>
            <Button
              component={RouterLink}
              to={`/hostels/${id}/media`}
              variant="contained"
              startIcon={<PhotoLibraryOutlinedIcon />}
            >
              {isSuperAdmin ? 'Media' : 'Photos'}
            </Button>
            {Boolean(hostel?.entitlements?.listing_publish) && (
              <Button
                component={RouterLink}
                to={`/hostels/${id}/listing`}
                variant="outlined"
              >
                Preview listing
              </Button>
            )}
            {Boolean(hostel?.entitlements?.vita_eye) && (
              <Button
                component={RouterLink}
                to={`/hostels/${id}/vita-eye`}
                variant="outlined"
                startIcon={<CameraAltOutlinedIcon />}
              >
                Vita Eye
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                variant="outlined"
                onClick={() => {
                  setPlanForm({
                    plan: hostel.plan || 'silver',
                    period: hostel.plan_period || 'year',
                    reason: '',
                    compUntil: '',
                  });
                  setPlanDialog(true);
                }}
              >
                Assign plan
              </Button>
            )}
          </>
        )}
      </PageHeader>

      <PublishChecklist hostelId={id} />
      <HostelVisitsPanel hostelId={id} />
      <LegacyMediaNotice images={hostel.images} />

      <Grid container spacing={1.5}>
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <Box
              component="img"
              src={getMediaUrl(hostel.logo) || demoImage('exterior', hostel.id)}
              alt={hostel.name}
              sx={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
            />
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
                <Avatar
                  src={hostelLogoSrc(hostel)}
                  variant="rounded"
                  sx={{ width: 64, height: 64, bgcolor: brand.navy }}
                >
                  {(hostel.name || 'H').charAt(0)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={750} noWrap>{hostel.name}</Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    <StatusChip status={hostel.status} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${String(hostel.plan || 'regular').toUpperCase()} · ${hostel.plan_status || 'comp'}${hostel.plan_expires_at ? ` · until ${String(hostel.plan_expires_at).slice(0, 10)}` : ''}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      color={
                        hostel.listing_published
                        && hostel.status === 'active'
                        && hostel.entitlements?.public_search
                          ? 'success'
                          : 'default'
                      }
                      label={
                        hostel.listing_published
                        && hostel.status === 'active'
                        && hostel.entitlements?.public_search
                          ? 'Live for seekers'
                          : 'Hidden from seekers'
                      }
                    />
                  </Box>
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {address || 'Address not added'}
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                <Stat label="Floors" value={summary.floors || 0} />
                <Stat label="Rooms" value={summary.rooms || 0} hint={`${summary.occupiedRooms || 0} occupied`} />
                <Stat label="Beds" value={summary.beds || 0} hint={`${occupancy}% filled`} />
                <Stat label="Available beds" value={summary.vacantBeds || 0} />
                <Stat label="Tenants" value={tenants.length} />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Fact label="Area" value={hostel.area} />
                <Fact label="Guest gender" value={hostel.gender_policy === 'male' ? 'Men' : hostel.gender_policy === 'female' ? 'Women' : 'Unisex / co-ed'} />
                <Fact label="Capacity" value={hostel.capacity} />
                <Fact label="Security deposit" value={formatCurrency(hostel.security_deposit)} />
                <Fact label="Notice period" value={hostel.notice_period_months ? `${hostel.notice_period_months} months` : '—'} />
                <Fact
                  label="How guests book"
                  value={
                    hostel.booking_model === 'instant'
                      ? 'Instant book'
                      : hostel.booking_model === 'request_advance'
                        ? `Hold with advance (${hostel.advance_percent == null ? 20 : hostel.advance_percent}%)`
                        : 'Request to book'
                  }
                />
                <Fact label="Phone" value={hostel.contact_phone} />
                <Fact label="Email" value={hostel.contact_email} />
                <Fact label="Owner" value={hostel.owner ? `${hostel.owner.first_name} ${hostel.owner.last_name}` : '—'} />
              </Box>

              {hostel.description && (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  {hostel.description}
                </Typography>
              )}

              {amenities.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
                  {amenities.map((item) => (
                    <Chip key={item} size="small" label={item} />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                <Box>
                  <Typography fontWeight={750}>Floor plan</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Floors, rooms, and beds. A yellow mattress is a website hold until the time on the tooltip. Walk-in cannot take it unless they are at the gate and you write a reason — that cancels the guest and refunds them if they paid.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                  {Object.entries(BED_META).map(([key, meta]) => (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: meta.color }} />
                      <Typography variant="caption">{meta.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {rooms.some((room) => (room.beds || []).some((bed) => bed.status === 'reserved')) && (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  Yellow mattresses are website holds. Hover for Held until. Walk-in at the gate still needs a written reason — that cancels the guest and refunds them if they paid.
                </Alert>
              )}

              {blocks.length > 1 && (
                <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
                  {[{ id: 'all', name: 'All blocks' }, ...blocks].map((block) => {
                    const active = String(blockId) === String(block.id);
                    return (
                      <Chip
                        key={block.id}
                        label={block.name}
                        size="small"
                        variant={active ? 'filled' : 'outlined'}
                        onClick={() => setBlockId(block.id)}
                        sx={{
                          fontWeight: 650,
                          bgcolor: active ? brand.navy : '#fff',
                          color: active ? '#fff' : brand.navy,
                          borderColor: alpha(brand.navy, 0.22),
                          '& .MuiChip-label': { color: 'inherit' },
                        }}
                      />
                    );
                  })}
                </Box>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '148px 1fr' }, gap: 1.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {floors.map((level) => {
                    const onFloor = rooms.filter((room) => Number(room.floor) === level);
                    const bedsOnFloor = onFloor.flatMap((room) => room.beds || []);
                    const filled = bedsOnFloor.filter((bed) => bed.status === 'occupied').length;
                    const ratio = bedsOnFloor.length ? filled / bedsOnFloor.length : 0;
                    const active = Number(floor) === level;
                    return (
                      <Button
                        key={level}
                        onClick={() => { setFloor(level); setSelectedRoomId(null); }}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          border: '1px solid',
                          borderColor: active ? brand.teal : alpha(brand.navy, 0.12),
                          bgcolor: active ? alpha(brand.teal, 0.12) : '#fff',
                          color: brand.navy,
                          px: 1,
                          py: 0.75,
                          minHeight: 52,
                        }}
                      >
                        <Box sx={{ width: '100%' }}>
                          <Typography fontSize="0.8rem" fontWeight={700} textAlign="left">Floor {level}</Typography>
                          <Typography fontSize="0.68rem" color="text.secondary" textAlign="left">
                            {onFloor.length} rooms · {bedsOnFloor.length} beds
                          </Typography>
                          <Box sx={{ mt: 0.4, height: 4, borderRadius: 2, bgcolor: alpha(brand.navy, 0.08), overflow: 'hidden' }}>
                            <Box sx={{ width: `${ratio * 100}%`, height: '100%', bgcolor: brand.navy }} />
                          </Box>
                        </Box>
                      </Button>
                    );
                  })}
                </Box>

                <Box>
                  {floorRooms.length === 0 ? (
                    <Box sx={{
                      minHeight: 220,
                      border: `1px dashed ${alpha(brand.navy, 0.2)}`,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'text.secondary',
                    }}
                    >
                      <Typography variant="body2">No rooms drawn on floor {floor} yet.</Typography>
                    </Box>
                  ) : (
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: 1,
                      p: 1,
                      borderRadius: 2,
                      bgcolor: alpha(brand.navy, 0.04),
                      border: `1px solid ${alpha(brand.navy, 0.08)}`,
                    }}
                    >
                      {floorRooms.map((room) => {
                        const beds = [...(room.beds || [])].sort((a, b) => String(a.bed_number).localeCompare(String(b.bed_number), undefined, { numeric: true }));
                        const active = selectedRoom?.id === room.id;
                        return (
                          <Box
                            key={room.id}
                            onClick={() => setSelectedRoomId(room.id)}
                            sx={{
                              p: 1,
                              borderRadius: 1.5,
                              cursor: 'pointer',
                              bgcolor: '#fff',
                              border: '1.5px solid',
                              borderColor: active ? brand.teal : alpha(brand.navy, 0.12),
                              boxShadow: active ? `0 0 0 3px ${alpha(brand.teal, 0.2)}` : 'none',
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5, mb: 0.75 }}>
                              <Typography fontWeight={750} fontSize="0.85rem">Room {room.room_number}</Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  textTransform: 'capitalize',
                                  color: beds.length > roomCapacity(room) ? 'error.main' : 'text.secondary',
                                  fontWeight: beds.length > roomCapacity(room) ? 700 : 400,
                                }}
                              >
                                {roomLabel(room.room_type)} · {beds.length}/{roomCapacity(room)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {beds.length === 0 && (
                                <Typography variant="caption" color="text.secondary">No beds</Typography>
                              )}
                              {beds.map((bed) => {
                                const meta = BED_META[bed.status] || BED_META.vacant;
                                const guest = bed.currentTenant?.full_name;
                                const age = ageFromDob(bed.currentTenant?.date_of_birth);
                                const tip = guest ? (
                                  <Box sx={{ textAlign: 'center', py: 0.25 }}>
                                    <Typography variant="caption" display="block" fontWeight={700} color="inherit">
                                      {guest}
                                    </Typography>
                                    {bed.currentTenant?.status === 'pending' && (
                                      <Typography variant="caption" display="block" color="inherit">
                                        Pending check-in
                                      </Typography>
                                    )}
                                    {age != null && (
                                      <Typography variant="caption" display="block" color="inherit">
                                        {age}
                                      </Typography>
                                    )}
                                  </Box>
                                ) : (bed.status === 'reserved'
                                  ? holdCopy(bed)
                                  : (bed.status === 'occupied' ? 'No resident assigned' : meta.label));
                                return (
                                  <Tooltip key={bed.id} title={tip} arrow placement="top">
                                    <Box
                                      component="button"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openBed(room, bed);
                                      }}
                                      aria-label={guest
                                        ? `${guest}, bed ${bed.bed_number}`
                                        : `Bed ${bed.bed_number}, ${bed.status === 'reserved' ? holdCopy(bed) : meta.label}`}
                                      sx={{
                                        width: 42,
                                        height: 34,
                                        p: 0,
                                        border: 0,
                                        borderRadius: 1,
                                        cursor: 'pointer',
                                        color: '#fff',
                                        bgcolor: meta.color,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: 1,
                                        boxShadow: bed.status === 'vacant' && !guest ? '0 0 0 2px #BBF7D0' : 'none',
                                        '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
                                      }}
                                    >
                                      <SingleBedIcon sx={{ fontSize: 16 }} />
                                      <Box component="span" sx={{ fontSize: '0.62rem', fontWeight: 700 }}>{bed.bed_number}</Box>
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {selectedRoom && (
                    <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1.5, border: `1px solid ${alpha(brand.navy, 0.1)}` }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                        <Typography fontWeight={750}>
                          Room {selectedRoom.room_number}
                          {selectedRoom.block?.name ? ` · ${selectedRoom.block.name}` : ''}
                        </Typography>
                        <StatusChip status={selectedRoom.status} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {roomLabel(selectedRoom.room_type)} · {selectedRoom.is_ac ? 'AC' : 'Non-AC'} · Rent {formatCurrency(selectedRoom.rent)}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                        {(selectedRoom.beds || []).map((bed) => {
                          const meta = BED_META[bed.status] || BED_META.vacant;
                          return (
                            <Chip
                              key={bed.id}
                              size="small"
                              label={`Bed ${bed.bed_number}${bed.currentTenant?.full_name ? ` · ${bed.currentTenant.full_name}` : bed.status === 'reserved' ? ` · ${formatHeldUntil(bed.hold?.hold_expires_at || bed.hold_expires_at)}` : ` · ${meta.label}`}`}
                              sx={{ bgcolor: alpha(meta.color, 0.15), color: meta.color, fontWeight: 650 }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={Boolean(bedAction)} onClose={() => setBedAction(null)} maxWidth="sm" fullWidth>
        <DialogContent>
          {bedAction && (
            <>
              <Typography fontWeight={750}>
                Bed {bedAction.bed.bed_number} · Room {bedAction.room.room_number}
              </Typography>
              <Typography
                variant="body2"
                color={bedAction.bed.status === 'reserved' ? 'warning.main' : 'success.main'}
                sx={{ mb: 2 }}
              >
                {bedAction.bed.status === 'reserved' ? holdCopy(bedAction.bed) : 'Available'}
              </Typography>

              {bedAction.mode === 'choose' && (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  <Button variant="contained" color="success" onClick={startBook}>
                    Book this bed
                  </Button>
                  <Button variant="outlined" onClick={() => {
                    const nextRoom = otherRooms[0];
                    const block = nextRoom ? blockName(nextRoom) : '';
                    setShiftBlock(block);
                    setShiftFloor(nextRoom ? String(nextRoom.floor) : '');
                    setTargetRoomId(nextRoom ? String(nextRoom.id) : '');
                    setBedAction((current) => ({ ...current, mode: 'shift' }));
                  }}
                  >
                    Shift this empty bed to another room
                  </Button>
                </Box>
              )}

              {bedAction.mode === 'book' && (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  <TextField
                    select
                    size="small"
                    label="Tenant without a bed"
                    value={pickedTenant}
                    onChange={(event) => setPickedTenant(event.target.value)}
                  >
                    {freeTenants.length === 0 && <MenuItem value="" disabled>No unassigned tenants</MenuItem>}
                    {freeTenants.map((tenant) => (
                      <MenuItem key={tenant.id} value={String(tenant.id)}>
                        {tenant.full_name || `Tenant ${tenant.id}`}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button variant="contained" color="success" disabled={!pickedTenant || savingBed} onClick={confirmBedAction}>
                    {savingBed ? <CircularProgress size={20} /> : 'Confirm booking'}
                  </Button>
                  <Button size="small" onClick={() => navigate(`/tenants/new`)}>Register a new tenant</Button>
                </Box>
              )}

              {bedAction.mode === 'override' && (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  <Alert severity={bedAction.bed.hold?.payment_status === 'paid' ? 'warning' : 'info'}>
                    {bedAction.bed.hold?.payment_status === 'paid'
                      ? 'This guest already paid. Taking the bed refunds them in full, cancels the website request, and is audited.'
                      : 'The website guest keeps this mattress until the hold ends. Taking it now cancels their request. Write why — this is audited.'}
                  </Alert>
                  <TextField
                    size="small"
                    label="Reason"
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    helperText="At least 3 characters"
                  />
                  <TextField
                    select
                    size="small"
                    label="Walk-in tenant without a bed"
                    value={pickedTenant}
                    onChange={(event) => setPickedTenant(event.target.value)}
                  >
                    {freeTenants.length === 0 && <MenuItem value="" disabled>No unassigned tenants</MenuItem>}
                    {freeTenants.map((tenant) => (
                      <MenuItem key={tenant.id} value={String(tenant.id)}>
                        {tenant.full_name || `Tenant ${tenant.id}`}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    color="warning"
                    disabled={!pickedTenant || overrideReason.trim().length < 3 || savingBed}
                    onClick={confirmBedAction}
                  >
                    {savingBed ? <CircularProgress size={20} /> : 'Take bed for walk-in'}
                  </Button>
                  <Button size="small" onClick={() => navigate(`/tenants/new`)}>Register a new tenant</Button>
                </Box>
              )}

              {bedAction.mode === 'shift' && (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Bed {bedAction.bed.bed_number} leaves Room {bedAction.room.room_number} and is added to the room you pick.
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 0.7fr 1fr', gap: 1 }}>
                    <TextField
                      select
                      size="small"
                      label="Block"
                      value={shiftBlock}
                      onChange={(event) => pickShiftBlock(event.target.value)}
                    >
                      {shiftBlocks.map((block) => (
                        <MenuItem key={block} value={block}>{block}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      size="small"
                      label="Floor"
                      value={shiftFloor}
                      onChange={(event) => pickShiftFloor(event.target.value)}
                    >
                      {shiftFloors.map((floor) => (
                        <MenuItem key={floor} value={floor}>{floor}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      size="small"
                      label="Room"
                      value={targetRoomId}
                      onChange={(event) => setTargetRoomId(event.target.value)}
                    >
                      {shiftRooms.length === 0 && <MenuItem value="" disabled>None</MenuItem>}
                      {shiftRooms.map((room) => (
                        <MenuItem key={room.id} value={String(room.id)}>
                          {room.room_number}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <Button variant="contained" disabled={!targetRoomId || savingBed} onClick={shiftEmptyBed}>
                    {savingBed ? <CircularProgress size={20} /> : 'Shift bed'}
                  </Button>
                </Box>
              )}

              {bedAction.mode !== 'choose' && bedAction.mode !== 'override' && (
                <Button size="small" sx={{ mt: 1 }} onClick={() => setBedAction((current) => ({ ...current, mode: 'choose' }))}>
                  Back
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(tenantMove)} onClose={() => setTenantMove(null)} maxWidth="xs" fullWidth>
        <DialogContent>
          {tenantMove && (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Typography fontWeight={750}>Transfer {tenantMove.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Currently {tenantMove.fromLabel}. Pick an available bed.
              </Typography>
              <TextField
                select
                size="small"
                label="Available bed"
                value={tenantMove.targetBedId}
                onChange={(event) => setTenantMove((current) => ({ ...current, targetBedId: event.target.value }))}
              >
                {availableBeds
                  .filter((bed) => `Room ${bed.roomNumber} · Bed ${bed.bedNumber}` !== tenantMove.fromLabel)
                  .map((bed) => (
                    <MenuItem key={bed.id} value={String(bed.id)}>
                      Room {bed.roomNumber}
                      {bed.block ? ` · ${bed.block}` : ''}
                      {` · Floor ${bed.floor} · Bed ${bed.bedNumber}`}
                    </MenuItem>
                  ))}
                {availableBeds.length === 0 && <MenuItem value="" disabled>No available beds</MenuItem>}
              </TextField>
              <Button
                variant="contained"
                disabled={!tenantMove.targetBedId || savingBed}
                onClick={confirmTenantMove}
              >
                {savingBed ? <CircularProgress size={20} /> : 'Move tenant'}
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(bedDialog)}
        onClose={() => setBedDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          {bedDialog && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 2, pb: 1.5 }}>
                <Avatar
                  src={personPhotoSrc(occupant?.photo || occupantUser?.avatar, occupant?.id)}
                  sx={{ width: 56, height: 56, bgcolor: (BED_META[bedDialog.bed.status] || BED_META.vacant).color }}
                >
                  {(occupantName || 'B').charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={750} fontSize="1.05rem">
                    {occupantName || 'No one on this bed'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Bed {bedDialog.bed.bed_number}
                    {' · '}
                    Room {bedDialog.room.room_number}
                    {bedDialog.room.block?.name ? ` · ${bedDialog.room.block.name}` : ''}
                    {` · Floor ${bedDialog.room.floor}`}
                  </Typography>
                  <Box sx={{ mt: 0.75 }}>
                    <StatusChip status={occupant?.status || bedDialog.bed.status} />
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setBedDialog(null)} aria-label="Close">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              <Divider />
              <Box sx={{ p: 2 }}>
                {bedDialog.loading && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={28} />
                  </Box>
                )}
                {!bedDialog.loading && !occupant && (
                  <Typography variant="body2" color="text.secondary">
                    This bed is {BED_META[bedDialog.bed.status]?.label?.toLowerCase() || 'empty'}. Assign a tenant to see their details here.
                  </Typography>
                )}
                {!bedDialog.loading && occupant && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <Fact label="Phone" value={occupantUser?.phone || occupant.alternate_phone} />
                    <Fact label="Email" value={occupantUser?.email} />
                    <Fact label="Gender" value={occupant.gender} />
                    <Fact label="Date of birth" value={occupant.date_of_birth ? dayjs(occupant.date_of_birth).format('DD MMM YYYY') : ''} />
                    <Fact label="Blood group" value={occupant.blood_group} />
                    <Fact label="Nationality" value={occupant.nationality} />
                    <Fact label="Move in" value={occupant.move_in_date ? dayjs(occupant.move_in_date).format('DD MMM YYYY') : ''} />
                    <Fact label="Monthly rent" value={formatCurrency(occupant.monthly_rent)} />
                    <Fact label="Deposit" value={formatCurrency(occupant.deposit_amount)} />
                    <Fact label="Advance" value={formatCurrency(occupant.advance_amount)} />
                    <Fact label={occupant.is_student ? 'College' : 'Company'} value={occupant.is_student ? occupant.college : occupant.company} />
                    <Fact label="Employee / student ID" value={occupant.employee_id} />
                    <Fact label="Emergency contact" value={occupant.emergency_contact_name} />
                    <Fact label="Emergency phone" value={occupant.emergency_contact_phone} />
                    <Fact label="Aadhaar" value={occupant.aadhar_masked} />
                    <Fact label="PAN" value={occupant.pan_masked} />
                    {(occupant.address || occupant.current_address || occupant.city) && (
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Fact
                          label="Address"
                          value={[occupant.current_address || occupant.address, occupant.city, occupant.state, occupant.pincode].filter(Boolean).join(', ')}
                        />
                      </Box>
                    )}
                    {occupant.medical_conditions && (
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Fact label="Medical notes" value={occupant.medical_conditions} />
                      </Box>
                    )}
                  </Box>
                )}
                {!bedDialog.loading && occupant && (
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {occupant.status === 'pending' && (
                      <Button
                        variant="contained"
                        color="success"
                        disabled={savingBed}
                        onClick={async () => {
                          setSavingBed(true);
                          try {
                            await api.post(`/tenants/${occupant.id}/check-in`, { hostel_id: id });
                            enqueueSnackbar('Resident checked in', { variant: 'success' });
                            setBedDialog(null);
                            await refreshPlan();
                          } catch (err) {
                            enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
                          } finally {
                            setSavingBed(false);
                          }
                        }}
                      >
                        {savingBed ? <CircularProgress size={20} /> : 'Check in'}
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      onClick={() => setTenantMove({
                        tenantId: occupant.id,
                        name: occupantName,
                        fromLabel: `Room ${bedDialog.room.room_number} · Bed ${bedDialog.bed.bed_number}`,
                        targetBedId: '',
                      })}
                    >
                      Transfer to another bed
                    </Button>
                  </Box>
                )}
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={planDialog} onClose={() => setPlanDialog(false)} maxWidth="sm" fullWidth>
        <DialogContent>
          <Typography fontWeight={700} sx={{ mb: 1 }}>Assign owner plan</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Complimentary override. Regular unpublishes the listing. The gift still expires after the
            selected period unless you set Comp until. Write why (audit).
          </Typography>
          {planForm.plan === 'regular' && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Regular is the kill-switch: the listing unpublishes and guests cannot find this PG online.
            </Alert>
          )}
          <TextField
            select
            fullWidth
            size="small"
            label="Package"
            value={planForm.plan}
            onChange={(event) => setPlanForm((prev) => ({ ...prev, plan: event.target.value }))}
            sx={{ mb: 1.5 }}
          >
            <MenuItem value="regular">Regular</MenuItem>
            <MenuItem value="silver">Silver</MenuItem>
            <MenuItem value="gold">Gold</MenuItem>
          </TextField>
          <TextField
            select
            fullWidth
            size="small"
            label="Period"
            value={planForm.period}
            onChange={(event) => setPlanForm((prev) => ({ ...prev, period: event.target.value }))}
            sx={{ mb: 1.5 }}
          >
            <MenuItem value="month">Monthly</MenuItem>
            <MenuItem value="year">Yearly</MenuItem>
          </TextField>
          <TextField
            fullWidth
            size="small"
            type="date"
            label="Comp until (optional)"
            value={planForm.compUntil}
            onChange={(event) => setPlanForm((prev) => ({ ...prev, compUntil: event.target.value }))}
            InputLabelProps={{ shrink: true }}
            helperText="Leave empty to expire after the selected period. Set a date to gift until that day."
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Reason (min 10 characters)"
            value={planForm.reason}
            onChange={(event) => setPlanForm((prev) => ({ ...prev, reason: event.target.value }))}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button onClick={() => setPlanDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={savingPlan || String(planForm.reason || '').trim().length < 10}
              onClick={async () => {
                setSavingPlan(true);
                try {
                  const body = {
                    plan: planForm.plan,
                    period: planForm.period,
                    reason: planForm.reason,
                  };
                  if (planForm.compUntil) body.expires_at = planForm.compUntil;
                  await api.post(`/super-admin/hostels/${id}/plan`, body);
                  enqueueSnackbar('Plan assigned', { variant: 'success' });
                  setPlanDialog(false);
                  await refreshPlan();
                } catch (err) {
                  enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
                } finally {
                  setSavingPlan(false);
                }
              }}
            >
              {savingPlan ? <CircularProgress size={22} /> : 'Assign'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default HostelViewPage;
