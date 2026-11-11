import { memo } from 'react';
import { Box } from '@mui/material';
import {
  atmosphereLayerSx,
  atmosphereGridSx,
  atmosphereOrbPrimarySx,
  atmosphereOrbSecondarySx,
} from '../../styles/atmosphere';

/** Static, viewport-sized backdrop. Must not animate or grow with page content. */
const AtmosphereBackground = () => (
  <Box sx={atmosphereLayerSx} aria-hidden>
    <Box sx={atmosphereGridSx} />
    <Box sx={atmosphereOrbPrimarySx} />
    <Box sx={atmosphereOrbSecondarySx} />
  </Box>
);

export default memo(AtmosphereBackground);
