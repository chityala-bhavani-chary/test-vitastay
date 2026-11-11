/**
 * BKG-002 — master listing_projections search index + hostel gender/area.
 * Additive. Does not sequelize.sync({ force: true }). Search never fans out to vitastay_*.
 */
require('dotenv').config();
const { DataTypes } = require('sequelize');

const HOSTEL_COLUMNS = {
  area: { type: DataTypes.STRING(120), allowNull: true },
  gender_policy: {
    type: DataTypes.ENUM('male', 'female', 'unisex'),
    allowNull: false,
    defaultValue: 'unisex',
  },
};

const CREATE = `
CREATE TABLE IF NOT EXISTS listing_projections (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  code VARCHAR(50) NULL,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  area VARCHAR(120) NULL,
  state VARCHAR(100) NULL,
  amenities JSON NULL,
  occupancy_types JSON NULL,
  gender_policy ENUM('male','female','unisex') NOT NULL DEFAULT 'unisex',
  stay_modes JSON NULL,
  min_rent DECIMAL(10, 2) NULL,
  max_rent DECIMAL(10, 2) NULL,
  daily_rent DECIMAL(10, 2) NULL,
  beds_available INT UNSIGNED NOT NULL DEFAULT 0,
  rating_avg DECIMAL(3, 2) NULL,
  rating_count INT UNSIGNED NOT NULL DEFAULT 0,
  cover_url VARCHAR(500) NULL,
  cover_thumb_url VARCHAR(500) NULL,
  plan ENUM('regular','silver','gold') NOT NULL DEFAULT 'regular',
  marketplace_ok TINYINT(1) NOT NULL DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  refreshed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_listing_projections_hostel (hostel_id),
  INDEX idx_listing_public_city (is_public, city),
  INDEX idx_listing_public_rent (is_public, min_rent),
  INDEX idx_listing_market_city (marketplace_ok, is_public, city),
  INDEX idx_listing_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const ensureListingSearchSchema = async (sequelize, log = console.log) => {
  const qi = sequelize.getQueryInterface();
  let hostels;
  try {
    hostels = await qi.describeTable('hostels');
  } catch {
    log('hostels table missing — skip listing search columns');
    return;
  }

  if (!hostels.area) {
    await qi.addColumn('hostels', 'area', HOSTEL_COLUMNS.area);
    log('Added hostels.area');
  } else {
    log('Skip (exists): hostels.area');
  }
  if (!hostels.gender_policy) {
    await qi.addColumn('hostels', 'gender_policy', HOSTEL_COLUMNS.gender_policy);
    log('Added hostels.gender_policy');
  } else {
    log('Skip (exists): hostels.gender_policy');
  }

  await sequelize.query(CREATE);
  log('listing_projections ready');
  await ensureListingPlanColumns(sequelize, log);
};

const ensureListingPlanColumns = async (sequelize, log = console.log) => {
  const qi = sequelize.getQueryInterface();
  let cols;
  try {
    cols = await qi.describeTable('listing_projections');
  } catch {
    return;
  }
  if (!cols.plan) {
    await sequelize.query(
      "ALTER TABLE listing_projections ADD COLUMN plan ENUM('regular','silver','gold') NOT NULL DEFAULT 'regular' AFTER cover_thumb_url"
    );
    log('Added listing_projections.plan');
  }
  if (!cols.marketplace_ok) {
    await sequelize.query(
      'ALTER TABLE listing_projections ADD COLUMN marketplace_ok TINYINT(1) NOT NULL DEFAULT 0 AFTER plan'
    );
    log('Added listing_projections.marketplace_ok');
  }
  try {
    await sequelize.query(
      'CREATE INDEX idx_listing_market_city ON listing_projections (marketplace_ok, is_public, city)'
    );
  } catch {
    /* exists */
  }
  try {
    await sequelize.query(`
      UPDATE listing_projections lp
      INNER JOIN hostels h ON h.id = lp.hostel_id
      SET lp.plan = IFNULL(h.plan, 'regular'),
          lp.marketplace_ok = IF(
            h.plan IN ('silver', 'gold')
            AND IFNULL(h.plan_status, 'comp') IN ('comp', 'active', 'grace'),
            1, 0
          )
    `);
    await sequelize.query(`
      UPDATE listing_projections lp
      INNER JOIN hostels h ON h.id = lp.hostel_id
      SET lp.is_public = IF(
        h.listing_published = 1 AND h.status = 'active' AND lp.marketplace_ok = 1,
        1, 0
      )
    `);
    log('listing_projections marketplace_ok backfill');
  } catch (err) {
    log(`marketplace_ok backfill skipped: ${err.message}`);
  }
};

module.exports = { ensureListingSearchSchema, ensureListingPlanColumns, HOSTEL_COLUMNS };

if (require.main === module) {
  (async () => {
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      await ensureListingSearchSchema(sequelize);
      const { backfillListingProjections } = require('../services/listingProjection');
      await backfillListingProjections((msg) => console.log(msg));
      await sequelize.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
};
