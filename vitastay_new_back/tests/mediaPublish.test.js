/**
 * TC-M-20…22 — publish checklist, owner publish gate, Super Admin override.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;
const checklistUrl = (hostelId) => `/api/hostels/${hostelId}/media/checklist`;
const publishUrl = (hostelId) => `/api/hostels/${hostelId}/media/publish`;
const overrideUrl = (hostelId) => `/api/hostels/${hostelId}/media/override`;

const seedCompletePack = async () => {
  const { PropertyMedia } = require('../models');
  const hostelId = fx().hostel.id;
  const uploadedBy = fx().owner.id;
  let n = 0;
  const add = (attrs) => PropertyMedia.create({
    hostel_id: hostelId,
    capture_kind: attrs.category === 'panorama_360' ? 'panorama_360' : 'photo',
    file_path: `/uploads/media/${hostelId}/pack-${Date.now()}-${n += 1}.jpg`,
    mime_type: 'image/jpeg',
    file_size: 1200,
    uploaded_by: uploadedBy,
    is_published: true,
    ...attrs,
  });

  await add({ category: 'exterior', is_cover: true, caption: 'cover' });
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
  await add({ category: 'panorama_360', capture_kind: 'panorama_360' });
};

describe('TC-M publish checklist', () => {
  let ownerToken;
  let tenantToken;
  let saToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    tenantToken = await login(fx().tenantUser.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
  });

  test('TC-M-20 incomplete pack (logo only) cannot publish', async () => {
    const res = await request(app)
      .get(checklistUrl(fx().hostel.id))
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.can_publish).toBe(false);
    expect(res.body.data.minima_ok).toBe(false);
    expect(res.body.data.listing_published).toBe(false);
    expect(res.body.data.missing.length).toBeGreaterThan(0);
    expect(res.body.data.missing.some((row) => row.code === 'exterior')).toBe(true);
    expect(res.body.data.missing.some((row) => row.code === 'cover')).toBe(true);

    const blocked = await request(app)
      .post(publishUrl(fx().hostel.id))
      .set(auth(ownerToken))
      .send({});
    expect(blocked.status).toBe(422);
    expect(Array.isArray(blocked.body.errors)).toBe(true);
  });

  test('tenant cannot read checklist or publish', async () => {
    const res = await request(app)
      .get(checklistUrl(fx().hostel.id))
      .set(auth(tenantToken));
    expect(res.status).toBe(403);
  });

  test('owner cannot override media minima', async () => {
    const res = await request(app)
      .post(overrideUrl(fx().hostel.id))
      .set(auth(ownerToken))
      .send({ reason: 'Owner trying to skip photos for onboarding' });
    expect(res.status).toBe(403);
  });

  test('TC-M-22 Super Admin override with reason publishes and audits', async () => {
    const short = await request(app)
      .post(overrideUrl(fx().hostel.id))
      .set(auth(saToken))
      .send({ reason: 'too short' });
    expect(short.status).toBe(422);

    const res = await request(app)
      .post(overrideUrl(fx().hostel.id))
      .set(auth(saToken))
      .send({ reason: 'Owner camera failed; tech will finish the pack this week.' });
    expect(res.status).toBe(200);
    expect(res.body.data.listing_published).toBe(true);
    expect(res.body.data.can_publish).toBe(true);
    expect(res.body.data.minima_ok).toBe(false);
    expect(res.body.data.override.reason).toMatch(/camera failed/i);

    const { AuditLog } = require('../models');
    const log = await AuditLog.findOne({
      where: {
        entity_type: 'hostel',
        entity_id: fx().hostel.id,
        action: 'MEDIA_OVERRIDE',
        user_id: fx().superAdmin.id,
      },
      order: [['id', 'DESC']],
    });
    expect(log).toBeTruthy();
    expect(String(log.new_values?.reason || JSON.stringify(log.new_values))).toMatch(/camera failed/i);

    await request(app)
      .post(`/api/hostels/${fx().hostel.id}/media/unpublish`)
      .set(auth(saToken))
      .send({});
  });

  test('TC-M-21 complete pack can_publish=true and owner can publish', async () => {
    await seedCompletePack();
    const res = await request(app)
      .get(checklistUrl(fx().hostel.id))
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.minima_ok).toBe(true);
    expect(res.body.data.can_publish).toBe(true);
    expect(res.body.data.missing).toEqual([]);
    expect(res.body.data.exterior.ok).toBe(true);
    expect(res.body.data.interior_common.ok).toBe(true);
    expect(res.body.data.room.ok).toBe(true);
    expect(res.body.data.floor.ok).toBe(true);
    expect(res.body.data.panorama_360.ok).toBe(true);
    expect(res.body.data.cover.ok).toBe(true);

    const published = await request(app)
      .post(publishUrl(fx().hostel.id))
      .set(auth(ownerToken))
      .send({});
    expect(published.status).toBe(200);
    expect(published.body.data.listing_published).toBe(true);
  });

  test('DEC-06 owner can publish without a 360; checklist recommends it', async () => {
    const { PropertyMedia } = require('../models');
    await PropertyMedia.destroy({ where: { hostel_id: fx().hostel.id }, force: true });
    await seedCompletePack();
    await PropertyMedia.destroy({
      where: { hostel_id: fx().hostel.id, category: 'panorama_360' },
      force: true,
    });

    const res = await request(app)
      .get(checklistUrl(fx().hostel.id))
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.minima_ok).toBe(true);
    expect(res.body.data.can_publish).toBe(true);
    expect(res.body.data.has_360).toBe(false);
    expect(res.body.data.panorama_360.ok).toBe(false);
    expect(res.body.data.recommended.some((row) => row.code === 'panorama_360')).toBe(true);
    expect(res.body.data.missing.some((row) => row.code === 'panorama_360')).toBe(false);

    await request(app)
      .post(`/api/hostels/${fx().hostel.id}/media/unpublish`)
      .set(auth(ownerToken))
      .send({});

    const published = await request(app)
      .post(publishUrl(fx().hostel.id))
      .set(auth(ownerToken))
      .send({});
    expect(published.status).toBe(200);
    expect(published.body.data.listing_published).toBe(true);
  });
});
