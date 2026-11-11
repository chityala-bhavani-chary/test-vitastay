module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.ENUM('info', 'success', 'warning', 'error', 'rent', 'complaint', 'visitor', 'maintenance', 'announcement'), defaultValue: 'info' },
    channel: { type: DataTypes.ENUM('in_app', 'email', 'sms', 'whatsapp', 'push'), defaultValue: 'in_app' },
    is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
    data: DataTypes.JSON,
    read_at: DataTypes.DATE,
  }, { tableName: 'notifications', updatedAt: false });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return Notification;
};
