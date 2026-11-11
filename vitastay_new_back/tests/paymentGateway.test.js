const mock = require('../services/gateways/mock');
const { mapGatewayMethod, remainingOf } = require('../services/rentCollect');
const { gatewayName } = require('../services/paymentGateway');

describe('payment gateway adapter', () => {
  it('uses the mock driver under NODE_ENV=test', () => {
    expect(gatewayName()).toBe('mock');
  });

  it('maps Razorpay methods onto rent_payments enum', () => {
    expect(mapGatewayMethod('upi')).toBe('upi');
    expect(mapGatewayMethod('card')).toBe('card');
    expect(mapGatewayMethod('netbanking')).toBe('online');
  });

  it('computes remaining balance', () => {
    expect(remainingOf({ total_amount: 8000, paid_amount: 2000 })).toBe(6000);
    expect(remainingOf({ total_amount: 8000, paid_amount: 8000 })).toBe(0);
  });

  it('rejects a webhook with a bad signature', () => {
    const raw = '{"event":"payment.captured"}';
    expect(mock.verifyWebhook(raw, 'deadbeef')).toBe(false);
    const good = require('crypto')
      .createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET || 'test-webhook-secret')
      .update(raw)
      .digest('hex');
    expect(mock.verifyWebhook(raw, good)).toBe(true);
  });
});
