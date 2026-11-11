/**
 * BIC-029 — physical / video visit slots. Master DB. Does not hold beds.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE_SLOTS = `
CREATE TABLE IF NOT EXISTS listing_visit_slots (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  visit_mode ENUM('physical','video') NOT NULL DEFAULT 'physical',
  video_url VARCHAR(500) NULL,
  capacity INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('open','cancelled') NOT NULL DEFAULT 'open',
  created_by INT UNSIGNED NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_visit_slots_hostel_starts (hostel_id, starts_at),
  INDEX idx_visit_slots_status (status, starts_at),
  CONSTRAINT fk_visit_slots_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const CREATE_VISITS = `
CREATE TABLE IF NOT EXISTS listing_visits (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  slot_id INT UNSIGNED NOT NULL,
  seeker_id INT UNSIGNED NOT NULL,
  visit_mode ENUM('physical','video') NOT NULL DEFAULT 'physical',
  status ENUM('requested','confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'requested',
  video_url VARCHAR(500) NULL,
  seeker_note VARCHAR(500) NULL,
  owner_note VARCHAR(500) NULL,
  decided_at DATETIME NULL,
  decided_by INT UNSIGNED NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_visit_seeker_slot (seeker_id, slot_id),
  INDEX idx_visits_hostel_status (hostel_id, status),
  INDEX idx_visits_seeker (seeker_id, status),
  INDEX idx_visits_slot (slot_id, status),
  CONSTRAINT fk_visits_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_visits_slot FOREIGN KEY (slot_id) REFERENCES listing_visit_slots(id) ON DELETE CASCADE,
  CONSTRAINT fk_visits_seeker FOREIGN KEY (seeker_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureVisitsSchema = async (db = sequelize, log = console.log) => {
  await db.query(CREATE_SLOTS);
  await db.query(CREATE_VISITS);
  log('listing_visit_slots + listing_visits ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureVisitsSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureVisitsSchema };
