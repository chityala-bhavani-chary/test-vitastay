/**
 * BKG-011 — hosted checkout for first month + deposit.
 * Webhook marks paid; bed stays reserved (not occupied) until owner confirm.
 */
const crypto = require('crypto');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { projectHostelAvailability } = require('../services/occupancyService');
const { expireHolds } = require('../services/bookingHold');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const emailOf = (n) => `payseeker${n}@test.vitastay.local`;
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
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

const latestOtp = async (email, type) => {
  const { OtpVerification } = require('../models');
  const row = await OtpVerification.findOne({
    where: { email, type, is_used: false },
    order: [['created_at', 'DESC']],
  });
  return row?.otp;
};

const registerSeeker = async (n) => {
  const email = emailOf(n);
  const phone = `987651${String(1000 + n).slice(-4)}`;
  await request(app).post('/api/public/auth/otp').send({ email, phone });
  const res = await request(app).post('/api/public/auth/register').send({
    email,
    phone,
    first_name: 'Pay',
    last_name: `Seeker${n}`,
    password: 'SeekerPass1',
    email_otp: await latestOtp(email, 'email_verify'),
    phone_otp: await latestOtp(email, 'phone_verify'),
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

describe('BKG-011 booking checkout', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let seeker;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      security_deposit: 10000,
      media_override_reason: 'BKG-011 pay tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel.id);
    await projectHostelAvailability(hostel.id);
    seeker = await registerSeeker(1);
  });

  const book = (token) => request(app)
    .post('/api/bookings')
    .set(auth(token))
    .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: tomorrow() });

  test('seeker creates a pay order for first month + deposit', async () => {
    const created = await book(seeker.token);
    expect(created.status).toBe(201);
    expect(created.body.data.deposit_due).toBe(10000);
    expect(created.body.data.amount_payable).toBe(18000);
    fx().bookingPay = created.body.data;

    const pay = await request(app)
      .post(`/api/bookings/${fx().bookingPay.id}/pay`)
      .set(auth(seeker.token));
    expect(pay.status).toBe(200);
    expect(pay.body.data.order_id).toMatch(/^order_mock_/);
    expect(pay.body.data.sandbox).toBe(true);
    expect(pay.body.data.amount).toBe(18000);
    fx().bookingPayOrder = pay.body.data;

    const { Booking } = require('../models');
    const row = await Booking.findByPk(fx().bookingPay.id);
    expect(row.payment_status).toBe('pending');
    expect(row.gateway_order_id).toBe(pay.body.data.order_id);
  });

  test('owner cannot create a seeker pay order', async () => {
    const res = await request(app)
      .post(`/api/bookings/${fx().bookingPay.id}/pay`)
      .set(auth(ownerToken));
    expect(res.status).toBe(403);
  });

  test('unsigned client success is rejected; bed stays reserved', async () => {
    const res = await request(app)
      .post(`/api/bookings/${fx().bookingPay.id}/pay/confirm`)
      .set(auth(seeker.token))
      .send({
        gateway_order_id: fx().bookingPayOrder.order_id,
        razorpay_payment_id: 'pay_spoof',
        razorpay_signature: 'not-a-signature',
      });
    expect(res.status).toBe(400);

    const { Booking, Bed, Tenant } = require('../models');
    const row = await Booking.findByPk(fx().bookingPay.id);
    expect(row.payment_status).not.toBe('paid');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('reserved');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
  });

  test('webhook capture marks paid, keeps reserved, does not occupy', async () => {
    const orderId = fx().bookingPayOrder.order_id;
    const body = capturedPayload(orderId, 'pay_bkg_011', 1800000);
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);

    const { Booking, Bed, Tenant, BedAssignment } = require('../models');
    const row = await Booking.findByPk(fx().bookingPay.id);
    expect(row.payment_status).toBe('paid');
    expect(row.status).toBe('awaiting_approval');
    expect(row.gateway_order_id).toBe(orderId);
    expect((await Bed.findByPk(row.bed_id)).status).toBe('reserved');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
    expect(await BedAssignment.count({ where: { bed_id: row.bed_id, status: 'active' } })).toBe(0);
  });

  test('duplicate webhook stays paid once and still does not occupy', async () => {
    const orderId = fx().bookingPayOrder.order_id;
    const body = capturedPayload(orderId, 'pay_bkg_011', 1800000);
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);

    const { PaymentOrder, Booking, Bed } = require('../models');
    expect(await PaymentOrder.count({
      where: { booking_id: fx().bookingPay.id, status: 'paid' },
    })).toBe(1);
    const row = await Booking.findByPk(fx().bookingPay.id);
    expect(row.payment_status).toBe('paid');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('reserved');
  });

  test('paid hold is not expired by the hold job', async () => {
    const { Booking, Bed } = require('../models');
    const row = await Booking.findByPk(fx().bookingPay.id);
    await row.update({ hold_expires_at: new Date(Date.now() - 1000) });
    await expireHolds();
    await row.reload();
    expect(row.status).toBe('awaiting_approval');
    expect(row.payment_status).toBe('paid');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('reserved');
  });

  test('owner confirm after pay occupies and opening invoice is already paid', async () => {
    const confirmed = await request(app)
      .post(`/api/bookings/${fx().bookingPay.id}/confirm`)
      .set(auth(ownerToken));
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('confirmed');

    const { Bed, Tenant, RentPayment } = require('../models');
    const bedId = fx().bookingPay.bed_id;
    expect((await Bed.findByPk(bedId)).status).toBe('occupied');
    const tenant = await Tenant.findByPk(confirmed.body.data.erp_tenant_id);
    expect(tenant.user_id).toBe(seeker.user.id);
    expect(tenant.status).toBe('pending');
    const invoice = await RentPayment.findOne({ where: { tenant_id: tenant.id } });
    expect(invoice.status).toBe('paid');
    expect(Number(invoice.total_amount)).toBe(18000);
    expect(Number(invoice.paid_amount)).toBe(18000);
    expect(invoice.payment_reference).toBe('pay_bkg_011');

    const checkedIn = await request(app)
      .post(`/api/tenants/${tenant.id}/check-in`)
      .set(auth(ownerToken))
      .send({ hostel_id: fx().hostel.id });
    expect(checkedIn.status).toBe(200);
    await tenant.reload();
    expect(tenant.status).toBe('active');
  });
});
