/**
 * BKG-014 / TC-B-17 — email + in-app to seeker and owner on request,
 * confirm, reject, expire, refund. Templates include hostel, room, amount, support.
 */
const crypto = require('crypto');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { projectHostelAvailability } = require('../services/occupancyService');
const { refreshListingProjection } = require('../services/listingProjection');
const { expireHolds } = require('../services/bookingHold');
const { flush, resetQueue, setSender } = require('../services/mailQueue');
const mock = require('../services/gateways/mock');

const fx = () => global.__erp;
const emailOf = (n) => `commseeker${n}@test.vitastay.local`;
const isoDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const secret = () => process.env.PAYMENT_WEBHOOK_SECRET || 'test-webhook-secret';
const sign = (body) => crypto.createHmac('sha256', secret()).update(body).digest('hex');
const asData = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
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
  const phone = `987656${String(1000 + n).slice(-4)}`;
  await request(app).post('/api/public/auth/otp').send({ email, phone });
  const res = await request(app).post('/api/public/auth/register').send({
    email,
    phone,
    first_name: 'Comm',
    last_name: `Seeker${n}`,
    password: 'SeekerPass1',
    email_otp: await latestOtp(email, 'email_verify'),
    phone_otp: await latestOtp(email, 'phone_verify'),
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

const waitForKind = async (userId, kind, timeoutMs = 4000) => {
  const { Notification } = require('../models');
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const rows = await Notification.findAll({ where: { user_id: userId } });
    const hit = rows.find((row) => asData(row.data).kind === kind);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`no ${kind} notification for user ${userId}`);
};

const kindsOf = async (userId) => {
  const { Notification } = require('../models');
  const rows = await Notification.findAll({ where: { user_id: userId } });
  return rows.map((row) => asData(row.data).kind).filter(Boolean);
};

describe('BKG-014 booking status comms', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let sent;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Hostel, Room, Bed } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      security_deposit: 10000,
      contact_phone: '08012345678',
      contact_email: 'garden@test.vitastay.local',
      media_override_reason: 'BKG-014 comms tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    const extra = await Room.create({
      hostel_id: hostel.id,
      room_number: '401',
      floor: 4,
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
    sent = [];
    resetQueue();
    setSender(async (job) => {
      sent.push(job);
      return { success: true };
    });
    mock.refundsIssued.length = 0;
  });

  afterEach(async () => {
    resetQueue();
    setSender(async () => ({ success: true }));
  });

  const createHeld = async (n) => {
    const seeker = await registerSeeker(n);
    const created = await request(app)
      .post('/api/bookings')
      .set(auth(seeker.token))
      .send({ hostel_id: fx().hostel.id, room_type: 'double', move_in_date: isoDays(5) });
    expect(created.status).toBe(201);
    return { seeker, booking: created.body.data };
  };

  test('request emails + in-app both sides include hostel, room, amount, support', async () => {
    const { seeker, booking } = await createHeld(1);
    await waitForKind(seeker.user.id, 'booking_requested');
    await waitForKind(fx().owner.id, 'booking_requested');
    await flush();

    const seekerKinds = await kindsOf(seeker.user.id);
    const ownerKinds = await kindsOf(fx().owner.id);
    expect(seekerKinds).toContain('booking_requested');
    expect(ownerKinds).toContain('booking_requested');

    const inbox = await request(app)
      .get('/api/settings/notifications')
      .set(auth(seeker.token));
    expect(inbox.status).toBe(200);
    expect((inbox.body.data || []).some((row) => asData(row.data).kind === 'booking_requested')).toBe(true);

    const ownerMail = sent.find((job) => job.to === fx().owner.email && /New booking request/i.test(job.subject));
    const seekerMail = sent.find((job) => job.to === seeker.user.email && /received your request/i.test(job.subject));
    expect(ownerMail).toBeTruthy();
    expect(seekerMail).toBeTruthy();
    [ownerMail, seekerMail].forEach((job) => {
      expect(job.html).toContain('Test Garden Hostel');
      expect(job.html).toContain('Double');
      expect(job.html).toMatch(/₹18000/);
      expect(job.html).toContain('08012345678');
      expect(job.html).toContain('garden@test.vitastay.local');
      expect(job.html).toContain(booking.code);
    });
    expect(ownerMail.html).toContain('/booking-requests');
    expect(seekerMail.html).toContain('/account');
  });

  test('confirm notifies seeker and owner', async () => {
    const { seeker, booking } = await createHeld(2);
    await waitForKind(fx().owner.id, 'booking_requested');
    const confirmed = await request(app)
      .post(`/api/bookings/${booking.id}/confirm`)
      .set(auth(ownerToken));
    expect(confirmed.status).toBe(200);
    await waitForKind(seeker.user.id, 'booking_confirmed');
    await waitForKind(fx().owner.id, 'booking_confirmed');
    await flush();
    expect(sent.some((job) => job.to === seeker.user.email && /accepted/i.test(job.subject))).toBe(true);
    expect(sent.some((job) => job.to === fx().owner.email && /accepted/i.test(job.subject))).toBe(true);
  });

  test('reject notifies seeker and owner', async () => {
    const { seeker, booking } = await createHeld(3);
    await waitForKind(fx().owner.id, 'booking_requested');
    const rejected = await request(app)
      .post(`/api/bookings/${booking.id}/reject`)
      .set(auth(ownerToken))
      .send({ reason: 'Beds full this week' });
    expect(rejected.status).toBe(200);
    await waitForKind(seeker.user.id, 'booking_rejected');
    await waitForKind(fx().owner.id, 'booking_rejected');
    await flush();
    const seekerMail = sent.find((job) => job.to === seeker.user.email && /declined/i.test(job.subject));
    expect(seekerMail).toBeTruthy();
    expect(seekerMail.html).toContain('Beds full this week');
    expect(seekerMail.html).toContain('Support');
  });

  test('hold expiry notifies seeker and owner once', async () => {
    const { seeker, booking } = await createHeld(4);
    await waitForKind(seeker.user.id, 'booking_requested');
    const { Booking } = require('../models');
    const row = await Booking.findByPk(booking.id);
    await row.update({ hold_expires_at: new Date(Date.now() - 1000) });
    const first = await expireHolds();
    expect(first.expired).toBeGreaterThanOrEqual(1);
    await waitForKind(seeker.user.id, 'booking_hold_expired');
    await waitForKind(fx().owner.id, 'booking_hold_expired');
    const countKind = async (userId) => {
      const { Notification } = require('../models');
      const rows = await Notification.findAll({ where: { user_id: userId } });
      return rows.filter((row) => (
        asData(row.data).kind === 'booking_hold_expired'
        && Number(asData(row.data).entity_id) === Number(booking.id)
      )).length;
    };
    expect(await countKind(seeker.user.id)).toBe(1);
    expect(await countKind(fx().owner.id)).toBe(1);
    const second = await expireHolds();
    expect(second.expired).toBe(0);
    expect(await countKind(seeker.user.id)).toBe(1);
    expect(await countKind(fx().owner.id)).toBe(1);
    await flush();
    expect(sent.some((job) => job.to === seeker.user.email && /Hold ended/i.test(job.subject))).toBe(true);
    expect(sent.some((job) => job.to === fx().owner.email && /Hold ended/i.test(job.subject))).toBe(true);
  });

  test('refund emails seeker and owner with amount', async () => {
    const { seeker, booking } = await createHeld(5);
    await waitForKind(fx().owner.id, 'booking_requested');
    const pay = await request(app)
      .post(`/api/bookings/${booking.id}/pay`)
      .set(auth(seeker.token));
    expect(pay.status).toBe(200);
    const body = JSON.stringify({
      id: 'evt_comm_rfnd_5',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_comm_rfnd_5',
            order_id: pay.body.data.order_id,
            amount: 1800000,
            method: 'upi',
            status: 'captured',
          },
        },
      },
    });
    const hook = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sign(body))
      .send(body);
    expect(hook.status).toBe(200);
    const cancelled = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set(auth(seeker.token));
    expect(cancelled.status).toBe(200);
    await waitForKind(seeker.user.id, 'booking_refunded');
    await waitForKind(fx().owner.id, 'booking_refunded');
    await flush();
    const seekerMail = sent.find((job) => job.to === seeker.user.email && /Refund/i.test(job.subject));
    const ownerMail = sent.find((job) => job.to === fx().owner.email && /Refund/i.test(job.subject));
    expect(seekerMail).toBeTruthy();
    expect(ownerMail).toBeTruthy();
    expect(seekerMail.html).toMatch(/₹18000/);
    expect(ownerMail.html).toMatch(/₹18000/);
    expect(ownerMail.html).toMatch(/payout/i);
  });
});
