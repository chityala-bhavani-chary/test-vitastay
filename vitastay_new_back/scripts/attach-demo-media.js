require('dotenv').config();
const { Hostel, User, sequelize } = require('../models');
const { attachToHostel } = require('../services/seedDemoMedia');
const { refreshListingProjection } = require('../services/listingProjection');

const run = async () => {
  const hostels = await Hostel.findAll({ order: [['id', 'ASC']] });
  if (!hostels.length) {
    console.log('No hostels to attach sample photos to');
    return;
  }
  const ownerFallback = await User.findOne({ where: { role: 'owner' } });
  const adminFallback = await User.findOne({ where: { role: 'super_admin' } });
  for (const hostel of hostels) {
    const user = (hostel.owner_id && await User.findByPk(hostel.owner_id))
      || ownerFallback
      || adminFallback;
    if (!user) {
      console.log(`Skip ${hostel.name}: no user to attribute uploads`);
      continue;
    }
    const result = await attachToHostel(hostel, user);
    await hostel.reload();
    try {
      await require('../services/listingPublish').publishListing({ hostel, user });
      console.log(`${hostel.name}: ${result.message}; listing published`);
    } catch (err) {
      await refreshListingProjection(hostel);
      console.log(`${hostel.name}: ${result.message}; not published (${err.message})`);
    }
  }
};

run()
  .then(() => sequelize.close())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
