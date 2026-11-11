/**
 * BIC-029 — schedule physical or video visit. Never holds a bed.
 */
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const {
  Hostel, ListingVisitSlot, ListingVisit, ListingProjection, User, SupervisorHostel,
} = require('../models');

const MODES = new Set(['physical', 'video']);
const OWNER_STATUSES = new Set(['confirmed', 'cancelled', 'completed', 'no_show']);
const ACTIVE_BOOKING = ['requested', 'confirmed'];

const httpError = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  throw err;
};

const canManageHostel = async (user, hostel) => {
  if (!user || !hostel) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'owner') return Number(hostel.owner_id) === Number(user.id);
  if (user.role === 'supervisor') {
    const row = await SupervisorHostel.findOne({
      where: { supervisor_id: user.id, hostel_id: hostel.id },
    });
    return Boolean(row);
  }
  return false;
};

const findHostel = async (idOrCode) => {
  const raw = String(idOrCode || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Hostel.findByPk(raw);
  return Hostel.findOne({ where: { code: { [Op.eq]: raw } } });
};

const assertPublished = async (hostel) => {
  if (!hostel) httpError(404, 'Listing not found');
  const projection = await ListingProjection.findOne({
    where: { hostel_id: hostel.id, is_public: true, marketplace_ok: true },
  });
  if (!projection) httpError(422, 'Visits are only available on published listings');
  return projection;
};

const bookedCount = async (slotId) => ListingVisit.count({
  where: { slot_id: slotId, status: { [Op.in]: ACTIVE_BOOKING } },
});

const serializeSlot = async (slot, { withRemaining = true } = {}) => {
  const booked = withRemaining ? await bookedCount(slot.id) : 0;
  const capacity = Number(slot.capacity) || 1;
  return {
    id: slot.id,
    hostel_id: slot.hostel_id,
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    visit_mode: slot.visit_mode,
    video_url: slot.visit_mode === 'video' ? slot.video_url : null,
    capacity,
    booked,
    remaining: Math.max(0, capacity - booked),
    status: slot.status,
  };
};

const serializeVisit = (visit, slot = null, hostel = null) => ({
  id: visit.id,
  hostel_id: visit.hostel_id,
  code: hostel?.code || null,
  name: hostel?.name || null,
  slot_id: visit.slot_id,
  seeker_id: visit.seeker_id,
  visit_mode: visit.visit_mode,
  status: visit.status,
  video_url: visit.video_url || slot?.video_url || null,
  seeker_note: visit.seeker_note,
  owner_note: visit.owner_note,
  starts_at: slot?.starts_at || visit.slot?.starts_at || null,
  ends_at: slot?.ends_at || visit.slot?.ends_at || null,
  decided_at: visit.decided_at,
  created_at: visit.created_at,
  holds_bed: false,
});

const createSlot = async (user, hostelId, body) => {
  const hostel = await Hostel.findByPk(hostelId);
  if (!hostel) httpError(404, 'Hostel not found');
  if (!(await canManageHostel(user, hostel))) httpError(403, 'Forbidden');

  const starts = dayjs(body.starts_at);
  const ends = body.ends_at ? dayjs(body.ends_at) : starts.add(1, 'hour');
  if (!starts.isValid() || !ends.isValid()) httpError(422, 'starts_at must be a valid datetime');
  if (!ends.isAfter(starts)) httpError(422, 'ends_at must be after starts_at');
  if (starts.isBefore(dayjs())) httpError(422, 'Cannot create a slot in the past');

  const mode = String(body.visit_mode || 'physical').toLowerCase();
  if (!MODES.has(mode)) httpError(422, 'visit_mode must be physical or video');
  const videoUrl = mode === 'video' ? String(body.video_url || '').trim().slice(0, 500) || null : null;
  const capacity = Math.min(20, Math.max(1, Number(body.capacity) || 1));

  const slot = await ListingVisitSlot.create({
    hostel_id: hostel.id,
    starts_at: starts.toDate(),
    ends_at: ends.toDate(),
    visit_mode: mode,
    video_url: videoUrl,
    capacity,
    status: 'open',
    created_by: user.id,
  });
  return serializeSlot(slot);
};

const listOwnerSlots = async (user, hostelId) => {
  const hostel = await Hostel.findByPk(hostelId);
  if (!hostel) httpError(404, 'Hostel not found');
  if (!(await canManageHostel(user, hostel))) httpError(403, 'Forbidden');
  const slots = await ListingVisitSlot.findAll({
    where: {
      hostel_id: hostel.id,
      starts_at: { [Op.gte]: dayjs().subtract(1, 'day').toDate() },
    },
    order: [['starts_at', 'ASC']],
  });
  return {
    items: await Promise.all(slots.map((slot) => serializeSlot(slot))),
    holds_bed: false,
  };
};

const cancelSlot = async (user, hostelId, slotId) => {
  const hostel = await Hostel.findByPk(hostelId);
  if (!hostel) httpError(404, 'Hostel not found');
  if (!(await canManageHostel(user, hostel))) httpError(403, 'Forbidden');
  const slot = await ListingVisitSlot.findOne({ where: { id: slotId, hostel_id: hostel.id } });
  if (!slot) httpError(404, 'Slot not found');
  await slot.update({ status: 'cancelled' });
  await ListingVisit.update(
    { status: 'cancelled', decided_at: new Date(), decided_by: user.id, owner_note: 'Slot cancelled' },
    { where: { slot_id: slot.id, status: { [Op.in]: ACTIVE_BOOKING } } }
  );
  return { cancelled: true, id: slot.id };
};

const listOwnerVisits = async (user, hostelId) => {
  const hostel = await Hostel.findByPk(hostelId);
  if (!hostel) httpError(404, 'Hostel not found');
  if (!(await canManageHostel(user, hostel))) httpError(403, 'Forbidden');
  const visits = await ListingVisit.findAll({
    where: { hostel_id: hostel.id },
    include: [
      { model: ListingVisitSlot, as: 'slot' },
      { model: User, as: 'seeker', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
    ],
    order: [['created_at', 'DESC']],
    limit: 100,
  });
  return {
    items: visits.map((v) => ({
      ...serializeVisit(v, v.slot, hostel),
      seeker: v.seeker
        ? {
          id: v.seeker.id,
          name: `${v.seeker.first_name || ''} ${v.seeker.last_name || ''}`.trim(),
          email: v.seeker.email,
          phone: v.seeker.phone,
        }
        : null,
    })),
    holds_bed: false,
  };
};

const updateVisitStatus = async (user, hostelId, visitId, body) => {
  const hostel = await Hostel.findByPk(hostelId);
  if (!hostel) httpError(404, 'Hostel not found');
  if (!(await canManageHostel(user, hostel))) httpError(403, 'Forbidden');
  const status = String(body.status || '').toLowerCase();
  if (!OWNER_STATUSES.has(status)) {
    httpError(422, 'status must be confirmed, cancelled, completed, or no_show');
  }
  const visit = await ListingVisit.findOne({
    where: { id: visitId, hostel_id: hostel.id },
    include: [{ model: ListingVisitSlot, as: 'slot' }],
  });
  if (!visit) httpError(404, 'Visit not found');

  const patch = {
    status,
    decided_at: new Date(),
    decided_by: user.id,
  };
  if (body.owner_note != null) patch.owner_note = String(body.owner_note).slice(0, 500);
  if (body.video_url != null && visit.visit_mode === 'video') {
    patch.video_url = String(body.video_url).trim().slice(0, 500) || null;
  }
  await visit.update(patch);
  return serializeVisit(visit, visit.slot, hostel);
};

const listPublicSlots = async (idOrCode) => {
  const hostel = await findHostel(idOrCode);
  await assertPublished(hostel);
  const slots = await ListingVisitSlot.findAll({
    where: {
      hostel_id: hostel.id,
      status: 'open',
      starts_at: { [Op.gt]: new Date() },
    },
    order: [['starts_at', 'ASC']],
    limit: 40,
  });
  const items = [];
  for (const slot of slots) {
    const row = await serializeSlot(slot);
    if (row.remaining > 0) items.push(row);
  }
  return { hostel_id: hostel.id, code: hostel.code, items, holds_bed: false };
};

const bookVisit = async (seekerId, body) => {
  const slotId = Number(body.slot_id);
  if (!Number.isInteger(slotId) || slotId <= 0) httpError(422, 'slot_id is required');
  const slot = await ListingVisitSlot.findByPk(slotId);
  if (!slot || slot.status !== 'open') httpError(404, 'Slot not found');
  if (dayjs(slot.starts_at).isBefore(dayjs())) httpError(422, 'This slot has already started');

  const hostel = await Hostel.findByPk(slot.hostel_id);
  await assertPublished(hostel);

  const remaining = (Number(slot.capacity) || 1) - await bookedCount(slot.id);
  if (remaining <= 0) httpError(409, 'This visit slot is full');

  const existing = await ListingVisit.findOne({
    where: { seeker_id: seekerId, slot_id: slot.id },
  });
  if (existing && ACTIVE_BOOKING.includes(existing.status)) {
    httpError(409, 'You already booked this slot');
  }

  let visit;
  if (existing) {
    await existing.update({
      status: 'requested',
      visit_mode: slot.visit_mode,
      video_url: slot.video_url,
      seeker_note: body.seeker_note != null ? String(body.seeker_note).slice(0, 500) : existing.seeker_note,
      decided_at: null,
      decided_by: null,
      owner_note: null,
    });
    visit = existing;
  } else {
    visit = await ListingVisit.create({
      hostel_id: hostel.id,
      slot_id: slot.id,
      seeker_id: seekerId,
      visit_mode: slot.visit_mode,
      status: 'requested',
      video_url: slot.video_url,
      seeker_note: body.seeker_note != null ? String(body.seeker_note).slice(0, 500) : null,
    });
  }
  return serializeVisit(visit, slot, hostel);
};

const listSeekerVisits = async (seekerId) => {
  const visits = await ListingVisit.findAll({
    where: { seeker_id: seekerId },
    include: [
      { model: ListingVisitSlot, as: 'slot' },
      { model: Hostel, as: 'hostel', attributes: ['id', 'code', 'name'] },
    ],
    order: [['created_at', 'DESC']],
    limit: 50,
  });
  return {
    items: visits.map((v) => serializeVisit(v, v.slot, v.hostel)),
    holds_bed: false,
  };
};

const cancelSeekerVisit = async (seekerId, visitId) => {
  const visit = await ListingVisit.findOne({
    where: { id: visitId, seeker_id: seekerId },
    include: [{ model: ListingVisitSlot, as: 'slot' }],
  });
  if (!visit) httpError(404, 'Visit not found');
  if (!ACTIVE_BOOKING.includes(visit.status)) httpError(422, 'Visit cannot be cancelled');
  await visit.update({ status: 'cancelled', decided_at: new Date() });
  return serializeVisit(visit, visit.slot);
};

module.exports = {
  createSlot,
  listOwnerSlots,
  cancelSlot,
  listOwnerVisits,
  updateVisitStatus,
  listPublicSlots,
  bookVisit,
  listSeekerVisits,
  cancelSeekerVisit,
};
