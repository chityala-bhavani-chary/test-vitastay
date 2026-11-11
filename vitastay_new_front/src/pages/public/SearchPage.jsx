/**
 * Guest PG search — hotel-booking layout on GET /public/listings.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Checkbox, Chip, Drawer, FormControlLabel, IconButton, MenuItem,
  Pagination, Rating, Slider, TextField, Typography, alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import WcOutlinedIcon from '@mui/icons-material/WcOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import DirectionsTransitOutlinedIcon from '@mui/icons-material/DirectionsTransitOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import api, { extractData, getErrorMessage } from '../../services/api';
import {
  AMENITY_OPTIONS,
  ESSENTIAL_FILTER_OPTIONS,
  GENDER_POLICY_OPTIONS,
  OCCUPANCY_OPTIONS,
  formatCurrency,
} from '../../utils/constants';
import { brand } from '../../styles/theme';
import { useSnackbar } from 'notistack';
import { listingCoverSrc, demoImage } from '../../utils/demoImages';
import SaveListingButton from '../../components/public/SaveListingButton';
import BookingModelBadge from '../../components/public/BookingModelBadge';
import SearchMapView from '../../components/public/SearchMapView';
import useCompareSelection from '../../hooks/useCompareSelection';
import useAuth from '../../hooks/useAuth';
import { hasMapKey, googleMapsKey, mapplsKey } from '../../utils/mapConfig';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';

const OFFICE_LS_KEY = 'vitastay_my_office';

const emptyFilters = {
  city: '',
  area: '',
  q: '',
  commute: '',
  min_rent: '',
  max_rent: '',
  occupancy: '',
  gender: '',
  food: '',
  ac: '',
  attached_bath: '',
  amenities: '',
  move_in: '',
  stay_mode: '',
  sort: '',
};

const BUDGET_MAX = 50000;
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'transparent',
    fontWeight: 650,
    color: brand.navy,
    '& fieldset': { border: 'none' },
    '& input, & .MuiSelect-select': { py: 0.4, px: 0, fontWeight: 650 },
  },
  '& .MuiInputLabel-root': { display: 'none' },
};

const fromParams = (params) => {
  const next = { ...emptyFilters };
  Object.keys(emptyFilters).forEach((key) => {
    next[key] = params.get(key) || '';
  });
  return next;
};

const genderLabel = (value) =>
  GENDER_POLICY_OPTIONS.find((row) => row.value === value)?.label || value;

const occupancyLabel = (value) =>
  OCCUPANCY_OPTIONS.find((row) => row.value === value)?.label || value;

const amenityList = (raw) => String(raw || '').split(',').map((part) => part.trim()).filter(Boolean);

const SearchField = ({ icon: Icon, label, children, last }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      px: 1.75,
      py: 0.75,
      minWidth: 0,
      flex: 1,
      borderRight: { xs: 0, md: last ? 0 : `1px solid ${alpha(brand.navy, 0.1)}` },
      borderBottom: { xs: last ? 0 : `1px solid ${alpha(brand.navy, 0.08)}`, md: 0 },
    }}
  >
    <Icon sx={{ color: brand.tealDark, fontSize: 22, flexShrink: 0 }} />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: alpha(brand.navy, 0.5), lineHeight: 1 }}>
        {label}
      </Typography>
      {children}
    </Box>
  </Box>
);

const ResultCard = ({ item, compareSelected, onToggleCompare, commute }) => {
  const cover = listingCoverSrc(item);
  const to = `/listings/${encodeURIComponent(item.code || item.id)}`;
  const place = [item.area, item.city, item.state].filter(Boolean).join(', ');
  const amenities = (item.amenities || []).slice(0, 5);
  const lowStock = item.beds_available > 0 && item.beds_available <= 3;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '240px minmax(0, 1fr) 180px' },
        bgcolor: '#fff',
        borderRadius: 2.5,
        overflow: 'hidden',
        color: 'inherit',
        border: `1px solid ${compareSelected ? brand.teal : alpha(brand.navy, 0.08)}`,
        boxShadow: `0 1px 2px ${alpha(brand.navy, 0.04)}, 0 8px 24px ${alpha(brand.navy, 0.05)}`,
        transition: 'transform 160ms ease, box-shadow 160ms ease',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 10px 28px ${alpha(brand.navy, 0.12)}`,
        },
      }}
    >
      <FormControlLabel
        onClick={(event) => event.stopPropagation()}
        control={(
          <Checkbox
            checked={compareSelected}
            onChange={() => onToggleCompare?.(item.id)}
            size="small"
            sx={{ color: brand.navy, '&.Mui-checked': { color: brand.teal } }}
          />
        )}
        label="Compare"
        sx={{
          position: 'absolute',
          left: 8,
          bottom: { xs: 'auto', sm: 8 },
          top: { xs: 48, sm: 'auto' },
          zIndex: 2,
          m: 0,
          px: 0.75,
          py: 0.15,
          borderRadius: 1,
          bgcolor: 'rgba(255,255,255,0.94)',
          '& .MuiFormControlLabel-label': { fontSize: '0.75rem', fontWeight: 700, color: brand.navy },
        }}
      />
      <Box
        component={RouterLink}
        to={to}
        sx={{
          position: 'relative',
          minHeight: { xs: 200, sm: 210 },
          bgcolor: alpha(brand.navy, 0.08),
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
        }}
      >
        <Box
          component="img"
          src={cover}
          alt=""
          onError={(event) => { event.currentTarget.src = demoImage('exterior', item.id); }}
          sx={{
            width: '100%',
            height: { xs: 200, sm: '100%' },
            objectFit: 'cover',
            display: 'block',
            position: { sm: 'absolute' },
            inset: { sm: 0 },
          }}
        />
        <Chip
          size="small"
          label={item.beds_available > 0 ? `${item.beds_available} beds left` : 'Fully occupied'}
          sx={{
            position: 'absolute',
            left: 10,
            top: 10,
            fontWeight: 700,
            bgcolor: item.beds_available > 0 ? '#fff' : alpha('#000', 0.7),
            color: item.beds_available > 0 ? brand.navy : '#fff',
          }}
        />
        <SaveListingButton
          hostelId={item.id}
          code={item.code}
          size="small"
          sx={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}
        />
      </Box>

      <Box
        component={RouterLink}
        to={to}
        sx={{
          p: { xs: 1.75, sm: 2 },
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <Typography fontWeight={800} sx={{ color: brand.navy, fontSize: '1.15rem', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
          {item.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.4, color: 'text.secondary' }}>
          <PlaceOutlinedIcon sx={{ fontSize: 16 }} />
          <Typography variant="body2" noWrap>{place || 'PG & hostel'}</Typography>
        </Box>
        {commute?.status === 'ok' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.55, color: brand.tealDark }}>
            <DirectionsTransitOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography variant="body2" fontWeight={700}>
              {commute.duration_text}
              {commute.distance_text ? ` · ${commute.distance_text}` : ''}
              {' '}to commute
            </Typography>
          </Box>
        )}
        {commute?.status === 'unavailable' && (
          <Typography variant="caption" sx={{ mt: 0.55, color: 'text.secondary', fontWeight: 600 }}>
            {commute.message || 'Travel time unavailable'}
          </Typography>
        )}
        {item.rating_count > 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.85 }}>
            <Box sx={{ bgcolor: brand.navy, color: '#fff', px: 0.75, py: 0.15, borderRadius: 1, fontWeight: 800, fontSize: '0.8rem' }}>
              {Number(item.rating_avg).toFixed(1)}
            </Box>
            <Rating value={Number(item.rating_avg) || 0} precision={0.1} readOnly size="small" />
            <Typography variant="caption" color="text.secondary">{item.rating_count} reviews</Typography>
          </Box>
        ) : (
          <Typography variant="caption" sx={{ mt: 0.85, color: brand.tealDark, fontWeight: 700 }}>
            Newly listed
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1.25 }}>
          {item.has_food && <Chip size="small" label="Food" sx={{ bgcolor: alpha(brand.teal, 0.12), fontWeight: 700 }} />}
          {item.has_ac && <Chip size="small" label="AC" sx={{ bgcolor: alpha(brand.teal, 0.12), fontWeight: 700 }} />}
          {item.has_attached_bath && <Chip size="small" label="Attached bath" sx={{ bgcolor: alpha(brand.teal, 0.12), fontWeight: 700 }} />}
          {amenities.map((name) => (
            <Chip key={name} size="small" label={name} sx={{ bgcolor: alpha(brand.navy, 0.05), fontWeight: 600 }} />
          ))}
          {(item.roomTypes || []).length > 0
            ? (item.roomTypes || []).slice(0, 4).map((row) => {
              const vacant = Number(row.vacantBeds ?? row.beds_available) || 0;
              const rent = row.startingRent ?? row.monthly_rent_from;
              const full = row.full === true || vacant <= 0;
              const rentBit = rent != null ? ` ${formatCurrency(rent)}` : '';
              const leftBit = full ? ' · full' : ` · ${vacant} left`;
              return (
                <Chip
                  key={row.room_type}
                  size="small"
                  variant="outlined"
                  label={`${occupancyLabel(row.room_type)}${rentBit}${leftBit}`}
                  sx={{
                    opacity: full ? 0.45 : 1,
                    fontWeight: 600,
                    textDecoration: full ? 'line-through' : 'none',
                  }}
                />
              );
            })
            : (item.occupancy_types || []).slice(0, 3).map((type) => (
              <Chip key={type} size="small" variant="outlined" label={occupancyLabel(type)} />
            ))}
        </Box>
        <Box sx={{ mt: 'auto', pt: 1.25, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            {genderLabel(item.gender_policy)}
          </Typography>
          <BookingModelBadge
            bookingModel={item.booking_model}
            badge={item.booking_badge}
            hint={item.booking_hint}
          />
          {item.vita_verified && (
            <Chip size="small" color="success" label="Vita Stay verified" sx={{ fontWeight: 700 }} />
          )}
          {item.has_360 === false && (
            <Chip size="small" variant="outlined" color="warning" label="No 360 yet" />
          )}
          {lowStock && (
            <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 800 }}>
              Only {item.beds_available} left
            </Typography>
          )}
        </Box>
      </Box>

      <Box
        component={RouterLink}
        to={to}
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          justifyContent: 'center',
          gap: 0.5,
          bgcolor: { sm: alpha(brand.navy, 0.03) },
          borderTop: { xs: `1px solid ${alpha(brand.navy, 0.08)}`, sm: 0 },
          borderLeft: { sm: `1px solid ${alpha(brand.navy, 0.06)}` },
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={700}>From</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.45rem', color: brand.navy, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {item.monthly_rent != null ? formatCurrency(item.monthly_rent) : 'On request'}
        </Typography>
        <Typography variant="caption" color="text.secondary">per month</Typography>
        {item.daily_rent != null && (
          <Typography variant="caption" color="text.secondary">{formatCurrency(item.daily_rent)} / night</Typography>
        )}
        <Box
          sx={{
            mt: 1.25,
            px: 2,
            py: 1,
            borderRadius: 999,
            bgcolor: brand.navy,
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            width: { xs: '100%', sm: 'auto' },
            justifyContent: 'center',
          }}
        >
          See rooms
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </Box>
      </Box>
    </Box>
  );
};

const FilterPanel = ({ filters, onPatch, onClear }) => {
  const selectedAmenities = amenityList(filters.amenities);
  const minVal = filters.min_rent === '' ? 0 : Number(filters.min_rent);
  const maxVal = filters.max_rent === '' ? BUDGET_MAX : Number(filters.max_rent);

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        label="Commute to office / college"
        placeholder="e.g. Manyata Tech Park"
        value={filters.commute || ''}
        onChange={(e) => onPatch({ commute: e.target.value }, false)}
        onBlur={() => onPatch({ commute: filters.commute }, true)}
        sx={{ mb: 2 }}
        helperText="Optional. We show travel time only when the maps API succeeds."
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography fontWeight={800} sx={{ color: brand.navy }}>Filter by</Typography>
        <Button size="small" onClick={onClear}>Clear all</Button>
      </Box>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Budget / month</Typography>
      <Slider
        value={[minVal, maxVal]}
        min={0}
        max={BUDGET_MAX}
        step={1000}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => formatCurrency(value)}
        onChange={(_, value) => onPatch({
          min_rent: value[0] <= 0 ? '' : String(value[0]),
          max_rent: value[1] >= BUDGET_MAX ? '' : String(value[1]),
        }, false)}
        onChangeCommitted={(_, value) => onPatch({
          min_rent: value[0] <= 0 ? '' : String(value[0]),
          max_rent: value[1] >= BUDGET_MAX ? '' : String(value[1]),
        })}
        sx={{ color: brand.teal, mb: 0.5 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
        {formatCurrency(minVal)} – {maxVal >= BUDGET_MAX ? `${formatCurrency(BUDGET_MAX)}+` : formatCurrency(maxVal)}
      </Typography>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Room type</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
        {OCCUPANCY_OPTIONS.map((row) => (
          <Chip
            key={row.value}
            label={row.label}
            clickable
            color={filters.occupancy === row.value ? 'primary' : 'default'}
            variant={filters.occupancy === row.value ? 'filled' : 'outlined'}
            onClick={() => onPatch({ occupancy: filters.occupancy === row.value ? '' : row.value })}
          />
        ))}
      </Box>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Who stays</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
        {GENDER_POLICY_OPTIONS.map((row) => (
          <Chip
            key={row.value}
            label={row.label}
            clickable
            color={filters.gender === row.value ? 'primary' : 'default'}
            variant={filters.gender === row.value ? 'filled' : 'outlined'}
            onClick={() => onPatch({ gender: filters.gender === row.value ? '' : row.value })}
          />
        ))}
      </Box>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Essentials</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        Gender is hostel policy (who may stay), not a person&apos;s gender. Food / AC / attached bath are indexed filters.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
        {ESSENTIAL_FILTER_OPTIONS.map((row) => {
          const on = filters[row.param] === '1' || filters[row.param] === 'true';
          return (
            <Chip
              key={row.key}
              label={row.label}
              clickable
              color={on ? 'primary' : 'default'}
              variant={on ? 'filled' : 'outlined'}
              onClick={() => onPatch({ [row.param]: on ? '' : '1' })}
            />
          );
        })}
      </Box>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>Amenities</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {AMENITY_OPTIONS.map((name) => (
          <FormControlLabel
            key={name}
            control={(
              <Checkbox
                size="small"
                checked={selectedAmenities.includes(name)}
                onChange={() => {
                  const next = selectedAmenities.includes(name)
                    ? selectedAmenities.filter((row) => row !== name)
                    : [...selectedAmenities, name];
                  onPatch({ amenities: next.join(',') });
                }}
              />
            )}
            label={<Typography variant="body2">{name}</Typography>}
          />
        ))}
      </Box>
    </Box>
  );
};

const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { isSeeker, isAuthenticated } = useAuth();
  const compare = useCompareSelection();
  const [filters, setFilters] = useState(() => fromParams(params));
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // list | map
  const [mapPins, setMapPins] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapMeta, setMapMeta] = useState({ total: 0, skipped_no_coords: 0 });
  const [commuteById, setCommuteById] = useState({});
  const [commuteMeta, setCommuteMeta] = useState({ loading: false, message: '', configured: true });
  const [savingOffice, setSavingOffice] = useState(false);
  const queryKey = useMemo(() => params.toString(), [params]);
  const mapReady = hasMapKey() && Boolean(googleMapsKey());
  const commuteQuery = (params.get('commute') || '').trim();

  const onToggleCompare = (hostelId) => {
    const result = compare.toggle(hostelId);
    if (result.full) {
      enqueueSnackbar(`Compare up to ${compare.max} PGs`, { variant: 'warning' });
    }
  };

  const setView = (mode) => {
    if (mode === 'map' && !mapReady) {
      enqueueSnackbar(
        mapplsKey()
          ? 'Mappls key is set; this build clusters with Google Maps. Add VITE_GOOGLE_MAPS_API_KEY.'
          : 'Add VITE_GOOGLE_MAPS_API_KEY to enable the map. Showing the list instead.',
        { variant: 'info' }
      );
      setViewMode('list');
      return;
    }
    setViewMode(mode);
  };

  useEffect(() => {
    document.title = 'Find a PG · Vita Stay';
    return () => { document.title = 'Vita Stay | Hostel Management'; };
  }, []);

  useEffect(() => {
    setFilters(fromParams(params));
  }, [queryKey]);

  useEffect(() => {
    if (params.get('commute')) return undefined;
    let cancelled = false;
    const hydrateOffice = async () => {
      try {
        if (isAuthenticated && isSeeker) {
          const { data } = await api.get('/commute/office');
          const office = extractData(data)?.office;
          if (cancelled || !office) return;
          const label = office.address || office.label;
          if (label) setFilters((prev) => (prev.commute ? prev : { ...prev, commute: label }));
          return;
        }
        const raw = localStorage.getItem(OFFICE_LS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const label = parsed?.address || parsed?.label;
        if (!cancelled && label) {
          setFilters((prev) => (prev.commute ? prev : { ...prev, commute: label }));
        }
      } catch {
        /* ignore */
      }
    };
    hydrateOffice();
    return () => { cancelled = true; };
  }, [isAuthenticated, isSeeker, params]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const query = { page: params.get('page') || 1, limit: 12 };
        Object.keys(emptyFilters).forEach((key) => {
          const value = params.get(key);
          if (value) query[key] = value;
        });
        const { data } = await api.get('/public/listings', { params: query });
        if (cancelled) return;
        const payload = extractData(data) || {};
        const paging = data.pagination || {};
        setItems(payload.items || []);
        setPagination({
          page: paging.page || 1,
          limit: paging.limit || 12,
          total: paging.total || 0,
          totalPages: paging.totalPages || Math.ceil((paging.total || 0) / (paging.limit || 12)),
        });
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [queryKey]);

  useEffect(() => {
    if (viewMode !== 'map' || !mapReady) return undefined;
    let cancelled = false;
    const run = async () => {
      setMapLoading(true);
      try {
        const query = {};
        Object.keys(emptyFilters).forEach((key) => {
          const value = params.get(key);
          if (value) query[key] = value;
        });
        const { data } = await api.get('/public/listings/map', { params: query });
        if (cancelled) return;
        const payload = extractData(data) || {};
        setMapPins(payload.pins || []);
        setMapMeta({
          total: payload.total || 0,
          skipped_no_coords: payload.skipped_no_coords || 0,
        });
      } catch (err) {
        if (!cancelled) {
          setMapPins([]);
          enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
        }
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [viewMode, mapReady, queryKey, enqueueSnackbar, params]);

  useEffect(() => {
    if (!commuteQuery || !items.length) {
      setCommuteById({});
      setCommuteMeta({ loading: false, message: '', configured: true });
      return undefined;
    }
    let cancelled = false;
    const run = async () => {
      setCommuteMeta({ loading: true, message: '', configured: true });
      try {
        const { data } = await api.post('/public/commute', {
          origin: commuteQuery,
          hostel_ids: items.map((row) => row.id),
          mode: 'driving',
        });
        if (cancelled) return;
        const payload = extractData(data) || {};
        const map = {};
        (payload.results || []).forEach((row) => {
          map[row.hostel_id] = row;
        });
        setCommuteById(map);
        setCommuteMeta({
          loading: false,
          configured: payload.configured !== false,
          message: payload.configured === false
            ? (payload.message || 'Travel times are not available right now.')
            : '',
        });
      } catch (err) {
        if (cancelled) return;
        setCommuteById({});
        setCommuteMeta({
          loading: false,
          configured: false,
          message: getErrorMessage(err) || 'Travel times could not be loaded.',
        });
      }
    };
    run();
    return () => { cancelled = true; };
  }, [commuteQuery, items]);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const saveMyOffice = async () => {
    const address = (filters.commute || commuteQuery || '').trim();
    if (!address) {
      enqueueSnackbar('Enter an office or college first', { variant: 'warning' });
      return;
    }
    setSavingOffice(true);
    try {
      if (isAuthenticated && isSeeker) {
        await api.put('/commute/office', { label: 'My office', address });
        enqueueSnackbar('Saved as my office', { variant: 'success' });
      } else {
        localStorage.setItem(OFFICE_LS_KEY, JSON.stringify({ label: 'My office', address }));
        enqueueSnackbar(
          isAuthenticated ? 'Saved on this device. Seeker accounts sync to the server.' : 'Saved on this device',
          { variant: 'success' }
        );
      }
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSavingOffice(false);
    }
  };

  const commitFilters = (nextFilters = filters, { resetPage = true } = {}) => {
    const next = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (String(value || '').trim()) next.set(key, String(value).trim());
    });
    if (!resetPage && params.get('page')) next.set('page', params.get('page'));
    setParams(next);
  };

  const applyFilters = (event) => {
    event?.preventDefault?.();
    commitFilters();
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setParams(new URLSearchParams());
    setFiltersOpen(false);
  };

  const goPage = (page) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setSort = (sort) => {
    commitFilters({ ...filters, sort }, { resetPage: true });
  };

  const patchFilters = (patch, commit = true) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (commit) commitFilters(next);
  };

  const destination = filters.q || filters.city || filters.area;
  const resultLabel = pagination.total === 1 ? 'PG' : 'PGs';
  const placeHint = params.get('q') || params.get('city') || params.get('area') || 'all cities';

  const filterNode = (
    <FilterPanel
      filters={filters}
      onPatch={patchFilters}
      onClear={clearFilters}
    />
  );

  return (
    <Box>
      <Box
        sx={{
          background: `linear-gradient(135deg, ${brand.navyDark} 0%, ${brand.navy} 48%, #006B72 100%)`,
          color: '#fff',
          pt: { xs: 3, md: 4.5 },
          pb: { xs: 7, md: 8 },
          px: { xs: 2, md: 3 },
        }}
      >
        <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.7rem', md: '2.25rem' }, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            Find a PG that feels like home
          </Typography>
          <Typography sx={{ mt: 0.75, maxWidth: 560, color: alpha('#fff', 0.78), fontSize: { xs: '0.95rem', md: '1.05rem' } }}>
            Search by city, compare rent and room types, then request a bed — the same flow as booking a hotel stay.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 3 } }}>
        <Box
          component="form"
          onSubmit={applyFilters}
          sx={{
            mt: { xs: -5, md: -4.5 },
            mb: 2.5,
            bgcolor: '#fff',
            borderRadius: 3,
            boxShadow: `0 18px 40px ${alpha(brand.navyDark, 0.22)}`,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { md: 'stretch' },
            overflow: 'hidden',
          }}
        >
          <SearchField icon={PlaceOutlinedIcon} label="Where">
            <TextField
              fullWidth
              placeholder="City, area, or PG name"
              value={destination}
              onChange={(e) => {
                setFilter('q', e.target.value);
                setFilter('city', '');
                setFilter('area', '');
              }}
              sx={fieldSx}
            />
          </SearchField>
          <SearchField icon={WorkOutlineIcon} label="Commute to">
            <TextField
              fullWidth
              placeholder="Office or college (optional)"
              value={filters.commute}
              onChange={(e) => setFilter('commute', e.target.value)}
              sx={fieldSx}
            />
          </SearchField>
          <SearchField icon={CalendarMonthOutlinedIcon} label="Move-in">
            <TextField
              fullWidth
              type="date"
              value={filters.move_in}
              onChange={(e) => setFilter('move_in', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={fieldSx}
            />
          </SearchField>
          <SearchField icon={MeetingRoomOutlinedIcon} label="Room type">
            <TextField
              select
              fullWidth
              value={filters.occupancy}
              onChange={(e) => setFilter('occupancy', e.target.value)}
              SelectProps={{
                displayEmpty: true,
                renderValue: (value) => (value ? occupancyLabel(value) : 'Any occupancy'),
              }}
              sx={fieldSx}
            >
              <MenuItem value="">Any occupancy</MenuItem>
              {OCCUPANCY_OPTIONS.map((row) => (
                <MenuItem key={row.value} value={row.value}>{row.label}</MenuItem>
              ))}
            </TextField>
          </SearchField>
          <SearchField icon={WcOutlinedIcon} label="Who stays" last>
            <TextField
              select
              fullWidth
              value={filters.gender}
              onChange={(e) => setFilter('gender', e.target.value)}
              SelectProps={{
                displayEmpty: true,
                renderValue: (value) => (value ? genderLabel(value) : 'Anyone'),
              }}
              sx={fieldSx}
            >
              <MenuItem value="">Anyone</MenuItem>
              {GENDER_POLICY_OPTIONS.map((row) => (
                <MenuItem key={row.value} value={row.value}>{row.label}</MenuItem>
              ))}
            </TextField>
          </SearchField>
          <Box sx={{ p: 1.25, display: 'flex', alignItems: 'center' }}>
            <Button type="submit" variant="contained" size="large" startIcon={<SearchIcon />} sx={{ minWidth: { md: 140 }, width: { xs: '100%', md: 'auto' }, py: 1.35 }}>
              Search
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' },
            gap: 2.5,
            alignItems: 'start',
          }}
        >
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'sticky',
              top: 80,
              bgcolor: '#fff',
              borderRadius: 2.5,
              p: 2,
              border: `1px solid ${alpha(brand.navy, 0.08)}`,
            }}
          >
            {filterNode}
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <Box>
                <Typography fontWeight={800} sx={{ color: brand.navy, fontSize: '1.15rem' }}>
                  {loading ? 'Searching PGs…' : `${pagination.total} ${resultLabel} in ${placeHint}`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Compare rent, room type, and beds left before you request a stay.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<TuneIcon />}
                  onClick={() => setFiltersOpen(true)}
                  sx={{ display: { xs: 'inline-flex', md: 'none' }, bgcolor: '#fff' }}
                >
                  Filters
                </Button>
                <Button
                  size="small"
                  variant={viewMode === 'list' ? 'contained' : 'outlined'}
                  startIcon={<ViewListOutlinedIcon />}
                  onClick={() => setView('list')}
                  sx={{ bgcolor: viewMode === 'list' ? undefined : '#fff' }}
                >
                  List
                </Button>
                <Button
                  size="small"
                  variant={viewMode === 'map' ? 'contained' : 'outlined'}
                  startIcon={<MapOutlinedIcon />}
                  onClick={() => setView('map')}
                  sx={{ bgcolor: viewMode === 'map' ? undefined : '#fff' }}
                >
                  Map
                </Button>
                <TextField
                  select
                  size="small"
                  value={filters.sort || 'name'}
                  onChange={(e) => setSort(e.target.value === 'name' ? '' : e.target.value)}
                  sx={{ minWidth: 170, bgcolor: '#fff' }}
                >
                  <MenuItem value="name">Recommended</MenuItem>
                  <MenuItem value="price_asc">Price: low to high</MenuItem>
                  <MenuItem value="price_desc">Price: high to low</MenuItem>
                </TextField>
              </Box>
            </Box>

            {error && (
              <Box sx={{ bgcolor: alpha('#D32F2F', 0.08), color: '#9B1C1C', p: 2, borderRadius: 2, mb: 2, fontWeight: 600 }}>
                {error}
              </Box>
            )}

            {commuteQuery && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(brand.teal, 0.08),
                  border: `1px solid ${alpha(brand.tealDark, 0.2)}`,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <DirectionsTransitOutlinedIcon sx={{ color: brand.tealDark }} />
                <Typography variant="body2" fontWeight={700} sx={{ color: brand.navy, flex: 1 }}>
                  {commuteMeta.loading
                    ? `Checking commute to ${commuteQuery}…`
                    : commuteMeta.message
                      ? commuteMeta.message
                      : `Travel times to ${commuteQuery}`}
                </Typography>
                <Button size="small" variant="outlined" disabled={savingOffice} onClick={saveMyOffice}>
                  Save as my office
                </Button>
              </Box>
            )}

            {viewMode === 'map' && mapReady ? (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {mapLoading
                    ? 'Loading pins…'
                    : `${mapMeta.total} mapped PG${mapMeta.total === 1 ? '' : 's'}${mapMeta.skipped_no_coords ? ` · ${mapMeta.skipped_no_coords} without coordinates skipped` : ''}`}
                </Typography>
                <SearchMapView pins={mapPins} loading={mapLoading} />
              </Box>
            ) : loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[0, 1, 2].map((row) => (
                  <Box key={row} sx={{ height: 210, borderRadius: 2.5, bgcolor: alpha(brand.navy, 0.08) }} />
                ))}
              </Box>
            ) : items.length === 0 ? (
              <Box sx={{ bgcolor: '#fff', borderRadius: 2.5, p: { xs: 4, md: 6 }, textAlign: 'center', border: `1px dashed ${alpha(brand.navy, 0.2)}` }}>
                <HotelOutlinedIcon sx={{ fontSize: 48, color: alpha(brand.navy, 0.28), mb: 1 }} />
                <Typography fontWeight={800} sx={{ color: brand.navy, mb: 0.5 }}>No PGs match these filters</Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Try another city, a wider budget, or a different room type. Unpublished hostels stay off this list.
                </Typography>
                <Button variant="contained" onClick={clearFilters}>Clear filters</Button>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {items.map((item) => (
                    <ResultCard
                      key={item.id}
                      item={item}
                      compareSelected={compare.isSelected(item.id)}
                      onToggleCompare={onToggleCompare}
                      commute={commuteQuery ? commuteById[item.id] : null}
                    />
                  ))}
                </Box>
                {pagination.totalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 1 }}>
                    <Pagination
                      page={pagination.page || 1}
                      count={pagination.totalPages}
                      onChange={(_, page) => goPage(page)}
                      color="primary"
                    />
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      </Box>

      <Drawer anchor="left" open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <Box sx={{ width: 300, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography fontWeight={800}>Filters</Typography>
            <IconButton onClick={() => setFiltersOpen(false)} aria-label="Close filters"><CloseIcon /></IconButton>
          </Box>
          {filterNode}
          <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={applyFilters}>Show stays</Button>
        </Box>
      </Drawer>

      {compare.count > 0 && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 16,
            zIndex: 20,
            mx: { xs: 2, md: 3 },
            mb: 2,
            maxWidth: 1280,
            ml: 'auto',
            mr: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1.25,
            borderRadius: 2,
            bgcolor: brand.navyDark,
            color: '#fff',
            boxShadow: `0 12px 28px ${alpha(brand.navyDark, 0.35)}`,
          }}
        >
          <Typography fontWeight={700} sx={{ flex: 1 }}>
            {compare.count}/{compare.max} selected for compare
            {compare.count < 2 ? ' — pick one more' : ''}
          </Typography>
          <Button size="small" color="inherit" onClick={compare.clear}>Clear</Button>
          <Button
            component={RouterLink}
            to={compare.compareHref || '/search'}
            disabled={!compare.canCompare}
            variant="contained"
            size="small"
            sx={{ bgcolor: '#fff', color: `${brand.navy} !important`, fontWeight: 800, '&:hover': { bgcolor: brand.mist } }}
          >
            Compare
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default SearchPage;
