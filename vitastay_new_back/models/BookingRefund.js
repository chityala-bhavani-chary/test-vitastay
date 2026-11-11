module.exports = (sequelize, DataTypes) => {
  const BookingRefund = sequelize.define('BookingRefund', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    booking_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    payment_order_id: DataTypes.INTEGER.UNSIGNED,
    provider: { type: DataTypes.STRING(32), allowNull: false },
    gateway_payment_id: DataTypes.STRING(64),
    gateway_refund_id: DataTypes.STRING(64),
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    retained_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    paid_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    reason: {
      type: DataTypes.ENUM('seeker_cancel', 'owner_reject', 'walkin_override'),
      allowNull: false,
    },
    kind: { type: DataTypes.ENUM('full', 'partial'), allowNull: false },
    policy_version: { type: DataTypes.STRING(32), allowNull: false },
    status: {
      type: DataTypes.ENUM('pending', 'processed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    payload: DataTypes.TEXT,
  }, {
    tableName: 'booking_refunds',
    indexes: [{ unique: true, fields: ['booking_id'] }],
  });

  BookingRefund.associate = (models) => {
    if (models.Booking) {
      BookingRefund.belongsTo(models.Booking, { foreignKey: 'booking_id', as: 'booking' });
    }
    if (models.Hostel) {
      BookingRefund.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    }
  };

  return BookingRefund;
};
