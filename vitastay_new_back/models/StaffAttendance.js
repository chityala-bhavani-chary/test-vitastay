module.exports = (sequelize, DataTypes) => {
  const StaffAttendance = sequelize.define('StaffAttendance', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    staff_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    check_in: DataTypes.TIME,
    check_out: DataTypes.TIME,
    status: { type: DataTypes.ENUM('present', 'absent', 'late', 'half_day', 'leave'), defaultValue: 'present' },
    late_minutes: { type: DataTypes.INTEGER, defaultValue: 0 },
    remarks: DataTypes.TEXT,
    marked_by: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'staff_attendance', createdAt: 'created_at', updatedAt: 'updated_at' });

  StaffAttendance.associate = (models) => {
    StaffAttendance.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
  };

  return StaffAttendance;
};
