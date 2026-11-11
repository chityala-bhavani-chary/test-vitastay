/**
 * BIC-029 — owner visit slots + inbox (no bed hold).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, MenuItem, TextField, Typography, alpha,
} from '@mui/material';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import api, { extractData, getErrorMessage } from '../../services/api';
import { brand } from '../../styles/theme';

const HostelVisitsPanel = ({ hostelId }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [slots, setSlots] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    starts_at: dayjs().add(1, 'day').hour(11).minute(0).second(0).format('YYYY-MM-DDTHH:mm'),
    visit_mode: 'physical',
    video_url: '',
    capacity: 1,
  });

  const load = useCallback(async () => {
    if (!hostelId) return;
    setLoading(true);
    try {
      const [slotRes, visitRes] = await Promise.all([
        api.get(`/hostels/${hostelId}/visit-slots`),
        api.get(`/hostels/${hostelId}/visits`),
      ]);
      setSlots(extractData(slotRes.data)?.items || []);
      setVisits(extractData(visitRes.data)?.items || []);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [hostelId, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const createSlot = async () => {
    try {
      await api.post(`/hostels/${hostelId}/visit-slots`, {
        starts_at: dayjs(form.starts_at).toISOString(),
        ends_at: dayjs(form.starts_at).add(1, 'hour').toISOString(),
        visit_mode: form.visit_mode,
        video_url: form.visit_mode === 'video' ? form.video_url : undefined,
        capacity: Number(form.capacity) || 1,
      });
      enqueueSnackbar('Visit slot added (does not hold a bed)', { variant: 'success' });
      load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const cancelSlot = async (slotId) => {
    try {
      await api.delete(`/hostels/${hostelId}/visit-slots/${slotId}`);
      load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const setVisitStatus = async (visitId, status) => {
    try {
      await api.patch(`/hostels/${hostelId}/visits/${visitId}`, { status });
      enqueueSnackbar(`Marked ${status.replace('_', ' ')}`, { variant: 'success' });
      load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ p: 2 }}>
        <Typography fontWeight={750} sx={{ color: brand.navy, mb: 0.5 }}>
          Visits & video tours
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Families can book a slot before paying. Scheduling a visit never holds a bed.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr 1fr auto' }, gap: 1, mb: 2 }}>
          <TextField
            size="small"
            type="datetime-local"
            label="Slot start"
            InputLabelProps={{ shrink: true }}
            value={form.starts_at}
            onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))}
          />
          <TextField
            select
            size="small"
            label="Type"
            value={form.visit_mode}
            onChange={(e) => setForm((prev) => ({ ...prev, visit_mode: e.target.value }))}
          >
            <MenuItem value="physical">Physical visit</MenuItem>
            <MenuItem value="video">Video tour</MenuItem>
          </TextField>
          {form.visit_mode === 'video' ? (
            <TextField
              size="small"
              label="Video link"
              placeholder="https://meet.google.com/…"
              value={form.video_url}
              onChange={(e) => setForm((prev) => ({ ...prev, video_url: e.target.value }))}
            />
          ) : (
            <TextField
              size="small"
              type="number"
              label="Capacity"
              value={form.capacity}
              onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
            />
          )}
          <Button variant="contained" onClick={createSlot}>Add slot</Button>
        </Box>

        {loading ? (
          <Typography variant="body2" color="text.secondary">Loading…</Typography>
        ) : (
          <>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>Open slots</Typography>
            <Box sx={{ display: 'grid', gap: 0.75, mb: 2 }}>
              {slots.filter((s) => s.status === 'open').length === 0 && (
                <Alert severity="info">No upcoming slots yet.</Alert>
              )}
              {slots.filter((s) => s.status === 'open').map((slot) => (
                <Box
                  key={slot.id}
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    alignItems: 'center',
                    p: 1,
                    borderRadius: 1.5,
                    border: `1px solid ${alpha(brand.navy, 0.1)}`,
                  }}
                >
                  <Typography fontWeight={650} sx={{ flex: 1 }}>
                    {dayjs(slot.starts_at).format('D MMM, h:mm A')}
                    {' · '}
                    {slot.visit_mode === 'video' ? 'Video' : 'Physical'}
                    {' · '}
                    {slot.remaining}/{slot.capacity} open
                  </Typography>
                  <Button size="small" color="inherit" onClick={() => cancelSlot(slot.id)}>Cancel slot</Button>
                </Box>
              ))}
            </Box>

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>Requests</Typography>
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {visits.length === 0 && (
                <Typography variant="body2" color="text.secondary">No visit requests yet.</Typography>
              )}
              {visits.slice(0, 12).map((visit) => (
                <Box
                  key={visit.id}
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    alignItems: 'center',
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: alpha(brand.navy, 0.03),
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    <Typography fontWeight={650}>
                      {visit.seeker?.name || 'Guest'}
                      {' · '}
                      {visit.starts_at ? dayjs(visit.starts_at).format('D MMM, h:mm A') : '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {visit.visit_mode}
                      {visit.seeker_note ? ` · ${visit.seeker_note}` : ''}
                    </Typography>
                  </Box>
                  <Chip size="small" label={visit.status.replace('_', ' ')} />
                  {visit.status === 'requested' && (
                    <>
                      <Button size="small" onClick={() => setVisitStatus(visit.id, 'confirmed')}>Confirm</Button>
                      <Button size="small" color="inherit" onClick={() => setVisitStatus(visit.id, 'cancelled')}>Cancel</Button>
                    </>
                  )}
                  {visit.status === 'confirmed' && (
                    <>
                      <Button size="small" onClick={() => setVisitStatus(visit.id, 'completed')}>Completed</Button>
                      <Button size="small" color="warning" onClick={() => setVisitStatus(visit.id, 'no_show')}>No-show</Button>
                    </>
                  )}
                </Box>
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HostelVisitsPanel;
