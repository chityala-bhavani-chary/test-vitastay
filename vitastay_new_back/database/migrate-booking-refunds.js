/**
 * Booking refunds (BKG-013). Additive. Never sequelize.sync({ force: true }).
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE_REFUNDS = `
CREATE TABLE IF NOT EXISTS booking_refunds (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id INT UNSIGNED NOT NULL,
  hostel_id INT UNSIGNED NOT NULL,
  payment_order_id INT UNSIGNED NULL,
  provider VARCHAR(32) NOT NULL,
  gateway_payment_id VARCHAR(64) NULL,
  gateway_refund_id VARCHAR(64) NULL,
  amount DECIMAL(10, 2) NOT NULL,
  retained_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10, 2) NOT NULL,
  reason ENUM('seeker_cancel', 'owner_reject', 'walkin_override') NOT NULL,
  kind ENUM('full', 'partial') NOT NULL,
  policy_version VARCHAR(32) NOT NULL,
  status ENUM('pending', 'processed', 'failed') NOT NULL DEFAULT 'pending',
  payload TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_refunds_booking (booking_id),
  INDEX idx_booking_refunds_hostel (hostel_id),
  INDEX idx_booking_refunds_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureBookingRefundsTable = async (db = sequelize, log = console.log) => {
  await db.query(CREATE_REFUNDS);
  log('booking_refunds ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureBookingRefundsTable();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureBookingRefundsTable };
