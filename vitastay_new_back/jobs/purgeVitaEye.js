/**
 * PKG-012 — delete unknown gate stills older than ~30 days; drop enrolments after the stay.
 *   node jobs/purgeVitaEye.js
 */
require('dotenv').config();
const { sequelize } = require('../models');
const { runRetention } = require('../services/vitaEyePrivacy');

(async () => {
  try {
    await sequelize.authenticate();
    const result = await runRetention();
    console.log(result);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
