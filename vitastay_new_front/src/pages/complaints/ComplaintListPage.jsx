import { useEffect, useState, useCallback } from 'react';
import {
  Box, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, CircularProgress, Stack, Chip, Tooltip, IconButton, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusChip from '../../components/common/StatusChip';
import useAuth from '../../hooks/useAuth';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE, PRIORITY, PRIORITY_LABELS, COMPLAINT_CATEGORIES, COMPLAINT_STATUS_LABELS } from '../../utils/constants';
import { brand } from '../../styles/theme';
import { alpha } from '@mui/material/styles';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';

const ComplaintListPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { isTenant, isOwner, isSupervisor, isStaff } = useAuth();
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
  const [actionTarget, setActionTarget] = useState(null); // { row, type: 'accept'|'reject' }
  const [actionLoading, setActionLoading] = useState(false);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: { hostel_id: '', title: '', description: '', category: 'other', priority: 'medium' },
  });

  const { register: registerAction, handleSubmit: handleActionSubmit, reset: resetAction } = useForm({
    defaultValues: { notes: '' },
  });

  useEffect(() => {
    if (!isTenant && !isStaff) {
      api.get('/hostels', { params: { limit: 100 } })
        .then(({ data }) => setHostels(extractPaginated(data).data))
        .catch(() => {});
    }
  }, [isTenant, isStaff]);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/complaints', {
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

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const categoryLabel = COMPLAINT_CATEGORIES.find((c) => c.value === formData.category)?.label || formData.category;
      const payload = isTenant
        ? { description: formData.description, category: formData.category, title: categoryLabel, priority: 'medium' }
        : { ...formData, hostel_id: Number(formData.hostel_id) };
      await api.post('/complaints', payload);
      enqueueSnackbar('Complaint submitted successfully', { variant: 'success' });
      setDialogOpen(false);
      fetchComplaints();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const onAction = async (formData) => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      const statusMap = { accept: 'in_progress', reject: 'rejected', complete: 'resolved' };
      const messageMap = {
        accept: 'Complaint accepted',
        reject: 'Complaint rejected',
        complete: 'Complaint marked as completed',
      };
      const defaultNotes = {
        accept: 'Complaint accepted',
        reject: 'Complaint rejected',
        complete: 'Problem rectified and complaint completed',
      };
      const status = statusMap[actionTarget.type];
      await api.post(`/complaints/${actionTarget.row.id}/status`, {
        status,
        notes: formData.notes || defaultNotes[actionTarget.type],
      });
      enqueueSnackbar(messageMap[actionTarget.type], {
        variant: actionTarget.type === 'reject' ? 'warning' : 'success',
      });
      setActionTarget(null);
      resetAction();
      fetchComplaints();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    { field: 'title', headerName: 'Title' },
    { field: 'category', headerName: 'Category', renderCell: ({ value }) => value?.replace(/_/g, ' ') },
    ...(!isTenant
      ? [{ field: 'priority', headerName: 'Priority', renderCell: ({ value }) => <StatusChip status={value} label={PRIORITY_LABELS[value]} /> }]
      : []),
    { field: 'hostel', headerName: 'Hostel', renderCell: ({ row }) => row.hostel?.name || '—' },
    {
      field: 'status',
      headerName: 'Status',
      renderCell: ({ value }) => (
        <StatusChip status={value} label={COMPLAINT_STATUS_LABELS[value] || value} />
      ),
    },
    { field: 'created_at', headerName: 'Date', renderCell: ({ value }) => dayjs(value).format('DD MMM YYYY') },
    ...(canManage
      ? [{
          field: 'actions',
          headerName: 'Actions',
          renderCell: ({ row }) => {
            const isOpen = row.status === 'open';
            const isInProgress = row.status === 'in_progress';
            return (
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Accept">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!isOpen}
                      onClick={() => { resetAction(); setActionTarget({ row, type: 'accept' }); }}
                      sx={{
                        color: isOpen ? brand.teal : 'text.disabled',
                        '&:hover': { bgcolor: alpha(brand.teal, 0.12) },
                      }}
                    >
                      <CheckCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Reject">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!isOpen}
                      onClick={() => { resetAction(); setActionTarget({ row, type: 'reject' }); }}
                      sx={{
                        color: isOpen ? 'error.main' : 'text.disabled',
                        '&:hover': { bgcolor: alpha('#f44336', 0.1) },
                      }}
                    >
                      <CancelOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Mark Completed">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!isInProgress}
                      onClick={() => { resetAction(); setActionTarget({ row, type: 'complete' }); }}
                      sx={{
                        color: isInProgress ? 'success.main' : 'text.disabled',
                        '&:hover': { bgcolor: alpha('#2e7d32', 0.1) },
                      }}
                    >
                      <TaskAltIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            );
          },
        }]
      : []),
  ];

  return (
    <Box>
      <PageHeader
        title="Complaints"
        subtitle={isStaff ? 'Jobs assigned to you' : 'Track and resolve tenant complaints'}
        {...(isTenant ? { actionLabel: 'New Complaint', onAction: () => { reset(); setDialogOpen(true); } } : {})}
      />

      <Box sx={{ mb: 2 }}>
        <TextField
          select size="small" label="Status" value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          sx={{ minWidth: 140, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="open">Open</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Completed</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
          <MenuItem value="closed">Closed</MenuItem>
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
        showActions={false}
      />

      {/* Submit Complaint dialog (tenant only) */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Submit Complaint</DialogTitle>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              {!isTenant && (
                <>
                  <Grid item xs={12}>
                    <Controller name="hostel_id" control={control} rules={{ required: !isTenant }} render={({ field }) => (
                      <TextField select fullWidth label="Hostel" {...field}>
                        {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                      </TextField>
                    )} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Title" {...register('title', { required: !isTenant })} error={!!errors.title} />
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <TextField fullWidth label="Description" multiline rows={4} {...register('description', { required: true })} error={!!errors.description} />
              </Grid>
              <Grid item xs={12}>
                <Controller name="category" control={control} rules={{ required: true }} render={({ field }) => (
                  <TextField select fullWidth label="Category" {...field} error={!!errors.category}>
                    {COMPLAINT_CATEGORIES.map((c) => (
                      <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                    ))}
                  </TextField>
                )} />
              </Grid>
              {!isTenant && (
                <Grid item xs={12}>
                  <Controller name="priority" control={control} render={({ field }) => (
                    <TextField select fullWidth label="Priority" {...field}>
                      {Object.values(PRIORITY).map((p) => <MenuItem key={p} value={p}>{PRIORITY_LABELS[p]}</MenuItem>)}
                    </TextField>
                  )} />
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={20} /> : 'Submit'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Accept / Reject / Complete confirmation dialog */}
      <Dialog
        open={Boolean(actionTarget)}
        onClose={() => setActionTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{
            color:
              actionTarget?.type === 'reject'
                ? 'error.main'
                : actionTarget?.type === 'complete'
                  ? 'success.main'
                  : brand.teal,
          }}
        >
          {actionTarget?.type === 'accept' && 'Accept Complaint'}
          {actionTarget?.type === 'reject' && 'Reject Complaint'}
          {actionTarget?.type === 'complete' && 'Mark as Completed'}
        </DialogTitle>
        <Box component="form" onSubmit={handleActionSubmit(onAction)}>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {actionTarget?.type === 'accept' && 'Accepting will mark the complaint as In Progress.'}
              {actionTarget?.type === 'reject' && 'Rejecting will close this complaint without further action.'}
              {actionTarget?.type === 'complete' && 'Confirm that the problem has been rectified. Status will change to Completed on both owner and tenant pages.'}
            </Typography>
            <TextField
              fullWidth
              label="Notes (optional)"
              multiline
              rows={2}
              {...registerAction('notes')}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setActionTarget(null)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              color={
                actionTarget?.type === 'reject'
                  ? 'error'
                  : actionTarget?.type === 'complete'
                    ? 'success'
                    : 'primary'
              }
              disabled={actionLoading}
            >
              {actionLoading
                ? <CircularProgress size={20} />
                : actionTarget?.type === 'accept'
                  ? 'Accept'
                  : actionTarget?.type === 'reject'
                    ? 'Reject'
                    : 'Complete'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default ComplaintListPage;
