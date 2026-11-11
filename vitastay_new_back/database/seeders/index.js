require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User, Hostel, HostelBlock, Room, Bed, Tenant, Staff, RentPayment, Expense, Notice, InventoryItem, Setting } = require('../../models');
const { generateReceiptNumber, generateInvoiceNumber } = require('../../helpers/token');
const dayjs = require('dayjs');

const seed = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('db:seed uses sequelize.sync({ force: true }) and is forbidden in production');
    }
    await sequelize.sync({ force: true });
    console.log('Database synced');

    const password = await bcrypt.hash('Admin@123', 12);
    const superAdminPassword = await bcrypt.hash('Vita@2025', 12);

    await User.create({
      email: 'info@vitasystems.ai',
      password: superAdminPassword,
      first_name: 'Vita',
      last_name: 'Systems',
      phone: null,
      role: 'super_admin',
      email_verified: true,
    });

    const owner = await User.create({
      email: 'owner@vitastay.com',
      password,
      first_name: 'Rajesh',
      last_name: 'Kumar',
      phone: '9876543210',
      role: 'owner',
      email_verified: true,
    });

    const supervisor = await User.create({
      email: 'supervisor@vitastay.com',
      password,
      first_name: 'Priya',
      last_name: 'Sharma',
      phone: '9876543211',
      role: 'supervisor',
      email_verified: true,
    });

    const hostel = await Hostel.create({
      owner_id: owner.id,
      name: 'Vita Stay Premium Hostel',
      code: 'VPH001',
      description: 'Premium AC hostel with modern amenities',
      address: '123 MG Road, Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560034',
      latitude: 12.9352,
      longitude: 77.6245,
      total_floors: 4,
      capacity: 120,
      amenities: ['WiFi', 'AC', 'Laundry', 'Gym', 'CCTV', 'Power Backup'],
      features: {
        rooms: true,
        tenants: true,
        rent: true,
        expenses: true,
        visitors: true,
        complaints: true,
        maintenance: true,
        notices: true,
        staff: true,
        attendance: true,
        inventory: true,
        reports: true,
      },
      electricity_charge: 500,
      water_charge: 200,
      security_deposit: 10000,
      contact_phone: '9876543210',
      contact_email: 'info@vitastay.com',
      status: 'active',
    });

    await require('../../models').SupervisorHostel.create({
      supervisor_id: supervisor.id,
      hostel_id: hostel.id,
    });

    const blockA = await HostelBlock.create({ hostel_id: hostel.id, name: 'Block A', total_floors: 4 });
    const blockB = await HostelBlock.create({ hostel_id: hostel.id, name: 'Block B', total_floors: 3 });

    const roomTypes = [
      { room_number: '101', floor: 1, room_type: 'single', sharing_type: 1, is_ac: true, rent: 12000 },
      { room_number: '102', floor: 1, room_type: 'double', sharing_type: 2, is_ac: true, rent: 8000 },
      { room_number: '103', floor: 1, room_type: 'triple', sharing_type: 3, is_ac: false, rent: 6000 },
      { room_number: '201', floor: 2, room_type: 'double', sharing_type: 2, is_ac: true, rent: 8500 },
      { room_number: '202', floor: 2, room_type: 'dormitory', sharing_type: 6, is_ac: false, rent: 4500 },
    ];

    for (const roomData of roomTypes) {
      const room = await Room.create({ hostel_id: hostel.id, block_id: blockA.id, ...roomData, status: 'vacant' });
      for (let i = 1; i <= roomData.sharing_type; i++) {
        await Bed.create({ room_id: room.id, bed_number: String(i), status: 'vacant' });
      }
    }

    try {
      const { attachToHostel } = require('../../services/seedDemoMedia');
      const demo = await attachToHostel(hostel, owner);
      console.log(demo.message);
      try {
        await require('../../services/listingPublish').publishListing({ hostel, user: owner });
        console.log('Demo listing published');
      } catch (err) {
        console.log('Demo listing not auto-published:', err.message);
      }
    } catch (err) {
      console.log('Demo photos skipped:', err.message);
    }

    const tenantUser = await User.create({
      email: 'tenant@vitastay.com',
      password,
      first_name: 'Amit',
      last_name: 'Patel',
      phone: '9876543212',
      role: 'tenant',
      email_verified: true,
    });

    const room102 = await Room.findOne({ where: { room_number: '102', hostel_id: hostel.id } });
    const bed1 = await Bed.findOne({ where: { room_id: room102.id, bed_number: '1' } });

    const tenant = await Tenant.create({
      user_id: tenantUser.id,
      hostel_id: hostel.id,
      room_id: room102.id,
      bed_id: bed1.id,
      aadhar: '1234-5678-9012',
      emergency_contact_name: 'Suresh Patel',
      emergency_contact_phone: '9876543299',
      college: 'IIT Bangalore',
      blood_group: 'B+',
      move_in_date: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
      deposit_amount: 10000,
      advance_amount: 8000,
      monthly_rent: 8000,
      status: 'active',
    });

    await bed1.update({ status: 'occupied' });
    await room102.update({ status: 'occupied' });

    await Staff.create({
      user_id: supervisor.id,
      hostel_id: hostel.id,
      staff_role: 'reception',
      employee_id: 'EMP001',
      salary: 25000,
      join_date: dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
      status: 'active',
    });

    const staffUser = await User.create({
      email: 'staff@vitastay.com',
      password,
      first_name: 'Amit',
      last_name: 'Rao',
      phone: '9876543212',
      role: 'staff',
      email_verified: true,
    });
    await Staff.create({
      user_id: staffUser.id,
      hostel_id: hostel.id,
      staff_role: 'maintenance',
      employee_id: 'EMP002',
      salary: 18000,
      join_date: dayjs().subtract(6, 'month').format('YYYY-MM-DD'),
      status: 'active',
    });

    await RentPayment.create({
      tenant_id: tenant.id,
      hostel_id: hostel.id,
      room_id: room102.id,
      amount: 8000,
      total_amount: 8000,
      paid_amount: 8000,
      due_date: dayjs().subtract(1, 'month').date(5).format('YYYY-MM-DD'),
      paid_date: dayjs().subtract(1, 'month').date(3).format('YYYY-MM-DD'),
      payment_method: 'upi',
      status: 'paid',
      receipt_number: generateReceiptNumber(),
      invoice_number: generateInvoiceNumber(),
      month_year: dayjs().subtract(1, 'month').format('YYYY-MM'),
      collected_by: supervisor.id,
    });

    await RentPayment.create({
      tenant_id: tenant.id,
      hostel_id: hostel.id,
      room_id: room102.id,
      amount: 8000,
      total_amount: 8000,
      paid_amount: 0,
      due_date: dayjs().date(5).format('YYYY-MM-DD'),
      status: 'pending',
      receipt_number: generateReceiptNumber(),
      invoice_number: generateInvoiceNumber(),
      month_year: dayjs().format('YYYY-MM'),
    });

    await Expense.create({
      hostel_id: hostel.id,
      category: 'electricity',
      amount: 15000,
      description: 'Monthly electricity bill',
      expense_date: dayjs().format('YYYY-MM-DD'),
      created_by: owner.id,
    });

    await Notice.create({
      hostel_id: hostel.id,
      title: 'Welcome to Vita Stay Hostel',
      content: 'We are delighted to have you here. Please follow hostel rules.',
      type: 'announcement',
      created_by: owner.id,
    });

    await InventoryItem.create({
      hostel_id: hostel.id,
      name: 'Mattress - Single',
      category: 'mattress',
      quantity: 50,
      min_stock: 10,
      unit_price: 2500,
    });

    await Setting.bulkCreate([
      { group: 'company', key: 'name', value: 'Vita Stay Hostel Management', type: 'string' },
      { group: 'company', key: 'currency', value: 'INR', type: 'string' },
      { group: 'company', key: 'timezone', value: 'Asia/Kolkata', type: 'string' },
      { group: 'invoice', key: 'prefix', value: 'INV', type: 'string' },
      { group: 'invoice', key: 'tax_rate', value: '0', type: 'number' },
    ]);

    console.log('Seed data created successfully!');
    console.log('\n--- Login Credentials ---');
    console.log('Super Admin: info@vitasystems.ai / Vita@2025');
    console.log('Owner:       owner@vitastay.com / Admin@123');
    console.log('Supervisor:  supervisor@vitastay.com / Admin@123');
    console.log('Tenant:      tenant@vitastay.com / Admin@123');
    console.log('Staff:       staff@vitastay.com / Admin@123');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seed();
