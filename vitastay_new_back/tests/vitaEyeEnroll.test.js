/**
 * PKG-010 / TC-PKG-10 — Gold face enrol with consent.
 * Hostel-scoped encrypted embeddings. No platform-wide graph. No KYC copy.
 * Capture is PKG-011.
 */
const fs = require('fs');
const path = require('path');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { pixel } = require('./helpers/mediaTest');
const { decryptEmbedding } = require('../services/faceCrypto');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const stillDir = (hostelId) => path.join(__dirname, '..', 'uploads', 'vita-eye', String(hostelId));

describe('PKG-010 Vita Eye enrol', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let staffToken;
  let saToken;
  let gold;
  let otherGold;
  let otherOwner;
  let jpeg;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    staffToken = await login(fx().staffUser.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
    jpeg = await pixel('jpeg', 32, 32);
    const { Hostel, User } = require('../models');
    const { hashPassword } = require('../helpers/password');
    gold = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Gold Eye Enrol PG',
      code: 'GLDEYE10',
      address: '10 Eye Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      status: 'active',
      listing_published: true,
      plan: 'gold',
      plan_status: 'active',
    });
    otherOwner = await User.create({
      email: 'pkg010.other@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Other',
      last_name: 'Owner',
      role: 'owner',
      is_active: true,
      email_verified: true,
    });
    otherGold = await Hostel.create({
      owner_id: otherOwner.id,
      name: 'Other Gold PG',
      code: 'OTHEYE10',
      address: '11 Eye Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411002',
      status: 'active',
      listing_published: false,
      plan: 'gold',
      plan_status: 'comp',
    });
    await fx().staff.update({ hostel_id: gold.id });
    await refreshListingProjection(gold.id);
  });

  afterAll(async () => {
    const {
      Hostel, FaceEnrollment, ListingProjection, User, Staff,
    } = require('../models');
    const ids = [gold?.id, otherGold?.id].filter(Boolean);
    await FaceEnrollment.destroy({ where: { hostel_id: ids }, force: true }).catch(() => {});
    await ListingProjection.destroy({ where: { hostel_id: ids } }).catch(() => {});
    if (fx().staff?.id) await Staff.update({ hostel_id: fx().hostel.id }, { where: { id: fx().staff.id } }).catch(() => {});
    await Hostel.destroy({ where: { id: ids }, force: true }).catch(() => {});
    if (otherOwner?.id) await User.destroy({ where: { id: otherOwner.id }, force: true }).catch(() => {});
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

  test('Gold status is ready; gallery empty; capture without still is 422', async () => {
    const status = await request(app).get(`/api/hostels/${gold.id}/vita-eye`).set(auth(ownerToken));
    expect(status.status).toBe(200);
    expect(status.body.data.ready).toBe(true);
    expect(status.body.data.capture_ready).toBe(true);
    expect(status.body.data.enrolled_count).toBe(0);
    expect(status.body.data.consent_copy).toMatch(/this PG only/i);
    expect(JSON.stringify(status.body)).not.toMatch(/embedding_cipher/);
    expect(JSON.stringify(status.body)).not.toMatch(/\/uploads\/tenants\//);

    const capture = await request(app)
      .post(`/api/hostels/${gold.id}/vita-eye/capture`)
      .set(auth(ownerToken))
      .send({});
    expect(capture.status).toBe(422);
  });

  test('enroll without consent or still is 422', async () => {
    const noConsent = await enroll(ownerToken, gold.id, {
      person_type: 'resident',
      person_id: fx().tenant.id,
      consent: 'false',
    }, jpeg);
    expect(noConsent.status).toBe(422);

    const noFile = await enroll(ownerToken, gold.id, {
      person_type: 'resident',
      person_id: fx().tenant.id,
      consent: 'true',
    });
    expect(noFile.status).toBe(422);
  });

  test('cannot enrol a person from another PG (no face graph)', async () => {
    const res = await enroll(ownerToken, gold.id, {
      person_type: 'resident',
      person_id: fx().tenant.id,
      consent: 'true',
    }, jpeg);
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/not a resident of this PG/i);
  });

  test('owner enrols a resident of this Gold PG; ciphertext is stored, not returned', async () => {
    const { Tenant, FaceEnrollment, User } = require('../models');
    const { hashPassword } = require('../helpers/password');
    const residentUser = await User.create({
      email: 'pkg010.resident@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Eye',
      last_name: 'Resident',
      role: 'tenant',
      is_active: true,
      email_verified: true,
    });
    const resident = await Tenant.create({
      user_id: residentUser.id,
      hostel_id: gold.id,
      full_name: 'Eye Resident',
      monthly_rent: 8000,
      status: 'active',
    });

    try {
      const res = await enroll(ownerToken, gold.id, {
        person_type: 'resident',
        person_id: resident.id,
        consent: 'true',
      }, jpeg);
      expect(res.status).toBe(200);
      expect(res.body.data.person_type).toBe('resident');
      expect(res.body.data.person_id).toBe(resident.id);
      expect(res.body.data.consent_at).toBeTruthy();
      expect(res.body.data.embedding_cipher).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/\/uploads\/tenants\//);
      expect(res.body.data.still_url).toMatch(/\/uploads\/vita-eye\//);

      const row = await FaceEnrollment.findOne({ where: { id: res.body.data.id } });
      expect(row).toBeTruthy();
      expect(row.hostel_id).toBe(gold.id);
      expect(row.embedding_cipher).toBeTruthy();
      expect(row.embedding_cipher).not.toMatch(/\[0\./);
      const vector = decryptEmbedding(row.embedding_cipher);
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBe(768);

      const { AuditLog } = require('../models');
      const log = await AuditLog.findOne({
        where: { action: 'VITA_EYE_ENROLL', entity_id: row.id },
        order: [['id', 'DESC']],
      });
      expect(log).toBeTruthy();
      expect(JSON.stringify(log.new_values || {})).not.toMatch(/embedding_cipher/);
    } finally {
      await FaceEnrollment.destroy({ where: { person_id: resident.id, person_type: 'resident' }, force: true }).catch(() => {});
      await resident.destroy({ force: true }).catch(() => {});
      await residentUser.destroy({ force: true }).catch(() => {});
    }
  });

  test('staff of this PG can enrol staff; other Gold owner is 403; guest still is 404', async () => {
    const res = await enroll(staffToken, gold.id, {
      person_type: 'staff',
      person_id: fx().staff.id,
      consent: 'true',
    }, jpeg);
    expect(res.status).toBe(200);
    expect(res.body.data.person_type).toBe('staff');

    const otherToken = await login(otherOwner.email, PASSWORD);
    const steal = await enroll(otherToken, gold.id, {
      person_type: 'staff',
      person_id: fx().staff.id,
      consent: 'true',
    }, jpeg);
    expect(steal.status).toBe(403);

    const stillPath = `/uploads/vita-eye/${gold.id}/${res.body.data.id}.jpg`;
    const guest = await request(app).get(stillPath);
    expect(guest.status).toBe(404);

    const ownerStill = await request(app).get(stillPath).set(auth(ownerToken));
    expect(ownerStill.status).toBe(200);

    const otherStill = await request(app).get(stillPath).set(auth(otherToken));
    expect(otherStill.status).toBe(404);
  });

  test('Silver remains 403; Super Admin can enrol on this Gold PG', async () => {
    const silver = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/vita-eye/enroll`)
      .set(auth(ownerToken))
      .field('person_type', 'staff')
      .field('person_id', String(fx().staff.id))
      .field('consent', 'true')
      .attach('still', jpeg, { filename: 'face.jpg', contentType: 'image/jpeg' });
    expect(silver.status).toBe(403);

    const sa = await enroll(saToken, gold.id, {
      person_type: 'staff',
      person_id: fx().staff.id,
      consent: 'true',
    }, jpeg);
    expect(sa.status).toBe(200);

    const listed = await request(app).get(`/api/hostels/${gold.id}/vita-eye`).set(auth(ownerToken));
    expect(listed.body.data.enrolled_count).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(listed.body)).not.toMatch(/embedding_cipher/);

    const id = listed.body.data.enrollments[0].id;
    const gone = await request(app)
      .delete(`/api/hostels/${gold.id}/vita-eye/enrollments/${id}`)
      .set(auth(ownerToken));
    expect(gone.status).toBe(200);
  });
});
