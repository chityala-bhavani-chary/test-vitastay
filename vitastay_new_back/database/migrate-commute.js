/**
 * BIC-025 — commute cache + seeker saved office/college. Additive. Master DB only.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE_CACHE = `
CREATE TABLE IF NOT EXISTS commute_cache (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cache_key CHAR(64) NOT NULL,
  origin_label VARCHAR(255) NULL,
  origin_lat DECIMAL(10, 7) NOT NULL,
  origin_lng DECIMAL(10, 7) NOT NULL,
  hostel_id INT UNSIGNED NOT NULL,
  mode VARCHAR(16) NOT NULL DEFAULT 'driving',
  status ENUM('ok', 'unavailable') NOT NULL,
  duration_seconds INT UNSIGNED NULL,
  distance_meters INT UNSIGNED NULL,
  duration_text VARCHAR(64) NULL,
  distance_text VARCHAR(64) NULL,
  message VARCHAR(255) NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'google',
  fetched_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_commute_cache_key (cache_key),
  INDEX idx_commute_cache_hostel (hostel_id),
  INDEX idx_commute_cache_fetched (fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const CREATE_OFFICE = `
CREATE TABLE IF NOT EXISTS seeker_commute_places (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  address VARCHAR(500) NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_seeker_commute_user (user_id),
  CONSTRAINT fk_seeker_commute_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureCommuteSchema = async (db = sequelize, log = console.log) => {
  await db.query(CREATE_CACHE);
  await db.query(CREATE_OFFICE);
  log('commute_cache + seeker_commute_places ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureCommuteSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureCommuteSchema };
