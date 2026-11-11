import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Avatar, Box, TextField, MenuItem, Tabs, Tab, Chip, IconButton, Tooltip, Button, alpha,
} from '@mui/material';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import LoginIcon from '@mui/icons-material/Login';
import { brand } from '../../styles/theme';
import TenantViewDialog from './TenantViewDialog';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import FilterToolbar from '../../components/common/FilterToolbar';
import DataTable from '../../components/common/DataTable';
import StatusChip from '../../components/common/StatusChip';
import SearchBar from '../../components/common/SearchBar';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE, displayEmail } from '../../utils/constants';
import { personPhotoSrc } from '../../utils/demoImages';
import { atmosphereFilterSx, atmosphereSelectMenuProps, atmosphereTabsSx } from '../../styles/atmosphere';
import InactivateTenantDialog from './InactivateTenantDialog';

const TABS = {
  active: { label: 'Active Tenants', statuses: 'active,pending' },
  inactive: { label: 'Inactive Tenants', statuses: 'inactive,moved_out' },
};

const STATUS_OPTIONS = {
  active: [{ value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }],
  inactive: [{ value: 'inactive', label: 'Inactive' }, { value: 'moved_out', label: 'Moved Out' }],
};

const TenantListPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState('active');
  const [rows, setRows] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState({ active: null, inactive: null });
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [inactivateTarget, setInactivateTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, []);

  const fetchCounts = useCallback(async () => {
    const entries = await Promise.all(Object.entries(TABS).map(async ([key, cfg]) => {
      try {
        const { data } = await api.get('/tenants', {
          params: { page: 1, limit: 1, hostelId: hostelFilter || undefined, status: cfg.statuses },
        });
        return [key, extractPaginated(data).pagination.total];
      } catch {
        return [key, null];
      }
    }));
    setCounts(Object.fromEntries(entries));
  }, [hostelFilter]);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tenants', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: search || undefined,
          hostelId: hostelFilter || undefined,
          status: statusFilter || TABS[tab].statuses,
        },
      });
      const { data: list, pagination } = extractPaginated(data);
      setRows(list);
      setTotalCount(pagination.total);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tab, page, rowsPerPage, search, hostelFilter, statusFilter, enqueueSnackbar]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const closeInactivate = useCallback(() => setInactivateTarget(null), []);
  const closeView = useCallback(() => setViewTarget(null), []);
  const onInactivated = useCallback(() => {
    setInactivateTarget(null);
    fetchTenants();
    fetchCounts();
  }, [fetchTenants, fetchCounts]);
  const onCheckedIn = useCallback(() => {
    fetchTenants();
    fetchCounts();
  }, [fetchTenants, fetchCounts]);

  const checkInRow = async (row, event) => {
    event?.stopPropagation?.();
    try {
      await api.post(`/tenants/${row.id}/check-in`, {
        hostel_id: row.hostel_id || row.hostel?.id,
      }, { params: { hostelId: row.hostel_id || row.hostel?.id, source: row.source } });
      enqueueSnackbar('Resident checked in', { variant: 'success' });
      fetchTenants();
      fetchCounts();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const changeTab = (_, value) => {
    setTab(value);
    setStatusFilter('');
    setPage(0);
  };

  const nameColumn = {
    field: 'name',
    headerName: 'Name',
    renderCell: ({ row }) => {
      const name = row.full_name || `${row.user?.first_name || ''} ${row.user?.last_name || ''}`.trim() || '—';
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar src={personPhotoSrc(row.photo || row.user?.avatar, row.id)} sx={{ width: 32, height: 32 }} />
          <span>{name}</span>
        </Box>
      );
    },
  };
  const phoneColumn = { field: 'phone', headerName: 'Phone', renderCell: ({ row }) => row.user?.phone || '—' };
  const hostelColumn = { field: 'hostel', headerName: 'Hostel', renderCell: ({ row }) => row.hostel?.name || '—' };
  const statusColumn = { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusChip status={value} /> };

  const columns = tab === 'active'
    ? [
      nameColumn,
      { field: 'email', headerName: 'Email', renderCell: ({ row }) => displayEmail(row.user?.email) || '—' },
      phoneColumn,
      hostelColumn,
      {
        field: 'room',
        headerName: 'Room / Bed',
        renderCell: ({ row }) => (row.room?.room_number
          ? `${row.room.room_number}${row.bed?.bed_number ? ` · Bed ${row.bed.bed_number}` : ''}`
          : '—'),
      },
      statusColumn,
    ]
    : [
      nameColumn,
      phoneColumn,
      hostelColumn,
      {
        field: 'move_in_date',
        headerName: 'Joined On',
        renderCell: ({ value }) => (value ? dayjs(value).format('DD MMM YYYY') : '—'),
      },
      {
        field: 'move_out_date',
        headerName: 'Inactive Since',
        renderCell: ({ value }) => (value ? dayjs(value).format('DD MMM YYYY') : '—'),
      },
      statusColumn,
    ];

  const tabLabel = (key) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {TABS[key].label}
      {counts[key] !== null && (
        <Chip
          size="small"
          label={counts[key]}
          sx={{
            height: 20,
            minWidth: 24,
            fontSize: 11,
            fontWeight: 700,
            color: tab === key ? '#fff' : brand.navy,
            bgcolor: tab === key ? brand.navy : alpha(brand.navy, 0.08),
          }}
        />
      )}
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Tenants"
        subtitle="Online bookings arrive as Pending — Check in when they take keys. Walk-ins are Active when you assign a bed."
        actionLabel="Add Tenant"
        actionTo="/tenants/new"
      />

      <FilterToolbar
        tabs={(
      <Tabs
        value={tab}
        onChange={changeTab}
        sx={{
          px: 1,
          borderBottom: `1px solid ${alpha(brand.navy, 0.08)}`,
          ...atmosphereTabsSx,
          '& .MuiTab-root': { ...atmosphereTabsSx['& .MuiTab-root'], fontWeight: 600, textTransform: 'none', fontSize: 14 },
        }}
      >
        <Tab value="active" label={tabLabel('active')} />
        <Tab value="inactive" label={tabLabel('inactive')} />
      </Tabs>
        )}
      >
        <SearchBar placeholder="Search tenants..." onSearch={(v) => { setSearch(v); setPage(0); }} sx={{ flex: 1, minWidth: 200 }} />
        <TextField
          select
          size="small"
          label="Hostel"
          value={hostelFilter}
          onChange={(e) => { setHostelFilter(e.target.value); setPage(0); }}
          sx={{ minWidth: 160, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All Hostels</MenuItem>
          {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
        </TextField>
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          sx={{ minWidth: 140, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All</MenuItem>
          {STATUS_OPTIONS[tab].map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
      </FilterToolbar>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        page={page}
        rowsPerPage={rowsPerPage}
        totalCount={totalCount}
        onPageChange={setPage}
        onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(0); }}
        primaryAction={(row) => (
          row.status === 'pending' ? (
            <Button size="small" variant="contained" startIcon={<LoginIcon />} onClick={(event) => checkInRow(row, event)}>
              Check in
            </Button>
          ) : (
            <Button size="small" variant="contained" onClick={() => setViewTarget(row)}>
              View
            </Button>
          )
        )}
        endActions={tab === 'active' ? (row) => (
          <>
            <Tooltip title="Mark Inactive">
              <IconButton size="small" color="warning" onClick={() => setInactivateTarget(row)}>
                <PersonOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : undefined}
        emptyMessage={tab === 'active' ? 'No active tenants' : 'No inactive tenants'}
      />

      <InactivateTenantDialog tenant={inactivateTarget} onClose={closeInactivate} onDone={onInactivated} />
      <TenantViewDialog
        tenant={viewTarget}
        onClose={closeView}
        onEdit={(row) => navigate(`/tenants/${row.id}/edit`)}
        onCheckedIn={onCheckedIn}
      />
    </Box>
  );
};

export default TenantListPage;
