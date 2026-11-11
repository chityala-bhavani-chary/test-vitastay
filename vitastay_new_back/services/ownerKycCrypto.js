/**
 * AES-256-GCM for owner KYC identifiers (PAN / GSTIN / UPI). Never log plaintext.
 */
const crypto = require('crypto');
const config = require('../config');

const keyBytes = () => {
  const raw = String(process.env.OWNER_KYC_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(`${config.jwt.secret}:owner-kyc-v1`).digest();
};

const encryptText = (plain) => {
  const text = String(plain || '').trim();
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
};

const decryptText = (ciphertext) => {
  if (!ciphertext) return null;
  const buf = Buffer.from(String(ciphertext), 'base64');
  if (buf.length < 29) return null;
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
};

const maskPan = (pan) => {
  const s = String(pan || '');
  if (s.length < 4) return '****';
  return `${s.slice(0, 2)}******${s.slice(-2)}`;
};

module.exports = { encryptText, decryptText, maskPan };
