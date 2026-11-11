/**
 * Nightly (or on-demand) rebuild of master listing_availability from each hostel DB.
 *   node jobs/reconcileListingAvailability.js
 */
require('dotenv').config();
const { sequelize } = require('../models');
const { reconcileListingAvailability } = require('../services/occupancyService');

(async () => {
  try {
    await sequelize.authenticate();
    const result = await reconcileListingAvailability(console.log);
    console.log(result);
    process.exit(result.failed ? 1 : 0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
