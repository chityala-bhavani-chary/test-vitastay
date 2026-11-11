module.exports = (sequelize, DataTypes) => {
  const CommuteCache = sequelize.define('CommuteCache', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    cache_key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    origin_label: DataTypes.STRING(255),
    origin_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    origin_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    mode: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'driving' },
    status: { type: DataTypes.ENUM('ok', 'unavailable'), allowNull: false },
    duration_seconds: DataTypes.INTEGER.UNSIGNED,
    distance_meters: DataTypes.INTEGER.UNSIGNED,
    duration_text: DataTypes.STRING(64),
    distance_text: DataTypes.STRING(64),
    message: DataTypes.STRING(255),
    provider: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'google' },
    fetched_at: { type: DataTypes.DATE, allowNull: false },
  }, {
    tableName: 'commute_cache',
    paranoid: false,
  });

  return CommuteCache;
};
