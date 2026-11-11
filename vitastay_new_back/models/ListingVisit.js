module.exports = (sequelize, DataTypes) => {
  const ListingVisit = sequelize.define('ListingVisit', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    slot_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    seeker_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    visit_mode: {
      type: DataTypes.ENUM('physical', 'video'),
      allowNull: false,
      defaultValue: 'physical',
    },
    status: {
      type: DataTypes.ENUM('requested', 'confirmed', 'cancelled', 'completed', 'no_show'),
      allowNull: false,
      defaultValue: 'requested',
    },
    video_url: DataTypes.STRING(500),
    seeker_note: DataTypes.STRING(500),
    owner_note: DataTypes.STRING(500),
    decided_at: DataTypes.DATE,
    decided_by: DataTypes.INTEGER.UNSIGNED,
  }, {
    tableName: 'listing_visits',
    paranoid: false,
    indexes: [
      { name: 'uq_visit_seeker_slot', unique: true, fields: ['seeker_id', 'slot_id'] },
    ],
  });

  ListingVisit.associate = (models) => {
    ListingVisit.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    ListingVisit.belongsTo(models.ListingVisitSlot, { foreignKey: 'slot_id', as: 'slot' });
    ListingVisit.belongsTo(models.User, { foreignKey: 'seeker_id', as: 'seeker' });
  };

  return ListingVisit;
};
