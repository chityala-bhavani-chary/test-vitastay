/**
 * Creates nivas_hostel database. Optionally creates DB_USER if not root.
 * Supports MySQL with no password (leave MYSQL_ROOT_PASSWORD empty).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const rootUser = process.env.MYSQL_ROOT_USER || 'root';
const rootPassword = process.env.MYSQL_ROOT_PASSWORD ?? '';
const appUser = process.env.DB_USER || 'nivas_user';
const appPassword = process.env.DB_PASSWORD ?? 'nivas_pass';
const dbName = process.env.DB_NAME || 'nivas_hostel';
const useRoot = appUser === 'root';

const setup = async () => {
  let rootConn;
  try {
    rootConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: rootUser,
      password: rootPassword,
      multipleStatements: true,
    });

    console.log(`✓ Connected as MySQL "${rootUser}"${rootPassword === '' ? ' (no password)' : ''}`);

    await rootConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✓ Database "${dbName}" ready`);

    if (!useRoot) {
      await rootConn.query(`DROP USER IF EXISTS '${appUser}'@'localhost'`);
      await rootConn.query(`CREATE USER '${appUser}'@'localhost' IDENTIFIED BY ?`, [appPassword]);
      await rootConn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${appUser}'@'localhost'`);
      await rootConn.query('FLUSH PRIVILEGES');
      console.log(`✓ User "${appUser}" created`);
    } else {
      console.log('✓ Using root user (no separate app user needed)');
    }

    await rootConn.end();

    const appConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: appUser,
      password: appPassword,
      database: dbName,
    });

    await appConn.ping();
    await appConn.end();

    console.log(`✓ Verified login as "${appUser}"`);
    console.log('\nSetup complete. Run: npm run db:seed\n');
    process.exit(0);
  } catch (err) {
    if (rootConn) await rootConn.end().catch(() => {});
    console.error('\n❌ Setup failed:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('MySQL rejected the login. If root has a password, set MYSQL_ROOT_PASSWORD in .env');
    }
    process.exit(1);
  }
};

setup();
