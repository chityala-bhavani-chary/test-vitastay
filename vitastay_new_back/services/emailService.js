const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../config/logger');

let transporter = null;

const getTransporter = () => {
  if (!transporter && config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransporter();
  if (!transport) {
    logger.warn(`Email not sent (SMTP not configured): ${subject} -> ${to}`);
    return { success: false, message: 'SMTP not configured' };
  }

  try {
    const info = await transport.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error('Email send failed:', err);
    throw err;
  }
};

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const factsBlock = ({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone }) => {
  const rows = [];
  if (hostel) rows.push(['PG', hostel]);
  if (occupancy) rows.push(['Room', occupancy]);
  if (amount) rows.push(['Amount', `₹${amount}`]);
  if (moveIn) rows.push(['Move-in', moveIn]);
  const support = [supportPhone, supportEmail].filter(Boolean).join(' · ');
  if (support) rows.push(['Support', support]);
  if (!rows.length) return '';
  return `<table style="margin:12px 0;border-collapse:collapse;font-size:14px;">${
    rows.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#6B7C8F;white-space:nowrap;">${esc(k)}</td><td style="padding:3px 0;">${esc(v)}</td></tr>`).join('')
  }</table>`;
};

const wrapHtml = (title, body) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2332;">
    <div style="background: #002D62; color: #fff; padding: 16px 20px;">
      <strong style="letter-spacing: 0.08em;">VITA STAY</strong>
    </div>
    <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
      <h2 style="color: #002D62; margin-top: 0;">${esc(title)}</h2>
      ${body}
      <p style="color: #6B7C8F; font-size: 12px; margin-top: 24px;">This is an operational message from Vita Stay. Guests also see this on Account; owners on Notifications.</p>
    </div>
  </div>
`;

const templates = {
  rentDue: ({ name, hostel, month, amount, dueDate, invoiceNumber, appUrl }) => ({
    subject: `Rent due ${dueDate}${hostel ? ` · ${hostel}` : ''}`.trim(),
    html: wrapHtml('Rent reminder', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p>Your rent for <strong>${esc(month) || 'this month'}</strong> is due on <strong>${esc(dueDate)}</strong>.</p>
      <p>Amount due: <strong>₹${esc(amount)}</strong>${invoiceNumber ? ` · Invoice ${esc(invoiceNumber)}` : ''}.</p>
      <p><a href="${esc(appUrl)}/rent" style="color: #00A896;">Open the tenant portal to pay</a></p>
    `),
  }),
  complaintAssigned: ({ name, title, hostel, appUrl }) => ({
    subject: `Complaint assigned${title ? `: ${title}` : ''}`,
    html: wrapHtml('Complaint assigned', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p>The complaint <strong>${esc(title) || 'your ticket'}</strong>${hostel ? ` at ${esc(hostel)}` : ''} has been assigned and is being looked at.</p>
      <p><a href="${esc(appUrl)}/complaints" style="color: #00A896;">View complaint</a></p>
    `),
  }),
  complaintAssignedStaff: ({ name, title, hostel, appUrl }) => ({
    subject: `New complaint assigned to you${title ? `: ${title}` : ''}`,
    html: wrapHtml('Complaint assigned to you', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p>You have been assigned <strong>${esc(title) || 'a complaint'}</strong>${hostel ? ` at ${esc(hostel)}` : ''}.</p>
      <p><a href="${esc(appUrl)}/complaints" style="color: #00A896;">Open complaints</a></p>
    `),
  }),
  bookingRequested: ({ name, hostel, code, occupancy, amount, moveIn, supportEmail, supportPhone, audience, appUrl }) => {
    const isOwner = audience !== 'seeker';
    return {
      subject: isOwner
        ? `New booking request${hostel ? ` · ${hostel}` : ''}`.trim()
        : `We received your request${hostel ? ` · ${hostel}` : ''}`.trim(),
      html: wrapHtml(isOwner ? 'New booking request' : 'Request received', `
        <p>Hi ${esc(name) || 'there'},</p>
        ${isOwner
          ? `<p>A guest requested ${esc(occupancy) || 'a bed'} at <strong>${esc(hostel) || 'your PG'}</strong> (${esc(code)}). Confirm or decline from the inbox.</p>`
          : `<p>We received your request ${esc(code)} at <strong>${esc(hostel) || 'the PG'}</strong>. The PG will confirm or decline. You are not a resident until they confirm.</p>`}
        ${factsBlock({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone })}
        <p><a href="${esc(appUrl)}${isOwner ? '/booking-requests' : '/account'}" style="color: #00A896;">${isOwner ? 'Open booking inbox' : 'Open your requests'}</a></p>
      `),
    };
  },
  bookingConfirmed: ({ name, hostel, code, occupancy, amount, moveIn, supportEmail, supportPhone, audience, appUrl }) => {
    const isOwner = audience === 'owner';
    return {
      subject: `Booking accepted${hostel ? ` · ${hostel}` : ''}`.trim(),
      html: wrapHtml('Booking accepted', `
        <p>Hi ${esc(name) || 'there'},</p>
        ${isOwner
          ? `<p>You confirmed ${esc(code)} at <strong>${esc(hostel) || 'your PG'}</strong>. The guest is on the hostel roll.</p>`
          : `<p>The PG accepted your request ${esc(code)} at <strong>${esc(hostel) || 'the PG'}</strong>. You are now on the hostel roll. First rent and deposit (if any) are on your ledger — pay from the tenant app when asked.</p>`}
        ${factsBlock({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone })}
        <p><a href="${esc(appUrl)}${isOwner ? '/booking-requests' : '/account'}" style="color: #00A896;">${isOwner ? 'Open booking inbox' : 'Open your requests'}</a></p>
      `),
    };
  },
  bookingRejected: ({ name, hostel, code, occupancy, amount, moveIn, supportEmail, supportPhone, reason, audience, appUrl }) => {
    const isOwner = audience === 'owner';
    return {
      subject: `Booking declined${hostel ? ` · ${hostel}` : ''}`.trim(),
      html: wrapHtml('Booking declined', `
        <p>Hi ${esc(name) || 'there'},</p>
        ${isOwner
          ? `<p>You declined ${esc(code)} at <strong>${esc(hostel) || 'your PG'}</strong>. That bed is vacant again.</p>`
          : `<p>The PG declined your request ${esc(code)} at <strong>${esc(hostel) || 'the PG'}</strong>.</p>`}
        ${reason ? `<p>Reason: ${esc(reason)}</p>` : ''}
        ${factsBlock({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone })}
        <p><a href="${esc(appUrl)}${isOwner ? '/booking-requests' : '/search'}" style="color: #00A896;">${isOwner ? 'Open booking inbox' : 'Find another PG'}</a></p>
      `),
    };
  },
  bookingCancelled: ({ name, hostel, code, occupancy, amount, moveIn, supportEmail, supportPhone, appUrl }) => ({
    subject: `Booking cancelled${hostel ? ` · ${hostel}` : ''}`.trim(),
    html: wrapHtml('Booking cancelled', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p>The guest cancelled ${esc(code)} at <strong>${esc(hostel) || 'your PG'}</strong>. That bed is vacant again.</p>
      ${factsBlock({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone })}
      <p><a href="${esc(appUrl)}/booking-requests" style="color: #00A896;">Open booking inbox</a></p>
    `),
  }),
  bookingPaid: ({ name, hostel, code, occupancy, amount, moveIn, supportEmail, supportPhone, appUrl }) => ({
    subject: `Booking paid${hostel ? ` · ${hostel}` : ''}`.trim(),
    html: wrapHtml('Booking paid', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p>A guest paid ${esc(code)} at <strong>${esc(hostel) || 'your PG'}</strong>. Confirm from the inbox to put them on the hostel roll. Payment does not occupy the bed by itself.</p>
      ${factsBlock({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone })}
      <p><a href="${esc(appUrl)}/booking-requests" style="color: #00A896;">Open booking inbox</a></p>
    `),
  }),
  bookingDisplaced: ({ name, hostel, code, occupancy, amount, moveIn, supportEmail, supportPhone, reason, appUrl }) => ({
    subject: `Bed taken by walk-in${hostel ? ` · ${hostel}` : ''}`.trim(),
    html: wrapHtml('Bed taken by walk-in', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p>The PG assigned the bed for ${esc(code)} at <strong>${esc(hostel) || 'the PG'}</strong> to a walk-in guest. Your request is cancelled.</p>
      ${reason ? `<p>Reason: ${esc(reason)}</p>` : ''}
      ${factsBlock({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone })}
      <p><a href="${esc(appUrl)}/search" style="color: #00A896;">Find another PG</a></p>
    `),
  }),
  bookingRefunded: ({ name, hostel, code, occupancy, amount, retained, kind, moveIn, supportEmail, supportPhone, audience, appUrl }) => {
    const isOwner = audience === 'owner';
    const partial = kind === 'partial';
    return {
      subject: `Refund ${partial ? 'started' : 'issued'}${hostel ? ` · ${hostel}` : ''}`.trim(),
      html: wrapHtml('Booking refund', `
        <p>Hi ${esc(name) || 'there'},</p>
        ${isOwner
          ? `<p>A refund of <strong>₹${esc(amount)}</strong> for ${esc(code)} at <strong>${esc(hostel) || 'your PG'}</strong> is going back to the guest. This amount is subtracted from your payout.</p>`
          : `<p>We have ${partial ? 'started a partial refund' : 'issued a refund'} for ${esc(code)} at <strong>${esc(hostel) || 'the PG'}</strong>.</p>
      <p>Amount returning to you: <strong>₹${esc(amount)}</strong>${retained && Number(retained) > 0 ? `. Amount kept as cancellation fee: ₹${esc(retained)}.` : '.'}</p>
      <p>It usually shows on your UPI or card statement in 5–7 working days.</p>`}
        ${factsBlock({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone })}
        <p><a href="${esc(appUrl)}${isOwner ? '/booking-requests' : '/account'}" style="color: #00A896;">${isOwner ? 'Open booking inbox' : 'Open your requests'}</a></p>
      `),
    };
  },
  bookingPaymentFailed: ({ name, hostel, code, occupancy, amount, moveIn, supportEmail, supportPhone, appUrl }) => ({
    subject: `Payment did not go through${hostel ? ` · ${hostel}` : ''}`.trim(),
    html: wrapHtml('Payment did not go through', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p>The payment for ${esc(code)} at <strong>${esc(hostel) || 'the PG'}</strong> failed or was cancelled. That bed is available for someone else again.</p>
      <p>Send a new request from the listing if you still want it. You are not a resident.</p>
      ${factsBlock({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone })}
      <p><a href="${esc(appUrl)}/search" style="color: #00A896;">Find another PG</a></p>
    `),
  }),
  bookingHoldExpired: ({ name, hostel, code, occupancy, amount, moveIn, supportEmail, supportPhone, audience, appUrl }) => {
    const isOwner = audience === 'owner';
    return {
      subject: `Hold ended${hostel ? ` · ${hostel}` : ''}`.trim(),
      html: wrapHtml('Bed hold ended', `
        <p>Hi ${esc(name) || 'there'},</p>
        ${isOwner
          ? `<p>The hold on ${code ? `<strong>${esc(code)}</strong>` : 'a guest request'} at <strong>${esc(hostel) || 'your PG'}</strong> has ended. That bed is vacant again.</p>`
          : `<p>The short hold on your booking${code ? ` <strong>${esc(code)}</strong>` : ''} at <strong>${esc(hostel) || 'the PG'}</strong> has ended. That bed is available for someone else again.</p>
      <p>Send a new request from the listing if you still want it.</p>`}
        ${factsBlock({ hostel, occupancy, amount, moveIn, supportEmail, supportPhone })}
        <p><a href="${esc(appUrl)}${isOwner ? '/booking-requests' : '/account'}" style="color: #00A896;">${isOwner ? 'Open booking inbox' : 'Open your requests'}</a></p>
      `),
    };
  },
  ownerPlanGrace: ({ name, hostel, graceDays, appUrl }) => ({
    subject: `Renew your Vita Stay plan${hostel ? ` · ${hostel}` : ''}`.trim(),
    html: wrapHtml('Plan renewal grace', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p>The paid period for <strong>${esc(hostel) || 'your PG'}</strong> has ended. You have <strong>${esc(graceDays) || '7'} days</strong> to renew Silver or Gold.</p>
      <p>If you do not renew, this PG drops to Regular: guests will not find it online, and open booking requests will end. Occupancy, tenants, and photos stay in the ERP.</p>
      <p><a href="${esc(appUrl)}/settings?tab=plan" style="color: #00A896;">Renew on Settings → Plan</a></p>
    `),
  }),
  vitaEyeAlert: ({ name, hostel, label, gate, confidence, appUrl }) => ({
    subject: `Vita Eye ${label || 'alert'}${hostel ? ` · ${hostel}` : ''}`.trim(),
    html: wrapHtml('Vita Eye gate alert', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p><strong>${esc(label) || 'A match'}</strong> at ${esc(gate) || 'the gate'} of <strong>${esc(hostel) || 'your PG'}</strong> (confidence ${esc(confidence) || '—'}).</p>
      <p>Doors are not locked. Open Vita Eye to mark “not a match” if this is a false alarm.</p>
      <p><a href="${esc(appUrl)}/hostels" style="color: #00A896;">Open hostels</a></p>
    `),
  }),
  ownerPlanLapsed: ({ name, hostel, appUrl }) => ({
    subject: `Plan lapsed to Regular${hostel ? ` · ${hostel}` : ''}`.trim(),
    html: wrapHtml('Plan lapsed to Regular', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p><strong>${esc(hostel) || 'Your PG'}</strong> is now Regular. Guests cannot find it on search or book online.</p>
      <p>Occupancy, tenants, rent, and photos are unchanged. Renew Silver or Gold to list again.</p>
      <p><a href="${esc(appUrl)}/settings?tab=plan" style="color: #00A896;">Renew on Settings → Plan</a></p>
    `),
  }),
  complaintResolved: ({ name, title, resolution, appUrl }) => ({
    subject: `Complaint resolved${title ? `: ${title}` : ''}`,
    html: wrapHtml('Complaint resolved', `
      <p>Hi ${esc(name) || 'there'},</p>
      <p>Your complaint <strong>${esc(title) || ''}</strong> is marked resolved.</p>
      ${resolution ? `<p>${esc(resolution)}</p>` : ''}
      <p><a href="${esc(appUrl)}/complaints" style="color: #00A896;">View details</a></p>
    `),
  }),
};

const renderTemplate = (name, vars) => {
  const fn = templates[name];
  if (!fn) throw new Error(`Unknown email template ${name}`);
  return fn(vars);
};

const sendOtpEmail = async (email, otp, type = 'password_reset') => {
  const subjects = {
    password_reset: 'Password Reset OTP - Vita Stay',
    email_verify: 'Email Verification OTP - Vita Stay',
    login: 'Login OTP - Vita Stay',
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1976d2;">Vita Stay</h2>
      <p>Your OTP for ${type.replace('_', ' ')} is:</p>
      <h1 style="color: #1976d2; letter-spacing: 8px;">${otp}</h1>
      <p>This OTP expires in ${config.otpExpiresMinutes} minutes.</p>
      <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;

  return sendEmail({ to: email, subject: subjects[type] || 'OTP - Vita Stay', html });
};

module.exports = { sendEmail, sendOtpEmail, wrapHtml, renderTemplate, templates, esc, factsBlock };
