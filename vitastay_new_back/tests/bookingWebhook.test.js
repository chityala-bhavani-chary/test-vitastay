/**
 * BKG-012 / QA-005 webhook replay — unique provider_event_id, 200 on duplicate,
 * failed/cancelled payment releases hold and never occupies.
 */
const crypto = require('crypto');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { projectHostelAvailability } = require('../services/occupancyService');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const emailOf = (n) => `hookseeker${n}@test.vitastay.local`;
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const secret = () => process.env.PAYMENT_WEBHOOK_SECRET || 'test-webhook-secret';
const sign = (body) => crypto.createHmac('sha256', secret()).update(body).digest('hex');

const capturedPayload = (orderId, paymentId, amountPaise, eventId) => JSON.stringify({
  id: eventId || `evt_${paymentId}`,
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

const failedPayload = (orderId, paymentId, eventId) => JSON.stringify({
  id: eventId || `evt_fail_${paymentId}`,
  event: 'payment.failed',
  payload: {
    payment: {
      entity: {
        id: paymentId,
        order_id: orderId,
        status: 'failed',
        method: 'upi',
      },
    },
  },
});

const cancelledPayload = (orderId, eventId) => JSON.stringify({
  id: eventId || `evt_cancel_${orderId}`,
  event: 'order.cancelled',
  payload: {
    order: {
      entity: {
        id: orderId,
        status: 'cancelled',
      },
    },
  },
});

const postWebhook = (body) => request(app)
  .post('/api/payments/webhook')
  .set('Content-Type', 'application/json')
  .set('X-Razorpay-Signature', sign(body))
  .send(body);

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
  const phone = `987652${String(1000 + n).slice(-4)}`;
  await request(app).post('/api/public/auth/otp').send({ email, phone });
  const res = await request(app).post('/api/public/auth/register').send({
    email,
    phone,
    first_name: 'Hook',
    last_name: `Seeker${n}`,
    password: 'SeekerPass1',
    email_otp: await latestOtp(email, 'email_verify'),
    phone_otp: await latestOtp(email, 'phone_verify'),
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

describe('BKG-012 idempotent booking webhooks', () => {
  jest.setTimeout(60000);
  let ownerToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      security_deposit: 10000,
      media_override_reason: 'BKG-012 webhook tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel.id);
    const { Room, Bed } = require('../models');
    const extra = await Room.create({
      hostel_id: hostel.id,
      room_number: '201',
      floor: 2,
      room_type: 'double',
      sharing_type: 2,
      rent: 8000,
      status: 'vacant',
    });
    await Promise.all(
      ['1', '2', '3', '4', '5', '6'].map((bed_number) => Bed.create({
        room_id: extra.id,
        bed_number,
        status: 'vacant',
      }))
    );
    await projectHostelAvailability(hostel.id);
  });

  const bookAndPay = async (n) => {
    const seeker = await registerSeeker(n);
    const created = await request(app)
      .post('/api/bookings')
      .set(auth(seeker.token))
      .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: tomorrow() });
    expect(created.status).toBe(201);
    const pay = await request(app)
      .post(`/api/bookings/${created.body.data.id}/pay`)
      .set(auth(seeker.token));
    expect(pay.status).toBe(200);
    return { seeker, booking: created.body.data, order: pay.body.data };
  };

  test('TC-B-05 failed webhook releases hold and does not occupy', async () => {
    const { seeker, booking, order } = await bookAndPay(1);
    const body = failedPayload(order.order_id, 'pay_bkg012_fail');
    const res = await postWebhook(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { Booking, Bed, Tenant, PaymentEvent } = require('../models');
    const row = await Booking.findByPk(booking.id);
    expect(row.payment_status).toBe('failed');
    expect(row.status).toBe('cancelled');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('vacant');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
    expect(await PaymentEvent.count({ where: { provider_event_id: 'evt_fail_pay_bkg012_fail' } })).toBe(1);
  });

  test('replayed failed webhook returns 200 and does not occupy twice', async () => {
    const { seeker, booking, order } = await bookAndPay(2);
    const body = failedPayload(order.order_id, 'pay_bkg012_fail_replay', 'evt_fail_replay');
    const first = await postWebhook(body);
    const second = await postWebhook(body);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const { Booking, Bed, Tenant, PaymentEvent } = require('../models');
    expect(await PaymentEvent.count({ where: { provider_event_id: 'evt_fail_replay' } })).toBe(1);
    const row = await Booking.findByPk(booking.id);
    expect(row.status).toBe('cancelled');
    expect(row.payment_status).toBe('failed');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('vacant');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
  });

  test('order.cancelled webhook releases hold', async () => {
    const { seeker, booking, order } = await bookAndPay(3);
    const res = await postWebhook(cancelledPayload(order.order_id, 'evt_order_cancel'));
    expect(res.status).toBe(200);

    const { Booking, Bed, Tenant } = require('../models');
    const row = await Booking.findByPk(booking.id);
    expect(row.status).toBe('cancelled');
    expect(row.payment_status).toBe('failed');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('vacant');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
  });

  test('TC-B-06 duplicate captured webhook is 200 and never occupies', async () => {
    const { seeker, booking, order } = await bookAndPay(4);
    const body = capturedPayload(order.order_id, 'pay_bkg012_cap', 1800000, 'evt_cap_once');
    const first = await postWebhook(body);
    const second = await postWebhook(body);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const { Booking, Bed, Tenant, PaymentOrder, PaymentEvent } = require('../models');
    expect(await PaymentEvent.count({ where: { provider_event_id: 'evt_cap_once' } })).toBe(1);
    expect(await PaymentOrder.count({ where: { booking_id: booking.id, status: 'paid' } })).toBe(1);
    const row = await Booking.findByPk(booking.id);
    expect(row.payment_status).toBe('paid');
    expect(row.status).toBe('awaiting_approval');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('reserved');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
  });

  test('parallel replay of the same capture is still one paid order', async () => {
    const { seeker, booking, order } = await bookAndPay(5);
    const body = capturedPayload(order.order_id, 'pay_bkg012_par', 1800000, 'evt_cap_parallel');
    const results = await Promise.all([postWebhook(body), postWebhook(body), postWebhook(body)]);
    expect(results.every((row) => row.status === 200)).toBe(true);

    const { PaymentOrder, PaymentEvent, Booking, Bed, Tenant } = require('../models');
    expect(await PaymentEvent.count({ where: { provider_event_id: 'evt_cap_parallel' } })).toBe(1);
    expect(await PaymentOrder.count({ where: { booking_id: booking.id, status: 'paid' } })).toBe(1);
    const row = await Booking.findByPk(booking.id);
    expect(row.payment_status).toBe('paid');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('reserved');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
  });

  test('failed webhook after paid does not reverse or occupy', async () => {
    const { seeker, booking, order } = await bookAndPay(6);
    const cap = capturedPayload(order.order_id, 'pay_bkg012_paid', 1800000, 'evt_already_paid');
    expect((await postWebhook(cap)).status).toBe(200);
    const fail = failedPayload(order.order_id, 'pay_bkg012_late_fail', 'evt_late_fail');
    expect((await postWebhook(fail)).status).toBe(200);

    const { Booking, Bed, Tenant } = require('../models');
    const row = await Booking.findByPk(booking.id);
    expect(row.payment_status).toBe('paid');
    expect(row.status).toBe('awaiting_approval');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('reserved');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
  });

  test('unsigned webhook is 400 and does not change occupancy', async () => {
    const { booking, order } = await bookAndPay(7);
    const body = capturedPayload(order.order_id, 'pay_spoof', 1800000, 'evt_spoof');
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', 'not-a-signature')
      .send(body);
    expect(res.status).toBe(400);

    const { Booking, Bed } = require('../models');
    const row = await Booking.findByPk(booking.id);
    expect(row.payment_status).not.toBe('paid');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('reserved');
  });

  test('owner confirm after paid occupy still happens only once', async () => {
    const { seeker, booking, order } = await bookAndPay(8);
    const body = capturedPayload(order.order_id, 'pay_bkg012_confirm', 1800000, 'evt_confirm_once');
    await postWebhook(body);
    await postWebhook(body);

    const confirmed = await request(app)
      .post(`/api/bookings/${booking.id}/confirm`)
      .set(auth(ownerToken));
    expect(confirmed.status).toBe(200);

    const { Bed, Tenant } = require('../models');
    expect((await Bed.findByPk(booking.bed_id)).status).toBe('occupied');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(1);
  });
});
