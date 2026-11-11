/**
 * PKG-005 — Gold is Silver plus full_product / vita_eye. Silver gets 403.
 * Enrol is PKG-010. Capture without a still is 422 (PKG-011).
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');
const { entitlementsOf, NEW_EXTRA_FLAG, UPGRADE_COPY } = require('../services/ownerPlan');

const fx = () => global.__erp;

describe('PKG-005 Gold extras and Vita Eye gates', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let gold;
  let silver;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Hostel } = require('../models');
    gold = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Gold Gate PG',
      code: 'GLDGATE',
      address: '1 Gold Lane',
      city: 'Mumbai',
      state: 'MH',
      pincode: '400001',
      status: 'active',
      listing_published: true,
      plan: 'gold',
      plan_status: 'active',
    });
    silver = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Silver No Eye PG',
      code: 'SLVNOEYE',
      address: '2 Silver Lane',
      city: 'Mumbai',
      state: 'MH',
      pincode: '400002',
      status: 'active',
      listing_published: true,
      plan: 'silver',
      plan_status: 'grace',
    });
    await refreshListingProjection(gold.id);
    await refreshListingProjection(silver.id);
  });

  afterAll(async () => {
    const { ListingProjection, Hostel } = require('../models');
    const ids = [gold?.id, silver?.id].filter(Boolean);
    await ListingProjection.destroy({ where: { hostel_id: ids } });
    await Hostel.destroy({ where: { id: ids }, force: true });
  });

  test('Gold live has every Silver flag plus vita_eye and full_product', () => {
    expect(NEW_EXTRA_FLAG).toBe('full_product');
    const live = entitlementsOf({ plan: 'gold', plan_status: 'active' });
    expect(live.public_search).toBe(true);
    expect(live.online_booking).toBe(true);
    expect(live.tenant_portal).toBe(true);
    expect(live.listing_analytics).toBe(true);
    expect(live.listing_publish).toBe(true);
    expect(live.vita_eye).toBe(true);
    expect(live.full_product).toBe(true);

    const silverLive = entitlementsOf({ plan: 'silver', plan_status: 'grace' });
    expect(silverLive.online_booking).toBe(true);
    expect(silverLive.vita_eye).toBe(false);
    expect(silverLive.full_product).toBe(false);

    const lapsed = entitlementsOf({ plan: 'gold', plan_status: 'lapsed' });
    expect(lapsed.vita_eye).toBe(false);
    expect(lapsed.full_product).toBe(false);
    expect(lapsed.erp).toBe(true);
  });

  test('Silver and Regular Vita Eye routes are 403 with Gold upgrade copy', async () => {
    const silverGet = await request(app)
      .get(`/api/hostels/${silver.id}/vita-eye`)
      .set(auth(ownerToken));
    expect(silverGet.status).toBe(403);
    expect(silverGet.body.message).toBe(UPGRADE_COPY.vita_eye);

    const silverEnroll = await request(app)
      .post(`/api/hostels/${silver.id}/vita-eye/enroll`)
      .set(auth(ownerToken))
      .send({ subject_type: 'resident' });
    expect(silverEnroll.status).toBe(403);

    const regular = await request(app)
      .get(`/api/hostels/${fx().pendingHostel.id}/vita-eye`)
      .set(auth(ownerToken));
    expect(regular.status).toBe(403);
  });

  test('Gold Vita Eye status is 200 ready; enrol without consent is 422; capture without still is 422', async () => {
    const status = await request(app)
      .get(`/api/hostels/${gold.id}/vita-eye`)
      .set(auth(ownerToken));
    expect(status.status).toBe(200);
    expect(status.body.data.ready).toBe(true);
    expect(status.body.data.capture_ready).toBe(true);
    expect(status.body.data.flag).toBe('vita_eye');
    expect(status.body.data.entitlements.full_product).toBe(true);
    expect(JSON.stringify(status.body)).not.toMatch(/\/uploads\/tenants\//);
    expect(JSON.stringify(status.body)).not.toMatch(/embedding_cipher/);

    const enroll = await request(app)
      .post(`/api/hostels/${gold.id}/vita-eye/enroll`)
      .set(auth(ownerToken))
      .send({});
    expect(enroll.status).toBe(422);

    const capture = await request(app)
      .post(`/api/hostels/${gold.id}/vita-eye/capture`)
      .set(auth(ownerToken))
      .send({});
    expect(capture.status).toBe(422);

    const events = await request(app)
      .get(`/api/hostels/${gold.id}/vita-eye/events`)
      .set(auth(ownerToken));
    expect(events.status).toBe(200);
    expect(Array.isArray(events.body.data.events)).toBe(true);
  });

  test('lapsed Gold cannot call Vita Eye', async () => {
    await gold.update({ plan_status: 'lapsed' });
    const res = await request(app)
      .get(`/api/hostels/${gold.id}/vita-eye`)
      .set(auth(ownerToken));
    expect(res.status).toBe(403);
    await gold.update({ plan_status: 'active' });
  });
});
