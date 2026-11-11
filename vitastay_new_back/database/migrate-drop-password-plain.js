/**
 * IMP-003 / BIC-104 — drop users.password_plain. Hashes only; temp passwords returned once on reset.
 */
require('dotenv').config();

const ensurePasswordPlainDropped = async (sequelize, log = console.log) => {
  const qi = sequelize.getQueryInterface();
  let cols;
  try {
    cols = await qi.describeTable('users');
  } catch {
    log('users missing — skip password_plain drop');
    return;
  }
  if (!cols.password_plain) {
    log('Skip (gone): users.password_plain');
    return;
  }
  await qi.removeColumn('users', 'password_plain');
  log('Dropped users.password_plain');
};

module.exports = { ensurePasswordPlainDropped };

if (require.main === module) {
  (async () => {
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      await ensurePasswordPlainDropped(sequelize);
      console.log('password_plain column removed');
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
