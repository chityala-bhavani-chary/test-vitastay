module.exports = (sequelize, DataTypes) => {
  const Wishlist = sequelize.define('Wishlist', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  }, {
    tableName: 'wishlists',
    paranoid: false,
    indexes: [
      { name: 'uq_wishlists_user_hostel', unique: true, fields: ['user_id', 'hostel_id'] },
      { name: 'idx_wishlists_user', fields: ['user_id', 'created_at'] },
    ],
  });

  Wishlist.associate = (models) => {
    Wishlist.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Wishlist.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return Wishlist;
};
