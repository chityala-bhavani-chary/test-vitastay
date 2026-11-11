const { randomUUID } = require('crypto');
const dayjs = require('dayjs');
const {
  User, RefreshToken, LoginHistory, OtpVerification, Tenant, Staff,
} = require('../models');
const { comparePassword, passwordFields } = require('../helpers/password');
const {
  generateAccessToken, generateRefreshToken, verifyRefreshToken, generateOtp,
} = require('../helpers/token');
const { sendOtpEmail } = require('./emailService');
const config = require('../config');

const getUserProfile = async (user) => {
  const profile = { ...(user.toJSON ? user.toJSON() : user) };
  delete profile.password;
  if (user.role === 'tenant') {
    profile.tenant = await Tenant.findOne({
      where: { user_id: user.id },
      include: ['hostel', 'room', 'bed'],
    });
  }
  if (user.role === 'staff' || user.role === 'supervisor') {
    profile.staff = await Staff.findOne({
      where: { user_id: user.id },
      include: ['hostel'],
    });
  }
  return profile;
};

const login = async ({ email, password, rememberMe, req }) => {
  const user = await User.findOne({ where: { email } });

  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  if (user.is_locked) {
    throw Object.assign(new Error('Account is locked'), { statusCode: 403 });
  }

  if (user.is_active === false) {
    throw Object.assign(new Error('Login is not enabled for this account'), { statusCode: 403 });
  }

  if (user.role === 'seeker') {
    throw Object.assign(new Error('Use the guest sign-in page for this account'), { statusCode: 403 });
  }

  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    await LoginHistory.create({
      user_id: user.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'failed',
      failure_reason: 'Invalid password',
    });
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  return issueSession(user, { rememberMe, req });
};

const issueSession = async (user, { rememberMe, req }) => {
  await user.update({ last_login: new Date() });
  await LoginHistory.create({
    user_id: user.id,
    ip_address: req.ip,
    device_info: req.headers['x-device-info'],
    user_agent: req.headers['user-agent'],
    status: 'success',
  });

  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ ...tokenPayload, sid: randomUUID() });

  const expiresAt = dayjs().add(
    rememberMe ? 30 : 7,
    'day'
  ).toDate();

  await RefreshToken.create({
    user_id: user.id,
    token: refreshToken,
    device_info: req.headers['x-device-info'],
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    expires_at: expiresAt,
  });

  const profile = await getUserProfile(user);

  return {
    user: profile,
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn,
  };
};

const refreshAccessToken = async (refreshToken, req) => {
  const decoded = verifyRefreshToken(refreshToken);
  const stored = await RefreshToken.findOne({
    where: { token: refreshToken, user_id: decoded.id, is_revoked: false },
  });

  if (!stored || dayjs(stored.expires_at).isBefore(dayjs())) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  const user = await User.findByPk(decoded.id);
  if (!user || !user.is_active || user.is_locked) {
    throw Object.assign(new Error('User not authorized'), { statusCode: 401 });
  }

  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(tokenPayload);

  return { accessToken, expiresIn: config.jwt.expiresIn };
};

const logout = async (refreshToken, userId) => {
  if (refreshToken) {
    await RefreshToken.update(
      { is_revoked: true },
      { where: { token: refreshToken, user_id: userId } }
    );
  }
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ where: { email } });
  if (!user) return { message: 'If email exists, OTP has been sent' };

  const otp = generateOtp();
  await OtpVerification.create({
    email,
    otp,
    type: 'password_reset',
    expires_at: dayjs().add(config.otpExpiresMinutes, 'minute').toDate(),
  });

  await sendOtpEmail(email, otp, 'password_reset');
  return { message: 'If email exists, OTP has been sent' };
};

const resetPassword = async ({ email, otp, newPassword }) => {
  const otpRecord = await OtpVerification.findOne({
    where: { email, otp, type: 'password_reset', is_used: false },
    order: [['created_at', 'DESC']],
  });

  if (!otpRecord || dayjs(otpRecord.expires_at).isBefore(dayjs())) {
    throw Object.assign(new Error('Invalid or expired OTP'), { statusCode: 400 });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  await user.update({
    ...(await passwordFields(newPassword)),
    password_changed_at: new Date(),
  });
  await otpRecord.update({ is_used: true });
  await RefreshToken.update({ is_revoked: true }, { where: { user_id: user.id } });

  return { message: 'Password reset successfully' };
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findByPk(userId);
  const isValid = await comparePassword(currentPassword, user.password);
  if (!isValid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });

  await user.update({
    ...(await passwordFields(newPassword)),
    password_changed_at: new Date(),
  });
  return { message: 'Password changed successfully' };
};

const updateProfile = async (userId, { first_name, last_name, phone }) => {
  const user = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const updates = {};
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;
  if (phone !== undefined) updates.phone = phone;

  await user.update(updates);
  return getUserProfile(user);
};

const updateAvatar = async (userId, avatarPath) => {
  const fs = require('fs');
  const path = require('path');
  const user = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const previous = user.avatar;
  await user.update({ avatar: avatarPath });

  if (previous && previous.startsWith('/uploads/avatars/')) {
    const oldFile = path.join(__dirname, '..', previous.replace(/^\//, ''));
    fs.promises.unlink(oldFile).catch(() => {});
  }

  return getUserProfile(user);
};

module.exports = {
  login,
  issueSession,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getUserProfile,
  updateProfile,
  updateAvatar,
};
