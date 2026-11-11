/**
 * IMP-003 — password_plain must not exist on users or appear in API payloads.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;

describe('IMP-003 password_plain removed', () => {
  test('users table has no password_plain column', async () => {
    const { sequelize } = require('../models');
    const cols = await sequelize.getQueryInterface().describeTable('users');
    expect(cols.password_plain).toBeUndefined();
  });

  test('login and me never return password or password_plain', async () => {
    const token = await login(fx().owner.email, PASSWORD);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: fx().owner.email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user).not.toHaveProperty('password');
    expect(loginRes.body.data.user).not.toHaveProperty('password_plain');
    expect(loginRes.body.data.user).not.toHaveProperty('password_display');

    const me = await request(app).get('/api/auth/profile').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.data).not.toHaveProperty('password');
    expect(me.body.data).not.toHaveProperty('password_plain');
  });

  test('Super Admin user list does not expose stored plaintext', async () => {
    const saToken = await login(fx().superAdmin.email, PASSWORD);
    const res = await request(app).get('/api/super-admin/users-by-hostel').set(auth(saToken));
    expect(res.status).toBe(200);
    const groups = res.body.data || [];
    const users = groups.flatMap((g) => g.users || []);
    expect(users.length).toBeGreaterThan(0);
    users.forEach((user) => {
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('password_plain');
      expect(user.password_display == null || user.password_display === '').toBe(true);
    });
  });
});
