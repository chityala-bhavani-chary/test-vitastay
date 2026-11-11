/**
 * DEC-05 — hostels.supervisor_media_upload (default true).
 * Assigned supervisors may manage listing photos unless the owner turns this off.
 */
require('dotenv').config();
const { DataTypes } = require('sequelize');

const HOSTEL_COLUMNS = {
  supervisor_media_upload: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
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

const ensureSupervisorMediaSchema = async (sequelize, log = console.log) => {
  const qi = sequelize.getQueryInterface();
  await addIfMissing(
    qi,
    'hostels',
    'supervisor_media_upload',
    HOSTEL_COLUMNS.supervisor_media_upload,
    log,
  );
};

module.exports = { ensureSupervisorMediaSchema, HOSTEL_COLUMNS };

if (require.main === module) {
  (async () => {
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      await ensureSupervisorMediaSchema(sequelize);
      console.log('supervisor media column ready');
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
