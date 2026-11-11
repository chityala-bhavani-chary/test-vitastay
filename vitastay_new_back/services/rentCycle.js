const { Op } = require('sequelize');
const dayjs = require('dayjs');
const logger = require('../config/logger');
const { generateReceiptNumber, generateInvoiceNumber } = require('../helpers/token');

/** Invoices are raised this many days before the due date so they appear in Reminders. */
const GENERATE_AHEAD_DAYS = 2;
const MAX_BACKFILL_MONTHS = 12;
const MIN_RUN_INTERVAL_MS = 10 * 60 * 1000;
const SCHEDULE_INTERVAL_MS = 60 * 60 * 1000;
/** Match rentController due-tracker: late fee only after this many days past due. */
const LATE_FEE_GRACE_DAYS = 3;
const UNPAID = ['pending', 'partial', 'overdue'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const invoiceTotal = (row) => round2(
  (Number(row.amount) || 0)
  + (Number(row.advance_amount) || 0)
  + (Number(row.deposit_amount) || 0)
  + (Number(row.penalty_amount) || 0)
  - (Number(row.discount_amount) || 0)
);

const readLateFeePercent = async (Setting, hostelId) => {
  if (!Setting) return 0;
  const rows = await Setting.findAll({
    where: {
      group: 'general',
      key: 'late_fee_percent',
      [Op.or]: [{ hostel_id: hostelId || null }, { hostel_id: null }],
    },
  });
  const scoped = rows.find((row) => Number(row.hostel_id) === Number(hostelId));
  const global = rows.find((row) => row.hostel_id == null);
  const raw = Number((scoped || global)?.value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, 100);
};

/** Same day-of-month as `day` in the month of `date`, clamped to the month's last day (31 → 28/29/30). */
const alignToDay = (date, day) => {
  const month = dayjs(date).startOf('month');
  return month.date(Math.min(day, month.daysInMonth()));
};

/** First billing date on `day` strictly after `date`. */
const nextCycleAfter = (date, day) => {
  const d = dayjs(date).startOf('day');
  const sameMonth = alignToDay(d, day);
  return sameMonth.isAfter(d) ? sameMonth : alignToDay(d.add(1, 'month'), day);
};

const billingDayOf = (tenant) => {
  if (tenant.rent_due_day) return Number(tenant.rent_due_day);
  return tenant.move_in_date ? dayjs(tenant.move_in_date).date() : null;
};

const isUniqueViolation = (err) => err?.name === 'SequelizeUniqueConstraintError';

const createCycleInvoice = async (db, tenant, dueDate, day) => {
  const periodEnd = nextCycleAfter(dueDate, day).subtract(1, 'day');
  const rent = Number(tenant.monthly_rent) || 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await db.RentPayment.create({
        tenant_id: tenant.id,
        hostel_id: tenant.hostel_id,
        room_id: tenant.room_id,
        amount: rent,
        total_amount: rent,
        paid_amount: 0,
        due_date: dueDate.format('YYYY-MM-DD'),
        month_year: dueDate.format('YYYY-MM'),
        status: 'pending',
        invoice_number: generateInvoiceNumber(),
        receipt_number: generateReceiptNumber(),
        notes: `Monthly rent for ${dueDate.format('DD MMM YYYY')} – ${periodEnd.format('DD MMM YYYY')}`,
      });
    } catch (err) {
      if (!isUniqueViolation(err) || attempt === 4) throw err;
    }
  }
  return null;
};

/**
 * Raise every rent invoice that has come due (up to GENERATE_AHEAD_DAYS ahead) for active tenants
 * in one database. Safe to run repeatedly: a tenant never gets two invoices for the same month.
 */
const generateForDatabase = async (db, today = dayjs()) => {
  const horizon = dayjs(today).startOf('day').add(GENERATE_AHEAD_DAYS, 'day');
  const backfillLimit = dayjs(today).startOf('day').subtract(MAX_BACKFILL_MONTHS, 'month');
  const tenants = await db.Tenant.findAll({
    where: { status: 'active', monthly_rent: { [Op.gt]: 0 }, move_in_date: { [Op.ne]: null } },
  });

  let created = 0;
  for (const tenant of tenants) {
    const day = billingDayOf(tenant);
    if (!day) continue;

    let next = tenant.next_rent_due_date ? dayjs(tenant.next_rent_due_date) : null;
    if (!next) {
      const latest = await db.RentPayment.max('due_date', {
        where: { tenant_id: tenant.id, status: { [Op.ne]: 'cancelled' } },
      });
      next = latest ? nextCycleAfter(latest, day) : alignToDay(tenant.move_in_date, day);
    }
    while (next.isBefore(backfillLimit)) next = nextCycleAfter(next, day);

    while (!next.isAfter(horizon)) {
      const monthYear = next.format('YYYY-MM');
      const exists = await db.RentPayment.count({
        where: { tenant_id: tenant.id, month_year: monthYear, status: { [Op.ne]: 'cancelled' } },
      });
      if (!exists) {
        await createCycleInvoice(db, tenant, next, day);
        created += 1;
      }
      next = nextCycleAfter(next, day);
    }

    const nextStr = next.format('YYYY-MM-DD');
    if (Number(tenant.rent_due_day) !== day || tenant.next_rent_due_date !== nextStr) {
      await tenant.update({ rent_due_day: day, next_rent_due_date: nextStr });
    }
  }
  return created;
};

/**
 * BIC-054 — after grace, mark overdue and apply late_fee_percent once onto penalty_amount.
 * Does not re-apply if a penalty already exists (owner may have set or waived).
 */
const applyLateFeesForDatabase = async (db, today = dayjs()) => {
  const cutoff = dayjs(today).startOf('day').subtract(LATE_FEE_GRACE_DAYS, 'day').format('YYYY-MM-DD');
  const open = await db.RentPayment.findAll({
    where: {
      status: { [Op.in]: UNPAID },
      due_date: { [Op.lt]: cutoff },
    },
  });
  if (!open.length) return 0;

  const percentByHostel = new Map();
  let applied = 0;
  for (const invoice of open) {
    const hostelId = invoice.hostel_id;
    if (!percentByHostel.has(hostelId)) {
      percentByHostel.set(hostelId, await readLateFeePercent(db.Setting, hostelId));
    }
    const percent = percentByHostel.get(hostelId) || 0;
    const base = Number(invoice.amount) || 0;
    const existingPenalty = Number(invoice.penalty_amount) || 0;
    const patch = {};

    if (invoice.status === 'pending' || invoice.status === 'partial') {
      patch.status = 'overdue';
    }

    if (percent > 0 && existingPenalty <= 0 && base > 0) {
      const fee = round2((base * percent) / 100);
      if (fee > 0) {
        patch.penalty_amount = fee;
        patch.total_amount = invoiceTotal({ ...invoice.toJSON(), penalty_amount: fee });
        const line = `Late fee ${percent}% after ${LATE_FEE_GRACE_DAYS}-day grace: ₹${fee.toFixed(2)}.`;
        patch.notes = invoice.notes ? `${invoice.notes}\n${line}` : line;
        applied += 1;
      }
    }

    if (Object.keys(patch).length) {
      await invoice.update(patch);
    }
  }
  return applied;
};

let running = null;
let lastRunAt = 0;

/** Generate due invoices in the master DB and every branch DB. Throttled unless `force`. */
const runRentCycle = ({ force = false } = {}) => {
  if (running) return running;
  if (!force && Date.now() - lastRunAt < MIN_RUN_INTERVAL_MS) return Promise.resolve(0);

  running = (async () => {
    const masterDb = require('../models');
    const { getHostelConnection } = require('./hostelDatabase');
    let total = await generateForDatabase(masterDb);
    let fees = await applyLateFeesForDatabase(masterDb);
    const { sendDueRentNotices } = require('./notifyService');
    await sendDueRentNotices(masterDb).catch((err) => logger.warn(`Rent reminders skipped: ${err.message}`));

    const branches = await masterDb.Hostel.findAll({ attributes: ['id', 'database_name'] });
    for (const hostel of branches.filter((h) => h.database_name)) {
      try {
        const conn = await getHostelConnection(hostel.database_name);
        total += await generateForDatabase(conn.models);
        fees += await applyLateFeesForDatabase(conn.models);
        await sendDueRentNotices(conn.models).catch((err) => logger.warn(`Rent reminders skipped for ${hostel.database_name}: ${err.message}`));
      } catch (err) {
        logger.warn(`Rent cycle skipped for ${hostel.database_name}: ${err.message}`);
      }
    }
    if (total) logger.info(`Rent cycle: raised ${total} monthly invoice(s)`);
    if (fees) logger.info(`Rent cycle: applied late fee on ${fees} invoice(s)`);
    return total;
  })().finally(() => {
    running = null;
    lastRunAt = Date.now();
  });
  return running;
};

const startRentCycleScheduler = () => {
  const run = () => runRentCycle({ force: true }).catch((err) => logger.error(`Rent cycle failed: ${err.message}`));
  run();
  setInterval(run, SCHEDULE_INTERVAL_MS).unref();
};

module.exports = {
  GENERATE_AHEAD_DAYS,
  LATE_FEE_GRACE_DAYS,
  alignToDay,
  nextCycleAfter,
  billingDayOf,
  generateForDatabase,
  applyLateFeesForDatabase,
  readLateFeePercent,
  runRentCycle,
  startRentCycleScheduler,
};
