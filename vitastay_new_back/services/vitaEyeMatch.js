/**
 * PKG-011 — Gold gate still → cosine match enrol + watchlist → event + notify.
 * v1 phone/tablet stills. No RTSP. Do not auto-lock doors. Hostel-scoped.
 */
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const config = require('../config');
const { FaceEnrollment, FaceWatchlist, FaceEvent, Staff, User, SupervisorHostel } = require('../models');
const { createAuditLog } = require('../helpers/audit');
const { signPrivateUrl } = require('./uploadAccess');
const { encryptEmbedding, decryptEmbedding } = require('./faceCrypto');
const { embedStill, stillJpeg, cosine } = require('./faceEmbed');
const { httpError } = require('./ownerPlan');
const { notifyUser } = require('./notifyService');
const { getNotificationSettings } = require('./notifySettings');

const STILL_ROOT = path.join(__dirname, '..', 'uploads', 'vita-eye');
const LABELS = {
  known_resident: 'Known resident',
  known_staff: 'Known staff',
  blocked: 'Blocked',
  unknown: 'Unknown',
};

const matchThreshold = () => Number(config.vitaEye?.matchThreshold || 0.85);

const round6 = (n) => Math.round((Number(n) || 0) * 1e6) / 1e6;

const stillPublicPath = (hostelId, kind, id) =>
  `/uploads/vita-eye/${hostelId}/${kind}-${id}.jpg`;

const stillAbsPath = (hostelId, kind, id) =>
  path.join(STILL_ROOT, String(hostelId), `${kind}-${id}.jpg`);

const writeKindStill = (hostelId, kind, id, jpeg) => {
  const abs = stillAbsPath(hostelId, kind, id);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, jpeg);
  return stillPublicPath(hostelId, kind, id);
};

const removeKindStill = (hostelId, kind, id) => {
  try {
    fs.rmSync(stillAbsPath(hostelId, kind, id), { force: true });
  } catch {
    // Windows may keep a handle until process exit.
  }
};

const toWatchPublic = (row) => ({
  id: row.id,
  hostel_id: row.hostel_id,
  label: row.label || null,
  reason: row.reason,
  expires_at: row.expires_at || null,
  still_url: row.still_path ? signPrivateUrl(row.still_path) : null,
  created_at: row.created_at,
});

const toEventPublic = (row) => ({
  id: row.id,
  hostel_id: row.hostel_id,
  label: row.label,
  label_text: LABELS[row.label] || row.label,
  confidence: round6(row.confidence),
  threshold: round6(row.threshold),
  match_enrollment_id: row.match_enrollment_id || null,
  match_watchlist_id: row.match_watchlist_id || null,
  gate: row.gate || 'gate',
  still_url: row.still_path ? signPrivateUrl(row.still_path) : null,
  captured_at: row.created_at,
  acked_at: row.acked_at || null,
  ack_note: row.ack_note || null,
  door_lock: false,
});

const assertNoSecrets = (payload) => {
  const blob = JSON.stringify(payload);
  if (/embedding_cipher|embedding_plain|\/uploads\/tenants\//i.test(blob)) {
    httpError(500, 'Face payload leaked a secret');
  }
  return payload;
};

const bestAgainst = (probe, rows, kind) => {
  let best = { score: 0, row: null, kind };
  rows.forEach((row) => {
    try {
      const vector = decryptEmbedding(row.embedding_cipher);
      const score = cosine(probe, vector);
      if (score > best.score) best = { score, row, kind };
    } catch {
      // skip corrupt ciphertext
    }
  });
  return best;
};

const classify = (enrolBest, watchBest, threshold) => {
  if (watchBest.row && watchBest.score >= threshold) {
    return {
      label: 'blocked',
      confidence: watchBest.score,
      match_enrollment_id: null,
      match_watchlist_id: watchBest.row.id,
    };
  }
  if (enrolBest.row && enrolBest.score >= threshold) {
    const personType = enrolBest.row.person_type === 'staff' ? 'known_staff' : 'known_resident';
    return {
      label: personType,
      confidence: enrolBest.score,
      match_enrollment_id: enrolBest.row.id,
      match_watchlist_id: null,
    };
  }
  const confidence = Math.max(enrolBest.score || 0, watchBest.score || 0);
  return {
    label: 'unknown',
    confidence,
    match_enrollment_id: null,
    match_watchlist_id: null,
  };
};

const recipientUsers = async (hostel) => {
  const users = new Map();
  if (hostel.owner_id) {
    const owner = await User.findByPk(hostel.owner_id);
    if (owner) users.set(owner.id, owner);
  }
  const staff = await Staff.findAll({
    where: { hostel_id: hostel.id, status: 'active' },
    include: [{ model: User, as: 'user' }],
  });
  staff.forEach((row) => {
    if (row.user) users.set(row.user.id, row.user);
  });
  const assigned = await SupervisorHostel.findAll({ where: { hostel_id: hostel.id } });
  await Promise.all(assigned.map(async (row) => {
    const user = await User.findByPk(row.supervisor_id);
    if (user) users.set(user.id, user);
  }));
  return [...users.values()];
};

const notifyMatch = async (hostel, event) => {
  const settings = await getNotificationSettings(hostel.id).catch(() => ({ email_enabled: true }));
  const emailOn = settings.email_enabled !== false;
  const labelText = LABELS[event.label] || event.label;
  const title = event.label === 'blocked'
    ? `Blocked person at ${hostel.name}`
    : event.label === 'unknown'
      ? `Unknown person at ${hostel.name}`
      : `${labelText} at ${hostel.name}`;
  const message = `${labelText} at ${event.gate || 'gate'} · confidence ${round6(event.confidence).toFixed(2)}. Doors are not locked.`;
  const type = event.label === 'known_resident' || event.label === 'known_staff' ? 'info' : 'warning';
  const recipients = await recipientUsers(hostel);
  await Promise.all(recipients.map((user) => notifyUser({
    userId: user.id,
    email: emailOn ? user.email : null,
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    title,
    message,
    type,
    kind: 'vita_eye_match',
    entityId: event.id,
    template: emailOn ? 'vitaEyeAlert' : null,
    vars: {
      hostel: hostel.name,
      label: labelText,
      gate: event.gate || 'gate',
      confidence: round6(event.confidence).toFixed(2),
    },
    hours: 1,
    extraData: { hostel_id: hostel.id, label: event.label },
  })));
};

const listWatchlist = async (hostel) => {
  const rows = await FaceWatchlist.findAll({
    where: { hostel_id: hostel.id },
    order: [['id', 'DESC']],
    attributes: { exclude: ['embedding_cipher'] },
  });
  return assertNoSecrets(rows.map(toWatchPublic));
};

const addWatchlist = async ({ hostel, user, body, file, req }) => {
  const reason = String(body?.reason || '').trim();
  if (reason.length < 3) httpError(422, 'Watchlist reason is required (premises security, not a public criminal list)');
  if (!file?.buffer) httpError(422, 'Upload a still (JPEG, PNG, or WebP)');
  const vector = await embedStill(file.buffer);
  const jpeg = await stillJpeg(file.buffer);
  const expiresAt = body?.expires_at ? new Date(body.expires_at) : null;
  if (body?.expires_at && Number.isNaN(expiresAt.getTime())) httpError(422, 'expires_at must be a date');
  const row = await FaceWatchlist.create({
    hostel_id: hostel.id,
    label: String(body?.label || '').trim() || null,
    reason,
    expires_at: expiresAt,
    embedding_cipher: encryptEmbedding(vector),
    created_by: user?.id || null,
  });
  const stillPath = writeKindStill(hostel.id, 'watch', row.id, jpeg);
  await row.update({ still_path: stillPath });
  await createAuditLog({
    userId: user?.id,
    action: 'VITA_EYE_WATCHLIST_ADD',
    entityType: 'face_watchlist',
    entityId: row.id,
    newValues: { hostel_id: hostel.id, reason },
    req,
  });
  return assertNoSecrets(toWatchPublic(row));
};

const removeWatchlist = async ({ hostel, user, watchlistId, req }) => {
  const row = await FaceWatchlist.findOne({ where: { id: watchlistId, hostel_id: hostel.id } });
  if (!row) httpError(404, 'Watchlist row not found');
  removeKindStill(hostel.id, 'watch', row.id);
  await row.destroy();
  await createAuditLog({
    userId: user?.id,
    action: 'VITA_EYE_WATCHLIST_REMOVE',
    entityType: 'face_watchlist',
    entityId: Number(watchlistId),
    oldValues: { hostel_id: hostel.id },
    req,
  });
  return { id: Number(watchlistId), revoked: true };
};

const listEvents = async (hostel) => {
  const rows = await FaceEvent.findAll({
    where: { hostel_id: hostel.id },
    order: [['id', 'DESC']],
    limit: 50,
  });
  return assertNoSecrets(rows.map(toEventPublic));
};

const captureStill = async ({ hostel, user, body, file, req }) => {
  const started = Date.now();
  if (!file?.buffer) httpError(422, 'Upload a gate still (JPEG, PNG, or WebP)');
  const threshold = matchThreshold();
  const probe = await embedStill(file.buffer);
  const jpeg = await stillJpeg(file.buffer);
  const enrols = await FaceEnrollment.findAll({ where: { hostel_id: hostel.id } });
  const watches = await FaceWatchlist.findAll({
    where: {
      hostel_id: hostel.id,
      [Op.or]: [{ expires_at: { [Op.is]: null } }, { expires_at: { [Op.gt]: new Date() } }],
    },
  });
  const decision = classify(bestAgainst(probe, enrols, 'enrol'), bestAgainst(probe, watches, 'watch'), threshold);
  const event = await FaceEvent.create({
    hostel_id: hostel.id,
    label: decision.label,
    confidence: round6(decision.confidence),
    threshold,
    match_enrollment_id: decision.match_enrollment_id,
    match_watchlist_id: decision.match_watchlist_id,
    gate: String(body?.gate || 'gate').trim().slice(0, 80) || 'gate',
    captured_by: user?.id || null,
  });
  const stillPath = writeKindStill(hostel.id, 'evt', event.id, jpeg);
  await event.update({ still_path: stillPath });
  try {
    await notifyMatch(hostel, event);
    await event.update({ notified_at: new Date() });
  } catch (err) {
    const logger = require('../config/logger');
    logger.warn(`Vita Eye notify skipped: ${err.message}`);
  }
  await createAuditLog({
    userId: user?.id,
    action: 'VITA_EYE_CAPTURE',
    entityType: 'face_event',
    entityId: event.id,
    newValues: { hostel_id: hostel.id, label: event.label, door_lock: false },
    req,
  });
  const elapsedMs = Date.now() - started;
  return assertNoSecrets({
    ...toEventPublic(event),
    elapsed_ms: elapsedMs,
    notified: Boolean(event.notified_at),
  });
};

const ackEvent = async ({ hostel, user, eventId, body, req }) => {
  const event = await FaceEvent.findOne({ where: { id: eventId, hostel_id: hostel.id } });
  if (!event) httpError(404, 'Event not found');
  const note = String(body?.note || body?.ack_note || 'not a match').trim() || 'not a match';
  await event.update({
    acked_at: new Date(),
    acked_by: user?.id || null,
    ack_note: note.slice(0, 500),
  });
  await createAuditLog({
    userId: user?.id,
    action: 'VITA_EYE_ACK',
    entityType: 'face_event',
    entityId: event.id,
    newValues: { hostel_id: hostel.id, ack_note: event.ack_note, door_lock: false },
    req,
  });
  return assertNoSecrets(toEventPublic(event));
};

module.exports = {
  LABELS,
  matchThreshold,
  captureStill,
  listEvents,
  ackEvent,
  listWatchlist,
  addWatchlist,
  removeWatchlist,
};
