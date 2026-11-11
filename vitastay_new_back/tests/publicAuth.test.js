/**
 * BKG-001 — guest/seeker register + login. Role seeker only. No tenants row.
 */
const { request, app, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { normalizeIndianMobile } = require('../helpers/phone');

const fx = () => global.__erp;
const emailOf = (n) => `seeker${n}@test.vitastay.local`;

const latestOtp = async (email, type) => {
  const { OtpVerification } = require('../models');
  const row = await OtpVerification.findOne({
    where: { email, type, is_used: false },
    order: [['created_at', 'DESC']],
  });
  return row?.otp;
};

describe('phone helper', () => {
  test('normalises +91 and leading 0 to 10 digits', () => {
    expect(normalizeIndianMobile('+91 98765 43210')).toBe('9876543210');
    expect(normalizeIndianMobile('09876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('12345')).toBeNull();
  });
});

describe('BKG-001 public seeker auth', () => {
  const email = emailOf(1);
  const phone = '9876511111';
  const password = 'SeekerPass1';
  let seekerToken;

  test('OTP then register creates seeker and no tenant row', async () => {
    const otpRes = await request(app).post('/api/public/auth/otp').send({
      email,
      phone: '+91 98765 11111',
      role: 'owner',
    });
    expect(otpRes.status).toBe(200);

    const emailOtp = await latestOtp(email, 'email_verify');
    const phoneOtp = await latestOtp(email, 'phone_verify');
    expect(emailOtp).toMatch(/^\d{6}$/);
    expect(phoneOtp).toMatch(/^\d{6}$/);

    const res = await request(app).post('/api/public/auth/register').send({
      email,
      phone,
      first_name: 'Asha',
      last_name: 'Seeker',
      password,
      email_otp: emailOtp,
      phone_otp: phoneOtp,
      role: 'owner',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('seeker');
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.phone).toBe(phone);
    expect(res.body.data.user.email_verified).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.join(';') || '').toMatch(/vitastay_at=/);
    expect(res.body.data.user).not.toHaveProperty('password');
    expect(res.body.data.user).not.toHaveProperty('password_plain');

    const { User, Tenant } = require('../models');
    const user = await User.findOne({ where: { email } });
    expect(user.role).toBe('seeker');
    expect(await Tenant.count({ where: { user_id: user.id } })).toBe(0);
  });

  test('operator email cannot request seeker OTP', async () => {
    const res = await request(app).post('/api/public/auth/otp').send({
      email: fx().owner.email,
      phone: '9876511112',
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/operator/i);
  });

  test('duplicate seeker email is 409', async () => {
    const res = await request(app).post('/api/public/auth/otp').send({
      email,
      phone: '9876511113',
    });
    expect(res.status).toBe(409);
  });

  test('bad OTP is 400', async () => {
    const other = emailOf(2);
    await request(app).post('/api/public/auth/otp').send({ email: other, phone: '9876511114' });
    const emailOtp = await latestOtp(other, 'email_verify');
    const res = await request(app).post('/api/public/auth/register').send({
      email: other,
      phone: '9876511114',
      first_name: 'Bad',
      last_name: 'Code',
      password,
      email_otp: emailOtp,
      phone_otp: '000000',
    });
    expect(res.status).toBe(400);
  });

  test('seeker can public-login; operator login is 403', async () => {
    const guest = await request(app).post('/api/public/auth/login').send({ email, password });
    expect(guest.status).toBe(200);
    expect(guest.body.data.user.role).toBe('seeker');
    seekerToken = guest.body.data.accessToken;

    const asOperator = await request(app).post('/api/auth/login').send({ email, password });
    expect(asOperator.status).toBe(403);
    expect(asOperator.body.message).toMatch(/guest sign-in/i);
  });

  test('owner cannot use public login', async () => {
    const res = await request(app).post('/api/public/auth/login').send({
      email: fx().owner.email,
      password: PASSWORD,
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/operator sign-in/i);
  });

  test('seeker cannot open ERP hostels', async () => {
    expect(seekerToken).toBeTruthy();
    const res = await request(app).get('/api/hostels').set(auth(seekerToken));
    expect(res.status).toBe(403);
  });
});
