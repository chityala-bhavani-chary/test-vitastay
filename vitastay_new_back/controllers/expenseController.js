const { Expense, Hostel } = require('../models');
const createCrudController = require('../utils/crudController');
const { FinanceTransaction } = require('../models');
const dayjs = require('dayjs');

const base = createCrudController(Expense, {
  includes: [{ model: Hostel, as: 'hostel', attributes: ['id', 'name'] }],
  searchFields: ['description', 'vendor'],
  sortFields: ['expense_date', 'amount', 'created_at'],
  filterBuilder: (req) => {
    const where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.category) where.category = req.query.category;
    return where;
  },
  beforeCreate: async (req) => ({
    ...req.body,
    created_by: req.user.id,
    bill_path: req.file ? `/uploads/expenses/${req.file.filename}` : null,
  }),
});

exports.getAll = base.getAll;
exports.getById = base.getById;
exports.remove = base.remove;

exports.create = async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      created_by: req.user.id,
      bill_path: req.file ? `/uploads/expenses/${req.file.filename}` : null,
    };
    const expense = await Expense.create(data);
    await FinanceTransaction.create({
      hostel_id: expense.hostel_id,
      type: 'expense',
      category: expense.category,
      amount: expense.amount,
      reference_id: expense.id,
      reference_type: 'expense',
      transaction_date: expense.expense_date,
      description: expense.description,
      created_by: req.user.id,
    });
    const { created } = require('../utils/response');
    return created(res, expense);
  } catch (err) {
    next(err);
  }
};

exports.update = base.update;
