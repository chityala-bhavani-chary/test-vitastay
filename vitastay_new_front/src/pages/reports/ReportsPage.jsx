import { useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, TextField, MenuItem, Button, Tabs, Tab,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import PeriodToolbar from '../../components/common/PeriodToolbar';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import FitChartBox from '../../components/charts/FitChartBox';
import OccupancyRing from '../../components/charts/OccupancyRing';
import ChartEmptyState from '../../components/charts/ChartEmptyState';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import { useSnackbar } from 'notistack';
import { atmosphereFilterSx, atmosphereSelectMenuProps, atmosphereTabsSx, atmosphereOutlinedBtnSx } from '../../styles/atmosphere';
import { brand } from '../../styles/theme';
import usePeriod from '../../hooks/usePeriod';
import { fillMonthSeries, formatChartMonth, prettyCategory } from '../../utils/periodRange';

const ReportsPage = () => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState('');
  const { period, setPeriod, bounds, monthKeys } = usePeriod();
  const [loading, setLoading] = useState(false);
  const [occupancy, setOccupancy] = useState(null);
  const [rentCollection, setRentCollection] = useState(null);
  const [pendingRent, setPendingRent] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [financeSummary, setFinanceSummary] = useState(null);

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => setHostels(extractPaginated(data).data))
      .catch(() => {});
  }, []);

  const params = { hostelId: hostelId || undefined, startDate: bounds.start, endDate: bounds.end };

  const fetchReports = async (reportTab = tab) => {
    setLoading(true);
    try {
      if (reportTab === 0) {
        const { data } = await api.get('/reports/occupancy', { params: { hostelId: hostelId || undefined } });
        setOccupancy(extractData(data));
      } else if (reportTab === 1) {
        const { data } = await api.get('/reports/rent-collection', { params });
        setRentCollection(extractData(data));
      } else if (reportTab === 2) {
        const { data } = await api.get('/reports/pending-rent', { params: { hostelId: hostelId || undefined } });
        setPendingRent(extractData(data));
      } else if (reportTab === 3) {
        const { data } = await api.get('/reports/expenses', { params });
        setExpenses(extractData(data));
      } else if (reportTab === 4) {
        const { data } = await api.get('/reports/finance-summary', { params });
        setFinanceSummary(extractData(data));
      }
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [tab, hostelId, bounds.start, bounds.end]);

  const handleExport = async () => {
    try {
      const response = await api.get('/reports/export/excel', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vitastay-report-${dayjs().format('YYYY-MM-DD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      enqueueSnackbar('Report exported successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const occupiedCount = (occupancy?.rooms || []).find((r) => r.status === 'occupied')?.count;
  const vacantCount = (occupancy?.rooms || []).find((r) => r.status === 'vacant')?.count;

  const expenseByCategory = expenses?.byCategory || expenses?.categories || [];
  const expenseLabels = expenseByCategory.map((e) => prettyCategory(e.category));
  const expenseValues = expenseByCategory.map((e) => parseFloat(e.total || e.amount || 0));

  const rentSeries = useMemo(
    () => fillMonthSeries(rentCollection?.byMonth || [], monthKeys),
    [rentCollection?.byMonth, monthKeys]
  );
  const expenseSeries = useMemo(
    () => fillMonthSeries(expenses?.byMonth || [], monthKeys),
    [expenses?.byMonth, monthKeys]
  );
  const financeSeries = useMemo(
    () => fillMonthSeries(financeSummary?.monthlyIncome || [], monthKeys),
    [financeSummary?.monthlyIncome, monthKeys]
  );

  const selectMonthAt = (keys, index) => {
    const month = keys[index];
    if (month) setPeriod({ kind: 'month', month });
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      <PageHeader title="Reports" subtitle="Analytics and financial reports">
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} sx={atmosphereOutlinedBtnSx}>
          Export Excel
        </Button>
      </PageHeader>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Hostel"
          value={hostelId}
          onChange={(e) => setHostelId(e.target.value)}
          sx={{ minWidth: 160, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All Hostels</MenuItem>
          {hostels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
        </TextField>
        <PeriodToolbar value={period} onChange={setPeriod} />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, ...atmosphereTabsSx }} variant="scrollable">
        <Tab label="Occupancy" />
        <Tab label="Rent Collection" />
        <Tab label="Pending Rent" />
        <Tab label="Expenses" />
        <Tab label="Finance Summary" />
      </Tabs>

      {loading ? (
        <LoadingSkeleton variant="dashboard" />
      ) : (
        <Card>
          <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
            {tab === 0 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.2fr' }, gap: 2, minWidth: 0, alignItems: 'center' }}>
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  <StatCard title="Total Rooms" value={occupancy?.total || 0} color="primary" size="small" />
                  <StatCard title="Occupancy Rate" value={`${occupancy?.occupancyRate || 0}%`} color="success" size="small" />
                </Box>
                <OccupancyRing
                  occupied={parseInt(occupiedCount || 0, 10)}
                  vacant={parseInt(vacantCount || 0, 10)}
                  size={180}
                />
              </Box>
            )}

            {tab === 1 && (
              <Box sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                  <StatCard title="Total Collected" value={formatCurrency(rentCollection?.total)} color="success" />
                  <StatCard title="Payments" value={rentCollection?.payments?.length || 0} color="primary" />
                </Box>
                <Typography fontWeight={800} sx={{ fontSize: '1.05rem' }}>Rent by month</Typography>
                {rentSeries.some((row) => row.total) ? (
                  <FitChartBox min={180} max={260} vh={24}>
                    <LineChart
                      labels={rentSeries.map((row) => formatChartMonth(row.month_year, monthKeys))}
                      selectedIndex={period.kind === 'month' ? monthKeys.indexOf(period.month) : -1}
                      onLabelClick={(_, index) => selectMonthAt(monthKeys, index)}
                      datasets={[{
                        label: 'Collected',
                        data: rentSeries.map((row) => row.total),
                        borderColor: brand.teal,
                      }]}
                    />
                  </FitChartBox>
                ) : (
                  <ChartEmptyState title="No rent collected in this period" hint="Try another month or a 3 / 6 / 12 month range." />
                )}
              </Box>
            )}

            {tab === 2 && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <StatCard title="Total Pending" value={formatCurrency(pendingRent?.total)} color="warning" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <StatCard title="Pending Invoices" value={pendingRent?.payments?.length || 0} color="error" />
                </Grid>
              </Grid>
            )}

            {tab === 3 && (
              <Box sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
                <StatCard title="Total Expenses" value={formatCurrency(expenses?.total)} color="error" />
                <Typography fontWeight={800} sx={{ fontSize: '1.05rem' }}>Expenses by month</Typography>
                {expenseSeries.some((row) => row.total) ? (
                  <FitChartBox min={160} max={220} vh={20}>
                    <LineChart
                      labels={expenseSeries.map((row) => formatChartMonth(row.month_year, monthKeys))}
                      selectedIndex={period.kind === 'month' ? monthKeys.indexOf(period.month) : -1}
                      onLabelClick={(_, index) => selectMonthAt(monthKeys, index)}
                      datasets={[{
                        label: 'Expenses',
                        data: expenseSeries.map((row) => row.total),
                        borderColor: theme.palette.error.main,
                      }]}
                    />
                  </FitChartBox>
                ) : (
                  <ChartEmptyState height={140} title="No expenses in this period" />
                )}
                <Typography fontWeight={800} sx={{ fontSize: '1.05rem' }}>Expenses by category</Typography>
                {expenseValues.some((v) => v > 0) ? (
                  <FitChartBox min={150} max={220} vh={20}>
                    <BarChart
                      horizontal
                      labels={expenseLabels}
                      datasets={[{ label: 'Amount', data: expenseValues, backgroundColor: brand.navy }]}
                    />
                  </FitChartBox>
                ) : (
                  <ChartEmptyState height={140} title="No category spend to show" />
                )}
              </Box>
            )}

            {tab === 4 && financeSummary && (
              <Box sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
                  <StatCard title="Total Income" value={formatCurrency(financeSummary.income)} color="success" />
                  <StatCard title="Total Expenses" value={formatCurrency(financeSummary.expenses)} color="error" />
                  <StatCard title="Net Balance" value={formatCurrency(financeSummary.balance || financeSummary.profit || (financeSummary.income - financeSummary.expenses))} color="primary" />
                </Box>
                <Typography fontWeight={800} sx={{ fontSize: '1.05rem' }}>Income by month</Typography>
                {financeSeries.some((row) => row.total) ? (
                  <FitChartBox min={180} max={240} vh={22}>
                    <LineChart
                      labels={financeSeries.map((row) => formatChartMonth(row.month_year, monthKeys))}
                      selectedIndex={period.kind === 'month' ? monthKeys.indexOf(period.month) : -1}
                      onLabelClick={(_, index) => selectMonthAt(monthKeys, index)}
                      datasets={[{
                        label: 'Income',
                        data: financeSeries.map((row) => row.total),
                        borderColor: brand.teal,
                      }]}
                    />
                  </FitChartBox>
                ) : (
                  <ChartEmptyState title="No income in this period" />
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ReportsPage;
