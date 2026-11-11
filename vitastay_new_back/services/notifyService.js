/**
 * In-app row always (unless skipped). Email/SMS go through mailQueue so HTTP never waits on SMTP.
 */
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const logger = require('../config/logger');
const config = require('../config');
const { getNotificationSettings } = require('./notifySettings');
const { enqueue } = require('./mailQueue');
const { renderTemplate } = require('./emailService');
const { isConfigured: smsConfigured } = require('./smsService');

const appUrl = () => (config.appUrl || 'http://localhost:3000').replace(/\/$/, '');

const displayName = (user) => {
  if (!user) return '';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '';
};

const asData = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw;
  return {};
};

const alreadySent = async ({ userId, type, kind, entityId, hours = 20 }) => {
  const { Notification } = require('../models');
  const rows = await Notification.findAll({
    where: {
      user_id: userId,
      type,
      created_at: { [Op.gte]: dayjs().subtract(hours, 'hour').toDate() },
    },
    attributes: ['id', 'data', 'channel'],
    limit: 40,
  });
  return rows.some((row) => {
    const data = asData(row.data);
    return data.kind === kind && Number(data.entity_id) === Number(entityId);
  });
};

const insertInApp = async ({ userId, title, message, type, data }) => {
  if (!userId) return null;
  const { Notification } = require('../models');
  return Notification.create({
    user_id: userId,
    title,
    message,
    type: type || 'info',
    channel: 'in_app',
    data: data || null,
  });
};

const queueEmail = ({ to, template, vars, cc }) => {
  if (!to) return;
  const rendered = renderTemplate(template, { appUrl: appUrl(), ...vars });
  enqueue({
    channel: 'email',
    to,
    cc,
    subject: rendered.subject,
    html: rendered.html,
  });
};

const queueSms = ({ to, text }) => {
  if (!to || !smsConfigured()) return;
  enqueue({ channel: 'sms', to, text, subject: text });
};

const notifyComplaintAssigned = async (complaint) => {
  try {
    const { User, Tenant, Hostel, Staff } = require('../models');
    const prefs = await getNotificationSettings(complaint.hostel_id);
    const tenant = await Tenant.findByPk(complaint.tenant_id);
    const hostel = await Hostel.findByPk(complaint.hostel_id, { attributes: ['id', 'name', 'owner_id'] });
    const tenantUser = tenant?.user_id ? await User.findByPk(tenant.user_id) : null;

    const assigneeUserId = await (async () => {
      if (!complaint.assigned_to) return null;
      const asUser = await User.findByPk(complaint.assigned_to);
      if (asUser) return asUser.id;
      const staff = await Staff.findByPk(complaint.assigned_to);
      return staff?.user_id || null;
    })();
    const assignee = assigneeUserId ? await User.findByPk(assigneeUserId) : null;

    const title = complaint.title || 'Complaint';
    const hostelName = hostel?.name || '';
    const data = { kind: 'complaint_assigned', entity_id: complaint.id, complaint_id: complaint.id };

    if (tenantUser) {
      await insertInApp({
        userId: tenantUser.id,
        title: 'Complaint assigned',
        message: `"${title}" is being looked at${hostelName ? ` at ${hostelName}` : ''}.`,
        type: 'complaint',
        data,
      });
      if (prefs.email_enabled && prefs.complaint_email && tenantUser.email) {
        queueEmail({
          to: tenantUser.email,
          template: 'complaintAssigned',
          vars: { name: displayName(tenantUser), title, hostel: hostelName },
        });
      }
      if (prefs.sms_enabled) {
        queueSms({
          to: tenantUser.phone,
          text: `Vita Stay: your complaint "${title}" has been assigned.`,
        });
      }
    }

    if (assignee && assignee.id !== tenantUser?.id) {
      await insertInApp({
        userId: assignee.id,
        title: 'Complaint assigned to you',
        message: `"${title}"${hostelName ? ` at ${hostelName}` : ''} needs your attention.`,
        type: 'complaint',
        data,
      });
      if (prefs.email_enabled && prefs.complaint_email && assignee.email) {
        queueEmail({
          to: assignee.email,
          template: 'complaintAssignedStaff',
          vars: { name: displayName(assignee), title, hostel: hostelName },
        });
      }
    }

    const alert = prefs.alert_email;
    if (prefs.email_enabled && prefs.complaint_email && alert && alert !== tenantUser?.email) {
      queueEmail({
        to: alert,
        template: 'complaintAssignedStaff',
        vars: { name: 'Team', title, hostel: hostelName },
      });
    }
  } catch (err) {
    logger.warn(`notifyComplaintAssigned failed: ${err.message}`);
  }
};

const notifyComplaintResolved = async (complaint) => {
  try {
    const { User, Tenant, Hostel } = require('../models');
    const prefs = await getNotificationSettings(complaint.hostel_id);
    const tenant = await Tenant.findByPk(complaint.tenant_id);
    const hostel = await Hostel.findByPk(complaint.hostel_id, { attributes: ['id', 'name'] });
    const tenantUser = tenant?.user_id ? await User.findByPk(tenant.user_id) : null;
    if (!tenantUser) return;

    const title = complaint.title || 'Complaint';
    const data = { kind: 'complaint_resolved', entity_id: complaint.id, complaint_id: complaint.id };
    await insertInApp({
      userId: tenantUser.id,
      title: 'Complaint resolved',
      message: `"${title}" has been marked resolved.`,
      type: 'complaint',
      data,
    });
    if (prefs.email_enabled && prefs.complaint_email && tenantUser.email) {
      queueEmail({
        to: tenantUser.email,
        template: 'complaintResolved',
        vars: {
          name: displayName(tenantUser),
          title,
          resolution: complaint.resolution || '',
          hostel: hostel?.name || '',
        },
      });
    }
    if (prefs.sms_enabled) {
      queueSms({
        to: tenantUser.phone,
        text: `Vita Stay: your complaint "${title}" is resolved.`,
      });
    }
  } catch (err) {
    logger.warn(`notifyComplaintResolved failed: ${err.message}`);
  }
};

const notifyRentDue = async ({ user, invoice, hostelName, prefs }) => {
  if (!user?.id) return false;
  const kind = 'rent_due';
  if (await alreadySent({
    userId: user.id,
    type: 'rent',
    kind,
    entityId: invoice.id,
  })) return false;

  const dueDate = dayjs(invoice.due_date).format('DD MMM YYYY');
  const month = invoice.month_year
    ? dayjs(`${invoice.month_year}-01`).format('MMM YYYY')
    : dueDate;
  const balance = Math.max(
    0,
    Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)
  );
  const amount = balance.toFixed(2);
  const data = { kind, entity_id: invoice.id, rent_payment_id: invoice.id };

  await insertInApp({
    userId: user.id,
    title: 'Rent due',
    message: `₹${amount} due on ${dueDate}${hostelName ? ` · ${hostelName}` : ''}.`,
    type: 'rent',
    data,
  });

  if (prefs.email_enabled && prefs.rent_due_email && user.email) {
    queueEmail({
      to: user.email,
      template: 'rentDue',
      vars: {
        name: displayName(user),
        hostel: hostelName,
        month,
        amount,
        dueDate,
        invoiceNumber: invoice.invoice_number,
      },
    });
  }
  if (prefs.sms_enabled) {
    queueSms({
      to: user.phone,
      text: `Vita Stay: rent ₹${amount} is due on ${dueDate}. Pay in the tenant portal.`,
    });
  }
  return true;
};

const sendDueRentNotices = async (db) => {
  const master = require('../models');
  const models = db || master;
  const unpaid = await models.RentPayment.findAll({
    where: { status: { [Op.in]: ['pending', 'partial', 'overdue'] } },
    include: [{ model: models.Tenant, as: 'tenant' }],
  });

  const prefsByHostel = new Map();
  let sent = 0;
  const today = dayjs().startOf('day');

  for (const invoice of unpaid) {
    const hostelId = invoice.hostel_id;
    if (!prefsByHostel.has(hostelId)) {
      prefsByHostel.set(hostelId, await getNotificationSettings(hostelId));
    }
    const prefs = prefsByHostel.get(hostelId);
    const due = dayjs(invoice.due_date).startOf('day');
    const daysUntil = due.diff(today, 'day');
    if (daysUntil > prefs.rent_reminder_days) continue;

    const tenant = invoice.tenant;
    if (!tenant?.user_id) continue;
    const user = await master.User.findByPk(tenant.user_id);
    if (!user) continue;
    const hostel = await master.Hostel.findByPk(hostelId, { attributes: ['name'] });
    const did = await notifyRentDue({ user, invoice, hostelName: hostel?.name || '', prefs });
    if (did) sent += 1;
  }
  if (sent) logger.info(`Rent reminders queued for ${sent} invoice(s)`);
  return sent;
};

const sendTestRentReminder = async (owner) => {
  if (!owner?.email) {
    throw Object.assign(new Error('Your account has no email address'), { statusCode: 400 });
  }
  const prefs = await getNotificationSettings(null);
  const dueDate = dayjs().add(Math.max(0, prefs.rent_reminder_days), 'day').format('DD MMM YYYY');

  await insertInApp({
    userId: owner.id,
    title: 'Test rent reminder',
    message: 'Sample rent due notice. Tenants were not emailed.',
    type: 'rent',
    data: { kind: 'rent_due_test' },
  });

  queueEmail({
    to: owner.email,
    template: 'rentDue',
    vars: {
      name: displayName(owner),
      hostel: 'Test property',
      month: dayjs().format('MMM YYYY'),
      amount: '1.00',
      dueDate,
      invoiceNumber: 'TEST',
    },
  });

  return {
    to: owner.email,
    smtp_configured: Boolean(config.smtp.host),
    email_jobs_enabled: Boolean(prefs.email_enabled && prefs.rent_due_email),
  };
};

const notifyUser = async ({
  userId,
  email,
  name,
  title,
  message,
  type = 'info',
  kind,
  entityId,
  template,
  vars,
  hours = 24,
  extraData,
}) => {
  if (!userId) return false;
  if (await alreadySent({ userId, type, kind, entityId, hours })) return false;
  await insertInApp({
    userId,
    title,
    message,
    type,
    data: { kind, entity_id: entityId, ...(extraData || {}) },
  });
  if (email && template) {
    queueEmail({ to: email, template, vars: { name, ...vars } });
  }
  return true;
};

const OCCUPANCY_LABELS = {
  single: 'Single',
  double: 'Double',
  triple: 'Triple',
  dormitory: 'Dormitory',
};

const occupancyOf = (booking) => {
  const raw = String(booking.room_type || '').trim();
  if (!raw) return 'a bed';
  return OCCUPANCY_LABELS[raw.toLowerCase()] || raw;
};

const rupeeOf = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  return v.toFixed(2);
};

const payableOf = (booking) => rupeeOf(
  (Number(booking.amount_due) || 0) + (Number(booking.deposit_due) || 0)
);

const moveInOf = (booking) => {
  if (!booking.move_in_date) return '';
  const d = dayjs(booking.move_in_date);
  return d.isValid() ? d.format('DD MMM YYYY') : String(booking.move_in_date);
};

const supportFrom = (hostel, owner) => ({
  supportEmail: String(hostel?.contact_email || owner?.email || config.support?.email || '').trim(),
  supportPhone: String(hostel?.contact_phone || config.support?.phone || '').trim(),
});

const loadBookingParties = async (booking) => {
  const { User, Hostel } = require('../models');
  const hostel = await Hostel.findByPk(booking.hostel_id, {
    attributes: ['id', 'owner_id', 'name', 'contact_phone', 'contact_email'],
  });
  const owner = hostel?.owner_id ? await User.findByPk(hostel.owner_id) : null;
  const seeker = booking.seeker_user_id ? await User.findByPk(booking.seeker_user_id) : null;
  const vars = {
    hostel: booking.listing_name || hostel?.name || '',
    code: booking.code,
    occupancy: occupancyOf(booking),
    amount: payableOf(booking),
    moveIn: moveInOf(booking),
    ...supportFrom(hostel, owner),
  };
  return { hostel, owner, seeker, vars };
};

const pingBookingUser = async (user, booking, spec, vars) => {
  if (!user) return false;
  return notifyUser({
    userId: user.id,
    email: spec.skipEmail ? null : user.email,
    name: displayName(user),
    title: spec.title,
    message: spec.message,
    type: spec.type || 'info',
    kind: spec.kind,
    entityId: booking.id,
    template: spec.template,
    vars: { ...vars, audience: spec.audience },
    hours: spec.hours,
    extraData: { booking_id: booking.id },
  });
};

const notifyBookingRequested = async (booking) => {
  try {
    const { owner, seeker, vars } = await loadBookingParties(booking);
    const summary = `${booking.code} · ${vars.occupancy} at ${vars.hostel}${vars.amount ? ` · ₹${vars.amount}` : ''}`;
    const seekerOk = await pingBookingUser(seeker, booking, {
      audience: 'seeker',
      title: 'Request received',
      message: `We received ${booking.code} at ${vars.hostel || 'the PG'}. The PG will confirm or decline. You are not a resident until they confirm.`,
      type: 'info',
      kind: 'booking_requested',
      template: 'bookingRequested',
    }, vars);
    const ownerOk = await pingBookingUser(owner, booking, {
      audience: 'owner',
      title: 'New booking request',
      message: summary,
      type: 'info',
      kind: 'booking_requested',
      template: 'bookingRequested',
    }, vars);
    return Boolean(seekerOk || ownerOk);
  } catch (err) {
    logger.warn(`Booking request notify skipped: ${err.message}`);
    return false;
  }
};

const notifyBookingConfirmed = async (booking) => {
  try {
    const { owner, seeker, vars } = await loadBookingParties(booking);
    const seekerOk = await pingBookingUser(seeker, booking, {
      audience: 'seeker',
      title: 'Booking accepted',
      message: `${vars.hostel || 'The PG'} accepted ${booking.code}. You are now on the hostel roll. First rent/deposit is on your ledger.`,
      type: 'success',
      kind: 'booking_confirmed',
      template: 'bookingConfirmed',
    }, vars);
    const ownerOk = await pingBookingUser(owner, booking, {
      audience: 'owner',
      title: 'Booking confirmed',
      message: `You confirmed ${booking.code} at ${vars.hostel}. The guest is on the hostel roll.`,
      type: 'success',
      kind: 'booking_confirmed',
      template: 'bookingConfirmed',
    }, vars);
    return Boolean(seekerOk || ownerOk);
  } catch (err) {
    logger.warn(`Booking confirm notify skipped: ${err.message}`);
    return false;
  }
};

const notifyBookingRejected = async (booking) => {
  try {
    const { owner, seeker, vars } = await loadBookingParties(booking);
    const reason = booking.reject_reason || '';
    const seekerOk = await pingBookingUser(seeker, booking, {
      audience: 'seeker',
      title: 'Booking declined',
      message: `${vars.hostel || 'The PG'} declined ${booking.code}. ${reason}`.trim(),
      type: 'warning',
      kind: 'booking_rejected',
      template: 'bookingRejected',
    }, { ...vars, reason });
    const ownerOk = await pingBookingUser(owner, booking, {
      audience: 'owner',
      title: 'Booking declined',
      message: `You declined ${booking.code} at ${vars.hostel}. That bed is vacant again.`,
      type: 'info',
      kind: 'booking_rejected',
      template: 'bookingRejected',
    }, { ...vars, reason });
    return Boolean(seekerOk || ownerOk);
  } catch (err) {
    logger.warn(`Booking reject notify skipped: ${err.message}`);
    return false;
  }
};

const notifyBookingCancelled = async (booking) => {
  try {
    const { owner, vars } = await loadBookingParties(booking);
    return pingBookingUser(owner, booking, {
      audience: 'owner',
      title: 'Booking cancelled',
      message: `A guest cancelled ${booking.code} at ${vars.hostel}.`,
      type: 'info',
      kind: 'booking_cancelled',
      template: 'bookingCancelled',
    }, vars);
  } catch (err) {
    logger.warn(`Booking cancel notify skipped: ${err.message}`);
    return false;
  }
};

const notifyBookingPaid = async (booking) => {
  try {
    const { owner, vars } = await loadBookingParties(booking);
    return pingBookingUser(owner, booking, {
      audience: 'owner',
      title: 'Booking paid',
      message: `${booking.code} at ${vars.hostel} is paid. Confirm to put them on the roll.`,
      type: 'success',
      kind: 'booking_paid',
      template: 'bookingPaid',
    }, vars);
  } catch (err) {
    logger.warn(`Booking paid notify skipped: ${err.message}`);
    return false;
  }
};

const notifyBookingDisplaced = async (booking) => {
  try {
    const { seeker, vars } = await loadBookingParties(booking);
    return pingBookingUser(seeker, booking, {
      audience: 'seeker',
      title: 'Bed taken by walk-in',
      message: `${vars.hostel || 'The PG'} assigned that bed to a walk-in. ${booking.code} is cancelled.`,
      type: 'warning',
      kind: 'booking_displaced',
      template: 'bookingDisplaced',
    }, { ...vars, reason: booking.cancel_reason || '' });
  } catch (err) {
    logger.warn(`Booking displace notify skipped: ${err.message}`);
    return false;
  }
};

const notifyBookingRefunded = async (booking, refund) => {
  try {
    const { owner, seeker, vars } = await loadBookingParties(booking);
    const amount = Number(refund?.amount) || 0;
    const retained = Number(refund?.retained_amount) || 0;
    const refundVars = {
      ...vars,
      amount: amount.toFixed(2),
      retained: retained.toFixed(2),
      kind: refund?.kind || 'full',
    };
    const seekerOk = await pingBookingUser(seeker, booking, {
      audience: 'seeker',
      title: amount > 0.009 ? 'Refund issued' : 'Booking cancelled',
      message: amount > 0.009
        ? `${booking.code}: ₹${amount.toFixed(2)} is being returned${retained > 0.009 ? ` (₹${retained.toFixed(2)} kept as cancellation fee)` : ''}.`
        : `${booking.code} was cancelled. No refund was due under the cancellation policy.`,
      type: 'info',
      kind: 'booking_refunded',
      template: amount > 0.009 ? 'bookingRefunded' : null,
    }, refundVars);
    const ownerOk = amount > 0.009
      ? await pingBookingUser(owner, booking, {
        audience: 'owner',
        title: 'Refund issued',
        message: `Refund of ₹${amount.toFixed(2)} for ${booking.code} at ${vars.hostel}. Subtracted from your payout.`,
        type: 'info',
        kind: 'booking_refunded',
        template: 'bookingRefunded',
      }, refundVars)
      : false;
    return Boolean(seekerOk || ownerOk);
  } catch (err) {
    logger.warn(`Booking refund notify skipped: ${err.message}`);
    return false;
  }
};

const notifyBookingPaymentFailed = async (booking) => {
  try {
    const { seeker, vars } = await loadBookingParties(booking);
    return pingBookingUser(seeker, booking, {
      audience: 'seeker',
      title: 'Payment did not go through',
      message: `${booking.code} at ${vars.hostel || 'the PG'} was not paid. That bed is free again.`,
      type: 'warning',
      kind: 'booking_payment_failed',
      template: 'bookingPaymentFailed',
    }, vars);
  } catch (err) {
    logger.warn(`Booking payment-failed notify skipped: ${err.message}`);
    return false;
  }
};

const notifyBookingHoldExpired = async (booking) => {
  try {
    const { owner, seeker, vars } = await loadBookingParties(booking);
    const seekerOk = await pingBookingUser(seeker, booking, {
      audience: 'seeker',
      title: 'Bed hold ended',
      message: `Your hold at ${vars.hostel || 'the PG'} expired. That bed is free for someone else.`,
      type: 'warning',
      kind: 'booking_hold_expired',
      template: 'bookingHoldExpired',
      hours: 72,
    }, vars);
    const ownerOk = await pingBookingUser(owner, booking, {
      audience: 'owner',
      title: 'Booking hold ended',
      message: `${booking.code} at ${vars.hostel} expired. That bed is vacant again.`,
      type: 'info',
      kind: 'booking_hold_expired',
      template: 'bookingHoldExpired',
      hours: 72,
    }, vars);
    return Boolean(seekerOk || ownerOk);
  } catch (err) {
    logger.warn(`Booking hold expiry notify skipped: ${err.message}`);
    return false;
  }
};

module.exports = {
  notifyComplaintAssigned,
  notifyComplaintResolved,
  notifyRentDue,
  notifyBookingHoldExpired,
  notifyBookingRefunded,
  notifyBookingPaymentFailed,
  notifyBookingPaid,
  notifyBookingDisplaced,
  notifyBookingRequested,
  notifyBookingConfirmed,
  notifyBookingRejected,
  notifyBookingCancelled,
  sendDueRentNotices,
  sendTestRentReminder,
  alreadySent,
  notifyUser,
};
