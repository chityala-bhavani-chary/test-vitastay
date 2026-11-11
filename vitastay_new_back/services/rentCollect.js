/**
 * Single ledger write for staff collect and tenant gateway capture.
 * Never create a second rent table — both paths update rent_payments + finance_transactions.
 */
const dayjs = require('dayjs');
const { RentPayment, FinanceTransaction } = require('../models');

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank', 'online'];
const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank: 'Bank Transfer',
  online: 'Online',
};
const UNPAID_STATUSES = ['pending', 'partial', 'overdue'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const remainingOf = (payment) => round2(
  (Number(payment.total_amount) || 0) - (Number(payment.paid_amount) || 0)
);

const mapGatewayMethod = (raw) => {
  const v = String(raw || '').toLowerCase();
  if (v === 'upi') return 'upi';
  if (v === 'card') return 'card';
  if (v === 'netbanking' || v === 'wallet' || v === 'emi' || v === 'online') return 'online';
  return 'online';
};

/**
 * @returns {{ payment, duplicate: boolean, alreadyPaid: boolean }}
 */
const applyCollection = async ({
  paymentId,
  paidAmount,
  method,
  reference,
  collectedBy,
  paidDate,
  transaction,
}) => {
  const payment = await RentPayment.findByPk(paymentId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!payment) {
    const err = new Error('Payment not found');
    err.statusCode = 404;
    throw err;
  }

  const ref = reference ? String(reference).trim() : '';
  if (ref && payment.payment_reference === ref) {
    return { payment, duplicate: true, alreadyPaid: remainingOf(payment) <= 0.009 };
  }

  const remaining = remainingOf(payment);
  if (remaining <= 0.009) {
    return { payment, duplicate: false, alreadyPaid: true };
  }

  const amount = round2(paidAmount);
  if (!(amount > 0)) {
    const err = new Error('Amount must be greater than 0');
    err.statusCode = 400;
    throw err;
  }
  if (amount - remaining > 0.009) {
    const err = new Error('Amount exceeds the balance due on this invoice');
    err.statusCode = 400;
    throw err;
  }

  const newPaidTotal = round2(Number(payment.paid_amount) + amount);
  const totalAmount = Number(payment.total_amount);
  const resolvedMethod = PAYMENT_METHODS.includes(method) ? method : 'cash';
  const date = paidDate || dayjs().format('YYYY-MM-DD');

  let status = 'partial';
  if (newPaidTotal + 0.009 >= totalAmount) status = 'paid';
  else if (newPaidTotal === 0) status = 'pending';

  await payment.update({
    paid_amount: newPaidTotal,
    paid_date: date,
    payment_method: resolvedMethod,
    payment_reference: ref || payment.payment_reference || null,
    status,
    collected_by: collectedBy || payment.collected_by,
  }, { transaction });

  await FinanceTransaction.create({
    hostel_id: payment.hostel_id,
    type: 'income',
    category: 'rent',
    amount,
    reference_id: payment.id,
    reference_type: 'rent_payment',
    transaction_date: date,
    description: `Rent payment (${PAYMENT_METHOD_LABELS[resolvedMethod]}) - ${payment.month_year}${ref ? ` - Ref ${ref}` : ''}`,
    created_by: collectedBy || null,
  }, { transaction });

  await payment.reload({ transaction });
  return { payment, duplicate: false, alreadyPaid: false };
};

module.exports = {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  UNPAID_STATUSES,
  round2,
  remainingOf,
  mapGatewayMethod,
  applyCollection,
};
