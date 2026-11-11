module.exports = (sequelize, DataTypes) => {
  const InventoryTransaction = sequelize.define('InventoryTransaction', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    item_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    type: { type: DataTypes.ENUM('in', 'out', 'adjustment', 'damage'), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    previous_quantity: DataTypes.INTEGER,
    new_quantity: DataTypes.INTEGER,
    remarks: DataTypes.TEXT,
    performed_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  }, { tableName: 'inventory_transactions', updatedAt: false });

  InventoryTransaction.associate = (models) => {
    InventoryTransaction.belongsTo(models.InventoryItem, { foreignKey: 'item_id', as: 'item' });
  };

  return InventoryTransaction;
};
