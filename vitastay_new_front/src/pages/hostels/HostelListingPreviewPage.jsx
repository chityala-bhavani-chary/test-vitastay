/**
 * Operator preview of the listing pack (MED-012).
 * Open listing preview/public page uses the guest listing at /listings/:code (BKG-003).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Typography, alpha } from '@mui/material';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import PanoramaViewer from '../../components/media/PanoramaViewer';
import DescriptionDraftPanel from '../../components/listings/DescriptionDraftPanel';
import OwnerKycPanel from '../../components/listings/OwnerKycPanel';
import VerifiedAdminPanel from '../../components/listings/VerifiedAdminPanel';
import api, { extractData, getErrorMessage } from '../../services/api';
import { getMediaUrl } from '../../utils/constants';
import { brand } from '../../styles/theme';

const GROUPS = [
  { key: 'all', label: 'All', category: null },
  { key: 'exterior', label: 'Outside', category: 'exterior' },
  { key: 'interior_common', label: 'Inside', category: 'interior_common' },
  { key: 'room', label: 'Rooms', category: 'room' },
  { key: 'floor', label: 'Floors', category: 'floor' },
  { key: 'panorama_360', label: '360°', category: 'panorama_360' },
  { key: 'walkthrough_video', label: 'Video', category: 'walkthrough_video' },
];

const HostelListingPreviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [hostel, setHostel] = useState(null);
  const [items, setItems] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [hostelRes, mediaRes] = await Promise.all([
          api.get(`/hostels/${id}`),
          api.get(`/hostels/${id}/media`),
        ]);
        if (cancelled) return;
        setHostel(extractData(hostelRes));
        const payload = extractData(mediaRes);
        setItems((payload.items || []).filter((item) => !item.deleted_at));
        setChecklist(payload.checklist || null);
      } catch (err) {
        if (!cancelled) {
          enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
          navigate('/hostels');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [id, enqueueSnackbar, navigate]);

  const counts = useMemo(() => {
    const next = { all: items.length };
    GROUPS.forEach((group) => {
      if (group.category) next[group.key] = items.filter((item) => item.category === group.category).length;
    });
    return next;
  }, [items]);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => item.category === filter);
  }, [items, filter]);

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  const published = Boolean(checklist?.listing_published);
  const canPublish = Boolean(checklist?.can_publish);
  const marketplace = hostel?.entitlements?.listing_publish !== false
    && checklist?.listing_publish !== false
    && checklist?.marketplace_ok !== false;

  return (
    <Box>
      <PageHeader
        dense
        title={hostel?.name || 'Listing preview'}
        subtitle="How seekers will see the photos"
        breadcrumbs={[
          { label: 'Hostels', path: '/hostels' },
          { label: hostel?.name || 'Hostel', path: `/hostels/${id}` },
          { label: 'Preview listing' },
        ]}
      >
        {marketplace ? (
          <Button
            component={RouterLink}
            to={`/listings/${encodeURIComponent(hostel?.code || id)}`}
            variant="contained"
          >
            {published ? 'Open public page' : 'Open listing preview'}
          </Button>
        ) : null}
        <Button component={RouterLink} to={`/hostels/${id}/media`} variant="outlined">
          Back to photos
        </Button>
      </PageHeader>

      {!marketplace && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          This PG is management-only. There is no public listing URL. Guests cannot find or book it online.
        </Alert>
      )}
      {marketplace && !published && (
        <Alert severity={canPublish ? 'info' : 'warning'} sx={{ mb: 1.5 }}>
          {canPublish
            ? 'This is a preview. Seekers cannot see this listing until you publish.'
            : 'Preview only. Finish the photo pack (green checklist) before publishing.'}
        </Alert>
      )}
      {marketplace && published && (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          Listing is live. Seekers can open the public gallery without signing in.
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }} role="tablist">
        {GROUPS.map((group) => (
          <Chip
            key={group.key}
            clickable
            color={filter === group.key ? 'primary' : 'default'}
            variant={filter === group.key ? 'filled' : 'outlined'}
            label={`${group.label} (${counts[group.key] || 0})`}
            onClick={() => setFilter(group.key)}
          />
        ))}
      </Box>

      {marketplace ? <VerifiedAdminPanel hostelId={id} /> : null}
      {marketplace ? <OwnerKycPanel hostelId={id} /> : null}
      {marketplace ? <DescriptionDraftPanel hostelId={id} /> : null}

      <Card sx={{ mt: marketplace ? 2 : 0 }}>
        <CardContent sx={{ p: 2 }}>
          {visible.length === 0 ? (
            <Typography color="text.secondary">
              {items.length === 0
                ? 'Add outside photos first. Listings need a visual pack before tenants can book.'
                : 'Nothing in this category yet.'}
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25 }}>
              {visible.map((item) => (
                <Box
                  key={item.id}
                  onClick={() => item.category === 'panorama_360' && setViewing(item)}
                  sx={{
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: item.is_cover ? brand.teal : alpha(brand.navy, 0.12),
                    cursor: item.category === 'panorama_360' ? 'pointer' : 'default',
                    bgcolor: '#fff',
                  }}
                >
                  <Box
                    component="img"
                    src={getMediaUrl(item.thumb_url || item.url)}
                    alt={item.caption || `${hostel?.name || 'Hostel'} photo`}
                    sx={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                  />
                  <Box sx={{ px: 1, py: 0.75 }}>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {item.caption
                        || (item.room_number ? `Room ${item.room_number}` : null)
                        || (item.floor_number ? `Floor ${item.floor_number}` : null)
                        || (item.is_cover ? 'Cover' : item.category)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <PanoramaViewer
        open={Boolean(viewing)}
        url={viewing ? getMediaUrl(viewing.url) : ''}
        stillUrl={viewing ? getMediaUrl(viewing.thumb_url || viewing.url) : ''}
        caption={viewing?.caption}
        context={[
          viewing?.room_number ? `Room ${viewing.room_number}` : null,
          viewing?.floor_number ? `Floor ${viewing.floor_number}` : null,
        ].filter(Boolean).join(' · ')}
        onClose={() => setViewing(null)}
      />
    </Box>
  );
};

export default HostelListingPreviewPage;
