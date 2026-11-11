require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    try {
      await sequelize.query(`
        ALTER TABLE hostels
        ADD COLUMN database_name VARCHAR(64) NULL AFTER contact_email
      `);
      console.log('Added hostels.database_name');
    } catch (err) {
      if (String(err.message).includes('Duplicate column')) {
        console.log('hostels.database_name already exists');
      } else {
        throw err;
      }
    }
    try {
      await sequelize.query(`CREATE INDEX idx_hostel_database_name ON hostels (database_name)`);
    } catch {
      // index may already exist
    }
    console.log('Migration complete');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
