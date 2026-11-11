import { Box, Skeleton, Card, CardContent, Grid, alpha } from '@mui/material';
import { brand } from '../../styles/theme';

/** Skeletons sit on the calm mist surface, so they must be navy-tinted or the page looks blank. */
const onSurface = {
  bgcolor: alpha(brand.navy, 0.08),
};

const LoadingSkeleton = ({ variant = 'card', rows = 5, columns = 4 }) => {
  if (variant === 'table') {
    return (
      <Box>
        <Skeleton variant="rounded" height={48} sx={{ mb: 1, borderRadius: 2, ...onSurface }} />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 0.5, borderRadius: 1, ...onSurface }} />
        ))}
      </Box>
    );
  }

  if (variant === 'form') {
    return (
      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Skeleton variant="text" width="30%" height={20} sx={{ mb: 1 }} />
                <Skeleton variant="rounded" height={56} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
            <Grid item xs={12}>
              <Skeleton variant="rounded" height={120} sx={{ borderRadius: 2 }} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'dashboard') {
    return (
      <Box>
        <Skeleton variant="rounded" height={28} width={220} sx={{ mb: 1.5, borderRadius: 1, ...onSurface }} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.5,
            mb: 1.5,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: 2, ...onSurface }} />
          ))}
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.6fr) minmax(0, 1fr)' },
            gap: 1.5,
          }}
        >
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: 2, ...onSurface }} />
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: 2, ...onSurface }} />
        </Box>
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="rounded" height={100} sx={{ mt: 2, borderRadius: 2 }} />
      </CardContent>
    </Card>
  );
};

export default LoadingSkeleton;
