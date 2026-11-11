module.exports = (sequelize, DataTypes) => {
  const StaffLeave = sequelize.define('StaffLeave', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    staff_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    leave_type: { type: DataTypes.ENUM('casual', 'sick', 'earned', 'unpaid'), defaultValue: 'casual' },
    reason: DataTypes.TEXT,
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
    approved_by: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'staff_leaves', createdAt: 'created_at', updatedAt: false });

  StaffLeave.associate = (models) => {
    StaffLeave.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
  };

  return StaffLeave;
};
