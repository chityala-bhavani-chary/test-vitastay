module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define('Room', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    block_id: DataTypes.INTEGER.UNSIGNED,
    room_number: { type: DataTypes.STRING(20), allowNull: false },
    floor: { type: DataTypes.INTEGER, defaultValue: 1 },
    room_type: { type: DataTypes.ENUM('single', 'double', 'triple', 'dormitory'), allowNull: false },
    sharing_type: { type: DataTypes.INTEGER, defaultValue: 1 },
    is_ac: { type: DataTypes.BOOLEAN, defaultValue: false },
    has_attached_bath: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    rent: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: { type: DataTypes.ENUM('occupied', 'vacant', 'maintenance', 'reserved'), defaultValue: 'vacant' },
    cleaning_status: { type: DataTypes.ENUM('clean', 'dirty', 'in_progress'), defaultValue: 'clean' },
    maintenance_status: { type: DataTypes.ENUM('none', 'pending', 'in_progress', 'completed'), defaultValue: 'none' },
    images: DataTypes.JSON,
    description: DataTypes.TEXT,
  }, { tableName: 'rooms' });

  Room.associate = (models) => {
    Room.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    Room.belongsTo(models.HostelBlock, { foreignKey: 'block_id', as: 'block' });
    Room.hasMany(models.Bed, { foreignKey: 'room_id', as: 'beds' });
    Room.hasMany(models.Tenant, { foreignKey: 'room_id', as: 'tenants' });
  };

  return Room;
};
