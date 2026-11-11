const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Hostel, User, Room, SupervisorHostel } = require('../models');
const { success, created, paginated, error } = require('../utils/response');
const { getPagination, getSort, buildSearchWhere } = require('../utils/pagination');
const { createAuditLog } = require('../helpers/audit');
const { ensureHostelDatabase } = require('../services/ensureHostelDatabase');
const { getModelsForHostel } = require('../helpers/hostelContext');
const { syncHostelJsonImagesSafe } = require('../services/legacyMedia');
const { withEntitlements } = require('../services/ownerPlan');

const LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const GENDER_POLICIES = new Set(['male', 'female', 'unisex']);

const PLAN_PAYLOAD_KEYS = [
  'plan', 'plan_period', 'plan_status', 'plan_starts_at', 'plan_expires_at', 'plan_grace_ends_at',
];

const parseBoolFlag = (value) => {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return undefined;
};

const KYC_PAYLOAD_KEYS = [
  'owner_kyc_status',
  'owner_pan_cipher',
  'owner_gstin_cipher',
  'owner_upi_cipher',
  'owner_kyc_reject_reason',
  'owner_kyc_verified_at',
  'owner_kyc_verified_by',
  'owner_kyc_submitted_at',
  'verified_at',
  'verified_by',
  'description_origin',
  'description_draft',
  'description_draft_source',
  'description_draft_at',
];

const sanitizeListingFields = (payload, role) => {
  require('../services/listingPublish').stripListingFieldsFromHostelPayload(payload);
  KYC_PAYLOAD_KEYS.forEach((key) => { delete payload[key]; });
  PLAN_PAYLOAD_KEYS.forEach((key) => { delete payload[key]; });
  require('../services/bookingModel').sanitizeHostelPayload(payload);
  if (payload.gender_policy != null && payload.gender_policy !== '') {
    const gender = String(payload.gender_policy).toLowerCase();
    if (GENDER_POLICIES.has(gender)) payload.gender_policy = gender;
    else delete payload.gender_policy;
  }
  if (typeof payload.area === 'string') {
    payload.area = payload.area.trim().slice(0, 120) || null;
  }
  // DEC-05: only owner / Super Admin may change who uploads listing photos.
  if (role === 'owner' || role === 'super_admin') {
    if (payload.supervisor_media_upload !== undefined) {
      const flag = parseBoolFlag(payload.supervisor_media_upload);
      if (flag === undefined) delete payload.supervisor_media_upload;
      else payload.supervisor_media_upload = flag;
    }
  } else {
    delete payload.supervisor_media_upload;
  }
};

const touchListing = (hostelId) => {
  require('../services/listingProjection').scheduleListingRefresh(hostelId);
};

const filesFor = (files, field) => {
  if (!files) return [];
  if (Array.isArray(files)) return field === 'images' ? files : [];
  return files[field] || [];
};

const removeStoredUpload = (relativePath) => {
  if (!relativePath || typeof relativePath !== 'string' || !relativePath.startsWith('/uploads/')) return;
  const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
  const absolute = path.resolve(__dirname, '..', relativePath.replace(/^\//, ''));
  if (!absolute.startsWith(uploadsRoot)) return;
  fs.unlink(absolute, () => {});
};

const applyLogo = (req, payload, previousLogo) => {
  const logoFile = filesFor(req.files, 'logo')[0];
  delete payload.logo;
  const removeLogo = payload.remove_logo === true || payload.remove_logo === 'true';
  delete payload.remove_logo;

  if (logoFile) {
    if (!LOGO_TYPES.has(logoFile.mimetype) || logoFile.size > LOGO_MAX_BYTES) {
      removeStoredUpload(`/uploads/hostels/${logoFile.filename}`);
      return 'Logo must be a PNG, JPG, WEBP, or GIF under 2 MB';
    }
    if (previousLogo && previousLogo !== `/uploads/hostels/${logoFile.filename}`) {
      removeStoredUpload(previousLogo);
    }
    payload.logo = `/uploads/hostels/${logoFile.filename}`;
    return null;
  }

  if (removeLogo && previousLogo) {
    removeStoredUpload(previousLogo);
    payload.logo = null;
  }
  return null;
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = {};

    if (req.user.role === 'super_admin') {
      // Platform-wide access
    } else if (req.user.role === 'owner') {
      where.owner_id = req.user.id;
    } else if (req.user.role === 'supervisor') {
      const assignments = await SupervisorHostel.findAll({ where: { supervisor_id: req.user.id } });
      where.id = { [Op.in]: assignments.map((a) => a.hostel_id) };
    }

    if (req.query.status) where.status = req.query.status;
    if (req.query.search) Object.assign(where, buildSearchWhere(req.query.search, ['name', 'city', 'address']));

    const { count, rows } = await Hostel.findAndCountAll({
      where,
      include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email'] }],
      order: getSort(req.query, ['name', 'created_at', 'city']),
      limit,
      offset,
    });

    return paginated(res, rows.map(withEntitlements), { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};

async function assertHostelAccess(req, hostel) {
  if (req.user.role === 'owner' && hostel.owner_id !== req.user.id) return false;
  if (req.user.role === 'supervisor') {
    const assigned = await SupervisorHostel.findOne({
      where: { supervisor_id: req.user.id, hostel_id: hostel.id },
    });
    if (!assigned) return false;
  }
  return true;
}

const accessDeniedMessage = (req) => (
  req.user?.role === 'supervisor' ? 'This hostel is not assigned to you' : 'Forbidden'
);

exports.getById = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }],
    });
    if (!hostel) return error(res, 'Hostel not found', 404);
    if (!(await assertHostelAccess(req, hostel))) return error(res, accessDeniedMessage(req), 403);

    let rooms = [];
    try {
      const ctx = await getModelsForHostel(hostel);
      if (ctx.models.Room) {
        rooms = await ctx.models.Room.findAll({
          where: ctx.isolated ? {} : { hostel_id: hostel.id },
          limit: 10,
        });
      }
    } catch {
      rooms = [];
    }

    const payload = withEntitlements(hostel);
    payload.rooms = rooms;
    return success(res, payload);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, owner_id: req.user.id };
    sanitizeListingFields(data, req.user.role);
    if (req.user.role === 'super_admin' && req.body.owner_id) {
      data.owner_id = req.body.owner_id;
    }
    const imageFiles = filesFor(req.files, 'images');
    if (imageFiles.length) {
      data.images = imageFiles.map((f) => `/uploads/hostels/${f.filename}`);
    }
    const logoError = applyLogo(req, data, null);
    if (logoError) return error(res, logoError, 400);

    // Owner branch → pending (DB created only after Super Admin approval)
    // Super Admin hostel → active + dedicated database immediately
    if (req.user.role === 'super_admin') {
      data.status = req.body.status || 'active';
    } else {
      data.status = 'pending_approval';
    }

    const hostel = await Hostel.create(data);
    await syncHostelJsonImagesSafe(hostel, { uploadedBy: req.user.id });

    let message = 'Branch submitted for Super Admin approval';
    if (hostel.status === 'active' || req.user.role === 'super_admin') {
      try {
        const databaseName = await ensureHostelDatabase(hostel);
        await hostel.reload();
        message = `Hostel created with isolated database "${databaseName}"`;
      } catch (provisionErr) {
        message = `Hostel created but database provisioning failed: ${provisionErr.message}`;
      }
    }

    await createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'hostel',
      entityId: hostel.id,
      newValues: { ...data, database_name: hostel.database_name },
      req,
    });
    touchListing(hostel.id);
    return created(res, withEntitlements(hostel), message);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id);
    if (!hostel) return error(res, 'Hostel not found', 404);
    if (!(await assertHostelAccess(req, hostel))) return error(res, accessDeniedMessage(req), 403);

    const payload = { ...req.body };
    sanitizeListingFields(payload, req.user.role);
    // Owners may only flip an approved hostel between active and inactive.
    // Approval, rejection, and hold stay with Super Admin.
    if (req.user.role !== 'super_admin') {
      const nextStatus = payload.status;
      delete payload.status;
      if (nextStatus && nextStatus !== hostel.status) {
        const locked = ['pending_approval', 'rejected', 'on_hold'].includes(hostel.status);
        const allowed = ['active', 'inactive'].includes(nextStatus);
        if (locked || !allowed) {
          return error(res, 'Only Super Admin can change this hostel status', 403);
        }
        payload.status = nextStatus;
      }
      if (['pending_approval', 'rejected'].includes(hostel.status) && req.user.role === 'supervisor') {
        return error(res, 'Hostel is awaiting Super Admin approval', 403);
      }
    }

    if (payload.description != null && String(payload.description) !== String(hostel.description || '')) {
      payload.description_origin = 'owner';
    }

    const oldValues = hostel.toJSON();
    const imageFiles = filesFor(req.files, 'images');
    if (imageFiles.length) {
      payload.images = [...(hostel.images || []), ...imageFiles.map((f) => `/uploads/hostels/${f.filename}`)];
    }
    const logoError = applyLogo(req, payload, hostel.logo);
    if (logoError) return error(res, logoError, 400);
    await hostel.update(payload);
    await syncHostelJsonImagesSafe(hostel, { uploadedBy: req.user.id });
    await createAuditLog({ userId: req.user.id, action: 'UPDATE', entityType: 'hostel', entityId: hostel.id, oldValues, newValues: payload, req });
    await require('../services/listingPublish').unpublishWhenHostelNotOperating(hostel, {
      user: req.user,
      req,
      trigger: 'hostel_status',
    });
    touchListing(hostel.id);
    return success(res, withEntitlements(hostel), 'Hostel updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.blueprint = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }],
    });
    if (!hostel) return error(res, 'Hostel not found', 404);
    if (!(await assertHostelAccess(req, hostel))) return error(res, accessDeniedMessage(req), 403);

    const ctx = await getModelsForHostel(hostel);
    let rooms = [];
    let blocks = [];

    if (hostel.status !== 'pending_approval') {
      const where = ctx.isolated ? {} : { hostel_id: hostel.id };
      const bedInclude = {
        model: ctx.models.Bed,
        as: 'beds',
        required: false,
      };
      if (ctx.models.Tenant) {
        bedInclude.include = [{
          model: ctx.models.Tenant,
          as: 'currentTenant',
          attributes: ['id', 'full_name', 'status', 'date_of_birth', 'bed_id'],
          required: false,
        }];
      }
      const loadRooms = (includeBeds) => ctx.models.Room.findAll({
        where: where,
        include: [
          includeBeds,
          { model: ctx.models.HostelBlock, as: 'block', attributes: ['id', 'name', 'total_floors'], required: false },
        ],
        order: [['floor', 'ASC'], ['room_number', 'ASC']],
      });
      try {
        rooms = await loadRooms(bedInclude);
      } catch {
        const plainBeds = { model: ctx.models.Bed, as: 'beds', required: false };
        rooms = await loadRooms(plainBeds);
      }
      blocks = await ctx.models.HostelBlock.findAll({
        where,
        order: [['name', 'ASC']],
      });
    }

    const roomJson = rooms.map((room) => room.toJSON());

    if (ctx.models.Tenant) {
      try {
        const tenants = await ctx.models.Tenant.findAll({
          where: {
            bed_id: { [Op.ne]: null },
            status: { [Op.notIn]: ['moved_out'] },
          },
          attributes: ['id', 'full_name', 'status', 'date_of_birth', 'bed_id'],
          order: [['id', 'DESC']],
        });
        const tenantByBed = new Map();
        tenants.forEach((tenant) => {
          if (!tenantByBed.has(tenant.bed_id)) tenantByBed.set(tenant.bed_id, tenant.toJSON());
        });
        roomJson.forEach((room) => {
          (room.beds || []).forEach((bed) => {
            const tenant = tenantByBed.get(bed.id);
            if (tenant) bed.currentTenant = tenant;
          });
        });
      } catch {
        // Floor plan still loads if tenant lookup is unavailable.
      }
    }
    await require('../services/occupancyService').attachHoldsToRooms(hostel.id, roomJson);

    const beds = roomJson.flatMap((room) => room.beds || []);
    const countBy = (items, status) => items.filter((item) => item.status === status).length;
    const floorNumbers = roomJson.map((room) => Number(room.floor) || 1);

    return success(res, {
      hostel: withEntitlements(hostel),
      blocks: blocks.map((block) => block.toJSON()),
      rooms: roomJson,
      summary: {
        floors: Math.max(Number(hostel.total_floors) || 1, ...floorNumbers, 1),
        rooms: roomJson.length,
        beds: beds.length,
        occupiedRooms: countBy(roomJson, 'occupied'),
        vacantRooms: countBy(roomJson, 'vacant'),
        reservedRooms: countBy(roomJson, 'reserved'),
        maintenanceRooms: countBy(roomJson, 'maintenance'),
        occupiedBeds: countBy(beds, 'occupied'),
        vacantBeds: countBy(beds, 'vacant'),
        reservedBeds: countBy(beds, 'reserved'),
        maintenanceBeds: countBy(beds, 'maintenance'),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.bedOccupant = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id);
    if (!hostel) return error(res, 'Hostel not found', 404);
    if (!(await assertHostelAccess(req, hostel))) return error(res, accessDeniedMessage(req), 403);

    const ctx = await getModelsForHostel(hostel);
    const bed = await ctx.models.Bed.findByPk(req.params.bedId, {
      include: [{
        model: ctx.models.Room,
        as: 'room',
        required: false,
        include: [{ model: ctx.models.HostelBlock, as: 'block', attributes: ['id', 'name'], required: false }],
      }],
    });
    if (!bed) return error(res, 'Bed not found', 404);
    if (!ctx.isolated && bed.room && Number(bed.room.hostel_id) !== Number(hostel.id)) {
      return error(res, 'Bed not found', 404);
    }

    const tenant = ctx.models.Tenant
      ? await ctx.models.Tenant.findOne({
        where: { bed_id: bed.id, status: { [Op.notIn]: ['moved_out'] } },
        order: [['id', 'DESC']],
      })
      : null;

    let user = null;
    if (tenant?.user_id) {
      user = await User.findByPk(tenant.user_id, {
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'avatar'],
      });
    }

    const tenantJson = tenant ? tenant.toJSON() : null;
    if (tenantJson) {
      const maskId = (value) => {
        if (!value) return null;
        const text = String(value);
        return text.length <= 4 ? text : `•••• ${text.slice(-4)}`;
      };
      tenantJson.aadhar_masked = maskId(tenantJson.aadhar);
      tenantJson.pan_masked = maskId(tenantJson.pan);
      delete tenantJson.aadhar;
      delete tenantJson.pan;
      delete tenantJson.passport;
      delete tenantJson.driving_license;
      delete tenantJson.voter_id;
    }

    return success(res, {
      bed: bed.toJSON(),
      tenant: tenantJson,
      user,
    });
  } catch (err) {
    next(err);
  }
};

const isUniqueViolation = (err) => {
  if (!err) return false;
  if (err.name === 'SequelizeUniqueConstraintError') return true;
  const code = err.original?.code || err.parent?.code;
  const errno = Number(err.original?.errno || err.parent?.errno);
  return code === 'ER_DUP_ENTRY' || errno === 1062 || /Duplicate entry/i.test(err.message || '');
};

const recordAssignment = async (ctx, transaction, values) => {
  if (!ctx.models.BedAssignment) return;
  const savepoint = await ctx.sequelize.transaction({ transaction });
  try {
    await ctx.models.BedAssignment.create(values, { transaction: savepoint });
    await savepoint.commit();
  } catch (err) {
    try { await savepoint.rollback(); } catch { /* already rolled back */ }
    if (isUniqueViolation(err)) {
      const conflict = new Error('This bed is already occupied');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw err;
  }
};

const markAssignmentMoved = async (ctx, transaction, bedId, tenantId) => {
  if (!ctx.models.BedAssignment) return;
  const savepoint = await ctx.sequelize.transaction({ transaction });
  try {
    await ctx.models.BedAssignment.update(
      { status: 'transferred', vacated_at: new Date() },
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
    where: { room_id: roomId, status: 'occupied' },
    transaction,
  });
  await models.Room.update(
    { status: occupied > 0 ? 'occupied' : 'vacant' },
    { where: { id: roomId }, transaction }
  );
};

const loadTargetBed = async (ctx, hostel, bedId, transaction, { allowReserved = false } = {}) => {
  const bed = await ctx.models.Bed.findByPk(bedId, {
    include: [{ model: ctx.models.Room, as: 'room', required: false }],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!bed) return { error: 'Bed not found', status: 404 };
  if (!ctx.isolated && bed.room && Number(bed.room.hostel_id) !== Number(hostel.id)) {
    return { error: 'Bed not found', status: 404 };
  }
  const occupiable = bed.status === 'vacant' || (allowReserved && bed.status === 'reserved');
  if (!occupiable) {
    if (bed.status === 'occupied') return { error: 'This bed is already occupied', status: 409 };
    if (bed.status === 'reserved') return { error: 'This bed is held for an online guest', status: 409 };
    return { error: 'This bed is not available', status: 409 };
  }
  if (bed.room?.is_active === false) {
    return { error: `Room ${bed.room.room_number} is inactive`, status: 400 };
  }
  return { bed };
};

exports.bookBed = async (req, res, next) => {
  const hostel = await Hostel.findByPk(req.params.id);
  if (!hostel) return error(res, 'Hostel not found', 404);
  if (!(await assertHostelAccess(req, hostel))) return error(res, accessDeniedMessage(req), 403);

  const overrideHold = req.body.override_hold === true
    || req.body.override_hold === 'true'
    || req.body.override_hold === 1
    || req.body.override_hold === '1';
  const reason = String(req.body.reason || req.body.override_reason || '').trim();

  const ctx = await getModelsForHostel(hostel);
  const t = await ctx.sequelize.transaction();
  try {
    const loaded = await loadTargetBed(ctx, hostel, req.params.bedId, t, { allowReserved: overrideHold });
    if (loaded.error) {
      await t.rollback();
      return error(res, loaded.error, loaded.status);
    }
    const wasReserved = loaded.bed.status === 'reserved';
    if (wasReserved && reason.length < 3) {
      await t.rollback();
      return error(res, 'A written reason is required to take a held bed', 422);
    }
    const tenant = await ctx.models.Tenant.findByPk(req.body.tenant_id, { transaction: t });
    if (!tenant || tenant.status === 'moved_out') {
      await t.rollback();
      return error(res, 'Tenant not found', 404);
    }
    if (tenant.bed_id && Number(tenant.bed_id) !== Number(loaded.bed.id)) {
      await t.rollback();
      return error(res, 'This tenant already has a bed. Use transfer to move them.', 400);
    }

    const occupancyService = require('../services/occupancyService');
    await occupancyService.occupyBed({
      ctx,
      bed: loaded.bed,
      tenant,
      userId: req.user.id,
      transaction: t,
      allowReserved: wasReserved,
      notes: wasReserved ? `Walk-in override: ${reason}` : null,
    });
    if (wasReserved) {
      const { displaceOpenBookingsForBed } = require('../services/bookingService');
      await displaceOpenBookingsForBed({
        hostelId: hostel.id,
        bedId: loaded.bed.id,
        reason: `Walk-in override: ${reason}`,
        actor: req.user,
        req,
      });
    }
    await t.commit();

    if (wasReserved) {
      await createAuditLog({
        userId: req.user.id,
        action: 'WALKIN_OVERRIDE',
        entityType: 'bed',
        entityId: loaded.bed.id,
        oldValues: { status: 'reserved' },
        newValues: { status: 'occupied', tenant_id: tenant.id, reason },
        req,
      });
    }

    require('../services/occupancySnapshot').scheduleOccupancyRefresh(hostel.id);
    await occupancyService.projectHostelAvailability(hostel);
    return success(res, { bed_id: loaded.bed.id, tenant_id: tenant.id }, wasReserved ? 'Walk-in override booked' : 'Bed booked');
  } catch (err) {
    await t.rollback();
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.transferBed = async (req, res, next) => {
  const hostel = await Hostel.findByPk(req.params.id);
  if (!hostel) return error(res, 'Hostel not found', 404);
  if (!(await assertHostelAccess(req, hostel))) return error(res, accessDeniedMessage(req), 403);

  const ctx = await getModelsForHostel(hostel);
  const t = await ctx.sequelize.transaction();
  try {
    const loaded = await loadTargetBed(ctx, hostel, req.params.bedId, t);
    if (loaded.error) {
      await t.rollback();
      return error(res, loaded.error, loaded.status);
    }
    const tenant = await ctx.models.Tenant.findByPk(req.body.tenant_id, { transaction: t });
    if (!tenant || !tenant.bed_id) {
      await t.rollback();
      return error(res, 'Choose a tenant who already has a bed', 400);
    }
    if (Number(tenant.bed_id) === Number(loaded.bed.id)) {
      await t.rollback();
      return error(res, 'Tenant is already on this bed', 400);
    }

    const previousBedId = tenant.bed_id;
    const previousRoomId = tenant.room_id;
    await ctx.models.Bed.update({ status: 'vacant' }, { where: { id: previousBedId }, transaction: t });
    await markAssignmentMoved(ctx, t, previousBedId, tenant.id);
    await loaded.bed.update({ status: 'occupied' }, { transaction: t });
    await tenant.update({
      bed_id: loaded.bed.id,
      room_id: loaded.bed.room_id,
      status: 'active',
    }, { transaction: t });
    await recordAssignment(ctx, t, {
      bed_id: loaded.bed.id,
      tenant_id: tenant.id,
      assigned_by: req.user.id,
      status: 'active',
      notes: 'Transferred from another bed',
    });
    await syncRoomOccupancy(ctx.models, previousRoomId, t);
    await syncRoomOccupancy(ctx.models, loaded.bed.room_id, t);
    await t.commit();
    require('../services/occupancySnapshot').scheduleOccupancyRefresh(hostel.id);
    await require('../services/occupancyService').projectHostelAvailability(hostel);
    return success(res, { bed_id: loaded.bed.id, tenant_id: tenant.id }, 'Bed transferred');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.shiftBed = async (req, res, next) => {
  const hostel = await Hostel.findByPk(req.params.id);
  if (!hostel) return error(res, 'Hostel not found', 404);
  if (!(await assertHostelAccess(req, hostel))) return error(res, accessDeniedMessage(req), 403);

  const ctx = await getModelsForHostel(hostel);
  const t = await ctx.sequelize.transaction();
  try {
    const bed = await ctx.models.Bed.findByPk(req.params.bedId, {
      include: [{ model: ctx.models.Room, as: 'room', required: false }],
      transaction: t,
    });
    if (!bed) {
      await t.rollback();
      return error(res, 'Bed not found', 404);
    }
    if (bed.status !== 'vacant') {
      await t.rollback();
      return error(res, 'Only an empty bed can be shifted to another room', 400);
    }
    const sitting = await ctx.models.Tenant.findOne({
      where: { bed_id: bed.id, status: { [Op.notIn]: ['moved_out'] } },
      transaction: t,
    });
    if (sitting) {
      await t.rollback();
      return error(res, 'This bed is booked. Transfer the tenant instead.', 400);
    }

    const destination = await ctx.models.Room.findByPk(req.body.room_id, { transaction: t });
    if (!destination) {
      await t.rollback();
      return error(res, 'Target room not found', 404);
    }
    if (!ctx.isolated && Number(destination.hostel_id) !== Number(hostel.id)) {
      await t.rollback();
      return error(res, 'Target room not found', 404);
    }
    if (Number(destination.id) === Number(bed.room_id)) {
      await t.rollback();
      return error(res, 'Choose a different room', 400);
    }
    if (destination.is_active === false) {
      await t.rollback();
      return error(res, `Room ${destination.room_number} is inactive`, 400);
    }

    const capacityOf = (room) => {
      if (room.room_type === 'single') return 1;
      if (room.room_type === 'double') return 2;
      if (room.room_type === 'triple') return 3;
      const sharing = Number(room.sharing_type);
      return Number.isFinite(sharing) && sharing > 0 ? sharing : 1;
    };

    const previousRoomId = bed.room_id;
    const existing = await ctx.models.Bed.findAll({ where: { room_id: destination.id }, transaction: t });
    const capacity = capacityOf(destination);
    if (existing.length >= capacity) {
      await t.rollback();
      const typeLabel = String(destination.room_type || 'room').replace(/_/g, ' ');
      return error(
        res,
        `Room ${destination.room_number} is ${typeLabel} and already has ${existing.length} of ${capacity} beds`,
        400
      );
    }
    const taken = new Set(existing.map((item) => String(item.bed_number)));
    let bedNumber = String(bed.bed_number);
    if (taken.has(bedNumber)) {
      const numeric = existing
        .map((item) => Number(item.bed_number))
        .filter((value) => Number.isFinite(value));
      bedNumber = String((numeric.length ? Math.max(...numeric) : existing.length) + 1);
    }

    await bed.update({ room_id: destination.id, bed_number: bedNumber }, { transaction: t });
    await syncRoomOccupancy(ctx.models, previousRoomId, t);
    await syncRoomOccupancy(ctx.models, destination.id, t);
    await t.commit();
    require('../services/occupancySnapshot').scheduleOccupancyRefresh(hostel.id);
    await require('../services/occupancyService').projectHostelAvailability(hostel);
    return success(res, { bed_id: bed.id, room_id: destination.id, bed_number: bedNumber }, 'Empty bed shifted');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id);
    if (!hostel) return error(res, 'Hostel not found', 404);
    if (req.user.role !== 'super_admin' && hostel.owner_id !== req.user.id) {
      return error(res, 'Forbidden', 403);
    }
    await hostel.destroy();
    await createAuditLog({ userId: req.user.id, action: 'DELETE', entityType: 'hostel', entityId: hostel.id, req });
    return success(res, null, 'Hostel deleted successfully');
  } catch (err) {
    next(err);
  }
};
