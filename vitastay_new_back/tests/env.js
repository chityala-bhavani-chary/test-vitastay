/**
 * Must run before any app/config import so tests never attach to nivas_hostel.
 * BCRYPT_ROUNDS is lowered only in this process — production .env is not rewritten.
 */
process.env.NODE_ENV = 'test';
require('dotenv').config();
process.env.DB_NAME_TEST = process.env.DB_NAME_TEST || 'nivas_hostel_test';
process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS || '4';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.PAYMENT_GATEWAY = 'mock';
process.env.PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'test-webhook-secret';
process.env.MAIL_QUEUE_RETRY_MS = process.env.MAIL_QUEUE_RETRY_MS || '0';
