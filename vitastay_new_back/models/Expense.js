module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define('Expense', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    category: { type: DataTypes.ENUM('electricity', 'water', 'internet', 'food', 'maintenance', 'salary', 'fuel', 'cleaning', 'purchase', 'other'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    description: DataTypes.TEXT,
    bill_path: DataTypes.STRING(500),
    expense_date: { type: DataTypes.DATEONLY, allowNull: false },
    vendor: DataTypes.STRING(255),
    payment_method: { type: DataTypes.ENUM('cash', 'upi', 'card', 'bank', 'cheque'), defaultValue: 'cash' },
    reference_number: DataTypes.STRING(100),
    created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    approved_by: DataTypes.INTEGER.UNSIGNED,
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'approved' },
  }, { tableName: 'expenses' });

  Expense.associate = (models) => {
    Expense.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return Expense;
};
