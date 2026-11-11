import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import { useSnackbar } from 'notistack';
import { payRentInvoice } from '../../utils/payRent';
import { formatCurrency } from '../../utils/constants';
import { getErrorMessage } from '../../services/api';

const PayRentButton = ({
  invoiceId,
  amount,
  onPaid,
  size = 'small',
  variant = 'contained',
  label,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [busy, setBusy] = useState(false);
  const due = Number(amount) || 0;

  const handlePay = async (event) => {
    event?.stopPropagation?.();
    if (!invoiceId || due <= 0) return;
    setBusy(true);
    try {
      const result = await payRentInvoice(invoiceId);
      if (result.already_paid) {
        enqueueSnackbar('This invoice is already paid', { variant: 'info' });
      } else {
        enqueueSnackbar(`Paid ${formatCurrency(result.paid_amount || due)}. Receipt ${result.receipt_number || ''}`.trim(), {
          variant: 'success',
        });
      }
      onPaid?.(result);
    } catch (err) {
      if (!err.cancelled) enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      color="warning"
      startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <PaymentsIcon />}
      disabled={busy || due <= 0}
      onClick={handlePay}
    >
      {label || `Pay ${formatCurrency(due)}`}
    </Button>
  );
};

export default PayRentButton;
