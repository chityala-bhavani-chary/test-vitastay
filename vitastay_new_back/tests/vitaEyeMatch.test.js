/**
 * PKG-011 / TC-PKG-11 — Gold gate still → known / unknown / blocked + notify.
 * Cosine vs enrol + watchlist. Event row. Not-a-match ack. No door lock.
 */
const fs = require('fs');
const path = require('path');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { pixel } = require('./helpers/mediaTest');
const { refreshListingProjection } = require('../services/listingProjection');
const { UPGRADE_COPY } = require('../services/ownerPlan');

const fx = () => global.__erp;
const stillDir = (hostelId) => path.join(__dirname, '..', 'uploads', 'vita-eye', String(hostelId));

describe('PKG-011 Vita Eye match', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let staffToken;
  let gold;
  let resident;
  let residentUser;
  let blue;
  let red;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    staffToken = await login(fx().staffUser.email, PASSWORD);
    blue = await pixel('jpeg', 64, 64, { r: 20, g: 40, b: 220 });
    red = await pixel('jpeg', 64, 64, { r: 220, g: 20, b: 20 });
    const { Hostel, User, Tenant } = require('../models');
    const { hashPassword } = require('../helpers/password');
    gold = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Gold Eye Match PG',
      code: 'GLDEYE11',
      address: '11 Eye Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411011',
      status: 'active',
      listing_published: true,
      plan: 'gold',
      plan_status: 'active',
    });
    residentUser = await User.create({
      email: 'pkg011.resident@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Match',
      last_name: 'Resident',
      role: 'tenant',
      is_active: true,
      email_verified: true,
    });
    resident = await Tenant.create({
      user_id: residentUser.id,
      hostel_id: gold.id,
      full_name: 'Match Resident',
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
    await FaceEvent.destroy({ where: { hostel_id: ids }, force: true }).catch(() => {});
    await FaceWatchlist.destroy({ where: { hostel_id: ids }, force: true }).catch(() => {});
    await FaceEnrollment.destroy({ where: { hostel_id: ids }, force: true }).catch(() => {});
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

  const capture = (token, hostelId, file, gate = 'main') => {
    let req = request(app)
      .post(`/api/hostels/${hostelId}/vita-eye/capture`)
      .set(auth(token));
    if (gate) req = req.field('gate', gate);
    if (file) {
      req = req.attach('still', file, { filename: 'gate.jpg', contentType: 'image/jpeg' });
    }
    return req;
  };

  const addWatch = (token, hostelId, file, fields) => {
    let req = request(app)
      .post(`/api/hostels/${hostelId}/vita-eye/watchlist`)
      .set(auth(token));
    Object.entries(fields || {}).forEach(([key, value]) => {
      req = req.field(key, String(value));
    });
    if (file) {
      req = req.attach('still', file, { filename: 'blocked.jpg', contentType: 'image/jpeg' });
    }
    return req;
  };

  const noSecrets = (body) => {
    const blob = JSON.stringify(body);
    expect(blob).not.toMatch(/embedding_cipher/);
    expect(blob).not.toMatch(/\/uploads\/tenants\//);
  };

  test('empty gallery capture is unknown; owner and staff are notified; doors stay unlocked', async () => {
    const res = await capture(ownerToken, gold.id, red, 'front');
    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('unknown');
    expect(res.body.data.label_text).toMatch(/unknown/i);
    expect(res.body.data.door_lock).toBe(false);
    expect(res.body.data.elapsed_ms).toBeLessThan(30000);
    expect(res.body.data.notified).toBe(true);
    expect(res.body.data.still_url).toMatch(/\/uploads\/vita-eye\//);
    expect(res.body.data.match_enrollment_id).toBeNull();
    noSecrets(res.body);

    const { Notification } = require('../models');
    const ownerNotes = await Notification.findAll({ where: { user_id: fx().owner.id } });
    const staffNotes = await Notification.findAll({ where: { user_id: fx().staffUser.id } });
    const ownerHit = ownerNotes.find((row) => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return data?.kind === 'vita_eye_match' && Number(data?.entity_id) === res.body.data.id;
    });
    const staffHit = staffNotes.find((row) => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return data?.kind === 'vita_eye_match' && Number(data?.entity_id) === res.body.data.id;
    });
    expect(ownerHit).toBeTruthy();
    expect(staffHit).toBeTruthy();
    expect(ownerHit.type).toBe('warning');
    expect(ownerHit.message).toMatch(/not locked/i);
  });

  test('same still as enrol is known_resident above threshold', async () => {
    const enrolled = await enroll(ownerToken, gold.id, {
      person_type: 'resident',
      person_id: resident.id,
      consent: 'true',
    }, blue);
    expect(enrolled.status).toBe(200);

    const res = await capture(ownerToken, gold.id, blue, 'front');
    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('known_resident');
    expect(Number(res.body.data.confidence)).toBeGreaterThanOrEqual(0.85);
    expect(res.body.data.match_enrollment_id).toBe(enrolled.body.data.id);
    expect(res.body.data.door_lock).toBe(false);
    expect(res.body.data.elapsed_ms).toBeLessThan(30000);
    expect(res.body.data.notified).toBe(true);
    noSecrets(res.body);

    const { Notification } = require('../models');
    const notes = await Notification.findAll({ where: { user_id: fx().owner.id } });
    const hit = notes.find((row) => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return data?.kind === 'vita_eye_match' && Number(data?.entity_id) === res.body.data.id;
    });
    expect(hit).toBeTruthy();
    expect(hit.type).toBe('info');
  });

  test('different colour still stays unknown until watchlist; blocked wins over known', async () => {
    const miss = await capture(staffToken, gold.id, red, 'side');
    expect(miss.status).toBe(200);
    expect(miss.body.data.label).toBe('unknown');
    expect(Number(miss.body.data.confidence)).toBeLessThan(0.85);

    const listed = await addWatch(ownerToken, gold.id, red, {
      reason: 'Do not admit — premises security',
      label: 'Blocked visitor',
    });
    expect(listed.status).toBe(200);
    expect(listed.body.data.reason).toMatch(/premises/i);
    expect(listed.body.data.embedding_cipher).toBeUndefined();
    expect(listed.body.data.still_url).toMatch(/\/uploads\/vita-eye\//);
    noSecrets(listed.body);

    const blocked = await capture(ownerToken, gold.id, red, 'side');
    expect(blocked.status).toBe(200);
    expect(blocked.body.data.label).toBe('blocked');
    expect(Number(blocked.body.data.confidence)).toBeGreaterThanOrEqual(0.85);
    expect(blocked.body.data.match_watchlist_id).toBe(listed.body.data.id);
    expect(blocked.body.data.match_enrollment_id).toBeNull();
    expect(blocked.body.data.door_lock).toBe(false);
    noSecrets(blocked.body);

    const sameBlue = await capture(ownerToken, gold.id, blue, 'front');
    expect(sameBlue.body.data.label).toBe('known_resident');
  });

  test('owner acks not a match; status lists events and watchlist; guest still 404', async () => {
    const events = await request(app)
      .get(`/api/hostels/${gold.id}/vita-eye/events`)
      .set(auth(ownerToken));
    expect(events.status).toBe(200);
    expect(events.body.data.door_lock).toBe(false);
    expect(events.body.data.events.length).toBeGreaterThan(0);
    noSecrets(events.body);

    const eventId = events.body.data.events[0].id;
    const ack = await request(app)
      .post(`/api/hostels/${gold.id}/vita-eye/events/${eventId}/ack`)
      .set(auth(ownerToken))
      .send({ note: 'not a match' });
    expect(ack.status).toBe(200);
    expect(ack.body.data.acked_at).toBeTruthy();
    expect(ack.body.data.ack_note).toMatch(/not a match/i);
    expect(ack.body.data.door_lock).toBe(false);

    const status = await request(app).get(`/api/hostels/${gold.id}/vita-eye`).set(auth(ownerToken));
    expect(status.status).toBe(200);
    expect(status.body.data.capture_ready).toBe(true);
    expect(status.body.data.door_lock).toBe(false);
    expect(status.body.data.watchlist_count).toBeGreaterThanOrEqual(1);
    expect(status.body.data.events[0].acked_at).toBeTruthy();
    noSecrets(status.body);

    const stillPath = `/uploads/vita-eye/${gold.id}/evt-${eventId}.jpg`;
    const guest = await request(app).get(stillPath);
    expect(guest.status).toBe(404);
    const ownerStill = await request(app).get(stillPath).set(auth(ownerToken));
    expect(ownerStill.status).toBe(200);
  });

  test('watchlist without reason is 422; Silver capture and watchlist are 403', async () => {
    const short = await addWatch(ownerToken, gold.id, red, { reason: 'no' });
    expect(short.status).toBe(422);

    const silverCap = await capture(ownerToken, fx().hostel.id, blue);
    expect(silverCap.status).toBe(403);
    expect(silverCap.body.message).toBe(UPGRADE_COPY.vita_eye);

    const silverWatch = await addWatch(ownerToken, fx().hostel.id, red, {
      reason: 'Should not land on Silver',
    });
    expect(silverWatch.status).toBe(403);
  });
});
