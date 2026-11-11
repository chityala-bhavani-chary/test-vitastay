/**
 * PKG-009 / TC-PKG-09 — Super Admin assign / gift / override with reason (audit).
 * Hostel list returns plan. Gift expires after the period unless comp_until is set.
 * Regular unpublishes. Owner cannot call the SA route.
 */
const dayjs = require('dayjs');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;

describe('PKG-009 Super Admin assign plan', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let saToken;
  let hostel;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
    const { Hostel } = require('../models');
    hostel = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'SA Assign PG',
      code: 'SAASGN01',
      address: '9 Gift Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      status: 'active',
      listing_published: true,
      plan: 'silver',
      plan_period: 'month',
      plan_status: 'active',
    });
    await refreshListingProjection(hostel.id);
  });

  afterAll(async () => {
    const {
      Hostel, ListingProjection, ListingAvailability, OccupancySnapshot,
      OwnerSubscription, Notification, AuditLog,
    } = require('../models');
    const id = hostel?.id;
    if (!id) return;
    await OwnerSubscription.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await ListingAvailability.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await OccupancySnapshot.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await ListingProjection.destroy({ where: { hostel_id: id } }).catch(() => {});
    await Notification.destroy({ where: { user_id: fx().owner.id, title: 'Plan updated by Vita Stay' } }).catch(() => {});
    await AuditLog.destroy({ where: { entity_type: 'hostel', entity_id: id, action: 'OWNER_PLAN_ASSIGN' } }).catch(() => {});
    await Hostel.destroy({ where: { id }, force: true }).catch(() => {});
  });

  test('GET /super-admin/hostels includes plan on each row', async () => {
    const res = await request(app)
      .get('/api/super-admin/hostels')
      .query({ search: 'SAASGN01' })
      .set(auth(saToken));
    expect(res.status).toBe(200);
    const rows = res.body.data || [];
    const row = rows.find((item) => Number(item.id) === Number(hostel.id));
    expect(row).toBeTruthy();
    expect(row.plan).toBeTruthy();
    expect(row.plan_status).toBeTruthy();
  });

  test('owner cannot assign via Super Admin route', async () => {
    const res = await request(app)
      .post(`/api/super-admin/hostels/${hostel.id}/plan`)
      .set(auth(ownerToken))
      .send({ plan: 'gold', period: 'year', reason: 'Owner trying to gift themselves gold' });
    expect(res.status).toBe(403);
  });

  test('short reason is 422', async () => {
    const res = await request(app)
      .post(`/api/super-admin/hostels/${hostel.id}/plan`)
      .set(auth(saToken))
      .send({ plan: 'gold', period: 'year', reason: 'too short' });
    expect(res.status).toBe(422);
  });

  test('gift without comp_until expires after the selected period', async () => {
    const res = await request(app)
      .post(`/api/super-admin/hostels/${hostel.id}/plan`)
      .set(auth(saToken))
      .send({ plan: 'gold', period: 'year', reason: 'Onboarding gift for sales demo hostel' });
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe('gold');
    expect(res.body.data.plan_status).toBe('comp');
    const expires = new Date(res.body.data.plan_expires_at).getTime();
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    expect(expires).toBeGreaterThan(Date.now() + yearMs - 2 * 24 * 60 * 60 * 1000);
    expect(expires).toBeLessThan(Date.now() + yearMs + 2 * 24 * 60 * 60 * 1000);

    const { AuditLog } = require('../models');
    const log = await AuditLog.findOne({
      where: {
        entity_type: 'hostel',
        entity_id: hostel.id,
        action: 'OWNER_PLAN_ASSIGN',
        user_id: fx().superAdmin.id,
      },
      order: [['id', 'DESC']],
    });
    expect(log).toBeTruthy();
    const blob = typeof log.new_values === 'string'
      ? log.new_values
      : JSON.stringify(log.new_values || {});
    expect(blob).toMatch(/gold/);
    expect(blob).toMatch(/Onboarding gift/);
  });

  test('comp_until / expires_at overrides the period end', async () => {
    const res = await request(app)
      .post(`/api/super-admin/hostels/${hostel.id}/plan`)
      .set(auth(saToken))
      .send({
        plan: 'silver',
        period: 'year',
        reason: 'Support gift until the owner pays Razorpay',
        expires_at: '2027-06-15',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe('silver');
    expect(Math.abs(dayjs(res.body.data.plan_expires_at).diff(dayjs('2027-06-15'), 'hour'))).toBeLessThan(24);
  });

  test('assign Regular unpublishes the listing (kill-switch)', async () => {
    const res = await request(app)
      .post(`/api/super-admin/hostels/${hostel.id}/plan`)
      .set(auth(saToken))
      .send({ plan: 'regular', period: 'year', reason: 'Support kill-switch while billing is stuck' });
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe('regular');
    expect(res.body.data.listing_published).toBe(false);
    expect(res.body.data.entitlements.public_search).toBe(false);

    const { ListingProjection } = require('../models');
    const proj = await ListingProjection.findOne({ where: { hostel_id: hostel.id } });
    expect(proj).toBeTruthy();
    expect(Boolean(proj.marketplace_ok)).toBe(false);
  });
});
