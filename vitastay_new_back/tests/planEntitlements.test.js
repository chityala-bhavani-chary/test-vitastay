/**
 * PKG-002 — hostel.plan entitlements. Plan wins over listing_published.
 * Regular never leaks onto public search even if published.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');
const { entitlementsOf } = require('../services/ownerPlan');

const fx = () => global.__erp;

describe('PKG-002 plan entitlements', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let regular;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Hostel } = require('../models');
    regular = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Regular Leak PG',
      code: 'RGLK01',
      address: '9 Regular Lane',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560009',
      status: 'active',
      listing_published: true,
      plan: 'regular',
      plan_status: 'comp',
      media_override_reason: 'PKG-002 regular leak test',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(regular.id);
  });

  afterAll(async () => {
    if (!regular) return;
    const { ListingProjection, Hostel } = require('../models');
    await ListingProjection.destroy({ where: { hostel_id: regular.id } });
    await Hostel.destroy({ where: { id: regular.id }, force: true });
  });

  test('hostels.plan defaults Regular and GET /hostels includes entitlement flags', async () => {
    const flags = entitlementsOf({ plan: 'regular', plan_status: 'comp' });
    expect(flags.erp).toBe(true);
    expect(flags.public_search).toBe(false);
    expect(flags.online_booking).toBe(false);
    expect(flags.listing_analytics).toBe(false);

    const silver = entitlementsOf({ plan: 'silver', plan_status: 'grace' });
    expect(silver.public_search).toBe(true);
    expect(silver.online_booking).toBe(true);
    expect(silver.vita_eye).toBe(false);

    const lapsed = entitlementsOf({ plan: 'gold', plan_status: 'lapsed' });
    expect(lapsed.public_search).toBe(false);
    expect(lapsed.online_booking).toBe(false);

    const list = await request(app).get('/api/hostels').set(auth(ownerToken)).query({ limit: 50 });
    expect(list.status).toBe(200);
    const row = (list.body.data || []).find((item) => item.id === regular.id);
    expect(row).toBeTruthy();
    expect(row.plan).toBe('regular');
    expect(row.entitlements.public_search).toBe(false);
    expect(row.entitlements.online_booking).toBe(false);
    expect(row.entitlements.erp).toBe(true);
  });

  test('Regular with listing_published is omitted from search and listing GET is 404', async () => {
    const { ListingProjection } = require('../models');
    const proj = await ListingProjection.findOne({ where: { hostel_id: regular.id } });
    expect(proj.marketplace_ok).toBe(false);
    expect(proj.is_public).toBe(false);
    expect(proj.plan).toBe('regular');

    const search = await request(app).get('/api/public/listings').query({ city: 'Bangalore' });
    expect(search.status).toBe(200);
    const ids = (search.body.data.items || []).map((row) => row.id);
    expect(ids).not.toContain(regular.id);

    const listing = await request(app).get(`/api/public/listings/${regular.code}`);
    expect(listing.status).toBe(404);
  });

  test('stale is_public cannot leak a Regular PG — marketplace_ok wins', async () => {
    const { ListingProjection } = require('../models');
    await ListingProjection.update(
      { is_public: true, marketplace_ok: false, plan: 'regular' },
      { where: { hostel_id: regular.id } },
    );
    const search = await request(app).get('/api/public/listings').query({ city: 'Bangalore' });
    const ids = (search.body.data.items || []).map((row) => row.id);
    expect(ids).not.toContain(regular.id);
    await refreshListingProjection(regular.id);
  });

  test('POST /bookings is 403 for Regular; publish is 403', async () => {
    await request(app).post('/api/public/auth/otp').send({
      email: 'pkg002seeker@test.vitastay.local',
      phone: '9876590002',
    });
    const { OtpVerification } = require('../models');
    const otp = async (type) => {
      const row = await OtpVerification.findOne({
        where: { email: 'pkg002seeker@test.vitastay.local', type, is_used: false },
        order: [['created_at', 'DESC']],
      });
      return row?.otp;
    };
    const registered = await request(app).post('/api/public/auth/register').send({
      email: 'pkg002seeker@test.vitastay.local',
      phone: '9876590002',
      first_name: 'Pkg',
      last_name: 'Seeker',
      password: 'SeekerPass1',
      email_otp: await otp('email_verify'),
      phone_otp: await otp('phone_verify'),
    });
    expect(registered.status).toBe(201);

    const book = await request(app)
      .post('/api/bookings')
      .set(auth(registered.body.data.accessToken))
      .send({ hostel_id: regular.id, room_type: 'double', move_in_date: '2026-12-01' });
    expect(book.status).toBe(403);
    expect(book.body.message).toMatch(/Upgrade to Silver/i);

    const publish = await request(app)
      .post(`/api/hostels/${regular.id}/listing/publish`)
      .set(auth(ownerToken))
      .send({});
    expect(publish.status).toBe(403);
    expect(publish.body.message).toMatch(/Upgrade to Silver/i);
  });

  test('Regular owner listing-analytics is 403; Silver fixture stays 200', async () => {
    const regularDash = await request(app)
      .get('/api/listing-analytics')
      .query({ hostel_id: regular.id })
      .set(auth(ownerToken));
    expect(regularDash.status).toBe(403);

    const silverDash = await request(app)
      .get('/api/listing-analytics')
      .query({ hostel_id: fx().hostel.id })
      .set(auth(ownerToken));
    expect(silverDash.status).toBe(200);
    expect((silverDash.body.data.hostels || []).some((row) => row.hostel_id === fx().hostel.id)).toBe(true);
  });

  test('features.online_booking cannot override a Regular plan', async () => {
    await regular.update({ features: { online_booking: true, public_listing: true } });
    await request(app).post('/api/public/auth/otp').send({
      email: 'pkg002seeker2@test.vitastay.local',
      phone: '9876590003',
    });
    const { OtpVerification } = require('../models');
    const otp = async (type) => {
      const row = await OtpVerification.findOne({
        where: { email: 'pkg002seeker2@test.vitastay.local', type, is_used: false },
        order: [['created_at', 'DESC']],
      });
      return row?.otp;
    };
    const registered = await request(app).post('/api/public/auth/register').send({
      email: 'pkg002seeker2@test.vitastay.local',
      phone: '9876590003',
      first_name: 'Pkg',
      last_name: 'Two',
      password: 'SeekerPass1',
      email_otp: await otp('email_verify'),
      phone_otp: await otp('phone_verify'),
    });
    const leak = await request(app)
      .post('/api/bookings')
      .set(auth(registered.body.data.accessToken))
      .send({ hostel_id: regular.id, room_type: 'double', move_in_date: '2026-12-02' });
    expect(leak.status).toBe(403);
  });
});
