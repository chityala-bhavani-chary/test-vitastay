/**
 * BIC-039 — verified badge is Super Admin only, after photo pack + pin + KYC.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;

const seedPack = async () => {
  const { PropertyMedia } = require('../models');
  const hostelId = fx().hostel.id;
  let n = 0;
  const add = (attrs) => PropertyMedia.create({
    hostel_id: hostelId,
    capture_kind: 'photo',
    file_path: `/uploads/media/${hostelId}/verified-${Date.now()}-${n += 1}.jpg`,
    mime_type: 'image/jpeg',
    file_size: 800,
    uploaded_by: fx().owner.id,
    is_published: true,
    ...attrs,
  });
  await add({ category: 'exterior', is_cover: true });
  await add({ category: 'exterior' });
  await add({ category: 'exterior' });
  await add({ category: 'interior_common' });
  await add({ category: 'interior_common' });
  await add({ category: 'interior_common' });
  await add({ category: 'interior_common' });
  await add({ category: 'room', room_id: fx().doubleRoom.id, room_number: '101' });
  await add({ category: 'room', room_id: fx().doubleRoom.id, room_number: '101' });
  await add({ category: 'room', room_id: fx().singleRoom.id, room_number: '102' });
  await add({ category: 'room', room_id: fx().singleRoom.id, room_number: '102' });
  await add({ category: 'floor', floor_number: 1 });
};

describe('BIC-039 Vita Stay verified', () => {
  let ownerToken;
  let saToken;
  let hostelId;

  beforeAll(async () => {
    const { ensureListingVerifiedSchema } = require('../database/migrate-listing-verified');
    await ensureListingVerifiedSchema(require('../models').sequelize, () => {});
    ownerToken = await login(fx().owner.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
    hostelId = fx().hostel.id;
    await seedPack();
  });

  test('owner cannot self-badge', async () => {
    const res = await request(app)
      .put(`/api/hostels/${hostelId}`)
      .set(auth(ownerToken))
      .send({ verified_at: new Date().toISOString() });
    expect(res.status).toBe(200);
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    expect(hostel.verified_at).toBeFalsy();
  });

  test('grant is blocked until pin and KYC are present, then shows on the projection', async () => {
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    await hostel.update({
      latitude: null,
      longitude: null,
      owner_kyc_status: 'none',
      verified_at: null,
    });
    const blocked = await request(app)
      .post(`/api/super-admin/hostels/${hostelId}/verified`)
      .set(auth(saToken))
      .send({});
    expect(blocked.status).toBe(422);
    expect(blocked.body.errors.photo_pack).toBe(true);
    expect(blocked.body.errors.address_pin).toBe(false);
    expect(blocked.body.errors.owner_kyc).toBe(false);

    await hostel.update({
      latitude: 12.93,
      longitude: 77.62,
      owner_kyc_status: 'verified',
    });
    const granted = await request(app)
      .post(`/api/super-admin/hostels/${hostelId}/verified`)
      .set(auth(saToken))
      .send({});
    expect(granted.status).toBe(200);
    expect(granted.body.data.verified).toBe(true);

    await refreshListingProjection(hostelId);
    const proj = await require('../models').ListingProjection.findOne({ where: { hostel_id: hostelId } });
    expect(proj.vita_verified).toBe(true);

    const removed = await request(app)
      .delete(`/api/super-admin/hostels/${hostelId}/verified`)
      .set(auth(saToken));
    expect(removed.status).toBe(200);
    expect(removed.body.data.verified).toBe(false);
  });
});