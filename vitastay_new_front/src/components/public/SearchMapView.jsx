/**
 * BIC-024 — Google Maps clustered pins. Uses hostel latitude/longitude only.
 * Without VITE_GOOGLE_MAPS_API_KEY, parent shows the list fallback.
 */
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography, alpha } from '@mui/material';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { brand } from '../../styles/theme';
import { formatCurrency } from '../../utils/constants';
import { listingCoverSrc, demoImage } from '../../utils/demoImages';
import { googleMapsKey } from '../../utils/mapConfig';

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

const SearchMapView = ({ pins = [], loading }) => {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const clustererRef = useRef(null);
  const markersRef = useRef([]);
  const [active, setActive] = useState(null);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const key = googleMapsKey();
    if (!key || !mapRef.current) return undefined;

    const boot = async () => {
      try {
        setOptions({ key, v: 'weekly' });
        const mapsLib = await importLibrary('maps');
        const { LatLngBounds } = await importLibrary('core');
        if (cancelled || !mapRef.current) return;

        if (!mapObj.current) {
          mapObj.current = new mapsLib.Map(mapRef.current, {
            center: INDIA_CENTER,
            zoom: 5,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          });
        }

        const map = mapObj.current;
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        if (clustererRef.current) {
          clustererRef.current.clearMarkers();
          clustererRef.current.setMap(null);
          clustererRef.current = null;
        }

        const bounds = new LatLngBounds();
        const markers = pins.map((pin) => {
          const position = { lat: pin.latitude, lng: pin.longitude };
          bounds.extend(position);
          const marker = new google.maps.Marker({
            position,
            title: pin.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: brand.teal,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });
          marker.addListener('click', () => setActive(pin));
          return marker;
        });
        markersRef.current = markers;

        if (markers.length) {
          clustererRef.current = new MarkerClusterer({ map, markers });
          if (markers.length === 1) {
            map.setCenter(bounds.getCenter());
            map.setZoom(14);
          } else {
            map.fitBounds(bounds, 48);
          }
        }
        if (!cancelled) setMapError('');
      } catch (err) {
        if (!cancelled) setMapError(err?.message || 'Could not load Google Maps');
      }
    };

    boot();
    return () => { cancelled = true; };
  }, [pins]);

  const cover = active ? listingCoverSrc(active) : null;

  return (
    <Box sx={{ position: 'relative', borderRadius: 2.5, overflow: 'hidden', border: `1px solid ${alpha(brand.navy, 0.1)}` }}>
      {mapError && (
        <Box sx={{ p: 2, bgcolor: alpha('#D32F2F', 0.08), color: '#9B1C1C', fontWeight: 600 }}>
          {mapError}
        </Box>
      )}
      <Box
        ref={mapRef}
        sx={{
          width: '100%',
          height: { xs: 420, md: 560 },
          bgcolor: alpha(brand.navy, 0.06),
        }}
      />
      {loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: alpha('#fff', 0.5) }}>
          <Typography fontWeight={700} sx={{ color: brand.navy }}>Loading map…</Typography>
        </Box>
      )}
      {!loading && !pins.length && !mapError && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <Box sx={{ bgcolor: '#fff', px: 2, py: 1.25, borderRadius: 2, boxShadow: 2 }}>
            <Typography fontWeight={700} sx={{ color: brand.navy }}>No mapped PGs for these filters</Typography>
            <Typography variant="body2" color="text.secondary">
              Pins need latitude/longitude on the hostel. We do not guess coordinates.
            </Typography>
          </Box>
        </Box>
      )}
      {active && (
        <Box
          sx={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            right: { xs: 12, sm: 'auto' },
            width: { sm: 300 },
            bgcolor: '#fff',
            borderRadius: 2,
            boxShadow: `0 12px 28px ${alpha(brand.navyDark, 0.22)}`,
            overflow: 'hidden',
            border: `1px solid ${alpha(brand.navy, 0.1)}`,
          }}
        >
          <Box
            component="img"
            src={cover}
            alt=""
            onError={(event) => { event.currentTarget.src = demoImage('exterior', active.id); }}
            sx={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
          />
          <Box sx={{ p: 1.5 }}>
            <Typography fontWeight={800} sx={{ color: brand.navy, lineHeight: 1.25 }}>{active.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
              {[active.area, active.city].filter(Boolean).join(', ') || 'PG & hostel'}
            </Typography>
            <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>
              {active.monthly_rent != null ? `From ${formatCurrency(active.monthly_rent)} / mo` : 'See listing'}
              {active.beds_available != null ? ` · ${active.beds_available} beds left` : ''}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                component={RouterLink}
                to={`/listings/${encodeURIComponent(active.code || active.id)}`}
                variant="contained"
                size="small"
                sx={{ fontWeight: 700 }}
              >
                View
              </Button>
              <Button size="small" onClick={() => setActive(null)}>Close</Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default SearchMapView;
