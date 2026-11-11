const { Notice, Hostel } = require('../models');
const createCrudController = require('../utils/crudController');
const { getPagination, getSort, buildSearchWhere } = require('../utils/pagination');
const { paginated, success, error } = require('../utils/response');
const { getTenantProfile } = require('../helpers/tenantScope');
const { applyStaffHostelScope } = require('../helpers/staffScope');

const base = createCrudController(Notice, {
  includes: [{ model: Hostel, as: 'hostel', attributes: ['id', 'name'] }],
  searchFields: ['title', 'content'],
  filterBuilder: (req) => {
    const where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.type) where.type = req.query.type;
    return where;
  },
  beforeCreate: async (req) => ({ ...req.body, created_by: req.user.id }),
});

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.type) where.type = req.query.type;
    if (req.query.search) Object.assign(where, buildSearchWhere(req.query.search, ['title', 'content']));

    if (req.user.role === 'tenant') {
      const tenant = await getTenantProfile(req.user.id);
      if (!tenant) return error(res, 'Tenant profile not found', 404);
      where.hostel_id = tenant.hostel_id;
    }

    const staffScoped = await applyStaffHostelScope(req, res, where);
    if (staffScoped.forbidden) return staffScoped.response;
    where = staffScoped.where;

    const { count, rows } = await Notice.findAndCountAll({
      where,
      include: [{ model: Hostel, as: 'hostel', attributes: ['id', 'name'] }],
      order: getSort(req.query, ['created_at']),
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
    const notice = await Notice.findByPk(req.params.id, {
      include: [{ model: Hostel, as: 'hostel', attributes: ['id', 'name'] }],
    });
    if (!notice) return error(res, 'Notice not found', 404);

    if (req.user.role === 'tenant') {
      const tenant = await getTenantProfile(req.user.id);
      if (!tenant) return error(res, 'Tenant profile not found', 404);
      if (Number(notice.hostel_id) !== Number(tenant.hostel_id)) {
        return error(res, 'Forbidden', 403);
      }
    }
    if (req.user.role === 'staff') {
      const { getStaffProfile } = require('../helpers/staffScope');
      const staff = await getStaffProfile(req.user.id);
      if (!staff) return error(res, 'Staff profile not found', 404);
      if (notice.hostel_id && Number(notice.hostel_id) !== Number(staff.hostel_id)) {
        return error(res, 'Forbidden', 403);
      }
    }

    return success(res, notice);
  } catch (err) {
    next(err);
  }
};

exports.create = base.create;
exports.update = base.update;
exports.remove = base.remove;
