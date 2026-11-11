/**
 * BIC-038 — encrypted owner KYC blocks publish until Super Admin verifies.
 */
const fs = require('fs');
const path = require('path');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;
const PAN = 'ABCDE1234F';

describe('BIC-038 owner KYC', () => {
  let ownerToken;
  let saToken;
  let hostelId;

  beforeAll(async () => {
    const { ensureOwnerKycSchema } = require('../database/migrate-owner-kyc');
    await ensureOwnerKycSchema(require('../models').sequelize, () => {});
    ownerToken = await login(fx().owner.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
    hostelId = fx().hostel.id;
  });

  afterAll(async () => {
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    if (hostel) {
      await hostel.update({
        owner_kyc_status: 'verified',
        owner_kyc_verified_at: new Date(),
      });
    }
  });

  test('publish is blocked until KYC is verified', async () => {
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    await hostel.update({ owner_kyc_status: 'none' });
    const blocked = await request(app)
      .post(`/api/hostels/${hostelId}/listing/publish`)
      .set(auth(ownerToken))
      .send({});
    expect(blocked.status).toBe(422);
    expect(blocked.body.message).toMatch(/verified/i);
  });

  test('owner cannot self-verify through hostel update', async () => {
    const res = await request(app)
      .put(`/api/hostels/${hostelId}`)
      .set(auth(ownerToken))
      .send({ owner_kyc_status: 'verified', owner_pan_cipher: PAN });
    expect(res.status).toBe(200);
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    expect(hostel.owner_kyc_status).not.toBe('verified');
  });

  test('submit stores ciphertext, public listing omits PAN, admin verify unlocks the gate', async () => {
    const submit = await request(app)
      .post(`/api/hostels/${hostelId}/owner-kyc`)
      .set(auth(ownerToken))
      .field('pan', PAN)
      .field('upi', 'owner@oksbi');
    expect(submit.status).toBe(200);
    expect(submit.body.data.status).toBe('submitted');
    expect(JSON.stringify(submit.body)).not.toContain(PAN);

    const raw = await require('../models').Hostel.unscoped().findByPk(hostelId);
    expect(raw.owner_pan_cipher).toBeTruthy();
    expect(raw.owner_pan_cipher).not.toContain(PAN);

    const stillBlocked = await request(app)
      .post(`/api/hostels/${hostelId}/listing/publish`)
      .set(auth(ownerToken))
      .send({});
    expect(stillBlocked.status).toBe(422);

    const review = await request(app)
      .get(`/api/hostels/${hostelId}/owner-kyc`)
      .set(auth(saToken));
    expect(review.status).toBe(200);
    expect(review.body.data.pan_mask).toMatch(/AB\*+4F|AB/);
    expect(review.body.data.pan_mask).not.toBe(PAN);

    const verified = await request(app)
      .post(`/api/super-admin/hostels/${hostelId}/owner-kyc/verify`)
      .set(auth(saToken))
      .send({});
    expect(verified.status).toBe(200);
    expect(verified.body.data.status).toBe('verified');
    expect(verified.body.data.publish_blocked).toBe(false);
  });

  test('guest cannot read an owner KYC file', async () => {
    const dir = path.join(__dirname, '..', 'uploads', 'owner-kyc');
    fs.mkdirSync(dir, { recursive: true });
    const name = `kyc-${Date.now()}.jpg`;
    const abs = path.join(dir, name);
    fs.writeFileSync(abs, Buffer.from('not-a-real-jpeg'));
    const publicPath = `/uploads/owner-kyc/${name}`;
    await require('../models').Document.create({
      entity_type: 'hostel',
      entity_id: hostelId,
      title: 'Owner bank proof',
      file_path: publicPath,
      uploaded_by: fx().owner.id,
    });
    const guest = await request(app).get(publicPath);
    expect(guest.status).not.toBe(200);
    fs.unlinkSync(abs);
  });
});