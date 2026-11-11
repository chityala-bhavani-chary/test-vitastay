import { useEffect, useState, useCallback } from 'react';
import {
  Box, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, CircularProgress,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import useAuth from '../../hooks/useAuth';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE, PRIORITY, PRIORITY_LABELS } from '../../utils/constants';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';

const MaintenanceListPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { isStaff } = useAuth();
  const canManage = !isStaff;
  const [rows, setRows] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      hostel_id: '', title: '', description: '', category: 'electrical',
      priority: 'medium', scheduled_date: dayjs().format('YYYY-MM-DD'),
    },
  });

  useEffect(() => {
    if (!canManage) return;
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, [canManage]);

  const fetchMaintenance = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/maintenance', {
        params: { page: page + 1, limit: rowsPerPage, status: statusFilter || undefined },
      });
      const { data: list, pagination } = extractPaginated(data);
      setRows(list);
      setTotalCount(pagination.total);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter, enqueueSnackbar]);

  useEffect(() => { fetchMaintenance(); }, [fetchMaintenance]);

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      await api.post('/maintenance', { ...formData, hostel_id: Number(formData.hostel_id) });
      enqueueSnackbar('Maintenance request created', { variant: 'success' });
      setDialogOpen(false);
      fetchMaintenance();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (row, status) => {
    try {
      await api.put(`/maintenance/${row.id}`, { status });
      enqueueSnackbar('Status updated', { variant: 'success' });
      fetchMaintenance();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/maintenance/${deleteTarget.id}`);
      enqueueSnackbar('Maintenance record deleted', { variant: 'success' });
      setDeleteTarget(null);
      fetchMaintenance();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { field: 'title', headerName: 'Title' },
    { field: 'category', headerName: 'Category', renderCell: ({ value }) => value?.replace(/_/g, ' ') },
    { field: 'priority', headerName: 'Priority', renderCell: ({ value }) => <StatusChip status={value} label={PRIORITY_LABELS[value]} /> },
    { field: 'hostel', headerName: 'Hostel', renderCell: ({ row }) => row.hostel?.name || '—' },
    { field: 'scheduled_date', headerName: 'Scheduled', renderCell: ({ value }) => value ? dayjs(value).format('DD MMM YYYY') : '—' },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusChip status={value} /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Maintenance"
        subtitle={canManage ? 'Schedule and track maintenance work' : 'Jobs assigned to you'}
        {...(canManage ? {
          actionLabel: 'New Request',
          onAction: () => {
            reset({
              hostel_id: hostels[0]?.id || '',
              title: '',
              description: '',
              category: 'electrical',
              priority: 'medium',
              scheduled_date: dayjs().format('YYYY-MM-DD'),
            });
            setDialogOpen(true);
          },
        } : {})}
      />

      <Box sx={{ mb: 2 }}>
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
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="completed">Completed</MenuItem>
          <MenuItem value="cancelled">Cancelled</MenuItem>
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
        {...(canManage ? {
          onEdit: (row) => {
            if (row.status === 'pending') handleStatusUpdate(row, 'in_progress');
            else if (row.status === 'in_progress') handleStatusUpdate(row, 'completed');
          },
          onDelete: (row) => setDeleteTarget(row),
        } : { showActions: false })}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>New Maintenance Request</DialogTitle>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller name="hostel_id" control={control} rules={{ required: true }} render={({ field }) => (
                  <TextField select fullWidth label="Hostel" {...field}>
                    {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Title" {...register('title', { required: true })} error={!!errors.title} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description" multiline rows={2} {...register('description', { required: true })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Category" {...register('category')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="priority" control={control} render={({ field }) => (
                  <TextField select fullWidth label="Priority" {...field}>
                    {Object.values(PRIORITY).map((p) => <MenuItem key={p} value={p}>{PRIORITY_LABELS[p]}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Scheduled Date" type="date" InputLabelProps={{ shrink: true }} {...register('scheduled_date')} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>{submitting ? <CircularProgress size={20} /> : 'Create'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete Request" message="Delete this maintenance request?" confirmLabel="Delete" severity="error" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </Box>
  );
};

export default MaintenanceListPage;
