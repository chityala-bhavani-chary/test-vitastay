import { Chip } from '@mui/material';

const STATUS_COLORS = {
  vacant: 'success',
  occupied: 'primary',
  maintenance: 'warning',
  reserved: 'info',
  pending: 'warning',
  paid: 'success',
  partial: 'info',
  overdue: 'error',
  open: 'error',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
  completed: 'success',
  cancelled: 'default',
  checked_in: 'success',
  checked_out: 'default',
  active: 'success',
  inactive: 'default',
  moved_out: 'default',
  on_hold: 'warning',
  pending_approval: 'warning',
  rejected: 'error',
  locked: 'error',
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
  present: 'success',
  absent: 'error',
  half_day: 'warning',
  approved: 'success',
};

const StatusChip = ({ status, label, size = 'small' }) => {
  const normalizedStatus = status?.toLowerCase?.() || status;
  const displayLabel = label || normalizedStatus?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Chip
      label={displayLabel}
      size={size}
      color={STATUS_COLORS[normalizedStatus] || 'default'}
      variant="outlined"
      sx={{ fontWeight: 500, textTransform: 'capitalize' }}
    />
  );
};

export default StatusChip;
