module.exports = (sequelize, DataTypes) => {
  const TenantDocument = sequelize.define('TenantDocument', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    document_type: {
      type: DataTypes.ENUM('aadhar', 'pan', 'passport', 'driving_license', 'voter_id', 'rent_agreement', 'other'),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    id_number: DataTypes.STRING(100),
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    back_file_path: DataTypes.STRING(500),
    expiry_date: DataTypes.DATEONLY,
    file_size: DataTypes.INTEGER,
    mime_type: DataTypes.STRING(100),
    uploaded_by: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'tenant_documents', updatedAt: false });

  TenantDocument.associate = (models) => {
    TenantDocument.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  };

  return TenantDocument;
};
