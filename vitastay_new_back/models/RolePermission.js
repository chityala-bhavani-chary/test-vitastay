module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define('RolePermission', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    role: { type: DataTypes.ENUM('owner', 'supervisor', 'tenant', 'staff'), allowNull: false },
    permission_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  }, { tableName: 'role_permissions', timestamps: false, paranoid: false });

  RolePermission.associate = (models) => {
    RolePermission.belongsTo(models.Permission, { foreignKey: 'permission_id' });
  };

  return RolePermission;
};
