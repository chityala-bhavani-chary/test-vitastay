import { useEffect, useState } from 'react';
import {
  Card, CardContent, Typography, Box, FormControl, InputLabel, Select, MenuItem, alpha,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import BuildIcon from '@mui/icons-material/Build';
import BadgeIcon from '@mui/icons-material/Badge';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import DoughnutChart from '../../components/charts/DoughnutChart';
import OccupancyRing from '../../components/charts/OccupancyRing';
import ChartEmptyState from '../../components/charts/ChartEmptyState';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { useSnackbar } from 'notistack';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';
import { brand } from '../../styles/theme';

const SupervisorDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHostels = async () => {
      try {
        const { data: res } = await api.get('/hostels', { params: { limit: 100 } });
        const { data: list } = extractPaginated(res);
        setHostels(list);
        if (list.length > 0) setHostelId(String(list[0].id));
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      }
    };
    fetchHostels();
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (!hostelId) {
      setLoading(false);
      return;
    }
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const { data: res } = await api.get('/dashboard/supervisor', { params: { hostelId } });
        setData(extractData(res));
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [hostelId, enqueueSnackbar]);

  const stats = data?.stats || {};
  const rooms = data?.rooms || [];
  const occupied = rooms.filter((r) => r.status === 'occupied').reduce((sum, r) => sum + parseInt(r.count, 10), 0);
  const vacant = rooms.filter((r) => r.status === 'vacant').reduce((sum, r) => sum + parseInt(r.count, 10), 0);
  const otherRooms = rooms.filter((r) => r.status !== 'occupied' && r.status !== 'vacant');
  const roomLabels = rooms.map((r) => String(r.status || 'other').replace(/_/g, ' '));
  const roomCounts = rooms.map((r) => parseInt(r.count, 10));
  const roomColors = rooms.map((r) => {
    if (r.status === 'occupied') return brand.teal;
    if (r.status === 'vacant') return alpha(brand.navy, 0.28);
    if (r.status === 'maintenance') return '#F5A623';
    return brand.navyLight;
  });

  return (
    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <PageHeader
        title="Supervisor Dashboard"
        subtitle="Daily operations overview for your assigned hostel"
      >
        {hostels.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 200, ...atmosphereFilterSx }}>
            <InputLabel sx={{ color: 'inherit' }}>Hostel</InputLabel>
            <Select
              value={hostelId}
              label="Hostel"
              onChange={(e) => setHostelId(e.target.value)}
              MenuProps={atmosphereSelectMenuProps}
            >
              {hostels.map((h) => (
                <MenuItem key={h.id} value={String(h.id)}>{h.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </PageHeader>

      {loading ? (
        <LoadingSkeleton variant="dashboard" />
      ) : !hostelId ? (
        <Card><CardContent><Typography color="text.secondary">No hostel assigned yet.</Typography></CardContent></Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(0, 1fr)' },
            gap: 1.5,
            alignItems: 'stretch',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <StatCard title="Check-ins Today" value={stats.checkIns || 0} icon={LoginIcon} color="success" size="small" />
            <StatCard title="Check-outs Today" value={stats.checkOuts || 0} icon={LogoutIcon} color="warning" size="small" />
            <StatCard title="Pending Rent" value={stats.pendingRent || 0} icon={PaymentsIcon} color="error" size="small" />
            <StatCard title="Open Complaints" value={stats.complaints || 0} icon={ReportProblemIcon} color="error" size="small" />
            <StatCard title="Maintenance" value={stats.maintenance || 0} icon={BuildIcon} color="warning" size="small" />
            <StatCard title="Visitors Today" value={stats.visitors || 0} icon={BadgeIcon} color="info" size="small" />
            <StatCard title="Staff Present" value={stats.attendance || 0} icon={EventAvailableIcon} color="success" size="small" />
          </Box>
          <Card sx={{ minWidth: 0, p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography fontWeight={800} sx={{ fontSize: '1.05rem', mb: 1.5, letterSpacing: '-0.02em' }}>
              Room status
            </Typography>
            {roomCounts.some((n) => n > 0) ? (
              <>
                <OccupancyRing occupied={occupied} vacant={vacant} size={150} />
                {otherRooms.length > 0 && (
                  <Box sx={{ mt: 2, height: 140 }}>
                    <DoughnutChart
                      compact
                      legend
                      labels={roomLabels}
                      data={roomCounts}
                      colors={roomColors}
                    />
                  </Box>
                )}
              </>
            ) : (
              <ChartEmptyState title="No rooms yet" hint="Room statuses will show here once the hostel has rooms." />
            )}
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default SupervisorDashboard;
