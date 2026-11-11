module.exports = (sequelize, DataTypes) => {
  const Bed = sequelize.define('Bed', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    room_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    bed_number: { type: DataTypes.STRING(10), allowNull: false },
    status: { type: DataTypes.ENUM('vacant', 'occupied', 'reserved', 'maintenance'), defaultValue: 'vacant' },
    hold_expires_at: DataTypes.DATE,
  }, { tableName: 'beds' });

  Bed.associate = (models) => {
    Bed.belongsTo(models.Room, { foreignKey: 'room_id', as: 'room' });
    Bed.hasMany(models.BedAssignment, { foreignKey: 'bed_id', as: 'assignments' });
    Bed.hasOne(models.Tenant, { foreignKey: 'bed_id', as: 'currentTenant' });
  };

  return Bed;
};
