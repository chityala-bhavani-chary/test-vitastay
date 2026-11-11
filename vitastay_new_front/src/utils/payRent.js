import api, { extractData } from '../services/api';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve(window.Razorpay);
    return;
  }
  const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
  if (existing) {
    existing.addEventListener('load', () => resolve(window.Razorpay));
    existing.addEventListener('error', () => reject(new Error('Could not load Razorpay Checkout')));
    return;
  }
  const script = document.createElement('script');
  script.src = CHECKOUT_SRC;
  script.async = true;
  script.onload = () => resolve(window.Razorpay);
  script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
  document.body.appendChild(script);
});

/**
 * Hosted checkout only (Razorpay). Never collect card fields.
 * Mock/sandbox captures via confirmPath. Live still verifies signature server-side;
 * webhook is the source of truth.
 */
const resumeHostedCheckout = async (order, confirmPath) => {
  if (order.already_paid || order.invoice?.status === 'paid' || order.payment_status === 'paid') {
    return { ...order, already_paid: true };
  }

  if (order.gateway === 'mock' || order.sandbox) {
    const { data: done } = await api.post(confirmPath, {
      gateway_order_id: order.order_id,
      method: 'upi',
    });
    return extractData(done);
  }

  const Razorpay = await loadRazorpay();
  if (!Razorpay) throw new Error('Razorpay Checkout is unavailable');

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.key_id,
      amount: order.amount_paise,
      currency: order.currency || 'INR',
      name: order.name || 'Vita Stay',
      description: order.description,
      order_id: order.order_id,
      prefill: order.prefill || {},
      theme: { color: '#00A896' },
      handler: async (response) => {
        try {
          const { data: done } = await api.post(confirmPath, response);
          resolve(extractData(done));
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(Object.assign(new Error('Payment cancelled'), { cancelled: true })),
      },
    });
    checkout.open();
  });
};

export const startHostedCheckout = async ({ createPath, confirmPath, body }) => {
  const { data } = await api.post(createPath, body);
  return resumeHostedCheckout(extractData(data), confirmPath);
};

export const payRentInvoice = async (invoiceId) => startHostedCheckout({
  createPath: `/rent/${invoiceId}/pay`,
  confirmPath: `/rent/${invoiceId}/pay/confirm`,
});

export const payBooking = async (bookingId) => startHostedCheckout({
  createPath: `/bookings/${bookingId}/pay`,
  confirmPath: `/bookings/${bookingId}/pay/confirm`,
});

export const payOwnerPlan = async (hostelId, { plan, period }) => startHostedCheckout({
  createPath: `/hostels/${hostelId}/plan/pay`,
  confirmPath: `/hostels/${hostelId}/plan/pay/confirm`,
  body: { plan, period },
});

export const changeOwnerPlan = async (hostelId, { plan, period, confirm_unpublish }) => {
  const { data } = await api.post(`/hostels/${hostelId}/plan`, { plan, period, confirm_unpublish });
  const payload = extractData(data);
  if (payload?.action === 'downgraded') return payload;
  return resumeHostedCheckout(payload, `/hostels/${hostelId}/plan/pay/confirm`);
};
