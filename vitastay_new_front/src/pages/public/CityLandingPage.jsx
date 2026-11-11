/**
 * BIC-032 — indexable /pg/{city}/{area} landing (Vite SPA; SSR later).
 * Only published projections. Empty places get noindex.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Chip, Pagination, Typography, alpha,
} from '@mui/material';
import api, { extractData, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/constants';
import { brand } from '../../styles/theme';
import { listingCoverSrc, demoImage } from '../../utils/demoImages';
import { pgPath } from '../../utils/locationSlugs';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import BookingModelBadge from '../../components/public/BookingModelBadge';

const upsertMeta = (attr, key, content) => {
  if (content == null) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const CityLandingPage = () => {
  const { citySlug, areaSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [payload, setPayload] = useState(null);
  const [areas, setAreas] = useState([]);
  const [paging, setPaging] = useState({ page: 1, totalPages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const path = areaSlug
          ? `/public/pg/${encodeURIComponent(citySlug)}/${encodeURIComponent(areaSlug)}`
          : `/public/pg/${encodeURIComponent(citySlug)}`;
        const [landingRes, areasRes] = await Promise.all([
          api.get(path, { params: { page, limit: 12 } }),
          api.get(`/public/pg/${encodeURIComponent(citySlug)}/areas`).catch(() => null),
        ]);
        if (cancelled) return;
        setPayload(extractData(landingRes.data));
        const p = landingRes.data?.pagination || {};
        setPaging({
          page: p.page || page,
          totalPages: p.totalPages || Math.ceil((p.total || 0) / (p.limit || 12)) || 0,
          total: p.total || 0,
        });
        setAreas(extractData(areasRes?.data)?.items || []);
      } catch (err) {
        if (!cancelled) {
          setPayload(null);
          setAreas([]);
          setPaging({ page: 1, totalPages: 0, total: 0 });
          setError(err.response?.status === 404
            ? 'No published PGs for this place yet'
            : getErrorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [citySlug, areaSlug, page]);

  const seo = payload?.seo;
  const items = payload?.items || [];

  useEffect(() => {
    const title = seo?.title || (error ? 'PG search · Vita Stay' : 'PG · Vita Stay');
    document.title = title;
    if (seo?.description) {
      upsertMeta('name', 'description', seo.description);
      upsertMeta('property', 'og:description', seo.description);
    }
    upsertMeta('property', 'og:title', title);
    upsertMeta('name', 'robots', seo?.indexable ? 'index, follow' : 'noindex, follow');
    upsertMeta('name', 'twitter:card', 'summary');

    const scriptId = 'vita-pg-jsonld';
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();
    if (seo?.indexable && items.length) {
      const origin = window.location.origin;
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: seo.title,
        description: seo.description,
        numberOfItems: paging.total || items.length,
        itemListElement: items.slice(0, 12).map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${origin}/listings/${encodeURIComponent(item.code || item.id)}`,
          name: item.name,
        })),
      };
      const el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = scriptId;
      el.text = JSON.stringify(jsonLd);
      document.head.appendChild(el);
    }
    return () => {
      document.title = 'Vita Stay | Hostel Management';
      const node = document.getElementById(scriptId);
      if (node) node.remove();
    };
  }, [seo, error, items, paging.total]);

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  const place = payload?.area
    ? `${payload.area}, ${payload.city}`
    : (payload?.city || citySlug);

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2rem' }, color: brand.navy, letterSpacing: '-0.03em' }}>
        PG in {place}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        {seo?.description || error || 'Published guest listings only.'}
      </Typography>

      {areas.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
          <Chip
            component={RouterLink}
            to={`/pg/${citySlug}`}
            clickable
            label={`All ${payload?.city || citySlug}`}
            color={!areaSlug ? 'primary' : 'default'}
            variant={!areaSlug ? 'filled' : 'outlined'}
          />
          {areas.map((row) => (
            <Chip
              key={row.slug}
              component={RouterLink}
              to={row.path || pgPath(payload?.city || citySlug, row.area)}
              clickable
              label={`${row.area} (${row.listing_count})`}
              color={areaSlug === row.slug ? 'primary' : 'default'}
              variant={areaSlug === row.slug ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      )}

      {error && (
        <Box sx={{ bgcolor: alpha(brand.navy, 0.04), p: 3, borderRadius: 2, mb: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>{error}</Typography>
          <Button component={RouterLink} to="/search" variant="contained">Search all cities</Button>
        </Box>
      )}

      {!error && items.length === 0 && (
        <Box sx={{ bgcolor: '#fff', p: 3, borderRadius: 2, border: `1px dashed ${alpha(brand.navy, 0.2)}` }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>No published PGs here yet</Typography>
          <Button component={RouterLink} to="/search" variant="outlined">Browse search</Button>
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {items.map((item) => {
          const to = `/listings/${encodeURIComponent(item.code || item.id)}`;
          const cover = listingCoverSrc(item) || demoImage('exterior', item.id);
          return (
            <Box
              key={item.id}
              component={RouterLink}
              to={to}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '200px 1fr' },
                gap: 0,
                textDecoration: 'none',
                color: 'inherit',
                bgcolor: '#fff',
                borderRadius: 2,
                overflow: 'hidden',
                border: `1px solid ${alpha(brand.navy, 0.08)}`,
              }}
            >
              <Box
                component="img"
                src={cover}
                alt=""
                onError={(event) => { event.currentTarget.src = demoImage('exterior', item.id); }}
                sx={{ width: '100%', height: { xs: 180, sm: '100%' }, minHeight: 160, objectFit: 'cover' }}
              />
              <Box sx={{ p: 2 }}>
                <Typography fontWeight={800} sx={{ color: brand.navy }}>{item.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[item.area, item.city].filter(Boolean).join(', ')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, alignItems: 'center' }}>
                  <Typography fontWeight={750} sx={{ color: brand.tealDark }}>
                    {item.monthly_rent != null ? `From ${formatCurrency(item.monthly_rent)}` : 'On request'}
                  </Typography>
                  <BookingModelBadge
                    bookingModel={item.booking_model}
                    badge={item.booking_badge}
                    hint={item.booking_hint}
                  />
                  {item.vita_verified && (
                    <Chip size="small" color="success" label="Vita Stay verified" sx={{ fontWeight: 700 }} />
                  )}
                  {item.beds_available > 0 && (
                    <Chip size="small" label={`${item.beds_available} beds left`} />
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      {paging.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            page={paging.page}
            count={paging.totalPages}
            onChange={(_, next) => {
              const q = new URLSearchParams(params);
              q.set('page', String(next));
              setParams(q);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

export default CityLandingPage;
