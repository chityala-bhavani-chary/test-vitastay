/**
 * BKG-005 / BKG-007 / BKG-010 / DEC-03 — occupy / vacate / reserve for walk-in bookBed and public hold.
 * DEC-03: a reserved bed wins over walk-in until expiry. occupyBed may take reserved only when
 * bookBed sent override_hold + a written reason (audit + notify + refund if paid).
 * Inventory stays on the hostel DB; vacancy is projected to master listing_availability
 * so search never fans out to vitastay_*. Conflicts are 409; unique
 * (bed_id, active_flag) is the last line of defence against double occupy.
 */
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { getModelsForHostel } = require('../helpers/hostelContext');

const VACANT = 'vacant';
const OCCUPIED = 'occupied';
const RESERVED = 'reserved';
const MAINTENANCE = 'maintenance';

const httpError = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  throw err;
};

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isUniqueViolation = (err) => {
  if (!err) return false;
  if (err.name === 'SequelizeUniqueConstraintError') return true;
  const code = err.original?.code || err.parent?.code;
  const errno = Number(err.original?.errno || err.parent?.errno);
  return code === 'ER_DUP_ENTRY' || errno === 1062 || /Duplicate entry/i.test(err.message || '');
};

const rejectIfNotOccupiable = (status, allowReserved) => {
  if (status === VACANT) return;
  if (allowReserved && status === RESERVED) return;
  if (status === OCCUPIED) httpError(409, 'This bed is already occupied');
  if (status === RESERVED) httpError(409, 'This bed is held for an online guest');
  httpError(409, 'This bed is not available');
};

const seekerNameOf = (seeker) => {
  if (!seeker) return null;
  const name = `${seeker.first_name || ''} ${seeker.last_name || ''}`.trim();
  return name || null;
};

const attachHoldsToRooms = async (hostelId, roomJson = []) => {
  const reserved = [];
  roomJson.forEach((room) => {
    (room.beds || []).forEach((bed) => {
      if (bed.status === RESERVED) reserved.push(bed);
    });
  });
  if (!reserved.length) return roomJson;

  let rows = [];
  try {
    const { Booking, User } = require('../models');
    rows = await Booking.findAll({
      where: {
        hostel_id: hostelId,
        bed_id: { [Op.in]: reserved.map((bed) => bed.id) },
        status: { [Op.in]: ['requested', 'held', 'awaiting_approval'] },
      },
      include: [{ model: User, as: 'seeker', attributes: ['first_name', 'last_name'], required: false }],
    });
  } catch (err) {
    logger.warn(`Blueprint hold attach skipped for hostel ${hostelId}: ${err.message}`);
  }

  const byBed = new Map(rows.map((row) => [Number(row.bed_id), row]));
  reserved.forEach((bed) => {
    const booking = byBed.get(Number(bed.id));
    const until = bed.hold_expires_at || booking?.hold_expires_at || null;
    bed.hold_expires_at = until;
    bed.hold = {
      booking_id: booking?.id || null,
      booking_code: booking?.code || null,
      hold_expires_at: until,
      payment_status: booking?.payment_status || null,
      seeker_name: seekerNameOf(booking?.seeker),
    };
  });
  return roomJson;
};

const recordAssignment = async (ctx, transaction, values) => {
  if (!ctx.models.BedAssignment) return;
  const savepoint = await ctx.sequelize.transaction({ transaction });
  try {
    await ctx.models.BedAssignment.create(values, { transaction: savepoint });
    await savepoint.commit();
  } catch (err) {
    try { await savepoint.rollback(); } catch { /* already rolled back */ }
    if (isUniqueViolation(err)) httpError(409, 'This bed is already occupied');
    throw err;
  }
};

const markAssignmentMoved = async (ctx, transaction, bedId, tenantId, status = 'transferred') => {
  if (!ctx.models.BedAssignment) return;
  const savepoint = await ctx.sequelize.transaction({ transaction });
  try {
    await ctx.models.BedAssignment.update(
      { status, vacated_at: new Date() },
      { where: { bed_id: bedId, tenant_id: tenantId, status: 'active' }, transaction: savepoint }
    );
    await savepoint.commit();
  } catch {
    await savepoint.rollback();
  }
};

const syncRoomOccupancy = async (models, roomId, transaction) => {
  if (!roomId) return;
  const occupied = await models.Bed.count({
    where: { room_id: roomId, status: OCCUPIED },
    transaction,
  });
  await models.Room.update(
    { status: occupied > 0 ? OCCUPIED : VACANT },
    { where: { id: roomId }, transaction }
  );
};

const lockBed = async (ctx, bedId, transaction) => {
  const bed = await ctx.models.Bed.findByPk(bedId, {
    include: [{ model: ctx.models.Room, as: 'room', required: false }],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!bed) httpError(404, 'Bed not found');
  return bed;
};

const occupyBed = async ({
  ctx, bed, tenant, userId, transaction, notes, allowReserved = false, tenantStatus = 'active',
}) => {
  const locked = await lockBed(ctx, bed.id, transaction);
  rejectIfNotOccupiable(locked.status, allowReserved);
  if (locked.room?.is_active === false) {
    httpError(400, `Room ${locked.room.room_number} is inactive`);
  }
  const nextStatus = tenantStatus === 'pending' ? 'pending' : 'active';
  await locked.update({ status: OCCUPIED, hold_expires_at: null }, { transaction });
  await tenant.update({
    bed_id: locked.id,
    room_id: locked.room_id,
    status: nextStatus,
  }, { transaction });
  await recordAssignment(ctx, transaction, {
    bed_id: locked.id,
    tenant_id: tenant.id,
    assigned_by: userId,
    status: 'active',
    notes: notes || null,
  });
  await syncRoomOccupancy(ctx.models, locked.room_id, transaction);
  return locked;
};

const vacateBed = async ({ ctx, bed, transaction }) => {
  const locked = await lockBed(ctx, bed.id, transaction);
  const tenant = await ctx.models.Tenant.findOne({
    where: { bed_id: locked.id, status: { [Op.notIn]: ['moved_out'] } },
    transaction,
  });
  await locked.update({ status: VACANT }, { transaction });
  if (tenant) {
    await markAssignmentMoved(ctx, transaction, locked.id, tenant.id, 'vacated');
    await tenant.update({ bed_id: null, room_id: null }, { transaction });
  } else if (ctx.models.BedAssignment) {
    await ctx.models.BedAssignment.update(
      { status: 'vacated', vacated_at: new Date() },
      { where: { bed_id: locked.id, status: 'active' }, transaction }
    );
  }
  await syncRoomOccupancy(ctx.models, locked.room_id, transaction);
  return locked;
};

const reserveBed = async ({ ctx, bed, transaction, holdExpiresAt = null }) => {
  const locked = await lockBed(ctx, bed.id, transaction);
  rejectIfNotOccupiable(locked.status, false);
  await locked.update({ status: RESERVED, hold_expires_at: holdExpiresAt }, { transaction });
  return locked;
};

const releaseReservedBed = async ({ ctx, bedId, transaction }) => {
  const locked = await lockBed(ctx, bedId, transaction);
  if (locked.status !== RESERVED) return locked;
  await locked.update({ status: VACANT, hold_expires_at: null }, { transaction });
  return locked;
};

const pickAndReserveBed = async ({
  ctx,
  hostel,
  roomType,
  roomId,
  bedId,
  holdExpiresAt,
}) => {
  const maxAttempts = bedId ? 1 : 8;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const t = await ctx.sequelize.transaction();
    try {
      let target;
      if (bedId) {
        target = await lockBed(ctx, bedId, t);
        if (!ctx.isolated && target.room && Number(target.room.hostel_id) !== Number(hostel.id)) {
          await t.rollback();
          httpError(404, 'Bed not found');
        }
      } else {
        const roomWhere = {
          ...(ctx.isolated ? {} : { hostel_id: hostel.id }),
          ...(roomType ? { room_type: roomType } : {}),
          ...(roomId ? { id: roomId } : {}),
        };
        target = await ctx.models.Bed.findOne({
          where: { status: VACANT },
          include: [{
            model: ctx.models.Room,
            as: 'room',
            required: true,
            where: roomWhere,
          }],
          order: [['id', 'ASC']],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!target) {
          await t.rollback();
          return null;
        }
      }
      if (target.status !== VACANT) {
        await t.rollback();
        if (bedId) httpError(409, 'That bed is not available');
        continue;
      }
      if (target.room?.is_active === false) {
        await t.rollback();
        httpError(422, `Room ${target.room.room_number} is inactive`);
      }
      if (roomType && target.room?.room_type && target.room.room_type !== roomType) {
        await t.rollback();
        httpError(422, 'bed_id does not match room_type');
      }
      await target.update({ status: RESERVED, hold_expires_at: holdExpiresAt || null }, { transaction: t });
      await t.commit();
      return target;
    } catch (err) {
      try { await t.rollback(); } catch { /* already rolled back */ }
      if (err.statusCode) throw err;
      throw err;
    }
  }
  return null;
};

const inventoryFromRooms = (rooms) => {
  const occupancy = new Map();
  let bedsAvailable = 0;
  let bedsReserved = 0;
  let bedsTotal = 0;
  const rents = [];

  rooms.forEach((room) => {
    const beds = room.beds || [];
    const vacant = beds.filter((bed) => bed.status === VACANT).length;
    const reserved = beds.filter((bed) => bed.status === RESERVED).length;
    const total = beds.length;
    bedsAvailable += vacant;
    bedsReserved += reserved;
    bedsTotal += total;
    const rent = num(room.rent);
    if (rent != null) rents.push(rent);
    const key = room.room_type || 'room';
    const row = occupancy.get(key) || {
      room_type: key,
      monthly_rent_from: rent,
      beds_available: 0,
      beds_reserved: 0,
      beds_total: 0,
      is_ac: Boolean(room.is_ac),
    };
    if (rent != null) {
      row.monthly_rent_from = row.monthly_rent_from == null ? rent : Math.min(row.monthly_rent_from, rent);
    }
    row.beds_available += vacant;
    row.beds_reserved += reserved;
    row.beds_total += total;
    row.is_ac = row.is_ac || Boolean(room.is_ac);
    occupancy.set(key, row);
  });

  return {
    occupancy: [...occupancy.values()],
    beds_available: bedsAvailable,
    beds_reserved: bedsReserved,
    beds_total: bedsTotal,
    monthly_rent_from: rents.length ? Math.min(...rents) : null,
    daily_rent: null,
  };
};

const loadInventoryRooms = async (hostel) => {
  const ctx = await getModelsForHostel(hostel);
  try {
    return await ctx.models.Room.findAll({
      where: ctx.isolated ? {} : { hostel_id: hostel.id },
      attributes: ['id', 'room_type', 'rent', 'is_ac', 'status'],
      include: [{ model: ctx.models.Bed, as: 'beds', attributes: ['id', 'status'], required: false }],
    });
  } catch (err) {
    logger.warn(`Listing availability rooms fallback for hostel ${hostel.id}: ${err.message}`);
    const { Room, Bed } = require('../models');
    return Room.findAll({
      where: { hostel_id: hostel.id },
      attributes: ['id', 'room_type', 'rent', 'is_ac', 'status'],
      include: [{ model: Bed, as: 'beds', attributes: ['id', 'status'], required: false }],
    });
  }
};

const persistListingAvailability = async (hostelId, inventory) => {
  const { ListingAvailability } = require('../models');
  const now = new Date();
  const types = new Set();
  for (const row of inventory.occupancy) {
    types.add(row.room_type);
    await ListingAvailability.upsert({
      hostel_id: hostelId,
      room_type: row.room_type,
      beds_available: row.beds_available,
      beds_reserved: row.beds_reserved,
      beds_total: row.beds_total,
      monthly_rent_from: row.monthly_rent_from,
      is_ac: Boolean(row.is_ac),
      refreshed_at: now,
    });
  }
  if (types.size) {
    await ListingAvailability.destroy({
      where: { hostel_id: hostelId, room_type: { [Op.notIn]: [...types] } },
    });
  } else {
    await ListingAvailability.destroy({ where: { hostel_id: hostelId } });
  }
};

/**
 * BIC-027 — seeker catalogue row: starting rent + vacant beds (not a bed UUID).
 * Keeps legacy occupancy fields for existing booking UI.
 */
const toRoomTypeRow = (row) => {
  const vacantBeds = Number(row.beds_available) || 0;
  const startingRent = row.monthly_rent_from != null ? Number(row.monthly_rent_from) : null;
  return {
    room_type: row.room_type,
    startingRent: Number.isFinite(startingRent) ? startingRent : null,
    vacantBeds,
    full: vacantBeds <= 0,
    monthly_rent_from: Number.isFinite(startingRent) ? startingRent : null,
    beds_available: vacantBeds,
    beds_reserved: Number(row.beds_reserved) || 0,
    beds_total: Number(row.beds_total) || 0,
    is_ac: Boolean(row.is_ac),
  };
};

const toRoomTypes = (occupancy = []) => occupancy.map(toRoomTypeRow);

const availabilityPayload = (inventory) => {
  const occupancy = toRoomTypes(inventory.occupancy || []);
  return {
    beds_available: inventory.beds_available,
    beds_total: inventory.beds_total,
    beds_reserved: inventory.beds_reserved,
    monthly_rent_from: inventory.monthly_rent_from,
    daily_rent: inventory.daily_rent,
    occupancy,
    roomTypes: occupancy,
  };
};

const readListingAvailability = async (hostelId) => {
  const { ListingAvailability } = require('../models');
  const rows = await ListingAvailability.findAll({
    where: { hostel_id: hostelId },
    order: [['room_type', 'ASC']],
  });
  if (!rows.length) return null;
  const occupancy = toRoomTypes(rows.map((row) => ({
    room_type: row.room_type,
    monthly_rent_from: num(row.monthly_rent_from),
    beds_available: Number(row.beds_available) || 0,
    beds_reserved: Number(row.beds_reserved) || 0,
    beds_total: Number(row.beds_total) || 0,
    is_ac: Boolean(row.is_ac),
  })));
  const bedsAvailable = occupancy.reduce((sum, row) => sum + row.beds_available, 0);
  const bedsReserved = occupancy.reduce((sum, row) => sum + row.beds_reserved, 0);
  const bedsTotal = occupancy.reduce((sum, row) => sum + row.beds_total, 0);
  const rents = occupancy.map((row) => row.monthly_rent_from).filter((value) => value != null);
  return {
    beds_available: bedsAvailable,
    beds_reserved: bedsReserved,
    beds_total: bedsTotal,
    monthly_rent_from: rents.length ? Math.min(...rents) : null,
    daily_rent: null,
    occupancy,
    roomTypes: occupancy,
  };
};

const patchListingProjectionVacancy = async (hostelId, inventory) => {
  const { ListingProjection } = require('../models');
  const row = await ListingProjection.findOne({ where: { hostel_id: hostelId } });
  if (!row) return;
  await row.update({
    beds_available: inventory.beds_available,
    min_rent: inventory.monthly_rent_from,
    occupancy_types: inventory.occupancy.map((item) => item.room_type),
    refreshed_at: new Date(),
  });
};

const projectHostelAvailability = async (hostelOrId) => {
  const { Hostel } = require('../models');
  const hostel = typeof hostelOrId === 'object' && hostelOrId?.id
    ? hostelOrId
    : await Hostel.findByPk(hostelOrId);
  if (!hostel) return null;
  const rooms = await loadInventoryRooms(hostel);
  const inventory = inventoryFromRooms(rooms);
  await persistListingAvailability(hostel.id, inventory);
  await patchListingProjectionVacancy(hostel.id, inventory);
  return availabilityPayload(inventory);
};

const scheduleAvailabilityRefresh = (hostelId) => {
  if (!hostelId) return;
  setImmediate(() => {
    projectHostelAvailability(hostelId)
      .then((inventory) => {
        // BIC-028 — after vacate/occupy projection, notify waitlist when beds open.
        if (!inventory) return null;
        return require('./waitlistService').notifyOnAvailability(hostelId, inventory);
      })
      .catch((err) => {
        logger.warn(`Listing availability refresh skipped for hostel ${hostelId}: ${err.message}`);
      });
  });
};

const reconcileListingAvailability = async (log = logger.info.bind(logger)) => {
  const { Hostel } = require('../models');
  const hostels = await Hostel.findAll({ attributes: ['id', 'code', 'name'] });
  let ok = 0;
  let failed = 0;
  for (const hostel of hostels) {
    try {
      await projectHostelAvailability(hostel);
      ok += 1;
    } catch (err) {
      failed += 1;
      logger.warn(`Listing availability reconcile failed for hostel ${hostel.id}: ${err.message}`);
    }
  }
  log(`listing_availability reconcile: ${ok} hostels, ${failed} failed`);
  return { ok, failed };
};

const RECONCILE_MS = 24 * 60 * 60 * 1000;

const startListingAvailabilityScheduler = () => {
  const run = () => reconcileListingAvailability().catch((err) => {
    logger.error(`Listing availability reconcile failed: ${err.message}`);
  });
  setTimeout(run, 30 * 1000).unref();
  setInterval(run, RECONCILE_MS).unref();
};

module.exports = {
  VACANT,
  OCCUPIED,
  RESERVED,
  MAINTENANCE,
  occupyBed,
  attachHoldsToRooms,
  vacateBed,
  reserveBed,
  releaseReservedBed,
  pickAndReserveBed,
  syncRoomOccupancy,
  markAssignmentMoved,
  inventoryFromRooms,
  persistListingAvailability,
  readListingAvailability,
  projectHostelAvailability,
  scheduleAvailabilityRefresh,
  reconcileListingAvailability,
  startListingAvailabilityScheduler,
  toRoomTypes,
  toRoomTypeRow,
};
