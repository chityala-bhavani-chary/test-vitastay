/**
 * BIC-025 — commute times + save my office. Mock provider in test (no fake UX times when unconfigured).
 */
const { request, app, auth } = require('./helpers/http');

const fx = () => global.__erp;

describe('BIC-025 commute', () => {
  let seekerToken;
  let hostelId;

  beforeAll(async () => {
    process.env.COMMUTE_PROVIDER = 'mock';
    const { ensureCommuteSchema } = require('../database/migrate-commute');
    await ensureCommuteSchema(require('../models').sequelize, () => {});

    const { Hostel, ListingProjection, User, OtpVerification, CommuteCache } = require('../models');
    await CommuteCache.destroy({ where: {}, force: true }).catch(() => {});

    hostelId = fx().hostel.id;
    const hostel = await Hostel.findByPk(hostelId);
    await hostel.update({
      listing_published: true,
      listing_published_at: new Date(),
      latitude: 12.9352,
      longitude: 77.6245,
      status: 'active',
    });
    await ListingProjection.upsert({
      hostel_id: hostel.id,
      code: hostel.code,
      name: hostel.name,
      city: hostel.city || 'Hyderabad',
      area: hostel.area || 'HSR',
      state: hostel.state || 'Telangana',
      amenities: ['WiFi'],
      occupancy_types: ['double'],
      gender_policy: 'unisex',
      stay_modes: ['monthly'],
      min_rent: 4500,
      max_rent: 12000,
      beds_available: 3,
      rating_avg: null,
      rating_count: 0,
      cover_url: null,
      cover_thumb_url: null,
      plan: 'silver',
      marketplace_ok: true,
      is_public: true,
      booking_model: 'approval_first',
      has_360: false,
      refreshed_at: new Date(),
    });

    const email = 'commuteseeker@test.vitastay.local';
    const phone = '9876590251';
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
      first_name: 'Commute',
      last_name: 'Seeker',
      password,
      email_otp: emailOtp,
      phone_otp: phoneOtp,
    });
    expect(reg.status).toBe(201);
    seekerToken = reg.body.data.accessToken;
  });

  afterAll(() => {
    delete process.env.COMMUTE_PROVIDER;
  });

  test('GET /public/commute/status reports configured under mock', async () => {
    const res = await request(app).get('/api/public/commute/status');
    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(true);
  });

  test('POST /public/commute returns real-shaped times (not a fixed 10 min)', async () => {
    const res = await request(app)
      .post('/api/public/commute')
      .send({ origin: 'Manyata Tech Park, Bangalore', hostel_ids: [hostelId], mode: 'driving' });
    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(true);
    expect(res.body.data.origin.label).toMatch(/Manyata/i);
    const row = res.body.data.results.find((r) => r.hostel_id === hostelId);
    expect(row).toBeTruthy();
    expect(row.status).toBe('ok');
    expect(row.duration_seconds).toBeGreaterThan(60);
    expect(row.duration_text).toBeTruthy();
    expect(row.duration_seconds).not.toBe(600); // do not invent a flat 10 minutes
  });

  test('second call hits commute_cache', async () => {
    const first = await request(app)
      .post('/api/public/commute')
      .send({ origin: 'Manyata Tech Park, Bangalore', hostel_ids: [hostelId] });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/public/commute')
      .send({ origin: 'Manyata Tech Park, Bangalore', hostel_ids: [hostelId] });
    expect(second.status).toBe(200);
    const row = second.body.data.results.find((r) => r.hostel_id === hostelId);
    expect(row.cached).toBe(true);
    expect(row.status).toBe('ok');
  });

  test('hostel without coordinates is unavailable (honest, no fake minutes)', async () => {
    const { Hostel } = require('../models');
    const pending = await Hostel.findByPk(fx().pendingHostel.id);
    await pending.update({ latitude: null, longitude: null });

    const res = await request(app)
      .post('/api/public/commute')
      .send({ origin: 'Koramangala', hostel_ids: [pending.id] });
    expect(res.status).toBe(200);
    const row = res.body.data.results[0];
    expect(row.status).toBe('unavailable');
    expect(row.duration_seconds).toBeNull();
    expect(row.duration_text).toBeNull();
    expect(String(row.message)).toMatch(/coordinates/i);
  });

  test('seeker can save and reuse my office', async () => {
    const save = await request(app)
      .put('/api/commute/office')
      .set(auth(seekerToken))
      .send({ label: 'My office', address: 'Electronic City, Bangalore' });
    expect(save.status).toBe(200);
    expect(save.body.data.office.label).toBe('My office');
    expect(Number.isFinite(Number(save.body.data.office.latitude))).toBe(true);

    const get = await request(app).get('/api/commute/office').set(auth(seekerToken));
    expect(get.status).toBe(200);
    expect(get.body.data.office.address).toMatch(/Electronic/i);

    const times = await request(app)
      .post('/api/public/commute')
      .set(auth(seekerToken))
      .send({ use_saved_office: true, hostel_ids: [hostelId] });
    expect(times.status).toBe(200);
    expect(times.body.data.results[0].status).toBe('ok');

    const cleared = await request(app).delete('/api/commute/office').set(auth(seekerToken));
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.removed).toBe(true);
  });

  test('guest cannot save office', async () => {
    const res = await request(app).put('/api/commute/office').send({ address: 'Somewhere' });
    expect(res.status).toBe(401);
  });

  test('missing origin is 422', async () => {
    const res = await request(app).post('/api/public/commute').send({ hostel_ids: [hostelId] });
    expect(res.status).toBe(422);
  });
});
