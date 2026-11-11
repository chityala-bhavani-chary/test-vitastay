require('dotenv').config();
const masterDb = require('../models');
const { getHostelConnection } = require('../services/hostelDatabase');

const STATEMENTS = [
  'ALTER TABLE rooms ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER description',
  'ALTER TABLE rooms ADD COLUMN deactivated_at DATETIME NULL AFTER is_active',
  'ALTER TABLE rooms ADD COLUMN deactivation_reason VARCHAR(255) NULL AFTER deactivated_at',
  'ALTER TABLE rooms ADD COLUMN deactivated_by INT UNSIGNED NULL AFTER deactivation_reason',
];

const migrate = async (sequelize, label) => {
  for (const sql of STATEMENTS) {
    try {
      await sequelize.query(sql);
      console.log(`[${label}] OK: ${sql.slice(23, 70)}`);
    } catch (err) {
      if (String(err.message).includes('Duplicate column')) {
        console.log(`[${label}] exists: ${sql.slice(23, 70)}`);
      } else if (String(err.message).includes("doesn't exist")) {
        console.log(`[${label}] no rooms table, skipped`);
        return;
      } else {
        throw err;
      }
    }
  }
};

(async () => {
  try {
    await masterDb.sequelize.authenticate();
    await migrate(masterDb.sequelize, 'master');

    const hostels = await masterDb.Hostel.findAll({ attributes: ['id', 'name', 'database_name'] });
    const databases = [...new Set(hostels.map((h) => h.database_name).filter(Boolean))];
    for (const databaseName of databases) {
      try {
        const conn = await getHostelConnection(databaseName);
        await migrate(conn.sequelize, databaseName);
      } catch (err) {
        console.warn(`[${databaseName}] skipped: ${err.message}`);
      }
    }
    console.log('Room active/inactive migration done');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
