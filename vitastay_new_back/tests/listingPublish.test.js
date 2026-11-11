/**
 * BKG-004 — listing published ≠ hostel status; hold unpublishes; SA moderation.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const listingPublish = (id) => `/api/hostels/${id}/listing/publish`;
const listingUnpublish = (id) => `/api/hostels/${id}/listing/unpublish`;
const saUnpublish = (id) => `/api/super-admin/hostels/${id}/listing/unpublish`;
const search = () => request(app).get('/api/public/listings');

const seedCompletePack = async () => {
  const { PropertyMedia } = require('../models');
  const hostelId = fx().hostel.id;
  const uploadedBy = fx().owner.id;
  let n = 0;
  const add = (attrs) => PropertyMedia.create({
    hostel_id: hostelId,
    capture_kind: attrs.category === 'panorama_360' ? 'panorama_360' : 'photo',
    file_path: `/uploads/media/${hostelId}/bkg004-${Date.now()}-${n += 1}.jpg`,
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

const searchIds = (res) => (res.body.data.items || []).map((row) => row.id);

describe('BKG-004 listing publish vs hostel status', () => {
  let ownerToken;
  let saToken;
  let staffToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
    staffToken = await login(fx().staffUser.email, PASSWORD);
    await seedCompletePack();
  });

  beforeEach(async () => {
    const hostel = await require('../models').Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      status: 'active',
      listing_published: false,
      listing_moderated_by: null,
      listing_moderated_at: null,
      listing_unpublish_reason: null,
      media_override_reason: null,
      media_override_by: null,
      media_override_at: null,
    });
    await refreshListingProjection(hostel.id);
  });

  test('hostel PUT cannot flip listing_published', async () => {
    const res = await request(app)
      .put(`/api/hostels/${fx().hostel.id}`)
      .set(auth(ownerToken))
      .send({ listing_published: true, listing_published_at: new Date().toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.data.listing_published).toBe(false);
  });

  test('staff cannot publish the listing', async () => {
    const res = await request(app)
      .post(listingPublish(fx().hostel.id))
      .set(auth(staffToken))
      .send({});
    expect(res.status).toBe(403);
  });

  test('owner publish indexes search; media alias still works', async () => {
    const published = await request(app)
      .post(listingPublish(fx().hostel.id))
      .set(auth(ownerToken))
      .send({});
    expect(published.status).toBe(200);
    expect(published.body.data.listing_published).toBe(true);
    expect(published.body.data.listing_published_at).toBeTruthy();
    expect(published.body.data.hostel_status).toBe('active');

    const found = await search();
    expect(searchIds(found)).toContain(fx().hostel.id);

    await request(app)
      .post(listingUnpublish(fx().hostel.id))
      .set(auth(ownerToken))
      .send({});
    const alias = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/media/publish`)
      .set(auth(ownerToken))
      .send({});
    expect(alias.status).toBe(200);
    expect(alias.body.data.listing_published).toBe(true);
  });

  test('holding a live listing unpublishes and release does not republish', async () => {
    const published = await request(app)
      .post(listingPublish(fx().hostel.id))
      .set(auth(ownerToken))
      .send({});
    const publishedAt = published.body.data.listing_published_at;
    expect(publishedAt).toBeTruthy();

    const held = await request(app)
      .patch(`/api/super-admin/hostels/${fx().hostel.id}/hold`)
      .set(auth(saToken))
      .send({ on_hold: true });
    expect(held.status).toBe(200);
    expect(held.body.data.status).toBe('on_hold');
    expect(held.body.data.listing_published).toBe(false);
    expect(held.body.data.listing_published_at).toBeTruthy();

    const hidden = await search();
    expect(searchIds(hidden)).not.toContain(fx().hostel.id);

    const blocked = await request(app)
      .post(listingPublish(fx().hostel.id))
      .set(auth(ownerToken))
      .send({});
    expect(blocked.status).toBe(422);

    const released = await request(app)
      .patch(`/api/super-admin/hostels/${fx().hostel.id}/hold`)
      .set(auth(saToken))
      .send({ on_hold: false });
    expect(released.status).toBe(200);
    expect(released.body.data.status).toBe('active');
    expect(released.body.data.listing_published).toBe(false);

    const stillHidden = await search();
    expect(searchIds(stillHidden)).not.toContain(fx().hostel.id);
  });

  test('owner deactivate unpublishes the listing', async () => {
    await request(app).post(listingPublish(fx().hostel.id)).set(auth(ownerToken)).send({});
    const res = await request(app)
      .put(`/api/hostels/${fx().hostel.id}`)
      .set(auth(ownerToken))
      .send({ status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
    expect(res.body.data.listing_published).toBe(false);
    expect(searchIds(await search())).not.toContain(fx().hostel.id);
  });

  test('Super Admin moderation unpublish requires a reason and audits', async () => {
    await request(app).post(listingPublish(fx().hostel.id)).set(auth(ownerToken)).send({});

    const ownerBlocked = await request(app)
      .post(saUnpublish(fx().hostel.id))
      .set(auth(ownerToken))
      .send({ reason: 'Owner trying to use the moderation endpoint here' });
    expect(ownerBlocked.status).toBe(403);

    const short = await request(app)
      .post(saUnpublish(fx().hostel.id))
      .set(auth(saToken))
      .send({ reason: 'too short' });
    expect(short.status).toBe(422);

    const res = await request(app)
      .post(saUnpublish(fx().hostel.id))
      .set(auth(saToken))
      .send({ reason: 'Photos do not match the PG; take down until reshoot.' });
    expect(res.status).toBe(200);
    expect(res.body.data.listing_published).toBe(false);
    expect(res.body.data.listing_moderated_by).toBe(fx().superAdmin.id);
    expect(res.body.data.listing_unpublish_reason).toMatch(/reshoot/i);

    const { AuditLog } = require('../models');
    const log = await AuditLog.findOne({
      where: {
        entity_type: 'hostel',
        entity_id: fx().hostel.id,
        action: 'LISTING_MODERATE_UNPUBLISH',
        user_id: fx().superAdmin.id,
      },
      order: [['id', 'DESC']],
    });
    expect(log).toBeTruthy();
    expect(searchIds(await search())).not.toContain(fx().hostel.id);
  });
});
