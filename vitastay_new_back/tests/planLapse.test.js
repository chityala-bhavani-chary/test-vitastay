/**
 * PKG-008 / TC-PKG-08 — grace then lapse to Regular.
 * Email owner before lapse. Refund paid open bookings (bkg-013 owner-reject/full).
 * Unpublish. Do not delete photos or tenants.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { processPlanRenewals } = require('../services/ownerPlanBilling');
const { refreshListingProjection } = require('../services/listingProjection');
const { quoteRefund } = require('../services/bookingRefundPolicy');

const fx = () => global.__erp;

describe('PKG-008 plan grace then lapse', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let hostel;
  let unpaid;
  let paid;
  let tenant;
  let media;
  let residentUser;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const {
      Hostel, Room, Bed, Booking, PaymentOrder, Tenant, PropertyMedia, User,
    } = require('../models');
    const { hashPassword } = require('../helpers/password');
    residentUser = await User.create({
      email: 'pkg008.resident@test.vitastay.local',
      password: await hashPassword(PASSWORD),
      first_name: 'Stay',
      last_name: 'Put',
      role: 'tenant',
      is_active: true,
      email_verified: true,
    });
    hostel = await Hostel.create({
      owner_id: fx().owner.id,
      name: 'Lapse Silver PG',
      code: 'LAPSESLV',
      address: '8 Lapse Lane',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      status: 'active',
      listing_published: true,
      plan: 'silver',
      plan_period: 'month',
      plan_status: 'active',
      plan_expires_at: new Date(Date.now() - 60 * 1000),
      plan_grace_ends_at: new Date(Date.now() + 60 * 60 * 1000),
    });
    const room = await Room.create({
      hostel_id: hostel.id,
      room_number: 'L1',
      floor: 1,
      room_type: 'single',
      sharing_type: 1,
      rent: 7000,
      status: 'vacant',
    });
    const bedHold = await Bed.create({ room_id: room.id, bed_number: '1', status: 'reserved' });
    const bedPaid = await Bed.create({ room_id: room.id, bed_number: '2', status: 'reserved' });
    tenant = await Tenant.create({
      user_id: residentUser.id,
      hostel_id: hostel.id,
      full_name: 'Stay Put',
      monthly_rent: 7000,
      status: 'active',
    });
    media = await PropertyMedia.create({
      hostel_id: hostel.id,
      category: 'exterior',
      capture_kind: 'photo',
      title: 'Gate',
      file_path: `hostels/${hostel.id}/gate.jpg`,
      mime_type: 'image/jpeg',
      file_size: 1200,
      uploaded_by: fx().owner.id,
    });
    unpaid = await Booking.create({
      code: 'BKG-LAPSE-UNPAID',
      seeker_user_id: fx().tenantUser.id,
      hostel_id: hostel.id,
      room_id: room.id,
      bed_id: bedHold.id,
      room_type: 'single',
      move_in_date: '2026-12-20',
      status: 'held',
      payment_status: 'none',
      listing_name: hostel.name,
      listing_code: hostel.code,
    });
    paid = await Booking.create({
      code: 'BKG-LAPSE-PAID',
      seeker_user_id: fx().otherTenantUser.id,
      hostel_id: hostel.id,
      room_id: room.id,
      bed_id: bedPaid.id,
      room_type: 'single',
      move_in_date: '2026-12-21',
      status: 'held',
      payment_status: 'paid',
      amount_due: 7000,
      deposit_due: 3000,
      listing_name: hostel.name,
      listing_code: hostel.code,
    });
    await PaymentOrder.create({
      booking_id: paid.id,
      hostel_id: hostel.id,
      order_type: 'booking',
      provider: 'mock',
      gateway_order_id: 'order_lapse_paid_1',
      gateway_payment_id: 'pay_lapse_paid_1',
      amount: 10000,
      status: 'paid',
    });
    await refreshListingProjection(hostel.id);
  });

  afterAll(async () => {
    const {
      ListingProjection, ListingAvailability, OccupancySnapshot, Booking, PaymentOrder,
      OwnerInvoice, OwnerSubscription, PropertyMedia, Tenant, Bed, Room, Hostel, User,
      BookingRefund, FinanceTransaction,
    } = require('../models');
    const id = hostel?.id;
    if (!id) return;
    await BookingRefund.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await FinanceTransaction.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await PaymentOrder.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await Booking.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await PropertyMedia.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await Tenant.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    const rooms = await Room.findAll({ where: { hostel_id: id } });
    await Bed.destroy({ where: { room_id: rooms.map((row) => row.id) }, force: true }).catch(() => {});
    await Room.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await OwnerInvoice.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await OwnerSubscription.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await ListingAvailability.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await OccupancySnapshot.destroy({ where: { hostel_id: id }, force: true }).catch(() => {});
    await ListingProjection.destroy({ where: { hostel_id: id } }).catch(() => {});
    await Hostel.destroy({ where: { id }, force: true }).catch(() => {});
    if (residentUser?.id) await User.destroy({ where: { id: residentUser.id }, force: true }).catch(() => {});
  });

  test('plan_lapse refunds the full paid amount (same as PG decline)', () => {
    const quote = quoteRefund({
      booking: { amount_due: 7000, deposit_due: 3000, move_in_date: '2026-12-21' },
      reason: 'plan_lapse',
    });
    expect(quote.kind).toBe('full');
    expect(quote.amount).toBe(10000);
  });

  test('expired paid-until enters grace, emails the owner, and stays on search', async () => {
    const first = await processPlanRenewals(new Date());
    expect(first.grace).toBeGreaterThanOrEqual(1);
    await hostel.reload();
    expect(hostel.plan).toBe('silver');
    expect(hostel.plan_status).toBe('grace');
    expect(hostel.listing_published).toBe(true);

    const { Notification } = require('../models');
    const notes = await Notification.findAll({
      where: { user_id: fx().owner.id },
      order: [['id', 'DESC']],
      limit: 12,
    });
    const kinds = notes.map((row) => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return data?.kind;
    });
    expect(kinds).toContain('owner_plan_grace');

    const search = await request(app).get('/api/public/listings').query({ city: 'Pune' });
    const ids = (search.body.data?.items || []).map((row) => row.id || row.hostel_id);
    expect(ids).toContain(hostel.id);
  });

  test('after grace: Regular, unpublished, unpaid hold expired, paid booking refunded, ERP kept', async () => {
    await hostel.update({ plan_grace_ends_at: new Date(Date.now() - 1000) });
    const second = await processPlanRenewals(new Date());
    expect(second.lapsed).toBeGreaterThanOrEqual(1);

    await hostel.reload();
    expect(hostel.plan).toBe('regular');
    expect(hostel.plan_status).toBe('lapsed');
    expect(hostel.listing_published).toBe(false);

    await unpaid.reload();
    expect(unpaid.status).toBe('expired');

    await paid.reload();
    expect(paid.payment_status).toBe('refunded');
    expect(paid.status).toBe('rejected');
    const { BookingRefund } = require('../models');
    const refund = await BookingRefund.findOne({ where: { booking_id: paid.id } });
    expect(refund).toBeTruthy();
    expect(refund.reason).toBe('owner_reject');
    expect(Number(refund.amount)).toBe(10000);

    await tenant.reload();
    expect(tenant.status).toBe('active');
    await media.reload();
    expect(media.file_path).toContain('gate.jpg');
    expect(media.deleted_at || media.deletedAt).toBeFalsy();

    const { Notification } = require('../models');
    const notes = await Notification.findAll({
      where: { user_id: fx().owner.id },
      order: [['id', 'DESC']],
      limit: 8,
    });
    const kinds = notes.map((row) => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return data?.kind;
    });
    expect(kinds).toContain('owner_plan_lapsed');

    await refreshListingProjection(hostel.id);
    const search = await request(app).get('/api/public/listings').query({ city: 'Pune' });
    const ids = (search.body.data?.items || []).map((row) => row.id || row.hostel_id);
    expect(ids).not.toContain(hostel.id);

    const me = await request(app).get(`/api/hostels/${hostel.id}/plan`).set(auth(ownerToken));
    expect(me.status).toBe(200);
    expect(me.body.data.plan).toBe('regular');
    expect(me.body.data.plan_status).toBe('lapsed');
  });
});
