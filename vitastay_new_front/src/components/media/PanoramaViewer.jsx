/**
 * Full-screen 360° overlay (Photo Sphere Viewer).
 * Original panorama loads only after the dialog opens (and not for reduced-motion / no-WebGL).
 * Drag on mobile, pinch/zoom navbar, arrows to look, Esc to close.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const hasWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
};

const PanoramaViewer = ({ open, url, stillUrl, caption, context, onClose }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [showStill, setShowStill] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setFailed(false);
      setEntered(false);
      setShowStill(false);
    } else {
      const webgl = hasWebGL();
      setFailed(!webgl);
      setShowStill(prefersReducedMotion());
    }
  }, [open]);

  useEffect(() => {
    if (!open || !entered || !url || showStill || failed) return undefined;
    if (!hasWebGL()) {
      setFailed(true);
      return undefined;
    }
    if (!containerRef.current) return undefined;

    try {
      viewerRef.current?.destroy();
      const viewer = new Viewer({
        container: containerRef.current,
        panorama: url,
        navbar: ['zoom', 'move', 'caption', 'fullscreen'],
        caption: caption || '360°',
        loadingTxt: 'Loading 360°…',
        mousewheel: true,
        mousemove: true,
        touchmoveTwoFingers: false,
        keyboard: 'always',
      });
      viewer.addEventListener('panorama-error', () => {
        setFailed(true);
      });
      viewerRef.current = viewer;
    } catch {
      setFailed(true);
    }

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [open, entered, url, caption, showStill, failed]);

  const still = stillUrl || url;
  const heading = [caption, context].filter(Boolean).join(' · ') || '360° view';

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      TransitionProps={{ onEntered: () => setEntered(true) }}
      PaperProps={{ sx: { bgcolor: '#111', height: '100dvh' } }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff' }}>
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
            <Typography fontWeight={700} noWrap>{heading}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Drag to look around · Esc to close
            </Typography>
          </Box>
          {!failed && (
            <Button color="inherit" onClick={() => setShowStill((v) => !v)}>
              {showStill ? 'Spin 360' : 'View still'}
            </Button>
          )}
          <Button color="inherit" onClick={onClose} startIcon={<CloseIcon />}>
            Exit
          </Button>
          <IconButton aria-label="Close 360 viewer" onClick={onClose} sx={{ color: '#fff', display: { sm: 'none' } }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {failed ? (
          <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Couldn’t open 360° view. Here’s the flat image.
            </Alert>
            {still ? (
              <Box
                component="img"
                src={still}
                alt={heading}
                sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            ) : null}
          </Box>
        ) : showStill ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
            {still ? (
              <Box component="img" src={still} alt={heading} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : null}
          </Box>
        ) : (
          <Box ref={containerRef} sx={{ flex: 1, minHeight: 0, touchAction: 'none' }} />
        )}
      </Box>
    </Dialog>
  );
};

export default PanoramaViewer;
