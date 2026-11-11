const bcrypt = require('bcrypt');
const config = require('../config');

const hashPassword = async (password) => {
  return bcrypt.hash(password, config.bcryptRounds);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/** Hash only — never store plaintext (IMP-003). */
const passwordFields = async (plain) => ({
  password: await hashPassword(plain),
});

module.exports = { hashPassword, comparePassword, passwordFields };
