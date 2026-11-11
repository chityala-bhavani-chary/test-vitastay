import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Alert, Box, Chip, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography, alpha,
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import DataTable from '../../components/common/DataTable';
import ExportMenu from '../../components/common/ExportMenu';
import SearchBar from '../../components/common/SearchBar';
import { formatCurrency } from '../../utils/constants';
import { brand } from '../../styles/theme';
import { dueIndicator, plural, PENDING_GRACE_DAYS } from './rentUtils';

const BUCKETS = {
  reminder: {
    title: 'Payment Reminders',
    hint: 'Rent due today or within the next 2 days. Send a reminder before the due date.',
    severity: 'info',
    color: '#0369A1',
  },
  pending: {
    title: 'Pending Payments',
    hint: `Due date has passed. Tenants are in the ${PENDING_GRACE_DAYS}-day grace period; after that they move to Overdue.`,
    severity: 'warning',
    color: '#B45309',
  },
  overdue: {
    title: 'Overdue Payments',
    hint: `Not paid even after the ${PENDING_GRACE_DAYS}-day grace period. Sorted by most days overdue.`,
    severity: 'error',
    color: '#B91C1C',
  },
};

const fmtDate = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '—');
const fmtMonth = (m) => (m ? dayjs(`${m}-01`).format('MMM YYYY') : '');

const whatsappLink = (row, hostelName, grouped) => {
  const digits = String(row.tenant_phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return null;
  const hostel = row.hostel_name || hostelName || 'your hostel';
  let body;
  if (grouped && row.months > 1) {
    body = `Your rent for ${plural(row.months, 'month')} (${row.month_list}) is pending, totalling ${formatCurrency(row.total_due)}. `
      + `The oldest was due on ${fmtDate(row.oldest_due)}.`;
  } else {
    const status = row.days_past_due > 0
      ? `was due on ${fmtDate(row.due_date)} (${plural(row.days_past_due, 'day')} ago)`
      : `is due on ${fmtDate(row.due_date)}`;
    body = `Your rent of ${formatCurrency(grouped ? row.total_due : row.balance)} for ${fmtMonth(row.month_year) || 'this month'} ${status}.`;
  }
  const text = `Hello ${row.tenant_name}, this is a reminder from ${hostel}. ${body} Please make the payment at the earliest. Thank you.`;
  return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
};

/** One row per tenant: months owed, oldest due date and total balance across the bucket's invoices. */
const groupByTenant = (items) => {
  const map = new Map();
  items.forEach((i) => {
    const g = map.get(i.tenant_id) || {
      id: `t-${i.tenant_id}`,
      tenant_id: i.tenant_id,
      tenant_name: i.tenant_name,
      tenant_phone: i.tenant_phone,
      hostel_name: i.hostel_name,
      room_number: i.room_number,
      invoices: [],
    };
    g.invoices.push(i);
    map.set(i.tenant_id, g);
  });
  return [...map.values()].map((g) => {
    const sorted = [...g.invoices].sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
    const oldest = sorted[0];
    return {
      ...g,
      invoices: sorted,
      months: sorted.length,
      month_list: sorted.map((i) => fmtMonth(i.month_year)).join(', '),
      oldest_invoice_id: oldest.id,
      oldest_due: oldest.due_date,
      due_date: oldest.due_date,
      month_year: oldest.month_year,
      days_past_due: oldest.days_past_due,
      months_past_due: oldest.months_past_due,
      total_due: sorted.reduce((s, i) => s + i.balance, 0),
      all_months_due: oldest.tenant_months_due,
      all_total_due: oldest.tenant_total_due,
    };
  }).sort((a, b) => b.days_past_due - a.days_past_due);
};

const MonthsChip = ({ months, color }) => (
  <Chip
    size="small"
    label={plural(months, 'month')}
    sx={{
      fontWeight: 700,
      bgcolor: months > 1 ? color : alpha(color, 0.12),
      color: months > 1 ? '#fff' : color,
    }}
  />
);

const RentDueTab = ({ bucket, items = [], loading, hostelName, onChangeDueDate }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [view, setView] = useState('invoice');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const cfg = BUCKETS[bucket];
  const canGroup = bucket !== 'reminder';
  const grouped = canGroup && view === 'tenant';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => [i.tenant_name, i.tenant_phone, i.room_number, i.invoice_number, i.hostel_name]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [items, search]);
  const tenantRows = useMemo(() => groupByTenant(filtered), [filtered]);
  const rows = grouped ? tenantRows : filtered;

  const totalBalance = filtered.reduce((sum, i) => sum + i.balance, 0);
  const tenantCount = tenantRows.length;
  const multiMonth = tenantRows.filter((t) => (t.all_months_due || t.months) > 1).length;
  const pageRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const tenantCell = (row) => (
    <Box>
      <Typography variant="body2" fontWeight={600}>{row.tenant_name}</Typography>
      {row.tenant_phone && <Typography variant="caption" color="text.secondary">{row.tenant_phone}</Typography>}
    </Box>
  );
  const indicatorChip = (row) => {
    const ind = dueIndicator(row.days_past_due, row.months_past_due);
    return <Chip size="small" color={ind.color} label={ind.label} sx={{ fontWeight: 600 }} />;
  };

  const invoiceColumns = [
    { field: 'tenant_name', headerName: 'Tenant', renderCell: ({ row }) => tenantCell(row) },
    { field: 'hostel_name', headerName: 'Hostel' },
    { field: 'room_number', headerName: 'Room' },
    {
      field: 'invoice_number',
      headerName: 'Invoice / Month',
      renderCell: ({ row }) => (
        <Box>
          <Typography variant="body2">{row.invoice_number || `#${row.id}`}</Typography>
          <Typography variant="caption" color="text.secondary">{fmtMonth(row.month_year)}</Typography>
        </Box>
      ),
    },
    {
      field: 'due_date',
      headerName: 'Due Date',
      renderCell: ({ row }) => (
        <Box>
          <Typography variant="body2">{fmtDate(row.due_date)}</Typography>
          {row.original_due_date && (
            <Typography variant="caption" color="text.secondary" display="block">
              Extended from {dayjs(row.original_due_date).format('DD MMM')} (+{plural(row.extension_days, 'day')})
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'days_past_due',
      headerName: bucket === 'reminder' ? 'Due In' : 'Due By',
      renderCell: ({ row }) => indicatorChip(row),
    },
    {
      field: 'tenant_months_due',
      headerName: bucket === 'reminder' ? 'Earlier Dues' : 'Months Due',
      renderCell: ({ row }) => {
        if (!row.tenant_months_due) return <Typography variant="caption" color="text.secondary">None</Typography>;
        return (
          <Tooltip title={`${row.tenant_name} owes ${formatCurrency(row.tenant_total_due)} across ${plural(row.tenant_months_due, 'unpaid month')} (oldest due ${fmtDate(row.tenant_oldest_due)})`}>
            <Box>
              <MonthsChip months={row.tenant_months_due} color={cfg.color} />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                {formatCurrency(row.tenant_total_due)} total
              </Typography>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'balance',
      headerName: 'Balance Due',
      align: 'right',
      renderCell: ({ row }) => (
        <Box>
          <Typography variant="body2" fontWeight={700} sx={{ color: cfg.color }}>{formatCurrency(row.balance)}</Typography>
          {row.paid_amount > 0 && (
            <Typography variant="caption" color="text.secondary" display="block">Paid {formatCurrency(row.paid_amount)}</Typography>
          )}
          {row.extension_charge > 0 && (
            <Typography variant="caption" color="text.secondary" display="block">
              Incl. extension {formatCurrency(row.extension_charge)}
            </Typography>
          )}
        </Box>
      ),
    },
  ];

  const tenantColumns = [
    { field: 'tenant_name', headerName: 'Tenant', renderCell: ({ row }) => tenantCell(row) },
    { field: 'hostel_name', headerName: 'Hostel' },
    { field: 'room_number', headerName: 'Room' },
    {
      field: 'months',
      headerName: bucket === 'overdue' ? 'Months Overdue' : 'Months Pending',
      renderCell: ({ row }) => (
        <Box>
          <MonthsChip months={row.months} color={cfg.color} />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25, maxWidth: 220 }}>
            {row.month_list}
          </Typography>
        </Box>
      ),
    },
    { field: 'oldest_due', headerName: 'Oldest Due', renderCell: ({ row }) => fmtDate(row.oldest_due) },
    { field: 'days_past_due', headerName: 'Due By', renderCell: ({ row }) => indicatorChip(row) },
    {
      field: 'total_due',
      headerName: 'Total Due',
      align: 'right',
      renderCell: ({ row }) => (
        <Box>
          <Typography variant="body2" fontWeight={800} sx={{ color: cfg.color }}>{formatCurrency(row.total_due)}</Typography>
          {row.all_months_due > row.months && (
            <Typography variant="caption" color="text.secondary" display="block">
              {formatCurrency(row.all_total_due)} across {plural(row.all_months_due, 'month')} in total
            </Typography>
          )}
        </Box>
      ),
    },
  ];

  const getExportData = async () => {
    const subtitle = `As of ${dayjs().format('DD MMM YYYY')}${hostelName ? ` · ${hostelName}` : ''}`;
    const summary = [
      ['Tenants', String(tenantCount)],
      ['Invoices', String(filtered.length)],
      ['Tenants with more than one month due', String(multiMonth)],
      ['Total balance due', formatCurrency(totalBalance)],
    ];
    if (grouped) {
      return {
        title: `${cfg.title} (by tenant)`,
        subtitle,
        summary,
        columns: [
          { header: 'Tenant', key: 'tenant_name', width: 22 },
          { header: 'Phone', key: 'tenant_phone', width: 14 },
          { header: 'Hostel', key: 'hostel_name', width: 22 },
          { header: 'Room', key: 'room_number', width: 8 },
          { header: 'Months Due', key: 'months', type: 'number', width: 11 },
          { header: 'Months', key: 'month_list', width: 30 },
          { header: 'Oldest Due', key: 'oldest_fmt', width: 13 },
          { header: 'Days Late', key: 'days_late', type: 'number', width: 10 },
          { header: 'Total Due', key: 'total_due', type: 'currency', width: 14 },
        ],
        rows: tenantRows.map((t) => ({
          ...t,
          oldest_fmt: fmtDate(t.oldest_due),
          days_late: Math.max(0, t.days_past_due),
        })),
      };
    }
    return {
      title: cfg.title,
      subtitle,
      summary,
      columns: [
        { header: 'Tenant', key: 'tenant_name', width: 22 },
        { header: 'Phone', key: 'tenant_phone', width: 14 },
        { header: 'Hostel', key: 'hostel_name', width: 22 },
        { header: 'Room', key: 'room_number', width: 8 },
        { header: 'Invoice', key: 'invoice_number', width: 20 },
        { header: 'Month', key: 'month_fmt', width: 10 },
        { header: 'Due Date', key: 'due_date_fmt', width: 13 },
        { header: 'Original Due', key: 'original_fmt', width: 13 },
        { header: bucket === 'reminder' ? 'Due In' : 'Due By', key: 'indicator', width: 30 },
        { header: 'Days Late', key: 'days_late', type: 'number', width: 10 },
        { header: 'Months Due (tenant)', key: 'tenant_months_due', type: 'number', width: 12 },
        { header: 'Invoice Amount', key: 'total_amount', type: 'currency', width: 15 },
        { header: 'Paid', key: 'paid_amount', type: 'currency', width: 13 },
        { header: 'Balance Due', key: 'balance', type: 'currency', width: 14 },
        { header: 'Tenant Total Due', key: 'tenant_total_due', type: 'currency', width: 15 },
      ],
      rows: filtered.map((i) => ({
        ...i,
        month_fmt: fmtMonth(i.month_year),
        due_date_fmt: fmtDate(i.due_date),
        original_fmt: i.original_due_date ? fmtDate(i.original_due_date) : '',
        indicator: dueIndicator(i.days_past_due, i.months_past_due).label,
        days_late: Math.max(0, i.days_past_due),
      })),
    };
  };

  const rowActions = (row) => {
    const invoiceId = grouped ? row.oldest_invoice_id : row.id;
    const invoiceRow = grouped ? row.invoices[0] : row;
    const wa = whatsappLink(row, hostelName, grouped);
    return (
      <Stack direction="row" spacing={0.25}>
        {wa && (
          <Tooltip title="Send WhatsApp reminder">
            <IconButton
              size="small"
              component="a"
              href={wa}
              target="_blank"
              rel="noopener"
              sx={{ color: '#25D366', '&:hover': { bgcolor: alpha('#25D366', 0.12) } }}
            >
              <WhatsAppIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {onChangeDueDate && (
          <Tooltip title={grouped ? 'Change due date of the oldest invoice' : 'Change due date'}>
            <IconButton
              size="small"
              onClick={() => onChangeDueDate({
                id: invoiceId,
                tenant_name: invoiceRow.tenant_name,
                invoice_number: invoiceRow.invoice_number,
                month_year: invoiceRow.month_year,
              })}
              sx={{ color: 'warning.main', '&:hover': { bgcolor: (t) => alpha(t.palette.warning.main, 0.12) } }}
            >
              <EditCalendarIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={grouped ? 'Collect oldest invoice first' : 'Collect payment'}>
          <IconButton
            size="small"
            onClick={() => navigate(`/rent/collect/${invoiceId}`)}
            sx={{ color: brand.teal, '&:hover': { bgcolor: alpha(brand.teal, 0.12) } }}
          >
            <PaymentsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    );
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ md: 'center' }}>
        <SearchBar
          placeholder="Search tenant, phone, room or invoice..."
          onSearch={(v) => { setSearch(v); setPage(0); }}
          sx={{ flex: 1, minWidth: 220 }}
        />
        {canGroup && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, v) => { if (v) { setView(v); setPage(0); } }}
            sx={{
              '& .MuiToggleButton-root': {
                color: brand.navy,
                borderColor: alpha(brand.navy, 0.2),
                bgcolor: '#fff',
                textTransform: 'none',
                px: 1.5,
                '&.Mui-selected': { color: '#fff', bgcolor: brand.navy, '&:hover': { bgcolor: brand.navyMid } },
              },
            }}
          >
            <ToggleButton value="invoice">By invoice</ToggleButton>
            <ToggleButton value="tenant">By tenant</ToggleButton>
          </ToggleButtonGroup>
        )}
        <ExportMenu getData={getExportData} disabled={loading} />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Paper sx={{ p: 1.5, flex: 1, borderLeft: `4px solid ${cfg.color}` }}>
          <Typography variant="caption" color="text.secondary">Tenants</Typography>
          <Typography variant="h6" fontWeight={800}>{tenantCount}</Typography>
          <Typography variant="caption" color="text.secondary">{plural(filtered.length, 'invoice')}</Typography>
        </Paper>
        {canGroup && (
          <Paper sx={{ p: 1.5, flex: 1, borderLeft: `4px solid ${cfg.color}` }}>
            <Typography variant="caption" color="text.secondary">Owing 2+ months</Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: multiMonth ? cfg.color : 'text.primary' }}>{multiMonth}</Typography>
            <Typography variant="caption" color="text.secondary">tenant(s)</Typography>
          </Paper>
        )}
        <Paper sx={{ p: 1.5, flex: 1, borderLeft: `4px solid ${cfg.color}` }}>
          <Typography variant="caption" color="text.secondary">Total Balance Due</Typography>
          <Typography variant="h6" fontWeight={800} sx={{ color: cfg.color }}>{formatCurrency(totalBalance)}</Typography>
        </Paper>
        <Alert severity={cfg.severity} sx={{ flex: 2, alignItems: 'center' }}>{cfg.hint}</Alert>
      </Stack>

      <DataTable
        columns={grouped ? tenantColumns : invoiceColumns}
        rows={pageRows}
        loading={loading}
        page={page}
        rowsPerPage={rowsPerPage}
        totalCount={rows.length}
        onPageChange={setPage}
        onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(0); }}
        emptyMessage={bucket === 'reminder' ? 'No rent due in the next 2 days' : `No ${bucket} payments`}
        customActions={rowActions}
      />
    </Box>
  );
};

export default RentDueTab;
