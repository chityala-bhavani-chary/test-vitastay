/**
 * Project occupancy (and current rent/complaint totals) onto master.
 * Isolated hostels store rooms/beds on vitastay_*; the owner dashboard must not
 * count only the master connection.
 */
const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const logger = require('../config/logger');
const { getModelsForHostel } = require('../helpers/hostelContext');

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const computeHostelStats = async (hostelOrId) => {
  const ctx = await getModelsForHostel(hostelOrId);
  const hostel = ctx.hostel;
  if (!hostel) return null;
  const hostelId = hostel.id;
  const db = ctx.models;
  const monthYear = dayjs().format('YYYY-MM');
  const todayStart = dayjs().startOf('day').toDate();

  const rooms = await db.Room.findAll({
    where: { hostel_id: hostelId },
    attributes: ['id', 'status'],
  });
  const roomIds = rooms.map((row) => row.id);
  const occupiedRooms = rooms.filter((row) => row.status === 'occupied').length;
  const vacantRooms = rooms.filter((row) => row.status === 'vacant').length;
  const roomTotal = occupiedRooms + vacantRooms;
  const occupancyRate = roomTotal > 0 ? Math.round((occupiedRooms / roomTotal) * 100) : 0;

  let occupiedBeds = 0;
  let vacantBeds = 0;
  if (roomIds.length) {
    occupiedBeds = await db.Bed.count({ where: { room_id: { [Op.in]: roomIds }, status: 'occupied' } });
    vacantBeds = await db.Bed.count({ where: { room_id: { [Op.in]: roomIds }, status: 'vacant' } });
  }

  const openRent = { hostel_id: hostelId, status: { [Op.in]: ['pending', 'partial', 'overdue'] } };
  const today = dayjs().format('YYYY-MM-DD');

  const [
    monthlyIncome,
    pendingRent,
    openComplaints,
    openMaintenance,
    visitorsToday,
    incomeRows,
    expenseRows,
    billedRows,
    openRentSums,
    overdueSums,
    statusCounts,
    vacancyLoss,
    activeTenants,
    checkInsToday,
    checkOutsToday,
    duePayments,
  ] = await Promise.all([
    db.RentPayment.sum('paid_amount', {
      where: { hostel_id: hostelId, status: { [Op.in]: ['paid', 'partial'] }, month_year: monthYear },
    }),
    db.RentPayment.sum('total_amount', {
      where: openRent,
    }),
    db.Complaint.count({
      where: { hostel_id: hostelId, status: { [Op.notIn]: ['resolved', 'closed'] } },
    }),
    db.Maintenance.count({
      where: { hostel_id: hostelId, status: { [Op.notIn]: ['completed', 'cancelled'] } },
    }),
    db.Visitor.count({
      where: { hostel_id: hostelId, in_time: { [Op.gte]: todayStart } },
    }),
    db.RentPayment.findAll({
      attributes: ['month_year', [fn('SUM', col('paid_amount')), 'total']],
      where: { hostel_id: hostelId, status: { [Op.in]: ['paid', 'partial'] } },
      group: ['month_year'],
      order: [['month_year', 'ASC']],
      raw: true,
    }),
    db.Expense.findAll({
      attributes: ['category', 'expense_date', 'amount'],
      where: {
        hostel_id: hostelId,
        expense_date: { [Op.gte]: dayjs().subtract(24, 'month').startOf('month').format('YYYY-MM-DD') },
      },
      raw: true,
    }).then((rows) => {
      const map = new Map();
      (rows || []).forEach((row) => {
        const month_year = row.expense_date ? dayjs(row.expense_date).format('YYYY-MM') : null;
        if (!month_year) return;
        const category = row.category || 'other';
        const key = `${month_year}|${category}`;
        map.set(key, (map.get(key) || 0) + num(row.amount));
      });
      return [...map.entries()].map(([key, total]) => {
        const [month_year, category] = key.split('|');
        return { month_year, category, total };
      });
    }),
    db.RentPayment.findAll({
      attributes: [
        'month_year',
        [fn('SUM', col('total_amount')), 'billed'],
        [fn('SUM', col('paid_amount')), 'collected'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { hostel_id: hostelId, status: { [Op.ne]: 'cancelled' } },
      group: ['month_year'],
      order: [['month_year', 'ASC']],
      raw: true,
    }),
    db.RentPayment.findAll({
      attributes: [
        [fn('SUM', col('total_amount')), 'billed'],
        [fn('SUM', col('paid_amount')), 'collected'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: openRent,
      raw: true,
    }),
    db.RentPayment.findAll({
      attributes: [
        [fn('SUM', col('total_amount')), 'billed'],
        [fn('SUM', col('paid_amount')), 'collected'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { hostel_id: hostelId, status: 'overdue' },
      raw: true,
    }),
    db.RentPayment.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      where: openRent,
      group: ['status'],
      raw: true,
    }),
    db.Room.sum('rent', { where: { hostel_id: hostelId, status: 'vacant' } }).catch(() => 0),
    db.Tenant.count({ where: { hostel_id: hostelId, status: 'active' } }).catch(() => 0),
    db.Tenant.count({ where: { hostel_id: hostelId, move_in_date: today } }).catch(() => 0),
    db.Tenant.count({ where: { hostel_id: hostelId, move_out_date: today } }).catch(() => 0),
    db.RentPayment.findAll({
      where: openRent,
      attributes: ['id', 'total_amount', 'paid_amount', 'status', 'month_year', 'due_date'],
      include: [{
        model: db.Tenant,
        as: 'tenant',
        attributes: ['id'],
        include: [{ model: db.User, as: 'user', attributes: ['first_name', 'last_name'] }],
      }],
      order: [['due_date', 'ASC'], ['id', 'ASC']],
      limit: 8,
    }).catch(() => []),
  ]);

  const openBilled = num(openRentSums?.[0]?.billed);
  const openCollected = num(openRentSums?.[0]?.collected);
  const overdueBilled = num(overdueSums?.[0]?.billed);
  const overdueCollected = num(overdueSums?.[0]?.collected);
  const openCounts = { pending: 0, partial: 0, overdue: 0 };
  (statusCounts || []).forEach((row) => {
    if (row?.status && openCounts[row.status] != null) openCounts[row.status] = num(row.count);
  });
  const dues = (duePayments || []).map((row) => {
    const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
    const user = plain.tenant?.user || {};
    const remaining = Math.max(0, num(plain.total_amount) - num(plain.paid_amount));
    return {
      id: plain.id,
      tenantName: [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Tenant',
      hostelName: hostel.name,
      amount: remaining,
      status: plain.status,
      month_year: plain.month_year,
      due_date: plain.due_date,
    };
  }).filter((row) => row.amount > 0);

  return {
    hostelId,
    isolated: Boolean(ctx.isolated),
    occupiedRooms,
    vacantRooms,
    occupiedBeds,
    vacantBeds,
    occupancyRate,
    monthlyIncome: num(monthlyIncome),
    pendingRent: num(pendingRent),
    outstanding: Math.max(0, openBilled - openCollected),
    overdueAmount: Math.max(0, overdueBilled - overdueCollected),
    overdueCount: openCounts.overdue,
    pendingCount: openCounts.pending,
    partialCount: openCounts.partial,
    vacancyLoss: num(vacancyLoss),
    activeTenants: num(activeTenants),
    checkInsToday: num(checkInsToday),
    checkOutsToday: num(checkOutsToday),
    openComplaints,
    openMaintenance,
    visitorsToday,
    incomeRows: incomeRows || [],
    billedRows: (billedRows || []).map((row) => ({
      month_year: row.month_year,
      billed: num(row.billed),
      collected: num(row.collected),
      count: num(row.count),
    })),
    expenseRows: expenseRows || [],
    dues,
  };
};

const persistSnapshot = async (stats) => {
  if (!stats) return null;
  const { OccupancySnapshot } = require('../models');
  await OccupancySnapshot.upsert({
    hostel_id: stats.hostelId,
    occupied_rooms: stats.occupiedRooms,
    vacant_rooms: stats.vacantRooms,
    occupied_beds: stats.occupiedBeds,
    vacant_beds: stats.vacantBeds,
    occupancy_rate: stats.occupancyRate,
    pending_rent: stats.pendingRent,
    monthly_income: stats.monthlyIncome,
    open_complaints: stats.openComplaints,
    open_maintenance: stats.openMaintenance,
    visitors_today: stats.visitorsToday,
    computed_at: new Date(),
  });
  require('./listingProjection').scheduleListingRefresh(stats.hostelId);
  require('./occupancyService').scheduleAvailabilityRefresh(stats.hostelId);
  return stats;
};

const snapshotToStats = (row) => {
  if (!row) return null;
  return {
    hostelId: row.hostel_id,
    isolated: false,
    occupiedRooms: num(row.occupied_rooms),
    vacantRooms: num(row.vacant_rooms),
    occupiedBeds: num(row.occupied_beds),
    vacantBeds: num(row.vacant_beds),
    occupancyRate: num(row.occupancy_rate),
    monthlyIncome: num(row.monthly_income),
    pendingRent: num(row.pending_rent),
    outstanding: num(row.pending_rent),
    overdueAmount: 0,
    overdueCount: 0,
    pendingCount: 0,
    partialCount: 0,
    vacancyLoss: 0,
    activeTenants: 0,
    checkInsToday: 0,
    checkOutsToday: 0,
    openComplaints: num(row.open_complaints),
    openMaintenance: num(row.open_maintenance),
    visitorsToday: num(row.visitors_today),
    incomeRows: [],
    billedRows: [],
    expenseRows: [],
    dues: [],
  };
};

const refreshOccupancySnapshot = async (hostelOrId) => {
  const stats = await computeHostelStats(hostelOrId);
  await persistSnapshot(stats);
  return stats;
};

const loadHostelStats = async (hostel) => {
  try {
    return await refreshOccupancySnapshot(hostel);
  } catch (err) {
    logger.warn(`Occupancy live read failed for hostel ${hostel.id}: ${err.message}`);
    const { OccupancySnapshot } = require('../models');
    const row = await OccupancySnapshot.findOne({ where: { hostel_id: hostel.id } });
    return snapshotToStats(row);
  }
};

const scheduleOccupancyRefresh = (hostelId) => {
  if (!hostelId) return;
  setImmediate(() => {
    refreshOccupancySnapshot(hostelId).catch((err) => {
      logger.warn(`Occupancy snapshot refresh skipped for hostel ${hostelId}: ${err.message}`);
    });
  });
};

module.exports = {
  computeHostelStats,
  refreshOccupancySnapshot,
  loadHostelStats,
  scheduleOccupancyRefresh,
  snapshotToStats,
};
