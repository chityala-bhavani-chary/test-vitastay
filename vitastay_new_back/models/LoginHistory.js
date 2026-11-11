module.exports = (sequelize, DataTypes) => {
  const LoginHistory = sequelize.define('LoginHistory', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    ip_address: DataTypes.STRING(45),
    device_info: DataTypes.STRING(500),
    user_agent: DataTypes.TEXT,
    status: { type: DataTypes.ENUM('success', 'failed', 'locked'), allowNull: false },
    failure_reason: DataTypes.STRING(255),
    login_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { tableName: 'login_history', timestamps: false, paranoid: false });

  LoginHistory.associate = (models) => {
    LoginHistory.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return LoginHistory;
};
