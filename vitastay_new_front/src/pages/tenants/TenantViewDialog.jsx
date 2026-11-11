import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Grid, IconButton, Link, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import { useSnackbar } from 'notistack';
import StatusChip from '../../components/common/StatusChip';
import api, { extractData, getErrorMessage } from '../../services/api';
import { displayEmail, formatCurrency, getMediaUrl } from '../../utils/constants';
import { personPhotoSrc } from '../../utils/demoImages';
import { printRentInvoice, viewRentInvoice } from '../../utils/printRentInvoice';

const METHOD_LABELS = {
  cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank Transfer', online: 'Online',
};
const ID_LABELS = {
  aadhar: 'Aadhaar Card', pan: 'PAN Card', passport: 'Passport', driving_license: 'Driving License', voter_id: 'Voter ID',
};

const fmtDate = (value) => (value ? dayjs(value).format('DD MMM YYYY') : '—');
const capitalize = (value) => (value ? String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');

const scopeParams = (row) => ({ hostelId: row?.hostel_id || row?.hostel?.id, source: row?.source });

const Field = ({ label, value, xs = 12, sm = 6, md = 4 }) => (
  <Grid item xs={xs} sm={sm} md={md}>
    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
      {value || value === 0 ? value : '—'}
    </Typography>
  </Grid>
);

const Block = ({ title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1.5 }}>{title}</Typography>
    <Grid container spacing={2}>{children}</Grid>
  </Box>
);

const SummaryCard = ({ label, value, color }) => (
  <Paper variant="outlined" sx={{ p: 1.5, flex: 1, minWidth: 130 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h6" fontWeight={700} color={color}>{formatCurrency(value)}</Typography>
  </Paper>
);

const TenantViewDialog = ({ tenant, onClose, onEdit, onCheckedIn }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState('details');
  const [details, setDetails] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setTab('details');
    setDetails(null);
    setHistory(null);
    setLoading(true);
    const params = scopeParams(tenant);
    Promise.all([
      api.get(`/tenants/${tenant.id}`, { params }),
      api.get(`/tenants/${tenant.id}/payments`, { params }),
    ])
      .then(([detailRes, paymentRes]) => {
        setDetails(extractData(detailRes.data));
        setHistory(extractData(paymentRes.data));
      })
      .catch((err) => {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
        onClose();
      })
      .finally(() => setLoading(false));
  }, [tenant, enqueueSnackbar, onClose]);

  const name = details?.full_name?.trim()
    || `${details?.user?.first_name || ''} ${details?.user?.last_name || ''}`.trim()
    || tenant?.full_name
    || '—';
  const roomLabel = details?.room?.room_number
    ? `Room ${details.room.room_number}${details?.bed?.bed_number ? ` · Bed ${details.bed.bed_number}` : ''}`
    : 'No bed allocated';
  const isBranch = tenant?.source === 'branch';

  const invoicePayload = (payment) => ({
    ...payment,
    bill_title: payment.is_registration ? 'Registration Bill' : 'Rent Invoice',
    tenant: { user: details?.user },
    hostel: history?.hostel || details?.hostel,
    bed_number: payment.is_registration && payment.room_id === details?.room_id ? details?.bed?.bed_number : null,
  });

  const modeLabel = (payment) => {
    if (payment.splits?.length > 1) return payment.splits.map((s) => `${METHOD_LABELS[s.method] || s.method} ${formatCurrency(s.amount)}`).join(' + ');
    if (Number(payment.paid_amount) > 0) return METHOD_LABELS[payment.payment_method] || capitalize(payment.payment_method);
    return '—';
  };

  const checkIn = async () => {
    if (!details?.id) return;
    setCheckingIn(true);
    try {
      const { data } = await api.post(`/tenants/${details.id}/check-in`, {
        hostel_id: details.hostel_id || details.hostel?.id || tenant?.hostel_id || tenant?.hostel?.id,
      }, { params: scopeParams(tenant) });
      const updated = extractData(data);
      setDetails((current) => ({ ...current, ...updated, status: 'active' }));
      enqueueSnackbar('Resident checked in', { variant: 'success' });
      onCheckedIn?.(updated);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <Dialog open={Boolean(tenant)} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, minHeight: '70vh' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={personPhotoSrc(details?.photo || details?.user?.avatar, details?.id || tenant?.id)} sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
            {name.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h6" fontWeight={700} noWrap>{name}</Typography>
              {details?.status && <StatusChip status={details.status} />}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {[details?.hostel?.name || tenant?.hostel?.name, details ? roomLabel : null, details?.user?.phone].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1.5, minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}>
          <Tab value="details" label="Details" />
          <Tab
            value="payments"
            label={(
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Payment History</span>
                {history?.payments?.length > 0 && <Chip size="small" label={history.payments.length} sx={{ height: 20, fontSize: 11 }} />}
              </Stack>
            )}
          />
        </Tabs>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        {loading || !details ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : tab === 'details' ? (
          <>
            <Block title="Personal Information">
              <Field label="Full Name" value={name} />
              <Field
                label="Date of Birth"
                value={details.date_of_birth ? `${fmtDate(details.date_of_birth)} (${dayjs().diff(details.date_of_birth, 'year')} yrs)` : null}
              />
              <Field label="Gender" value={capitalize(details.gender)} />
              <Field label="Blood Group" value={details.blood_group} />
              <Field label="Nationality" value={details.nationality} />
              <Field label="Marital Status" value={details.marital_status ? capitalize(details.marital_status) : null} />
            </Block>

            <Block title="Contact Details">
              <Field label="Mobile" value={details.user?.phone} />
              <Field label="Alternate Mobile" value={details.alternate_phone} />
              <Field label="Email" value={displayEmail(details.user?.email)} />
              <Field label="Portal Login" value={details.user?.is_active ? 'Enabled' : 'Not enabled'} />
              <Field label="Permanent Address" value={details.permanent_address || details.address} md={8} />
              <Field
                label="Current Address"
                value={details.same_as_permanent ? 'Same as permanent address' : details.current_address}
                md={12}
              />
            </Block>

            <Block title="Accommodation">
              <Field label="Hostel" value={details.hostel?.name} />
              <Field label="Room / Bed" value={details.room?.room_number ? roomLabel : null} />
              <Field label="Floor" value={details.room?.floor} />
              <Field label="Move-in Date" value={fmtDate(details.move_in_date)} />
              {details.move_out_date && <Field label="Move-out Date" value={fmtDate(details.move_out_date)} />}
              <Field label="Monthly Rent" value={formatCurrency(details.monthly_rent)} />
              <Field label="Security Deposit" value={formatCurrency(details.deposit_amount)} />
            </Block>

            <Block title="Emergency Contact">
              <Field label="Name" value={details.emergency_contact_name} />
              <Field label="Relationship" value={details.emergency_contact_relation} />
              <Field label="Mobile" value={details.emergency_contact_phone} />
              <Field label="Alternate Number" value={details.emergency_contact_alternate} />
              <Field label="Address" value={details.emergency_contact_address} md={8} />
            </Block>

            {(details.is_student || details.guardian_name) && (
              <Block title="Parent / Guardian">
                <Field label="Name" value={details.guardian_name} />
                <Field label="Mobile" value={details.guardian_phone} />
                <Field label="Email" value={details.guardian_email} />
                <Field label="Occupation" value={details.guardian_occupation} />
                <Field label="College / Institution" value={details.college} />
                <Field label="Address" value={details.guardian_address} />
              </Block>
            )}

            <Box>
              <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1.5 }}>Identity Documents</Typography>
              {(details.documents || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">No documents on file</Typography>
              ) : (
                <Stack spacing={1}>
                  {details.documents.map((doc) => (
                    <Paper key={doc.id} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ flex: 1, minWidth: 180 }}>
                        <Typography variant="body2" fontWeight={600}>{ID_LABELS[doc.document_type] || capitalize(doc.document_type)}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ letterSpacing: '0.05em' }}>
                          {doc.id_number || '—'}{doc.expiry_date ? ` · Expires ${fmtDate(doc.expiry_date)}` : ''}
                        </Typography>
                      </Box>
                      {doc.file_path && (
                        <Link href={getMediaUrl(doc.file_path)} target="_blank" rel="noopener" underline="hover">Front image</Link>
                      )}
                      {doc.back_file_path && (
                        <Link href={getMediaUrl(doc.back_file_path)} target="_blank" rel="noopener" underline="hover">Back image</Link>
                      )}
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          </>
        ) : (
          <>
            <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap>
              <SummaryCard label="Total Billed" value={history?.summary?.billed} />
              <SummaryCard label="Total Paid" value={history?.summary?.paid} color="success.main" />
              <SummaryCard
                label="Outstanding"
                value={history?.summary?.outstanding}
                color={history?.summary?.outstanding > 0 ? 'error.main' : undefined}
              />
              <SummaryCard label="Security Deposit" value={history?.summary?.deposit} />
            </Stack>

            {(history?.payments || []).length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>No payments or invoices yet</Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice</TableCell>
                      <TableCell>Month</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Paid</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Mode / Paid On</TableCell>
                      <TableCell align="right">Invoice</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.payments.map((p) => {
                      const balance = Math.max(0, Number(p.total_amount) - Number(p.paid_amount));
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{p.invoice_number || `#${p.id}`}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {p.is_registration ? 'Registration bill' : `Due ${fmtDate(p.due_date)}`}
                            </Typography>
                          </TableCell>
                          <TableCell>{p.month_year ? dayjs(`${p.month_year}-01`).format('MMM YYYY') : '—'}</TableCell>
                          <TableCell align="right">{formatCurrency(p.total_amount)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(p.paid_amount)}</TableCell>
                          <TableCell align="right" sx={{ color: balance > 0 ? 'error.main' : undefined }}>{formatCurrency(balance)}</TableCell>
                          <TableCell><StatusChip status={p.status} /></TableCell>
                          <TableCell>
                            <Typography variant="body2">{modeLabel(p)}</Typography>
                            {p.paid_date && <Typography variant="caption" color="text.secondary">{fmtDate(p.paid_date)}</Typography>}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title="View invoice">
                              <IconButton size="small" onClick={() => viewRentInvoice(invoicePayload(p))}>
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Print invoice">
                              <IconButton size="small" color="primary" onClick={() => printRentInvoice(invoicePayload(p))}>
                                <PrintIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Close</Button>
        {tab === 'details' && details?.status === 'pending' && (
          <Button variant="contained" color="success" disabled={checkingIn} onClick={checkIn}>
            {checkingIn ? 'Checking in…' : 'Check in'}
          </Button>
        )}
        {tab === 'details' && (
          <Tooltip title={isBranch ? 'Switch the hostel filter to "All Hostels" to edit this tenant' : ''}>
            <span>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                disabled={!details || isBranch}
                onClick={() => onEdit(tenant)}
              >
                Edit Details
              </Button>
            </span>
          </Tooltip>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TenantViewDialog;
