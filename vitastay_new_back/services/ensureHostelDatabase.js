const { provisionHostelDatabase } = require('./hostelDatabase');
const logger = require('../config/logger');

/**
 * Provision an isolated MySQL database for a hostel/branch and persist database_name.
 * Called when Super Admin creates/registers a hostel or approves a branch.
 */
const ensureHostelDatabase = async (hostel) => {
  if (!hostel) throw new Error('Hostel is required');

  if (hostel.database_name && hostel.status === 'active') {
    // Re-sync meta into existing DB
    const { getHostelConnection, seedHostelMeta } = require('./hostelDatabase');
    const conn = await getHostelConnection(hostel.database_name);
    await seedHostelMeta(conn.models, {
      ...(typeof hostel.toJSON === 'function' ? hostel.toJSON() : hostel),
      database_name: hostel.database_name,
    });
    return hostel.database_name;
  }

  const { databaseName } = await provisionHostelDatabase(hostel);
  await hostel.update({ database_name: databaseName });
  logger.info(`Provisioned isolated database "${databaseName}" for hostel #${hostel.id} (${hostel.name})`);
  return databaseName;
};

module.exports = { ensureHostelDatabase };
