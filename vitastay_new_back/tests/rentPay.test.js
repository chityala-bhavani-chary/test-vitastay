/**
 * TC-E-17…20 — tenant self-pay (mock gateway) against nivas_hostel_test.
 */
const crypto = require('crypto');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;
const secret = () => process.env.PAYMENT_WEBHOOK_SECRET || 'test-webhook-secret';
const sign = (body) => crypto.createHmac('sha256', secret()).update(body).digest('hex');

const capturedPayload = (orderId, paymentId, amountPaise = 800000) => JSON.stringify({
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

describe('TC-E tenant self-pay', () => {
  let ownerToken;
  let tenantToken;
  let otherToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    tenantToken = await login(fx().tenantUser.email, PASSWORD);
    otherToken = await login(fx().otherTenantUser.email, PASSWORD);
  });

  test('TC-E-17 tenant creates a pay order for own unpaid invoice', async () => {
    const res = await request(app)
      .post(`/api/rent/${fx().pendingRent.id}/pay`)
      .set(auth(tenantToken));
    expect(res.status).toBe(200);
    expect(res.body.data.order_id).toMatch(/^order_mock_/);
    expect(res.body.data.sandbox).toBe(true);
    expect(res.body.data.amount).toBe(8000);
    fx().payOrder = res.body.data;
  });

  test('TC-E-17b tenant cannot pay another resident invoice', async () => {
    const otherInvoice = await require('../models').RentPayment.findOne({
      where: { tenant_id: fx().otherTenant.id },
    });
    const res = await request(app)
      .post(`/api/rent/${otherInvoice.id}/pay`)
      .set(auth(tenantToken));
    expect(res.status).toBe(403);
  });

  test('TC-E-17c staff collect stays owner-only; tenant collect is 403', async () => {
    const res = await request(app)
      .post(`/api/rent/${fx().pendingRent.id}/collect`)
      .set(auth(tenantToken))
      .send({ paid_amount: 8000, payment_method: 'upi' });
    expect(res.status).toBe(403);
  });

  test('TC-E-17d owner cannot use tenant /pay', async () => {
    const res = await request(app)
      .post(`/api/rent/${fx().pendingRent.id}/pay`)
      .set(auth(ownerToken));
    expect(res.status).toBe(403);
  });

  test('TC-E-18 webhook capture marks invoice paid with payment_reference', async () => {
    const orderId = fx().payOrder.order_id;
    const body = capturedPayload(orderId, 'pay_tc_e18', 800000);
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { RentPayment, FinanceTransaction } = require('../models');
    const invoice = await RentPayment.findByPk(fx().pendingRent.id);
    expect(invoice.status).toBe('paid');
    expect(invoice.payment_method).toBe('upi');
    expect(invoice.payment_reference).toBe('pay_tc_e18');
    expect(invoice.receipt_number).toBeTruthy();

    const txns = await FinanceTransaction.findAll({
      where: { reference_type: 'rent_payment', reference_id: invoice.id },
    });
    expect(txns).toHaveLength(1);
    expect(Number(txns[0].amount)).toBe(8000);
  });

  test('TC-E-19 duplicate webhook does not double-credit', async () => {
    const orderId = fx().payOrder.order_id;
    const body = capturedPayload(orderId, 'pay_tc_e18', 800000);
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);

    const { FinanceTransaction, RentPayment } = require('../models');
    const invoice = await RentPayment.findByPk(fx().pendingRent.id);
    expect(Number(invoice.paid_amount)).toBe(8000);
    const txns = await FinanceTransaction.findAll({
      where: { reference_type: 'rent_payment', reference_id: invoice.id },
    });
    expect(txns).toHaveLength(1);
  });

  test('TC-E-20 confirm on a second invoice is idempotent by invoice', async () => {
    const { RentPayment, FinanceTransaction } = require('../models');
    const { generateReceiptNumber, generateInvoiceNumber } = require('../helpers/token');
    const dayjs = require('dayjs');
    const invoice = await RentPayment.create({
      tenant_id: fx().tenant.id,
      hostel_id: fx().hostel.id,
      amount: 2500,
      total_amount: 2500,
      paid_amount: 0,
      due_date: dayjs().format('YYYY-MM-DD'),
      status: 'pending',
      receipt_number: generateReceiptNumber(),
      invoice_number: generateInvoiceNumber(),
      month_year: dayjs().format('YYYY-MM'),
    });

    const created = await request(app)
      .post(`/api/rent/${invoice.id}/pay`)
      .set(auth(tenantToken));
    expect(created.status).toBe(200);

    const first = await request(app)
      .post(`/api/rent/${invoice.id}/pay/confirm`)
      .set(auth(tenantToken))
      .send({ gateway_order_id: created.body.data.order_id, method: 'upi' });
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('paid');

    const second = await request(app)
      .post(`/api/rent/${invoice.id}/pay/confirm`)
      .set(auth(tenantToken))
      .send({ gateway_order_id: created.body.data.order_id, method: 'upi' });
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);

    const txns = await FinanceTransaction.findAll({
      where: { reference_type: 'rent_payment', reference_id: invoice.id },
    });
    expect(txns).toHaveLength(1);

    const other = await request(app)
      .post(`/api/rent/${invoice.id}/pay/confirm`)
      .set(auth(otherToken))
      .send({ gateway_order_id: created.body.data.order_id });
    expect(other.status).toBe(403);
  });
});
