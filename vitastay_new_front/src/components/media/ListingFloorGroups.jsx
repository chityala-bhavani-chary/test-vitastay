/**
 * Public listing floor groups (MED-016). Floor 2 corridors stay under Floor 2.
 */
import { Box, Typography } from '@mui/material';
import GalleryTile from './GalleryTile';
import { itemAlt, sortRecordKeys } from './mediaHelpers';
import { brand } from '../../styles/theme';

const floorTitle = (key) => {
  const n = Number(key);
  if (n === 0) return 'Ground floor';
  return `Floor ${key}`;
};

const ListingFloorGroups = ({ floors = {}, hostelName, onOpenStill, onOpenPano }) => {
  const keys = sortRecordKeys(floors);
  if (!keys.length) {
    return <Typography color="text.secondary">No floor photos yet.</Typography>;
  }

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {keys.map((key) => {
        const photos = floors[key] || [];
        return (
          <Box key={key}>
            <Typography fontWeight={750} sx={{ color: brand.navy, mb: 1 }}>
              {floorTitle(key)}
            </Typography>
            {photos.length === 0 ? (
              <Typography color="text.secondary">No photos on this floor yet.</Typography>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                  gap: 1.25,
                }}
              >
                {photos.map((item, index) => (
                  <GalleryTile
                    key={item.id}
                    item={item}
                    stillPool={photos}
                    onOpenStill={onOpenStill}
                    onOpenPano={onOpenPano}
                    alt={itemAlt(item, hostelName, index, photos.length, floorTitle(key))}
                  />
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default ListingFloorGroups;
