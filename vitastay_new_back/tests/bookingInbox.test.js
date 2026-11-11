/**
 * BKG-008 / BKG-009 — owner confirm occupies via occupyBed; reject frees hold.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { projectHostelAvailability } = require('../services/occupancyService');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const emailOf = (n) => `inboxseeker${n}@test.vitastay.local`;
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

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
  const phone = `987654${String(1000 + n).slice(-4)}`;
  await request(app).post('/api/public/auth/otp').send({ email, phone });
  const res = await request(app).post('/api/public/auth/register').send({
    email,
    phone,
    first_name: 'Inbox',
    last_name: `Seeker${n}`,
    password: 'SeekerPass1',
    email_otp: await latestOtp(email, 'email_verify'),
    phone_otp: await latestOtp(email, 'phone_verify'),
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

const book = (token) => request(app)
  .post('/api/bookings')
  .set(auth(token))
  .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: tomorrow() });

describe('BKG-008 booking inbox', () => {
  let ownerToken;
  let seeker;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const hostel = await require('../models').Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      media_override_reason: 'BKG-008 inbox tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel.id);
    await projectHostelAvailability(hostel.id);
    seeker = await registerSeeker(1);
  });

  test('owner inbox lists held request; seeker cannot confirm', async () => {
    const created = await book(seeker.token);
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const inbox = await request(app).get('/api/bookings').set(auth(ownerToken));
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.some((row) => row.id === id)).toBe(true);
    expect(inbox.body.data.find((row) => row.id === id).seeker.email).toBe(seeker.user.email);

    const forbidden = await request(app).post(`/api/bookings/${id}/confirm`).set(auth(seeker.token));
    expect(forbidden.status).toBe(403);
  });

  test('reject without reason is 422; with reason frees the bed', async () => {
    const other = await registerSeeker(2);
    const created = await book(other.token);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const bedId = created.body.data.bed_id;

    const missing = await request(app)
      .post(`/api/bookings/${id}/reject`)
      .set(auth(ownerToken))
      .send({});
    expect(missing.status).toBe(422);

    const rejected = await request(app)
      .post(`/api/bookings/${id}/reject`)
      .set(auth(ownerToken))
      .send({ reason: 'Not a fit for this PG' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('rejected');
    expect(rejected.body.data.reject_reason).toMatch(/Not a fit/);
    expect((await require('../models').Bed.findByPk(bedId)).status).toBe('vacant');
  });

  test('confirm occupies with occupyBed, creates tenant and opening invoice', async () => {
    const other = await registerSeeker(3);
    const created = await book(other.token);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const bedId = created.body.data.bed_id;

    const confirmed = await request(app)
      .post(`/api/bookings/${id}/confirm`)
      .set(auth(ownerToken));
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('confirmed');
    expect(confirmed.body.data.erp_tenant_id).toBeTruthy();
    expect((await require('../models').Bed.findByPk(bedId)).status).toBe('occupied');

    const { Tenant, RentPayment, User } = require('../models');
    const tenant = await Tenant.findByPk(confirmed.body.data.erp_tenant_id);
    expect(tenant.user_id).toBe(other.user.id);
    expect(tenant.bed_id).toBe(bedId);
    expect(tenant.status).toBe('pending');
    const invoice = await RentPayment.findOne({ where: { tenant_id: tenant.id } });
    expect(invoice).toBeTruthy();
    expect(invoice.status).toBe('pending');
    expect(Number(invoice.total_amount)).toBeGreaterThan(0);
    expect((await User.findByPk(other.user.id)).role).toBe('tenant');

    const checkedIn = await request(app)
      .post(`/api/tenants/${tenant.id}/check-in`)
      .set(auth(ownerToken))
      .send({ hostel_id: fx().hostel.id });
    expect(checkedIn.status).toBe(200);
    await tenant.reload();
    expect(tenant.status).toBe('active');

    const again = await request(app).post(`/api/bookings/${id}/confirm`).set(auth(ownerToken));
    expect(again.status).toBe(422);
  });
});
