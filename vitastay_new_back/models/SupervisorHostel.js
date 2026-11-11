module.exports = (sequelize, DataTypes) => {
  const SupervisorHostel = sequelize.define('SupervisorHostel', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    supervisor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    assigned_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { tableName: 'supervisor_hostels', timestamps: false, paranoid: false });

  SupervisorHostel.associate = (models) => {
    SupervisorHostel.belongsTo(models.User, { foreignKey: 'supervisor_id', as: 'supervisor' });
    SupervisorHostel.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return SupervisorHostel;
};
