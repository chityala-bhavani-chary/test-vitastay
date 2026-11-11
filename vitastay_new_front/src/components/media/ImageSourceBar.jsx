import { useRef } from 'react';
import { Box, Button } from '@mui/material';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';

const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Library · Capture 360° (middle) · Use camera.
 * Camera uses the device rear camera via capture="environment".
 */
const ImageSourceBar = ({
  onFiles,
  multiple = true,
  accept = ACCEPT,
  disabled = false,
  showCamera = true,
  showPano = false,
  onOpenPano,
  libraryLabel = 'Choose photos',
  cameraLabel = 'Use camera',
  panoLabel = 'Capture 360°',
}) => {
  const libraryRef = useRef(null);
  const cameraRef = useRef(null);

  const emit = (list) => {
    const files = [...(list || [])];
    if (files.length) onFiles?.(files);
  };

  return (
    <Box
      sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mt: 1.5 }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button
        variant="outlined"
        size="small"
        disabled={disabled}
        startIcon={<PhotoLibraryOutlinedIcon />}
        onClick={() => libraryRef.current?.click()}
      >
        {libraryLabel}
      </Button>
      {showPano && (
        <Button
          variant="contained"
          size="small"
          disabled={disabled}
          startIcon={<ThreeSixtyIcon />}
          onClick={() => onOpenPano?.()}
        >
          {panoLabel}
        </Button>
      )}
      {showCamera && (
        <Button
          variant="outlined"
          size="small"
          disabled={disabled}
          startIcon={<PhotoCameraOutlinedIcon />}
          onClick={() => cameraRef.current?.click()}
        >
          {cameraLabel}
        </Button>
      )}
      <input
        ref={libraryRef}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        hidden
        accept={accept}
        capture="environment"
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = '';
        }}
      />
    </Box>
  );
};

export default ImageSourceBar;
