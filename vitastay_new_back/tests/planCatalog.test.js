/**
 * PKG-001 — master `plans` catalog. No hard-coded rupees. Checkout off while INR is null.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;

describe('PKG-001 plan catalog', () => {
  jest.setTimeout(60000);
  let ownerToken;
  let saToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    saToken = await login(fx().superAdmin.email, PASSWORD);
  });

  test('seeded Regular / Silver / Gold have null INR, GST, and active flag', async () => {
    const res = await request(app).get('/api/plans').set(auth(ownerToken));
    expect(res.status).toBe(200);
    const plans = res.body.data.plans || [];
    expect(plans.map((row) => row.code)).toEqual(['regular', 'silver', 'gold']);
    plans.forEach((row) => {
      expect(row.monthly_inr).toBeNull();
      expect(row.yearly_inr).toBeNull();
      expect(row.yearly_discount_pct).toBeNull();
      expect(row.gst_pct).toBe(18);
      expect(row.is_active).toBe(true);
    });
  });

  test('checkout stays 422 while catalog INR is empty', async () => {
    const pay = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/plan/pay`)
      .set(auth(ownerToken))
      .send({ plan: 'silver', period: 'year' });
    expect(pay.status).toBe(422);
    expect(pay.body.message).toMatch(/finance fills/i);
  });

  test('Super Admin writes yearly discount and GST; owner cannot', async () => {
    const put = await request(app)
      .put('/api/super-admin/plans/silver')
      .set(auth(saToken))
      .send({
        monthly_inr: 2999,
        yearly_inr: 29990,
        yearly_discount_pct: 17,
        gst_pct: 18,
        is_active: true,
      });
    expect(put.status).toBe(200);
    expect(put.body.data.monthly_inr).toBe(2999);
    expect(put.body.data.yearly_inr).toBe(29990);
    expect(put.body.data.yearly_discount_pct).toBe(17);
    expect(put.body.data.gst_pct).toBe(18);

    const steal = await request(app)
      .put('/api/super-admin/plans/silver')
      .set(auth(ownerToken))
      .send({ monthly_inr: 1 });
    expect(steal.status).toBe(403);

    const bad = await request(app)
      .put('/api/super-admin/plans/silver')
      .set(auth(saToken))
      .send({ yearly_discount_pct: 140 });
    expect(bad.status).toBe(422);
  });

  test('inactive plan disappears from owner catalog and is not on sale', async () => {
    await request(app)
      .put('/api/super-admin/plans/gold')
      .set(auth(saToken))
      .send({ monthly_inr: 4999, yearly_inr: 49990, is_active: false });

    const ownerCat = await request(app).get('/api/plans').set(auth(ownerToken));
    expect(ownerCat.body.data.plans.map((row) => row.code)).not.toContain('gold');

    const saCat = await request(app).get('/api/super-admin/plans').set(auth(saToken));
    expect(saCat.body.data.plans.map((row) => row.code)).toContain('gold');
    expect(saCat.body.data.plans.find((row) => row.code === 'gold').is_active).toBe(false);

    const pay = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/plan/pay`)
      .set(auth(ownerToken))
      .send({ plan: 'gold', period: 'month' });
    expect(pay.status).toBe(422);
    expect(pay.body.message).toMatch(/not on sale/i);
  });

  test('new hostel defaults to Regular even if the body asks for Gold', async () => {
    const res = await request(app)
      .post('/api/hostels')
      .set(auth(ownerToken))
      .send({
        name: 'PKG001 Branch',
        address: '1 Catalog Lane',
        city: 'Pune',
        state: 'MH',
        pincode: '411001',
        plan: 'gold',
        plan_status: 'active',
      });
    expect([200, 201]).toContain(res.status);
    const hostel = res.body.data;
    expect(hostel.plan).toBe('regular');
    expect(hostel.plan_status).toBe('comp');
  });
});
