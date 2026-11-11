module.exports = (sequelize, DataTypes) => {
  const OccupancySnapshot = sequelize.define('OccupancySnapshot', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    occupied_rooms: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    vacant_rooms: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    occupied_beds: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    vacant_beds: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    occupancy_rate: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    pending_rent: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    monthly_income: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    open_complaints: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    open_maintenance: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    visitors_today: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    computed_at: DataTypes.DATE,
  }, {
    tableName: 'occupancy_snapshots',
    paranoid: false,
  });

  OccupancySnapshot.associate = (models) => {
    OccupancySnapshot.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return OccupancySnapshot;
};
