require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    try {
      await sequelize.query(`
        ALTER TABLE hostels
        ADD COLUMN notice_period_months INT DEFAULT 1 AFTER security_deposit
      `);
      console.log('Added notice_period_months');
    } catch (err) {
      if (String(err.message).includes('Duplicate column')) {
        console.log('notice_period_months already exists');
      } else {
        throw err;
      }
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
