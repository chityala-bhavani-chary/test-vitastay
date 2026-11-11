/**
 * PKG-010 gallery + PKG-011 gate capture + PKG-012 DPDP export/erase + PKG-014 playbook.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  FormControlLabel, MenuItem, TextField, Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { getMediaUrl } from '../../utils/constants';
import useAuth from '../../hooks/useAuth';

const HostelVitaEyePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isOwner, isSuperAdmin, isSupervisor } = useAuth();
  const [hostel, setHostel] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(null);
  const [residents, setResidents] = useState([]);
  const [staffRows, setStaffRows] = useState([]);
  const [personType, setPersonType] = useState('resident');
  const [personId, setPersonId] = useState('');
  const [consent, setConsent] = useState(false);
  const [still, setStill] = useState(null);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [gateStill, setGateStill] = useState(null);
  const [gateName, setGateName] = useState('gate');
  const [capturing, setCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState(null);
  const [watchStill, setWatchStill] = useState(null);
  const [watchReason, setWatchReason] = useState('');
  const [watchLabel, setWatchLabel] = useState('');
  const [savingWatch, setSavingWatch] = useState(false);
  const [acking, setAcking] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [erasing, setErasing] = useState(false);

  const load = useCallback(async () => {
    const eyeRes = await api.get(`/hostels/${id}/vita-eye`);
    const eye = extractData(eyeRes);
    setStatus(eye);
    try {
      const hostelRes = await api.get(`/hostels/${id}`);
      setHostel(extractData(hostelRes));
    } catch {
      setHostel({ id, name: eye?.name, code: eye?.code });
    }
    try {
      const tenantsRes = await api.get('/tenants', { params: { hostelId: id, limit: 200 } });
      const { data: tenants } = extractPaginated(tenantsRes);
      setResidents((tenants || []).filter((row) => row.status !== 'moved_out'));
    } catch {
      setResidents([]);
    }
    try {
      const staffRes = await api.get('/staff', { params: { hostelId: id, limit: 200 } });
      const { data: staff } = extractPaginated(staffRes);
      setStaffRows(staff || []);
    } catch {
      setStaffRows([]);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await load();
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 403) {
          setDenied(getErrorMessage(err));
          try {
            const { data } = await api.get(`/hostels/${id}`);
            setHostel(extractData(data));
          } catch {
            navigate('/hostels');
          }
        } else {
          enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
          navigate('/hostels');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [id, enqueueSnackbar, navigate, load]);

  const people = personType === 'staff' ? staffRows : residents;
  const personLabel = (row) => {
    if (personType === 'staff') {
      return [row.user?.first_name, row.user?.last_name].filter(Boolean).join(' ')
        || row.employee_id
        || `Staff ${row.id}`;
    }
    return row.full_name || `Resident ${row.id}`;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!consent || !personId || !still) return;
    setSaving(true);
    try {
      const body = new FormData();
      body.append('person_type', personType);
      body.append('person_id', personId);
      body.append('consent', 'true');
      body.append('still', still);
      await api.post(`/hostels/${id}/vita-eye/enroll`, body);
      enqueueSnackbar('Face enrolled for this PG', { variant: 'success' });
      setStill(null);
      setConsent(false);
      setPersonId('');
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const capture = async (event) => {
    event.preventDefault();
    if (!gateStill) return;
    setCapturing(true);
    try {
      const body = new FormData();
      body.append('still', gateStill);
      body.append('gate', gateName || 'gate');
      const res = await api.post(`/hostels/${id}/vita-eye/capture`, body);
      const data = extractData(res);
      setLastCapture(data);
      setGateStill(null);
      enqueueSnackbar(data.label_text || 'Captured', {
        variant: data.label === 'blocked' || data.label === 'unknown' ? 'warning' : 'success',
      });
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setCapturing(false);
    }
  };

  const addBlocked = async (event) => {
    event.preventDefault();
    if (!watchStill || String(watchReason).trim().length < 3) return;
    setSavingWatch(true);
    try {
      const body = new FormData();
      body.append('still', watchStill);
      body.append('reason', watchReason);
      if (watchLabel) body.append('label', watchLabel);
      await api.post(`/hostels/${id}/vita-eye/watchlist`, body);
      enqueueSnackbar('Added to blocked list', { variant: 'success' });
      setWatchStill(null);
      setWatchReason('');
      setWatchLabel('');
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSavingWatch(false);
    }
  };

  const ackEvent = async (eventId) => {
    setAcking(eventId);
    try {
      await api.post(`/hostels/${id}/vita-eye/events/${eventId}/ack`, { note: 'not a match' });
      enqueueSnackbar('Marked not a match', { variant: 'info' });
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setAcking(null);
    }
  };

  const exportRecords = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/hostels/${id}/vita-eye/export`);
      const data = extractData(res);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `vita-eye-${hostel?.code || id}.json`;
      link.click();
      URL.revokeObjectURL(href);
      enqueueSnackbar('Export downloaded (no embeddings)', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const eraseAll = async () => {
    const ok = window.confirm(
      'Erase all Vita Eye faces for this PG? Enrolments, the blocked list, and gate stills will be deleted. This cannot be undone.'
    );
    if (!ok) return;
    setErasing(true);
    try {
      await api.post(`/hostels/${id}/vita-eye/erase`, { confirm: true });
      enqueueSnackbar('Vita Eye records erased for this PG', { variant: 'info' });
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setErasing(false);
    }
  };

  const revoke = async (enrollmentId) => {
    setRevoking(enrollmentId);
    try {
      await api.delete(`/hostels/${id}/vita-eye/enrollments/${enrollmentId}`);
      enqueueSnackbar('Enrolment removed', { variant: 'info' });
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setRevoking(null);
    }
  };

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  const enrollments = status?.enrollments || [];
  const watchlist = status?.watchlist || [];
  const events = status?.events || [];
  const eventColor = (label) => {
    if (label === 'blocked') return 'error';
    if (label === 'unknown') return 'warning';
    return 'success';
  };

  return (
    <Box>
      <PageHeader
        dense
        title={hostel?.name || 'Vita Eye'}
        subtitle="Gold gate security"
        breadcrumbs={[
          { label: 'Hostels', path: '/hostels' },
          { label: hostel?.name || 'Hostel', path: `/hostels/${id}` },
          { label: 'Vita Eye' },
        ]}
      >
        <Button component={RouterLink} to={`/hostels/${id}`} variant="outlined">
          Back to hostel
        </Button>
      </PageHeader>

      {denied ? (
        <Alert severity="info">{denied}</Alert>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            Enrol known faces, then capture a gate still. Unknown and blocked ping owner and staff.
            Doors are not locked. Embeddings are not sold. Do not upload KYC.
          </Alert>

          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography fontWeight={750} sx={{ mb: 0.5 }}>
                {status?.playbook?.title || 'Turn on Vita Eye'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {status?.playbook?.body
                  || 'Included in Gold. Enrol residents, add a blocked list, test one capture, then confirm the notification arrived.'}
              </Typography>
              {(status?.playbook?.checklist?.steps || []).map((step) => (
                <Box
                  key={step.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    py: 0.75,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Chip
                    size="small"
                    color={step.done ? 'success' : 'default'}
                    label={step.done ? 'Done' : (step.recommended ? 'Recommended' : 'To do')}
                    sx={{ mt: 0.15 }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={650}>{step.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{step.detail}</Typography>
                    {step.id === 'confirm_notify' && !step.done && (
                      <Button
                        component={RouterLink}
                        to="/notifications"
                        size="small"
                        sx={{ mt: 0.5, px: 0 }}
                      >
                        Open Notifications
                      </Button>
                    )}
                  </Box>
                </Box>
              ))}
              {status?.playbook?.checklist?.stale ? (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  Last capture is older than {status?.playbook?.checklist?.stale_hours || 24} hours.
                  Super Admin sees this as last-capture-too-old. Capture a still now.
                </Alert>
              ) : status?.playbook?.checklist?.ready ? (
                <Alert severity="success" sx={{ mt: 1.5 }}>
                  Vita Eye is ready. Keep capturing so last-capture-too-old does not appear on Super Admin support.
                </Alert>
              ) : (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  Finish enrol, a test capture, and a notification. A camera that silently fails makes Gold feel broken.
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography fontWeight={750} sx={{ mb: 1 }}>Enrol a face</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {status?.consent_copy}
              </Typography>
              <Box component="form" onSubmit={submit} sx={{ display: 'grid', gap: 1.5, maxWidth: 520 }}>
                <TextField
                  select
                  size="small"
                  label="Person type"
                  value={personType}
                  onChange={(event) => {
                    setPersonType(event.target.value);
                    setPersonId('');
                  }}
                >
                  <MenuItem value="resident">Resident</MenuItem>
                  <MenuItem value="staff">Staff</MenuItem>
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Person"
                  value={personId}
                  onChange={(event) => setPersonId(event.target.value)}
                >
                  <MenuItem value="">Select</MenuItem>
                  {people.map((row) => (
                    <MenuItem key={row.id} value={String(row.id)}>{personLabel(row)}</MenuItem>
                  ))}
                </TextField>
                <Button variant="outlined" component="label">
                  {still ? still.name : 'Choose still (JPEG / PNG / WebP)'}
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setStill(event.target.files?.[0] || null)}
                  />
                </Button>
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                    />
                  )}
                  label="I have this person’s consent for gate security at this PG only"
                />
                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saving || !consent || !personId || !still}
                  >
                    {saving ? <CircularProgress size={22} /> : 'Enrol'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Typography fontWeight={750}>Gallery</Typography>
                <Chip size="small" label={`${status?.enrolled_count || 0} enrolled`} />
              </Box>
              {enrollments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No faces enrolled yet. Vita Eye cannot match at the gate until this gallery has people.
                </Typography>
              ) : (
                enrollments.map((row) => (
                  <Box
                    key={row.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {row.still_url ? (
                      <Box
                        component="img"
                        src={getMediaUrl(row.still_url)}
                        alt=""
                        sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1, bgcolor: 'action.hover' }}
                      />
                    ) : (
                      <Box sx={{ width: 48, height: 48, borderRadius: 1, bgcolor: 'action.hover' }} />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={650} noWrap>
                        {row.person_name || `${row.person_type} #${row.person_id}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {String(row.person_type || '').toUpperCase()}
                        {row.consent_at ? ` · consent ${String(row.consent_at).slice(0, 10)}` : ''}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      disabled={revoking === row.id}
                      onClick={() => revoke(row.id)}
                    >
                      Remove
                    </Button>
                  </Box>
                ))
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Embeddings stay on this PG. Match threshold {status?.threshold ?? 0.85}.
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography fontWeight={750} sx={{ mb: 1 }}>Gate capture</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Phone or tablet still. Owner and staff get a notice. Doors stay unlocked.
              </Typography>
              <Box component="form" onSubmit={capture} sx={{ display: 'grid', gap: 1.5, maxWidth: 520 }}>
                <TextField
                  size="small"
                  label="Gate"
                  value={gateName}
                  onChange={(event) => setGateName(event.target.value)}
                />
                <Button variant="outlined" component="label">
                  {gateStill ? gateStill.name : 'Choose gate still'}
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    capture="environment"
                    onChange={(event) => setGateStill(event.target.files?.[0] || null)}
                  />
                </Button>
                <Box>
                  <Button type="submit" variant="contained" disabled={capturing || !gateStill}>
                    {capturing ? <CircularProgress size={22} /> : 'Capture'}
                  </Button>
                </Box>
                {lastCapture && (
                  <Chip
                    color={eventColor(lastCapture.label)}
                    label={`${lastCapture.label_text} · ${Number(lastCapture.confidence || 0).toFixed(2)} · ${lastCapture.elapsed_ms || 0} ms`}
                  />
                )}
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography fontWeight={750} sx={{ mb: 1 }}>Blocked list</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                People who must not enter this PG. Not a public criminal database.
              </Typography>
              <Box component="form" onSubmit={addBlocked} sx={{ display: 'grid', gap: 1.5, maxWidth: 520, mb: 2 }}>
                <TextField
                  size="small"
                  label="Label (optional)"
                  value={watchLabel}
                  onChange={(event) => setWatchLabel(event.target.value)}
                />
                <TextField
                  size="small"
                  label="Reason"
                  value={watchReason}
                  onChange={(event) => setWatchReason(event.target.value)}
                />
                <Button variant="outlined" component="label">
                  {watchStill ? watchStill.name : 'Choose still'}
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setWatchStill(event.target.files?.[0] || null)}
                  />
                </Button>
                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={savingWatch || !watchStill || String(watchReason).trim().length < 3}
                  >
                    {savingWatch ? <CircularProgress size={22} /> : 'Add blocked'}
                  </Button>
                </Box>
              </Box>
              {watchlist.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No blocked faces yet.</Typography>
              ) : watchlist.map((row) => (
                <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  {row.still_url ? (
                    <Box component="img" src={getMediaUrl(row.still_url)} alt="" sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1 }} />
                  ) : null}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={650} noWrap>{row.label || 'Blocked'}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.reason}</Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={async () => {
                      try {
                        await api.delete(`/hostels/${id}/vita-eye/watchlist/${row.id}`);
                        await load();
                      } catch (err) {
                        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
                      }
                    }}
                  >
                    Remove
                  </Button>
                </Box>
              ))}
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography fontWeight={750} sx={{ mb: 1 }}>Gate events</Typography>
              {events.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No captures yet.</Typography>
              ) : events.map((row) => (
                <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  {row.still_url ? (
                    <Box component="img" src={getMediaUrl(row.still_url)} alt="" sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1 }} />
                  ) : null}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Chip size="small" color={eventColor(row.label)} label={row.label_text} sx={{ mr: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      {row.gate} · {Number(row.confidence || 0).toFixed(2)}
                      {row.acked_at ? ' · not a match' : ''}
                    </Typography>
                  </Box>
                  {!row.acked_at && (
                    <Button size="small" disabled={acking === row.id} onClick={() => ackEvent(row.id)}>
                      Not a match
                    </Button>
                  )}
                </Box>
              ))}
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography fontWeight={750} sx={{ mb: 1 }}>Privacy</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {status?.privacy?.text
                  || 'Gate security at this PG only. Unknown stills about 30 days. Enrolled faces last for the stay. Embeddings are not sold.'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Button component={RouterLink} to="/legal/vita-eye" variant="outlined">
                  Privacy policy
                </Button>
                {(isOwner || isSuperAdmin || isSupervisor) && (
                  <Button variant="outlined" disabled={exporting} onClick={exportRecords}>
                    {exporting ? <CircularProgress size={22} /> : 'Export records'}
                  </Button>
                )}
                {(isOwner || isSuperAdmin) && (
                  <Button color="error" variant="outlined" disabled={erasing} onClick={eraseAll}>
                    {erasing ? <CircularProgress size={22} /> : 'Erase this PG'}
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default HostelVitaEyePage;
