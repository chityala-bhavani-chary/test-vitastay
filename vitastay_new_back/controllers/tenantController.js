const crypto = require('crypto');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const {
  Tenant, User, Room, Bed, Hostel, BedAssignment, RentPayment, TenantDocument,
} = require('../models');
const { success, created, paginated, error } = require('../utils/response');
const { getPagination, getSort } = require('../utils/pagination');
const { passwordFields, hashPassword } = require('../helpers/password');
const { generateReceiptNumber, generateInvoiceNumber } = require('../helpers/token');
const { nextCycleAfter } = require('../services/rentCycle');

const USER_FIELDS = new Set(['email', 'password', 'first_name', 'last_name', 'phone']);
const SKIP_FIELDS = new Set([
  ...USER_FIELDS,
  'identities',
  'hostel_id',
  'room_id',
  'bed_id',
  'status',
  'create_login',
  'confirm_password',
  'room_type',
  'payments',
  'rent_due_day',
  'next_rent_due_date',
]);

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_LOGIN_EMAIL_DOMAIN = 'nologin.vitastay.local';
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank', 'online'];
const PAYMENT_METHOD_LABELS = {
  cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank Transfer', online: 'Online',
};
const MOBILE_FIELDS = [
  ['phone', 'Mobile number'],
  ['alternate_phone', 'Alternate mobile number'],
  ['emergency_contact_phone', 'Emergency contact mobile number'],
  ['emergency_contact_alternate', 'Emergency alternate number'],
  ['guardian_phone', 'Guardian mobile number'],
];

const ID_FORMATS = {
  aadhar: { label: 'Aadhaar', pattern: /^\d{12}$/, hint: '12 digits' },
  pan: { label: 'PAN', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/, hint: '5 letters + 4 digits + 1 letter' },
  passport: { label: 'Passport', pattern: /^[A-Z][0-9]{7}$/, hint: '1 letter + 7 digits' },
  driving_license: { label: 'Driving License', pattern: /^[A-Z]{2}[0-9]{2}[0-9A-Z]{6,12}$/, hint: 'state code + RTO code + number' },
  voter_id: { label: 'Voter ID', pattern: /^[A-Z]{3}[0-9]{7}$/, hint: '3 letters + 7 digits' },
};

/** Uppercases and strips spaces/hyphens in place; returns an error message for the first invalid ID. */
const normalizeAndValidateIdentities = (identities) => {
  for (let i = 0; i < identities.length; i += 1) {
    const identity = identities[i];
    if (!identity?.id_number) continue;
    identity.id_number = String(identity.id_number).toUpperCase().replace(/[\s-]/g, '');
    const format = ID_FORMATS[identity.document_type || identity.id_type];
    if (format && !format.pattern.test(identity.id_number)) {
      return `ID #${i + 1}: invalid ${format.label} number (${format.hint})`;
    }
  }
  return null;
};

const statusFilter = (value) => {
  const list = String(value).split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 1 ? { [Op.in]: list } : list[0];
};

const INACTIVE_STATUSES = ['inactive', 'moved_out'];
const DUE_STATUSES = ['pending', 'partial', 'overdue'];

/** Rows listed from a branch database carry source=branch; everything else lives in the master DB. */
const resolveTenantDb = async (req) => {
  const src = { ...req.query, ...req.body };
  const hostelId = Number(src.hostelId || src.hostel_id) || null;
  if (hostelId && src.source === 'branch') {
    const { getModelsForHostel } = require('../helpers/hostelContext');
    const ctx = await getModelsForHostel(hostelId);
    if (ctx.hostel) return ctx.models;
  }
  return require('../models');
};

const getPendingDues = async (db, tenantId, transaction) => {
  const rows = await db.RentPayment.findAll({
    where: { tenant_id: tenantId, status: { [Op.in]: DUE_STATUSES } },
    order: [['due_date', 'ASC']],
    transaction,
  });
  const items = rows
    .map((p) => {
      const total = Number(p.total_amount) || 0;
      const paid = Number(p.paid_amount) || 0;
      return {
        id: p.id,
        invoice_number: p.invoice_number,
        month_year: p.month_year,
        due_date: p.due_date,
        status: p.status,
        total_amount: total,
        paid_amount: paid,
        balance: Math.max(0, Math.round((total - paid) * 100) / 100),
      };
    })
    .filter((item) => item.balance > 0);
  return { items, total: items.reduce((sum, item) => sum + item.balance, 0) };
};

const validateMobileFields = (body) => {
  for (const [field, label] of MOBILE_FIELDS) {
    const value = body[field];
    if (value === undefined || value === null || value === '') continue;
    if (!MOBILE_REGEX.test(String(value).trim())) {
      return `${label} must be 10 digits and start with 6, 7, 8 or 9`;
    }
  }
  return null;
};

const placeholderEmail = () => `tenant.${crypto.randomUUID()}@${NO_LOGIN_EMAIL_DOMAIN}`;

const parsePaymentSplits = (value) => parseMaybeJson(value, [])
  .map((row) => ({
    method: String(row?.method || '').toLowerCase(),
    amount: Math.round((Number(row?.amount) || 0) * 100) / 100,
    reference: row?.reference ? String(row.reference).trim().slice(0, 100) : '',
  }))
  .filter((row) => row.amount > 0);

const parseMaybeJson = (value, fallback = []) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toBool = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const splitFullName = (fullName = '', firstName = '', lastName = '') => {
  const cleaned = String(fullName || '').trim();
  if (!cleaned) {
    return {
      first_name: firstName || 'Tenant',
      last_name: lastName || 'User',
    };
  }
  const parts = cleaned.split(/\s+/);
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' ') || parts[0],
  };
};

const pickTenantFields = (body) => {
  const data = {};
  Object.keys(body || {}).forEach((key) => {
    if (SKIP_FIELDS.has(key)) return;
    if (body[key] === undefined) return;
    data[key] = body[key];
  });

  data.same_as_permanent = toBool(body.same_as_permanent, true);
  data.is_student = toBool(body.is_student, false);

  if (data.same_as_permanent && data.permanent_address) {
    data.current_address = data.permanent_address;
  }

  if (data.permanent_address && !data.address) {
    data.address = data.permanent_address;
  }

  ['monthly_rent', 'deposit_amount', 'advance_amount'].forEach((field) => {
    if (data[field] !== undefined && data[field] !== '') {
      data[field] = Number(data[field]) || 0;
    }
  });

  return data;
};

const syncIdNumberColumns = (tenantData, identities = []) => {
  identities.forEach((identity) => {
    const type = identity.document_type || identity.id_type;
    const number = identity.id_number;
    if (!type || !number) return;
    if (type === 'aadhar') tenantData.aadhar = number;
    if (type === 'pan') tenantData.pan = number;
    if (type === 'passport') tenantData.passport = number;
    if (type === 'driving_license') tenantData.driving_license = number;
    if (type === 'voter_id') tenantData.voter_id = number;
  });
};

const saveIdentityDocuments = async ({ tenantId, identities, files, userId, transaction, DocumentModel }) => {
  const Doc = DocumentModel || TenantDocument;
  const docs = [];
  for (let i = 0; i < identities.length; i += 1) {
    const identity = identities[i];
    const type = identity.document_type || identity.id_type;
    const number = identity.id_number;
    if (!type || !number) continue;

    const front = files?.[`id_${i}_front`]?.[0] || (i === 0 ? files?.id_front?.[0] : null);
    const back = files?.[`id_${i}_back`]?.[0] || (i === 0 ? files?.id_back?.[0] : null);
    if (!front) continue;

    const labels = {
      aadhar: 'Aadhaar Card',
      pan: 'PAN Card',
      passport: 'Passport',
      driving_license: 'Driving License',
      voter_id: 'Voter ID',
      other: 'ID Document',
    };

    docs.push({
      tenant_id: tenantId,
      document_type: type,
      title: `${labels[type] || 'ID'} - ${number}`,
      id_number: number,
      file_path: `/uploads/tenants/${front.filename}`,
      back_file_path: back ? `/uploads/tenants/${back.filename}` : null,
      expiry_date: identity.expiry_date || null,
      file_size: front.size,
      mime_type: front.mimetype,
      uploaded_by: userId,
    });
  }

  if (docs.length) {
    await Doc.bulkCreate(docs, { transaction });
  }
  return docs;
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const hostelId = req.query.hostelId ? Number(req.query.hostelId) : null;
    const { getModelsForHostel } = require('../helpers/hostelContext');
    const master = require('../models');

    if (hostelId) {
      const ctx = await getModelsForHostel(hostelId);
      if (!ctx.hostel) return error(res, 'Hostel not found', 404);
      if (ctx.hostel.status === 'pending_approval') {
        return paginated(res, [], { page, limit, total: 0 });
      }

      const where = ctx.isolated ? {} : { hostel_id: hostelId };
      if (req.query.status) where.status = statusFilter(req.query.status);

      const { count, rows } = await ctx.models.Tenant.findAndCountAll({
        where,
        include: [
          { model: ctx.models.Room, as: 'room', attributes: ['id', 'room_number', 'floor'], required: false },
          { model: ctx.models.Bed, as: 'bed', attributes: ['id', 'bed_number'], required: false },
        ],
        order: getSort(req.query, ['created_at', 'move_in_date']),
        limit,
        offset,
      });

      const userIds = rows.map((r) => r.user_id).filter(Boolean);
      const users = userIds.length
        ? await master.User.findAll({
          where: { id: userIds },
          attributes: { exclude: ['password'] },
        })
        : [];
      const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

      const mapped = rows.map((row) => {
        const json = row.toJSON();
        json.user = userMap[row.user_id] || null;
        json.hostel = { id: ctx.hostel.id, name: ctx.hostel.name, database_name: ctx.databaseName };
        if (ctx.isolated) json.source = 'branch';
        return json;
      });

      return paginated(res, mapped, { page, limit, total: count });
    }

    const where = {};
    if (req.query.status) where.status = statusFilter(req.query.status);
    if (req.query.roomId) where.room_id = req.query.roomId;

    const { count, rows } = await Tenant.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: { exclude: ['password'] } },
        { model: Hostel, as: 'hostel', attributes: ['id', 'name', 'database_name'] },
        { model: Room, as: 'room', attributes: ['id', 'room_number', 'floor'] },
        { model: Bed, as: 'bed', attributes: ['id', 'bed_number'] },
      ],
      order: getSort(req.query, ['created_at', 'move_in_date']),
      limit,
      offset,
    });

    return paginated(res, rows, { page, limit, total: count });
  } catch (err) {
    next(err);
  }
};

const HOSTEL_BILL_ATTRIBUTES = ['id', 'name', 'address', 'city', 'state', 'pincode', 'contact_phone', 'contact_email'];
const SAFE_USER_ATTRIBUTES = { exclude: ['password'] };

exports.getById = async (req, res, next) => {
  try {
    const master = require('../models');
    const db = await resolveTenantDb(req);

    if (db === master) {
      const tenant = await Tenant.findByPk(req.params.id, {
        include: [
          { model: User, as: 'user', attributes: SAFE_USER_ATTRIBUTES },
          'hostel', 'room', 'bed', 'documents', 'rentPayments',
        ],
      });
      if (!tenant) return error(res, 'Tenant not found', 404);
      return success(res, tenant);
    }

    const tenant = await db.Tenant.findByPk(req.params.id, {
      include: [
        { model: db.Room, as: 'room', required: false },
        { model: db.Bed, as: 'bed', required: false },
        { model: db.TenantDocument, as: 'documents', required: false },
      ],
    });
    if (!tenant) return error(res, 'Tenant not found', 404);
    const json = tenant.toJSON();
    json.user = await master.User.findByPk(tenant.user_id, { attributes: SAFE_USER_ATTRIBUTES });
    json.hostel = await master.Hostel.findByPk(tenant.hostel_id, { attributes: HOSTEL_BILL_ATTRIBUTES });
    json.source = 'branch';
    return success(res, json);
  } catch (err) {
    next(err);
  }
};

const METHOD_BY_LABEL = Object.fromEntries(Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => [label, key]));

const mapTransaction = (ft) => {
  const description = ft.description || '';
  const methodMatch = /\(([^)]+)\)/.exec(description);
  const refMatch = / - Ref (.+)$/.exec(description);
  return {
    id: ft.id,
    amount: Number(ft.amount) || 0,
    transaction_date: ft.transaction_date,
    description,
    method: methodMatch ? METHOD_BY_LABEL[methodMatch[1]] || null : null,
    reference: refMatch ? refMatch[1] : '',
  };
};

exports.getPayments = async (req, res, next) => {
  try {
    const master = require('../models');
    const db = await resolveTenantDb(req);
    const tenant = await db.Tenant.findByPk(req.params.id);
    if (!tenant) return error(res, 'Tenant not found', 404);

    const payments = await db.RentPayment.findAll({
      where: { tenant_id: tenant.id },
      include: [{ model: db.Room, as: 'room', attributes: ['id', 'room_number', 'floor'], required: false }],
      order: [['due_date', 'DESC'], ['id', 'DESC']],
    });

    const ids = payments.map((p) => p.id);
    const transactions = ids.length
      ? await db.FinanceTransaction.findAll({
        where: { reference_type: 'rent_payment', reference_id: { [Op.in]: ids } },
        order: [['id', 'ASC']],
      })
      : [];
    const txnsByPayment = transactions.reduce((acc, ft) => {
      (acc[ft.reference_id] = acc[ft.reference_id] || []).push(mapTransaction(ft));
      return acc;
    }, {});

    const summary = { billed: 0, paid: 0, outstanding: 0, deposit: Number(tenant.deposit_amount) || 0 };
    const rows = payments.map((p) => {
      const json = p.toJSON();
      const txns = txnsByPayment[p.id] || [];
      const total = Number(json.total_amount) || 0;
      const paid = Number(json.paid_amount) || 0;
      if (json.status !== 'cancelled') {
        summary.billed += total;
        summary.paid += paid;
        summary.outstanding += Math.max(0, total - paid);
      }
      json.transactions = txns;
      json.is_registration = txns.some((t) => t.description.startsWith('Registration payment'));
      json.splits = json.is_registration
        ? txns.filter((t) => t.method).map(({ method, amount, reference }) => ({ method, amount, reference }))
        : null;
      return json;
    });

    const hostel = await master.Hostel.findByPk(tenant.hostel_id, { attributes: HOSTEL_BILL_ATTRIBUTES });
    return success(res, { hostel, summary, payments: rows });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  const master = require('../models');
  const { getModelsForHostel } = require('../helpers/hostelContext');
  const t = await master.sequelize.transaction();
  let hostelTx = null;
  try {
    const body = req.body || {};
    const email = body.email ? String(body.email).trim().toLowerCase() : '';
    const phone = body.phone ? String(body.phone).trim() : '';
    const fullName = body.full_name;
    const names = splitFullName(fullName, body.first_name, body.last_name);
    const hostel_id = Number(body.hostel_id);
    let room_id = body.room_id ? Number(body.room_id) : null;
    const bed_id = body.bed_id ? Number(body.bed_id) : null;
    const createLogin = toBool(body.create_login, false);

    if (!fullName || !hostel_id || !phone) {
      await t.rollback();
      return error(res, 'Full name, mobile and hostel are required', 400);
    }

    const mobileError = validateMobileFields(body);
    if (mobileError) {
      await t.rollback();
      return error(res, mobileError, 400);
    }

    if (email && !EMAIL_REGEX.test(email)) {
      await t.rollback();
      return error(res, 'Enter a valid email address', 400);
    }

    if (createLogin) {
      if (!email) {
        await t.rollback();
        return error(res, 'Email is required to create tenant login', 400);
      }
      if (!body.password || String(body.password).length < 6) {
        await t.rollback();
        return error(res, 'Login password must be at least 6 characters', 400);
      }
    }

    const catalogHostel = await master.Hostel.findByPk(hostel_id);
    if (!catalogHostel) {
      await t.rollback();
      return error(res, 'Hostel/branch not found', 404);
    }
    if (catalogHostel.status === 'pending_approval') {
      await t.rollback();
      return error(res, 'Hostel/branch is awaiting Super Admin approval', 403);
    }
    if (createLogin) {
      const { entitlementsOf, UPGRADE_COPY } = require('../services/ownerPlan');
      if (!entitlementsOf(catalogHostel).tenant_portal) {
        await t.rollback();
        return error(res, UPGRADE_COPY.tenant_portal, 403);
      }
    }

    const identities = parseMaybeJson(body.identities, []);
    if (!identities.length || !identities[0]?.id_number) {
      await t.rollback();
      return error(res, 'At least one identity proof is required', 400);
    }

    const idError = normalizeAndValidateIdentities(identities);
    if (idError) {
      await t.rollback();
      return error(res, idError, 400);
    }

    for (let i = 0; i < identities.length; i += 1) {
      const type = identities[i]?.document_type || identities[i]?.id_type;
      const front = req.files?.[`id_${i}_front`]?.[0] || (i === 0 ? req.files?.id_front?.[0] : null);
      const back = req.files?.[`id_${i}_back`]?.[0] || (i === 0 ? req.files?.id_back?.[0] : null);
      if (!front) {
        await t.rollback();
        return error(res, `Front image is required for ID #${i + 1}`, 400);
      }
      if (type !== 'pan' && !back) {
        await t.rollback();
        return error(res, `Back image is required for ID #${i + 1} (only PAN card is exempt)`, 400);
      }
    }

    if (toBool(body.is_student, false) && !body.guardian_name) {
      await t.rollback();
      return error(res, 'Parent/Guardian details are mandatory for students', 400);
    }

    const payments = parsePaymentSplits(body.payments);
    if (payments.some((p) => !PAYMENT_METHODS.includes(p.method))) {
      await t.rollback();
      return error(res, 'Invalid payment method', 400);
    }

    if (email) {
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        await t.rollback();
        return error(res, 'Email already exists', 409);
      }
    }

    // Tenant rows require a user record; tenants without login get a disabled, password-less profile user.
    const credentialFields = createLogin
      ? await passwordFields(body.password)
      : { password: await hashPassword(crypto.randomBytes(32).toString('hex')) };

    const user = await User.create({
      email: email || placeholderEmail(),
      ...credentialFields,
      first_name: names.first_name,
      last_name: names.last_name,
      phone,
      role: 'tenant',
      is_active: createLogin,
    }, { transaction: t });

    const ctx = await getModelsForHostel(catalogHostel);
    const db = ctx.models;
    hostelTx = ctx.isolated ? await db.sequelize.transaction() : t;

    let bed = null;
    let room = null;
    if (bed_id) {
      bed = await db.Bed.findByPk(bed_id, { transaction: hostelTx });
      if (!bed || (room_id && bed.room_id !== room_id)) {
        await t.rollback();
        if (ctx.isolated) await hostelTx.rollback();
        return error(res, 'Selected bed not found in this room', 404);
      }
      if (bed.status !== 'vacant') {
        await t.rollback();
        if (ctx.isolated) await hostelTx.rollback();
        return error(res, `Bed ${bed.bed_number} is no longer available. Please pick another bed.`, 409);
      }
      room_id = bed.room_id;
      await bed.update({ status: 'occupied' }, { transaction: hostelTx });
      await db.Room.update({ status: 'occupied' }, { where: { id: bed.room_id }, transaction: hostelTx });
    }
    if (room_id) room = await db.Room.findByPk(room_id, { transaction: hostelTx });

    const tenantData = pickTenantFields(body);
    tenantData.full_name = fullName;
    if (req.files?.photo?.[0]) {
      tenantData.photo = `/uploads/tenants/${req.files.photo[0].filename}`;
    }
    syncIdNumberColumns(tenantData, identities);

    const tenant = await db.Tenant.create({
      user_id: user.id,
      hostel_id,
      room_id,
      bed_id,
      move_in_date: tenantData.move_in_date || dayjs().format('YYYY-MM-DD'),
      status: 'active',
      ...tenantData,
    }, { transaction: hostelTx });

    await saveIdentityDocuments({
      tenantId: tenant.id,
      identities,
      files: req.files,
      userId: req.user.id,
      transaction: hostelTx,
      DocumentModel: db.TenantDocument,
    });

    if (bed_id) {
      await db.BedAssignment.create({
        bed_id,
        tenant_id: tenant.id,
        assigned_by: req.user.id,
        status: 'active',
      }, { transaction: hostelTx });
    }

    let registrationPayment = null;
    const rentAmount = Number(tenantData.monthly_rent) || 0;
    const depositAmount = Number(tenantData.deposit_amount) || 0;
    const billTotal = rentAmount + depositAmount;
    const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);

    if (paidTotal - billTotal > 0.009) {
      await t.rollback();
      if (ctx.isolated) await hostelTx.rollback();
      return error(res, 'Total paid amount cannot exceed rent + deposit', 400);
    }

    if (billTotal > 0) {
      const moveIn = dayjs(tenant.move_in_date || undefined);
      const today = dayjs().format('YYYY-MM-DD');
      let paymentStatus = 'pending';
      if (paidTotal > 0) paymentStatus = paidTotal + 0.009 >= billTotal ? 'paid' : 'partial';
      const primary = [...payments].sort((a, b) => b.amount - a.amount)[0];
      const splitSummary = payments
        .map((p) => `${PAYMENT_METHOD_LABELS[p.method]} ₹${p.amount}${p.reference ? ` (Ref: ${p.reference})` : ''}`)
        .join(', ');

      registrationPayment = await db.RentPayment.create({
        tenant_id: tenant.id,
        hostel_id,
        room_id,
        amount: rentAmount,
        deposit_amount: depositAmount,
        total_amount: billTotal,
        paid_amount: paidTotal,
        due_date: moveIn.format('YYYY-MM-DD'),
        paid_date: paidTotal > 0 ? today : null,
        payment_method: primary?.method || 'cash',
        payment_reference: payments.map((p) => p.reference).filter(Boolean).join(', ').slice(0, 255) || null,
        month_year: moveIn.format('YYYY-MM'),
        receipt_number: generateReceiptNumber(),
        invoice_number: generateInvoiceNumber(),
        status: paymentStatus,
        notes: payments.length > 1 ? `Split payment: ${splitSummary}` : (splitSummary || null),
        collected_by: paidTotal > 0 ? req.user.id : null,
      }, { transaction: hostelTx });

      for (const p of payments) {
        await db.FinanceTransaction.create({
          hostel_id,
          type: 'income',
          category: 'rent',
          amount: p.amount,
          reference_id: registrationPayment.id,
          reference_type: 'rent_payment',
          transaction_date: today,
          description: `Registration payment (${PAYMENT_METHOD_LABELS[p.method]}) - ${fullName}${p.reference ? ` - Ref ${p.reference}` : ''}`,
          created_by: req.user.id,
        }, { transaction: hostelTx });
      }
    }

    // Rent falls due every month on the joining date; the registration bill covers the first month.
    const joinDate = dayjs(tenant.move_in_date || undefined);
    await tenant.update({
      rent_due_day: joinDate.date(),
      next_rent_due_date: (registrationPayment ? nextCycleAfter(joinDate, joinDate.date()) : joinDate).format('YYYY-MM-DD'),
    }, { transaction: hostelTx });

    await t.commit();
    if (ctx.isolated && hostelTx) await hostelTx.commit();
    require('../services/occupancySnapshot').scheduleOccupancyRefresh(hostel_id);

    const result = await db.Tenant.findByPk(tenant.id, {
      include: [
        { model: db.Room, as: 'room', required: false },
        { model: db.Bed, as: 'bed', required: false },
        { model: db.TenantDocument, as: 'documents', required: false },
      ],
    });
    const payload = result?.toJSON?.() || result;
    payload.user = {
      id: user.id,
      email: email || null,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      has_login: createLogin,
    };
    payload.hostel = { id: catalogHostel.id, name: catalogHostel.name, database_name: ctx.databaseName };
    payload.registration_payment = registrationPayment
      ? {
        ...registrationPayment.toJSON(),
        splits: payments,
        room: room ? { id: room.id, room_number: room.room_number, floor: room.floor } : null,
        bed_number: bed?.bed_number || null,
      }
      : null;
    return created(res, payload, ctx.isolated
      ? `Tenant created in branch database "${ctx.databaseName}"`
      : 'Tenant created successfully');
  } catch (err) {
    try { await t.rollback(); } catch { /* ignore */ }
    try { if (hostelTx) await hostelTx.rollback(); } catch { /* ignore */ }
    next(err);
  }
};

exports.update = async (req, res, next) => {
  const { sequelize } = require('../models');
  const t = await sequelize.transaction();
  try {
    const tenant = await Tenant.findByPk(req.params.id, { include: ['user'], transaction: t });
    if (!tenant) {
      await t.rollback();
      return error(res, 'Tenant not found', 404);
    }

    const body = req.body || {};
    const mobileError = validateMobileFields(body);
    if (mobileError) {
      await t.rollback();
      return error(res, mobileError, 400);
    }
    if (body.status && INACTIVE_STATUSES.includes(body.status) && !INACTIVE_STATUSES.includes(tenant.status)) {
      await t.rollback();
      return error(res, 'Use "Mark Inactive" from the tenant list so dues are verified and the bed is released', 400);
    }
    const fullName = body.full_name || tenant.full_name;
    const names = splitFullName(fullName, body.first_name, body.last_name);
    const identities = parseMaybeJson(body.identities, []);
    const idError = normalizeAndValidateIdentities(identities);
    if (idError) {
      await t.rollback();
      return error(res, idError, 400);
    }

    await tenant.user.update({
      first_name: names.first_name,
      last_name: names.last_name,
      phone: body.phone !== undefined ? body.phone : tenant.user.phone,
      email: body.email || tenant.user.email,
    }, { transaction: t });

    const tenantData = pickTenantFields(body);
    if (fullName) tenantData.full_name = fullName;
    if (req.files?.photo?.[0]) {
      tenantData.photo = `/uploads/tenants/${req.files.photo[0].filename}`;
    }
    if (identities.length) syncIdNumberColumns(tenantData, identities);

    if (body.hostel_id) tenantData.hostel_id = Number(body.hostel_id);
    if (body.room_id !== undefined) tenantData.room_id = body.room_id ? Number(body.room_id) : null;
    if (body.bed_id !== undefined) tenantData.bed_id = body.bed_id ? Number(body.bed_id) : null;
    if (body.status) tenantData.status = body.status;

    await tenant.update(tenantData, { transaction: t });

    if (identities.length) {
      await saveIdentityDocuments({
        tenantId: tenant.id,
        identities,
        files: req.files,
        userId: req.user.id,
        transaction: t,
      });
    }

    await t.commit();
    const result = await Tenant.findByPk(tenant.id, {
      include: ['user', 'hostel', 'room', 'bed', 'documents'],
    });
    return success(res, result, 'Tenant updated successfully');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * DEC-04 — activate a pending online booking resident when they arrive / take keys.
 * Bed was already occupied on Confirm; this only flips tenant.status pending → active.
 */
exports.checkIn = async (req, res, next) => {
  try {
    const master = require('../models');
    const { getModelsForHostel } = require('../helpers/hostelContext');
    const { createAuditLog } = require('../helpers/audit');
    const hostelId = Number(req.body.hostel_id || req.body.hostelId || req.query.hostelId || req.query.hostel_id) || null;

    let tenant = null;
    let ctx = null;
    if (hostelId) {
      ctx = await getModelsForHostel(hostelId);
      tenant = await ctx.models.Tenant.findByPk(req.params.id);
    }
    if (!tenant) {
      tenant = await master.Tenant.findByPk(req.params.id);
      if (tenant) {
        ctx = await getModelsForHostel(tenant.hostel_id);
        if (ctx.isolated) {
          tenant = await ctx.models.Tenant.findByPk(req.params.id);
        }
      }
    }
    if (!tenant || !ctx?.hostel) return error(res, 'Tenant not found', 404);

    if (req.user.role === 'owner' && Number(ctx.hostel.owner_id) !== Number(req.user.id)) {
      return error(res, 'Forbidden', 403);
    }
    if (req.user.role === 'supervisor') {
      const { SupervisorHostel } = master;
      const assigned = await SupervisorHostel.findOne({
        where: { supervisor_id: req.user.id, hostel_id: ctx.hostel.id },
      });
      if (!assigned) return error(res, 'Forbidden', 403);
    }

    if (tenant.status === 'active') {
      return success(res, tenant, 'Already checked in');
    }
    if (tenant.status !== 'pending') {
      return error(res, 'Only pending residents can be checked in', 422);
    }
    if (!tenant.bed_id) {
      return error(res, 'This resident has no bed to check in to', 422);
    }

    await tenant.update({ status: 'active' });
    await createAuditLog({
      userId: req.user.id,
      action: 'TENANT_CHECK_IN',
      entityType: 'tenant',
      entityId: tenant.id,
      oldValues: { status: 'pending' },
      newValues: { status: 'active', bed_id: tenant.bed_id },
      req,
    });
    return success(res, tenant, 'Resident checked in');
  } catch (err) {
    next(err);
  }
};

exports.moveOut = async (req, res, next) => {
  const { sequelize } = require('../models');
  const t = await sequelize.transaction();
  try {
    const tenant = await Tenant.findByPk(req.params.id, { transaction: t });
    if (!tenant) {
      await t.rollback();
      return error(res, 'Tenant not found', 404);
    }

    await tenant.update({
      status: 'moved_out',
      move_out_date: req.body.move_out_date || dayjs().format('YYYY-MM-DD'),
    }, { transaction: t });

    if (tenant.bed_id) {
      await Bed.update({ status: 'vacant' }, { where: { id: tenant.bed_id }, transaction: t });
      await BedAssignment.update(
        { status: 'vacated', vacated_at: new Date() },
        { where: { tenant_id: tenant.id, status: 'active' }, transaction: t }
      );
      const vacantBeds = await Bed.count({ where: { room_id: tenant.room_id, status: 'vacant' }, transaction: t });
      const totalBeds = await Bed.count({ where: { room_id: tenant.room_id }, transaction: t });
      if (vacantBeds === totalBeds) {
        await Room.update({ status: 'vacant' }, { where: { id: tenant.room_id }, transaction: t });
      }
    }

    await t.commit();
    require('../services/occupancySnapshot').scheduleOccupancyRefresh(tenant.hostel_id);
    require('../services/vitaEyePrivacy').revokeStayForPerson({
      hostelId: tenant.hostel_id,
      personType: 'resident',
      personId: tenant.id,
      reason: 'moved_out',
    }).catch(() => {});
    return success(res, tenant, 'Tenant moved out successfully');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.getDues = async (req, res, next) => {
  try {
    const db = await resolveTenantDb(req);
    const tenant = await db.Tenant.findByPk(req.params.id, {
      include: [
        { model: db.Room, as: 'room', attributes: ['id', 'room_number', 'floor'], required: false },
        { model: db.Bed, as: 'bed', attributes: ['id', 'bed_number'], required: false },
      ],
    });
    if (!tenant) return error(res, 'Tenant not found', 404);

    const dues = await getPendingDues(db, tenant.id);
    return success(res, {
      tenant_id: tenant.id,
      status: tenant.status,
      room: tenant.room,
      bed: tenant.bed,
      deposit_amount: Number(tenant.deposit_amount) || 0,
      pending_amount: dues.total,
      pending_items: dues.items,
    });
  } catch (err) {
    next(err);
  }
};

exports.deactivate = async (req, res, next) => {
  let t = null;
  try {
    const db = await resolveTenantDb(req);
    t = await db.sequelize.transaction();

    const tenant = await db.Tenant.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!tenant) {
      await t.rollback();
      return error(res, 'Tenant not found', 404);
    }
    if (INACTIVE_STATUSES.includes(tenant.status)) {
      await t.rollback();
      return error(res, 'Tenant is already inactive', 400);
    }

    const dues = await getPendingDues(db, tenant.id, t);
    if (dues.total > 0) {
      await t.rollback();
      return error(
        res,
        `Tenant has pending dues of ₹${dues.total}. Collect the pending amount before marking inactive.`,
        409,
        { pending_amount: dues.total, pending_items: dues.items },
      );
    }

    const bedId = tenant.bed_id;
    const roomId = tenant.room_id;
    let vacatedBed = null;

    if (bedId) {
      const bed = await db.Bed.findByPk(bedId, { transaction: t });
      if (bed) {
        await bed.update({ status: 'vacant' }, { transaction: t });
        vacatedBed = { id: bed.id, bed_number: bed.bed_number };
      }
      await db.BedAssignment.update(
        { status: 'vacated', vacated_at: new Date() },
        { where: { tenant_id: tenant.id, status: 'active' }, transaction: t },
      );
    }

    await tenant.update({
      status: 'inactive',
      move_out_date: req.body.move_out_date || dayjs().format('YYYY-MM-DD'),
      bed_id: null,
      room_id: null,
    }, { transaction: t });

    if (roomId) {
      const totalBeds = await db.Bed.count({ where: { room_id: roomId }, transaction: t });
      const vacantBeds = await db.Bed.count({ where: { room_id: roomId, status: 'vacant' }, transaction: t });
      if (totalBeds > 0 && vacantBeds === totalBeds) {
        await db.Room.update({ status: 'vacant' }, { where: { id: roomId }, transaction: t });
      }
    }

    await t.commit();
    t = null;

    if (tenant.user_id) {
      await User.update({ is_active: false }, { where: { id: tenant.user_id, role: 'tenant' } });
    }

    require('../services/vitaEyePrivacy').revokeStayForPerson({
      hostelId: tenant.hostel_id,
      personType: 'resident',
      personId: tenant.id,
      reason: 'inactive',
    }).catch(() => {});

    return success(res, { id: tenant.id, status: tenant.status, vacated_bed: vacatedBed }, vacatedBed
      ? `Tenant marked inactive and bed ${vacatedBed.bed_number} is now available`
      : 'Tenant marked inactive');
  } catch (err) {
    if (t) {
      try { await t.rollback(); } catch { /* ignore */ }
    }
    next(err);
  }
};
