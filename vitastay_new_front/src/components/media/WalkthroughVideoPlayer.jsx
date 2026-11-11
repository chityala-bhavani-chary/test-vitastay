/**
 * BIC-035 — HTML5 walkthrough player. No autoplay with sound.
 */
import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getMediaUrl } from '../../utils/constants';

const WalkthroughVideoPlayer = ({ open, item, onClose }) => {
  const src = item ? getMediaUrl(item.url) : '';
  const poster = item?.thumb_url ? getMediaUrl(item.thumb_url) : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {item?.caption || 'Walkthrough video'}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {src ? (
          <video
            key={src}
            controls
            playsInline
            preload="metadata"
            poster={poster}
            style={{ width: '100%', maxHeight: '70vh', background: '#111', borderRadius: 8 }}
          >
            <source src={src} type={item?.mime_type || 'video/mp4'} />
            Your browser does not support MP4 playback.
          </video>
        ) : (
          <Typography color="text.secondary">No video selected.</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WalkthroughVideoPlayer;
