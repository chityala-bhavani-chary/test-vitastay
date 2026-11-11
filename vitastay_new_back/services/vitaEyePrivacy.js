/**
 * PKG-012 — DPDP for Vita Eye. Purpose = premises security at that PG.
 * Unknown stills ~30 days. Enrolled faces last for the stay. Embeddings are not sold.
 * Super Admin browse of another PG is audited. No platform-wide face graph.
 */
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const config = require('../config');
const logger = require('../config/logger');
const { FaceEnrollment, FaceWatchlist, FaceEvent, Tenant, Staff } = require('../models');
const { createAuditLog } = require('../helpers/audit');
const { httpError } = require('./ownerPlan');

const POLICY_VERSION = 'pkg-012.v1';
const STILL_ROOT = path.join(__dirname, '..', 'uploads', 'vita-eye');
const POLICY_URL = '/legal/vita-eye';

const CONSENT_COPY =
  'I consent to Vita Stay storing an encrypted face embedding of this person for gate security at this PG only. '
  + 'Embeddings are not sold and are not a platform-wide face graph. '
  + 'Enrolled faces last for the stay. Unknown gate stills are kept about 30 days.';

const POLICY_TEXT = [
  'Vita Eye is for gate security at the PG that enrolled the face. Purpose is premises security, not marketing.',
  'Embeddings stay encrypted on that PG. They are not sold and are not a platform-wide face graph.',
  'Unknown gate stills are kept about 30 days, then deleted.',
  'Enrolled resident and staff faces last for the stay (removed on move-out or when staff leave).',
  'The PG owner can export a record of who is enrolled and recent gate events, or erase this PG’s Vita Eye data on request.',
  'Super Admin access to another PG’s faces is written to the audit log.',
].join(' ');

const unknownRetentionDays = () => {
  const raw = Number(config.vitaEye?.unknownRetentionDays);
  if (!Number.isFinite(raw)) return 30;
  return Math.min(365, Math.max(1, Math.round(raw)));
};

const publicPolicy = () => ({
  version: POLICY_VERSION,
  purpose: 'premises_security',
  sold: false,
  platform_wide_graph: false,
  unknown_retention_days: unknownRetentionDays(),
  enrolled_retention: 'duration_of_stay',
  policy_url: POLICY_URL,
  text: POLICY_TEXT,
});

const stillDir = (hostelId) => path.join(STILL_ROOT, String(hostelId));

const removeRelStill = (rel) => {
  if (!rel) return;
  const abs = path.join(__dirname, '..', String(rel).replace(/^\//, '').replace(/\//g, path.sep));
  try {
    fs.rmSync(abs, { force: true });
  } catch {
    // Windows may keep a handle until process exit.
  }
};

const removeHostelStills = (hostelId) => {
  try {
    fs.rmSync(stillDir(hostelId), { recursive: true, force: true });
  } catch {
    // ignore
  }
};

const assertNoSecrets = (payload) => {
  const blob = JSON.stringify(payload);
  if (/embedding_cipher|embedding_plain|\/uploads\/tenants\//i.test(blob)) {
    httpError(500, 'Face payload leaked a secret');
  }
  return payload;
};

const isOtherPgSuperAdmin = (user, hostel) =>
  user?.role === 'super_admin' && hostel && Number(hostel.owner_id) !== Number(user.id);

const auditSaAccess = async ({ user, hostel, req, kind, extra }) => {
  if (!isOtherPgSuperAdmin(user, hostel)) return;
  await createAuditLog({
    userId: user.id,
    action: 'VITA_EYE_SA_ACCESS',
    entityType: 'hostel',
    entityId: hostel.id,
    newValues: {
      hostel_id: hostel.id,
      kind: kind || 'browse',
      path: extra?.path || String(req?.originalUrl || '').split('?')[0] || null,
    },
    req,
  });
};

const canExport = (user) => ['owner', 'super_admin', 'supervisor'].includes(user?.role);
const canErase = (user) => user?.role === 'owner' || user?.role === 'super_admin';

const revokeEnrollmentRow = async (row) => {
  if (!row) return false;
  if (row.still_path) removeRelStill(row.still_path);
  else {
    try {
      fs.rmSync(path.join(stillDir(row.hostel_id), `${row.id}.jpg`), { force: true });
    } catch {
      // ignore
    }
  }
  await row.destroy();
  return true;
};

const revokeStayForPerson = async ({ hostelId, personType, personId, reason = 'stay_ended' }) => {
  const row = await FaceEnrollment.findOne({
    where: { hostel_id: hostelId, person_type: personType, person_id: personId },
  });
  if (!row) return { revoked: 0 };
  await revokeEnrollmentRow(row);
  await createAuditLog({
    userId: null,
    action: 'VITA_EYE_RETENTION',
    entityType: 'face_enrollment',
    entityId: row.id,
    oldValues: { hostel_id: hostelId, person_type: personType, person_id: personId, reason },
  });
  return { revoked: 1 };
};

const purgeUnknownCaptures = async (now = new Date()) => {
  const cutoff = dayjs(now).subtract(unknownRetentionDays(), 'day').toDate();
  const rows = await FaceEvent.findAll({
    where: { label: 'unknown', createdAt: { [Op.lt]: cutoff } },
  });
  await Promise.all(rows.map(async (row) => {
    removeRelStill(row.still_path);
    await row.destroy();
  }));
  return rows.length;
};

const revokeEndedStays = async () => {
  const enrols = await FaceEnrollment.findAll();
  let revoked = 0;
  await Promise.all(enrols.map(async (row) => {
    if (row.person_type === 'resident') {
      const tenant = await Tenant.findByPk(row.person_id);
      if (!tenant || tenant.status === 'moved_out' || tenant.status === 'inactive'
        || Number(tenant.hostel_id) !== Number(row.hostel_id)) {
        const ok = await revokeEnrollmentRow(row);
        if (ok) revoked += 1;
      }
      return;
    }
    const staff = await Staff.findByPk(row.person_id);
    if (!staff || staff.status === 'inactive' || staff.status === 'terminated'
      || Number(staff.hostel_id) !== Number(row.hostel_id)) {
      const ok = await revokeEnrollmentRow(row);
      if (ok) revoked += 1;
    }
  }));
  return revoked;
};

const runRetention = async (now = new Date()) => {
  const unknown = await purgeUnknownCaptures(now);
  const stayEnded = await revokeEndedStays();
  if (unknown || stayEnded) {
    await createAuditLog({
      userId: null,
      action: 'VITA_EYE_RETENTION',
      entityType: 'vita_eye',
      entityId: 0,
      newValues: { unknown, stay_ended: stayEnded, days: unknownRetentionDays() },
    });
  }
  return { unknown, stay_ended: stayEnded, days: unknownRetentionDays() };
};

const exportHostel = async ({ hostel, user, req }) => {
  if (!canExport(user)) httpError(403, 'Only the PG owner can export Vita Eye records');
  const enroll = require('./vitaEyeEnroll');
  const match = require('./vitaEyeMatch');
  const payload = assertNoSecrets({
    ...publicPolicy(),
    hostel: { id: hostel.id, name: hostel.name, code: hostel.code },
    exported_at: new Date().toISOString(),
    enrollments: await enroll.listEnrollments(hostel),
    watchlist: await match.listWatchlist(hostel),
    events: await match.listEvents(hostel),
  });
  await createAuditLog({
    userId: user?.id,
    action: 'VITA_EYE_EXPORT',
    entityType: 'hostel',
    entityId: hostel.id,
    newValues: {
      hostel_id: hostel.id,
      enrollments: payload.enrollments.length,
      watchlist: payload.watchlist.length,
      events: payload.events.length,
    },
    req,
  });
  return payload;
};

const eraseHostel = async ({ hostel, user, body, req }) => {
  if (!canErase(user)) httpError(403, 'Only the PG owner can erase Vita Eye records');
  const confirmed = body?.confirm === true || body?.confirm === 'true' || body?.confirm === 'erase';
  if (!confirmed) httpError(422, 'Confirm erase with { confirm: true }. This deletes this PG’s enrolments, blocked list, and gate stills.');
  const enrollments = await FaceEnrollment.count({ where: { hostel_id: hostel.id } });
  const watchlist = await FaceWatchlist.count({ where: { hostel_id: hostel.id } });
  const events = await FaceEvent.count({ where: { hostel_id: hostel.id } });
  await FaceEvent.destroy({ where: { hostel_id: hostel.id } });
  await FaceWatchlist.destroy({ where: { hostel_id: hostel.id } });
  await FaceEnrollment.destroy({ where: { hostel_id: hostel.id } });
  removeHostelStills(hostel.id);
  await createAuditLog({
    userId: user?.id,
    action: 'VITA_EYE_ERASE',
    entityType: 'hostel',
    entityId: hostel.id,
    oldValues: { hostel_id: hostel.id, enrollments, watchlist, events },
    req,
  });
  return {
    erased: true,
    enrollments,
    watchlist,
    events,
    sold: false,
  };
};

const startRetentionScheduler = () => {
  const TICK_MS = 6 * 60 * 60 * 1000;
  const run = () => runRetention().catch((err) => {
    logger.warn(`Vita Eye retention skipped: ${err.message}`);
  });
  setTimeout(run, 20000).unref();
  setInterval(run, TICK_MS).unref();
};

module.exports = {
  POLICY_VERSION,
  POLICY_URL,
  POLICY_TEXT,
  CONSENT_COPY,
  publicPolicy,
  unknownRetentionDays,
  auditSaAccess,
  isOtherPgSuperAdmin,
  revokeStayForPerson,
  purgeUnknownCaptures,
  revokeEndedStays,
  runRetention,
  exportHostel,
  eraseHostel,
  startRetentionScheduler,
};
