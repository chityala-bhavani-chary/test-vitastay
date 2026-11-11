module.exports = (sequelize, DataTypes) => {
  const OtpVerification = sequelize.define('OtpVerification', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    otp: { type: DataTypes.STRING(10), allowNull: false },
    type: { type: DataTypes.ENUM('password_reset', 'email_verify', 'login', 'phone_verify'), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    is_used: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { tableName: 'otp_verifications', timestamps: true, updatedAt: false, paranoid: false });

  return OtpVerification;
};
