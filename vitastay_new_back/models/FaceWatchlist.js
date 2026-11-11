module.exports = (sequelize, DataTypes) => {
  const FaceWatchlist = sequelize.define('FaceWatchlist', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    label: { type: DataTypes.STRING(120), allowNull: true },
    reason: { type: DataTypes.STRING(500), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    embedding_cipher: { type: DataTypes.TEXT, allowNull: false },
    still_path: { type: DataTypes.STRING(500), allowNull: true },
    created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  }, {
    tableName: 'face_watchlist',
    paranoid: false,
    indexes: [{ name: 'idx_face_watch_hostel', fields: ['hostel_id'] }],
  });

  FaceWatchlist.associate = (models) => {
    FaceWatchlist.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return FaceWatchlist;
};
