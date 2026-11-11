module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: DataTypes.INTEGER.UNSIGNED,
    action: { type: DataTypes.STRING(100), allowNull: false },
    entity_type: DataTypes.STRING(50),
    entity_id: DataTypes.INTEGER.UNSIGNED,
    old_values: DataTypes.JSON,
    new_values: DataTypes.JSON,
    ip_address: DataTypes.STRING(45),
    user_agent: DataTypes.TEXT,
  }, { tableName: 'audit_logs', updatedAt: false });

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return AuditLog;
};
