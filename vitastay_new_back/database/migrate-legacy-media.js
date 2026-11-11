/**
 * Copies hostels.images JSON into property_media as interior_common and
 * rooms.images into category room. Does not drop the JSON columns.
 * Idempotent on (hostel_id, file_path).
 * Default is dry-run. Pass --apply to write.
 */
require('dotenv').config();
const { ensurePropertyMediaTable } = require('./migrate-property-media');
const { migrateAllLegacyMedia } = require('../services/legacyMedia');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dryRunFlag = args.includes('--dry-run');
if (apply && dryRunFlag) {
  console.error('Use either --dry-run or --apply, not both.');
  process.exit(1);
}
const dryRun = !apply;

(async () => {
  try {
    const { sequelize } = require('../models');
    await sequelize.authenticate();
    console.log(`Connected (master)${dryRun ? ' — dry run' : ''}`);

    await ensurePropertyMediaTable(sequelize);
    await sequelize.query(
      'ALTER TABLE property_media ADD UNIQUE KEY uk_property_media_hostel_path (hostel_id, file_path)'
    ).then(() => console.log('OK: unique hostel+file_path'))
      .catch((err) => {
        if (/Duplicate|already exists/i.test(String(err.message))) {
          console.log('Skip (exists): unique hostel+file_path');
        } else {
          throw err;
        }
      });

    const totals = await migrateAllLegacyMedia({ dryRun });
    console.log(JSON.stringify({ dryRun, apply, ...totals }, null, 2));
    console.log(dryRun
      ? 'Dry run only — JSON columns unchanged, no property_media rows written. Re-run with --apply to copy.'
      : 'Legacy JSON copied into property_media. JSON columns kept for one more release. Recategorise rows titled “Please recategorise”.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
