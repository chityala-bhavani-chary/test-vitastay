/**
 * PKG-008 — grace (default 7 days) then lapse Silver/Gold to Regular.
 * Unpublishes, refunds/expires open seeker bookings, keeps photos and tenants.
 *   node jobs/lapseOwnerPlans.js
 */
require('dotenv').config();
const { sequelize } = require('../models');
const { processPlanRenewals } = require('../services/ownerPlanBilling');

(async () => {
  try {
    await sequelize.authenticate();
    const result = await processPlanRenewals();
    console.log(result);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
