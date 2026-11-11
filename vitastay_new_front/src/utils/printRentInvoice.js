import dayjs from 'dayjs';
import { formatCurrency, displayEmail, getMediaUrl } from '../utils/constants';

const METHOD_LABELS = {
  cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank Transfer', online: 'Online',
};
const methodLabel = (m) => METHOD_LABELS[m] || String(m || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS_COLORS = {
  paid: '#15803D',
  partial: '#B45309',
  pending: '#B91C1C',
  overdue: '#B91C1C',
  cancelled: '#6B7280',
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const belowHundred = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);

const belowThousand = (n) => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
};

/** Integer to words using the Indian numbering system (Thousand, Lakh, Crore). */
const integerToWords = (num) => {
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;
  return [
    crore ? `${integerToWords(crore)} Crore` : '',
    lakh ? `${belowHundred(lakh)} Lakh` : '',
    thousand ? `${belowHundred(thousand)} Thousand` : '',
    rest ? belowThousand(rest) : '',
  ].filter(Boolean).join(' ');
};

export const amountInWords = (amount) => {
  const totalPaise = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const rupeeText = `Rupees ${integerToWords(rupees)}`;
  return paise ? `${rupeeText} and ${belowHundred(paise)} Paise Only` : `${rupeeText} Only`;
};

const absoluteUrl = (path) => {
  const url = getMediaUrl(path);
  if (!url) return '';
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return '';
  }
};

/**
 * Builds a printable half-A4 (A5 landscape) bill with hostel name and payment details.
 */
const buildInvoiceHtml = (payment, options = { autoPrint: false }) => {
  if (!payment) return null;

  const user = payment.tenant?.user;
  const tenantName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—' : '—';
  const tenantPhone = user?.phone || payment.tenant?.phone || '';
  const tenantEmail = displayEmail(user?.email);
  const deposit = parseFloat(payment.deposit_amount || 0);
  const penalty = parseFloat(payment.penalty_amount || 0);
  const discount = parseFloat(payment.discount_amount || 0);
  const extension = parseFloat(payment.extension_charge || 0);
  const extensionDays = Number(payment.extension_days) || 0;
  const splits = Array.isArray(payment.splits) ? payment.splits : [];
  const hostelName = payment.hostel?.name || 'Vita Stay Hostel';
  const hostelAddress = [payment.hostel?.address, payment.hostel?.city, payment.hostel?.state, payment.hostel?.pincode]
    .filter(Boolean)
    .join(', ');
  const hostelPhone = payment.hostel?.contact_phone || payment.hostel?.phone || '';
  const hostelEmail = payment.hostel?.contact_email || payment.hostel?.email || '';
  const hostelLogo = absoluteUrl(payment.hostel?.logo);
  const roomLabel = payment.room?.room_number
    ? `Room ${payment.room.room_number}${payment.bed_number ? ` · Bed ${payment.bed_number}` : ''}`
    : '—';
  const total = parseFloat(payment.total_amount || 0);
  const paid = parseFloat(payment.paid_amount || 0);
  const balance = Math.max(0, total - paid);
  // A partial payment (or a single installment) gets a receipt for the received amount only.
  const receivedAmount = payment.receipt_amount != null ? parseFloat(payment.receipt_amount) || 0 : paid;
  const isPartial = receivedAmount > 0 && receivedAmount + 0.009 < total;
  const isFullyPaid = payment.status === 'paid' || (receivedAmount > 0 && !isPartial);
  const isReceipt = isPartial || isFullyPaid;
  const statusKey = isReceipt ? 'paid' : (payment.status || 'pending');
  const status = isReceipt ? 'received' : statusKey.replace(/_/g, ' ');
  const statusColor = STATUS_COLORS[statusKey] || STATUS_COLORS.pending;
  const invoiceRef = payment.invoice_number || `INV-${payment.id}`;
  const invoiceNo = isReceipt
    ? (payment.receipt_number || invoiceRef)
    : (payment.invoice_number || payment.receipt_number || `INV-${payment.id}`);
  const monthLabel = payment.month_year || '—';
  const monthDisplay = payment.month_year ? dayjs(`${payment.month_year}-01`).format('MMM YYYY') : '—';
  const billDate = dayjs(payment.paid_date || payment.created_at || undefined).format('DD MMM YYYY');
  const dueDate = payment.due_date ? dayjs(payment.due_date).format('DD MMM YYYY') : '—';
  const paidDate = payment.paid_date ? dayjs(payment.paid_date).format('DD MMM YYYY') : '—';
  let method = payment.payment_method ? methodLabel(payment.payment_method) : '—';
  if (splits.length > 1) method = `Split (${splits.map((s) => methodLabel(s.method)).join(' + ')})`;
  else if (splits.length === 1) method = methodLabel(splits[0].method);
  else if (Array.isArray(payment.splits)) method = '—';
  const printedAt = dayjs().format('DD MMM YYYY, hh:mm A');
  const billTitle = isReceipt ? 'Payment Receipt' : (payment.bill_title || 'Rent Invoice');

  const towards = [
    `Monthly Rent (${monthDisplay})`,
    deposit > 0 ? 'Security Deposit' : null,
    penalty > 0 ? 'Late Fee' : null,
    extension > 0 ? 'Due Date Extension' : null,
  ].filter(Boolean).join(' & ');
  const extensionLabel = `Due Date Extension${extensionDays > 0 ? ` (${extensionDays} day${extensionDays === 1 ? '' : 's'}`
    + `${payment.original_due_date ? `, from ${dayjs(payment.original_due_date).format('DD MMM')}` : ''})` : ''}`;

  const chargeRows = isPartial
    ? [[`Part payment towards ${towards} — against Invoice ${invoiceRef}`, formatCurrency(receivedAmount)]]
    : [
      [`Monthly Rent (${monthDisplay})`, formatCurrency(payment.amount ?? total)],
      deposit > 0 ? ['Security Deposit (refundable)', formatCurrency(deposit)] : null,
      penalty > 0 ? ['Late Fee / Penalty', formatCurrency(penalty)] : null,
      extension > 0 ? [extensionLabel, formatCurrency(extension)] : null,
      discount > 0 ? ['Discount', `- ${formatCurrency(discount)}`] : null,
    ].filter(Boolean);

  const e = escapeHtml;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${e(billTitle)} - ${e(hostelName)} - ${e(invoiceNo)}</title>
  <style>
    @page { size: A5 landscape; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #1C2B3A;
      background: #E9EEF3;
      font-size: 10.5px;
      line-height: 1.35;
    }
    .actions {
      width: 210mm;
      margin: 12px auto 10px;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .actions button {
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-btn { background: #002D62; color: #fff; }
    .close-btn { background: #fff; color: #1C2B3A; border: 1px solid #cfd8e1 !important; }

    .sheet {
      width: 210mm;
      height: 148mm;
      margin: 0 auto 24px;
      padding: 7mm 9mm 5mm;
      background: #fff;
      box-shadow: 0 6px 24px rgba(0, 45, 98, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-top: 4px solid #002D62;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding-bottom: 3mm;
      border-bottom: 1.5px solid #002D62;
    }
    .brand { display: flex; gap: 10px; align-items: center; min-width: 0; }
    .brand img { width: 40px; height: 40px; object-fit: contain; border-radius: 6px; }
    .hostel-name {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: #002D62;
      letter-spacing: 0.01em;
      line-height: 1.15;
    }
    .hostel-sub { color: #4A5D73; font-size: 9.5px; margin-top: 2px; }
    .bill-meta { text-align: right; flex-shrink: 0; }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border: 1.5px solid #008F7A;
      color: #008F7A;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .bill-meta .line { font-size: 10px; color: #4A5D73; }
    .bill-meta .line b { color: #1C2B3A; }

    .info {
      display: grid;
      grid-template-columns: 1.6fr 1fr 0.9fr 0.9fr;
      gap: 10px;
      padding: 2.5mm 0;
      border-bottom: 1px solid #E3E9EF;
    }
    .label {
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6B7C8F;
      margin-bottom: 1px;
    }
    .value { font-size: 11.5px; font-weight: 600; }
    .muted { color: #6B7C8F; font-size: 9.5px; }
    .status {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 999px;
      border: 1px solid ${statusColor};
      color: ${statusColor};
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .body {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      gap: 6mm;
      padding-top: 3mm;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #E8EEF3; }
    th {
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #4A5D73;
      background: #F2F6F9;
      border-bottom: 1px solid #D5DEE6;
    }
    td { font-size: 10.5px; }
    .amount { text-align: right; white-space: nowrap; }

    .words {
      margin-top: 3mm;
      padding: 5px 8px;
      border-left: 3px solid #008F7A;
      background: #F2FAF8;
    }
    .words .text { font-size: 10.5px; font-weight: 600; font-style: italic; }

    .pay-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 10px;
      margin-top: 3mm;
    }

    .totals { border: 1px solid #D5DEE6; border-radius: 6px; overflow: hidden; }
    .totals .row {
      display: flex;
      justify-content: space-between;
      padding: 4px 9px;
      font-size: 10.5px;
    }
    .totals .row + .row { border-top: 1px solid #EEF2F6; }
    .totals .paid span:last-child { color: #15803D; font-weight: 600; }
    .totals .due span:last-child { color: ${balance > 0 ? '#B45309' : '#1C2B3A'}; font-weight: 600; }
    .totals .grand {
      background: #002D62;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 9px;
    }
    .breakdown { margin-top: 3mm; }
    .breakdown .label { margin-bottom: 2px; }

    .footer {
      margin-top: auto;
      padding-top: 2mm;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .note { font-size: 8.5px; color: #6B7C8F; }
    .sign { text-align: center; min-width: 45mm; }
    .sign .line-sig { border-top: 1px solid #1C2B3A; margin-bottom: 2px; }
    .sign span { font-size: 9px; color: #4A5D73; }
    .website {
      margin-top: 2mm;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.25em;
      color: #002D62;
      opacity: 0.35;
    }

    @media print {
      body { background: #fff; }
      .actions { display: none !important; }
      .sheet { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="close-btn" onclick="window.close()">Close</button>
    <button class="print-btn" onclick="window.print()">Print Bill</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        ${hostelLogo ? `<img src="${e(hostelLogo)}" alt="" onerror="this.remove()" />` : ''}
        <div>
          <h1 class="hostel-name">${e(hostelName)}</h1>
          ${hostelAddress ? `<div class="hostel-sub">${e(hostelAddress)}</div>` : ''}
          ${hostelPhone || hostelEmail ? `<div class="hostel-sub">${[hostelPhone && `Ph: ${e(hostelPhone)}`, e(hostelEmail)].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>` : ''}
        </div>
      </div>
      <div class="bill-meta">
        <div class="badge">${e(billTitle)}</div>
        <div class="line">${isReceipt ? 'Receipt No' : 'Bill No'}: <b>${e(invoiceNo)}</b></div>
        <div class="line">Date: <b>${e(billDate)}</b></div>
      </div>
    </div>

    <div class="info">
      <div>
        <div class="label">Billed To</div>
        <div class="value">${e(tenantName)}</div>
        <div class="muted">${[tenantPhone, tenantEmail].filter(Boolean).map(e).join(' · ') || '&nbsp;'}</div>
      </div>
      <div>
        <div class="label">Room / Bed</div>
        <div class="value">${e(roomLabel)}</div>
      </div>
      <div>
        <div class="label">Billing Month</div>
        <div class="value">${e(monthDisplay)}</div>
      </div>
      <div>
        <div class="label">Status</div>
        <div><span class="status">${e(status)}</span></div>
      </div>
    </div>

    <div class="body">
      <div>
        <table>
          <thead>
            <tr><th>Description</th><th class="amount">Amount</th></tr>
          </thead>
          <tbody>
            ${chargeRows.map(([label, value]) => `<tr><td>${e(label)}</td><td class="amount">${e(value)}</td></tr>`).join('')}
          </tbody>
        </table>

        <div class="words">
          <div class="label">${isReceipt ? 'Amount Received in Words' : 'Amount in Words'}</div>
          <div class="text">${e(amountInWords(isReceipt ? receivedAmount : total))}</div>
        </div>

        <div class="pay-info">
          <div><div class="label">Payment Mode</div><div class="value">${e(method)}</div></div>
          <div><div class="label">${receivedAmount > 0 ? 'Paid On' : 'Due Date'}</div><div class="value">${e(receivedAmount > 0 ? paidDate : dueDate)}</div></div>
          ${payment.payment_reference && splits.length <= 1 ? `<div><div class="label">Reference</div><div class="value">${e(payment.payment_reference)}</div></div>` : ''}
        </div>
      </div>

      <div>
        <div class="totals">
          ${isReceipt ? `
          <div class="row grand"><span>Amount Received</span><span>${formatCurrency(receivedAmount)}</span></div>` : `
          <div class="row"><span>Sub Total</span><span>${formatCurrency(total)}</span></div>
          <div class="row paid"><span>Paid</span><span>${formatCurrency(paid)}</span></div>
          <div class="row due"><span>Balance Due</span><span>${formatCurrency(balance)}</span></div>
          <div class="row grand"><span>Total Amount</span><span>${formatCurrency(total)}</span></div>`}
        </div>

        ${splits.length > 1 ? `
        <div class="breakdown">
          <div class="label">Payment Breakdown</div>
          <table>
            <thead><tr><th>Mode</th><th>Reference</th><th class="amount">Amount</th></tr></thead>
            <tbody>
              ${splits.map((s) => `
              <tr>
                <td>${e(methodLabel(s.method))}</td>
                <td>${e(s.reference || '—')}</td>
                <td class="amount">${formatCurrency(s.amount)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
      </div>
    </div>

    <div class="footer">
      <div class="footer-row">
        <div class="note">
          This is a computer-generated ${isReceipt ? 'receipt' : 'bill'}. Security deposit is refundable as per hostel policy.<br/>
          Printed on ${e(printedAt)}
        </div>
        <div class="sign">
          <div class="line-sig"></div>
          <span>Authorised Signatory</span>
        </div>
      </div>
      <div class="website">www.vitastay.in</div>
    </div>
  </div>
  <script>
    ${options.autoPrint ? `
    window.onload = function () {
      setTimeout(function () { window.print(); }, 300);
    };
    ` : ''}
  </script>
</body>
</html>`;

  return { html, hostelName, monthLabel, invoiceNo };
};

const openInvoiceWindow = (payment, autoPrint) => {
  const built = buildInvoiceHtml(payment, { autoPrint });
  if (!built) return;
  const win = window.open('', '_blank', 'width=900,height=680');
  if (!win) return;
  win.document.open();
  win.document.write(built.html);
  win.document.close();
};

/**
 * Opens a printable rent invoice window with hostel name and payment details.
 */
export const printRentInvoice = (payment) => openInvoiceWindow(payment, true);

/** Open invoice in a new window for viewing (no auto-print). */
export const viewRentInvoice = (payment) => openInvoiceWindow(payment, false);

/** Download invoice as an HTML file (can be opened/printed/saved as PDF). */
export const downloadRentInvoice = (payment) => {
  const built = buildInvoiceHtml(payment, { autoPrint: false });
  if (!built) return;
  const blob = new Blob([built.html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeHostel = built.hostelName.replace(/[^\w\-]+/g, '_');
  const safeMonth = built.monthLabel.replace(/[^\w\-]+/g, '_');
  link.href = url;
  link.download = `Rent_Invoice_${safeHostel}_${safeMonth}_${built.invoiceNo}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default printRentInvoice;
