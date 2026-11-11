const { Visitor, Tenant, Hostel, Room, User } = require('../models');
const createCrudController = require('../utils/crudController');
const { success } = require('../utils/response');

const base = createCrudController(Visitor, {
  includes: [
    { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name'] }] },
    { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
    { model: Room, as: 'room', attributes: ['id', 'room_number'] },
  ],
  searchFields: ['name', 'phone', 'purpose'],
  filterBuilder: (req) => {
    const where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.tenantId) where.tenant_id = req.query.tenantId;
    // Tenant can only see their own visitors — enforced async in getAll override below
    return where;
  },
  beforeCreate: async (req) => ({
    ...req.body,
    created_by: req.user.id,
    photo: req.file ? `/uploads/visitors/${req.file.filename}` : null,
  }),
});

const { applyTenantScope, assertTenantOwnsRecord, getTenantProfile } = require('../helpers/tenantScope');
const { getPagination, getSort, buildSearchWhere } = require('../utils/pagination');
const { paginated, error } = require('../utils/response');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    let where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.tenantId) where.tenant_id = req.query.tenantId;
    if (req.query.search) Object.assign(where, buildSearchWhere(req.query.search, ['name', 'phone', 'purpose']));

    const scoped = await applyTenantScope(req, res, where);
    if (scoped.forbidden) return scoped.response;
    where = scoped.where;

    const { count, rows } = await Visitor.findAndCountAll({
      where,
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name'] }] },
        { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
      ],
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
    const record = await Visitor.findByPk(req.params.id, {
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name'] }] },
        { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
      ],
    });
    if (!record) return error(res, 'Visitor not found', 404);
    const ownership = await assertTenantOwnsRecord(req, res, record.tenant_id);
    if (ownership.forbidden) return ownership.response;
    return success(res, record);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { created } = require('../utils/response');
    let tenantId = req.body.tenant_id;
    if (req.user.role === 'tenant') {
      const tenant = await getTenantProfile(req.user.id);
      if (!tenant) return error(res, 'Tenant profile not found', 404);
      tenantId = tenant.id;
    }
    const record = await Visitor.create({
      ...req.body,
      tenant_id: tenantId,
      created_by: req.user.id,
      photo: req.file ? `/uploads/visitors/${req.file.filename}` : null,
    });
    return created(res, record);
  } catch (err) {
    next(err);
  }
};

exports.update = base.update;

exports.approve = async (req, res, next) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) return require('../utils/response').error(res, 'Visitor not found', 404);
    await visitor.update({ status: 'approved', approved_by: req.user.id, approved_at: new Date() });
    return success(res, visitor, 'Visitor approved');
  } catch (err) {
    next(err);
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) return require('../utils/response').error(res, 'Visitor not found', 404);
    await visitor.update({ status: 'checked_out', out_time: new Date() });
    return success(res, visitor, 'Visitor checked out');
  } catch (err) {
    next(err);
  }
};

exports.remove = base.remove;
