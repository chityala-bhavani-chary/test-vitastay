/**
 * BIC-022 — seeker saved / wishlist PGs. Master DB only. Additive.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE_WISHLISTS = `
CREATE TABLE IF NOT EXISTS wishlists (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  hostel_id INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wishlists_user_hostel (user_id, hostel_id),
  INDEX idx_wishlists_user (user_id, created_at),
  INDEX idx_wishlists_hostel (hostel_id),
  CONSTRAINT fk_wishlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlists_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureWishlistsTable = async (db = sequelize, log = console.log) => {
  await db.query(CREATE_WISHLISTS);
  log('wishlists ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureWishlistsTable();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureWishlistsTable };
