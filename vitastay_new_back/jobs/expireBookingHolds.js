/**
 * Release expired booking holds (beds.reserved → vacant). Idempotent.
 *   node jobs/expireBookingHolds.js
 */
require('dotenv').config();
const { sequelize } = require('../models');
const { expireHolds } = require('../services/bookingHold');

(async () => {
  try {
    await sequelize.authenticate();
    const result = await expireHolds();
    console.log(result);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
