module.exports = (sequelize, DataTypes) => {
  const Tenant = sequelize.define('Tenant', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    room_id: DataTypes.INTEGER.UNSIGNED,
    bed_id: DataTypes.INTEGER.UNSIGNED,
    employee_id: DataTypes.STRING(50),
    full_name: DataTypes.STRING(255),
    photo: DataTypes.STRING(500),
    date_of_birth: DataTypes.DATEONLY,
    gender: { type: DataTypes.ENUM('male', 'female', 'other'), allowNull: true },
    blood_group: DataTypes.STRING(10),
    nationality: { type: DataTypes.STRING(100), defaultValue: 'Indian' },
    marital_status: {
      type: DataTypes.ENUM('single', 'married', 'divorced', 'widowed', 'other'),
      allowNull: true,
    },
    alternate_phone: DataTypes.STRING(20),
    permanent_address: DataTypes.TEXT,
    current_address: DataTypes.TEXT,
    same_as_permanent: { type: DataTypes.BOOLEAN, defaultValue: true },
    aadhar: DataTypes.STRING(20),
    pan: DataTypes.STRING(20),
    passport: DataTypes.STRING(20),
    driving_license: DataTypes.STRING(20),
    voter_id: DataTypes.STRING(30),
    emergency_contact_name: DataTypes.STRING(100),
    emergency_contact_phone: DataTypes.STRING(20),
    emergency_contact_relation: DataTypes.STRING(50),
    emergency_contact_alternate: DataTypes.STRING(20),
    emergency_contact_address: DataTypes.TEXT,
    guardian_name: DataTypes.STRING(100),
    guardian_phone: DataTypes.STRING(20),
    guardian_email: DataTypes.STRING(255),
    guardian_occupation: DataTypes.STRING(100),
    guardian_address: DataTypes.TEXT,
    is_student: { type: DataTypes.BOOLEAN, defaultValue: false },
    company: DataTypes.STRING(255),
    college: DataTypes.STRING(255),
    medical_conditions: DataTypes.TEXT,
    address: DataTypes.TEXT,
    city: DataTypes.STRING(100),
    state: DataTypes.STRING(100),
    pincode: DataTypes.STRING(10),
    move_in_date: DataTypes.DATEONLY,
    move_out_date: DataTypes.DATEONLY,
    deposit_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    advance_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    monthly_rent: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    rent_due_day: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    next_rent_due_date: { type: DataTypes.DATEONLY, allowNull: true },
    status: { type: DataTypes.ENUM('active', 'inactive', 'moved_out', 'pending'), defaultValue: 'pending' },
  }, { tableName: 'tenants' });

  Tenant.associate = (models) => {
    Tenant.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Tenant.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    Tenant.belongsTo(models.Room, { foreignKey: 'room_id', as: 'room' });
    Tenant.belongsTo(models.Bed, { foreignKey: 'bed_id', as: 'bed' });
    Tenant.hasMany(models.TenantDocument, { foreignKey: 'tenant_id', as: 'documents' });
    Tenant.hasMany(models.RentPayment, { foreignKey: 'tenant_id', as: 'rentPayments' });
    Tenant.hasMany(models.Visitor, { foreignKey: 'tenant_id', as: 'visitors' });
    Tenant.hasMany(models.Complaint, { foreignKey: 'tenant_id', as: 'complaints' });
    Tenant.hasMany(models.BedAssignment, { foreignKey: 'tenant_id', as: 'bedAssignments' });
  };

  return Tenant;
};
