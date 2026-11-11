/**
 * PKG-012 / TC-PKG-12 — DPDP for Vita Eye.
 * 30-day unknown stills; enrol for the stay; owner export/erase; SA browse is audited.
 */
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { pixel } = require('./helpers/mediaTest');
const { refreshListingProjection } = require('../services/listingProjection');
const { runRetention, POLICY_VERSION } = require('../services/vitaEyePrivacy');
const { UPGRADE_COPY } = require('../services/ownerPlan');

const fx = () => global.__erp;
const stillDir = (hostelId) => path.join(__dirname, '..', 'uploads', 'vita-eye', String(hostelId));

describe('PKG-012 Vita Eye privacy', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let staffToken;
  let saToken;
  let gold;
  let resident;
  let residentUser;
  let jpeg;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    staffToken = await login(fx().staffUser.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
    jpeg = await pixel('jpeg', 32, 32, { r: 20, g: 40, b: 200 });
    const { Hostel, User, Tenant } = require('../models');
    const { hashPassword } = require('../helpers/password');
    gold = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Gold Eye Privacy PG',
      code: 'GLDEYE12',
      address: '12 Eye Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411012',
      status: 'active',
      listing_published: true,
      plan: 'gold',
      plan_status: 'active',
    });
    residentUser = await User.create({
      email: 'pkg012.resident@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Privacy',
      last_name: 'Resident',
      role: 'tenant',
      is_active: true,
      email_verified: true,
    });
    resident = await Tenant.create({
      user_id: residentUser.id,
      hostel_id: gold.id,
      full_name: 'Privacy Resident',
      monthly_rent: 8000,
      status: 'active',
    });
    await fx().staff.update({ hostel_id: gold.id });
    await refreshListingProjection(gold.id);
  });

  afterAll(async () => {
    const {
      Hostel, FaceEnrollment, FaceWatchlist, FaceEvent, ListingProjection, User, Tenant, Staff,
    } = require('../models');
    const ids = [gold?.id].filter(Boolean);
    await FaceEvent.destroy({ where: { hostel_id: ids } }).catch(() => {});
    await FaceWatchlist.destroy({ where: { hostel_id: ids } }).catch(() => {});
    await FaceEnrollment.destroy({ where: { hostel_id: ids } }).catch(() => {});
    await ListingProjection.destroy({ where: { hostel_id: ids } }).catch(() => {});
    if (fx().staff?.id) {
      await Staff.update({ hostel_id: fx().hostel.id }, { where: { id: fx().staff.id } }).catch(() => {});
    }
    if (resident?.id) await Tenant.destroy({ where: { id: resident.id }, force: true }).catch(() => {});
    if (residentUser?.id) await User.destroy({ where: { id: residentUser.id }, force: true }).catch(() => {});
    await Hostel.destroy({ where: { id: ids }, force: true }).catch(() => {});
    ids.forEach((hostelId) => {
      try {
        fs.rmSync(stillDir(hostelId), { recursive: true, force: true });
      } catch {
        // ignore
      }
    });
  });

  const enroll = (token, fields, file) => {
    let req = request(app)
      .post(`/api/hostels/${gold.id}/vita-eye/enroll`)
      .set(auth(token));
    Object.entries(fields).forEach(([key, value]) => {
      req = req.field(key, String(value));
    });
    if (file) req = req.attach('still', file, { filename: 'face.jpg', contentType: 'image/jpeg' });
    return req;
  };

  const capture = (token, file) => request(app)
    .post(`/api/hostels/${gold.id}/vita-eye/capture`)
    .set(auth(token))
    .field('gate', 'front')
    .attach('still', file, { filename: 'gate.jpg', contentType: 'image/jpeg' });

  test('public privacy policy names purpose, 30-day unknown, no sale', async () => {
    const res = await request(app).get('/api/public/vita-eye-privacy');
    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(POLICY_VERSION);
    expect(res.body.data.purpose).toBe('premises_security');
    expect(res.body.data.sold).toBe(false);
    expect(res.body.data.platform_wide_graph).toBe(false);
    expect(res.body.data.unknown_retention_days).toBe(30);
    expect(res.body.data.enrolled_retention).toBe('duration_of_stay');
    expect(res.body.data.text).toMatch(/not sold/i);
    expect(res.body.data.text).toMatch(/30 days/i);
    expect(JSON.stringify(res.body)).not.toMatch(/embedding_cipher/);
  });

  test('Gold status exposes privacy copy; Super Admin browse of this PG is audited', async () => {
    const status = await request(app).get(`/api/hostels/${gold.id}/vita-eye`).set(auth(ownerToken));
    expect(status.status).toBe(200);
    expect(status.body.data.consent_copy).toMatch(/this PG only/i);
    expect(status.body.data.consent_copy).toMatch(/not sold/i);
    expect(status.body.data.consent_copy).toMatch(/30 days/i);
    expect(status.body.data.privacy.sold).toBe(false);
    expect(status.body.data.privacy.unknown_retention_days).toBe(30);
    expect(status.body.data.next).toBeNull();
    expect(status.body.data.playbook.version).toBe('pkg-014.v1');

    const sa = await request(app).get(`/api/hostels/${gold.id}/vita-eye`).set(auth(saToken));
    expect(sa.status).toBe(200);
    const { AuditLog } = require('../models');
    const log = await AuditLog.findOne({
      where: { action: 'VITA_EYE_SA_ACCESS', user_id: fx().superAdmin.id, entity_id: gold.id },
      order: [['id', 'DESC']],
    });
    expect(log).toBeTruthy();
    expect(JSON.stringify(log.new_values || {})).not.toMatch(/embedding_cipher/);
  });

  test('unknown captures older than 30 days are deleted; known stays; stay-ended enrol is revoked', async () => {
    const enrolled = await enroll(ownerToken, {
      person_type: 'resident',
      person_id: resident.id,
      consent: 'true',
    }, jpeg);
    expect(enrolled.status).toBe(200);

    const known = await capture(ownerToken, jpeg);
    expect(known.status).toBe(200);
    expect(known.body.data.label).toBe('known_resident');

    const red = await pixel('jpeg', 32, 32, { r: 220, g: 20, b: 20 });
    const unknown = await capture(ownerToken, red);
    expect(unknown.status).toBe(200);
    expect(unknown.body.data.label).toBe('unknown');

    const { FaceEvent, FaceEnrollment, sequelize } = require('../models');
    await sequelize.query('UPDATE face_events SET created_at = :at WHERE id = :id', {
      replacements: {
        at: dayjs().subtract(31, 'day').format('YYYY-MM-DD HH:mm:ss'),
        id: unknown.body.data.id,
      },
    });
    await sequelize.query('UPDATE face_events SET created_at = :at WHERE id = :id', {
      replacements: {
        at: dayjs().subtract(31, 'day').format('YYYY-MM-DD HH:mm:ss'),
        id: known.body.data.id,
      },
    });

    const first = await runRetention(new Date());
    expect(first.unknown).toBeGreaterThanOrEqual(1);
    expect(await FaceEvent.findByPk(unknown.body.data.id)).toBeNull();
    expect(await FaceEvent.findByPk(known.body.data.id)).toBeTruthy();

    const second = await runRetention(new Date());
    expect(second.unknown).toBe(0);

    await resident.update({ status: 'moved_out' });
    const afterStay = await runRetention(new Date());
    expect(afterStay.stay_ended).toBeGreaterThanOrEqual(1);
    expect(await FaceEnrollment.findByPk(enrolled.body.data.id)).toBeNull();
    await resident.update({ status: 'active' });
  });

  test('owner export has no ciphertext; staff cannot erase; owner erase wipes this PG', async () => {
    const enrolled = await enroll(ownerToken, {
      person_type: 'resident',
      person_id: resident.id,
      consent: 'true',
    }, jpeg);
    expect(enrolled.status).toBe(200);
    await capture(ownerToken, jpeg);

    const exported = await request(app)
      .get(`/api/hostels/${gold.id}/vita-eye/export`)
      .set(auth(ownerToken));
    expect(exported.status).toBe(200);
    expect(exported.body.data.sold).toBe(false);
    expect(exported.body.data.enrollments.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(exported.body)).not.toMatch(/embedding_cipher/);
    expect(JSON.stringify(exported.body)).not.toMatch(/\/uploads\/tenants\//);

    const staffErase = await request(app)
      .post(`/api/hostels/${gold.id}/vita-eye/erase`)
      .set(auth(staffToken))
      .send({ confirm: true });
    expect(staffErase.status).toBe(403);

    const missing = await request(app)
      .post(`/api/hostels/${gold.id}/vita-eye/erase`)
      .set(auth(ownerToken))
      .send({});
    expect(missing.status).toBe(422);

    const erased = await request(app)
      .post(`/api/hostels/${gold.id}/vita-eye/erase`)
      .set(auth(ownerToken))
      .send({ confirm: true });
    expect(erased.status).toBe(200);
    expect(erased.body.data.erased).toBe(true);

    const status = await request(app).get(`/api/hostels/${gold.id}/vita-eye`).set(auth(ownerToken));
    expect(status.body.data.enrolled_count).toBe(0);
    expect(status.body.data.watchlist_count).toBe(0);
    expect(status.body.data.events.length).toBe(0);

    const silver = await request(app)
      .get(`/api/hostels/${fx().hostel.id}/vita-eye/export`)
      .set(auth(ownerToken));
    expect(silver.status).toBe(403);
    expect(silver.body.message).toBe(UPGRADE_COPY.vita_eye);
  });
});
