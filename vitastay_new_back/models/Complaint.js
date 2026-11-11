module.exports = (sequelize, DataTypes) => {
  const Complaint = sequelize.define('Complaint', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    room_id: DataTypes.INTEGER.UNSIGNED,
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.ENUM('room', 'electric', 'plumbing', 'cleaning', 'food', 'security', 'other'), defaultValue: 'other' },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'), defaultValue: 'medium' },
    status: { type: DataTypes.ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected'), defaultValue: 'open' },
    assigned_to: DataTypes.INTEGER.UNSIGNED,
    images: DataTypes.JSON,
    resolution: DataTypes.TEXT,
    resolved_at: DataTypes.DATE,
    resolved_by: DataTypes.INTEGER.UNSIGNED,
    rating: DataTypes.INTEGER,
    feedback: DataTypes.TEXT,
  }, { tableName: 'complaints' });

  Complaint.associate = (models) => {
    Complaint.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    Complaint.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
    Complaint.belongsTo(models.Room, { foreignKey: 'room_id', as: 'room' });
    Complaint.hasMany(models.ComplaintTimeline, { foreignKey: 'complaint_id', as: 'timeline' });
  };

  return Complaint;
};
