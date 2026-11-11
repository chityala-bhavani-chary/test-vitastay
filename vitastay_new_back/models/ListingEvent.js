module.exports = (sequelize, DataTypes) => {
  const ListingEvent = sequelize.define('ListingEvent', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    event_type: {
      type: DataTypes.ENUM(
        'listing_view',
        'gallery_tab',
        'pano_open',
        'video_open',
        'booking_started',
        'booking_paid',
        'booking_cancelled',
        'listing_share_copy',
        'listing_share_whatsapp',
        'listing_share_native'
      ),
      allowNull: false,
    },
    session_hash: { type: DataTypes.STRING(32), allowNull: true },
    tab_key: { type: DataTypes.STRING(32), allowNull: true },
    media_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    booking_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  }, {
    tableName: 'listing_events',
    updatedAt: false,
    paranoid: false,
    indexes: [
      { name: 'idx_listing_events_hostel_type', fields: ['hostel_id', 'event_type', 'created_at'] },
      { name: 'idx_listing_events_session', fields: ['session_hash', 'event_type'] },
      { name: 'uq_listing_events_booking_type', unique: true, fields: ['booking_id', 'event_type'] },
    ],
  });

  ListingEvent.associate = (models) => {
    ListingEvent.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return ListingEvent;
};
