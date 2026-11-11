/**
 * TC-E-21…24, 31 — rent/complaint email is queued, never awaited on SMTP.
 */
const dayjs = require('dayjs');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { flush, resetQueue, setSender } = require('../services/mailQueue');
const { sendDueRentNotices } = require('../services/notifyService');
const { generateInvoiceNumber, generateReceiptNumber } = require('../helpers/token');

const fx = () => global.__erp;

describe('TC-E outbound notifications', () => {
  let ownerToken;
  let tenantToken;
  let sent;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    tenantToken = await login(fx().tenantUser.email, PASSWORD);
  });

  beforeEach(() => {
    sent = [];
    resetQueue();
    setSender(async (job) => {
      sent.push(job);
      return { success: true };
    });
  });

  afterEach(async () => {
    resetQueue();
    setSender(async () => ({ success: true }));
  });

  test('TC-E-21 assign queues tenant + assignee email and writes in-app; HTTP does not wait on SMTP', async () => {
    const created = await request(app)
      .post('/api/complaints')
      .set(auth(tenantToken))
      .send({
        title: 'Notify assign leak',
        description: 'Drip',
        category: 'plumbing',
      });
    expect(created.status).toBe(201);

    let release;
    const barrier = new Promise((resolve) => {
      release = resolve;
    });
    setSender(async (job) => {
      sent.push(job);
      await barrier;
      return { success: true };
    });

    const t0 = Date.now();
    const assigned = await request(app)
      .post(`/api/complaints/${created.body.data.id}/assign`)
      .set(auth(ownerToken))
      .send({ assigned_to: fx().owner.id });
    const elapsed = Date.now() - t0;
    expect(assigned.status).toBe(200);
    expect(elapsed).toBeLessThan(3000);

    release();
    await flush();

    const subjects = sent.map((job) => job.subject);
    expect(subjects.some((s) => /Complaint assigned/i.test(s))).toBe(true);
    expect(sent.some((job) => job.to === fx().tenantUser.email)).toBe(true);
    expect(sent.some((job) => job.to === fx().owner.email)).toBe(true);

    const { Notification } = require('../models');
    const asData = (raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw) || {};
    const bells = await Notification.findAll({ where: { user_id: fx().tenantUser.id } });
    expect(bells.some((row) => asData(row.data).kind === 'complaint_assigned')).toBe(true);
  });

  test('TC-E-22 resolve emails the tenant', async () => {
    const created = await request(app)
      .post('/api/complaints')
      .set(auth(tenantToken))
      .send({
        title: 'Notify resolve leak',
        description: 'Drip',
        category: 'plumbing',
      });
    expect(created.status).toBe(201);

    const resolved = await request(app)
      .post(`/api/complaints/${created.body.data.id}/resolve`)
      .set(auth(ownerToken))
      .send({ resolution: 'Washer replaced' });
    expect(resolved.status).toBe(200);
    await flush();

    expect(sent.some((job) => job.to === fx().tenantUser.email && /resolved/i.test(job.subject))).toBe(true);
  });

  test('TC-E-23 owner notification settings are persisted and honoured', async () => {
    const save = await request(app)
      .put('/api/settings')
      .set(auth(ownerToken))
      .send({
        group: 'notifications',
        settings: {
          email_enabled: false,
          sms_enabled: false,
          rent_due_email: true,
          complaint_email: true,
          rent_reminder_days: 5,
          alert_email: 'ops@test.vitastay.local',
        },
      });
    expect(save.status).toBe(200);

    const listed = await request(app).get('/api/settings').set(auth(ownerToken));
    expect(listed.status).toBe(200);
    expect(listed.body.data.notifications.email_enabled).toBe('false');
    expect(listed.body.data.notifications.rent_reminder_days).toBe('5');

    const created = await request(app)
      .post('/api/complaints')
      .set(auth(tenantToken))
      .send({
        title: 'Settings honour leak',
        description: 'Drip',
        category: 'plumbing',
      });
    const assigned = await request(app)
      .post(`/api/complaints/${created.body.data.id}/assign`)
      .set(auth(ownerToken))
      .send({ assigned_to: fx().owner.id });
    expect(assigned.status).toBe(200);
    await flush();
    expect(sent).toHaveLength(0);

    await request(app)
      .put('/api/settings')
      .set(auth(ownerToken))
      .send({
        group: 'notifications',
        settings: {
          email_enabled: true,
          sms_enabled: false,
          rent_due_email: true,
          complaint_email: true,
          rent_reminder_days: 3,
          alert_email: '',
        },
      });
  });

  test('TC-E-24 rent due notice is queued once per invoice within the reminder window', async () => {
    const { RentPayment, Notification } = require('../models');
    const invoice = await RentPayment.create({
      tenant_id: fx().tenant.id,
      hostel_id: fx().hostel.id,
      amount: 1111,
      total_amount: 1111,
      paid_amount: 0,
      due_date: dayjs().format('YYYY-MM-DD'),
      status: 'pending',
      receipt_number: generateReceiptNumber(),
      invoice_number: generateInvoiceNumber(),
      month_year: dayjs().format('YYYY-MM'),
    });
    const far = await RentPayment.create({
      tenant_id: fx().tenant.id,
      hostel_id: fx().hostel.id,
      amount: 2222,
      total_amount: 2222,
      paid_amount: 0,
      due_date: dayjs().add(40, 'day').format('YYYY-MM-DD'),
      status: 'pending',
      receipt_number: generateReceiptNumber(),
      invoice_number: generateInvoiceNumber(),
      month_year: dayjs().add(40, 'day').format('YYYY-MM'),
    });

    const first = await sendDueRentNotices();
    await flush();
    expect(first).toBeGreaterThanOrEqual(1);
    expect(sent.some((job) => job.to === fx().tenantUser.email && /Rent due/i.test(job.subject))).toBe(true);
    expect(sent.some((job) => job.html && job.html.includes(invoice.invoice_number))).toBe(true);
    expect(sent.some((job) => job.html && job.html.includes(far.invoice_number))).toBe(false);

    sent.length = 0;
    const second = await sendDueRentNotices();
    await flush();
    expect(second).toBe(0);
    expect(sent).toHaveLength(0);

    const asData = (raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw) || {};
    const bells = await Notification.findAll({
      where: { user_id: fx().tenantUser.id, type: 'rent' },
    });
    const forInvoice = bells.filter((row) => Number(asData(row.data).entity_id) === Number(invoice.id));
    expect(forInvoice).toHaveLength(1);
  });

  test('TC-E-31 owner can send a test rent reminder to themselves', async () => {
    const res = await request(app)
      .post('/api/settings/notifications/test-reminder')
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.to).toBe(fx().owner.email);
    await flush();
    expect(sent.some((job) => job.to === fx().owner.email && /Rent due/i.test(job.subject))).toBe(true);

    const { Notification } = require('../models');
    const bells = await Notification.findAll({
      where: { user_id: fx().owner.id, type: 'rent' },
    });
    const asData = (raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw) || {};
    expect(bells.some((row) => asData(row.data).kind === 'rent_due_test')).toBe(true);

    const denied = await request(app)
      .post('/api/settings/notifications/test-reminder')
      .set(auth(tenantToken));
    expect(denied.status).toBe(403);
  });
});
