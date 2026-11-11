import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, TextField, MenuItem, Typography, Button, Card,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import DownloadIcon from '@mui/icons-material/Download';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import PeriodToolbar from '../../components/common/PeriodToolbar';
import DataTable from '../../components/common/DataTable';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import LineChart from '../../components/charts/LineChart';
import FitChartBox from '../../components/charts/FitChartBox';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE, formatCurrency } from '../../utils/constants';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';
import usePeriod from '../../hooks/usePeriod';
import ChartEmptyState from '../../components/charts/ChartEmptyState';
import { brand } from '../../styles/theme';
import { fillMonthSeries, formatChartMonth } from '../../utils/periodRange';

const filterSx = {
  width: '100%',
  ...atmosphereFilterSx,
  '& .MuiOutlinedInput-root': {
    ...atmosphereFilterSx['& .MuiOutlinedInput-root'],
    height: 40,
  },
};

const formatPaymentMethod = (method) => {
  if (!method) return '—';
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const RevenuePage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rows, setRows] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenditure: 0,
    netRevenue: 0,
  });
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState('');
  const { period, setPeriod, bounds, monthKeys } = usePeriod();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const startDate = bounds.start;
  const endDate = bounds.end;

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, []);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/revenue', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          hostelId: hostelId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      const payload = extractData(data) || {};
      setRows(payload.items || []);
      setMonthly(payload.monthly || []);
      setSummary(payload.summary || {
        totalIncome: 0,
        totalExpenditure: 0,
        netRevenue: 0,
      });
      setTotalCount(payload.pagination?.total || 0);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, hostelId, startDate, endDate, enqueueSnackbar]);

  useEffect(() => { setPage(0); }, [period, hostelId]);

  const monthSeries = useMemo(
    () => fillMonthSeries(
      (monthly || []).map((row) => ({ month_year: row.month || row.month_year, total: row.total })),
      monthKeys
    ),
    [monthly, monthKeys]
  );

  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/revenue', {
        params: {
          page: 1,
          limit: 1000,
          hostelId: hostelId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      const payload = extractData(data) || {};
      const items = payload.items || [];
      const s = payload.summary || summary;

      const escapeCsv = (val) => {
        const str = String(val ?? '');
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
      };

      const lines = [
        ['Revenue Export'],
        ['From', startDate || ''],
        ['To', endDate || ''],
        ['Hostel', hostelId ? (hostels.find((h) => String(h.id) === String(hostelId))?.name || hostelId) : 'All Hostels'],
        ['Total Income', s.totalIncome ?? 0],
        ['Total Expenditure', s.totalExpenditure ?? 0],
        ['Net Revenue', s.netRevenue ?? 0],
        [],
        ['Tenant', 'Date Paid', 'Payment Made', 'Amount Paid', 'For Month', 'Hostel', 'Room', 'Status'],
        ...items.map((row) => [
          row.tenant?.user
            ? `${row.tenant.user.first_name} ${row.tenant.user.last_name}`
            : '',
          row.paid_date ? dayjs(row.paid_date).format('DD MMM YYYY') : '',
          formatPaymentMethod(row.payment_method),
          row.paid_amount ?? 0,
          row.month_year || '',
          row.hostel?.name || '',
          row.room?.room_number || '',
          row.status || '',
        ]),
      ];

      const csv = lines.map((line) => (Array.isArray(line) ? line.map(escapeCsv).join(',') : '')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `revenue-tenants-log-${startDate || 'from'}_to_${endDate || 'to'}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      enqueueSnackbar('Revenue data exported', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const tenantLogColumns = [
    {
      field: 'tenant',
      headerName: 'Tenant',
      renderCell: ({ row }) => (
        row.tenant?.user
          ? `${row.tenant.user.first_name} ${row.tenant.user.last_name}`
          : '—'
      ),
    },
    {
      field: 'paid_date',
      headerName: 'Date Paid',
      renderCell: ({ value }) => (value ? dayjs(value).format('DD MMM YYYY') : '—'),
    },
    {
      field: 'payment_method',
      headerName: 'Payment Made',
      renderCell: ({ value }) => formatPaymentMethod(value),
    },
    {
      field: 'paid_amount',
      headerName: 'Amount Paid',
      renderCell: ({ value }) => (
        <Typography fontWeight={700} color="success.main">
          {formatCurrency(value)}
        </Typography>
      ),
    },
    { field: 'month_year', headerName: 'For Month' },
    {
      field: 'hostel',
      headerName: 'Hostel',
      renderCell: ({ row }) => row.hostel?.name || '—',
    },
  ];

  if (loading && rows.length === 0) return <LoadingSkeleton variant="dashboard" />;

  const netPositive = (summary.netRevenue || 0) >= 0;

  return (
    <Box>
      <PageHeader
        title="Revenue"
        subtitle="Track income, expenditure, and net revenue across your hostels"
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Hostel"
          value={hostelId}
          onChange={(e) => { setHostelId(e.target.value); setPage(0); }}
          sx={{ ...filterSx, maxWidth: 280 }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All Hostels</MenuItem>
          {hostels.map((h) => (
            <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
          ))}
        </TextField>
        <PeriodToolbar value={period} onChange={setPeriod} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <StatCard
          size="small"
          title="Total Income"
          value={formatCurrency(summary.totalIncome ?? summary.totalRevenue)}
          icon={TrendingUpIcon}
          color="success"
          subtitle="Rent collected"
        />
        <StatCard
          size="small"
          title="Total Expenditure"
          value={formatCurrency(summary.totalExpenditure)}
          icon={TrendingDownIcon}
          color="error"
          subtitle={summary.bookingRefunds > 0
            ? `Includes ${formatCurrency(summary.bookingRefunds)} booking refunds`
            : 'Expenses on date'}
        />
        <StatCard
          size="small"
          title="Net Revenue"
          value={formatCurrency(summary.netRevenue)}
          icon={AccountBalanceWalletIcon}
          color={netPositive ? 'primary' : 'warning'}
          subtitle="Income − expenses − booking refunds"
        />
      </Box>

      <Card sx={{ mb: 2, p: 2 }}>
        <Typography fontWeight={800} sx={{ fontSize: '1.05rem', mb: 1, letterSpacing: '-0.02em' }}>
          Revenue by month
        </Typography>
        {monthSeries.some((row) => row.total) ? (
          <FitChartBox min={180} max={260} vh={24}>
            <LineChart
              labels={monthSeries.map((row) => formatChartMonth(row.month_year, monthKeys))}
              selectedIndex={period.kind === 'month' ? monthKeys.indexOf(period.month) : -1}
              onLabelClick={(_, index) => {
                const month = monthKeys[index];
                if (month) setPeriod({ kind: 'month', month });
              }}
              datasets={[{
                label: 'Income',
                data: monthSeries.map((row) => row.total),
                borderColor: brand.teal,
              }]}
            />
          </FitChartBox>
        ) : (
          <ChartEmptyState
            title="No collections in this period"
            hint="Pick another month or range, or collect rent to see the trend."
            actionTo="/rent/collect"
            actionLabel="Collect rent"
          />
        )}
      </Card>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 1.5,
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ color: brand.navy }}>
            Tenants Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Payment date, payment method, and amount paid by each tenant
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export / Download'}
        </Button>
      </Box>

      <DataTable
        columns={tenantLogColumns}
        rows={rows}
        loading={loading}
        page={page}
        rowsPerPage={rowsPerPage}
        totalCount={totalCount}
        onPageChange={setPage}
        onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(0); }}
        showActions={false}
        emptyMessage="No tenant payments in the selected date range."
      />
    </Box>
  );
};

export default RevenuePage;
