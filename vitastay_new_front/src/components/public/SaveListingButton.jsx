/**
 * BIC-022 — heart on search cards / listing. Guests are sent to login.
 */
import { IconButton, Tooltip } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useNavigate, useLocation } from 'react-router-dom';
import useWishlist from '../../hooks/useWishlist';
import { brand } from '../../styles/theme';

const SaveListingButton = ({
  hostelId,
  code,
  size = 'medium',
  sx = {},
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSeeker, isSaved, toggle } = useWishlist();
  const saved = Boolean(hostelId && isSaved(hostelId));
  const target = code || hostelId;

  const onClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!target) return;
    if (!isSeeker) {
      const next = `${location.pathname}${location.search || ''}`;
      navigate(`/account/login?next=${encodeURIComponent(next)}`);
      return;
    }
    await toggle(target, { currentlySaved: saved });
  };

  return (
    <Tooltip title={saved ? 'Remove from saved' : 'Save for later'}>
      <IconButton
        aria-label={saved ? 'Remove from saved' : 'Save listing'}
        aria-pressed={saved}
        size={size}
        onClick={onClick}
        sx={{
          bgcolor: 'rgba(255,255,255,0.92)',
          color: saved ? '#C62828' : brand.navy,
          '&:hover': { bgcolor: '#fff' },
          ...sx,
        }}
      >
        {saved ? <FavoriteIcon fontSize="inherit" /> : <FavoriteBorderIcon fontSize="inherit" />}
      </IconButton>
    </Tooltip>
  );
};

export default SaveListingButton;
