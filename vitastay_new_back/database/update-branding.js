require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.query(`
      UPDATE settings
      SET value = 'Vita Stay Hostel Management'
      WHERE \`key\` = 'name' AND \`group\` = 'company'
    `);
    await sequelize.query(`
      UPDATE settings
      SET value = 'Vita Stay'
      WHERE \`key\` = 'app_name'
    `);
    console.log('Branding settings updated to Vita Stay');
    process.exit(0);
  } catch (err) {
    console.log(err.message);
    process.exit(0);
  }
})();
