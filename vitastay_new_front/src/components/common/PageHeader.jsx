import { memo } from 'react';
import { Box, Typography, Breadcrumbs, Link, Button, alpha } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import { brand } from '../../styles/theme';

const PageHeader = ({
  title,
  subtitle,
  breadcrumbs = [],
  actionLabel,
  actionIcon: ActionIcon = AddIcon,
  onAction,
  actionTo,
  dense = false,
  children,
}) => (
  <Box sx={{ mb: dense ? 1.5 : 2.5 }}>
    {breadcrumbs.length > 0 && (
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" sx={{ color: alpha(brand.navy, 0.35) }} />}
        sx={{ mb: 1, color: alpha(brand.navy, 0.55) }}
      >
        {breadcrumbs.map((crumb, index) =>
          crumb.path ? (
            <Link key={index} component={RouterLink} to={crumb.path} underline="hover" color="inherit">
              {crumb.label}
            </Link>
          ) : (
            <Typography key={index} sx={{ color: brand.navy }} fontSize="0.875rem" fontWeight={600}>
              {crumb.label}
            </Typography>
          )
        )}
      </Breadcrumbs>
    )}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: dense ? 1 : 2 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant={dense ? 'h5' : 'h4'}
          fontWeight={800}
          gutterBottom={!!subtitle}
          sx={{ color: brand.navy, lineHeight: 1.2, letterSpacing: '-0.02em' }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: alpha(brand.navy, 0.62) }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {children}
        {(actionLabel && (onAction || actionTo)) && (
          actionTo ? (
            <Button variant="contained" startIcon={<ActionIcon />} component={RouterLink} to={actionTo}>
              {actionLabel}
            </Button>
          ) : (
            <Button variant="contained" startIcon={<ActionIcon />} onClick={onAction}>
              {actionLabel}
            </Button>
          )
        )}
      </Box>
    </Box>
  </Box>
);

export default memo(PageHeader);
