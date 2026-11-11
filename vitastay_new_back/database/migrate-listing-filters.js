/**
 * BIC-026 — first-class listing filter flags + room attached bath.
 * Additive. Master + branch rooms column.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const ensureListingFilterSchema = async (db = sequelize, log = console.log) => {
  const qi = db.getQueryInterface();

  let rooms;
  try {
    rooms = await qi.describeTable('rooms');
  } catch {
    log('rooms missing — skip has_attached_bath');
    rooms = null;
  }
  if (rooms && !rooms.has_attached_bath) {
    await qi.addColumn('rooms', 'has_attached_bath', {
      type: require('sequelize').DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    log('Added rooms.has_attached_bath');
  } else if (rooms) {
    log('Skip (exists): rooms.has_attached_bath');
  }

  let cols;
  try {
    cols = await qi.describeTable('listing_projections');
  } catch {
    log('listing_projections missing — skip filter flags');
    return;
  }

  const flags = [
    ['has_food', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['has_ac', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['has_attached_bath', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ];
  for (const [name, ddl] of flags) {
    if (!cols[name]) {
      await db.query(`ALTER TABLE listing_projections ADD COLUMN ${name} ${ddl}`);
      log(`Added listing_projections.${name}`);
    } else {
      log(`Skip (exists): listing_projections.${name}`);
    }
  }

  const [idxRows] = await db.query("SHOW INDEX FROM listing_projections WHERE Key_name = 'idx_listing_filter_essentials'");
  if (!idxRows.length) {
    await db.query(
      'CREATE INDEX idx_listing_filter_essentials ON listing_projections (is_public, has_food, has_ac, has_attached_bath, gender_policy)'
    );
    log('Added idx_listing_filter_essentials');
  } else {
    log('Skip (exists): idx_listing_filter_essentials');
  }
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureListingFilterSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureListingFilterSchema };
