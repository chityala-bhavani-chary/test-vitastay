import { useEffect, useState, useCallback } from 'react';
import {
  Box, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import useAuth from '../../hooks/useAuth';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';

const VisitorListPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { isTenant, isOwner, isSupervisor } = useAuth();
  const canManage = isOwner || isSupervisor;
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
      hostel_id: '', visitor_name: '', visitor_phone: '', visitor_id_type: 'aadhar',
      visitor_id_number: '', purpose: '', expected_in_time: dayjs().format('YYYY-MM-DDTHH:mm'),
    },
  });

  useEffect(() => {
    if (!isTenant) {
      api.get('/hostels', { params: { limit: 100 } })
        .then(({ data }) => setHostels(extractPaginated(data).data))
        .catch(() => {});
    }
  }, [isTenant]);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/visitors', {
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

  useEffect(() => { fetchVisitors(); }, [fetchVisitors]);

  const openCreate = () => {
    reset({
      hostel_id: hostels[0]?.id || '', visitor_name: '', visitor_phone: '', visitor_id_type: 'aadhar',
      visitor_id_number: '', purpose: '', expected_in_time: dayjs().format('YYYY-MM-DDTHH:mm'),
    });
    setDialogOpen(true);
  };

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const payload = isTenant ? formData : { ...formData, hostel_id: Number(formData.hostel_id) };
      await api.post('/visitors', payload);
      enqueueSnackbar('Visitor registered successfully', { variant: 'success' });
      setDialogOpen(false);
      fetchVisitors();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (row) => {
    try {
      await api.post(`/visitors/${row.id}/approve`);
      enqueueSnackbar('Visitor approved', { variant: 'success' });
      fetchVisitors();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const handleCheckout = async (row) => {
    try {
      await api.post(`/visitors/${row.id}/checkout`);
      enqueueSnackbar('Visitor checked out', { variant: 'success' });
      fetchVisitors();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/visitors/${deleteTarget.id}`);
      enqueueSnackbar('Visitor record deleted', { variant: 'success' });
      setDeleteTarget(null);
      fetchVisitors();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { field: 'visitor_name', headerName: 'Name' },
    { field: 'visitor_phone', headerName: 'Phone' },
    { field: 'purpose', headerName: 'Purpose' },
    { field: 'hostel', headerName: 'Hostel', renderCell: ({ row }) => row.hostel?.name || '—' },
    {
      field: 'in_time',
      headerName: 'Check-in',
      renderCell: ({ value }) => value ? dayjs(value).format('DD MMM HH:mm') : '—',
    },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusChip status={value} /> },
    ...(canManage ? [{
      field: 'actions',
      headerName: 'Quick Actions',
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {row.status === 'pending' && (
            <Tooltip title="Approve"><IconButton size="small" color="success" onClick={() => handleApprove(row)}><CheckCircleIcon fontSize="small" /></IconButton></Tooltip>
          )}
          {['approved', 'checked_in'].includes(row.status) && (
            <Tooltip title="Check Out"><IconButton size="small" color="warning" onClick={() => handleCheckout(row)}><ExitToAppIcon fontSize="small" /></IconButton></Tooltip>
          )}
        </Box>
      ),
    }] : []),
  ];

  return (
    <Box>
      <PageHeader title="Visitors" subtitle="Register and manage visitor entries" actionLabel="Register Visitor" onAction={openCreate} />

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
          <MenuItem value="approved">Approved</MenuItem>
          <MenuItem value="checked_in">Checked In</MenuItem>
          <MenuItem value="checked_out">Checked Out</MenuItem>
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
        onDelete={canManage ? (row) => setDeleteTarget(row) : undefined}
        showActions={canManage}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Register Visitor</DialogTitle>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              {!isTenant && (
                <Grid item xs={12}>
                  <Controller name="hostel_id" control={control} rules={{ required: true }} render={({ field }) => (
                    <TextField select fullWidth label="Hostel" {...field}>
                      {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                    </TextField>
                  )} />
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Visitor Name" {...register('visitor_name', { required: true })} error={!!errors.visitor_name} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone" {...register('visitor_phone', { required: true })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="ID Type" {...register('visitor_id_type')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="ID Number" {...register('visitor_id_number')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Purpose" {...register('purpose', { required: true })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Expected Time" type="datetime-local" InputLabelProps={{ shrink: true }} {...register('expected_in_time')} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={20} /> : 'Register'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete Visitor" message="Delete this visitor record?" confirmLabel="Delete" severity="error" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </Box>
  );
};

export default VisitorListPage;
