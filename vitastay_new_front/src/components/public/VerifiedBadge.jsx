import { Chip } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';

const VerifiedBadge = ({ verified, size = 'small' }) => {
  if (!verified) return null;
  return (
    <Chip
      size={size}
      icon={<VerifiedIcon />}
      label="Vita Stay verified"
      color="success"
      sx={{ fontWeight: 700 }}
    />
  );
};

export default VerifiedBadge;
