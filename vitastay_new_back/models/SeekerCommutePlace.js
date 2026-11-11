module.exports = (sequelize, DataTypes) => {
  const SeekerCommutePlace = sequelize.define('SeekerCommutePlace', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    label: { type: DataTypes.STRING(120), allowNull: false },
    address: DataTypes.STRING(500),
    latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  }, {
    tableName: 'seeker_commute_places',
    paranoid: false,
  });

  SeekerCommutePlace.associate = (models) => {
    SeekerCommutePlace.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return SeekerCommutePlace;
};
