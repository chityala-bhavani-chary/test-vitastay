/**
 * Restore a backup directory created by scripts/backup.js.
 * Drill mode loads one dump into a throwaway database.
 * Production mode refuses to run without --confirm RESTORE and never uses db:seed.
 */
require('./loadEnv');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const mysql = require('mysql2/promise');
const { findBin } = require('./mysqlBin');
const { connectionConfig } = require('./opsDb');
const { ENGINE, assertDrillTarget, assertProductionConfirm } = require('./restoreGuard');

const arg = (flag, fallback) => {
  const idx = process.argv.indexOf(flag);
  return idx === -1 ? fallback : process.argv[idx + 1];
};

const mode = arg('--mode', 'drill');
const latestFile = path.join(__dirname, '..', 'backups', 'latest.txt');
const defaultDir = fs.existsSync(latestFile) ? fs.readFileSync(latestFile, 'utf8').trim() : '';
const dirArg = arg('--dir', defaultDir);
const target = arg('--target', 'nivas_hostel_restore_drill');
const confirm = arg('--confirm', '');
const dropAfter = process.argv.includes('--drop-after');
const masterName = process.env.DB_NAME || 'nivas_hostel';

try {
  if (mode === 'production') {
    assertProductionConfirm({
      confirm,
      nodeEnv: process.env.NODE_ENV,
      flags: process.argv,
    });
  } else if (mode === 'drill') {
    assertDrillTarget(target, masterName);
  } else {
    throw new Error(`Unknown --mode ${mode}`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

if (!dirArg || !fs.existsSync(dirArg)) {
  console.error('Usage: node scripts/restore.js --dir <backup-folder> --mode drill --target nivas_hostel_restore_drill');
  process.exit(1);
}
const dir = path.resolve(dirArg);

const { host: dbHost, port: dbPort, user: dbUser, password: dbPassword } = connectionConfig();

const mysqlCli = findBin('mysql');
const PROTECTED = new Set(ENGINE);

const mysqlArgs = ['-h', dbHost, '-P', String(dbPort), '-u', dbUser];

const runMysql = (args, input) => execFileSync(mysqlCli, args, {
  input,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, MYSQL_PWD: dbPassword },
});

const sqlFiles = () => fs.readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => path.join(dir, name));

const restoreFile = (file, database) => {
  const sql = fs.readFileSync(file, 'utf8');
  runMysql([...mysqlArgs, database], sql);
};

(async () => {
  if (mode === 'production') {
    assertProductionConfirm({
      confirm,
      nodeEnv: process.env.NODE_ENV,
      flags: process.argv,
    });
    for (const file of sqlFiles()) {
      const dbName = path.basename(file, '.sql');
      if (PROTECTED.has(dbName)) continue;
      console.log('Restoring', dbName);
      runMysql([...mysqlArgs, '-e', `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`]);
      restoreFile(file, dbName);
    }
    const uploadsArchive = path.join(dir, 'uploads.tgz');
    const uploadsCopy = path.join(dir, 'uploads');
    const uploadsDest = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsArchive)) {
      execFileSync('tar', ['-xzf', uploadsArchive, '-C', path.join(__dirname, '..')]);
      console.log('Restored uploads/ from tarball');
    } else if (fs.existsSync(uploadsCopy)) {
      fs.cpSync(uploadsCopy, uploadsDest, { recursive: true });
      console.log('Restored uploads/ from folder copy');
    }
    console.log('Production restore finished. Verify /api/health and a login before announcing.');
    return;
  }

  if (mode !== 'drill') {
    throw new Error(`Unknown --mode ${mode}`);
  }
  assertDrillTarget(target, masterName);

  const dumps = sqlFiles();
  const named = (name) => dumps.find((file) => path.basename(file) === name);
  const dumpFlag = arg('--dump', '');
  const dumpFile = dumpFlag
    ? named(dumpFlag.endsWith('.sql') ? dumpFlag : `${dumpFlag}.sql`)
    : null;
  const masterDump = dumpFile
    || named(`${masterName}.sql`)
    || named('nivas_hostel.sql')
    || named('nivas_hostel_test.sql')
    || dumps.find((file) => !path.basename(file).startsWith('vitastay_'))
    || dumps[0];
  if (!masterDump) throw new Error(`No .sql dumps in ${dir}`);

  const conn = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
  });
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${target}\``);
    await conn.query(`CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (err) {
    const msg = String(err.message || err);
    if (/access denied/i.test(msg)) {
      throw new Error(
        `${msg}. Drill CREATE DATABASE needs MYSQL_BACKUP_USER or MYSQL_ROOT_USER — nivas_user is scoped to nivas_hostel.* only.`
      );
    }
    throw err;
  } finally {
    await conn.end();
  }

  restoreFile(masterDump, target);
  const verify = runMysql([...mysqlArgs, target, '-N', '-e', 'SHOW TABLES']);
  const tables = verify.split(/\s+/).filter(Boolean);
  console.log(`Drill restore of ${path.basename(masterDump)} → ${target} (${tables.length} tables)`);
  console.log(tables.slice(0, 12).join(', ') + (tables.length > 12 ? ', …' : ''));

  if (!tables.includes('users') && !tables.includes('hostels')) {
    throw new Error('Restore drill failed: expected users or hostels table');
  }

  if (dropAfter) {
    const dropConn = await mysql.createConnection({
      host: dbHost, port: dbPort, user: dbUser, password: dbPassword,
    });
    try {
      await dropConn.query(`DROP DATABASE IF EXISTS \`${target}\``);
      console.log(`Dropped drill database ${target}`);
    } finally {
      await dropConn.end();
    }
  } else {
    console.log(`Leave ${target} in place, or re-run with --drop-after`);
  }
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
