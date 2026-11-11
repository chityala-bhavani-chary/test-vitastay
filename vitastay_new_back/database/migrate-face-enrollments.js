/**
 * PKG-010 — Gold Vita Eye gallery. Additive. Never sequelize.sync({ force: true }).
 * Embeddings are ciphertext. Table is hostel-scoped (no platform-wide face graph).
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE = `
CREATE TABLE IF NOT EXISTS face_enrollments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  person_type ENUM('resident', 'staff') NOT NULL,
  person_id INT UNSIGNED NOT NULL,
  embedding_cipher TEXT NOT NULL,
  consent_at DATETIME NOT NULL,
  still_path VARCHAR(500) NULL,
  enrolled_by INT UNSIGNED NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_face_enroll_person (hostel_id, person_type, person_id),
  INDEX idx_face_enroll_hostel (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureFaceEnrollmentSchema = async (db = sequelize, log = console.log) => {
  await db.query(CREATE);
  log('face_enrollments ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureFaceEnrollmentSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureFaceEnrollmentSchema };
