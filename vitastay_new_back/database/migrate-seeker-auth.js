/**
 * BKG-001 — seeker role + phone OTP column.
 * Additive. Does not sequelize.sync({ force: true }). Does not create tenants rows.
 */
require('dotenv').config();

const ROLE_ENUM = "ENUM('super_admin','owner','supervisor','tenant','staff','seeker')";
const OTP_ENUM = "ENUM('password_reset','email_verify','login','phone_verify')";

const columnType = async (sequelize, table, column) => {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return String(rows[0]?.COLUMN_TYPE || rows[0]?.column_type || '');
};

const ensureSeekerAuthSchema = async (sequelize, log = console.log) => {
  const qi = sequelize.getQueryInterface();

  const userRole = await columnType(sequelize, 'users', 'role');
  if (userRole && !userRole.includes('seeker')) {
    await sequelize.query(
      `ALTER TABLE users MODIFY COLUMN role ${ROLE_ENUM} NOT NULL DEFAULT 'tenant'`
    );
    log('Updated users.role enum with seeker');
  } else {
    log('Skip (exists): users.role seeker');
  }

  try {
    const permRole = await columnType(sequelize, 'role_permissions', 'role');
    if (permRole && !permRole.includes('seeker')) {
      await sequelize.query(
        `ALTER TABLE role_permissions MODIFY COLUMN role ${ROLE_ENUM} NOT NULL`
      );
      log('Updated role_permissions.role enum with seeker');
    }
  } catch (err) {
    log(`role_permissions skip: ${err.message}`);
  }

  const otpType = await columnType(sequelize, 'otp_verifications', 'type');
  if (otpType && !otpType.includes('phone_verify')) {
    await sequelize.query(
      `ALTER TABLE otp_verifications MODIFY COLUMN type ${OTP_ENUM} NOT NULL`
    );
    log('Updated otp_verifications.type enum with phone_verify');
  } else {
    log('Skip (exists): otp_verifications.type phone_verify');
  }

  let otpCols;
  try {
    otpCols = await qi.describeTable('otp_verifications');
  } catch {
    log('otp_verifications missing — skip phone column');
    return;
  }
  if (!otpCols.phone) {
    await sequelize.query(
      'ALTER TABLE otp_verifications ADD COLUMN phone VARCHAR(20) NULL AFTER email'
    );
    log('Added otp_verifications.phone');
  } else {
    log('Skip (exists): otp_verifications.phone');
  }
};

module.exports = { ensureSeekerAuthSchema };

if (require.main === module) {
  (async () => {
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      await ensureSeekerAuthSchema(sequelize);
      await sequelize.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
