/**
 * PKG-014 / TC-PKG-14 — Gold playbook + Super Admin Vita Eye support queue.
 * Enrol failures / last-capture-too-old. Not a separate SKU. nivas_hostel_test only.
 */
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD, assertSafeTestDatabase } = require('./helpers/fixtures');
const { pixel } = require('./helpers/mediaTest');
const { refreshListingProjection } = require('../services/listingProjection');
const { UPGRADE_COPY } = require('../services/ownerPlan');

const fx = () => global.__erp;
const stillDir = (hostelId) => path.join(__dirname, '..', 'uploads', 'vita-eye', String(hostelId));

describe('PKG-014 Vita Eye support', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let saToken;
  let jpeg;
  let gap;
  let healthy;
  let stale;
  let silver;
  let gapResident;
  let healthyResident;
  let gapUser;
  let healthyUser;

  beforeAll(async () => {
    const { sequelize, Hostel, User, Tenant } = require('../models');
    assertSafeTestDatabase(sequelize);
    expect(sequelize.config.database).toBe('nivas_hostel_test');
    expect(sequelize.config.database).not.toBe('nivas_hostel');

    ownerToken = await login(fx().owner.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
    jpeg = await pixel('jpeg', 48, 48, { r: 30, g: 90, b: 180 });
    const { hashPassword } = require('../helpers/password');

    gap = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'PKG014 Enrol Gap PG',
      code: 'PKG014GAP',
      address: '14 Gap Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411014',
      status: 'active',
      listing_published: true,
      plan: 'gold',
      plan_status: 'active',
    });
    healthy = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'PKG014 Healthy Eye PG',
      code: 'PKG014OK',
      address: '14 Ready Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411015',
      status: 'active',
      listing_published: true,
      plan: 'gold',
      plan_status: 'active',
    });
    stale = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'PKG014 Stale Capture PG',
      code: 'PKG014OLD',
      address: '14 Stale Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411016',
      status: 'active',
      listing_published: true,
      plan: 'gold',
      plan_status: 'comp',
    });
    silver = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'PKG014 Silver No Eye PG',
      code: 'PKG014SLV',
      address: '14 Silver Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411017',
      status: 'active',
      listing_published: true,
      plan: 'silver',
      plan_status: 'active',
    });

    gapUser = await User.create({
      email: 'pkg014.gap@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Gap',
      last_name: 'Resident',
      role: 'tenant',
      is_active: true,
      email_verified: true,
    });
    healthyUser = await User.create({
      email: 'pkg014.ok@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Ready',
      last_name: 'Resident',
      role: 'tenant',
      is_active: true,
      email_verified: true,
    });
    gapResident = await Tenant.create({
      user_id: gapUser.id,
      hostel_id: gap.id,
      full_name: 'Gap Resident',
      monthly_rent: 8000,
      status: 'active',
    });
    healthyResident = await Tenant.create({
      user_id: healthyUser.id,
      hostel_id: healthy.id,
      full_name: 'Ready Resident',
      monthly_rent: 8000,
      status: 'active',
    });
    await refreshListingProjection(gap.id);
    await refreshListingProjection(healthy.id);
    await refreshListingProjection(stale.id);
    await refreshListingProjection(silver.id);
  });

  afterAll(async () => {
    const {
      Hostel, FaceEnrollment, FaceWatchlist, FaceEvent, ListingProjection, User, Tenant,
    } = require('../models');
    const ids = [gap?.id, healthy?.id, stale?.id, silver?.id].filter(Boolean);
    await FaceEvent.destroy({ where: { hostel_id: ids }, force: true }).catch(() => {});
    await FaceWatchlist.destroy({ where: { hostel_id: ids }, force: true }).catch(() => {});
    await FaceEnrollment.destroy({ where: { hostel_id: ids }, force: true }).catch(() => {});
    await ListingProjection.destroy({ where: { hostel_id: ids } }).catch(() => {});
    await Tenant.destroy({
      where: { hostel_id: ids },
      force: true,
    }).catch(() => {});
    if (gapUser?.id) await User.destroy({ where: { id: gapUser.id }, force: true }).catch(() => {});
    if (healthyUser?.id) await User.destroy({ where: { id: healthyUser.id }, force: true }).catch(() => {});
    await Hostel.destroy({ where: { id: ids }, force: true }).catch(() => {});
    ids.forEach((hostelId) => {
      try {
        fs.rmSync(stillDir(hostelId), { recursive: true, force: true });
      } catch {
        // ignore
      }
    });
  });

  const enroll = (token, hostelId, fields, file) => {
    let req = request(app)
      .post(`/api/hostels/${hostelId}/vita-eye/enroll`)
      .set(auth(token));
    Object.entries(fields).forEach(([key, value]) => {
      req = req.field(key, String(value));
    });
    if (file) {
      req = req.attach('still', file, { filename: 'face.jpg', contentType: 'image/jpeg' });
    }
    return req;
  };

  const capture = (token, hostelId, file) => {
    let req = request(app)
      .post(`/api/hostels/${hostelId}/vita-eye/capture`)
      .set(auth(token))
      .field('gate', 'front');
    if (file) {
      req = req.attach('still', file, { filename: 'gate.jpg', contentType: 'image/jpeg' });
    }
    return req;
  };

  test('Gold status playbook lists enrol, blocked list, capture, notify; Silver playbook is 403', async () => {
    const status = await request(app).get(`/api/hostels/${gap.id}/vita-eye`).set(auth(ownerToken));
    expect(status.status).toBe(200);
    expect(status.body.data.next).toBeNull();
    expect(status.body.data.playbook.sku).toBe('gold');
    expect(status.body.data.playbook.version).toBe('pkg-014.v1');
    expect(status.body.data.playbook.body).toMatch(/not a separate product/i);
    const steps = status.body.data.playbook.checklist.steps;
    expect(steps.map((row) => row.id)).toEqual([
      'enrol_residents', 'watchlist', 'test_capture', 'confirm_notify',
    ]);
    expect(status.body.data.playbook.checklist.residents).toBe(1);
    expect(gapResident.id).toBeTruthy();
    expect(steps.find((row) => row.id === 'enrol_residents').done).toBe(false);
    expect(steps.find((row) => row.id === 'watchlist').recommended).toBe(true);
    expect(status.body.data.playbook.checklist.ready).toBe(false);
    expect(status.body.data.playbook.checklist.stale).toBe(false);
    expect(JSON.stringify(status.body)).not.toMatch(/embedding_cipher/);

    const article = await request(app).get(`/api/hostels/${gap.id}/vita-eye/playbook`).set(auth(ownerToken));
    expect(article.status).toBe(200);
    expect(article.body.data.title).toMatch(/turn on vita eye/i);

    const silverPlay = await request(app).get(`/api/hostels/${silver.id}/vita-eye/playbook`).set(auth(ownerToken));
    expect(silverPlay.status).toBe(403);
    expect(silverPlay.body.message).toBe(UPGRADE_COPY.vita_eye);
  });

  test('owner cannot open Super Admin queue; SA queue lists enrol failure and omits Silver', async () => {
    const ownerQueue = await request(app).get('/api/super-admin/vita-eye').set(auth(ownerToken));
    expect(ownerQueue.status).toBe(403);

    const queue = await request(app).get('/api/super-admin/vita-eye').set(auth(saToken));
    expect(queue.status).toBe(200);
    expect(queue.body.data.separate_sku).toBe(false);
    expect(queue.body.data.sku).toBe('gold');
    expect(queue.body.data.stale_hours).toBe(24);
    const items = queue.body.data.items || [];
    const gapRow = items.find((row) => row.id === gap.id);
    expect(gapRow).toBeTruthy();
    expect(gapRow.issues).toEqual(expect.arrayContaining(['enrol_failure', 'never_captured']));
    expect(items.find((row) => row.id === silver.id)).toBeUndefined();
    expect(JSON.stringify(queue.body)).not.toMatch(/embedding_cipher/);
  });

  test('healthy Gold (enrol + capture + notify) leaves the queue; stale capture stays', async () => {
    const enrolled = await enroll(ownerToken, healthy.id, {
      person_type: 'resident',
      person_id: healthyResident.id,
      consent: 'true',
    }, jpeg);
    expect(enrolled.status).toBe(200);

    const shot = await capture(ownerToken, healthy.id, jpeg);
    expect(shot.status).toBe(200);
    expect(shot.body.data.notified).toBe(true);

    const ready = await request(app).get(`/api/hostels/${healthy.id}/vita-eye`).set(auth(ownerToken));
    expect(ready.status).toBe(200);
    expect(ready.body.data.playbook.checklist.ready).toBe(true);
    expect(ready.body.data.playbook.checklist.steps.find((row) => row.id === 'enrol_residents').done).toBe(true);
    expect(ready.body.data.playbook.checklist.steps.find((row) => row.id === 'test_capture').done).toBe(true);
    expect(ready.body.data.playbook.checklist.steps.find((row) => row.id === 'confirm_notify').done).toBe(true);

    const { sequelize, FaceEvent } = require('../models');
    const old = await FaceEvent.create({
      hostel_id: stale.id,
      label: 'unknown',
      confidence: 0,
      threshold: 0.85,
      notified_at: new Date(),
    });
    await sequelize.query('UPDATE face_events SET created_at = ? WHERE id = ?', {
      replacements: [dayjs().subtract(48, 'hour').toDate(), old.id],
    });

    const queue = await request(app).get('/api/super-admin/vita-eye').set(auth(saToken));
    expect(queue.status).toBe(200);
    const items = queue.body.data.items || [];
    expect(items.find((row) => row.id === healthy.id)).toBeUndefined();
    const staleRow = items.find((row) => row.id === stale.id);
    expect(staleRow).toBeTruthy();
    expect(staleRow.issues).toContain('stale_capture');
  });
});
