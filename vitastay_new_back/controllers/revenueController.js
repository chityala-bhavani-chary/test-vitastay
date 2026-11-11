const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const { RentPayment, Tenant, Hostel, Room, User, FinanceTransaction, Expense } = require('../models');
const { success, error } = require('../utils/response');
const { getPagination, getSort } = require('../utils/pagination');

/**
 * Revenue from collected tenant rent payments + expenses for net revenue.
 */
exports.getRevenue = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = {
      paid_amount: { [Op.gt]: 0 },
      status: { [Op.in]: ['paid', 'partial'] },
    };

    let hostelScope = null;

    if (req.query.hostelId) where.hostel_id = Number(req.query.hostelId);
    if (req.query.monthYear) where.month_year = req.query.monthYear;

    if (req.query.date) {
      where.paid_date = req.query.date;
    } else if (req.query.startDate || req.query.endDate) {
      where.paid_date = {};
      if (req.query.startDate) where.paid_date[Op.gte] = req.query.startDate;
      if (req.query.endDate) where.paid_date[Op.lte] = req.query.endDate;
    }

    if (req.user.role === 'owner') {
      const owned = await Hostel.findAll({
        where: { owner_id: req.user.id },
        attributes: ['id'],
      });
      const hostelIds = owned.map((h) => h.id);
      if (hostelIds.length === 0) {
        return success(res, {
          items: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          summary: {
            totalIncome: 0,
            totalExpenditure: 0,
            netRevenue: 0,
            totalRevenue: 0,
            thisMonthRevenue: 0,
            todayRevenue: 0,
            paidInvoices: 0,
            partialInvoices: 0,
            bookingRefunds: 0,
          },
          monthly: [],
          ledger: [],
        });
      }
      if (req.query.hostelId && !hostelIds.includes(Number(req.query.hostelId))) {
        return error(res, 'Forbidden', 403);
      }
      if (!req.query.hostelId) where.hostel_id = { [Op.in]: hostelIds };
      hostelScope = req.query.hostelId ? Number(req.query.hostelId) : { [Op.in]: hostelIds };
    } else if (req.query.hostelId) {
      hostelScope = Number(req.query.hostelId);
    }

    const { count, rows } = await RentPayment.findAndCountAll({
      where,
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name', 'email', 'phone'] }] },
        { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
      ],
      order: getSort(req.query, ['paid_date', 'updated_at', 'created_at']),
      limit,
      offset,
    });

    const today = dayjs().format('YYYY-MM-DD');
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
    const monthEnd = dayjs().endOf('month').format('YYYY-MM-DD');

    const sumPaid = async (extraWhere = {}) => {
      const [row] = await RentPayment.findAll({
        where: { ...where, ...extraWhere },
        attributes: [[fn('COALESCE', fn('SUM', col('paid_amount')), 0), 'total']],
        raw: true,
      });
      return parseFloat(row?.total || 0);
    };

    const totalIncome = await sumPaid();
    const thisMonthRevenue = await sumPaid({
      paid_date: { [Op.between]: [monthStart, monthEnd] },
    });
    const todayRevenue = await sumPaid({ paid_date: today });
    const paidInvoices = await RentPayment.count({ where: { ...where, status: 'paid' } });
    const partialInvoices = await RentPayment.count({ where: { ...where, status: 'partial' } });

    // Expenses / expenditure for same hostel + date scope
    const expenseWhere = {};
    if (hostelScope) expenseWhere.hostel_id = hostelScope;
    if (req.query.date) {
      expenseWhere.expense_date = req.query.date;
    } else if (req.query.startDate || req.query.endDate) {
      expenseWhere.expense_date = {};
      if (req.query.startDate) expenseWhere.expense_date[Op.gte] = req.query.startDate;
      if (req.query.endDate) expenseWhere.expense_date[Op.lte] = req.query.endDate;
    }

    let totalExpenditure = 0;
    try {
      const [expenseRow] = await Expense.findAll({
        where: expenseWhere,
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        raw: true,
      });
      totalExpenditure = parseFloat(expenseRow?.total || 0);
    } catch {
      totalExpenditure = 0;
    }

    let bookingRefunds = 0;
    try {
      const refundWhere = { type: 'expense', category: 'booking_refund' };
      if (hostelScope) refundWhere.hostel_id = hostelScope;
      if (req.query.date) {
        refundWhere.transaction_date = req.query.date;
      } else if (req.query.startDate || req.query.endDate) {
        refundWhere.transaction_date = {};
        if (req.query.startDate) refundWhere.transaction_date[Op.gte] = req.query.startDate;
        if (req.query.endDate) refundWhere.transaction_date[Op.lte] = req.query.endDate;
      }
      const [refundRow] = await FinanceTransaction.findAll({
        where: refundWhere,
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        raw: true,
      });
      bookingRefunds = parseFloat(refundRow?.total || 0);
    } catch {
      bookingRefunds = 0;
    }
    totalExpenditure += bookingRefunds;

    const netRevenue = totalIncome - totalExpenditure;

    const monthly = await RentPayment.findAll({
      where,
      attributes: [
        'month_year',
        [fn('COALESCE', fn('SUM', col('paid_amount')), 0), 'total'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['month_year'],
      order: [['month_year', 'ASC']],
      raw: true,
    });

    let ledger = [];
    try {
      const ledgerWhere = { type: 'income', category: 'rent' };
      if (where.hostel_id) ledgerWhere.hostel_id = where.hostel_id;
      if (req.query.startDate || req.query.endDate) {
        ledgerWhere.transaction_date = {};
        if (req.query.startDate) ledgerWhere.transaction_date[Op.gte] = req.query.startDate;
        if (req.query.endDate) ledgerWhere.transaction_date[Op.lte] = req.query.endDate;
      }
      ledger = await FinanceTransaction.findAll({
        where: ledgerWhere,
        include: [{ model: Hostel, as: 'hostel', attributes: ['id', 'name'] }],
        order: [['transaction_date', 'DESC'], ['id', 'DESC']],
        limit: 50,
      });
    } catch {
      ledger = [];
    }

    return success(res, {
      items: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit) || 0,
      },
      summary: {
        totalIncome,
        totalExpenditure,
        netRevenue,
        totalRevenue: totalIncome,
        thisMonthRevenue,
        todayRevenue,
        paidInvoices,
        partialInvoices,
        bookingRefunds,
      },
      monthly: monthly.map((m) => ({
        month: m.month_year,
        total: parseFloat(m.total || 0),
        count: parseInt(m.count || 0, 10),
      })),
      ledger,
    });
  } catch (err) {
    next(err);
  }
};
