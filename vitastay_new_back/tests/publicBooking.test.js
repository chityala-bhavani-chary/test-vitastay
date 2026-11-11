/**
 * BKG-006 — seeker POST /bookings. Never occupies a bed. Never calls bookBed.
 */
const fs = require('fs');
const path = require('path');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { projectHostelAvailability } = require('../services/occupancyService');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const emailOf = (n) => `bookseeker${n}@test.vitastay.local`;
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const latestOtp = async (email, type) => {
  const { OtpVerification } = require('../models');
  const row = await OtpVerification.findOne({
    where: { email, type, is_used: false },
    order: [['created_at', 'DESC']],
  });
  return row?.otp;
};

const registerSeeker = async (n) => {
  const email = emailOf(n);
  const phone = `987652${String(1000 + n).slice(-4)}`;
  await request(app).post('/api/public/auth/otp').send({ email, phone });
  const res = await request(app).post('/api/public/auth/register').send({
    email,
    phone,
    first_name: 'Book',
    last_name: `Seeker${n}`,
    password: 'SeekerPass1',
    email_otp: await latestOtp(email, 'email_verify'),
    phone_otp: await latestOtp(email, 'phone_verify'),
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

describe('BKG-006 public booking request', () => {
  let seeker;
  let ownerToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const hostel = await require('../models').Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      media_override_reason: 'BKG-006 booking tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel.id);
    await projectHostelAvailability(hostel.id);
    seeker = await registerSeeker(1);
  });

  test('service source never calls bookBed', () => {
    const src = fs.readFileSync(path.join(__dirname, '../services/bookingService.js'), 'utf8');
    expect(src).not.toMatch(/hostelController/);
    expect(src).not.toMatch(/occupyBed\(/);
    expect(src).not.toMatch(/require\('\.\.\/controllers/);
  });

  test('owner cannot create a public booking', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(auth(ownerToken))
      .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: tomorrow() });
    expect(res.status).toBe(403);
  });

  test('seeker request is 201 held and does not occupy', async () => {
    const { Bed } = require('../models');
    const vacantBefore = await Bed.count({ where: { status: 'vacant' } });
    const occupiedBefore = await Bed.count({ where: { status: 'occupied' } });

    const res = await request(app)
      .post('/api/bookings')
      .set(auth(seeker.token))
      .send({
        hostel_id: fx().hostel.id,
        room_type: 'double',
        move_in_date: tomorrow(),
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('held');
    expect(res.body.data.room_type).toBe('double');
    expect(res.body.data.bed_id).toBeTruthy();
    expect(res.body.data.hold_expires_at).toBeTruthy();
    expect(res.body.data.code).toMatch(/^BKG-/);
    expect(res.body.data.erp_tenant_id).toBeNull();

    const { Tenant, Booking } = require('../models');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
    expect(await Bed.count({ where: { status: 'vacant' } })).toBe(vacantBefore - 1);
    expect(await Bed.count({ where: { status: 'occupied' } })).toBe(occupiedBefore);
    expect((await Bed.findByPk(res.body.data.bed_id)).status).toBe('reserved');
    expect(await Booking.count({ where: { seeker_user_id: seeker.user.id } })).toBe(1);

    const again = await request(app)
      .post('/api/bookings')
      .set(auth(seeker.token))
      .send({ hostel_id: fx().hostel.id, room_type: 'single', move_in_date: tomorrow() });
    expect(again.status).toBe(409);
  });

  test('Regular plan is 403; unpublished Silver is 404; past move-in is 422', async () => {
    const other = await registerSeeker(2);
    const pending = await request(app)
      .post('/api/bookings')
      .set(auth(other.token))
      .send({ hostel_id: fx().pendingHostel.id, room_type: 'double', move_in_date: tomorrow() });
    expect(pending.status).toBe(403);

    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({ listing_published: false });
    await refreshListingProjection(hostel.id);
    const unpublished = await request(app)
      .post('/api/bookings')
      .set(auth(other.token))
      .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: tomorrow() });
    expect(unpublished.status).toBe(404);
    await hostel.update({ listing_published: true });
    await refreshListingProjection(hostel.id);

    const past = await request(app)
      .post('/api/bookings')
      .set(auth(other.token))
      .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: '2020-01-01' });
    expect(past.status).toBe(422);
  });

  test('seeker can get, list, and cancel their request', async () => {
    const list = await request(app).get('/api/bookings').set(auth(seeker.token));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    const id = list.body.data[0].id;

    const got = await request(app).get(`/api/bookings/${id}`).set(auth(seeker.token));
    expect(got.status).toBe(200);
    expect(got.body.data.id).toBe(id);

    const ownerPeek = await request(app).get(`/api/bookings/${id}`).set(auth(ownerToken));
    expect(ownerPeek.status).toBe(200);

    const cancelled = await request(app).post(`/api/bookings/${id}/cancel`).set(auth(seeker.token));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');
  });
});
