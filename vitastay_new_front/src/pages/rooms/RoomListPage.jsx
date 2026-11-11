import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, MenuItem, Chip, Tooltip, Typography, Button, Switch, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, alpha,
} from '@mui/material';
import SingleBedIcon from '@mui/icons-material/SingleBed';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import HistoryIcon from '@mui/icons-material/History';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import FilterToolbar from '../../components/common/FilterToolbar';
import DataTable from '../../components/common/DataTable';
import StatusChip from '../../components/common/StatusChip';
import SearchBar from '../../components/common/SearchBar';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE, formatCurrency } from '../../utils/constants';
import { demoImage } from '../../utils/demoImages';
import { brand } from '../../styles/theme';
import { BED_META, roomCapacity, roomPath } from './roomUtils';

const ROOM_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'triple', label: 'Triple' },
  { value: 'dormitory', label: 'Dormitory' },
];

const AVAILABILITY = [
  { value: '', label: 'All rooms' },
  { value: 'available', label: 'Has available bed' },
  { value: 'full', label: 'Fully booked' },
];

const MAX_BED_ICONS = 8;

const busyBeds = (room) => (room.beds || []).filter((b) => b.status === 'occupied' || b.status === 'reserved').length;

const selectSx = {
  minWidth: 120,
  '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 2, fontSize: '0.85rem' },
  '& .MuiInputLabel-root': { fontSize: '0.85rem' },
};

const BedStrip = ({ room }) => {
  const beds = [...(room.beds || [])].sort((a, b) => String(a.bed_number).localeCompare(String(b.bed_number), undefined, { numeric: true }));
  const capacity = roomCapacity(room);
  const free = beds.filter((b) => b.status === 'vacant').length;
  const over = capacity > 0 && beds.length > capacity;
  const shown = beds.slice(0, MAX_BED_ICONS);

  if (!beds.length) {
    return <Typography variant="caption" color="text.secondary">No beds</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {shown.map((bed) => {
          const meta = BED_META[bed.status] || BED_META.vacant;
          return (
            <Tooltip key={bed.id} arrow title={`Bed ${bed.bed_number} · ${meta.label}`}>
              <Box
                sx={{
                  display: 'inline-flex',
                  p: '2px',
                  borderRadius: 1,
                  color: meta.color,
                  bgcolor: alpha(meta.color, 0.1),
                  border: `1px solid ${alpha(meta.color, 0.35)}`,
                }}
              >
                <SingleBedIcon sx={{ fontSize: 16 }} />
              </Box>
            </Tooltip>
          );
        })}
        {beds.length > MAX_BED_ICONS && (
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.25 }}>
            +{beds.length - MAX_BED_ICONS}
          </Typography>
        )}
      </Box>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, whiteSpace: 'nowrap', color: free ? BED_META.vacant.color : 'text.secondary' }}
      >
        {free ? `${free} free` : 'Full'}
      </Typography>
      {over && (
        <Tooltip arrow title={`${beds.length} beds in a room built for ${capacity}`}>
          <Chip size="small" label="Over capacity" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: alpha('#D64545', 0.12), color: '#D64545' }} />
        </Tooltip>
      )}
    </Box>
  );
};

const RoomListPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState('active');
  const [rows, setRows] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [tabCounts, setTabCounts] = useState({ active: 0, inactive: 0 });
  const [search, setSearch] = useState('');
  const [searchKey, setSearchKey] = useState(0);
  const [hostelFilter, setHostelFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [availability, setAvailability] = useState('');
  const [toggleTarget, setToggleTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [toggling, setToggling] = useState(false);

  const isInactiveTab = tab === 'inactive';

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, []);

  const selectedHostel = useMemo(
    () => hostels.find((h) => String(h.id) === String(hostelFilter)),
    [hostels, hostelFilter],
  );

  const floorOptions = useMemo(() => {
    const max = selectedHostel
      ? Number(selectedHostel.total_floors) || 1
      : Math.max(1, ...hostels.map((h) => Number(h.total_floors) || 0));
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [selectedHostel, hostels]);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const shared = {
      search: search || undefined,
      hostelId: hostelFilter || undefined,
      floor: floorFilter || undefined,
      roomType: typeFilter || undefined,
    };
    const tabOnly = isInactiveTab ? {} : {
      status: statusFilter || undefined,
      availability: availability || undefined,
    };
    try {
      const [{ data }, other] = await Promise.all([
        api.get('/rooms', {
          params: {
            ...shared, ...tabOnly, page: page + 1, limit: rowsPerPage, active: isInactiveTab ? 'false' : 'true',
          },
        }),
        api.get('/rooms', { params: { ...shared, page: 1, limit: 1, active: isInactiveTab ? 'true' : 'false' } })
          .catch(() => null),
      ]);
      const { data: list, pagination } = extractPaginated(data);
      setRows(list);
      setTotalCount(pagination.total);
      const otherTotal = other ? extractPaginated(other.data).pagination.total : 0;
      setTabCounts(isInactiveTab
        ? { active: otherTotal, inactive: pagination.total }
        : { active: pagination.total, inactive: otherTotal });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, hostelFilter, floorFilter, typeFilter, statusFilter, availability, isInactiveTab, enqueueSnackbar]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const withReset = (setter) => (e) => { setter(e.target.value); setPage(0); };

  const handleHostelChange = (e) => {
    const next = e.target.value;
    const hostel = hostels.find((h) => String(h.id) === String(next));
    if (floorFilter && hostel && Number(floorFilter) > (Number(hostel.total_floors) || 1)) setFloorFilter('');
    setHostelFilter(next);
    setPage(0);
  };

  const activeFilters = [
    search, hostelFilter, floorFilter, typeFilter,
    ...(isInactiveTab ? [] : [statusFilter, availability]),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setSearchKey((k) => k + 1);
    setHostelFilter('');
    setFloorFilter('');
    setTypeFilter('');
    setStatusFilter('');
    setAvailability('');
    setPage(0);
  };

  const openToggle = (room) => {
    setReason('');
    setToggleTarget(room);
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    const makeActive = toggleTarget.is_active === false;
    setToggling(true);
    try {
      const hostelId = toggleTarget.hostel_id || toggleTarget.hostel?.id;
      const { data } = await api.patch(
        `/rooms/${toggleTarget.id}/active`,
        { is_active: makeActive, reason: reason || undefined },
        { params: { hostelId: hostelId || undefined } },
      );
      enqueueSnackbar(data?.message || 'Room updated', { variant: 'success' });
      setToggleTarget(null);
      fetchRooms();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setToggling(false);
    }
  };

  const roomCell = {
    field: 'room_number',
    headerName: 'Room',
    renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="img"
          src={demoImage('room', row.id)}
          alt=""
          sx={{ width: 44, height: 32, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
        />
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, color: brand.navy, lineHeight: 1.2 }}>
            {row.room_number}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Floor {row.floor}{row.block?.name ? ` · ${row.block.name}` : ''}
          </Typography>
        </Box>
      </Box>
    ),
  };

  const typeCell = {
    field: 'room_type',
    headerName: 'Type',
    renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
          {row.room_type?.replace(/_/g, ' ')}
          <Typography component="span" variant="caption" color="text.secondary"> · {roomCapacity(row)} beds</Typography>
        </Typography>
        {row.is_ac && (
          <Tooltip arrow title="Air conditioned">
            <AcUnitIcon sx={{ fontSize: 14, color: brand.teal }} />
          </Tooltip>
        )}
      </Box>
    ),
  };

  const hostelCell = {
    field: 'hostel',
    headerName: 'Hostel',
    renderCell: ({ row }) => row.hostel?.name || selectedHostel?.name || '—',
  };

  const activeColumns = [
    roomCell,
    typeCell,
    { field: 'beds', headerName: 'Beds', renderCell: ({ row }) => <BedStrip room={row} /> },
    { field: 'rent', headerName: 'Rent', renderCell: ({ value }) => formatCurrency(value) },
    hostelCell,
    {
      field: 'status',
      headerName: 'Status',
      renderCell: ({ value }) => <StatusChip status={value} label={value === 'vacant' ? 'Available' : undefined} />,
    },
  ];

  const inactiveColumns = [
    roomCell,
    typeCell,
    hostelCell,
    {
      field: 'deactivated_at',
      headerName: 'Inactive since',
      renderCell: ({ value }) => (value ? (
        <Box>
          <Typography variant="body2" sx={{ lineHeight: 1.2 }}>{dayjs(value).format('DD MMM YYYY')}</Typography>
          <Typography variant="caption" color="text.secondary">{dayjs(value).format('hh:mm A')}</Typography>
        </Box>
      ) : '—'),
    },
    {
      field: 'deactivation_reason',
      headerName: 'Reason',
      renderCell: ({ value }) => (
        <Typography variant="body2" sx={{ maxWidth: 260, color: value ? 'text.primary' : 'text.secondary' }} noWrap title={value || ''}>
          {value || 'No reason given'}
        </Typography>
      ),
    },
    { field: 'deactivatedBy', headerName: 'By', renderCell: ({ value }) => value || '—' },
  ];

  const activeSwitch = (row) => {
    const busy = busyBeds(row);
    const isActive = row.is_active !== false;
    const blocked = isActive && busy > 0;
    const hint = blocked
      ? `${busy} bed${busy === 1 ? ' is' : 's are'} occupied or reserved — transfer tenants before making it inactive`
      : isActive ? 'Active · click to make inactive' : 'Inactive · click to activate';
    return (
      <Tooltip arrow title={hint}>
        <span>
          <Switch
            size="small"
            color="success"
            checked={isActive}
            disabled={blocked}
            onChange={() => openToggle(row)}
          />
        </span>
      </Tooltip>
    );
  };

  const makingActive = toggleTarget?.is_active === false;

  return (
    <Box>
      <PageHeader dense title="Rooms" subtitle="Room inventory and bed availability" actionLabel="Add Room" actionTo="/rooms/new" />

      <FilterToolbar
        tabs={(
        <Tabs
          value={tab}
          onChange={(_, value) => { setTab(value); setPage(0); }}
          sx={{
            minHeight: 40,
            px: 1,
            borderBottom: `1px solid ${alpha(brand.navy, 0.08)}`,
            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600, fontSize: '0.85rem' },
          }}
        >
          <Tab
            value="active"
            icon={<MeetingRoomIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Active rooms (${tabCounts.active})`}
          />
          <Tab
            value="inactive"
            icon={<HistoryIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Inactive log (${tabCounts.inactive})`}
          />
        </Tabs>
        )}
      >
          <Box
            sx={{
              width: '100%',
              display: 'grid',
              gap: 1,
              alignItems: 'center',
              gridTemplateColumns: {
                xs: '1fr 1fr',
                md: isInactiveTab
                  ? 'minmax(180px, 1.6fr) 1.3fr 0.7fr 0.9fr auto'
                  : 'minmax(180px, 1.6fr) 1.3fr 0.7fr 0.9fr 0.9fr auto',
              },
              '& > :first-of-type': { gridColumn: { xs: '1 / -1', md: 'auto' } },
            }}
          >
            <SearchBar
              key={searchKey}
              placeholder="Search room number..."
              onSearch={(v) => { setSearch(v); setPage(0); }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(brand.navy, 0.04) } }}
            />
            <TextField select size="small" label="Hostel" value={hostelFilter} onChange={handleHostelChange} sx={selectSx}>
              <MenuItem value="">All hostels</MenuItem>
              {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Floor" value={floorFilter} onChange={withReset(setFloorFilter)} sx={{ ...selectSx, minWidth: 90 }}>
              <MenuItem value="">All</MenuItem>
              {floorOptions.map((f) => <MenuItem key={f} value={f}>Floor {f}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Type" value={typeFilter} onChange={withReset(setTypeFilter)} sx={selectSx}>
              <MenuItem value="">All types</MenuItem>
              {ROOM_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            {!isInactiveTab && (
              <TextField select size="small" label="Status" value={statusFilter} onChange={withReset(setStatusFilter)} sx={selectSx}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="vacant">Available</MenuItem>
                <MenuItem value="occupied">Occupied</MenuItem>
                <MenuItem value="reserved">Reserved</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
              </TextField>
            )}
            <Button
              size="small"
              startIcon={<FilterAltOffIcon fontSize="small" />}
              onClick={clearFilters}
              disabled={!activeFilters}
              sx={{ whiteSpace: 'nowrap', color: brand.navy }}
            >
              Clear{activeFilters ? ` (${activeFilters})` : ''}
            </Button>
          </Box>

          {!isInactiveTab ? (
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {AVAILABILITY.map((opt) => {
                  const selected = availability === opt.value;
                  return (
                    <Chip
                      key={opt.value || 'all'}
                      size="small"
                      label={opt.label}
                      onClick={() => { setAvailability(opt.value); setPage(0); }}
                      sx={{
                        height: 24,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        bgcolor: selected ? brand.navy : alpha(brand.navy, 0.06),
                        color: selected ? '#fff' : brand.navy,
                        '&:hover': { bgcolor: selected ? brand.navy : alpha(brand.navy, 0.12) },
                      }}
                    />
                  );
                })}
                <Typography variant="caption" sx={{ alignSelf: 'center', color: 'text.secondary', ml: 0.5 }}>
                  {totalCount} room{totalCount === 1 ? '' : 's'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                {Object.entries(BED_META).map(([key, meta]) => (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                    <SingleBedIcon sx={{ fontSize: 15, color: meta.color }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{meta.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, width: '100%' }}>
              Inactive rooms are hidden from booking, transfers and the floor plan. Switch one on to bring it back.
            </Typography>
          )}
      </FilterToolbar>

      <DataTable
        columns={isInactiveTab ? inactiveColumns : activeColumns}
        rows={rows}
        loading={loading}
        page={page}
        rowsPerPage={rowsPerPage}
        totalCount={totalCount}
        onPageChange={setPage}
        onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(0); }}
        primaryAction={(row) => (
          <Button size="small" variant="contained" onClick={() => navigate(roomPath(row))}>
            Open
          </Button>
        )}
        onEdit={isInactiveTab ? undefined : (row) => navigate(roomPath(row, '/edit'))}
        endActions={activeSwitch}
        emptyMessage={isInactiveTab ? 'No inactive rooms' : 'No rooms match these filters'}
      />

      <Dialog open={Boolean(toggleTarget)} onClose={() => !toggling && setToggleTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          {makingActive ? 'Activate' : 'Make inactive'} · Room {toggleTarget?.room_number}
        </DialogTitle>
        <DialogContent>
          {makingActive ? (
            <Typography variant="body2" color="text.secondary">
              The room and its beds will be available again for booking, transfers and the floor plan.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                The room is kept with its history but hidden from booking, transfers and the floor plan.
                You can find it later in the Inactive log tab.
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Reason (optional)"
                placeholder="e.g. Renovation, plumbing work"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                inputProps={{ maxLength: 255 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setToggleTarget(null)} disabled={toggling}>Cancel</Button>
          <Button
            variant="contained"
            color={makingActive ? 'success' : 'warning'}
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? <CircularProgress size={20} /> : makingActive ? 'Activate room' : 'Make inactive'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoomListPage;
