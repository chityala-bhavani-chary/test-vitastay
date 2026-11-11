module.exports = (sequelize, DataTypes) => {
  const HostelBlock = sequelize.define('HostelBlock', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: DataTypes.TEXT,
    total_floors: { type: DataTypes.INTEGER, defaultValue: 1 },
  }, { tableName: 'hostel_blocks' });

  HostelBlock.associate = (models) => {
    HostelBlock.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    HostelBlock.hasMany(models.Room, { foreignKey: 'block_id', as: 'rooms' });
  };

  return HostelBlock;
};
