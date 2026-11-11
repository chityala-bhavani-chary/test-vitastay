/**
 * TC-M-30, TC-M-32, TC-M-34, TC-M-35 — public listing media, IDOR on unpublished.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;
const publicMedia = (id) => `/api/public/listings/${id}/media`;
const publicListing = (id) => `/api/public/listings/${id}`;

const seedCompletePack = async () => {
  const { PropertyMedia } = require('../models');
  const hostelId = fx().hostel.id;
  const uploadedBy = fx().owner.id;
  let n = 0;
  const add = (attrs) => PropertyMedia.create({
    hostel_id: hostelId,
    capture_kind: attrs.category === 'panorama_360' ? 'panorama_360' : 'photo',
    file_path: `/uploads/media/${hostelId}/pub-${Date.now()}-${n += 1}.jpg`,
    thumb_path: `/uploads/media/${hostelId}/pub-${Date.now()}-${n}-thumb.jpg`,
    mime_type: 'image/jpeg',
    file_size: 1200,
    uploaded_by: uploadedBy,
    is_published: true,
    ...attrs,
  });

  const cover = await add({ category: 'exterior', is_cover: true, caption: 'Gate' });
  await add({ category: 'exterior' });
  await add({ category: 'exterior' });
  await add({ category: 'interior_common', caption: 'Lounge' });
  await add({ category: 'interior_common' });
  await add({ category: 'interior_common' });
  await add({ category: 'interior_common' });
  await add({ category: 'room', room_id: fx().doubleRoom.id, room_number: '101' });
  await add({ category: 'room', room_id: fx().doubleRoom.id, room_number: '101' });
  await add({ category: 'room', room_id: fx().singleRoom.id, room_number: '102' });
  await add({ category: 'room', room_id: fx().singleRoom.id, room_number: '102' });
  await add({ category: 'floor', floor_number: 1, caption: 'First floor corridor' });
  await add({ category: 'panorama_360', capture_kind: 'panorama_360', caption: 'entrance' });
  return cover;
};

describe('TC-M public listing media', () => {
  let ownerToken;
  let hiddenPath;
  let kycPath;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { PropertyMedia, TenantDocument } = require('../models');
    hiddenPath = `/uploads/media/${fx().hostel.id}/hidden-unpublished.jpg`;
    kycPath = `/uploads/tenants/aadhar-secret.jpg`;
    await PropertyMedia.create({
      hostel_id: fx().hostel.id,
      category: 'exterior',
      capture_kind: 'photo',
      file_path: hiddenPath,
      mime_type: 'image/jpeg',
      file_size: 800,
      uploaded_by: fx().owner.id,
      is_published: false,
    });
    await TenantDocument.create({
      tenant_id: fx().tenant.id,
      document_type: 'aadhar',
      title: 'Aadhaar',
      file_path: kycPath,
      uploaded_by: fx().owner.id,
    });
  });

  test('TC-M-35 unpublished hostel is 404 and leaks no media URLs', async () => {
    const res = await request(app).get(publicMedia(fx().hostel.id));
    expect(res.status).toBe(404);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/\/uploads\/media\//);
    expect(body).not.toMatch(/\/uploads\/tenants\//);
    expect(body).not.toContain(kycPath);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('pending hostel is 404 even if guessed', async () => {
    const res = await request(app).get(publicMedia(fx().pendingHostel.id));
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/\/uploads\/media\//);
  });

  test('rejected and on-hold hostels are 404 even if listing_published', async () => {
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().pendingHostel.id);
    await hostel.update({ status: 'rejected', listing_published: true });
    const rejected = await request(app).get(publicMedia(hostel.id));
    expect(rejected.status).toBe(404);
    expect(JSON.stringify(rejected.body)).not.toMatch(/\/uploads\/media\//);
    await hostel.update({ status: 'on_hold' });
    expect((await request(app).get(publicMedia(hostel.id))).status).toBe(404);
    await hostel.update({ status: 'pending_approval', listing_published: false });
  });

  test('unknown id is 404', async () => {
    const res = await request(app).get(publicMedia(999999));
    expect(res.status).toBe(404);
  });

  test('TC-M-30 guest GET after publish returns every category with thumbs', async () => {
    await seedCompletePack();
    const published = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/media/publish`)
      .set(auth(ownerToken))
      .send({});
    expect(published.status).toBe(200);

    const res = await request(app).get(publicMedia(fx().hostel.id));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/public/i);
    const media = res.body.data;
    expect(media.cover.thumb_url).toBeTruthy();
    expect(media.cover.url).toMatch(/^\/uploads\/media\//);
    expect(media.exterior.length).toBeGreaterThanOrEqual(3);
    expect(media.interior_common.length).toBeGreaterThanOrEqual(4);
    expect(media.panorama_360.length).toBeGreaterThanOrEqual(1);
    expect(media.floors['1'].length).toBeGreaterThanOrEqual(1);
    expect(media.items.every((item) => item.thumb_url)).toBe(true);
    expect(media.total).toBe(media.items.length);
    expect(media.counts.all).toBe(media.items.length);
    expect(media.counts.exterior).toBe(media.exterior.length);
    expect(media.counts.interior_common).toBe(media.interior_common.length);
    expect(media.counts.room).toBeGreaterThanOrEqual(4);
    expect(media.counts.floor).toBeGreaterThanOrEqual(1);
    expect(media.counts.panorama_360).toBe(media.panorama_360.length);
    expect(JSON.stringify(res.body)).not.toContain(kycPath);
    expect(JSON.stringify(res.body)).not.toContain(hiddenPath);
    expect(JSON.stringify(res.body)).not.toMatch(/media_override/);
    expect(JSON.stringify(res.body)).not.toMatch(/database_name/);
  });

  test('TC-M-32 public count matches published operator items only', async () => {
    const operator = await request(app)
      .get(`/api/hostels/${fx().hostel.id}/media`)
      .set(auth(ownerToken));
    const publishedOps = operator.body.data.items.filter((item) => item.is_published && !item.deleted_at);
    const guest = await request(app).get(publicMedia(fx().hostel.id));
    expect(guest.body.data.items).toHaveLength(publishedOps.length);
  });

  test('TC-M-34 room 101 photos are grouped only under 101', async () => {
    const res = await request(app).get(publicMedia(fx().hostel.id)).query({ category: 'room' });
    expect(res.status).toBe(200);
    const rooms = res.body.data.rooms;
    expect(rooms['101'].photos).toHaveLength(2);
    expect(rooms['101'].photos.every((item) => item.room_number === '101')).toBe(true);
    expect(rooms['102'].photos.every((item) => item.room_number === '102')).toBe(true);
    expect(rooms['101'].photos.some((item) => item.room_number === '102')).toBe(false);
    expect(rooms['101'].room_type).toBe('double');
    expect(Number(rooms['101'].rent)).toBe(8000);
    expect(rooms['101'].beds_available).toBeGreaterThanOrEqual(0);
    expect(rooms['101']).not.toHaveProperty('tenants');
    expect(rooms['102'].photos).toHaveLength(2);
    expect(res.body.data.exterior).toEqual([]);
    expect(res.body.data.cover.caption).toBe('Gate');
    expect(res.body.data.cover.category).toBe('exterior');
  });

  test('TC-M-31 counts stay on chips even when a category filter empties other groups', async () => {
    const res = await request(app).get(publicMedia(fx().hostel.id)).query({ category: 'floor' });
    expect(res.status).toBe(200);
    expect(res.body.data.exterior).toEqual([]);
    expect(res.body.data.interior_common).toEqual([]);
    expect(res.body.data.panorama_360).toEqual([]);
    expect(res.body.data.counts.floor).toBeGreaterThanOrEqual(1);
    expect(res.body.data.counts.exterior).toBeGreaterThanOrEqual(3);
    expect(res.body.data.counts.interior_common).toBeGreaterThanOrEqual(4);
    expect(res.body.data.counts.all).toBeGreaterThan(res.body.data.items.length);
  });

  test('floor photos are grouped under floors[n]', async () => {
    const res = await request(app).get(publicMedia(fx().hostel.id)).query({ category: 'floor' });
    expect(res.status).toBe(200);
    expect(res.body.data.floors['1'].length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.floors['1'].every((item) => item.floor_number === 1)).toBe(true);
    expect(res.body.data.exterior).toEqual([]);
  });

  test('room photos with no live room_id are omitted from public JSON', async () => {
    const { PropertyMedia } = require('../models');
    const orphan = await PropertyMedia.create({
      hostel_id: fx().hostel.id,
      category: 'room',
      capture_kind: 'photo',
      room_id: 999001,
      room_number: 'GONE',
      file_path: `/uploads/media/${fx().hostel.id}/orphan-gone.jpg`,
      thumb_path: `/uploads/media/${fx().hostel.id}/orphan-gone-thumb.jpg`,
      mime_type: 'image/jpeg',
      file_size: 900,
      uploaded_by: fx().owner.id,
      is_published: true,
    });
    const res = await request(app).get(publicMedia(fx().hostel.id)).query({ category: 'room' });
    expect(res.status).toBe(200);
    expect(res.body.data.rooms.GONE).toBeUndefined();
    expect(res.body.data.items.some((item) => item.id === orphan.id)).toBe(false);
  });

  test('GET listing by code includes hostel facts and grouped media', async () => {
    const { publicHostel } = require('../services/publicListingMedia');
    expect(publicHostel({ amenities: '["WiFi","Gym"]', address: '12 MG Road, Ward' }).amenities).toEqual(['WiFi', 'Gym']);
    expect(publicHostel({ amenities: '["WiFi","Gym"]', address: '12 MG Road, Ward' }).area).toBe('12 MG Road');
    await fx().hostel.update({ amenities: ['WiFi', 'Laundry'] });

    const res = await request(app).get(publicListing(fx().hostel.code));
    expect(res.status).toBe(200);
    expect(res.body.data.hostel.name).toBe(fx().hostel.name);
    expect(res.body.data.hostel.city).toBe('Bangalore');
    expect(res.body.data.hostel.amenities).toEqual(expect.arrayContaining(['WiFi', 'Laundry']));
    expect(res.body.data.hostel.area).toBe('1 Test Street');
    expect(res.body.data.hostel).not.toHaveProperty('owner_id');
    expect(res.body.data.hostel).not.toHaveProperty('database_name');
    expect(res.body.data.hostel.booking_model).toBe('approval_first');
    expect(res.body.data.hostel.booking_badge).toBe('Request to book');
    expect(res.body.data.preview).toBe(false);
    expect(res.body.data.availability.monthly_rent_from).toBe(8000);
    expect(res.body.data.availability.occupancy.map((row) => row.room_type)).toEqual(
      expect.arrayContaining(['single', 'double'])
    );
    expect(res.body.data.seo.title).toMatch(/Test Garden Hostel/);
    expect(res.body.data.seo.share_image).toMatch(/^\/uploads\/media\//);
    expect(res.body.data.rules.gender_policy).toBe('unisex');
    expect(res.body.data.media.items.length).toBeGreaterThan(0);
    expect(res.body.data.media.rooms['101'].photos.every((item) => item.room_number === '101')).toBe(true);
    expect(res.body.data.media.rooms['101']).toMatchObject({ room_type: 'double' });
    expect(JSON.stringify(res.body)).not.toMatch(/Test Tenant/);
  });

  test('BKG-003 unpublished listing is 404 for guests; Regular owner 404; unpublished Silver preview for owner', async () => {
    const guest = await request(app).get(publicListing(fx().pendingHostel.id));
    expect(guest.status).toBe(404);
    expect(JSON.stringify(guest.body)).not.toMatch(/\/uploads\/media\//);

    const tenantToken = await login(fx().tenantUser.email, PASSWORD);
    expect((await request(app).get(publicListing(fx().pendingHostel.id)).set(auth(tenantToken))).status).toBe(404);

    const regularOwner = await request(app)
      .get(publicListing(fx().pendingHostel.id))
      .set(auth(ownerToken));
    expect(regularOwner.status).toBe(404);
    expect(JSON.stringify(regularOwner.body)).not.toMatch(/\/uploads\/media\//);

    const { Hostel } = require('../models');
    const silver = await Hostel.findByPk(fx().hostel.id);
    const wasPublished = silver.listing_published;
    await silver.update({ listing_published: false });
    try {
      const ownerPreview = await request(app)
        .get(publicListing(fx().hostel.id))
        .set(auth(ownerToken));
      expect(ownerPreview.status).toBe(200);
      expect(ownerPreview.body.data.preview).toBe(true);
      expect(ownerPreview.headers['cache-control']).toMatch(/no-store/i);
      expect(ownerPreview.body.data.hostel.name).toBe(fx().hostel.name);
      expect(ownerPreview.body.data.hostel).not.toHaveProperty('owner_id');
    } finally {
      await silver.update({ listing_published: wasPublished });
    }
  });

  test('invalid category is 422', async () => {
    const res = await request(app).get(publicMedia(fx().hostel.id)).query({ category: 'kyc' });
    expect(res.status).toBe(422);
  });

  test('TC-M-15 public GET omits soft-deleted', async () => {
    const { PropertyMedia } = require('../models');
    const extra = await PropertyMedia.create({
      hostel_id: fx().hostel.id,
      category: 'interior_common',
      capture_kind: 'photo',
      file_path: `/uploads/media/${fx().hostel.id}/extra-del.jpg`,
      thumb_path: `/uploads/media/${fx().hostel.id}/extra-del-thumb.jpg`,
      mime_type: 'image/jpeg',
      file_size: 900,
      uploaded_by: fx().owner.id,
      is_published: true,
      caption: 'spare lounge',
    });
    const before = await request(app).get(publicMedia(fx().hostel.id));
    expect(before.status).toBe(200);
    expect(before.body.data.items.some((item) => item.id === extra.id)).toBe(true);

    const del = await request(app)
      .delete(`/api/hostels/${fx().hostel.id}/media/${extra.id}`)
      .set(auth(ownerToken));
    expect(del.status).toBe(200);

    const guest = await request(app).get(publicMedia(fx().hostel.id));
    expect(guest.status).toBe(200);
    expect(guest.body.data.items.some((item) => item.id === extra.id)).toBe(false);
    expect(JSON.stringify(guest.body)).not.toContain(extra.file_path);
  });
});
