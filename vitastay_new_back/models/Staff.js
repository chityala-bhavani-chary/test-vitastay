module.exports = (sequelize, DataTypes) => {
  const Staff = sequelize.define('Staff', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    staff_role: { type: DataTypes.ENUM('reception', 'cleaner', 'security', 'cook', 'maintenance', 'other'), allowNull: false },
    employee_id: DataTypes.STRING(50),
    salary: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    join_date: DataTypes.DATEONLY,
    address: DataTypes.TEXT,
    emergency_contact: DataTypes.STRING(20),
    status: { type: DataTypes.ENUM('active', 'inactive', 'terminated'), defaultValue: 'active' },
  }, { tableName: 'staff' });

  Staff.associate = (models) => {
    Staff.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Staff.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    Staff.hasMany(models.StaffAttendance, { foreignKey: 'staff_id', as: 'attendance' });
    Staff.hasMany(models.StaffLeave, { foreignKey: 'staff_id', as: 'leaves' });
  };

  return Staff;
};
