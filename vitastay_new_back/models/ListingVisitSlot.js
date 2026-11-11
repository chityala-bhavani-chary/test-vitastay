module.exports = (sequelize, DataTypes) => {
  const ListingVisitSlot = sequelize.define('ListingVisitSlot', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    starts_at: { type: DataTypes.DATE, allowNull: false },
    ends_at: { type: DataTypes.DATE, allowNull: false },
    visit_mode: {
      type: DataTypes.ENUM('physical', 'video'),
      allowNull: false,
      defaultValue: 'physical',
    },
    video_url: DataTypes.STRING(500),
    capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    status: {
      type: DataTypes.ENUM('open', 'cancelled'),
      allowNull: false,
      defaultValue: 'open',
    },
    created_by: DataTypes.INTEGER.UNSIGNED,
  }, {
    tableName: 'listing_visit_slots',
    paranoid: false,
  });

  ListingVisitSlot.associate = (models) => {
    ListingVisitSlot.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    ListingVisitSlot.hasMany(models.ListingVisit, { foreignKey: 'slot_id', as: 'visits' });
  };

  return ListingVisitSlot;
};
