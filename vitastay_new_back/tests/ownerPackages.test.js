/**
 * PKG-013 / TC-PKG-13 — plan-gate regression on nivas_hostel_test only.
 * Regular absent from search. Published Silver bookable. Vita Eye 403 on Silver.
 * Other-owner 403 on plan buy. Never production nivas_hostel.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD, assertSafeTestDatabase } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');
const { projectHostelAvailability } = require('../services/occupancyService');
const { UPGRADE_COPY } = require('../services/ownerPlan');

const fx = () => global.__erp;
const CITY = 'Coimbatore';
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
};

describe('PKG-013 owner package gates', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let otherToken;
  let seekerToken;
  let regular;
  let silver;
  let otherOwner;
  let otherHostel;
  let bookingId;

  beforeAll(async () => {
    const { sequelize, Hostel, User, Room, Bed, ListingProjection } = require('../models');
    assertSafeTestDatabase(sequelize);
    expect(sequelize.config.database).toBe('nivas_hostel_test');
    expect(sequelize.config.database).not.toBe('nivas_hostel');

    ownerToken = await login(fx().owner.email, PASSWORD);
    const { hashPassword } = require('../helpers/password');
    const override = {
      media_override_reason: 'PKG-013 plan gate regression',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    };

    regular = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'PKG013 Regular Hidden PG',
      code: 'PKG013REG',
      address: '13 Regular Lane',
      city: CITY,
      state: 'TN',
      pincode: '641001',
      status: 'active',
      listing_published: true,
      plan: 'regular',
      plan_status: 'comp',
      ...override,
    });
    silver = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'PKG013 Silver Live PG',
      code: 'PKG013SLV',
      address: '13 Silver Lane',
      city: CITY,
      state: 'TN',
      pincode: '641002',
      status: 'active',
      listing_published: true,
      plan: 'silver',
      plan_status: 'active',
      ...override,
    });
    const room = await Room.create({
      hostel_id: silver.id,
      room_number: 'S13',
      floor: 1,
      room_type: 'double',
      sharing_type: 2,
      rent: 9000,
      status: 'vacant',
    });
    await Bed.create({ room_id: room.id, bed_number: '1', status: 'vacant' });
    await Bed.create({ room_id: room.id, bed_number: '2', status: 'vacant' });

    otherOwner = await User.create({
      email: 'pkg013.other@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Other',
      last_name: 'Owner',
      role: 'owner',
      is_active: true,
      email_verified: true,
    });
    otherHostel = await Hostel.create({
      owner_id: otherOwner.id,
      name: 'PKG013 Other PG',
      code: 'PKG013OTH',
      address: '13 Other Lane',
      city: CITY,
      state: 'TN',
      pincode: '641003',
      status: 'active',
      listing_published: false,
      plan: 'regular',
      plan_status: 'comp',
    });
    await refreshListingProjection(regular.id);
    await refreshListingProjection(silver.id);
    await refreshListingProjection(otherHostel.id);
    await projectHostelAvailability(silver.id);

    otherToken = await login(otherOwner.email, PASSWORD);

    const email = 'pkg013seeker@test.vitastay.local';
    const phone = '9876591313';
    await request(app).post('/api/public/auth/otp').send({ email, phone });
    const { OtpVerification } = require('../models');
    const otp = async (type) => {
      const row = await OtpVerification.findOne({
        where: { email, type, is_used: false },
        order: [['created_at', 'DESC']],
      });
      return row?.otp;
    };
    const registered = await request(app).post('/api/public/auth/register').send({
      email,
      phone,
      first_name: 'Pkg',
      last_name: 'Seeker',
      password: 'SeekerPass1',
      email_otp: await otp('email_verify'),
      phone_otp: await otp('phone_verify'),
    });
    expect(registered.status).toBe(201);
    seekerToken = registered.body.data.accessToken;
  });

  afterAll(async () => {
    const {
      ListingProjection, Hostel, User, Room, Bed, Booking,
    } = require('../models');
    const ids = [regular?.id, silver?.id, otherHostel?.id].filter(Boolean);
    if (bookingId) await Booking.destroy({ where: { id: bookingId }, force: true }).catch(() => {});
    await Booking.destroy({ where: { hostel_id: ids }, force: true }).catch(() => {});
    const rooms = await Room.findAll({ where: { hostel_id: ids } }).catch(() => []);
    const roomIds = rooms.map((row) => row.id);
    if (roomIds.length) await Bed.destroy({ where: { room_id: roomIds }, force: true }).catch(() => {});
    await Room.destroy({ where: { hostel_id: ids }, force: true }).catch(() => {});
    await ListingProjection.destroy({ where: { hostel_id: ids } }).catch(() => {});
    await Hostel.destroy({ where: { id: ids }, force: true }).catch(() => {});
    if (otherOwner?.id) await User.destroy({ where: { id: otherOwner.id }, force: true }).catch(() => {});
  });

  test('Regular published PG is absent from GET /public/listings; Silver published is present', async () => {
    const { ListingProjection } = require('../models');
    const regularRow = await ListingProjection.findOne({ where: { hostel_id: regular.id } });
    const silverRow = await ListingProjection.findOne({ where: { hostel_id: silver.id } });
    expect(regularRow?.marketplace_ok).toBeFalsy();
    expect(silverRow?.marketplace_ok).toBeTruthy();

    const search = await request(app).get('/api/public/listings').query({ city: CITY });
    expect(search.status).toBe(200);
    const codes = (search.body.data.items || []).map((row) => row.code);
    expect(codes).not.toContain('PKG013REG');
    expect(codes).toContain('PKG013SLV');
    expect(JSON.stringify(search.body)).not.toMatch(/PKG013 Regular Hidden/);

    const hidden = await request(app).get(`/api/public/listings/${regular.code}`);
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(hidden.body)).not.toMatch(/Regular Hidden/);

    const listing = await request(app).get(`/api/public/listings/${silver.code}`);
    expect(listing.status).toBe(200);
    expect(listing.body.data.hostel.name).toBe('PKG013 Silver Live PG');
  });

  test('POST /bookings is 403 on Regular and succeeds on published Silver', async () => {
    const blocked = await request(app)
      .post('/api/bookings')
      .set(auth(seekerToken))
      .send({ hostel_id: regular.id, room_type: 'double', move_in_date: tomorrow() });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe(UPGRADE_COPY.online_booking);

    const booked = await request(app)
      .post('/api/bookings')
      .set(auth(seekerToken))
      .send({ hostel_id: silver.id, room_type: 'double', move_in_date: tomorrow() });
    expect(booked.status).not.toBe(403);
    expect(booked.status).toBe(201);
    expect(booked.body.data.status).toBe('held');
    bookingId = booked.body.data.id;
  });

  test('Vita Eye is 403 on Silver with Gold upgrade copy', async () => {
    const status = await request(app)
      .get(`/api/hostels/${silver.id}/vita-eye`)
      .set(auth(ownerToken));
    expect(status.status).toBe(403);
    expect(status.body.message).toBe(UPGRADE_COPY.vita_eye);

    const enroll = await request(app)
      .post(`/api/hostels/${silver.id}/vita-eye/enroll`)
      .set(auth(ownerToken))
      .send({ person_type: 'staff', consent: true });
    expect(enroll.status).toBe(403);

    const capture = await request(app)
      .post(`/api/hostels/${silver.id}/vita-eye/capture`)
      .set(auth(ownerToken))
      .send({});
    expect(capture.status).toBe(403);
  });

  test('other owner cannot buy a plan for this PG', async () => {
    const stealPay = await request(app)
      .post(`/api/hostels/${silver.id}/plan/pay`)
      .set(auth(otherToken))
      .send({ plan: 'gold', period: 'month' });
    expect(stealPay.status).toBe(403);

    const stealChange = await request(app)
      .post(`/api/hostels/${silver.id}/plan`)
      .set(auth(otherToken))
      .send({ plan: 'gold', period: 'month' });
    expect(stealChange.status).toBe(403);

    const peek = await request(app)
      .get(`/api/hostels/${otherHostel.id}/plan`)
      .set(auth(ownerToken));
    expect(peek.status).toBe(403);
  });
});
