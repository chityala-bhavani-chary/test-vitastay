/**
 * BIC-023 — compare 2–3 published PGs. Public fields only (no KYC).
 * Route: /compare?ids=1,2,3 — loads GET /public/listings?ids=
 */
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Rating, Typography, alpha,
} from '@mui/material';
import api, { extractData, getErrorMessage } from '../../services/api';
import { brand } from '../../styles/theme';
import { formatCurrency, GENDER_POLICY_OPTIONS } from '../../utils/constants';
import { listingCoverSrc, demoImage } from '../../utils/demoImages';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const MAX = 3;

const parseIds = (raw) => String(raw || '')
  .split(',')
  .map((part) => Number(String(part).trim()))
  .filter((id) => Number.isFinite(id) && id > 0)
  .filter((id, index, all) => all.indexOf(id) === index)
  .slice(0, MAX);

const genderLabel = (value) =>
  GENDER_POLICY_OPTIONS.find((row) => row.value === value)?.label || value || '—';

const amenityText = (list) => {
  const rows = Array.isArray(list) ? list : [];
  return rows.length ? rows.join(', ') : '—';
};

const ComparePage = () => {
  const [params] = useSearchParams();
  const ids = useMemo(() => parseIds(params.get('ids')), [params]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (ids.length < 2) {
        setItems([]);
        setLoading(false);
        setError('');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/public/listings', {
          params: { ids: ids.join(','), limit: MAX },
        });
        const payload = extractData(data) || {};
        const list = payload.items || [];
        const byId = new Map(list.map((row) => [Number(row.id), row]));
        const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
        if (!cancelled) setItems(ordered);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [ids]);

  if (ids.length < 2) {
    return (
      <Box sx={{ maxWidth: 720 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: brand.navy, mb: 1 }}>Compare PGs</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Pick 2 or 3 listings on search (checkbox), then open Compare.
        </Alert>
        <Button component={RouterLink} to="/search" variant="contained">Back to search</Button>
      </Box>
    );
  }

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button component={RouterLink} to="/search">Back to search</Button>
      </Box>
    );
  }

  if (items.length < 2) {
    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Fewer than 2 published listings matched those ids. They may be unpublished.
        </Alert>
        <Button component={RouterLink} to="/search" variant="contained">Back to search</Button>
      </Box>
    );
  }

  const cells = items.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    place: [item.area, item.city].filter(Boolean).join(', ') || '—',
    photo: listingCoverSrc(item),
    rent: item.monthly_rent,
    deposit: item.security_deposit,
    ratingAvg: item.rating_avg,
    ratingCount: item.rating_count,
    amenities: item.amenities,
    gender: item.gender_policy,
    beds: item.beds_available,
    to: `/listings/${encodeURIComponent(item.code || item.id)}`,
  }));

  const fieldRows = [
    {
      label: 'Photo',
      render: (row) => (
        <Box
          component={RouterLink}
          to={row.to}
          sx={{ display: 'block', borderRadius: 1.5, overflow: 'hidden', height: 120 }}
        >
          <Box
            component="img"
            src={row.photo}
            alt=""
            onError={(event) => { event.currentTarget.src = demoImage('exterior', row.id); }}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
      ),
    },
    {
      label: 'PG',
      render: (row) => (
        <Box>
          <Typography fontWeight={750} sx={{ color: brand.navy }}>{row.name}</Typography>
          <Typography variant="body2" color="text.secondary">{row.place}</Typography>
        </Box>
      ),
    },
    {
      label: 'Monthly rent from',
      render: (row) => (row.rent != null ? formatCurrency(row.rent) : 'On request'),
    },
    {
      label: 'Security deposit',
      render: (row) => (row.deposit != null ? formatCurrency(row.deposit) : '—'),
    },
    {
      label: 'Distance',
      render: () => '—',
    },
    {
      label: 'Rating',
      render: (row) => (row.ratingCount > 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Rating value={Number(row.ratingAvg) || 0} precision={0.1} readOnly size="small" />
          <Typography variant="caption">{Number(row.ratingAvg).toFixed(1)} · {row.ratingCount}</Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">Newly listed</Typography>
      )),
    },
    {
      label: 'Amenities',
      render: (row) => (
        <Typography variant="body2" sx={{ lineHeight: 1.45 }}>{amenityText(row.amenities)}</Typography>
      ),
    },
    {
      label: 'Guest gender',
      render: (row) => genderLabel(row.gender),
    },
    {
      label: 'Beds left',
      render: (row) => (row.beds != null ? String(row.beds) : '—'),
    },
    {
      label: '',
      render: (row) => (
        <Button component={RouterLink} to={row.to} variant="contained" size="small" sx={{ fontWeight: 700 }}>
          View listing
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'baseline', mb: 2 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: brand.navy, flex: 1 }}>
          Compare PGs
        </Typography>
        <Chip size="small" label={`${cells.length} of ${MAX} max`} />
        <Button component={RouterLink} to="/search" size="small">Change selection</Button>
      </Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Side-by-side facts only — rent, deposit, rating, photos, amenities. No KYC or private owner data.
        Distance appears when map search ships.
      </Typography>

      <Box
        sx={{
          overflowX: 'auto',
          border: `1px solid ${alpha(brand.navy, 0.1)}`,
          borderRadius: 2,
          bgcolor: '#fff',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `140px repeat(${cells.length}, minmax(180px, 1fr))`,
            minWidth: 140 + cells.length * 180,
          }}
        >
          {fieldRows.map((field) => (
            <Box key={field.label || 'cta'} sx={{ display: 'contents' }}>
              <Box
                sx={{
                  p: 1.5,
                  borderBottom: `1px solid ${alpha(brand.navy, 0.08)}`,
                  bgcolor: alpha(brand.navy, 0.03),
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: brand.navy,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {field.label}
              </Box>
              {cells.map((row) => (
                <Box
                  key={`${field.label}-${row.id}`}
                  sx={{
                    p: 1.5,
                    borderBottom: `1px solid ${alpha(brand.navy, 0.08)}`,
                    borderLeft: `1px solid ${alpha(brand.navy, 0.06)}`,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {field.render(row)}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default ComparePage;
