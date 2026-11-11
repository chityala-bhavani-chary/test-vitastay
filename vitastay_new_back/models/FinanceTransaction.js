module.exports = (sequelize, DataTypes) => {
  const FinanceTransaction = sequelize.define('FinanceTransaction', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    type: { type: DataTypes.ENUM('income', 'expense'), allowNull: false },
    category: { type: DataTypes.STRING(100), allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    reference_id: DataTypes.INTEGER.UNSIGNED,
    reference_type: DataTypes.STRING(50),
    transaction_date: { type: DataTypes.DATEONLY, allowNull: false },
    description: DataTypes.TEXT,
    created_by: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'finance_transactions', updatedAt: false });

  FinanceTransaction.associate = (models) => {
    FinanceTransaction.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return FinanceTransaction;
};
