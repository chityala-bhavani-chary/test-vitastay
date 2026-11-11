/**
 * BIC-025 — travel time from office/college to PG via Distance Matrix.
 * Cache hits; never invent durations when the provider fails or is unset.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const { CommuteCache, Hostel, SeekerCommutePlace } = require('../models');

const MODES = new Set(['driving', 'transit', 'walking', 'bicycling']);
const MAX_HOSTELS = 40;
const MATRIX_CHUNK = 25;

const googleKey = () =>
  String(config.googleMaps?.serverKey || process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();

const useMockProvider = () =>
  process.env.COMMUTE_PROVIDER === 'mock'
  || (config.nodeEnv === 'test' && !googleKey());

const isConfigured = () => Boolean(googleKey()) || useMockProvider();

const roundCoord = (n) => Number(Number(n).toFixed(4));

const cacheKeyFor = (originLat, originLng, hostelId, mode) =>
  crypto
    .createHash('sha256')
    .update(`${mode}|${roundCoord(originLat)}|${roundCoord(originLng)}|${hostelId}`)
    .digest('hex');

const cacheTtlMs = () => {
  const hours = Math.max(1, Number(config.googleMaps?.cacheTtlHours) || 168);
  return hours * 60 * 60 * 1000;
};

const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const formatDuration = (seconds) => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} sec`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
};

const formatDistance = (meters) => {
  const m = Math.max(0, Math.round(Number(meters) || 0));
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
};

const unavailableRow = (hostelId, message) => ({
  hostel_id: hostelId,
  status: 'unavailable',
  duration_seconds: null,
  distance_meters: null,
  duration_text: null,
  distance_text: null,
  message: message || 'Travel time could not be calculated',
  cached: false,
});

const okRow = (hostelId, payload, cached = false) => ({
  hostel_id: hostelId,
  status: 'ok',
  duration_seconds: payload.duration_seconds,
  distance_meters: payload.distance_meters,
  duration_text: payload.duration_text || formatDuration(payload.duration_seconds),
  distance_text: payload.distance_text || formatDistance(payload.distance_meters),
  message: null,
  cached,
});

async function geocodeAddress(address) {
  const q = String(address || '').trim();
  if (!q) {
    const err = new Error('Office or college address is required');
    err.statusCode = 422;
    throw err;
  }

  if (useMockProvider()) {
    // Deterministic mock pin near Bangalore for tests
    const hash = crypto.createHash('md5').update(q.toLowerCase()).digest();
    const lat = 12.97 + (hash[0] / 255) * 0.08;
    const lng = 77.59 + (hash[1] / 255) * 0.08;
    return { lat, lng, label: q, formatted_address: q };
  }

  const key = googleKey();
  if (!key) {
    const err = new Error('Travel times are not configured');
    err.statusCode = 503;
    throw err;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', q);
  url.searchParams.set('key', key);
  url.searchParams.set('region', 'in');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = new Error('Geocoding request failed');
    err.statusCode = 502;
    throw err;
  }
  const body = await res.json();
  if (body.status !== 'OK' || !body.results?.[0]) {
    const err = new Error(
      body.status === 'ZERO_RESULTS'
        ? 'Could not find that office or college'
        : `Geocoding unavailable (${body.status || 'error'})`
    );
    err.statusCode = body.status === 'ZERO_RESULTS' ? 404 : 502;
    throw err;
  }
  const first = body.results[0];
  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    label: q,
    formatted_address: first.formatted_address || q,
  };
}

async function resolveOrigin(originInput) {
  if (originInput && typeof originInput === 'object' && originInput.lat != null && originInput.lng != null) {
    const lat = Number(originInput.lat);
    const lng = Number(originInput.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const err = new Error('Invalid origin coordinates');
      err.statusCode = 422;
      throw err;
    }
    return {
      lat,
      lng,
      label: String(originInput.label || originInput.address || 'Saved place').trim() || 'Saved place',
    };
  }
  const text = typeof originInput === 'string' ? originInput : originInput?.address || originInput?.label;
  const geo = await geocodeAddress(text);
  return { lat: geo.lat, lng: geo.lng, label: geo.label };
}

async function fetchMatrixRows(origin, destinations, mode) {
  if (!destinations.length) return [];

  if (useMockProvider()) {
    return destinations.map((dest) => {
      const meters = haversineMeters(origin.lat, origin.lng, dest.lat, dest.lng) * 1.35;
      const speedMps = mode === 'walking' ? 1.4 : mode === 'bicycling' ? 4.5 : mode === 'transit' ? 6 : 8.5;
      const seconds = Math.max(60, Math.round(meters / speedMps));
      return {
        hostel_id: dest.hostel_id,
        status: 'ok',
        duration_seconds: seconds,
        distance_meters: Math.round(meters),
        duration_text: formatDuration(seconds),
        distance_text: formatDistance(meters),
        message: null,
      };
    });
  }

  const key = googleKey();
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destinations', destinations.map((d) => `${d.lat},${d.lng}`).join('|'));
  url.searchParams.set('mode', mode);
  url.searchParams.set('key', key);
  url.searchParams.set('units', 'metric');
  url.searchParams.set('region', 'in');

  const res = await fetch(url.toString());
  if (!res.ok) {
    return destinations.map((d) => unavailableRow(d.hostel_id, 'Distance Matrix request failed'));
  }
  const body = await res.json();
  if (body.status !== 'OK') {
    return destinations.map((d) =>
      unavailableRow(d.hostel_id, `Travel time unavailable (${body.status || 'error'})`)
    );
  }
  const elements = body.rows?.[0]?.elements || [];
  return destinations.map((dest, i) => {
    const el = elements[i];
    if (!el || el.status !== 'OK') {
      return unavailableRow(dest.hostel_id, el?.status === 'ZERO_RESULTS'
        ? 'No route found'
        : 'Travel time could not be calculated');
    }
    return {
      hostel_id: dest.hostel_id,
      status: 'ok',
      duration_seconds: el.duration?.value ?? null,
      distance_meters: el.distance?.value ?? null,
      duration_text: el.duration?.text || formatDuration(el.duration?.value),
      distance_text: el.distance?.text || formatDistance(el.distance?.value),
      message: null,
    };
  });
}

async function readCache(keys) {
  if (!keys.length) return new Map();
  const cutoff = new Date(Date.now() - cacheTtlMs());
  const rows = await CommuteCache.findAll({
    where: {
      cache_key: { [Op.in]: keys },
      fetched_at: { [Op.gte]: cutoff },
    },
  });
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.cache_key, row);
  });
  return map;
}

async function writeCache(entries) {
  const now = new Date();
  await Promise.all(entries.map(async (entry) => {
    await CommuteCache.upsert({
      cache_key: entry.cache_key,
      origin_label: entry.origin_label,
      origin_lat: entry.origin_lat,
      origin_lng: entry.origin_lng,
      hostel_id: entry.hostel_id,
      mode: entry.mode,
      status: entry.status,
      duration_seconds: entry.duration_seconds,
      distance_meters: entry.distance_meters,
      duration_text: entry.duration_text,
      distance_text: entry.distance_text,
      message: entry.message,
      provider: useMockProvider() ? 'mock' : 'google',
      fetched_at: now,
    });
  }));
}

async function loadHostelCoords(hostelIds) {
  const hostels = await Hostel.findAll({
    where: { id: { [Op.in]: hostelIds } },
    attributes: ['id', 'latitude', 'longitude'],
  });
  const byId = new Map(hostels.map((h) => [h.id, h]));
  return hostelIds.map((id) => {
    const h = byId.get(id);
    const lat = h?.latitude == null ? null : Number(h.latitude);
    const lng = h?.longitude == null ? null : Number(h.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { hostel_id: id, missing: true };
    }
    return { hostel_id: id, lat, lng, missing: false };
  });
}

/**
 * @param {{ origin: string|object, hostel_ids: number[], mode?: string }} input
 */
async function commuteTimes(input) {
  const mode = MODES.has(String(input.mode || 'driving')) ? String(input.mode || 'driving') : 'driving';
  const rawIds = [...new Set((input.hostel_ids || [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))]
    .slice(0, MAX_HOSTELS);

  if (!rawIds.length) {
    const err = new Error('hostel_ids are required');
    err.statusCode = 422;
    throw err;
  }

  if (!isConfigured()) {
    return {
      configured: false,
      mode,
      origin: null,
      message: 'Travel times are not available right now. We will not show estimated minutes.',
      results: rawIds.map((id) => unavailableRow(id, 'Travel times are not configured')),
    };
  }

  const origin = await resolveOrigin(input.origin);
  const coords = await loadHostelCoords(rawIds);
  const results = [];
  const needFetch = [];

  const keys = coords
    .filter((c) => !c.missing)
    .map((c) => cacheKeyFor(origin.lat, origin.lng, c.hostel_id, mode));
  const cached = await readCache(keys);

  for (const c of coords) {
    if (c.missing) {
      results.push(unavailableRow(c.hostel_id, 'This PG has no map coordinates'));
      continue;
    }
    const key = cacheKeyFor(origin.lat, origin.lng, c.hostel_id, mode);
    const hit = cached.get(key);
    if (hit) {
      if (hit.status === 'ok') {
        results.push(okRow(c.hostel_id, {
          duration_seconds: hit.duration_seconds,
          distance_meters: hit.distance_meters,
          duration_text: hit.duration_text,
          distance_text: hit.distance_text,
        }, true));
      } else {
        results.push({
          ...unavailableRow(c.hostel_id, hit.message),
          cached: true,
        });
      }
    } else {
      needFetch.push(c);
    }
  }

  for (let i = 0; i < needFetch.length; i += MATRIX_CHUNK) {
    const chunk = needFetch.slice(i, i + MATRIX_CHUNK);
    const fetched = await fetchMatrixRows(origin, chunk, mode);
    const toStore = [];
    fetched.forEach((row) => {
      const key = cacheKeyFor(origin.lat, origin.lng, row.hostel_id, mode);
      toStore.push({
        cache_key: key,
        origin_label: origin.label,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        hostel_id: row.hostel_id,
        mode,
        status: row.status,
        duration_seconds: row.duration_seconds,
        distance_meters: row.distance_meters,
        duration_text: row.duration_text,
        distance_text: row.distance_text,
        message: row.message,
      });
      if (row.status === 'ok') {
        results.push(okRow(row.hostel_id, row, false));
      } else {
        results.push({ ...row, cached: false });
      }
    });
    await writeCache(toStore);
  }

  results.sort((a, b) => a.hostel_id - b.hostel_id);

  return {
    configured: true,
    mode,
    origin: {
      label: origin.label,
      latitude: origin.lat,
      longitude: origin.lng,
    },
    message: null,
    results,
  };
}

function serializeOffice(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    updated_at: row.updated_at,
  };
}

async function getSavedOffice(userId) {
  const row = await SeekerCommutePlace.findOne({ where: { user_id: userId } });
  return serializeOffice(row);
}

async function saveOffice(userId, body) {
  const label = String(body?.label || body?.address || 'My office').trim().slice(0, 120) || 'My office';
  let lat = body?.latitude != null ? Number(body.latitude) : body?.lat != null ? Number(body.lat) : null;
  let lng = body?.longitude != null ? Number(body.longitude) : body?.lng != null ? Number(body.lng) : null;
  let address = body?.address != null ? String(body.address).trim().slice(0, 500) : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    if (!address && !body?.label) {
      const err = new Error('address or coordinates are required');
      err.statusCode = 422;
      throw err;
    }
    if (!isConfigured()) {
      const err = new Error('Cannot save office: travel geocoding is not configured');
      err.statusCode = 503;
      throw err;
    }
    const geo = await geocodeAddress(address || body.label);
    lat = geo.lat;
    lng = geo.lng;
    address = address || geo.formatted_address || label;
  }

  const [row] = await SeekerCommutePlace.upsert({
    user_id: userId,
    label,
    address: address || label,
    latitude: lat,
    longitude: lng,
  });
  const fresh = await SeekerCommutePlace.findOne({ where: { user_id: userId } });
  return serializeOffice(fresh || row);
}

async function clearOffice(userId) {
  const n = await SeekerCommutePlace.destroy({ where: { user_id: userId } });
  return { removed: n > 0 };
}

async function officeAsOrigin(userId) {
  const office = await getSavedOffice(userId);
  if (!office) {
    const err = new Error('No saved office. Save one first, or type an address.');
    err.statusCode = 404;
    throw err;
  }
  return {
    lat: office.latitude,
    lng: office.longitude,
    label: office.label,
    address: office.address,
  };
}

module.exports = {
  isConfigured,
  commuteTimes,
  getSavedOffice,
  saveOffice,
  clearOffice,
  officeAsOrigin,
  geocodeAddress,
  // test helpers
  _cacheKeyFor: cacheKeyFor,
  _haversineMeters: haversineMeters,
};
