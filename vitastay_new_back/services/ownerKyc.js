/**
 * BIC-038 — owner PAN / optional GSTIN / UPI or cancelled-cheque proof.
 * Identifiers stay encrypted. Publish stays blocked until Super Admin verifies.
 */
const path = require('path');
const { Document } = require('../models');
const { encryptText, decryptText, maskPan } = require('./ownerKycCrypto');

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const UPI_RE = /^[\w.\-]{2,64}@[A-Za-z]{2,64}$/;

const httpError = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  return err;
};

const assertOwnerKycForPublish = (hostel) => {
  if (String(hostel?.owner_kyc_status) !== 'verified') {
    throw httpError(422, 'Owner PAN and bank proof must be verified before this listing can go public');
  }
};

const maskUpi = (upi) => {
  const value = String(upi || '');
  const at = value.indexOf('@');
  if (at < 1) return null;
  return `${value.slice(0, 1)}***${value.slice(at)}`;
};

const loadSecrets = async (hostel) => {
  const row = await hostel.constructor.unscoped().findByPk(hostel.id, {
    attributes: ['owner_pan_cipher', 'owner_gstin_cipher', 'owner_upi_cipher'],
  });
  return row || {};
};

const statusPayload = async (hostel, { reveal = false } = {}) => {
  const secrets = await loadSecrets(hostel);
  const pan = reveal ? decryptText(secrets.owner_pan_cipher) : null;
  const upi = reveal ? decryptText(secrets.owner_upi_cipher) : null;
  const proofs = await Document.findAll({
    where: { entity_type: 'hostel', entity_id: hostel.id, title: 'Owner bank proof' },
    order: [['id', 'DESC']],
    limit: 5,
  });
  return {
    status: hostel.owner_kyc_status || 'none',
    submitted_at: hostel.owner_kyc_submitted_at || null,
    verified_at: hostel.owner_kyc_verified_at || null,
    reject_reason: hostel.owner_kyc_status === 'rejected' ? (hostel.owner_kyc_reject_reason || null) : null,
    has_pan: Boolean(secrets.owner_pan_cipher),
    has_gstin: Boolean(secrets.owner_gstin_cipher),
    has_upi: Boolean(secrets.owner_upi_cipher),
    pan_mask: pan ? maskPan(pan) : null,
    upi_mask: upi ? maskUpi(upi) : null,
    proofs: proofs.map((doc) => ({
      id: doc.id,
      file_type: doc.file_type,
      created_at: doc.created_at || doc.createdAt || null,
    })),
    publish_blocked: hostel.owner_kyc_status !== 'verified',
  };
};

const submit = async ({ hostel, user, body = {}, file }) => {
  const pan = String(body.pan || '').trim().toUpperCase();
  if (!PAN_RE.test(pan)) throw httpError(422, 'Enter a valid PAN (e.g. ABCDE1234F)');
  const gstinRaw = String(body.gstin || '').trim().toUpperCase();
  if (gstinRaw && !GSTIN_RE.test(gstinRaw)) throw httpError(422, 'GSTIN looks invalid');
  const upi = String(body.upi || '').trim();
  if (upi && !UPI_RE.test(upi)) throw httpError(422, 'UPI ID looks invalid');
  if (!upi && !file) throw httpError(422, 'Add a UPI ID or upload a cancelled cheque');

  if (file) {
    const publicPath = `/uploads/owner-kyc/${path.basename(file.path || file.filename)}`;
    await Document.create({
      entity_type: 'hostel',
      entity_id: hostel.id,
      title: 'Owner bank proof',
      file_path: publicPath,
      file_type: file.mimetype || null,
      file_size: file.size || null,
      description: 'Cancelled cheque or bank proof for listing KYC',
      uploaded_by: user.id,
    });
  }

  await hostel.update({
    owner_pan_cipher: encryptText(pan),
    owner_gstin_cipher: gstinRaw ? encryptText(gstinRaw) : null,
    owner_upi_cipher: upi ? encryptText(upi) : null,
    owner_kyc_status: 'submitted',
    owner_kyc_submitted_at: new Date(),
    owner_kyc_verified_at: null,
    owner_kyc_verified_by: null,
    owner_kyc_reject_reason: null,
  });
  await hostel.reload();
  return {
    ...(await statusPayload(hostel)),
    message: 'KYC submitted. A Vita Stay admin will verify it before the listing can go public.',
  };
};

const verify = async ({ hostel, user }) => {
  const secrets = await loadSecrets(hostel);
  if (!secrets.owner_pan_cipher) throw httpError(422, 'No PAN on file');
  if (!decryptText(secrets.owner_pan_cipher)) throw httpError(422, 'PAN could not be read');
  await hostel.update({
    owner_kyc_status: 'verified',
    owner_kyc_verified_at: new Date(),
    owner_kyc_verified_by: user.id,
    owner_kyc_reject_reason: null,
  });
  await hostel.reload();
  return {
    ...(await statusPayload(hostel, { reveal: true })),
    message: 'Owner KYC verified',
  };
};

const reject = async ({ hostel, reason }) => {
  const text = String(reason || '').trim();
  if (text.length < 10) throw httpError(422, 'Rejection reason must be at least 10 characters');
  await hostel.update({
    owner_kyc_status: 'rejected',
    owner_kyc_reject_reason: text.slice(0, 500),
    owner_kyc_verified_at: null,
    owner_kyc_verified_by: null,
  });
  await hostel.reload();
  return {
    ...(await statusPayload(hostel)),
    message: 'Owner KYC rejected',
  };
};

module.exports = {
  assertOwnerKycForPublish,
  statusPayload,
  submit,
  verify,
  reject,
};
