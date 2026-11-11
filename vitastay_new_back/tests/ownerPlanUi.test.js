/**
 * PKG-006 / TC-PKG-06 — owner Settings → Plan: GET/POST /hostels/:id/plan,
 * docs/17 copy, downgrade confirm unpublishes.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');
const { PLAN_OWNER_COPY, UNPUBLISH_DOWNGRADE_MESSAGE } = require('../services/ownerPlan');

const fx = () => global.__erp;

describe('PKG-006 owner Settings → Plan', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let silver;
  let gold;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Hostel } = require('../models');
    silver = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Silver Plan UI PG',
      code: 'SLVPLNUI',
      address: '1 Plan Lane',
      city: 'Mumbai',
      state: 'MH',
      pincode: '400001',
      status: 'active',
      listing_published: true,
      plan: 'silver',
      plan_period: 'month',
      plan_status: 'active',
    });
    gold = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Gold Plan UI PG',
      code: 'GLDPLNUI',
      address: '2 Plan Lane',
      city: 'Mumbai',
      state: 'MH',
      pincode: '400002',
      status: 'active',
      listing_published: true,
      plan: 'gold',
      plan_period: 'year',
      plan_status: 'comp',
    });
    await refreshListingProjection(silver.id);
    await refreshListingProjection(gold.id);
  });

  afterAll(async () => {
    const { ListingProjection, Hostel } = require('../models');
    const ids = [silver?.id, gold?.id].filter(Boolean);
    await ListingProjection.destroy({ where: { hostel_id: ids } });
    await Hostel.destroy({ where: { id: ids }, force: true });
  });

  test('GET plan returns current package, period, docs/17 copy, and listing flag', async () => {
    const res = await request(app).get(`/api/hostels/${silver.id}/plan`).set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe('silver');
    expect(res.body.data.plan_period).toBe('month');
    expect(res.body.data.listing_published).toBe(true);
    expect(res.body.data.downgrade_unpublishes).toBe(true);
    expect(res.body.data.copy).toBe(PLAN_OWNER_COPY.silver);
    const copies = (res.body.data.catalog || []).map((row) => [row.code, row.copy]);
    expect(copies).toEqual(expect.arrayContaining([
      ['regular', PLAN_OWNER_COPY.regular],
      ['silver', PLAN_OWNER_COPY.silver],
      ['gold', PLAN_OWNER_COPY.gold],
    ]));
  });

  test('POST Regular without confirm_unpublish is 422 and listing stays live', async () => {
    const res = await request(app)
      .post(`/api/hostels/${silver.id}/plan`)
      .set(auth(ownerToken))
      .send({ plan: 'regular', period: 'month' });
    expect(res.status).toBe(422);
    expect(res.body.message).toBe(UNPUBLISH_DOWNGRADE_MESSAGE);
    expect(res.body.errors).toEqual({ needs_confirm: true, unpublish: true });

    await silver.reload();
    expect(silver.plan).toBe('silver');
    expect(silver.listing_published).toBe(true);
  });

  test('POST Regular with confirm_unpublish unpublishes and drops marketplace', async () => {
    const res = await request(app)
      .post(`/api/hostels/${silver.id}/plan`)
      .set(auth(ownerToken))
      .send({ plan: 'regular', period: 'month', confirm_unpublish: true });
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('downgraded');
    expect(res.body.data.plan).toBe('regular');
    expect(res.body.data.listing_published).toBe(false);
    expect(res.body.data.copy).toBe(PLAN_OWNER_COPY.regular);
    expect(res.body.data.entitlements.public_search).toBe(false);

    await silver.reload();
    expect(silver.plan).toBe('regular');
    expect(silver.listing_published).toBe(false);

    const search = await request(app).get('/api/public/listings').query({ city: 'Mumbai' });
    const ids = (search.body.data?.items || []).map((row) => row.id || row.hostel_id);
    expect(ids).not.toContain(silver.id);
  });

  test('Gold → Silver keeps the listing live and does not require unpublish confirm', async () => {
    const res = await request(app)
      .post(`/api/hostels/${gold.id}/plan`)
      .set(auth(ownerToken))
      .send({ plan: 'silver', period: 'year' });
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('downgraded');
    expect(res.body.data.plan).toBe('silver');
    expect(res.body.data.listing_published).toBe(true);
    expect(res.body.data.entitlements.vita_eye).toBe(false);
    expect(res.body.data.entitlements.public_search).toBe(true);

    await gold.reload();
    expect(gold.listing_published).toBe(true);
    expect(gold.plan).toBe('silver');
  });

  test('upgrade while INR is empty is 422; other owner cannot change this PG', async () => {
    const pay = await request(app)
      .post(`/api/hostels/${silver.id}/plan`)
      .set(auth(ownerToken))
      .send({ plan: 'gold', period: 'month' });
    expect(pay.status).toBe(422);
    expect(pay.body.message).toMatch(/finance fills/i);

    const { User } = require('../models');
    const { hashPassword } = require('../helpers/password');
    const other = await User.create({
      email: 'pkg006.other@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Other',
      last_name: 'Owner',
      role: 'owner',
      is_active: true,
      email_verified: true,
    });
    try {
      const otherToken = await login(other.email, PASSWORD);
      const forbidden = await request(app)
        .post(`/api/hostels/${silver.id}/plan`)
        .set(auth(otherToken))
        .send({ plan: 'regular', confirm_unpublish: true });
      expect(forbidden.status).toBe(403);
    } finally {
      await other.destroy({ force: true });
    }
  });
});
