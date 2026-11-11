/**
 * BKG-010 — at most one active assignment per bed.
 * MySQL has no partial unique indexes. A generated active_flag is 1 while
 * status = active and NULL otherwise, so UNIQUE (bed_id, active_flag)
 * allows many vacated rows and only one occupant. (MariaDB rejects
 * referencing bed_id inside a generated column — same shape as cover_flag.)
 */
require('dotenv').config();
const { sequelize } = require('../models');

const COLUMN_SQL = `
  ALTER TABLE bed_assignments
  ADD COLUMN active_flag TINYINT UNSIGNED
  GENERATED ALWAYS AS (IF(status = 'active', 1, NULL)) VIRTUAL
`;

const isDuplicate = (err) => {
  const msg = String(err?.message || '');
  return err?.original?.code === 'ER_DUP_FIELDNAME'
    || err?.original?.code === 'ER_DUP_KEYNAME'
    || err?.original?.code === 'ER_DUP_ENTRY'
    || /duplicate (column|key|entry)/i.test(msg);
};

const tableColumns = async (sequelize, table) => {
  try {
    return await sequelize.getQueryInterface().describeTable(table);
  } catch {
    return null;
  }
};

const indexNames = async (sequelize, table) => {
  try {
    const [rows] = await sequelize.query(`SHOW INDEX FROM \`${table}\``);
    return (rows || []).map((row) => String(row.Key_name || row.key_name || ''));
  } catch {
    return [];
  }
};

const ensureActiveAssignmentUnique = async (db = sequelize, log = console.log) => {
  const cols = await tableColumns(db, 'bed_assignments');
  if (!cols) return;

  if (!cols.active_flag) {
    try {
      await db.query(COLUMN_SQL);
      log('bed_assignments.active_flag generated');
    } catch (err) {
      if (!isDuplicate(err)) throw err;
    }
  }

  const names = await indexNames(db, 'bed_assignments');
  if (names.includes('uq_bed_assignments_active_bed')) return;
  try {
    await db.query(
      'CREATE UNIQUE INDEX uq_bed_assignments_active_bed ON bed_assignments (bed_id, active_flag)'
    );
    log('uq_bed_assignments_active_bed');
  } catch (err) {
    if (isDuplicate(err)) return;
    log(`unique active bed skipped: ${err.message}`);
  }
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureActiveAssignmentUnique();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureActiveAssignmentUnique };
