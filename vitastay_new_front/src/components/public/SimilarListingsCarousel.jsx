/**
 * BIC-031 — similar / nearby published PGs on a listing.
 */
import { useEffect, useState } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import api, { extractData } from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import { brand } from '../../styles/theme';
import { listingCoverSrc, demoImage } from '../../utils/demoImages';

const SimilarListingsCarousel = ({ idOrSlug, preview }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!idOrSlug || preview) {
      setItems([]);
      return undefined;
    }
    let cancelled = false;
    api.get(`/public/listings/${encodeURIComponent(idOrSlug)}/similar`, { params: { limit: 8 } })
      .then(({ data }) => {
        if (!cancelled) setItems(extractData(data)?.items || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => { cancelled = true; };
  }, [idOrSlug, preview]);

  if (preview || items.length === 0) return null;

  return (
    <Box sx={{ mt: 4, mb: 2 }}>
      <Typography fontWeight={750} sx={{ color: brand.navy, mb: 0.5 }}>
        Similar PGs nearby
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Same city, similar rent — stay on Vita Stay instead of starting over on Google.
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          pb: 1,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item) => {
          const to = `/listings/${encodeURIComponent(item.code || item.id)}`;
          const cover = listingCoverSrc(item) || demoImage('exterior', item.id);
          const place = [item.area, item.city].filter(Boolean).join(', ');
          return (
            <Box
              key={item.id}
              component={RouterLink}
              to={to}
              sx={{
                flex: '0 0 220px',
                scrollSnapAlign: 'start',
                textDecoration: 'none',
                color: 'inherit',
                borderRadius: 2,
                overflow: 'hidden',
                border: `1px solid ${alpha(brand.navy, 0.1)}`,
                bgcolor: '#fff',
                transition: 'transform 160ms ease',
                '&:hover': { transform: 'translateY(-2px)' },
              }}
            >
              <Box
                component="img"
                src={cover}
                alt=""
                onError={(event) => { event.currentTarget.src = demoImage('exterior', item.id); }}
                sx={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
              />
              <Box sx={{ p: 1.25 }}>
                <Typography fontWeight={750} noWrap sx={{ color: brand.navy, fontSize: '0.95rem' }}>
                  {item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {place || 'PG'}
                </Typography>
                <Typography fontWeight={700} sx={{ mt: 0.5, color: brand.tealDark, fontSize: '0.9rem' }}>
                  {item.monthly_rent != null ? `From ${formatCurrency(item.monthly_rent)}` : 'On request'}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default SimilarListingsCarousel;
