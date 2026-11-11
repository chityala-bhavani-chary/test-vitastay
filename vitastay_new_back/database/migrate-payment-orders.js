/**
 * Gateway orders + webhook event log. Additive. Never sequelize.sync({ force: true }).
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE_ORDERS = `
CREATE TABLE IF NOT EXISTS payment_orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rent_payment_id INT UNSIGNED NULL,
  booking_id INT UNSIGNED NULL,
  tenant_id INT UNSIGNED NULL,
  hostel_id INT UNSIGNED NOT NULL,
  provider VARCHAR(32) NOT NULL,
  gateway_order_id VARCHAR(64) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'INR',
  status ENUM('created', 'paid', 'failed', 'cancelled') DEFAULT 'created',
  gateway_payment_id VARCHAR(64) NULL,
  payment_method VARCHAR(32) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_orders_gateway (gateway_order_id),
  INDEX idx_payment_orders_invoice (rent_payment_id),
  INDEX idx_payment_orders_booking (booking_id),
  INDEX idx_payment_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const CREATE_EVENTS = `
CREATE TABLE IF NOT EXISTS payment_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  provider_event_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(64) NULL,
  rent_payment_id INT UNSIGNED NULL,
  payload TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_events_provider (provider, provider_event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const patchPaymentOrderColumns = async (db, log) => {
  let cols;
  try {
    cols = await db.getQueryInterface().describeTable('payment_orders');
  } catch {
    return;
  }
  if (!cols.booking_id) {
    await db.query('ALTER TABLE payment_orders ADD COLUMN booking_id INT UNSIGNED NULL AFTER rent_payment_id');
    log('payment_orders.booking_id');
  }
  if (cols.rent_payment_id && cols.rent_payment_id.allowNull === false) {
    await db.query('ALTER TABLE payment_orders MODIFY COLUMN rent_payment_id INT UNSIGNED NULL');
    log('payment_orders.rent_payment_id nullable');
  }
  if (cols.tenant_id && cols.tenant_id.allowNull === false) {
    await db.query('ALTER TABLE payment_orders MODIFY COLUMN tenant_id INT UNSIGNED NULL');
    log('payment_orders.tenant_id nullable');
  }
  const [indexes] = await db.query('SHOW INDEX FROM payment_orders');
  const names = (indexes || []).map((row) => String(row.Key_name || ''));
  if (!names.includes('idx_payment_orders_booking')) {
    try {
      await db.query('CREATE INDEX idx_payment_orders_booking ON payment_orders (booking_id)');
      log('idx_payment_orders_booking');
    } catch { /* exists */ }
  }
};

const ensurePaymentOrderTables = async (db = sequelize, log = console.log) => {
  await db.query(CREATE_ORDERS);
  await db.query(CREATE_EVENTS);
  await patchPaymentOrderColumns(db, log);
  log('payment_orders / payment_events ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensurePaymentOrderTables();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensurePaymentOrderTables };
