/**
 * PKG-004 — Silver is the marketplace SKU while the plan is live.
 * Unpublished Silver stays hidden. Lapsed Silver is gated like Regular.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');
const { entitlementsOf } = require('../services/ownerPlan');

const fx = () => global.__erp;

const invite = (token, hostelId, email, phone) => request(app)
  .post('/api/tenants')
  .set(auth(token))
  .field('full_name', 'Portal Tenant')
  .field('phone', phone)
  .field('hostel_id', String(hostelId))
  .field('email', email)
  .field('password', 'Tenant1')
  .field('create_login', 'true');

describe('PKG-004 Silver marketplace SKU', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let silverOnlyToken;
  let live;
  let draft;
  let lapsed;
  let regular;
  let ids = [];

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { User, Hostel } = require('../models');
    const { hashPassword } = require('../helpers/password');
    const override = {
      media_override_reason: 'PKG-004 silver marketplace test',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    };
    const mk = (attrs) => Hostel.create({
      owner_id: fx().owner.id,
      address: '8 Silver Lane',
      city: 'Chennai',
      state: 'TN',
      pincode: '600001',
      status: 'active',
      plan: 'silver',
      ...override,
      ...attrs,
    });

    live = await mk({
      name: 'Silver Live PG',
      code: 'SLVLIVE',
      listing_published: true,
      plan_status: 'grace',
    });
    draft = await mk({
      name: 'Silver Draft PG',
      code: 'SLVDRAFT',
      listing_published: false,
      plan_status: 'active',
      media_override_reason: null,
      media_override_by: null,
      media_override_at: null,
    });
    lapsed = await mk({
      name: 'Silver Lapsed PG',
      code: 'SLVLAPSE',
      listing_published: true,
      plan_status: 'lapsed',
    });
    regular = await mk({
      name: 'Regular Tenant PG',
      code: 'RGPORT1',
      listing_published: true,
      plan: 'regular',
      plan_status: 'comp',
    });
    ids = [live.id, draft.id, lapsed.id, regular.id];
    await Promise.all(ids.map((id) => refreshListingProjection(id)));

    const silverOwner = await User.create({
      email: 'silver-only@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Sil',
      last_name: 'Owner',
      role: 'owner',
      is_active: true,
      email_verified: true,
    });
    await live.update({ owner_id: silverOwner.id });
    await draft.update({ owner_id: silverOwner.id });
    await refreshListingProjection(live.id);
    await refreshListingProjection(draft.id);
    silverOnlyToken = await login(silverOwner.email, PASSWORD);
  });

  afterAll(async () => {
    const { ListingProjection, Hostel, User } = require('../models');
    const ownerId = live?.owner_id;
    await ListingProjection.destroy({ where: { hostel_id: ids } });
    await Hostel.destroy({ where: { id: ids }, force: true });
    if (ownerId && ownerId !== fx().owner.id) {
      await User.destroy({ where: { id: ownerId }, force: true });
    }
  });

  test('live includes grace and SA-gifted comp; pending and lapsed do not', () => {
    expect(entitlementsOf({ plan: 'silver', plan_status: 'grace' }).online_booking).toBe(true);
    expect(entitlementsOf({ plan: 'silver', plan_status: 'active' }).public_search).toBe(true);
    expect(entitlementsOf({ plan: 'silver', plan_status: 'comp' }).tenant_portal).toBe(true);
    expect(entitlementsOf({ plan: 'silver', plan_status: 'comp' }).listing_analytics).toBe(true);
    expect(entitlementsOf({ plan: 'silver', plan_status: 'lapsed' }).online_booking).toBe(false);
    expect(entitlementsOf({ plan: 'silver', plan_status: 'pending' }).listing_publish).toBe(false);
    expect(entitlementsOf({ plan: 'gold', plan_status: 'grace' }).vita_eye).toBe(true);
    expect(entitlementsOf({ plan: 'silver', plan_status: 'grace' }).vita_eye).toBe(false);
  });

  test('published Silver in grace is on search and listing GET is 200', async () => {
    const search = await request(app).get('/api/public/listings').query({ city: 'Chennai' });
    expect(search.status).toBe(200);
    const codes = (search.body.data.items || []).map((row) => row.code);
    expect(codes).toContain('SLVLIVE');
    expect(codes).not.toContain('SLVDRAFT');
    expect(codes).not.toContain('SLVLAPSE');
    expect(codes).not.toContain('RGPORT1');

    const listing = await request(app).get(`/api/public/listings/${live.code}`);
    expect(listing.status).toBe(200);
    expect(listing.body.data.preview).toBe(false);
    expect(listing.body.data.hostel.name).toBe('Silver Live PG');
  });

  test('unpublished Silver is 404 for guests and preview for the owner', async () => {
    const guest = await request(app).get(`/api/public/listings/${draft.code}`);
    expect(guest.status).toBe(404);
    expect(guest.body.message).toMatch(/not found/i);
    expect(JSON.stringify(guest.body)).not.toMatch(/Silver Draft/);

    const preview = await request(app)
      .get(`/api/public/listings/${draft.code}`)
      .set(auth(silverOnlyToken));
    expect(preview.status).toBe(200);
    expect(preview.body.data.preview).toBe(true);
  });

  test('lapsed Silver is 404 even if listing_published; bookings 403', async () => {
    const listing = await request(app).get(`/api/public/listings/${lapsed.code}`);
    expect(listing.status).toBe(404);

    const ownerPeek = await request(app)
      .get(`/api/public/listings/${lapsed.code}`)
      .set(auth(ownerToken));
    expect(ownerPeek.status).toBe(404);

    await request(app).post('/api/public/auth/otp').send({
      email: 'pkg004seeker@test.vitastay.local',
      phone: '9876590401',
    });
    const { OtpVerification } = require('../models');
    const otp = async (type) => {
      const row = await OtpVerification.findOne({
        where: { email: 'pkg004seeker@test.vitastay.local', type, is_used: false },
        order: [['created_at', 'DESC']],
      });
      return row?.otp;
    };
    const registered = await request(app).post('/api/public/auth/register').send({
      email: 'pkg004seeker@test.vitastay.local',
      phone: '9876590401',
      first_name: 'Sil',
      last_name: 'Seeker',
      password: 'SeekerPass1',
      email_otp: await otp('email_verify'),
      phone_otp: await otp('phone_verify'),
    });
    expect(registered.status).toBe(201);
    const token = registered.body.data.accessToken;

    const lapsedBook = await request(app)
      .post('/api/bookings')
      .set(auth(token))
      .send({ hostel_id: lapsed.id, room_type: 'double', move_in_date: '2026-12-20' });
    expect(lapsedBook.status).toBe(403);

    const draftBook = await request(app)
      .post('/api/bookings')
      .set(auth(token))
      .send({ hostel_id: draft.id, room_type: 'double', move_in_date: '2026-12-20' });
    expect(draftBook.status).toBe(404);

    const liveBook = await request(app)
      .post('/api/bookings')
      .set(auth(token))
      .send({ hostel_id: live.id, room_type: 'double', move_in_date: '2026-12-20' });
    expect(liveBook.status).not.toBe(403);
    expect([201, 409, 422]).toContain(liveBook.status);
  });

  test('Silver-only owner keeps Bookings and Listing stats; Regular and lapsed cannot invite tenants', async () => {
    const inbox = await request(app).get('/api/bookings').set(auth(silverOnlyToken));
    expect(inbox.status).toBe(200);

    const stats = await request(app).get('/api/listing-analytics').set(auth(silverOnlyToken));
    expect(stats.status).toBe(200);

    const lapsedStats = await request(app)
      .get('/api/listing-analytics')
      .query({ hostel_id: lapsed.id })
      .set(auth(ownerToken));
    expect(lapsedStats.status).toBe(403);

    const publishDraft = await request(app)
      .post(`/api/hostels/${draft.id}/listing/publish`)
      .set(auth(silverOnlyToken))
      .send({});
    expect(publishDraft.status).not.toBe(403);

    const regularInvite = await invite(ownerToken, regular.id, 'pkg004-regular@test.vitastay.local', '9876590402');
    expect(regularInvite.status).toBe(403);
    expect(regularInvite.body.message).toMatch(/tenant logins/i);

    const lapsedInvite = await invite(ownerToken, lapsed.id, 'pkg004-lapsed@test.vitastay.local', '9876590403');
    expect(lapsedInvite.status).toBe(403);

    const liveInvite = await invite(silverOnlyToken, live.id, 'pkg004-live@test.vitastay.local', '9876590404');
    expect(liveInvite.status).not.toBe(403);
    expect(liveInvite.status).toBe(400);
    expect(liveInvite.body.message).toMatch(/identity/i);
  });
});
