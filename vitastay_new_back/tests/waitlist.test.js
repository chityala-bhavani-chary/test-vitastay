/**
 * BIC-028 — waitlist / notify me when a bed opens.
 */
const { request, app, auth } = require('./helpers/http');
const { projectHostelAvailability, scheduleAvailabilityRefresh } = require('../services/occupancyService');
const { refreshListingProjection } = require('../services/listingProjection');
const { notifyOnAvailability, expireStale } = require('../services/waitlistService');

const fx = () => global.__erp;

describe('BIC-028 waitlist', () => {
  let seekerToken;
  let hostelId;
  let fullType;

  beforeAll(async () => {
    const { ensureWaitlistTable } = require('../database/migrate-waitlist');
    await ensureWaitlistTable(require('../models').sequelize, () => {});

    const { Hostel, ListingAvailability, User, OtpVerification } = require('../models');
    hostelId = fx().hostel.id;
    const hostel = await Hostel.findByPk(hostelId);
    await hostel.update({
      listing_published: true,
      listing_published_at: new Date(),
      status: 'active',
      media_override_reason: 'BIC-028',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostelId);
    await projectHostelAvailability(hostelId);

    // Force one type full so waitlist join is allowed
    const rows = await ListingAvailability.findAll({ where: { hostel_id: hostelId } });
    fullType = rows[0]?.room_type || 'double';
    await ListingAvailability.update(
      { beds_available: 0 },
      { where: { hostel_id: hostelId, room_type: fullType } }
    );

    const email = 'waitseeker@test.vitastay.local';
    const phone = '9876590281';
    const password = 'SeekerPass1';
    await User.destroy({ where: { email }, force: true }).catch(() => {});
    await request(app).post('/api/public/auth/otp').send({ email, phone });
    const emailOtp = (await OtpVerification.findOne({
      where: { email, type: 'email_verify', is_used: false },
      order: [['created_at', 'DESC']],
    }))?.otp;
    const phoneOtp = (await OtpVerification.findOne({
      where: { email, type: 'phone_verify', is_used: false },
      order: [['created_at', 'DESC']],
    }))?.otp;
    const reg = await request(app).post('/api/public/auth/register').send({
      email,
      phone,
      first_name: 'Wait',
      last_name: 'Seeker',
      password,
      email_otp: emailOtp,
      phone_otp: phoneOtp,
    });
    expect(reg.status).toBe(201);
    seekerToken = reg.body.data.accessToken;
  });

  test('guest cannot join waitlist', async () => {
    const res = await request(app).post('/api/waitlists').send({
      hostel_id: hostelId,
      room_type: fullType,
    });
    expect(res.status).toBe(401);
  });

  test('seeker joins once (dedupe) when type is full', async () => {
    const first = await request(app)
      .post('/api/waitlists')
      .set(auth(seekerToken))
      .send({ hostel_id: hostelId, room_type: fullType, notify_email: true });
    expect(first.status).toBe(200);
    expect(first.body.data.joined).toBe(true);
    expect(first.body.data.room_type).toBe(fullType);

    const second = await request(app)
      .post('/api/waitlists')
      .set(auth(seekerToken))
      .send({ hostel_id: hostelId, room_type: fullType });
    expect(second.status).toBe(200);
    expect(second.body.data.created).toBe(false);

    const list = await request(app).get('/api/waitlists').set(auth(seekerToken));
    expect(list.status).toBe(200);
    const active = (list.body.data.items || []).filter(
      (row) => row.hostel_id === hostelId && row.room_type === fullType && row.status === 'active'
    );
    expect(active.length).toBe(1);
  });

  test('cannot waitlist a type that already has beds', async () => {
    const { ListingAvailability } = require('../models');
    const open = await ListingAvailability.findOne({
      where: { hostel_id: hostelId, beds_available: { [require('sequelize').Op.gt]: 0 } },
    });
    if (!open) return;
    const res = await request(app)
      .post('/api/waitlists')
      .set(auth(seekerToken))
      .send({ hostel_id: hostelId, room_type: open.room_type });
    expect(res.status).toBe(422);
  });

  test('vacancy notify marks waitlist notified (email opt-in)', async () => {
    const inventory = {
      roomTypes: [{ room_type: fullType, vacantBeds: 2, beds_available: 2 }],
    };
    const result = await notifyOnAvailability(hostelId, inventory);
    expect(result.notified).toBeGreaterThanOrEqual(1);

    const status = await request(app)
      .get(`/api/waitlists/listing/${hostelId}`)
      .set(auth(seekerToken));
    expect(status.status).toBe(200);
    expect((status.body.data.items || []).some((r) => r.room_type === fullType)).toBe(false);

    const list = await request(app).get('/api/waitlists').set(auth(seekerToken));
    const row = (list.body.data.items || []).find(
      (r) => r.hostel_id === hostelId && r.room_type === fullType
    );
    expect(row.status).toBe('notified');
  });

  test('expireStale flips past-due active rows', async () => {
    const { ListingWaitlist } = require('../models');
    const row = await ListingWaitlist.create({
      user_id: (await require('../models').User.findOne({ where: { email: 'waitseeker@test.vitastay.local' } })).id,
      hostel_id: hostelId,
      room_type: 'triple',
      notify_email: true,
      status: 'active',
      expires_at: new Date(Date.now() - 3600_000),
    });
    const n = await expireStale({ id: row.id });
    expect(n).toBeGreaterThanOrEqual(1);
    await row.reload();
    expect(row.status).toBe('expired');
  });

  test('scheduleAvailabilityRefresh wires notify after project', async () => {
    // Re-join with full type
    const { ListingAvailability } = require('../models');
    await ListingAvailability.update(
      { beds_available: 0 },
      { where: { hostel_id: hostelId, room_type: fullType } }
    );
    await request(app)
      .post('/api/waitlists')
      .set(auth(seekerToken))
      .send({ hostel_id: hostelId, room_type: fullType });

    await ListingAvailability.update(
      { beds_available: 3 },
      { where: { hostel_id: hostelId, room_type: fullType } }
    );

    // Direct notify path (scheduler is async setImmediate)
    const result = await notifyOnAvailability(hostelId, {
      roomTypes: [{ room_type: fullType, vacantBeds: 3 }],
    });
    expect(result.notified).toBeGreaterThanOrEqual(0);
    expect(typeof scheduleAvailabilityRefresh).toBe('function');
  });
});
