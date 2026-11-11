module.exports = (sequelize, DataTypes) => {
  const ComplaintTimeline = sequelize.define('ComplaintTimeline', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    complaint_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    action: { type: DataTypes.STRING(100), allowNull: false },
    performed_by: DataTypes.INTEGER.UNSIGNED,
    notes: DataTypes.TEXT,
  }, { tableName: 'complaint_timeline', updatedAt: false });

  ComplaintTimeline.associate = (models) => {
    ComplaintTimeline.belongsTo(models.Complaint, { foreignKey: 'complaint_id', as: 'complaint' });
  };

  return ComplaintTimeline;
};
