const { Op } = require('sequelize');
const { sequelize, User, Hostel, Tenant, Staff, RentPayment, SupervisorHostel } = require('../models');
const { success, created, paginated, error } = require('../utils/response');
const { getPagination, getSort, buildSearchWhere } = require('../utils/pagination');
const { passwordFields } = require('../helpers/password');
const { createAuditLog } = require('../helpers/audit');
const {
  DEFAULT_HOSTEL_FEATURES,
  normalizeFeatures,
  HOSTEL_FEATURE_KEYS,
  HOSTEL_FEATURE_LABELS,
  AMENITY_OPTIONS,
} = require('../constants/hostelFeatures');

const { withEntitlements } = require('../services/ownerPlan');
const { supportQueue } = require('../services/vitaEyeSupport');

const touchListing = (hostelId) => {
  require('../services/listingProjection').scheduleListingRefresh(hostelId);
};

const userPublicAttrs = [
  'id', 'email', 'role', 'first_name', 'last_name', 'phone',
  'is_active', 'is_locked', 'last_login', 'password_changed_at', 'created_at',
];

const mapUserRow = (user, extra = {}) => {
  if (!user) return null;
  const json = typeof user.toJSON === 'function' ? user.toJSON() : user;
  return {
    id: json.id,
    email: json.email,
    role: json.role,
    first_name: json.first_name,
    last_name: json.last_name,
    name: `${json.first_name || ''} ${json.last_name || ''}`.trim(),
    phone: json.phone,
    is_active: json.is_active,
    is_locked: json.is_locked,
    last_login: json.last_login,
    password_changed_at: json.password_changed_at,
    // IMP-003: never return a stored plaintext. Reset returns newPassword once.
    password_display: null,
    ...extra,
  };
};

const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$';
  let pwd = 'Nv@';
  for (let i = 0; i < 6; i += 1) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
};
exports.getMeta = async (req, res) => {
  return success(res, {
    features: HOSTEL_FEATURE_KEYS.map((key) => ({ key, label: HOSTEL_FEATURE_LABELS[key] })),
    amenities: AMENITY_OPTIONS,
    defaultFeatures: DEFAULT_HOSTEL_FEATURES,
  });
};

exports.getDashboard = async (req, res, next) => {
  try {
    const [
      totalHostels,
      activeHostels,
      onHoldHostels,
      pendingApprovalHostels,
      totalOwners,
      totalUsers,
      totalTenants,
      pendingRent,
    ] = await Promise.all([
      Hostel.count(),
      Hostel.count({ where: { status: 'active' } }),
      Hostel.count({ where: { status: 'on_hold' } }),
      Hostel.count({ where: { status: 'pending_approval' } }),
      User.count({ where: { role: 'owner' } }),
      User.count({ where: { role: { [Op.ne]: 'super_admin' } } }),
      Tenant.count({ where: { status: 'active' } }),
      RentPayment.sum('total_amount', { where: { status: { [Op.in]: ['pending', 'partial', 'overdue'] } } }),
    ]);

    const recentHostels = await Hostel.findAll({
      include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }],
      order: [['created_at', 'DESC']],
      limit: 5,
    });

    return success(res, {
      stats: {
        totalHostels,
        activeHostels,
        onHoldHostels,
        pendingApprovalHostels,
        totalOwners,
        totalUsers,
        totalTenants,
        pendingRent: pendingRent || 0,
      },
      recentHostels,
    });
  } catch (err) {
    next(err);
  }
};

exports.getHostels = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) Object.assign(where, buildSearchWhere(req.query.search, ['name', 'city', 'code', 'address']));

    const { count, rows } = await Hostel.findAndCountAll({
      where,
      include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'is_active', 'is_locked'] }],
      order: getSort(req.query, ['name', 'created_at', 'city', 'status']),
      limit,
      offset,
    });

    return paginated(res, rows.map(withEntitlements), { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};

exports.registerHostel = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { owner: ownerData, hostel: hostelData } = req.body;

    if (!ownerData?.email || !ownerData?.password || !ownerData?.first_name || !ownerData?.last_name) {
      await t.rollback();
      return error(res, 'Owner email, password, first name and last name are required', 400);
    }
    if (!hostelData?.name || !hostelData?.address || !hostelData?.city || !hostelData?.state || !hostelData?.pincode) {
      await t.rollback();
      return error(res, 'Hostel name, address, city, state and pincode are required', 400);
    }

    const existing = await User.findOne({ where: { email: ownerData.email }, transaction: t });
    if (existing) {
      await t.rollback();
      return error(res, 'Owner email already exists', 409);
    }

    if (hostelData.code) {
      const codeExists = await Hostel.findOne({ where: { code: hostelData.code }, transaction: t });
      if (codeExists) {
        await t.rollback();
        return error(res, 'Hostel code already exists', 409);
      }
    }

    const owner = await User.create({
      email: ownerData.email,
      ...(await passwordFields(ownerData.password)),
      first_name: ownerData.first_name,
      last_name: ownerData.last_name,
      phone: ownerData.phone || null,
      role: 'owner',
      email_verified: true,
      is_active: true,
    }, { transaction: t });

    const hostel = await Hostel.create({
      owner_id: owner.id,
      plan: 'regular',
      plan_status: 'comp',
      name: hostelData.name,
      code: hostelData.code || null,
      description: hostelData.description || null,
      address: hostelData.address,
      city: hostelData.city,
      area: hostelData.area || null,
      state: hostelData.state,
      pincode: hostelData.pincode,
      country: hostelData.country || 'India',
      total_floors: hostelData.total_floors || 1,
      capacity: hostelData.capacity || 0,
      amenities: hostelData.amenities || [],
      features: normalizeFeatures(hostelData.features),
      electricity_charge: hostelData.electricity_charge || 0,
      water_charge: hostelData.water_charge || 0,
      security_deposit: hostelData.security_deposit || 0,
      notice_period_months: hostelData.notice_period_months || 1,
      contact_phone: hostelData.contact_phone || ownerData.phone || null,
      contact_email: hostelData.contact_email || ownerData.email,
      status: hostelData.status || 'active',
      gender_policy: ['male', 'female', 'unisex'].includes(String(hostelData.gender_policy || '').toLowerCase())
        ? String(hostelData.gender_policy).toLowerCase()
        : 'unisex',
    }, { transaction: t });

    await createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'hostel',
      entityId: hostel.id,
      newValues: { owner_id: owner.id, hostel_id: hostel.id, registered_by: 'super_admin' },
      req,
    });

    await t.commit();

    // Dedicated DB named from hostel — created after catalog commit
    let databaseName = null;
    try {
      const { ensureHostelDatabase } = require('../services/ensureHostelDatabase');
      databaseName = await ensureHostelDatabase(hostel);
      await hostel.reload();
    } catch (provisionErr) {
      touchListing(hostel.id);
      return created(res, hostel, `Hostel registered but database provisioning failed: ${provisionErr.message}`);
    }

    const result = await Hostel.findByPk(hostel.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }],
    });

    touchListing(hostel.id);
    return created(res, result, `Hostel registered with isolated database "${databaseName}"`);
  } catch (err) {
    try { await t.rollback(); } catch { /* transaction may already be committed */ }
    next(err);
  }
};

exports.updateHostel = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id);
    if (!hostel) return error(res, 'Hostel not found', 404);

    const payload = { ...req.body };
    if (payload.features) payload.features = normalizeFeatures(payload.features);
    delete payload.owner_id;
    require('../services/listingPublish').stripListingFieldsFromHostelPayload(payload);
    ['plan', 'plan_period', 'plan_status', 'plan_starts_at', 'plan_expires_at', 'plan_grace_ends_at']
      .forEach((key) => { delete payload[key]; });

    const oldValues = hostel.toJSON();
    await hostel.update(payload);
    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'hostel',
      entityId: hostel.id,
      oldValues,
      newValues: payload,
      req,
    });

    await require('../services/listingPublish').unpublishWhenHostelNotOperating(hostel, {
      user: req.user,
      req,
      trigger: 'hostel_status',
    });
    return success(res, hostel, 'Hostel updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.setHostelHold = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id);
    if (!hostel) return error(res, 'Hostel not found', 404);

    if (hostel.status === 'pending_approval' || hostel.status === 'rejected') {
      return error(res, 'Approve the hostel before putting it on hold', 400);
    }

    const onHold = Boolean(req.body.on_hold);
    const status = onHold ? 'on_hold' : (req.body.status || 'active');
    await hostel.update({ status });

    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'hostel',
      entityId: hostel.id,
      newValues: { status, on_hold: onHold },
      req,
    });

    if (onHold) {
      await require('../services/listingPublish').unpublishWhenHostelNotOperating(hostel, {
        user: req.user,
        req,
        trigger: 'hostel_hold',
      });
    } else {
      require('../services/listingProjection').scheduleListingRefresh(hostel.id);
    }
    await hostel.reload();
    return success(res, hostel, onHold ? 'Hostel put on hold' : 'Hostel released from hold');
  } catch (err) {
    next(err);
  }
};

exports.approveHostel = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email'] }],
    });
    if (!hostel) return error(res, 'Hostel not found', 404);

    // Create dedicated MySQL database for this branch/hostel — data stays isolated
    let databaseName = hostel.database_name;
    try {
      const { ensureHostelDatabase } = require('../services/ensureHostelDatabase');
      databaseName = await ensureHostelDatabase(hostel);
      await hostel.reload();
    } catch (provisionErr) {
      return error(res, `Approval failed while creating database: ${provisionErr.message}`, 500);
    }

    await hostel.update({ status: 'active', database_name: databaseName });
    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'hostel',
      entityId: hostel.id,
      newValues: { status: 'active', database_name: databaseName, approved_by: req.user.id },
      req,
    });

    touchListing(hostel.id);
    return success(res, hostel, `Hostel approved. Isolated database "${databaseName}" is ready`);
  } catch (err) {
    next(err);
  }
};

exports.rejectHostel = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email'] }],
    });
    if (!hostel) return error(res, 'Hostel not found', 404);

    const reason = req.body.reason || null;
    await hostel.update({ status: 'rejected' });
    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'hostel',
      entityId: hostel.id,
      newValues: { status: 'rejected', reason, rejected_by: req.user.id },
      req,
    });

    await require('../services/listingPublish').unpublishWhenHostelNotOperating(hostel, {
      user: req.user,
      req,
      trigger: 'hostel_status',
    });
    return success(res, hostel, 'Hostel registration rejected');
  } catch (err) {
    next(err);
  }
};

exports.updateFeatures = async (req, res, next) => {
  try {
    const hostel = await Hostel.findByPk(req.params.id);
    if (!hostel) return error(res, 'Hostel not found', 404);

    const features = normalizeFeatures(req.body.features || req.body);
    await hostel.update({ features });

    return success(res, hostel, 'Hostel features updated');
  } catch (err) {
    next(err);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = { role: { [Op.ne]: 'super_admin' } };
    if (req.query.role) where.role = req.query.role;
    if (req.query.search) {
      Object.assign(where, buildSearchWhere(req.query.search, ['email', 'first_name', 'last_name', 'phone']));
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      include: [
        { model: Hostel, as: 'ownedHostels', attributes: ['id', 'name', 'code', 'status'] },
        { model: Hostel, as: 'supervisedHostels', attributes: ['id', 'name', 'code', 'status'], through: { attributes: [] } },
        { model: Tenant, as: 'tenantProfile', attributes: ['id', 'hostel_id', 'status'], include: [{ model: Hostel, as: 'hostel', attributes: ['id', 'name', 'code'] }] },
        { model: Staff, as: 'staffProfile', attributes: ['id', 'hostel_id', 'staff_role', 'status'], include: [{ model: Hostel, as: 'hostel', attributes: ['id', 'name', 'code'] }] },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const mapped = rows.map((u) => {
      const row = mapUserRow(u);
      const hostels = [];
      (u.ownedHostels || []).forEach((h) => hostels.push({ id: h.id, name: h.name, code: h.code, link: 'owner' }));
      (u.supervisedHostels || []).forEach((h) => hostels.push({ id: h.id, name: h.name, code: h.code, link: 'supervisor' }));
      if (u.tenantProfile?.hostel) {
        hostels.push({
          id: u.tenantProfile.hostel.id,
          name: u.tenantProfile.hostel.name,
          code: u.tenantProfile.hostel.code,
          link: 'tenant',
        });
      }
      if (u.staffProfile?.hostel) {
        hostels.push({
          id: u.staffProfile.hostel.id,
          name: u.staffProfile.hostel.name,
          code: u.staffProfile.hostel.code,
          link: 'staff',
        });
      }
      row.hostels = hostels;
      row.ownedHostels = u.ownedHostels || [];
      return row;
    });

    return paginated(res, mapped, { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};

exports.getUsersByHostel = async (req, res, next) => {
  try {
    const hostelWhere = {};
    if (req.query.hostelId) hostelWhere.id = req.query.hostelId;
    if (req.query.status) hostelWhere.status = req.query.status;
    if (req.query.search) {
      Object.assign(hostelWhere, buildSearchWhere(req.query.search, ['name', 'code', 'city']));
    }

    const hostels = await Hostel.findAll({
      where: hostelWhere,
      include: [{ model: User, as: 'owner', attributes: userPublicAttrs }],
      order: [['name', 'ASC']],
    });

    const result = [];

    for (const hostel of hostels) {
      const usersMap = new Map();

      if (hostel.owner) {
        usersMap.set(hostel.owner.id, mapUserRow(hostel.owner, { link_role: 'owner' }));
      }

      const supervisorLinks = await SupervisorHostel.findAll({
        where: { hostel_id: hostel.id },
        include: [{ model: User, as: 'supervisor', attributes: userPublicAttrs }],
      });
      supervisorLinks.forEach((link) => {
        if (link.supervisor && !usersMap.has(link.supervisor.id)) {
          usersMap.set(link.supervisor.id, mapUserRow(link.supervisor, { link_role: 'supervisor' }));
        }
      });

      const tenants = await Tenant.findAll({
        where: { hostel_id: hostel.id },
        include: [{ model: User, as: 'user', attributes: userPublicAttrs }],
      });
      tenants.forEach((t) => {
        if (t.user && !usersMap.has(t.user.id)) {
          usersMap.set(t.user.id, mapUserRow(t.user, { link_role: 'tenant', tenant_status: t.status }));
        }
      });

      const staffRows = await Staff.findAll({
        where: { hostel_id: hostel.id },
        include: [{ model: User, as: 'user', attributes: userPublicAttrs }],
      });
      staffRows.forEach((s) => {
        if (s.user && !usersMap.has(s.user.id)) {
          usersMap.set(s.user.id, mapUserRow(s.user, {
            link_role: 'staff',
            staff_role: s.staff_role,
            staff_status: s.status,
          }));
        }
      });

      let users = Array.from(usersMap.values());

      if (req.query.role) {
        users = users.filter((u) => u.role === req.query.role || u.link_role === req.query.role);
      }
      if (req.query.userSearch) {
        const q = String(req.query.userSearch).toLowerCase();
        users = users.filter((u) =>
          String(u.id).includes(q)
          || u.name?.toLowerCase().includes(q)
          || u.email?.toLowerCase().includes(q)
          || u.phone?.toLowerCase().includes(q)
        );
      }

      users.sort((a, b) => {
        const order = { owner: 0, supervisor: 1, staff: 2, tenant: 3 };
        return (order[a.link_role] ?? 9) - (order[b.link_role] ?? 9) || a.id - b.id;
      });

      result.push({
        hostel: {
          id: hostel.id,
          name: hostel.name,
          code: hostel.code,
          city: hostel.city,
          status: hostel.status,
        },
        users,
        userCount: users.length,
      });
    }

    return success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.resetUserPassword = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    if (user.role === 'super_admin') return error(res, 'Cannot reset another super admin password here', 403);

    let { newPassword, generate } = req.body;
    if (generate || !newPassword) {
      newPassword = generateTempPassword();
    }
    if (!newPassword || String(newPassword).length < 6) {
      return error(res, 'Password must be at least 6 characters', 400);
    }

    await user.update({
      ...(await passwordFields(newPassword)),
      password_changed_at: new Date(),
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'user',
      entityId: user.id,
      newValues: { password_reset: true },
      req,
    });

    return success(res, {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`.trim(),
      newPassword,
    }, 'Password reset successfully');
  } catch (err) {
    next(err);
  }
};

exports.lockUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    if (user.role === 'super_admin') return error(res, 'Cannot lock super admin', 403);

    await user.update({ is_locked: Boolean(req.body.is_locked) });
    const safe = user.toJSON();
    delete safe.password;
    return success(res, safe, user.is_locked ? 'Account locked' : 'Account unlocked');
  } catch (err) {
    next(err);
  }
};

exports.createOwner = async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;
    if (!email || !password || !first_name || !last_name) {
      return error(res, 'Email, password, first name and last name are required', 400);
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return error(res, 'Email already exists', 409);

    const owner = await User.create({
      email,
      ...(await passwordFields(password)),
      first_name,
      last_name,
      phone: phone || null,
      role: 'owner',
      email_verified: true,
      is_active: true,
    });

    const safe = owner.toJSON();
    delete safe.password;
    return created(res, safe, 'Owner account created');
  } catch (err) {
    next(err);
  }
};

exports.vitaEyeQueue = async (req, res, next) => {
  try {
    const data = await supportQueue();
    return success(res, data, 'Vita Eye support queue');
  } catch (err) {
    next(err);
  }
};
