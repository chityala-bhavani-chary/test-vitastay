/**
 * Ordered additive migrate-* scripts. Never runs db:seed.
 * Linux servers can use deploy/scripts/migrate-production.sh; this file works on Windows too.
 */
require('./loadEnv');
const { spawnSync } = require('child_process');
const path = require('path');

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--yes')) {
  console.error('Refusing to migrate production without: node scripts/migrate-production.js --yes');
  process.exit(1);
}

const back = path.join(__dirname, '..');
const run = (rel, extraArgs = []) => {
  console.log(`==> ${rel}${extraArgs.length ? ` ${extraArgs.join(' ')}` : ''}`);
  const result = spawnSync(process.execPath, [path.join(back, rel), ...extraArgs], {
    cwd: back,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
};

run('scripts/preflightEnv.js');
run('database/migrate-super-admin.js');
run('database/migrate-tenant-fields.js');
run('database/migrate-hostel-approval.js');
run('database/migrate-hostel-databases.js');
run('database/migrate-hostel-logo.js');
run('database/migrate-notice-period.js');
run('database/migrate-room-active.js');
run('database/migrate-property-media.js');
run('database/migrate-legacy-media.js', ['--apply']);
run('database/migrate-payment-orders.js');
run('database/migrate-seeker-auth.js');
run('database/migrate-listing-search.js');
run('database/migrate-booking-model.js');
console.log('Migrations finished. Do NOT run npm run db:seed.');
