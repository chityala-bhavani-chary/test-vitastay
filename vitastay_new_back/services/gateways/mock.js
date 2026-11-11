const crypto = require('crypto');

const secret = () => process.env.PAYMENT_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || 'mock-webhook-secret';

const hmac = (payload, key = secret()) => crypto.createHmac('sha256', key).update(payload).digest('hex');

const createOrder = async ({ amountRupees, receipt }) => {
  const paise = Math.round(Number(amountRupees) * 100);
  const id = `order_mock_${String(receipt || Date.now()).replace(/[^\w]/g, '').slice(0, 24)}_${Date.now().toString(36)}`;
  return {
    id,
    amount: paise,
    currency: 'INR',
    receipt: String(receipt || '').slice(0, 40),
    status: 'created',
  };
};

const verifyWebhook = (rawBody, signature) => {
  const expected = hmac(rawBody);
  return Boolean(signature) && expected === String(signature);
};

const verifyCheckout = ({ orderId, paymentId, signature }) => {
  const expected = hmac(`${orderId}|${paymentId}`);
  return Boolean(signature) && expected === String(signature);
};

const { parseGatewayEvent } = require('./parseEvent');

const parseCapture = (event) => {
  const parsed = parseGatewayEvent(event);
  return {
    ...parsed,
    method: parsed.method || 'upi',
  };
};

const publicKey = () => process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';

const signCheckout = (orderId, paymentId) => hmac(`${orderId}|${paymentId}`);

const refundsIssued = [];

const refund = async ({ paymentId, amountRupees, notes }) => {
  const paise = Math.round(Number(amountRupees) * 100);
  const body = {
    id: `rfnd_mock_${String(paymentId || 'pay').replace(/[^\w]/g, '').slice(0, 20)}_${Date.now().toString(36)}`,
    payment_id: paymentId,
    amount: paise,
    currency: 'INR',
    status: 'processed',
    notes: notes || {},
  };
  refundsIssued.push(body);
  return body;
};

module.exports = {
  name: 'mock',
  createOrder,
  verifyWebhook,
  verifyCheckout,
  parseCapture,
  publicKey,
  signCheckout,
  refund,
  refundsIssued,
};
