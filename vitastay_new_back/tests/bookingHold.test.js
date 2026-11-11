/**
 * BKG-007 — reserved hold, expiry job, walk-in cannot take a held bed.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { projectHostelAvailability } = require('../services/occupancyService');
const { expireHolds } = require('../services/bookingHold');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const emailOf = (n) => `holdseeker${n}@test.vitastay.local`;
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
  const phone = `987653${String(1000 + n).slice(-4)}`;
  await request(app).post('/api/public/auth/otp').send({ email, phone });
  const res = await request(app).post('/api/public/auth/register').send({
    email,
    phone,
    first_name: 'Hold',
    last_name: `Seeker${n}`,
    password: 'SeekerPass1',
    email_otp: await latestOtp(email, 'email_verify'),
    phone_otp: await latestOtp(email, 'phone_verify'),
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

describe('BKG-007 booking hold', () => {
  let ownerToken;
  let a;
  let b;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const hostel = await require('../models').Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      media_override_reason: 'BKG-007 hold tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel.id);
    await projectHostelAvailability(hostel.id);
    a = await registerSeeker(1);
    b = await registerSeeker(2);
  });

  test('two seekers one bed: one held, one 409', async () => {
    const { Bed, Room } = require('../models');
    const vacant = await Bed.findOne({
      where: { status: 'vacant' },
      include: [{ model: Room, as: 'room', where: { hostel_id: fx().hostel.id, room_type: 'double' } }],
    });
    expect(vacant).toBeTruthy();

    const [first, second] = await Promise.all([
      request(app).post('/api/bookings').set(auth(a.token)).send({
        hostel_id: fx().hostel.id,
        bed_id: vacant.id,
        room_type: 'double',
        move_in_date: tomorrow(),
      }),
      request(app).post('/api/bookings').set(auth(b.token)).send({
        hostel_id: fx().hostel.id,
        bed_id: vacant.id,
        room_type: 'double',
        move_in_date: tomorrow(),
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const won = first.status === 201 ? first : second;
    expect(won.body.data.status).toBe('held');
    expect(won.body.data.bed_id).toBe(vacant.id);
    await vacant.reload();
    expect(vacant.status).toBe('reserved');
  });

  test('walk-in bookBed cannot take a reserved bed', async () => {
    const { Booking } = require('../models');
    const held = await Booking.findOne({
      where: { seeker_user_id: a.user.id, status: 'held' },
    });
    expect(held?.bed_id).toBeTruthy();
    const walkin = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/beds/${held.bed_id}/book`)
      .set(auth(ownerToken))
      .send({ tenant_id: fx().walkin.id });
    expect(walkin.status).toBe(409);
    expect(walkin.body.message).toMatch(/held|not available/i);
  });

  test('expiry job releases the bed, expires the booking, notifies once', async () => {
    const { Booking, Bed, Notification } = require('../models');
    const held = await Booking.findOne({
      where: { seeker_user_id: a.user.id, status: 'held' },
    });
    const bedId = held.bed_id;
    await held.update({ hold_expires_at: new Date(Date.now() - 1000) });

    const first = await expireHolds();
    expect(first.expired).toBeGreaterThanOrEqual(1);
    await held.reload();
    expect(held.status).toBe('expired');
    expect((await Bed.findByPk(bedId)).status).toBe('vacant');

    const notes = await Notification.count({
      where: { user_id: a.user.id, type: 'warning' },
    });
    expect(notes).toBeGreaterThanOrEqual(1);

    const second = await expireHolds();
    expect(second.expired).toBe(0);
    expect(await Notification.count({
      where: { user_id: a.user.id, type: 'warning' },
    })).toBe(notes);
  });
});
