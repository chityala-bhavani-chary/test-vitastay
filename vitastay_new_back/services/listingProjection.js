/**
 * Master search index for public listings (BKG-002 / BIC-117 lite).
 * Search reads this table only. Isolated vitastay_* DBs are touched only on refresh.
 */
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { getModelsForHostel } = require('../helpers/hostelContext');
const { toCoverObject, selectListingCover } = require('./listingCover');
const { publicAssetUrl } = require('./mediaStorage');

const { GENDER_POLICIES, deriveEssentialFlags } = require('./listingFilters');

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

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

const genderPolicyOf = (hostel) => {
  const raw = String(hostel?.gender_policy || 'unisex').toLowerCase();
  return GENDER_POLICIES.includes(raw) ? raw : 'unisex';
};

const areaOf = (hostel) => {
  const area = String(hostel?.area || '').trim();
  if (area) return area.slice(0, 120);
  const address = String(hostel?.address || '').split(',')[0].trim();
  return address ? address.slice(0, 120) : null;
};

const loadRooms = async (hostel) => {
  try {
    const ctx = await getModelsForHostel(hostel);
    return ctx.models.Room.findAll({
      where: ctx.isolated ? {} : { hostel_id: hostel.id },
      attributes: ['id', 'room_type', 'rent', 'is_ac', 'has_attached_bath'],
      include: [{ model: ctx.models.Bed, as: 'beds', attributes: ['id', 'status'], required: false }],
    });
  } catch (err) {
    logger.warn(`Listing projection rooms fallback for hostel ${hostel.id}: ${err.message}`);
    const { Room, Bed } = require('../models');
    return Room.findAll({
      where: { hostel_id: hostel.id },
      attributes: ['id', 'room_type', 'rent', 'is_ac', 'has_attached_bath'],
      include: [{ model: Bed, as: 'beds', attributes: ['id', 'status'], required: false }],
    });
  }
};

const coverUrls = async (hostelId, name) => {
  const { PropertyMedia } = require('../models');
  const rows = await PropertyMedia.findAll({
    where: {
      hostel_id: hostelId,
      is_published: true,
      file_path: {
        [Op.or]: [
          { [Op.like]: '/uploads/media/%' },
          { [Op.like]: '/uploads/hostels/%' },
          { [Op.like]: '/uploads/rooms/%' },
        ],
      },
    },
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  const cover = toCoverObject(selectListingCover(rows), name);
  return {
    cover_url: cover?.url || null,
    cover_thumb_url: cover?.thumb_url || publicAssetUrl(cover?.url) || null,
  };
};

const refreshListingProjection = async (hostelOrId) => {
  const { Hostel, OccupancySnapshot, ListingProjection, ListingAvailability } = require('../models');
  const hostel = typeof hostelOrId === 'object' && hostelOrId?.id
    ? hostelOrId
    : await Hostel.findByPk(hostelOrId);
  if (!hostel) return null;

  const { PropertyMedia } = require('../models');
  const [rooms, snapshot, cover, availabilityRows, panoCount] = await Promise.all([
    loadRooms(hostel),
    OccupancySnapshot.findOne({ where: { hostel_id: hostel.id } }),
    coverUrls(hostel.id, hostel.name),
    ListingAvailability.findAll({ where: { hostel_id: hostel.id } }),
    PropertyMedia.count({
      where: {
        hostel_id: hostel.id,
        category: 'panorama_360',
        is_published: true,
      },
    }),
  ]);

  const rents = rooms.map((room) => num(room.rent)).filter((value) => value != null);
  const occupancyTypes = [...new Set(rooms.map((room) => room.room_type).filter(Boolean))];
  let bedsAvailable = 0;
  if (availabilityRows.length) {
    bedsAvailable = availabilityRows.reduce((sum, row) => sum + (Number(row.beds_available) || 0), 0);
  } else if (snapshot) {
    bedsAvailable = Number(snapshot.vacant_beds) || 0;
  } else {
    bedsAvailable = rooms.reduce(
      (sum, room) => sum + (room.beds || []).filter((bed) => bed.status === 'vacant').length,
      0
    );
  }

  const { marketplaceOk, planOf } = require('./ownerPlan');
  const { normalizeModel, normalizeAdvancePercent } = require('./bookingModel');
  const marketOk = marketplaceOk(hostel);
  const isPublic = Boolean(hostel.listing_published)
    && String(hostel.status) === 'active'
    && marketOk;
  const bookingModel = normalizeModel(hostel.booking_model);
  const amenities = asList(hostel.amenities);
  const essentials = deriveEssentialFlags(amenities, rooms);
  const payload = {
    hostel_id: hostel.id,
    code: hostel.code || null,
    name: hostel.name,
    city: hostel.city,
    area: areaOf(hostel),
    state: hostel.state || null,
    amenities,
    occupancy_types: occupancyTypes,
    gender_policy: genderPolicyOf(hostel),
    stay_modes: ['monthly'],
    min_rent: rents.length ? Math.min(...rents) : null,
    max_rent: rents.length ? Math.max(...rents) : null,
    daily_rent: null,
    beds_available: bedsAvailable,
    rating_avg: null,
    rating_count: 0,
    cover_url: cover.cover_url,
    cover_thumb_url: cover.cover_thumb_url,
    plan: planOf(hostel),
    marketplace_ok: marketOk,
    is_public: isPublic,
    booking_model: bookingModel,
    advance_percent: bookingModel === 'request_advance' ? normalizeAdvancePercent(hostel.advance_percent) : null,
    has_360: Number(panoCount) > 0,
    has_food: essentials.has_food,
    has_ac: essentials.has_ac,
    has_attached_bath: essentials.has_attached_bath,
    vita_verified: Boolean(hostel.verified_at),
    refreshed_at: new Date(),
  };

  const existing = await ListingProjection.findOne({ where: { hostel_id: hostel.id } });
  if (existing) {
    await existing.update(payload);
    return existing;
  }
  return ListingProjection.create(payload);
};

const scheduleListingRefresh = (hostelId) => {
  if (!hostelId) return;
  setImmediate(() => {
    refreshListingProjection(hostelId).catch((err) => {
      logger.warn(`Listing projection refresh skipped for hostel ${hostelId}: ${err.message}`);
    });
  });
};

const backfillListingProjections = async (log = () => {}) => {
  const { Hostel, ListingProjection } = require('../models');
  const existing = await ListingProjection.findAll({ attributes: ['hostel_id'] });
  const have = new Set(existing.map((row) => Number(row.hostel_id)));
  const hostels = await Hostel.findAll({
    attributes: ['id'],
    where: { listing_published: true },
  });
  let n = 0;
  for (const hostel of hostels) {
    if (have.has(Number(hostel.id))) continue;
    await refreshListingProjection(hostel.id);
    n += 1;
  }
  log(`listing_projections backfill: ${n} published hostels`);
};

module.exports = {
  GENDER_POLICIES,
  refreshListingProjection,
  scheduleListingRefresh,
  backfillListingProjections,
};
