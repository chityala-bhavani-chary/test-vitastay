/**
 * PKG-003 — Regular is ERP only. Public URLs 404. Seekers 403. Occupancy + revenue stay.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;

describe('PKG-003 Regular is ERP only', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let regularOwnerToken;
  let regular;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { User, Hostel } = require('../models');
    const { hashPassword } = require('../helpers/password');
    const regularOwner = await User.create({
      email: 'regular-only@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Reg',
      last_name: 'Owner',
      role: 'owner',
      is_active: true,
      email_verified: true,
    });
    regular = await Hostel.create({
      owner_id: regularOwner.id,
      name: 'Regular Only PG',
      code: 'RGONLY1',
      address: '3 ERP Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      status: 'active',
      listing_published: true,
      plan: 'regular',
      plan_status: 'comp',
      media_override_reason: 'PKG-003 regular URL leak test',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(regular.id);
    regularOwnerToken = await login(regularOwner.email, PASSWORD);
  });

  afterAll(async () => {
    if (!regular) return;
    const { ListingProjection, Hostel, User } = require('../models');
    const ownerId = regular.owner_id;
    await ListingProjection.destroy({ where: { hostel_id: regular.id } });
    await Hostel.destroy({ where: { id: regular.id }, force: true });
    if (ownerId) await User.destroy({ where: { id: ownerId }, force: true });
  });

  test('public listing and media GET are 404 for guests and the owner — same unpublished copy', async () => {
    const guest = await request(app).get(`/api/public/listings/${regular.code}`);
    expect(guest.status).toBe(404);
    expect(guest.body.message).toMatch(/not found/i);
    expect(JSON.stringify(guest.body)).not.toMatch(/Regular Only/);
    expect(JSON.stringify(guest.body)).not.toMatch(/\/uploads\//);

    const ownerPublic = await request(app)
      .get(`/api/public/listings/${regular.code}`)
      .set(auth(regularOwnerToken));
    expect(ownerPublic.status).toBe(404);
    expect(ownerPublic.body.message).toBe(guest.body.message);

    const media = await request(app).get(`/api/public/listings/${regular.id}/media`);
    expect(media.status).toBe(404);
    expect(JSON.stringify(media.body)).not.toMatch(/\/uploads\//);

    const search = await request(app).get('/api/public/listings').query({ city: 'Pune' });
    expect((search.body.data.items || []).map((row) => row.id)).not.toContain(regular.id);
  });

  test('seeker book and owner publish are 403; checklist hides marketplace', async () => {
    await request(app).post('/api/public/auth/otp').send({
      email: 'pkg003seeker@test.vitastay.local',
      phone: '9876590004',
    });
    const { OtpVerification } = require('../models');
    const otp = async (type) => {
      const row = await OtpVerification.findOne({
        where: { email: 'pkg003seeker@test.vitastay.local', type, is_used: false },
        order: [['created_at', 'DESC']],
      });
      return row?.otp;
    };
    const registered = await request(app).post('/api/public/auth/register').send({
      email: 'pkg003seeker@test.vitastay.local',
      phone: '9876590004',
      first_name: 'Reg',
      last_name: 'Seeker',
      password: 'SeekerPass1',
      email_otp: await otp('email_verify'),
      phone_otp: await otp('phone_verify'),
    });
    expect(registered.status).toBe(201);

    const book = await request(app)
      .post('/api/bookings')
      .set(auth(registered.body.data.accessToken))
      .send({ hostel_id: regular.id, room_type: 'double', move_in_date: '2026-12-15' });
    expect(book.status).toBe(403);

    const publish = await request(app)
      .post(`/api/hostels/${regular.id}/listing/publish`)
      .set(auth(regularOwnerToken))
      .send({});
    expect(publish.status).toBe(403);

    const override = await request(app)
      .post(`/api/hostels/${regular.id}/media/override`)
      .set(auth(await login(fx().superAdmin.email, PASSWORD)))
      .send({ reason: 'Try to publish a Regular PG online' });
    expect(override.status).toBe(403);

    const pack = await request(app)
      .get(`/api/hostels/${regular.id}/media/checklist`)
      .set(auth(regularOwnerToken));
    expect(pack.status).toBe(200);
    expect(pack.body.data.listing_publish).toBe(false);
    expect(pack.body.data.marketplace_ok).toBe(false);
    expect(pack.body.data.can_publish).toBe(false);
  });

  test('Regular-only owner booking inbox and listing stats are 403; blueprint and revenue stay', async () => {
    const inbox = await request(app).get('/api/bookings').set(auth(regularOwnerToken));
    expect(inbox.status).toBe(403);
    expect(inbox.body.message).toMatch(/Upgrade to Silver/i);

    const stats = await request(app).get('/api/listing-analytics').set(auth(regularOwnerToken));
    expect(stats.status).toBe(403);

    const blueprint = await request(app)
      .get(`/api/hostels/${regular.id}/blueprint`)
      .set(auth(regularOwnerToken));
    expect(blueprint.status).toBe(200);
    expect(blueprint.body.data.hostel.entitlements.listing_publish).toBe(false);
    expect(blueprint.body.data.hostel.entitlements.public_search).toBe(false);
    expect(blueprint.body.data.hostel.entitlements.occupancy).toBe(true);
    expect(blueprint.body.data.hostel.entitlements.revenue).toBe(true);

    const revenue = await request(app).get('/api/revenue').set(auth(regularOwnerToken));
    expect(revenue.status).toBe(200);

    const mixedInbox = await request(app).get('/api/bookings').set(auth(ownerToken));
    expect(mixedInbox.status).toBe(200);
  });
});
