module.exports = (sequelize, DataTypes) => {
  const ListingAvailability = sequelize.define('ListingAvailability', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    room_type: { type: DataTypes.STRING(32), allowNull: false },
    beds_available: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    beds_reserved: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    beds_total: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    monthly_rent_from: DataTypes.DECIMAL(10, 2),
    is_ac: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    refreshed_at: DataTypes.DATE,
  }, {
    tableName: 'listing_availability',
    paranoid: false,
    indexes: [
      { unique: true, name: 'uq_listing_availability_hostel_type', fields: ['hostel_id', 'room_type'] },
      { name: 'idx_listing_availability_type_vacant', fields: ['room_type', 'beds_available'] },
    ],
  });

  ListingAvailability.associate = (models) => {
    ListingAvailability.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return ListingAvailability;
};
