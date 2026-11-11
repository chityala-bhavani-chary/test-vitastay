module.exports = (sequelize, DataTypes) => {
  const Setting = sequelize.define('Setting', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: DataTypes.INTEGER.UNSIGNED,
    group: { type: DataTypes.STRING(50), defaultValue: 'general', field: 'group' },
    key: { type: DataTypes.STRING(100), allowNull: false, field: 'key' },
    value: DataTypes.TEXT,
    type: { type: DataTypes.ENUM('string', 'number', 'boolean', 'json'), defaultValue: 'string' },
    description: DataTypes.STRING(255),
  }, { tableName: 'settings' });

  Setting.associate = (models) => {
    Setting.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return Setting;
};
