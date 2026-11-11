import { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Stack, Button, Divider, alpha, useTheme,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import BuildIcon from '@mui/icons-material/Build';
import CampaignIcon from '@mui/icons-material/Campaign';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusChip from '../../components/common/StatusChip';
import api, { extractData, getErrorMessage } from '../../services/api';
import { useSnackbar } from 'notistack';
import useAuth from '../../hooks/useAuth';

const JobRow = ({ title, meta, status, to }) => {
  const theme = useTheme();
  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        py: 1.25,
        px: 0.25,
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 1,
        minHeight: 48,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={600} fontSize="0.95rem" noWrap>{title}</Typography>
        {meta && (
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {meta}
          </Typography>
        )}
      </Box>
      {status ? <StatusChip status={status} /> : null}
    </Box>
  );
};

const JobCard = ({ title, icon: Icon, actionTo, actionLabel, empty, children }) => (
  <Card sx={{ mb: 2 }}>
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
              color: 'primary.main',
            }}
          >
            <Icon fontSize="small" />
          </Box>
          <Typography variant="h6" fontWeight={700} fontSize="1.05rem">{title}</Typography>
        </Stack>
        <Button
          component={RouterLink}
          to={actionTo}
          size="small"
          endIcon={<ArrowForwardIcon />}
          sx={{ textTransform: 'none' }}
        >
          {actionLabel}
        </Button>
      </Stack>
      {empty ? (
        <Typography color="text.secondary" variant="body2">{empty}</Typography>
      ) : (
        <Box>
          <Divider sx={{ mb: 0.5 }} />
          {children}
        </Box>
      )}
    </CardContent>
  </Card>
);

const StaffDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data: res } = await api.get('/dashboard/staff');
      setData(extractData(res));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  const profile = data?.profile || {};
  const firstName = profile.user?.first_name || user?.first_name || 'there';
  const hostelName = profile.hostel?.name || user?.staff?.hostel?.name || '';
  const role = profile.staff?.staff_role?.replace(/_/g, ' ') || 'staff';
  const complaints = data?.complaints || [];
  const maintenance = data?.maintenance || [];
  const notices = data?.notices || [];

  return (
    <Box sx={{ width: '100%', maxWidth: { xs: '100%', md: 720 }, mx: 'auto', minWidth: 0 }}>
      <PageHeader
        title={`Hi, ${firstName}`}
        subtitle={hostelName ? `${hostelName} · ${role}` : 'Your jobs for today'}
        dense
      />

      <JobCard
        title="Assigned complaints"
        icon={ReportProblemIcon}
        actionTo="/complaints"
        actionLabel="All"
        empty={complaints.length ? null : 'No open complaints assigned to you.'}
      >
        {complaints.map((row) => (
          <JobRow
            key={row.id}
            to="/complaints"
            title={row.title}
            status={row.status}
            meta={[row.room?.room_number ? `Room ${row.room.room_number}` : null, row.hostel?.name]
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
      </JobCard>

      <JobCard
        title="Today's maintenance"
        icon={BuildIcon}
        actionTo="/maintenance"
        actionLabel="All"
        empty={maintenance.length ? null : 'No maintenance due today.'}
      >
        {maintenance.map((row) => (
          <JobRow
            key={row.id}
            to="/maintenance"
            title={row.title}
            status={row.status}
            meta={[
              row.scheduled_date ? dayjs(row.scheduled_date).format('DD MMM') : 'Unscheduled',
              row.room?.room_number ? `Room ${row.room.room_number}` : null,
            ].filter(Boolean).join(' · ')}
          />
        ))}
      </JobCard>

      <JobCard
        title="Notices"
        icon={CampaignIcon}
        actionTo="/notices"
        actionLabel="All"
        empty={notices.length ? null : 'No notices for your hostel.'}
      >
        {notices.map((row) => (
          <JobRow
            key={row.id}
            to="/notices"
            title={row.title}
            meta={dayjs(row.created_at).format('DD MMM YYYY')}
          />
        ))}
      </JobCard>
    </Box>
  );
};

export default StaffDashboard;
