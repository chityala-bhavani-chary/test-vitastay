module.exports = (sequelize, DataTypes) => {
  const Document = sequelize.define('Document', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    entity_type: { type: DataTypes.ENUM('tenant', 'staff', 'hostel', 'contract', 'rent_agreement', 'other'), allowNull: false },
    entity_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    file_type: DataTypes.STRING(50),
    file_size: DataTypes.INTEGER,
    description: DataTypes.TEXT,
    uploaded_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  }, { tableName: 'documents', updatedAt: false });

  return Document;
};
