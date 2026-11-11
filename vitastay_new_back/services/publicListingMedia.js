/**
 * Group published property_media for the public listing payload.
 * Listing files: /uploads/media, /uploads/hostels, /uploads/rooms.
 * Never KYC (/uploads/tenants) or other private folders.
 */
const { Op } = require('sequelize');
const { PropertyMedia } = require('../models');
const { getModelsForHostel } = require('../helpers/hostelContext');
const { toCoverObject, selectListingCover } = require('./listingCover');
const { isAllowedLegacyPath } = require('./legacyMedia');
const { publicAssetUrl } = require('./mediaStorage');

const CATEGORIES = ['exterior', 'interior_common', 'room', 'floor', 'panorama_360', 'walkthrough_video'];
const PAGE_HINT = 100;

const isListingFile = (filePath) => isAllowedLegacyPath(filePath);

const toPublicItem = (row) => ({
  id: row.id,
  category: row.category,
  capture_kind: row.capture_kind,
  room_id: row.room_id || null,
  room_number: row.room_number || null,
  floor_number: row.floor_number,
  caption: row.caption || null,
  title: row.title || null,
  url: publicAssetUrl(row.file_path),
  thumb_url: publicAssetUrl(
    row.thumb_path
      || ((row.capture_kind === 'video' || row.category === 'walkthrough_video') ? null : row.file_path)
  ),
  mime_type: row.mime_type || null,
  sort_order: row.sort_order,
  is_cover: Boolean(row.is_cover),
  alt: row.caption || row.title || null,
  context: row.caption || row.title || null,
});

const loadPublishedMedia = async (hostel, category) => {
  const where = {
    hostel_id: hostel.id,
    is_published: true,
    file_path: {
      [Op.or]: [
        { [Op.like]: '/uploads/media/%' },
        { [Op.like]: '/uploads/hostels/%' },
        { [Op.like]: '/uploads/rooms/%' },
      ],
    },
  };
  if (category && CATEGORIES.includes(category)) where.category = category;
  const rows = await PropertyMedia.findAll({
    where,
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  return rows.filter((row) => isListingFile(row.file_path));
};

const groupListingMedia = async (hostel, { category } = {}) => {
  const allRows = await loadPublishedMedia(hostel);
  const rows = category ? allRows.filter((row) => row.category === category) : allRows;
  const items = rows.map(toPublicItem);
  const allItems = allRows.map(toPublicItem);

  const ctx = await getModelsForHostel(hostel);
  const roomQuery = {
    where: ctx.isolated ? {} : { hostel_id: hostel.id },
    attributes: ['id', 'room_number', 'room_type', 'floor', 'rent', 'is_ac', 'sharing_type', 'status'],
    order: [['floor', 'ASC'], ['room_number', 'ASC']],
  };
  let rooms;
  try {
    rooms = await ctx.models.Room.findAll({
      ...roomQuery,
      include: [{ model: ctx.models.Bed, as: 'beds', attributes: ['id', 'status'] }],
    });
  } catch {
    rooms = await ctx.models.Room.findAll(roomQuery);
  }
  const roomById = new Map(rooms.map((room) => [Number(room.id), room]));

  const bedsAvailable = (meta) => {
    const beds = meta.beds || [];
    return beds.filter((bed) => bed.status === 'vacant').length;
  };

  const roomsGroup = {};
  const addRoomBucket = (item, meta) => {
    const key = String(meta.room_number);
    if (!roomsGroup[key]) {
      const beds = meta.beds || [];
      roomsGroup[key] = {
        room_id: meta.id,
        room_number: key,
        room_type: meta.room_type || null,
        is_ac: Boolean(meta.is_ac),
        floor: meta.floor == null ? null : Number(meta.floor),
        rent: meta.rent == null ? null : Number(meta.rent),
        beds_available: bedsAvailable(meta),
        beds_total: beds.length,
        photos: [],
        panoramas: [],
      };
    }
    if (item.capture_kind === 'panorama_360' || item.category === 'panorama_360') {
      roomsGroup[key].panoramas.push(item);
    } else {
      roomsGroup[key].photos.push(item);
    }
  };

  const visibleItems = items.filter((item) => {
    if (item.category === 'room') return Boolean(item.room_id && roomById.has(Number(item.room_id)));
    if (item.category === 'panorama_360' && item.room_id) {
      return roomById.has(Number(item.room_id));
    }
    return true;
  });

  const floors = {};
  visibleItems.forEach((item) => {
    const meta = item.room_id ? roomById.get(Number(item.room_id)) : null;
    if (item.category === 'room' || (item.category === 'panorama_360' && item.room_id)) {
      if (meta) addRoomBucket(item, meta);
    }
    if (item.category === 'floor' && item.floor_number != null && item.floor_number !== '') {
      const key = String(item.floor_number);
      if (!floors[key]) floors[key] = [];
      floors[key].push(item);
    }
  });

  const coverPool = allItems.filter((item) => {
    if (item.category === 'walkthrough_video' || item.capture_kind === 'video') return false;
    if (item.category === 'room') return Boolean(item.room_id && roomById.has(Number(item.room_id)));
    if (item.category === 'panorama_360' && item.room_id) return roomById.has(Number(item.room_id));
    return true;
  });
  const coverRow = selectListingCover(coverPool);

  const countOf = (category) => allItems.filter((item) => item.category === category).length;

  return {
    cover: toCoverObject(coverRow, hostel.name),
    exterior: visibleItems.filter((item) => item.category === 'exterior'),
    interior_common: visibleItems.filter((item) => item.category === 'interior_common'),
    rooms: roomsGroup,
    floors,
    panorama_360: visibleItems.filter((item) => item.category === 'panorama_360'),
    walkthrough_video: visibleItems.filter((item) => item.category === 'walkthrough_video'),
    items: visibleItems,
    total: visibleItems.length,
    counts: {
      all: allItems.length,
      exterior: countOf('exterior'),
      interior_common: countOf('interior_common'),
      room: countOf('room'),
      floor: countOf('floor'),
      panorama_360: countOf('panorama_360'),
      walkthrough_video: countOf('walkthrough_video'),
    },
    page_hint: PAGE_HINT,
  };
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

const areaOf = (hostel) => {
  const area = String(hostel?.area || '').trim();
  if (area) return area.slice(0, 120);
  const address = String(hostel?.address || '').split(',')[0].trim();
  return address ? address.slice(0, 120) : null;
};

const publicHostel = (hostel) => ({
  id: hostel.id,
  name: hostel.name,
  name_hi: hostel.name_hi || null,
  code: hostel.code,
  city: hostel.city,
  area: areaOf(hostel),
  state: hostel.state || null,
  pincode: hostel.pincode || null,
  country: hostel.country || 'India',
  gender_policy: hostel.gender_policy || 'unisex',
  description: hostel.description || null,
  description_hi: hostel.description_hi || null,
  description_origin: hostel.description_origin || null,
  locales: {
    en: true,
    hi: Boolean(hostel.description_hi || hostel.name_hi),
  },
  vita_verified: Boolean(hostel.verified_at),
  amenities: asList(hostel.amenities),
  security_deposit: hostel.security_deposit == null ? null : Number(hostel.security_deposit),
  notice_period_months: hostel.notice_period_months == null ? null : Number(hostel.notice_period_months),
  electricity_charge: hostel.electricity_charge == null ? 0 : Number(hostel.electricity_charge),
  water_charge: hostel.water_charge == null ? 0 : Number(hostel.water_charge),
  ...require('./bookingModel').publicMeta(hostel),
});

module.exports = {
  CATEGORIES,
  PAGE_HINT,
  toPublicItem,
  groupListingMedia,
  publicHostel,
  isListingFile,
};
