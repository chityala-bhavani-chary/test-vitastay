/**
 * PRD §6.6 minima (DEC-06: 360 is recommended, not publish-blocking).
 * can_publish is true when blocking counts pass, or Super Admin override is on file.
 * Public listing (MED-004) must call isListingPubliclyVisible — never skip this guard.
 */
const { getModelsForHostel } = require('../helpers/hostelContext');
const { toCoverObject } = require('./listingCover');

const REQUIRED = {
  exterior: 3,
  interior_common: 4,
  photos_per_listed_room: 2,
  cover: 1,
};

/** DEC-06 — still shown on the checklist; does not block Publish. BIC-039 may require for verified later. */
const RECOMMENDED = {
  panorama_360: 1,
};

const OVERRIDE_REASON_MIN = 10;
const OVERRIDE_REASON_MAX = 500;

const liveItems = (items) => items.filter((row) => {
  if (row.deletedAt || row.deleted_at) return false;
  if (row.is_published === false || row.is_published === 0) return false;
  return true;
});

const moreLabel = (needed, have, noun) => {
  const plural = needed === 1 ? noun : `${noun}s`;
  if (have <= 0) return `Add ${needed} ${plural}`;
  return `Add ${needed} more ${plural}`;
};

const computeChecklist = (items, rooms = []) => {
  const published = liveItems(items);
  const exterior = published.filter((row) => row.category === 'exterior').length;
  const interior = published.filter((row) => row.category === 'interior_common').length;
  const panos = published.filter((row) => row.category === 'panorama_360').length;
  const videos = published.filter((row) => row.category === 'walkthrough_video' || row.capture_kind === 'video').length;
  const coverRow = published.find((row) => row.is_cover === true || row.is_cover === 1) || null;
  const coverCount = published.filter((row) => row.is_cover === true || row.is_cover === 1).length;
  const roomPhotos = published.filter((row) => row.category === 'room');
  const floorPhotos = published.filter((row) => row.category === 'floor');

  const listedTypes = [...new Set(rooms.map((room) => room.room_type).filter(Boolean))];
  const byType = {};
  listedTypes.forEach((type) => {
    const typeRoomIds = new Set(
      rooms.filter((room) => room.room_type === type).map((room) => Number(room.id))
    );
    const count = roomPhotos.filter((row) => typeRoomIds.has(Number(row.room_id))).length;
    byType[type] = {
      count,
      required: REQUIRED.photos_per_listed_room,
      ok: count >= REQUIRED.photos_per_listed_room,
    };
  });
  const roomOk = listedTypes.length === 0 || Object.values(byType).every((row) => row.ok);

  const floorsWithRooms = [...new Set(
    rooms.map((room) => Number(room.floor)).filter((n) => Number.isFinite(n))
  )].sort((a, b) => a - b);
  const missingFloors = floorsWithRooms.filter((floor) => (
    !floorPhotos.some((row) => Number(row.floor_number) === floor)
  ));
  const floorOk = missingFloors.length === 0;

  const exteriorOk = exterior >= REQUIRED.exterior;
  const interiorOk = interior >= REQUIRED.interior_common;
  const panoOk = panos >= RECOMMENDED.panorama_360;
  const coverOk = coverCount === REQUIRED.cover;

  const missing = [];
  if (!exteriorOk) {
    const needed = REQUIRED.exterior - exterior;
    missing.push({
      code: 'exterior',
      count: exterior,
      required: REQUIRED.exterior,
      message: `${moreLabel(needed, exterior, 'outside photo')} (${exterior}/${REQUIRED.exterior})`,
    });
  }
  if (!interiorOk) {
    const needed = REQUIRED.interior_common - interior;
    missing.push({
      code: 'interior_common',
      count: interior,
      required: REQUIRED.interior_common,
      message: `${moreLabel(needed, interior, 'inside photo')} (${interior}/${REQUIRED.interior_common})`,
    });
  }
  listedTypes.forEach((type) => {
    const row = byType[type];
    if (row.ok) return;
    const needed = row.required - row.count;
    missing.push({
      code: 'room',
      room_type: type,
      count: row.count,
      required: row.required,
      message: `${moreLabel(needed, row.count, `${type} room photo`)} (${row.count}/${row.required})`,
    });
  });
  missingFloors.forEach((floor) => {
    missing.push({
      code: 'floor',
      floor_number: floor,
      count: 0,
      required: 1,
      message: `Add a floor photo for floor ${floor}`,
    });
  });
  if (!coverOk) {
    missing.push({
      code: 'cover',
      count: coverCount,
      required: REQUIRED.cover,
      message: coverCount > 1 ? 'Keep exactly one cover image' : 'Set a cover image',
    });
  }

  const recommended = [];
  if (!panoOk) {
    recommended.push({
      code: 'panorama_360',
      count: panos,
      recommended: RECOMMENDED.panorama_360,
      message: panos <= 0
        ? 'Recommended: add a 360° tour so seekers can look around (not required to publish)'
        : `Recommended: add ${RECOMMENDED.panorama_360 - panos} more 360° (${panos}/${RECOMMENDED.panorama_360})`,
    });
  }
  if (videos <= 0) {
    recommended.push({
      code: 'walkthrough_video',
      count: videos,
      recommended: 1,
      message: 'Optional: add a short MP4 walkthrough (does not replace 360°)',
    });
  }

  // DEC-06: 360 is recommended only — still shows on checklist / “No 360 yet” badge.
  // BIC-035: video is optional and never blocks publish or 360.
  const minimaOk = exteriorOk && interiorOk && roomOk && floorOk && coverOk;

  return {
    exterior: { count: exterior, required: REQUIRED.exterior, ok: exteriorOk },
    interior_common: { count: interior, required: REQUIRED.interior_common, ok: interiorOk },
    room: {
      count: roomPhotos.length,
      required_per_listed_room: REQUIRED.photos_per_listed_room,
      ok: roomOk,
      by_type: byType,
    },
    floor: {
      count: floorPhotos.length,
      required_floors: floorsWithRooms.length,
      ok: floorOk,
      missing_floors: missingFloors,
    },
    panorama_360: {
      count: panos,
      recommended: RECOMMENDED.panorama_360,
      required: 0,
      ok: panoOk,
      blocking: false,
    },
    walkthrough_video: {
      count: videos,
      recommended: 1,
      required: 0,
      ok: videos > 0,
      blocking: false,
    },
    cover: {
      count: coverCount,
      required: REQUIRED.cover,
      ok: coverOk,
      item: toCoverObject(coverRow),
    },
    missing,
    recommended,
    has_360: panos > 0,
    has_walkthrough_video: videos > 0,
    minima_ok: minimaOk,
    can_publish: minimaOk,
  };
};

const overrideActive = (hostel) => Boolean(hostel?.media_override_reason);

const attachPublishState = (computed, hostel) => {
  const hasOverride = overrideActive(hostel);
  const { entitlementsOf } = require('./ownerPlan');
  const flags = entitlementsOf(hostel);
  return {
    ...computed,
    minima_ok: computed.minima_ok,
    can_publish: Boolean((computed.minima_ok || hasOverride) && flags.listing_publish),
    marketplace_ok: Boolean(flags.public_search),
    listing_publish: Boolean(flags.listing_publish),
    plan: flags.plan,
    listing_published: Boolean(hostel?.listing_published),
    listing_published_at: hostel?.listing_published_at || null,
    listing_moderated_by: hostel?.listing_moderated_by || null,
    listing_unpublish_reason: hostel?.listing_unpublish_reason || null,
    hostel_status: hostel?.status || null,
    has_360: Boolean(computed.has_360),
    override: hasOverride ? {
      reason: hostel.media_override_reason,
      by: hostel.media_override_by || null,
      at: hostel.media_override_at || null,
    } : null,
    missing: computed.minima_ok ? [] : (computed.missing || []),
    recommended: computed.recommended || [],
  };
};

const buildChecklist = async (hostel, items) => {
  const ctx = await getModelsForHostel(hostel);
  const rooms = await ctx.models.Room.findAll({
    where: { hostel_id: hostel.id },
    attributes: ['id', 'room_type', 'floor'],
  });
  return attachPublishState(computeChecklist(items, rooms), hostel);
};

const loadChecklist = async (hostel) => {
  const { PropertyMedia } = require('../models');
  const items = await PropertyMedia.findAll({ where: { hostel_id: hostel.id } });
  return buildChecklist(hostel, items);
};

/**
 * MED-004 / public GET must refuse unpublished hostels even if someone guesses the id.
 */
const isListingPubliclyVisible = (hostel, checklist) => {
  if (!hostel || !checklist) return false;
  if (!hostel.listing_published) return false;
  if (String(hostel.status) !== 'active') return false;
  const { marketplaceOk } = require('./ownerPlan');
  if (!marketplaceOk(hostel)) return false;
  return Boolean(checklist.minima_ok || overrideActive(hostel));
};

const validateOverrideReason = (raw) => {
  const reason = String(raw || '').trim();
  if (reason.length < OVERRIDE_REASON_MIN) {
    return { ok: false, message: `Override reason must be at least ${OVERRIDE_REASON_MIN} characters` };
  }
  if (reason.length > OVERRIDE_REASON_MAX) {
    return { ok: false, message: `Override reason must be ${OVERRIDE_REASON_MAX} characters or fewer` };
  }
  return { ok: true, reason };
};

module.exports = {
  REQUIRED,
  RECOMMENDED,
  OVERRIDE_REASON_MIN,
  computeChecklist,
  attachPublishState,
  buildChecklist,
  loadChecklist,
  isListingPubliclyVisible,
  validateOverrideReason,
};
