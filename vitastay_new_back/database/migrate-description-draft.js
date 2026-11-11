/**
 * BIC-034 — listing description draft (never auto-published). Additive.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const ensureDescriptionDraftSchema = async (db = sequelize, log = console.log) => {
  const qi = db.getQueryInterface();
  let cols;
  try {
    cols = await qi.describeTable('hostels');
  } catch {
    log('hostels missing — skip description draft columns');
    return;
  }

  if (!cols.description_draft) {
    await qi.addColumn('hostels', 'description_draft', {
      type: require('sequelize').DataTypes.TEXT,
      allowNull: true,
    });
    log('Added hostels.description_draft');
  } else {
    log('Skip (exists): hostels.description_draft');
  }

  if (!cols.description_draft_source) {
    await db.query(
      "ALTER TABLE hostels ADD COLUMN description_draft_source ENUM('template','llm') NULL"
    );
    log('Added hostels.description_draft_source');
  } else {
    log('Skip (exists): hostels.description_draft_source');
  }

  if (!cols.description_origin) {
    await db.query(
      "ALTER TABLE hostels ADD COLUMN description_origin ENUM('owner','template','llm') NULL"
    );
    log('Added hostels.description_origin');
  } else {
    log('Skip (exists): hostels.description_origin');
  }

  if (!cols.description_draft_at) {
    await qi.addColumn('hostels', 'description_draft_at', {
      type: require('sequelize').DataTypes.DATE,
      allowNull: true,
    });
    log('Added hostels.description_draft_at');
  } else {
    log('Skip (exists): hostels.description_draft_at');
  }
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureDescriptionDraftSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureDescriptionDraftSchema };
