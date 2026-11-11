require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    try {
      await sequelize.query(`
        ALTER TABLE hostels
        ADD COLUMN logo VARCHAR(255) NULL AFTER images
      `);
      console.log('Added hostels.logo');
    } catch (err) {
      if (String(err.message).includes('Duplicate column')) {
        console.log('hostels.logo already exists');
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
