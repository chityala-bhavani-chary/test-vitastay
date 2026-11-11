/**
 * TC-M-01…16 — authenticated hostel media APIs (owner / supervisor / Super Admin).
 */
const { Op } = require('sequelize');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const {
  mediaUrl,
  pixel,
  postMedia,
  loadPanoFixture,
  PANO_WIDTH,
  PANO_HEIGHT,
  cleanupTestUploads,
} = require('./helpers/mediaTest');
const { computeChecklist } = require('../services/mediaPublishGuard');
const { hashPassword } = require('../helpers/password');

const fx = () => global.__erp;

describe('media publish checklist math', () => {
  test('can_publish is false until minima and cover are met', () => {
    const rooms = [
      { id: 1, room_type: 'double', floor: 1 },
      { id: 2, room_type: 'single', floor: 1 },
    ];
    const empty = computeChecklist([], rooms);
    expect(empty.can_publish).toBe(false);
    expect(empty.exterior.ok).toBe(false);
    expect(empty.missing.some((row) => row.code === 'exterior')).toBe(true);

    const ready = computeChecklist([
      ...Array.from({ length: 3 }, (_, i) => ({ category: 'exterior', is_cover: i === 0, is_published: true })),
      ...Array.from({ length: 4 }, () => ({ category: 'interior_common', is_published: true })),
      { category: 'room', room_id: 1, is_published: true },
      { category: 'room', room_id: 1, is_published: true },
      { category: 'room', room_id: 2, is_published: true },
      { category: 'room', room_id: 2, is_published: true },
      { category: 'floor', floor_number: 1, is_published: true },
      { category: 'panorama_360', is_published: true },
    ], rooms);
    expect(ready.can_publish).toBe(true);
    expect(ready.room.ok).toBe(true);
    expect(ready.cover.ok).toBe(true);
    expect(ready.missing).toEqual([]);
    expect(ready.has_360).toBe(true);
  });

  test('DEC-06 publish works without 360; 360 stays recommended', () => {
    const rooms = [{ id: 1, room_type: 'double', floor: 1 }];
    const noPano = computeChecklist([
      ...Array.from({ length: 3 }, (_, i) => ({ category: 'exterior', is_cover: i === 0, is_published: true })),
      ...Array.from({ length: 4 }, () => ({ category: 'interior_common', is_published: true })),
      { category: 'room', room_id: 1, is_published: true },
      { category: 'room', room_id: 1, is_published: true },
      { category: 'floor', floor_number: 1, is_published: true },
    ], rooms);
    expect(noPano.minima_ok).toBe(true);
    expect(noPano.can_publish).toBe(true);
    expect(noPano.has_360).toBe(false);
    expect(noPano.panorama_360.ok).toBe(false);
    expect(noPano.panorama_360.blocking).toBe(false);
    expect(noPano.missing.some((row) => row.code === 'panorama_360')).toBe(false);
    expect(noPano.recommended.some((row) => row.code === 'panorama_360')).toBe(true);
  });
});

describe('TC-M property media API', () => {
  let ownerToken;
  let tenantToken;
  let saToken;
  let supervisorToken;
  let jpeg;
  let png;
  let webp;
  let jpegBufs;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    tenantToken = await login(fx().tenantUser.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
    jpeg = await pixel('jpeg');
    png = await pixel('png');
    webp = await pixel('webp', 16, 8);
    jpegBufs = await Promise.all(Array.from({ length: 10 }, () => pixel('jpeg')));

    const { User, SupervisorHostel } = require('../models');
    const supervisor = await User.create({
      email: 'supervisor@media.test.local',
      first_name: 'Media',
      last_name: 'Supervisor',
      role: 'supervisor',
      password: await hashPassword(PASSWORD),
      is_active: true,
      email_verified: true,
    });
    await SupervisorHostel.create({
      supervisor_id: supervisor.id,
      hostel_id: fx().pendingHostel.id,
    });
    supervisorToken = await login(supervisor.email, PASSWORD);
  });

  afterAll(() => {
    cleanupTestUploads([fx()?.hostel?.id, fx()?.pendingHostel?.id]);
  });

  test('TC-M-01 owner POST 3 JPEGs category=exterior', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'Gate' },
      jpegBufs.slice(0, 3).map((buffer, i) => ({
        buffer,
        filename: `ext-${i}.jpg`,
        contentType: 'image/jpeg',
      }))
    );
    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.items.every((item) => item.category === 'exterior')).toBe(true);
    expect(res.body.data.items[0].url).toMatch(/^\/uploads\/media\//);
    expect(res.body.data.items[0].thumb_url).toBeTruthy();
    const listed = await request(app).get(mediaUrl(fx().hostel.id)).set(auth(ownerToken));
    expect(listed.body.data.quota.max).toBe(200);
    expect(listed.body.data.quota.used).toBeGreaterThanOrEqual(3);
    expect(listed.body.data.quota.remaining).toBe(200 - listed.body.data.quota.used);
  });

  test('TC-M-02 PATCH is_cover=true clears the previous cover', async () => {
    const first = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', is_cover: true, caption: 'cover-a' },
      [{ buffer: jpeg, filename: 'cover-a.jpg', contentType: 'image/jpeg' }]
    );
    const second = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'cover-b' },
      [{ buffer: jpeg, filename: 'cover-b.jpg', contentType: 'image/jpeg' }]
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const aId = first.body.data.items[0].id;
    const bId = second.body.data.items[0].id;

    const patch = await request(app)
      .patch(mediaUrl(fx().hostel.id, `/${bId}`))
      .set(auth(ownerToken))
      .send({ is_cover: true });
    expect(patch.status).toBe(200);
    expect(patch.body.data.is_cover).toBe(true);

    const list = await request(app).get(mediaUrl(fx().hostel.id)).set(auth(ownerToken));
    expect(list.status).toBe(200);
    expect(list.body.data.cover.id).toBe(bId);
    const a = list.body.data.items.find((item) => item.id === aId);
    const b = list.body.data.items.find((item) => item.id === bId);
    expect(a.is_cover).toBe(false);
    expect(b.is_cover).toBe(true);
    expect(list.body.data.cover.category).toBe('exterior');
    expect(list.body.data.checklist.cover.item.id).toBe(bId);
    expect(list.body.data.items.filter((item) => item.is_cover)).toHaveLength(1);
  });

  test('TC-M-02b clearing the only cover without a replacement is 422', async () => {
    const first = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', is_cover: true, caption: 'only-cover' },
      [{ buffer: jpeg, filename: 'only-cover.jpg', contentType: 'image/jpeg' }]
    );
    const id = first.body.data.items[0].id;
    const res = await request(app)
      .patch(mediaUrl(fx().hostel.id, `/${id}`))
      .set(auth(ownerToken))
      .send({ is_cover: false });
    expect(res.status).toBe(422);
    const list = await request(app).get(mediaUrl(fx().hostel.id)).set(auth(ownerToken));
    expect(list.body.data.cover.id).toBe(id);
  });

  test('TC-M-02c deleting the cover promotes an outside photo', async () => {
    const first = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', is_cover: true, caption: 'old-cover' },
      [{ buffer: jpeg, filename: 'old-cover.jpg', contentType: 'image/jpeg' }]
    );
    const interior = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'interior_common', caption: 'toilet' },
      [{ buffer: jpeg, filename: 'toilet.jpg', contentType: 'image/jpeg' }]
    );
    await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'facade' },
      [{ buffer: jpeg, filename: 'facade.jpg', contentType: 'image/jpeg' }]
    );
    const coverId = first.body.data.items[0].id;
    const toiletId = interior.body.data.items[0].id;

    const del = await request(app)
      .delete(mediaUrl(fx().hostel.id, `/${coverId}`))
      .set(auth(ownerToken));
    expect(del.status).toBe(200);

    const list = await request(app).get(mediaUrl(fx().hostel.id)).set(auth(ownerToken));
    expect(list.body.data.cover.id).not.toBe(coverId);
    expect(list.body.data.cover.id).not.toBe(toiletId);
    expect(list.body.data.cover.category).toBe('exterior');
    expect(list.body.data.items.filter((item) => item.is_cover)).toHaveLength(1);
  });

  test('TC-M-03 upload 4 interior_common — checklist interior ok', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'interior_common', caption: 'lounge' },
      jpegBufs.slice(0, 4).map((buffer, i) => ({
        buffer,
        filename: `int-${i}.jpg`,
        contentType: 'image/jpeg',
      }))
    );
    expect(res.status).toBe(201);
    const list = await request(app).get(mediaUrl(fx().hostel.id)).set(auth(ownerToken));
    expect(list.body.data.checklist.interior_common.count).toBeGreaterThanOrEqual(4);
    expect(list.body.data.checklist.interior_common.ok).toBe(true);
  });

  test('TC-M-04 upload 2 room photos with room_id', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'room', room_id: fx().doubleRoom.id, caption: '101' },
      [
        { buffer: jpeg, filename: '101-a.jpg', contentType: 'image/jpeg' },
        { buffer: jpeg, filename: '101-b.jpg', contentType: 'image/jpeg' },
      ]
    );
    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items.every((item) => item.room_id === fx().doubleRoom.id)).toBe(true);
    expect(res.body.data.items[0].room_number).toBe('101');
  });

  test('TC-M-05 category=room without room_id is 422', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'room' },
      [{ buffer: jpeg, filename: 'noroom.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(422);
  });

  test('TC-M-05b deleting a room hides its listing photos', async () => {
    const { Room } = require('../models');
    const extra = await Room.create({
      hostel_id: fx().hostel.id,
      room_number: '199',
      floor: 1,
      room_type: 'triple',
      sharing_type: 3,
      rent: 5000,
      status: 'vacant',
    });
    const uploaded = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'room', room_id: extra.id, caption: '199 window' },
      [
        { buffer: jpeg, filename: '199-a.jpg', contentType: 'image/jpeg' },
        { buffer: jpeg, filename: '199-b.jpg', contentType: 'image/jpeg' },
      ]
    );
    expect(uploaded.status).toBe(201);
    const ids = uploaded.body.data.items.map((item) => item.id);

    const del = await request(app)
      .delete(`/api/rooms/${extra.id}`)
      .query({ hostelId: fx().hostel.id })
      .set(auth(ownerToken));
    expect(del.status).toBe(200);

    const list = await request(app)
      .get(mediaUrl(fx().hostel.id))
      .query({ category: 'room' })
      .set(auth(ownerToken));
    expect(list.body.data.items.some((item) => ids.includes(item.id))).toBe(false);

    const withDeleted = await request(app)
      .get(mediaUrl(fx().hostel.id))
      .query({ category: 'room', include_deleted: true })
      .set(auth(ownerToken));
    expect(withDeleted.body.data.items.filter((item) => ids.includes(item.id)).length).toBe(2);
  });

  test('TC-M-06 floor photo with floor_number=2', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'floor', floor_number: 2, caption: 'second floor' },
      [{ buffer: jpeg, filename: 'floor2.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(201);
    expect(res.body.data.items[0].floor_number).toBe(2);

    const list = await request(app)
      .get(mediaUrl(fx().hostel.id))
      .query({ category: 'floor', floor_number: 2 })
      .set(auth(ownerToken));
    expect(list.status).toBe(200);
    expect(list.body.data.items.some((item) => item.floor_number === 2)).toBe(true);
  });

  test('TC-M-07 floor_number=99 is 422', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'floor', floor_number: 99 },
      [{ buffer: jpeg, filename: 'floor99.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(422);
  });

  test('TC-M-07b category=floor without floor_number is 422', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'floor' },
      [{ buffer: jpeg, filename: 'nofloor.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(422);
  });

  test('TC-M-08 panorama_360 WebP sets capture_kind', async () => {
    const pano = await pixel('webp', 64, 32);
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'panorama_360', caption: 'entrance' },
      [{ buffer: pano, filename: 'pano.webp', contentType: 'image/webp' }]
    );
    expect(res.status).toBe(201);
    expect(res.body.data.items[0].capture_kind).toBe('panorama_360');
    expect(res.body.data.items[0].category).toBe('panorama_360');
    expect(res.body.data.items[0].width).toBe(64);
    expect(res.body.data.items[0].height).toBe(32);
    expect(res.body.data.items[0].aspect_ok).toBe(true);
    expect(res.body.data.items[0].thumb_url).toMatch(/_thumb/);
  });

  test('TC-M-08 fixture 2:1 JPEG keeps original pixels', async () => {
    const pano = await loadPanoFixture();
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'panorama_360', caption: 'fixture' },
      [{ buffer: pano, filename: 'pano-2x1.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(201);
    const item = res.body.data.items[0];
    expect(item.capture_kind).toBe('panorama_360');
    expect(item.width).toBe(PANO_WIDTH);
    expect(item.height).toBe(PANO_HEIGHT);
    expect(item.aspect_ok).toBe(true);
    expect(item.file_size).toBe(pano.length);
  });

  test('TC-M-08b panorama optional room_id is stored', async () => {
    const pano = await pixel('jpeg', 64, 32);
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'panorama_360', room_id: fx().doubleRoom.id, caption: 'room 101' },
      [{ buffer: pano, filename: 'room-pano.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(201);
    expect(res.body.data.items[0].room_id).toBe(fx().doubleRoom.id);
    expect(res.body.data.items[0].room_number).toBe('101');
    expect(res.body.data.items[0].category).toBe('panorama_360');
  });

  test('TC-M-08c panorama floor_number=99 is 422', async () => {
    const pano = await pixel('jpeg', 64, 32);
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'panorama_360', floor_number: 99 },
      [{ buffer: pano, filename: 'bad-floor-pano.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(422);
  });

  test('TC-M-09 26 MB 360 is 413', async () => {
    const huge = Buffer.alloc(26 * 1024 * 1024, 1);
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'panorama_360' },
      [{ buffer: huge, filename: 'huge.jpg', contentType: 'image/jpeg' }]
    );
    expect([413, 422]).toContain(res.status);
    expect(String(res.body.message)).toMatch(/too big|25 MB/i);
  });

  test('TC-M-09b 11 MB still is 413 with 10 MB copy', async () => {
    const huge = Buffer.alloc(11 * 1024 * 1024, 1);
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior' },
      [{ buffer: huge, filename: 'huge-still.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(413);
    expect(String(res.body.message)).toMatch(/10 MB/i);
  });

  test('TC-M-10 .exe is 400 invalid type', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior' },
      [{ buffer: Buffer.from('MZ'), filename: 'malware.exe', contentType: 'application/octet-stream' }]
    );
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/invalid file type|jpeg|webp/i);
  });

  test('TC-M-10 .heic is 400 invalid type', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior' },
      [{ buffer: Buffer.from('ftypheic'), filename: 'phone.heic', contentType: 'image/heic' }]
    );
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/invalid file type|jpeg|webp|heic/i);
  });

  test('TC-M-11 Super Admin uploads to another owner hostel and audits', async () => {
    const res = await postMedia(
      saToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'tech-upload' },
      [{ buffer: png, filename: 'tech.png', contentType: 'image/png' }]
    );
    expect(res.status).toBe(201);
    const { AuditLog } = require('../models');
    const log = await AuditLog.findOne({
      where: {
        entity_type: 'property_media',
        user_id: fx().superAdmin.id,
        action: 'CREATE',
      },
      order: [['id', 'DESC']],
    });
    expect(log).toBeTruthy();
    expect(log.entity_id).toBe(res.body.data.items[0].id);
    const recorded = typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values;
    expect(recorded.uploaded_by).toBe(fx().superAdmin.id);
    expect(recorded.role).toBe('super_admin');
    expect(JSON.stringify(recorded)).toMatch(/tech\.png/);
    expect(res.body.data.items[0].uploaded_by).toBe(fx().superAdmin.id);

    const open = await request(app).get(`/api/hostels/${fx().hostel.id}`).set(auth(saToken));
    expect(open.status).toBe(200);
    const media = await request(app).get(mediaUrl(fx().hostel.id)).set(auth(saToken));
    expect(media.status).toBe(200);
  });

  test('TC-M-12 supervisor of hostel A cannot upload to B', async () => {
    const res = await postMedia(
      supervisorToken,
      fx().hostel.id,
      { category: 'exterior' },
      [{ buffer: jpeg, filename: 'scope.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(403);
    expect(String(res.body.message)).toMatch(/not assigned/i);
  });

  test('TC-M-12b supervisor GET unassigned hostel is 403', async () => {
    const res = await request(app).get(`/api/hostels/${fx().hostel.id}`).set(auth(supervisorToken));
    expect(res.status).toBe(403);
    expect(String(res.body.message)).toMatch(/not assigned/i);
  });

  test('TC-M-12c supervisor list and media are assigned hostels only', async () => {
    const list = await request(app).get('/api/hostels').set(auth(supervisorToken));
    expect(list.status).toBe(200);
    const ids = (list.body.data || []).map((row) => row.id);
    expect(ids).toContain(fx().pendingHostel.id);
    expect(ids).not.toContain(fx().hostel.id);

    const allowed = await request(app).get(mediaUrl(fx().pendingHostel.id)).set(auth(supervisorToken));
    expect(allowed.status).toBe(200);

    const blocked = await request(app).get(mediaUrl(fx().hostel.id)).set(auth(supervisorToken));
    expect(blocked.status).toBe(403);
  });

  test('DEC-05 supervisor uploads on assigned hostel by default', async () => {
    const hostelId = fx().pendingHostel.id;
    const res = await postMedia(
      supervisorToken,
      hostelId,
      { category: 'exterior', caption: 'Warden shot' },
      [{ buffer: jpeg, filename: 'warden.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(201);
    expect(res.body.data.items[0].uploaded_by).toBeTruthy();
  });

  test('DEC-05 owner can lock supervisor uploads; GET still works', async () => {
    const { Hostel } = require('../models');
    const hostelId = fx().pendingHostel.id;
    // Active so supervisor PUT is allowed to reach field sanitize (still cannot flip the flag).
    await Hostel.update({ status: 'active' }, { where: { id: hostelId } });

    const locked = await request(app)
      .put(`/api/hostels/${hostelId}`)
      .set(auth(ownerToken))
      .send({ supervisor_media_upload: false });
    expect(locked.status).toBe(200);
    expect(locked.body.data.supervisor_media_upload).toBe(false);

    const sneak = await request(app)
      .put(`/api/hostels/${hostelId}`)
      .set(auth(supervisorToken))
      .send({ supervisor_media_upload: true, description: 'sneak' });
    expect(sneak.status).toBe(200);
    expect((await Hostel.findByPk(hostelId)).supervisor_media_upload).toBe(false);

    const denied = await postMedia(
      supervisorToken,
      hostelId,
      { category: 'exterior' },
      [{ buffer: jpeg, filename: 'locked.jpg', contentType: 'image/jpeg' }]
    );
    expect(denied.status).toBe(403);
    expect(String(denied.body.message)).toMatch(/turned off supervisor photo/i);

    const stillSee = await request(app).get(mediaUrl(hostelId)).set(auth(supervisorToken));
    expect(stillSee.status).toBe(200);

    const unlocked = await request(app)
      .put(`/api/hostels/${hostelId}`)
      .set(auth(ownerToken))
      .send({ supervisor_media_upload: true });
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.data.supervisor_media_upload).toBe(true);

    await Hostel.update({ status: 'pending_approval' }, { where: { id: hostelId } });
  });

  test('TC-M-13 tenant POST media is 403', async () => {
    const res = await postMedia(
      tenantToken,
      fx().hostel.id,
      { category: 'exterior' },
      [{ buffer: jpeg, filename: 'tenant.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(403);
  });

  test('TC-M-14 PUT reorder changes GET order', async () => {
    const createdA = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'reorder-a', sort_order: 10 },
      [{ buffer: jpeg, filename: 'ra.jpg', contentType: 'image/jpeg' }]
    );
    const createdB = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'reorder-b', sort_order: 11 },
      [{ buffer: jpeg, filename: 'rb.jpg', contentType: 'image/jpeg' }]
    );
    const aId = createdA.body.data.items[0].id;
    const bId = createdB.body.data.items[0].id;

    const put = await request(app)
      .put(mediaUrl(fx().hostel.id, '/reorder'))
      .set(auth(ownerToken))
      .send({ items: [{ id: aId, sort_order: 50 }, { id: bId, sort_order: 40 }] });
    expect(put.status).toBe(200);

    const list = await request(app)
      .get(mediaUrl(fx().hostel.id))
      .query({ category: 'exterior' })
      .set(auth(ownerToken));
    const a = list.body.data.items.find((item) => item.id === aId);
    const b = list.body.data.items.find((item) => item.id === bId);
    expect(b.sort_order).toBeLessThan(a.sort_order);
  });

  test('TC-M-15 DELETE is soft — GET omits unless include_deleted', async () => {
    const created = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'to-delete' },
      [{ buffer: jpeg, filename: 'del.jpg', contentType: 'image/jpeg' }]
    );
    const id = created.body.data.items[0].id;
    const del = await request(app)
      .delete(mediaUrl(fx().hostel.id, `/${id}`))
      .set(auth(ownerToken));
    expect(del.status).toBe(200);

    const list = await request(app).get(mediaUrl(fx().hostel.id)).set(auth(ownerToken));
    expect(list.body.data.items.some((item) => item.id === id)).toBe(false);

    const withDeleted = await request(app)
      .get(mediaUrl(fx().hostel.id))
      .query({ include_deleted: true })
      .set(auth(ownerToken));
    expect(withDeleted.body.data.items.some((item) => item.id === id)).toBe(true);
  });

  test('TC-M-16 bulk 10 files in one request', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'bulk' },
      jpegBufs.map((buffer, i) => ({
        buffer,
        filename: `bulk-${i}.jpg`,
        contentType: 'image/jpeg',
      }))
    );
    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(10);
  });

  test('TC-M-17 caption of 201 chars is 422', async () => {
    const res = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'x'.repeat(201) },
      [{ buffer: jpeg, filename: 'cap.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(422);
  });

  test('TC-M-18 replace file keeps id and swaps the bytes', async () => {
    const created = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'replace-me' },
      [{ buffer: jpeg, filename: 'old.jpg', contentType: 'image/jpeg' }]
    );
    const id = created.body.data.items[0].id;
    const oldUrl = created.body.data.items[0].url;
    const res = await request(app)
      .post(mediaUrl(fx().hostel.id, `/${id}/replace`))
      .set(auth(ownerToken))
      .attach('files', png, { filename: 'new.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.url).not.toBe(oldUrl);
    expect(res.body.data.mime_type).toBe('image/png');
    expect(res.body.data.caption).toBe('replace-me');
  });

  test('TC-M-15c restore brings a soft-deleted photo back', async () => {
    const created = await postMedia(
      ownerToken,
      fx().hostel.id,
      { category: 'exterior', caption: 'restore-me' },
      [{ buffer: jpeg, filename: 'restore.jpg', contentType: 'image/jpeg' }]
    );
    const id = created.body.data.items[0].id;
    await request(app).delete(mediaUrl(fx().hostel.id, `/${id}`)).set(auth(ownerToken));
    const restored = await request(app)
      .post(mediaUrl(fx().hostel.id, `/${id}/restore`))
      .set(auth(ownerToken));
    expect(restored.status).toBe(200);
    expect(restored.body.data.id).toBe(id);
    expect(restored.body.data.deleted_at).toBeFalsy();
    const list = await request(app).get(mediaUrl(fx().hostel.id)).set(auth(ownerToken));
    expect(list.body.data.items.some((item) => item.id === id)).toBe(true);
  });

  test('TC-M-16b over hostel quota is 422', async () => {
    const { PropertyMedia } = require('../models');
    const hostelId = fx().hostel.id;
    const used = await PropertyMedia.count({ where: { hostel_id: hostelId } });
    const stubs = [];
    for (let i = used; i < 200; i += 1) {
      stubs.push({
        hostel_id: hostelId,
        category: 'exterior',
        capture_kind: 'photo',
        file_path: `/uploads/media/${hostelId}/quota-${i}.jpg`,
        mime_type: 'image/jpeg',
        file_size: 100,
        uploaded_by: fx().owner.id,
        is_published: true,
        sort_order: 8000 + i,
      });
    }
    if (stubs.length) await PropertyMedia.bulkCreate(stubs);
    const res = await postMedia(
      ownerToken,
      hostelId,
      { category: 'exterior' },
      [{ buffer: jpeg, filename: 'over.jpg', contentType: 'image/jpeg' }]
    );
    expect(res.status).toBe(422);
    await PropertyMedia.destroy({
      where: { hostel_id: hostelId, file_path: { [Op.like]: '%/quota-%' } },
      force: true,
    });
  });
});
