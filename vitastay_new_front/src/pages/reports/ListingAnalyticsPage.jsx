/**
 * Listing funnel (BKG-015). Owner sees their PG only. Super Admin sees all.
 * 360° open rate is the PRD success metric (target 25% of listing opens).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Chip, MenuItem, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PaymentsIcon from '@mui/icons-material/Payments';
import CancelIcon from '@mui/icons-material/Cancel';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import PeriodToolbar from '../../components/common/PeriodToolbar';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, getErrorMessage } from '../../services/api';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';
import useAuth from '../../hooks/useAuth';
import usePeriod from '../../hooks/usePeriod';

const rateLabel = (value) => (value == null ? '—' : `${value}%`);

const ListingAnalyticsPage = () => {
  const { isSuperAdmin } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { period, setPeriod, bounds } = usePeriod();
  const from = bounds.start;
  const to = bounds.end;
  const [hostelId, setHostelId] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/listing-analytics', {
      params: { from, to, hostel_id: hostelId || undefined },
    })
      .then(({ data }) => {
        if (!cancelled) setPayload(extractData(data));
      })
      .catch((err) => {
        if (!cancelled) enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [from, to, hostelId, enqueueSnackbar]);

  const totals = payload?.totals || {};
  const hostels = payload?.hostels || [];
  const target = payload?.pano_open_rate_target || 25;
  const panoRate = totals.pano_open_rate;
  const panoOk = panoRate != null && panoRate >= target;
  const selected = useMemo(
    () => (hostelId ? hostels.find((row) => String(row.hostel_id) === String(hostelId)) : null),
    [hostelId, hostels]
  );
  const focus = selected || (hostels.length === 1 ? hostels[0] : null);
  const funnel = focus || {
    views: totals.views,
    gallery_tabs: totals.gallery_tabs,
    pano_opens: totals.pano_opens,
    bookings_started: totals.bookings_started,
    paid: totals.paid,
    cancelled: totals.cancelled,
    view_sessions: totals.view_sessions,
    pano_sessions: totals.pano_sessions,
    gallery_sessions: totals.gallery_sessions,
    pano_open_rate: totals.pano_open_rate,
    gallery_interact_rate: totals.gallery_interact_rate,
    conversion_view_to_started: totals.conversion_view_to_started,
    conversion_started_to_paid: totals.conversion_started_to_paid,
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      <PageHeader
        title="Listing stats"
        subtitle={isSuperAdmin
          ? 'Guest funnel across published PGs. No emails, IPs, or guest names are stored.'
          : 'How guests move from your listing to a paid request. Occupancy reports stay on Reports.'}
      />

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        {hostels.length > 1 && (
          <TextField
            select
            size="small"
            label="PG"
            value={hostelId}
            onChange={(event) => setHostelId(event.target.value)}
            sx={{ minWidth: 220, ...atmosphereFilterSx }}
            SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
          >
            <MenuItem value="">All PGs</MenuItem>
            {hostels.map((row) => (
              <MenuItem key={row.hostel_id} value={row.hostel_id}>{row.name}</MenuItem>
            ))}
          </TextField>
        )}
        <PeriodToolbar value={period} onChange={setPeriod} />
      </Box>

      {loading ? (
        <LoadingSkeleton variant="dashboard" />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
              gap: 1,
              mb: 1.5,
            }}
          >
            <StatCard title="Listing views" value={funnel.views || 0} subtitle={`${funnel.view_sessions || 0} sessions`} icon={VisibilityIcon} color="primary" size="small" />
            <StatCard title="Gallery tabs" value={funnel.gallery_tabs || 0} subtitle={`${rateLabel(funnel.gallery_interact_rate)} of views`} icon={PhotoCameraIcon} color="info" size="small" />
            <StatCard title="360° opens" value={funnel.pano_opens || 0} subtitle={`${rateLabel(funnel.pano_open_rate)} of views`} icon={ThreeSixtyIcon} color="secondary" size="small" />
            <StatCard title="Requests" value={funnel.bookings_started || 0} subtitle={`${rateLabel(funnel.conversion_view_to_started)} of views`} icon={EventNoteIcon} color="primary" size="small" />
            <StatCard title="Paid" value={funnel.paid || 0} subtitle={`${rateLabel(funnel.conversion_started_to_paid)} of requests`} icon={PaymentsIcon} color="success" size="small" />
            <StatCard title="Cancelled" value={funnel.cancelled || 0} icon={CancelIcon} color="warning" size="small" />
          </Box>

          <Card sx={{ mb: 1.5 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Typography fontWeight={700}>360° open rate</Typography>
                <Chip
                  size="small"
                  color={panoOk ? 'success' : 'warning'}
                  label={`${rateLabel(funnel.pano_open_rate)} of listing opens`}
                />
                <Typography variant="body2" color="text.secondary">
                  PRD target {target}% of listing opens.
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Unique sessions that opened a 360 vs unique sessions that opened the listing. Tabs besides All count as gallery interaction. Booking pay still does not occupy a bed.
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Funnel by PG</Typography>
              {hostels.length === 0 ? (
                <Typography color="text.secondary">No hostels in this account.</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>PG</TableCell>
                      <TableCell align="right">Views</TableCell>
                      <TableCell align="right">Gallery</TableCell>
                      <TableCell align="right">360°</TableCell>
                      <TableCell align="right">360 rate</TableCell>
                      <TableCell align="right">Requests</TableCell>
                      <TableCell align="right">Paid</TableCell>
                      <TableCell align="right">Cancelled</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {hostels.map((row) => (
                      <TableRow key={row.hostel_id} hover>
                        <TableCell>{row.name}</TableCell>
                        <TableCell align="right">{row.views}</TableCell>
                        <TableCell align="right">{row.gallery_tabs}</TableCell>
                        <TableCell align="right">{row.pano_opens}</TableCell>
                        <TableCell align="right">{rateLabel(row.pano_open_rate)}</TableCell>
                        <TableCell align="right">{row.bookings_started}</TableCell>
                        <TableCell align="right">{row.paid}</TableCell>
                        <TableCell align="right">{row.cancelled}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default ListingAnalyticsPage;
