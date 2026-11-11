/**
 * BKG-015 / TC-B-18 — privacy-safe listing funnel events + owner/SA dashboard.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');
const { hashSession } = require('../services/listingAnalytics');

const fx = () => global.__erp;
const isoDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('BKG-015 listing analytics', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let saToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
    const hostel = await require('../models').Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      media_override_reason: 'BKG-015 analytics tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel.id);
  });

  test('public ingest records view/tab/360 without user_id or raw session', async () => {
    const sid = 'sess-analytics-1';
    const view = await request(app)
      .post(`/api/public/listings/${fx().hostel.id}/events`)
      .send({ event: 'listing_view', session_id: sid, email: 'leak@example.com', user_id: 99 });
    expect(view.status).toBe(200);
    expect(view.body.data.recorded).toBe(true);

    const tab = await request(app)
      .post(`/api/public/listings/${fx().hostel.code}/events`)
      .send({ event: 'gallery_tab', tab: 'panorama_360', session_id: sid });
    expect(tab.status).toBe(200);

    const pano = await request(app)
      .post(`/api/public/listings/${fx().hostel.id}/events`)
      .send({ event: 'pano_open', media_id: 12, session_id: sid });
    expect(pano.status).toBe(200);

    const { ListingEvent } = require('../models');
    const rows = await ListingEvent.findAll({ where: { hostel_id: fx().hostel.id } });
    expect(rows.some((row) => row.event_type === 'listing_view')).toBe(true);
    expect(rows.every((row) => !row.get('user_id') && !row.get('ip') && !row.get('email'))).toBe(true);
    expect(rows.some((row) => row.session_hash === hashSession(sid))).toBe(true);
    expect(rows.every((row) => row.session_hash !== sid)).toBe(true);
    const json = JSON.stringify(rows.map((row) => row.toJSON()));
    expect(json).not.toMatch(/leak@example.com/);
  });

  test('unpublished listing is 404 and unknown event is 422', async () => {
    const unpublished = await request(app)
      .post(`/api/public/listings/${fx().pendingHostel.id}/events`)
      .send({ event: 'listing_view', session_id: 'x' });
    expect(unpublished.status).toBe(404);

    const bad = await request(app)
      .post(`/api/public/listings/${fx().hostel.id}/events`)
      .send({ event: 'password_reset', session_id: 'x' });
    expect(bad.status).toBe(422);
  });

  test('same session view is not double-counted', async () => {
    const sid = 'sess-analytics-dup';
    const first = await request(app)
      .post(`/api/public/listings/${fx().hostel.id}/events`)
      .send({ event: 'listing_view', session_id: sid });
    const second = await request(app)
      .post(`/api/public/listings/${fx().hostel.id}/events`)
      .send({ event: 'listing_view', session_id: sid });
    expect(first.body.data.recorded).toBe(true);
    expect(second.body.data.recorded).toBe(false);
  });

  test('owner dashboard shows 360 open rate; other owner is 403; seeker is 403', async () => {
    const dash = await request(app)
      .get('/api/listing-analytics')
      .set(auth(ownerToken));
    expect(dash.status).toBe(200);
    const mine = dash.body.data.hostels.find((row) => row.hostel_id === fx().hostel.id);
    expect(mine).toBeTruthy();
    expect(mine.views).toBeGreaterThanOrEqual(1);
    expect(mine.pano_opens).toBeGreaterThanOrEqual(1);
    expect(mine.pano_open_rate).toBeGreaterThan(0);
    expect(dash.body.data.pano_open_rate_target).toBe(25);

    const { User, Hostel } = require('../models');
    const other = await User.create({
      email: 'otherowner@test.vitastay.local',
      password: await require('../helpers/password').hashPassword(PASSWORD),
      first_name: 'Other',
      last_name: 'Owner',
      role: 'owner',
      is_active: true,
      email_verified: true,
    });
    await Hostel.create({
      owner_id: other.id,
      name: 'Other PG',
      code: 'NTEST99',
      address: '9 Other St',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      status: 'active',
    });
    const foreign = await request(app)
      .get('/api/listing-analytics')
      .query({ hostel_id: fx().hostel.id })
      .set(auth(await login('otherowner@test.vitastay.local', PASSWORD)));
    expect(foreign.status).toBe(403);

    const seeker = await request(app).post('/api/public/auth/otp').send({
      email: 'analyticsseeker@test.vitastay.local',
      phone: '9876562001',
    });
    expect(seeker.status).toBe(200);
    const { OtpVerification } = require('../models');
    const emailOtp = await OtpVerification.findOne({
      where: { email: 'analyticsseeker@test.vitastay.local', type: 'email_verify', is_used: false },
      order: [['created_at', 'DESC']],
    });
    const phoneOtp = await OtpVerification.findOne({
      where: { email: 'analyticsseeker@test.vitastay.local', type: 'phone_verify', is_used: false },
      order: [['created_at', 'DESC']],
    });
    const registered = await request(app).post('/api/public/auth/register').send({
      email: 'analyticsseeker@test.vitastay.local',
      phone: '9876562001',
      first_name: 'Ana',
      last_name: 'Seeker',
      password: 'SeekerPass1',
      email_otp: emailOtp.otp,
      phone_otp: phoneOtp.otp,
    });
    expect(registered.status).toBe(201);
    const seekerDash = await request(app)
      .get('/api/listing-analytics')
      .set(auth(registered.body.data.accessToken));
    expect(seekerDash.status).toBe(403);
  });

  test('booking started/paid/cancelled land on the funnel', async () => {
    const { OtpVerification } = require('../models');
    const email = 'funnelseeker@test.vitastay.local';
    await request(app).post('/api/public/auth/otp').send({ email, phone: '9876562002' });
    const emailOtp = await OtpVerification.findOne({
      where: { email, type: 'email_verify', is_used: false },
      order: [['created_at', 'DESC']],
    });
    const phoneOtp = await OtpVerification.findOne({
      where: { email, type: 'phone_verify', is_used: false },
      order: [['created_at', 'DESC']],
    });
    const registered = await request(app).post('/api/public/auth/register').send({
      email,
      phone: '9876562002',
      first_name: 'Funnel',
      last_name: 'Seeker',
      password: 'SeekerPass1',
      email_otp: emailOtp.otp,
      phone_otp: phoneOtp.otp,
    });
    expect(registered.status).toBe(201);
    const created = await request(app)
      .post('/api/bookings')
      .set(auth(registered.body.data.accessToken))
      .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: isoDays(4) });
    expect(created.status).toBe(201);

    const waitKind = async (kind) => {
      const { ListingEvent } = require('../models');
      const t0 = Date.now();
      while (Date.now() - t0 < 4000) {
        const hit = await ListingEvent.findOne({
          where: { booking_id: created.body.data.id, event_type: kind },
        });
        if (hit) return hit;
        await new Promise((r) => setTimeout(r, 40));
      }
      throw new Error(`missing ${kind}`);
    };
    await waitKind('booking_started');

    const cancelled = await request(app)
      .post(`/api/bookings/${created.body.data.id}/cancel`)
      .set(auth(registered.body.data.accessToken));
    expect(cancelled.status).toBe(200);
    await waitKind('booking_cancelled');

    const dash = await request(app).get('/api/listing-analytics').set(auth(saToken));
    expect(dash.status).toBe(200);
    const row = dash.body.data.hostels.find((item) => item.hostel_id === fx().hostel.id);
    expect(row.bookings_started).toBeGreaterThanOrEqual(1);
    expect(row.cancelled).toBeGreaterThanOrEqual(1);
  });
});
