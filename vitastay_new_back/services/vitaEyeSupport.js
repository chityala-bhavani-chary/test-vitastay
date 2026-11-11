/**
 * PKG-014 — Gold application support. Playbook + SA queue.
 * Not a separate SKU. Enrol failures / last-capture-too-old.
 */
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const config = require('../config');
const { Hostel, Tenant, FaceEnrollment, FaceEvent, FaceWatchlist } = require('../models');
const { entitlementsOf } = require('./ownerPlan');

const PLAYBOOK_VERSION = 'pkg-014.v1';

const PLAYBOOK = {
  version: PLAYBOOK_VERSION,
  title: 'Turn on Vita Eye',
  sku: 'gold',
  body: [
    'Vita Eye is included in Gold. It is not a separate product.',
    '1. Enrol current residents of this PG, with consent. Staff who work the gate should be enrolled too.',
    '2. Add a blocked list for people who must not enter. This is premises security, not a public criminal database.',
    '3. Capture one still from the phone or tablet at the gate. Owner and staff should get a notice within 30 seconds.',
    '4. Open Notifications and confirm that notice arrived. If it did not, check Settings → Notifications.',
    'Doors are never locked. Embeddings are not sold. Super Admin can see this PG’s faces only with an audit log.',
  ].join(' '),
};

const staleCaptureHours = () => {
  const raw = Number(config.vitaEye?.staleCaptureHours);
  if (!Number.isFinite(raw)) return 24;
  return Math.min(168, Math.max(1, Math.round(raw)));
};

const activeResidentCount = async (hostelId) => Tenant.count({
  where: {
    hostel_id: hostelId,
    status: { [Op.notIn]: ['moved_out', 'inactive'] },
  },
});

const enrolledResidentCount = async (hostelId) => FaceEnrollment.count({
  where: { hostel_id: hostelId, person_type: 'resident' },
});

const healthOf = async (hostel) => {
  const flags = entitlementsOf(hostel);
  const residents = await activeResidentCount(hostel.id);
  const enrolledResidents = await enrolledResidentCount(hostel.id);
  const enrolledCount = await FaceEnrollment.count({ where: { hostel_id: hostel.id } });
  const watchlistCount = await FaceWatchlist.count({ where: { hostel_id: hostel.id } });
  const lastEvent = await FaceEvent.findOne({
    where: { hostel_id: hostel.id },
    order: [['id', 'DESC']],
    attributes: ['id', 'label', 'notified_at', 'createdAt'],
  });
  const lastCapturedAt = lastEvent?.createdAt || lastEvent?.created_at || null;
  const hours = staleCaptureHours();
  const stale = Boolean(lastCapturedAt)
    && dayjs(lastCapturedAt).isBefore(dayjs().subtract(hours, 'hour'));
  const enrolDone = enrolledResidents >= residents;
  const captureDone = Boolean(lastEvent);
  const notifyDone = Boolean(lastEvent?.notified_at);
  const watchDone = watchlistCount > 0;
  const issues = [];
  if (residents > 0 && enrolledResidents === 0) issues.push('enrol_failure');
  else if (!enrolDone) issues.push('enrol_gap');
  if (!captureDone) issues.push('never_captured');
  else if (stale) issues.push('stale_capture');
  if (captureDone && !notifyDone) issues.push('notify_unconfirmed');

  const steps = [
    {
      id: 'enrol_residents',
      label: 'Enrol current residents',
      done: enrolDone,
      detail: `${enrolledResidents} of ${residents} residents enrolled`,
    },
    {
      id: 'watchlist',
      label: 'Add a blocked list',
      done: watchDone,
      recommended: true,
      detail: watchDone ? `${watchlistCount} blocked` : 'Add people who must not enter this PG',
    },
    {
      id: 'test_capture',
      label: 'Test one capture',
      done: captureDone,
      detail: lastCapturedAt
        ? `Last capture ${dayjs(lastCapturedAt).format('DD MMM YYYY HH:mm')}`
        : 'Capture a still from the phone or tablet',
    },
    {
      id: 'confirm_notify',
      label: 'Confirm a notification arrived',
      done: notifyDone,
      detail: notifyDone ? 'Owner/staff were notified' : 'Open Notifications after a test capture',
    },
  ];

  return {
    hostel_id: hostel.id,
    name: hostel.name,
    code: hostel.code,
    plan: flags.plan,
    plan_status: flags.plan_status,
    vita_eye: flags.vita_eye,
    residents,
    enrolled_residents: enrolledResidents,
    enrolled_count: enrolledCount,
    watchlist_count: watchlistCount,
    last_captured_at: lastCapturedAt,
    last_label: lastEvent?.label || null,
    notified: notifyDone,
    stale,
    stale_hours: hours,
    issues,
    steps,
    ready: enrolDone && captureDone && notifyDone,
  };
};

const playbookOf = async (hostel) => {
  const checklist = await healthOf(hostel);
  return {
    ...PLAYBOOK,
    stale_hours: checklist.stale_hours,
    checklist,
  };
};

const supportQueue = async () => {
  const hostels = await Hostel.findAll({
    where: {
      plan: 'gold',
      plan_status: { [Op.in]: ['active', 'comp', 'grace'] },
    },
    order: [['name', 'ASC']],
    attributes: ['id', 'name', 'code', 'plan', 'plan_status', 'owner_id'],
  });
  const rows = [];
  await Promise.all(hostels.map(async (hostel) => {
    const health = await healthOf(hostel);
    if (!health.issues.length) return;
    rows.push({
      id: hostel.id,
      name: hostel.name,
      code: hostel.code,
      plan: hostel.plan,
      plan_status: hostel.plan_status,
      issues: health.issues,
      residents: health.residents,
      enrolled_residents: health.enrolled_residents,
      last_captured_at: health.last_captured_at,
      last_label: health.last_label,
      stale_hours: health.stale_hours,
    });
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return {
    sku: 'gold',
    separate_sku: false,
    stale_hours: staleCaptureHours(),
    count: rows.length,
    items: rows,
  };
};

module.exports = {
  PLAYBOOK_VERSION,
  PLAYBOOK,
  staleCaptureHours,
  healthOf,
  playbookOf,
  supportQueue,
};
