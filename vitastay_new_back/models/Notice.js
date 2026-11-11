module.exports = (sequelize, DataTypes) => {
  const Notice = sequelize.define('Notice', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: DataTypes.INTEGER.UNSIGNED,
    title: { type: DataTypes.STRING(255), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.ENUM('announcement', 'emergency', 'event', 'festival', 'general'), defaultValue: 'general' },
    is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
    event_date: DataTypes.DATEONLY,
    expires_at: DataTypes.DATE,
    target_roles: DataTypes.JSON,
    created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  }, { tableName: 'notices' });

  Notice.associate = (models) => {
    Notice.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return Notice;
};
