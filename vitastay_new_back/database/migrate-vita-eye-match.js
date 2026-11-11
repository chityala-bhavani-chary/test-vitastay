/**
 * PKG-011 — Gold gate capture events + blocked watchlist. Additive.
 * Never sequelize.sync({ force: true }). Hostel-scoped. No platform-wide graph.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE_WATCH = `
CREATE TABLE IF NOT EXISTS face_watchlist (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  label VARCHAR(120) NULL,
  reason VARCHAR(500) NOT NULL,
  expires_at DATETIME NULL,
  embedding_cipher TEXT NOT NULL,
  still_path VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_face_watch_hostel (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const CREATE_EVENTS = `
CREATE TABLE IF NOT EXISTS face_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  label ENUM('known_resident', 'known_staff', 'blocked', 'unknown') NOT NULL,
  confidence DECIMAL(7, 6) NOT NULL DEFAULT 0,
  threshold DECIMAL(7, 6) NOT NULL,
  match_enrollment_id INT UNSIGNED NULL,
  match_watchlist_id INT UNSIGNED NULL,
  still_path VARCHAR(500) NULL,
  gate VARCHAR(80) NULL,
  captured_by INT UNSIGNED NULL,
  acked_at DATETIME NULL,
  acked_by INT UNSIGNED NULL,
  ack_note VARCHAR(500) NULL,
  notified_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_face_events_hostel (hostel_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureVitaEyeMatchSchema = async (db = sequelize, log = console.log) => {
  await db.query(CREATE_WATCH);
  await db.query(CREATE_EVENTS);
  log('face_watchlist and face_events ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureVitaEyeMatchSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureVitaEyeMatchSchema };
