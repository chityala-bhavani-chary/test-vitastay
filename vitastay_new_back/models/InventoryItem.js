module.exports = (sequelize, DataTypes) => {
  const InventoryItem = sequelize.define('InventoryItem', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    category: { type: DataTypes.ENUM('beds', 'mattress', 'chairs', 'fans', 'ac', 'tables', 'buckets', 'cleaning', 'other'), allowNull: false },
    quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
    min_stock: { type: DataTypes.INTEGER, defaultValue: 5 },
    unit: { type: DataTypes.STRING(20), defaultValue: 'pcs' },
    unit_price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    location: DataTypes.STRING(255),
    status: { type: DataTypes.ENUM('available', 'low_stock', 'out_of_stock'), defaultValue: 'available' },
  }, { tableName: 'inventory_items' });

  InventoryItem.associate = (models) => {
    InventoryItem.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    InventoryItem.hasMany(models.InventoryTransaction, { foreignKey: 'item_id', as: 'transactions' });
  };

  return InventoryItem;
};
