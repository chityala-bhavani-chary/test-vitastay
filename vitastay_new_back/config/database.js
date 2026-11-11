require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'nivas_user',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'nivas_pass',
    database: process.env.DB_NAME || 'nivas_hostel',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
  },
  test: {
    username: process.env.DB_USER || 'nivas_user',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'nivas_pass',
    database: process.env.DB_NAME_TEST || 'nivas_hostel_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    pool: { max: 20, min: 5, acquire: 30000, idle: 10000 },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
  },
};
