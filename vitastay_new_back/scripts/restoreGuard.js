/**
 * Restore safety: a drill must never land on live master or engine schemas.
 */
const ENGINE = ['mysql', 'sys', 'information_schema', 'performance_schema'];

const isProtectedDatabase = (name, masterName = process.env.DB_NAME || 'nivas_hostel') => {
  const db = String(name || '');
  return ENGINE.includes(db) || db === masterName || db === 'nivas_hostel';
};

const assertDrillTarget = (target, masterName) => {
  if (isProtectedDatabase(target, masterName)) {
    throw new Error(`Refusing drill restore onto protected database "${target}"`);
  }
};

const assertProductionConfirm = ({ confirm, nodeEnv, flags = [] }) => {
  if (confirm !== 'RESTORE') {
    throw new Error('Production restore refused. Pass --mode production --confirm RESTORE');
  }
  if (nodeEnv === 'production' && !flags.includes('--i-am-restoring-production')) {
    throw new Error('Pass --i-am-restoring-production as well when NODE_ENV=production');
  }
};

module.exports = { ENGINE, isProtectedDatabase, assertDrillTarget, assertProductionConfirm };
