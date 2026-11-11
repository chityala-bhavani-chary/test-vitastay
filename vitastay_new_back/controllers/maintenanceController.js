const { Maintenance, Hostel, Room } = require('../models');
const createCrudController = require('../utils/crudController');
const { getPagination, getSort, buildSearchWhere } = require('../utils/pagination');
const { paginated, success, error } = require('../utils/response');
const { applyStaffJobScope, assignmentIdsFor, isAssignedToStaff } = require('../helpers/staffScope');

const includes = [
  { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
  { model: Room, as: 'room', attributes: ['id', 'room_number'] },
];

const base = createCrudController(Maintenance, {
  includes,
  searchFields: ['title', 'description', 'vendor'],
  filterBuilder: (req) => {
    const where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;
    return where;
  },
  beforeCreate: async (req) => ({
    ...req.body,
    created_by: req.user.id,
    images: req.files?.map((f) => `/uploads/maintenance/${f.filename}`) || [],
  }),
});

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    let where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;
    if (req.query.scheduledDate) where.scheduled_date = req.query.scheduledDate;
    if (req.query.search) Object.assign(where, buildSearchWhere(req.query.search, ['title', 'description', 'vendor']));

    const staffScoped = await applyStaffJobScope(req, res, where);
    if (staffScoped.forbidden) return staffScoped.response;
    where = staffScoped.where;

    const { count, rows } = await Maintenance.findAndCountAll({
      where,
      include: includes,
      order: getSort(req.query, ['scheduled_date', 'created_at']),
      limit,
      offset,
    });
    return paginated(res, rows, { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const record = await Maintenance.findByPk(req.params.id, { include: includes });
    if (!record) return error(res, 'Maintenance not found', 404);
    if (req.user.role === 'staff') {
      const { ids } = await assignmentIdsFor(req.user.id);
      if (!isAssignedToStaff(record.assigned_to, ids)) {
        return error(res, 'Forbidden', 403);
      }
    }
    return success(res, record);
  } catch (err) {
    next(err);
  }
};

exports.create = base.create;
exports.update = base.update;
exports.remove = base.remove;
