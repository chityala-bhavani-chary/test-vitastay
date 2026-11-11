/**
 * DEC-01 — hostels.booking_model + advance_percent, projected to listing_projections,
 * snapshotted on bookings. Additive. Default approval_first.
 */
require('dotenv').config();
const { DataTypes } = require('sequelize');

const HOSTEL_COLUMNS = {
  booking_model: {
    type: DataTypes.ENUM('approval_first', 'instant', 'request_advance'),
    allowNull: false,
    defaultValue: 'approval_first',
  },
  advance_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 20,
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

const ensureBookingModelSchema = async (sequelize, log = console.log) => {
  const qi = sequelize.getQueryInterface();
  await addIfMissing(qi, 'hostels', 'booking_model', HOSTEL_COLUMNS.booking_model, log);
  await addIfMissing(qi, 'hostels', 'advance_percent', HOSTEL_COLUMNS.advance_percent, log);
  await addIfMissing(qi, 'listing_projections', 'booking_model', {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'approval_first',
  }, log);
  await addIfMissing(qi, 'listing_projections', 'advance_percent', {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  }, log);
  await addIfMissing(qi, 'bookings', 'booking_model', {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'approval_first',
  }, log);
  await addIfMissing(qi, 'bookings', 'advance_percent', {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  }, log);
  try {
    await sequelize.query(`
      UPDATE listing_projections lp
      INNER JOIN hostels h ON h.id = lp.hostel_id
      SET lp.booking_model = IFNULL(h.booking_model, 'approval_first'),
          lp.advance_percent = IF(IFNULL(h.booking_model, 'approval_first') = 'request_advance', h.advance_percent, NULL)
    `);
  } catch (err) {
    log(`listing_projections booking_model backfill skipped: ${err.message}`);
  }
};

module.exports = { ensureBookingModelSchema, HOSTEL_COLUMNS };

if (require.main === module) {
  (async () => {
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      await ensureBookingModelSchema(sequelize);
      console.log('booking model columns ready');
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
