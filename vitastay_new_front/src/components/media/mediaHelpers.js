export const isPanoramaItem = (item) => (
  item?.category === 'panorama_360' || item?.capture_kind === 'panorama_360'
);

export const isVideoItem = (item) => (
  item?.category === 'walkthrough_video' || item?.capture_kind === 'video'
);

/** Listing grids and search cards use thumbs only. Lightbox / 360 viewer load the original. */
export const listingThumbSrc = (item) => {
  if (isVideoItem(item)) return item?.thumb_url || null;
  return item?.thumb_url || item?.url;
};

export const itemAlt = (item, hostelName, index, total, tabLabel) => {
  if (item?.alt || item?.caption) return item.alt || item.caption;
  const place = hostelName ? ` — ${hostelName}` : '';
  return `${tabLabel} photo ${index + 1} of ${total}${place}`;
};

export const panoramaContext = (item) => ([
  item?.room_number ? `Room ${item.room_number}` : null,
  item?.floor_number ? `Floor ${item.floor_number}` : null,
  item?.category === 'exterior' ? 'Outside' : null,
  item?.category === 'interior_common' ? 'Inside' : null,
].filter(Boolean).join(' · '));

export const sortRecordKeys = (record) =>
  Object.keys(record || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
