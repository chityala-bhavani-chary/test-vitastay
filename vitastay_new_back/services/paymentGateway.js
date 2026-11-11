/**
 * DEC-08: one Indian gateway for MVP — Razorpay hosted checkout (UPI + cards).
 * Mock driver is for tests and local demo without merchant keys. Production forbids mock.
 */
const razorpay = require('./gateways/razorpay');
const mock = require('./gateways/mock');
const { parseGatewayEvent } = require('./gateways/parseEvent');

const CAPTURE_EVENTS = ['payment.captured', 'order.paid'];
const FAIL_EVENTS = ['payment.failed', 'order.cancelled', 'payment.cancelled'];

const configuredName = () => String(process.env.PAYMENT_GATEWAY || '').trim().toLowerCase();

const getGateway = () => {
  const name = configuredName();
  if (name === 'mock') return mock;
  if (name === 'razorpay') return razorpay;
  if (process.env.NODE_ENV === 'test') return mock;
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) return razorpay;
  return mock;
};

const gatewayName = () => getGateway().name;

module.exports = {
  getGateway,
  gatewayName,
  CAPTURE_EVENTS,
  FAIL_EVENTS,
  parseGatewayEvent,
};
