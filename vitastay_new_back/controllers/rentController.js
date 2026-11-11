const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { RentPayment, Tenant, Hostel, Room, User, FinanceTransaction } = require('../models');
const { success, created, paginated, error } = require('../utils/response');
const { getPagination, getSort } = require('../utils/pagination');
const { generateReceiptNumber, generateInvoiceNumber } = require('../helpers/token');
const { applyTenantScope, assertTenantOwnsRecord } = require('../helpers/tenantScope');
const { nextCycleAfter, runRentCycle } = require('../services/rentCycle');
const {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  applyCollection,
} = require('../services/rentCollect');
const METHOD_BY_LABEL = Object.fromEntries(Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => [label, key]));
const UNPAID_STATUSES = ['pending', 'partial', 'overdue'];
const PENDING_GRACE_DAYS = 3;
const REMINDER_DAYS = 2;
const DATE_FILTER_FIELDS = ['due_date', 'paid_date'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Pro-rata rent for the days a due date is pushed out: monthly rent ÷ days in that month × days. */
const extensionQuote = (payment, fromDate, toDate) => {
  const days = dayjs(toDate).startOf('day').diff(dayjs(fromDate).startOf('day'), 'day');
  const monthDays = dayjs(fromDate).daysInMonth();
  const perDay = round2((Number(payment.amount) || 0) / monthDays);
  return {
    days,
    month_days: monthDays,
    per_day: perDay,
    suggested_charge: days > 0 ? round2(((Number(payment.amount) || 0) / monthDays) * days) : 0,
  };
};

const LIST_INCLUDES = () => [
  {
    model: Tenant,
    as: 'tenant',
    attributes: ['id', 'full_name', 'user_id'],
    include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name', 'phone', 'email'] }],
  },
  { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
  { model: Room, as: 'room', attributes: ['id', 'room_number'] },
];

const invoiceInfo = (p) => ({
  rent_payment_id: p?.id || null,
  invoice_number: p?.invoice_number || null,
  month_year: p?.month_year || null,
  tenant_name: p?.tenant?.full_name?.trim()
    || `${p?.tenant?.user?.first_name || ''} ${p?.tenant?.user?.last_name || ''}`.trim()
    || '—',
  tenant_phone: p?.tenant?.user?.phone || '',
  hostel_name: p?.hostel?.name || '—',
  room_number: p?.room?.room_number || '—',
});

exports.getAll = async (req, res, next) => {
  try {
    await runRentCycle().catch(() => {});
    const { page, limit, offset } = getPagination(req.query);
    let where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.tenantId) where.tenant_id = req.query.tenantId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.monthYear) where.month_year = req.query.monthYear;

    const dateField = DATE_FILTER_FIELDS.includes(req.query.dateField) ? req.query.dateField : 'due_date';
    const range = {};
    if (req.query.from && dayjs(req.query.from).isValid()) range[Op.gte] = dayjs(req.query.from).format('YYYY-MM-DD');
    if (req.query.to && dayjs(req.query.to).isValid()) range[Op.lte] = dayjs(req.query.to).format('YYYY-MM-DD');
    if (Object.getOwnPropertySymbols(range).length) where[dateField] = range;

    const search = String(req.query.search || '').trim();
    if (search) {
      const like = { [Op.like]: `%${search}%` };
      where[Op.or] = [
        { invoice_number: like },
        { month_year: like },
        { '$tenant.full_name$': like },
        { '$tenant.user.first_name$': like },
        { '$tenant.user.last_name$': like },
        { '$tenant.user.phone$': like },
        { '$room.room_number$': like },
      ];
    }

    const scoped = await applyTenantScope(req, res, where);
    if (scoped.forbidden) return scoped.response;
    where = scoped.where;

    const { count, rows } = await RentPayment.findAndCountAll({
      where,
      subQuery: false,
      distinct: true,
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name', 'email', 'phone'] }] },
        { model: Hostel, as: 'hostel', attributes: ['id', 'name'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
      ],
      order: getSort(req.query, ['due_date', 'created_at', 'paid_date']),
      limit,
      offset,
    });

    return paginated(res, rows, { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const payment = await RentPayment.findByPk(req.params.id, {
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name', 'email', 'phone'] }] },
        { model: Hostel, as: 'hostel', attributes: ['id', 'name', 'address', 'city', 'state', 'pincode', 'contact_phone', 'contact_email'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number'] },
      ],
    });
    if (!payment) return error(res, 'Payment not found', 404);

    const ownership = await assertTenantOwnsRecord(req, res, payment.tenant_id);
    if (ownership.forbidden) return ownership.response;

    return success(res, payment);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.body.tenant_id);
    if (!tenant) return error(res, 'Tenant not found', 404);

    const total = parseFloat(req.body.amount || 0)
      + parseFloat(req.body.penalty_amount || 0)
      - parseFloat(req.body.discount_amount || 0);

    const payment = await RentPayment.create({
      ...req.body,
      hostel_id: tenant.hostel_id,
      room_id: tenant.room_id,
      total_amount: total,
      receipt_number: generateReceiptNumber(),
      invoice_number: generateInvoiceNumber(),
      status: 'pending',
    });

    return created(res, payment, 'Rent invoice created');
  } catch (err) {
    next(err);
  }
};

exports.collectPayment = async (req, res, next) => {
  const { sequelize } = require('../models');
  const t = await sequelize.transaction();
  try {
    const result = await applyCollection({
      paymentId: req.params.id,
      paidAmount: parseFloat(req.body.paid_amount),
      method: req.body.payment_method,
      reference: req.body.payment_reference,
      collectedBy: req.user.id,
      paidDate: req.body.paid_date,
      transaction: t,
    });
    await t.commit();
    return success(
      res,
      result.payment,
      result.alreadyPaid ? 'Invoice is already paid' : 'Payment collected successfully'
    );
  } catch (err) {
    await t.rollback();
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

/** BIC-054 — owner/supervisor clears automated late fee; balance drops by penalty_amount. */
exports.waiveLateFee = async (req, res, next) => {
  try {
    const payment = await RentPayment.findByPk(req.params.id);
    if (!payment) return error(res, 'Payment not found', 404);
    if (!UNPAID_STATUSES.includes(payment.status)) {
      return error(res, 'Only unpaid invoices can waive a late fee', 422);
    }
    const penalty = round2(payment.penalty_amount);
    if (penalty <= 0) return error(res, 'No late fee on this invoice', 422);

    const nextTotal = round2(
      (Number(payment.amount) || 0)
      + (Number(payment.advance_amount) || 0)
      + (Number(payment.deposit_amount) || 0)
      - (Number(payment.discount_amount) || 0)
    );
    const reason = String(req.body?.reason || '').trim();
    const line = reason
      ? `Late fee ₹${penalty.toFixed(2)} waived: ${reason}`
      : `Late fee ₹${penalty.toFixed(2)} waived by staff.`;
    await payment.update({
      penalty_amount: 0,
      total_amount: nextTotal,
      notes: payment.notes ? `${payment.notes}\n${line}` : line,
    });
    return success(res, payment, 'Late fee waived');
  } catch (err) {
    next(err);
  }
};

const isLatestInvoice = async (payment, transaction) => {
  const later = await RentPayment.count({
    where: {
      tenant_id: payment.tenant_id,
      id: { [Op.ne]: payment.id },
      status: { [Op.ne]: 'cancelled' },
      due_date: { [Op.gt]: payment.original_due_date || payment.due_date },
    },
    transaction,
  });
  return later === 0;
};

/** Data the "Change due date" dialog needs: actual due date, pro-rata basis and billing cycle. */
exports.getDueDateInfo = async (req, res, next) => {
  try {
    const payment = await RentPayment.findByPk(req.params.id);
    if (!payment) return error(res, 'Payment not found', 404);
    const tenant = await Tenant.findByPk(payment.tenant_id, {
      attributes: ['id', 'move_in_date', 'monthly_rent', 'rent_due_day', 'next_rent_due_date'],
    });
    const actualDue = payment.original_due_date || payment.due_date;
    return success(res, {
      id: payment.id,
      status: payment.status,
      amount: Number(payment.amount) || 0,
      total_amount: Number(payment.total_amount) || 0,
      paid_amount: Number(payment.paid_amount) || 0,
      extension_charge: Number(payment.extension_charge) || 0,
      due_date: payment.due_date,
      actual_due_date: actualDue,
      month_days: dayjs(actualDue).daysInMonth(),
      is_latest: await isLatestInvoice(payment),
      tenant: tenant ? {
        move_in_date: tenant.move_in_date,
        monthly_rent: Number(tenant.monthly_rent) || 0,
        rent_due_day: tenant.rent_due_day || (tenant.move_in_date ? dayjs(tenant.move_in_date).date() : null),
        next_rent_due_date: tenant.next_rent_due_date,
      } : null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Move an unpaid invoice's due date. The extra days past the actual (original) due date are charged
 * pro-rata by default; the charge is editable and replaces any earlier extension charge.
 */
exports.updateDueDate = async (req, res, next) => {
  const { sequelize } = require('../models');
  const t = await sequelize.transaction();
  const fail = async (message, status = 400) => {
    await t.rollback();
    return error(res, message, status);
  };
  try {
    const payment = await RentPayment.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!payment) return fail('Payment not found', 404);
    if (['paid', 'cancelled'].includes(payment.status)) return fail('Due date can only be changed on unpaid invoices');

    const newDue = dayjs(req.body.due_date);
    if (!req.body.due_date || !newDue.isValid()) return fail('A valid new due date is required');

    const actualDue = payment.original_due_date || payment.due_date;
    const quote = extensionQuote(payment, actualDue, newDue);
    if (quote.days > 366) return fail('Due date cannot be extended by more than a year');

    const rawCharge = req.body.extension_charge;
    const charge = round2(rawCharge === undefined || rawCharge === null || rawCharge === ''
      ? quote.suggested_charge
      : Number(rawCharge));
    if (!Number.isFinite(charge) || charge < 0) return fail('Extension charge must be 0 or more');

    const paid = Number(payment.paid_amount) || 0;
    const newTotal = round2(Number(payment.total_amount) - (Number(payment.extension_charge) || 0) + charge);
    if (paid - newTotal > 0.009) return fail('Invoice total cannot be less than the amount already paid');

    if (req.body.apply_to_future && !(await isLatestInvoice(payment, t))) {
      return fail('"Apply to future months" is only available on the tenant\'s latest invoice');
    }

    let status = 'pending';
    if (paid > 0) status = paid + 0.009 >= newTotal ? 'paid' : 'partial';
    const reason = String(req.body.reason || '').trim().slice(0, 300);
    const signedDays = `${quote.days > 0 ? '+' : ''}${quote.days} day${Math.abs(quote.days) === 1 ? '' : 's'}`;
    const noteLine = `[${dayjs().format('DD MMM YYYY')}] Due date changed from ${dayjs(payment.due_date).format('DD MMM YYYY')} `
      + `to ${newDue.format('DD MMM YYYY')} (${signedDays} vs original ${dayjs(actualDue).format('DD MMM YYYY')}), `
      + `extension charge ₹${charge.toFixed(2)}${reason ? ` — ${reason}` : ''}`;

    await payment.update({
      due_date: newDue.format('YYYY-MM-DD'),
      original_due_date: quote.days === 0 ? null : dayjs(actualDue).format('YYYY-MM-DD'),
      extension_days: quote.days,
      extension_charge: charge,
      total_amount: newTotal,
      status,
      paid_date: status === 'paid' ? (payment.paid_date || dayjs().format('YYYY-MM-DD')) : payment.paid_date,
      notes: [payment.notes, noteLine].filter(Boolean).join('\n'),
    }, { transaction: t });

    let future = null;
    if (req.body.apply_to_future) {
      const tenant = await Tenant.findByPk(payment.tenant_id, { transaction: t });
      const day = newDue.date();
      const nextDue = nextCycleAfter(newDue, day).format('YYYY-MM-DD');
      await tenant.update({ rent_due_day: day, next_rent_due_date: nextDue }, { transaction: t });
      future = { rent_due_day: day, next_rent_due_date: nextDue };
    }

    await t.commit();
    return success(res, { ...payment.toJSON(), quote, future }, 'Due date updated');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * Payment log for a date range. Uses finance transactions (one per collection / split) and falls back
 * to the invoice itself for paid invoices that pre-date transaction logging.
 */
exports.getHistory = async (req, res, next) => {
  try {
    const from = dayjs(req.query.from || dayjs().subtract(29, 'day'));
    const to = dayjs(req.query.to || dayjs());
    if (!from.isValid() || !to.isValid() || from.isAfter(to)) {
      return error(res, 'Invalid date range', 400);
    }
    const range = [from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD')];
    const hostelWhere = req.query.hostelId ? { hostel_id: Number(req.query.hostelId) } : {};

    const txns = await FinanceTransaction.findAll({
      where: {
        ...hostelWhere,
        type: 'income',
        reference_type: 'rent_payment',
        transaction_date: { [Op.between]: range },
      },
      order: [['transaction_date', 'DESC'], ['id', 'DESC']],
    });
    const txnPaymentIds = [...new Set(txns.map((ft) => ft.reference_id).filter(Boolean))];

    const paidInRange = await RentPayment.findAll({
      where: { ...hostelWhere, paid_amount: { [Op.gt]: 0 }, paid_date: { [Op.between]: range } },
      attributes: ['id'],
    });
    const candidateIds = paidInRange.map((p) => p.id).filter((pid) => !txnPaymentIds.includes(pid));
    const logged = candidateIds.length
      ? await FinanceTransaction.findAll({
        where: { reference_type: 'rent_payment', reference_id: { [Op.in]: candidateIds } },
        attributes: ['reference_id'],
      })
      : [];
    const loggedIds = new Set(logged.map((ft) => ft.reference_id));
    const legacyIds = candidateIds.filter((pid) => !loggedIds.has(pid));

    const allIds = [...txnPaymentIds, ...legacyIds];
    const payments = allIds.length
      ? await RentPayment.findAll({ where: { id: { [Op.in]: allIds } }, include: LIST_INCLUDES() })
      : [];
    const byId = new Map(payments.map((p) => [p.id, p]));

    const entries = [
      ...txns.map((ft) => {
        const p = byId.get(ft.reference_id);
        const desc = ft.description || '';
        const methodMatch = /\(([^)]+)\)/.exec(desc);
        const refMatch = / - Ref (.+)$/.exec(desc);
        return {
          id: `t${ft.id}`,
          date: ft.transaction_date,
          amount: Number(ft.amount) || 0,
          method: (methodMatch && METHOD_BY_LABEL[methodMatch[1]]) || p?.payment_method || 'cash',
          reference: refMatch ? refMatch[1] : (p?.payment_reference || ''),
          type: desc.startsWith('Registration') ? 'Registration' : 'Rent',
          ...invoiceInfo(p),
        };
      }),
      ...legacyIds.map((pid) => {
        const p = byId.get(pid);
        return {
          id: `p${pid}`,
          date: p?.paid_date,
          amount: Number(p?.paid_amount) || 0,
          method: p?.payment_method || 'cash',
          reference: p?.payment_reference || '',
          type: 'Rent',
          ...invoiceInfo(p),
        };
      }),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, { amount: 0, count: 0 }]));
    entries.forEach((entry) => {
      const bucket = byMethod[entry.method] || (byMethod[entry.method] = { amount: 0, count: 0 });
      bucket.amount += entry.amount;
      bucket.count += 1;
    });

    return success(res, {
      from: range[0],
      to: range[1],
      entries,
      summary: {
        total: entries.reduce((sum, entry) => sum + entry.amount, 0),
        count: entries.length,
        by_method: byMethod,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unpaid invoices grouped by how close/far they are from the due date:
 * reminder = due today or within the next 2 days, pending = 1-3 days late (grace), overdue = more than 3 days late.
 */
exports.getDueTracker = async (req, res, next) => {
  try {
    await runRentCycle().catch(() => {});
    const where = { status: { [Op.in]: UNPAID_STATUSES } };
    if (req.query.hostelId) where.hostel_id = Number(req.query.hostelId);

    const rows = await RentPayment.findAll({ where, include: LIST_INCLUDES(), order: [['due_date', 'ASC']] });
    const today = dayjs().startOf('day');
    const buckets = { reminder: [], pending: [], overdue: [] };
    const byTenant = new Map();

    rows.forEach((p) => {
      const total = Number(p.total_amount) || 0;
      const paid = Number(p.paid_amount) || 0;
      const balance = Math.round((total - paid) * 100) / 100;
      if (balance <= 0 || !p.due_date) return;

      const daysPastDue = today.diff(dayjs(p.due_date).startOf('day'), 'day');
      let bucket = null;
      if (daysPastDue > PENDING_GRACE_DAYS) bucket = 'overdue';
      else if (daysPastDue >= 1) bucket = 'pending';
      else if (daysPastDue >= -REMINDER_DAYS) bucket = 'reminder';
      if (!bucket) return;

      if (daysPastDue >= 1) {
        const stats = byTenant.get(p.tenant_id) || { months: 0, amount: 0, oldest: p.due_date };
        stats.months += 1;
        stats.amount = round2(stats.amount + balance);
        if (p.due_date < stats.oldest) stats.oldest = p.due_date;
        byTenant.set(p.tenant_id, stats);
      }

      buckets[bucket].push({
        id: p.id,
        tenant_id: p.tenant_id,
        due_date: p.due_date,
        original_due_date: p.original_due_date,
        extension_days: p.extension_days || 0,
        extension_charge: Number(p.extension_charge) || 0,
        status: p.status,
        total_amount: total,
        paid_amount: paid,
        balance,
        days_past_due: daysPastDue,
        months_past_due: today.diff(dayjs(p.due_date).startOf('day'), 'month'),
        days_until_due: Math.max(0, -daysPastDue),
        grace_days_left: bucket === 'pending' ? PENDING_GRACE_DAYS - daysPastDue : null,
        ...invoiceInfo(p),
      });
    });

    Object.values(buckets).flat().forEach((item) => {
      const stats = byTenant.get(item.tenant_id);
      item.tenant_months_due = stats?.months || 0;
      item.tenant_total_due = stats?.amount || 0;
      item.tenant_oldest_due = stats?.oldest || null;
    });

    buckets.overdue.sort((a, b) => b.days_past_due - a.days_past_due);
    const summary = Object.fromEntries(Object.entries(buckets).map(([key, list]) => [
      key,
      { count: list.length, amount: list.reduce((sum, item) => sum + item.balance, 0) },
    ]));

    return success(res, {
      today: today.format('YYYY-MM-DD'),
      grace_days: PENDING_GRACE_DAYS,
      reminder_days: REMINDER_DAYS,
      buckets,
      summary,
    });
  } catch (err) {
    next(err);
  }
};

/** Generic Excel export: { title, columns: [{ header, key, width?, type? }], rows, summary?: [[label, value]] } */
exports.exportExcel = async (req, res, next) => {
  try {
    const ExcelJS = require('exceljs');
    const { title = 'Export', subtitle = '', columns = [], rows = [], summary = [] } = req.body || {};
    if (!Array.isArray(columns) || !columns.length || !Array.isArray(rows)) {
      return error(res, 'Columns and rows are required', 400);
    }
    if (rows.length > 20000) return error(res, 'Too many rows to export', 400);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VitaStay';
    const sheet = workbook.addWorksheet(String(title).slice(0, 31).replace(/[\\/?*[\]:]/g, '-'));

    sheet.mergeCells(1, 1, 1, columns.length);
    sheet.getCell(1, 1).value = title;
    sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF002D62' } };
    sheet.mergeCells(2, 1, 2, columns.length);
    sheet.getCell(2, 1).value = subtitle || `Generated on ${dayjs().format('DD MMM YYYY, hh:mm A')}`;
    sheet.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF6B7C8F' } };

    let rowIndex = 4;
    if (Array.isArray(summary) && summary.length) {
      summary.forEach(([label, value]) => {
        sheet.getCell(rowIndex, 1).value = label;
        sheet.getCell(rowIndex, 1).font = { bold: true };
        sheet.getCell(rowIndex, 2).value = value;
        rowIndex += 1;
      });
      rowIndex += 1;
    }

    const headerRow = sheet.getRow(rowIndex);
    columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002D62' } };
      cell.alignment = { vertical: 'middle' };
      sheet.getColumn(i + 1).width = col.width || Math.max(12, String(col.header).length + 4);
    });
    sheet.views = [{ state: 'frozen', ySplit: rowIndex }];

    rows.forEach((row) => {
      rowIndex += 1;
      const excelRow = sheet.getRow(rowIndex);
      columns.forEach((col, i) => {
        const cell = excelRow.getCell(i + 1);
        const value = row?.[col.key];
        if (col.type === 'currency') {
          cell.value = Number(value) || 0;
          cell.numFmt = '"₹"#,##0.00';
        } else if (col.type === 'number') {
          cell.value = Number(value) || 0;
        } else {
          cell.value = value == null ? '' : String(value);
        }
      });
    });

    const safeName = String(title).replace(/[^\w-]+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${safeName}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

exports.getPending = async (req, res, next) => {
  try {
    const where = { status: { [Op.in]: ['pending', 'partial', 'overdue'] } };
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;

    const payments = await RentPayment.findAll({
      where,
      include: [{ model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name', 'phone'] }] }],
      order: [['due_date', 'ASC']],
    });

    return success(res, payments);
  } catch (err) {
    next(err);
  }
};
