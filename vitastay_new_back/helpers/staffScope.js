const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { Staff } = require('../models');
const { error } = require('../utils/response');

const getStaffProfile = async (userId) => Staff.findOne({ where: { user_id: userId } });

const assignmentIdsFor = async (userId) => {
  const staff = await getStaffProfile(userId);
  const ids = [Number(userId)];
  if (staff) ids.push(Number(staff.id));
  return { staff, ids };
};

const isAssignedToStaff = (assignedTo, ids) => ids.includes(Number(assignedTo));

const applyStaffJobScope = async (req, res, where = {}) => {
  if (req.user?.role !== 'staff') {
    return { where, staff: null, ids: [], forbidden: false };
  }
  const { staff, ids } = await assignmentIdsFor(req.user.id);
  if (!staff) {
    return {
      where,
      staff: null,
      ids,
      forbidden: true,
      response: error(res, 'Staff profile not found', 404),
    };
  }
  return {
    where: {
      ...where,
      assigned_to: { [Op.in]: ids },
      hostel_id: staff.hostel_id,
    },
    staff,
    ids,
    forbidden: false,
  };
};

const applyStaffHostelScope = async (req, res, where = {}) => {
  if (req.user?.role !== 'staff') {
    return { where, staff: null, forbidden: false };
  }
  const staff = await getStaffProfile(req.user.id);
  if (!staff) {
    return {
      where,
      staff: null,
      forbidden: true,
      response: error(res, 'Staff profile not found', 404),
    };
  }
  return {
    where: {
      [Op.and]: [
        where,
        { [Op.or]: [{ hostel_id: staff.hostel_id }, { hostel_id: { [Op.is]: null } }] },
      ],
    },
    staff,
    forbidden: false,
  };
};

const todayMaintenanceWhere = (today = dayjs().format('YYYY-MM-DD')) => ({
  status: { [Op.notIn]: ['completed', 'cancelled'] },
  [Op.or]: [
    { scheduled_date: today },
    { status: 'in_progress' },
    { scheduled_date: { [Op.is]: null }, status: { [Op.in]: ['pending', 'scheduled'] } },
  ],
});

module.exports = {
  getStaffProfile,
  assignmentIdsFor,
  isAssignedToStaff,
  applyStaffJobScope,
  applyStaffHostelScope,
  todayMaintenanceWhere,
};
