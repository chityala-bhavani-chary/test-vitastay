module.exports = (sequelize, DataTypes) => {
  const RentPayment = sequelize.define('RentPayment', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    room_id: DataTypes.INTEGER.UNSIGNED,
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    advance_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    deposit_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    penalty_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    paid_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    due_date: { type: DataTypes.DATEONLY, allowNull: false },
    original_due_date: { type: DataTypes.DATEONLY, allowNull: true },
    extension_days: { type: DataTypes.INTEGER, defaultValue: 0 },
    extension_charge: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    paid_date: DataTypes.DATEONLY,
    payment_method: { type: DataTypes.ENUM('cash', 'upi', 'card', 'bank', 'online'), defaultValue: 'cash' },
    payment_reference: DataTypes.STRING(255),
    status: { type: DataTypes.ENUM('pending', 'partial', 'paid', 'overdue', 'cancelled'), defaultValue: 'pending' },
    receipt_number: { type: DataTypes.STRING(50), unique: true },
    invoice_number: { type: DataTypes.STRING(50), unique: true },
    month_year: { type: DataTypes.STRING(7), allowNull: false },
    notes: DataTypes.TEXT,
    collected_by: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'rent_payments' });

  RentPayment.associate = (models) => {
    RentPayment.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
    RentPayment.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    RentPayment.belongsTo(models.Room, { foreignKey: 'room_id', as: 'room' });
  };

  return RentPayment;
};
