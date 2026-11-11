/**
 * Nightly backup: master nivas_hostel, every vitastay_* hostel DB, and uploads/.
 * Does not dump nivas_hostel_test unless --include-test is passed.
 * Never runs sequelize.sync.
 */
require('./loadEnv');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const mysql = require('mysql2/promise');
const { findBin } = require('./mysqlBin');
const { connectionConfig } = require('./opsDb');

const includeTest = process.argv.includes('--include-test');
const outRoot = path.resolve(
  process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : path.join(__dirname, '..', 'backups')
);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(outRoot, stamp);

const { host: dbHost, port: dbPortNum, user: dbUser, password: dbPassword } = connectionConfig();
const dbPort = String(dbPortNum);
const masterName = process.env.DB_NAME || 'nivas_hostel';

const mysqlCli = findBin('mysql');
const dumpCli = findBin('mysqldump');

const run = (bin, args) => execFileSync(bin, args, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, MYSQL_PWD: dbPassword },
});

const listHostelDatabases = async () => {
  const conn = await mysql.createConnection({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPassword,
  });
  try {
    try {
      const [rows] = await conn.query("SHOW DATABASES LIKE 'vitastay\\_%'");
      return rows.map((row) => Object.values(row)[0]).filter(Boolean);
    } catch {
      const [rows] = await conn.query(
        `SELECT DISTINCT database_name AS n FROM \`${masterName}\`.hostels
         WHERE database_name IS NOT NULL AND database_name <> ''`
      );
      return rows.map((row) => row.n).filter(Boolean);
    }
  } finally {
    await conn.end();
  }
};

const dumpDatabase = (name) => {
  const sqlPath = path.join(dest, `${name}.sql`);
  const sql = run(dumpCli, [
    '-h', dbHost,
    '-P', dbPort,
    '-u', dbUser,
    '--single-transaction',
    '--routines',
    '--triggers',
    name,
  ]);
  fs.writeFileSync(sqlPath, sql);
  return sqlPath;
};

const archiveUploads = () => {
  const uploads = path.join(__dirname, '..', 'uploads');
  const archive = path.join(dest, 'uploads.tgz');
  if (!fs.existsSync(uploads)) {
    fs.writeFileSync(path.join(dest, 'uploads-missing.txt'), 'uploads/ did not exist at backup time\n');
    return null;
  }
  try {
    execFileSync('tar', ['-czf', archive, '-C', path.join(__dirname, '..'), 'uploads'], { stdio: 'ignore' });
    return archive;
  } catch {
    const copyDir = path.join(dest, 'uploads');
    fs.cpSync(uploads, copyDir, { recursive: true });
    return copyDir;
  }
};

(async () => {
  fs.mkdirSync(dest, { recursive: true });
  const databases = [masterName];
  if (includeTest) databases.push(process.env.DB_NAME_TEST || 'nivas_hostel_test');
  const hostelDbs = await listHostelDatabases();
  if (!hostelDbs.length) console.log('No vitastay_* hostel databases found');
  databases.push(...hostelDbs);

  const unique = [...new Set(databases)].filter((name) => {
    if (!includeTest && String(name).endsWith('_test')) return false;
    if (!includeTest && String(name).includes('_restore_drill')) return false;
    return true;
  });

  const dumped = [];
  for (const name of unique) {
    try {
      dumped.push(dumpDatabase(name));
      console.log('Dumped', name);
    } catch (err) {
      if (name === masterName) {
        console.error(`Master dump failed for ${name}: ${err.message}`);
        process.exit(1);
      }
      console.warn(`Skip ${name}: ${err.message}`);
    }
  }

  const uploads = archiveUploads();
  console.log(uploads ? `Archived uploads → ${path.basename(uploads)}` : 'uploads/ missing');
  const manifest = [
    `created: ${new Date().toISOString()}`,
    `host: ${dbHost}:${dbPort}`,
    `user: ${dbUser}`,
    `databases: ${unique.join(', ')}`,
    `files: ${dumped.map((file) => path.basename(file)).join(', ')}`,
    `uploads: ${uploads ? path.basename(uploads) : 'none'}`,
    'restore: node scripts/restore.js --dir <this-folder> --mode drill --target nivas_hostel_restore_drill',
    'production restore requires --mode production --confirm RESTORE',
  ].join('\n');
  fs.writeFileSync(path.join(dest, 'MANIFEST.txt'), `${manifest}\n`);
  fs.writeFileSync(path.join(outRoot, 'latest.txt'), dest);
  console.log(`Backup written to ${dest}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
