/**
 * PKG-010 — Gold face gallery. Hostel-scoped. Consent required. Embeddings encrypted at rest.
 * Privacy / retention is PKG-012. Do not copy KYC (/uploads/tenants).
 */
const fs = require('fs');
const path = require('path');
const { FaceEnrollment, Tenant, Staff, User } = require('../models');
const { createAuditLog } = require('../helpers/audit');
const { signPrivateUrl } = require('./uploadAccess');
const { encryptEmbedding } = require('./faceCrypto');
const { embedStill, stillJpeg } = require('./faceEmbed');
const { httpError } = require('./ownerPlan');
const { CONSENT_COPY, publicPolicy } = require('./vitaEyePrivacy');
const { playbookOf } = require('./vitaEyeSupport');

const PERSON_TYPES = new Set(['resident', 'staff']);
const STILL_ROOT = path.join(__dirname, '..', 'uploads', 'vita-eye');

const truthyConsent = (value) => {
  if (value === true || value === 1) return true;
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
};

const normalizeType = (raw) => {
  const value = String(raw || '').toLowerCase();
  if (value === 'tenant') return 'resident';
  return value;
};

const stillPublicPath = (hostelId, enrollmentId) =>
  `/uploads/vita-eye/${hostelId}/${enrollmentId}.jpg`;

const stillAbsPath = (hostelId, enrollmentId) =>
  path.join(STILL_ROOT, String(hostelId), `${enrollmentId}.jpg`);

const removeStill = (hostelId, enrollmentId) => {
  try {
    fs.rmSync(stillAbsPath(hostelId, enrollmentId), { force: true });
  } catch {
    // Windows may hold the handle until process exit.
  }
};

const writeStill = (hostelId, enrollmentId, jpeg) => {
  const abs = stillAbsPath(hostelId, enrollmentId);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, jpeg);
  return stillPublicPath(hostelId, enrollmentId);
};

const loadPerson = async (hostel, personType, personId) => {
  const id = Number(personId);
  if (!Number.isInteger(id) || id < 1) httpError(422, 'person_id is required');
  if (personType === 'resident') {
    const tenant = await Tenant.findByPk(id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name'] }],
    });
    if (!tenant || Number(tenant.hostel_id) !== Number(hostel.id)) {
      httpError(422, 'Person is not a resident of this PG');
    }
    if (tenant.status === 'moved_out') httpError(422, 'Moved-out residents cannot be enrolled');
    const name = tenant.full_name
      || [tenant.user?.first_name, tenant.user?.last_name].filter(Boolean).join(' ')
      || `Resident ${tenant.id}`;
    return { id: tenant.id, name, status: tenant.status };
  }
  const staff = await Staff.findByPk(id, {
    include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name'] }],
  });
  if (!staff || Number(staff.hostel_id) !== Number(hostel.id)) {
    httpError(422, 'Person is not staff of this PG');
  }
  const name = [staff.user?.first_name, staff.user?.last_name].filter(Boolean).join(' ')
    || staff.employee_id
    || `Staff ${staff.id}`;
  return { id: staff.id, name, status: staff.status };
};

const toPublic = (row, personName) => ({
  id: row.id,
  hostel_id: row.hostel_id,
  person_type: row.person_type,
  person_id: row.person_id,
  person_name: personName || null,
  consent_at: row.consent_at,
  enrolled_at: row.updated_at || row.created_at,
  still_url: row.still_path ? signPrivateUrl(row.still_path) : null,
});

const assertNoSecrets = (payload) => {
  const blob = JSON.stringify(payload);
  if (/embedding_cipher|embedding_plain|\/uploads\/tenants\//i.test(blob)) {
    httpError(500, 'Face payload leaked a secret');
  }
  return payload;
};

const listEnrollments = async (hostel) => {
  const rows = await FaceEnrollment.findAll({
    where: { hostel_id: hostel.id },
    order: [['updated_at', 'DESC']],
    attributes: { exclude: ['embedding_cipher'] },
  });
  const named = await Promise.all(rows.map(async (row) => {
    try {
      const person = await loadPerson(hostel, row.person_type, row.person_id);
      return toPublic(row, person.name);
    } catch {
      return toPublic(row, null);
    }
  }));
  return assertNoSecrets(named);
};

const enrollPerson = async ({ hostel, user, body, file, req }) => {
  if (!truthyConsent(body?.consent)) {
    httpError(422, 'Written consent is required (DPDP). Tick consent to enrol this person at this PG only.');
  }
  const personType = normalizeType(body?.person_type);
  if (!PERSON_TYPES.has(personType)) httpError(422, 'person_type must be resident or staff');
  if (!file?.buffer) httpError(422, 'Upload a still (JPEG, PNG, or WebP)');

  const person = await loadPerson(hostel, personType, body?.person_id);
  const vector = await embedStill(file.buffer);
  const jpeg = await stillJpeg(file.buffer);
  const cipher = encryptEmbedding(vector);
  const now = new Date();

  let row = await FaceEnrollment.findOne({
    where: { hostel_id: hostel.id, person_type: personType, person_id: person.id },
  });
  if (row) {
    await row.update({
      embedding_cipher: cipher,
      consent_at: now,
      enrolled_by: user?.id || null,
    });
  } else {
    row = await FaceEnrollment.create({
      hostel_id: hostel.id,
      person_type: personType,
      person_id: person.id,
      embedding_cipher: cipher,
      consent_at: now,
      enrolled_by: user?.id || null,
    });
  }
  const stillPath = writeStill(hostel.id, row.id, jpeg);
  await row.update({ still_path: stillPath });
  await createAuditLog({
    userId: user?.id,
    action: 'VITA_EYE_ENROLL',
    entityType: 'face_enrollment',
    entityId: row.id,
    newValues: {
      hostel_id: hostel.id,
      person_type: personType,
      person_id: person.id,
      consent: true,
    },
    req,
  });
  return assertNoSecrets(toPublic(row, person.name));
};

const revokeEnrollment = async ({ hostel, user, enrollmentId, req }) => {
  const row = await FaceEnrollment.findOne({
    where: { id: enrollmentId, hostel_id: hostel.id },
  });
  if (!row) httpError(404, 'Enrolment not found');
  const snapshot = { hostel_id: hostel.id, person_type: row.person_type, person_id: row.person_id };
  removeStill(hostel.id, row.id);
  await row.destroy();
  await createAuditLog({
    userId: user?.id,
    action: 'VITA_EYE_ENROLL_REVOKE',
    entityType: 'face_enrollment',
    entityId: Number(enrollmentId),
    oldValues: snapshot,
    req,
  });
  return { id: Number(enrollmentId), revoked: true };
};

const statusPayload = async (hostel, flags) => {
  const enrollments = await listEnrollments(hostel);
  const match = require('./vitaEyeMatch');
  const watchlist = await match.listWatchlist(hostel);
  const events = await match.listEvents(hostel);
  return {
    ready: true,
    flag: 'vita_eye',
    next: null,
    capture_ready: true,
    door_lock: false,
    threshold: match.matchThreshold(),
    name: hostel.name,
    code: hostel.code,
    plan: flags.plan,
    plan_status: flags.plan_status,
    entitlements: flags,
    enrolled_count: enrollments.length,
    watchlist_count: watchlist.length,
    consent_copy: CONSENT_COPY,
    privacy: publicPolicy(),
    playbook: await playbookOf(hostel),
    enrollments,
    watchlist,
    events,
  };
};

module.exports = {
  CONSENT_COPY,
  enrollPerson,
  listEnrollments,
  revokeEnrollment,
  statusPayload,
  stillAbsPath,
};
