module.exports = (sequelize, DataTypes) => {
  const Booking = sequelize.define('Booking', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    seeker_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    room_id: DataTypes.INTEGER.UNSIGNED,
    bed_id: DataTypes.INTEGER.UNSIGNED,
    room_type: DataTypes.STRING(32),
    move_in_date: { type: DataTypes.DATEONLY, allowNull: false },
    stay_type: { type: DataTypes.ENUM('monthly', 'daily'), allowNull: false, defaultValue: 'monthly' },
    status: {
      type: DataTypes.ENUM(
        'requested',
        'held',
        'awaiting_approval',
        'confirmed',
        'rejected',
        'cancelled',
        'expired'
      ),
      allowNull: false,
      defaultValue: 'requested',
    },
    hold_expires_at: DataTypes.DATE,
    amount_due: DataTypes.DECIMAL(10, 2),
    deposit_due: DataTypes.DECIMAL(10, 2),
    payment_status: {
      type: DataTypes.ENUM('none', 'pending', 'paid', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'none',
    },
    gateway_order_id: DataTypes.STRING(64),
    erp_tenant_id: DataTypes.INTEGER.UNSIGNED,
    cancel_reason: DataTypes.STRING(500),
    reject_reason: DataTypes.STRING(500),
    decided_by: DataTypes.INTEGER.UNSIGNED,
    decided_at: DataTypes.DATE,
    listing_name: DataTypes.STRING(255),
    listing_code: DataTypes.STRING(50),
    booking_model: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'approval_first' },
    advance_percent: DataTypes.DECIMAL(5, 2),
  }, {
    tableName: 'bookings',
    paranoid: false,
    indexes: [
      { name: 'idx_bookings_seeker', fields: ['seeker_user_id', 'status'] },
      { name: 'idx_bookings_hostel', fields: ['hostel_id', 'status'] },
    ],
  });

  Booking.associate = (models) => {
    Booking.belongsTo(models.User, { foreignKey: 'seeker_user_id', as: 'seeker' });
    Booking.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return Booking;
};
