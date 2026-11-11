/**
 * BIC-035 — walkthrough_video category + capture_kind=video. Additive ENUM widen.
 * Does not block publish; 360 stays independent.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CATEGORY_ENUM = "ENUM('exterior','interior_common','room','floor','panorama_360','walkthrough_video')";
const KIND_ENUM = "ENUM('photo','panorama_360','video')";

const ensureWalkthroughVideoSchema = async (db = sequelize, log = console.log) => {
  const qi = db.getQueryInterface();
  let cols;
  try {
    cols = await qi.describeTable('property_media');
  } catch {
    log('property_media missing — skip walkthrough video');
    return;
  }

  const catType = String(cols.category?.type || '').toLowerCase();
  if (!catType.includes('walkthrough_video')) {
    await db.query(`ALTER TABLE property_media MODIFY COLUMN category ${CATEGORY_ENUM} NOT NULL`);
    log('Widened property_media.category for walkthrough_video');
  } else {
    log('Skip (exists): property_media.category walkthrough_video');
  }

  const kindType = String(cols.capture_kind?.type || '').toLowerCase();
  if (!kindType.includes('video')) {
    await db.query(`ALTER TABLE property_media MODIFY COLUMN capture_kind ${KIND_ENUM} NOT NULL`);
    log('Widened property_media.capture_kind for video');
  } else {
    log('Skip (exists): property_media.capture_kind video');
  }
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureWalkthroughVideoSchema();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureWalkthroughVideoSchema };
