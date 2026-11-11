require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.query(`
      ALTER TABLE hostels
      MODIFY COLUMN status ENUM(
        'pending_approval',
        'active',
        'inactive',
        'maintenance',
        'on_hold',
        'rejected'
      ) DEFAULT 'pending_approval'
    `);
    console.log('Hostel approval statuses ready');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
