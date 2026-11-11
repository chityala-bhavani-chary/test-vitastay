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
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE, EXPENSE_CATEGORIES, formatCurrency } from '../../utils/constants';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';

const ExpenseListPage = () => {
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
      hostel_id: '', category: 'utilities', amount: 0, description: '',
      expense_date: dayjs().format('YYYY-MM-DD'), vendor_name: '', payment_method: 'cash',
    },
  });

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/expenses', {
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

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const openCreate = () => {
    reset({
      hostel_id: hostels[0]?.id || '', category: 'utilities', amount: 0, description: '',
      expense_date: dayjs().format('YYYY-MM-DD'), vendor_name: '', payment_method: 'cash',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      await api.post('/expenses', { ...formData, hostel_id: Number(formData.hostel_id) });
      enqueueSnackbar('Expense recorded successfully', { variant: 'success' });
      setDialogOpen(false);
      fetchExpenses();
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
      await api.delete(`/expenses/${deleteTarget.id}`);
      enqueueSnackbar('Expense deleted', { variant: 'success' });
      setDeleteTarget(null);
      fetchExpenses();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { field: 'expense_date', headerName: 'Date', renderCell: ({ value }) => dayjs(value).format('DD MMM YYYY') },
    { field: 'category', headerName: 'Category', renderCell: ({ value }) => value?.replace(/_/g, ' ') },
    { field: 'description', headerName: 'Description' },
    { field: 'amount', headerName: 'Amount', renderCell: ({ value }) => formatCurrency(value) },
    { field: 'hostel', headerName: 'Hostel', renderCell: ({ row }) => row.hostel?.name || '—' },
    { field: 'vendor_name', headerName: 'Vendor' },
  ];

  return (
    <Box>
      <PageHeader title="Expenses" subtitle="Track hostel operational expenses" actionLabel="Add Expense" onAction={openCreate} />

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
        <DialogTitle>Add Expense</DialogTitle>
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
                <Controller name="category" control={control} render={({ field }) => (
                  <TextField select fullWidth label="Category" {...field}>
                    {EXPENSE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c.replace(/_/g, ' ')}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Amount (₹)" type="number" {...register('amount', { valueAsNumber: true, required: true })} error={!!errors.amount} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Date" type="date" InputLabelProps={{ shrink: true }} {...register('expense_date', { required: true })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Vendor" {...register('vendor_name')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description" multiline rows={2} {...register('description', { required: true })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete Expense" message="Delete this expense record?" confirmLabel="Delete" severity="error" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </Box>
  );
};

export default ExpenseListPage;
