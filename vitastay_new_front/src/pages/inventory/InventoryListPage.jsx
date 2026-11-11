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

const InventoryListPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [hostelFilter, setHostelFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      hostel_id: '', name: '', category: 'furniture', unit: 'pcs',
      quantity: 0, min_quantity: 5, location: '',
    },
  });

  const { register: registerAdjust, handleSubmit: handleAdjustSubmit, reset: resetAdjust } = useForm({
    defaultValues: { quantity: 0, type: 'in', notes: '' },
  });

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/inventory', {
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

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      await api.post('/inventory', { ...formData, hostel_id: Number(formData.hostel_id) });
      enqueueSnackbar('Inventory item added', { variant: 'success' });
      setDialogOpen(false);
      fetchInventory();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const onAdjust = async (formData) => {
    setSubmitting(true);
    try {
      await api.post(`/inventory/${adjustDialog.id}/adjust`, formData);
      enqueueSnackbar('Stock adjusted', { variant: 'success' });
      setAdjustDialog(null);
      resetAdjust();
      fetchInventory();
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
      await api.delete(`/inventory/${deleteTarget.id}`);
      enqueueSnackbar('Item deleted', { variant: 'success' });
      setDeleteTarget(null);
      fetchInventory();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { field: 'name', headerName: 'Item' },
    { field: 'category', headerName: 'Category', renderCell: ({ value }) => value?.replace(/_/g, ' ') },
    { field: 'quantity', headerName: 'Qty', align: 'center' },
    { field: 'unit', headerName: 'Unit', align: 'center' },
    { field: 'min_quantity', headerName: 'Min Qty', align: 'center' },
    { field: 'hostel', headerName: 'Hostel', renderCell: ({ row }) => row.hostel?.name || '—' },
    {
      field: 'stock_status',
      headerName: 'Stock',
      renderCell: ({ row }) => (
        <StatusChip
          status={row.quantity <= row.min_quantity ? 'overdue' : 'paid'}
          label={row.quantity <= row.min_quantity ? 'Low Stock' : 'In Stock'}
        />
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="Inventory" subtitle="Track hostel supplies and assets" actionLabel="Add Item" onAction={() => { reset({ hostel_id: hostels[0]?.id || '' }); setDialogOpen(true); }} />

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
        onEdit={(row) => { resetAdjust({ quantity: 1, type: 'in', notes: '' }); setAdjustDialog(row); }}
        onDelete={(row) => setDeleteTarget(row)}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Add Inventory Item</DialogTitle>
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
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Item Name" {...register('name', { required: true })} error={!!errors.name} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Category" {...register('category')} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Quantity" type="number" {...register('quantity', { valueAsNumber: true })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Unit" {...register('unit')} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Min Quantity" type="number" {...register('min_quantity', { valueAsNumber: true })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Location" {...register('location')} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>{submitting ? <CircularProgress size={20} /> : 'Add'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(adjustDialog)} onClose={() => setAdjustDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Adjust Stock — {adjustDialog?.name}</DialogTitle>
        <Box component="form" onSubmit={handleAdjustSubmit(onAdjust)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField select fullWidth label="Type" {...registerAdjust('type')}>
                  <MenuItem value="in">Stock In</MenuItem>
                  <MenuItem value="out">Stock Out</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Quantity" type="number" {...registerAdjust('quantity', { valueAsNumber: true, required: true })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" {...registerAdjust('notes')} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setAdjustDialog(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>{submitting ? <CircularProgress size={20} /> : 'Adjust'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete Item" message="Delete this inventory item?" confirmLabel="Delete" severity="error" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </Box>
  );
};

export default InventoryListPage;
