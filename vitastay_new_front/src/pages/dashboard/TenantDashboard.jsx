import { useCallback, useEffect, useState } from 'react';
import {
  Card, CardContent, Typography, Box, Button, Stack, Divider, alpha, useTheme,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import BadgeIcon from '@mui/icons-material/Badge';
import DescriptionIcon from '@mui/icons-material/Description';
import CampaignIcon from '@mui/icons-material/Campaign';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HotelIcon from '@mui/icons-material/Hotel';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusChip from '../../components/common/StatusChip';
import api, { extractData, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import { useSnackbar } from 'notistack';
import PayRentButton from '../rent/PayRentButton';

const DetailItem = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
      {label}
    </Typography>
    {typeof value === 'string' || typeof value === 'number' ? (
      <Typography fontWeight={600} fontSize="0.95rem">{value || '—'}</Typography>
    ) : (
      value
    )}
  </Box>
);

const SectionCard = ({ title, icon: Icon, action, children, sx = {} }) => {
  const theme = useTheme();
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.palette.mode === 'dark'
            ? '0 10px 32px rgba(0,0,0,0.45)'
            : '0 10px 32px rgba(0,0,0,0.08)',
        },
        ...sx,
      }}
    >
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', flex: 1, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {Icon && (
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
            )}
            <Typography variant="h6" fontWeight={700} fontSize="1.05rem">
              {title}
            </Typography>
          </Stack>
          {action}
        </Stack>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</Box>
      </CardContent>
    </Card>
  );
};

const TenantDashboard = () => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data: res } = await api.get('/dashboard/tenant');
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
  const rentDue = data?.rentDue;
  const stats = data?.stats || {};
  const announcements = data?.announcements || [];
  const paymentHistory = data?.paymentHistory || [];
  const dueAmount = rentDue
    ? Math.max(0, parseFloat(rentDue.total_amount || 0) - parseFloat(rentDue.paid_amount || 0))
    : 0;

  return (
    <Box>
      <PageHeader
        title={`Welcome, ${profile.user?.first_name || 'Tenant'}`}
        subtitle={
          profile.hostel?.name
            ? `${profile.hostel.name}${profile.room?.room_number ? ` · Room ${profile.room.room_number}` : ''}`
            : 'Your tenant portal'
        }
      >
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button component={RouterLink} to="/rent" variant="contained" size="small" endIcon={<ArrowForwardIcon />}>
            Rent
          </Button>
          <Button component={RouterLink} to="/complaints" variant="contained" size="small" endIcon={<ArrowForwardIcon />}>
            Complaints
          </Button>
          <Button component={RouterLink} to="/visitors" variant="contained" size="small" endIcon={<ArrowForwardIcon />}>
            Visitors
          </Button>
        </Stack>
      </PageHeader>

      {/* Stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
          mb: 2,
        }}
      >
        <StatCard
          title="Rent Due"
          value={dueAmount > 0 ? formatCurrency(dueAmount) : '₹0'}
          icon={PaymentsIcon}
          color={dueAmount > 0 ? 'warning' : 'success'}
          subtitle={
            dueAmount > 0 && rentDue?.due_date
              ? `Due ${dayjs(rentDue.due_date).format('DD MMM YYYY')}`
              : 'All cleared'
          }
        />
        <StatCard title="Open Complaints" value={stats.complaints || 0} icon={ReportProblemIcon} color="error" />
        <StatCard title="Active Visitors" value={stats.visitors || 0} icon={BadgeIcon} color="info" />
        <StatCard title="Documents" value={stats.documents || 0} icon={DescriptionIcon} color="primary" />
      </Box>

      {/* Stay + Announcements — equal height */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 5fr) minmax(0, 7fr)' },
          gap: 1.5,
          mb: 2,
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <SectionCard title="Your Stay" icon={MeetingRoomIcon}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 2,
                mb: 2,
              }}
            >
              <DetailItem label="Hostel" value={profile.hostel?.name || '—'} />
              <DetailItem label="Room" value={profile.room?.room_number || '—'} />
              <DetailItem label="Bed" value={profile.bed?.bed_number || '—'} />
              <DetailItem
                label="Move-in"
                value={profile.move_in_date ? dayjs(profile.move_in_date).format('DD MMM YYYY') : '—'}
              />
              <DetailItem label="Status" value={<StatusChip status={profile.status || 'active'} />} />
              <DetailItem
                label="Monthly Rent"
                value={profile.monthly_rent != null ? formatCurrency(profile.monthly_rent) : '—'}
              />
            </Box>

            {dueAmount > 0 ? (
              <Box
                sx={{
                  mt: 'auto',
                  p: 1.75,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
                  <Box>
                    <Typography variant="caption" color="text.secondary">Outstanding</Typography>
                    <Typography fontWeight={700} color="warning.main">
                      {formatCurrency(dueAmount)}
                    </Typography>
                  </Box>
                  {rentDue?.id ? (
                    <PayRentButton
                      invoiceId={rentDue.id}
                      amount={dueAmount}
                      onPaid={() => fetchDashboard()}
                    />
                  ) : (
                    <Button component={RouterLink} to="/rent" variant="contained" color="warning" size="small">
                      View Rent
                    </Button>
                  )}
                </Stack>
              </Box>
            ) : (
              <Button
                component={RouterLink}
                to="/rent"
                variant="outlined"
                size="small"
                sx={{ mt: 'auto', alignSelf: 'flex-start' }}
                endIcon={<ArrowForwardIcon />}
              >
                Payment history
              </Button>
            )}
          </SectionCard>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <SectionCard
            title="Announcements"
            icon={CampaignIcon}
            action={
              <Button component={RouterLink} to="/notices" size="small" endIcon={<ArrowForwardIcon />}>
                All
              </Button>
            }
          >
            {announcements.length === 0 ? (
              <Box
                sx={{
                  flex: 1,
                  minHeight: 140,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  px: 2,
                  borderRadius: 2,
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
                }}
              >
                <CampaignIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary" fontWeight={500}>
                  No announcements right now
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Hostel notices will appear here
                </Typography>
              </Box>
            ) : (
              <Stack spacing={0} divider={<Divider flexItem />} sx={{ flex: 1 }}>
                {announcements.slice(0, 4).map((notice) => (
                  <Box key={notice.id} sx={{ py: 1.25 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Typography fontWeight={600} fontSize="0.9rem" sx={{ flex: 1 }}>
                        {notice.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                        {dayjs(notice.created_at || notice.createdAt).format('DD MMM')}
                      </Typography>
                    </Stack>
                    {notice.content && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {notice.content}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Box>
      </Box>

      {/* Recent payments */}
      <SectionCard
        title="Recent Payments"
        icon={PaymentsIcon}
        action={
          <Button component={RouterLink} to="/rent" size="small" endIcon={<ArrowForwardIcon />}>
            View all
          </Button>
        }
      >
        {paymentHistory.length === 0 ? (
          <Box
            sx={{
              py: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
            }}
          >
            <HotelIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary" fontWeight={500}>
              No payment history yet
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>
              Paid invoices will show up here
            </Typography>
            <Button component={RouterLink} to="/rent" size="small" variant="outlined">
              Go to Rent
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 1.5,
            }}
          >
            {paymentHistory.slice(0, 6).map((payment) => (
              <Box
                key={payment.id}
                sx={{
                  p: 1.75,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Box>
                  <Typography fontWeight={600} fontSize="0.9rem">
                    {payment.month_year}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {payment.paid_date
                      ? dayjs(payment.paid_date).format('DD MMM YYYY')
                      : `Due ${dayjs(payment.due_date).format('DD MMM YYYY')}`}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography fontWeight={700} fontSize="0.9rem">
                    {formatCurrency(payment.paid_amount || payment.total_amount)}
                  </Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'flex-end' }}>
                    <StatusChip status={payment.status} />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </SectionCard>
    </Box>
  );
};

export default TenantDashboard;
