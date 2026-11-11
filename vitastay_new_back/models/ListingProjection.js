module.exports = (sequelize, DataTypes) => {
  const ListingProjection = sequelize.define('ListingProjection', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    code: DataTypes.STRING(50),
    name: { type: DataTypes.STRING(255), allowNull: false },
    city: { type: DataTypes.STRING(100), allowNull: false },
    area: DataTypes.STRING(120),
    state: DataTypes.STRING(100),
    amenities: { type: DataTypes.JSON, defaultValue: [] },
    occupancy_types: { type: DataTypes.JSON, defaultValue: [] },
    gender_policy: {
      type: DataTypes.ENUM('male', 'female', 'unisex'),
      allowNull: false,
      defaultValue: 'unisex',
    },
    stay_modes: { type: DataTypes.JSON, defaultValue: ['monthly'] },
    min_rent: DataTypes.DECIMAL(10, 2),
    max_rent: DataTypes.DECIMAL(10, 2),
    daily_rent: DataTypes.DECIMAL(10, 2),
    beds_available: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    rating_avg: DataTypes.DECIMAL(3, 2),
    rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    cover_url: DataTypes.STRING(500),
    cover_thumb_url: DataTypes.STRING(500),
    plan: {
      type: DataTypes.ENUM('regular', 'silver', 'gold'),
      allowNull: false,
      defaultValue: 'regular',
    },
    marketplace_ok: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    booking_model: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'approval_first' },
    advance_percent: DataTypes.DECIMAL(5, 2),
    has_360: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    has_food: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    has_ac: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    has_attached_bath: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    vita_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    refreshed_at: DataTypes.DATE,
  }, {
    tableName: 'listing_projections',
    paranoid: false,
    indexes: [
      { name: 'idx_listing_public_city', fields: ['is_public', 'city'] },
      { name: 'idx_listing_public_rent', fields: ['is_public', 'min_rent'] },
      { name: 'idx_listing_market_city', fields: ['marketplace_ok', 'is_public', 'city'] },
      { name: 'idx_listing_city', fields: ['city'] },
      { name: 'idx_listing_filter_essentials', fields: ['is_public', 'has_food', 'has_ac', 'has_attached_bath', 'gender_policy'] },
    ],
  });

  ListingProjection.associate = (models) => {
    ListingProjection.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return ListingProjection;
};
