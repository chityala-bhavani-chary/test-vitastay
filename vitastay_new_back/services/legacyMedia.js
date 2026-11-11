/**
 * Copy unstructured hostels.images / rooms.images JSON into property_media.
 * Does not drop JSON columns and never copies hostel.logo (logo is not listing cover).
 * KYC / tenant documents must not use this module.
 */
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { writeThumbnail } = require('./mediaStorage');

const LEGACY_MEDIA_TITLE = 'Please recategorise';
const HOSTEL_CAPTION = 'Please recategorise';
const ROOM_CAPTION = 'Please recategorise';

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const ALLOWED_PREFIXES = ['/uploads/hostels/', '/uploads/rooms/', '/uploads/media/'];
const BLOCKED_PREFIXES = ['/uploads/tenants/', '/uploads/complaints/', '/uploads/maintenance/'];

const uploadsRoot = path.resolve(__dirname, '..', 'uploads');

const isAllowedLegacyPath = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return false;
  if (BLOCKED_PREFIXES.some((prefix) => filePath.startsWith(prefix))) return false;
  return ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
};

const parseImageList = (value) => {
  if (!value) return [];
  let list = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      list = JSON.parse(trimmed);
    } catch {
      list = trimmed.startsWith('/uploads/') ? [trimmed] : [];
    }
  }
  if (!Array.isArray(list)) return [];
  const paths = list.map((item) => {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object') {
      return String(item.path || item.url || item.file_path || '').trim();
    }
    return '';
  }).filter(isAllowedLegacyPath);
  return [...new Set(paths)];
};

const inferMimeType = (filePath) => {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
};

const resolveUpload = (filePath) => {
  if (!filePath || !String(filePath).startsWith('/uploads/')) return null;
  const absolute = path.resolve(__dirname, '..', String(filePath).replace(/^\//, ''));
  if (!absolute.startsWith(uploadsRoot)) return null;
  return absolute;
};

const fileSizeFor = (filePath) => {
  const absolute = resolveUpload(filePath);
  if (!absolute) return 0;
  try {
    return fs.statSync(absolute).size;
  } catch {
    return 0;
  }
};

/**
 * Insert JSON image paths into property_media. Idempotent on (hostel_id, file_path).
 *
 * @param {'interior_common'|'room'} category
 */
const copyImagePaths = async ({
  PropertyMedia,
  hostelId,
  category,
  paths,
  roomId = null,
  roomNumber = null,
  floorNumber = null,
  uploadedBy,
  title = LEGACY_MEDIA_TITLE,
  caption = null,
  dryRun = false,
  transaction = null,
}) => {
    const uniquePaths = parseImageList(paths);
  if (!uniquePaths.length) return { inserted: 0, skipped: 0, pending: 0 };

  const existing = await PropertyMedia.findAll({
    where: { hostel_id: hostelId, file_path: { [Op.in]: uniquePaths } },
    attributes: ['file_path'],
    paranoid: false,
    transaction,
  });
  const have = new Set(existing.map((row) => row.file_path));
  const toInsert = uniquePaths
    .map((filePath, index) => ({ filePath, sortOrder: index }))
    .filter((row) => !have.has(row.filePath));

  if (dryRun || !toInsert.length) {
    return { inserted: 0, skipped: uniquePaths.length - toInsert.length, pending: toInsert.length };
  }

  const records = [];
  for (const { filePath, sortOrder } of toInsert) {
    let thumbPath = filePath;
    const absolute = resolveUpload(filePath);
    if (absolute && fs.existsSync(absolute)) {
      try {
        const thumb = await writeThumbnail(absolute);
        thumbPath = thumb.thumbPath || filePath;
      } catch (err) {
        logger.warn(`legacy thumb skipped for ${filePath}: ${err.message}`);
      }
    }
    records.push({
      hostel_id: hostelId,
      category,
      capture_kind: 'photo',
      room_id: roomId,
      room_number: roomNumber,
      floor_number: floorNumber,
      title,
      caption,
      file_path: filePath,
      thumb_path: thumbPath,
      mime_type: inferMimeType(filePath),
      file_size: fileSizeFor(filePath),
      sort_order: sortOrder,
      is_cover: false,
      is_published: true,
      uploaded_by: uploadedBy,
    });
  }

  await PropertyMedia.bulkCreate(records, { transaction, validate: true, ignoreDuplicates: true });
  return { inserted: records.length, skipped: uniquePaths.length - records.length, pending: 0 };
};

const resolveUploader = async (hostel, uploadedBy) => {
  if (uploadedBy) return uploadedBy;
  if (hostel?.owner_id) return hostel.owner_id;
  const { User } = require('../models');
  const admin = await User.findOne({ where: { role: 'super_admin' }, attributes: ['id'] });
  return admin?.id || null;
};

const syncHostelJsonImages = async (hostel, {
  uploadedBy,
  dryRun = false,
  transaction = null,
  PropertyMedia,
} = {}) => {
  const Model = PropertyMedia || require('../models').PropertyMedia;
  const uploader = await resolveUploader(hostel, uploadedBy);
  if (!uploader) {
    logger.warn(`property_media JSON sync skipped for hostel ${hostel?.id}: no uploaded_by`);
    return { inserted: 0, skipped: 0, pending: 0 };
  }
  const paths = parseImageList(hostel.images).filter((filePath) => filePath !== hostel.logo);
  return copyImagePaths({
    PropertyMedia: Model,
    hostelId: hostel.id,
    category: 'interior_common',
    paths,
    uploadedBy: uploader,
    caption: HOSTEL_CAPTION,
    dryRun,
    transaction,
  });
};

const syncRoomJsonImages = async (hostel, room, {
  uploadedBy,
  dryRun = false,
  transaction = null,
  PropertyMedia,
} = {}) => {
  const Model = PropertyMedia || require('../models').PropertyMedia;
  const uploader = await resolveUploader(hostel, uploadedBy);
  if (!uploader) {
    logger.warn(`property_media JSON sync skipped for room ${room?.id}: no uploaded_by`);
    return { inserted: 0, skipped: 0, pending: 0 };
  }
  return copyImagePaths({
    PropertyMedia: Model,
    hostelId: hostel.id,
    category: 'room',
    paths: room.images,
    roomId: room.id,
    roomNumber: room.room_number || null,
    floorNumber: room.floor == null ? null : Number(room.floor),
    uploadedBy: uploader,
    caption: ROOM_CAPTION,
    dryRun,
    transaction,
  });
};

const syncHostelJsonImagesSafe = async (hostel, options) => {
  try {
    return await syncHostelJsonImages(hostel, options);
  } catch (err) {
    logger.warn(`property_media JSON sync skipped for hostel ${hostel?.id}: ${err.message}`);
    return { inserted: 0, skipped: 0, pending: 0, error: err.message };
  }
};

const syncRoomJsonImagesSafe = async (hostel, room, options) => {
  try {
    return await syncRoomJsonImages(hostel, room, options);
  } catch (err) {
    logger.warn(`property_media JSON sync skipped for room ${room?.id}: ${err.message}`);
    return { inserted: 0, skipped: 0, pending: 0, error: err.message };
  }
};

const collectRooms = async (hostel, log = () => {}) => {
  const { Room } = require('../models');
  const { getHostelConnection } = require('./hostelDatabase');
  const rooms = new Map();
  const add = (list) => {
    (list || []).forEach((room) => rooms.set(Number(room.id), room));
  };

  if (hostel.database_name) {
    try {
      const conn = await getHostelConnection(hostel.database_name);
      add(await conn.models.Room.findAll());
    } catch (err) {
      log(`skip isolated rooms for hostel ${hostel.id} (${hostel.database_name}): ${err.message}`);
    }
  }

  add(await Room.findAll({ where: { hostel_id: hostel.id } }));
  return [...rooms.values()];
};

/**
 * One-off backfill for every hostel. Safe to re-run. Does not drop JSON columns.
 */
const migrateAllLegacyMedia = async ({ dryRun = false, log = console.log } = {}) => {
  const { Hostel, PropertyMedia } = require('../models');
  const hostels = await Hostel.findAll();
  const totals = {
    hostels: hostels.length,
    hostelInserted: 0,
    roomInserted: 0,
    skipped: 0,
    pending: 0,
    rooms: 0,
  };

  for (const hostel of hostels) {
    const hostelResult = await syncHostelJsonImages(hostel, { dryRun, PropertyMedia });
    totals.hostelInserted += hostelResult.inserted;
    totals.skipped += hostelResult.skipped;
    totals.pending += hostelResult.pending || 0;

    const rooms = await collectRooms(hostel, log);
    totals.rooms += rooms.length;
    for (const room of rooms) {
      const roomResult = await syncRoomJsonImages(hostel, room, { dryRun, PropertyMedia });
      totals.roomInserted += roomResult.inserted;
      totals.skipped += roomResult.skipped;
      totals.pending += roomResult.pending || 0;
    }
  }

  return totals;
};

module.exports = {
  LEGACY_MEDIA_TITLE,
  ALLOWED_PREFIXES,
  BLOCKED_PREFIXES,
  parseImageList,
  isAllowedLegacyPath,
  inferMimeType,
  copyImagePaths,
  syncHostelJsonImages,
  syncRoomJsonImages,
  syncHostelJsonImagesSafe,
  syncRoomJsonImagesSafe,
  migrateAllLegacyMedia,
};
