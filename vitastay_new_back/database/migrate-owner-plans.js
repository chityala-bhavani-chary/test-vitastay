/**
 * Owner packages (BKG-016 / DEC-02). Additive. Never sequelize.sync({ force: true }).
 * Catalog prices stay NULL until finance fills INR — checkout stays off.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE_PLANS = `
CREATE TABLE IF NOT EXISTS plans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code ENUM('regular', 'silver', 'gold') NOT NULL,
  name VARCHAR(32) NOT NULL,
  monthly_inr DECIMAL(10, 2) NULL,
  yearly_inr DECIMAL(10, 2) NULL,
  yearly_discount_pct DECIMAL(5, 2) NULL,
  gst_pct DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plans_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const CREATE_SUBS = `
CREATE TABLE IF NOT EXISTS owner_subscriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  plan_code ENUM('regular', 'silver', 'gold') NOT NULL,
  period ENUM('month', 'year') NOT NULL,
  status ENUM('pending', 'active', 'grace', 'cancelled', 'lapsed', 'comp') NOT NULL DEFAULT 'pending',
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  grace_ends_at DATETIME NULL,
  amount_ex_gst DECIMAL(10, 2) NULL,
  gst_pct DECIMAL(5, 2) NULL,
  gst_amount DECIMAL(10, 2) NULL,
  amount_inc_gst DECIMAL(10, 2) NULL,
  created_by INT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner_subs_hostel (hostel_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const CREATE_INVOICES = `
CREATE TABLE IF NOT EXISTS owner_invoices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  subscription_id INT UNSIGNED NULL,
  invoice_number VARCHAR(40) NOT NULL,
  plan_code ENUM('regular', 'silver', 'gold') NOT NULL,
  period ENUM('month', 'year') NOT NULL,
  amount_ex_gst DECIMAL(10, 2) NOT NULL,
  gst_pct DECIMAL(5, 2) NOT NULL,
  gst_amount DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'INR',
  status ENUM('pending', 'paid', 'failed', 'void') NOT NULL DEFAULT 'pending',
  period_start DATE NULL,
  period_end DATE NULL,
  paid_at DATETIME NULL,
  payment_order_id INT UNSIGNED NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_owner_invoices_number (invoice_number),
  INDEX idx_owner_invoices_hostel (hostel_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const addColumnIfMissing = async (db, table, column, ddl, log) => {
  const qi = db.getQueryInterface();
  let cols;
  try {
    cols = await qi.describeTable(table);
  } catch {
    return;
  }
  if (cols[column]) return;
  await db.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  log(`${table}.${column}`);
};

const ensureIndex = async (db, table, name, sql, log) => {
  const [indexes] = await db.query(`SHOW INDEX FROM ${table}`);
  const names = (indexes || []).map((row) => String(row.Key_name || ''));
  if (names.includes(name)) return;
  try {
    await db.query(sql);
    log(name);
  } catch { /* exists */ }
};

const seedPlans = async (db, log) => {
  const [rows] = await db.query('SELECT code FROM plans');
  const have = new Set((rows || []).map((row) => row.code));
  const catalog = [
    ['regular', 'Regular', 1],
    ['silver', 'Silver', 2],
    ['gold', 'Gold', 3],
  ];
  for (const [code, name, sort] of catalog) {
    if (have.has(code)) continue;
    await db.query(
      'INSERT INTO plans (code, name, monthly_inr, yearly_inr, gst_pct, is_active, sort_order, created_at, updated_at) VALUES (?, ?, NULL, NULL, 18.00, 1, ?, NOW(), NOW())',
      { replacements: [code, name, sort] }
    );
    log(`plans seed ${code}`);
  }
};

const grandfatherPublished = async (db, log) => {
  try {
    const [result] = await db.query(
      "UPDATE hostels SET plan = 'silver', plan_status = 'comp' WHERE listing_published = 1 AND plan IS NULL"
    );
    const n = result?.affectedRows ?? result;
    if (n) log(`grandfathered ${n} published hostel(s) to silver/comp`);
  } catch (err) {
    log(`grandfather skipped: ${err.message}`);
  }
};

const patchPaymentOrders = async (db, log) => {
  await addColumnIfMissing(
    db,
    'payment_orders',
    'order_type',
    "order_type VARCHAR(16) NOT NULL DEFAULT 'rent' AFTER hostel_id",
    log
  );
  await addColumnIfMissing(
    db,
    'payment_orders',
    'owner_invoice_id',
    'owner_invoice_id INT UNSIGNED NULL AFTER booking_id',
    log
  );
  try {
    await db.query("UPDATE payment_orders SET order_type = 'booking' WHERE booking_id IS NOT NULL AND (order_type IS NULL OR order_type = 'rent')");
    await db.query("UPDATE payment_orders SET order_type = 'owner_plan' WHERE owner_invoice_id IS NOT NULL");
  } catch { /* table empty / missing */ }
  await ensureIndex(
    db,
    'payment_orders',
    'idx_payment_orders_owner_invoice',
    'CREATE INDEX idx_payment_orders_owner_invoice ON payment_orders (owner_invoice_id)',
    log
  );
};

const ensureOwnerPlanSchema = async (db = sequelize, log = console.log) => {
  await db.query(CREATE_PLANS);
  await db.query(CREATE_SUBS);
  await db.query(CREATE_INVOICES);
  await addColumnIfMissing(db, 'hostels', 'plan', "plan ENUM('regular','silver','gold') NOT NULL DEFAULT 'regular'", log);
  await addColumnIfMissing(db, 'hostels', 'plan_period', "plan_period ENUM('month','year') NULL", log);
  await addColumnIfMissing(
    db,
    'hostels',
    'plan_status',
    "plan_status ENUM('comp','active','grace','lapsed','pending') NOT NULL DEFAULT 'comp'",
    log
  );
  await addColumnIfMissing(db, 'hostels', 'plan_starts_at', 'plan_starts_at DATETIME NULL', log);
  await addColumnIfMissing(db, 'hostels', 'plan_expires_at', 'plan_expires_at DATETIME NULL', log);
  await addColumnIfMissing(db, 'hostels', 'plan_grace_ends_at', 'plan_grace_ends_at DATETIME NULL', log);
  await seedPlans(db, log);
  await grandfatherPublished(db, log);
  await patchPaymentOrders(db, log);
  log('owner plans ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureOwnerPlanSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureOwnerPlanSchema };
