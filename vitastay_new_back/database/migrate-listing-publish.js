/**
 * Listing publish flag + Super Admin media override on master hostels.
 * Additive. Does not sequelize.sync({ force: true }).
 */
require('dotenv').config();
const { DataTypes } = require('sequelize');

const LISTING_COLUMNS = {
  listing_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  listing_published_at: { type: DataTypes.DATE, allowNull: true },
  listing_moderated_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  listing_moderated_at: { type: DataTypes.DATE, allowNull: true },
  listing_unpublish_reason: { type: DataTypes.STRING(500), allowNull: true },
  media_override_reason: { type: DataTypes.STRING(500), allowNull: true },
  media_override_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  media_override_at: { type: DataTypes.DATE, allowNull: true },
};

const ensureListingPublishColumns = async (sequelize, log = console.log) => {
  const qi = sequelize.getQueryInterface();
  let existing;
  try {
    existing = await qi.describeTable('hostels');
  } catch {
    log('hostels table missing — skip listing publish columns');
    return;
  }
  for (const [column, definition] of Object.entries(LISTING_COLUMNS)) {
    if (existing[column]) {
      log(`Skip (exists): hostels.${column}`);
      continue;
    }
    await qi.addColumn('hostels', column, definition);
    log(`Added hostels.${column}`);
  }
};

module.exports = { ensureListingPublishColumns, LISTING_COLUMNS };

if (require.main === module) {
  (async () => {
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      await ensureListingPublishColumns(sequelize);
      console.log('listing publish columns ready');
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
