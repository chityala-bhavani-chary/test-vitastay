/**
 * Minimal ERP fixtures for TC-E occupancy / rent / RBAC tests.
 * Seeded only onto the dedicated test database (see tests/setup.js).
 */
const dayjs = require('dayjs');
const { hashPassword } = require('../../helpers/password');
const { generateReceiptNumber, generateInvoiceNumber } = require('../../helpers/token');

const PASSWORD = 'TestPass123!';

const assertSafeTestDatabase = (sequelize) => {
  const name = sequelize.config?.database || sequelize.getDatabaseName?.();
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Refusing to reset the database outside NODE_ENV=test');
  }
  if (!String(name).endsWith('_test')) {
    throw new Error(`Refusing to reset non-test database "${name}"`);
  }
};

const resetAndSeed = async () => {
  const db = require('../../models');
  assertSafeTestDatabase(db.sequelize);
  await db.sequelize.query('DROP TABLE IF EXISTS leave_requests');
  await db.sequelize.sync({ force: true });
  const { ensureActiveAssignmentUnique } = require('../../database/migrate-bed-assignment-unique');
  await ensureActiveAssignmentUnique(db.sequelize, () => {});
  const { ensureOwnerPlanSchema } = require('../../database/migrate-owner-plans');
  await ensureOwnerPlanSchema(db.sequelize, () => {});
  const { ensureFaceEnrollmentSchema } = require('../../database/migrate-face-enrollments');
  await ensureFaceEnrollmentSchema(db.sequelize, () => {});
  const { ensureVitaEyeMatchSchema } = require('../../database/migrate-vita-eye-match');
  await ensureVitaEyeMatchSchema(db.sequelize, () => {});
  const { ensureBookingModelSchema } = require('../../database/migrate-booking-model');
  await ensureBookingModelSchema(db.sequelize, () => {});

  const password = await hashPassword(PASSWORD);
  const userAttrs = {
    password,
    is_active: true,
    email_verified: true,
  };

  const superAdmin = await db.User.create({
    ...userAttrs,
    email: 'sa@test.vitastay.local',
    first_name: 'Super',
    last_name: 'Admin',
    role: 'super_admin',
  });
  const owner = await db.User.create({
    ...userAttrs,
    email: 'owner@test.vitastay.local',
    first_name: 'Test',
    last_name: 'Owner',
    role: 'owner',
    phone: '9876500001',
  });
  const tenantUser = await db.User.create({
    ...userAttrs,
    email: 'tenant@test.vitastay.local',
    first_name: 'Test',
    last_name: 'Tenant',
    role: 'tenant',
    phone: '9876500002',
  });
  const otherTenantUser = await db.User.create({
    ...userAttrs,
    email: 'other@test.vitastay.local',
    first_name: 'Other',
    last_name: 'Tenant',
    role: 'tenant',
    phone: '9876500003',
  });
  const walkinUser = await db.User.create({
    ...userAttrs,
    email: 'walkin@test.vitastay.local',
    first_name: 'Walk',
    last_name: 'In',
    role: 'tenant',
    phone: '9876500004',
  });
  const extraWalkinUser = await db.User.create({
    ...userAttrs,
    email: 'walkin2@test.vitastay.local',
    first_name: 'Second',
    last_name: 'Walkin',
    role: 'tenant',
    phone: '9876500005',
  });
  const staffUser = await db.User.create({
    ...userAttrs,
    email: 'staff@test.vitastay.local',
    first_name: 'Test',
    last_name: 'Staff',
    role: 'staff',
    phone: '9876500006',
  });

  const hostel = await db.Hostel.create({
    owner_id: owner.id,
    name: 'Test Garden Hostel',
    code: 'NTEST01',
    address: '1 Test Street',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    total_floors: 3,
    capacity: 20,
    status: 'active',
    database_name: null,
    plan: 'silver',
    plan_status: 'comp',
    owner_kyc_status: 'verified',
    owner_kyc_verified_at: new Date(),
  });

  const pendingHostel = await db.Hostel.create({
    owner_id: owner.id,
    name: 'Pending Branch',
    code: `TAP${Date.now().toString(36).slice(-6)}`.slice(0, 12).toUpperCase(),
    address: '2 Pending Lane',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560002',
    total_floors: 2,
    status: 'pending_approval',
    database_name: null,
  });

  const doubleRoom = await db.Room.create({
    hostel_id: hostel.id,
    room_number: '101',
    floor: 1,
    room_type: 'double',
    sharing_type: 2,
    rent: 8000,
    status: 'vacant',
  });
  const singleRoom = await db.Room.create({
    hostel_id: hostel.id,
    room_number: '102',
    floor: 1,
    room_type: 'single',
    sharing_type: 1,
    rent: 12000,
    status: 'vacant',
  });

  const bed101a = await db.Bed.create({ room_id: doubleRoom.id, bed_number: '1', status: 'vacant' });
  const bed101b = await db.Bed.create({ room_id: doubleRoom.id, bed_number: '2', status: 'vacant' });
  const bed102a = await db.Bed.create({ room_id: singleRoom.id, bed_number: '1', status: 'vacant' });

  const tenant = await db.Tenant.create({
    user_id: tenantUser.id,
    hostel_id: hostel.id,
    full_name: 'Test Tenant',
    monthly_rent: 8000,
    status: 'active',
  });
  const otherTenant = await db.Tenant.create({
    user_id: otherTenantUser.id,
    hostel_id: hostel.id,
    full_name: 'Other Tenant',
    monthly_rent: 7000,
    status: 'active',
  });
  const walkin = await db.Tenant.create({
    user_id: walkinUser.id,
    hostel_id: hostel.id,
    full_name: 'Walk In',
    monthly_rent: 8000,
    status: 'active',
  });
  const extraWalkin = await db.Tenant.create({
    user_id: extraWalkinUser.id,
    hostel_id: hostel.id,
    full_name: 'Second Walkin',
    monthly_rent: 8000,
    status: 'active',
  });
  const staff = await db.Staff.create({
    user_id: staffUser.id,
    hostel_id: hostel.id,
    staff_role: 'maintenance',
    employee_id: 'EMPTEST',
    status: 'active',
  });

  const pendingRent = await db.RentPayment.create({
    tenant_id: tenant.id,
    hostel_id: hostel.id,
    amount: 8000,
    total_amount: 8000,
    paid_amount: 0,
    due_date: dayjs().date(5).format('YYYY-MM-DD'),
    status: 'pending',
    receipt_number: generateReceiptNumber(),
    invoice_number: generateInvoiceNumber(),
    month_year: dayjs().format('YYYY-MM'),
  });
  await db.RentPayment.create({
    tenant_id: otherTenant.id,
    hostel_id: hostel.id,
    amount: 7000,
    total_amount: 7000,
    paid_amount: 0,
    due_date: dayjs().date(5).format('YYYY-MM-DD'),
    status: 'pending',
    receipt_number: generateReceiptNumber(),
    invoice_number: generateInvoiceNumber(),
    month_year: dayjs().format('YYYY-MM'),
  });

  return {
    password: PASSWORD,
    superAdmin,
    owner,
    tenantUser,
    otherTenantUser,
    hostel,
    pendingHostel,
    doubleRoom,
    singleRoom,
    bed101a,
    bed101b,
    bed102a,
    tenant,
    otherTenant,
    walkin,
    extraWalkin,
    staffUser,
    staff,
    pendingRent,
  };
};

module.exports = { PASSWORD, assertSafeTestDatabase, resetAndSeed };
