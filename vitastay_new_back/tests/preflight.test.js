const { isWeak, assertProductionEnv } = require('../scripts/assertProductionEnv');

describe('production env guard', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = previous.NODE_ENV;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = previous.JWT_REFRESH_SECRET;
    process.env.DB_PASSWORD = previous.DB_PASSWORD;
    process.env.CORS_ORIGINS = previous.CORS_ORIGINS;
    process.env.APP_URL = previous.APP_URL;
    process.env.API_URL = previous.API_URL;
    process.env.SMTP_HOST = previous.SMTP_HOST;
    process.env.SMTP_USER = previous.SMTP_USER;
    process.env.SMTP_PASS = previous.SMTP_PASS;
    process.env.SUPER_ADMIN_PASSWORD = previous.SUPER_ADMIN_PASSWORD;
    process.env.PAYMENT_GATEWAY = previous.PAYMENT_GATEWAY;
    process.env.RAZORPAY_KEY_ID = previous.RAZORPAY_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = previous.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = previous.RAZORPAY_WEBHOOK_SECRET;
  });

  it('treats example JWT values as weak', () => {
    expect(isWeak('dev-secret-change-me')).toBe(true);
    expect(isWeak('your-super-secret-jwt-key-change-in-production')).toBe(true);
    expect(isWeak('a-sufficiently-long-random-production-secret')).toBe(false);
  });

  it('does not throw outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('accepts a complete production env', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-sufficiently-long-random-production-secret';
    process.env.JWT_REFRESH_SECRET = 'another-long-random-refresh-secret-ok';
    process.env.DB_PASSWORD = 'not-empty';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://app.example.com';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'ops@example.com';
    process.env.SMTP_PASS = 'app-password';
    process.env.SUPER_ADMIN_PASSWORD = 'rotated-not-example';
    process.env.PAYMENT_GATEWAY = 'razorpay';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_live_testsecret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test_secret_value';
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('keeps db:seed forbidden in production', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../database/seeders/index.js'), 'utf8');
    expect(src).toMatch(/NODE_ENV === 'production'/);
    expect(src).toMatch(/forbidden in production/);
    expect(src.indexOf("NODE_ENV === 'production'")).toBeLessThan(src.indexOf('sequelize.sync'));
  });

  it('throws when production still has example secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev-secret-change-me';
    process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret';
    process.env.DB_PASSWORD = '';
    process.env.CORS_ORIGINS = '';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.API_URL = 'http://localhost:5000';
    expect(() => assertProductionEnv()).toThrow(/Production env check failed/);
  });
});
