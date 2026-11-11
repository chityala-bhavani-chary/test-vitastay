import { useEffect, useState, useCallback } from 'react';
import {
  Box, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, CircularProgress,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';

const StaffListPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [hostelFilter, setHostelFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      email: '', password: '', first_name: '', last_name: '', phone: '',
      hostel_id: '', designation: 'warden', salary: 0, join_date: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, []);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/staff', {
        params: { page: page + 1, limit: rowsPerPage, hostelId: hostelFilter || undefined },
      });
      const { data: list, pagination } = extractPaginated(data);
      setRows(list);
      setTotalCount(pagination.total);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, hostelFilter, enqueueSnackbar]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      await api.post('/staff', { ...formData, hostel_id: Number(formData.hostel_id) });
      enqueueSnackbar('Staff member added successfully', { variant: 'success' });
      setDialogOpen(false);
      fetchStaff();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/staff/${deleteTarget.id}`);
      enqueueSnackbar('Staff member removed', { variant: 'success' });
      setDeleteTarget(null);
      fetchStaff();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      field: 'name',
      headerName: 'Name',
      renderCell: ({ row }) => `${row.user?.first_name || ''} ${row.user?.last_name || ''}`.trim(),
    },
    { field: 'email', headerName: 'Email', renderCell: ({ row }) => row.user?.email || '—' },
    { field: 'designation', headerName: 'Designation', renderCell: ({ value }) => value?.replace(/_/g, ' ') },
    { field: 'hostel', headerName: 'Hostel', renderCell: ({ row }) => row.hostel?.name || '—' },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusChip status={value || 'active'} /> },
  ];

  return (
    <Box>
      <PageHeader title="Staff" subtitle="Manage hostel staff members" actionLabel="Add Staff" onAction={() => { reset({ hostel_id: hostels[0]?.id || '' }); setDialogOpen(true); }} />

      <Box sx={{ mb: 2 }}>
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
        onDelete={(row) => setDeleteTarget(row)}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Add Staff Member</DialogTitle>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="First Name" {...register('first_name', { required: true })} error={!!errors.first_name} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Last Name" {...register('last_name', { required: true })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Email" type="email" {...register('email', { required: true })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Password" type="password" {...register('password', { required: true, minLength: 6 })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone" {...register('phone')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="hostel_id" control={control} rules={{ required: true }} render={({ field }) => (
                  <TextField select fullWidth label="Hostel" {...field}>
                    {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Designation" {...register('designation')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Salary (₹)" type="number" {...register('salary', { valueAsNumber: true })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Join Date" type="date" InputLabelProps={{ shrink: true }} {...register('join_date')} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>{submitting ? <CircularProgress size={20} /> : 'Add Staff'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Remove Staff" message="Remove this staff member?" confirmLabel="Remove" severity="error" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </Box>
  );
};

export default StaffListPage;
