const mysql = require('mysql2/promise');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Occupancy/ops tables only. property_media stays on the master DB
// (PropertyMedia is registered in models/index.js, not here).
const OPERATIONAL_MODELS = [
  'Hostel',
  'HostelBlock',
  'Room',
  'Bed',
  'BedAssignment',
  'Tenant',
  'TenantDocument',
  'Staff',
  'StaffAttendance',
  'StaffLeave',
  'RentPayment',
  'Expense',
  'FinanceTransaction',
  'Visitor',
  'Complaint',
  'ComplaintTimeline',
  'Maintenance',
  'Notice',
  'InventoryItem',
  'InventoryTransaction',
  'Document',
  'Setting',
  'AuditLog',
];

const connections = new Map();

const getRootConnection = async () => mysql.createConnection({
  host: process.env.DB_HOST || dbConfig.host || 'localhost',
  port: Number(process.env.DB_PORT || dbConfig.port || 3306),
  user: process.env.MYSQL_ROOT_USER || 'root',
  password: process.env.MYSQL_ROOT_PASSWORD ?? '',
  multipleStatements: true,
});

const sanitizeDbName = (name, code) => {
  const base = String(code || name || 'hostel')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'hostel';
  return `vitastay_${base}`.slice(0, 64);
};

const buildSequelize = (databaseName) => new Sequelize(
  databaseName,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    define: dbConfig.define,
  }
);

const loadOperationalModels = (sequelize) => {
  const db = { sequelize, Sequelize };
  OPERATIONAL_MODELS.forEach((modelName) => {
    const factory = require(`../models/${modelName}`);
    db[modelName] = factory(sequelize, DataTypes);
  });
  Object.keys(db).forEach((name) => {
    if (db[name]?.associate) {
      try {
        db[name].associate(db);
      } catch {
        // Cross-model associations that need User/master models are skipped safely
      }
    }
  });
  return db;
};

const getHostelConnection = async (databaseName) => {
  if (!databaseName) return null;
  if (connections.has(databaseName)) {
    return connections.get(databaseName);
  }
  const sequelize = buildSequelize(databaseName);
  await sequelize.authenticate();
  const models = loadOperationalModels(sequelize);
  const entry = { sequelize, models, databaseName };
  connections.set(databaseName, entry);
  return entry;
};

const closeHostelConnection = async (databaseName) => {
  const entry = connections.get(databaseName);
  if (!entry) return;
  await entry.sequelize.close();
  connections.delete(databaseName);
};

const grantAppUserAccess = async (rootConn, databaseName) => {
  const appUser = process.env.DB_USER || dbConfig.username || 'nivas_user';
  if (appUser === 'root') return;
  try {
    await rootConn.query(
      `GRANT ALL PRIVILEGES ON \`${databaseName}\`.* TO '${appUser}'@'localhost'`
    );
    await rootConn.query(
      `GRANT ALL PRIVILEGES ON \`${databaseName}\`.* TO '${appUser}'@'%'`
    );
    await rootConn.query('FLUSH PRIVILEGES');
  } catch (err) {
    // Non-fatal if grants already exist / host pattern differs
    console.warn(`Grant warning for ${databaseName}:`, err.message);
  }
};

const seedHostelMeta = async (models, hostel) => {
  const existing = await models.Hostel.findByPk(hostel.id);
  const payload = {
    id: hostel.id,
    owner_id: hostel.owner_id,
    name: hostel.name,
    code: hostel.code,
    description: hostel.description,
    address: hostel.address,
    city: hostel.city,
    state: hostel.state,
    pincode: hostel.pincode,
    country: hostel.country || 'India',
    total_floors: hostel.total_floors || 1,
    capacity: hostel.capacity || 0,
    amenities: hostel.amenities || [],
    features: hostel.features || {},
    electricity_charge: hostel.electricity_charge || 0,
    water_charge: hostel.water_charge || 0,
    security_deposit: hostel.security_deposit || 0,
    notice_period_months: hostel.notice_period_months || 1,
    contact_phone: hostel.contact_phone,
    contact_email: hostel.contact_email,
    status: 'active',
    database_name: hostel.database_name,
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  // Force same catalog ID inside branch DB for consistent references
  await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    await models.Hostel.create(payload);
  } finally {
    await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  }
  return models.Hostel.findByPk(hostel.id);
};

/**
 * Create an isolated MySQL database for a hostel/branch and sync its schema.
 */
const provisionHostelDatabase = async (hostel) => {
  const databaseName = hostel.database_name || sanitizeDbName(hostel.name, hostel.code);
  const rootConn = await getRootConnection();

  try {
    await rootConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await grantAppUserAccess(rootConn, databaseName);
  } finally {
    await rootConn.end();
  }

  // Drop cached connection if re-provisioning
  await closeHostelConnection(databaseName);

  const sequelize = buildSequelize(databaseName);
  const models = loadOperationalModels(sequelize);
  await sequelize.sync({ alter: true });
  try {
    const { ensureActiveAssignmentUnique } = require('../database/migrate-bed-assignment-unique');
    await ensureActiveAssignmentUnique(sequelize, () => {});
  } catch (err) {
    console.warn(`active assignment unique skipped for ${databaseName}: ${err.message}`);
  }

  const hostelWithDb = {
    ...(typeof hostel.toJSON === 'function' ? hostel.toJSON() : hostel),
    database_name: databaseName,
  };
  await seedHostelMeta(models, hostelWithDb);

  connections.set(databaseName, { sequelize, models, databaseName });

  return {
    databaseName,
    sequelize,
    models,
  };
};

const dropHostelDatabase = async (databaseName) => {
  if (!databaseName) return;
  await closeHostelConnection(databaseName);
  const rootConn = await getRootConnection();
  try {
    await rootConn.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  } finally {
    await rootConn.end();
  }
};

module.exports = {
  OPERATIONAL_MODELS,
  sanitizeDbName,
  provisionHostelDatabase,
  getHostelConnection,
  closeHostelConnection,
  dropHostelDatabase,
  seedHostelMeta,
};
