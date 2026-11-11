/**
 * BKG-010 / QA-005 TC-B-02…04 — parallel books, walk-in vs hold, confirm after expiry.
 * Webhook replay is tests/bookingWebhook.test.js (BKG-012 / QA-005).
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { hashPassword } = require('../helpers/password');
const { projectHostelAvailability } = require('../services/occupancyService');
const { expireHolds } = require('../services/bookingHold');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const emailOf = (n) => `race${n}@test.vitastay.local`;
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
    first_name: 'Race',
    last_name: `Seeker${n}`,
    password: 'SeekerPass1',
    email_otp: await latestOtp(email, 'email_verify'),
    phone_otp: await latestOtp(email, 'phone_verify'),
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

describe('BKG-010 booking concurrency', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let lane;
  let passwordHash;
  let tenantSeq = 0;

  const makeTenant = async (label) => {
    tenantSeq += 1;
    const { User, Tenant } = require('../models');
    const user = await User.create({
      email: `bkg010-${label}-${tenantSeq}@test.vitastay.local`,
      first_name: 'Lane',
      last_name: `${label}${tenantSeq}`,
      password: passwordHash,
      role: 'tenant',
      is_active: true,
      email_verified: true,
    });
    return Tenant.create({
      user_id: user.id,
      hostel_id: fx().hostel.id,
      full_name: `Lane ${label} ${tenantSeq}`,
      monthly_rent: 8000,
      status: 'active',
    });
  };

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Hostel, Room, Bed } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      media_override_reason: 'BKG-010 concurrency tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel.id);
    await projectHostelAvailability(hostel.id);

    const room = await Room.create({
      hostel_id: hostel.id,
      room_number: '199',
      floor: 3,
      room_type: 'double',
      sharing_type: 2,
      rent: 8000,
      status: 'vacant',
    });
    const a = await Bed.create({ room_id: room.id, bed_number: '1', status: 'vacant' });
    const b = await Bed.create({ room_id: room.id, bed_number: '2', status: 'vacant' });
    lane = { room, a, b };
  });

  test('TC-B-02 eight parallel POSTs on one bed: one held, rest 409, never occupied', async () => {
    const seekers = [];
    for (let i = 1; i <= 8; i += 1) seekers.push(await registerSeeker(i));

    const responses = await Promise.all(seekers.map((s) => request(app)
      .post('/api/bookings')
      .set(auth(s.token))
      .send({
        hostel_id: fx().hostel.id,
        bed_id: lane.a.id,
        room_type: 'double',
        move_in_date: tomorrow(),
      })));

    const created = responses.filter((r) => r.status === 201);
    const conflicted = responses.filter((r) => r.status === 409);
    expect(created).toHaveLength(1);
    expect(conflicted).toHaveLength(7);
    expect(created[0].body.data.status).toBe('held');
    expect(created[0].body.data.bed_id).toBe(lane.a.id);

    await lane.a.reload();
    expect(lane.a.status).toBe('reserved');
    const { Booking, BedAssignment } = require('../models');
    expect(await Booking.count({ where: { bed_id: lane.a.id, status: 'held' } })).toBe(1);
    expect(await BedAssignment.count({ where: { bed_id: lane.a.id, status: 'active' } })).toBe(0);
  });

  test('TC-B-04 walk-in during hold is 409 unless override_hold + reason is audited', async () => {
    const { Booking, AuditLog, BedAssignment } = require('../models');
    await lane.a.reload();
    expect(lane.a.status).toBe('reserved');

    const blueprint = await request(app)
      .get(`/api/hostels/${fx().hostel.id}/blueprint`)
      .set(auth(ownerToken));
    expect(blueprint.status).toBe(200);
    const heldBed = (blueprint.body.data.rooms || [])
      .flatMap((room) => room.beds || [])
      .find((bed) => Number(bed.id) === Number(lane.a.id));
    expect(heldBed.status).toBe('reserved');
    expect(heldBed.hold_expires_at).toBeTruthy();
    expect(heldBed.hold.booking_code).toMatch(/^BKG/);
    expect(heldBed.hold.hold_expires_at).toBeTruthy();

    const tenant = await makeTenant('blocked');

    const blocked = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/beds/${lane.a.id}/book`)
      .set(auth(ownerToken))
      .send({ tenant_id: tenant.id });
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/held|not available/i);
    await lane.a.reload();
    expect(lane.a.status).toBe('reserved');
    expect(await Booking.count({ where: { bed_id: lane.a.id, status: 'held' } })).toBe(1);

    const missingReason = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/beds/${lane.a.id}/book`)
      .set(auth(ownerToken))
      .send({ tenant_id: tenant.id, override_hold: true });
    expect(missingReason.status).toBe(422);

    const override = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/beds/${lane.a.id}/book`)
      .set(auth(ownerToken))
      .send({ tenant_id: tenant.id, override_hold: true, reason: 'Guest arrived at the gate' });
    expect(override.status).toBe(200);

    await lane.a.reload();
    await tenant.reload();
    expect(lane.a.status).toBe('occupied');
    expect(Number(tenant.bed_id)).toBe(Number(lane.a.id));
    expect(await Booking.count({ where: { bed_id: lane.a.id, status: 'held' } })).toBe(0);
    expect(await Booking.count({ where: { bed_id: lane.a.id, status: 'cancelled' } })).toBe(1);
    expect(await BedAssignment.count({ where: { bed_id: lane.a.id, status: 'active' } })).toBe(1);

    const audits = await AuditLog.findAll({ where: { action: 'WALKIN_OVERRIDE' } });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(audits.map((row) => row.new_values))).toMatch(/Guest arrived at the gate/);
  });

  test('TC-B-03 confirm after expiry is 409 and the bed stays vacant', async () => {
    const seeker = await registerSeeker(20);
    const created = await request(app).post('/api/bookings').set(auth(seeker.token)).send({
      hostel_id: fx().hostel.id,
      bed_id: lane.b.id,
      room_type: 'double',
      move_in_date: tomorrow(),
    });
    expect(created.status).toBe(201);
    const { Booking, Bed, BedAssignment } = require('../models');
    const row = await Booking.findByPk(created.body.data.id);
    await row.update({ hold_expires_at: new Date(Date.now() - 1000) });

    const expired = await expireHolds();
    expect(expired.expired).toBeGreaterThanOrEqual(1);
    await row.reload();
    expect(row.status).toBe('expired');
    expect((await Bed.findByPk(lane.b.id)).status).toBe('vacant');

    const confirm = await request(app)
      .post(`/api/bookings/${row.id}/confirm`)
      .set(auth(ownerToken));
    expect(confirm.status).toBe(409);
    expect(confirm.body.message).toMatch(/expired/i);
    expect((await Bed.findByPk(lane.b.id)).status).toBe('vacant');
    expect(await BedAssignment.count({ where: { bed_id: lane.b.id, status: 'active' } })).toBe(0);
  });

  test('two parallel walk-ins on one vacant bed: one occupies, one 409, unique assignment', async () => {
    const { Bed, BedAssignment } = require('../models');
    const first = await makeTenant('parallel-a');
    const second = await makeTenant('parallel-b');
    await lane.b.reload();
    expect(lane.b.status).toBe('vacant');

    const [a, b] = await Promise.all([
      request(app)
        .post(`/api/hostels/${fx().hostel.id}/beds/${lane.b.id}/book`)
        .set(auth(ownerToken))
        .send({ tenant_id: first.id }),
      request(app)
        .post(`/api/hostels/${fx().hostel.id}/beds/${lane.b.id}/book`)
        .set(auth(ownerToken))
        .send({ tenant_id: second.id }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    await lane.b.reload();
    expect(lane.b.status).toBe('occupied');
    expect(await BedAssignment.count({ where: { bed_id: lane.b.id, status: 'active' } })).toBe(1);

    await expect(BedAssignment.create({
      bed_id: lane.b.id,
      tenant_id: second.id,
      status: 'active',
    })).rejects.toThrow();

    const occupied = await Bed.findByPk(lane.b.id);
    expect(occupied.status).toBe('occupied');
  });
});
