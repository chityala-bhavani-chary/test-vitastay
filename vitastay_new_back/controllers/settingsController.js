const { Setting, Notification, User, SupervisorHostel } = require('../models');
const { success, error } = require('../utils/response');
const { passwordFields } = require('../helpers/password');
const { getPagination } = require('../utils/pagination');
const { paginated } = require('../utils/response');

exports.getSettings = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.group) where.group = req.query.group;
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    else where.hostel_id = null;

    const settings = await Setting.findAll({ where });
    const settingsMap = settings.reduce((acc, s) => {
      if (!acc[s.group]) acc[s.group] = {};
      acc[s.group][s.key] = s.value;
      return acc;
    }, {});
    const { isConfigured: smsConfigured } = require('../services/smsService');
    const config = require('../config');
    settingsMap.delivery = {
      smtp_configured: Boolean(config.smtp.host),
      sms_available: smsConfigured(),
    };
    return success(res, settingsMap);
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const { group, settings, hostelId } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await Setting.upsert({
        hostel_id: hostelId || null,
        group,
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
      });
    }
    return success(res, null, 'Settings updated');
  } catch (err) {
    next(err);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = { user_id: req.user.id };
    if (req.query.unreadOnly === 'true') where.is_read = false;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    return paginated(res, rows, { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: { id: req.params.id, user_id: req.user.id } }
    );
    return success(res, null, 'Marked as read');
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: { user_id: req.user.id, is_read: false } }
    );
    return success(res, null, 'All marked as read');
  } catch (err) {
    next(err);
  }
};

exports.sendTestReminder = async (req, res, next) => {
  try {
    const { sendTestRentReminder } = require('../services/notifyService');
    const result = await sendTestRentReminder(req.user);
    const message = result.smtp_configured
      ? `Test rent reminder queued to ${result.to}`
      : `Queued a test to ${result.to}, but SMTP is not configured so it will not leave the server`;
    return success(res, result, message);
  } catch (err) {
    next(err);
  }
};

exports.createSupervisor = async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, phone, hostelIds } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return error(res, 'Email already exists', 409);

    const user = await User.create({
      email,
      ...(await passwordFields(password)),
      first_name,
      last_name,
      phone,
      role: 'supervisor',
    });

    if (hostelIds?.length) {
      await SupervisorHostel.bulkCreate(
        hostelIds.map((hostel_id) => ({ supervisor_id: user.id, hostel_id }))
      );
    }

    const safe = user.toJSON();
    delete safe.password;
    return success(res, safe, 'Supervisor created', 201);
  } catch (err) {
    next(err);
  }
};

exports.lockUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    await user.update({ is_locked: req.body.is_locked });
    const safe = user.toJSON();
    delete safe.password;
    return success(res, safe, user.is_locked ? 'Account locked' : 'Account unlocked');
  } catch (err) {
    next(err);
  }
};

exports.resetUserPassword = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    await user.update({
      ...(await passwordFields(req.body.newPassword)),
      password_changed_at: new Date(),
    });
    return success(res, null, 'Password reset successfully');
  } catch (err) {
    next(err);
  }
};
