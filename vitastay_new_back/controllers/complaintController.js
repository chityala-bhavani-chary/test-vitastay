const { Complaint, ComplaintTimeline, Tenant, Hostel, Room, User } = require('../models');
const createCrudController = require('../utils/crudController');
const { success } = require('../utils/response');

const base = createCrudController(Complaint, {
  includes: [
    { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name'] }] },
    { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
    { model: Room, as: 'room', attributes: ['id', 'room_number'] },
    { model: ComplaintTimeline, as: 'timeline' },
  ],
  searchFields: ['title', 'description'],
  filterBuilder: (req) => {
    const where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.tenantId) where.tenant_id = req.query.tenantId;
    return where;
  },
});

const { applyTenantScope, assertTenantOwnsRecord, getTenantProfile } = require('../helpers/tenantScope');
const { applyStaffJobScope, assignmentIdsFor, isAssignedToStaff } = require('../helpers/staffScope');
const { getPagination, getSort, buildSearchWhere } = require('../utils/pagination');
const { paginated, error, created } = require('../utils/response');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    let where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.tenantId) where.tenant_id = req.query.tenantId;
    if (req.query.search) Object.assign(where, buildSearchWhere(req.query.search, ['title', 'description']));

    const scoped = await applyTenantScope(req, res, where);
    if (scoped.forbidden) return scoped.response;
    where = scoped.where;

    const staffScoped = await applyStaffJobScope(req, res, where);
    if (staffScoped.forbidden) return staffScoped.response;
    where = staffScoped.where;

    const { count, rows } = await Complaint.findAndCountAll({
      where,
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name'] }] },
        { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
        { model: ComplaintTimeline, as: 'timeline' },
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
    const record = await Complaint.findByPk(req.params.id, {
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name'] }] },
        { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
        { model: ComplaintTimeline, as: 'timeline' },
      ],
    });
    if (!record) return error(res, 'Complaint not found', 404);
    const ownership = await assertTenantOwnsRecord(req, res, record.tenant_id);
    if (ownership.forbidden) return ownership.response;
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

exports.remove = base.remove;

exports.create = async (req, res, next) => {
  try {
    let tenantId = req.body.tenant_id;
    let hostelId = req.body.hostel_id;
    let roomId = req.body.room_id;

    if (req.user.role === 'tenant') {
      const tenant = await getTenantProfile(req.user.id);
      if (!tenant) return error(res, 'Tenant profile not found', 404);
      tenantId = tenant.id;
      hostelId = tenant.hostel_id;
      roomId = tenant.room_id;
    }

    const data = {
      ...req.body,
      tenant_id: tenantId,
      hostel_id: hostelId,
      room_id: roomId,
      images: req.files?.map((f) => `/uploads/complaints/${f.filename}`) || [],
    };
    const complaint = await Complaint.create(data);
    await ComplaintTimeline.create({
      complaint_id: complaint.id,
      action: 'created',
      performed_by: req.user.id,
      notes: 'Complaint raised',
    });
    return created(res, complaint);
  } catch (err) {
    next(err);
  }
};

exports.update = base.update;

exports.assign = async (req, res, next) => {
  try {
    const complaint = await Complaint.findByPk(req.params.id);
    if (!complaint) return require('../utils/response').error(res, 'Complaint not found', 404);
    await complaint.update({ assigned_to: req.body.assigned_to, status: 'assigned' });
    await ComplaintTimeline.create({
      complaint_id: complaint.id,
      action: 'assigned',
      performed_by: req.user.id,
      notes: `Assigned to staff #${req.body.assigned_to}`,
    });
    const { notifyComplaintAssigned } = require('../services/notifyService');
    await notifyComplaintAssigned(complaint);
    return success(res, complaint, 'Complaint assigned');
  } catch (err) {
    next(err);
  }
};

exports.resolve = async (req, res, next) => {
  try {
    const complaint = await Complaint.findByPk(req.params.id);
    if (!complaint) return require('../utils/response').error(res, 'Complaint not found', 404);
    await complaint.update({
      status: 'resolved',
      resolution: req.body.resolution,
      resolved_at: new Date(),
      resolved_by: req.user.id,
    });
    await ComplaintTimeline.create({
      complaint_id: complaint.id,
      action: 'resolved',
      performed_by: req.user.id,
      notes: req.body.resolution,
    });
    const { notifyComplaintResolved } = require('../services/notifyService');
    await notifyComplaintResolved(complaint);
    return success(res, complaint, 'Complaint resolved');
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const allowed = ['in_progress', 'rejected', 'resolved', 'closed'];
    if (!allowed.includes(status)) {
      return require('../utils/response').error(res, 'Invalid status', 400);
    }
    const complaint = await Complaint.findByPk(req.params.id);
    if (!complaint) return require('../utils/response').error(res, 'Complaint not found', 404);

    const updates = { status };
    if (status === 'resolved') {
      updates.resolved_at = new Date();
      updates.resolved_by = req.user.id;
      if (notes) updates.resolution = notes;
    }

    await complaint.update(updates);
    await ComplaintTimeline.create({
      complaint_id: complaint.id,
      action: status === 'resolved' ? 'completed' : status,
      performed_by: req.user.id,
      notes: notes || (status === 'resolved' ? 'Complaint completed' : `Status changed to ${status}`),
    });
    if (status === 'resolved') {
      const { notifyComplaintResolved } = require('../services/notifyService');
      await notifyComplaintResolved(complaint);
    }
    return success(res, complaint, status === 'resolved' ? 'Complaint completed' : `Complaint ${status}`);
  } catch (err) {
    next(err);
  }
};
