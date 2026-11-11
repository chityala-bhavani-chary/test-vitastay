import { Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

const ChartEmptyState = ({
  title = 'Nothing to plot yet',
  hint,
  actionTo,
  actionLabel,
  height = 160,
}) => (
  <Box
    sx={{
      height,
      minHeight: 140,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      px: 2,
      borderRadius: 2,
      bgcolor: 'action.hover',
    }}
  >
    <InboxOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.75 }} />
    <Typography fontWeight={700} sx={{ fontSize: '0.9rem' }}>{title}</Typography>
    {hint && (
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, maxWidth: 280 }}>
        {hint}
      </Typography>
    )}
    {actionTo && actionLabel && (
      <Button component={RouterLink} to={actionTo} size="small" sx={{ mt: 1.25 }}>
        {actionLabel}
      </Button>
    )}
  </Box>
);

export default ChartEmptyState;
