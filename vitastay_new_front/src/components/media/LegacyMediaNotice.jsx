/**
 * Reminds owners that unstructured JSON photos were copied into property_media
 * and still need recategorisation. The JSON columns stay until the next release.
 */
import { Alert, Box } from '@mui/material';
import { getMediaUrl } from '../../utils/constants';

const LegacyMediaNotice = ({ images, kind = 'hostel' }) => {
  const list = Array.isArray(images) ? images.filter(Boolean) : [];
  if (!list.length) return null;

  const bucket = kind === 'room' ? 'Room photos' : 'Interior (common)';
  const verb = list.length === 1 ? 'was' : 'were';

  return (
    <Box sx={{ mb: 2 }}>
      <Alert severity="info" sx={{ mb: 1 }}>
        {list.length} uncategorised photo{list.length === 1 ? '' : 's'} {verb} copied into the
        gallery as {bucket}. Recategorise exterior, floor, and 360° shots later — the original
        list is kept until the next release.
      </Alert>
      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>
        {list.map((src) => (
          <Box
            key={src}
            component="img"
            src={getMediaUrl(src)}
            alt="Uncategorised property photo"
            sx={{ width: 88, height: 64, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default LegacyMediaNotice;
