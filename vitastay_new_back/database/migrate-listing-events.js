/**
 * Listing funnel events (BKG-015). Additive. Never sequelize.sync({ force: true }).
 * Privacy: no user_id, email, IP, or user-agent. session_hash is a truncated SHA-256.
 */
require('dotenv').config();
const { sequelize } = require('../models');

const CREATE_EVENTS = `
CREATE TABLE IF NOT EXISTS listing_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  event_type ENUM(
    'listing_view',
    'gallery_tab',
    'pano_open',
    'video_open',
    'booking_started',
    'booking_paid',
    'booking_cancelled',
    'listing_share_copy',
    'listing_share_whatsapp',
    'listing_share_native'
  ) NOT NULL,
  session_hash CHAR(32) NULL,
  tab_key VARCHAR(32) NULL,
  media_id INT UNSIGNED NULL,
  booking_id INT UNSIGNED NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_listing_events_hostel_type (hostel_id, event_type, created_at),
  INDEX idx_listing_events_session (session_hash, event_type),
  UNIQUE KEY uq_listing_events_booking_type (booking_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const EVENT_ENUM = "ENUM('listing_view','gallery_tab','pano_open','video_open','booking_started','booking_paid','booking_cancelled','listing_share_copy','listing_share_whatsapp','listing_share_native')";

const ensureListingEventsTable = async (db = sequelize, log = console.log) => {
  await db.query(CREATE_EVENTS);
  try {
    await db.query(`ALTER TABLE listing_events MODIFY COLUMN event_type ${EVENT_ENUM} NOT NULL`);
    log('listing_events.event_type includes share and video');
  } catch (err) {
    log(`listing_events enum widen skipped: ${err.message}`);
  }
  log('listing_events ready');
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await ensureListingEventsTable();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { ensureListingEventsTable };
