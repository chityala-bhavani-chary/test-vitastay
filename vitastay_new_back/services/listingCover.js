/**
 * Exactly one listing thumbnail. Search cards and listing hero use this, not a random interior.
 */
const { publicAssetUrl } = require('./mediaStorage');

const FALLBACK_ORDER = ['exterior', 'interior_common', 'floor', 'room', 'panorama_360'];

const isCoverFlag = (row) => row && (row.is_cover === true || row.is_cover === 1);

const toCoverObject = (row, alt) => {
  if (!row) return null;
  const url = row.file_path || row.url || null;
  if (!url && row.id == null) return null;
  return {
    id: row.id || null,
    url: publicAssetUrl(url),
    thumb_url: publicAssetUrl(row.thumb_path || row.thumb_url || url),
    caption: row.caption || null,
    category: row.category || null,
    alt: row.caption || row.title || row.alt || alt || null,
  };
};

const selectListingCover = (items) => {
  const list = items || [];
  const marked = list.find(isCoverFlag);
  if (marked) return marked;
  for (let i = 0; i < FALLBACK_ORDER.length; i += 1) {
    const hit = list.find((item) => item.category === FALLBACK_ORDER[i]);
    if (hit) return hit;
  }
  return list[0] || null;
};

module.exports = {
  FALLBACK_ORDER,
  isCoverFlag,
  toCoverObject,
  selectListingCover,
};
