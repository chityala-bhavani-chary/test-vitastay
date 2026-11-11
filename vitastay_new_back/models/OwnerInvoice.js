module.exports = (sequelize, DataTypes) => {
  const OwnerInvoice = sequelize.define('OwnerInvoice', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    subscription_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    invoice_number: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    plan_code: {
      type: DataTypes.ENUM('regular', 'silver', 'gold'),
      allowNull: false,
    },
    period: {
      type: DataTypes.ENUM('month', 'year'),
      allowNull: false,
    },
    amount_ex_gst: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    gst_pct: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    gst_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    currency: { type: DataTypes.STRING(8), defaultValue: 'INR' },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'void'),
      allowNull: false,
      defaultValue: 'pending',
    },
    period_start: DataTypes.DATEONLY,
    period_end: DataTypes.DATEONLY,
    paid_at: DataTypes.DATE,
    payment_order_id: DataTypes.INTEGER.UNSIGNED,
  }, {
    tableName: 'owner_invoices',
    paranoid: false,
    indexes: [
      { name: 'idx_owner_invoices_hostel', fields: ['hostel_id', 'status'] },
    ],
  });

  OwnerInvoice.associate = (models) => {
    OwnerInvoice.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    OwnerInvoice.belongsTo(models.OwnerSubscription, { foreignKey: 'subscription_id', as: 'subscription' });
  };

  return OwnerInvoice;
};
