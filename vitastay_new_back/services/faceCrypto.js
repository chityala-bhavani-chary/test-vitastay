/**
 * AES-256-GCM for Vita Eye embeddings. Ciphertext stays hostel-row scoped.
 * No platform-wide face graph. Do not log plaintext vectors.
 */
const crypto = require('crypto');
const config = require('../config');

const keyBytes = () => {
  const raw = String(process.env.FACE_EMBEDDING_KEY || config.vitaEye?.embeddingKey || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(`${config.jwt.secret}:vita-eye-v1`).digest();
};

const encryptEmbedding = (vector) => {
  const payload = Buffer.from(JSON.stringify(vector), 'utf8');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
};

const decryptEmbedding = (ciphertext) => {
  const buf = Buffer.from(String(ciphertext || ''), 'base64');
  if (buf.length < 29) {
    const err = new Error('Invalid embedding ciphertext');
    err.statusCode = 500;
    throw err;
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
};

module.exports = { encryptEmbedding, decryptEmbedding };
