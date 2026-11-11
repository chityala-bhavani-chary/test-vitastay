/**
 * Write missing ~400px thumbs for existing property_media rows.
 * Safe to re-run. Does not move files to object storage.
 */
require('dotenv').config();
const fs = require('fs');
const {
  absoluteFromPublic,
  writeThumbnail,
  writePanoPreview,
} = require('../services/mediaStorage');

(async () => {
  try {
    const { sequelize, PropertyMedia } = require('../models');
    await sequelize.authenticate();
    const rows = await PropertyMedia.findAll();
    let wrote = 0;
    let skipped = 0;
    for (const row of rows) {
      const abs = absoluteFromPublic(row.file_path);
      if (!abs || !fs.existsSync(abs)) {
        skipped += 1;
        continue;
      }
      const isPano = row.category === 'panorama_360' || row.capture_kind === 'panorama_360';
      const thumb = isPano ? await writePanoPreview(abs) : await writeThumbnail(abs);
      if (thumb.thumbPath && thumb.thumbPath !== row.thumb_path) {
        await row.update({
          thumb_path: thumb.thumbPath,
          width: thumb.width || row.width,
          height: thumb.height || row.height,
        });
        wrote += 1;
      } else {
        skipped += 1;
      }
    }
    console.log(JSON.stringify({ rows: rows.length, wrote, skipped }, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
