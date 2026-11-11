/**
 * Published PG listing (BKG-003): stay product page matching hotel-style search.
 * Unpublished → 404 for guests. Owners/supervisors/SA can preview while logged in.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, IconButton, MenuItem, TextField, Tooltip, Typography, alpha,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useSnackbar } from 'notistack';
import SaveListingButton from '../../components/public/SaveListingButton';
import BookingModelBadge from '../../components/public/BookingModelBadge';
import VerifiedBadge from '../../components/public/VerifiedBadge';
import VisitBookPanel from '../../components/public/VisitBookPanel';
import SimilarListingsCarousel from '../../components/public/SimilarListingsCarousel';
import api, { extractData, getErrorMessage } from '../../services/api';
import {
  GENDER_POLICY_OPTIONS,
  OCCUPANCY_OPTIONS,
  formatCurrency,
  getMediaUrl,
  ROLES,
} from '../../utils/constants';
import { brand } from '../../styles/theme';
import GalleryTabs, {
  isPanoramaItem,
  panoramaContext,
} from '../../components/media/GalleryTabs';
import { listingThumbSrc } from '../../components/media/mediaHelpers';
import { demoImage } from '../../utils/demoImages';
import PhotoLightbox from '../../components/media/PhotoLightbox';
import PanoramaViewer from '../../components/media/PanoramaViewer';
import WalkthroughVideoPlayer from '../../components/media/WalkthroughVideoPlayer';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import useAuth from '../../hooks/useAuth';
import { trackListingEvent } from '../../utils/listingEvents';
import { pgPath } from '../../utils/locationSlugs';
import {
  localizedHostelText,
  readStoredLocale,
  storeLocale,
  tPublic,
} from '../../i18n/publicListing';

const genderLabel = (value) =>
  GENDER_POLICY_OPTIONS.find((row) => row.value === value)?.label || 'Unisex / co-ed';

const occupancyLabel = (value) =>
  OCCUPANCY_OPTIONS.find((row) => row.value === value)?.label || value;

const photoKind = (item) => {
  if (item?.category === 'room') return 'room';
  if (item?.category === 'interior_common') return 'interior';
  if (item?.category === 'floor' || item?.category === 'floor_plan') return 'floor';
  return 'exterior';
};

const swapBrokenPhoto = (event, item, seed) => {
  const img = event.currentTarget;
  if (img.dataset.fallback === '1') return;
  img.dataset.fallback = '1';
  img.src = demoImage(photoKind(item), seed);
};

const absAsset = (path) => {
  const url = getMediaUrl(path);
  if (!url) return null;
  if (/^https?:/i.test(url)) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;
};

const upsertMeta = (attr, key, content) => {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const Fact = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.65rem' }}>
      {label}
    </Typography>
    <Typography fontWeight={700} sx={{ color: brand.navy, mt: 0.35 }}>{value || '—'}</Typography>
  </Box>
);

const sectionCard = {
  bgcolor: '#fff',
  borderRadius: 2.5,
  border: `1px solid ${alpha(brand.navy, 0.08)}`,
  p: { xs: 2, md: 2.5 },
};

const ListingPage = () => {
  const { idOrSlug } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user, isAuthenticated, isSeeker } = useAuth();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState('all');
  const [stills, setStills] = useState([]);
  const [stillIndex, setStillIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [panoItem, setPanoItem] = useState(null);
  const [videoItem, setVideoItem] = useState(null);
  const [locale, setLocale] = useState(() => readStoredLocale());
  const [roomType, setRoomType] = useState('');
  const [moveIn, setMoveIn] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);
  const [waitlistTypes, setWaitlistTypes] = useState([]);
  const [waitlistSaving, setWaitlistSaving] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      setStatus(null);
      setTab('all');
      setLightboxOpen(false);
      setPanoItem(null);
      setWaitlistTypes([]);
      try {
        const { data } = await api.get(`/public/listings/${encodeURIComponent(idOrSlug)}`);
        if (!cancelled) setPayload(extractData(data));
      } catch (err) {
        if (!cancelled) {
          setPayload(null);
          setStatus(err.response?.status || null);
          setError(err.response?.status === 404
            ? 'This listing is not available'
            : getErrorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [idOrSlug]);

  const hostel = payload?.hostel;
  const media = payload?.media || payload;
  const availability = payload?.availability || {};
  const rules = payload?.rules || {};
  const seo = payload?.seo || {};
  const preview = Boolean(payload?.preview);

  useEffect(() => {
    if (!payload || preview || !idOrSlug) return undefined;
    if (isAuthenticated && !isSeeker) return undefined;
    trackListingEvent(idOrSlug, 'listing_view');
    return undefined;
  }, [payload, preview, idOrSlug, isAuthenticated, isSeeker]);

  useEffect(() => {
    if (!isSeeker || !hostel?.id || preview) {
      setWaitlistTypes([]);
      return undefined;
    }
    let cancelled = false;
    api.get(`/waitlists/listing/${hostel.id}`)
      .then(({ data }) => {
        if (cancelled) return;
        const items = extractData(data)?.items || [];
        setWaitlistTypes(items.map((row) => row.room_type));
      })
      .catch(() => {
        if (!cancelled) setWaitlistTypes([]);
      });
    return () => { cancelled = true; };
  }, [isSeeker, hostel?.id, preview]);

  const items = media?.items || [];
  const cover = media?.cover;

  useEffect(() => {
    const title = seo.title || (hostel?.name ? `${hostel.name} · Vita Stay` : null);
    if (title) document.title = title;
    if (seo.description) {
      upsertMeta('name', 'description', seo.description);
      upsertMeta('property', 'og:description', seo.description);
    }
    if (title) upsertMeta('property', 'og:title', title);
    const share = absAsset(seo.share_image || cover?.url || cover?.thumb_url)
      || (hostel ? `${window.location.origin}${demoImage('exterior', hostel.id)}` : null);
    if (share) {
      upsertMeta('property', 'og:image', share);
      upsertMeta('name', 'twitter:image', share);
    }
    if (typeof window !== 'undefined') {
      upsertMeta('property', 'og:url', window.location.href);
      upsertMeta('property', 'og:type', 'website');
    }
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'robots', preview ? 'noindex, nofollow' : 'index, follow');
    return () => { document.title = 'Vita Stay | Hostel Management'; };
  }, [seo, hostel, cover, preview]);

  const allStills = useMemo(
    () => items.filter((item) => !isPanoramaItem(item)),
    [items],
  );

  const openStill = (item, pool) => {
    const list = (pool || allStills).filter((row) => !isPanoramaItem(row));
    if (!list.length) return;
    const index = Math.max(0, list.findIndex((row) => row.id === item?.id));
    setStills(list);
    setStillIndex(index);
    setLightboxOpen(true);
  };

  const openCover = () => {
    const coverItem = items.find((item) => item.id === cover?.id)
      || items.find((item) => item.is_cover)
      || allStills[0];
    if (!coverItem) return;
    if (isPanoramaItem(coverItem)) setPanoItem(coverItem);
    else openStill(coverItem, allStills);
  };

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  if (error || !hostel) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        {error || 'This listing is not available'}
        {status === 404 && user?.role === ROLES.OWNER && (
          <Box component="span"> If you own this PG, open Preview listing from the hostel in the ERP.</Box>
        )}
      </Alert>
    );
  }

  const hero = listingThumbSrc(cover) || listingThumbSrc(items[0]) || demoImage('exterior', hostel.id);
  const amenities = Array.isArray(hostel.amenities) ? hostel.amenities : [];
  const listingPath = `/listings/${encodeURIComponent(hostel.code || idOrSlug)}`;
  const fromRent = availability.monthly_rent_from;
  const bedsLeft = Number(availability.beds_available) || 0;
  const place = [hostel.area, hostel.city, hostel.state].filter(Boolean).join(' · ');
  const localized = localizedHostelText(hostel, locale);
  const hasHindi = Boolean(hostel.description_hi || hostel.name_hi || hostel.locales?.hi);
  const setListingLocale = (next) => {
    const value = next === 'hi' ? 'hi' : 'en';
    setLocale(value);
    storeLocale(value);
  };
  const occupancyRows = availability.roomTypes || availability.occupancy || [];
  const defaultType = occupancyRows.find((row) => (row.vacantBeds ?? row.beds_available) > 0)?.room_type
    || occupancyRows[0]?.room_type
    || '';
  const selectedType = roomType || defaultType;
  const selectedRow = occupancyRows.find((row) => row.room_type === selectedType);
  const selectedRent = selectedRow?.startingRent ?? selectedRow?.monthly_rent_from ?? fromRent;
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const sidePhotos = allStills
    .filter((item) => item.id !== cover?.id)
    .slice()
    .sort((a, b) => Number(/recategorise/i.test(a?.caption || '')) - Number(/recategorise/i.test(b?.caption || '')))
    .slice(0, 4);
  const heroSrc = getMediaUrl(hero) || demoImage('exterior', hostel.id);

  const requestBooking = async () => {
    setBookingError('');
    setBookingSaving(true);
    try {
      const { data } = await api.post('/bookings', {
        hostel_id: hostel.id,
        listing_code: hostel.code,
        room_type: selectedType,
        move_in_date: moveIn || tomorrow,
        stay_type: 'monthly',
      });
      const booking = extractData(data);
      navigate(`/bookings/${booking.id}`);
    } catch (err) {
      setBookingError(getErrorMessage(err));
    } finally {
      setBookingSaving(false);
    }
  };

  const joinWaitlist = async (type) => {
    const room = type || selectedType;
    if (!room) return;
    setWaitlistSaving(room);
    try {
      await api.post('/waitlists', {
        hostel_id: hostel.id,
        room_type: room,
        notify_email: true,
      });
      setWaitlistTypes((prev) => (prev.includes(room) ? prev : [...prev, room]));
      enqueueSnackbar('We will email you when a bed opens (expires in 30 days)', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setWaitlistSaving('');
    }
  };

  const cta = preview
    ? { label: 'Preview only', to: null, hint: 'Seekers cannot open this page until you publish.' }
    : isSeeker
      ? { label: hostel.booking_badge || 'Request to book', to: null, hint: hostel.booking_hint || 'We hold a bed so nobody else can take it. The PG still has to confirm.' }
      : isAuthenticated
        ? { label: 'Open ERP', to: '/dashboard', hint: 'Guests book from a guest account, not staff login.' }
        : { label: 'Create account to book', to: `/account/register?next=${encodeURIComponent(listingPath)}`, hint: 'Sign in if you already have a guest account.' };

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${listingPath}`
    : listingPath;
  const unfurlUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/public/listings/${encodeURIComponent(hostel.code || idOrSlug)}/share`
    : shareUrl;
  const coverShareUrl = absAsset(seo.share_image || cover?.url || cover?.thumb_url);
  const priceLabel = fromRent != null ? `From ${formatCurrency(fromRent)}/month` : null;
  const shareText = [
    `${localized.name || hostel.name}${place ? ` · ${place}` : ''}`,
    priceLabel,
    coverShareUrl,
  ].filter(Boolean).join('\n');
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${unfurlUrl}`)}`;
  const mobileShare = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && window.matchMedia?.('(pointer: coarse)').matches;

  const shareListing = async (event) => {
    event?.preventDefault?.();
    if (mobileShare) {
      try {
        await navigator.share({
          title: localized.name || hostel.name,
          text: shareText,
          url: unfurlUrl,
        });
        if (!preview) trackListingEvent(idOrSlug, 'listing_share_native');
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    window.open(whatsappHref, '_blank', 'noopener,noreferrer');
    if (!preview) trackListingEvent(idOrSlug, 'listing_share_whatsapp');
  };

  const copyShareLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      enqueueSnackbar('Link copied', { variant: 'success' });
      if (!preview) trackListingEvent(idOrSlug, 'listing_share_copy');
    } catch {
      enqueueSnackbar('Could not copy link', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ pb: { xs: 10, lg: 0 } }}>
      {preview && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {tPublic(locale, 'previewOnly')}
        </Alert>
      )}

      {/* Title row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: '"Syne", "DM Sans", sans-serif',
              fontWeight: 800,
              fontSize: { xs: '1.55rem', md: '2rem' },
              letterSpacing: '-0.03em',
              color: brand.navy,
              lineHeight: 1.15,
            }}
          >
            {localized.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.75, color: 'text.secondary', flexWrap: 'wrap' }}>
            <PlaceOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography variant="body2">{place || 'PG & hostel'}</Typography>
            {hostel.gender_policy && (
              <Typography variant="body2">· {genderLabel(hostel.gender_policy)}</Typography>
            )}
          </Box>
        </Box>
        {!preview && <SaveListingButton hostelId={hostel.id} code={hostel.code} />}
        <Tooltip title="Share on WhatsApp">
          <IconButton
            aria-label="Share on WhatsApp"
            onClick={shareListing}
            sx={{ color: '#128C7E' }}
          >
            <WhatsAppIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Copy link">
          <IconButton aria-label="Copy listing link" onClick={copyShareLink} sx={{ color: brand.navy }}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Hero media mosaic */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: sidePhotos.length ? '1.6fr 1fr' : '1fr' },
          gap: 1,
          mb: 2.5,
          height: { xs: 240, md: 420 },
          borderRadius: 2.5,
          overflow: 'hidden',
          border: `1px solid ${alpha(brand.navy, 0.08)}`,
          bgcolor: alpha(brand.navy, 0.06),
        }}
      >
        <Box
          component="button"
          type="button"
          onClick={openCover}
          aria-label={cover?.alt || cover?.caption || `Open ${hostel.name} cover photo`}
          sx={{
            position: 'relative',
            display: 'block',
            width: '100%',
            height: '100%',
            p: 0,
            border: 0,
            cursor: 'pointer',
            bgcolor: 'transparent',
            overflow: 'hidden',
            '&:focus-visible': { outline: `2px solid ${brand.teal}`, outlineOffset: 2 },
          }}
        >
          <Box
            component="img"
            src={heroSrc}
            alt={cover?.alt || cover?.caption || `${hostel.name} cover`}
            onError={(event) => swapBrokenPhoto(event, cover, hostel.id)}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {allStills.length > 0 && (
            <Chip
              icon={<PhotoLibraryOutlinedIcon />}
              label={`${allStills.length} photos`}
              size="small"
              onClick={(e) => { e.stopPropagation(); openCover(); }}
              sx={{ position: 'absolute', right: 12, bottom: 12, bgcolor: '#fff', fontWeight: 700 }}
            />
          )}
        </Box>
        {sidePhotos.length > 0 && (
          <Box
            sx={{
              display: { xs: 'none', md: 'grid' },
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 1,
              height: '100%',
              minHeight: 0,
            }}
          >
            {sidePhotos.map((item, index) => (
              <Box
                key={item.id || index}
                component="button"
                type="button"
                onClick={() => openStill(item)}
                sx={{
                  p: 0,
                  border: 0,
                  cursor: 'pointer',
                  bgcolor: 'transparent',
                  overflow: 'hidden',
                  minHeight: 0,
                  height: '100%',
                  '&:focus-visible': { outline: `2px solid ${brand.teal}` },
                }}
              >
                <Box
                  component="img"
                  src={getMediaUrl(listingThumbSrc(item)) || demoImage(photoKind(item), hostel.id + index + 1)}
                  alt={item.alt || item.caption || ''}
                  onError={(event) => swapBrokenPhoto(event, item, hostel.id + index + 1)}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(300px, 0.9fr)' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            <BookingModelBadge
              bookingModel={hostel.booking_model}
              badge={hostel.booking_badge}
              hint={hostel.booking_hint}
              size="medium"
            />
            <VerifiedBadge verified={hostel.vita_verified} size="medium" />
            <Chip label={tPublic(locale, 'bedsLeft', bedsLeft)} sx={{ fontWeight: 700 }} />
            {availability.daily_rent != null && (
              <Chip variant="outlined" label={`${formatCurrency(availability.daily_rent)} / night`} />
            )}
            {hasHindi && (
              <Chip
                clickable
                color={locale === 'hi' ? 'primary' : 'default'}
                variant={locale === 'hi' ? 'filled' : 'outlined'}
                label={tPublic(locale, 'hindi')}
                onClick={() => setListingLocale(locale === 'hi' ? 'en' : 'hi')}
                sx={{ fontWeight: 700 }}
              />
            )}
            {!hasHindi && (
              <Chip
                clickable
                variant="outlined"
                label={locale === 'hi' ? tPublic(locale, 'english') : tPublic(locale, 'hindi')}
                onClick={() => setListingLocale(locale === 'hi' ? 'en' : 'hi')}
                sx={{ fontWeight: 700 }}
              />
            )}
          </Box>

          {localized.description && (
            <Box sx={sectionCard}>
              <Typography fontWeight={800} sx={{ color: brand.navy, mb: 1, letterSpacing: '-0.02em' }}>{tPublic(locale, 'about')}</Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.65 }}>{localized.description}</Typography>
              {hostel.description_origin === 'llm' && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  {tPublic(locale, 'aiDescription')}
                </Typography>
              )}
            </Box>
          )}

          <Box sx={{ ...sectionCard, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
            <Fact label="Guest gender" value={genderLabel(rules.gender_policy || hostel.gender_policy)} />
            <Fact label="Security deposit" value={formatCurrency(rules.security_deposit ?? hostel.security_deposit)} />
            <Fact
              label="Notice period"
              value={
                (rules.notice_period_months ?? hostel.notice_period_months)
                  ? `${rules.notice_period_months ?? hostel.notice_period_months} ${(Number(rules.notice_period_months ?? hostel.notice_period_months) === 1) ? 'month' : 'months'}`
                  : '—'
              }
            />
            <Fact
              label="Location"
              value={(
                <Box component="span" sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                  <Typography fontWeight={700} component="span" sx={{ color: brand.navy }}>
                    {[hostel.city, hostel.pincode].filter(Boolean).join(' · ') || hostel.city || '—'}
                  </Typography>
                  {hostel.city && (
                    <Button
                      component={RouterLink}
                      to={pgPath(hostel.city, hostel.area)}
                      size="small"
                      sx={{ textTransform: 'none', minWidth: 0, p: 0, fontWeight: 700 }}
                    >
                      More PGs here
                    </Button>
                  )}
                </Box>
              )}
            />
          </Box>

          {amenities.length > 0 && (
            <Box sx={sectionCard}>
              <Typography fontWeight={800} sx={{ color: brand.navy, mb: 1.25, letterSpacing: '-0.02em' }}>Amenities</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
                {amenities.map((amenity) => (
                  <Box key={amenity} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 18, color: brand.tealDark }} />
                    <Typography variant="body2" fontWeight={600}>{amenity}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <VisitBookPanel idOrSlug={idOrSlug} listingPath={listingPath} preview={preview} />

          {occupancyRows.length > 0 && (
            <Box sx={sectionCard}>
              <Typography fontWeight={800} sx={{ color: brand.navy, mb: 1.25, letterSpacing: '-0.02em' }}>Room types</Typography>
              <Box sx={{ display: 'grid', gap: 1 }}>
                {occupancyRows.map((row) => {
                  const vacant = Number(row.vacantBeds ?? row.beds_available) || 0;
                  const rent = row.startingRent ?? row.monthly_rent_from;
                  const full = row.full === true || vacant <= 0;
                  const active = selectedType === row.room_type;
                  return (
                    <Box
                      key={row.room_type}
                      onClick={() => !full && setRoomType(row.room_type)}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: full ? alpha(brand.navy, 0.03) : active ? alpha(brand.teal, 0.08) : alpha(brand.navy, 0.02),
                        border: `1px solid ${active ? brand.teal : alpha(brand.navy, 0.08)}`,
                        opacity: full ? 0.55 : 1,
                        cursor: full ? 'default' : 'pointer',
                      }}
                    >
                      <Box>
                        <Typography fontWeight={750} sx={{ color: brand.navy }}>
                          {occupancyLabel(row.room_type)}
                          {row.is_ac ? ' AC' : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {full ? 'Full' : `${vacant} beds left`}
                          {row.beds_total ? ` · ${row.beds_total} beds` : ''}
                        </Typography>
                        {full && !preview && (
                          <Box sx={{ mt: 0.75 }}>
                            {waitlistTypes.includes(row.room_type) ? (
                              <Chip size="small" color="success" label="Notify me — on" />
                            ) : isSeeker ? (
                              <Button size="small" variant="outlined" disabled={waitlistSaving === row.room_type} onClick={(e) => { e.stopPropagation(); joinWaitlist(row.room_type); }}>
                                Notify me
                              </Button>
                            ) : (
                              <Button size="small" component={RouterLink} to={`/account/login?next=${encodeURIComponent(listingPath)}`} onClick={(e) => e.stopPropagation()}>
                                Sign in to get notified
                              </Button>
                            )}
                          </Box>
                        )}
                      </Box>
                      <Typography fontWeight={800} sx={{ color: brand.navy, fontSize: '1.05rem' }}>
                        {rent != null ? `${formatCurrency(rent)}` : '—'}
                        {rent != null && <Typography component="span" variant="caption" color="text.secondary" fontWeight={600}> / mo</Typography>}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          <Box sx={sectionCard}>
            <Typography fontWeight={800} sx={{ color: brand.navy, mb: 1.25, letterSpacing: '-0.02em' }}>{tPublic(locale, 'photos')}</Typography>
            <GalleryTabs
              hostelName={localized.name}
              items={items}
              rooms={media.rooms || {}}
              floors={media.floors || {}}
              counts={media.counts}
              selected={tab}
              onSelect={(key) => {
                setTab(key);
                if (!preview && !(isAuthenticated && !isSeeker) && key && key !== 'all') {
                  trackListingEvent(idOrSlug, 'gallery_tab', { tab: key });
                }
              }}
              onOpenStill={openStill}
              onOpenPano={(item) => {
                setPanoItem(item);
                if (!preview && !(isAuthenticated && !isSeeker) && item?.id) {
                  trackListingEvent(idOrSlug, 'pano_open', { media_id: item.id });
                }
              }}
              onOpenVideo={(item) => {
                setVideoItem(item);
                if (!preview && !(isAuthenticated && !isSeeker) && item?.id) {
                  trackListingEvent(idOrSlug, 'video_open', { media_id: item.id });
                }
              }}
            />
          </Box>
        </Box>

        {/* Sticky booking panel */}
        <Box
          sx={{
            position: { lg: 'sticky' },
            top: { lg: 88 },
            ...sectionCard,
            boxShadow: `0 12px 32px ${alpha(brand.navy, 0.08)}`,
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={700}>From</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.75rem', color: brand.navy, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {selectedRent != null
              ? formatCurrency(selectedRent)
              : fromRent != null
                ? formatCurrency(fromRent)
                : tPublic(locale, 'askPrice')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tPublic(locale, 'bedsLeft', bedsLeft)}
          </Typography>

          {isSeeker && !preview && (
            <Box sx={{ display: 'grid', gap: 1.25, mb: 1.5 }}>
              <TextField
                select
                size="small"
                label="Occupancy"
                value={selectedType}
                onChange={(event) => setRoomType(event.target.value)}
              >
                {occupancyRows.map((row) => {
                  const vacant = Number(row.vacantBeds ?? row.beds_available) || 0;
                  const rent = row.startingRent ?? row.monthly_rent_from;
                  return (
                    <MenuItem key={row.room_type} value={row.room_type} disabled={vacant <= 0}>
                      {occupancyLabel(row.room_type)}
                      {rent != null ? ` · ${formatCurrency(rent)}` : ''}
                      {vacant > 0 ? ` · ${vacant} left` : ' · full'}
                    </MenuItem>
                  );
                })}
              </TextField>
              <TextField
                size="small"
                type="date"
                label="Move-in"
                InputLabelProps={{ shrink: true }}
                value={moveIn || tomorrow}
                onChange={(event) => setMoveIn(event.target.value)}
              />
            </Box>
          )}

          {bookingError && <Alert severity="error" sx={{ mb: 1.25, borderRadius: 2 }}>{bookingError}</Alert>}

          {cta.to ? (
            <Button component={RouterLink} to={cta.to} variant="contained" fullWidth size="large" sx={{ py: 1.35, fontWeight: 800 }}>
              {cta.label}
            </Button>
          ) : isSeeker && !preview ? (
            <>
              <Button
                variant="contained"
                fullWidth
                size="large"
                disabled={bookingSaving || bedsLeft <= 0 || !selectedType}
                onClick={requestBooking}
                sx={{ py: 1.35, fontWeight: 800 }}
              >
                {cta.label}
              </Button>
              {bedsLeft <= 0 && selectedType && (
                <Button
                  fullWidth
                  sx={{ mt: 1 }}
                  variant="outlined"
                  disabled={waitlistSaving === selectedType || waitlistTypes.includes(selectedType)}
                  onClick={() => joinWaitlist(selectedType)}
                >
                  {waitlistTypes.includes(selectedType) ? 'Notify me — on' : 'Notify me when a bed opens'}
                </Button>
              )}
            </>
          ) : (
            <Button variant="contained" fullWidth size="large" disabled sx={{ py: 1.35 }}>{cta.label}</Button>
          )}

          {!preview && !isSeeker && !isAuthenticated && (
            <Button
              component={RouterLink}
              to={`/account/login?next=${encodeURIComponent(listingPath)}`}
              fullWidth
              variant="outlined"
              sx={{ mt: 1 }}
            >
              Sign in
            </Button>
          )}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.25, lineHeight: 1.5 }}>
            {cta.hint}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: { xs: 'flex', lg: 'none' },
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          pb: 'calc(12px + env(safe-area-inset-bottom))',
          bgcolor: '#fff',
          borderTop: `1px solid ${alpha(brand.navy, 0.1)}`,
          boxShadow: `0 -8px 24px ${alpha(brand.navy, 0.08)}`,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, color: brand.navy, lineHeight: 1.1 }}>
            {selectedRent != null ? formatCurrency(selectedRent) : fromRent != null ? formatCurrency(fromRent) : tPublic(locale, 'askPrice')}
          </Typography>
          <Typography variant="caption" color="text.secondary">{tPublic(locale, 'bedsLeft', bedsLeft)}</Typography>
        </Box>
        {cta.to ? (
          <Button component={RouterLink} to={cta.to} variant="contained" sx={{ fontWeight: 800, flexShrink: 0 }}>
            {cta.label}
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={!isSeeker || preview || bookingSaving || bedsLeft <= 0 || !selectedType}
            onClick={isSeeker && !preview ? requestBooking : undefined}
            sx={{ fontWeight: 800, flexShrink: 0 }}
          >
            {cta.label}
          </Button>
        )}
      </Box>

      <SimilarListingsCarousel idOrSlug={idOrSlug} preview={preview} />

      <PhotoLightbox
        open={lightboxOpen}
        items={stills}
        index={stillIndex}
        onIndex={setStillIndex}
        onClose={() => setLightboxOpen(false)}
        hostelName={hostel.name}
      />

      <PanoramaViewer
        open={Boolean(panoItem)}
        url={panoItem ? getMediaUrl(panoItem.url) : ''}
        stillUrl={panoItem ? getMediaUrl(panoItem.thumb_url || panoItem.url) : ''}
        caption={panoItem?.caption || panoItem?.alt || '360°'}
        context={panoItem ? panoramaContext(panoItem) : ''}
        onClose={() => setPanoItem(null)}
      />
      <WalkthroughVideoPlayer
        open={Boolean(videoItem)}
        item={videoItem}
        onClose={() => setVideoItem(null)}
      />
    </Box>
  );
};

export default ListingPage;
