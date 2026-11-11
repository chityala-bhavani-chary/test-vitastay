module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define('Permission', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    module: { type: DataTypes.STRING(50), allowNull: false },
    action: { type: DataTypes.STRING(50), allowNull: false },
    description: DataTypes.STRING(255),
  }, { tableName: 'permissions', timestamps: true, updatedAt: false, paranoid: false });

  Permission.associate = (models) => {
    Permission.hasMany(models.RolePermission, { foreignKey: 'permission_id' });
  };

  return Permission;
};
