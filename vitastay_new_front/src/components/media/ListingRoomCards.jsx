/**
 * Public listing room cards (MED-016). Photos stay under their room number.
 * Do not merge sort_order across rooms — each card uses its own photos/panoramas arrays.
 */
import { Box, Card, CardContent, Chip, Typography, alpha } from '@mui/material';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import { brand } from '../../styles/theme';
import { formatCurrency } from '../../utils/constants';
import { sortRecordKeys } from './mediaHelpers';
import GalleryTile from './GalleryTile';

const TYPE_LABEL = {
  single: 'Single',
  double: 'Double',
  triple: 'Triple',
  dormitory: 'Dormitory',
};

const typeLabel = (room) => {
  const type = TYPE_LABEL[room.room_type] || room.room_type || 'Room';
  return room.is_ac ? `${type} AC` : type;
};

const bedsLabel = (room) => {
  const left = Number(room.beds_available);
  if (!Number.isFinite(left) || left <= 0) return 'Full';
  return left === 1 ? '1 bed left' : `${left} beds left`;
};

const ListingRoomCards = ({ rooms = {}, hostelName, onOpenStill, onOpenPano }) => {
  const keys = sortRecordKeys(rooms);
  if (!keys.length) {
    return <Typography color="text.secondary">No room photos yet.</Typography>;
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {keys.map((key) => {
        const room = rooms[key];
        const stills = room.photos || [];
        const panos = room.panoramas || [];
        const strip = [...stills, ...panos];
        const full = bedsLabel(room) === 'Full';
        return (
          <Card
            key={room.room_id || key}
            variant="outlined"
            sx={{ borderColor: alpha(brand.navy, 0.12) }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: 1,
                  mb: 0.5,
                }}
              >
                <Typography fontWeight={750} sx={{ color: brand.navy }}>
                  {room.room_number}
                </Typography>
                <Typography color="text.secondary">{typeLabel(room)}</Typography>
                {panos.length > 0 && (
                  <Chip
                    size="small"
                    clickable
                    icon={<ThreeSixtyIcon />}
                    label="360°"
                    onClick={() => onOpenPano?.(panos[0])}
                    sx={{ height: 28 }}
                  />
                )}
                <Box sx={{ flex: 1 }} />
                {room.rent != null && (
                  <Typography fontWeight={750}>{formatCurrency(room.rent)}</Typography>
                )}
              </Box>
              <Typography
                variant="body2"
                sx={{ color: full ? 'warning.main' : brand.tealDark, mb: 1.25, fontWeight: 650 }}
              >
                {bedsLabel(room)}
              </Typography>
              {strip.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No photos for this room yet.
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    overflowX: 'auto',
                    pb: 0.5,
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {strip.map((item, index) => (
                    <GalleryTile
                      key={item.id}
                      item={item}
                      compact
                      stillPool={stills}
                      onOpenStill={onOpenStill}
                      onOpenPano={onOpenPano}
                      alt={item.alt || item.caption || `Room ${room.room_number} photo ${index + 1} — ${hostelName || ''}`}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export default ListingRoomCards;
