module.exports = (sequelize, DataTypes) => {
  const PaymentOrder = sequelize.define('PaymentOrder', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    rent_payment_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    booking_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    owner_invoice_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    order_type: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'rent' },
    provider: { type: DataTypes.STRING(32), allowNull: false },
    gateway_order_id: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    currency: { type: DataTypes.STRING(8), defaultValue: 'INR' },
    status: {
      type: DataTypes.ENUM('created', 'paid', 'failed', 'cancelled'),
      defaultValue: 'created',
    },
    gateway_payment_id: DataTypes.STRING(64),
    payment_method: DataTypes.STRING(32),
  }, { tableName: 'payment_orders' });

  PaymentOrder.associate = (models) => {
    PaymentOrder.belongsTo(models.RentPayment, { foreignKey: 'rent_payment_id', as: 'invoice' });
    PaymentOrder.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
    if (models.Booking) {
      PaymentOrder.belongsTo(models.Booking, { foreignKey: 'booking_id', as: 'booking' });
    }
  };

  return PaymentOrder;
};
