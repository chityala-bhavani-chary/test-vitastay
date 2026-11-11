const { DataTypes } = require('sequelize');
const logger = require('../config/logger');
const { ensurePropertyMediaTable } = require('../database/migrate-property-media');
const { ensurePaymentOrderTables } = require('../database/migrate-payment-orders');
const { ensureOccupancySnapshotTable } = require('../database/migrate-occupancy-snapshots');
const { remapLegacyBrandEmails } = require('../database/migrate-brand-emails');
const { ensureListingPublishColumns } = require('../database/migrate-listing-publish');
const { ensureSeekerAuthSchema } = require('../database/migrate-seeker-auth');
const { ensureListingSearchSchema } = require('../database/migrate-listing-search');
const { ensureListingAvailabilityTable } = require('../database/migrate-listing-availability');
const { ensureBookingsTable } = require('../database/migrate-bookings');
const { ensureBookingRefundsTable } = require('../database/migrate-booking-refunds');
const { ensureListingEventsTable } = require('../database/migrate-listing-events');
const { ensureOwnerPlanSchema } = require('../database/migrate-owner-plans');
const { ensureFaceEnrollmentSchema } = require('../database/migrate-face-enrollments');
const { ensureVitaEyeMatchSchema } = require('../database/migrate-vita-eye-match');
const { ensureActiveAssignmentUnique } = require('../database/migrate-bed-assignment-unique');
const { ensureBookingModelSchema } = require('../database/migrate-booking-model');
const { ensureSupervisorMediaSchema } = require('../database/migrate-supervisor-media');
const { ensureOptional360Schema } = require('../database/migrate-360-optional');
const { ensurePasswordPlainDropped } = require('../database/migrate-drop-password-plain');
const { ensureWishlistsTable } = require('../database/migrate-wishlists');
const { ensureCommuteSchema } = require('../database/migrate-commute');
const { ensureListingFilterSchema } = require('../database/migrate-listing-filters');
const { ensureWaitlistTable } = require('../database/migrate-waitlist');
const { ensureVisitsSchema } = require('../database/migrate-visits');
const { ensureDescriptionDraftSchema } = require('../database/migrate-description-draft');
const { ensureWalkthroughVideoSchema } = require('../database/migrate-walkthrough-video');
const { ensureListingI18nSchema } = require('../database/migrate-listing-i18n');
const { ensureOwnerKycSchema } = require('../database/migrate-owner-kyc');
const { ensureListingVerifiedSchema } = require('../database/migrate-listing-verified');

/**
 * Columns added after the initial schema. New branch databases get them from
 * `sync({ alter: true })`; existing master/branch databases are patched here at startup.
 */
const COLUMNS = {
  hostels: {
    logo: { type: DataTypes.STRING(255), allowNull: true },
  },
  tenants: {
    rent_due_day: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    next_rent_due_date: { type: DataTypes.DATEONLY, allowNull: true },
  },
  rent_payments: {
    original_due_date: { type: DataTypes.DATEONLY, allowNull: true },
    extension_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    extension_charge: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  },
  beds: {
    hold_expires_at: { type: DataTypes.DATE, allowNull: true },
  },
  bookings: {
    reject_reason: { type: DataTypes.STRING(500), allowNull: true },
    decided_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    decided_at: { type: DataTypes.DATE, allowNull: true },
    deposit_due: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    gateway_order_id: { type: DataTypes.STRING(64), allowNull: true },
  },
};

const upgradeDatabase = async (sequelize, label) => {
  const qi = sequelize.getQueryInterface();
  for (const [table, columns] of Object.entries(COLUMNS)) {
    let existing;
    try {
      existing = await qi.describeTable(table);
    } catch {
      continue;
    }
    for (const [column, definition] of Object.entries(columns)) {
      if (existing[column]) continue;
      await qi.addColumn(table, column, definition);
      logger.info(`Schema upgrade: added ${table}.${column} (${label})`);
    }
  }
};

const runSchemaUpgrades = async () => {
  const { sequelize, Hostel } = require('../models');
  await upgradeDatabase(sequelize, 'master');
  try {
    await ensurePropertyMediaTable(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`property_media schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensurePaymentOrderTables(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`payment_orders schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureOccupancySnapshotTable(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`occupancy_snapshots schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureListingPublishColumns(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`listing publish schema upgrade skipped: ${err.message}`);
  }
  try {
    await remapLegacyBrandEmails((msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`Brand email remap skipped: ${err.message}`);
  }
  try {
    await ensureSeekerAuthSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`seeker auth schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureListingSearchSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
    const { backfillListingProjections } = require('./listingProjection');
    await backfillListingProjections((msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`listing search schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureListingAvailabilityTable(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`listing availability schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureBookingsTable(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`bookings schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureBookingRefundsTable(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`booking_refunds schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureListingEventsTable(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`listing_events schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureActiveAssignmentUnique(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`active assignment unique skipped: ${err.message}`);
  }
  try {
    await ensureOwnerPlanSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`owner plans schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureFaceEnrollmentSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`face_enrollments schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureVitaEyeMatchSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`vita-eye match schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureBookingModelSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`booking model schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureSupervisorMediaSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`supervisor media schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureOptional360Schema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`optional 360 schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensurePasswordPlainDropped(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`password_plain drop skipped: ${err.message}`);
  }
  try {
    await ensureWishlistsTable(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`wishlists schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureCommuteSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`commute schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureListingFilterSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`listing filter schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureWaitlistTable(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`waitlist schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureVisitsSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`visits schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureDescriptionDraftSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`description draft schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureWalkthroughVideoSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`walkthrough video schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureListingI18nSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`listing i18n schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureOwnerKycSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`owner KYC schema upgrade skipped: ${err.message}`);
  }
  try {
    await ensureListingVerifiedSchema(sequelize, (msg) => logger.info(`Schema upgrade: ${msg}`));
  } catch (err) {
    logger.warn(`listing verified schema upgrade skipped: ${err.message}`);
  }

  const { getHostelConnection } = require('./hostelDatabase');
  const branches = await Hostel.findAll({ where: {}, attributes: ['id', 'database_name'] });
  for (const hostel of branches.filter((h) => h.database_name)) {
    try {
      const conn = await getHostelConnection(hostel.database_name);
      await upgradeDatabase(conn.sequelize, hostel.database_name);
      await ensureActiveAssignmentUnique(conn.sequelize, (msg) => logger.info(`Schema upgrade: ${msg} (${hostel.database_name})`));
      try {
        await ensureListingFilterSchema(conn.sequelize, (msg) => logger.info(`Schema upgrade: ${msg} (${hostel.database_name})`));
      } catch (branchErr) {
        logger.warn(`listing filter schema skipped for ${hostel.database_name}: ${branchErr.message}`);
      }
    } catch (err) {
      logger.warn(`Schema upgrade skipped for ${hostel.database_name}: ${err.message}`);
    }
  }
};

module.exports = { runSchemaUpgrades };
