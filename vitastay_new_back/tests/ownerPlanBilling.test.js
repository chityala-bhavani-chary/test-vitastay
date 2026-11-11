/**
 * BKG-016 / TC-B-19 — owner subscription catalog, GST invoice, checkout, lapse.
 * No per-booking commission. Prices come from Super Admin catalog, never hard-coded.
 */
const crypto = require('crypto');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { processPlanRenewals } = require('../services/ownerPlanBilling');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const secret = () => process.env.PAYMENT_WEBHOOK_SECRET || 'test-webhook-secret';
const sign = (body) => crypto.createHmac('sha256', secret()).update(body).digest('hex');
const capturedPayload = (orderId, paymentId, amountPaise) => JSON.stringify({
  id: `evt_${paymentId}`,
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: paymentId,
        order_id: orderId,
        amount: amountPaise,
        method: 'upi',
        status: 'captured',
      },
    },
  },
});

describe('BKG-016 owner plan billing', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let saToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
  });

  test('catalog has Regular/Silver/Gold and checkout is off until finance fills INR', async () => {
    const res = await request(app).get('/api/plans').set(auth(ownerToken));
    expect(res.status).toBe(200);
    const codes = (res.body.data.plans || []).map((row) => row.code);
    expect(codes).toEqual(expect.arrayContaining(['regular', 'silver', 'gold']));
    expect(res.body.data.plans.every((row) => row.monthly_inr == null && row.yearly_inr == null)).toBe(true);

    const pay = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/plan/pay`)
      .set(auth(ownerToken))
      .send({ plan: 'gold', period: 'month' });
    expect(pay.status).toBe(422);
    expect(pay.body.message).toMatch(/finance fills/i);
  });

  test('Regular hostel is absent from public search and seeker booking is 403', async () => {
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().pendingHostel.id);
    const snapshot = {
      status: hostel.status,
      listing_published: hostel.listing_published,
      plan: hostel.plan,
      plan_status: hostel.plan_status,
      media_override_reason: hostel.media_override_reason,
      media_override_by: hostel.media_override_by,
      media_override_at: hostel.media_override_at,
    };
    await hostel.update({
      status: 'active',
      listing_published: true,
      plan: 'regular',
      plan_status: 'comp',
      media_override_reason: 'BKG-016 regular leak test',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel);

    try {
      const search = await request(app).get('/api/public/listings').query({ city: 'Bangalore' });
      expect(search.status).toBe(200);
      const rows = search.body.data?.items || [];
      const ids = rows.map((row) => row.id || row.hostel_id);
      expect(ids).not.toContain(hostel.id);

      const listing = await request(app).get(`/api/public/listings/${hostel.code}`);
      expect(listing.status).toBe(404);

      await request(app).post('/api/public/auth/otp').send({
        email: 'planseeker@test.vitastay.local',
        phone: '9876590160',
      });
      const { OtpVerification } = require('../models');
      const otp = async (type) => {
        const row = await OtpVerification.findOne({
          where: { email: 'planseeker@test.vitastay.local', type, is_used: false },
          order: [['created_at', 'DESC']],
        });
        return row?.otp;
      };
      const registered = await request(app).post('/api/public/auth/register').send({
        email: 'planseeker@test.vitastay.local',
        phone: '9876590160',
        first_name: 'Plan',
        last_name: 'Seeker',
        password: 'SeekerPass1',
        email_otp: await otp('email_verify'),
        phone_otp: await otp('phone_verify'),
      });
      expect(registered.status).toBe(201);
      const book = await request(app)
        .post('/api/bookings')
        .set(auth(registered.body.data.accessToken))
        .send({ hostel_id: hostel.id, room_type: 'double', move_in_date: '2026-12-01' });
      expect(book.status).toBe(403);
      expect(book.body.message).toMatch(/Upgrade to Silver/i);
    } finally {
      await hostel.update(snapshot);
      await refreshListingProjection(hostel);
    }
  });

  test('Super Admin fills prices; owner GST invoice + webhook activates Gold; duplicate is 200', async () => {
    const put = await request(app)
      .put('/api/super-admin/plans/gold')
      .set(auth(saToken))
      .send({ monthly_inr: 4999, yearly_inr: 49990, gst_pct: 18 });
    expect(put.status).toBe(200);
    expect(put.body.data.monthly_inr).toBe(4999);
    expect(put.body.data.gst_pct).toBe(18);

    const seekerOwner = await request(app)
      .put('/api/super-admin/plans/gold')
      .set(auth(ownerToken))
      .send({ monthly_inr: 1 });
    expect(seekerOwner.status).toBe(403);

    const pay = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/plan/pay`)
      .set(auth(ownerToken))
      .send({ plan: 'gold', period: 'month' });
    expect(pay.status).toBe(200);
    expect(pay.body.data.order_type || pay.body.data.invoice).toBeTruthy();
    expect(pay.body.data.amount).toBe(5898.82);
    expect(pay.body.data.invoice.gst_amount).toBe(899.82);
    expect(pay.body.data.invoice.amount_ex_gst).toBe(4999);
    const orderId = pay.body.data.order_id;

    const { PaymentOrder } = require('../models');
    const row = await PaymentOrder.findOne({ where: { gateway_order_id: orderId } });
    expect(row.order_type).toBe('owner_plan');
    expect(row.booking_id).toBeNull();
    expect(row.rent_payment_id).toBeNull();
    expect(row.owner_invoice_id).toBeTruthy();

    const body = capturedPayload(orderId, `pay_gold_${Date.now()}`, Math.round(5898.82 * 100));
    const hook = await request(app)
      .post('/api/payments/webhook')
      .set('x-razorpay-signature', sign(body))
      .set('Content-Type', 'application/json')
      .send(body);
    expect(hook.status).toBe(200);

    const replay = await request(app)
      .post('/api/payments/webhook')
      .set('x-razorpay-signature', sign(body))
      .set('Content-Type', 'application/json')
      .send(body);
    expect(replay.status).toBe(200);

    const hostel = await require('../models').Hostel.findByPk(fx().hostel.id);
    expect(hostel.plan).toBe('gold');
    expect(hostel.plan_status).toBe('active');
    expect(hostel.plan_expires_at).toBeTruthy();

    const me = await request(app).get(`/api/hostels/${fx().hostel.id}/plan`).set(auth(ownerToken));
    expect(me.status).toBe(200);
    expect(me.body.data.plan).toBe('gold');
    expect(me.body.data.invoices[0].status).toBe('paid');
    expect(me.body.data.entitlements.vita_eye).toBe(true);
    expect(me.body.data.entitlements.public_search).toBe(true);
  });

  test('other owner cannot buy this hostel; supervisor has no catalog write', async () => {
    const { User, Hostel } = require('../models');
    const { hashPassword } = require('../helpers/password');
    const other = await User.create({
      email: 'other.owner.plan@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Other',
      last_name: 'Owner',
      role: 'owner',
      is_active: true,
      email_verified: true,
    });
    const otherHostel = await Hostel.create({
      owner_id: other.id,
      name: 'Other PG',
      code: 'OTHP01',
      address: '9 Other St',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      status: 'active',
      plan: 'regular',
      plan_status: 'comp',
    });
    const otherToken = await login(other.email, PASSWORD);
    const steal = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/plan/pay`)
      .set(auth(otherToken))
      .send({ plan: 'silver', period: 'month' });
    expect(steal.status).toBe(403);

    const mine = await request(app).get(`/api/hostels/${otherHostel.id}/plan`).set(auth(ownerToken));
    expect(mine.status).toBe(403);
  });

  test('grace then lapse to Regular unpublishes and expires unpaid holds', async () => {
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      plan: 'silver',
      plan_status: 'active',
      listing_published: true,
      status: 'active',
      plan_expires_at: new Date(Date.now() - 60 * 1000),
      plan_grace_ends_at: new Date(Date.now() + 60 * 60 * 1000),
    });
    const first = await processPlanRenewals(new Date());
    expect(first.grace).toBeGreaterThanOrEqual(1);
    await hostel.reload();
    expect(hostel.plan).toBe('silver');
    expect(hostel.plan_status).toBe('grace');

    await hostel.update({ plan_grace_ends_at: new Date(Date.now() - 1000) });
    const second = await processPlanRenewals(new Date());
    expect(second.lapsed).toBeGreaterThanOrEqual(1);
    await hostel.reload();
    expect(hostel.plan).toBe('regular');
    expect(hostel.plan_status).toBe('lapsed');
    expect(hostel.listing_published).toBe(false);

    await refreshListingProjection(hostel);
    const search = await request(app).get('/api/public/listings');
    const ids = (search.body.data?.items || []).map((row) => row.id || row.hostel_id);
    expect(ids).not.toContain(hostel.id);
  });

  test('Super Admin assign Regular with reason; short reason 422', async () => {
    const short = await request(app)
      .post(`/api/super-admin/hostels/${fx().hostel.id}/plan`)
      .set(auth(saToken))
      .send({ plan: 'silver', reason: 'too short' });
    expect(short.status).toBe(422);

    const ok = await request(app)
      .post(`/api/super-admin/hostels/${fx().hostel.id}/plan`)
      .set(auth(saToken))
      .send({ plan: 'silver', period: 'year', reason: 'Onboarding gift for demo hostel' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.plan).toBe('silver');
    expect(ok.body.data.plan_status).toBe('comp');
    expect(new Date(ok.body.data.plan_expires_at).getTime()).toBeGreaterThan(Date.now() + 300 * 24 * 60 * 60 * 1000);
  });

  test('PKG-007 renew same plan stacks paid-until; order is owner_plan not seeker checkout', async () => {
    const {
      Hostel, PaymentOrder, PaymentEvent, ListingProjection, OwnerInvoice, OwnerSubscription,
    } = require('../models');
    const hostel = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Renew Plan PG',
      code: 'RNWPLN01',
      address: '3 Renew Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      status: 'active',
      listing_published: false,
      plan: 'regular',
      plan_status: 'comp',
    });

    const put = await request(app)
      .put('/api/super-admin/plans/silver')
      .set(auth(saToken))
      .send({ monthly_inr: 2000, yearly_inr: 20000, gst_pct: 18 });
    expect(put.status).toBe(200);

    const payOnce = async () => {
      const pay = await request(app)
        .post(`/api/hostels/${hostel.id}/plan`)
        .set(auth(ownerToken))
        .send({ plan: 'silver', period: 'month' });
      expect(pay.status).toBe(200);
      expect(pay.body.data.action).toBe('checkout');
      expect(pay.body.data.order_type).toBe('owner_plan');
      expect(pay.body.data.invoice.amount_ex_gst).toBe(2000);
      expect(pay.body.data.invoice.gst_amount).toBe(360);
      expect(pay.body.data.amount).toBe(2360);
      const orderId = pay.body.data.order_id;
      const row = await PaymentOrder.findOne({ where: { gateway_order_id: orderId } });
      expect(row.order_type).toBe('owner_plan');
      expect(row.booking_id).toBeNull();
      expect(row.rent_payment_id).toBeNull();
      expect(row.owner_invoice_id).toBeTruthy();
      const body = capturedPayload(orderId, `pay_rnw_${orderId}`, Math.round(2360 * 100));
      const hook = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', sign(body))
        .set('Content-Type', 'application/json')
        .send(body);
      expect(hook.status).toBe(200);
      const replay = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', sign(body))
        .set('Content-Type', 'application/json')
        .send(body);
      expect(replay.status).toBe(200);
      expect(await PaymentEvent.count({
        where: { provider_event_id: JSON.parse(body).id },
      })).toBe(1);
      return orderId;
    };

    try {
      await payOnce();
      await hostel.reload();
      expect(hostel.plan).toBe('silver');
      expect(hostel.plan_status).toBe('active');
      const firstEnd = new Date(hostel.plan_expires_at).getTime();
      expect(firstEnd).toBeGreaterThan(Date.now());

      await payOnce();
      await hostel.reload();
      const secondEnd = new Date(hostel.plan_expires_at).getTime();
      expect(secondEnd).toBeGreaterThan(firstEnd + 20 * 24 * 60 * 60 * 1000);

      const me = await request(app).get(`/api/hostels/${hostel.id}/plan`).set(auth(ownerToken));
      expect(me.status).toBe(200);
      expect(me.body.data.invoices.filter((row) => row.status === 'paid').length).toBeGreaterThanOrEqual(2);
    } finally {
      await PaymentOrder.destroy({ where: { hostel_id: hostel.id }, force: true });
      await OwnerInvoice.destroy({ where: { hostel_id: hostel.id }, force: true });
      await OwnerSubscription.destroy({ where: { hostel_id: hostel.id }, force: true });
      await ListingProjection.destroy({ where: { hostel_id: hostel.id } });
      await hostel.destroy({ force: true });
    }
  });
});
