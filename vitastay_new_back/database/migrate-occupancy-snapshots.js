/**
 * Master-only projection of per-hostel occupancy. Additive. Never sequelize.sync({ force: true }).
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE = `
CREATE TABLE IF NOT EXISTS occupancy_snapshots (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  occupied_rooms INT UNSIGNED DEFAULT 0,
  vacant_rooms INT UNSIGNED DEFAULT 0,
  occupied_beds INT UNSIGNED DEFAULT 0,
  vacant_beds INT UNSIGNED DEFAULT 0,
  occupancy_rate INT UNSIGNED DEFAULT 0,
  pending_rent DECIMAL(12, 2) DEFAULT 0,
  monthly_income DECIMAL(12, 2) DEFAULT 0,
  open_complaints INT UNSIGNED DEFAULT 0,
  open_maintenance INT UNSIGNED DEFAULT 0,
  visitors_today INT UNSIGNED DEFAULT 0,
  computed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_occupancy_snapshots_hostel (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureOccupancySnapshotTable = async (db = sequelize, log = console.log) => {
  await db.query(CREATE);
  log('occupancy_snapshots ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureOccupancySnapshotTable();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureOccupancySnapshotTable };
