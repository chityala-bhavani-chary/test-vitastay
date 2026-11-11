const { Hostel, SupervisorHostel, Staff } = require('../models');
const { error } = require('../utils/response');
const { auditSaAccess } = require('../services/vitaEyePrivacy');

const userCanAccessVitaEye = async (user, hostel) => {
  if (!user || !hostel) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'owner') return Number(hostel.owner_id) === Number(user.id);
  if (user.role === 'supervisor') {
    const assigned = await SupervisorHostel.findOne({
      where: { supervisor_id: user.id, hostel_id: hostel.id },
    });
    return Boolean(assigned);
  }
  if (user.role === 'staff') {
    const row = await Staff.findOne({
      where: { user_id: user.id, hostel_id: hostel.id, status: 'active' },
    });
    return Boolean(row);
  }
  return false;
};

const loadHostelForVitaEye = async (req, res, next) => {
  try {
    const hostelId = req.params.hostelId || req.params.id;
    const hostel = await Hostel.findByPk(hostelId);
    if (!hostel) return error(res, 'Hostel not found', 404);
    if (await userCanAccessVitaEye(req.user, hostel)) {
      req.hostel = hostel;
      await auditSaAccess({ user: req.user, hostel, req, kind: 'browse' });
      return next();
    }
    if (req.user?.role === 'supervisor' || req.user?.role === 'staff') {
      return error(res, 'This hostel is not assigned to you', 403);
    }
    return error(res, 'Forbidden', 403);
  } catch (err) {
    next(err);
  }
};

module.exports = { userCanAccessVitaEye, loadHostelForVitaEye };
