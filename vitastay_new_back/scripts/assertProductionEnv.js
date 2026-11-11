/**
 * Blocks production boot with example secrets or a missing CORS/SMTP/JWT setup.
 * Staging and production must fail closed — a marketplace with the sample JWT
 * would let anyone mint operator tokens.
 */
const WEAK = [
  'your-super-secret-jwt-key-change-in-production',
  'your-super-secret-refresh-key-change-in-production',
  'dev-secret-change-me',
  'dev-refresh-secret',
  'changeme',
  'secret',
];

const isWeak = (value) => {
  const v = String(value || '').trim();
  if (v.length < 24) return true;
  return WEAK.some((sample) => v.toLowerCase() === sample.toLowerCase());
};

const assertProductionEnv = () => {
  if (process.env.NODE_ENV !== 'production') return;

  const problems = [];
  if (isWeak(process.env.JWT_SECRET)) {
    problems.push('JWT_SECRET is missing, short, or still the example value');
  }
  if (isWeak(process.env.JWT_REFRESH_SECRET)) {
    problems.push('JWT_REFRESH_SECRET is missing, short, or still the example value');
  }
  if (!process.env.DB_PASSWORD) {
    problems.push('DB_PASSWORD is empty — production must not use an unauthenticated DB user');
  }
  const cors = String(process.env.CORS_ORIGINS || '').trim();
  if (!cors) {
    problems.push('CORS_ORIGINS must list exact HTTPS frontend origins');
  }
  if (cors.split(',').some((origin) => origin.trim() === '*')) {
    problems.push('CORS_ORIGINS must not be *');
  }
  if (!process.env.APP_URL || !/^https:\/\//i.test(process.env.APP_URL)) {
    problems.push('APP_URL must be the public HTTPS site origin');
  }
  if (!process.env.API_URL || !/^https:\/\//i.test(process.env.API_URL)) {
    problems.push('API_URL must be the public HTTPS API origin');
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    problems.push('SMTP_HOST / SMTP_USER / SMTP_PASS are required so OTP mail actually sends');
  }
  if (String(process.env.SUPER_ADMIN_PASSWORD || '') === 'Vita@2025') {
    problems.push('SUPER_ADMIN_PASSWORD is still the documented example — rotate it');
  }
  const gateway = String(process.env.PAYMENT_GATEWAY || 'razorpay').toLowerCase();
  if (gateway === 'mock') {
    problems.push('PAYMENT_GATEWAY=mock is forbidden in production (would mark rent paid without money)');
  }
  if (gateway === 'razorpay') {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      problems.push('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required for tenant self-pay');
    }
    if (!process.env.RAZORPAY_WEBHOOK_SECRET && !process.env.PAYMENT_WEBHOOK_SECRET) {
      problems.push('RAZORPAY_WEBHOOK_SECRET is required so payment webhooks can be verified');
    }
  }

  if (problems.length) {
    const message = `Production env check failed:\n- ${problems.join('\n- ')}`;
    throw new Error(message);
  }
};

module.exports = { assertProductionEnv, isWeak };

if (require.main === module) {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Production env assert skipped (NODE_ENV=${process.env.NODE_ENV || 'undefined'})`);
      process.exit(0);
    }
    require('./loadEnv');
    assertProductionEnv();
    console.log('Production env check passed');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
