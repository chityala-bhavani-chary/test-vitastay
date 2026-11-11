const { Staff, User, Hostel, StaffAttendance, StaffLeave } = require('../models');
const createCrudController = require('../utils/crudController');
const { success, created, error } = require('../utils/response');
const { passwordFields } = require('../helpers/password');
const { getPagination, getSort } = require('../utils/pagination');
const { paginated } = require('../utils/response');

const base = createCrudController(Staff, {
  includes: [
    { model: User, as: 'user', attributes: { exclude: ['password'] } },
    { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
  ],
  searchFields: [],
  filterBuilder: (req) => {
    const where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.staff_role) where.staff_role = req.query.staff_role;
    if (req.query.status) where.status = req.query.status;
    return where;
  },
});

exports.getAll = base.getAll;
exports.getById = base.getById;
exports.update = base.update;
exports.remove = base.remove;

exports.create = async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, phone, ...staffData } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return error(res, 'Email already exists', 409);

    const user = await User.create({
      email,
      ...(await passwordFields(password || 'Staff@123')),
      first_name,
      last_name,
      phone,
      role: staffData.staff_role === 'reception' ? 'supervisor' : 'staff',
    });

    const staff = await Staff.create({ user_id: user.id, ...staffData });
    const result = await Staff.findByPk(staff.id, { include: ['user', 'hostel'] });
    return created(res, result, 'Staff created successfully');
  } catch (err) {
    next(err);
  }
};

exports.markAttendance = async (req, res, next) => {
  try {
    const [attendance, created_] = await StaffAttendance.findOrCreate({
      where: { staff_id: req.body.staff_id, date: req.body.date },
      defaults: { ...req.body, marked_by: req.user.id },
    });
    if (!created_) await attendance.update({ ...req.body, marked_by: req.user.id });
    return success(res, attendance, 'Attendance marked');
  } catch (err) {
    next(err);
  }
};

exports.getAttendance = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = {};
    if (req.query.date) where.date = req.query.date;
    if (req.query.staffId) where.staff_id = req.query.staffId;

    const { count, rows } = await StaffAttendance.findAndCountAll({
      where,
      include: [{ model: Staff, as: 'staff', where: req.query.hostelId ? { hostel_id: req.query.hostelId } : {}, include: ['user'] }],
      order: getSort(req.query, ['date']),
      limit,
      offset,
    });
    return paginated(res, rows, { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};

exports.requestLeave = async (req, res, next) => {
  try {
    const leave = await StaffLeave.create(req.body);
    return created(res, leave);
  } catch (err) {
    next(err);
  }
};
