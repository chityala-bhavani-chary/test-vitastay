require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User } = require('../models');
const { DEFAULT_HOSTEL_FEATURES } = require('../constants/hostelFeatures');

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'info@vitasystems.ai';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Vita@2025';

const migrate = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    await sequelize.query(`
      ALTER TABLE users
      MODIFY COLUMN role ENUM('super_admin', 'owner', 'supervisor', 'tenant', 'staff', 'seeker')
      NOT NULL DEFAULT 'tenant'
    `);
    console.log('Updated users.role enum');

    try {
      await sequelize.query(`
        ALTER TABLE role_permissions
        MODIFY COLUMN role ENUM('super_admin', 'owner', 'supervisor', 'tenant', 'staff', 'seeker') NOT NULL
      `);
      console.log('Updated role_permissions.role enum');
    } catch (err) {
      console.log('role_permissions skip:', err.message);
    }

    try {
      await sequelize.query(`
        ALTER TABLE hostels
        ADD COLUMN features JSON NULL AFTER amenities
      `);
      console.log('Added hostels.features column');
    } catch (err) {
      if (String(err.message).includes('Duplicate column')) {
        console.log('hostels.features already exists');
      } else {
        throw err;
      }
    }

    await sequelize.query(`
      ALTER TABLE hostels
      MODIFY COLUMN status ENUM('active', 'inactive', 'maintenance', 'on_hold') DEFAULT 'active'
    `);
    console.log('Updated hostels.status enum');

    const featuresJson = JSON.stringify(DEFAULT_HOSTEL_FEATURES).replace(/'/g, "\\'");
    await sequelize.query(`
      UPDATE hostels
      SET features = '${featuresJson}'
      WHERE features IS NULL
    `);
    console.log('Backfilled hostel features');

    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
    const [existing] = await sequelize.query(
      `SELECT id FROM users WHERE email = :email LIMIT 1`,
      { replacements: { email: SUPER_ADMIN_EMAIL } }
    );

    if (existing.length) {
      await sequelize.query(
        `UPDATE users SET
          password = :password,
          role = 'super_admin',
          first_name = 'Vita',
          last_name = 'Systems',
          email_verified = 1,
          is_active = 1,
          is_locked = 0
         WHERE email = :email`,
        { replacements: { email: SUPER_ADMIN_EMAIL, password: passwordHash } }
      );
      console.log(`Updated Super Admin: ${SUPER_ADMIN_EMAIL}`);
    } else {
      await User.create({
        email: SUPER_ADMIN_EMAIL,
        password: passwordHash,
        role: 'super_admin',
        first_name: 'Vita',
        last_name: 'Systems',
        phone: null,
        email_verified: true,
        is_active: true,
      });
      console.log(`Created Super Admin: ${SUPER_ADMIN_EMAIL}`);
    }

    console.log('\n--- Super Admin Credentials ---');
    console.log(`Email:    ${SUPER_ADMIN_EMAIL}`);
    console.log(`Password: ${SUPER_ADMIN_PASSWORD}`);
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
