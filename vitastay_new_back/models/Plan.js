module.exports = (sequelize, DataTypes) => {
  const Plan = sequelize.define('Plan', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    code: {
      type: DataTypes.ENUM('regular', 'silver', 'gold'),
      allowNull: false,
      unique: true,
    },
    name: { type: DataTypes.STRING(32), allowNull: false },
    monthly_inr: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    yearly_inr: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    yearly_discount_pct: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    gst_pct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 18 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'plans',
    paranoid: false,
  });

  return Plan;
};
