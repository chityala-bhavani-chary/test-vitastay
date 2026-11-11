const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const {
  Hostel, Room, Tenant, RentPayment, Complaint, Maintenance,
  Visitor, User, SupervisorHostel, Notice,
} = require('../models');
const { assignmentIdsFor, todayMaintenanceWhere } = require('../helpers/staffScope');
const { loadHostelStats } = require('./occupancySnapshot');
const { getModelsForHostel } = require('../helpers/hostelContext');
const logger = require('../config/logger');

const mergeMonthSeries = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    if (!row || !row.month_year) return;
    map.set(row.month_year, (map.get(row.month_year) || 0) + Number(row.total || 0));
  });
  return [...map.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([month_year, total]) => ({ month_year, total }));
};

const mergeExpenseSeries = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = row?.category || 'other';
    map.set(key, (map.get(key) || 0) + Number(row.total || 0));
  });
  return [...map.entries()].map(([category, total]) => ({ category, total }));
};

const getOwnerDashboard = async (ownerId) => {
  const hostels = await Hostel.findAll({
    where: { owner_id: ownerId },
    attributes: ['id', 'name', 'database_name'],
  });

  if (!hostels.length) {
    return {
      stats: {
        totalHostels: 0, occupiedRooms: 0, vacantRooms: 0, occupiedBeds: 0, vacantBeds: 0,
        monthlyIncome: 0, pendingRent: 0, outstanding: 0, overdueAmount: 0,
        overdueCount: 0, pendingCount: 0, partialCount: 0, vacancyLoss: 0, activeTenants: 0,
        checkInsToday: 0, checkOutsToday: 0, complaints: 0, maintenance: 0, visitorsToday: 0, occupancyRate: 0,
      },
      charts: { monthlyIncome: [], monthlyBilled: [], monthlyExpenses: [], occupancyRate: [], expenses: [], expensesByMonth: [] },
      dues: [],
      recentActivities: [],
    };
  }

  const perHostel = [];
  for (const hostel of hostels) {
    const stats = await loadHostelStats(hostel);
    if (stats) perHostel.push(stats);
  }

  const occupiedRooms = perHostel.reduce((sum, row) => sum + row.occupiedRooms, 0);
  const vacantRooms = perHostel.reduce((sum, row) => sum + row.vacantRooms, 0);
  const occupiedBeds = perHostel.reduce((sum, row) => sum + (row.occupiedBeds || 0), 0);
  const vacantBeds = perHostel.reduce((sum, row) => sum + (row.vacantBeds || 0), 0);
  const monthlyIncome = perHostel.reduce((sum, row) => sum + row.monthlyIncome, 0);
  const pendingRent = perHostel.reduce((sum, row) => sum + row.pendingRent, 0);
  const outstanding = perHostel.reduce((sum, row) => sum + (row.outstanding || 0), 0);
  const overdueAmount = perHostel.reduce((sum, row) => sum + (row.overdueAmount || 0), 0);
  const overdueCount = perHostel.reduce((sum, row) => sum + (row.overdueCount || 0), 0);
  const pendingCount = perHostel.reduce((sum, row) => sum + (row.pendingCount || 0), 0);
  const partialCount = perHostel.reduce((sum, row) => sum + (row.partialCount || 0), 0);
  const vacancyLoss = perHostel.reduce((sum, row) => sum + (row.vacancyLoss || 0), 0);
  const activeTenants = perHostel.reduce((sum, row) => sum + (row.activeTenants || 0), 0);
  const checkInsToday = perHostel.reduce((sum, row) => sum + (row.checkInsToday || 0), 0);
  const checkOutsToday = perHostel.reduce((sum, row) => sum + (row.checkOutsToday || 0), 0);
  const complaints = perHostel.reduce((sum, row) => sum + row.openComplaints, 0);
  const maintenance = perHostel.reduce((sum, row) => sum + row.openMaintenance, 0);
  const visitorsToday = perHostel.reduce((sum, row) => sum + row.visitorsToday, 0);
  const roomTotal = occupiedRooms + vacantRooms;
  const occupancyRate = roomTotal > 0 ? Math.round((occupiedRooms / roomTotal) * 100) : 0;
  const billedMerged = perHostel.flatMap((row) => row.billedRows || []);
  const monthlyBilledMap = new Map();
  billedMerged.forEach((row) => {
    if (!row?.month_year) return;
    const prev = monthlyBilledMap.get(row.month_year) || { billed: 0, collected: 0, count: 0 };
    monthlyBilledMap.set(row.month_year, {
      billed: prev.billed + Number(row.billed || 0),
      collected: prev.collected + Number(row.collected || 0),
      count: prev.count + Number(row.count || 0),
    });
  });
  const monthlyBilled = [...monthlyBilledMap.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([month_year, value]) => ({ month_year, ...value }));
  const dues = perHostel
    .flatMap((row) => row.dues || [])
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 8);

  return {
    stats: {
      totalHostels: hostels.length,
      occupiedRooms,
      vacantRooms,
      occupiedBeds,
      vacantBeds,
      monthlyIncome,
      pendingRent,
      outstanding,
      overdueAmount,
      overdueCount,
      pendingCount,
      partialCount,
      vacancyLoss,
      activeTenants,
      checkInsToday,
      checkOutsToday,
      complaints,
      maintenance,
      visitorsToday,
      occupancyRate,
    },
    charts: {
      monthlyIncome: mergeMonthSeries(perHostel.flatMap((row) => row.incomeRows || [])).slice(-24),
      monthlyBilled: monthlyBilled.slice(-24),
      monthlyExpenses: mergeMonthSeries(
        perHostel.flatMap((row) => (row.expenseRows || []).map((item) => ({
          month_year: item.month_year,
          total: item.total,
        })))
      ).slice(-24),
      occupancyRate: [{ occupied: occupiedRooms, vacant: vacantRooms, rate: occupancyRate }],
      expensesByMonth: perHostel.flatMap((row) => row.expenseRows || []),
      expenses: mergeExpenseSeries(perHostel.flatMap((row) => row.expenseRows || [])),
    },
    dues,
    recentActivities: [],
  };
};

const getSupervisorDashboard = async (supervisorId, hostelId) => {
  const assignment = await SupervisorHostel.findOne({
    where: { supervisor_id: supervisorId, hostel_id: hostelId },
  });
  if (!assignment) throw Object.assign(new Error('Hostel not assigned'), { statusCode: 403 });

  const ctx = await getModelsForHostel(hostelId);
  if (!ctx.hostel) throw Object.assign(new Error('Hostel not found'), { statusCode: 404 });
  const db = ctx.models;
  const today = dayjs().format('YYYY-MM-DD');

  const [checkIns, checkOuts, pendingRent, complaints, maintenance, visitors, attendance, rooms] = await Promise.all([
    db.Tenant.count({ where: { hostel_id: hostelId, move_in_date: today } }),
    db.Tenant.count({ where: { hostel_id: hostelId, move_out_date: today } }),
    db.RentPayment.count({ where: { hostel_id: hostelId, status: { [Op.in]: ['pending', 'overdue'] } } }),
    db.Complaint.count({ where: { hostel_id: hostelId, status: { [Op.notIn]: ['resolved', 'closed'] } } }),
    db.Maintenance.count({ where: { hostel_id: hostelId, status: { [Op.notIn]: ['completed', 'cancelled'] } } }),
    db.Visitor.count({ where: { hostel_id: hostelId, in_time: { [Op.gte]: dayjs().startOf('day').toDate() } } }),
    db.StaffAttendance.count({
      where: { date: today, status: 'present' },
      include: [{ model: db.Staff, as: 'staff', where: { hostel_id: hostelId }, attributes: [] }],
    }).catch((err) => {
      logger.warn(`Supervisor attendance count skipped: ${err.message}`);
      return 0;
    }),
    db.Room.findAll({
      where: { hostel_id: hostelId },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    }),
  ]);

  return {
    stats: { checkIns, checkOuts, pendingRent, complaints, maintenance, visitors, attendance },
    rooms,
  };
};

const getTenantDashboard = async (userId) => {
  const tenant = await Tenant.findOne({
    where: { user_id: userId },
    include: ['hostel', 'room', 'bed', { model: User, as: 'user', attributes: ['first_name', 'last_name', 'email', 'phone', 'avatar'] }],
  });

  if (!tenant) throw Object.assign(new Error('Tenant profile not found'), { statusCode: 404 });

  const [rentDue, paymentHistory, complaints, visitors, documents, announcements] = await Promise.all([
    RentPayment.findOne({
      where: { tenant_id: tenant.id, status: { [Op.in]: ['pending', 'partial', 'overdue'] } },
      order: [['due_date', 'ASC']],
    }),
    RentPayment.findAll({
      where: { tenant_id: tenant.id, status: 'paid' },
      order: [['paid_date', 'DESC']],
      limit: 5,
    }),
    Complaint.count({ where: { tenant_id: tenant.id, status: { [Op.notIn]: ['resolved', 'closed'] } } }),
    Visitor.count({ where: { tenant_id: tenant.id, status: { [Op.in]: ['approved', 'checked_in'] } } }),
    require('../models').TenantDocument.count({ where: { tenant_id: tenant.id } }),
    require('../models').Notice.findAll({
      where: {
        [Op.and]: [
          { [Op.or]: [{ hostel_id: tenant.hostel_id }, { hostel_id: null }] },
          { [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }] },
        ],
      },
      order: [['created_at', 'DESC']],
      limit: 5,
    }),
  ]);

  return {
    profile: tenant,
    rentDue,
    paymentHistory,
    stats: { complaints, visitors, documents },
    announcements,
  };
};

const getStaffDashboard = async (userId) => {
  const { staff, ids } = await assignmentIdsFor(userId);
  if (!staff) throw Object.assign(new Error('Staff profile not found'), { statusCode: 404 });

  const hostel = await Hostel.findByPk(staff.hostel_id, { attributes: ['id', 'name'] });
  const assigned = { assigned_to: { [Op.in]: ids }, hostel_id: staff.hostel_id };
  const openComplaint = {
    ...assigned,
    status: { [Op.notIn]: ['resolved', 'closed', 'rejected'] },
  };
  const todayMaint = { ...assigned, ...todayMaintenanceWhere() };
  const noticeWhere = {
    [Op.and]: [
      { [Op.or]: [{ hostel_id: staff.hostel_id }, { hostel_id: { [Op.is]: null } }] },
      { [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }] },
    ],
  };

  const [complaints, maintenance, notices, complaintCount, maintenanceCount] = await Promise.all([
    Complaint.findAll({
      where: openComplaint,
      include: [
        { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 10,
    }),
    Maintenance.findAll({
      where: todayMaint,
      include: [
        { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
      ],
      order: [['scheduled_date', 'ASC'], ['created_at', 'DESC']],
      limit: 10,
    }),
    Notice.findAll({
      where: noticeWhere,
      include: [{ model: Hostel, as: 'hostel', attributes: ['id', 'name'] }],
      order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
      limit: 5,
    }),
    Complaint.count({ where: openComplaint }),
    Maintenance.count({ where: todayMaint }),
  ]);

  const user = await User.findByPk(userId, {
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'role'],
  });

  return {
    profile: {
      user,
      staff: {
        id: staff.id,
        staff_role: staff.staff_role,
        employee_id: staff.employee_id,
        hostel_id: staff.hostel_id,
      },
      hostel,
    },
    stats: {
      complaints: complaintCount,
      maintenance: maintenanceCount,
      notices: notices.length,
    },
    complaints,
    maintenance,
    notices,
  };
};

module.exports = { getOwnerDashboard, getSupervisorDashboard, getTenantDashboard, getStaffDashboard };
