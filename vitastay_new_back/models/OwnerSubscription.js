module.exports = (sequelize, DataTypes) => {
  const OwnerSubscription = sequelize.define('OwnerSubscription', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    plan_code: {
      type: DataTypes.ENUM('regular', 'silver', 'gold'),
      allowNull: false,
    },
    period: {
      type: DataTypes.ENUM('month', 'year'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'grace', 'cancelled', 'lapsed', 'comp'),
      allowNull: false,
      defaultValue: 'pending',
    },
    starts_at: DataTypes.DATE,
    expires_at: DataTypes.DATE,
    grace_ends_at: DataTypes.DATE,
    amount_ex_gst: DataTypes.DECIMAL(10, 2),
    gst_pct: DataTypes.DECIMAL(5, 2),
    gst_amount: DataTypes.DECIMAL(10, 2),
    amount_inc_gst: DataTypes.DECIMAL(10, 2),
    created_by: DataTypes.INTEGER.UNSIGNED,
    notes: DataTypes.STRING(500),
  }, {
    tableName: 'owner_subscriptions',
    paranoid: false,
    indexes: [
      { name: 'idx_owner_subs_hostel', fields: ['hostel_id', 'status'] },
    ],
  });

  OwnerSubscription.associate = (models) => {
    OwnerSubscription.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    OwnerSubscription.hasMany(models.OwnerInvoice, { foreignKey: 'subscription_id', as: 'invoices' });
  };

  return OwnerSubscription;
};
