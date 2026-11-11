const crypto = require('crypto');

const keyId = () => process.env.RAZORPAY_KEY_ID || '';
const keySecret = () => process.env.RAZORPAY_KEY_SECRET || '';
const webhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || '';

const hmac = (payload, secret) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

const createOrder = async ({ amountRupees, receipt, notes }) => {
  if (!keyId() || !keySecret()) {
    throw new Error('Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
  }
  const paise = Math.round(Number(amountRupees) * 100);
  const auth = Buffer.from(`${keyId()}:${keySecret()}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: paise,
      currency: 'INR',
      receipt: String(receipt || '').slice(0, 40),
      payment_capture: 1,
      notes: notes || {},
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error?.description || `Razorpay order failed (${res.status})`);
  }
  return body;
};

const verifyWebhook = (rawBody, signature) => {
  const secret = webhookSecret();
  if (!secret || !signature) return false;
  return hmac(rawBody, secret) === String(signature);
};

const verifyCheckout = ({ orderId, paymentId, signature }) => {
  if (!keySecret() || !signature) return false;
  return hmac(`${orderId}|${paymentId}`, keySecret()) === String(signature);
};

const { parseGatewayEvent } = require('./parseEvent');

const parseCapture = (event) => parseGatewayEvent(event);

const publicKey = () => keyId();

const refund = async ({ paymentId, amountRupees, notes }) => {
  if (!keyId() || !keySecret()) {
    throw new Error('Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
  }
  if (!paymentId) {
    throw new Error('Razorpay refund needs a captured payment id');
  }
  const paise = Math.round(Number(amountRupees) * 100);
  const auth = Buffer.from(`${keyId()}:${keySecret()}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: paise,
      notes: notes || {},
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error?.description || `Razorpay refund failed (${res.status})`);
  }
  return body;
};

module.exports = {
  name: 'razorpay',
  createOrder,
  verifyWebhook,
  verifyCheckout,
  parseCapture,
  publicKey,
  refund,
};
