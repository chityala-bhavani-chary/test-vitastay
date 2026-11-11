module.exports = (sequelize, DataTypes) => {
  const PaymentEvent = sequelize.define('PaymentEvent', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    provider: { type: DataTypes.STRING(32), allowNull: false },
    provider_event_id: { type: DataTypes.STRING(128), allowNull: false },
    event_type: DataTypes.STRING(64),
    rent_payment_id: DataTypes.INTEGER.UNSIGNED,
    payload: DataTypes.TEXT,
  }, {
    tableName: 'payment_events',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['provider', 'provider_event_id'] }],
  });

  return PaymentEvent;
};
