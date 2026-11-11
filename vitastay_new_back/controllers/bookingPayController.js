const { success, error } = require('../utils/response');
const { getGateway } = require('../services/paymentGateway');
const { createBookingPayOrder, captureBookingOrder, loadBooking } = require('../services/bookingPay');

exports.createOrder = async (req, res, next) => {
  try {
    const payload = await createBookingPayOrder(req.params.id, req.user);
    if (payload.already_paid) {
      return success(res, payload, 'Booking is already paid');
    }
    return success(res, payload, 'Payment order created');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.confirm = async (req, res, next) => {
  try {
    const booking = await loadBooking(req.params.id);
    if (!booking) return error(res, 'Booking not found', 404);
    if (Number(booking.seeker_user_id) !== Number(req.user.id)) {
      return error(res, 'Forbidden', 403);
    }

    const gateway = getGateway();
    const orderId = req.body.razorpay_order_id || req.body.gateway_order_id;
    if (!orderId) return error(res, 'Missing gateway order id', 400);
    if (booking.gateway_order_id && booking.gateway_order_id !== orderId) {
      return error(res, 'Gateway order does not match this booking', 400);
    }

    let paymentId = req.body.razorpay_payment_id || req.body.gateway_payment_id;
    const signature = req.body.razorpay_signature;

    if (gateway.name === 'mock' && !paymentId) {
      paymentId = `pay_mock_bkg_${booking.id}_${Date.now()}`;
    } else if (!gateway.verifyCheckout({
      orderId,
      paymentId,
      signature,
    })) {
      return error(res, 'Invalid payment signature', 400);
    }

    const captured = await captureBookingOrder({
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      method: req.body.method || 'upi',
      eventId: `confirm_${paymentId}`,
      eventType: 'checkout.captured',
      payload: req.body,
    });

    return success(res, {
      id: captured.booking.id,
      code: captured.booking.code,
      status: captured.booking.status,
      payment_status: captured.booking.payment_status,
      occupied: false,
      duplicate: captured.duplicate,
    }, captured.duplicate ? 'Payment already recorded' : 'Payment recorded. The PG still confirms the bed.');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};
