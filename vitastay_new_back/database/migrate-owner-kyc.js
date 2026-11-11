/**
 * BIC-038 — owner KYC status + encrypted identifiers on hostels. Additive.
 */
require('dotenv').config();
const { sequelize } = require('../models');
const { DataTypes } = require('sequelize');

const ensureOwnerKycSchema = async (db = sequelize, log = console.log) => {
  const qi = db.getQueryInterface();
  let cols;
  try {
    cols = await qi.describeTable('hostels');
  } catch {
    log('hostels missing — skip owner KYC');
    return;
  }

  if (!cols.owner_kyc_status) {
    await db.query(
      "ALTER TABLE hostels ADD COLUMN owner_kyc_status ENUM('none','submitted','verified','rejected') NOT NULL DEFAULT 'none'"
    );
    log('Added hostels.owner_kyc_status');
  } else {
    log('Skip (exists): hostels.owner_kyc_status');
  }

  const addText = async (name) => {
    if (!cols[name]) {
      await qi.addColumn('hostels', name, { type: DataTypes.TEXT, allowNull: true });
      log(`Added hostels.${name}`);
    } else {
      log(`Skip (exists): hostels.${name}`);
    }
  };
  await addText('owner_pan_cipher');
  await addText('owner_gstin_cipher');
  await addText('owner_upi_cipher');
  await addText('owner_kyc_reject_reason');

  if (!cols.owner_kyc_verified_at) {
    await qi.addColumn('hostels', 'owner_kyc_verified_at', { type: DataTypes.DATE, allowNull: true });
    log('Added hostels.owner_kyc_verified_at');
  } else {
    log('Skip (exists): hostels.owner_kyc_verified_at');
  }

  if (!cols.owner_kyc_verified_by) {
    await qi.addColumn('hostels', 'owner_kyc_verified_by', {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    });
    log('Added hostels.owner_kyc_verified_by');
  } else {
    log('Skip (exists): hostels.owner_kyc_verified_by');
  }

  if (!cols.owner_kyc_submitted_at) {
    await qi.addColumn('hostels', 'owner_kyc_submitted_at', { type: DataTypes.DATE, allowNull: true });
    log('Added hostels.owner_kyc_submitted_at');
  } else {
    log('Skip (exists): hostels.owner_kyc_submitted_at');
  }
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureOwnerKycSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureOwnerKycSchema };
