/**
 * BIC-036 — Hindi listing description (+ optional name). Additive.
 */
require('dotenv').config();
const { sequelize } = require('../models');
const { DataTypes } = require('sequelize');

const ensureListingI18nSchema = async (db = sequelize, log = console.log) => {
  const qi = db.getQueryInterface();
  let cols;
  try {
    cols = await qi.describeTable('hostels');
  } catch {
    log('hostels missing — skip listing i18n');
    return;
  }

  if (!cols.description_hi) {
    await qi.addColumn('hostels', 'description_hi', { type: DataTypes.TEXT, allowNull: true });
    log('Added hostels.description_hi');
  } else {
    log('Skip (exists): hostels.description_hi');
  }

  if (!cols.name_hi) {
    await qi.addColumn('hostels', 'name_hi', { type: DataTypes.STRING(255), allowNull: true });
    log('Added hostels.name_hi');
  } else {
    log('Skip (exists): hostels.name_hi');
  }
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureListingI18nSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureListingI18nSchema };
