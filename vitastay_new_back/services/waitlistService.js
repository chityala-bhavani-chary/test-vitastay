/**
 * BIC-028 — notify me when a sharing type opens. One row per user+hostel+type.
 * Auto-expire 30 days. Opt-in email (default) / WhatsApp stub.
 */
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const config = require('../config');
const {
  ListingWaitlist, Hostel, ListingProjection, ListingAvailability, User,
} = require('../models');
const { sendEmail, wrapHtml, esc } = require('./emailService');

const ROOM_TYPES = new Set(['single', 'double', 'triple', 'dormitory']);
const TTL_DAYS = 30;

const httpError = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  throw err;
};

const expireStale = async (whereExtra = {}) => {
  const n = await ListingWaitlist.update(
    { status: 'expired' },
    {
      where: {
        status: 'active',
        expires_at: { [Op.lt]: new Date() },
        ...whereExtra,
      },
    }
  );
  return n[0] || 0;
};

const serialize = (row, hostel = null) => ({
  id: row.id,
  hostel_id: row.hostel_id,
  code: hostel?.code || null,
  name: hostel?.name || null,
  room_type: row.room_type,
  status: row.status,
  notify_email: Boolean(row.notify_email),
  notify_whatsapp: Boolean(row.notify_whatsapp),
  expires_at: row.expires_at,
  notified_at: row.notified_at,
  created_at: row.created_at,
});

const findHostel = async (idOrCode) => {
  const raw = String(idOrCode || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Hostel.findByPk(raw);
  return Hostel.findOne({ where: { code: { [Op.eq]: raw } } });
};

const assertPublished = async (hostel) => {
  if (!hostel) httpError(404, 'Listing not found');
  const projection = await ListingProjection.findOne({
    where: { hostel_id: hostel.id, is_public: true, marketplace_ok: true },
  });
  if (!projection) httpError(422, 'Only published listings can be waitlisted');
  return projection;
};

const bedsForType = async (hostelId, roomType) => {
  const row = await ListingAvailability.findOne({
    where: { hostel_id: hostelId, room_type: roomType },
  });
  return Number(row?.beds_available) || 0;
};

const join = async (userId, { hostel_id, code, room_type, notify_email, notify_whatsapp, phone }) => {
  await expireStale({ user_id: userId });
  const type = String(room_type || '').trim().toLowerCase();
  if (!ROOM_TYPES.has(type)) httpError(422, 'room_type must be single, double, triple, or dormitory');

  const hostel = await findHostel(hostel_id || code);
  await assertPublished(hostel);

  const vacant = await bedsForType(hostel.id, type);
  if (vacant > 0) {
    httpError(422, 'Beds are already available for this type — book now instead of joining the waitlist');
  }

  const emailOn = notify_email === false || notify_email === 'false' ? false : true;
  const waOn = notify_whatsapp === true || notify_whatsapp === 'true' || notify_whatsapp === 1;
  if (!emailOn && !waOn) httpError(422, 'Enable email or WhatsApp notifications');

  const expiresAt = dayjs().add(TTL_DAYS, 'day').toDate();
  const existing = await ListingWaitlist.findOne({
    where: { user_id: userId, hostel_id: hostel.id, room_type: type },
  });

  if (existing) {
    if (existing.status === 'active' && dayjs(existing.expires_at).isAfter(dayjs())) {
      await existing.update({
        notify_email: emailOn,
        notify_whatsapp: waOn,
        phone: waOn ? String(phone || '').trim().slice(0, 20) || existing.phone : existing.phone,
      });
      return { ...serialize(existing, hostel), joined: true, created: false };
    }
    await existing.update({
      status: 'active',
      notify_email: emailOn,
      notify_whatsapp: waOn,
      phone: waOn ? String(phone || '').trim().slice(0, 20) || null : null,
      expires_at: expiresAt,
      notified_at: null,
    });
    return { ...serialize(existing, hostel), joined: true, created: false };
  }

  const row = await ListingWaitlist.create({
    user_id: userId,
    hostel_id: hostel.id,
    room_type: type,
    notify_email: emailOn,
    notify_whatsapp: waOn,
    phone: waOn ? String(phone || '').trim().slice(0, 20) || null : null,
    status: 'active',
    expires_at: expiresAt,
  });
  return { ...serialize(row, hostel), joined: true, created: true };
};

const leave = async (userId, { hostel_id, code, room_type, id }) => {
  let row = null;
  if (id) {
    row = await ListingWaitlist.findOne({ where: { id: Number(id), user_id: userId } });
  } else {
    const type = String(room_type || '').trim().toLowerCase();
    const hostel = await findHostel(hostel_id || code);
    if (!hostel || !ROOM_TYPES.has(type)) httpError(404, 'Waitlist entry not found');
    row = await ListingWaitlist.findOne({
      where: { user_id: userId, hostel_id: hostel.id, room_type: type },
    });
  }
  if (!row) httpError(404, 'Waitlist entry not found');
  await row.update({ status: 'cancelled' });
  return { removed: true, id: row.id };
};

const listForUser = async (userId) => {
  await expireStale({ user_id: userId });
  const rows = await ListingWaitlist.findAll({
    where: { user_id: userId, status: { [Op.in]: ['active', 'notified'] } },
    order: [['created_at', 'DESC']],
  });
  const hostels = await Hostel.findAll({
    where: { id: { [Op.in]: rows.map((r) => r.hostel_id) } },
    attributes: ['id', 'code', 'name'],
  });
  const byId = new Map(hostels.map((h) => [h.id, h]));
  return {
    items: rows.map((row) => serialize(row, byId.get(row.hostel_id))),
    ttl_days: TTL_DAYS,
  };
};

const statusForListing = async (userId, hostelId) => {
  if (!userId || !hostelId) return { items: [] };
  await expireStale({ user_id: userId, hostel_id: hostelId });
  const rows = await ListingWaitlist.findAll({
    where: { user_id: userId, hostel_id: hostelId, status: 'active' },
  });
  return {
    items: rows.map((row) => ({
      room_type: row.room_type,
      expires_at: row.expires_at,
      notify_email: Boolean(row.notify_email),
      notify_whatsapp: Boolean(row.notify_whatsapp),
    })),
  };
};

const sendWaitlistNotice = async (entry, hostel, roomType, vacantBeds) => {
  const user = entry.user || await User.findByPk(entry.user_id);
  if (!user) return;
  const label = String(roomType).replace(/^\w/, (c) => c.toUpperCase());
  const listingUrl = `${config.appUrl}/listings/${encodeURIComponent(hostel.code || hostel.id)}`;

  if (entry.notify_email && user.email) {
    await sendEmail({
      to: user.email,
      subject: `Bed open · ${hostel.name} (${label})`,
      html: wrapHtml('A bed opened', `
        <p>Hi ${esc(user.first_name) || 'there'},</p>
        <p><strong>${esc(label)}</strong> at <strong>${esc(hostel.name)}</strong> now has
        <strong>${esc(vacantBeds)}</strong> bed${vacantBeds === 1 ? '' : 's'} available.</p>
        <p><a href="${esc(listingUrl)}">Open listing and book</a></p>
        <p style="color:#6B7C8F;font-size:12px;">You asked to be notified. This alert expires after one send.</p>
      `),
    });
  }

  if (entry.notify_whatsapp) {
    const phone = entry.phone || user.phone;
    if (config.sms?.apiKey && phone) {
      logger.info(`Waitlist WhatsApp/SMS stub to ${phone}: ${label} open at ${hostel.code}`);
    } else {
      logger.info(`Waitlist WhatsApp skipped (no SMS_API_KEY or phone): user ${user.id} ${hostel.code}/${roomType}`);
    }
  }
};

/**
 * After availability projection — notify active waiters when a type has vacant beds.
 */
const notifyOnAvailability = async (hostelId, inventory) => {
  await expireStale({ hostel_id: hostelId });
  const hostel = await Hostel.findByPk(hostelId);
  if (!hostel) return { notified: 0 };
  const types = (inventory?.roomTypes || inventory?.occupancy || [])
    .filter((row) => (Number(row.vacantBeds ?? row.beds_available) || 0) > 0);

  let notified = 0;
  for (const row of types) {
    const vacant = Number(row.vacantBeds ?? row.beds_available) || 0;
    const waiters = await ListingWaitlist.findAll({
      where: {
        hostel_id: hostelId,
        room_type: row.room_type,
        status: 'active',
        expires_at: { [Op.gte]: new Date() },
      },
      include: [{ model: User, as: 'user', attributes: ['id', 'email', 'phone', 'first_name', 'last_name'] }],
    });
    for (const entry of waiters) {
      try {
        await sendWaitlistNotice(entry, hostel, row.room_type, vacant);
        await entry.update({ status: 'notified', notified_at: new Date() });
        notified += 1;
      } catch (err) {
        logger.warn(`Waitlist notify failed id=${entry.id}: ${err.message}`);
      }
    }
  }
  return { notified };
};

module.exports = {
  TTL_DAYS,
  join,
  leave,
  listForUser,
  statusForListing,
  notifyOnAvailability,
  expireStale,
};
