import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Typography,
} from '@mui/material';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import { snapshotVideoFrame, stitchEquirectangular } from '../../utils/compressImage';

const PANO_FRAMES = 8;

const CameraCaptureDialog = ({
  open,
  onClose,
  onCapture,
  title = 'Capture 360°',
}) => {
  const videoRef = useRef(null);
  const singleRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [frames, setFrames] = useState([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [panoFile, setPanoFile] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let stream;
    let cancelled = false;
    const start = async () => {
      setReady(false);
      setError('');
      setFrames([]);
      setPanoFile(null);
      setPreviewUrl('');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setError('Live camera is blocked. Use “Take one 360 photo” to open the device camera instead.');
      }
    };
    start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const snapFrame = async () => {
    if (!videoRef.current || busy) return;
    setBusy(true);
    try {
      const file = await snapshotVideoFrame(videoRef.current, {
        name: `angle-${frames.length + 1}.jpg`,
      });
      const next = [...frames, file];
      setFrames(next);
      if (next.length >= PANO_FRAMES) {
        const stitched = await stitchEquirectangular(next);
        setPanoFile(stitched);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(stitched);
        });
      }
    } catch (err) {
      setError(err.message || 'Could not capture that angle');
    } finally {
      setBusy(false);
    }
  };

  const resetFrames = () => {
    setFrames([]);
    setPanoFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  };

  const confirm = () => {
    if (!panoFile) return;
    onCapture?.(panoFile);
    onClose?.();
  };

  const takeOne = (fileList) => {
    const file = fileList?.[0];
    if (file) onCapture?.(file);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#fff' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ThreeSixtyIcon /> {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Hold the phone upright. Rotate a little between shots until 8 angles are filled — we stitch them
          into a 2:1 360° photo. Or capture one photo from the phone’s 360 mode.
        </Typography>
        {error && <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert>}
        {previewUrl ? (
          <Box
            component="img"
            src={previewUrl}
            alt="360 preview"
            sx={{ width: '100%', borderRadius: 2, display: 'block', mb: 1 }}
          />
        ) : (
          <Box
            sx={{
              position: 'relative',
              bgcolor: '#111',
              borderRadius: 2,
              overflow: 'hidden',
              aspectRatio: '4 / 3',
              mb: 1,
            }}
          >
            <Box
              component="video"
              ref={videoRef}
              autoPlay
              playsInline
              muted
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {!ready && (
              <Typography
                variant="caption"
                sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}
              >
                Starting camera…
              </Typography>
            )}
          </Box>
        )}
        <LinearProgress
          variant="determinate"
          value={(Math.min(frames.length, PANO_FRAMES) / PANO_FRAMES) * 100}
          sx={{ mb: 1, height: 8, borderRadius: 4 }}
        />
        <Typography variant="caption" color="text.secondary">
          {panoFile
            ? '360° ready — use this photo or recapture'
            : `${frames.length}/${PANO_FRAMES} angles · rotate right, then capture`}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Button
          size="small"
          onClick={() => singleRef.current?.click()}
          startIcon={<PhotoCameraOutlinedIcon />}
        >
          Take one 360 photo
        </Button>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={onClose}>Cancel</Button>
          {panoFile ? (
            <>
              <Button onClick={resetFrames}>Recapture</Button>
              <Button variant="contained" onClick={confirm}>Use this 360°</Button>
            </>
          ) : (
            <Button
              variant="contained"
              onClick={snapFrame}
              disabled={!ready || busy || frames.length >= PANO_FRAMES}
            >
              Capture angle {Math.min(frames.length + 1, PANO_FRAMES)}
            </Button>
          )}
        </Box>
        <input
          ref={singleRef}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(event) => {
            takeOne(event.target.files);
            event.target.value = '';
          }}
        />
      </DialogActions>
    </Dialog>
  );
};

export default CameraCaptureDialog;
