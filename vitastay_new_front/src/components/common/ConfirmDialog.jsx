import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const ConfirmDialog = ({
  open,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  severity = 'warning',
}) => (
  <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {severity === 'warning' && <WarningAmberIcon color="warning" />}
      {title}
    </DialogTitle>
    <DialogContent>
      <Typography color="text.secondary">{message}</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
      <Button
        variant="contained"
        color={severity === 'error' ? 'error' : 'primary'}
        onClick={onConfirm}
        disabled={loading}
      >
        {loading ? 'Processing...' : confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
