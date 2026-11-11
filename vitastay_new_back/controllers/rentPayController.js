const { success, error } = require('../utils/response');
const { assertTenantOwnsRecord } = require('../helpers/tenantScope');
const { getGateway } = require('../services/paymentGateway');
const { remainingOf } = require('../services/rentCollect');
const { loadInvoice, createPayOrder, captureOrder } = require('../services/rentPay');

exports.createOrder = async (req, res, next) => {
  try {
    const invoice = await loadInvoice(req.params.id);
    if (!invoice) return error(res, 'Payment not found', 404);

    const ownership = await assertTenantOwnsRecord(req, res, invoice.tenant_id);
    if (ownership.forbidden) return ownership.response;

    const payload = await createPayOrder(invoice, invoice.tenant?.user);
    if (payload.already_paid) {
      return success(res, payload, 'Invoice is already paid');
    }
    return success(res, payload, 'Payment order created');
  } catch (err) {
    next(err);
  }
};

exports.confirm = async (req, res, next) => {
  try {
    const invoice = await loadInvoice(req.params.id);
    if (!invoice) return error(res, 'Payment not found', 404);

    const ownership = await assertTenantOwnsRecord(req, res, invoice.tenant_id);
    if (ownership.forbidden) return ownership.response;

    const gateway = getGateway();
    const orderId = req.body.razorpay_order_id || req.body.gateway_order_id;
    if (!orderId) return error(res, 'Missing gateway order id', 400);

    let paymentId = req.body.razorpay_payment_id || req.body.gateway_payment_id;
    const signature = req.body.razorpay_signature;

    if (gateway.name === 'mock' && !paymentId) {
      paymentId = `pay_mock_${invoice.id}_${Date.now()}`;
    } else if (!gateway.verifyCheckout({
      orderId,
      paymentId,
      signature,
    })) {
      return error(res, 'Invalid payment signature', 400);
    }

    const captured = await captureOrder({
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      method: req.body.method || 'upi',
      eventId: `confirm_${paymentId}`,
      eventType: 'checkout.captured',
      payload: req.body,
      collectedBy: req.user.id,
    });

    const paid = captured.payment;
    const remaining = remainingOf(paid);
    return success(res, {
      id: paid.id,
      status: paid.status,
      paid_amount: Number(paid.paid_amount),
      total_amount: Number(paid.total_amount),
      balance: remaining,
      payment_method: paid.payment_method,
      payment_reference: paid.payment_reference,
      receipt_number: paid.receipt_number,
      invoice_number: paid.invoice_number,
      duplicate: captured.duplicate,
    }, captured.duplicate ? 'Payment already recorded' : 'Payment successful');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};
