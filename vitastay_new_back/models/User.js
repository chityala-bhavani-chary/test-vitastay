module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('super_admin', 'owner', 'supervisor', 'tenant', 'staff', 'seeker'), defaultValue: 'tenant' },
    first_name: { type: DataTypes.STRING(100), allowNull: false },
    last_name: { type: DataTypes.STRING(100), allowNull: false },
    phone: DataTypes.STRING(20),
    avatar: DataTypes.STRING(500),
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_locked: { type: DataTypes.BOOLEAN, defaultValue: false },
    email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    last_login: DataTypes.DATE,
    password_changed_at: DataTypes.DATE,
  }, {
    tableName: 'users',
    indexes: [{ fields: ['role'] }, { fields: ['email'] }],
  });

  User.associate = (models) => {
    User.hasOne(models.Tenant, { foreignKey: 'user_id', as: 'tenantProfile' });
    User.hasOne(models.Staff, { foreignKey: 'user_id', as: 'staffProfile' });
    User.hasMany(models.Hostel, { foreignKey: 'owner_id', as: 'ownedHostels' });
    User.hasMany(models.RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
    User.hasMany(models.LoginHistory, { foreignKey: 'user_id', as: 'loginHistory' });
    User.hasMany(models.Notification, { foreignKey: 'user_id', as: 'notifications' });
    User.belongsToMany(models.Hostel, { through: models.SupervisorHostel, foreignKey: 'supervisor_id', as: 'supervisedHostels' });
    if (models.Booking) {
      User.hasMany(models.Booking, { foreignKey: 'seeker_user_id', as: 'bookings' });
    }
  };

  return User;
};
