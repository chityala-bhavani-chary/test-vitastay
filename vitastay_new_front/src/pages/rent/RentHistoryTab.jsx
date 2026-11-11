import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Box, Chip, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import DataTable from '../../components/common/DataTable';
import ExportMenu from '../../components/common/ExportMenu';
import api, { extractData, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';
import { METHOD_LABELS, methodLabel } from './rentUtils';

const PRESETS = {
  today: { label: 'Today', range: () => [dayjs(), dayjs()] },
  week: { label: 'Last 7 days', range: () => [dayjs().subtract(6, 'day'), dayjs()] },
  month: { label: 'This month', range: () => [dayjs().startOf('month'), dayjs()] },
  last30: { label: 'Last 30 days', range: () => [dayjs().subtract(29, 'day'), dayjs()] },
  lastMonth: {
    label: 'Last month',
    range: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
  custom: { label: 'Custom range' },
};

const fmt = (d) => d.format('YYYY-MM-DD');

const METHOD_COLORS = {
  cash: '#15803D', upi: '#7C3AED', card: '#0369A1', bank: '#B45309', online: '#0F766E',
};

const RentHistoryTab = ({ hostelId, hostelName }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [preset, setPreset] = useState('last30');
  const [from, setFrom] = useState(fmt(PRESETS.last30.range()[0]));
  const [to, setTo] = useState(fmt(dayjs()));
  const [methodFilter, setMethodFilter] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const applyPreset = (key) => {
    setPreset(key);
    if (key !== 'custom') {
      const [start, end] = PRESETS[key].range();
      setFrom(fmt(start));
      setTo(fmt(end));
    }
    setPage(0);
  };

  const load = useCallback(async () => {
    if (!from || !to || from > to) return;
    setLoading(true);
    try {
      const { data: res } = await api.get('/rent/history', { params: { from, to, hostelId: hostelId || undefined } });
      setData(extractData(res));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [from, to, hostelId, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const entries = useMemo(
    () => (data?.entries || []).filter((e) => !methodFilter || e.method === methodFilter),
    [data, methodFilter],
  );
  const filteredTotal = entries.reduce((sum, e) => sum + e.amount, 0);
  const pageRows = entries.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const rangeLabel = `${dayjs(from).format('DD MMM YYYY')} – ${dayjs(to).format('DD MMM YYYY')}`;

  const columns = [
    { field: 'date', headerName: 'Date', renderCell: ({ value }) => (value ? dayjs(value).format('DD MMM YYYY') : '—') },
    {
      field: 'tenant_name',
      headerName: 'Tenant',
      renderCell: ({ row }) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{row.tenant_name}</Typography>
          {row.tenant_phone && <Typography variant="caption" color="text.secondary">{row.tenant_phone}</Typography>}
        </Box>
      ),
    },
    { field: 'hostel_name', headerName: 'Hostel' },
    { field: 'room_number', headerName: 'Room' },
    {
      field: 'invoice_number',
      headerName: 'Invoice / Month',
      renderCell: ({ row }) => (
        <Box>
          <Typography variant="body2">{row.invoice_number || '—'}</Typography>
          <Typography variant="caption" color="text.secondary">
            {row.month_year ? dayjs(`${row.month_year}-01`).format('MMM YYYY') : ''}{row.type === 'Registration' ? ' · Registration' : ''}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'method',
      headerName: 'Mode',
      renderCell: ({ value }) => (
        <Chip
          size="small"
          label={methodLabel(value)}
          sx={{ fontWeight: 600, color: METHOD_COLORS[value] || 'text.primary', borderColor: METHOD_COLORS[value] }}
          variant="outlined"
        />
      ),
    },
    { field: 'reference', headerName: 'Reference', renderCell: ({ value }) => value || '—' },
    {
      field: 'amount',
      headerName: 'Amount',
      align: 'right',
      renderCell: ({ value }) => <Typography variant="body2" fontWeight={700} color="success.main">{formatCurrency(value)}</Typography>,
    },
  ];

  const getExportData = async () => ({
    title: 'Payment History',
    subtitle: `${rangeLabel}${hostelName ? ` · ${hostelName}` : ''}${methodFilter ? ` · ${methodLabel(methodFilter)} only` : ''}`,
    summary: [
      ['Total collected', formatCurrency(filteredTotal)],
      ['Transactions', String(entries.length)],
      ...Object.entries(data?.summary?.by_method || {})
        .filter(([m, v]) => v.count > 0 && (!methodFilter || m === methodFilter))
        .map(([m, v]) => [`${methodLabel(m)} (${v.count})`, formatCurrency(v.amount)]),
    ],
    columns: [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Tenant', key: 'tenant_name', width: 22 },
      { header: 'Phone', key: 'tenant_phone', width: 14 },
      { header: 'Hostel', key: 'hostel_name', width: 22 },
      { header: 'Room', key: 'room_number', width: 8 },
      { header: 'Invoice', key: 'invoice_number', width: 20 },
      { header: 'Month', key: 'month_year', width: 10 },
      { header: 'Type', key: 'type', width: 13 },
      { header: 'Mode', key: 'method_label', width: 14 },
      { header: 'Reference', key: 'reference', width: 18 },
      { header: 'Amount', key: 'amount', type: 'currency', width: 14 },
    ],
    rows: entries.map((e) => ({
      ...e,
      date: e.date ? dayjs(e.date).format('DD MMM YYYY') : '',
      method_label: methodLabel(e.method),
    })),
  });

  const byMethod = data?.summary?.by_method || {};

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ md: 'center' }}>
        <TextField
          select
          size="small"
          label="Period"
          value={preset}
          onChange={(e) => applyPreset(e.target.value)}
          sx={{ minWidth: 160, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          {Object.entries(PRESETS).map(([key, p]) => <MenuItem key={key} value={key}>{p.label}</MenuItem>)}
        </TextField>
        <TextField
          type="date"
          size="small"
          label="From"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPreset('custom'); setPage(0); }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ max: to }}
          sx={atmosphereFilterSx}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPreset('custom'); setPage(0); }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: from, max: fmt(dayjs()) }}
          sx={atmosphereFilterSx}
        />
        <TextField
          select
          size="small"
          label="Mode"
          value={methodFilter}
          onChange={(e) => { setMethodFilter(e.target.value); setPage(0); }}
          sx={{ minWidth: 140, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All modes</MenuItem>
          {Object.entries(METHOD_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <ExportMenu getData={getExportData} disabled={loading} />
      </Stack>

      <Box sx={{ display: 'grid', gap: 1.5, mb: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' } }}>
        <Paper sx={{ p: 1.5, borderTop: '3px solid', borderColor: 'primary.main' }}>
          <Typography variant="caption" color="text.secondary">Total Collected</Typography>
          <Typography variant="h6" fontWeight={800}>{formatCurrency(filteredTotal)}</Typography>
          <Typography variant="caption" color="text.secondary">{entries.length} transaction(s)</Typography>
        </Paper>
        {Object.entries(METHOD_LABELS).map(([key, label]) => (
          <Paper
            key={key}
            onClick={() => { setMethodFilter(methodFilter === key ? '' : key); setPage(0); }}
            sx={{
              p: 1.5,
              cursor: 'pointer',
              borderTop: '3px solid',
              borderColor: METHOD_COLORS[key],
              outline: methodFilter === key ? `2px solid ${METHOD_COLORS[key]}` : 'none',
              opacity: methodFilter && methodFilter !== key ? 0.55 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ color: METHOD_COLORS[key] }}>
              {formatCurrency(byMethod[key]?.amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">{byMethod[key]?.count || 0} payment(s)</Typography>
          </Paper>
        ))}
      </Box>

      <DataTable
        columns={columns}
        rows={pageRows}
        loading={loading}
        page={page}
        rowsPerPage={rowsPerPage}
        totalCount={entries.length}
        onPageChange={setPage}
        onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(0); }}
        showActions={false}
        emptyMessage={`No payments recorded between ${rangeLabel}`}
      />
    </Box>
  );
};

export default RentHistoryTab;
