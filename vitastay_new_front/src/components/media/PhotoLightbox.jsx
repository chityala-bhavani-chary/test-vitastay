/**
 * Full-screen stills lightbox (MED-015).
 * Next/prev, swipe, Esc. Alt from caption. Originals load only while open.
 * 360 files never pass through here — those use PanoramaViewer.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Box, Dialog, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getMediaUrl } from '../../utils/constants';

const SWIPE_PX = 50;
const hit = {
  color: '#fff',
  bgcolor: 'rgba(0,0,0,0.45)',
  width: 44,
  height: 44,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
};

const PhotoLightbox = ({
  open,
  items = [],
  index = 0,
  onIndex,
  onClose,
  hostelName,
}) => {
  const touchRef = useRef({ x: 0, y: 0 });
  const current = items[index] || null;
  const total = items.length;
  const alt = current?.alt || current?.caption
    || (hostelName ? `Photo ${index + 1} of ${total} — ${hostelName}` : `Photo ${index + 1} of ${total}`);

  const go = useCallback((delta) => {
    if (!total) return;
    const next = (index + delta + total) % total;
    onIndex?.(next);
  }, [index, onIndex, total]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(-1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go, onClose]);

  const onTouchStart = (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchRef.current.x;
    const dy = touch.clientY - touchRef.current.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { bgcolor: '#111', color: '#fff' } }}
      aria-label="Photo viewer"
    >
      <Box
        sx={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            bgcolor: 'rgba(0,0,0,0.72)',
            zIndex: 2,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>
              {current?.caption || alt}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }} aria-live="polite">
              {total ? `${index + 1} of ${total}` : ''} · swipe or arrows · Esc to close
            </Typography>
          </Box>
          <IconButton aria-label="Close photo viewer" onClick={onClose} sx={hit}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            px: { xs: 1, md: 8 },
            py: 1,
          }}
        >
          {total > 1 && (
            <IconButton
              aria-label="Previous photo"
              onClick={() => go(-1)}
              sx={{ ...hit, position: 'absolute', left: 8, zIndex: 2 }}
            >
              <ChevronLeftIcon />
            </IconButton>
          )}

          {current && (
            <Box
              component="img"
              src={getMediaUrl(current.url || current.thumb_url)}
              alt={alt}
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}

          {total > 1 && (
            <IconButton
              aria-label="Next photo"
              onClick={() => go(1)}
              sx={{ ...hit, position: 'absolute', right: 8, zIndex: 2 }}
            >
              <ChevronRightIcon />
            </IconButton>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default PhotoLightbox;
