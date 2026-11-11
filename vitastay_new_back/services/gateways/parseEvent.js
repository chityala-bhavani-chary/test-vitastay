/**
 * Razorpay-shaped webhook body → order / payment ids.
 * Shared by live and mock drivers so replay tests match production parsing.
 */
const parseGatewayEvent = (event) => {
  const body = typeof event === 'string' ? JSON.parse(event) : (event || {});
  const payment = body?.payload?.payment?.entity || {};
  const order = body?.payload?.order?.entity || {};
  const entity = payment.id ? payment : order;
  return {
    eventType: body?.event || '',
    eventId: String(body?.id || entity.id || ''),
    orderId: payment.order_id || order.id || entity.order_id || null,
    paymentId: payment.id || null,
    amountPaise: Number(entity.amount) || 0,
    method: entity.method || null,
    status: entity.status || '',
  };
};

module.exports = { parseGatewayEvent };
