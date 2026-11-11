import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, MenuItem, IconButton, Tooltip, Stack, Tabs, Tab, Chip, Typography, Button,
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import FilterToolbar from '../../components/common/FilterToolbar';
import DataTable from '../../components/common/DataTable';
import StatusChip from '../../components/common/StatusChip';
import ExportMenu from '../../components/common/ExportMenu';
import useAuth from '../../hooks/useAuth';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE, formatCurrency } from '../../utils/constants';
import { printRentInvoice, viewRentInvoice, downloadRentInvoice } from '../../utils/printRentInvoice';
import { brand } from '../../styles/theme';
import { alpha } from '@mui/material/styles';
import {
  atmosphereFilterSx, atmosphereSelectMenuProps, atmosphereTabsSx,
} from '../../styles/atmosphere';
import SearchBar from '../../components/common/SearchBar';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import RentHistoryTab from './RentHistoryTab';
import RentDueTab from './RentDueTab';
import ChangeDueDateDialog from './ChangeDueDateDialog';
import PayRentButton from './PayRentButton';
import { dueIndicator, plural } from './rentUtils';

const UNPAID = ['pending', 'partial', 'overdue'];

const DATE_PRESETS = {
  all: { label: 'All dates' },
  thisMonth: { label: 'This month', range: () => [dayjs().startOf('month'), dayjs().endOf('month')] },
  lastMonth: {
    label: 'Last month',
    range: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
  next7: { label: 'Next 7 days', range: () => [dayjs(), dayjs().add(7, 'day')] },
  last30: { label: 'Last 30 days', range: () => [dayjs().subtract(29, 'day'), dayjs()] },
  thisYear: { label: 'This year', range: () => [dayjs().startOf('year'), dayjs().endOf('year')] },
  custom: { label: 'Custom range' },
};
const ymd = (d) => d.format('YYYY-MM-DD');

const TAB_DEFS = [
  { value: 'invoices', label: 'Invoices' },
  { value: 'history', label: 'Payment History' },
  { value: 'reminder', label: 'Reminders', color: '#38BDF8' },
  { value: 'pending', label: 'Pending', color: '#FBBF24' },
  { value: 'overdue', label: 'Overdue', color: '#F87171' },
];

const tenantNameOf = (row) => (row.tenant?.full_name?.trim()
  || (row.tenant?.user ? `${row.tenant.user.first_name || ''} ${row.tenant.user.last_name || ''}`.trim() : '')
  || '—');

const RentListPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isTenant, isOwner, isSupervisor } = useAuth();
  const canCollect = isOwner || isSupervisor;

  const [tab, setTab] = useState('invoices');
  const [hostels, setHostels] = useState([]);
  const [hostelFilter, setHostelFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [dueData, setDueData] = useState(null);
  const [dueLoading, setDueLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateField, setDateField] = useState('due_date');
  const [datePreset, setDatePreset] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dueDateInvoice, setDueDateInvoice] = useState(null);

  const applyDatePreset = (key) => {
    setDatePreset(key);
    if (key === 'all') { setFromDate(''); setToDate(''); }
    else if (DATE_PRESETS[key].range) {
      const [start, end] = DATE_PRESETS[key].range();
      setFromDate(ymd(start));
      setToDate(ymd(end));
    }
    setPage(0);
  };

  const listParams = useCallback(() => ({
    status: statusFilter || undefined,
    hostelId: hostelFilter || undefined,
    search: search || undefined,
    dateField,
    from: fromDate || undefined,
    to: toDate || undefined,
  }), [statusFilter, hostelFilter, search, dateField, fromDate, toDate]);

  const hostelName = hostels.find((h) => String(h.id) === String(hostelFilter))?.name || '';

  useEffect(() => {
    if (!canCollect) return;
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, [canCollect]);

  const fetchRent = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/rent', {
        params: { page: page + 1, limit: rowsPerPage, ...listParams() },
      });
      const { data: list, pagination } = extractPaginated(data);
      setRows(list);
      setTotalCount(pagination.total);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, listParams, enqueueSnackbar]);

  const fetchDue = useCallback(async () => {
    if (!canCollect) return;
    setDueLoading(true);
    try {
      const { data } = await api.get('/rent/due-tracker', { params: { hostelId: hostelFilter || undefined } });
      setDueData(extractData(data));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setDueLoading(false);
    }
  }, [canCollect, hostelFilter, enqueueSnackbar]);

  useEffect(() => { if (tab === 'invoices') fetchRent(); }, [tab, fetchRent]);
  useEffect(() => { fetchDue(); }, [fetchDue]);

  const changeTab = (_, value) => {
    setTab(value);
    if (['reminder', 'pending', 'overdue'].includes(value)) fetchDue();
  };

  const openDueDateDialog = useCallback((invoice) => setDueDateInvoice(invoice), []);
  const closeDueDateDialog = useCallback(() => setDueDateInvoice(null), []);
  const handleDueDateChanged = useCallback(() => {
    setDueDateInvoice(null);
    fetchDue();
    if (tab === 'invoices') fetchRent();
  }, [fetchDue, fetchRent, tab]);

  const waiveLateFee = async (row) => {
    const fee = Number(row.penalty_amount) || 0;
    if (fee <= 0) return;
    if (!window.confirm(`Waive late fee of ${formatCurrency(fee)} on this invoice?`)) return;
    setBusyId(`${row.id}-waive`);
    try {
      await api.post(`/rent/${row.id}/waive-late-fee`, { reason: 'Waived from rent list' });
      enqueueSnackbar('Late fee waived', { variant: 'success' });
      fetchRent();
      fetchDue();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const loadInvoice = async (row) => {
    const { data } = await api.get(`/rent/${row.id}`);
    return extractData(data);
  };

  const handleInvoiceAction = async (row, action) => {
    setBusyId(`${row.id}-${action}`);
    try {
      const payment = await loadInvoice(row);
      if (action === 'view') viewRentInvoice(payment);
      else if (action === 'download') {
        downloadRentInvoice(payment);
        enqueueSnackbar('Invoice downloaded', { variant: 'success' });
      } else {
        printRentInvoice(payment);
      }
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const today = dayjs().startOf('day');

  const columns = [
    {
      field: 'month_year',
      headerName: 'Month',
      renderCell: ({ value }) => (value ? dayjs(`${value}-01`).format('MMM YYYY') : '—'),
    },
    { field: 'tenant', headerName: 'Tenant', renderCell: ({ row }) => tenantNameOf(row) },
    { field: 'hostel', headerName: 'Hostel', renderCell: ({ row }) => row.hostel?.name || '—' },
    { field: 'room', headerName: 'Room', renderCell: ({ row }) => row.room?.room_number || '—' },
    { field: 'total_amount', headerName: 'Total', renderCell: ({ value }) => formatCurrency(value) },
    { field: 'paid_amount', headerName: 'Paid', renderCell: ({ value }) => formatCurrency(value) },
    {
      field: 'due_date',
      headerName: 'Due Date',
      renderCell: ({ row, value }) => {
        if (!value) return '—';
        const balance = Number(row.total_amount) - Number(row.paid_amount);
        const due = dayjs(value).startOf('day');
        const days = today.diff(due, 'day');
        const showIndicator = UNPAID.includes(row.status) && balance > 0 && days >= -2;
        const ind = showIndicator ? dueIndicator(days, today.diff(due, 'month')) : null;
        return (
          <Box>
            <Typography variant="body2">{due.format('DD MMM YYYY')}</Typography>
            {row.original_due_date && (
              <Typography variant="caption" color="text.secondary" display="block">
                Extended from {dayjs(row.original_due_date).format('DD MMM')} ({row.extension_days > 0 ? '+' : ''}{plural(row.extension_days, 'day')})
              </Typography>
            )}
            {ind && (
              <Typography variant="caption" fontWeight={600} color={`${ind.color}.main`} display="block">{ind.label}</Typography>
            )}
          </Box>
        );
      },
    },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusChip status={value} /> },
  ];

  const getInvoiceExport = async () => {
    const all = [];
    for (let p = 1; p <= 50; p += 1) {
      const { data } = await api.get('/rent', { params: { page: p, limit: 100, ...listParams() } });
      const { data: list, pagination } = extractPaginated(data);
      all.push(...list);
      if (all.length >= pagination.total || !list.length) break;
    }
    const billed = all.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const paid = all.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    return {
      title: 'Rent Invoices',
      subtitle: [
        hostelName,
        statusFilter ? `Status: ${statusFilter}` : '',
        fromDate || toDate
          ? `${dateField === 'paid_date' ? 'Paid' : 'Due'} ${fromDate ? dayjs(fromDate).format('DD MMM YYYY') : '…'} – ${toDate ? dayjs(toDate).format('DD MMM YYYY') : '…'}`
          : '',
        search ? `Search: "${search}"` : '',
      ].filter(Boolean).join(' · '),
      summary: [
        ['Invoices', String(all.length)],
        ['Total billed', formatCurrency(billed)],
        ['Total paid', formatCurrency(paid)],
        ['Outstanding', formatCurrency(Math.max(0, billed - paid))],
      ],
      columns: [
        { header: 'Invoice', key: 'invoice_number', width: 20 },
        { header: 'Month', key: 'month', width: 11 },
        { header: 'Tenant', key: 'tenant', width: 22 },
        { header: 'Phone', key: 'phone', width: 14 },
        { header: 'Hostel', key: 'hostel', width: 22 },
        { header: 'Room', key: 'room', width: 8 },
        { header: 'Due Date', key: 'due', width: 13 },
        { header: 'Original Due', key: 'original_due', width: 13 },
        { header: 'Extension Charge', key: 'extension_charge', type: 'currency', width: 15 },
        { header: 'Total', key: 'total_amount', type: 'currency', width: 13 },
        { header: 'Paid', key: 'paid_amount', type: 'currency', width: 13 },
        { header: 'Balance', key: 'balance', type: 'currency', width: 13 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Paid On', key: 'paid_on', width: 13 },
        { header: 'Mode', key: 'payment_method', width: 10 },
      ],
      rows: all.map((r) => ({
        ...r,
        month: r.month_year ? dayjs(`${r.month_year}-01`).format('MMM YYYY') : '',
        tenant: tenantNameOf(r),
        phone: r.tenant?.user?.phone || '',
        hostel: r.hostel?.name || '',
        room: r.room?.room_number || '',
        due: r.due_date ? dayjs(r.due_date).format('DD MMM YYYY') : '',
        original_due: r.original_due_date ? dayjs(r.original_due_date).format('DD MMM YYYY') : '',
        balance: Math.max(0, Number(r.total_amount) - Number(r.paid_amount)),
        paid_on: r.paid_date ? dayjs(r.paid_date).format('DD MMM YYYY') : '',
        payment_method: Number(r.paid_amount) > 0 ? r.payment_method : '',
      })),
    };
  };

  const tabLabel = (def) => {
    const count = dueData?.summary?.[def.value]?.count;
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <span>{def.label}</span>
        {def.color && count !== undefined && (
          <Chip
            size="small"
            label={count}
            sx={{
              height: 20,
              minWidth: 24,
              fontSize: 11,
              fontWeight: 700,
              bgcolor: count ? alpha(def.color, 0.22) : alpha(brand.navy, 0.08),
              color: brand.navy,
            }}
          />
        )}
      </Stack>
    );
  };

  const invoicesView = (
    <>
      <FilterToolbar>
        <SearchBar
          placeholder="Search tenant, phone, room, invoice no..."
          onSearch={(v) => { setSearch(v.trim()); setPage(0); }}
          sx={{ flex: '1 1 220px', minWidth: 200, maxWidth: 360 }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          sx={{ minWidth: 120, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="partial">Partial</MenuItem>
          <MenuItem value="paid">Paid</MenuItem>
          <MenuItem value="overdue">Overdue</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Date by"
          value={dateField}
          onChange={(e) => { setDateField(e.target.value); setPage(0); }}
          sx={{ minWidth: 120, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="due_date">Due date</MenuItem>
          <MenuItem value="paid_date">Paid date</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Period"
          value={datePreset}
          onChange={(e) => applyDatePreset(e.target.value)}
          sx={{ minWidth: 140, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          {Object.entries(DATE_PRESETS).map(([key, p]) => <MenuItem key={key} value={key}>{p.label}</MenuItem>)}
        </TextField>
        {datePreset === 'custom' && (
          <>
            <TextField
              type="date"
              size="small"
              label="From"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: toDate || undefined }}
              sx={{ width: 155, ...atmosphereFilterSx }}
            />
            <TextField
              type="date"
              size="small"
              label="To"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(0); }}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: fromDate || undefined }}
              sx={{ width: 155, ...atmosphereFilterSx }}
            />
          </>
        )}
        <Box sx={{ flex: 1 }} />
        {canCollect && <ExportMenu getData={getInvoiceExport} disabled={loading} />}
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
        showActions={canCollect || isTenant}
        primaryAction={(row) => {
          if (isTenant) {
            const balance = Math.max(0, Number(row.total_amount) - Number(row.paid_amount));
            const canPay = UNPAID.includes(row.status) && balance > 0;
            if (canPay) {
              return (
                <PayRentButton
                  invoiceId={row.id}
                  amount={balance}
                  onPaid={() => fetchRent()}
                />
              );
            }
            return (
              <Button size="small" variant="outlined" onClick={() => handleInvoiceAction(row, 'view')}>
                {Number(row.paid_amount) > 0 ? 'Receipt' : 'Invoice'}
              </Button>
            );
          }
          if (canCollect && UNPAID.includes(row.status)) {
            return (
              <Button
                size="small"
                variant="contained"
                startIcon={<PaymentsIcon />}
                onClick={() => navigate(`/rent/collect/${row.id}`)}
              >
                Collect
              </Button>
            );
          }
          return (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PrintIcon />}
              disabled={busyId === `${row.id}-print`}
              onClick={() => handleInvoiceAction(row, 'print')}
            >
              Print
            </Button>
          );
        }}
        customActions={(row) => {
          if (isTenant) {
            return (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title={Number(row.paid_amount) > 0 ? 'Download receipt' : 'Download invoice'}>
                  <IconButton
                    size="small"
                    disabled={busyId === `${row.id}-download`}
                    onClick={() => handleInvoiceAction(row, 'download')}
                    sx={{ color: 'primary.main', '&:hover': { bgcolor: alpha(brand.navy, 0.1) } }}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            );
          }

          const canCollectRow = canCollect && UNPAID.includes(row.status);
          return (
            <Stack direction="row" spacing={0.25}>
              {canCollectRow && (
                <Tooltip title="Change due date">
                  <IconButton
                    size="small"
                    onClick={() => openDueDateDialog({
                      id: row.id,
                      tenant_name: tenantNameOf(row),
                      invoice_number: row.invoice_number,
                      month_year: row.month_year,
                    })}
                    sx={{ color: 'warning.main', '&:hover': { bgcolor: (t) => alpha(t.palette.warning.main, 0.12) } }}
                  >
                    <EditCalendarIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {canCollectRow && Number(row.penalty_amount) > 0 && (
                <Tooltip title={`Waive late fee (${formatCurrency(row.penalty_amount)})`}>
                  <IconButton
                    size="small"
                    disabled={busyId === `${row.id}-waive`}
                    onClick={() => waiveLateFee(row)}
                    sx={{ color: 'error.main', '&:hover': { bgcolor: (t) => alpha(t.palette.error.main, 0.12) } }}
                  >
                    <MoneyOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          );
        }}
      />
    </>
  );

  if (isTenant) {
    return (
      <Box>
        <PageHeader title="Rent Payments" subtitle="Pay outstanding rent with UPI or card, and download receipts" />
        {invoicesView}
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Rent Payments" subtitle="Manage rent invoices, collections, reminders and dues">
        <TextField
          select
          size="small"
          label="Hostel"
          value={hostelFilter}
          onChange={(e) => { setHostelFilter(e.target.value); setPage(0); }}
          sx={{ minWidth: 190, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All Hostels</MenuItem>
          {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
        </TextField>
      </PageHeader>

      <Tabs
        value={tab}
        onChange={changeTab}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          borderBottom: `1px solid ${alpha(brand.navy, 0.1)}`,
          ...atmosphereTabsSx,
          '& .MuiTab-root': { ...atmosphereTabsSx['& .MuiTab-root'], fontWeight: 600, textTransform: 'none', fontSize: 14 },
        }}
      >
        {TAB_DEFS.map((def) => <Tab key={def.value} value={def.value} label={tabLabel(def)} />)}
      </Tabs>

      {tab === 'invoices' && invoicesView}
      {tab === 'history' && <RentHistoryTab hostelId={hostelFilter} hostelName={hostelName} />}
      {['reminder', 'pending', 'overdue'].includes(tab) && (
        <RentDueTab
          key={tab}
          bucket={tab}
          items={dueData?.buckets?.[tab] || []}
          loading={dueLoading && !dueData}
          hostelName={hostelName}
          onChangeDueDate={openDueDateDialog}
        />
      )}

      <ChangeDueDateDialog invoice={dueDateInvoice} onClose={closeDueDateDialog} onDone={handleDueDateChanged} />
    </Box>
  );
};

export default RentListPage;
