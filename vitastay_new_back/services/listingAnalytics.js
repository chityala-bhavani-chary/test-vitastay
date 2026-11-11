/**
 * BKG-015 — listing funnel events. Privacy-safe: no user_id, email, IP, UA, or KYC.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { ListingEvent, Hostel } = require('../models');
const { loadChecklist, isListingPubliclyVisible } = require('./mediaPublishGuard');
const { entitlementsOf, UPGRADE_COPY } = require('./ownerPlan');
const logger = require('../config/logger');

const PUBLIC_EVENTS = new Set([
  'listing_view',
  'gallery_tab',
  'pano_open',
  'video_open',
  'listing_share_copy',
  'listing_share_whatsapp',
  'listing_share_native',
]);
const BOOKING_EVENTS = new Set(['booking_started', 'booking_paid', 'booking_cancelled']);
const GALLERY_TABS = new Set([
  'all', 'exterior', 'interior_common', 'room', 'floor', 'panorama_360', 'walkthrough_video',
]);

const hashSession = (raw) => {
  const s = String(raw || '').trim().slice(0, 80);
  if (!s) return null;
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
};

const findHostel = async (idOrSlug) => {
  const raw = String(idOrSlug || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Hostel.findByPk(raw);
  return Hostel.findOne({ where: { code: raw } });
};

const loadPublishedHostel = async (idOrSlug) => {
  const hostel = await findHostel(idOrSlug);
  if (!hostel) return null;
  const checklist = await loadChecklist(hostel);
  if (!isListingPubliclyVisible(hostel, checklist)) return null;
  return hostel;
};

const isUniqueErr = (err) => {
  if (!err) return false;
  if (err.name === 'SequelizeUniqueConstraintError') return true;
  const code = err.original?.code || err.parent?.code;
  return code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '');
};

const alreadyRecent = async ({ hostelId, eventType, sessionHash, tabKey, mediaId, hours = 6 }) => {
  if (!sessionHash) return false;
  const where = {
    hostel_id: hostelId,
    event_type: eventType,
    session_hash: sessionHash,
    created_at: { [Op.gte]: dayjs().subtract(hours, 'hour').toDate() },
  };
  if (eventType === 'gallery_tab' && tabKey) where.tab_key = tabKey;
  if ((eventType === 'pano_open' || eventType === 'video_open') && mediaId) where.media_id = mediaId;
  const row = await ListingEvent.findOne({ where, attributes: ['id'] });
  return Boolean(row);
};

const recordPublicEvent = async ({ idOrSlug, event, tab, mediaId, sessionId }) => {
  const type = String(event || '').trim();
  if (!PUBLIC_EVENTS.has(type)) {
    const err = new Error('Unknown event');
    err.statusCode = 422;
    throw err;
  }
  const hostel = await loadPublishedHostel(idOrSlug);
  if (!hostel) {
    const err = new Error('Listing not found');
    err.statusCode = 404;
    throw err;
  }
  const tabKey = type === 'gallery_tab' ? String(tab || '').trim() : null;
  if (type === 'gallery_tab' && !GALLERY_TABS.has(tabKey)) {
    const err = new Error('Unknown gallery tab');
    err.statusCode = 422;
    throw err;
  }
  const sessionHash = hashSession(sessionId);
  const media = (type === 'pano_open' || type === 'video_open') && mediaId ? Number(mediaId) : null;
  const hours = type === 'listing_view' ? 6 : (type === 'pano_open' || type === 'video_open') ? 0.05 : 0.02;
  if (await alreadyRecent({
    hostelId: hostel.id,
    eventType: type,
    sessionHash,
    tabKey,
    mediaId: media,
    hours,
  })) {
    return { recorded: false, hostel_id: hostel.id };
  }
  await ListingEvent.create({
    hostel_id: hostel.id,
    event_type: type,
    session_hash: sessionHash,
    tab_key: tabKey,
    media_id: Number.isFinite(media) ? media : null,
  });
  return { recorded: true, hostel_id: hostel.id };
};

const recordBookingEvent = async (booking, eventType) => {
  try {
    if (!booking?.id || !booking.hostel_id) return false;
    if (!BOOKING_EVENTS.has(eventType)) return false;
    await ListingEvent.create({
      hostel_id: booking.hostel_id,
      event_type: eventType,
      booking_id: booking.id,
    });
    return true;
  } catch (err) {
    if (isUniqueErr(err)) return false;
    logger.warn(`Listing analytics booking event skipped: ${err.message}`);
    return false;
  }
};

const pct = (num, den) => {
  if (!den) return null;
  return Math.round((1000 * Number(num)) / Number(den)) / 10;
};

const emptyCounts = () => ({
  listing_view: 0,
  gallery_tab: 0,
  pano_open: 0,
  booking_started: 0,
  booking_paid: 0,
  booking_cancelled: 0,
  view_sessions: 0,
  pano_sessions: 0,
  gallery_sessions: 0,
});

const decorate = (hostel, counts) => {
  const c = { ...emptyCounts(), ...counts };
  return {
    hostel_id: hostel.id,
    name: hostel.name,
    code: hostel.code,
    views: c.listing_view,
    gallery_tabs: c.gallery_tab,
    pano_opens: c.pano_open,
    bookings_started: c.booking_started,
    paid: c.booking_paid,
    cancelled: c.booking_cancelled,
    view_sessions: c.view_sessions,
    pano_sessions: c.pano_sessions,
    gallery_sessions: c.gallery_sessions,
    pano_open_rate: pct(c.pano_sessions, c.view_sessions),
    gallery_interact_rate: pct(c.gallery_sessions, c.view_sessions),
    conversion_view_to_started: pct(c.booking_started, c.listing_view),
    conversion_started_to_paid: pct(c.booking_paid, c.booking_started),
  };
};

const summarize = async ({ user, hostelId, from, to }) => {
  if (!user?.id) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
  if (!['owner', 'super_admin'].includes(user.role)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const where = {};
  if (user.role === 'owner') where.owner_id = user.id;
  if (hostelId) {
    where.id = Number(hostelId);
    if (!Number.isFinite(where.id)) {
      const err = new Error('Invalid hostel');
      err.statusCode = 422;
      throw err;
    }
  }
  const hostels = await Hostel.findAll({
    where,
    attributes: ['id', 'name', 'code', 'owner_id', 'plan', 'plan_status'],
    order: [['name', 'ASC']],
  });
  if (hostelId && !hostels.length) {
    const err = new Error(user.role === 'owner' ? 'This hostel is not yours' : 'Hostel not found');
    err.statusCode = 403;
    throw err;
  }
  const entitled = hostels.filter((hostel) => entitlementsOf(hostel).listing_analytics);
  if (hostelId && hostels.length && !entitled.length) {
    const err = new Error(UPGRADE_COPY.listing_analytics);
    err.statusCode = 403;
    throw err;
  }
  if (user.role !== 'super_admin' && !entitled.length) {
    const err = new Error(UPGRADE_COPY.listing_analytics);
    err.statusCode = 403;
    throw err;
  }

  const start = from ? dayjs(from).startOf('day') : dayjs().subtract(29, 'day').startOf('day');
  const end = to ? dayjs(to).endOf('day') : dayjs().endOf('day');
  const scoped = entitled;
  const ids = scoped.map((h) => h.id);
  const rows = ids.length
    ? await ListingEvent.findAll({
      where: {
        hostel_id: { [Op.in]: ids },
        created_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      attributes: ['id', 'hostel_id', 'event_type', 'session_hash', 'tab_key'],
    })
    : [];

  const byHostel = new Map();
  ids.forEach((id) => byHostel.set(id, {
    ...emptyCounts(),
    viewSet: new Set(),
    panoSet: new Set(),
    gallerySet: new Set(),
  }));

  rows.forEach((row) => {
    const bucket = byHostel.get(row.hostel_id);
    if (!bucket) return;
    bucket[row.event_type] = (bucket[row.event_type] || 0) + 1;
    if (row.session_hash) {
      if (row.event_type === 'listing_view') bucket.viewSet.add(row.session_hash);
      if (row.event_type === 'pano_open') bucket.panoSet.add(row.session_hash);
      if (row.event_type === 'gallery_tab' && row.tab_key && row.tab_key !== 'all') {
        bucket.gallerySet.add(row.session_hash);
      }
    }
  });

  const hostelsOut = scoped.map((hostel) => {
    const bucket = byHostel.get(hostel.id);
    return decorate(hostel, {
      ...bucket,
      view_sessions: bucket.viewSet.size,
      pano_sessions: bucket.panoSet.size,
      gallery_sessions: bucket.gallerySet.size,
    });
  });

  const totals = hostelsOut.reduce((acc, row) => {
    acc.views += row.views;
    acc.gallery_tabs += row.gallery_tabs;
    acc.pano_opens += row.pano_opens;
    acc.bookings_started += row.bookings_started;
    acc.paid += row.paid;
    acc.cancelled += row.cancelled;
    acc.view_sessions += row.view_sessions;
    acc.pano_sessions += row.pano_sessions;
    acc.gallery_sessions += row.gallery_sessions;
    return acc;
  }, {
    views: 0,
    gallery_tabs: 0,
    pano_opens: 0,
    bookings_started: 0,
    paid: 0,
    cancelled: 0,
    view_sessions: 0,
    pano_sessions: 0,
    gallery_sessions: 0,
  });

  return {
    from: start.format('YYYY-MM-DD'),
    to: end.format('YYYY-MM-DD'),
    pano_open_rate_target: 25,
    totals: {
      ...totals,
      pano_open_rate: pct(totals.pano_sessions, totals.view_sessions),
      gallery_interact_rate: pct(totals.gallery_sessions, totals.view_sessions),
      conversion_view_to_started: pct(totals.bookings_started, totals.views),
      conversion_started_to_paid: pct(totals.paid, totals.bookings_started),
    },
    hostels: hostelsOut,
  };
};

module.exports = {
  PUBLIC_EVENTS,
  BOOKING_EVENTS,
  hashSession,
  recordPublicEvent,
  recordBookingEvent,
  summarize,
};
