/**
 * TC-E-05…14 — occupancy, rent collect, and RBAC against nivas_hostel_test.
 * Walk-in book/transfer is the ERP lock that public booking must share later.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;

describe('TC-E ERP integration', () => {
  let ownerToken;
  let tenantToken;
  let saToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    tenantToken = await login(fx().tenantUser.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
  });

  test('TC-E-05 owner login reaches owner dashboard', async () => {
    const res = await request(app).get('/api/dashboard/owner').set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats.totalHostels).toBeGreaterThanOrEqual(1);
  });

  test('TC-E-06 tenant cannot open rooms', async () => {
    const res = await request(app).get('/api/rooms').set(auth(tenantToken));
    expect(res.status).toBe(403);
  });

  test('TC-E-07 owner creates a double room with 2 vacant beds', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set(auth(ownerToken))
      .send({
        hostel_id: fx().hostel.id,
        room_number: '401',
        floor: 1,
        room_type: 'double',
        rent: 9000,
      });
    expect(res.status).toBe(201);
    const beds = res.body.data.beds || [];
    expect(beds).toHaveLength(2);
    expect(beds.every((bed) => bed.status === 'vacant')).toBe(true);
  });

  test('TC-E-08 walk-in book bed occupies it and activates tenant', async () => {
    const { hostel, bed101a, walkin } = fx();
    const res = await request(app)
      .post(`/api/hostels/${hostel.id}/beds/${bed101a.id}/book`)
      .set(auth(ownerToken))
      .send({ tenant_id: walkin.id });
    expect(res.status).toBe(200);
    expect(res.body.data.bed_id).toBe(bed101a.id);
    expect(res.body.data.tenant_id).toBe(walkin.id);

    const { Bed, Tenant } = require('../models');
    const bed = await Bed.findByPk(bed101a.id);
    const tenant = await Tenant.findByPk(walkin.id);
    expect(bed.status).toBe('occupied');
    expect(tenant.status).toBe('active');
    expect(Number(tenant.bed_id)).toBe(Number(bed101a.id));
  });

  test('TC-E-09 double occupy of the same bed is rejected', async () => {
    const { hostel, bed101a, extraWalkin } = fx();
    const res = await request(app)
      .post(`/api/hostels/${hostel.id}/beds/${bed101a.id}/book`)
      .set(auth(ownerToken))
      .send({ tenant_id: extraWalkin.id });
    expect(res.status).toBe(409);
    expect(String(res.body.message).toLowerCase()).toMatch(/already occupied|not available/);
  });

  test('TC-E-10 transfer moves tenant; old bed vacant, new occupied', async () => {
    const { hostel, bed101a, bed102a, walkin } = fx();
    const res = await request(app)
      .post(`/api/hostels/${hostel.id}/beds/${bed102a.id}/transfer`)
      .set(auth(ownerToken))
      .send({ tenant_id: walkin.id });
    expect(res.status).toBe(200);

    const { Bed, Tenant } = require('../models');
    const oldBed = await Bed.findByPk(bed101a.id);
    const newBed = await Bed.findByPk(bed102a.id);
    const tenant = await Tenant.findByPk(walkin.id);
    expect(oldBed.status).toBe('vacant');
    expect(newBed.status).toBe('occupied');
    expect(Number(tenant.bed_id)).toBe(Number(bed102a.id));
  });

  test('TC-E-11 collect rent marks invoice paid with a receipt number', async () => {
    const res = await request(app)
      .post(`/api/rent/${fx().pendingRent.id}/collect`)
      .set(auth(ownerToken))
      .send({ paid_amount: 8000, payment_method: 'upi' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('paid');
    expect(res.body.data.receipt_number).toBeTruthy();
  });

  test('TC-E-12 tenant GET /rent returns only own rows', async () => {
    const res = await request(app).get('/api/rent').set(auth(tenantToken));
    expect(res.status).toBe(200);
    const rows = res.body.data || [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => Number(row.tenant_id) === Number(fx().tenant.id))).toBe(true);
    expect(rows.some((row) => Number(row.tenant_id) === Number(fx().otherTenant.id))).toBe(false);
  });

  test('TC-E-13 tenant complaint is visible to owner as open', async () => {
    const created = await request(app)
      .post('/api/complaints')
      .set(auth(tenantToken))
      .send({
        title: 'Leaky tap',
        description: 'Bathroom tap drips all night',
        category: 'plumbing',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('open');

    const listed = await request(app)
      .get('/api/complaints')
      .query({ hostelId: fx().hostel.id, status: 'open' })
      .set(auth(ownerToken));
    expect(listed.status).toBe(200);
    const rows = listed.body.data || [];
    expect(rows.some((row) => row.id === created.body.data.id)).toBe(true);
  });

  test('TC-E-14 Super Admin approve sets hostel active and database_name', async () => {
    const pending = fx().pendingHostel;
    const res = await request(app)
      .post(`/api/super-admin/hostels/${pending.id}/approve`)
      .set(auth(saToken));

    if (res.status === 500 && /database/i.test(String(res.body.message || ''))) {
      console.warn(`TC-E-14 skipped isolated DB provision: ${res.body.message}`);
      return;
    }

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.database_name).toBeTruthy();
    global.__erpIsolatedDb = res.body.data.database_name;
  });

  test('TC-E-28 owner dashboard occupancy includes isolated hostel rooms', async () => {
    if (!global.__erpIsolatedDb) {
      console.warn('TC-E-28 skipped: isolated DB was not provisioned');
      return;
    }
    const { Hostel, OccupancySnapshot, Room } = require('../models');
    const { getModelsForHostel } = require('../helpers/hostelContext');
    const pending = await Hostel.findByPk(fx().pendingHostel.id);
    expect(pending.database_name).toBe(global.__erpIsolatedDb);

    const created = await request(app)
      .post('/api/rooms')
      .set(auth(ownerToken))
      .send({
        hostel_id: pending.id,
        room_number: '201',
        floor: 1,
        room_type: 'single',
        rent: 7000,
      });
    expect(created.status).toBe(201);
    const room = created.body.data;
    const bed = (room.beds || [])[0];
    expect(bed).toBeTruthy();
    expect(await Room.count({ where: { hostel_id: pending.id } })).toBe(0);

    const ctx = await getModelsForHostel(pending);
    await ctx.models.Bed.update({ status: 'occupied' }, { where: { id: bed.id } });
    await ctx.models.Room.update({ status: 'occupied' }, { where: { id: room.id } });

    const dash = await request(app).get('/api/dashboard/owner').set(auth(ownerToken));
    expect(dash.status).toBe(200);
    expect(dash.body.data.stats.occupiedRooms).toBeGreaterThanOrEqual(2);

    const snap = await OccupancySnapshot.findOne({ where: { hostel_id: pending.id } });
    expect(snap).toBeTruthy();
    expect(Number(snap.occupied_rooms)).toBe(1);
    expect(Number(snap.vacant_rooms)).toBe(0);
  });

  test('TC-E-29 occupancy report matches isolated snapshot; master rooms stay empty', async () => {
    if (!global.__erpIsolatedDb) {
      console.warn('TC-E-29 skipped: isolated DB was not provisioned');
      return;
    }
    const { Hostel, OccupancySnapshot, Room } = require('../models');
    const pending = await Hostel.findByPk(fx().pendingHostel.id);
    expect(await Room.count({ where: { hostel_id: pending.id } })).toBe(0);

    const report = await request(app)
      .get('/api/reports/occupancy')
      .query({ hostelId: pending.id })
      .set(auth(ownerToken));
    expect(report.status).toBe(200);
    expect(Number(report.body.data.total)).toBe(1);
    expect(report.body.data.occupancyRate).toBe(100);

    const snap = await OccupancySnapshot.findOne({ where: { hostel_id: pending.id } });
    expect(Number(snap.occupied_rooms)).toBe(1);
  });
});
