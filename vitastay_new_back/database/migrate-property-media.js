/**
 * Adds property_media for categorised PG photos and 360° panoramas.
 * Master DB only — rooms may live in isolated hostel DBs, so room_id is not a FK
 * and room_number is stored for listing cards.
 * Does not drop hostels.images / rooms.images (copied by database/migrate-legacy-media.js).
 * Does not use sequelize.sync({ force: true }).
 */
require('dotenv').config();

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS property_media (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  category ENUM('exterior','interior_common','room','floor','panorama_360') NOT NULL,
  capture_kind ENUM('photo','panorama_360') NOT NULL DEFAULT 'photo',
  room_id INT UNSIGNED NULL,
  room_number VARCHAR(20) NULL,
  floor_number INT NULL,
  title VARCHAR(150) NULL,
  caption VARCHAR(200) NULL,
  file_path VARCHAR(500) NOT NULL,
  thumb_path VARCHAR(500) NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by INT UNSIGNED NOT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cover_flag TINYINT UNSIGNED GENERATED ALWAYS AS (
    IF(is_cover = 1 AND deleted_at IS NULL, 1, NULL)
  ) VIRTUAL,
  INDEX idx_media_hostel_cat (hostel_id, category, deleted_at),
  INDEX idx_media_room (room_id),
  UNIQUE KEY uk_property_media_one_cover (hostel_id, cover_flag),
  UNIQUE KEY uk_property_media_hostel_path (hostel_id, file_path),
  CONSTRAINT fk_media_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  CONSTRAINT chk_property_media_room CHECK (category <> 'room' OR room_id IS NOT NULL),
  CONSTRAINT chk_property_media_floor CHECK (category <> 'floor' OR floor_number IS NOT NULL),
  CONSTRAINT chk_property_media_360 CHECK (category <> 'panorama_360' OR capture_kind = 'panorama_360')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const skippable = (err) => {
  const msg = String(err.message || '');
  return /Duplicate|already exists|Duplicate key name|Duplicate column|Duplicate foreign key/i.test(msg);
};

const runSql = async (sequelize, sql, label, log) => {
  try {
    await sequelize.query(sql);
    log(`OK: ${label}`);
  } catch (err) {
    if (skippable(err)) {
      log(`Skip (exists): ${label}`);
    } else {
      throw err;
    }
  }
};

const columnExists = async (sequelize, column) => {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'property_media' AND column_name = ?`,
    { replacements: [column] }
  );
  return Number(rows[0].c) > 0;
};

const constraintExists = async (sequelize, name) => {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.table_constraints
     WHERE table_schema = DATABASE() AND table_name = 'property_media' AND constraint_name = ?`,
    { replacements: [name] }
  );
  return Number(rows[0].c) > 0;
};

const patchExistingTable = async (sequelize, log) => {
  if (!(await columnExists(sequelize, 'room_number'))) {
    await runSql(
      sequelize,
      'ALTER TABLE property_media ADD COLUMN room_number VARCHAR(20) NULL AFTER room_id',
      'column room_number',
      log
    );
  } else {
    log('Skip (exists): column room_number');
  }

  if (!(await columnExists(sequelize, 'cover_flag'))) {
    await runSql(
      sequelize,
      `ALTER TABLE property_media ADD COLUMN cover_flag TINYINT UNSIGNED GENERATED ALWAYS AS (
         IF(is_cover = 1 AND deleted_at IS NULL, 1, NULL)
       ) VIRTUAL`,
      'generated column cover_flag',
      log
    );
  } else {
    log('Skip (exists): generated column cover_flag');
  }

  if (!(await constraintExists(sequelize, 'uk_property_media_one_cover'))) {
    await runSql(
      sequelize,
      'ALTER TABLE property_media ADD UNIQUE KEY uk_property_media_one_cover (hostel_id, cover_flag)',
      'unique one cover per hostel',
      log
    );
  } else {
    log('Skip (exists): unique one cover per hostel');
  }

  if (!(await constraintExists(sequelize, 'uk_property_media_hostel_path'))) {
    await runSql(
      sequelize,
      'ALTER TABLE property_media ADD UNIQUE KEY uk_property_media_hostel_path (hostel_id, file_path)',
      'unique hostel+file_path',
      log
    );
  } else {
    log('Skip (exists): unique hostel+file_path');
  }

  const [fkRows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE() AND table_name = 'property_media'
       AND column_name = 'hostel_id' AND referenced_table_name IS NOT NULL`
  );
  if (Number(fkRows[0].c) === 0) {
    await runSql(
      sequelize,
      'ALTER TABLE property_media ADD CONSTRAINT fk_media_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id)',
      'fk_media_hostel',
      log
    );
  } else {
    log('Skip (exists): fk_media_hostel');
  }

  const checks = [
    ['chk_property_media_room', "category <> 'room' OR room_id IS NOT NULL"],
    ['chk_property_media_floor', "category <> 'floor' OR floor_number IS NOT NULL"],
    ['chk_property_media_360', "category <> 'panorama_360' OR capture_kind = 'panorama_360'"],
  ];
  for (const [name, expr] of checks) {
    if (!(await constraintExists(sequelize, name))) {
      await runSql(
        sequelize,
        `ALTER TABLE property_media ADD CONSTRAINT ${name} CHECK (${expr})`,
        name,
        log
      );
    } else {
      log(`Skip (exists): ${name}`);
    }
  }
};

const ensurePropertyMediaTable = async (sequelize, log = console.log) => {
  const [tables] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'property_media'`
  );
  const exists = Number(tables[0].c) > 0;

  if (!exists) {
    await sequelize.query(CREATE_SQL);
    log('Created property_media');
    return;
  }

  log('property_media already exists — patching constraints');
  await patchExistingTable(sequelize, log);
};

module.exports = { ensurePropertyMediaTable };

if (require.main === module) {
  (async () => {
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      console.log('Connected (master)');
      await ensurePropertyMediaTable(sequelize);
      console.log('property_media migration done');
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  })();
}
