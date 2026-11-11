module.exports = (sequelize, DataTypes) => {
  const ListingWaitlist = sequelize.define('ListingWaitlist', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    room_type: { type: DataTypes.STRING(32), allowNull: false },
    notify_email: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notify_whatsapp: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    phone: DataTypes.STRING(20),
    status: {
      type: DataTypes.ENUM('active', 'notified', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'active',
    },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    notified_at: DataTypes.DATE,
  }, {
    tableName: 'listing_waitlist',
    paranoid: false,
    indexes: [
      { name: 'uq_waitlist_user_hostel_type', unique: true, fields: ['user_id', 'hostel_id', 'room_type'] },
      { name: 'idx_waitlist_hostel_type_status', fields: ['hostel_id', 'room_type', 'status'] },
      { name: 'idx_waitlist_expires', fields: ['status', 'expires_at'] },
    ],
  });

  ListingWaitlist.associate = (models) => {
    ListingWaitlist.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    ListingWaitlist.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return ListingWaitlist;
};
