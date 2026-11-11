module.exports = (sequelize, DataTypes) => {
  const Visitor = sequelize.define('Visitor', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    room_id: DataTypes.INTEGER.UNSIGNED,
    name: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    email: DataTypes.STRING(255),
    id_proof_type: { type: DataTypes.ENUM('aadhar', 'pan', 'passport', 'driving_license', 'voter_id', 'other'), allowNull: false },
    id_proof_number: { type: DataTypes.STRING(50), allowNull: false },
    photo: DataTypes.STRING(500),
    purpose: { type: DataTypes.TEXT, allowNull: false },
    in_time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    out_time: DataTypes.DATE,
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'checked_in', 'checked_out'), defaultValue: 'pending' },
    approved_by: DataTypes.INTEGER.UNSIGNED,
    approved_at: DataTypes.DATE,
    created_by: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'visitors' });

  Visitor.associate = (models) => {
    Visitor.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    Visitor.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
    Visitor.belongsTo(models.Room, { foreignKey: 'room_id', as: 'room' });
  };

  return Visitor;
};
