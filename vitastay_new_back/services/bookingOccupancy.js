/**
 * BKG-009 / DEC-04 — on owner confirm (or instant pay): ERP tenant + occupyBed + opening invoice.
 * Tenant stays `pending` until check-in (activate). Bed is occupied so inventory stays locked.
 * Walk-in bookBed still activates immediately (person is at the gate).
 */
const dayjs = require('dayjs');
const { generateReceiptNumber, generateInvoiceNumber } = require('../helpers/token');
const { getModelsForHostel } = require('../helpers/hostelContext');
const { occupyBed, projectHostelAvailability } = require('./occupancyService');
const { nextCycleAfter } = require('./rentCycle');

const httpError = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  throw err;
};

const openingCharge = async (ctx, {
  hostel, tenant, roomId, rent, deposit, moveIn, transaction, prepaid = null,
}) => {
  const rentAmount = Number(rent) || 0;
  const depositAmount = Number(deposit) || 0;
  const billTotal = rentAmount + depositAmount;
  if (billTotal <= 0 || !ctx.models.RentPayment) return null;
  const due = dayjs(moveIn || undefined);
  const prepaidAmount = prepaid && Number(prepaid.amount) > 0
    ? Math.min(Number(prepaid.amount), billTotal)
    : 0;
  const fullyPaid = prepaidAmount >= billTotal - 0.009;
  const status = fullyPaid ? 'paid' : (prepaidAmount > 0 ? 'partial' : 'pending');
  return ctx.models.RentPayment.create({
    tenant_id: tenant.id,
    hostel_id: hostel.id,
    room_id: roomId || tenant.room_id,
    amount: rentAmount,
    deposit_amount: depositAmount,
    total_amount: billTotal,
    paid_amount: prepaidAmount,
    due_date: due.format('YYYY-MM-DD'),
    month_year: due.format('YYYY-MM'),
    status,
    payment_method: prepaidAmount > 0 ? (prepaid.payment_method || 'online') : 'cash',
    payment_reference: prepaidAmount > 0 ? (prepaid.gateway_payment_id || prepaid.gateway_order_id || null) : null,
    invoice_number: generateInvoiceNumber(),
    receipt_number: generateReceiptNumber(),
    notes: prepaidAmount > 0
      ? `Booking confirm · prepaid ₹${prepaidAmount}${fullyPaid ? '' : ' of'} first month${depositAmount ? ' + deposit' : ''}`
      : `Booking confirm · first month${depositAmount ? ' + deposit' : ''}`,
  }, { transaction });
};

const fulfillConfirmedBooking = async ({ booking, actor }) => {
  if (!booking.bed_id) httpError(422, 'This booking has no held bed to occupy');
  const { User, Hostel } = require('../models');
  const hostel = await Hostel.findByPk(booking.hostel_id);
  if (!hostel) httpError(404, 'Listing not found');
  const seeker = await User.findByPk(booking.seeker_user_id);
  if (!seeker) httpError(404, 'Guest account not found');

  const ctx = await getModelsForHostel(hostel);
  const t = await ctx.sequelize.transaction();
  let tenant;
  let invoice = null;
  try {
    tenant = await ctx.models.Tenant.findOne({
      where: { user_id: seeker.id },
      transaction: t,
    });
    if (tenant && Number(tenant.hostel_id) !== Number(hostel.id)) {
      httpError(409, 'This guest is already a resident at another PG');
    }
    if (tenant?.bed_id && Number(tenant.bed_id) !== Number(booking.bed_id)) {
      httpError(409, 'This guest already has a bed');
    }

    const room = await ctx.models.Room.findByPk(booking.room_id || null, { transaction: t });
    const monthlyRent = Number(booking.amount_due) || Number(room?.rent) || 0;
    const deposit = Number(hostel.security_deposit) || 0;
    const moveIn = booking.move_in_date || dayjs().format('YYYY-MM-DD');
    const dueDay = dayjs(moveIn).date();

    if (!tenant) {
      tenant = await ctx.models.Tenant.create({
        user_id: seeker.id,
        hostel_id: hostel.id,
        full_name: `${seeker.first_name || ''} ${seeker.last_name || ''}`.trim() || seeker.email,
        monthly_rent: monthlyRent,
        deposit_amount: deposit,
        move_in_date: moveIn,
        rent_due_day: dueDay,
        next_rent_due_date: nextCycleAfter(moveIn, dueDay).format('YYYY-MM-DD'),
        status: 'pending',
      }, { transaction: t });
    } else {
      await tenant.update({
        monthly_rent: tenant.monthly_rent || monthlyRent,
        deposit_amount: tenant.deposit_amount || deposit,
        move_in_date: tenant.move_in_date || moveIn,
        status: 'pending',
      }, { transaction: t });
    }

    await occupyBed({
      ctx,
      bed: { id: booking.bed_id },
      tenant,
      userId: actor?.id || booking.seeker_user_id,
      transaction: t,
      allowReserved: true,
      tenantStatus: 'pending',
      notes: `Online booking ${booking.code}`,
    });
    await tenant.reload({ transaction: t });

    let prepaid = null;
    if (booking.payment_status === 'paid') {
      const { PaymentOrder } = require('../models');
      prepaid = await PaymentOrder.findOne({
        where: { booking_id: booking.id, status: 'paid' },
        order: [['id', 'DESC']],
      });
    }

    invoice = await openingCharge(ctx, {
      hostel,
      tenant,
      roomId: booking.room_id,
      rent: monthlyRent,
      deposit,
      moveIn,
      transaction: t,
      prepaid,
    });
    await t.commit();
  } catch (err) {
    try { await t.rollback(); } catch { /* already rolled back */ }
    if (err.statusCode === 400) err.statusCode = 409;
    throw err;
  }

  if (seeker.role === 'seeker') {
    await seeker.update({ role: 'tenant' });
  }

  await projectHostelAvailability(hostel);
  try {
    require('./occupancySnapshot').scheduleOccupancyRefresh(hostel.id);
  } catch { /* optional */ }

  return { tenant, invoice };
};

module.exports = { fulfillConfirmedBooking };
