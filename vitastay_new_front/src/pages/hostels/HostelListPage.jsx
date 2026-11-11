import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, TextField, MenuItem, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  FormGroup, FormControlLabel, Checkbox, Typography, Tooltip, Switch, Avatar,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import SearchBar from '../../components/common/SearchBar';
import useAuth from '../../hooks/useAuth';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE, HOSTEL_FEATURES, DEFAULT_HOSTEL_FEATURES } from '../../utils/constants';
import { hostelLogoSrc } from '../../utils/demoImages';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';

const HostelListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { isOwner, isSuperAdmin, isSupervisor } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [statusTarget, setStatusTarget] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [holdTarget, setHoldTarget] = useState(null);
  const [featuresTarget, setFeaturesTarget] = useState(null);
  const [featuresDraft, setFeaturesDraft] = useState({ ...DEFAULT_HOSTEL_FEATURES });
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approving, setApproving] = useState(false);

  const canManage = isOwner || isSuperAdmin;

  const fetchHostels = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isSuperAdmin ? '/super-admin/hostels' : '/hostels';
      const { data } = await api.get(endpoint, {
        params: { page: page + 1, limit: rowsPerPage, search: search || undefined, status: statusFilter || undefined },
      });
      const { data: list, pagination } = extractPaginated(data);
      setRows(list);
      setTotalCount(pagination.total);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter, enqueueSnackbar, isSuperAdmin]);

  useEffect(() => { fetchHostels(); }, [fetchHostels]);

  const statusLocked = (status) => ['pending_approval', 'rejected', 'on_hold'].includes(status);

  const handleSetActive = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === 'active' ? 'inactive' : 'active';
    setUpdatingStatus(true);
    try {
      await api.put(`/hostels/${statusTarget.id}`, { status: nextStatus });
      enqueueSnackbar(nextStatus === 'active' ? 'Hostel set to active' : 'Hostel set to inactive', { variant: 'success' });
      setStatusTarget(null);
      fetchHostels();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleHold = async () => {
    if (!holdTarget) return;
    const onHold = holdTarget.status !== 'on_hold';
    try {
      await api.patch(`/super-admin/hostels/${holdTarget.id}/hold`, { on_hold: onHold });
      enqueueSnackbar(onHold ? 'Hostel put on hold' : 'Hostel released from hold', { variant: 'success' });
      setHoldTarget(null);
      fetchHostels();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const openFeatures = (row) => {
    setFeaturesTarget(row);
    setFeaturesDraft({ ...DEFAULT_HOSTEL_FEATURES, ...(row.features || {}) });
  };

  const saveFeatures = async () => {
    if (!featuresTarget) return;
    setSavingFeatures(true);
    try {
      await api.patch(`/super-admin/hostels/${featuresTarget.id}/features`, { features: featuresDraft });
      enqueueSnackbar('Features updated', { variant: 'success' });
      setFeaturesTarget(null);
      fetchHostels();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    try {
      await api.post(`/super-admin/hostels/${approveTarget.id}/approve`);
      enqueueSnackbar('Hostel approved and activated', { variant: 'success' });
      setApproveTarget(null);
      fetchHostels();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setApproving(true);
    try {
      await api.post(`/super-admin/hostels/${rejectTarget.id}/reject`, { reason: rejectReason || undefined });
      enqueueSnackbar('Hostel registration rejected', { variant: 'info' });
      setRejectTarget(null);
      setRejectReason('');
      fetchHostels();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setApproving(false);
    }
  };

  const columns = [
    {
      field: 'name',
      headerName: 'Name',
      renderCell: ({ row, value }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar
            src={hostelLogoSrc(row)}
            variant="rounded"
            alt=""
            sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main' }}
          >
            {String(value || '?').charAt(0).toUpperCase()}
          </Avatar>
          <span>{value}</span>
        </Box>
      ),
    },
    { field: 'code', headerName: 'Code' },
    { field: 'city', headerName: 'City' },
    { field: 'capacity', headerName: 'Capacity', align: 'center' },
    ...(isSuperAdmin ? [{
      field: 'owner',
      headerName: 'Owner',
      renderCell: ({ value }) => value ? `${value.first_name} ${value.last_name}` : '—',
    }, {
      field: 'database_name',
      headerName: 'Database',
      renderCell: ({ value }) => value || '—',
    }] : []),
    {
      field: 'status',
      headerName: 'Status',
      renderCell: ({ value }) => <StatusChip status={value} />,
    },
    {
      field: 'plan',
      headerName: 'Plan',
      renderCell: ({ row }) => {
        const until = row.plan_expires_at ? ` · until ${String(row.plan_expires_at).slice(0, 10)}` : '';
        return (
          <Chip
            size="small"
            variant="outlined"
            label={`${String(row.plan || 'regular').toUpperCase()} · ${row.plan_status || 'comp'}${until}`}
          />
        );
      },
    },
    {
      field: 'listing_published',
      headerName: 'Listing',
      renderCell: ({ row }) => {
        const live = Boolean(row.listing_published)
          && row.status === 'active'
          && Boolean(row.entitlements?.public_search);
        return (
          <Chip
            size="small"
            color={live ? 'success' : 'default'}
            variant="outlined"
            label={live ? 'Live for seekers' : 'Hidden from seekers'}
          />
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Hostels"
        subtitle={
          isSuperAdmin
            ? 'Approve, hold, and open Media to finish listing photos / 360 for any PG'
            : isSupervisor
              ? 'Assigned hostels only — open Photos to complete the listing pack'
              : 'Manage your branches — new branches need Super Admin approval'
        }
        actionLabel={isSuperAdmin ? 'Register Hostel' : canManage ? 'Add Branch' : undefined}
        actionTo={isSuperAdmin ? '/super-admin/register-hostel' : canManage ? '/hostels/new' : undefined}
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <SearchBar placeholder="Search hostels..." onSearch={(v) => { setSearch(v); setPage(0); }} sx={{ flex: 1, minWidth: 200 }} />
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
          <MenuItem value="pending_approval">Pending Approval</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
          <MenuItem value="maintenance">Maintenance</MenuItem>
          <MenuItem value="on_hold">On Hold</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </TextField>
      </Box>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        page={page}
        rowsPerPage={rowsPerPage}
        totalCount={totalCount}
        onPageChange={setPage}
        onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(0); }}
        onView={(row) => navigate(`/hostels/${row.id}`)}
        onEdit={canManage ? (row) => navigate(`/hostels/${row.id}/edit`) : undefined}
        endActions={canManage ? (row) => {
          const locked = statusLocked(row.status);
          const isActive = row.status === 'active';
          return (
            <Tooltip title={locked ? 'Waiting on Super Admin' : isActive ? 'Active — turn off to deactivate' : 'Set active'}>
              <span>
                <Switch
                  size="small"
                  color="success"
                  checked={isActive}
                  disabled={locked}
                  onChange={() => setStatusTarget(row)}
                  inputProps={{ 'aria-label': isActive ? 'Deactivate hostel' : 'Set hostel active' }}
                />
              </span>
            </Tooltip>
          );
        } : undefined}
        customActions={(row) => (
          <>
            <Button size="small" onClick={() => navigate(`/hostels/${row.id}/media`)}>
              {isSuperAdmin ? 'Media' : 'Photos'}
            </Button>
            {isSuperAdmin && (
              <>
                {(row.status === 'pending_approval' || row.status === 'rejected') && (
                  <Button size="small" color="success" variant="contained" onClick={() => setApproveTarget(row)}>
                    Approve
                  </Button>
                )}
                {row.status === 'pending_approval' && (
                  <Button size="small" color="error" onClick={() => { setRejectTarget(row); setRejectReason(''); }}>
                    Reject
                  </Button>
                )}
                {row.status !== 'pending_approval' && row.status !== 'rejected' && (
                  <Button size="small" color={row.status === 'on_hold' ? 'success' : 'warning'} onClick={() => setHoldTarget(row)}>
                    {row.status === 'on_hold' ? 'Release' : 'Hold'}
                  </Button>
                )}
                <Button size="small" onClick={() => openFeatures(row)}>Features</Button>
              </>
            )}
          </>
        )}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.status === 'active' ? 'Deactivate Hostel' : 'Set Hostel Active'}
        message={
          statusTarget?.status === 'active'
            ? `Set "${statusTarget?.name}" to inactive? The seeker listing is unpublished too. Turning Active back on does not republish — use Photos → Publish listing.`
            : `Set "${statusTarget?.name}" to active? This is hostel operations only. Publish the listing separately from Photos if seekers should see it.`
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Deactivate' : 'Set active'}
        severity={statusTarget?.status === 'active' ? 'warning' : 'info'}
        loading={updatingStatus}
        onConfirm={handleSetActive}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(holdTarget)}
        title={holdTarget?.status === 'on_hold' ? 'Release Hostel' : 'Put Hostel On Hold'}
        message={
          holdTarget?.status === 'on_hold'
            ? `Release "${holdTarget?.name}" back to active operations? The listing stays unpublished until someone publishes it from Photos.`
            : `Put "${holdTarget?.name}" on hold? This also unpublishes the listing so it cannot stay on Google while closed. Releasing hold does not republish.`
        }
        confirmLabel={holdTarget?.status === 'on_hold' ? 'Release' : 'Hold'}
        severity="warning"
        onConfirm={handleHold}
        onCancel={() => setHoldTarget(null)}
      />

      <Dialog open={Boolean(featuresTarget)} onClose={() => setFeaturesTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Module Features — {featuresTarget?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Toggle which modules are enabled for this hostel
          </Typography>
          <FormGroup>
            {HOSTEL_FEATURES.map((feature) => (
              <FormControlLabel
                key={feature.key}
                control={(
                  <Checkbox
                    checked={Boolean(featuresDraft[feature.key])}
                    onChange={() => setFeaturesDraft((prev) => ({ ...prev, [feature.key]: !prev[feature.key] }))}
                  />
                )}
                label={feature.label}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeaturesTarget(null)}>Cancel</Button>
          <Button variant="contained" disabled={savingFeatures} onClick={saveFeatures}>Save Features</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="Approve Hostel"
        message={`Approve "${approveTarget?.name}" and set status to Active?`}
        confirmLabel="Approve"
        severity="info"
        loading={approving}
        onConfirm={handleApprove}
        onCancel={() => setApproveTarget(null)}
      />

      <Dialog open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reject Hostel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Reject registration for "{rejectTarget?.name}"?
          </Typography>
          <TextField
            fullWidth
            label="Reason (optional)"
            multiline
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={approving} onClick={handleReject}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HostelListPage;
