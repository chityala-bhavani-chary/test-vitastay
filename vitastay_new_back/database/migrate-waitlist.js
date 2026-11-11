/**
 * BIC-028 — waitlist / notify me when a bed opens. Master DB only. Additive.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE = `
CREATE TABLE IF NOT EXISTS listing_waitlist (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  hostel_id INT UNSIGNED NOT NULL,
  room_type VARCHAR(32) NOT NULL,
  notify_email TINYINT(1) NOT NULL DEFAULT 1,
  notify_whatsapp TINYINT(1) NOT NULL DEFAULT 0,
  phone VARCHAR(20) NULL,
  status ENUM('active','notified','cancelled','expired') NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  notified_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_waitlist_user_hostel_type (user_id, hostel_id, room_type),
  INDEX idx_waitlist_hostel_type_status (hostel_id, room_type, status),
  INDEX idx_waitlist_expires (status, expires_at),
  CONSTRAINT fk_waitlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_waitlist_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureWaitlistTable = async (db = sequelize, log = console.log) => {
  await db.query(CREATE);
  log('listing_waitlist ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureWaitlistTable();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureWaitlistTable };
