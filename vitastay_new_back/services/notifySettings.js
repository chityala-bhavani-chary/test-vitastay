const { Op } = require('sequelize');

const DEFAULTS = {
  email_enabled: true,
  sms_enabled: false,
  rent_due_email: true,
  complaint_email: true,
  rent_reminder_days: 3,
  alert_email: '',
};

const asBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
};

const asNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const rowsToMap = (rows) => {
  const map = {};
  rows.forEach((row) => {
    map[row.key] = row.value;
  });
  return map;
};

const getNotificationSettings = async (hostelId) => {
  const { Setting } = require('../models');
  const globalRows = await Setting.findAll({
    where: { group: 'notifications', hostel_id: { [Op.is]: null } },
  });
  let hostelRows = [];
  if (hostelId) {
    hostelRows = await Setting.findAll({
      where: { group: 'notifications', hostel_id: hostelId },
    });
  }
  const raw = { ...rowsToMap(globalRows), ...rowsToMap(hostelRows) };
  return {
    email_enabled: asBool(raw.email_enabled, DEFAULTS.email_enabled),
    sms_enabled: asBool(raw.sms_enabled, DEFAULTS.sms_enabled),
    rent_due_email: asBool(raw.rent_due_email, DEFAULTS.rent_due_email),
    complaint_email: asBool(raw.complaint_email, DEFAULTS.complaint_email),
    rent_reminder_days: Math.max(0, asNumber(raw.rent_reminder_days, DEFAULTS.rent_reminder_days)),
    alert_email: String(raw.alert_email || DEFAULTS.alert_email).trim(),
  };
};

module.exports = { DEFAULTS, asBool, asNumber, getNotificationSettings };
