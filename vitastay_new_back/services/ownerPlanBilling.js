/**
 * BKG-016 — owner subscription money movement.
 * Seeker booking/rent stay on payment_orders.booking_id / rent_payment_id.
 * Owner plans use order_type=owner_plan + owner_invoice_id. No commission.
 */
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { sequelize, Hostel, OwnerSubscription, OwnerInvoice, PaymentOrder, User } = require('../models');
const { getGateway } = require('./paymentGateway');
const { recordEvent } = require('./rentPay');
const { generateInvoiceNumber } = require('../helpers/token');
const { createAuditLog } = require('../helpers/audit');
const logger = require('../config/logger');
const config = require('../config');
const {
  PLAN_CODES,
  PERIODS,
  PLAN_RANK,
  loadPlan,
  quote,
  listCatalog,
  hostelPlanPayload,
  entitlementsOf,
  planOf,
  statusOf,
  UNPUBLISH_DOWNGRADE_MESSAGE,
  httpError,
  round2,
} = require('./ownerPlan');

const ORDER_REUSE_MS = 25 * 60 * 1000;
const GRACE_DAYS = Math.max(1, parseInt(process.env.OWNER_PLAN_GRACE_DAYS, 10) || 7);

const periodEnd = (period, from = new Date()) => (
  period === 'year' ? dayjs(from).add(1, 'year').toDate() : dayjs(from).add(1, 'month').toDate()
);

const assertOwnerOf = (user, hostel) => {
  if (!user) httpError(401, 'Unauthorized');
  if (user.role === 'super_admin') return;
  if (user.role === 'owner' && Number(hostel.owner_id) === Number(user.id)) return;
  httpError(403, 'This hostel is not yours');
};

const formatCheckout = (order, invoice, hostel, gateway, owner) => {
  const amount = Number(order.amount);
  return {
    already_paid: false,
    gateway: gateway.name,
    sandbox: gateway.name === 'mock',
    key_id: gateway.publicKey(),
    order_id: order.gateway_order_id,
    amount,
    amount_paise: Math.round(amount * 100),
    currency: order.currency || 'INR',
    name: 'Vita Stay',
    description: `${hostel.name} · ${invoice.plan_code} ${invoice.period}`,
    invoice: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      plan: invoice.plan_code,
      period: invoice.period,
      amount_ex_gst: Number(invoice.amount_ex_gst),
      gst_pct: Number(invoice.gst_pct),
      gst_amount: Number(invoice.gst_amount),
      total: Number(invoice.total),
      status: invoice.status,
    },
    order_type: 'owner_plan',
    prefill: {
      name: `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim(),
      email: owner?.email || '',
      contact: owner?.phone || '',
    },
  };
};

const reuseOpenOrder = async (invoice, amount, provider) => PaymentOrder.findOne({
  where: {
    owner_invoice_id: invoice.id,
    order_type: 'owner_plan',
    provider,
    status: 'created',
    amount,
    created_at: { [Op.gte]: new Date(Date.now() - ORDER_REUSE_MS) },
  },
  order: [['id', 'DESC']],
});

const applyPlanToHostel = async (hostel, {
  plan,
  period,
  status,
  startsAt,
  expiresAt,
  graceEndsAt,
  transaction,
}) => {
  await hostel.update({
    plan,
    plan_period: period || hostel.plan_period,
    plan_status: status,
    plan_starts_at: startsAt || hostel.plan_starts_at,
    plan_expires_at: expiresAt,
    plan_grace_ends_at: graceEndsAt,
  }, { transaction });
};

const notifyOwner = async (hostel, { title, message, kind }) => {
  try {
    const { Notification } = require('../models');
    if (!hostel.owner_id) return;
    await Notification.create({
      user_id: hostel.owner_id,
      title,
      message,
      type: 'info',
      channel: 'in_app',
      data: { kind, entity_id: hostel.id },
    });
  } catch (err) {
    logger.warn(`Owner plan notify skipped: ${err.message}`);
  }
};

const notifyPlanOwner = async (hostel, { title, message, kind, template }) => {
  try {
    if (!hostel.owner_id) return;
    const { User } = require('../models');
    const owner = await User.findByPk(hostel.owner_id, {
      attributes: ['id', 'email', 'first_name', 'last_name'],
    });
    if (!owner) return;
    const name = `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email;
    const notify = require('./notifyService');
    await notify.notifyUser({
      userId: owner.id,
      email: owner.email,
      name,
      title,
      message,
      type: kind === 'owner_plan_lapsed' ? 'warning' : 'info',
      kind,
      entityId: hostel.id,
      template,
      vars: {
        hostel: hostel.name,
        plan: hostel.plan,
        graceDays: String(GRACE_DAYS),
      },
      hours: 20,
    });
  } catch (err) {
    logger.warn(`Owner plan email skipped: ${err.message}`);
  }
};

const createPayOrder = async ({ hostel, user, plan, period }) => {
  assertOwnerOf(user, hostel);
  const planRow = await loadPlan(plan);
  if (!planRow.is_active) httpError(422, 'This plan is not on sale');
  const priced = quote(planRow, period);
  if (!priced.checkout_open) {
    httpError(422, priced.message);
  }

  const owner = await User.findByPk(hostel.owner_id, {
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone'],
  });

  const existingInvoice = await OwnerInvoice.findOne({
    where: {
      hostel_id: hostel.id,
      plan_code: priced.plan,
      period: priced.period,
      status: 'pending',
      total: priced.total,
      created_at: { [Op.gte]: new Date(Date.now() - ORDER_REUSE_MS) },
    },
    order: [['id', 'DESC']],
  });

  let invoice = existingInvoice;
  let subscription = invoice?.subscription_id
    ? await OwnerSubscription.findByPk(invoice.subscription_id)
    : null;

  if (!invoice) {
    subscription = await OwnerSubscription.create({
      hostel_id: hostel.id,
      plan_code: priced.plan,
      period: priced.period,
      status: 'pending',
      amount_ex_gst: priced.amount_ex_gst,
      gst_pct: priced.gst_pct,
      gst_amount: priced.gst_amount,
      amount_inc_gst: priced.total,
      created_by: user.id,
    });
    invoice = await OwnerInvoice.create({
      hostel_id: hostel.id,
      subscription_id: subscription.id,
      invoice_number: generateInvoiceNumber('VS'),
      plan_code: priced.plan,
      period: priced.period,
      amount_ex_gst: priced.amount_ex_gst,
      gst_pct: priced.gst_pct,
      gst_amount: priced.gst_amount,
      total: priced.total,
      status: 'pending',
    });
  }

  const gateway = getGateway();
  const open = await reuseOpenOrder(invoice, priced.total, gateway.name);
  if (open) return formatCheckout(open, invoice, hostel, gateway, owner);

  const created = await gateway.createOrder({
    amountRupees: priced.total,
    receipt: invoice.invoice_number,
    notes: {
      order_type: 'owner_plan',
      hostel_id: String(hostel.id),
      invoice_id: String(invoice.id),
      plan: priced.plan,
    },
  });

  const order = await PaymentOrder.create({
    rent_payment_id: null,
    booking_id: null,
    tenant_id: null,
    hostel_id: hostel.id,
    owner_invoice_id: invoice.id,
    order_type: 'owner_plan',
    provider: gateway.name,
    gateway_order_id: created.id,
    amount: priced.total,
    currency: created.currency || 'INR',
    status: 'created',
  });
  await invoice.update({ payment_order_id: order.id });

  return formatCheckout(order, invoice, hostel, gateway, owner);
};

const capturePlanOrder = async ({
  gatewayOrderId,
  gatewayPaymentId,
  method,
  eventId,
  eventType,
  payload,
}) => {
  const t = await sequelize.transaction();
  try {
    const order = await PaymentOrder.findOne({
      where: { gateway_order_id: gatewayOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) {
      await t.rollback();
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }
    await recordEvent({
      provider: order.provider,
      eventId,
      eventType,
      payload,
      rentPaymentId: null,
    });
    if (order.status === 'paid') {
      await t.commit();
      return { duplicate: true, order };
    }
    if (order.order_type !== 'owner_plan' && !order.owner_invoice_id) {
      await t.rollback();
      const err = new Error('Not an owner-plan order');
      err.statusCode = 422;
      throw err;
    }

    const invoice = await OwnerInvoice.findByPk(order.owner_invoice_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!invoice) {
      await t.rollback();
      const err = new Error('Invoice not found');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const hostel = await Hostel.findByPk(invoice.hostel_id, { transaction: t, lock: t.LOCK.UPDATE });
    const currentEnd = hostel?.plan_expires_at ? new Date(hostel.plan_expires_at) : null;
    const stackFrom = hostel
      && hostel.plan === invoice.plan_code
      && ['active', 'grace', 'comp'].includes(String(hostel.plan_status || ''))
      && currentEnd
      && currentEnd > now
      ? currentEnd
      : now;
    const ends = periodEnd(invoice.period, stackFrom);
    const graceEnds = dayjs(ends).add(GRACE_DAYS, 'day').toDate();

    await order.update({
      status: 'paid',
      gateway_payment_id: gatewayPaymentId || order.gateway_payment_id,
      payment_method: method || order.payment_method,
    }, { transaction: t });
    await invoice.update({
      status: 'paid',
      paid_at: now,
      payment_order_id: order.id,
      period_start: dayjs(stackFrom).format('YYYY-MM-DD'),
      period_end: dayjs(ends).format('YYYY-MM-DD'),
    }, { transaction: t });
    if (invoice.subscription_id) {
      await OwnerSubscription.update(
        { status: 'cancelled' },
        {
          where: {
            hostel_id: invoice.hostel_id,
            status: { [Op.in]: ['active', 'grace'] },
            id: { [Op.ne]: invoice.subscription_id },
          },
          transaction: t,
        }
      );
      await OwnerSubscription.update({
        status: 'active',
        starts_at: stackFrom,
        expires_at: ends,
        grace_ends_at: graceEnds,
      }, { where: { id: invoice.subscription_id }, transaction: t });
    }
    await applyPlanToHostel(hostel, {
      plan: invoice.plan_code,
      period: invoice.period,
      status: 'active',
      startsAt: hostel.plan_starts_at || now,
      expiresAt: ends,
      graceEndsAt: graceEnds,
      transaction: t,
    });
    await t.commit();

    const { refreshListingProjection } = require('./listingProjection');
    await refreshListingProjection(hostel.id);
    notifyOwner(hostel, {
      title: stackFrom === now ? 'Plan paid' : 'Plan renewed',
      message: `${hostel.name} is on ${invoice.plan_code} until ${dayjs(ends).format('DD MMM YYYY')}. GST invoice ${invoice.invoice_number}.`,
      kind: 'owner_plan_paid',
    }).catch(() => {});
    return { duplicate: false, order, invoice };
  } catch (err) {
    if (!t.finished) await t.rollback();
    throw err;
  }
};

const failPlanOrder = async ({
  gatewayOrderId,
  gatewayPaymentId,
  eventId,
  eventType,
  payload,
}) => {
  const order = await PaymentOrder.findOne({ where: { gateway_order_id: gatewayOrderId } });
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }
  await recordEvent({
    provider: order.provider,
    eventId,
    eventType,
    payload,
    rentPaymentId: null,
  });
  if (order.status === 'paid') return { ignored: true };
  await order.update({
    status: 'failed',
    gateway_payment_id: gatewayPaymentId || order.gateway_payment_id,
  });
  if (order.owner_invoice_id) {
    await OwnerInvoice.update(
      { status: 'failed' },
      { where: { id: order.owner_invoice_id, status: 'pending' } }
    );
  }
  return { ignored: false };
};

const confirmPay = async ({ hostel, user, body }) => {
  assertOwnerOf(user, hostel);
  const gateway = getGateway();
  const orderId = body.gateway_order_id || body.razorpay_order_id;
  if (!orderId) httpError(422, 'gateway_order_id is required');
  const order = await PaymentOrder.findOne({ where: { gateway_order_id: orderId } });
  if (!order || Number(order.hostel_id) !== Number(hostel.id)) httpError(404, 'Order not found');
  if (order.order_type !== 'owner_plan') httpError(422, 'Not an owner-plan order');

  if (gateway.name !== 'mock') {
    const ok = gateway.verifyCheckout({
      orderId,
      paymentId: body.razorpay_payment_id || body.gateway_payment_id,
      signature: body.razorpay_signature || body.signature,
    });
    if (!ok) httpError(400, 'Invalid checkout signature');
  }

  return capturePlanOrder({
    gatewayOrderId: orderId,
    gatewayPaymentId: body.razorpay_payment_id || body.gateway_payment_id || `mock_${orderId}`,
    method: body.method || 'upi',
    eventId: `confirm_${orderId}`,
    eventType: 'order.paid',
    payload: body,
  });
};

const assignPlan = async ({ hostel, user, plan, period, reason, expiresAt, req }) => {
  if (user?.role !== 'super_admin') httpError(403, 'Forbidden');
  const trimmed = String(reason || '').trim();
  if (trimmed.length < 10) httpError(422, 'Reason must be at least 10 characters');
  const code = String(plan || '').toLowerCase();
  if (!PLAN_CODES.includes(code)) httpError(422, 'plan must be regular, silver, or gold');
  const per = period ? String(period).toLowerCase() : 'year';
  if (!PERIODS.includes(per)) httpError(422, 'period must be month or year');

  const rawUntil = expiresAt == null || expiresAt === ''
    ? ''
    : (expiresAt instanceof Date ? expiresAt.toISOString() : String(expiresAt).trim());
  const now = new Date();
  const ends = rawUntil ? dayjs(rawUntil) : dayjs(periodEnd(per, now));
  if (!ends.isValid()) httpError(422, 'comp_until must be a date');

  const expiresDate = ends.toDate();
  const graceEnds = ends.add(GRACE_DAYS, 'day').toDate();
  await applyPlanToHostel(hostel, {
    plan: code,
    period: per,
    status: 'comp',
    startsAt: now,
    expiresAt: expiresDate,
    graceEndsAt: graceEnds,
  });
  await OwnerSubscription.create({
    hostel_id: hostel.id,
    plan_code: code,
    period: per,
    status: 'comp',
    starts_at: now,
    expires_at: expiresDate,
    grace_ends_at: graceEnds,
    created_by: user.id,
    notes: trimmed,
  });
  await createAuditLog({
    userId: user.id,
    action: 'OWNER_PLAN_ASSIGN',
    entityType: 'hostel',
    entityId: hostel.id,
    newValues: {
      plan: code,
      period: per,
      reason: trimmed,
      expires_at: ends.format('YYYY-MM-DD'),
      comp_until: rawUntil || null,
    },
    req,
  });
  if (code === 'regular') {
    await lapseMarketplace(hostel, { reason: `Assigned Regular: ${trimmed}`, user, req });
  } else {
    const { refreshListingProjection } = require('./listingProjection');
    await refreshListingProjection(hostel.id);
  }
  await hostel.reload();
  notifyOwner(hostel, {
    title: 'Plan updated by Vita Stay',
    message: code === 'regular'
      ? `${hostel.name} is now Regular (ERP only). The listing is unpublished.`
      : `${hostel.name} is now ${code} (${per}) complimentary until ${ends.format('YYYY-MM-DD')}.`,
    kind: 'owner_plan_assigned',
  });
  return hostelPlanPayload(hostel, await listCatalog());
};

const expireOpenBookings = async (hostelId) => {
  const { Booking } = require('../models');
  const { releaseHold } = require('./bookingHold');
  const { processRefund } = require('./bookingRefund');
  const notify = require('./notifyService');
  const open = await Booking.findAll({
    where: {
      hostel_id: hostelId,
      status: { [Op.in]: ['held', 'requested', 'awaiting_approval'] },
    },
  });
  for (const row of open) {
    try {
      const paid = row.payment_status === 'paid' || row.payment_status === 'refunded';
      if (paid) {
        try {
          await processRefund({ booking: row, reason: 'owner_reject', actorId: null });
          await row.reload();
        } catch (err) {
          logger.warn(`Plan lapse refund ${row.id} skipped: ${err.message}`);
        }
      }
      await releaseHold(row);
      await row.update({
        status: paid ? 'rejected' : 'expired',
        reject_reason: paid ? 'Plan lapsed to Regular' : row.reject_reason,
        hold_expires_at: null,
      });
      if (paid) {
        notify.notifyBookingRejected(row).catch(() => {});
      } else {
        notify.notifyBookingHoldExpired(row).catch(() => {});
      }
    } catch (err) {
      logger.warn(`Plan lapse hold ${row.id} skipped: ${err.message}`);
    }
  }
};

const lapseMarketplace = async (hostel, { reason, user, req } = {}) => {
  const { unpublishListing } = require('./listingPublish');
  if (hostel.listing_published) {
    await unpublishListing({
      hostel,
      user: user || null,
      req,
      reason: reason || 'Plan lapsed to Regular',
      trigger: 'plan_lapse',
      clearOverride: false,
      requireUser: false,
    });
  } else {
    const { refreshListingProjection } = require('./listingProjection');
    await refreshListingProjection(hostel.id);
  }
  await expireOpenBookings(hostel.id);
};

const lapseToRegular = async (hostel, { reason } = {}) => {
  await applyPlanToHostel(hostel, {
    plan: 'regular',
    period: hostel.plan_period,
    status: 'lapsed',
    startsAt: hostel.plan_starts_at,
    expiresAt: hostel.plan_expires_at,
    graceEndsAt: hostel.plan_grace_ends_at,
  });
  await OwnerSubscription.update(
    { status: 'lapsed' },
    { where: { hostel_id: hostel.id, status: { [Op.in]: ['active', 'grace'] } } }
  );
  await lapseMarketplace(hostel, { reason: reason || 'Subscription lapsed to Regular' });
  await hostel.reload();
  await notifyPlanOwner(hostel, {
    title: 'Plan lapsed to Regular',
    message: `${hostel.name} is off public search. Occupancy and tenants are unchanged. Renew Silver or Gold to list again.`,
    kind: 'owner_plan_lapsed',
    template: 'ownerPlanLapsed',
  });
  return hostel;
};

const processPlanRenewals = async (now = new Date()) => {
  const due = await Hostel.findAll({
    where: {
      plan: { [Op.in]: ['silver', 'gold'] },
      plan_status: { [Op.in]: ['active', 'grace', 'comp'] },
      plan_expires_at: { [Op.ne]: null, [Op.lte]: now },
    },
  });
  let grace = 0;
  let lapsed = 0;
  for (const hostel of due) {
    const graceEnds = hostel.plan_grace_ends_at
      ? new Date(hostel.plan_grace_ends_at)
      : dayjs(hostel.plan_expires_at).add(GRACE_DAYS, 'day').toDate();
    if (now < graceEnds) {
      if (hostel.plan_status !== 'grace' || !hostel.plan_grace_ends_at) {
        await hostel.update({ plan_status: 'grace', plan_grace_ends_at: graceEnds });
        await OwnerSubscription.update(
          { status: 'grace' },
          { where: { hostel_id: hostel.id, status: { [Op.in]: ['active', 'comp'] } } }
        );
        await notifyPlanOwner(hostel, {
          title: 'Renew your plan',
          message: `${hostel.name} is in a ${GRACE_DAYS}-day grace. Renew Silver or Gold on Settings → Plan or this PG drops to Regular.`,
          kind: 'owner_plan_grace',
          template: 'ownerPlanGrace',
        });
        grace += 1;
      }
      continue;
    }
    await lapseToRegular(hostel, { reason: 'Subscription expired' });
    lapsed += 1;
  }
  return { scanned: due.length, grace, lapsed };
};

const truthy = (value) => value === true || value === 1 || value === '1' || value === 'true' || value === 'yes';

const changePlan = async ({ hostel, user, plan, period, confirmUnpublish, req }) => {
  assertOwnerOf(user, hostel);
  const target = String(plan || '').toLowerCase();
  if (!PLAN_CODES.includes(target)) httpError(422, 'plan must be regular, silver, or gold');
  const per = period ? String(period).toLowerCase() : (hostel.plan_period || 'month');
  if (!PERIODS.includes(per)) httpError(422, 'period must be month or year');

  const current = planOf(hostel);
  const currentRank = PLAN_RANK[current] ?? 0;
  const targetRank = PLAN_RANK[target] ?? 0;
  if (targetRank < currentRank) {
    const losesListing = target === 'regular' && Boolean(hostel.listing_published);
    if (losesListing && !truthy(confirmUnpublish)) {
      const err = new Error(UNPUBLISH_DOWNGRADE_MESSAGE);
      err.statusCode = 422;
      err.errors = { needs_confirm: true, unpublish: true };
      throw err;
    }

    const keepStatus = ['active', 'comp', 'grace'].includes(statusOf(hostel))
      ? statusOf(hostel)
      : 'active';
    await applyPlanToHostel(hostel, {
      plan: target,
      period: per,
      status: target === 'regular' ? 'active' : keepStatus,
      startsAt: hostel.plan_starts_at || new Date(),
      expiresAt: target === 'regular' ? null : hostel.plan_expires_at,
      graceEndsAt: target === 'regular' ? null : hostel.plan_grace_ends_at,
    });

    if (target === 'regular') {
      await OwnerSubscription.update(
        { status: 'cancelled' },
        { where: { hostel_id: hostel.id, status: { [Op.in]: ['active', 'grace', 'pending'] } } }
      );
      await lapseMarketplace(hostel, {
        reason: 'Owner downgraded to Regular',
        user,
        req,
      });
    } else {
      await OwnerSubscription.update(
        { plan_code: target, period: per },
        { where: { hostel_id: hostel.id, status: { [Op.in]: ['active', 'grace', 'comp'] } } }
      );
      const { refreshListingProjection } = require('./listingProjection');
      await refreshListingProjection(hostel.id);
    }

    await createAuditLog({
      userId: user.id,
      action: 'OWNER_PLAN_CHANGE',
      entityType: 'hostel',
      entityId: hostel.id,
      newValues: {
        from: current,
        plan: target,
        period: per,
        confirm_unpublish: Boolean(truthy(confirmUnpublish)),
      },
      req,
    });
    notifyOwner(hostel, {
      title: target === 'regular' ? 'Plan downgraded to Regular' : `Plan changed to ${target}`,
      message: target === 'regular'
        ? `${hostel.name} is off public search. Guests cannot book online until you upgrade to Silver or Gold.`
        : `${hostel.name} is now ${target}. Vita Eye is off; the listing stays online if it was published.`,
      kind: 'owner_plan_changed',
    }).catch(() => {});
    await hostel.reload();
    return { action: 'downgraded', ...(await getHostelPlan({ hostel, user })) };
  }

  const checkout = await createPayOrder({ hostel, user, plan: target, period: per });
  return { action: 'checkout', ...checkout };
};

const getHostelPlan = async ({ hostel, user }) => {
  assertOwnerOf(user, hostel);
  const catalog = await listCatalog({ activeOnly: user.role !== 'super_admin' });
  const invoices = await OwnerInvoice.findAll({
    where: { hostel_id: hostel.id },
    order: [['id', 'DESC']],
    limit: 12,
  });
  return {
    ...hostelPlanPayload(hostel, catalog),
    invoices: invoices.map((row) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      plan: row.plan_code,
      period: row.period,
      amount_ex_gst: Number(row.amount_ex_gst),
      gst_pct: Number(row.gst_pct),
      gst_amount: Number(row.gst_amount),
      total: Number(row.total),
      status: row.status,
      paid_at: row.paid_at,
      period_start: row.period_start,
      period_end: row.period_end,
    })),
  };
};

const updateCatalogPlan = async ({ user, code, body }) => {
  if (user?.role !== 'super_admin') httpError(403, 'Forbidden');
  const row = await loadPlan(code);
  const patch = {};
  const money = (key) => {
    if (body[key] === undefined) return;
    if (body[key] === null || body[key] === '') {
      patch[key] = null;
      return;
    }
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0) httpError(422, `${key} must be a non-negative number or empty`);
    patch[key] = round2(n);
  };
  money('monthly_inr');
  money('yearly_inr');
  money('yearly_discount_pct');
  if (patch.yearly_discount_pct != null && patch.yearly_discount_pct > 100) {
    httpError(422, 'yearly_discount_pct must be 0–100');
  }
  if (body.gst_pct !== undefined) {
    if (body.gst_pct === null || body.gst_pct === '') {
      patch.gst_pct = 18;
    } else {
      const n = Number(body.gst_pct);
      if (!Number.isFinite(n) || n < 0 || n > 100) httpError(422, 'gst_pct must be 0–100');
      patch.gst_pct = round2(n);
    }
  }
  if (body.is_active !== undefined) {
    const raw = body.is_active;
    patch.is_active = !(raw === false || raw === 0 || raw === '0' || raw === 'false');
  }
  if (body.name) patch.name = String(body.name).slice(0, 32);
  await row.update(patch);
  return row;
};

const startPlanLapseScheduler = () => {
  const TICK_MS = 10 * 60 * 1000;
  const run = () => processPlanRenewals().catch((err) => {
    logger.warn(`Owner plan lapse job skipped: ${err.message}`);
  });
  setTimeout(run, 12000).unref();
  setInterval(run, TICK_MS).unref();
};

module.exports = {
  GRACE_DAYS,
  startPlanLapseScheduler,
  createPayOrder,
  capturePlanOrder,
  failPlanOrder,
  confirmPay,
  assignPlan,
  lapseToRegular,
  processPlanRenewals,
  getHostelPlan,
  changePlan,
  updateCatalogPlan,
  entitlementsOf,
};
