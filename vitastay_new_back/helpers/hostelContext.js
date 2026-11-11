/**
 * Resolve models for a hostel/branch.
 * - If hostel has database_name → use isolated branch DB (no data mix)
 * - Else fall back to master DB models
 */
const masterDb = require('../models');
const { getHostelConnection } = require('../services/hostelDatabase');

const getModelsForHostel = async (hostelOrId) => {
  let hostel = hostelOrId;
  if (typeof hostelOrId === 'number' || typeof hostelOrId === 'string') {
    hostel = await masterDb.Hostel.findByPk(hostelOrId);
  }
  if (!hostel) {
    return { hostel: null, models: masterDb, isolated: false, databaseName: null };
  }

  if (hostel.database_name) {
    const conn = await getHostelConnection(hostel.database_name);
    return {
      hostel,
      models: conn.models,
      sequelize: conn.sequelize,
      isolated: true,
      databaseName: conn.databaseName,
    };
  }

  return {
    hostel,
    models: masterDb,
    sequelize: masterDb.sequelize,
    isolated: false,
    databaseName: null,
  };
};

module.exports = { getModelsForHostel };
