import { Box, Typography, alpha } from '@mui/material';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { getMediaUrl } from '../../utils/constants';
import { demoImage } from '../../utils/demoImages';
import { brand } from '../../styles/theme';
import { isPanoramaItem, isVideoItem, listingThumbSrc } from './mediaHelpers';

const GalleryTile = ({
  item,
  alt,
  onOpenStill,
  onOpenPano,
  onOpenVideo,
  stillPool,
  height = { xs: 120, md: 140 },
  compact = false,
}) => {
  const isPano = isPanoramaItem(item);
  const isVideo = isVideoItem(item);
  const thumb = listingThumbSrc(item);

  const onClick = () => {
    if (isVideo) return onOpenVideo?.(item);
    if (isPano) return onOpenPano?.(item);
    return onOpenStill?.(item, stillPool);
  };

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={isVideo ? `Play video: ${alt}` : (isPano ? `Open 360°: ${alt}` : `Open photo: ${alt}`)}
      sx={{
        position: 'relative',
        borderRadius: 1.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: item.is_cover ? brand.teal : alpha(brand.navy, 0.12),
        bgcolor: '#fff',
        p: 0,
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        appearance: 'none',
        WebkitAppearance: 'none',
        minHeight: 44,
        minWidth: compact ? 72 : 0,
        flex: compact ? '0 0 auto' : undefined,
        width: compact ? 96 : '100%',
        '&:focus-visible': { outline: `2px solid ${brand.teal}`, outlineOffset: 2 },
      }}
    >
      {thumb ? (
        <Box
          component="img"
          src={getMediaUrl(thumb)}
          alt={alt}
          onError={(event) => {
            const img = event.currentTarget;
            if (img.dataset.fallback === '1') return;
            img.dataset.fallback = '1';
            const kind = item?.category === 'room' ? 'room' : item?.category === 'interior_common' ? 'interior' : 'exterior';
            img.src = demoImage(kind, item?.id || 0);
          }}
          sx={{
            width: '100%',
            height: compact ? 72 : height,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: compact ? 72 : height,
            bgcolor: brand.navy,
            display: 'block',
          }}
        />
      )}
      {isPano && (
        <ThreeSixtyIcon
          aria-hidden
          sx={{
            position: 'absolute',
            left: '50%',
            top: compact ? '50%' : '42%',
            transform: 'translate(-50%, -50%)',
            fontSize: compact ? 28 : 36,
            color: '#fff',
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))',
            pointerEvents: 'none',
          }}
        />
      )}
      {isVideo && (
        <PlayCircleOutlineIcon
          aria-hidden
          sx={{
            position: 'absolute',
            left: '50%',
            top: compact ? '50%' : '42%',
            transform: 'translate(-50%, -50%)',
            fontSize: compact ? 32 : 40,
            color: '#fff',
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))',
            pointerEvents: 'none',
          }}
        />
      )}
      {!compact && (item.caption || item.is_cover || isPano || isVideo) && (
        <Box sx={{ px: 1, py: 0.75 }}>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {item.caption || (item.is_cover ? 'Cover' : isVideo ? 'Video' : isPano ? '360°' : '')}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default GalleryTile;
