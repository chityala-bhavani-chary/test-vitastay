/**
 * Tenant self-pay: create a gateway order for the remaining invoice balance,
 * then capture into the same applyCollection path staff collect uses.
 */
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { sequelize, RentPayment, PaymentOrder, PaymentEvent, Tenant, User, Hostel } = require('../models');
const logger = require('../config/logger');
const { getGateway } = require('./paymentGateway');
const { remainingOf, mapGatewayMethod, applyCollection, UNPAID_STATUSES } = require('./rentCollect');

const ORDER_REUSE_MS = 25 * 60 * 1000;

const loadInvoice = async (id, transaction) => RentPayment.findByPk(id, {
  include: [
    { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }] },
    { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
  ],
  transaction,
  lock: transaction ? transaction.LOCK.UPDATE : undefined,
});

const reuseOpenOrder = async (invoice, amount, provider) => {
  const open = await PaymentOrder.findOne({
    where: {
      rent_payment_id: invoice.id,
      provider,
      status: 'created',
      amount,
      created_at: { [Op.gte]: new Date(Date.now() - ORDER_REUSE_MS) },
    },
    order: [['id', 'DESC']],
  });
  return open;
};

const createPayOrder = async (invoice, tenantUser) => {
  const remaining = remainingOf(invoice);
  if (remaining <= 0.009 || !UNPAID_STATUSES.includes(invoice.status)) {
    return { already_paid: true, payment: invoice };
  }

  const gateway = getGateway();
  const existing = await reuseOpenOrder(invoice, remaining, gateway.name);
  if (existing) {
    return formatOrder(existing, invoice, gateway, tenantUser);
  }

  const created = await gateway.createOrder({
    amountRupees: remaining,
    receipt: invoice.invoice_number || `rent-${invoice.id}`,
    notes: {
      rent_payment_id: String(invoice.id),
      tenant_id: String(invoice.tenant_id),
      invoice: invoice.invoice_number || '',
    },
  });

  const order = await PaymentOrder.create({
    rent_payment_id: invoice.id,
    tenant_id: invoice.tenant_id,
    hostel_id: invoice.hostel_id,
    order_type: 'rent',
    provider: gateway.name,
    gateway_order_id: created.id,
    amount: remaining,
    currency: created.currency || 'INR',
    status: 'created',
  });

  return formatOrder(order, invoice, gateway, tenantUser);
};

const formatOrder = (order, invoice, gateway, tenantUser) => {
  const amountPaise = Math.round(Number(order.amount) * 100);
  const user = tenantUser || invoice.tenant?.user || {};
  return {
    already_paid: false,
    gateway: gateway.name,
    sandbox: gateway.name === 'mock',
    key_id: gateway.publicKey(),
    order_id: order.gateway_order_id,
    amount: Number(order.amount),
    amount_paise: amountPaise,
    currency: order.currency || 'INR',
    name: invoice.hostel?.name || 'Vita Stay',
    description: `Rent ${invoice.month_year} · ${invoice.invoice_number || `#${invoice.id}`}`,
    invoice: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      receipt_number: invoice.receipt_number,
      month_year: invoice.month_year,
      status: invoice.status,
      total_amount: Number(invoice.total_amount),
      paid_amount: Number(invoice.paid_amount),
      balance: remainingOf(invoice),
    },
    prefill: {
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      email: user.email || '',
      contact: user.phone || '',
    },
  };
};

const recordEvent = async ({ provider, eventId, eventType, rentPaymentId, payload, transaction }) => {
  if (!eventId) return { duplicate: false };
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  try {
    await PaymentEvent.create({
      provider,
      provider_event_id: String(eventId),
      event_type: eventType || null,
      rent_payment_id: rentPaymentId || null,
      payload: raw,
    }, { transaction });
    logger.info('payment webhook stored', {
      provider,
      provider_event_id: String(eventId),
      event_type: eventType || null,
    });
    return { duplicate: false };
  } catch (err) {
    const code = err.original?.code || err.parent?.code;
    const errno = Number(err.original?.errno || err.parent?.errno);
    const duplicate = err.name === 'SequelizeUniqueConstraintError'
      || code === 'ER_DUP_ENTRY'
      || errno === 1062
      || /Duplicate entry/i.test(err.message || '');
    if (duplicate) {
      logger.info('payment webhook duplicate', {
        provider,
        provider_event_id: String(eventId),
        event_type: eventType || null,
      });
      return { duplicate: true };
    }
    throw err;
  }
};

const captureOrder = async ({
  gatewayOrderId,
  gatewayPaymentId,
  method,
  eventId,
  eventType,
  payload,
  collectedBy,
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
      const err = new Error('Gateway order not found');
      err.statusCode = 404;
      throw err;
    }

    const recorded = await recordEvent({
      provider: order.provider,
      eventId: eventId || gatewayPaymentId,
      eventType,
      rentPaymentId: order.rent_payment_id,
      payload,
      transaction: t,
    });

    if (order.status === 'paid') {
      const payment = await RentPayment.findByPk(order.rent_payment_id, { transaction: t });
      await t.commit();
      return { payment, order, duplicate: true };
    }

    if (recorded.duplicate && order.status === 'paid') {
      const payment = await RentPayment.findByPk(order.rent_payment_id, { transaction: t });
      await t.commit();
      return { payment, order, duplicate: true };
    }

    let result;
    try {
      result = await applyCollection({
        paymentId: order.rent_payment_id,
        paidAmount: Number(order.amount),
        method: mapGatewayMethod(method),
        reference: gatewayPaymentId,
        collectedBy,
        paidDate: dayjs().format('YYYY-MM-DD'),
        transaction: t,
      });
    } catch (err) {
      if (err.statusCode === 400 && /exceeds/i.test(err.message)) {
        await order.update({ status: 'cancelled' }, { transaction: t });
        const payment = await RentPayment.findByPk(order.rent_payment_id, { transaction: t });
        await t.commit();
        return { payment, order, duplicate: false, alreadyPaid: true };
      }
      throw err;
    }

    const resolvedMethod = mapGatewayMethod(method);
    if (result.alreadyPaid && !result.duplicate) {
      await order.update({
        status: 'cancelled',
        gateway_payment_id: gatewayPaymentId || order.gateway_payment_id,
        payment_method: resolvedMethod,
      }, { transaction: t });
    } else {
      await order.update({
        status: 'paid',
        gateway_payment_id: gatewayPaymentId || order.gateway_payment_id,
        payment_method: resolvedMethod,
      }, { transaction: t });
    }

    await t.commit();
    return {
      payment: result.payment,
      order,
      duplicate: result.duplicate || recorded.duplicate,
      alreadyPaid: result.alreadyPaid,
    };
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

const failOrder = async ({
  gatewayOrderId,
  gatewayPaymentId,
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
      const err = new Error('Gateway order not found');
      err.statusCode = 404;
      throw err;
    }

    const recorded = await recordEvent({
      provider: order.provider,
      eventId: eventId || gatewayPaymentId,
      eventType,
      rentPaymentId: order.rent_payment_id,
      payload,
      transaction: t,
    });

    if (order.status === 'paid') {
      await t.commit();
      return { order, duplicate: recorded.duplicate, ignored: true };
    }
    if (order.status === 'created') {
      await order.update({
        status: 'failed',
        gateway_payment_id: gatewayPaymentId || order.gateway_payment_id,
      }, { transaction: t });
    }
    await t.commit();
    return { order, duplicate: recorded.duplicate };
  } catch (err) {
    try { await t.rollback(); } catch { /* already rolled back */ }
    throw err;
  }
};

module.exports = {
  loadInvoice,
  createPayOrder,
  captureOrder,
  failOrder,
  recordEvent,
};
