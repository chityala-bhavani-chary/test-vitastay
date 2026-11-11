/**
 * DEC-06 — listing_projections.has_360 for search/listing “No 360 yet” badge.
 * Publish no longer requires a panorama; checklist still recommends ≥1.
 */
require('dotenv').config();
const { DataTypes } = require('sequelize');

const COLUMNS = {
  has_360: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
};

const addIfMissing = async (qi, table, column, definition, log) => {
  let cols;
  try {
    cols = await qi.describeTable(table);
  } catch {
    log(`${table} missing — skip ${column}`);
    return;
  }
  if (cols[column]) {
    log(`Skip (exists): ${table}.${column}`);
    return;
  }
  await qi.addColumn(table, column, definition);
  log(`Added ${table}.${column}`);
};

const ensureOptional360Schema = async (sequelize, log = console.log) => {
  const qi = sequelize.getQueryInterface();
  await addIfMissing(qi, 'listing_projections', 'has_360', COLUMNS.has_360, log);
  try {
    await sequelize.query(`
      UPDATE listing_projections lp
      SET lp.has_360 = EXISTS (
        SELECT 1 FROM property_media pm
        WHERE pm.hostel_id = lp.hostel_id
          AND pm.category = 'panorama_360'
          AND pm.deleted_at IS NULL
          AND (pm.is_published IS NULL OR pm.is_published = 1)
      )
    `);
    log('listing_projections.has_360 backfill');
  } catch (err) {
    log(`has_360 backfill skipped: ${err.message}`);
  }
};

module.exports = { ensureOptional360Schema, COLUMNS };

if (require.main === module) {
  (async () => {
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      await ensureOptional360Schema(sequelize);
      console.log('optional 360 columns ready');
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
