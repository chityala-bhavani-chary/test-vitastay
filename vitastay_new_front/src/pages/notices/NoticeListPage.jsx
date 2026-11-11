import { useEffect, useState, useCallback } from 'react';
import {
  Box, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, CircularProgress, FormControlLabel, Checkbox,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import useAuth from '../../hooks/useAuth';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';

const NoticeListPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { isOwner, isSupervisor } = useAuth();
  const canManage = isOwner || isSupervisor;
  const [rows, setRows] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      hostel_id: '', title: '', content: '', type: 'general',
      is_pinned: false, expires_at: '',
    },
  });

  useEffect(() => {
    if (canManage) {
      api.get('/hostels', { params: { limit: 100 } })
        .then(({ data }) => setHostels(extractPaginated(data).data))
        .catch(() => {});
    }
  }, [canManage]);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notices', { params: { page: page + 1, limit: rowsPerPage } });
      const { data: list, pagination } = extractPaginated(data);
      setRows(list);
      setTotalCount(pagination.total);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, enqueueSnackbar]);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        hostel_id: formData.hostel_id ? Number(formData.hostel_id) : null,
        expires_at: formData.expires_at || null,
      };
      await api.post('/notices', payload);
      enqueueSnackbar('Notice published successfully', { variant: 'success' });
      setDialogOpen(false);
      fetchNotices();
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
      await api.delete(`/notices/${deleteTarget.id}`);
      enqueueSnackbar('Notice deleted', { variant: 'success' });
      setDeleteTarget(null);
      fetchNotices();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { field: 'title', headerName: 'Title' },
    { field: 'type', headerName: 'Type', renderCell: ({ value }) => value?.replace(/_/g, ' ') },
    { field: 'hostel', headerName: 'Hostel', renderCell: ({ row }) => row.hostel?.name || 'All Hostels' },
    { field: 'created_at', headerName: 'Published', renderCell: ({ value }) => dayjs(value).format('DD MMM YYYY') },
    {
      field: 'expires_at',
      headerName: 'Expires',
      renderCell: ({ value }) => value ? dayjs(value).format('DD MMM YYYY') : 'Never',
    },
    { field: 'is_pinned', headerName: 'Pinned', renderCell: ({ value }) => value ? 'Yes' : 'No' },
  ];

  return (
    <Box>
      <PageHeader
        title="Notices"
        subtitle="Announcements and important updates"
        actionLabel={canManage ? 'Publish Notice' : undefined}
        onAction={canManage ? () => { reset(); setDialogOpen(true); } : undefined}
      />

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
        <DialogTitle>Publish Notice</DialogTitle>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller name="hostel_id" control={control} render={({ field }) => (
                  <TextField select fullWidth label="Hostel (optional)" {...field}>
                    <MenuItem value="">All Hostels</MenuItem>
                    {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Title" {...register('title', { required: true })} error={!!errors.title} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Content" multiline rows={4} {...register('content', { required: true })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Type" {...register('type')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Expires At" type="date" InputLabelProps={{ shrink: true }} {...register('expires_at')} />
              </Grid>
              <Grid item xs={12}>
                <Controller name="is_pinned" control={control} render={({ field }) => (
                  <FormControlLabel control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label="Pin this notice" />
                )} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>{submitting ? <CircularProgress size={20} /> : 'Publish'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete Notice" message="Delete this notice?" confirmLabel="Delete" severity="error" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </Box>
  );
};

export default NoticeListPage;
