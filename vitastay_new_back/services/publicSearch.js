/**
 * GET /public/listings — master listing_projections only. No isolated hostel DB reads.
 * BIC-024 map pins: GET /public/listings/map — lat/lng from hostels (no geocode).
 */
const { Op } = require('sequelize');
const { sequelize, ListingProjection, Hostel } = require('../models');
const { getPagination } = require('../utils/pagination');
const dayjs = require('dayjs');
const { GENDER_POLICIES, truthy } = require('./listingFilters');

const OCCUPANCY = new Set(['single', 'double', 'triple', 'dormitory']);
const GENDERS = new Set(GENDER_POLICIES);
const STAY = new Set(['monthly', 'daily']);
const MAP_PIN_LIMIT = 300;

const csv = (value) => String(value || '')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean);

const asList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return value.split(',').map((part) => part.trim()).filter(Boolean);
    }
  }
  return [];
};

const jsonContains = (column, value) => sequelize.where(
  sequelize.fn('JSON_CONTAINS', sequelize.col(column), JSON.stringify(value)),
  1
);

const parseMoveIn = (raw) => {
  if (raw == null || raw === '') return { ok: true, date: null };
  const date = dayjs(raw);
  if (!date.isValid()) return { ok: false, message: 'move_in must be a date (YYYY-MM-DD)' };
  if (date.endOf('day').isBefore(dayjs().startOf('day'))) {
    return { ok: false, message: 'move_in cannot be in the past' };
  }
  return { ok: true, date: date.format('YYYY-MM-DD') };
};

const toCard = (row) => {
  const json = row.toJSON ? row.toJSON() : row;
  const monthly = json.min_rent != null ? Number(json.min_rent) : null;
  const daily = json.daily_rent != null ? Number(json.daily_rent) : null;
  return {
    id: json.hostel_id,
    code: json.code,
    name: json.name,
    city: json.city,
    area: json.area || null,
    state: json.state || null,
    cover_url: json.cover_url || null,
    cover_thumb_url: json.cover_thumb_url || json.cover_url || null,
    monthly_rent: monthly,
    daily_rent: daily,
    security_deposit: json.security_deposit != null ? Number(json.security_deposit) : null,
    beds_available: Number(json.beds_available) || 0,
    rating_avg: json.rating_avg != null ? Number(json.rating_avg) : null,
    rating_count: Number(json.rating_count) || 0,
    amenities: asList(json.amenities),
    occupancy_types: asList(json.occupancy_types),
    gender_policy: json.gender_policy || 'unisex',
    stay_modes: asList(json.stay_modes).length ? asList(json.stay_modes) : ['monthly'],
    ...require('./bookingModel').publicMeta(json),
    has_360: Boolean(json.has_360),
    has_food: Boolean(json.has_food),
    has_ac: Boolean(json.has_ac),
    has_attached_bath: Boolean(json.has_attached_bath),
    vita_verified: Boolean(json.vita_verified),
    latitude: json.latitude != null ? Number(json.latitude) : null,
    longitude: json.longitude != null ? Number(json.longitude) : null,
  };
};

const buildSearchWhere = async (query = {}) => {
  const moveIn = parseMoveIn(query.move_in);
  if (!moveIn.ok) {
    const err = new Error(moveIn.message);
    err.statusCode = 422;
    throw err;
  }

  const where = { is_public: true, marketplace_ok: true };
  const and = [];

  const idList = csv(query.ids)
    .map((part) => Number(part))
    .filter((id) => Number.isFinite(id) && id > 0)
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, 3);
  if (idList.length) where.hostel_id = { [Op.in]: idList };

  const city = String(query.city || '').trim();
  if (city) where.city = { [Op.like]: `%${city}%` };

  const area = String(query.area || '').trim();
  if (area) where.area = { [Op.like]: `%${area}%` };

  const q = String(query.q || '').trim();
  if (q) {
    and.push({
      [Op.or]: [
        { name: { [Op.like]: `%${q}%` } },
        { city: { [Op.like]: `%${q}%` } },
        { area: { [Op.like]: `%${q}%` } },
      ],
    });
  }

  const minRent = query.min_rent != null && query.min_rent !== '' ? Number(query.min_rent) : null;
  const maxRent = query.max_rent != null && query.max_rent !== '' ? Number(query.max_rent) : null;
  if (minRent != null && Number.isFinite(minRent)) {
    where.min_rent = { ...(where.min_rent || {}), [Op.gte]: minRent };
  }
  if (maxRent != null && Number.isFinite(maxRent)) {
    where.min_rent = { ...(where.min_rent || {}), [Op.lte]: maxRent };
  }

  csv(query.amenities).forEach((amenity) => {
    and.push(jsonContains('ListingProjection.amenities', amenity));
  });

  const occupancy = String(query.occupancy || query.occupancy_type || '').trim().toLowerCase();
  if (occupancy) {
    if (!OCCUPANCY.has(occupancy)) {
      const err = new Error('occupancy must be single, double, triple, or dormitory');
      err.statusCode = 422;
      throw err;
    }
    if (moveIn.date) {
      const { ListingAvailability } = require('../models');
      const vacantTypes = await ListingAvailability.findAll({
        attributes: ['hostel_id'],
        where: { room_type: occupancy, beds_available: { [Op.gt]: 0 } },
        raw: true,
      });
      where.hostel_id = { [Op.in]: vacantTypes.map((row) => row.hostel_id).concat(0) };
    } else {
      and.push(jsonContains('ListingProjection.occupancy_types', occupancy));
    }
  }

  const gender = String(query.gender || query.gender_policy || '').trim().toLowerCase();
  if (gender) {
    if (!GENDERS.has(gender)) {
      const err = new Error('gender must be male, female, or unisex (hostel policy, not tenant sex)');
      err.statusCode = 422;
      throw err;
    }
    if (gender === 'unisex') where.gender_policy = 'unisex';
    else where.gender_policy = { [Op.in]: [gender, 'unisex'] };
  }

  // BIC-026 first-class essentials (indexed columns). Also accept legacy amenities=AC etc.
  if (truthy(query.food) || truthy(query.has_food)) where.has_food = true;
  if (truthy(query.ac) || truthy(query.has_ac)) where.has_ac = true;
  if (truthy(query.attached_bath) || truthy(query.has_attached_bath)) where.has_attached_bath = true;

  const stayMode = String(query.stay_mode || '').trim().toLowerCase();
  if (stayMode) {
    if (!STAY.has(stayMode)) {
      const err = new Error('stay_mode must be monthly or daily');
      err.statusCode = 422;
      throw err;
    }
    and.push(jsonContains('ListingProjection.stay_modes', stayMode));
  }

  if (moveIn.date) where.beds_available = { [Op.gt]: 0 };
  if (and.length) where[Op.and] = and;

  const sortKey = String(query.sort || 'name').toLowerCase();
  const order = {
    price_asc: [['min_rent', 'ASC'], ['name', 'ASC'], ['hostel_id', 'ASC']],
    price_desc: [['min_rent', 'DESC'], ['name', 'ASC'], ['hostel_id', 'ASC']],
  }[sortKey] || [['name', 'ASC'], ['hostel_id', 'ASC']];

  return { where, order, moveIn };
};

const searchListings = async (query = {}) => {
  const pageQuery = { ...query, limit: query.limit || 12 };
  const { page, limit, offset } = getPagination(pageQuery);
  const capped = Math.min(limit, 50);
  const { where, order } = await buildSearchWhere(query);

  const { count, rows } = await ListingProjection.findAndCountAll({
    where,
    order,
    limit: capped,
    offset,
  });

  const hostelIds = rows.map((row) => row.hostel_id);
  const extras = hostelIds.length
    ? await Hostel.findAll({
      where: { id: { [Op.in]: hostelIds } },
      attributes: ['id', 'security_deposit', 'latitude', 'longitude'],
    })
    : [];
  const byId = new Map(extras.map((row) => [row.id, row]));

  // BIC-027 — attach sharing catalogue (starting rent + beds left) from master projection.
  const { ListingAvailability } = require('../models');
  const { toRoomTypes } = require('./occupancyService');
  const availRows = hostelIds.length
    ? await ListingAvailability.findAll({
      where: { hostel_id: { [Op.in]: hostelIds } },
      order: [['room_type', 'ASC']],
    })
    : [];
  const roomTypesByHostel = new Map();
  availRows.forEach((row) => {
    const list = roomTypesByHostel.get(row.hostel_id) || [];
    list.push(row);
    roomTypesByHostel.set(row.hostel_id, list);
  });

  return {
    items: rows.map((row) => {
      const hostel = byId.get(row.hostel_id);
      const card = toCard({
        ...(row.toJSON ? row.toJSON() : row),
        security_deposit: hostel?.security_deposit == null ? null : Number(hostel.security_deposit),
        latitude: hostel?.latitude == null ? null : Number(hostel.latitude),
        longitude: hostel?.longitude == null ? null : Number(hostel.longitude),
      });
      card.roomTypes = toRoomTypes(roomTypesByHostel.get(row.hostel_id) || []);
      return card;
    }),
    pagination: { page, limit: capped, total: count },
  };
};

/**
 * BIC-024 — published PGs that already have latitude/longitude. Never geocodes.
 */
const searchMapPins = async (query = {}) => {
  const { where, order } = await buildSearchWhere(query);
  const rows = await ListingProjection.findAll({
    where,
    order,
    limit: MAP_PIN_LIMIT,
  });
  if (!rows.length) {
    return { pins: [], total: 0, skipped_no_coords: 0 };
  }

  const hostelIds = rows.map((row) => row.hostel_id);
  const hostels = await Hostel.findAll({
    where: {
      id: { [Op.in]: hostelIds },
      latitude: { [Op.ne]: null },
      longitude: { [Op.ne]: null },
    },
    attributes: ['id', 'latitude', 'longitude', 'security_deposit'],
  });
  const byId = new Map(hostels.map((row) => [row.id, row]));

  const pins = [];
  for (const row of rows) {
    const hostel = byId.get(row.hostel_id);
    if (!hostel) continue;
    const lat = Number(hostel.latitude);
    const lng = Number(hostel.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    pins.push({
      id: row.hostel_id,
      code: row.code,
      name: row.name,
      city: row.city,
      area: row.area || null,
      latitude: lat,
      longitude: lng,
      monthly_rent: row.min_rent != null ? Number(row.min_rent) : null,
      security_deposit: hostel.security_deposit == null ? null : Number(hostel.security_deposit),
      beds_available: Number(row.beds_available) || 0,
      cover_thumb_url: row.cover_thumb_url || row.cover_url || null,
      rating_avg: row.rating_avg != null ? Number(row.rating_avg) : null,
      rating_count: Number(row.rating_count) || 0,
      ...require('./bookingModel').publicMeta(row),
    });
  }

  return {
    pins,
    total: pins.length,
    skipped_no_coords: rows.length - pins.length,
  };
};

/**
 * BIC-031 — similar / nearby published PGs. Same city, rent ±20%, cover required.
 * Simple SQL — not ML. Excludes the source hostel; optionally excludes full.
 */
const findSimilarListings = async (idOrSlug, query = {}) => {
  const raw = String(idOrSlug || '').trim();
  if (!raw) {
    const err = new Error('Listing id or code is required');
    err.statusCode = 422;
    throw err;
  }

  const sourceWhere = /^\d+$/.test(raw)
    ? { hostel_id: Number(raw) }
    : { code: raw };
  const source = await ListingProjection.findOne({
    where: { ...sourceWhere, is_public: true, marketplace_ok: true },
  });
  if (!source) {
    const err = new Error('Listing not found');
    err.statusCode = 404;
    throw err;
  }

  const limit = Math.min(12, Math.max(1, Number(query.limit) || 8));
  const excludeFull = !(query.exclude_full === '0' || query.exclude_full === 'false');
  const rent = source.min_rent != null ? Number(source.min_rent) : null;

  const where = {
    is_public: true,
    marketplace_ok: true,
    hostel_id: { [Op.ne]: source.hostel_id },
    city: source.city,
    [Op.or]: [
      { cover_url: { [Op.ne]: null } },
      { cover_thumb_url: { [Op.ne]: null } },
    ],
  };
  if (excludeFull) where.beds_available = { [Op.gt]: 0 };
  if (Number.isFinite(rent) && rent > 0) {
    where.min_rent = {
      [Op.between]: [Math.round(rent * 0.8), Math.round(rent * 1.2)],
    };
  }

  const rows = await ListingProjection.findAll({
    where,
    order: [['min_rent', 'ASC'], ['name', 'ASC'], ['hostel_id', 'ASC']],
    limit: limit * 3,
  });

  const scored = rows
    .filter((row) => {
      const cover = row.cover_thumb_url || row.cover_url;
      return Boolean(cover && String(cover).trim());
    })
    .map((row) => {
      const rowRent = row.min_rent != null ? Number(row.min_rent) : null;
      const rentDelta = Number.isFinite(rent) && Number.isFinite(rowRent)
        ? Math.abs(rowRent - rent)
        : 999999;
      const sameArea = source.area
        && row.area
        && String(source.area).toLowerCase() === String(row.area).toLowerCase()
        ? 0
        : 1;
      return { row, rentDelta, sameArea };
    })
    .sort((a, b) => a.sameArea - b.sameArea || a.rentDelta - b.rentDelta)
    .slice(0, limit);

  return {
    source: {
      id: source.hostel_id,
      code: source.code,
      city: source.city,
      area: source.area || null,
      monthly_rent: rent,
    },
    items: scored.map(({ row }) => toCard(row)),
  };
};

module.exports = {
  searchListings,
  searchMapPins,
  findSimilarListings,
  toCard,
  parseMoveIn,
  MAP_PIN_LIMIT,
};
