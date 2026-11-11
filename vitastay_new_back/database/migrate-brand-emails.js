/**
 * Rename leftover Nivas seed logins to Vita Stay. Additive. Does not rename nivas_hostel.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const EMAIL_MAP = {
  'owner@nivas.com': 'owner@vitastay.com',
  'supervisor@nivas.com': 'supervisor@vitastay.com',
  'tenant@nivas.com': 'tenant@vitastay.com',
  'staff@nivas.com': 'staff@vitastay.com',
};

const remapLegacyBrandEmails = async (log = console.log) => {
  const { User, Hostel } = require('../models');
  for (const [from, to] of Object.entries(EMAIL_MAP)) {
    const taken = await User.findOne({ where: { email: to } });
    if (taken) continue;
    const [count] = await User.update({ email: to }, { where: { email: from } });
    if (count) log(`Seed login ${from} → ${to}`);
  }
  const [hostels] = await Hostel.update(
    { contact_email: 'info@vitastay.com' },
    { where: { contact_email: 'info@nivas.com' } }
  );
  if (hostels) log('Hostel contact_email info@nivas.com → info@vitastay.com');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await remapLegacyBrandEmails();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { EMAIL_MAP, remapLegacyBrandEmails };
