/**
 * Who may read /uploads files. Listing photos are public only when the PG listing is live.
 * KYC (/uploads/tenants) is never guest-readable. Signed query strings are the S3-shaped seam.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const { verifyAccessToken } = require('../helpers/token');
const { userCanManageHostelMedia } = require('../middleware/mediaAccess');
const { userCanAccessVitaEye } = require('../middleware/vitaEyeAccess');
const { isListingPubliclyVisible, loadChecklist } = require('./mediaPublishGuard');

const ACCESS_COOKIE = 'vitastay_at';
const PRIVATE_PREFIXES = ['/uploads/tenants/', '/uploads/complaints/', '/uploads/vita-eye/', '/uploads/owner-kyc/'];
const LISTING_PREFIXES = ['/uploads/media/', '/uploads/hostels/', '/uploads/rooms/'];
const OPERATOR_ROLES = new Set(['super_admin', 'owner', 'supervisor']);
const SIG_TTL_SEC = 15 * 60;
const VISIBILITY_TTL_MS = 15 * 1000;

const visibilityCache = new Map();

const uploadPathname = (req) => decodeURIComponent(String(req.originalUrl || req.url || '').split('?')[0]);

const isPrivateUploadPath = (filePath) => PRIVATE_PREFIXES.some((prefix) => String(filePath || '').startsWith(prefix));
const isListingUploadPath = (filePath) => LISTING_PREFIXES.some((prefix) => String(filePath || '').startsWith(prefix));

const hmac = (value) => crypto.createHmac('sha256', config.jwt.secret).update(value).digest('hex');

const signPrivateUrl = (publicPath) => {
  if (!publicPath || !isPrivateUploadPath(publicPath)) return publicPath;
  const exp = Math.floor(Date.now() / 1000) + SIG_TTL_SEC;
  const sig = hmac(`${publicPath}.${exp}`);
  return `${publicPath}?exp=${exp}&sig=${sig}`;
};

const hasValidSignature = (req, publicPath) => {
  const exp = Number(req.query?.exp);
  const sig = String(req.query?.sig || '');
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000) || !sig) return false;
  const expected = hmac(`${publicPath}.${exp}`);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const tokenFromReq = (req) => {
  const header = req.headers?.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies?.[ACCESS_COOKIE]) return req.cookies[ACCESS_COOKIE];
  return null;
};

const optionalUser = async (req) => {
  const token = tokenFromReq(req);
  if (!token) return null;
  try {
    const decoded = verifyAccessToken(token);
    const { User } = require('../models');
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'role', 'is_active', 'is_locked'],
    });
    if (!user || !user.is_active || user.is_locked) return null;
    return user;
  } catch {
    return null;
  }
};

const clearListingVisibilityCache = (hostelId) => {
  if (hostelId == null) visibilityCache.clear();
  else visibilityCache.delete(Number(hostelId));
};

const guestListingVisible = async (hostel) => {
  if (!hostel) return false;
  const id = Number(hostel.id);
  const hit = visibilityCache.get(id);
  if (hit && Date.now() - hit.at < VISIBILITY_TTL_MS) return hit.visible;
  const checklist = await loadChecklist(hostel);
  const visible = isListingPubliclyVisible(hostel, checklist);
  visibilityCache.set(id, { visible, at: Date.now() });
  return visible;
};

const findListingRow = async (publicPath, hostelId) => {
  const { PropertyMedia } = require('../models');
  const where = {
    [Op.or]: [{ file_path: publicPath }, { thumb_path: publicPath }],
  };
  if (hostelId) where.hostel_id = hostelId;
  return PropertyMedia.findOne({ where, paranoid: false });
};

const canReadListingFile = async (user, publicPath) => {
  const mediaHostel = String(publicPath).match(/^\/uploads\/media\/(\d+)\//);
  if (mediaHostel) {
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(mediaHostel[1]);
    if (!hostel) return false;
    if (await userCanManageHostelMedia(user, hostel)) return true;
    if (!(await guestListingVisible(hostel))) return false;
    const row = await findListingRow(publicPath, hostel.id);
    return Boolean(row && !row.deletedAt && row.is_published !== false && row.is_published !== 0);
  }

  const row = await findListingRow(publicPath);
  if (row) {
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(row.hostel_id);
    if (await userCanManageHostelMedia(user, hostel)) return true;
    if (row.deletedAt || row.is_published === false || row.is_published === 0) return false;
    return guestListingVisible(hostel);
  }
  return false;
};

const canReadPrivateFile = async (user, publicPath) => {
  if (!user) return false;

  if (String(publicPath).startsWith('/uploads/vita-eye/')) {
    const match = String(publicPath).match(/^\/uploads\/vita-eye\/(\d+)\//);
    if (!match) return false;
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(match[1]);
    const allowed = await userCanAccessVitaEye(user, hostel);
    if (allowed) {
      const { auditSaAccess } = require('./vitaEyePrivacy');
      await auditSaAccess({
        user,
        hostel,
        kind: 'still',
        extra: { path: publicPath },
      });
    }
    return allowed;
  }

  if (user.role === 'super_admin') return true;

  if (String(publicPath).startsWith('/uploads/owner-kyc/')) {
    const { Document, Hostel } = require('../models');
    const doc = await Document.findOne({ where: { file_path: publicPath, entity_type: 'hostel' } });
    if (!doc) return false;
    const hostel = await Hostel.findByPk(doc.entity_id);
    if (!hostel) return false;
    return user.role === 'owner' && Number(hostel.owner_id) === Number(user.id);
  }

  if (String(publicPath).startsWith('/uploads/tenants/')) {
    const { Tenant, TenantDocument, Hostel } = require('../models');
    const doc = await TenantDocument.findOne({
      where: { [Op.or]: [{ file_path: publicPath }, { back_file_path: publicPath }] },
    });
    const tenant = doc
      ? await Tenant.findByPk(doc.tenant_id)
      : await Tenant.findOne({ where: { photo: publicPath } });
    if (!tenant) return false;
    if (tenant.user_id && Number(tenant.user_id) === Number(user.id)) return true;
    const hostel = await Hostel.findByPk(tenant.hostel_id);
    return userCanManageHostelMedia(user, hostel);
  }

  return OPERATOR_ROLES.has(user.role);
};

const setAccessCookie = (res, accessToken) => {
  if (!res || !accessToken) return;
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge: 16 * 60 * 1000,
  });
};

const clearAccessCookie = (res) => {
  if (!res) return;
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
};

module.exports = {
  ACCESS_COOKIE,
  PRIVATE_PREFIXES,
  LISTING_PREFIXES,
  SIG_TTL_SEC,
  uploadPathname,
  isPrivateUploadPath,
  isListingUploadPath,
  signPrivateUrl,
  hasValidSignature,
  optionalUser,
  canReadListingFile,
  canReadPrivateFile,
  clearListingVisibilityCache,
  setAccessCookie,
  clearAccessCookie,
};
