const crypto = require('crypto');
const { getGateway, CAPTURE_EVENTS, FAIL_EVENTS } = require('../services/paymentGateway');
const { captureOrder, failOrder, recordEvent } = require('../services/rentPay');
const { captureBookingOrder, failBookingOrder } = require('../services/bookingPay');
const { capturePlanOrder, failPlanOrder } = require('../services/ownerPlanBilling');
const { PaymentOrder } = require('../models');
const logger = require('../config/logger');

const rawString = (req) => {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body || {});
};

const eventIdOf = (capture, raw) => {
  const id = String(capture.eventId || '').trim();
  if (id) return id;
  return `hash_${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 40)}`;
};

exports.handleWebhook = async (req, res, next) => {
  try {
    const gateway = getGateway();
    const raw = rawString(req);
    const signature = req.get('x-razorpay-signature') || req.get('x-vitastay-signature') || '';

    if (!gateway.verifyWebhook(raw, signature)) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }

    const capture = gateway.parseCapture(parsed);
    const eventId = eventIdOf(capture, raw);
    const eventType = capture.eventType || '';

    logger.info('payment webhook received', {
      provider: gateway.name,
      event_type: eventType,
      provider_event_id: eventId,
      order_id: capture.orderId || null,
    });

    try {
      if (CAPTURE_EVENTS.includes(eventType) && capture.orderId) {
        const order = await PaymentOrder.findOne({ where: { gateway_order_id: capture.orderId } });
        const isPlan = order?.order_type === 'owner_plan' || order?.owner_invoice_id;
        if (isPlan) {
          await capturePlanOrder({
            gatewayOrderId: capture.orderId,
            gatewayPaymentId: capture.paymentId,
            method: capture.method,
            eventId,
            eventType,
            payload: parsed,
          });
        } else if (order?.booking_id) {
          await captureBookingOrder({
            gatewayOrderId: capture.orderId,
            gatewayPaymentId: capture.paymentId,
            method: capture.method,
            eventId,
            eventType,
            payload: parsed,
          });
        } else {
          await captureOrder({
            gatewayOrderId: capture.orderId,
            gatewayPaymentId: capture.paymentId,
            method: capture.method,
            eventId,
            eventType,
            payload: parsed,
            collectedBy: null,
          });
        }
      } else if (FAIL_EVENTS.includes(eventType) && capture.orderId) {
        const order = await PaymentOrder.findOne({ where: { gateway_order_id: capture.orderId } });
        const isPlan = order?.order_type === 'owner_plan' || order?.owner_invoice_id;
        if (isPlan) {
          await failPlanOrder({
            gatewayOrderId: capture.orderId,
            gatewayPaymentId: capture.paymentId,
            eventId,
            eventType,
            payload: parsed,
          });
        } else if (order?.booking_id) {
          await failBookingOrder({
            gatewayOrderId: capture.orderId,
            gatewayPaymentId: capture.paymentId,
            eventId,
            eventType,
            payload: parsed,
          });
        } else if (order) {
          await failOrder({
            gatewayOrderId: capture.orderId,
            gatewayPaymentId: capture.paymentId,
            eventId,
            eventType,
            payload: parsed,
          });
        } else {
          await recordEvent({
            provider: gateway.name,
            eventId,
            eventType,
            payload: parsed,
          });
        }
      } else {
        await recordEvent({
          provider: gateway.name,
          eventId,
          eventType: eventType || 'ignored',
          payload: parsed,
        });
      }
    } catch (err) {
      if (err.statusCode === 404) {
        await recordEvent({
          provider: gateway.name,
          eventId,
          eventType: eventType || 'unknown_order',
          payload: parsed,
        }).catch(() => {});
        return res.status(200).json({ success: true, message: 'Unknown order' });
      }
      throw err;
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};
