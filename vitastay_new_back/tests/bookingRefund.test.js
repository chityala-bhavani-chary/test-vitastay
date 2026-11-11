/**
 * BKG-013 / TC-B-07 — refunds on seeker cancel and owner reject after pay.
 * Idempotent by booking_id. Failed gateway does not occupy.
 */
const crypto = require('crypto');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { projectHostelAvailability } = require('../services/occupancyService');
const { refreshListingProjection } = require('../services/listingProjection');
const { quoteRefund, POLICY_VERSION, SEEKER_FULL_HOURS } = require('../services/bookingRefundPolicy');
const mock = require('../services/gateways/mock');

const fx = () => global.__erp;
const emailOf = (n) => `refundseeker${n}@test.vitastay.local`;
const isoDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
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
  const phone = `987653${String(1000 + n).slice(-4)}`;
  await request(app).post('/api/public/auth/otp').send({ email, phone });
  const res = await request(app).post('/api/public/auth/register').send({
    email,
    phone,
    first_name: 'Refund',
    last_name: `Seeker${n}`,
    password: 'SeekerPass1',
    email_otp: await latestOtp(email, 'email_verify'),
    phone_otp: await latestOtp(email, 'phone_verify'),
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

describe('BKG-013 booking refunds', () => {
  jest.setTimeout(60000);
  let ownerToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Hostel, Room, Bed } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      security_deposit: 10000,
      media_override_reason: 'BKG-013 refund tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    const extra = await Room.create({
      hostel_id: hostel.id,
      room_number: '301',
      floor: 3,
      room_type: 'double',
      sharing_type: 2,
      rent: 8000,
      status: 'vacant',
    });
    await Promise.all(['1', '2', '3', '4', '5', '6'].map((bed_number) => Bed.create({
      room_id: extra.id,
      bed_number,
      status: 'vacant',
    })));
    await refreshListingProjection(hostel.id);
    await projectHostelAvailability(hostel.id);
  });

  beforeEach(() => {
    mock.refundsIssued.length = 0;
  });

  const bookPayCapture = async (n, moveInDays = 1) => {
    const seeker = await registerSeeker(n);
    const created = await request(app)
      .post('/api/bookings')
      .set(auth(seeker.token))
      .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: isoDays(moveInDays) });
    expect(created.status).toBe(201);
    const pay = await request(app)
      .post(`/api/bookings/${created.body.data.id}/pay`)
      .set(auth(seeker.token));
    expect(pay.status).toBe(200);
    const paymentId = `pay_rfnd_${n}`;
    const hook = await postWebhook(capturedPayload(pay.body.data.order_id, paymentId, 1800000));
    expect(hook.status).toBe(200);
    return { seeker, booking: created.body.data, order: pay.body.data, paymentId };
  };

  test('public policy matches coded numbers', async () => {
    const res = await request(app).get('/api/public/refund-policy');
    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(POLICY_VERSION);
    expect(res.body.data.seeker_full_refund_hours).toBe(SEEKER_FULL_HOURS);
    expect(quoteRefund({
      booking: { amount_due: 8000, deposit_due: 10000, move_in_date: isoDays(1) },
      reason: 'seeker_cancel',
    }).kind).toBe('partial');
    expect(quoteRefund({
      booking: { amount_due: 8000, deposit_due: 10000, move_in_date: isoDays(5) },
      reason: 'seeker_cancel',
    }).kind).toBe('full');
    expect(quoteRefund({
      booking: { amount_due: 8000, deposit_due: 10000, move_in_date: isoDays(1) },
      reason: 'owner_reject',
    }).amount).toBe(18000);
  });

  test('unpaid cancel does not write a refund', async () => {
    const seeker = await registerSeeker(10);
    const created = await request(app)
      .post('/api/bookings')
      .set(auth(seeker.token))
      .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: isoDays(3) });
    expect(created.status).toBe(201);
    const res = await request(app)
      .post(`/api/bookings/${created.body.data.id}/cancel`)
      .set(auth(seeker.token));
    expect(res.status).toBe(200);
    const { BookingRefund, Bed } = require('../models');
    expect(await BookingRefund.count({ where: { booking_id: created.body.data.id } })).toBe(0);
    expect((await Bed.findByPk(created.body.data.bed_id)).status).toBe('vacant');
  });

  test('TC-B-07 owner reject after pay refunds in full and frees the bed', async () => {
    const { seeker, booking } = await bookPayCapture(1, 1);
    const res = await request(app)
      .post(`/api/bookings/${booking.id}/reject`)
      .set(auth(ownerToken))
      .send({ reason: 'No longer available this week' });
    expect(res.status).toBe(200);
    expect(res.body.data.payment_status).toBe('refunded');
    expect(res.body.data.refund.amount).toBe(18000);
    expect(res.body.data.refund.kind).toBe('full');
    expect(res.body.data.refund.status).toBe('processed');
    expect(mock.refundsIssued).toHaveLength(1);
    expect(mock.refundsIssued[0].amount).toBe(1800000);

    const { Booking, Bed, Tenant, BookingRefund, FinanceTransaction } = require('../models');
    const row = await Booking.findByPk(booking.id);
    expect(row.status).toBe('rejected');
    expect(row.payment_status).toBe('refunded');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('vacant');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
    expect(await BookingRefund.count({ where: { booking_id: booking.id } })).toBe(1);
    expect(await FinanceTransaction.count({
      where: { reference_type: 'booking_refund', category: 'booking_refund' },
    })).toBeGreaterThanOrEqual(1);
  });

  test('duplicate refund by booking id stays one row', async () => {
    const { seeker, booking } = await bookPayCapture(2, 5);
    const first = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set(auth(seeker.token));
    expect(first.status).toBe(200);
    const second = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set(auth(seeker.token));
    expect(second.status).toBe(422);

    const { BookingRefund, FinanceTransaction } = require('../models');
    expect(await BookingRefund.count({ where: { booking_id: booking.id } })).toBe(1);
    expect(await FinanceTransaction.count({
      where: { reference_type: 'booking_refund', reference_id: first.body.data.refund.id },
    })).toBe(1);
    expect(mock.refundsIssued).toHaveLength(1);
  });

  test('seeker cancel under 48h refunds deposit only', async () => {
    const { seeker, booking } = await bookPayCapture(3, 1);
    const res = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set(auth(seeker.token));
    expect(res.status).toBe(200);
    expect(res.body.data.refund.kind).toBe('partial');
    expect(res.body.data.refund.amount).toBe(10000);
    expect(res.body.data.refund.retained_amount).toBe(8000);
    expect(mock.refundsIssued[0].amount).toBe(1000000);
    const { Bed } = require('../models');
    expect((await Bed.findByPk(booking.bed_id)).status).toBe('vacant');
  });

  test('seeker cancel 48h+ refunds in full', async () => {
    const { seeker, booking } = await bookPayCapture(4, 5);
    const res = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set(auth(seeker.token));
    expect(res.status).toBe(200);
    expect(res.body.data.refund.kind).toBe('full');
    expect(res.body.data.refund.amount).toBe(18000);
    expect(res.body.data.payment_status).toBe('refunded');
  });

  test('confirm after refund is refused and does not occupy', async () => {
    const { seeker, booking } = await bookPayCapture(5, 5);
    await request(app).post(`/api/bookings/${booking.id}/cancel`).set(auth(seeker.token));
    const res = await request(app)
      .post(`/api/bookings/${booking.id}/confirm`)
      .set(auth(ownerToken));
    expect(res.status).toBe(422);
    const { Bed, Tenant } = require('../models');
    expect((await Bed.findByPk(booking.bed_id)).status).toBe('vacant');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(0);
  });
});
