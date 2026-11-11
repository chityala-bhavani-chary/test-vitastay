const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    define: dbConfig.define,
  }
);

const db = { sequelize, Sequelize };

const models = [
  'User', 'RefreshToken', 'LoginHistory', 'OtpVerification', 'Permission', 'RolePermission',
  'Hostel', 'HostelBlock', 'Room', 'Bed', 'BedAssignment', 'Tenant', 'TenantDocument',
  'Staff', 'StaffAttendance', 'StaffLeave', 'RentPayment', 'Expense',
  'FinanceTransaction', 'Visitor', 'Complaint', 'ComplaintTimeline', 'Maintenance',
  'Notice', 'InventoryItem', 'InventoryTransaction', 'Document', 'Notification',
  'Setting', 'AuditLog', 'SupervisorHostel', 'PropertyMedia',
  'PaymentOrder', 'PaymentEvent', 'OccupancySnapshot', 'ListingProjection', 'ListingAvailability',
  'Booking', 'BookingRefund', 'ListingEvent', 'Wishlist',
  'CommuteCache', 'SeekerCommutePlace', 'ListingWaitlist',
  'ListingVisitSlot', 'ListingVisit',
  'Plan', 'OwnerSubscription', 'OwnerInvoice', 'FaceEnrollment', 'FaceWatchlist', 'FaceEvent',
];

models.forEach((modelName) => {
  const factory = require(`./${modelName}`);
  db[modelName] = factory(sequelize, Sequelize.DataTypes);
});

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
