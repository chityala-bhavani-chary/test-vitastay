/**
 * BIC-030 / DEC-01 — Instant book vs Request to book (and Hold with advance).
 * Tooltip explains chargeback risk / who confirms. Instant-only search filter is later.
 */
import { Chip, Tooltip } from '@mui/material';

const BookingModelBadge = ({
  bookingModel,
  badge,
  hint,
  size = 'small',
  sx,
}) => {
  if (!badge) return null;
  const chip = (
    <Chip
      size={size}
      color={bookingModel === 'instant' ? 'success' : 'default'}
      variant={bookingModel === 'instant' ? 'filled' : 'outlined'}
      label={badge}
      sx={sx}
    />
  );
  if (!hint) return chip;
  return (
    <Tooltip title={hint} arrow enterTouchDelay={0}>
      <span>{chip}</span>
    </Tooltip>
  );
};

export default BookingModelBadge;
