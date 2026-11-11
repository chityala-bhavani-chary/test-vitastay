module.exports = (sequelize, DataTypes) => {
  const BedAssignment = sequelize.define('BedAssignment', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    bed_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    assigned_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    vacated_at: DataTypes.DATE,
    status: { type: DataTypes.ENUM('active', 'vacated', 'transferred'), defaultValue: 'active' },
    notes: DataTypes.TEXT,
    assigned_by: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'bed_assignments', updatedAt: false });

  BedAssignment.associate = (models) => {
    BedAssignment.belongsTo(models.Bed, { foreignKey: 'bed_id', as: 'bed' });
    BedAssignment.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  };

  return BedAssignment;
};
