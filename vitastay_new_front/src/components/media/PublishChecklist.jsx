/**
 * Publish checklist (PRD §6.6). Red/green counts; Super Admin override.
 * variant="manager" hides category jump buttons (tabs are on the Media page).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, LinearProgress, TextField, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import api, { extractData, getErrorMessage } from '../../services/api';
import { getMediaUrl } from '../../utils/constants';
import useAuth from '../../hooks/useAuth';

const RULES = [
  { key: 'exterior', label: 'Outside' },
  { key: 'interior_common', label: 'Inside PG' },
  { key: 'room', label: 'Rooms' },
  { key: 'floor', label: 'Floors' },
  { key: 'panorama_360', label: '360°' },
  { key: 'cover', label: 'Cover' },
];

const fraction = (row) => {
  if (!row) return '0/0';
  if (row.recommended != null && (row.required == null || row.required === 0)) {
    return `${row.count || 0}/${row.recommended}`;
  }
  if (row.required != null) return `${row.count || 0}/${row.required}`;
  if (row.required_per_listed_room != null) {
    const types = Object.values(row.by_type || {});
    if (!types.length) return 'ok';
    return `${types.filter((item) => item.ok).length}/${types.length}`;
  }
  if (row.required_floors != null) return `${row.count || 0}/${row.required_floors}`;
  return String(row.count ?? 0);
};

const chipColor = (ruleKey, row) => {
  if (row?.ok) return 'success';
  if (ruleKey === 'panorama_360' || row?.blocking === false) return 'warning';
  return 'error';
};

const RULE_HREF = {
  exterior: (hostelId) => `/hostels/${hostelId}/media`,
  interior_common: (hostelId) => `/hostels/${hostelId}/media?tab=inside`,
  room: (hostelId) => `/hostels/${hostelId}/media?tab=rooms`,
  floor: (hostelId) => `/hostels/${hostelId}/media?tab=floors`,
  panorama_360: (hostelId) => `/hostels/${hostelId}/media?tab=360`,
  cover: (hostelId) => `/hostels/${hostelId}/media`,
};

const PublishChecklist = ({ hostelId, reloadToken, variant = 'hostel' }) => {
  const { enqueueSnackbar } = useSnackbar();
  const { isOwner, isSuperAdmin } = useAuth();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [moderateOpen, setModerateOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [moderateReason, setModerateReason] = useState('');

  const load = useCallback(async () => {
    if (!hostelId) return;
    try {
      const { data } = await api.get(`/hostels/${hostelId}/media/checklist`);
      setPack(extractData(data));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [hostelId, enqueueSnackbar]);

  useEffect(() => { load(); }, [load, reloadToken]);

  const post = async (url, body) => {
    setSaving(true);
    try {
      const { data } = await api.post(url, body || {});
      setPack(extractData(data));
      enqueueSnackbar(data.message || 'Updated', { variant: 'success' });
      setOverrideOpen(false);
      setModerateOpen(false);
      setReason('');
      setModerateReason('');
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !pack) return null;

  const okCount = RULES.filter((rule) => pack[rule.key]?.ok).length;
  const marketplace = pack.listing_publish !== false && pack.marketplace_ok !== false;
  const canPublish = Boolean(pack.can_publish) && marketplace;
  const published = Boolean(pack.listing_published);
  const hostelActive = pack.hostel_status === 'active';

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Box>
            <Typography fontWeight={750}>Publish checklist</Typography>
            <Typography variant="caption" color="text.secondary">
              {okCount}/{RULES.length} complete
              {published && marketplace ? ' · listing is live for seekers' : ' · listing is hidden from seekers'}
              {' — not the same as hostel Active'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {variant !== 'manager' && (
              <>
                <Button size="small" component={RouterLink} to={`/hostels/${hostelId}/media`} variant="outlined">
                  Photos
                </Button>
                {marketplace && (
                  <Button size="small" component={RouterLink} to={`/hostels/${hostelId}/listing`} variant="outlined">
                    Preview listing
                  </Button>
                )}
              </>
            )}
            {marketplace && published && isOwner && (
              <Button
                size="small"
                variant="outlined"
                disabled={saving}
                onClick={() => post(`/hostels/${hostelId}/listing/unpublish`)}
              >
                Unpublish
              </Button>
            )}
            {marketplace && published && isSuperAdmin && (
              <Button size="small" color="warning" variant="outlined" disabled={saving} onClick={() => setModerateOpen(true)}>
                Unpublish listing
              </Button>
            )}
            {marketplace && !published && (isOwner || isSuperAdmin) && (
              <Button
                size="small"
                variant="contained"
                disabled={saving || !canPublish || !hostelActive}
                onClick={() => post(`/hostels/${hostelId}/listing/publish`)}
              >
                Publish listing
              </Button>
            )}
            {marketplace && isSuperAdmin && !pack.minima_ok && (
              <Button size="small" color="warning" variant="outlined" disabled={saving || !hostelActive} onClick={() => setOverrideOpen(true)}>
                Override & publish
              </Button>
            )}
          </Box>
        </Box>

        <LinearProgress
          variant="determinate"
          value={Math.round((okCount / RULES.length) * 100)}
          sx={{ mb: 1.25, height: 8, borderRadius: 1 }}
          color={pack.minima_ok ? 'success' : 'warning'}
        />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {RULES.map((rule) => {
            const row = pack[rule.key] || {};
            const href = RULE_HREF[rule.key]?.(hostelId);
            const thumb = rule.key === 'cover' ? row.item?.thumb_url : null;
            const color = chipColor(rule.key, row);
            const label = rule.key === 'panorama_360' && !row.ok
              ? `${rule.label} ${fraction(row)} · recommended`
              : `${rule.label} ${fraction(row)}`;
            return (
              <Chip
                key={rule.key}
                size="small"
                label={label}
                color={color}
                variant={row.ok ? 'filled' : 'outlined'}
                avatar={thumb ? <Avatar src={getMediaUrl(thumb)} alt="" /> : undefined}
                {...(href ? { component: RouterLink, to: href, clickable: true } : {})}
              />
            );
          })}
        </Box>

        {!marketplace && (
          <Alert severity="info" sx={{ mt: 1.25 }}>
            This PG is management-only. Guests cannot find it online. Upgrade to Silver to publish a listing and take bookings.
          </Alert>
        )}

        {marketplace && !hostelActive && (
          <Alert severity="info" sx={{ mt: 1.25 }}>
            Hostel status is {String(pack.hostel_status || 'unknown').replace(/_/g, ' ')}. Publish is blocked until the hostel is Active. That is operations, not the seeker listing.
          </Alert>
        )}

        {pack.override?.reason && (
          <Alert severity="warning" sx={{ mt: 1.25 }}>
            Published with Super Admin override: {pack.override.reason}
          </Alert>
        )}

        {pack.listing_unpublish_reason && !published && (
          <Alert severity="info" sx={{ mt: 1.25 }}>
            Last unpublish: {pack.listing_unpublish_reason}
          </Alert>
        )}

        {!pack.minima_ok && (pack.missing || []).length > 0 && (
          <Box sx={{ mt: 1 }}>
            {(pack.missing || []).map((row) => (
              <Typography key={`${row.code}-${row.room_type || row.floor_number || ''}`} variant="caption" color="error" display="block">
                {row.message}
              </Typography>
            ))}
          </Box>
        )}

        {(pack.recommended || []).length > 0 && (
          <Box sx={{ mt: 1 }}>
            {(pack.recommended || []).map((row) => (
              <Typography key={`rec-${row.code}`} variant="caption" color="warning.dark" display="block">
                {row.message}
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>

      <Dialog open={overrideOpen} onClose={() => setOverrideOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Override photo minima</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Use for onboarding when outside/inside/room/floor/cover minima are incomplete. 360° is recommended, not required to publish. The reason is audited. Seekers still see whatever photos exist.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={saving || reason.trim().length < 10}
            onClick={() => post(`/hostels/${hostelId}/media/override`, { reason: reason.trim() })}
          >
            Publish with override
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moderateOpen} onClose={() => setModerateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Unpublish listing (moderation)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Seekers will lose this page and search card. Hostel Active / On hold stays as it is. The reason is audited.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Reason"
            value={moderateReason}
            onChange={(event) => setModerateReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModerateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={saving || moderateReason.trim().length < 10}
            onClick={() => post(`/super-admin/hostels/${hostelId}/listing/unpublish`, { reason: moderateReason.trim() })}
          >
            Unpublish listing
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default PublishChecklist;
