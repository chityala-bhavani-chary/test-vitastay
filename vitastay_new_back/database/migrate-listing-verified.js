/**
 * BIC-039 — Super Admin “Vita Stay verified” timestamp. Additive.
 */
require('dotenv').config();
const { sequelize } = require('../models');
const { DataTypes } = require('sequelize');

const ensureListingVerifiedSchema = async (db = sequelize, log = console.log) => {
  const qi = db.getQueryInterface();
  const add = async (table, name, definition) => {
    let cols;
    try {
      cols = await qi.describeTable(table);
    } catch {
      log(`${table} missing — skip ${name}`);
      return;
    }
    if (cols[name]) {
      log(`Skip (exists): ${table}.${name}`);
      return;
    }
    await qi.addColumn(table, name, definition);
    log(`Added ${table}.${name}`);
  };

  await add('hostels', 'verified_at', { type: DataTypes.DATE, allowNull: true });
  await add('hostels', 'verified_by', { type: DataTypes.INTEGER.UNSIGNED, allowNull: true });
  await add('listing_projections', 'vita_verified', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureListingVerifiedSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureListingVerifiedSchema };
