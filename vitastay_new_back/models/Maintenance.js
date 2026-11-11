module.exports = (sequelize, DataTypes) => {
  const Maintenance = sequelize.define('Maintenance', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    room_id: DataTypes.INTEGER.UNSIGNED,
    type: { type: DataTypes.ENUM('room_repair', 'electric', 'plumbing', 'painting', 'furniture', 'other'), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: DataTypes.TEXT,
    status: { type: DataTypes.ENUM('pending', 'scheduled', 'in_progress', 'completed', 'cancelled'), defaultValue: 'pending' },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'), defaultValue: 'medium' },
    vendor: DataTypes.STRING(255),
    cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    scheduled_date: DataTypes.DATEONLY,
    completed_date: DataTypes.DATEONLY,
    images: DataTypes.JSON,
    notes: DataTypes.TEXT,
    created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    assigned_to: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'maintenance' });

  Maintenance.associate = (models) => {
    Maintenance.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    Maintenance.belongsTo(models.Room, { foreignKey: 'room_id', as: 'room' });
  };

  return Maintenance;
};
