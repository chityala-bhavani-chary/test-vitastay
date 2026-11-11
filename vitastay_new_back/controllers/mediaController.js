/**
 * POST /api/hostels/:hostelId/media
 * Roles: owner, supervisor (assigned), super_admin
 * Side effects: writes /uploads/media, audit_logs, unsets previous cover if is_cover
 */
const { Op } = require('sequelize');
const { PropertyMedia, sequelize } = require('../models');
const { success, created, error } = require('../utils/response');
const { createAuditLog } = require('../helpers/audit');
const { getModelsForHostel } = require('../helpers/hostelContext');
const {
  loadChecklist,
  validateOverrideReason,
} = require('../services/mediaPublishGuard');
const mediaStorage = require('../services/mediaStorage');
const { toCoverObject, selectListingCover } = require('../services/listingCover');

const CATEGORIES = PropertyMedia.CATEGORIES;
const CAPTION_MAX = 200;
const MEDIA_MAX_PER_HOSTEL = mediaStorage.MEDIA_MAX_PER_HOSTEL;

const quotaPayload = (used) => ({
  used,
  max: MEDIA_MAX_PER_HOSTEL,
  remaining: Math.max(0, MEDIA_MAX_PER_HOSTEL - used),
});

const persistUploadedFile = async (file, { isPano = false, isVideo = false } = {}) => {
  let width = null;
  let height = null;
  let fileSize = file.size;
  if (isVideo) {
    const thumb = await mediaStorage.writeVideoThumbnail(file.path);
    return {
      file_path: mediaStorage.toPublicPath(file.path),
      thumb_path: thumb.thumbPath,
      mime_type: file.mimetype || 'video/mp4',
      file_size: fileSize,
      width: null,
      height: null,
    };
  }
  if (!isPano) {
    const compressed = await mediaStorage.compressListingPhoto(file.path, file.mimetype);
    width = compressed.width;
    height = compressed.height;
    if (compressed.size) fileSize = compressed.size;
  }
  const thumb = isPano
    ? await mediaStorage.writePanoPreview(file.path)
    : await mediaStorage.writeThumbnail(file.path);
  return {
    file_path: mediaStorage.toPublicPath(file.path),
    thumb_path: thumb.thumbPath,
    mime_type: file.mimetype,
    file_size: fileSize,
    width: width || thumb.width,
    height: height || thumb.height,
  };
};

const parseBool = (value) => {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on') return true;
  if (value === false || value === 0 || value === '0' || value === 'false' || value === '') return false;
  return undefined;
};

const parseIntOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
};

const toItem = (row) => ({
  id: row.id,
  category: row.category,
  capture_kind: row.capture_kind,
  room_id: row.room_id,
  room_number: row.room_number || null,
  floor_number: row.floor_number,
  caption: row.caption,
  title: row.title,
  url: mediaStorage.publicAssetUrl(row.file_path),
  thumb_url: mediaStorage.publicAssetUrl(
    row.thumb_path
      || ((row.capture_kind === 'video' || row.category === 'walkthrough_video') ? null : row.file_path)
  ),
  mime_type: row.mime_type,
  file_size: row.file_size,
  width: row.width,
  height: row.height,
  sort_order: row.sort_order,
  is_cover: Boolean(row.is_cover),
  is_published: row.is_published !== false && row.is_published !== 0,
  aspect_ok: mediaStorage.isEquirectangular(row.width, row.height),
  uploaded_by: row.uploaded_by || null,
  deleted_at: row.deletedAt || row.deleted_at || null,
});

const unlinkReqFiles = (files) => {
  (files || []).forEach((file) => mediaStorage.removeAbs(file.path));
};

const resolveRoom = async (hostel, roomId) => {
  const ctx = await getModelsForHostel(hostel);
  const room = await ctx.models.Room.findByPk(roomId);
  if (!room || Number(room.hostel_id) !== Number(hostel.id)) return null;
  return room;
};

const validatePlacement = async (hostel, { category, roomId, floorNumber }) => {
  if (!CATEGORIES.includes(category)) {
    return 'Invalid category';
  }
  if (category === 'room') {
    if (!roomId) return 'Room is required for room photos';
    const room = await resolveRoom(hostel, roomId);
    if (!room) return 'Room not found';
  }
  if (category === 'floor') {
    if (floorNumber === null) return 'Floor is required for floor photos';
    if (!Number.isInteger(floorNumber) || Number.isNaN(floorNumber)) return 'Invalid floor_number';
    const maxFloors = Math.max(Number(hostel.total_floors) || 1, 1);
    if (floorNumber < 1 || floorNumber > maxFloors) return 'Invalid floor_number';
  }
  if (category === 'panorama_360') {
    if (roomId) {
      const room = await resolveRoom(hostel, roomId);
      if (!room) return 'Room not found';
    }
    if (floorNumber !== null) {
      if (!Number.isInteger(floorNumber) || Number.isNaN(floorNumber)) return 'Invalid floor_number';
      const maxFloors = Math.max(Number(hostel.total_floors) || 1, 1);
      if (floorNumber < 1 || floorNumber > maxFloors) return 'Invalid floor_number';
    }
  }
  return null;
};

const list = async (req, res, next) => {
  try {
    const hostel = req.hostel;
    const includeDeleted = String(req.query.include_deleted || 'false') === 'true';
    const allRows = await PropertyMedia.findAll({
      where: { hostel_id: hostel.id },
      paranoid: !includeDeleted,
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });

    let rows = allRows;
    if (!includeDeleted) {
      const ctx = await getModelsForHostel(hostel);
      const liveRooms = await ctx.models.Room.findAll({
        where: ctx.isolated ? {} : { hostel_id: hostel.id },
        attributes: ['id'],
      });
      const liveIds = new Set(liveRooms.map((room) => Number(room.id)));
      rows = rows.filter((row) => {
        if (row.category === 'room') return liveIds.has(Number(row.room_id));
        if (row.category === 'panorama_360' && row.room_id) return liveIds.has(Number(row.room_id));
        return true;
      });
    }
    if (req.query.category) {
      rows = rows.filter((row) => row.category === req.query.category);
    }
    if (req.query.room_id) {
      rows = rows.filter((row) => Number(row.room_id) === Number(req.query.room_id));
    }
    if (req.query.floor_number !== undefined && req.query.floor_number !== '') {
      rows = rows.filter((row) => Number(row.floor_number) === Number(req.query.floor_number));
    }

    const liveRows = allRows.filter((row) => !(row.deletedAt || row.deleted_at));
    const coverRow = liveRows.find((row) => row.is_cover);
    const checklist = await loadChecklist(hostel);

    return success(res, {
      cover: toCoverObject(coverRow, hostel.name),
      checklist,
      quota: quotaPayload(liveRows.length),
      items: rows.map(toItem),
    });
  } catch (err) {
    next(err);
  }
};

const checklist = async (req, res, next) => {
  try {
    const data = await loadChecklist(req.hostel);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const sendListing = async (res, next, work) => {
  try {
    const result = await work();
    return success(res, result.checklist, result.message);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode, err.errors);
    next(err);
  }
};

const publishListing = (req, res, next) => sendListing(res, next, () => (
  require('../services/listingPublish').publishListing({ hostel: req.hostel, user: req.user, req })
));

const unpublishListing = (req, res, next) => sendListing(res, next, () => (
  require('../services/listingPublish').unpublishListing({
    hostel: req.hostel,
    user: req.user,
    req,
    reason: req.body?.reason,
    trigger: 'owner',
    clearOverride: true,
  })
));

/**
 * POST /api/hostels/:hostelId/media/override
 * Roles: super_admin
 * Side effects: writes override reason, publishes listing, audit_logs
 */
const overridePublish = async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') {
      return error(res, 'Forbidden', 403);
    }
    const hostel = req.hostel;
    const { assertEntitlement } = require('../services/ownerPlan');
    try {
      assertEntitlement(hostel, 'listing_publish');
    } catch (err) {
      if (err.statusCode === 403) return error(res, err.message, 403);
      throw err;
    }
    if (hostel.status !== 'active') {
      return error(res, 'Hostel must be active before publishing the listing', 422);
    }
    try {
      require('../services/ownerKyc').assertOwnerKycForPublish(hostel);
    } catch (err) {
      if (err.statusCode) return error(res, err.message, err.statusCode);
      throw err;
    }
    const checked = validateOverrideReason(req.body?.reason);
    if (!checked.ok) return error(res, checked.message, 422);

    await hostel.update({
      media_override_reason: checked.reason,
      media_override_by: req.user.id,
      media_override_at: new Date(),
      listing_published: true,
      listing_published_at: new Date(),
      listing_moderated_by: null,
      listing_moderated_at: null,
      listing_unpublish_reason: null,
    });
    const { clearListingVisibilityCache } = require('../services/uploadAccess');
    clearListingVisibilityCache(hostel.id);
    await createAuditLog({
      userId: req.user.id,
      action: 'MEDIA_OVERRIDE',
      entityType: 'hostel',
      entityId: hostel.id,
      newValues: { reason: checked.reason, listing_published: true },
      req,
    });
    await createAuditLog({
      userId: req.user.id,
      action: 'MEDIA_OVERRIDE',
      entityType: 'property_media',
      entityId: hostel.id,
      newValues: { hostel_id: hostel.id, reason: checked.reason, listing_published: true },
      req,
    });
    await require('../services/listingProjection').refreshListingProjection(hostel);
    return success(res, await loadChecklist(hostel), 'Listing published with media override');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const files = req.files || [];
  try {
    const hostel = req.hostel;
    const category = String(req.body.category || '').trim();
    const caption = req.body.caption != null ? String(req.body.caption) : null;
    const roomId = parseIntOrNull(req.body.room_id);
    const floorNumber = parseIntOrNull(req.body.floor_number);
    const isCover = parseBool(req.body.is_cover) === true;
    const sortStart = parseIntOrNull(req.body.sort_order);

    if (!files.length) {
      return error(res, 'At least one file is required', 400);
    }
    if (caption && caption.length > CAPTION_MAX) {
      unlinkReqFiles(files);
      return error(res, 'Caption must be 200 characters or fewer', 422);
    }
    if (roomId !== null && Number.isNaN(roomId)) {
      unlinkReqFiles(files);
      return error(res, 'Invalid room_id', 422);
    }
    if (req.body.floor_number !== undefined && req.body.floor_number !== '' && Number.isNaN(floorNumber)) {
      unlinkReqFiles(files);
      return error(res, 'Invalid floor_number', 422);
    }

    const placementError = await validatePlacement(hostel, { category, roomId, floorNumber });
    if (placementError) {
      unlinkReqFiles(files);
      return error(res, placementError, 422);
    }

    const isPano = category === 'panorama_360';
    const isVideo = category === 'walkthrough_video';
    const maxBytes = isVideo
      ? mediaStorage.VIDEO_MAX_BYTES
      : (isPano ? mediaStorage.PANO_MAX_BYTES : mediaStorage.PHOTO_MAX_BYTES);
    const oversized = files.find((file) => file.size > maxBytes);
    if (oversized) {
      unlinkReqFiles(files);
      return error(res, mediaStorage.tooLargeMessage(isVideo ? 'video' : (isPano ? 'panorama_360' : 'photo')), 413);
    }

    for (const file of files) {
      const mime = String(file.mimetype || '').toLowerCase();
      const ext = require('path').extname(file.originalname || '').toLowerCase();
      if (isVideo) {
        if (!mediaStorage.VIDEO_MIME.has(mime) && !mediaStorage.VIDEO_EXT.has(ext)) {
          unlinkReqFiles(files);
          return error(res, 'Walkthrough video must be MP4 (video/mp4).', 400);
        }
      } else if (mediaStorage.VIDEO_MIME.has(mime) || mediaStorage.VIDEO_EXT.has(ext)) {
        unlinkReqFiles(files);
        return error(res, 'MP4 uploads belong in the Video walkthrough category.', 400);
      }
    }

    const used = await PropertyMedia.count({ where: { hostel_id: hostel.id } });
    if (used + files.length > MEDIA_MAX_PER_HOSTEL) {
      unlinkReqFiles(files);
      const left = Math.max(0, MEDIA_MAX_PER_HOSTEL - used);
      return error(
        res,
        `Hostel can hold ${MEDIA_MAX_PER_HOSTEL} media files. ${left} remaining.`,
        422
      );
    }

    const linkRoom = category === 'room' || (isPano && roomId);
    const linkFloor = category === 'floor' || (isPano && floorNumber !== null);
    let roomNumber = null;
    if (linkRoom) {
      const room = await resolveRoom(hostel, roomId);
      roomNumber = room.room_number;
    }

    const maxRow = await PropertyMedia.findOne({
      where: { hostel_id: hostel.id },
      order: [['sort_order', 'DESC']],
      paranoid: false,
    });
    let nextSort = Number.isInteger(sortStart) ? sortStart : (maxRow ? maxRow.sort_order + 1 : 0);

    const createdRows = [];
    await sequelize.transaction(async (transaction) => {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const stored = await persistUploadedFile(file, { isPano, isVideo });
        const row = await PropertyMedia.create({
          hostel_id: hostel.id,
          category,
          capture_kind: isVideo ? 'video' : (isPano ? 'panorama_360' : 'photo'),
          room_id: linkRoom ? roomId : null,
          room_number: linkRoom ? roomNumber : null,
          floor_number: linkFloor ? floorNumber : null,
          caption,
          file_path: stored.file_path,
          thumb_path: stored.thumb_path,
          mime_type: stored.mime_type,
          file_size: stored.file_size,
          width: stored.width,
          height: stored.height,
          sort_order: nextSort,
          is_cover: !isVideo && isCover && i === 0,
          is_published: true,
          uploaded_by: req.user.id,
        }, { transaction });
        createdRows.push(row);
        nextSort += 1;
      }
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'property_media',
      entityId: createdRows[0].id,
      newValues: {
        hostel_id: hostel.id,
        category,
        uploaded_by: req.user.id,
        role: req.user.role,
        ids: createdRows.map((row) => row.id),
        count: createdRows.length,
        files: createdRows.map((row, i) => ({
          id: row.id,
          file_path: row.file_path,
          original_name: files[i]?.originalname || null,
        })),
      },
      req,
    });

    return created(res, { items: createdRows.map(toItem) }, 'Media uploaded');
  } catch (err) {
    unlinkReqFiles(files);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const hostel = req.hostel;
    const row = await PropertyMedia.findOne({
      where: { id: req.params.mediaId, hostel_id: hostel.id },
    });
    if (!row) return error(res, 'Media not found', 404);

    const oldValues = row.toJSON();
    const payload = {};

    if (req.body.caption !== undefined) {
      const caption = req.body.caption == null ? null : String(req.body.caption);
      if (caption && caption.length > CAPTION_MAX) {
        return error(res, 'Caption must be 200 characters or fewer', 422);
      }
      payload.caption = caption;
    }
    if (req.body.sort_order !== undefined) {
      const sortOrder = parseIntOrNull(req.body.sort_order);
      if (!Number.isInteger(sortOrder)) return error(res, 'Invalid sort_order', 422);
      payload.sort_order = sortOrder;
    }
    if (req.body.is_cover !== undefined) {
      const isCover = parseBool(req.body.is_cover);
      if (isCover === undefined) return error(res, 'Invalid is_cover', 422);
      if (isCover === true && (row.category === 'walkthrough_video' || row.capture_kind === 'video')) {
        return error(res, 'Walkthrough video cannot be the listing cover', 422);
      }
      if (isCover === false && row.is_cover) {
        return error(res, 'Set another photo as cover first — listings need exactly one cover', 422);
      }
      payload.is_cover = isCover;
    }
    if (req.body.is_published !== undefined) {
      const isPublished = parseBool(req.body.is_published);
      if (isPublished === undefined) return error(res, 'Invalid is_published', 422);
      payload.is_published = isPublished;
    }
    if (req.body.title !== undefined) {
      payload.title = req.body.title == null ? null : String(req.body.title).slice(0, 150);
    }

    const nextCategory = req.body.category !== undefined ? String(req.body.category) : row.category;
    const nextRoomId = req.body.room_id !== undefined ? parseIntOrNull(req.body.room_id) : row.room_id;
    const nextFloor = req.body.floor_number !== undefined
      ? parseIntOrNull(req.body.floor_number)
      : row.floor_number;

    if (req.body.room_id !== undefined && Number.isNaN(nextRoomId)) {
      return error(res, 'Invalid room_id', 422);
    }
    if (req.body.floor_number !== undefined && req.body.floor_number !== null && Number.isNaN(nextFloor)) {
      return error(res, 'Invalid floor_number', 422);
    }

    const placementError = await validatePlacement(hostel, {
      category: nextCategory,
      roomId: nextRoomId,
      floorNumber: nextFloor,
    });
    if (placementError) return error(res, placementError, 422);

    payload.category = nextCategory;
    if (nextCategory === 'walkthrough_video') {
      payload.capture_kind = 'video';
    } else if (nextCategory === 'panorama_360') {
      payload.capture_kind = 'panorama_360';
    } else if (row.capture_kind === 'video') {
      payload.capture_kind = 'photo';
    } else {
      payload.capture_kind = row.capture_kind || 'photo';
    }
    if (nextCategory === 'room' || (nextCategory === 'panorama_360' && nextRoomId)) {
      const room = await resolveRoom(hostel, nextRoomId);
      payload.room_id = nextRoomId;
      payload.room_number = room.room_number;
    } else if (req.body.category !== undefined || req.body.room_id !== undefined) {
      payload.room_id = null;
      payload.room_number = null;
    }
    if (nextCategory === 'floor' || nextCategory === 'panorama_360' || req.body.floor_number !== undefined) {
      payload.floor_number = (nextCategory === 'floor' || nextCategory === 'panorama_360')
        ? nextFloor
        : (req.body.floor_number !== undefined ? nextFloor : row.floor_number);
    }

    await sequelize.transaction(async (transaction) => {
      await row.update(payload, { transaction });
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'property_media',
      entityId: row.id,
      oldValues,
      newValues: row.toJSON(),
      req,
    });

    return success(res, toItem(row), 'Media updated');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const hostel = req.hostel;
    const row = await PropertyMedia.findOne({
      where: { id: req.params.mediaId, hostel_id: hostel.id },
    });
    if (!row) return error(res, 'Media not found', 404);

    const oldValues = row.toJSON();
    const wasCover = Boolean(row.is_cover);
    await sequelize.transaction(async (transaction) => {
      await row.destroy({ transaction });
      if (wasCover) {
        const remaining = await PropertyMedia.findAll({
          where: { hostel_id: hostel.id, is_published: true },
          transaction,
        });
        const nextCover = selectListingCover(remaining);
        if (nextCover && !nextCover.is_cover) {
          await nextCover.update({ is_cover: true }, { transaction });
        }
      }
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'property_media',
      entityId: row.id,
      oldValues,
      req,
    });

    return success(res, { id: row.id, deleted: true }, 'Media deleted');
  } catch (err) {
    next(err);
  }
};

const reorder = async (req, res, next) => {
  try {
    const hostel = req.hostel;
    const items = req.body.items;
    if (!Array.isArray(items) || !items.length) {
      return error(res, 'items array is required', 422);
    }

    const ids = items.map((item) => Number(item.id)).filter((id) => Number.isInteger(id));
    if (ids.length !== items.length) return error(res, 'Invalid media id in reorder', 422);

    const rows = await PropertyMedia.findAll({
      where: { hostel_id: hostel.id, id: { [Op.in]: ids } },
    });
    if (rows.length !== ids.length) return error(res, 'Media not found', 404);

    await sequelize.transaction(async (transaction) => {
      for (const item of items) {
        const sortOrder = Number(item.sort_order);
        if (!Number.isInteger(sortOrder)) {
          const err = new Error('Invalid sort_order');
          err.statusCode = 422;
          throw err;
        }
        await PropertyMedia.update(
          { sort_order: sortOrder },
          { where: { id: item.id, hostel_id: hostel.id }, transaction }
        );
      }
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'property_media',
      entityId: ids[0],
      newValues: { hostel_id: hostel.id, reorder: items },
      req,
    });

    const updated = await PropertyMedia.findAll({
      where: { hostel_id: hostel.id },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });
    return success(res, { items: updated.map(toItem) }, 'Media reordered');
  } catch (err) {
    next(err);
  }
};

const replaceFile = async (req, res, next) => {
  const files = req.files || [];
  try {
    if (files.length !== 1) {
      unlinkReqFiles(files);
      return error(res, 'Exactly one file is required to replace', 400);
    }
    const hostel = req.hostel;
    const row = await PropertyMedia.findOne({
      where: { id: req.params.mediaId, hostel_id: hostel.id },
    });
    if (!row) {
      unlinkReqFiles(files);
      return error(res, 'Media not found', 404);
    }

    const file = files[0];
    const isPano = row.category === 'panorama_360';
    const isVideo = row.category === 'walkthrough_video' || row.capture_kind === 'video';
    const maxBytes = isVideo
      ? mediaStorage.VIDEO_MAX_BYTES
      : (isPano ? mediaStorage.PANO_MAX_BYTES : mediaStorage.PHOTO_MAX_BYTES);
    if (file.size > maxBytes) {
      unlinkReqFiles(files);
      return error(res, mediaStorage.tooLargeMessage(isVideo ? 'video' : (isPano ? 'panorama_360' : 'photo')), 413);
    }
    const mime = String(file.mimetype || '').toLowerCase();
    const ext = require('path').extname(file.originalname || '').toLowerCase();
    if (isVideo) {
      if (!mediaStorage.VIDEO_MIME.has(mime) && !mediaStorage.VIDEO_EXT.has(ext)) {
        unlinkReqFiles(files);
        return error(res, 'Walkthrough video must be MP4 (video/mp4).', 400);
      }
    } else if (mediaStorage.VIDEO_MIME.has(mime) || mediaStorage.VIDEO_EXT.has(ext)) {
      unlinkReqFiles(files);
      return error(res, 'MP4 uploads belong in the Video walkthrough category.', 400);
    }

    const oldPath = row.file_path;
    const oldThumb = row.thumb_path;
    const stored = await persistUploadedFile(file, { isPano, isVideo });
    await row.update({ ...stored, uploaded_by: req.user.id });

    mediaStorage.removePublic(oldPath);
    if (oldThumb && oldThumb !== oldPath) mediaStorage.removePublic(oldThumb);

    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'property_media',
      entityId: row.id,
      oldValues: { file_path: oldPath, thumb_path: oldThumb },
      newValues: {
        file_path: row.file_path,
        replaced: true,
        original_name: file.originalname || null,
        uploaded_by: req.user.id,
        role: req.user.role,
      },
      req,
    });

    return success(res, toItem(row), isVideo ? 'Video replaced' : 'Photo replaced');
  } catch (err) {
    unlinkReqFiles(files);
    next(err);
  }
};

const restore = async (req, res, next) => {
  try {
    const hostel = req.hostel;
    const row = await PropertyMedia.findOne({
      where: { id: req.params.mediaId, hostel_id: hostel.id },
      paranoid: false,
    });
    if (!row || !row.deletedAt) return error(res, 'Media not found', 404);

    const used = await PropertyMedia.count({ where: { hostel_id: hostel.id } });
    if (used >= MEDIA_MAX_PER_HOSTEL) {
      return error(res, `Hostel can hold ${MEDIA_MAX_PER_HOSTEL} photos.`, 422);
    }

    await sequelize.transaction(async (transaction) => {
      const liveCover = await PropertyMedia.findOne({
        where: { hostel_id: hostel.id, is_cover: true, id: { [Op.ne]: row.id } },
        transaction,
      });
      if (liveCover && row.is_cover) {
        await PropertyMedia.update(
          { is_cover: false },
          { where: { id: row.id }, paranoid: false, transaction, hooks: false }
        );
        row.is_cover = false;
      }
      await row.restore({ transaction });
    });
    await row.reload();

    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'property_media',
      entityId: row.id,
      newValues: { restored: true, is_cover: row.is_cover },
      req,
    });

    return success(res, toItem(row), 'Photo restored');
  } catch (err) {
    next(err);
  }
};

const attachDemoPack = async (req, res, next) => {
  try {
    const result = await require('../services/seedDemoMedia').attachToHostel(req.hostel, req.user);
    return success(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  create,
  update,
  remove,
  reorder,
  replaceFile,
  restore,
  checklist,
  publishListing,
  unpublishListing,
  overridePublish,
  attachDemoPack,
};
