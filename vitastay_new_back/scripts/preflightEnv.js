/**
 * Prints the go-live checklist and fails if production secrets are still examples.
 * Usage: node scripts/preflightEnv.js
 */
require('./loadEnv');
const { isWeak } = require('./assertProductionEnv');

const rows = [
  ['NODE_ENV', process.env.NODE_ENV, process.env.NODE_ENV === 'production' ? 'ok' : 'set production on the server'],
  ['DB_HOST / DB_NAME / DB_USER', `${process.env.DB_HOST || '-'} ${process.env.DB_NAME || '-'} ${process.env.DB_USER || '-'}`, process.env.DB_NAME ? 'ok' : 'missing'],
  ['DB_PASSWORD', process.env.DB_PASSWORD ? 'set' : 'empty', process.env.DB_PASSWORD ? 'ok' : 'required in production'],
  ['JWT_SECRET', isWeak(process.env.JWT_SECRET) ? 'WEAK/EXAMPLE' : 'set', isWeak(process.env.JWT_SECRET) ? 'rotate' : 'ok'],
  ['JWT_REFRESH_SECRET', isWeak(process.env.JWT_REFRESH_SECRET) ? 'WEAK/EXAMPLE' : 'set', isWeak(process.env.JWT_REFRESH_SECRET) ? 'rotate' : 'ok'],
  ['CORS_ORIGINS', process.env.CORS_ORIGINS || '(unset)', process.env.CORS_ORIGINS && !process.env.CORS_ORIGINS.includes('*') ? 'ok' : 'exact HTTPS origins'],
  ['APP_URL', process.env.APP_URL || '(unset)', /^https:\/\//i.test(process.env.APP_URL || '') ? 'ok' : 'must be https in production'],
  ['API_URL', process.env.API_URL || '(unset)', /^https:\/\//i.test(process.env.API_URL || '') ? 'ok' : 'must be https in production'],
  ['SMTP_HOST', process.env.SMTP_HOST || '(unset)', process.env.SMTP_HOST ? 'ok' : 'OTP will not send'],
  ['SUPER_ADMIN_PASSWORD', process.env.SUPER_ADMIN_PASSWORD === 'Vita@2025' ? 'EXAMPLE' : (process.env.SUPER_ADMIN_PASSWORD ? 'set' : 'n/a after bootstrap'), process.env.SUPER_ADMIN_PASSWORD === 'Vita@2025' ? 'rotate' : 'ok'],
  ['MYSQL_ROOT_* (provisioner)', process.env.MYSQL_ROOT_USER || process.env.MYSQL_ROOT_PASSWORD ? 'set' : 'unset', 'only needed to CREATE vitastay_* DBs'],
  ['db:seed', 'forbidden in production', 'never run'],
  ['PAYMENT_GATEWAY', process.env.PAYMENT_GATEWAY || 'razorpay (default)', process.env.PAYMENT_GATEWAY === 'mock' ? 'forbidden in production' : 'ok'],
  ['RAZORPAY_KEY_ID', process.env.RAZORPAY_KEY_ID ? 'set' : 'unset', process.env.RAZORPAY_KEY_ID ? 'ok' : 'needed for tenant UPI/card pay'],
];

console.log('\nVita Stay go-live checklist\n');
rows.forEach(([item, value, note]) => {
  console.log(`${item.padEnd(28)} ${String(value).padEnd(28)} ${note}`);
});
console.log('\nMigrate with npm run ops:migrate -- --yes — do not npm run db:seed.');
console.log('Backup with npm run ops:backup. Restore drill: npm run ops:restore-drill.\n');

if (process.env.NODE_ENV === 'production') {
  const { assertProductionEnv } = require('./assertProductionEnv');
  assertProductionEnv();
}
