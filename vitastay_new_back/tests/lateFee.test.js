/**
 * BIC-054 — automated late fee after grace + owner waive.
 */
const dayjs = require('dayjs');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const {
  applyLateFeesForDatabase,
  LATE_FEE_GRACE_DAYS,
} = require('../services/rentCycle');
const { generateInvoiceNumber, generateReceiptNumber } = require('../helpers/token');

const fx = () => global.__erp;

describe('BIC-054 late fee engine', () => {
  let ownerToken;
  let invoiceId;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Setting } = require('../models');
    await Setting.upsert({
      hostel_id: fx().hostel.id,
      group: 'general',
      key: 'late_fee_percent',
      value: '10',
      type: 'number',
    });
  });

  test('applies late fee once after grace and marks overdue', async () => {
    const { RentPayment } = require('../models');
    const { tenant, hostel, doubleRoom } = fx();
    const due = dayjs().subtract(LATE_FEE_GRACE_DAYS + 2, 'day').format('YYYY-MM-DD');
    const invoice = await RentPayment.create({
      tenant_id: tenant.id,
      hostel_id: hostel.id,
      room_id: doubleRoom.id,
      amount: 10000,
      total_amount: 10000,
      paid_amount: 0,
      penalty_amount: 0,
      due_date: due,
      month_year: dayjs(due).format('YYYY-MM'),
      status: 'pending',
      invoice_number: generateInvoiceNumber(),
      receipt_number: generateReceiptNumber(),
      notes: 'BIC-054 test rent',
    });
    invoiceId = invoice.id;

    const applied = await applyLateFeesForDatabase(require('../models'));
    expect(applied).toBeGreaterThanOrEqual(1);

    await invoice.reload();
    expect(invoice.status).toBe('overdue');
    expect(Number(invoice.penalty_amount)).toBe(1000);
    expect(Number(invoice.total_amount)).toBe(11000);
    expect(String(invoice.notes)).toMatch(/Late fee 10%/);

    await applyLateFeesForDatabase(require('../models'));
    await invoice.reload();
    expect(Number(invoice.penalty_amount)).toBe(1000);
  });

  test('owner can waive late fee', async () => {
    expect(invoiceId).toBeTruthy();
    const res = await request(app)
      .post(`/api/rent/${invoiceId}/waive-late-fee`)
      .set(auth(ownerToken))
      .send({ reason: 'First-month courtesy' });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.penalty_amount)).toBe(0);
    expect(Number(res.body.data.total_amount)).toBe(10000);
    expect(String(res.body.data.notes)).toMatch(/waived/i);
  });
});
