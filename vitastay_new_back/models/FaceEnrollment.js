module.exports = (sequelize, DataTypes) => {
  const FaceEnrollment = sequelize.define('FaceEnrollment', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    person_type: {
      type: DataTypes.ENUM('resident', 'staff'),
      allowNull: false,
    },
    person_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    embedding_cipher: { type: DataTypes.TEXT, allowNull: false },
    consent_at: { type: DataTypes.DATE, allowNull: false },
    still_path: { type: DataTypes.STRING(500), allowNull: true },
    enrolled_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  }, {
    tableName: 'face_enrollments',
    paranoid: false,
    indexes: [
      { name: 'uq_face_enroll_person', unique: true, fields: ['hostel_id', 'person_type', 'person_id'] },
      { name: 'idx_face_enroll_hostel', fields: ['hostel_id'] },
    ],
  });

  FaceEnrollment.associate = (models) => {
    FaceEnrollment.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
  };

  return FaceEnrollment;
};
