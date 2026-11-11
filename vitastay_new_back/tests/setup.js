/**
 * Creates nivas_hostel_test and reseeds it. Never targets nivas_hostel / production.
 */
const mysql = require('mysql2/promise');
const { resetAndSeed, assertSafeTestDatabase } = require('./helpers/fixtures');

const skipReset = () => {
  try {
    const file = String(expect.getState().testPath || '');
    return /legacyMedia|preflight|restoreGuard|paymentGateway|mailQueue|notifyTemplates|brand|dockerCompose|mediaStorage|mediaCache|listingCover|mediaQaContract|pwaContract/.test(file);
  } catch {
    return false;
  }
};

const openMysql = async (user, password) => {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  try {
    return await mysql.createConnection({ host, port, user, password });
  } catch {
    return null;
  }
};

const ensureTestDatabase = async () => {
  const dbName = process.env.DB_NAME_TEST || 'nivas_hostel_test';
  const appUser = process.env.DB_USER || 'nivas_user';
  const rootUser = process.env.MYSQL_ROOT_USER || 'root';
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD ?? '';

  let admin = await openMysql(rootUser, rootPassword);
  if (!admin && rootPassword !== '') admin = await openMysql(rootUser, '');
  if (!admin) {
    throw new Error(
      `Cannot create ${dbName}. Start MariaDB/MySQL and allow ${rootUser} to CREATE DATABASE.`
    );
  }

  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    if (appUser !== 'root') {
      try {
        await admin.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${appUser}'@'localhost'`);
        await admin.query('FLUSH PRIVILEGES');
      } catch (err) {
        console.warn(`Test DB grant warning: ${err.message}`);
      }
    }
  } finally {
    await admin.end();
  }
};

beforeAll(async () => {
  if (skipReset()) return;
  await ensureTestDatabase();
  const { sequelize } = require('../models');
  assertSafeTestDatabase(sequelize);
  await sequelize.authenticate();
  global.__erp = await resetAndSeed();
}, 90000);

afterAll(async () => {
  const { cleanupTestUploads } = require('./helpers/mediaTest');
  cleanupTestUploads([global.__erp?.hostel?.id, global.__erp?.pendingHostel?.id]);
  const isolated = global.__erpIsolatedDb;
  if (isolated) {
    try {
      const { dropHostelDatabase } = require('../services/hostelDatabase');
      await dropHostelDatabase(isolated);
    } catch (err) {
      console.warn(`Could not drop test isolated DB ${isolated}: ${err.message}`);
    }
  }
  try {
    const { sequelize } = require('../models');
    await sequelize.close();
  } catch {
    // already closed
  }
});
