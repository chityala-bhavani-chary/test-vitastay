/**
 * Master listing_availability — per room-type vacancy for search (AD-03 / BKG-005).
 * Additive. Isolated vitastay_* DBs are not touched.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE = `
CREATE TABLE IF NOT EXISTS listing_availability (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  room_type VARCHAR(32) NOT NULL,
  beds_available INT UNSIGNED NOT NULL DEFAULT 0,
  beds_reserved INT UNSIGNED NOT NULL DEFAULT 0,
  beds_total INT UNSIGNED NOT NULL DEFAULT 0,
  monthly_rent_from DECIMAL(10, 2) NULL,
  is_ac TINYINT(1) NOT NULL DEFAULT 0,
  refreshed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_listing_availability_hostel_type (hostel_id, room_type),
  KEY idx_listing_availability_type_vacant (room_type, beds_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureListingAvailabilityTable = async (db = sequelize, log = console.log) => {
  await db.query(CREATE);
  log('listing_availability ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureListingAvailabilityTable();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureListingAvailabilityTable };
