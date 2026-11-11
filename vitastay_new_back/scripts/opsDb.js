/**
 * Credentials for backup/restore. Prefer an explicit dump account, then MySQL root,
 * then the same development defaults Sequelize uses (nivas_user / nivas_pass).
 */
require('./loadEnv');

const credentials = () => {
  if (process.env.MYSQL_BACKUP_USER) {
    return {
      user: process.env.MYSQL_BACKUP_USER,
      password: process.env.MYSQL_BACKUP_PASSWORD ?? '',
    };
  }
  if (process.env.MYSQL_ROOT_USER || process.env.MYSQL_ROOT_PASSWORD !== undefined) {
    return {
      user: process.env.MYSQL_ROOT_USER || 'root',
      password: process.env.MYSQL_ROOT_PASSWORD ?? '',
    };
  }
  return {
    user: process.env.DB_USER || 'nivas_user',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'nivas_pass',
  };
};

const connectionConfig = () => ({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  ...credentials(),
});

module.exports = { credentials, connectionConfig };
