module.exports = (sequelize, DataTypes) => {
  const FaceEvent = sequelize.define('FaceEvent', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    label: {
      type: DataTypes.ENUM('known_resident', 'known_staff', 'blocked', 'unknown'),
      allowNull: false,
    },
    confidence: { type: DataTypes.DECIMAL(7, 6), allowNull: false, defaultValue: 0 },
    threshold: { type: DataTypes.DECIMAL(7, 6), allowNull: false },
    match_enrollment_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    match_watchlist_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    still_path: { type: DataTypes.STRING(500), allowNull: true },
    gate: { type: DataTypes.STRING(80), allowNull: true },
    captured_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    acked_at: { type: DataTypes.DATE, allowNull: true },
    acked_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    ack_note: { type: DataTypes.STRING(500), allowNull: true },
    notified_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'face_events',
    paranoid: false,
    updatedAt: false,
    indexes: [{ name: 'idx_face_events_hostel', fields: ['hostel_id', 'created_at'] }],
  });

  FaceEvent.associate = (models) => {
    FaceEvent.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return FaceEvent;
};
