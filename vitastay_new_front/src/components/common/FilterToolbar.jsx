import { Box, Card, alpha } from '@mui/material';
import { brand } from '../../styles/theme';

/**
 * Shared list filter chrome for calm ops — white toolbar on mist content.
 */
const FilterToolbar = ({ children, tabs, sx }) => (
  <Card
    elevation={0}
    sx={{
      mb: 2,
      borderRadius: 2.5,
      border: `1px solid ${alpha(brand.navy, 0.08)}`,
      overflow: 'hidden',
      ...sx,
    }}
  >
    {tabs}
    <Box
      sx={{
        p: 1.5,
        display: 'flex',
        gap: 1.25,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {children}
    </Box>
  </Card>
);

export default FilterToolbar;
