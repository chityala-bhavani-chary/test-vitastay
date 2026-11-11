/**
 * Master bookings table (BKG-006). Not isolated vitastay_* DBs.
 * Additive. Does not occupy beds (that is BKG-009 / occupancyService.occupyBed).
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE = `
CREATE TABLE IF NOT EXISTS bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  seeker_user_id INT UNSIGNED NOT NULL,
  hostel_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED NULL,
  bed_id INT UNSIGNED NULL,
  room_type VARCHAR(32) NULL,
  move_in_date DATE NOT NULL,
  stay_type ENUM('monthly','daily') NOT NULL DEFAULT 'monthly',
  status ENUM('requested','held','awaiting_approval','confirmed','rejected','cancelled','expired') NOT NULL DEFAULT 'requested',
  hold_expires_at DATETIME NULL,
  amount_due DECIMAL(10, 2) NULL,
  deposit_due DECIMAL(10, 2) NULL,
  payment_status ENUM('none','pending','paid','failed','refunded') NOT NULL DEFAULT 'none',
  gateway_order_id VARCHAR(64) NULL,
  erp_tenant_id INT UNSIGNED NULL,
  cancel_reason VARCHAR(500) NULL,
  reject_reason VARCHAR(500) NULL,
  decided_by INT UNSIGNED NULL,
  decided_at DATETIME NULL,
  listing_name VARCHAR(255) NULL,
  listing_code VARCHAR(50) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bookings_code (code),
  KEY idx_bookings_seeker (seeker_user_id, status),
  KEY idx_bookings_hostel (hostel_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureBookingsTable = async (db = sequelize, log = console.log) => {
  await db.query(CREATE);
  log('bookings ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureBookingsTable();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureBookingsTable };
