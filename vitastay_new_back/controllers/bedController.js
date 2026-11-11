const { Bed, BedAssignment, Room, Tenant, User } = require('../models');
const { success, paginated, error } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const dayjs = require('dayjs');

exports.getByRoom = async (req, res, next) => {
  try {
    const beds = await Bed.findAll({
      where: { room_id: req.params.roomId },
      include: [
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
        { model: Tenant, as: 'currentTenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name'] }] },
      ],
    });
    return success(res, beds);
  } catch (err) {
    next(err);
  }
};

exports.assignTenant = async (req, res, next) => {
  const { sequelize } = require('../models');
  const t = await sequelize.transaction();
  try {
    const bed = await Bed.findByPk(req.params.id, { transaction: t });
    if (!bed) {
      await t.rollback();
      return error(res, 'Bed not found', 404);
    }
    if (bed.status === 'occupied') {
      await t.rollback();
      return error(res, 'Bed is already occupied', 400);
    }

    const tenant = await Tenant.findByPk(req.body.tenant_id, { transaction: t });
    if (!tenant) {
      await t.rollback();
      return error(res, 'Tenant not found', 404);
    }

    await bed.update({ status: 'occupied' }, { transaction: t });
    await tenant.update({ bed_id: bed.id, room_id: bed.room_id }, { transaction: t });
    await Room.update({ status: 'occupied' }, { where: { id: bed.room_id }, transaction: t });

    const assignment = await BedAssignment.create({
      bed_id: bed.id,
      tenant_id: tenant.id,
      assigned_by: req.user.id,
      status: 'active',
    }, { transaction: t });

    await t.commit();
    require('../services/occupancySnapshot').scheduleOccupancyRefresh(tenant.hostel_id);
    await require('../services/occupancyService').projectHostelAvailability(tenant.hostel_id);
    return success(res, assignment, 'Tenant assigned to bed');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.vacate = async (req, res, next) => {
  const { sequelize } = require('../models');
  const t = await sequelize.transaction();
  try {
    const bed = await Bed.findByPk(req.params.id, { transaction: t });
    if (!bed) {
      await t.rollback();
      return error(res, 'Bed not found', 404);
    }

    await bed.update({ status: 'vacant' }, { transaction: t });
    await BedAssignment.update(
      { status: 'vacated', vacated_at: new Date() },
      { where: { bed_id: bed.id, status: 'active' }, transaction: t }
    );

    const tenant = await Tenant.findOne({ where: { bed_id: bed.id }, transaction: t });
    if (tenant) {
      await tenant.update({ bed_id: null, status: 'inactive' }, { transaction: t });
    }

    const vacantCount = await Bed.count({ where: { room_id: bed.room_id, status: 'vacant' }, transaction: t });
    const totalCount = await Bed.count({ where: { room_id: bed.room_id }, transaction: t });
    if (vacantCount === totalCount) {
      await Room.update({ status: 'vacant' }, { where: { id: bed.room_id }, transaction: t });
    }

    await t.commit();
    const room = await Room.findByPk(bed.room_id);
    require('../services/occupancySnapshot').scheduleOccupancyRefresh(room?.hostel_id);
    if (room?.hostel_id) {
      await require('../services/occupancyService').projectHostelAvailability(room.hostel_id);
    }
    return success(res, bed, 'Bed vacated');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await BedAssignment.findAndCountAll({
      where: { bed_id: req.params.id },
      include: [{ model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name'] }] }],
      order: [['assigned_at', 'DESC']],
      limit,
      offset,
    });
    return paginated(res, rows, { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};
