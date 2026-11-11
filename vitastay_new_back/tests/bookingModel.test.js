/**
 * DEC-01 — per-PG booking model. Default approval_first does not occupy on pay.
 * Instant occupy-on-pay. request_advance charges a percent and still waits for Confirm.
 */
const crypto = require('crypto');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { projectHostelAvailability } = require('../services/occupancyService');
const { refreshListingProjection } = require('../services/listingProjection');
const {
  checkoutAmount,
  publicMeta,
  normalizeModel,
  DEFAULT_MODEL,
} = require('../services/bookingModel');

const fx = () => global.__erp;
const emailOf = (n) => `modelseeker${n}@test.vitastay.local`;
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
  const phone = `987659${String(1000 + n).slice(-4)}`;
  await request(app).post('/api/public/auth/otp').send({ email, phone });
  const res = await request(app).post('/api/public/auth/register').send({
    email,
    phone,
    first_name: 'Model',
    last_name: `Seeker${n}`,
    password: 'SeekerPass1',
    email_otp: await latestOtp(email, 'email_verify'),
    phone_otp: await latestOtp(email, 'phone_verify'),
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

const publishHostel = async (hostel) => {
  await hostel.update({
    listing_published: true,
    status: 'active',
    plan: 'silver',
    plan_status: 'comp',
    security_deposit: 10000,
    media_override_reason: 'DEC-01 booking model tests',
    media_override_by: fx().superAdmin.id,
    media_override_at: new Date(),
  });
  await refreshListingProjection(hostel.id);
  await projectHostelAvailability(hostel.id);
  return hostel.reload();
};

const makeListedHostel = async ({ code, name, model, advancePercent }) => {
  const { Hostel, Room, Bed } = require('../models');
  const hostel = await Hostel.create({
    owner_id: fx().owner.id,
    name,
    code,
    address: '9 Model Lane',
    city: 'Bangalore',
    area: 'Model Nagar',
    state: 'Karnataka',
    pincode: '560099',
    status: 'active',
    plan: 'silver',
    plan_status: 'comp',
    booking_model: model,
    advance_percent: advancePercent == null ? 20 : advancePercent,
    security_deposit: 10000,
    database_name: null,
  });
  const room = await Room.create({
    hostel_id: hostel.id,
    room_number: '201',
    floor: 1,
    room_type: 'double',
    sharing_type: 2,
    rent: 8000,
    status: 'vacant',
  });
  await Bed.create({ room_id: room.id, bed_number: '1', status: 'vacant' });
  await Bed.create({ room_id: room.id, bed_number: '2', status: 'vacant' });
  return publishHostel(hostel);
};

const capture = async (orderId, paymentId, amountPaise) => {
  const body = capturedPayload(orderId, paymentId, amountPaise);
  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', sign(body))
    .send(body);
  expect(res.status).toBe(200);
};

describe('DEC-01 booking models', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let instantHostel;
  let advanceHostel;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    instantHostel = await makeListedHostel({
      code: 'D01INST',
      name: 'DEC01 Instant PG',
      model: 'approval_first',
    });
    advanceHostel = await makeListedHostel({
      code: 'D01ADV',
      name: 'DEC01 Advance PG',
      model: 'request_advance',
      advancePercent: 20,
    });
  });

  test('checkout amount is full on default and instant, percent on request_advance', () => {
    expect(normalizeModel(null)).toBe(DEFAULT_MODEL);
    expect(checkoutAmount({ rent: 8000, deposit: 10000, model: 'approval_first' })).toBe(18000);
    expect(checkoutAmount({ rent: 8000, deposit: 10000, model: 'instant' })).toBe(18000);
    expect(checkoutAmount({ rent: 8000, deposit: 10000, model: 'request_advance', advancePercent: 20 })).toBe(3600);
    expect(publicMeta({ booking_model: 'instant' }).booking_badge).toBe('Instant book');
    expect(publicMeta({}).booking_badge).toBe('Request to book');
  });

  test('search and listing show Request to book until the owner switches the model', async () => {
    const listing = await request(app).get(`/api/public/listings/${instantHostel.code}`);
    expect(listing.status).toBe(200);
    expect(listing.body.data.hostel.booking_model).toBe('approval_first');
    expect(listing.body.data.hostel.booking_badge).toBe('Request to book');
    expect(listing.body.data.hostel.booking_hint).toMatch(/still has to confirm/i);

    const search = await request(app).get('/api/public/listings').query({ q: 'DEC01 Instant' });
    expect(search.status).toBe(200);
    const card = (search.body.data.items || search.body.data || []).find(
      (row) => row.code === 'D01INST' || row.name === 'DEC01 Instant PG'
    );
    expect(card).toMatchObject({
      booking_model: 'approval_first',
      booking_badge: 'Request to book',
    });
  });

  test('owner can set instant; listing badge flips; pay occupies', async () => {
    const put = await request(app)
      .put(`/api/hostels/${instantHostel.id}`)
      .set(auth(ownerToken))
      .send({ booking_model: 'instant' });
    expect(put.status).toBe(200);
    expect(put.body.data.booking_model).toBe('instant');
    await refreshListingProjection(instantHostel.id);

    const listing = await request(app).get(`/api/public/listings/${instantHostel.code}`);
    expect(listing.body.data.hostel.booking_badge).toBe('Instant book');

    const seeker = await registerSeeker(1);
    const created = await request(app)
      .post('/api/bookings')
      .set(auth(seeker.token))
      .send({ hostel_id: instantHostel.id, room_type: 'double', move_in_date: tomorrow() });
    expect(created.status).toBe(201);
    expect(created.body.data.booking_model).toBe('instant');
    expect(created.body.data.amount_payable).toBe(18000);
    expect(created.body.data.booking_badge).toBe('Instant book');

    const pay = await request(app)
      .post(`/api/bookings/${created.body.data.id}/pay`)
      .set(auth(seeker.token));
    expect(pay.status).toBe(200);
    expect(pay.body.data.amount).toBe(18000);

    await capture(pay.body.data.order_id, 'pay_dec01_instant', 1800000);

    const { Booking, Bed, Tenant, RentPayment } = require('../models');
    const row = await Booking.findByPk(created.body.data.id);
    expect(row.payment_status).toBe('paid');
    expect(row.status).toBe('confirmed');
    expect(row.erp_tenant_id).toBeTruthy();
    expect((await Bed.findByPk(row.bed_id)).status).toBe('occupied');
    expect(await Tenant.count({ where: { user_id: seeker.user.id } })).toBe(1);
    const tenant = await Tenant.findByPk(row.erp_tenant_id);
    expect(tenant.status).toBe('pending');
    const invoice = await RentPayment.findOne({ where: { tenant_id: row.erp_tenant_id } });
    expect(invoice.status).toBe('paid');
    expect(Number(invoice.paid_amount)).toBe(18000);
  });

  test('request_advance charges 20% and Confirm still occupies with a partial opening invoice', async () => {
    const put = await request(app)
      .put(`/api/hostels/${advanceHostel.id}`)
      .set(auth(ownerToken))
      .send({ booking_model: 'request_advance', advance_percent: 20 });
    expect(put.status).toBe(200);
    expect(put.body.data.booking_model).toBe('request_advance');
    expect(Number(put.body.data.advance_percent)).toBe(20);
    await refreshListingProjection(advanceHostel.id);

    const listing = await request(app).get(`/api/public/listings/${advanceHostel.code}`);
    expect(listing.body.data.hostel.booking_badge).toBe('Hold with advance');
    expect(listing.body.data.hostel.advance_percent).toBe(20);

    const seeker = await registerSeeker(2);
    const created = await request(app)
      .post('/api/bookings')
      .set(auth(seeker.token))
      .send({ hostel_id: advanceHostel.id, room_type: 'double', move_in_date: tomorrow() });
    expect(created.status).toBe(201);
    expect(created.body.data.booking_model).toBe('request_advance');
    expect(created.body.data.amount_payable).toBe(3600);
    expect(created.body.data.amount_total).toBe(18000);

    const pay = await request(app)
      .post(`/api/bookings/${created.body.data.id}/pay`)
      .set(auth(seeker.token));
    expect(pay.status).toBe(200);
    expect(pay.body.data.amount).toBe(3600);

    await capture(pay.body.data.order_id, 'pay_dec01_advance', 360000);

    const { Booking, Bed, RentPayment } = require('../models');
    const row = await Booking.findByPk(created.body.data.id);
    expect(row.payment_status).toBe('paid');
    expect(row.status).toBe('awaiting_approval');
    expect((await Bed.findByPk(row.bed_id)).status).toBe('reserved');

    const confirmed = await request(app)
      .post(`/api/bookings/${row.id}/confirm`)
      .set(auth(ownerToken));
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('confirmed');
    await row.reload();
    expect((await Bed.findByPk(row.bed_id)).status).toBe('occupied');
    const invoice = await RentPayment.findOne({ where: { tenant_id: row.erp_tenant_id } });
    expect(invoice.status).toBe('partial');
    expect(Number(invoice.total_amount)).toBe(18000);
    expect(Number(invoice.paid_amount)).toBe(3600);
  });
});
