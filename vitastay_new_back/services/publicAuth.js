/**
 * Guest / seeker identity (BKG-001).
 * Creates users.role=seeker only. Never owner/staff. No tenants row (DEC-04: that is BKG-009).
 */
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { User, Tenant, OtpVerification } = require('../models');
const { passwordFields, comparePassword } = require('../helpers/password');
const { generateOtp } = require('../helpers/token');
const { normalizeIndianMobile } = require('../helpers/phone');
const { sendOtpEmail } = require('./emailService');
const { sendSms } = require('./smsService');
const { issueSession } = require('./authService');
const config = require('../config');
const logger = require('../config/logger');

const OPERATOR_ROLES = new Set(['super_admin', 'owner', 'supervisor', 'tenant', 'staff']);
const SEEKER_ROLE = 'seeker';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const normalizeEmail = (raw) => String(raw || '').trim().toLowerCase();

const findLiveOtp = async ({ email, phone, type, otp }) => {
  const where = { email, type, is_used: false, otp: String(otp || '') };
  if (phone) where.phone = phone;
  else where[Op.or] = [{ phone: null }, { phone: '' }];
  const row = await OtpVerification.findOne({
    where,
    order: [['created_at', 'DESC']],
  });
  if (!row || dayjs(row.expires_at).isBefore(dayjs())) {
    throw fail('Invalid or expired OTP', 400);
  }
  return row;
};

const requestRegisterOtp = async ({ email: rawEmail, phone: rawPhone }) => {
  const email = normalizeEmail(rawEmail);
  const phone = normalizeIndianMobile(rawPhone);
  if (!email) throw fail('Valid email is required', 422);
  if (!phone) throw fail('Enter a valid 10-digit Indian mobile number', 422);

  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) {
    if (OPERATOR_ROLES.has(existingEmail.role)) {
      throw fail('This email is used for the operator app. Sign in at the staff login page.', 409);
    }
    throw fail('This email is already registered. Sign in instead.', 409);
  }

  const existingPhone = await User.findOne({ where: { phone } });
  if (existingPhone) {
    throw fail('This mobile number is already registered.', 409);
  }

  const emailOtp = generateOtp();
  const phoneOtp = generateOtp();
  const expiresAt = dayjs().add(config.otpExpiresMinutes, 'minute').toDate();

  await OtpVerification.create({
    email,
    phone: null,
    otp: emailOtp,
    type: 'email_verify',
    expires_at: expiresAt,
  });
  await OtpVerification.create({
    email,
    phone,
    otp: phoneOtp,
    type: 'phone_verify',
    expires_at: expiresAt,
  });

  await sendOtpEmail(email, emailOtp, 'email_verify');
  await sendSms({
    to: phone,
    text: `Vita Stay code ${phoneOtp}. Expires in ${config.otpExpiresMinutes} minutes. Do not share it.`,
  });

  if (config.nodeEnv !== 'production') {
    logger.info(`Seeker OTP for ${email} / ${phone}: email ${emailOtp} phone ${phoneOtp}`);
  }

  return {
    message: 'We sent a code to your email and mobile.',
    expires_in_minutes: config.otpExpiresMinutes,
  };
};

const registerSeeker = async ({
  email: rawEmail,
  phone: rawPhone,
  first_name,
  last_name,
  password,
  email_otp,
  phone_otp,
  role: _ignoredRole,
  rememberMe,
  req,
}) => {
  const email = normalizeEmail(rawEmail);
  const phone = normalizeIndianMobile(rawPhone);
  const first = String(first_name || '').trim();
  const last = String(last_name || '').trim();
  if (!first || !last) throw fail('First and last name are required', 422);
  if (!phone) throw fail('Enter a valid 10-digit Indian mobile number', 422);
  if (String(password || '').length < 8) throw fail('Password must be at least 8 characters', 422);

  if (await User.findOne({ where: { email } })) {
    throw fail('This email is already registered. Sign in instead.', 409);
  }
  if (await User.findOne({ where: { phone } })) {
    throw fail('This mobile number is already registered.', 409);
  }

  const emailRow = await findLiveOtp({ email, type: 'email_verify', otp: email_otp });
  const phoneRow = await findLiveOtp({ email, phone, type: 'phone_verify', otp: phone_otp });
  await emailRow.update({ is_used: true });
  await phoneRow.update({ is_used: true });

  const user = await User.create({
    email,
    phone,
    first_name: first.slice(0, 100),
    last_name: last.slice(0, 100),
    role: SEEKER_ROLE,
    email_verified: true,
    is_active: true,
    ...(await passwordFields(password)),
  });

  const tenants = await Tenant.count({ where: { user_id: user.id } });
  if (tenants) {
    logger.error(`Seeker register created a tenant row for user ${user.id} — unexpected`);
  }

  return issueSession(user, { rememberMe, req });
};

const loginSeeker = async ({ email: rawEmail, password, rememberMe, req }) => {
  const email = normalizeEmail(rawEmail);
  const user = await User.findOne({ where: { email } });
  if (!user) throw fail('Invalid email or password', 401);
  if (user.is_locked) throw fail('Account is locked', 403);
  if (user.is_active === false) throw fail('Login is not enabled for this account', 403);
  if (user.role !== SEEKER_ROLE) {
    throw fail('Use the operator sign-in page for this account', 403);
  }
  const isValid = await comparePassword(password, user.password);
  if (!isValid) throw fail('Invalid email or password', 401);
  return issueSession(user, { rememberMe, req });
};

module.exports = {
  SEEKER_ROLE,
  requestRegisterOtp,
  registerSeeker,
  loginSeeker,
};
