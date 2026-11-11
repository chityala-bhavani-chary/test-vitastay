/**
 * Locate mysql / mysqldump on Windows MariaDB installs and typical Linux paths.
 */
const fs = require('fs');
const path = require('path');

const CANDIDATE_DIRS = [
  process.env.MYSQL_BIN,
  'C:\\Program Files\\MariaDB 13.0\\bin',
  'C:\\Program Files\\MariaDB 11.4\\bin',
  'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin',
  '/usr/bin',
  '/usr/local/bin',
  '/usr/local/mysql/bin',
].filter(Boolean);

const findBin = (name) => {
  const exe = process.platform === 'win32' && !name.endsWith('.exe') ? `${name}.exe` : name;
  for (const dir of CANDIDATE_DIRS) {
    const candidate = path.join(dir, exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  return name;
};

module.exports = { findBin };
