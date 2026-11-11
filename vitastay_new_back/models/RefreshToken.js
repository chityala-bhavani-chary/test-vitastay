module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    token: { type: DataTypes.STRING(500), allowNull: false, unique: true },
    device_info: DataTypes.STRING(500),
    ip_address: DataTypes.STRING(45),
    user_agent: DataTypes.TEXT,
    expires_at: { type: DataTypes.DATE, allowNull: false },
    is_revoked: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { tableName: 'refresh_tokens', timestamps: true, updatedAt: false, paranoid: false });

  RefreshToken.associate = (models) => {
    RefreshToken.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return RefreshToken;
};
