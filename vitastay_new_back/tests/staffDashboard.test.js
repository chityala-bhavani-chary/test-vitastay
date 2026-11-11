/**
 * TC-E-25…27 — staff home shows assigned jobs only.
 */
const dayjs = require('dayjs');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;

describe('TC-E staff dashboard', () => {
  let staffToken;
  let ownerToken;
  let mine;
  let other;
  let todayJob;
  let laterJob;

  beforeAll(async () => {
    staffToken = await login(fx().staffUser.email, PASSWORD);
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { Complaint, Maintenance, Notice } = require('../models');
    const today = dayjs().format('YYYY-MM-DD');

    mine = await Complaint.create({
      hostel_id: fx().hostel.id,
      tenant_id: fx().tenant.id,
      title: 'Staff job leak',
      description: 'Assigned to housekeeper',
      category: 'plumbing',
      status: 'assigned',
      assigned_to: fx().staffUser.id,
    });
    other = await Complaint.create({
      hostel_id: fx().hostel.id,
      tenant_id: fx().otherTenant.id,
      title: 'Owner-only leak',
      description: 'Not for staff',
      category: 'plumbing',
      status: 'open',
    });
    todayJob = await Maintenance.create({
      hostel_id: fx().hostel.id,
      title: 'Fix corridor light',
      description: 'Due today',
      type: 'electric',
      status: 'pending',
      scheduled_date: today,
      created_by: fx().owner.id,
      assigned_to: fx().staff.id,
    });
    laterJob = await Maintenance.create({
      hostel_id: fx().hostel.id,
      title: 'Next week paint',
      description: 'Not today',
      type: 'painting',
      status: 'scheduled',
      scheduled_date: dayjs().add(7, 'day').format('YYYY-MM-DD'),
      created_by: fx().owner.id,
      assigned_to: fx().staff.id,
    });
    await Notice.create({
      hostel_id: fx().hostel.id,
      title: 'Staff briefing',
      content: 'Mops in the store.',
      type: 'general',
      created_by: fx().owner.id,
    });
  });

  test('TC-E-25 staff dashboard lists assigned complaints, today’s maintenance, notices', async () => {
    const res = await request(app).get('/api/dashboard/staff').set(auth(staffToken));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.profile.staff.id).toBe(fx().staff.id);
    expect(data.complaints.some((row) => row.id === mine.id)).toBe(true);
    expect(data.complaints.some((row) => row.id === other.id)).toBe(false);
    expect(data.maintenance.some((row) => row.id === todayJob.id)).toBe(true);
    expect(data.maintenance.some((row) => row.id === laterJob.id)).toBe(false);
    expect(data.notices.some((row) => row.title === 'Staff briefing')).toBe(true);
  });

  test('TC-E-26 staff list APIs are scoped to assigned_to; owner still sees all', async () => {
    const staffList = await request(app).get('/api/complaints').set(auth(staffToken));
    expect(staffList.status).toBe(200);
    const staffRows = staffList.body.data || [];
    expect(staffRows.some((row) => row.id === mine.id)).toBe(true);
    expect(staffRows.some((row) => row.id === other.id)).toBe(false);

    const ownerList = await request(app).get('/api/complaints').set(auth(ownerToken));
    expect(ownerList.status).toBe(200);
    const ownerRows = ownerList.body.data || [];
    expect(ownerRows.some((row) => row.id === mine.id)).toBe(true);
    expect(ownerRows.some((row) => row.id === other.id)).toBe(true);

    const maint = await request(app).get('/api/maintenance').set(auth(staffToken));
    expect(maint.status).toBe(200);
    const maintRows = maint.body.data || [];
    expect(maintRows.every((row) => [fx().staff.id, fx().staffUser.id].includes(Number(row.assigned_to)))).toBe(true);

    const hidden = await request(app).get(`/api/complaints/${other.id}`).set(auth(staffToken));
    expect(hidden.status).toBe(403);
  });

  test('TC-E-27 staff cannot open owner dashboard or create maintenance', async () => {
    const dash = await request(app).get('/api/dashboard/owner').set(auth(staffToken));
    expect(dash.status).toBe(403);
    const create = await request(app)
      .post('/api/maintenance')
      .set(auth(staffToken))
      .send({
        hostel_id: fx().hostel.id,
        title: 'Should fail',
        description: 'Staff cannot create',
        type: 'other',
      });
    expect(create.status).toBe(403);
  });
});
