import { useEffect, useState, useCallback } from 'react';
import {
  Box, TextField, MenuItem, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Stack, Accordion, AccordionSummary, AccordionDetails, Paper, Table,
  TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip, InputAdornment,
  Chip, Alert, CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import SearchBar from '../../components/common/SearchBar';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { ROLE_LABELS } from '../../utils/constants';
import { atmosphereFilterSx, atmosphereSelectMenuProps, atmosphereOutlinedBtnSx } from '../../styles/atmosphere';

const UsersPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [groups, setGroups] = useState([]);
  const [hostelOptions, setHostelOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [lockTarget, setLockTarget] = useState(null);
  const [revealedPasswords, setRevealedPasswords] = useState({});

  useEffect(() => {
    api.get('/super-admin/hostels', { params: { limit: 100 } })
      .then(({ data }) => {
        const { data: rows } = extractPaginated(data);
        setHostelOptions(rows.map((h) => ({ id: h.id, name: h.name, code: h.code })));
      })
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/super-admin/users-by-hostel', {
        params: {
          hostelId: hostelFilter || undefined,
          role: roleFilter || undefined,
          userSearch: search || undefined,
        },
      });
      setGroups(extractData(data) || []);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [hostelFilter, roleFilter, search, enqueueSnackbar]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openReset = (user, hostel) => {
    setResetTarget({ ...user, hostelName: hostel?.name });
    setNewPassword('');
    setShowPassword(true);
    setResetResult(null);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$';
    let pwd = 'Nv@';
    for (let i = 0; i < 6; i += 1) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewPassword(pwd);
    setShowPassword(true);
  };

  const handleResetPassword = async (autoGenerate = false) => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const payload = autoGenerate || !newPassword
        ? { generate: true }
        : { newPassword };
      const { data } = await api.post(`/super-admin/users/${resetTarget.id}/reset-password`, payload);
      const result = extractData(data);
      setResetResult(result);
      setRevealedPasswords((prev) => ({
        ...prev,
        [resetTarget.id]: result?.newPassword || newPassword,
      }));
      enqueueSnackbar('Password reset successfully — copy and share with the user', { variant: 'success' });
      setNewPassword(result?.newPassword || newPassword);
      setShowPassword(true);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar('Copied to clipboard', { variant: 'success' });
    } catch {
      enqueueSnackbar('Could not copy', { variant: 'error' });
    }
  };

  const handleLockToggle = async () => {
    if (!lockTarget) return;
    try {
      await api.patch(`/super-admin/users/${lockTarget.id}/lock`, {
        is_locked: !lockTarget.is_locked,
      });
      enqueueSnackbar(lockTarget.is_locked ? 'Account unlocked' : 'Account locked', { variant: 'success' });
      setLockTarget(null);
      fetchUsers();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  if (loading) return <LoadingSkeleton variant="table" />;

  return (
    <Box>
      <PageHeader
        title="Users & Password Reset"
        subtitle="Hostel-wise users — ID, name, password control and reset"
      >
        <Button startIcon={<RefreshIcon />} onClick={fetchUsers} variant="outlined" sx={atmosphereOutlinedBtnSx}>
          Refresh
        </Button>
      </PageHeader>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <SearchBar
          placeholder="Search by ID, name, email, phone..."
          onSearch={(v) => setSearch(v)}
          sx={{ flex: 1, minWidth: 220 }}
        />
        <TextField
          select
          size="small"
          label="Hostel"
          value={hostelFilter}
          onChange={(e) => setHostelFilter(e.target.value)}
          sx={{ minWidth: 200, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All Hostels</MenuItem>
          {hostelOptions.map((h) => (
            <MenuItem key={h.id} value={h.id}>{h.name} ({h.code})</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          sx={{ minWidth: 150, ...atmosphereFilterSx }}
          SelectProps={{ MenuProps: atmosphereSelectMenuProps }}
        >
          <MenuItem value="">All Roles</MenuItem>
          <MenuItem value="owner">Owner</MenuItem>
          <MenuItem value="supervisor">Supervisor</MenuItem>
          <MenuItem value="tenant">Tenant</MenuItem>
          <MenuItem value="staff">Staff</MenuItem>
        </TextField>
      </Box>

      {groups.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">No hostels / users found</Typography>
        </Paper>
      ) : (
        groups.map((group) => (
          <Accordion key={group.hostel.id} defaultExpanded sx={{ mb: 1.5 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 2 }} flexWrap="wrap">
                <Typography fontWeight={700}>{group.hostel.name}</Typography>
                <Chip size="small" label={group.hostel.code || '—'} variant="outlined" />
                <Typography variant="body2" color="text.secondary">{group.hostel.city}</Typography>
                <StatusChip status={group.hostel.status} />
                <Chip size="small" color="primary" label={`${group.userCount} users`} sx={{ ml: 'auto !important' }} />
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {group.users.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 2 }}>No users in this hostel</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Email / Login</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Password</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Reset</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.users.map((user) => {
                      const revealed = revealedPasswords[user.id] || '';
                      return (
                        <TableRow key={`${group.hostel.id}-${user.id}`} hover>
                          <TableCell>{user.id}</TableCell>
                          <TableCell>
                            <Typography fontWeight={600}>{user.name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography variant="body2">{user.email}</Typography>
                              <Tooltip title="Copy email">
                                <IconButton size="small" onClick={() => copyText(user.email)}>
                                  <ContentCopyIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={ROLE_LABELS[user.link_role || user.role] || user.role}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{user.phone || '—'}</TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography
                                variant="body2"
                                sx={{ fontFamily: 'monospace', letterSpacing: revealed ? 0 : 1 }}
                              >
                                {revealed || '—'}
                              </Typography>
                              {revealed && (
                                <Tooltip title="Copy password">
                                  <IconButton size="small" onClick={() => copyText(revealed)}>
                                    <ContentCopyIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <StatusChip status={user.is_locked ? 'locked' : 'active'} />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => openReset(user, group.hostel)}
                              >
                                Reset Password
                              </Button>
                              <Tooltip title={user.is_locked ? 'Unlock' : 'Lock'}>
                                <IconButton
                                  size="small"
                                  color={user.is_locked ? 'success' : 'warning'}
                                  onClick={() => setLockTarget(user)}
                                >
                                  {user.is_locked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </AccordionDetails>
          </Accordion>
        ))
      )}

      <Dialog
        open={Boolean(resetTarget)}
        onClose={() => { if (!resetting) { setResetTarget(null); setResetResult(null); } }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            User ID: <strong>{resetTarget?.id}</strong> · {resetTarget?.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {resetTarget?.email}
            {resetTarget?.hostelName ? ` · Hostel: ${resetTarget.hostelName}` : ''}
          </Typography>

          {resetResult?.newPassword && (
            <Alert severity="success" sx={{ mb: 2 }}>
              New password set. Copy it now — it is shown once and is not stored.
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{resetResult.newPassword}</Typography>
                <IconButton size="small" onClick={() => copyText(resetResult.newPassword)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Alert>
          )}

          <TextField
            fullWidth
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Min 6 characters — or auto-generate"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <Button variant="outlined" onClick={generatePassword} sx={{ mb: 1 }}>
            Generate Password
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setResetTarget(null); setResetResult(null); }} disabled={resetting}>
            Close
          </Button>
          <Button
            variant="outlined"
            disabled={resetting}
            onClick={() => handleResetPassword(true)}
          >
            {resetting ? <CircularProgress size={20} /> : 'Auto Reset'}
          </Button>
          <Button
            variant="contained"
            disabled={resetting || (!!newPassword && newPassword.length < 6)}
            onClick={() => handleResetPassword(false)}
          >
            {resetting ? <CircularProgress size={20} /> : 'Set Password'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(lockTarget)}
        title={lockTarget?.is_locked ? 'Unlock Account' : 'Lock Account'}
        message={`Are you sure you want to ${lockTarget?.is_locked ? 'unlock' : 'lock'} ${lockTarget?.email}?`}
        confirmLabel={lockTarget?.is_locked ? 'Unlock' : 'Lock'}
        severity={lockTarget?.is_locked ? 'info' : 'warning'}
        onConfirm={handleLockToggle}
        onCancel={() => setLockTarget(null)}
      />
    </Box>
  );
};

export default UsersPage;
