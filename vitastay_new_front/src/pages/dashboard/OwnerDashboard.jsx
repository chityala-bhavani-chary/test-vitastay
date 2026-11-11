import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Card, Typography, Box, Button, LinearProgress, alpha, useTheme,
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import BuildIcon from '@mui/icons-material/Build';
import BadgeIcon from '@mui/icons-material/Badge';
import HotelIcon from '@mui/icons-material/Hotel';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CampaignIcon from '@mui/icons-material/Campaign';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import PeriodToolbar from '../../components/common/PeriodToolbar';
import KpiCard from '../../components/common/KpiCard';
import StatusChip from '../../components/common/StatusChip';
import BarChart from '../../components/charts/BarChart';
import FitChartBox from '../../components/charts/FitChartBox';
import OccupancyRing from '../../components/charts/OccupancyRing';
import ChartEmptyState from '../../components/charts/ChartEmptyState';
import api, { extractData, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import { useSnackbar } from 'notistack';
import { atmosphereOutlinedBtnSx } from '../../styles/atmosphere';
import { brand } from '../../styles/theme';
import usePeriod from '../../hooks/usePeriod';
import {
  fillMonthSeries,
  formatChartMonth,
  formatMonthLabel,
  monthsEndingAt,
  sumSeries,
} from '../../utils/periodRange';

const AttentionRow = ({ icon: Icon, label, value, to, tone, alert }) => (
  <Box
    component={RouterLink}
    to={to}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 1.1,
      py: 0.85,
      borderRadius: 1.5,
      textDecoration: 'none',
      color: 'inherit',
      bgcolor: alert ? alpha(tone, 0.08) : 'transparent',
      '&:hover': { bgcolor: alpha(tone, 0.12) },
    }}
  >
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: 1,
        display: 'grid',
        placeItems: 'center',
        bgcolor: alpha(tone, 0.14),
        color: tone,
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: 16 }} />
    </Box>
    <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={800} sx={{ color: alert ? tone : 'text.primary' }}>
      {value}
    </Typography>
    <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
  </Box>
);

const TodayStat = ({ icon: Icon, label, value, to, tone }) => (
  <Box
    component={to ? RouterLink : 'div'}
    to={to}
    sx={{
      flex: 1,
      minWidth: 0,
      textDecoration: 'none',
      color: 'inherit',
      px: 1,
      py: 0.75,
      borderRadius: 1.5,
      '&:hover': to ? { bgcolor: alpha(tone, 0.08) } : undefined,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.35 }}>
      <Icon sx={{ fontSize: 15, color: tone }} />
      <Typography variant="caption" color="text.secondary" fontWeight={700} noWrap>
        {label}
      </Typography>
    </Box>
    <Typography fontWeight={800} sx={{ fontSize: '1.2rem', lineHeight: 1.1 }}>
      {value}
    </Typography>
  </Box>
);

const OwnerDashboard = () => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { period, setPeriod, monthKeys } = usePeriod();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data: res } = await api.get('/dashboard/owner');
        setData(extractData(res));
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [enqueueSnackbar]);

  const stats = data?.stats || {};
  const charts = data?.charts || {};
  const dues = data?.dues || [];
  const occupancy = charts.occupancyRate?.[0] || { occupied: 0, vacant: 0 };

  const chartMonthKeys = useMemo(() => {
    if (period.kind === 'range') return monthKeys;
    return monthsEndingAt(period.month, 6);
  }, [period, monthKeys]);

  const billedLookup = useMemo(() => {
    const map = new Map();
    (charts.monthlyBilled || []).forEach((row) => {
      map.set(row.month_year, {
        billed: Number(row.billed || 0),
        collected: Number(row.collected || 0),
      });
    });
    (charts.monthlyIncome || []).forEach((row) => {
      const prev = map.get(row.month_year) || { billed: 0, collected: 0 };
      if (!prev.collected) prev.collected = Number(row.total || 0);
      map.set(row.month_year, prev);
    });
    return map;
  }, [charts.monthlyBilled, charts.monthlyIncome]);

  const collectionSeries = useMemo(
    () => chartMonthKeys.map((month) => {
      const hit = billedLookup.get(month) || { billed: 0, collected: 0 };
      return { month_year: month, billed: hit.billed, collected: hit.collected };
    }),
    [chartMonthKeys, billedLookup]
  );

  const periodBilled = useMemo(
    () => monthKeys.reduce((sum, month) => sum + Number(billedLookup.get(month)?.billed || 0), 0),
    [monthKeys, billedLookup]
  );
  const periodCollected = useMemo(
    () => monthKeys.reduce((sum, month) => sum + Number(billedLookup.get(month)?.collected || 0), 0),
    [monthKeys, billedLookup]
  );
  const periodExpenseTotal = useMemo(
    () => sumSeries(fillMonthSeries(charts.monthlyExpenses, monthKeys)),
    [charts.monthlyExpenses, monthKeys]
  );

  const collectionRate = periodBilled > 0 ? Math.round((periodCollected / periodBilled) * 100) : 0;
  const lastMonthKey = dayjs().subtract(1, 'month').format('YYYY-MM');
  const lastMonthCollected = Number(billedLookup.get(lastMonthKey)?.collected || 0);
  const collectedDelta = period.kind === 'month' && period.month === dayjs().format('YYYY-MM')
    ? periodCollected - lastMonthCollected
    : null;

  const selectedIndex = period.kind === 'month'
    ? chartMonthKeys.indexOf(period.month)
    : -1;
  const hasCollectionHistory = collectionSeries.some((row) => row.billed || row.collected);
  const outstanding = Number(stats.outstanding || stats.pendingRent || 0);
  const overdueAmount = Number(stats.overdueAmount || 0);
  const openJobs = Number(stats.complaints || 0) + Number(stats.maintenance || 0);
  const periodCaption = period.kind === 'month'
    ? formatMonthLabel(period.month)
    : `Last ${period.months} months`;

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  const selectMonthAt = (index) => {
    const month = chartMonthKeys[index];
    if (month) setPeriod({ kind: 'month', month });
  };

  return (
    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <PageHeader
        dense
        title="Owner Dashboard"
        subtitle="Occupancy, collections, and dues — what to act on today"
      >
        <Button size="small" variant="contained" startIcon={<PaymentsIcon />} component={RouterLink} to="/rent/collect">
          Collect rent
        </Button>
        <Button size="small" variant="outlined" startIcon={<PersonAddIcon />} component={RouterLink} to="/tenants/new" sx={atmosphereOutlinedBtnSx}>
          Add tenant
        </Button>
        <Button size="small" variant="outlined" startIcon={<CampaignIcon />} component={RouterLink} to="/notices" sx={atmosphereOutlinedBtnSx}>
          Notice
        </Button>
        <Button size="small" variant="outlined" startIcon={<AssessmentIcon />} component={RouterLink} to="/reports" sx={atmosphereOutlinedBtnSx}>
          Reports
        </Button>
      </PageHeader>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            lg: 'repeat(6, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        <KpiCard
          label="Occupancy"
          value={`${stats.occupancyRate || 0}%`}
          hint={`${stats.occupiedRooms || 0} of ${(stats.occupiedRooms || 0) + (stats.vacantRooms || 0)} rooms filled`}
          icon={MeetingRoomIcon}
          color="success"
          to="/rooms"
          meter={stats.occupancyRate || 0}
        />
        <KpiCard
          label="Collected"
          value={formatCurrency(periodCollected)}
          hint={collectedDelta == null
            ? periodCaption
            : `${collectedDelta >= 0 ? '+' : ''}${formatCurrency(collectedDelta)} vs last month`}
          icon={PaymentsIcon}
          color="success"
          to="/revenue"
          meter={periodBilled > 0 ? collectionRate : undefined}
        />
        <KpiCard
          label="Still due"
          value={formatCurrency(outstanding)}
          hint={`${(stats.pendingCount || 0) + (stats.partialCount || 0) + (stats.overdueCount || 0)} open invoices`}
          icon={PaymentsIcon}
          color="warning"
          to="/rent"
        />
        <KpiCard
          label="Overdue"
          value={formatCurrency(overdueAmount)}
          hint={`${stats.overdueCount || 0} tenant${stats.overdueCount === 1 ? '' : 's'} past due`}
          icon={WarningAmberIcon}
          color="error"
          to="/rent"
        />
        <KpiCard
          label="Vacant rooms"
          value={stats.vacantRooms || 0}
          hint={stats.vacancyLoss ? `${formatCurrency(stats.vacancyLoss)} idle / month` : `${stats.activeTenants || 0} active tenants`}
          icon={HotelIcon}
          color="info"
          to="/rooms"
        />
        <KpiCard
          label="Open jobs"
          value={openJobs}
          hint={`${stats.complaints || 0} complaints · ${stats.maintenance || 0} maintenance`}
          icon={BuildIcon}
          color="warning"
          to="/complaints"
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(280px, 1fr)' },
          gap: 1.5,
          alignItems: 'stretch',
        }}
      >
        <Card sx={{ p: 2, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
            <Box>
              <Typography fontWeight={800} sx={{ fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
                Rent collection
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {periodCaption} · billed vs received
              </Typography>
            </Box>
            <PeriodToolbar value={period} onChange={setPeriod} />
          </Box>

          {periodBilled > 0 ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                <Typography fontWeight={800} sx={{ fontSize: '1.15rem' }}>
                  {formatCurrency(periodCollected)}
                  <Typography component="span" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                    {` of ${formatCurrency(periodBilled)}`}
                  </Typography>
                </Typography>
                <Typography fontWeight={800} sx={{ color: collectionRate >= 80 ? 'success.main' : 'warning.main' }}>
                  {collectionRate}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={collectionRate}
                sx={{
                  height: 10,
                  borderRadius: 99,
                  bgcolor: alpha(brand.navy, 0.08),
                  '& .MuiLinearProgress-bar': { bgcolor: brand.teal, borderRadius: 99 },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                {formatCurrency(Math.max(0, periodBilled - periodCollected))} still open this period
                {periodExpenseTotal > 0 ? ` · expenses ${formatCurrency(periodExpenseTotal)}` : ''}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              No invoices in {periodCaption}
              {outstanding > 0 ? ` — ${formatCurrency(outstanding)} is still due from earlier months.` : '.'}
            </Typography>
          )}

          <Box sx={{ mt: 2, flex: 1, minWidth: 0 }}>
            {hasCollectionHistory ? (
              <FitChartBox min={170} max={220} vh={20}>
                <BarChart
                  legend
                  labels={collectionSeries.map((row) => formatChartMonth(row.month_year, chartMonthKeys))}
                  onLabelClick={(_, index) => selectMonthAt(index)}
                  datasets={[
                    {
                      label: 'Billed',
                      data: collectionSeries.map((row) => row.billed),
                      backgroundColor: collectionSeries.map((_, index) => (
                        index === selectedIndex ? alpha(brand.navy, 0.38) : alpha(brand.navy, 0.16)
                      )),
                    },
                    {
                      label: 'Collected',
                      data: collectionSeries.map((row) => row.collected),
                      backgroundColor: collectionSeries.map((_, index) => (
                        index === selectedIndex ? brand.tealDark : brand.teal
                      )),
                    },
                  ]}
                />
              </FitChartBox>
            ) : (
              <ChartEmptyState
                height={150}
                title="No rent invoices yet"
                hint="Generate or collect rent to see billed vs received by month."
                actionTo="/rent/collect"
                actionLabel="Collect rent"
              />
            )}
          </Box>
        </Card>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <Card sx={{ p: 2 }}>
            <Typography fontWeight={800} sx={{ fontSize: '1.05rem', mb: 1.25, letterSpacing: '-0.02em' }}>
              Occupancy
            </Typography>
            <OccupancyRing
              occupied={occupancy.occupied || stats.occupiedRooms || 0}
              vacant={occupancy.vacant || stats.vacantRooms || 0}
              occupiedBeds={stats.occupiedBeds}
              vacantBeds={stats.vacantBeds}
              lossLabel={stats.vacancyLoss ? `${formatCurrency(stats.vacancyLoss)} idle this month` : null}
              size={140}
            />
          </Card>
          <Card sx={{ p: 1.5 }}>
            <Typography fontWeight={800} sx={{ fontSize: '1.05rem', px: 0.5, mb: 0.5, letterSpacing: '-0.02em' }}>
              Today
            </Typography>
            <Box sx={{ display: 'flex' }}>
              <TodayStat icon={LoginIcon} label="Move-ins" value={stats.checkInsToday || 0} to="/tenants" tone={theme.palette.success.main} />
              <TodayStat icon={LogoutIcon} label="Move-outs" value={stats.checkOutsToday || 0} to="/tenants" tone={theme.palette.warning.main} />
              <TodayStat icon={BadgeIcon} label="Visitors" value={stats.visitorsToday || 0} to="/visitors" tone={theme.palette.info.main} />
            </Box>
          </Card>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(280px, 1fr)' },
          gap: 1.5,
          alignItems: 'stretch',
        }}
      >
        <Card sx={{ p: 2, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box>
              <Typography fontWeight={800} sx={{ fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
                Who still owes
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Highest outstanding invoices — collect these first
              </Typography>
            </Box>
            <Button size="small" component={RouterLink} to="/rent" endIcon={<ChevronRightIcon />}>
              All dues
            </Button>
          </Box>
          {dues.length === 0 ? (
            <ChartEmptyState
              height={140}
              title="No open dues"
              hint="Every invoice is collected. Nice work."
            />
          ) : (
            <Box>
              {dues.map((row) => (
                <Box
                  key={row.id}
                  component={RouterLink}
                  to="/rent"
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.9fr) auto auto',
                    gap: 1,
                    alignItems: 'center',
                    py: 1,
                    px: 0.5,
                    textDecoration: 'none',
                    color: 'inherit',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 0 },
                    '&:hover': { bgcolor: alpha(brand.navy, 0.04) },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>{row.tenantName}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {row.hostelName} · {formatMonthLabel(row.month_year)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Due {row.due_date ? dayjs(row.due_date).format('DD MMM') : '—'}
                  </Typography>
                  <StatusChip status={row.status} />
                  <Typography fontWeight={800} sx={{ color: row.status === 'overdue' ? 'error.main' : 'text.primary' }}>
                    {formatCurrency(row.amount)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Card>

        <Card sx={{ p: 1.5, minWidth: 0 }}>
          <Typography fontWeight={800} sx={{ fontSize: '1.05rem', px: 0.5, mb: 0.75, letterSpacing: '-0.02em' }}>
            Act now
          </Typography>
          <AttentionRow
            icon={PaymentsIcon}
            label="Pending rent"
            value={formatCurrency(outstanding)}
            to="/rent"
            tone={theme.palette.warning.main}
            alert={outstanding > 0}
          />
          <AttentionRow
            icon={WarningAmberIcon}
            label="Overdue tenants"
            value={stats.overdueCount || 0}
            to="/rent"
            tone={theme.palette.error.main}
            alert={Number(stats.overdueCount) > 0}
          />
          <AttentionRow
            icon={ReportProblemIcon}
            label="Open complaints"
            value={stats.complaints || 0}
            to="/complaints"
            tone={theme.palette.error.main}
            alert={Number(stats.complaints) > 0}
          />
          <AttentionRow
            icon={BuildIcon}
            label="Maintenance"
            value={stats.maintenance || 0}
            to="/maintenance"
            tone={theme.palette.warning.dark}
            alert={Number(stats.maintenance) > 0}
          />
          <AttentionRow
            icon={HotelIcon}
            label="Vacant rooms"
            value={stats.vacantRooms || 0}
            to="/rooms"
            tone={theme.palette.info.main}
            alert={Number(stats.vacantRooms) > 0}
          />
          <AttentionRow
            icon={EventAvailableIcon}
            label="Active tenants"
            value={stats.activeTenants || 0}
            to="/tenants"
            tone={brand.teal}
          />
        </Card>
      </Box>
    </Box>
  );
};

export default OwnerDashboard;
